// QUAL MARCA ESTE DEPLOY É.
//
// Um repositório, dois sites: a Serenata (Brasil e México) e a Ballad Gift
// (EUA). Cada um é um projeto da Vercel com o próprio banco, o próprio
// gateway e o próprio domínio, e é a env `VITE_MARCA` do projeto que decide
// qual identidade este código veste. Ver "Expansão EUA" no CLAUDE.md.
//
// Regra de ouro, a mesma do `/es`: sem a env, é SERENATA. O site que está
// vendendo nunca depende de alguém lembrar de configurar nada.
//
// Este arquivo não importa nada de propósito: ele é lido pelo navegador (Vite),
// pelas funções de `api/` (Node, sem Vite) e pelos jobs do Inngest. Qualquer
// dependência aqui arrasta junto pra lugares onde ela não existe.

export type ChaveMarca = "serenata" | "ballad";

export type Marca = {
  chave: ChaveMarca;
  nome: string;
  dominio: string;
  /**
   * Origem canônica, COM www: é o host que o site serve de verdade e o que sai
   * nos links enviados. Precisa ser absoluta porque o robô de prévia do
   * WhatsApp não resolve caminho relativo em og:image.
   */
  url: string;
  /** O que a marca promete, em uma linha. */
  promessa: string;
  /** Onde o cliente escreve. Aparece em rodapé, termos, obrigado, editor. */
  emailContato: string;
  /** O que a pessoa PEDIU ou COMPROU. Ver `emails/remetentes.ts`. */
  remetenteTransacional: string;
  /** O que ninguém pediu (ofertas, recuperação). */
  remetenteRecuperacao: string;
  /** Pra onde a resposta de qualquer e-mail vai. */
  responderPara: string;
  /** Domínios de onde esta marca manda e-mail (o raiz e os subdomínios de envio). */
  dominiosDeEnvio: readonly string[];
  /** Imagem de compartilhamento (og:image) do site e do presente sem foto. */
  imagemCompartilhar: string;
  /**
   * O nome do evento de compra no TikTok. A Serenata nasceu no
   * `CompletePayment` e as campanhas dela otimizam por ele: trocar lá zera o
   * aprendizado. O pixel da Ballad (29/09) é novo, e o painel novo do TikTok
   * só lista `Purchase` como evento de compra pra otimizar.
   */
  eventoCompraTiktok: "CompletePayment" | "Purchase";
};

export const MARCAS: Record<ChaveMarca, Marca> = {
  serenata: {
    chave: "serenata",
    nome: "Serenata",
    dominio: "serenatagift.com",
    url: "https://www.serenatagift.com",
    promessa: "Uma música feita da história de quem você ama",
    emailContato: "contato@serenatagift.com",
    remetenteTransacional: "Serenata <contato@serenatagift.com>",
    remetenteRecuperacao: "Serenata <ola@envio.serenatagift.com>",
    responderPara: "contato@serenatagift.com",
    dominiosDeEnvio: ["serenatagift.com", "envio.serenatagift.com"],
    imagemCompartilhar: "/og-presente.jpg",
    eventoCompraTiktok: "CompletePayment",
  },
  ballad: {
    chave: "ballad",
    nome: "Ballad Gift",
    dominio: "balladgift.com",
    url: "https://www.balladgift.com",
    promessa: "A song made from the story of someone you love",
    emailContato: "support@balladgift.com",
    // Sem subdomínio de envio por enquanto: no começo o volume é pequeno e
    // não existe régua de oferta. Quando existir, ela ganha o seu, como na
    // Serenata, pra reclamação de oferta nunca respingar na entrega.
    remetenteTransacional: "Ballad Gift <hello@balladgift.com>",
    remetenteRecuperacao: "Ballad Gift <hello@balladgift.com>",
    responderPara: "support@balladgift.com",
    dominiosDeEnvio: ["balladgift.com"],
    imagemCompartilhar: "/ballad/og-presente.jpg",
    eventoCompraTiktok: "Purchase",
  },
};

/** Lê a env nos três ambientes: Vite (navegador e SSR), Node puro (api/) e Inngest. */
function envMarca(): string | undefined {
  let v: string | undefined;
  try {
    v = (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_MARCA;
  } catch {
    v = undefined;
  }
  if (!v && typeof process !== "undefined") v = process.env?.VITE_MARCA;
  return v?.trim().toLowerCase();
}

/** Qualquer coisa que não seja exatamente "ballad" é Serenata. */
export function chaveDaMarca(v: string | undefined = envMarca()): ChaveMarca {
  return v === "ballad" ? "ballad" : "serenata";
}

export const MARCA_ATIVA: Marca = MARCAS[chaveDaMarca()];

/**
 * O e-mail saiu desta marca? Recebe o campo `from` como o Resend manda
 * ("Nome <x@dominio>" ou só o endereço). Usado pelo webhook do Resend, que
 * recebe os eventos da CONTA inteira, das duas marcas.
 */
export function remetenteEDaMarca(from: string | undefined | null, marca: Marca = MARCA_ATIVA): boolean {
  if (!from) return false;
  const endereco = (from.match(/<([^>]+)>/)?.[1] ?? from).trim().toLowerCase();
  const dominio = endereco.split("@")[1];
  return !!dominio && marca.dominiosDeEnvio.includes(dominio);
}
