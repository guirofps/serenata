import { inngest } from "../client.js";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { REMETENTE_RECUPERACAO, RESPONDER_PARA } from "../../emails/remetentes.js";
import {
  assuntoLembreteData,
  emailLembreteData,
  textoLembreteData,
} from "../../emails/lembrete-data.js";
import { registrarEnvio } from "../../src/lib/registro-email.js";
import { literalLike } from "../../src/lib/sql-like.js";
import { diasAte, hojeEmBrasilia } from "../../src/lib/datas-calendario.js";
import type { TipoData } from "../../src/lib/datas-especiais.js";

// O LEMBRETE DAS DATAS que ela cadastrou no editor ("me avise nessa data").
//
// Uma vez por dia, às 10h de Brasília: toda data que cai daqui a 10 dias
// ganha um e-mail, UM por data por ano (`avisado_ano`). Dez dias porque é o
// tempo de ela lembrar, decidir e ainda sobrar folga pra entrega.
//
// O botão vai pro atalho de cliente no editor dela (`#outra-musica`), a música
// extra com preço de quem já comprou, e não pro funil inteiro a preço cheio.
//
// Remetente de RECUPERAÇÃO (subdomínio): é convite pra comprar, mesmo que ela
// tenha pedido. O domínio raiz fica pro que ela pagou pra receber.

const SITE = process.env.VITE_APP_URL?.startsWith("http")
  ? process.env.VITE_APP_URL
  : "https://www.serenatagift.com";
const ANTECEDENCIA = 10;
const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

function db() {
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env ausente");
  return createClient(url, key, { auth: { persistSession: false } });
}

export const lembrarDatas = inngest.createFunction(
  { id: "lembrar-datas", retries: 1, triggers: [{ cron: "5 13 * * *" }] },
  async ({ step }) => {
    const hoje = hojeEmBrasilia();
    const ano = hoje.getUTCFullYear();

    const devidas = await step.run("datas-daqui-a-10-dias", async () => {
      const sb = db();
      const alvo = new Date(hoje.getTime() + ANTECEDENCIA * 86_400_000);
      // O mês do alvo e o anterior (29/02 lembrado no 28), e o filtro fino é o `diasAte`.
      const meses = [alvo.getUTCMonth() + 1, alvo.getUTCMonth() === 0 ? 12 : alvo.getUTCMonth()];
      const { data } = await sb
        .from("datas_especiais")
        .select("id, email, nome, tipo, dia, mes, avisado_ano")
        .in("mes", meses)
        .eq("locale", "pt");
      return (data ?? []).filter(
        (d) =>
          d.avisado_ano !== ano && diasAte(d.dia as number, d.mes as number, hoje) === ANTECEDENCIA,
      );
    });

    let enviados = 0;
    for (const d of devidas) {
      const ok = await step.run(`lembrar-${d.id}`, async () => {
        const chave = process.env.RESEND_API_KEY;
        if (!chave) return false;
        const sb = db();
        // Marca ANTES de mandar, condicionalmente: rodada repetida não manda dois.
        const { data: marcou } = await sb
          .from("datas_especiais")
          .update({ avisado_ano: ano })
          .eq("id", d.id)
          .or(`avisado_ano.is.null,avisado_ano.neq.${ano}`)
          .select("id");
        if (!marcou?.length) return false;

        // O editor mais recente dela: é onde mora o atalho de cliente.
        const { data: ped } = await sb
          .from("pedidos")
          .select("musica_id")
          .ilike("email", literalLike(d.email as string))
          .eq("status", "pago")
          .not("musica_id", "is", null)
          .order("paid_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        const { data: m } = ped?.musica_id
          ? await sb.from("musicas").select("token_edicao").eq("id", ped.musica_id).maybeSingle()
          : { data: null };
        const link = m?.token_edicao
          ? `${SITE}/editar/${m.token_edicao}?de=lembrete_data#outra-musica`
          : `${SITE}/criar?utm_source=lembrete_data&utm_medium=email`;

        const nome = String(d.nome);
        const tipo = d.tipo as TipoData;
        const dataTexto = `${d.dia} de ${MESES[(d.mes as number) - 1]}`;
        const { data: enviado, error } = await new Resend(chave).emails.send({
          tags: [{ name: "template", value: "lembrete_data" }],
          from: REMETENTE_RECUPERACAO,
          replyTo: RESPONDER_PARA,
          to: [d.email as string],
          subject: assuntoLembreteData(nome, tipo, ANTECEDENCIA),
          html: emailLembreteData({ nome, tipo, dias: ANTECEDENCIA, dataTexto, link }),
          text: textoLembreteData({ nome, tipo, dias: ANTECEDENCIA, link }),
        });
        if (error) {
          // Devolve a marca: amanhã não é mais "daqui a 10 dias", mas pelo
          // menos o registro não mente que avisou.
          await sb.from("datas_especiais").update({ avisado_ano: null }).eq("id", d.id);
          console.error("[lembrar-datas] envio falhou:", error.message);
          return false;
        }
        await registrarEnvio(sb, {
          emailId: enviado?.id,
          template: "lembrete_data",
          para: d.email as string,
        });
        return true;
      });
      if (ok) enviados += 1;
    }
    return { devidas: devidas.length, enviados };
  },
);
