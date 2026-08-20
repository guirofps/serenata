import { useEffect, useMemo, useRef, useState } from "react";

// VENDAS POR DIA — o gráfico principal do painel.
//
// O topo do painel são sete números que dizem COMO ESTÁ. Nenhum deles diz pra
// ONDE ESTÁ INDO: 93 vendas no período pode ser um começo forte que morreu na
// terça, ou uma rampa subindo agora, e a decisão é oposta nos dois casos. A
// setinha de variação compara com o período anterior inteiro, que é um número
// a mais — não um formato.
//
// ── AS ESCOLHAS DE DESENHO, E POR QUÊ ───────────────────────────
//
// UMA SÉRIE, UMA COR. Toda barra usa o mesmo acento. A tentação é pintar as
// maiores mais escuras — fica bonito e é errado: a altura JÁ diz o tamanho, e
// gastar a cor repetindo isso queima o único canal livre que sobrou.
//
// COLUNA, NÃO LINHA. Venda é evento contável e o dia é um balde fechado. Linha
// sugere que existe valor contínuo entre segunda e terça, e não existe.
//
// DIA SEM VENDA APARECE COMO ZERO. `custos.porDia` só traz dia que teve custo
// ou venda — desenhar só o que veio encosta sexta em segunda e some com o fim
// de semana fraco, que é justamente o que se quer enxergar.
//
// UM RÓTULO SÓ, no melhor dia. Número em cima de toda barra é ruído que
// ninguém lê; o resto sai no hover e na tabela "Custo x receita por dia", que
// vive nesta mesma aba e é a versão em texto destes mesmos dados.
//
// ── POR QUE A LARGURA É MEDIDA, E NÃO EM PORCENTAGEM ────────────
//
// A primeira versão desenhava tudo em % com `preserveAspectRatio="none"`. Some
// a matemática e some o `ResizeObserver`, mas o preço apareceu no teste: com
// 30 dias a barra saía com 25px e com 7 dias com 152px, porque "largura da
// banda menos folga" é uma FRAÇÃO — ela não sabe quantos pixels virou. Coluna
// de 152px não é coluna, é um bloco. Medindo, o teto de 24px vale sempre, e de
// quebra o canto arredondado deixa de sair esticado e a linha de base deixa de
// precisar de `vectorEffect`.

/**
 * `receitaBrl` já vem CONVERTIDA pra real em `admin-dados.ts` — a venda em
 * dólar do funil mexicano entra ao câmbio, porque esta linha é comparada com o
 * custo, que é sempre em real. É o oposto do cartão "Receita" do topo, que
 * mostra as duas moedas separadas de propósito.
 */
export type DiaDeVenda = { dia: string; vendas: number; receitaBrl: number; brl: number };

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

/** "2026-08-14" -> "14/08". Fatiado, não `new Date`: a string já é a chave. */
function diaCurto(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

const DIA_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
function diaDaSemana(iso: string): string {
  // `T12:00:00Z`, meio do dia: com `T00:00:00Z` o fuso do navegador puxa a data
  // pro dia anterior e o rótulo sai defasado.
  return DIA_SEMANA[new Date(`${iso}T12:00:00Z`).getUTCDay()] ?? "";
}

/**
 * Preenche os dias sem movimento entre a ponta e a outra do recorte.
 *
 * O recorte manda quando existe (`de`/`ate` do painel); sem ele, o intervalo
 * dos próprios dados. Assim um período de 30 dias com venda em 4 mostra 30
 * colunas, 26 delas no chão — que é a informação.
 */
function preencherDias(dados: DiaDeVenda[], de?: string, ate?: string): DiaDeVenda[] {
  const porDia = new Map(dados.map((d) => [d.dia, d]));
  const chaves = [...porDia.keys()].sort();
  const inicio = (de ?? chaves[0] ?? "").slice(0, 10);
  const fim = (ate ?? chaves[chaves.length - 1] ?? "").slice(0, 10);
  if (!inicio || !fim || inicio > fim) return dados;

  const saida: DiaDeVenda[] = [];
  const t = new Date(`${inicio}T12:00:00Z`).getTime();
  const tFim = new Date(`${fim}T12:00:00Z`).getTime();
  // Teto de segurança: um `de` corrompido não pode virar laço infinito.
  for (let i = 0; t + i * 86400000 <= tFim && i < 400; i++) {
    const iso = new Date(t + i * 86400000).toISOString().slice(0, 10);
    saida.push(porDia.get(iso) ?? { dia: iso, vendas: 0, receitaBrl: 0, brl: 0 });
  }
  return saida.length ? saida : dados;
}

/** Teto do eixo em número redondo — 7 vendas vira 8, 23 vira 25. */
function tetoRedondo(max: number): number {
  if (max <= 4) return Math.max(1, max);
  const passo = max <= 10 ? 2 : max <= 50 ? 5 : max <= 200 ? 25 : 100;
  return Math.ceil(max / passo) * passo;
}

/** Coluna com o topo arredondado e a base reta, ancorada na linha de base. */
function colunaPath(x: number, y: number, w: number, h: number, base: number): string {
  const r = Math.min(4, w / 2, h);
  if (r <= 0.5) return `M${x} ${base}h${w}V${y}h${-w}Z`;
  return `M${x} ${base}V${y + r}a${r} ${r} 0 0 1 ${r} ${-r}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}V${base}Z`;
}

const ALTURA = 178;
/**
 * Onde o desenho termina e começa a faixa das datas.
 *
 * Separado de `ALTURA` porque a primeira versão colocava o rótulo em
 * `ALTURA - 3` com a linha de base em `ALTURA - 1`: as datas ficavam DENTRO do
 * gráfico e as colunas passavam por cima delas. Reservar a faixa é o conserto;
 * empurrar o texto pra baixo sem crescer o `viewBox` só o cortaria.
 */
const BASE = 140;
const EIXO_Y = 32;
/** Teto de espessura da coluna. Acima disso deixa de ser coluna e vira bloco. */
const BARRA_MAX = 24;
/**
 * Ar entre duas colunas vizinhas.
 *
 * 2px é o padrão, mas ele NÃO pode ser fixo: 90 dias num celular dão uma banda
 * de 2,9px, e tirar 2 dali deixa a coluna com 0,9 — abaixo do piso de 1px, ou
 * seja, uma tarja de linhas iguais onde a altura some. Quando a banda é
 * minúscula, a folga vira um quarto dela e a coluna fica com o resto.
 */
const FOLGA_MAX = 2;

export function GraficoVendas({
  porDia,
  de,
  ate,
}: {
  porDia: DiaDeVenda[];
  /** O recorte do painel, pra o eixo cobrir o período pedido e não só o que teve venda. */
  de?: string;
  ate?: string;
}) {
  const [ativo, setAtivo] = useState<number | null>(null);
  const caixa = useRef<HTMLDivElement>(null);
  // Sem medida ainda (primeiro render, SSR), desenha num palco de 800: o
  // `ResizeObserver` corrige no frame seguinte e ninguém vê o meio-termo.
  const [largura, setLargura] = useState(800);

  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    // MEDE NA MONTAGEM, E NÃO SÓ NO OBSERVER.
    //
    // O navegador não entrega callback de `ResizeObserver` pra página oculta —
    // aba em segundo plano, painel escondido, impressão. Sem esta linha, o
    // gráfico ficava com a largura de partida (800) e o SVG inteiro era
    // ESCALADO pra caber: o desenho aparecia certo, mas o teto de 24px da
    // coluna virava 8px sem ninguém perceber, porque o erro é proporcional e
    // parece só "um gráfico menor". Descoberto medindo, não olhando.
    setLargura(el.getBoundingClientRect().width);
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => setLargura(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const dias = useMemo(() => preencherDias(porDia, de, ate), [porDia, de, ate]);
  const total = dias.reduce((s, d) => s + d.vendas, 0);

  if (!dias.length || total === 0) {
    return (
      <p className="rounded-2xl border border-[var(--tinta-fraca)]/40 bg-[var(--papel-fundo)] px-4 py-8 text-center text-sm text-[var(--tinta-suave)]">
        Nenhuma venda neste recorte.
      </p>
    );
  }

  const teto = tetoRedondo(Math.max(...dias.map((d) => d.vendas)));
  const melhor = dias.reduce((iMax, d, i) => (d.vendas > dias[iMax].vendas ? i : iMax), 0);

  const plot = Math.max(largura - EIXO_Y, 80);
  const banda = plot / dias.length;
  const folga = Math.min(FOLGA_MAX, banda * 0.25);
  const larguraBarra = Math.max(1, Math.min(BARRA_MAX, banda - folga));
  const base = BASE;
  const xDe = (i: number) => EIXO_Y + i * banda + (banda - larguraBarra) / 2;
  // Uma marca de data a cada N, no máximo seis: noventa datas viram tarja
  // cinza, e o que se lê num gráfico de tendência é a forma, não cada dia.
  const passoRotulo = Math.max(1, Math.ceil(dias.length / 6));

  return (
    <div className="rounded-2xl border border-[var(--tinta-fraca)]/40 bg-[var(--papel-fundo)] p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[11px] uppercase tracking-wider text-[var(--tinta-suave)]">
          Vendas por dia
        </p>
        <p className="text-xs text-[var(--tinta-suave)]">
          {total} no período · melhor dia {diaCurto(dias[melhor].dia)} com {dias[melhor].vendas}
        </p>
      </div>

      <div ref={caixa} className="relative">
        <svg
          width="100%"
          height={ALTURA}
          viewBox={`0 0 ${largura} ${ALTURA}`}
          role="img"
          aria-label={`Vendas por dia. ${total} vendas no período, melhor dia ${diaCurto(dias[melhor].dia)} com ${dias[melhor].vendas}.`}
          onMouseLeave={() => setAtivo(null)}
        >
          {/* Grade recessiva: meia-altura e topo, hairline sólida. Tracejado
              competiria com as colunas. */}
          {[0, 0.5].map((f) => (
            <line
              key={f}
              x1={EIXO_Y}
              x2={largura}
              y1={1 + f * (base - 1)}
              y2={1 + f * (base - 1)}
              stroke="var(--tinta-fraca)"
              strokeOpacity="0.35"
              strokeWidth="1"
            />
          ))}
          <line
            x1={EIXO_Y}
            x2={largura}
            y1={base}
            y2={base}
            stroke="var(--tinta-fraca)"
            strokeOpacity="0.7"
            strokeWidth="1"
          />

          {/* Os números do eixo Y, dentro do SVG agora que ele tem escala 1:1
              em pixel — não estica mais, então não distorce o texto. */}
          <text
            x={EIXO_Y - 6}
            y={10}
            textAnchor="end"
            className="fill-[var(--tinta-suave)] text-[10px] tabular-nums"
          >
            {teto}
          </text>
          <text
            x={EIXO_Y - 6}
            y={base}
            textAnchor="end"
            className="fill-[var(--tinta-suave)] text-[10px] tabular-nums"
          >
            0
          </text>

          {dias.map((d, i) => {
            const altura = (d.vendas / teto) * (base - 1);
            return (
              <g key={d.dia}>
                {/* Alvo de hover da BANDA INTEIRA, não só da coluna: num dia
                    de zero venda a coluna tem altura nenhuma, e sem isto o dia
                    fraco — o que mais importa investigar — seria o único
                    impossível de consultar. */}
                <rect
                  x={EIXO_Y + i * banda}
                  y={0}
                  width={banda}
                  height={base}
                  fill="transparent"
                  onMouseEnter={() => setAtivo(i)}
                />
                {d.vendas > 0 && (
                  <path
                    d={colunaPath(xDe(i), base - altura, larguraBarra, altura, base)}
                    fill="var(--acento)"
                    fillOpacity={ativo === null || ativo === i ? 1 : 0.4}
                    className="pointer-events-none transition-opacity"
                  />
                )}
              </g>
            );
          })}

          {/* Eixo X. Dentro do SVG pelo mesmo motivo do eixo Y, e com âncora
              nas pontas pra a primeira e a última data não saírem cortadas. */}
          {dias.map((d, i) =>
            i % passoRotulo !== 0 && i !== dias.length - 1 ? null : (
              <text
                key={d.dia}
                x={EIXO_Y + (i + 0.5) * banda}
                y={BASE + 16}
                textAnchor={i === 0 ? "start" : i === dias.length - 1 ? "end" : "middle"}
                className="fill-[var(--tinta-suave)] text-[10px] tabular-nums"
              >
                {diaCurto(d.dia)}
              </text>
            ),
          )}
        </svg>

        {/* O balão do dia sob o cursor. Em HTML por cima do SVG: herda a fonte
            e as bordas arredondadas do painel sem reimplementar nada. */}
        {ativo !== null && (
          <div
            className="pointer-events-none absolute top-0 z-10 min-w-[8.5rem] rounded-xl border border-[var(--tinta-fraca)]/50 bg-[var(--papel)] px-3 py-2 text-xs shadow-lg"
            style={{
              left: xDe(ativo) + larguraBarra / 2,
              // Perto da borda direita o balão abre pra esquerda, senão sai da
              // caixa; nas outras posições fica centrado na coluna.
              transform: xDe(ativo) > largura - 160 ? "translateX(-100%)" : "translateX(-50%)",
            }}
          >
            <p className="font-medium">
              {diaCurto(dias[ativo].dia)}{" "}
              <span className="text-[var(--tinta-suave)]">{diaDaSemana(dias[ativo].dia)}</span>
            </p>
            <p className="mt-1 tabular-nums">
              {dias[ativo].vendas} {dias[ativo].vendas === 1 ? "venda" : "vendas"}
            </p>
            {dias[ativo].receitaBrl > 0 && (
              <p className="tabular-nums text-[var(--tinta-suave)]">
                {brl(dias[ativo].receitaBrl)}
              </p>
            )}
            {dias[ativo].brl > 0 && (
              <p className="tabular-nums text-[var(--tinta-suave)]">custo {brl(dias[ativo].brl)}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
