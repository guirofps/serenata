// ENTREGA DA MÚSICA PELO WHATSAPP (Meta Cloud API).
//
// Por que existe: 96% dos compradores digitam o WhatsApp no funil (174 de 182
// numa semana). O e-mail chega e some na aba de Promoções, e isso gerou a
// maior parte dos tickets: em 16/08, sete pessoas escreveram no mesmo dia
// dizendo que tinham pago e não achavam a música.
//
// COMPLEMENTA o e-mail, não substitui. Quem trocou de número, quem digitou
// errado, quem prefere e-mail: todos continuam recebendo por lá.
//
// SÓ ENTREGA, NUNCA RECUPERAÇÃO. Mensagem de utilidade pra quem pagou e
// consentiu é o uso que a API oficial existe pra servir. Mensagem fria pra
// quem abandonou é marketing, custa mais caro e derruba a nota de qualidade
// da conta. A recuperação segue na mão do atendimento, no número humano.
//
// INERTE SEM CREDENCIAL: sem as env vars a função devolve "desligado" e não
// quebra nada. É o que permite subir este código antes da aprovação do Meta.

const API = "https://graph.facebook.com/v21.0";

export type ResultadoZap =
  | { ok: true; id: string }
  | { ok: false; motivo: "desligado" | "sem_numero" | "erro"; detalhe?: string };

/**
 * Número no formato que o Meta espera: só dígitos, com país, sem "+".
 *
 * O banco guarda em E.164 (`+5511999998888`), e a API rejeita o "+". Números
 * com menos de 12 dígitos não são brasileiros válidos com DDI, e mandar assim
 * gasta uma conversa pra falhar: o caso real foi `+55319955859`, com dígitos
 * faltando, que só foi descoberto quando o suporte tentou ligar.
 */
export function paraWhatsapp(telefone: string | null | undefined): string | null {
  const so = String(telefone ?? "").replace(/\D/g, "");
  if (so.length < 12 || so.length > 15) return null;
  return so;
}

/**
 * Manda o template de entrega.
 *
 * `template` e `idioma` vêm de env porque o nome é definido na aprovação do
 * Meta e pode mudar sem deploy. Os parâmetros são posicionais, na ordem em que
 * aparecem no texto aprovado.
 */
export async function entregarPorWhatsapp(args: {
  telefone: string | null | undefined;
  nome: string;
  titulo: string;
  /** Só o token: o link completo vive no botão do template. */
  tokenEdicao: string;
  locale: "pt" | "es";
}): Promise<ResultadoZap> {
  const token = process.env.WHATSAPP_TOKEN;
  const numeroId = process.env.WHATSAPP_PHONE_ID;
  if (!token || !numeroId) return { ok: false, motivo: "desligado" };

  const para = paraWhatsapp(args.telefone);
  if (!para) return { ok: false, motivo: "sem_numero" };

  const template =
    args.locale === "es"
      ? (process.env.WHATSAPP_TEMPLATE_ES ?? "cancion_lista")
      : (process.env.WHATSAPP_TEMPLATE_PT ?? "musica_pronta");

  try {
    const r = await fetch(`${API}/${numeroId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: para,
        type: "template",
        template: {
          name: template,
          language: { code: args.locale === "es" ? "es" : "pt_BR" },
          components: [
            {
              type: "body",
              parameters: [
                { type: "text", text: args.nome.slice(0, 60) },
                { type: "text", text: args.titulo.slice(0, 60) },
              ],
            },
            {
              // O botão do template é do tipo URL dinâmica: a base
              // (serenatagift.com/editar/) fica fixa na aprovação e só o token
              // viaja. É o que permite um template aprovado servir todo mundo.
              type: "button",
              sub_type: "url",
              index: "0",
              parameters: [{ type: "text", text: args.tokenEdicao }],
            },
          ],
        },
      }),
      signal: AbortSignal.timeout(20000),
    });

    const corpo = (await r.json()) as {
      messages?: { id: string }[];
      error?: { message?: string; code?: number };
    };
    if (!r.ok || corpo.error) {
      return { ok: false, motivo: "erro", detalhe: corpo.error?.message ?? `HTTP ${r.status}` };
    }
    const id = corpo.messages?.[0]?.id;
    return id ? { ok: true, id } : { ok: false, motivo: "erro", detalhe: "sem id na resposta" };
  } catch (err) {
    return { ok: false, motivo: "erro", detalhe: err instanceof Error ? err.message : String(err) };
  }
}
