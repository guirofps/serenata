import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { emailDaSessao } from "@/lib/conta-sessao";
import { conviteDaCompra, jaComprou } from "@/lib/indicacao-db";
import {
  PCT_COMISSAO,
  PCT_DESCONTO,
  SAQUE_MINIMO_CENTAVOS,
  chavePixAceitavel,
  gerarCodigo,
  linkDoConvite,
} from "@/lib/indicacao";

// O MEMBER GET MEMBER do lado de quem usa: o convidado na oferta e quem
// indica na área dele. As regras estão em `indicacao.ts`; o dinheiro, na
// migração `20260926000000_indicacao.sql`.
//
// NUNCA O E-MAIL COMO PARÂMETRO. Mesma regra de `meus-creditos`: server
// function é rota HTTP, e aceitar e-mail deixaria qualquer um ler o saldo de
// qualquer pessoa, ou pior, pedir o saque dela pra outra chave PIX. A única
// credencial aceita é a sessão assinada pelo Supabase.

/**
 * A oferta pergunta: esta sessão chegou por um convite que vale?
 *
 * Só diz SE vale e quanto é o desconto em porcentagem. O valor em reais a
 * tela calcula com o mesmo `descontoDoConvite` que o servidor usa na
 * cobrança, sobre o preço que ela já está mostrando.
 */
export const conviteDaSessao = createServerFn({ method: "POST" })
  .validator((data: { sessionId: string }) => data)
  .handler(async ({ data }): Promise<{ ok: true; pct: number } | { ok: false }> => {
    if (!data.sessionId) return { ok: false };
    const db = supabaseAdmin();
    const { data: quiz } = await db
      .from("quiz_responses")
      .select("email, attribution, locale")
      .eq("session_id", data.sessionId)
      .maybeSingle();
    if (!quiz) return { ok: false };
    const convite = await conviteDaCompra(db, {
      attribution: quiz.attribution,
      email: quiz.email as string | null,
      locale: quiz.locale as string | null,
    });
    return convite ? { ok: true, pct: PCT_DESCONTO } : { ok: false };
  });

export type MinhaIndicacao =
  | {
      ok: true;
      codigo: string;
      link: string;
      pctComissao: number;
      pctDesconto: number;
      minimoCentavos: number;
      pendenteCentavos: number;
      disponivelCentavos: number;
      sacadoCentavos: number;
      comissoes: Array<{
        quando: string;
        valorCentavos: number;
        liberaEm: string;
        estado: "a-liberar" | "liberada" | "estornada";
      }>;
      saques: Array<{
        quando: string;
        valorCentavos: number;
        status: "solicitado" | "pago" | "recusado";
      }>;
    }
  | { ok: false; motivo: "sem-sessao" | "sem-compra" | "erro" };

/**
 * O código desta pessoa, criado na primeira vez que ela abre a tela.
 *
 * Criado sob demanda, e não pra todo comprador de uma vez: 84% nunca fazem
 * login, e um código que ninguém vai ver é só uma linha a mais.
 */
async function codigoDe(
  db: ReturnType<typeof supabaseAdmin>,
  email: string,
): Promise<string | null> {
  const ler = async () =>
    (await db.from("indicacao_codigos").select("codigo").eq("email", email).maybeSingle()).data
      ?.codigo as string | undefined;
  const existente = await ler();
  if (existente) return existente;
  // Colisão é improvável (31^6 ≈ 887 milhões), mas o `unique` do banco é
  // quem garante; aqui só se tenta de novo. A outra colisão possível é a
  // mesma pessoa em duas abas: a segunda perde no `email` e lê a da primeira.
  for (let i = 0; i < 5; i++) {
    const { error } = await db.from("indicacao_codigos").insert({ email, codigo: gerarCodigo() });
    if (!error) break;
    if (error.code !== "23505") {
      console.error("[indicacao] criar código falhou:", error.message);
      return null;
    }
    const agora = await ler();
    if (agora) return agora;
  }
  return (await ler()) ?? null;
}

export const minhaIndicacao = createServerFn({ method: "POST" })
  .validator((data: { token: string }) => data)
  .handler(async ({ data }): Promise<MinhaIndicacao> => {
    const email = await emailDaSessao(data.token);
    if (!email) return { ok: false, motivo: "sem-sessao" };
    const db = supabaseAdmin();
    try {
      if (!(await jaComprou(db, email))) return { ok: false, motivo: "sem-compra" };
      const codigo = await codigoDe(db, email);
      if (!codigo) return { ok: false, motivo: "erro" };

      const [saldo, comissoes, saques] = await Promise.all([
        db.rpc("saldo_indicacao", { p_email: email }).maybeSingle(),
        db
          .from("indicacao_comissoes")
          .select("valor_centavos, libera_em, created_at, pedidos(status)")
          .eq("indicador_email", email)
          .order("created_at", { ascending: false })
          .limit(50),
        db
          .from("indicacao_saques")
          .select("valor_centavos, status, created_at")
          .eq("email", email)
          .order("created_at", { ascending: false })
          .limit(20),
      ]);
      const s = (saldo.data ?? {}) as Record<string, number | string | null>;
      const n = (v: unknown) => Number(v ?? 0) || 0;
      const agora = Date.now();

      return {
        ok: true,
        codigo,
        link: linkDoConvite(codigo),
        pctComissao: PCT_COMISSAO,
        pctDesconto: PCT_DESCONTO,
        minimoCentavos: SAQUE_MINIMO_CENTAVOS,
        pendenteCentavos: n(s.pendente_centavos),
        disponivelCentavos: n(s.disponivel_centavos),
        sacadoCentavos: n(s.sacado_centavos),
        // NENHUM DADO DO CONVIDADO. Quem indica vê que alguém comprou, quando
        // e quanto rendeu; não vê e-mail nem nome de quem usou o link. O
        // convidado não autorizou ninguém a saber que ele comprou.
        comissoes: (comissoes.data ?? []).map((c) => {
          const status = (c.pedidos as { status?: string } | null)?.status;
          return {
            quando: c.created_at as string,
            valorCentavos: c.valor_centavos as number,
            liberaEm: c.libera_em as string,
            estado:
              status !== "pago"
                ? ("estornada" as const)
                : new Date(c.libera_em as string).getTime() <= agora
                  ? ("liberada" as const)
                  : ("a-liberar" as const),
          };
        }),
        saques: (saques.data ?? []).map((q) => ({
          quando: q.created_at as string,
          valorCentavos: q.valor_centavos as number,
          status: q.status as "solicitado" | "pago" | "recusado",
        })),
      };
    } catch (err) {
      console.error("[indicacao] ler painel falhou:", (err as Error).message);
      return { ok: false, motivo: "erro" };
    }
  });

export type ResultadoSaque =
  | { ok: true; valorCentavos: number }
  | {
      ok: false;
      motivo: "sem-sessao" | "chave-invalida" | "saldo-insuficiente" | "saque-em-aberto" | "erro";
    };

export const pedirSaque = createServerFn({ method: "POST" })
  .validator((data: { token: string; chavePix: string }) => data)
  .handler(async ({ data }): Promise<ResultadoSaque> => {
    const email = await emailDaSessao(data.token);
    if (!email) return { ok: false, motivo: "sem-sessao" };
    const chave = chavePixAceitavel(data.chavePix);
    if (!chave) return { ok: false, motivo: "chave-invalida" };
    // A conta de quanto dá, a trava contra dois toques e o "um saque aberto
    // por vez" moram TODOS na função do banco, sob o mesmo lock. Conferir o
    // saldo aqui e gravar depois abriria a janela que o lock existe pra fechar.
    const { data: linha, error } = await supabaseAdmin()
      .rpc("pedir_saque_indicacao", { p_email: email, p_chave: chave })
      .single();
    if (error) {
      if (error.message.includes("saldo-insuficiente"))
        return { ok: false, motivo: "saldo-insuficiente" };
      if (error.message.includes("saque-em-aberto"))
        return { ok: false, motivo: "saque-em-aberto" };
      console.error("[indicacao] saque falhou:", error.message);
      return { ok: false, motivo: "erro" };
    }
    return {
      ok: true,
      valorCentavos: Number((linha as { valor_centavos?: number }).valor_centavos) || 0,
    };
  });
