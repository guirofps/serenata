// Imports relativos COM extensão .js: este arquivo vira ESM em runtime na
// Vercel, e o resolver ESM do Node não aceita specifier sem extensão. O tsc
// resolve ".js" para o .ts correspondente na checagem de tipos.
import { serve } from "inngest/node";
import { inngest } from "../inngest/client.js";
import { healthcheck } from "../inngest/functions/healthcheck.js";
import { gerarMusica } from "../inngest/functions/gerarMusica.js";
import { lembrarPresente } from "../inngest/functions/lembrarPresente.js";
import { volteCriar } from "../inngest/functions/volteCriar.js";
import { ocasiaoCalendario } from "../inngest/functions/ocasiaoCalendario.js";
import { limparAudioAntigo } from "../inngest/functions/limparAudioAntigo.js";
import { vigiaWebhook } from "../inngest/functions/vigiaWebhook.js";
import { vigiarSaldo } from "../inngest/functions/vigiarSaldo.js";
import { mandarLetra } from "../inngest/functions/mandarLetra.js";
import { sequenciaRecuperacao } from "../inngest/functions/sequenciaRecuperacao.js";
import { triarSuporte } from "../inngest/functions/triarSuporte.js";
import { pixNaoPago } from "../inngest/functions/pixNaoPago.js";
import { guardeOLink } from "../inngest/functions/guardeOLink.js";
import { repescarFalhadas } from "../inngest/functions/repescarFalhadas.js";
import { vigiaExperimento } from "../inngest/functions/vigiaExperimento.js";
import { puxarMetricasAds } from "../inngest/functions/puxarMetricasAds.js";
import { resumoDiario } from "../inngest/functions/resumoDiario.js";
import { taxasFaltando } from "../inngest/functions/taxasFaltando.js";
import { vigiaEntrega } from "../inngest/functions/vigiaEntrega.js";
import { ofertaQuadro } from "../inngest/functions/ofertaQuadro.js";
import { vigiaGeracao } from "../inngest/functions/vigiaGeracao.js";
import { quaseComprou } from "../inngest/functions/quaseComprou.js";
import { quadroParado } from "../inngest/functions/quadroParado.js";
import { creditoParado } from "../inngest/functions/creditoParado.js";
import { renderizarVideo } from "../inngest/functions/renderizarVideo.js";
import { ofertaVideo } from "../inngest/functions/ofertaVideo.js";
import { conviteIndicacao } from "../inngest/functions/conviteIndicacao.js";
import { avisoVendas } from "../inngest/functions/avisoVendas.js";
import { videoPendente } from "../inngest/functions/videoPendente.js";
import { lembrarDatas } from "../inngest/functions/lembrarDatas.js";
import { campanhaMusica10 } from "../inngest/functions/campanhaMusica10.js";

import { MARCA_ATIVA } from "../src/lib/marca-identidade.js";

// ── NA BALLAD GIFT (EUA), SÓ O QUE ELA TEM ────────────────────────
//
// O mesmo código publica as funções nos DOIS deploys, cada um no seu ambiente
// do Inngest. Tudo que é PIX, Perfect Pay, WhatsApp, oferta em real ou régua
// de recuperação brasileira rodaria lá como cron, mandando e-mail em
// português, com preço em real, pra cliente americano. A Ballad registra só a
// espinha do produto: gerar a música, mandar a letra, repescar e vigiar.
//
// Função nova que servir pros dois entra nas DUAS listas, de propósito: o
// padrão da Ballad é ficar de fora até alguém decidir que ela serve lá.
const DA_BALLAD = [
  healthcheck,
  gerarMusica,
  mandarLetra,
  repescarFalhadas,
  vigiaGeracao,
  vigiaEntrega,
  limparAudioAntigo,
  // A recuperação de quem clicou em comprar e não pagou: manda de volta pro
  // funil em inglês (`/retomar`), sem cupom e sem PIX.
  quaseComprou,
  // O gasto do Google pro painel (custo por venda e ROAS por campanha). Lê a
  // conta de `GOOGLE_ADS_CUSTOMER_ID`, que no projeto da Ballad é a Projeto GM2.
  puxarMetricasAds,
  // O vídeo-presente, vendido pelo Stripe no editor desde 30/09: o render na
  // Lambda e o e-mail "your video is ready". Precisa das REMOTION_* no projeto.
  renderizarVideo,
  // Pós-compra em inglês (30/09): o lembrete de montar a página (quem pagou e
  // não mexeu) e o "guarde seus links" (quem montou), com a copy `en`.
  lembrarPresente,
  guardeOLink,
  // A recuperação de quem recebeu a letra e não comprou: na Ballad é a régua
  // curta em preço cheio (2 e 3), sem a escada de desconto do português e
  // sem `/oferta/` (que é só PIX). Todo botão volta pelo `/retomar`.
  sequenciaRecuperacao,
  // Os números do dia pro dono, em português: o pulso do WhatsApp em dólar e
  // o fechamento das 07h03 com a receita convertida, os dois com "[Ballad
  // Gift]" na frente pra não se misturar com os da Serenata.
  avisoVendas,
  resumoDiario,
  // Na Ballad o vigia olha o Stripe: venda confirmada sem o webhook falar, e
  // sessão paga lá com pedido pendente aqui.
  vigiaWebhook,
];

// Adapter "inngest/node" (req/res nativo), não "inngest/next": no Inngest v4 o
// adapter next virou web-style (Request -> Response) e nunca escreve no res de
// uma function Vercel Node — o request pendura para sempre. Foi exatamente o
// modo de falha silenciosa dos repos anteriores.
export default serve({
  client: inngest,
  functions: MARCA_ATIVA.chave === "ballad" ? DA_BALLAD : [
    healthcheck,
    gerarMusica,
    lembrarPresente,
    volteCriar,
    ocasiaoCalendario,
    limparAudioAntigo,
    vigiaWebhook,
    vigiarSaldo,
    mandarLetra,
    sequenciaRecuperacao,
    triarSuporte,
    pixNaoPago,
    guardeOLink,
    repescarFalhadas,
    vigiaEntrega,
    vigiaExperimento,
    taxasFaltando,
    puxarMetricasAds,
    resumoDiario,
    ofertaQuadro,
    vigiaGeracao,
    quaseComprou,
    quadroParado,
    creditoParado,
    renderizarVideo,
    ofertaVideo,
    conviteIndicacao,
    avisoVendas,
    videoPendente,
    lembrarDatas,
    // Campanha MUSICA10 (07/10): só Serenata, liga com CAMPANHA_MUSICA10_ON=1.
    campanhaMusica10,
  ],
});
