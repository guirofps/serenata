import { MARCA_ATIVA } from "../src/lib/marca-identidade.js";
import { textoDaRecusa, type GrupoRecusa } from "../src/lib/recusa-rapida.js";
import { emailQuaseComprou, type CopyEmail } from "./quase-comprou.js";
// CARTÃO RECUSADO, 10 MINUTOS DEPOIS (Ballad, teste `recusa_rapida`, 28/10).
//
// O mesmo molde do "quase comprou" (layout, botão, rodapé), com o texto do
// MOTIVO da recusa e a saída pra ele. Ver `src/lib/recusa-rapida.ts`.

type Args = { nome: string; titulo: string; link: string; locale: "es" | "en"; grupo: GrupoRecusa; mexico: boolean };

function copyDe(a: Args): CopyEmail {
  const t = textoDaRecusa(a.grupo, a.locale, a.mexico);
  return a.locale === "es"
    ? {
        assunto: (n) => `Tu pago no pasó, pero la canción de ${n} sigue guardada`,
        titulo: (n) => `La canción de <em style="color:#7d2b3a;">${n}</em> te sigue esperando.`,
        corpo: t.corpo,
        lembrete: t.lembrete,
        botao: "INTENTAR EL PAGO DE NUEVO",
        rodapeAviso: "Tu canción y tu letra están guardadas, y el link no expira.<br>¿Sigue sin pasar? Responde este correo y te ayudamos.",
        rodape: `${MARCA_ATIVA.nome} · una canción hecha de la historia de quien tú quieres`,
      }
    : {
        assunto: (n) => `Your payment didn't go through, but ${n}'s song is saved`,
        titulo: (n) => `${n}'s song is <em style="color:#7d2b3a;">still waiting</em> for you.`,
        corpo: t.corpo,
        lembrete: t.lembrete,
        botao: "TRY THE PAYMENT AGAIN",
        rodapeAviso: "Your song and lyrics are saved, and the link never expires.<br>Still stuck? Just reply to this email and we'll help.",
        rodape: "Ballad Gift · a song made from the story of someone you love",
      };
}

export function assuntoRecusaRapida(a: Args): string {
  return copyDe(a).assunto(a.nome);
}

export function emailRecusaRapida(a: Args): string {
  return emailQuaseComprou({ nome: a.nome, titulo: a.titulo, link: a.link, locale: a.locale, copy: copyDe(a) });
}

export function textoRecusaRapida(a: Args): string {
  const t = textoDaRecusa(a.grupo, a.locale, a.mexico);
  return `${t.corpo}\n\n${t.lembrete}\n\n${a.link}`;
}
