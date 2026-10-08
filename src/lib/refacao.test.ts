import { beforeEach, describe, expect, it, vi } from "vitest";

// O FLUXO INTEIRO DO AJUSTE, com banco e modelo falsos.
//
// O que este arquivo segura (07/10):
// - pedido claro passa e gasta o direito UMA vez;
// - "vago" e "falhou" não deixam versão arquivada órfã nem gastam o direito
//   (a Carmelina ficou com uma órfã em `versoes_musica` e a letra antiga);
// - resposta cortada pelo `max_tokens` é "falhou", não letra vazia salva;
// - letra colada de 1.480 caracteres não é cortada nem recusada;
// - o teto de uso vale de verdade.

type Linha = Record<string, unknown>;
let tabelas: Record<string, Linha[]>;
let falharUpdate = false;

// ── Um PostgREST de brinquedo: só o que `refacao.ts` usa ──────────
function consulta(nome: string) {
  const filtros: ((l: Linha) => boolean)[] = [];
  let op: "select" | "update" | "upsert" | "delete" | "insert" = "select";
  let carga: Linha | null = null;
  let devolverLinhas = false;
  let unico = false;
  let limite: number | null = null;
  const q = {
    select() {
      devolverLinhas = true;
      return q;
    },
    update(c: Linha) {
      op = "update";
      carga = c;
      return q;
    },
    upsert(c: Linha) {
      op = "upsert";
      carga = c;
      return q;
    },
    insert(c: Linha) {
      op = "insert";
      carga = c;
      return q;
    },
    delete() {
      op = "delete";
      return q;
    },
    eq(k: string, v: unknown) {
      filtros.push((l) => l[k] === v);
      return q;
    },
    neq(k: string, v: unknown) {
      filtros.push((l) => l[k] !== v);
      return q;
    },
    is(k: string, v: unknown) {
      filtros.push((l) => (l[k] ?? null) === v);
      return q;
    },
    limit(n: number) {
      limite = n;
      return q;
    },
    maybeSingle() {
      unico = true;
      return q;
    },
    then(ok: (r: { data: unknown; error: unknown }) => unknown, erro?: (e: unknown) => unknown) {
      return Promise.resolve(executar()).then(ok, erro);
    },
  };
  function executar(): { data: unknown; error: unknown } {
    const t = (tabelas[nome] ??= []);
    const casa = (l: Linha) => filtros.every((f) => f(l));
    if (op === "select") {
      let rs = t.filter(casa);
      if (limite != null) rs = rs.slice(0, limite);
      return { data: unico ? (rs[0] ?? null) : rs, error: null };
    }
    if (op === "update") {
      if (nome === "musicas" && falharUpdate) return { data: null, error: { message: "banco caiu" } };
      const rs = t.filter(casa);
      rs.forEach((l) => Object.assign(l, carga));
      return { data: devolverLinhas ? rs : null, error: null };
    }
    if (op === "upsert") {
      const c = carga!;
      const i = t.findIndex((l) => l.musica_id === c.musica_id && l.ordem === c.ordem);
      if (i >= 0) t[i] = { ...c };
      else t.push({ ...c });
      return { data: null, error: null };
    }
    if (op === "insert") {
      t.push({ ...carga! });
      return { data: null, error: null };
    }
    tabelas[nome] = t.filter((l) => !casa(l));
    return { data: null, error: null };
  }
  return q;
}

vi.mock("@/lib/supabase-admin", () => ({
  supabaseAdmin: () => ({
    from: (t: string) => consulta(t),
    storage: { from: () => ({ copy: async () => ({ error: null }) }) },
  }),
}));

// `createServerFn` vira a própria função do handler.
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const b = {
      validator: () => b,
      handler: (fn: unknown) => fn,
    };
    return b;
  },
}));

const chamarClaude = vi.fn();
vi.mock("@/lib/recuperacao-letra", () => ({ chamarClaude: (...a: unknown[]) => chamarClaude(...a) }));
vi.mock("@/lib/custos", () => ({ MODELO_LETRA: "claude-sonnet-5", registrarCustoLetra: async () => {} }));
const disparar = vi.fn(async (_id: string) => {});
vi.mock("@/lib/gerar-letra", () => ({ dispararGeracaoMusica: (id: string) => disparar(id) }));

const cobrarUso = vi.fn(async (..._a: unknown[]) => {});
vi.mock("@/lib/limite-uso.server", () => {
  class LimiteEstourado extends Error {}
  return {
    TETO_REFACAO: { nome: "refacao", porSessao: 8, porOrigem: 20 },
    LimiteEstourado,
    cobrarUso: (...a: unknown[]) => cobrarUso(...a),
  };
});

const { pedirRefacao } = (await import("./refacao")) as unknown as {
  pedirRefacao: (a: { data: { tokenEdicao: string; pedido: string; estilo?: string; voz?: string } }) => Promise<
    { ok: true; restantes: number } | { ok: false; erro: string; falta?: string }
  >;
};
const { LimiteEstourado } = await import("@/lib/limite-uso.server");

const LETRA = [
  "[Verse 1]",
  "Ainda não provei o bolo de fubá que você faz",
  "E a casa inteira cheira a café quando você chega",
  "[Chorus]",
  "Simon, meu neto, meu presente de Deus",
  "Simon, você é o sol dos dias meus",
].join("\n");

const resposta = (j: Record<string, unknown>, stopReason = "end_turn") => ({
  texto: JSON.stringify(j),
  uso: {},
  stopReason,
});

const musica = () => tabelas.musicas[0];
const pedir = (pedido: string, extra: { estilo?: string; voz?: string } = {}) =>
  pedirRefacao({ data: { tokenEdicao: "tok", pedido, ...extra } });

beforeEach(() => {
  falharUpdate = false;
  chamarClaude.mockReset();
  disparar.mockClear();
  cobrarUso.mockReset();
  cobrarUso.mockImplementation(async () => {});
  tabelas = {
    musicas: [
      {
        id: "m1",
        token_edicao: "tok",
        letra: LETRA,
        titulo: "Neto",
        estilo_suno: null,
        genero: "sertanejo",
        audio_path: "m1/v1.mp3",
        audio_path_v2: "m1/v2.mp3",
        timestamps: null,
        timestamps_v2: null,
        status: "pronta",
        quiz_response_id: "q1",
        refacoes_incluidas: 1,
        refacoes_usadas: 0,
      },
    ],
    pedidos: [{ id: "p1", quiz_response_id: "q1", status: "pago" }],
    quiz_responses: [{ id: "q1", respostas: { voz: "feminina" } }],
    versoes_musica: [],
  };
});

describe("pedirRefacao", () => {
  it("pronúncia de nome: aplica, arquiva a versão e gasta o direito uma vez", async () => {
    // Israel, 06/10: queria corrigir a pronúncia de "Simon" e desistiu.
    const nova = LETRA.replace(/Simon/g, "Sáimon");
    chamarClaude.mockResolvedValue(resposta({ letra: nova, mudou: ["Simon vira Sáimon"], aviso: "Escrevi como se fala em inglês." }));
    const r = await pedir("corrigir a pronúncia do nome Simon, é como em inglês");
    expect(r).toEqual({ ok: true, restantes: 0 });
    expect(musica().letra).toBe(nova);
    expect(musica().refacoes_usadas).toBe(1);
    expect(musica().status).toBe("gerando");
    expect(tabelas.versoes_musica).toHaveLength(1);
    expect(tabelas.versoes_musica[0]).toMatchObject({ ordem: 1, letra: LETRA, audio_path: "m1/versoes/1/v1.mp3" });
    expect(disparar).toHaveBeenCalledWith("m1");
  });

  it("vago: não grava versão, não gasta o direito, devolve a pergunta sem travessão", async () => {
    chamarClaude.mockResolvedValue(resposta({ letra: LETRA, mudou: [], falta: "O que entra no lugar — o bolo ou o café?" }));
    const r = await pedir("não gostei");
    expect(r).toEqual({ ok: false, erro: "vago", falta: "O que entra no lugar, o bolo ou o café?" });
    expect(tabelas.versoes_musica).toHaveLength(0);
    expect(musica().refacoes_usadas).toBe(0);
    expect(musica().letra).toBe(LETRA);
    expect(disparar).not.toHaveBeenCalled();
  });

  it("resposta cortada no max_tokens é falhou, sem órfã e sem gastar", async () => {
    // 8 das 11 versões órfãs refeitas em 07/10: o pensamento comia os 4000.
    chamarClaude.mockResolvedValue({ texto: '{"letra": "[Verse 1]\\nAinda', uso: {}, stopReason: "max_tokens" });
    const r = await pedir("Acrescenta no refrão que ama ser chamado biso");
    expect(r).toEqual({ ok: false, erro: "falhou" });
    expect(tabelas.versoes_musica).toHaveLength(0);
    expect(musica().refacoes_usadas).toBe(0);
    expect(musica().audio_path).toBe("m1/v1.mp3");
  });

  it("erro do provedor é falhou, sem órfã e sem gastar", async () => {
    chamarClaude.mockRejectedValue(new Error("Anthropic 529"));
    const r = await pedir("troca fubá por cenoura");
    expect(r).toEqual({ ok: false, erro: "falhou" });
    expect(tabelas.versoes_musica).toHaveLength(0);
    expect(musica().refacoes_usadas).toBe(0);
  });

  it("banco falha ao gravar depois de arquivar: desfaz o arquivo", async () => {
    chamarClaude.mockResolvedValue(resposta({ letra: LETRA.replace("fubá", "cenoura"), mudou: ["x"] }));
    falharUpdate = true;
    const r = await pedir("troca fubá por cenoura");
    expect(r).toEqual({ ok: false, erro: "falhou" });
    expect(tabelas.versoes_musica).toHaveLength(0);
    expect(musica().refacoes_usadas).toBe(0);
  });

  it("JSON com aspa sem escape dentro da letra não vira falhou", async () => {
    const nova = LETRA.replace("fubá", 'fubá, "o melhor"');
    chamarClaude.mockResolvedValue({
      texto: `{"letra": ${JSON.stringify(nova).replace('\\"o melhor\\"', '"o melhor"')}, "mudou": ["x"]}`,
      uso: {},
      stopReason: "end_turn",
    });
    const r = await pedir("coloca que o bolo é o melhor");
    expect(r.ok).toBe(true);
    expect(musica().letra).toBe(nova);
  });

  it("órfã antiga da mesma ordem não trava: é sobrescrita", async () => {
    // O que a Carmelina tinha: versão ordem 1 sem o ajuste ter sido gasto.
    tabelas.versoes_musica.push({ musica_id: "m1", ordem: 1, letra: "velha", pedido: "tentativa antiga" });
    chamarClaude.mockResolvedValue(resposta({ letra: LETRA.replace("fubá", "cenoura"), mudou: ["x"] }));
    const r = await pedir("troca fubá por cenoura");
    expect(r.ok).toBe(true);
    expect(tabelas.versoes_musica).toHaveLength(1);
    expect(tabelas.versoes_musica[0]).toMatchObject({ letra: LETRA, pedido: "troca fubá por cenoura" });
  });

  it("letra inteira colada (1.480 caracteres) passa inteira e vira a letra nova", async () => {
    const verso = "Quatro sonhos chegaram em tempos diferentes, presentes que Deus me confiou";
    const colada = Array.from({ length: 20 }, (_, i) => `${verso} ${i}`).join("\n");
    expect(colada.length).toBeGreaterThan(1480);
    const nova = "[Verse 1]\n" + colada;
    chamarClaude.mockResolvedValue(resposta({ letra: nova, mudou: ["letra trocada pela do cliente"] }));
    const r = await pedir(colada);
    expect(r.ok).toBe(true);
    const msg = chamarClaude.mock.calls[0][0] as string;
    expect(msg).toContain(colada); // nada cortado no caminho
    expect(msg).toContain("letra inteira escrita pelo cliente");
    expect(musica().letra).toBe(nova);
  });

  it("acima do teto de tamanho volta `longo` sem chamar o modelo", async () => {
    const r = await pedir("a".repeat(4001));
    expect(r).toEqual({ ok: false, erro: "longo" });
    expect(chamarClaude).not.toHaveBeenCalled();
  });

  it("voz pedida só por escrito regrava o som com a letra intacta", async () => {
    chamarClaude.mockResolvedValue(resposta({ letra: LETRA, mudou: [], voz: "masculina" }));
    const r = await pedir("Gostaria de mudar a voz, para masculina mais grave");
    expect(r.ok).toBe(true);
    expect(musica().letra).toBe(LETRA);
    expect((tabelas.quiz_responses[0].respostas as Record<string, unknown>).voz).toBe("masculina");
    expect(musica().refacoes_usadas).toBe(1);
  });

  it("teto de uso estourado barra antes do modelo", async () => {
    cobrarUso.mockRejectedValue(new LimiteEstourado());
    const r = await pedir("troca fubá por cenoura");
    expect(r).toEqual({ ok: false, erro: "limite" });
    expect(chamarClaude).not.toHaveBeenCalled();
  });

  it("teto com banco fora do ar falha aberto", async () => {
    cobrarUso.mockRejectedValue(new Error("rede"));
    chamarClaude.mockResolvedValue(resposta({ letra: LETRA.replace("fubá", "cenoura"), mudou: ["x"] }));
    const r = await pedir("troca fubá por cenoura");
    expect(r.ok).toBe(true);
  });

  it("segunda chamada concorrente não regrava de novo", async () => {
    chamarClaude.mockResolvedValue(resposta({ letra: LETRA.replace("fubá", "cenoura"), mudou: ["x"] }));
    // Simula a outra aba gastando o ajuste enquanto o modelo respondia.
    chamarClaude.mockImplementationOnce(async () => {
      Object.assign(musica(), { refacoes_usadas: 1, status: "gerando" });
      return resposta({ letra: LETRA.replace("fubá", "cenoura"), mudou: ["x"] });
    });
    const r = await pedir("troca fubá por cenoura");
    expect(r).toEqual({ ok: false, erro: "gravando" });
    expect(disparar).not.toHaveBeenCalled();
  });
});
