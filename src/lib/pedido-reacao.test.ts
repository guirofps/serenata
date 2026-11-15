import { describe, expect, it } from "vitest";
import { PEDIDO_REACAO_MAX_H, PEDIDO_REACAO_MIN_H, ehRespostaDeReacao, filaPedidoReacao, type PedidoParaReacao } from "./pedido-reacao";
import { bracoDoTeste } from "./braco-email";
import { assuntoPedidoReacao, emailPedidoReacao, textoPedidoReacao } from "../../emails/pedido-reacao";

const H = 3600000;
const agora = Date.parse("2026-10-08T15:00:00Z");
// Posição 3 do fim: 'd' (ímpar) é B, 'c' (par) é A.
const QB = "00000000-0000-4000-8000-000000000d00";
const QA = "00000000-0000-4000-8000-000000000c00";

const pedido = (o: Partial<PedidoParaReacao> = {}): PedidoParaReacao => ({
  email: "Ana@Gmail.com",
  quiz_response_id: QB,
  musica_id: "m1",
  paid_at: new Date(agora - 80 * H).toISOString(),
  ...o,
});

const base = (pedidos: PedidoParaReacao[]) => ({
  pedidos,
  quizzes: new Map([
    [QB, { locale: "pt", nome: "Marcos" }],
    [QA, { locale: "pt", nome: "Rita" }],
  ]),
  prontas: new Set(["m1", "m2"]),
  bloqueados: new Set<string>(),
  agora,
  max: 10,
});

describe("filaPedidoReacao", () => {
  it("os ids de exemplo estão nos braços certos", () => {
    expect(bracoDoTeste("pedido_reacao", QB)).toBe("b");
    expect(bracoDoTeste("pedido_reacao", QA)).toBe("a");
  });

  it("os dois braços recebem: o B com o cupom (como era), o A com a música de presente (15/11)", () => {
    const fila = filaPedidoReacao(base([pedido(), pedido({ email: "x@y.com", quiz_response_id: QA, musica_id: "m2" })]));
    expect(fila).toEqual([
      { email: "ana@gmail.com", quizId: QB, musicaId: "m1", nome: "Marcos", premio: "cupom" },
      { email: "x@y.com", quizId: QA, musicaId: "m2", nome: "Rita", premio: "musica" },
    ]);
  });

  it(`só no 3º dia: entre ${PEDIDO_REACAO_MIN_H}h e ${PEDIDO_REACAO_MAX_H}h depois da compra`, () => {
    const em = (h: number) => filaPedidoReacao(base([pedido({ paid_at: new Date(agora - h * H).toISOString() })])).length;
    expect(em(PEDIDO_REACAO_MIN_H - 1)).toBe(0);
    expect(em(PEDIDO_REACAO_MIN_H)).toBe(1);
    expect(em(PEDIDO_REACAO_MAX_H)).toBe(1);
    expect(em(PEDIDO_REACAO_MAX_H + 1)).toBe(0);
  });

  it("uma vez por pessoa, bloqueado fora, música não pronta fora, espanhol fora", () => {
    expect(filaPedidoReacao(base([pedido(), pedido({ musica_id: "m2" })]))).toHaveLength(1);
    expect(filaPedidoReacao({ ...base([pedido()]), bloqueados: new Set(["ana@gmail.com"]) })).toHaveLength(0);
    expect(filaPedidoReacao(base([pedido({ musica_id: "m9" })]))).toHaveLength(0);
    const es = base([pedido()]);
    es.quizzes.set(QB, { locale: "es", nome: "Marcos" });
    expect(filaPedidoReacao(es)).toHaveLength(0);
  });

  it("respeita o máximo", () => {
    const pedidos = Array.from({ length: 5 }, (_, i) => pedido({ email: `p${i}@x.com` }));
    expect(filaPedidoReacao({ ...base(pedidos), max: 2 })).toHaveLength(2);
  });
});

describe("a resposta com o vídeo vai pro dono, não pro robô", () => {
  it("reconhece a resposta pelo assunto", () => {
    expect(ehRespostaDeReacao(`Re: ${assuntoPedidoReacao("Marcos")}`)).toBe(true);
    expect(ehRespostaDeReacao("RE: video de reacao")).toBe(true);
    expect(ehRespostaDeReacao("Re: sua música está pronta")).toBe(false);
  });

  it("o assunto dos dois prêmios cai na mesma triagem, e dá pra saber qual foi", () => {
    const cupom = assuntoPedidoReacao("Marcos");
    const musica = assuntoPedidoReacao("Marcos", "musica");
    expect(cupom).toBe("Um pedido sobre o vídeo de reação de Marcos");
    expect(musica).not.toBe(cupom);
    expect(ehRespostaDeReacao(`Re: ${musica}`)).toBe(true);
    expect(musica).toContain("música de presente");
  });
});

describe("a copy do pedido", () => {
  const html = emailPedidoReacao({
    nome: "Marcos",
    linkResposta: "mailto:contato@serenatagift.com",
    linkDescadastro: "https://x/api/descadastro",
  });
  const texto = textoPedidoReacao({ nome: "Marcos" });

  it("promete o cupom mandado pela equipe, sem gerar nada", () => {
    for (const t of [html, texto]) {
      expect(t).toContain("cupom de R$ 10");
      expect(t).toMatch(/a gente te manda/);
    }
  });

  it("consentimento honesto: anúncio só com permissão", () => {
    for (const t of [html, texto]) {
      expect(t).toMatch(/só aparece num anúncio da Serenata se você deixar/);
      expect(t).toMatch(/quem aparece no vídeo estiver de acordo/);
    }
  });

  it("sem travessão", () => {
    expect([assuntoPedidoReacao("Marcos"), html, texto].join(" ")).not.toContain("—");
  });
});

describe("a copy do pedido com a música de presente (braço A, 15/11)", () => {
  const html = emailPedidoReacao({
    nome: "Marcos",
    premio: "musica",
    linkResposta: "mailto:contato@serenatagift.com",
    linkDescadastro: "https://x/api/descadastro",
  });
  const texto = textoPedidoReacao({ nome: "Marcos", premio: "musica" });

  it("promete uma música nova liberada pela equipe, pra quem autoriza o uso", () => {
    for (const t of [html, texto]) {
      expect(t).toMatch(/uma música nova/);
      expect(t).toMatch(/autorizo/);
      expect(t).toMatch(/Uma pessoa da equipe confere/);
    }
  });

  it("quem não autoriza ainda pode mandar, e ganha o cupom", () => {
    for (const t of [html, texto]) {
      expect(t).toContain("cupom de R$ 10");
      expect(t).toMatch(/fica só com a gente/);
    }
  });

  it("só com o acordo de quem aparece, e sem travessão", () => {
    for (const t of [html, texto]) {
      expect(t).toMatch(/quem aparece no vídeo estiver de acordo/);
      expect(t).not.toContain("—");
    }
  });

  it("o cupom (padrão) não mudou de texto", () => {
    expect(textoPedidoReacao({ nome: "Marcos" })).toBe(textoPedidoReacao({ nome: "Marcos", premio: "cupom" }));
    expect(textoPedidoReacao({ nome: "Marcos" })).not.toMatch(/uma música nova/);
  });
});
