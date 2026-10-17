// QUAIS CONTAS DO GOOGLE ADS O PAINEL LÊ.
//
// A Serenata tem DUAS desde 17/10: a Climes Ecom (692-319-8164) foi suspensa e
// a venda passou pra Seren Out26 (477-958-6821, gerida pela MCC Falkland). A
// antiga continua sendo LIDA (conta suspensa deixa ler): o Google ajusta os
// últimos dias retroativamente, e venda de hoje pode vir de clique de semanas
// atrás num anúncio de lá (`cliques_anuncio`). Os ids de campanha, anúncio e
// clique não se repetem entre contas, então as duas convivem nas mesmas tabelas.
//
// Cravado na Serenata, como a tag (`google-ads.ts`): sem depender de a env da
// Vercel ter sido trocada. A Ballad segue pela env, uma conta só.
//
// A PRIMEIRA é a que recebe escrita (listas de público). A conta suspensa
// recusa qualquer alteração.
import { chaveDaMarca, type ChaveMarca } from "./marca-identidade.js";

export type ContaGoogleAds = { id: string; login?: string };

const NOVA: ContaGoogleAds = { id: "4779586821", login: "5024394715" };
const ANTIGA = "6923198164";

export function contasGoogleAds(
  env: Record<string, string | undefined> = process.env,
  marca: ChaveMarca = chaveDaMarca(),
): ContaGoogleAds[] {
  const id = env.GOOGLE_ADS_CUSTOMER_ID?.trim();
  const login = env.GOOGLE_ADS_LOGIN_CUSTOMER_ID?.trim() || undefined;
  if (marca !== "serenata") return id ? [{ id, ...(login && { login }) }] : [];
  // A antiga é lida como a env de produção sempre leu, enquanto a env apontar pra ela.
  const loginAntiga = id === ANTIGA ? login : undefined;
  return [NOVA, { id: ANTIGA, ...(loginAntiga && { login: loginAntiga }) }];
}
