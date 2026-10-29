// "TU FICHA DE OXXO SIGUE ACTIVA" (Ballad México, teste `oxxo_pendente`).
//
// A regra e o porquê moram em `src/lib/oxxo-pendente.ts`. Aqui só a copy, em
// espanhol do México (`tú`), e escrita pra quem PEDIU a ficha: não é oferta,
// é a ficha dela de volta na mão. Por isso nenhum desconto, nenhuma pressão
// inventada: o prazo é o da própria ficha, e é verdadeiro.
//
// O botão reabre a MESMA ficha (a página da dLocal, `pix_url` do pedido): o
// código que ela leva ao OXXO continua o mesmo. Quem preferir cartão tem a
// volta pro funil embaixo, discreta.

import { MARCA_ATIVA } from "../src/lib/marca-identidade.js";
import type { Toque } from "../src/lib/oxxo-pendente.js";

export type ArgsOxxoPendente = {
  nome: string;
  toque: Toque;
  /** A página da dLocal com a ficha (o `pix_url` do pedido). */
  linkFicha: string;
  /** A volta pro funil pra pagar com cartão, ou `null`. */
  linkCartao: string | null;
  /** "el jueves 30 de octubre a las 3:40 p. m." */
  vence: string;
  /** "hoy" / "mañana" no 2º toque; senão `null`. */
  quando: "hoy" | "mañana" | null;
  /** "$199 MXN", quando a dLocal disse o valor. */
  valor: string | null;
};

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export function assuntoOxxoPendente(a: Pick<ArgsOxxoPendente, "nome" | "toque" | "quando">): string {
  if (a.toque === 2) return `Tu ficha de OXXO vence ${a.quando ?? "pronto"}`;
  return `Tu ficha de OXXO para la canción de ${a.nome} sigue activa`;
}

function linhas(a: ArgsOxxoPendente) {
  const valor = a.valor ? ` de ${a.valor}` : "";
  if (a.toque === 2) {
    return {
      titulo: `Tu ficha vence ${a.quando ?? "pronto"}.`,
      corpo: [
        `La canción de ${a.nome} ya está grabada y esperando. Solo falta pagar la ficha${valor}, que vence ${a.vence}.`,
        "Puedes pagarla en cualquier OXXO con el código de la ficha. En cuanto se acredite, la canción completa y su página regalo llegan a este correo.",
      ],
      botao: "VER MI FICHA DE PAGO",
    };
  }
  return {
    titulo: "Tu ficha sigue activa.",
    corpo: [
      `Generaste una ficha${valor} para pagar la canción de ${a.nome} en OXXO o por transferencia. Sigue válida hasta ${a.vence}.`,
      "Puedes pagarla en cualquier OXXO con el código de la ficha, cuando te quede cerca. En cuanto se acredite, la canción completa y su página regalo llegan a este correo.",
    ],
    botao: "VER MI FICHA DE PAGO",
  };
}

export function emailOxxoPendente(a: ArgsOxxoPendente): string {
  const L = linhas(a);
  const nome = esc(a.nome);
  const corpo = L.corpo.map((p) => esc(p).replaceAll(esc(a.nome), `<strong style="color:#2a1518;">${nome}</strong>`));
  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(assuntoOxxoPendente(a))}</title></head>
<body style="margin:0;padding:0;background-color:#f2e9dc;font-family:Georgia,'Times New Roman',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f2e9dc;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#faf5ee;border:1px solid rgba(42,21,24,0.14);border-radius:16px;overflow:hidden;">
        <tr><td height="4" style="background:linear-gradient(90deg,#7d2b3a,#c9a227);"></td></tr>
        <tr><td style="padding:34px 28px 30px;">
          <p style="margin:0;font-size:22px;line-height:1.3;color:#2a1518;">${esc(L.titulo)}</p>
          ${corpo
            .map(
              (p, i) =>
                `<p style="margin:${i ? "10px" : "14px"} 0 0;font-size:15px;line-height:1.6;color:rgba(42,21,24,0.78);font-family:Helvetica,Arial,sans-serif;">${p}</p>`,
            )
            .join("")}
          <table cellpadding="0" cellspacing="0" style="margin:24px 0 0;"><tr><td align="center">
            <a href="${esc(a.linkFicha)}" style="display:inline-block;background:#7d2b3a;color:#faf5ee;text-decoration:none;font-size:16px;font-family:Helvetica,Arial,sans-serif;font-weight:bold;padding:16px 30px;border-radius:999px;">
              ${L.botao}
            </a>
          </td></tr></table>
          <p style="margin:22px 0 0;padding-top:16px;border-top:1px solid rgba(42,21,24,0.08);font-size:13px;line-height:1.55;color:rgba(42,21,24,0.6);font-family:Helvetica,Arial,sans-serif;">
            Si ya pagaste, no hagas nada: el pago en OXXO tarda unas horas en confirmarse y la canción llega sola.${
              a.linkCartao
                ? `<br>¿Prefieres pagar con tarjeta? <a href="${esc(a.linkCartao)}" style="color:#7d2b3a;">Termina aquí</a>.`
                : ""
            }<br>Si algo no abre, responde este correo y lo resolvemos.
          </p>
          <p style="margin:18px 0 0;color:rgba(42,21,24,0.4);font-size:11px;font-family:Helvetica,Arial,sans-serif;">
            ${esc(MARCA_ATIVA.nome)} · una canción hecha de la historia de quien tú quieres
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

export function textoOxxoPendente(a: ArgsOxxoPendente): string {
  const L = linhas(a);
  return [
    L.titulo,
    "",
    ...L.corpo,
    "",
    `Tu ficha: ${a.linkFicha}`,
    "",
    "Si ya pagaste, no hagas nada: el pago en OXXO tarda unas horas en confirmarse y la canción llega sola.",
    ...(a.linkCartao ? [`¿Prefieres pagar con tarjeta? ${a.linkCartao}`] : []),
  ].join("\n");
}
