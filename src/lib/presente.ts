import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/lib/supabase-admin";

// Carrega a página presente pelo token público.
//
// Tudo server-side: o bucket de áudio é PRIVADO e a URL é assinada aqui.
// O token é a única credencial — imprevisível (22 chars de UUID), sem
// enumeração possível, e não expõe id de sessão nem e-mail de ninguém.

export type Presente = {
  titulo: string;
  letra: string;
  nome: string;
  relacao: string | null;
  ocasiao: string | null;
  historia: string | null;
  audioUrl: string | null;
  timestamps: Array<{ word: string; start: number; end: number }> | null;
  duracaoS: number | null;
  /** Existe uma segunda versão pra ouvir? */
  temAlternativa: boolean;
  /** Qual está tocando agora. */
  versao: 1 | 2;
  /** Personalização do comprador (pode não existir). */
  fotoUrl: string | null;
  dedicatoria: string | null;
  /** Fotos que passam atrás da letra, na ordem. */
  galeria: string[];
  /** Segundo em que cada seção da música entra (intro, verso, refrão…). */
  secoes: number[];
  /** Cor de destaque escolhida pelo comprador (oklch), ou null pro padrão. */
  corDestaque: string | null;
  /** Efeito escolhido pelo comprador (ex.: "coracoes"), ou null. */
  efeito: string | null;
  /**
   * Quando o comprador mexeu no presente pela última vez. Serve só de
   * `?v=` no og:image: sem isso, trocar a foto depois de mandar o link não
   * adiantaria nada, porque o WhatsApp guarda a prévia por URL.
   */
  personalizadaEm: string | null;
};

// O Suno devolve os marcadores de seção DENTRO das palavras com timestamp:
// a primeira palavra de cada bloco vem como "[Chorus]\nPalavra". Isso dá o
// segundo exato em que o refrão entra — de graça, no dado que já compramos.
//
// É o que permite a foto virar no compasso certo. Quem usa música de
// catálogo não tem como fazer isso: não há sincronia possível entre uma
// faixa pronta e a história de alguém.
function extrairSecoes(
  palavras: Array<{ word: string; start: number }> | null,
): number[] {
  if (!palavras?.length) return [];
  const marcos = palavras.filter((p) => /\[[^\]]+\]/.test(p.word)).map((p) => p.start);
  // Sem marcador (ou só o do início), não inventa estrutura: quem consome
  // decide o que fazer com a lista vazia.
  return marcos.length > 1 ? marcos : [];
}

export const carregarPresente = createServerFn({ method: "GET" })
  // `versao: 2` toca a alternativa. O Suno devolve duas gravações da mesma
  // letra numa única chamada; as duas fazem parte do que a pessoa leva.
  .validator((data: { token: string; versao?: number }) => data)
  .handler(async ({ data }): Promise<Presente | null> => {
    const db = supabaseAdmin();

    const { data: m } = await db
      .from("musicas")
      .select(
        "titulo, letra, status, audio_path, audio_path_v2, timestamps, timestamps_v2, duracao_s, quiz_response_id, foto_path, dedicatoria, galeria, versao_preferida, cor_destaque, efeito, personalizada_em",
      )
      .eq("token", data.token)
      .maybeSingle();

    if (!m || m.status !== "pronta") return null;

    const { data: q } = await db
      .from("quiz_responses")
      .select("respostas")
      .eq("id", m.quiz_response_id)
      .maybeSingle();

    const r = (q?.respostas ?? {}) as Record<string, string>;

    const temAlternativa = Boolean(m.audio_path_v2);
    // Sem ?v= no link, abre na versão que o COMPRADOR marcou como preferida
    // (a que ele gostou mais). Com ?v= explícito, respeita o que foi pedido.
    // Só cai na v2 se ela existir de verdade — link com ?v=2 numa música de
    // uma versão só toca a principal em vez de dar tela muda.
    const desejada = data.versao ?? m.versao_preferida ?? 1;
    const versao: 1 | 2 = desejada === 2 && temAlternativa ? 2 : 1;
    const caminho = versao === 2 ? m.audio_path_v2 : m.audio_path;

    let audioUrl: string | null = null;
    if (caminho) {
      // 7 dias: tempo de sobra pra pessoa abrir, reabrir e mostrar pros outros.
      const { data: assinada } = await db.storage
        .from("musicas")
        .createSignedUrl(caminho, 60 * 60 * 24 * 7);
      audioUrl = assinada?.signedUrl ?? null;
    }

    return {
      titulo: m.titulo ?? "Sua música",
      letra: m.letra ?? "",
      nome: r.nome ?? "você",
      relacao: r.relacao ?? null,
      ocasiao: r.ocasiao ?? null,
      // A história vira o "encarte" do disco.
      historia: [r.historia1, r.historia2].filter(Boolean).join("\n\n") || null,
      audioUrl,
      // Cada gravação tem seus timestamps: os da v1 em `timestamps`, os da v2
      // em `timestamps_v2`. Usar os de uma na outra acenderia a letra fora do
      // que se ouve. Quando a v2 não tiver os seus (músicas antigas, antes do
      // backfill), cai em null e mostra a letra estática.
      timestamps:
        (versao === 1
          ? (m.timestamps as Array<{ word: string; start: number; end: number }> | null)
          : (m.timestamps_v2 as Array<{ word: string; start: number; end: number }> | null)) ??
        null,
      duracaoS: versao === 1 && m.duracao_s ? Number(m.duracao_s) : null,
      temAlternativa,
      versao,
      // Bucket de fotos é PRIVADO (são fotos de família): URL assinada, do
      // mesmo jeito que o áudio.
      fotoUrl: m.foto_path
        ? ((
            await db.storage
              .from("fotos")
              .createSignedUrl(m.foto_path, 60 * 60 * 24 * 7)
          ).data?.signedUrl ?? null)
        : null,
      dedicatoria: m.dedicatoria ?? null,
      // Galeria nas DUAS versões: as fotos são as mesmas, o que muda é o
      // COMPASSO em que elas trocam — por isso as seções vêm dos timestamps
      // da versão que está tocando (a v2 tem timing próprio).
      galeria: m.galeria?.length
        ? (
            await db.storage
              .from("fotos")
              .createSignedUrls(m.galeria as string[], 60 * 60 * 24 * 7)
          ).data
            ?.map((d) => d.signedUrl)
            .filter((u): u is string => Boolean(u)) ?? []
        : [],
      secoes: extrairSecoes(
        (versao === 1 ? m.timestamps : m.timestamps_v2) as
          | Array<{ word: string; start: number }>
          | null,
      ),
      corDestaque: m.cor_destaque ?? null,
      efeito: m.efeito ?? null,
      personalizadaEm: (m.personalizada_em as string | null) ?? null,
    };
  });
