import { createHash } from "node:crypto";

// A VENDA CONTADA DO SERVIDOR, QUANDO O GATEWAY APROVA.
//
// ── POR QUE O PIXEL SOZINHO NÃO SERVE ────────────────────────────
//
// O pixel dispara na `/obrigado`, e `/obrigado` é uma página que muita gente
// nunca vê: quem paga PIX no aplicativo do banco não volta pro site. Isso já
// foi medido aqui, com o Google: em 28/08 foram 23 vendas num dia e 8
// contadas pela tag. Dois terços jogados fora, e a campanha otimizando em
// cima do terço que sobrou. Foi o que fez `api/conversoes.ts` existir.
//
// Repetir esse desenho no TikTok seria repetir o erro sabendo do erro.
//
// ── E POR QUE O PIXEL CONTINUA SENDO NECESSÁRIO ──────────────────
//
// Não é um OU outro. A Events API precisa saber em QUEM casar a venda, e
// quem captura isso é o pixel: o `ttclid` que vem na URL do clique no anúncio
// e o cookie `_ttp` que ele planta. Sem o pixel, o evento de servidor chega
// órfão e a plataforma o trata como visitante novo, sem creditar a campanha.
//
// Pixel identifica. Webhook converte. Os dois mandam o MESMO `event_id`, e o
// TikTok deduplica: vale o que chegar primeiro, e a cobertura vira a união
// dos dois em vez da interseção.
//
// ── O QUE SOBE, E O QUE NUNCA SOBE ───────────────────────────────
//
// E-mail e telefone vão em SHA-256, que é o que a API exige. O e-mail cru não
// sai daqui. `ttclid` e `ttp` vão como estão porque são identificadores do
// próprio TikTok, não dado pessoal nosso.

const API = "https://business-api.tiktok.com/open_api/v1.3/event/track/";

const normaliza = (v: unknown) => String(v ?? "").trim().toLowerCase();
const sha = (v: unknown) => {
  const n = normaliza(v);
  return n ? createHash("sha256").update(n).digest("hex") : undefined;
};

export type VendaTiktok = {
  /** O MESMO id que o pixel manda na `/obrigado`. É o que deduplica. */
  eventId: string;
  valor: number;
  moeda: "BRL" | "USD";
  email?: string | null;
  telefone?: string | null;
  /** Da `attribution` do lead. Sem ele o evento chega órfão. */
  ttclid?: string | null;
  /** Cookie `_ttp`, quando a gente tiver guardado. */
  ttp?: string | null;
  /** Quando o pagamento foi aprovado, não quando este código rodou. */
  quando?: Date;
};

/**
 * Manda a venda pro TikTok. NUNCA joga.
 *
 * Chamado de dentro do webhook de pagamento, que tem um trabalho e é entregar
 * o produto. Medição que falha não pode derrubar entrega: o pior caso aqui é
 * uma venda não contada, e o pior caso de um throw é um cliente pago sem
 * música. A assimetria decide o `catch`.
 */
export async function venderNoTiktok(v: VendaTiktok): Promise<{ ok: boolean; motivo?: string }> {
  const token = process.env.TIKTOK_ACCESS_TOKEN;
  const pixel = process.env.TIKTOK_PIXEL_ID;
  // Sem conta configurada isto é no-op, igual ao pixel no navegador.
  if (!token || !pixel) return { ok: false, motivo: "sem credenciais" };

  // Só identificadores que existem. Campo vazio é pior que campo ausente:
  // a plataforma tenta casar com string vazia e erra.
  const user: Record<string, string> = {};
  const emailHash = sha(v.email);
  const foneHash = sha(v.telefone ? String(v.telefone).replace(/\D/g, "") : null);
  if (emailHash) user.email = emailHash;
  if (foneHash) user.phone = foneHash;
  if (v.ttclid) user.ttclid = v.ttclid;
  if (v.ttp) user.ttp = v.ttp;

  // Sem NENHUM identificador o evento não casa com ninguém e só suja o
  // relatório. Melhor não mandar do que mandar lixo.
  if (!Object.keys(user).length) return { ok: false, motivo: "sem identificador" };

  try {
    const r = await fetch(API, {
      method: "POST",
      headers: { "Access-Token": token, "Content-Type": "application/json" },
      body: JSON.stringify({
        event_source: "web",
        event_source_id: pixel,
        data: [
          {
            event: "CompletePayment",
            // O horário do PAGAMENTO, não o de agora. Webhook pode chegar
            // atrasado, e a plataforma atribui pelo instante que recebe.
            event_time: Math.floor((v.quando ?? new Date()).getTime() / 1000),
            event_id: v.eventId,
            user,
            properties: {
              currency: v.moeda,
              value: v.valor,
              contents: [{ content_type: "product", content_name: "Musica personalizada" }],
            },
          },
        ],
      }),
    });
    const j = (await r.json()) as { code?: number; message?: string };
    // A API responde 200 com `code` diferente de zero quando recusa. Ler só o
    // status HTTP daria "deu certo" pra evento rejeitado.
    if (j.code !== 0) {
      console.error("[tiktok] recusou:", j.code, (j.message ?? "").slice(0, 200));
      return { ok: false, motivo: j.message ?? String(j.code) };
    }
    return { ok: true };
  } catch (err) {
    console.error("[tiktok] falhou:", (err as Error).message);
    return { ok: false, motivo: (err as Error).message };
  }
}
