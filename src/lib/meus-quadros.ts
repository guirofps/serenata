import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { emailDaSessao } from "@/lib/conta-sessao";
import { literalLike } from "@/lib/sql-like";

// O QUADRO DA PESSOA: o que ela comprou, de qual música é, e o que falta.
//
// Três funções e uma regra que governa as três: quem manda é o TOKEN da
// sessão, nunca um id que veio do navegador. Toda consulta e toda escrita
// confere que o quadro é dela antes de tocar em qualquer coisa.
//
// ── O DIREITO E O GASTO ──────────────────────────────────────────
//
// Comprar dá um direito (linha em `quadros` com `musica_id` nulo). O direito
// vira quadro na CONFIRMAÇÃO, que é quando ela escolhe a música. Enquanto não
// confirma, ela troca de música à vontade e nada foi gasto: é a diferença
// entre "tenho um quadro pra montar" e "meu quadro é o da música tal".
//
// Depois de confirmado, título, dedicatória e estilo continuam editáveis,
// porque ela vai voltar pra reimprimir. A MÚSICA não muda: senão um quadro
// comprado uma vez viraria quadro de todas as músicas dela.

export type MusicaDoQuadro = {
  id: string;
  titulo: string;
  /** O nome de quem a música é, pra ela reconhecer qual é qual. */
  para: string;
  genero: string | null;
  criadaEm: string;
  tokenEdicao: string;
  /** Já tem foto na página presente? A foto do quadro sai daí. */
  temFoto: boolean;
  /** Já existe quadro confirmado desta música? Evita ela gastar o segundo à toa. */
  jaTemQuadro: boolean;
};

export type MeusQuadros = {
  /**
   * O IDIOMA DA CONTA, tirado da música mais recente.
   *
   * `/meu-quadro` não tem prefixo de rota de onde deduzir, e é a mesma pista
   * que o painel usa. Sem isto a tela sai em português pra quem comprou no
   * funil mexicano e abriu o link do quadro direto.
   */
  locale: "pt" | "es";
  /** Quantos direitos comprados e ainda não amarrados a uma música. */
  paraMontar: number;
  /** Os quadros já confirmados, pra ela voltar e reimprimir. */
  prontos: Array<{
    id: string;
    musicaId: string;
    titulo: string;
    tokenEdicao: string;
  }>;
  /** Todas as músicas dela, pra escolher. */
  musicas: MusicaDoQuadro[];
};

/**
 * O estilo GRAVADO, com campos concretos.
 *
 * Não é `Record<string, unknown>` porque o serializador das server functions
 * recusa `unknown` (ele precisa saber que aquilo atravessa a rede). Campos
 * opcionais porque a linha pode ter sido gravada por uma versão anterior, com
 * menos opções de estilo.
 */
export type EstiloGravado = { modo?: string; cor?: string; efeito?: string };

/** O que a pessoa tem: direitos, quadros prontos e as músicas pra escolher. */
export const meusQuadros = createServerFn({ method: "POST" })
  .validator((data: { token: string }) => data)
  .handler(async ({ data }): Promise<MeusQuadros> => {
    const vazio: MeusQuadros = { locale: "pt", paraMontar: 0, prontos: [], musicas: [] };
    const email = await emailDaSessao(data.token);
    if (!email) return vazio;

    const db = supabaseAdmin();
    const { data: conta } = await db.from("users").select("id").eq("email", email).maybeSingle();

    const [{ data: direitos }, { data: musicas }] = await Promise.all([
      db
        .from("quadros")
        .select("id, musica_id, titulo, confirmado_em")
        .ilike("email", literalLike(email))
        .order("created_at", { ascending: true }),
      // As músicas vêm pela CONTA, não pelo e-mail: é `user_id` que amarra
      // música a dono no resto do sistema, e o e-mail da compra às vezes é
      // diferente do e-mail do quiz.
      conta?.id
        ? db
            .from("musicas")
            .select("id, titulo, token_edicao, genero, created_at, foto_path, quiz_response_id, locale")
            .eq("user_id", conta.id)
            .eq("status", "pronta")
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] as never[] }),
    ]);

    const linhas = direitos ?? [];
    const usadas = new Set(linhas.map((q) => q.musica_id).filter(Boolean) as string[]);

    // O nome de quem a música é sai das respostas do quiz. Sem ele, três
    // músicas com o mesmo título (que acontece: o título é da canção) ficam
    // indistinguíveis na hora de escolher.
    const quizIds = (musicas ?? []).map((m) => m.quiz_response_id).filter(Boolean);
    const paraDe = new Map<string, string>();
    if (quizIds.length) {
      const { data: quizzes } = await db
        .from("quiz_responses")
        .select("id, respostas")
        .in("id", quizIds);
      for (const q of quizzes ?? []) {
        const nome = ((q.respostas ?? {}) as Record<string, string>).nome?.trim();
        if (nome) paraDe.set(q.id, nome);
      }
    }

    return {
      locale: (musicas ?? [])[0]?.locale === "es" ? "es" : "pt",
      paraMontar: linhas.filter((q) => !q.musica_id).length,
      prontos: linhas
        .filter((q) => q.musica_id)
        .map((q) => {
          const m = (musicas ?? []).find((x) => x.id === q.musica_id);
          return {
            id: q.id,
            musicaId: q.musica_id as string,
            titulo: q.titulo ?? m?.titulo ?? "Sua música",
            tokenEdicao: m?.token_edicao ?? "",
          };
        }),
      musicas: (musicas ?? []).map((m) => ({
        id: m.id,
        titulo: m.titulo ?? "Sua música",
        para: paraDe.get(m.quiz_response_id) ?? "",
        genero: m.genero,
        criadaEm: m.created_at,
        tokenEdicao: m.token_edicao,
        temFoto: Boolean(m.foto_path),
        jaTemQuadro: usadas.has(m.id),
      })),
    };
  });

/**
 * AMARRA UM DIREITO A UMA MÚSICA. É aqui que o quadro é gasto.
 *
 * Pega o direito mais antigo sem música. Se não houver nenhum, recusa: é o
 * ponto em que um quadro comprado viraria quadro de todas as músicas dela.
 */
export const confirmarQuadro = createServerFn({ method: "POST" })
  .validator((data: { token: string; musicaId: string }) => data)
  .handler(
    async ({
      data,
    }): Promise<
      { ok: true; tokenEdicao: string } | { ok: false; erro: "sem-conta" | "sem-direito" | "sem-musica" }
    > => {
      const email = await emailDaSessao(data.token);
      if (!email) return { ok: false, erro: "sem-conta" };

      const db = supabaseAdmin();

      // A MÚSICA É DELA? Sem esta pergunta, um id colado na requisição faria o
      // quadro sair com a música de outra pessoa.
      const { data: conta } = await db.from("users").select("id").eq("email", email).maybeSingle();
      if (!conta?.id) return { ok: false, erro: "sem-musica" };
      const { data: musica } = await db
        .from("musicas")
        .select("id, titulo, dedicatoria, token_edicao")
        .eq("id", data.musicaId)
        .eq("user_id", conta.id)
        .maybeSingle();
      if (!musica?.id) return { ok: false, erro: "sem-musica" };

      // Já confirmado pra esta música: devolve o mesmo quadro em vez de gastar
      // um segundo direito. Clicar duas vezes não pode custar dois quadros.
      const { data: jaTem } = await db
        .from("quadros")
        .select("id")
        .ilike("email", literalLike(email))
        .eq("musica_id", musica.id)
        .maybeSingle();
      if (jaTem?.id) return { ok: true, tokenEdicao: musica.token_edicao };

      const { data: direito } = await db
        .from("quadros")
        .select("id")
        .ilike("email", literalLike(email))
        .is("musica_id", null)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (!direito?.id) return { ok: false, erro: "sem-direito" };

      // TÍTULO E DEDICATÓRIA NASCEM COPIADOS da página presente. Ela já
      // escreveu isso uma vez; pedir de novo é trabalho repetido, e trabalho
      // repetido é onde as pessoas desistem.
      const { error } = await db
        .from("quadros")
        .update({
          musica_id: musica.id,
          confirmado_em: new Date().toISOString(),
          titulo: musica.titulo,
          dedicatoria: musica.dedicatoria,
        })
        .eq("id", direito.id)
        // A trava contra corrida entre duas abas: só atualiza se AINDA estiver
        // sem música. A segunda aba não encontra a linha e não gasta nada.
        .is("musica_id", null);
      if (error) return { ok: false, erro: "sem-direito" };

      return { ok: true, tokenEdicao: musica.token_edicao };
    },
  );

/** Salva o que ela escreveu e escolheu, pra não morrer no localStorage. */
export const salvarQuadro = createServerFn({ method: "POST" })
  .validator(
    (data: {
      token: string;
      musicaId: string;
      titulo?: string;
      dedicatoria?: string;
      estilo?: EstiloGravado;
    }) => data,
  )
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    const email = await emailDaSessao(data.token);
    if (!email) return { ok: false };
    const db = supabaseAdmin();
    const mudanca: Record<string, unknown> = {};
    if (data.titulo !== undefined) mudanca.titulo = data.titulo.slice(0, 120);
    if (data.dedicatoria !== undefined) mudanca.dedicatoria = data.dedicatoria.slice(0, 400);
    if (data.estilo !== undefined) mudanca.estilo = data.estilo;
    if (!Object.keys(mudanca).length) return { ok: true };

    const { error } = await db
      .from("quadros")
      .update(mudanca)
      .ilike("email", literalLike(email))
      .eq("musica_id", data.musicaId);
    return { ok: !error };
  });

/**
 * TENHO DIREITO A ESTE QUADRO?
 *
 * Separado de `carregarQuadro` porque a resposta depende da SESSÃO, e o loader
 * da rota roda no servidor sem navegador: não há token pra ler lá. Então a
 * folha carrega primeiro (é o que ela veio ver) e o direito chega logo depois,
 * numa chamada que não arrasta a letra inteira de novo.
 */
export const acessoAoQuadro = createServerFn({ method: "POST" })
  .validator((data: { token: string; musicaId: string }) => data)
  .handler(
    async ({
      data,
    }): Promise<{
      acesso: "confirmado" | "previa" | "nenhum";
      titulo: string | null;
      dedicatoria: string | null;
      estilo: EstiloGravado | null;
    }> => {
      const nada = { acesso: "nenhum" as const, titulo: null, dedicatoria: null, estilo: null };
      const email = await emailDaSessao(data.token);
      if (!email) return nada;

      const db = supabaseAdmin();
      const { data: meu } = await db
        .from("quadros")
        .select("id, titulo, dedicatoria, estilo")
        .ilike("email", literalLike(email))
        .eq("musica_id", data.musicaId)
        .maybeSingle();
      if (meu?.id) {
        return {
          acesso: "confirmado",
          titulo: meu.titulo,
          dedicatoria: meu.dedicatoria,
          estilo: (meu.estilo ?? null) as EstiloGravado | null,
        };
      }

      const { count } = await db
        .from("quadros")
        .select("id", { count: "exact", head: true })
        .ilike("email", literalLike(email))
        .is("musica_id", null);
      return {
        acesso: (count ?? 0) > 0 ? "previa" : "nenhum",
        titulo: null,
        dedicatoria: null,
        estilo: null,
      };
    },
  );
