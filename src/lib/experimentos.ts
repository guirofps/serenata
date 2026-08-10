// TESTE A/B DE VERDADE: metade do tráfego em cada versão, sorteado aqui.
//
// O que existia antes era controle por CAMPANHA (`?f=b`): pra testar era
// preciso duplicar a campanha no Google Ads, e aí os dois lados nunca ficam
// comparáveis — orçamento, horário e leilão são diferentes, então a diferença
// medida pode ser da campanha e não da tela. Foi exatamente essa confusão que
// travou a leitura de "home contra /criar".
//
// Aqui o sorteio é por PESSOA, dentro da mesma campanha. Os dois lados vivem o
// mesmo leilão, o mesmo horário e o mesmo público. A diferença que sobrar é da
// tela.
//
// ── POR QUE NÃO É UM `if (Math.random() < 0.5)` NO COMPONENTE ──
//
// O quiz é renderizado NO SERVIDOR (o HTML de /criar já vem com a pergunta e
// os chips dentro). Sorteio no cliente quebra de duas formas: o servidor manda
// A, o cliente decide B, e a pessoa vê a tela trocar na frente dela — além do
// erro de hidratação do React, que descarta a árvore e refaz tudo.
//
// A solução é a que ferramenta séria de A/B usa: um script minúsculo, SÍNCRONO
// e antes de tudo, que sorteia e carimba a escolha no <html>. O CSS decide o
// que aparece. As duas versões vêm no HTML, e o navegador esconde uma antes do
// primeiro pixel. Sem piscada, sem hidratação errada, e funciona mesmo se o
// React demorar.
//
// ── O QUE NÃO FAZER ──
//
// Não mexer no `id` nem nas `variantes` de um experimento já rodando: a
// escolha fica gravada no navegador da pessoa, e trocar os nomes no meio
// embaralha quem já foi sorteado com quem chegou agora. Encerrar e criar
// outro com id novo é sempre mais barato que consertar dado sujo.

export type Experimento = {
  /** Vira `data-exp-<id>` no <html> e `mp_exp:<id>` no navegador. */
  id: string;
  /** A primeira é SEMPRE o controle: é ela que aparece sem JavaScript. */
  variantes: [string, ...string[]];
  /** Pesos em partes iguais quando ausente. */
  peso?: number[];
  ativo: boolean;
  /** O que está sendo testado e por quê. Aparece no painel. */
  nota: string;
};

export const EXPERIMENTOS: Experimento[] = [
  {
    id: "abertura",
    variantes: ["A", "B"],
    // DESLIGADO em 10/08, sem ter chegado a medir nada.
    //
    // Não porque a variante perdeu: porque a BASE quebrou embaixo dela. O
    // deploy que trouxe este teste trouxe junto as barras fixas do quiz, e a
    // passagem da pergunta 1 pra 2 caiu de 43% pra 14% nas mesmas campanhas.
    // Comparar A com B em cima de uma tela quebrada não mede a ideia, mede o
    // defeito — e as duas variantes carregavam o mesmo defeito.
    //
    // A máquina de A/B continua inteira e testada. É só religar isto (e
    // conferir a taxa base antes) quando o funil voltar ao normal.
    ativo: false,
    nota:
      "A primeira tela do quiz. Medido em 09/08: de 195 que viram a pergunta 1, só 41 (21%) tocaram em algum chip, e 63% não produziram mais nenhum evento. Não é atrito de botão (só 6 escolheram sem avançar), é o primeiro instante. B mostra a prova e a promessa ANTES de pedir a primeira resposta.",
  },
];

const CHAVE = "mp_exp:";

/** Só os ativos. Um experimento desligado some do <html> e do CSS. */
export function experimentosAtivos(): Experimento[] {
  return EXPERIMENTOS.filter((e) => e.ativo);
}

/** `data-exp-abertura` — o atributo que o CSS lê. */
export function atributoDe(id: string): string {
  return `data-exp-${id}`;
}

/**
 * O script que roda ANTES do React, direto no <head>.
 *
 * Síncrono de propósito: se ele fosse `async` ou rodasse no `onload`, o
 * navegador já teria pintado a versão A e a troca apareceria. É pequeno
 * porque tudo aqui atrasa o primeiro pixel de toda visita.
 *
 * `?exp=abertura:b` força uma variante e fica grudada — é como se testa a
 * própria variante antes de mandar tráfego pra ela.
 */
export function scriptExperimentos(): string {
  const cfg = experimentosAtivos().map((e) => ({
    id: e.id,
    v: e.variantes,
    p: e.peso ?? e.variantes.map(() => 1),
  }));
  return `(function(){try{
var C=${JSON.stringify(cfg)},D=document.documentElement,U=new URLSearchParams(location.search),F=U.get("exp")||"";
for(var i=0;i<C.length;i++){var e=C[i],k="${CHAVE}"+e.id,v=null;
var m=F.split(",").map(function(s){return s.trim()}).filter(function(s){return s.indexOf(e.id+":")===0});
if(m.length){var f=m[0].split(":")[1];for(var j=0;j<e.v.length;j++){if(e.v[j].toLowerCase()===String(f).toLowerCase())v=e.v[j];}}
if(!v){try{var s=localStorage.getItem(k);if(s&&e.v.indexOf(s)>=0)v=s;}catch(_){}}
if(!v){var t=0;for(var j=0;j<e.p.length;j++)t+=e.p[j];var r=Math.random()*t,a=0;v=e.v[0];
for(var j=0;j<e.v.length;j++){a+=e.p[j];if(r<a){v=e.v[j];break;}}}
try{localStorage.setItem(k,v);}catch(_){}
D.setAttribute("data-exp-"+e.id,v);}
}catch(_){}})();`;
}

/**
 * O CSS que esconde a versão que não foi sorteada.
 *
 * `display:contents` e não `block`: o invólucro precisa sumir do layout, senão
 * ele vira uma caixa a mais dentro de um flex e desalinha tudo.
 *
 * A regra `:not([data-exp-...])` é o caso de JavaScript desligado ou script
 * bloqueado: sem atributo nenhum, aparece o controle. Nunca uma tela vazia.
 */
export function cssExperimentos(): string {
  const linhas: string[] = [];
  // TODOS os experimentos, não só os ativos. Descoberto do jeito ruim em
  // 10/08: ao desligar um experimento, as regras dele sumiam do CSS, e o
  // bloco da variante B ficava SEM nenhuma regra de `display:none` — ou seja,
  // desligar o teste publicava a variante pra 100% do tráfego, exatamente o
  // contrário do pretendido. Desligar tem que ser a coisa mais segura de
  // fazer com um experimento, não a mais perigosa.
  for (const e of EXPERIMENTOS) {
    const seletores = e.variantes.map((v) => `[data-v="${e.id}:${v}"]`).join(",");
    linhas.push(`${seletores}{display:none}`);

    if (!e.ativo) {
      // Desligado: só o controle aparece, pra quem tiver escrito conteúdo de
      // controle dentro de um <Variante> não ficar com a tela vazia.
      linhas.push(`[data-v="${e.id}:${e.variantes[0]}"]{display:contents}`);
      continue;
    }
    for (const v of e.variantes) {
      linhas.push(
        `html[${atributoDe(e.id)}="${v}"] [data-v="${e.id}:${v}"]{display:contents}`,
      );
    }
    linhas.push(
      `html:not([${atributoDe(e.id)}]) [data-v="${e.id}:${e.variantes[0]}"]{display:contents}`,
    );
  }
  return linhas.join("");
}

/** A variante desta pessoa. No servidor devolve o controle. */
export function varianteDe(id: string): string {
  const exp = EXPERIMENTOS.find((e) => e.id === id);
  const controle = exp?.variantes[0] ?? "A";
  if (typeof document === "undefined") return controle;
  return document.documentElement.getAttribute(atributoDe(id)) ?? controle;
}

/** Todas as escolhas, no formato que vai pro banco: `{ abertura: "B" }`. */
export function variantesAtuais(): Record<string, string> {
  if (typeof document === "undefined") return {};
  const out: Record<string, string> = {};
  for (const e of experimentosAtivos()) {
    const v = document.documentElement.getAttribute(atributoDe(e.id));
    if (v) out[e.id] = v;
  }
  return out;
}

/**
 * Carimba as escolhas em `mp_attribution`, que é de onde `trackEvent` relê a
 * cada evento e de onde a RPC de lead copia pro `quiz_responses.attribution`.
 *
 * É isto que faz o experimento aparecer no funil INTEIRO sem tocar em nenhuma
 * rota: cada `page_view`, `quiz_step` e `checkout_click` já carrega a
 * atribuição, e agora carrega a variante junto.
 */
export function carimbarExperimentos(): void {
  if (typeof window === "undefined") return;
  const vars = variantesAtuais();
  if (!Object.keys(vars).length) return;
  try {
    const cru = localStorage.getItem("mp_attribution");
    const atual = cru ? (JSON.parse(cru) as Record<string, unknown>) : {};
    const antes = JSON.stringify(atual.exp ?? null);
    if (antes === JSON.stringify(vars)) return; // idempotente
    localStorage.setItem(
      "mp_attribution",
      JSON.stringify({
        ...atual,
        exp: vars,
        captured_at: atual.captured_at ?? new Date().toISOString(),
      }),
    );
  } catch {
    // Modo anônimo: o teste ainda roda na tela, só não é medido.
  }
}
