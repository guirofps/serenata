import { createServerFn } from "@tanstack/react-start";
import { FORA, type ExperimentoConfig, type Plano, type Variante } from "@/lib/experimentos";
import { planoCompleto } from "@/lib/preco";
import { supabaseAdmin } from "@/lib/supabase-admin";

// AS DUAS FUNÇÕES QUE O PAINEL USA.
//
// Separadas de `admin-dados.ts` de propósito: aquilo é leitura pesada de
// funil, isto é escrita de configuração. Misturar faria a tela de config
// carregar 180 mil eventos pra salvar um checkbox.

/** Lê SEM cache: quem está editando não pode ver estado velho. */
export const carregarExperimentos = createServerFn({ method: "POST" }).handler(
  async (): Promise<ExperimentoConfig[]> => {
    const { exigirAdmin } = await import("@/lib/admin-auth.server");
    exigirAdmin();
    const { lerConfigFresca } = await import("@/lib/experimentos-config.server");
    return lerConfigFresca();
  },
);

export type EntradaSalvar = {
  id: string;
  ativo: boolean;
  exposicaoPct: number;
  nota: string;
  variantes: Variante[];
};

/** O que a linha `experimentos` diz AGORA, lido do banco — nunca do payload. */
type EstadoNoBanco = { ativo: boolean; variantes: Variante[] } | null;

type Decisao = { ok: true; variantes: Variante[] } | { ok: false; erro: string };

/**
 * Confere só a FORMA do payload — o suficiente pra não estourar 500 dentro
 * de `decidirSalvamento` quando o corpo do request não bate com `EntradaSalvar`
 * (campo faltando, tipo errado, `variantes` que não é array).
 *
 * `.validator()` do `createServerFn`, logo abaixo, NÃO faz esse trabalho: é
 * só um cast de tipo (`(data: EntradaSalvar) => data`), sem checagem em
 * tempo de execução — um `fetch` direto no endpoint, sem passar pela tela do
 * painel, entrega o que quiser como `data`. Sem esta função, `novas.length`
 * ou `novas.map(...)` dentro de `decidirSalvamento` quebra com `TypeError`
 * assim que `variantes` não é array, e o painel recebe um 500 genérico em
 * vez de `{ ok:false, erro }`.
 *
 * Não valida REGRA de negócio (isso é `decidirSalvamento`) — só que os tipos
 * batem o suficiente pra decidir sem explodir.
 */
export function formatoValido(data: unknown): data is EntradaSalvar {
  if (typeof data !== "object" || data === null) return false;
  const d = data as Record<string, unknown>;
  if (typeof d.id !== "string" || d.id.trim() === "") return false;
  if (typeof d.ativo !== "boolean") return false;
  if (typeof d.exposicaoPct !== "number" || !Number.isFinite(d.exposicaoPct)) return false;
  if (typeof d.nota !== "string") return false;
  if (!Array.isArray(d.variantes)) return false;
  return d.variantes.every((v) => {
    if (typeof v !== "object" || v === null) return false;
    const vv = v as Record<string, unknown>;
    if (typeof vv.nome !== "string") return false;
    if (typeof vv.peso !== "number") return false;
    if (vv.plano === undefined) return true;
    if (typeof vv.plano !== "object" || vv.plano === null) return false;
    const p = vv.plano as Record<string, unknown>;
    return (
      typeof p.texto === "string" &&
      typeof p.valor === "number" &&
      typeof p.ancora === "string" &&
      typeof p.checkout === "string"
    );
  });
}

/**
 * Tira espaço das pontas de nome e dos três campos de texto do plano.
 *
 * Roda ANTES de qualquer decisão, e o resultado (`novas`, dentro de
 * `decidirSalvamento`) é literalmente o que se GRAVA no final — não dá pra
 * decidir sobre um valor e persistir outro diferente, porque aí a decisão
 * vale pra um estado que nunca chega a existir no banco.
 *
 * Existe por dois furos encontrados na revisão:
 *   - `"https://pay/a"` e `"https://pay/a "` são strings DIFERENTES pro
 *     `Set` da Trava 2, mas o navegador ignora o espaço em volta da URL —
 *     as duas abrem o MESMO checkout mostrando preços diferentes.
 *   - `"FORA"` e `" fora "` não batem com `=== FORA` mas colidem do mesmo
 *     jeito com o sentinela: o script do `<head>` (`scriptExperimentos`, em
 *     `experimentos.ts`) compara com `toLowerCase()`.
 *
 * Peso também é normalizado aqui (nunca negativo, nunca `NaN`) — antes essa
 * conta vivia solta dentro do `.handler()` de `salvarExperimento`, calculada
 * em cima de `data.variantes` cru, ou seja, DEPOIS de todas as travas já
 * terem decidido em cima de outro valor. Uma normalização só, usada pela
 * decisão e pela gravação, é o que garante que as duas concordam.
 */
function normalizarVariante(v: Variante): Variante {
  const nome = v.nome.trim();
  const peso = Math.max(0, Number(v.peso) || 0);
  if (!v.plano) return { nome, peso };
  return {
    nome,
    peso,
    plano: {
      texto: String(v.plano.texto ?? "").trim(),
      valor: v.plano.valor,
      ancora: String(v.plano.ancora ?? "").trim(),
      checkout: String(v.plano.checkout ?? "").trim(),
    },
  };
}

/**
 * `true` só quando o plano está completo E faz sentido cobrar por ele.
 *
 * `planoCompleto` (de `@/lib/preco.ts`) é o MESMO juiz que decide, em
 * runtime, se uma variante entra em `variantesComPlano`/`planosDaConfig` —
 * exige os quatro campos, `ancora` incluída, todos não-vazios depois de
 * trim. Antes esta trava reimplementava essa checagem com uma versão mais
 * fraca (sem `ancora`, sem trim), e a divergência abria a pior falha
 * possível: o painel deixava ligar um experimento que `planoCompleto`
 * rejeitava depois — a variante continuava sendo SORTEADA (o script do
 * `<head>` só olha `ativo` e `variantes.length`), mas `PrecoDaOferta` não
 * achava plano nenhum pra ela e não renderizava bloco de preço nenhum. Tela
 * de oferta sem preço, e o caixa cobrando o valor do controle por baixo.
 * Duas noções de "plano válido" no mesmo repo sempre divergem de novo; por
 * isso uma importada da outra, não duas reescritas em paralelo.
 *
 * `valor > 0` é um requisito A MAIS que `planoCompleto` não faz (ele só
 * exige `Number.isFinite`, então `0` e negativo passam por ele) — preço
 * zero ou negativo no ar manda uma conversão sem sentido pro Google Ads.
 */
function planoProntoParaAtivar(p: Plano | undefined): p is Plano {
  return planoCompleto(p) && p.valor > 0;
}

function planosIguais(a: Plano | undefined, b: Plano | undefined): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return (
    a.texto === b.texto && a.valor === b.valor && a.ancora === b.ancora && a.checkout === b.checkout
  );
}

/**
 * Compara duas listas de variantes JÁ NORMALIZADAS, campo a campo, na MESMA
 * posição — não por nome casado entre as duas listas.
 *
 * Comparar por posição (índice) é proposital, não descuido: a primeira
 * variante é sempre o controle (`experimentos.ts`, topo), então REORDENAR
 * duas variantes sem mudar nenhum preço já é uma mudança de controle, e tem
 * que cair na Trava 1 igual a mudar o preço. Adicionar ou remover uma versão
 * também muda o comprimento e cai aqui.
 *
 * Antes disto, a comparação era `JSON.stringify` do objeto `plano` inteiro.
 * Funcionava, mas dependia da ordem das CHAVES do `jsonb` do banco bater com
 * a ordem que o formulário monta o objeto em JS — divergência nisso faria
 * TODO salvamento com o teste ligado ser recusado (falso negativo: "desligue
 * o teste" sem nada ter mudado de verdade). Comparar campo a campo não liga
 * pra ordem de chave nenhuma.
 */
function variantesIguaisParaTrava1(a: Variante[], b: Variante[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((va, i) => va.nome === b[i].nome && planosIguais(va.plano, b[i].plano));
}

/**
 * TODAS as travas de `salvarExperimento`, sem tocar em banco nem em rede.
 *
 * Extraída à parte de propósito: são elas que protegem dinheiro de verdade
 * (o teste de preço em produção), e são o único jeito de testar essas travas
 * sem inventar mock de Supabase — a função recebe o estado atual já lido, e
 * devolve só a decisão.
 *
 * `banco` PRECISA vir de uma leitura fresca da tabela, feita pelo chamador,
 * nunca do que o navegador mandou. A Trava 1 abaixo compara contra
 * `banco.ativo`, não contra `entrada.ativo` — é isso que fecha o furo de
 * mandar `ativo:false` junto com um preço novo pra passar pela trava
 * enquanto o teste está ligado de verdade.
 *
 * Em caso de aceite, devolve as variantes JÁ NORMALIZADAS
 * (`{ok:true, variantes}`) — é isso que `salvarExperimento` grava, não
 * `entrada.variantes` cru. Decidir sobre um valor e gravar outro é o mesmo
 * defeito que motivou normalizar antes de decidir (ver `normalizarVariante`).
 */
export function decidirSalvamento(banco: EstadoNoBanco, entrada: EntradaSalvar): Decisao {
  if (!banco) return { ok: false, erro: "experimento não existe" };
  if (!entrada.variantes.length) return { ok: false, erro: "precisa de pelo menos uma versão" };

  const novas = entrada.variantes.map(normalizarVariante);
  const antigo = (banco.variantes ?? []).map(normalizarVariante);

  const nomeVazio = novas.find((v) => v.nome === "");
  if (nomeVazio) {
    // Nome vazio sorteia um valor FALSY (`""`). Em runtime, o script do
    // `<head>` só grava no `localStorage` quando `v` é truthy — então uma
    // variante `""` faz `if(!v)` continuar verdadeiro pra sempre, e a
    // exposição é RE-SORTEADA a cada visita da mesma pessoa. Isso quebra o
    // invariante central de um teste A/B válido: quem já foi sorteado nunca
    // é reclassificado (ver o comentário de `scriptExperimentos`).
    return { ok: false, erro: "toda versão precisa de um nome" };
  }
  // Comparado já normalizado (trim + minúsculas): o script do `<head>`
  // compara `?exp=` com `toLowerCase()` contra o sentinela, então `"FORA"` e
  // `" fora "` colidem com ele do mesmo jeito que `"fora"` colide.
  if (novas.some((v) => v.nome.toLowerCase() === FORA)) {
    return { ok: false, erro: `\`${FORA}\` é reservado pra quem não entra no teste` };
  }
  if (new Set(novas.map((v) => v.nome)).size !== novas.length) {
    return { ok: false, erro: "duas versões com o mesmo nome" };
  }

  // TRAVA 1 — preço e link são só-leitura enquanto o teste está no ar.
  //
  // Quem já foi sorteada pro B tem o preço antigo gravado no navegador. Ela
  // volta, lê outro, e os dois preços ficam embaixo do mesmo rótulo. A
  // comparação é contra `banco.ativo` (o que a linha diz AGORA), não contra
  // `entrada.ativo` (o que o clique mandou) — senão bastaria mandar
  // `ativo:false` junto pra furar a trava, e ela não valeria nada.
  if (banco.ativo && !variantesIguaisParaTrava1(antigo, novas)) {
    return {
      ok: false,
      erro: "desligue o teste pra mexer em preço, link ou nome de versão",
    };
  }

  if (entrada.ativo) {
    // TRAVA — não liga com todo peso zerado.
    //
    // Peso `0` num braço isolado é válido (zera esse braço sem apagar a
    // variante, ver o comentário de `scriptExperimentos`). Mas TODOS em zero
    // é diferente: o painel diria "no ar" enquanto 100% do tráfego cai no
    // controle (`t>0` falha em `scriptExperimentos`, e `v` fica travado em
    // `e.v[0]`) — teste que não testa nada, e ninguém saberia olhando só o
    // toggle `ativo`. Decisão: RECUSAR, não aceitar com aviso. Mesma família
    // das outras travas — "no ar" tem que significar "rodando de verdade",
    // não "rodando, com ressalva que só aparece se alguém ler a nota".
    if (novas.every((v) => v.peso <= 0)) {
      return { ok: false, erro: "pelo menos uma versão precisa ter peso maior que zero" };
    }

    // TRAVA 2 — não liga com duas versões dividindo o mesmo checkout.
    //
    // É o defeito que o teste de preço inteiro existe pra impedir: a tela diz
    // um número e o caixa cobra outro. `v.plano?.checkout` já vem TRIMADO
    // (a lista é `novas`, normalizada acima) — sem isso, um espaço a mais
    // numa das duas URLs as fazia parecer diferentes pro `Set` enquanto o
    // navegador as trata como a mesma.
    const links = novas.map((v) => v.plano?.checkout).filter((s): s is string => !!s);
    if (links.length !== new Set(links).size) {
      return { ok: false, erro: "duas versões apontam pro mesmo link de checkout" };
    }

    // TRAVA 3 — versão sem plano completo (e com preço > 0) não entra no ar.
    const incompleta = novas.find((v) => !planoProntoParaAtivar(v.plano));
    if (incompleta) {
      return { ok: false, erro: `a versão ${incompleta.nome} está sem preço ou link válido` };
    }
  }

  return { ok: true, variantes: novas };
}

/**
 * Salva um experimento, com as travas que impedem estrago de um clique.
 *
 * A decisão em si mora em `decidirSalvamento` (testável sem banco). Aqui só
 * confere a FORMA do payload, lê o estado atual, chama a decisão, e — se ela
 * deixar — grava. Falha de forma ou de decisão volta pro chamador como
 * `{ ok:false, erro }`, nunca como exceção: é a tela do painel que decide
 * como mostrar isso, não um 500 genérico.
 */
export const salvarExperimento = createServerFn({ method: "POST" })
  .validator((data: EntradaSalvar) => data)
  .handler(async ({ data }): Promise<{ ok: boolean; erro?: string }> => {
    const { exigirAdmin } = await import("@/lib/admin-auth.server");
    exigirAdmin();

    // `.validator()` acima é só um cast — não checa nada em runtime. Quem
    // bate direto no endpoint (sem passar pela tela) pode mandar qualquer
    // corpo, e `decidirSalvamento` explodiria com `TypeError` no primeiro
    // `.length`/`.map` se `variantes` não for array. `formatoValido` é a
    // checagem de verdade, antes de decidir qualquer coisa.
    if (!formatoValido(data)) {
      return { ok: false, erro: "payload em formato inválido" };
    }

    const { invalidarConfig } = await import("@/lib/experimentos-config.server");
    const db = supabaseAdmin();

    const { data: linha } = await db
      .from("experimentos")
      .select("ativo, variantes")
      .eq("id", data.id)
      .maybeSingle();

    const banco: EstadoNoBanco = linha
      ? { ativo: Boolean(linha.ativo), variantes: (linha.variantes ?? []) as Variante[] }
      : null;

    const decisao = decidirSalvamento(banco, data);
    if (!decisao.ok) return decisao;

    const exposicao = Math.max(0, Math.min(100, Math.round(data.exposicaoPct)));
    const { error } = await db
      .from("experimentos")
      .update({
        ativo: data.ativo,
        exposicao_pct: exposicao,
        nota: data.nota,
        // As variantes que se GRAVAM são as que a decisão devolveu
        // (`decisao.variantes`, já normalizadas) — nunca `data.variantes`
        // cru. É o que faz a decisão e a gravação concordarem sempre (ver o
        // comentário de `normalizarVariante`).
        variantes: decisao.variantes,
        atualizado_em: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) return { ok: false, erro: error.message };

    // Só invalida DEPOIS do `update` confirmado — invalidar antes reabriria
    // a janela de até 60s de config velha que a invalidação existe pra
    // fechar, se o `update` acima falhasse por qualquer motivo.
    //
    // Isto derruba o cache SÓ NESTA instância. Em produção (Vercel) o site
    // roda em várias lambdas, cada uma com sua própria cópia de
    // `lidoEm`/`snapshotDoServidor` (variável de módulo, não compartilhada)
    // — as outras instâncias continuam servindo o snapshot antigo até a
    // própria janela de 60s delas vencer. Ver o comentário de
    // `invalidarConfig` em `experimentos-config.server.ts`.
    invalidarConfig();
    return { ok: true };
  });
