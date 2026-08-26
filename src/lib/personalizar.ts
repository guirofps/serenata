import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/lib/supabase-admin";

// Personalização da página-presente pelo COMPRADOR.
//
// Autorização: `token_edicao`, que é diferente do `token` público. O público
// vai colado no WhatsApp do presenteado; se ele autorizasse escrita, quem
// GANHA o presente poderia alterá-lo. Aqui um lê e o outro escreve.
//
// Tudo passa pelo servidor com service role — não existe policy de storage
// para anon, então não há caminho que escreva sem passar por esta validação.

export type PresenteEditavel = {
  /** Idioma da venda. Decide a moldura do editor. */
  locale: "pt" | "es";
  titulo: string;
  nome: string;
  dedicatoria: string | null;
  fotoUrl: string | null;
  /** Galeria que passa atrás da letra. Caminho + URL assinada, na ordem. */
  galeria: Array<{ caminho: string; url: string }>;
  /** As duas gravações, pra ouvir e comparar. `audioUrlV2` pode não existir. */
  audioUrlV1: string | null;
  audioUrlV2: string | null;
  /** Qual gravação o comprador prefere (1 ou 2). */
  versaoPreferida: 1 | 2;
  /** Cor de destaque escolhida (oklch), ou null pro padrão. */
  corDestaque: string | null;
  efeito: string | null;
  tokenPublico: string;
  publicada: boolean;
  /**
   * Quantas refações esta música já teve. Zero na imensa maioria, e quando é
   * maior que zero as gravações atuais ganham o selo de "nova versão".
   */
  refacoes: number;
  /**
   * As gravações ARQUIVADAS, da mais recente pra mais antiga.
   *
   * Elas existem porque a refação SOMA em vez de substituir: o custo da
   * primeira gravação já foi pago e não volta, então guardar transforma o
   * mesmo gasto em mais produto e cobre quem pede o ajuste, ouve, e prefere o
   * original.
   */
  anteriores: Array<{
    ordem: number;
    titulo: string | null;
    audioUrlV1: string | null;
    audioUrlV2: string | null;
    pedido: string | null;
  }>;
};

export const MAX_GALERIA = 12;

const MAX_DEDICATORIA = 280;
// O bucket recusa acima de 5 MB, mas a checagem aqui evita subir o payload
// inteiro só para o storage rejeitar no fim.
const MAX_FOTO_BYTES = 5 * 1024 * 1024;
const TIPOS_OK = ["image/jpeg", "image/png", "image/webp"] as const;

/**
 * O ARQUIVO É MESMO UMA IMAGEM DO TIPO QUE ELE DIZ SER?
 *
 * O `data:image/jpeg;base64,` da frente é escrito pelo cliente — é uma
 * ETIQUETA, não uma prova. Sem conferir os bytes, o bucket vira hospedagem de
 * arquivo arbitrário (5 MB por vez, 12 por presente) servido por URL assinada
 * do nosso domínio, com o `Content-Type` que o remetente escolheu. É o tipo de
 * coisa que só aparece quando alguém já está usando.
 *
 * A assinatura de cada formato é fixa e mora nos primeiros bytes:
 *   JPEG  FF D8 FF
 *   PNG   89 50 4E 47 0D 0A 1A 0A
 *   WEBP  "RIFF" ---- "WEBP"  (o tamanho vai no meio, por isso os dois pedaços)
 */
function conferirAssinatura(bytes: Buffer, tipo: string): boolean {
  if (tipo === "image/jpeg")
    return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (tipo === "image/png") {
    return (
      bytes.length > 8 &&
      bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    );
  }
  if (tipo === "image/webp") {
    return (
      bytes.length > 12 &&
      bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
      bytes.subarray(8, 12).toString("ascii") === "WEBP"
    );
  }
  return false;
}

async function buscarPorTokenEdicao(tokenEdicao: string) {
  const db = supabaseAdmin();
  const { data } = await db
    .from("musicas")
    .select(
      "id, token, titulo, foto_path, galeria, dedicatoria, personalizada_em, quiz_response_id, audio_path, audio_path_v2, versao_preferida, cor_destaque, efeito, refacoes_usadas",
    )
    .eq("token_edicao", tokenEdicao)
    .maybeSingle();
  return data;
}

/** Assina vários caminhos de uma vez, preservando a ordem. */
export async function assinarGaleria(
  caminhos: string[] | null,
): Promise<Array<{ caminho: string; url: string }>> {
  if (!caminhos?.length) return [];
  const { data } = await supabaseAdmin()
    .storage.from("fotos")
    .createSignedUrls(caminhos, 60 * 60 * 24 * 7);
  // createSignedUrls devolve na ordem pedida; um caminho que sumiu do bucket
  // vem sem signedUrl e é descartado, em vez de virar imagem quebrada.
  return (data ?? [])
    .map((d, i) => ({ caminho: caminhos[i], url: d.signedUrl ?? "" }))
    .filter((x) => x.url);
}

async function urlDaFoto(caminho: string | null): Promise<string | null> {
  if (!caminho) return null;
  const { data } = await supabaseAdmin()
    .storage.from("fotos")
    .createSignedUrl(caminho, 60 * 60 * 24 * 7);
  return data?.signedUrl ?? null;
}

async function urlDoAudio(caminho: string | null): Promise<string | null> {
  if (!caminho) return null;
  const { data } = await supabaseAdmin()
    .storage.from("musicas")
    .createSignedUrl(caminho, 60 * 60 * 24 * 7);
  return data?.signedUrl ?? null;
}

/** Carrega o presente para a tela de edição. */
export const carregarParaEditar = createServerFn({ method: "GET" })
  .validator((data: { tokenEdicao: string }) => data)
  .handler(async ({ data }): Promise<PresenteEditavel | null> => {
    const m = await buscarPorTokenEdicao(data.tokenEdicao);
    if (!m) return null;

    const { data: q } = await supabaseAdmin()
      .from("quiz_responses")
      .select("respostas, locale")
      .eq("id", m.quiz_response_id)
      .maybeSingle();
    const r = (q?.respostas ?? {}) as Record<string, string>;

    // O idioma da venda: o editor abre por link de e-mail, sem prefixo de
    // rota de onde deduzir. Ver a migration 20260807000000_locale.
    const locale = (q as { locale?: string } | null)?.locale === "es" ? "es" : "pt";

    return {
      locale: locale as "pt" | "es",
      titulo: m.titulo ?? "Sua música",
      nome: r.nome ?? "você",
      dedicatoria: m.dedicatoria,
      fotoUrl: await urlDaFoto(m.foto_path),
      galeria: await assinarGaleria(m.galeria),
      audioUrlV1: await urlDoAudio(m.audio_path),
      audioUrlV2: await urlDoAudio(m.audio_path_v2),
      versaoPreferida: (m.versao_preferida === 2 ? 2 : 1) as 1 | 2,
      corDestaque: m.cor_destaque ?? null,
      efeito: m.efeito ?? null,
      tokenPublico: m.token,
      publicada: Boolean(m.personalizada_em),
      refacoes: m.refacoes_usadas ?? 0,
      anteriores: await versoesAnteriores(m.id),
    };
  });

/**
 * As gravações que a refação arquivou, prontas pra tocar.
 *
 * Consulta separada e não um join: são zero linhas pra quase todo mundo, e
 * assinar URL de áudio custa uma chamada cada — não vale pagar isso na carga
 * de quem nunca pediu ajuste.
 */
async function versoesAnteriores(musicaId: string) {
  const { data } = await supabaseAdmin()
    .from("versoes_musica")
    .select("ordem, titulo, audio_path, audio_path_v2, pedido")
    .eq("musica_id", musicaId)
    .order("ordem", { ascending: false });
  if (!data?.length) return [];
  return Promise.all(
    data.map(async (v) => ({
      ordem: v.ordem as number,
      titulo: (v.titulo as string | null) ?? null,
      audioUrlV1: await urlDoAudio(v.audio_path as string | null),
      audioUrlV2: await urlDoAudio(v.audio_path_v2 as string | null),
      pedido: (v.pedido as string | null) ?? null,
    })),
  );
}

/** Salva a versão preferida (1 ou 2) — a que abre por padrão no presente. */
export const definirVersaoPreferida = createServerFn({ method: "POST" })
  .validator((data: { tokenEdicao: string; versao: number }) => data)
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    const m = await buscarPorTokenEdicao(data.tokenEdicao);
    if (!m) return { ok: false };
    const versao = data.versao === 2 ? 2 : 1;
    await supabaseAdmin().from("musicas").update({ versao_preferida: versao }).eq("id", m.id);
    return { ok: true };
  });

/** Salva a cor de destaque. Valida contra os presets pra não aceitar
 *  qualquer string (quem chama a API direto não passa pela interface). */
export const definirCor = createServerFn({ method: "POST" })
  .validator((data: { tokenEdicao: string; oklch: string }) => data)
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    const { CORES_PRESENTE } = await import("@/lib/marca");
    const valida = CORES_PRESENTE.some((c) => c.oklch === data.oklch);
    if (!valida) return { ok: false };
    const m = await buscarPorTokenEdicao(data.tokenEdicao);
    if (!m) return { ok: false };
    await supabaseAdmin().from("musicas").update({ cor_destaque: data.oklch }).eq("id", m.id);
    return { ok: true };
  });

/** Salva o efeito da página (ex.: "coracoes" ou "nenhum"). */
export const definirEfeito = createServerFn({ method: "POST" })
  .validator((data: { tokenEdicao: string; efeito: string }) => data)
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    const VALIDOS = ["nenhum", "coracoes", "estrelas", "petalas", "luzes"];
    if (!VALIDOS.includes(data.efeito)) return { ok: false };
    const m = await buscarPorTokenEdicao(data.tokenEdicao);
    if (!m) return { ok: false };
    // "nenhum" grava null (sem efeito).
    const valor = data.efeito === "nenhum" ? null : data.efeito;
    await supabaseAdmin().from("musicas").update({ efeito: valor }).eq("id", m.id);
    return { ok: true };
  });

/** Acrescenta fotos à galeria (as que passam atrás da letra). */
export const adicionarNaGaleria = createServerFn({ method: "POST" })
  .validator((data: { tokenEdicao: string; fotosBase64: string[] }) => data)
  .handler(
    async ({
      data,
    }): Promise<{
      ok: boolean;
      galeria?: Array<{ caminho: string; url: string }>;
      erro?: string;
    }> => {
      const m = await buscarPorTokenEdicao(data.tokenEdicao);
      if (!m) return { ok: false, erro: "não encontrado" };

      const atual: string[] = m.galeria ?? [];
      const cabem = MAX_GALERIA - atual.length;
      if (cabem <= 0) return { ok: false, erro: `A galeria já tem ${MAX_GALERIA} fotos.` };

      const db = supabaseAdmin();
      const novos: string[] = [];

      for (const [i, b64] of data.fotosBase64.slice(0, cabem).entries()) {
        const casa = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(b64);
        if (!casa) continue; // ignora o inválido em vez de derrubar o lote
        const [, tipo, corpo] = casa;
        const bytes = Buffer.from(corpo, "base64");
        if (bytes.length > MAX_FOTO_BYTES) continue;
        // A etiqueta `data:` não prova nada; os bytes provam. Ver
        // `conferirAssinatura`.
        if (!conferirAssinatura(bytes, tipo)) continue;

        // Nome único por posição+tempo: sem isso, subir duas fotos no mesmo
        // segundo sobrescreveria uma com a outra.
        const ext = tipo === "image/png" ? "png" : tipo === "image/webp" ? "webp" : "jpg";
        const caminho = `${m.id}/g-${Date.now()}-${atual.length + i}.${ext}`;
        const { error } = await db.storage
          .from("fotos")
          .upload(caminho, bytes, { contentType: tipo, upsert: false });
        if (error) {
          console.error("[galeria] upload falhou:", error.message);
          continue;
        }
        novos.push(caminho);
      }

      if (!novos.length) return { ok: false, erro: "Nenhuma foto pôde ser usada." };

      const galeria = [...atual, ...novos];
      const { error } = await db
        .from("musicas")
        .update({ galeria, personalizada_em: new Date().toISOString() })
        .eq("id", m.id);
      if (error) {
        console.error("[galeria] update falhou:", error.message);
        return { ok: false, erro: "Não consegui salvar agora." };
      }
      return { ok: true, galeria: await assinarGaleria(galeria) };
    },
  );

/** Remove uma foto da galeria (e do bucket). */
export const removerDaGaleria = createServerFn({ method: "POST" })
  .validator((data: { tokenEdicao: string; caminho: string }) => data)
  .handler(
    async ({
      data,
    }): Promise<{ ok: boolean; galeria: Array<{ caminho: string; url: string }> }> => {
      const m = await buscarPorTokenEdicao(data.tokenEdicao);
      if (!m) return { ok: false, galeria: [] };
      const db = supabaseAdmin();

      // O CAMINHO TEM QUE ESTAR NESTA GALERIA.
      //
      // Antes, `data.caminho` ia direto pro `remove()`: o token de edição
      // provava que a pessoa é dona DESTA música, e a linha seguinte apagava
      // qualquer arquivo do bucket que ela nomeasse — inclusive `<outra
      // musica>/capa.jpg`. Autorizar a porta e não conferir a sala é o mesmo
      // erro do `admin_session=true`, um andar abaixo: o token foi verificado, o
      // ALVO não.
      //
      // A conferência é contra a lista do banco, não contra um prefixo de
      // caminho: comparar `caminho.startsWith(m.id)` aceitaria um `../` no meio
      // e dependeria de o storage normalizar o caminho por nós.
      const atual: string[] = m.galeria ?? [];
      if (!atual.includes(data.caminho)) {
        return { ok: false, galeria: await assinarGaleria(atual) };
      }

      const galeria = atual.filter((c: string) => c !== data.caminho);
      await db.storage.from("fotos").remove([data.caminho]);
      await db.from("musicas").update({ galeria }).eq("id", m.id);
      return { ok: true, galeria: await assinarGaleria(galeria) };
    },
  );

/**
 * Salva foto e/ou dedicatória.
 *
 * A foto chega já redimensionada e cortada pelo cliente (canvas), em base64.
 * Redimensionar no cliente evita subir 8 MB de foto de celular e é o mesmo
 * passo que o corte quadrado exige de qualquer jeito.
 */
export const salvarPersonalizacao = createServerFn({ method: "POST" })
  .validator(
    (data: { tokenEdicao: string; dedicatoria?: string | null; fotoBase64?: string | null }) =>
      data,
  )
  .handler(async ({ data }): Promise<{ ok: boolean; fotoUrl?: string | null; erro?: string }> => {
    const m = await buscarPorTokenEdicao(data.tokenEdicao);
    // Mensagem genérica de propósito: não confirma se o token existe.
    if (!m) return { ok: false, erro: "não encontrado" };

    const db = supabaseAdmin();
    const patch: Record<string, unknown> = { personalizada_em: new Date().toISOString() };

    // ── dedicatória ──
    if (data.dedicatoria !== undefined) {
      const texto = (data.dedicatoria ?? "").trim();
      if (texto.length > MAX_DEDICATORIA) {
        return { ok: false, erro: `A dedicatória passa de ${MAX_DEDICATORIA} caracteres.` };
      }
      patch.dedicatoria = texto || null;
    }

    // ── foto ──
    let fotoUrl: string | null | undefined;
    if (data.fotoBase64) {
      const casa = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(data.fotoBase64);
      if (!casa) return { ok: false, erro: "Formato de imagem não aceito." };
      const [, tipo, b64] = casa;
      if (!TIPOS_OK.includes(tipo as (typeof TIPOS_OK)[number])) {
        return { ok: false, erro: "Formato de imagem não aceito." };
      }

      const bytes = Buffer.from(b64, "base64");
      if (bytes.length > MAX_FOTO_BYTES) {
        return { ok: false, erro: "A imagem é grande demais." };
      }
      if (!conferirAssinatura(bytes, tipo)) {
        return { ok: false, erro: "Formato de imagem não aceito." };
      }

      // Caminho fixo por música: republicar SUBSTITUI em vez de acumular
      // lixo no bucket a cada troca de foto.
      const ext = tipo === "image/png" ? "png" : tipo === "image/webp" ? "webp" : "jpg";
      const caminho = `${m.id}/capa.${ext}`;
      const { error } = await db.storage
        .from("fotos")
        .upload(caminho, bytes, { contentType: tipo, upsert: true });
      if (error) {
        console.error("[personalizar] upload falhou:", error);
        return { ok: false, erro: "Não consegui subir a foto agora." };
      }

      // Trocou de extensão? Apaga a anterior, senão fica órfã no bucket.
      if (m.foto_path && m.foto_path !== caminho) {
        await db.storage.from("fotos").remove([m.foto_path]);
      }
      patch.foto_path = caminho;
      fotoUrl = await urlDaFoto(caminho);
    }

    const { error } = await db.from("musicas").update(patch).eq("id", m.id);
    if (error) {
      console.error("[personalizar] update falhou:", error);
      return { ok: false, erro: "Não consegui salvar agora." };
    }
    return { ok: true, fotoUrl };
  });

/** Remove a foto de capa (volta ao visual padrão). */
export const removerFoto = createServerFn({ method: "POST" })
  .validator((data: { tokenEdicao: string }) => data)
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    const m = await buscarPorTokenEdicao(data.tokenEdicao);
    if (!m) return { ok: false };
    const db = supabaseAdmin();
    if (m.foto_path) await db.storage.from("fotos").remove([m.foto_path]);
    await db.from("musicas").update({ foto_path: null }).eq("id", m.id);
    return { ok: true };
  });

/**
 * A URL assinada do MP3, sozinha.
 *
 * Existe pro botão "Baixar a música" do PAINEL. O `carregarParaEditar` já
 * devolve o áudio, mas junto com foto, galeria e versões anteriores — cinco a
 * dez assinaturas de Storage. Pra desenhar um botão no cartão da lista isso
 * seria caro por música e por carregamento, e a lista tem N delas.
 *
 * Chamado no CLIQUE, não na carga: quem abre o painel pra ver o link não paga
 * pela assinatura de quem vai baixar.
 *
 * A credencial é o `token_edicao`, igual ao editor e à refação. O painel exige
 * login, mas o token é o que ele já tem em mãos na linha da música, e usar a
 * mesma porta em todo lugar é o que evita ter duas regras de acesso.
 */
export const urlDaMusica = createServerFn({ method: "POST" })
  .validator((data: { tokenEdicao: string }) => data)
  .handler(
    async ({ data }): Promise<{ url: string | null; titulo: string; nome: string }> => {
      const vazio = { url: null, titulo: "Sua música", nome: "você" };
      const m = await buscarPorTokenEdicao(data.tokenEdicao);
      if (!m) return vazio;

      // A versão que ela escolheu, com a outra como reserva: quem nunca abriu
      // o editor tem `versao_preferida = 1` por padrão, e em música antiga o
      // v2 pode não existir.
      const caminho =
        (m.versao_preferida === 2 ? m.audio_path_v2 : m.audio_path) ??
        m.audio_path ??
        m.audio_path_v2;
      if (!caminho) return vazio;

      const { data: q } = await supabaseAdmin()
        .from("quiz_responses")
        .select("respostas")
        .eq("id", m.quiz_response_id)
        .maybeSingle();
      const r = (q?.respostas ?? {}) as Record<string, string>;

      return {
        url: await urlDoAudio(caminho),
        titulo: m.titulo ?? "Sua música",
        nome: r.nome?.trim() || "você",
      };
    },
  );
