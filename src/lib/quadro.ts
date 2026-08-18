import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { emailDaSessao } from "@/lib/conta-sessao";

// O QUADRO: a página presente virando uma folha A4 pra imprimir e emoldurar.
//
// É o produto que transforma digital em físico sem nenhuma logística nossa, a
// mesma jogada do QR Code na caixa de bombom que está no CLAUDE.md, só que na
// versão que fica na parede.
//
// POR QUE NÃO GERAR IMAGEM. A saída óbvia seria rasterizar a tela num canvas e
// empacotar como PDF. Não: aí o texto vira pixel e sai serrilhado no papel,
// justamente na letra, que é o que a pessoa vai ler emoldurado. Esta rota é
// uma folha A4 de verdade em CSS de impressão, então o texto continua vetorial
// e sai nítido em qualquer tamanho, e a foto entra na resolução original que
// ela subiu. O "salvar como PDF" é do próprio navegador.

export type Quadro = {
  locale: "pt" | "es";
  titulo: string;
  nome: string;
  /** A letra JÁ SEM as marcações de estrutura. Ver `limparLetra`. */
  letra: string;
  dedicatoria: string | null;
  fotoUrl: string | null;
  corDestaque: string | null;
  /** Link da página presente, que vira o QR Code no rodapé. */
  linkPresente: string;
  /**
   * O DIREITO DE IMPRIMIR.
   *
   *   `confirmado` — ela amarrou um quadro comprado a esta música. Imprime.
   *   `previa`     — tem quadro comprado e ainda não escolheu. Vê, não imprime.
   *   `nenhum`     — não comprou. Vê o exemplo e a oferta.
   *
   * Antes disto a rota era aberta a quem tivesse o link do editor, que vai por
   * e-mail: o quadro estava à venda e de graça ao mesmo tempo.
   */
  acesso: "confirmado" | "previa" | "nenhum";
  /** O que ela escreveu NO QUADRO, que começa copiado da página presente. */
  musicaId: string | null;
};

/**
 * Tira o andaime da letra.
 *
 * `[Verse 1]`, `[Chorus]`, `[Short Intro - máx 8s]` são instruções PRO SUNO,
 * não texto de música. Na tela do presente elas já não aparecem; num quadro
 * na parede seriam o detalhe que denuncia que aquilo saiu de uma máquina.
 */
function limparLetra(bruta: string): string {
  return bruta
    .split("\n")
    .filter((l) => !/^\s*\[.*\]\s*$/.test(l))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// O EXEMPLO, pra quem ainda não comprou poder ver o que está comprando.
//
// Dado inventado, foto que já é pública na home. Não usa presente de cliente
// nenhum: um exemplo que expõe a homenagem de uma pessoa real seria trair
// exatamente quem confiou na gente pra guardar isso.
const EXEMPLO: Quadro = {
  locale: "pt",
  titulo: "Um Minuto na Padaria",
  nome: "Amor",
  letra: `Você entrou pela porta e o cheiro de pão quentinho
Não foi mais o mesmo depois que os nossos olhos se acharam
Ficamos um minuto só nos olhando de leve
E nesse minuto inteiro os anos todos começaram

Foi um minuto de olhar e mudou minha vida inteira
Desde aquele primeiro dia você virou minha rotina
Tantos anos depois eu escolho você de novo
Obrigada por me encontrar, meu coração é seu de fato

Virei sua namorada antes mesmo de perceber
Depois veio o vestido branco e o sim
Duas filhas vieram como presente pra nós dois
E você ainda me chama do seu jeito, sorrindo assim

Seu jeito brincalhão nunca deixou de existir
Na vida inteira que a gente construiu
Se eu voltasse pra aquele instante primeiro
Eu ia escolher de novo esse minuto inteiro

Me chama do seu jeito
Que eu vou te chamar de meu, de agora e pra sempre
Obrigada por me encontrar`,
  dedicatoria: "Pra você, com todo amor. ❤️",
  fotoUrl: "/img/exemplo-pai.webp",
  corDestaque: null,
  linkPresente: "https://www.serenatagift.com",
  // O exemplo imprime: é a vitrine, e vitrine que não deixa ver não vende.
  acesso: "confirmado",
  musicaId: null,
};

export const carregarQuadro = createServerFn({ method: "POST" })
  .validator((data: { tokenEdicao: string; token?: string }) => data)
  .handler(async ({ data }): Promise<Quadro | null> => {
    if (data.tokenEdicao === "exemplo") return EXEMPLO;
    // Exemplo com foto EM PÉ, pra conferir o arranjo de retrato sem depender
    // de um cliente ter subido uma. Não é linkado em lugar nenhum.
    if (data.tokenEdicao === "exemplo-retrato") {
      return { ...EXEMPLO, fotoUrl: "/img/teste-vertical.png" };
    }
    const db = supabaseAdmin();

    // O TOKEN DE EDIÇÃO é a credencial, como no resto do pós-compra: quem tem
    // o link é o dono. Sem sessão, sem login, e por isso funciona no celular
    // da pessoa direto do e-mail.
    const { data: m } = await db
      .from("musicas")
      .select("id, titulo, letra, dedicatoria, foto_path, cor_destaque, token, quiz_response_id, locale")
      .eq("token_edicao", data.tokenEdicao)
      .maybeSingle();
    if (!m?.letra) return null;

    // ── QUEM ESTÁ PEDINDO, E TEM DIREITO? ────────────────────
    // O token de edição prova que o link é dela, não que ela comprou o quadro.
    // O direito mora em `quadros`, e quem prova a identidade é a sessão.
    let acesso: Quadro["acesso"] = "nenhum";
    const email = data.token ? await emailDaSessao(data.token) : null;
    if (email) {
      const { data: meu } = await db
        .from("quadros")
        .select("id, musica_id, titulo, dedicatoria")
        .ilike("email", email)
        .eq("musica_id", m.id)
        .maybeSingle();
      if (meu?.id) {
        acesso = "confirmado";
        // O que ela escreveu no QUADRO manda sobre o que está na página
        // presente: são peças diferentes e ela pode querer textos diferentes.
        if (meu.titulo) m.titulo = meu.titulo;
        if (meu.dedicatoria !== null && meu.dedicatoria !== undefined) {
          m.dedicatoria = meu.dedicatoria;
        }
      } else {
        const { count } = await db
          .from("quadros")
          .select("id", { count: "exact", head: true })
          .ilike("email", email)
          .is("musica_id", null);
        if ((count ?? 0) > 0) acesso = "previa";
      }
    }

    const { data: q } = await db
      .from("quiz_responses")
      .select("respostas")
      .eq("id", m.quiz_response_id)
      .maybeSingle();
    const nome = ((q?.respostas ?? {}) as Record<string, string>).nome?.trim() ?? "";

    // A foto por URL assinada LONGA (7 dias): a pessoa pode montar hoje e
    // imprimir na semana que vem, e link vencido no meio da impressão é o
    // tipo de falha que ela descobre no papel.
    let fotoUrl: string | null = null;
    if (m.foto_path) {
      const { data: u } = await db.storage
        .from("fotos")
        .createSignedUrl(m.foto_path, 60 * 60 * 24 * 7);
      fotoUrl = u?.signedUrl ?? null;
    }

    return {
      locale: m.locale === "es" ? "es" : "pt",
      titulo: m.titulo ?? "",
      nome,
      letra: limparLetra(m.letra),
      dedicatoria: m.dedicatoria,
      fotoUrl,
      corDestaque: m.cor_destaque,
      linkPresente: `https://www.serenatagift.com/p/${m.token}`,
      acesso,
      musicaId: m.id,
    };
  });
