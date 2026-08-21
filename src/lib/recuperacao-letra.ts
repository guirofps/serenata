import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { MODELO_LETRA, registrarCustoLetra, type UsoClaude } from "@/lib/custos";
import { dispararGeracaoMusica } from "@/lib/gerar-letra";

// AJUSTE DE LETRA E REGRAVAÇÃO, na mão de quem está falando com o cliente.
//
// O buraco que isto fecha: parte das vendas não cai por preço nem por
// desconfiança, cai por UM detalhe da letra. "São 22 anos de casados, não 16."
// "O apelido dele é Nem, não amor." Hoje o atendente não tem o que fazer com
// isso: não vê a letra, não consegue mudar, não consegue regravar. Ou o dono
// para o que está fazendo e resolve no banco, ou a venda morre.
//
// Caso real (17/08) que motivou isto: uma cliente com Pix gerado e não pago
// perguntou se dava pra trocar o número de anos na letra. A letra estava
// pronta, a música gravada, e a única pessoa capaz de mexer era o dono.
//
// A conta é ridícula: reescrever a letra custa centavos de Claude e regravar
// custa R$ 0,32 de kie.ai, contra R$ 38 de venda que já estava perdida.

const MODEL = MODELO_LETRA;

// System próprio, e curto de propósito. O `systemDaLetra` da coautoria ensina
// a ESCREVER do zero a partir do quiz; aqui o trabalho é o oposto, mexer o
// mínimo numa letra que a pessoa já leu e já aprovou quase inteira. Usar o
// prompt de criação aqui devolveria uma letra nova, e a cliente perderia
// justamente os versos de que gostou.
const SYSTEM_AJUSTE = `Você ajusta letras de música já escritas, em português do Brasil.

Recebe uma letra pronta e um pedido de mudança feito pelo cliente. Sua tarefa é
aplicar EXATAMENTE o que foi pedido e mais nada.

Regras:
- Mexa só no necessário. Todo verso não afetado pelo pedido volta IDÊNTICO,
  palavra por palavra. A pessoa já leu e aprovou o resto.
- Se o pedido troca um dado (idade, tempo de casados, nome, apelido, cidade),
  troque em TODAS as ocorrências, inclusive nos refrões repetidos.
- Preserve as marcações de estrutura ([Verse 1], [Chorus], [Bridge]...) e a
  quantidade de linhas de cada bloco.
- Mantenha a métrica cantável: a linha nova precisa ter mais ou menos o mesmo
  número de sílabas da antiga, senão não cabe na melodia.
- Não invente fato que o cliente não deu. Se o pedido for vago demais para
  aplicar sem inventar, devolva a letra intacta e diga o que falta.
- Nada de travessão no texto da letra.

Responda SÓ com JSON:
{"letra": "a letra inteira, com as marcações", "mudou": ["o que foi alterado, 1 linha cada"], "aviso": "vazio, ou o que faltou para aplicar o pedido"}`;

async function chamarClaude(userMsg: string): Promise<{ texto: string; uso: UsoClaude }> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY ausente no servidor");
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4000,
      // Sem `output_config.effort` — 400 no Haiku 4.5. Ver `coautoria.ts`.
      system: [{ type: "text", text: SYSTEM_AJUSTE, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: userMsg }],
    }),
  });
  if (!r.ok) {
    // O CORPO É LIDO UMA VEZ SÓ. `r.text()` consome o stream: ler de novo pra
    // montar a mensagem do throw devolveria string vazia, e o erro chegaria
    // sem a única informação que distingue saldo de chave de sobrecarga.
    const corpo = (await r.text()).slice(0, 500);
    // Loga no servidor e, quando a causa precisa de gente, manda e-mail.
    // Import dinâmico: mantém o Resend fora de qualquer bundle que não seja
    // este caminho de erro. Não usa `await` no alerta pra não somar latência
    // de e-mail em cima de um usuário que já está esperando — mas o `catch`
    // existe porque promessa solta que rejeita derruba o processo no Node.
    void import("@/lib/alerta-operacao")
      .then((m) => m.alertarFalhaClaude({ status: r.status, corpo, onde: "recuperacao-letra" }))
      .catch(() => {});
    throw new Error(`Anthropic ${r.status}: ${corpo.slice(0, 200)}`);
  }
  const j = await r.json();
  return {
    texto: j.content?.find((b: { type: string }) => b.type === "text")?.text ?? "",
    uso: (j.usage ?? {}) as UsoClaude,
  };
}

function extrairJson<T>(texto: string): T {
  const s = texto.indexOf("{");
  const e = texto.lastIndexOf("}");
  if (s === -1 || e === -1) throw new Error("Resposta do modelo não continha JSON");
  return JSON.parse(texto.slice(s, e + 1)) as T;
}

export type LetraParaAjuste = {
  musicaId: string;
  titulo: string | null;
  letra: string;
  paraQuem: string | null;
  relacao: string | null;
  genero: string | null;
  locale: "pt" | "es";
  status: string;
  /** Já pagou? Muda o que é seguro fazer com esta música. */
  pago: boolean;
  /** Já montou o presente (foto/dedicatória)? Então provavelmente já entregou. */
  entregue: boolean;
  linkPresente: string | null;
  /** As duas versões, por URL assinada de 2h. Null enquanto não existirem. */
  audioV1: string | null;
  audioV2: string | null;
  geradaEm: string | null;
};

// Áudio por URL ASSINADA e curta, como no resto do painel: o bucket é privado
// e link que não expira acaba encaminhado pra fora. O atendente precisa OUVIR
// e BAIXAR pra mandar pro cliente, não precisa de link eterno.
async function assinarAudio(caminho: string | null): Promise<string | null> {
  if (!caminho) return null;
  const { data } = await supabaseAdmin().storage.from("musicas").createSignedUrl(caminho, 2 * 3600);
  return data?.signedUrl ?? null;
}

/** A letra inteira de uma música, com o contexto que decide o que pode ser feito. */
export const letraParaAjuste = createServerFn({ method: "POST" })
  .validator((data: { musicaId: string }) => data)
  .handler(async ({ data }): Promise<LetraParaAjuste> => {
    const { exigirRecuperacao } = await import("@/lib/admin-auth.server");
    exigirRecuperacao();
    const db = supabaseAdmin();

    const { data: m, error } = await db
      .from("musicas")
      .select("id, titulo, letra, genero, status, token, quiz_response_id, foto_path, dedicatoria, audio_path, audio_path_v2, gerada_em")
      .eq("id", data.musicaId)
      .single();
    if (error || !m) throw new Error("música não encontrada");

    const { data: q } = await db
      .from("quiz_responses")
      .select("respostas, locale")
      .eq("id", m.quiz_response_id)
      .maybeSingle();
    const r = (q?.respostas ?? {}) as Record<string, string>;

    const { data: pedidos } = await db
      .from("pedidos")
      .select("status")
      .eq("quiz_response_id", m.quiz_response_id);

    const [audioV1, audioV2] = await Promise.all([
      assinarAudio(m.audio_path),
      assinarAudio(m.audio_path_v2),
    ]);

    const SITE = "https://www.serenatagift.com";
    return {
      musicaId: m.id,
      titulo: m.titulo,
      letra: m.letra ?? "",
      paraQuem: r.nome?.trim() ?? null,
      relacao: r.relacao ?? null,
      genero: m.genero,
      locale: q?.locale === "es" ? "es" : "pt",
      status: m.status,
      pago: (pedidos ?? []).some((p) => p.status === "pago"),
      entregue: Boolean(m.foto_path || m.dedicatoria),
      linkPresente: m.token ? `${SITE}/p/${m.token}` : null,
      audioV1,
      audioV2,
      geradaEm: m.gerada_em,
    };
  });

/**
 * Só o estado da gravação, pra tela acompanhar sem recarregar a busca inteira.
 *
 * Sem isto o atendente mandava gravar e ficava no escuro: a mensagem era
 * "recarregue a busca", e ele teria que digitar o e-mail do cliente de novo
 * pra descobrir se ficou pronta. Com o cliente esperando no WhatsApp, isso é
 * o suficiente pra ele desistir de usar a ferramenta.
 */
export const estadoDaMusica = createServerFn({ method: "POST" })
  .validator((data: { musicaId: string }) => data)
  .handler(
    async ({
      data,
    }): Promise<{
      status: string;
      erro: string | null;
      audioV1: string | null;
      audioV2: string | null;
      geradaEm: string | null;
    }> => {
      const { exigirRecuperacao } = await import("@/lib/admin-auth.server");
      exigirRecuperacao();
      const { data: m } = await supabaseAdmin()
        .from("musicas")
        .select("status, erro, audio_path, audio_path_v2, gerada_em")
        .eq("id", data.musicaId)
        .single();
      if (!m) throw new Error("música não encontrada");
      const [audioV1, audioV2] = await Promise.all([
        assinarAudio(m.audio_path),
        assinarAudio(m.audio_path_v2),
      ]);
      return { status: m.status, erro: m.erro, audioV1, audioV2, geradaEm: m.gerada_em };
    },
  );

/**
 * Aplica o pedido do cliente e devolve a PROPOSTA. Não salva.
 *
 * Separado do salvar de propósito: o atendente tem que LER antes de gravar.
 * Um ajuste automático que troca o verso errado e vai direto pro banco
 * transforma um cliente quase convencido num cliente irritado.
 */
export const reescreverLetra = createServerFn({ method: "POST" })
  .validator((data: { musicaId: string; pedido: string }) => data)
  .handler(async ({ data }): Promise<{ letra: string; mudou: string[]; aviso: string }> => {
    const { exigirRecuperacao } = await import("@/lib/admin-auth.server");
    exigirRecuperacao();
    const pedido = data.pedido.trim();
    if (pedido.length < 3) throw new Error("descreva o que mudar");

    const db = supabaseAdmin();
    const { data: m } = await db
      .from("musicas")
      .select("letra, quiz_response_id")
      .eq("id", data.musicaId)
      .single();
    if (!m?.letra) throw new Error("música sem letra");

    const { texto, uso } = await chamarClaude(
      `LETRA ATUAL:\n${m.letra}\n\nPEDIDO DO CLIENTE:\n${pedido}`,
    );
    const j = extrairJson<{ letra?: string; mudou?: string[]; aviso?: string }>(texto);
    if (!j.letra?.trim()) throw new Error("modelo não devolveu letra");

    await registrarCustoLetra({ quizResponseId: m.quiz_response_id, modelo: MODEL, uso });
    return { letra: j.letra.trim(), mudou: j.mudou ?? [], aviso: j.aviso ?? "" };
  });

/** Grava a letra (a proposta do modelo, ou o que o atendente editou à mão). */
export const salvarLetra = createServerFn({ method: "POST" })
  .validator((data: { musicaId: string; letra: string }) => data)
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { exigirRecuperacao } = await import("@/lib/admin-auth.server");
    exigirRecuperacao();
    const letra = data.letra.trim();
    // Piso de tamanho: letra vazia salva por engano apagaria o produto, e o job
    // de geração falharia com "musica sem letra" sem ninguém entender por quê.
    if (letra.length < 80) throw new Error("letra curta demais, parece engano");
    const { error } = await supabaseAdmin()
      .from("musicas")
      .update({ letra })
      .eq("id", data.musicaId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Regrava a música com a letra que está salva agora.
 *
 * DOIS CUIDADOS, e nenhum é paranoia:
 *
 * 1. `gerarMusica` sai na hora quando o status é "pronta" (ele existe pra não
 *    regravar o que já existe). Sem zerar o status aqui, o botão não faria
 *    nada e o atendente ficaria esperando pra sempre.
 *
 * 2. Regravar SUBSTITUI o áudio no mesmo link. Se a pessoa já pagou e já
 *    mandou o presente, quem abrir passa a ouvir outra coisa. Por isso música
 *    paga exige confirmação explícita: o caminho comum (Pix abandonado, onde
 *    ninguém recebeu nada) passa direto, e só o caminho perigoso pede um
 *    segundo sim.
 */
export const regravarMusica = createServerFn({ method: "POST" })
  .validator((data: { musicaId: string; confirmoSubstituir?: boolean }) => data)
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { exigirRecuperacao } = await import("@/lib/admin-auth.server");
    exigirRecuperacao();
    const db = supabaseAdmin();

    const { data: m } = await db
      .from("musicas")
      .select("id, status, letra, quiz_response_id")
      .eq("id", data.musicaId)
      .single();
    if (!m) throw new Error("música não encontrada");
    if (!m.letra) throw new Error("música sem letra");
    if (m.status === "gerando") throw new Error("já está gravando, espere terminar");

    const { data: pedidos } = await db
      .from("pedidos")
      .select("status")
      .eq("quiz_response_id", m.quiz_response_id);
    const pago = (pedidos ?? []).some((p) => p.status === "pago");
    if (pago && !data.confirmoSubstituir) throw new Error("PRECISA_CONFIRMAR");

    await db.from("musicas").update({ status: "gerando", erro: null }).eq("id", m.id);
    await dispararGeracaoMusica(m.id);
    return { ok: true };
  });
