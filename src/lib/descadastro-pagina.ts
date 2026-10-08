// A PÁGINA DO "CANCELAR INSCRIÇÃO" (`api/descadastro.ts`), NA MARCA CERTA.
//
// Até 08/10 ela era fixa: "SERENATA" no topo e tudo em português. A Ballad
// Gift manda o mesmo cabeçalho List-Unsubscribe (`cabecalhosDescadastro`), e
// o americano que tocava no botão caía numa página em português de outra
// marca, que é o jeito mais curto de ele achar que é golpe e apertar "spam".
//
// O idioma sai da MARCA, e não da pessoa: o link não carrega locale, e cada
// deploy só manda e-mail no idioma dele (a Ballad em inglês; a Serenata em
// português, e o espanhol de lá não leva este cabeçalho). Puro e sem `@/`:
// é lido por uma função de `api/`.

import type { Marca } from "./marca-identidade.js";

const escapar = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

type Copy = {
  lang: string;
  pergunta: string;
  botao: string;
  pronto: string;
  ressalva: string;
};

const COPY: Record<"pt" | "en", Copy> = {
  pt: {
    lang: "pt-BR",
    pergunta: "Parar de receber os nossos e-mails de novidades?",
    botao: "Sim, não quero mais receber",
    pronto: "Pronto, você não recebe mais estes e-mails.",
    ressalva: "Os e-mails da música que você comprou continuam chegando normalmente.",
  },
  en: {
    lang: "en",
    pergunta: "Stop getting our update emails?",
    botao: "Yes, unsubscribe me",
    pronto: "Done, you won't get these emails anymore.",
    ressalva: "Emails about a song you bought will still arrive as usual.",
  },
};

/** O idioma da página, pela marca do deploy. */
export function idiomaDescadastro(marca: Pick<Marca, "chave">): "pt" | "en" {
  return marca.chave === "ballad" ? "en" : "pt";
}

/** A palavra do topo. A Ballad assina só "BALLAD", como no logo. */
function logoTexto(marca: Pick<Marca, "chave" | "nome">): string {
  return marca.chave === "ballad" ? "BALLAD" : marca.nome.toUpperCase();
}

function moldura(marca: Pick<Marca, "chave" | "nome">, C: Copy, corpo: string): string {
  return (
    `<!DOCTYPE html><html lang="${C.lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${escapar(marca.nome)}</title></head>` +
    `<body style="margin:0;background:#f2e9dc;font-family:Georgia,serif;color:#2a1518;display:grid;place-items:center;min-height:100vh;padding:24px;text-align:center">` +
    `<div style="max-width:420px"><p style="letter-spacing:3px;color:#7d2b3a">${escapar(logoTexto(marca))}</p>${corpo}</div></body></html>`
  );
}

/** GET: a pergunta e o botão (o GET nunca descadastra, ver `api/descadastro.ts`). */
export function paginaConfirmarDescadastro(
  marca: Pick<Marca, "chave" | "nome">,
  email: string,
  acao: string,
): string {
  const C = COPY[idiomaDescadastro(marca)];
  return moldura(
    marca,
    C,
    `<h1 style="font-weight:normal;font-size:23px">${C.pergunta}</h1>` +
      `<p style="color:rgba(42,21,24,0.6);font-family:Helvetica,Arial,sans-serif;font-size:14px">${escapar(email)}</p>` +
      `<form method="POST" action="${escapar(acao)}"><button style="margin-top:14px;background:#7d2b3a;color:#faf5ee;border:0;border-radius:999px;padding:14px 28px;font-size:15px;font-family:Helvetica,Arial,sans-serif;font-weight:bold;cursor:pointer">${C.botao}</button></form>`,
  );
}

/** POST: feito. */
export function paginaDescadastrado(marca: Pick<Marca, "chave" | "nome">): string {
  const C = COPY[idiomaDescadastro(marca)];
  return moldura(
    marca,
    C,
    `<h1 style="font-weight:normal;font-size:24px">${C.pronto}</h1>` +
      `<p style="color:rgba(42,21,24,0.6);font-family:Helvetica,Arial,sans-serif;font-size:14px">${C.ressalva}</p>`,
  );
}
