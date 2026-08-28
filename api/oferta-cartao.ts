// O CARTÃO DO DEGRAU DA ESCADA.
//
// A tela `/oferta/<token>` paga por PIX na nossa página. Quem prefere cartão
// (ou quer parcelar) precisa ir pro checkout hospedado — e no PREÇO DAQUELE
// DEGRAU, senão a pessoa lê R$ 19 no e-mail e vê R$ 38 no caixa.
//
// ── POR QUE UM ENDPOINT, E NÃO UM LINK DIRETO ────────────────────
//
// Porque o degrau decide o preço. Um link direto teria que carregar o degrau
// em claro na URL, e aí a assinatura não serviria pra nada: bastaria trocar
// o número. Aqui o token assinado é conferido NO SERVIDOR e só então vira
// redirecionamento pro produto certo.
//
// É a mesma regra do resto do projeto: o que a pessoa manda não decide o
// ALVO da operação.

import type { IncomingMessage, ServerResponse } from "node:http";
import { conferirOferta } from "../src/lib/oferta-assinada.js";
import { OFERTA, type DegrauEscada } from "../emails/escada.js";

type Req = IncomingMessage & { method?: string; url?: string };
type Res = ServerResponse & {
  status: (c: number) => Res;
  json: (b: unknown) => void;
  redirect: (code: number, url: string) => void;
};

export default function handler(req: Req, res: Res) {
  const url = new URL(req.url ?? "/", "https://www.serenatagift.com");
  const token = url.searchParams.get("t") ?? "";
  const aberto = conferirOferta(token);

  // Token inválido não vira erro na cara de quem ia comprar: manda pro funil,
  // que é onde ela consegue comprar de qualquer jeito.
  if (!aberto) {
    res.statusCode = 302;
    res.setHeader("Location", "/criar");
    return res.end();
  }

  const oferta = OFERTA[aberto.degrau as DegrauEscada];
  if (!oferta) {
    res.statusCode = 302;
    res.setHeader("Location", "/criar");
    return res.end();
  }

  const destino = new URL(oferta.checkout);
  // `src` é o `session_id`, e não é enfeite: é por ele que o webhook da
  // Perfect Pay casa o pagamento com a música já gravada. Sem ele a compra
  // entra como "pago sem música casada" e alguém entrega à mão.
  destino.searchParams.set("src", aberto.sessao);

  res.statusCode = 302;
  res.setHeader("Location", destino.toString());
  res.setHeader("Cache-Control", "no-store");
  return res.end();
}
