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

// ── OS TIPOS DA CONFIG QUE VEM DO BANCO ──────────────────────────
//
// Moram aqui, não em `experimentos-config.server.ts`: aquele módulo lê o
// banco com service role, e se o tipo morasse lá o import viraria um ciclo
// (o server precisa de `EXPERIMENTOS`, e este arquivo precisaria do tipo de
// volta). Pior, `preco.ts` roda no cliente — encostar num módulo `.server.ts`
// dali vazaria service role pro bundle do navegador. `Experimento` acima é a
// forma ANTIGA (array fixo em código); estas são a forma nova, que troca o
// array por linha de banco.
//
// As duas NÃO deixam de conviver — só trocam de papel. `EXPERIMENTOS` vira o
// FALLBACK de `ExperimentoConfig` (ver `configDoCodigo` mais abaixo), nunca
// mais a fonte ativa de nada: TODO caminho deste arquivo lê `configAtual()`.
// Isso inclui `experimentosAtivos`, `varianteDe` e `variantesAtuais`, que por
// um tempo continuaram lendo o array direto — parecia inofensivo (são leitura
// do atributo que o `<head>` JÁ carimbou), mas era por ali que passava o
// `ativo` que decide se a escolha é GRAVADA em `mp_attribution`. Com o array
// mandando nisso, um experimento ligado pelo painel aparecia na tela e não
// aparecia no resultado.

/** O preço como número, como texto e como link. Um objeto só, de propósito. */
export type Plano = { texto: string; valor: number; ancora: string; checkout: string };

export type Variante = { nome: string; peso: number; plano?: Plano };

export type ExperimentoConfig = {
  id: string;
  ativo: boolean;
  exposicaoPct: number;
  nota: string;
  variantes: Variante[];
};

/**
 * O CHÃO, não a verdade.
 *
 * A configuração viva mora na tabela `experimentos`: `experimentos-config.server.ts`
 * lê o banco, e `configAtual()` (mais abaixo, ISOMÓRFICA de propósito — ver o
 * comentário dela) é quem devolve o snapshot pro `<head>`. Este array só entra
 * em jogo quando nem banco nem snapshot respondem, via `configDoCodigo()`, que
 * mapeia pra `ExperimentoConfig` forçando `ativo: false` — INDEPENDENTE do que
 * estiver escrito no campo `ativo` de cada entrada abaixo (o `preco` está
 * `true` aqui só porque `seo.ts` e `admin-dados.ts` ainda leem esse campo pra
 * outra coisa; o sorteio nunca mais olha pra ele). É o que mantém o pré-render
 * da home seguro: no build não existe banco, então o script pré-renderizado
 * nasce inerte e o sorteio acontece em /criar.
 */
export const EXPERIMENTOS: Experimento[] = [
  {
    id: "preco",
    // A=38 (controle) · B=19 · C=9 · D=29 · E=54,90.
    //
    // Os cinco planos existem na Perfect Pay e os cinco foram conferidos
    // abrindo o checkout: o "Total Hoje" de cada tela bate com o texto do
    // plano em `preco.ts`. São PLANOS do mesmo produto, não produtos novos —
    // ver a nota lá sobre o fallback por valor do `reconhecerOferta`.
    variantes: ["A", "B", "C", "D", "E"],
    // PESO IGUAL, cinco fatias de 20%.
    //
    // Cinco braços é muita divisão pro volume desta operação: os extremos
    // (R$ 9 contra R$ 54,90) separam rápido porque a diferença é grande, mas
    // 29 contra 38 leva meses. Está registrado como escolha do dono, com a
    // conta na mesa, e não por descuido.
    peso: [1, 1, 1, 1, 1],
    ativo: true,
    nota:
      "Quanto custa a música. O preço vive em `preco.ts` como PLANO (número na tela + produto da Perfect Pay + valor da conversão no mesmo objeto), porque o que estraga teste de preço é a tela dizer um número e o caixa cobrar outro. Fora do teste: o funil espanhol (volume pequeno demais pra dividir) e quem chega com cupom da recuperação (o e-mail já prometeu um número exato).",
  },
];

const CHAVE = "mp_exp:";

/**
 * Quem não entrou no teste.
 *
 * É carimbada como qualquer variante, e por isso vira linha própria no painel
 * sem nenhuma agregação nova. Serve de canário: se o controle DENTRO do teste
 * se comporta muito diferente de quem está fora, o problema não é a variante,
 * é a tela quebrada embaixo dela. Foi exatamente isso que impediu de ler o
 * experimento `abertura`.
 */
export const FORA = "fora";

/**
 * Só os ativos, LIDOS DA CONFIG VIVA (`configAtual()`) — nunca do array em
 * código.
 *
 * Era o último caminho que ainda perguntava `ativo` pro array: enquanto
 * `scriptExperimentos`/`cssExperimentos` já liam o banco, quem CARIMBA
 * (`variantesAtuais` → `carimbarExperimentos`) lia o código. Ligar um
 * experimento pelo painel, portanto, sorteava e escondia a variante certa e
 * mesmo assim não gravava a escolha em `mp_attribution` — teste rodando na
 * tela e invisível no resultado, que é o pior dos dois mundos: gasta tráfego
 * e não responde nada.
 *
 * Devolve a forma NOVA (`ExperimentoConfigPublica`), porque é o que a config
 * viva tem. Os dois consumidores só precisam do `id`.
 */
export function experimentosAtivos(): ExperimentoConfigPublica[] {
  return configAtual().filter((e) => e.ativo);
}

/** `data-exp-preco` — o atributo que o CSS lê. */
export function atributoDe(id: string): string {
  return `data-exp-${id}`;
}

// ── A CONFIG ISOMÓRFICA: MESMA LEITURA NO SERVIDOR E NO CLIENTE ──────────
//
// `configAtual()` é quem `RootShell` (`__root.tsx`) chama pra saber que config
// passar pra `scriptExperimentos`/`cssExperimentos`. `RootShell` renderiza no
// servidor (a cada requisição) E hidrata no cliente (uma vez, no load) — se
// cada lado lesse a config de um lugar diferente, o <script> e o <style> que
// saem daqui divergiriam entre o HTML que o servidor mandou e o que o React
// monta ao hidratar. É O MESMO defeito que motiva todo o resto deste arquivo
// (ver o topo), só que na config em vez de no sorteio.
//
// A ponte é o <script> que `RootShell` escreve ANTES do de sorteio, com
// `scriptConfigGlobal` (mais abaixo): planta `window.__SRN_CFG__` com a
// config que o servidor acabou de usar. No servidor, `configAtual()` lê
// `snapshotDoServidor` — variável de módulo que `experimentos-config.server.ts`
// preenche a cada requisição, ANTES do render, via `definirConfigDoServidor`
// (chamada pelo `requestMiddleware` em `src/start.ts`). No cliente,
// `configAtual()` lê `window.__SRN_CFG__`, que é literalmente o JSON que o
// servidor escreveu. Os dois lados partem do MESMO valor — não de uma cópia
// dele, do mesmo objeto serializado — então a string que sai depois de
// `scriptExperimentos`/`cssExperimentos` é idêntica dos dois lados.
//
// `experimentos-config.server.ts` continua sendo o ÚNICO arquivo que importa
// o cliente Supabase com service role: ele só lê o banco e empurra o
// resultado pra cá. Nunca o contrário — se este arquivo importasse algo de
// lá, o ciclo (e o vazamento de service role pro bundle do cliente) voltaria.
// É por isso que `configAtual()` mora AQUI, isomórfica, e não no `.server.ts`.

/**
 * O que `nota` NÃO É: `nota` é estratégia de preço interna (o porquê de cada
 * braço, pra quem olha o painel — ver o comentário de `preco` em
 * `EXPERIMENTOS`), digitada por gente, e vai continuar sendo depois que o
 * painel deixar editar. Nenhum dos três consumidores do <head>
 * (`scriptConfigGlobal`, `scriptExperimentos`, `cssExperimentos`) LÊ `nota` —
 * então ela não tem por que sair pro HTML público, que qualquer um pode abrir
 * com "ver código-fonte". `plano` FICA — a tela e o link de checkout são
 * montados no cliente a partir dele —, mas só o das variantes que estão de
 * fato no ar: ver o corte por posição em `projetarParaPublico`.
 */
export type ExperimentoConfigPublica = Omit<ExperimentoConfig, "nota">;

/**
 * Reduz a config aos campos públicos, antes de qualquer serialização.
 *
 * IDEMPOTENTE de propósito, e não por acaso: `configAtual()` roda isto tanto
 * no servidor (sobre o snapshot cru, que TEM `nota`) quanto no cliente (sobre
 * `window.__SRN_CFG__`, que É o resultado desta mesma função já rodada no
 * servidor, momentos antes). A função nunca LÊ `nota` do que recebe — só
 * reconstrói os campos que quer manter, campo por campo — então reprojetar
 * um valor já projetado devolve exatamente o mesmo valor. É isso que garante
 * que os dois lados do <head> continuem idênticos mesmo depois deste corte.
 *
 * ── EXPERIMENTO DESLIGADO PUBLICA SÓ O PLANO DO CONTROLE ──────────
 *
 * O ciclo que o painel IMPÕE pra mexer em preço é desligar → editar → religar
 * (Trava 1, `admin-experimentos.ts`). Se o desligado continuasse publicando o
 * plano de todas as variantes, os preços e links NOVOS ficariam no "ver
 * código-fonte" de qualquer visitante durante essa janela — preço que ainda
 * não foi decidido, e link de checkout que ninguém deveria abrir ainda.
 *
 * Mas o corte NÃO pode ser "sem plano nenhum quando desligado": `planoControle()`
 * (`preco.ts`) lê o plano da variante-CONTROLE da config viva, e é esse
 * caminho que faz "mudar o preço pelo painel, sem deploy" funcionar com o
 * teste desligado — que é justamente o estado normal de quem não está
 * testando nada. Sem ele, o site voltaria a exibir o preço do catálogo em
 * código e o painel viraria enfeite.
 *
 * Então o corte é por POSIÇÃO: o plano da primeira variante (o controle — é o
 * preço que está na tela, público por definição) fica; o das demais cai. Com
 * o teste LIGADO, todos ficam, porque aí todos já estão sendo exibidos.
 *
 * `cssExperimentos` não é afetada: ela só lê `id`, `ativo` e `nome`.
 */
function projetarParaPublico(cfg: ExperimentoConfigPublica[]): ExperimentoConfigPublica[] {
  return cfg.map((e) => ({
    id: e.id,
    ativo: e.ativo,
    exposicaoPct: e.exposicaoPct,
    variantes: e.variantes.map((v, i) => ({
      nome: v.nome,
      peso: v.peso,
      plano: e.ativo || i === 0 ? v.plano : undefined,
    })),
  }));
}

declare global {
  interface Window {
    /** Escrito pelo servidor no <head>, antes do <script> de sorteio. JÁ projetada. */
    __SRN_CFG__?: ExperimentoConfigPublica[];
  }
}

/** Preenchida por `definirConfigDoServidor`, a cada requisição, só no servidor. */
let snapshotDoServidor: ExperimentoConfig[] | null = null;

/**
 * Só `experimentos-config.server.ts` chama isto — depois de ler o banco. Se a
 * leitura falhar, ele simplesmente NÃO chama, e o snapshot anterior continua
 * valendo (ver o comentário de `recarregar` lá): cair pro fallback do código
 * a cada soluço do banco tiraria gente do teste em silêncio.
 *
 * Recebe a config CRUA (com `nota`) — `configAtual()` é quem projeta na
 * saída. Guardar a crua aqui deixa outro código de servidor (o painel, Task
 * 6) ler `nota` de algum outro caminho no futuro, se precisar; hoje só
 * `lerConfigFresca()` faz isso, direto, sem passar por este snapshot.
 */
export function definirConfigDoServidor(cfg: ExperimentoConfig[]): void {
  snapshotDoServidor = cfg;
}

/**
 * SÓ PARA TESTE. Devolve o snapshot do servidor pro estado "nunca li o banco
 * ainda" — sem isto, testar o ramo de fallback de `configAtual()` depende de
 * rodar ANTES de qualquer teste que chame `definirConfigDoServidor`, porque
 * `snapshotDoServidor` é uma variável de módulo e persiste entre `it`s do
 * mesmo arquivo.
 */
export function _resetConfigDoServidorParaTeste(): void {
  snapshotDoServidor = null;
}

/**
 * O chão de `configAtual()`, quando nem o snapshot do servidor nem
 * `window.__SRN_CFG__` respondem — instância fria antes da primeira leitura,
 * ou build sem banco (pré-render). TUDO `ativo: false`, sempre, mesmo que
 * `EXPERIMENTOS` diga outra coisa: ver o comentário do array acima.
 */
function configDoCodigo(): ExperimentoConfig[] {
  return EXPERIMENTOS.map((e) => ({
    id: e.id,
    ativo: false, // NUNCA true no fallback. Ver restrições globais do plano.
    exposicaoPct: 100,
    nota: e.nota,
    variantes: e.variantes.map((nome, i) => ({ nome, peso: e.peso?.[i] ?? 1 })),
  }));
}

/**
 * A config viva, JÁ PROJETADA pro que o <head> público usa (`nota` fora — ver
 * `projetarParaPublico`). Lida dos dois lados. Ver o comentário grande acima.
 */
export function configAtual(): ExperimentoConfigPublica[] {
  if (typeof window !== "undefined") {
    return projetarParaPublico(window.__SRN_CFG__ ?? configDoCodigo());
  }
  return projetarParaPublico(snapshotDoServidor ?? configDoCodigo());
}

/**
 * O <script> que planta `window.__SRN_CFG__` — a ponte que faz `configAtual()`
 * ser isomórfica (ver o comentário grande acima). PRECISA vir ANTES do
 * <script> de `scriptExperimentos` no <head>: se viesse depois, o sorteio já
 * teria rodado sem saber a config viva.
 *
 * Escapa `<`, `>` e `&`: os campos de `Plano` (texto, ancora, checkout) são
 * texto digitado no painel, não literal de código — um `</script>` digitado
 * ali dentro fecharia a tag mais cedo e injetaria HTML no <head> de todo
 * visitante do site. `scriptExperimentos` não corre este risco porque só
 * embarca id, nome de variante, peso e exposição; este aqui embarca a config
 * pública inteira (`nota` já saiu — ver `configAtual`/`projetarParaPublico`),
 * `Plano` incluído.
 */
export function scriptConfigGlobal(cfg: ExperimentoConfigPublica[]): string {
  const seguro = JSON.stringify(cfg).replace(
    /[<>&]/g,
    (c) => ({ "<": "\\u003c", ">": "\\u003e", "&": "\\u0026" })[c]!,
  );
  return `window.__SRN_CFG__=${seguro};`;
}

/**
 * O script que roda ANTES do React, direto no <head>.
 *
 * Síncrono de propósito: se ele fosse `async` ou rodasse no `onload`, o
 * navegador já teria pintado o controle e a troca apareceria. É pequeno
 * porque tudo aqui atrasa o primeiro pixel de toda visita.
 *
 * A ordem de decisão é: `?exp=` força e gruda > o que já está guardado no
 * navegador (quem já foi sorteado nunca é reclassificado) > a EXPOSIÇÃO, que
 * decide se a pessoa entra no teste ou cai em `FORA` > só então o peso, que
 * escolhe a variante entre quem entrou. Sortear a exposição depois de `?exp=`
 * e do guardado é o que deixa forçar variante pra testar continuar funcionando
 * mesmo com a exposição em 1%.
 *
 * `peso || 1` era o bug: `0` é peso VÁLIDO (zerar um braço é como se para de
 * mandar tráfego pra ele sem apagar a variante — o painel vai deixar fazer
 * isso), e `||` trata `0` como ausente e troca por 1. É `?? 1` que faz a
 * distinção certa: só peso AUSENTE (undefined) vira 1. Com todos os pesos
 * zerados, `t` (a soma) dá `0`, e o `if(t>0)` abaixo pula o sorteio inteiro —
 * `v` fica no valor com que já entrou no bloco, o controle (`e.v[0]`), sem
 * tocar em `Math.random()` nem arriscar dividir por zero.
 */
export function scriptExperimentos(cfg: ExperimentoConfigPublica[]): string {
  const ativos = cfg.filter((e) => e.ativo && e.variantes.length > 0);
  if (!ativos.length) return "";
  const compacto = ativos.map((e) => ({
    id: e.id,
    v: e.variantes.map((v) => v.nome),
    p: e.variantes.map((v) => v.peso ?? 1),
    x: e.exposicaoPct,
  }));
  return `(function(){try{
var C=${JSON.stringify(compacto)},D=document.documentElement,U=new URLSearchParams(location.search),F=U.get("exp")||"";
for(var i=0;i<C.length;i++){var e=C[i],k="${CHAVE}"+e.id,v=null;
var m=F.split(",").map(function(s){return s.trim()}).filter(function(s){return s.indexOf(e.id+":")===0});
if(m.length){var f=m[0].split(":")[1];if(String(f).toLowerCase()==="${FORA}")v="${FORA}";for(var j=0;j<e.v.length;j++){if(e.v[j].toLowerCase()===String(f).toLowerCase())v=e.v[j];}}
if(!v){try{var s=localStorage.getItem(k);if(s==="${FORA}"||e.v.indexOf(s)>=0)v=s;}catch(_){}}
if(!v&&Math.random()*100>=e.x){v="${FORA}";}
if(!v){var t=0;for(var j=0;j<e.p.length;j++)t+=e.p[j];v=e.v[0];
if(t>0){var r=Math.random()*t,a=0;for(var j=0;j<e.v.length;j++){a+=e.p[j];if(r<a){v=e.v[j];break;}}}}
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
 * Três redes de segurança, nesta ordem de prioridade: `:not([data-exp-...])`
 * é JavaScript desligado ou script bloqueado (sem atributo nenhum, aparece o
 * controle); `[data-exp-...="fora"]` é quem a exposição deixou de fora do
 * teste (aparece o controle também); e o experimento DESLIGADO nem chega a
 * gerar as duas regras acima — só a do controle, incondicional.
 */
export function cssExperimentos(cfg: ExperimentoConfigPublica[]): string {
  const linhas: string[] = [];
  // TODOS os experimentos, não só os ativos. Descoberto do jeito ruim em
  // 10/08: ao desligar um experimento, as regras dele sumiam do CSS, e o
  // bloco da variante ficava SEM nenhuma regra de `display:none` — ou seja,
  // desligar publicava a variante pra 100% do tráfego. Desligar tem que ser a
  // coisa mais segura de fazer com um experimento, não a mais perigosa.
  for (const e of cfg) {
    if (!e.variantes.length) continue;
    const nomes = e.variantes.map((v) => v.nome);
    const controle = nomes[0];
    linhas.push(nomes.map((v) => `[data-v="${e.id}:${v}"]`).join(",") + "{display:none}");

    if (!e.ativo) {
      // Desligado: só o controle aparece, pra quem tiver escrito conteúdo de
      // controle dentro de um <Variante> não ficar com a tela vazia.
      linhas.push(`[data-v="${e.id}:${controle}"]{display:contents}`);
      continue;
    }
    for (const v of nomes) {
      linhas.push(`html[${atributoDe(e.id)}="${v}"] [data-v="${e.id}:${v}"]{display:contents}`);
    }
    // Quem ficou de fora do teste vê o CONTROLE. Sem esta regra, a tela dele
    // sairia sem preço nenhum.
    linhas.push(
      `html[${atributoDe(e.id)}="${FORA}"] [data-v="${e.id}:${controle}"]{display:contents}`,
    );
    linhas.push(`html:not([${atributoDe(e.id)}]) [data-v="${e.id}:${controle}"]{display:contents}`);
  }
  return linhas.join("");
}

/**
 * A variante desta pessoa. No servidor devolve o controle.
 *
 * O controle sai da CONFIG VIVA, pela mesma razão de `experimentosAtivos`:
 * quem decide qual é a primeira variante é o painel. Sem banco, `configAtual()`
 * já cai sozinha no array em código, que é de onde isto lia antes.
 */
export function varianteDe(id: string): string {
  const controle = configAtual().find((e) => e.id === id)?.variantes[0]?.nome ?? "A";
  if (typeof document === "undefined") return controle;
  return document.documentElement.getAttribute(atributoDe(id)) ?? controle;
}

/** Todas as escolhas, no formato que vai pro banco: `{ preco: "B" }`. */
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
