import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/lib/supabase-admin";
export { diasAte, hojeEmBrasilia } from "@/lib/datas-calendario";

// DATAS QUE ELA NÃO PODE ESQUECER: aniversários e datas de namoro que ela
// cadastra no editor, pra gente avisar 10 dias antes (`lembrarDatas`).
//
// Aberto pelo `token_edicao`, a mesma prova de posse do resto do editor. A
// lista mora no E-MAIL de quem comprou: é dela, não da música, e aparece em
// qualquer presente que ela montar.

export type TipoData = "aniversario" | "namoro" | "outra";
export type DataEspecial = { id: string; nome: string; tipo: TipoData; dia: number; mes: number };

const MAX_POR_EMAIL = 20;

function valida(d: { nome?: unknown; tipo?: unknown; dia?: unknown; mes?: unknown }) {
  const nome = String(d.nome ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 40);
  const tipo: TipoData = d.tipo === "namoro" || d.tipo === "outra" ? d.tipo : "aniversario";
  const dia = Number(d.dia);
  const mes = Number(d.mes);
  if (!nome || !Number.isInteger(dia) || !Number.isInteger(mes)) return null;
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  const diasNoMes = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mes - 1];
  if (dia > diasNoMes) return null;
  return { nome, tipo, dia, mes };
}

/** O e-mail de quem comprou esta música: o do pedido pago, ou o do quiz. */
async function donoDoToken(tokenEdicao: string): Promise<{ email: string; locale: string } | null> {
  if (!tokenEdicao) return null;
  const db = supabaseAdmin();
  const { data: m } = await db
    .from("musicas")
    .select("id, quiz_response_id, locale")
    .eq("token_edicao", tokenEdicao)
    .maybeSingle();
  if (!m) return null;
  const { data: p } = await db
    .from("pedidos")
    .select("email")
    .eq("musica_id", m.id)
    .eq("status", "pago")
    .not("email", "is", null)
    .limit(1)
    .maybeSingle();
  let email = (p?.email as string | null) ?? null;
  if (!email && m.quiz_response_id) {
    const { data: q } = await db
      .from("quiz_responses")
      .select("email")
      .eq("id", m.quiz_response_id)
      .maybeSingle();
    email = (q?.email as string | null) ?? null;
  }
  return email
    ? { email: email.trim().toLowerCase(), locale: (m.locale as string) === "es" ? "es" : "pt" }
    : null;
}

async function lista(email: string): Promise<DataEspecial[]> {
  const { data } = await supabaseAdmin()
    .from("datas_especiais")
    .select("id, nome, tipo, dia, mes")
    .eq("email", email)
    .order("mes")
    .order("dia");
  return (data ?? []) as DataEspecial[];
}

export const listarDatas = createServerFn({ method: "POST" })
  .validator((d: { tokenEdicao: string }) => d)
  .handler(async ({ data }): Promise<DataEspecial[]> => {
    const dono = await donoDoToken(data.tokenEdicao);
    return dono ? lista(dono.email) : [];
  });

export const salvarData = createServerFn({ method: "POST" })
  .validator(
    (d: { tokenEdicao: string; nome: string; tipo: TipoData; dia: number; mes: number }) => d,
  )
  .handler(async ({ data }): Promise<{ ok: boolean; erro?: string; datas: DataEspecial[] }> => {
    const dono = await donoDoToken(data.tokenEdicao);
    if (!dono) return { ok: false, erro: "sem-dono", datas: [] };
    const v = valida(data);
    if (!v) return { ok: false, erro: "invalida", datas: await lista(dono.email) };
    const atuais = await lista(dono.email);
    if (atuais.length >= MAX_POR_EMAIL) return { ok: false, erro: "limite", datas: atuais };
    // A mesma pessoa no mesmo dia não entra duas vezes (duplo toque).
    if (
      atuais.some(
        (x) => x.nome.toLowerCase() === v.nome.toLowerCase() && x.dia === v.dia && x.mes === v.mes,
      )
    ) {
      return { ok: true, datas: atuais };
    }
    const { error } = await supabaseAdmin()
      .from("datas_especiais")
      .insert({ ...v, email: dono.email, locale: dono.locale, origem: "editor" });
    return { ok: !error, erro: error?.message, datas: await lista(dono.email) };
  });

export const removerData = createServerFn({ method: "POST" })
  .validator((d: { tokenEdicao: string; id: string }) => d)
  .handler(async ({ data }): Promise<DataEspecial[]> => {
    const dono = await donoDoToken(data.tokenEdicao);
    if (!dono) return [];
    // O ALVO confere contra o dono: o id que chega não decide sozinho o que apagar.
    await supabaseAdmin()
      .from("datas_especiais")
      .delete()
      .eq("id", data.id)
      .eq("email", dono.email);
    return lista(dono.email);
  });
