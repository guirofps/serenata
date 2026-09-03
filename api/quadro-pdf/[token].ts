// O QUADRO VIRA PDF NO SERVIDOR.
//
// ── POR QUE ESTA ROTA EXISTE ─────────────────────────────────────
//
// O botão da folha chamava `window.print()` e mais nada. No computador isso
// funciona; no celular é frágil, e dentro do navegador embutido de um
// aplicativo de e-mail ele simplesmente NÃO EXISTE — o toque não faz nada,
// sem erro e sem aviso.
//
// Não é teoria. Medido em 30 dias, 76 cliques no botão:
//
//   74 de celular, 2 de tablet, ZERO de computador
//   15 das 33 sessões apertaram mais de uma vez
//   a pior: 14 cliques em 109 minutos; a segunda: 11 em 6 minutos
//
// Ninguém aperta "imprimir" catorze vezes querendo catorze cópias. Aperta
// catorze vezes quando nada acontece.
//
// O caso que fechou o diagnóstico foi o da Mausina, em 02/09: confirmou o
// quadro às 17:23:52, apertou imprimir às 17:24:58, e às 17:28:13 respondeu
// o nosso e-mail com "Vou procurar alguém pra fazer para mim". Ela tinha
// pago R$ 24,90 e fez tudo certo.
//
// É a mesma família do defeito do botão de baixar a música, que dois dias
// antes virou contestação pública com a palavra "golpe": a gente entrega um
// botão que o aparelho não executa, e o cliente conclui que o produto não
// funciona.
//
// ── POR QUE NO SERVIDOR, E NÃO NO NAVEGADOR ──────────────────────
//
// A alternativa era desenhar a folha em canvas no cliente (html-to-image e
// afins) e salvar num blob. Mais leve, e o download por blob de mesma origem
// funciona no celular.
//
// Mas o entregável aqui é IMPRESSO. O que a gráfica recebe tem que ser
// exatamente o que a pessoa viu na tela, e rasterizar DOM no cliente erra
// justamente onde dói: fonte que não carregou vira fallback, foto de outro
// domínio suja o canvas, efeito com blend mode sai diferente. Um PDF bonito
// na tela e errado no papel é pior que nenhum, porque o erro só aparece
// depois de a pessoa pagar a impressão.
//
// O Chrome do servidor renderiza a MESMA página, com as MESMAS fontes e o
// MESMO CSS de impressão que já existia. Não há segunda implementação do
// layout pra divergir da primeira.
//
// ── O QUE ESTA ROTA NÃO FAZ ──────────────────────────────────────
//
// Não monta o quadro e não decide nada sobre ele. Ela abre `/quadro/<token>`
// e imprime o que estiver lá — inclusive o estilo que a pessoa escolheu, que
// desde 03/09 é gravado no servidor a cada troca. Se a folha mudar, o PDF
// muda junto, sem ninguém lembrar de mexer aqui.

import type { IncomingMessage, ServerResponse } from "node:http";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";

type Req = IncomingMessage & {
  method?: string;
  query?: Record<string, string | string[]>;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
};
type Res = ServerResponse & {
  status: (c: number) => Res;
  json: (b: unknown) => void;
  send: (b: unknown) => void;
};

function db() {
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env ausente");
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * De onde o Chrome vai abrir a página.
 *
 * `VITE_APP_URL` e NUNCA o cabeçalho de host. Está no CLAUDE.md como
 * invariante: em produção, cabeçalho de host não decide destino. Aqui o
 * estrago seria específico e feio — quem controlasse o host mandaria o nosso
 * Chrome, autenticado por nada mas rodando na nossa infra, buscar uma página
 * dele.
 */
function base(): string {
  return (process.env.VITE_APP_URL ?? "https://www.serenatagift.com").replace(/\/+$/, "");
}

/** Nome de arquivo que uma pessoa reconhece na pasta de downloads. */
function apelido(titulo: string | null): string {
  const limpo = (titulo ?? "quadro")
    .normalize("NFD")
    // `Diacritic` em vez da faixa de codigos escrita a mao: a faixa some
    // em qualquer editor que normalize o arquivo, e ai o nome do anexo
    // volta a sair com acento, que e onde download em celular engasga.
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return `Quadro-${limpo || "Serenata"}.pdf`;
}

/**
 * O teto. Renderizar custa CPU nossa, e a rota é pública por token.
 *
 * Falha ABERTA, como todo teto deste projeto: banco fora do ar não pode
 * impedir alguém de imprimir o que já pagou. Ver `limite-uso.server.ts`.
 */
async function cabe(chave: string, teto: number): Promise<boolean> {
  try {
    const { data, error } = await db().rpc("consumir_limite", {
      p_chave: chave,
      p_janela_s: 3600,
      p_teto: teto,
    });
    if (error) {
      console.error("[quadro-pdf] limite falhou:", error.message);
      return true;
    }
    return data !== false;
  } catch {
    return true;
  }
}

function origemHash(req: Req): string | null {
  const bruto =
    req.headers["x-forwarded-for"] ?? req.headers["x-real-ip"] ?? req.headers["cf-connecting-ip"];
  const ip = String(Array.isArray(bruto) ? bruto[0] : (bruto ?? ""))
    .split(",")[0]
    ?.trim();
  if (!ip) return null;
  const sal = process.env.ADMIN_SECRET ?? "sem-sal";
  return createHash("sha256").update(`${sal}:${ip}`).digest("hex").slice(0, 32);
}

export default async function handler(req: Req, res: Res) {
  if (req.method !== "GET") return res.status(405).json({ erro: "metodo" });

  const cru = req.query?.token;
  const token = String(Array.isArray(cru) ? cru[0] : (cru ?? "")).trim();
  // O token vai direto pra uma URL que o nosso Chrome abre. Sem esta trava,
  // um "token" com barra ou dois-pontos passaria a escolher a página.
  if (!/^[0-9a-f]{32}$/.test(token)) return res.status(400).json({ erro: "token" });

  let navegador: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;
  try {
    // ── QUEM PODE PEDIR ──────────────────────────────────────────
    //
    // A linha em `quadros` só nasce no webhook de pagamento confirmado, então
    // a existência dela É a prova de compra. Não há checagem de sessão nem de
    // login de propósito: 84% dos compradores nunca entram na conta, e o
    // token de edição é a credencial que eles têm na mão.
    const cliente = db();
    const { data: musica } = await cliente
      .from("musicas")
      .select("id, titulo")
      .eq("token_edicao", token)
      .maybeSingle();
    if (!musica) return res.status(404).json({ erro: "nao-encontrado" });

    const { data: quadro } = await cliente
      .from("quadros")
      .select("id, confirmado_em")
      .eq("musica_id", musica.id)
      .maybeSingle();
    if (!quadro) return res.status(404).json({ erro: "sem-quadro" });

    const [cabeToken, cabeIp] = await Promise.all([
      cabe(`quadropdf:${token}`, 20),
      (async () => {
        const o = origemHash(req);
        return o ? cabe(`quadropdf-ip:${o}`, 60) : true;
      })(),
    ]);
    if (!cabeToken || !cabeIp) return res.status(429).json({ erro: "muitas-vezes" });

    // ── O CHROME ─────────────────────────────────────────────────
    navegador = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
    const pagina = await navegador.newPage();
    // A4 em px a 96dpi. A folha se escala pela largura da janela, então uma
    // janela estreita imprimiria a versão encolhida de celular.
    await pagina.setViewport({ width: 794, height: 1123, deviceScaleFactor: 2 });

    await pagina.goto(`${base()}/quadro/${token}`, {
      waitUntil: "networkidle0",
      timeout: 30000,
    });

    // A PÁGINA AVISA QUANDO ACABOU. Ver a bandeirinha em
    // `quadro.$tokenEdicao.tsx`: sem ela, restaria dormir um tanto arbitrário
    // e torcer, e a folha sai errada de um jeito que só aparece na gráfica
    // (letra no corpo velho, QR em branco, foto ausente).
    await pagina.waitForSelector("html[data-quadro-pronto]", { timeout: 20000 });
    // As fontes entram no cálculo do corpo da letra: imprimir antes delas
    // assentarem muda o tamanho do texto no papel.
    await pagina.evaluate(() => document.fonts?.ready);

    const pdf = await pagina.pdf({
      format: "a4",
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });

    res.setHeader("Content-Type", "application/pdf");
    // O QUE FAZ O CELULAR BAIXAR DE VERDADE. É a mesma lição do botão do MP3:
    // `attachment` no cabeçalho é a única coisa que o navegador embutido de
    // aplicativo respeita — sem ele, ou abre um visualizador de onde não se
    // sai, ou não acontece nada.
    res.setHeader("Content-Disposition", `attachment; filename="${apelido(musica.titulo)}"`);
    res.setHeader("Content-Length", String(pdf.length));
    // Documento com o nome e a foto de uma pessoa não fica em cache de CDN.
    res.setHeader("Cache-Control", "private, no-store");
    res.status(200).send(Buffer.from(pdf));
  } catch (err) {
    console.error("[quadro-pdf] falhou:", err);
    // A tela tem que saber que falhou pra cair no `window.print()`, que é o
    // caminho que sempre existiu. Erro mudo aqui devolveria a pessoa ao
    // defeito original sem ninguém ficar sabendo.
    res.status(500).json({ erro: "render" });
  } finally {
    await navegador?.close().catch(() => {});
  }
}
