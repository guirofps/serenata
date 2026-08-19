import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// O RELÓGIO DA CONFIG, COM O BANCO FORA DO AR.
//
// É o cenário do DEPLOY ANTES DA MIGRATION (a spec manda a ordem contrária,
// mas a ordem errada é um clique) e o do Supabase lento. Nos dois, o site tem
// que DEGRADAR — servir o fallback do código e seguir — e não MARTELAR: uma
// consulta condenada por requisição, com o primeiro render de cada visita
// esperando por ela.
//
// O mock é do cliente Supabase inteiro. Não existe banco aqui, e o que está
// sendo testado não é SQL nenhum: é o relógio (`carregouUmaVez`/`lidoEm`) e o
// prazo da leitura.

/** Quantas vezes a consulta foi montada, e o que ela faz quando acontece. */
let consultas = 0;
let responder: (sinal: AbortSignal) => Promise<unknown> = async () => ({ data: [], error: null });

vi.mock("@/lib/supabase-admin", () => ({
  supabaseAdmin: () => ({
    from: () => ({
      select: () => ({
        order: () => ({
          abortSignal: (sinal: AbortSignal) => {
            consultas++;
            return responder(sinal);
          },
        }),
      }),
    }),
  }),
}));

const { garantirConfig, lerConfigFresca, _resetRelogioParaTeste, TIMEOUT_PAINEL_MS } =
  await import("./experimentos-config.server");
const { configAtual, _resetConfigDoServidorParaTeste } = await import("./experimentos");

/** O banco que não responde nunca — só desiste quando o sinal aborta. */
const penduraAteAbortar = (sinal: AbortSignal) =>
  new Promise<unknown>((resolve) => {
    sinal.addEventListener("abort", () =>
      resolve({ data: null, error: { message: "AbortError" } }),
    );
  });

beforeEach(() => {
  // O `console.error` de `recarregar` é COMPORTAMENTO esperado nestes testes
  // (banco fora do ar); silenciado pra a saída da suíte não parecer falha.
  vi.spyOn(console, "error").mockImplementation(() => {});
  consultas = 0;
  _resetRelogioParaTeste();
  _resetConfigDoServidorParaTeste();
});

afterEach(() => {
  responder = async () => ({ data: [], error: null });
  vi.restoreAllMocks();
});

describe("garantirConfig com o banco fora do ar", () => {
  it("a falha conta como tentativa: a requisição seguinte não espera de novo", async () => {
    // O defeito: `carregouUmaVez` só virava `true` no SUCESSO, então com a
    // tabela inexistente TODA requisição caía no ramo da instância fria e
    // fazia `await` de uma consulta condenada. O `lidoEm` do `catch` — cujo
    // comentário dizia existir "pra não martelar o banco" — só é lido no ramo
    // quente, que nunca era alcançado. A proteção era código morto exatamente
    // na falha pra qual foi escrita.
    responder = async () => ({
      data: null,
      error: { message: 'relation "experimentos" não existe' },
    });

    await garantirConfig();
    expect(consultas).toBe(1);

    // Segunda visita, dentro da janela de 60s: nada de consulta nova, e nada
    // de espera. (Sem a correção, `consultas` seria 2, 3, 4… uma por visita.)
    await garantirConfig();
    await garantirConfig();
    expect(consultas).toBe(1);
  });

  it("e o site segue com o fallback do código: tudo desligado, nunca sem config", async () => {
    responder = async () => ({ data: null, error: { message: "connection refused" } });
    await garantirConfig();
    const preco = configAtual().find((e) => e.id === "preco");
    expect(preco?.ativo).toBe(false);
  });
});

describe("prazo da leitura", () => {
  it("desiste sozinha quando o banco não responde — sem prazo passado, o do render", async () => {
    // Custa ~1,5s de propósito: é o valor do prazo PADRÃO (o do caminho do
    // render) sendo provado de verdade, não uma constante lida de volta. Sem
    // deadline nenhum — que era o estado antes — esta promessa nunca voltava,
    // e o primeiro render de toda página ficava pendurado junto.
    responder = penduraAteAbortar;
    const inicio = Date.now();
    await expect(lerConfigFresca()).rejects.toThrow(/AbortError/);
    const gasto = Date.now() - inicio;
    expect(gasto).toBeGreaterThanOrEqual(1_000);
    expect(gasto).toBeLessThan(4_000);
  }, 10_000);

  it("o prazo é por chamada: o painel pede mais tempo que o render", async () => {
    responder = penduraAteAbortar;
    // Prova que o parâmetro governa mesmo (20ms desiste na hora), e que o
    // prazo do painel é folgado o bastante pra não virar "Config não
    // carregou" em dia de banco lento.
    await expect(lerConfigFresca(20)).rejects.toThrow(/AbortError/);
    expect(TIMEOUT_PAINEL_MS).toBeGreaterThanOrEqual(10_000);
  });
});
