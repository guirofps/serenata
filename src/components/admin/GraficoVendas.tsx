import { useEffect, useMemo, useRef, useState } from "react";
import type { PontoSerie } from "@/lib/admin-dados";

// RECEITA AO LONGO DO TEMPO — o gráfico principal do painel.
//
// Os cartões do topo dizem COMO ESTÁ. Nenhum deles diz pra ONDE ESTÁ INDO:
// R$ 2.406 no período tem forma de rampa e forma de queda, e a decisão é
// oposta nos dois casos. A setinha de variação resolve metade — ela compara com
// o período anterior, mas devolve mais um número, não um formato.
//
// ── AS ESCOLHAS, E POR QUÊ ──────────────────────────────────────
//
// RECEITA, NÃO CONTAGEM. A operação faz poucas vendas por dia. Contagem por
// hora é uma linha de zeros e uns, que não tem forma nenhuma; a receita
// desenha a curva. A contagem não some — vai no balão do hover, onde ela
// responde "foram três vendas ou uma cara?".
//
// LINHA, NÃO COLUNA. Com duas séries sobrepostas, coluna vira barra agrupada e
// o olho perde a comparação. Linha sólida contra tracejada é a leitura mais
// direta que existe pra "hoje contra ontem", e é por isso que todo painel de
// e-commerce faz assim.
//
// UMA COR, DUAS FORÇAS. O período anterior é CONTEXTO, não um concorrente:
// mesmo acento, mais apagado e tracejado. Duas cores fortes fariam o olho
// procurar qual das duas é a boa notícia.
//
// A TRACEJADA VAI ALÉM DA SÓLIDA, de propósito. A sólida para em agora; a
// tracejada mostra o período anterior INTEIRO. É o que transforma o desenho de
// placar em meta: dá pra ver quanto falta pra alcançar ontem. Todo o resto do
// painel compara "até esta mesma hora" — aqui, e só aqui, a régua é outra, e o
// servidor busca essa janela separado (ver `serieAnterior` em `admin-dados`).

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
/**
 * O rótulo do eixo Y, COMPACTO a partir do milhar.
 *
 * "R$ 1.000" mede 39px e não cabia na calha; "R$ 12.500", de um mês bom, mede
 * mais ainda. O texto era cortado pela borda esquerda do SVG e saía "I$ 1.000"
 * — o tipo de defeito que parece fonte estranha e é geometria. Compacto ("R$ 1
 * mil") resolve a largura sem tirar a moeda, que é o que diz o que o eixo mede.
 */
const brlEixo = (n: number) =>
  n >= 1000
    ? n.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
        notation: "compact",
        maximumFractionDigits: 1,
      })
    : brl(n);
const brlExato = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

/** Teto do eixo em número redondo, pra a marca do topo ser legível. */
function tetoRedondo(max: number): number {
  if (max <= 0) return 1;
  const escala = 10 ** Math.floor(Math.log10(max));
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 7.5, 10]) {
    if (max <= m * escala) return m * escala;
  }
  return 10 * escala;
}

const ALTURA = 190;
/** Onde o desenho acaba e começa a faixa das datas. */
const BASE = 150;
/** Calha do eixo Y. Cabe "R$ 12,5 mil" com folga — medido, não estimado. */
const EIXO_Y = 54;
const TOPO = 8;

export function GraficoVendas({
  serie,
  anterior,
  granularidade,
  rotuloPeriodo,
  rotuloAnterior,
}: {
  serie: PontoSerie[];
  /** O mesmo recorte, um período atrás — e INTEIRO, não cortado em agora. */
  anterior: PontoSerie[];
  granularidade: "hora" | "dia";
  rotuloPeriodo: string;
  rotuloAnterior: string;
}) {
  const [ativo, setAtivo] = useState<number | null>(null);
  const caixa = useRef<HTMLDivElement>(null);
  const [largura, setLargura] = useState(800);

  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    // Mede na montagem também, e não só no observer: o navegador não entrega
    // callback de `ResizeObserver` pra página oculta (aba em segundo plano,
    // impressão), e aí o SVG inteiro sairia escalado.
    setLargura(el.getBoundingClientRect().width);
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => setLargura(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // AS DUAS SÉRIES SE ALINHAM POR POSIÇÃO, não por data: o balde 14 de hoje
  // encosta no balde 14 de ontem. É a única leitura que faz sentido — comparar
  // por data absoluta seria comparar hoje com hoje.
  const n = Math.max(serie.length, anterior.length);
  const totais = useMemo(() => {
    const soma = (a: PontoSerie[]) => a.reduce((s, p) => s + p.receitaBrl, 0);
    return { atual: soma(serie), antes: soma(anterior) };
  }, [serie, anterior]);

  if (!n || (totais.atual === 0 && totais.antes === 0)) {
    return (
      <p className="rounded-2xl border border-[var(--tinta-fraca)]/40 bg-[var(--papel-fundo)] px-4 py-8 text-center text-sm text-[var(--tinta-suave)]">
        Nenhuma venda neste recorte nem no anterior.
      </p>
    );
  }

  const teto = tetoRedondo(
    Math.max(...serie.map((p) => p.receitaBrl), ...anterior.map((p) => p.receitaBrl), 0),
  );
  const plot = Math.max(largura - EIXO_Y, 80);
  // Ponto no MEIO do balde: a receita da hora 14 não acontece às 14:00 em
  // ponto, ela é o intervalo inteiro.
  const x = (i: number) => EIXO_Y + ((i + 0.5) * plot) / n;
  const y = (v: number) => BASE - (v / teto) * (BASE - TOPO);

  const caminho = (pts: PontoSerie[]) =>
    pts.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(p.receitaBrl).toFixed(1)}`).join("");

  // QUANTAS DATAS CABEM, e não quantas eu acho bonito. Um número fixo de
  // marcas funciona no desktop e colide no celular, porque a mesma quantidade
  // de texto tem metade do espaço — medido: 7 marcas de "01/07" em 375px se
  // sobrepõem duas a duas. "08" ocupa bem menos que "01/07", daí os dois
  // números.
  const larguraRotulo = granularidade === "hora" ? 28 : 48;
  const cabem = Math.max(2, Math.floor(plot / larguraRotulo));
  const passoRotulo = Math.max(1, Math.ceil(n / cabem));
  const eixo = serie.length >= anterior.length ? serie : anterior;

  // A ÚLTIMA MARCA SUBSTITUI a anterior quando encosta nela, em vez de se
  // somar. Forçar o último índice além do passo era o que ainda deixava dois
  // rótulos colados no fim (28 e 29, num passo de 7). Trocar preserva a data
  // final — que é o que diz até onde o gráfico vai — sem sobrepor nada.
  const marcas: number[] = [];
  for (let i = 0; i < eixo.length; i += passoRotulo) marcas.push(i);
  const fim = eixo.length - 1;
  if (fim > 0) {
    if (fim - marcas[marcas.length - 1] < passoRotulo * 0.7) marcas.pop();
    marcas.push(fim);
  }

  const pAtual = ativo !== null ? serie[ativo] : undefined;
  const pAntes = ativo !== null ? anterior[ativo] : undefined;

  return (
    <div className="rounded-2xl border border-[var(--tinta-fraca)]/40 bg-[var(--papel-fundo)] p-4">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-[11px] uppercase tracking-wider text-[var(--tinta-suave)]">
          Receita ao longo do tempo
        </p>
        <p className="text-xs text-[var(--tinta-suave)]">
          {granularidade === "hora" ? "por hora" : "por dia"} · anterior {brl(totais.antes)}
        </p>
      </div>
      <p
        className="mb-3 tabular-nums leading-none text-[var(--acento)]"
        style={{ fontWeight: 600, fontSize: "var(--t-xl)" }}
      >
        {brlExato(totais.atual)}
      </p>

      <div ref={caixa} className="relative">
        <svg
          width="100%"
          height={ALTURA}
          viewBox={`0 0 ${largura} ${ALTURA}`}
          role="img"
          aria-label={`Receita por ${granularidade}. ${brlExato(totais.atual)} no período contra ${brlExato(totais.antes)} no anterior.`}
          onMouseLeave={() => setAtivo(null)}
          onMouseMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            // A posição do mouse em unidade de viewBox — o SVG pode estar
            // escalado, e usar o pixel da tela erraria o balde.
            const px = ((e.clientX - r.left) / r.width) * largura;
            const i = Math.floor(((px - EIXO_Y) / plot) * n);
            setAtivo(i >= 0 && i < n ? i : null);
          }}
        >
          {[0, 0.5, 1].map((f) => (
            <g key={f}>
              <line
                x1={EIXO_Y}
                x2={largura}
                y1={BASE - f * (BASE - TOPO)}
                y2={BASE - f * (BASE - TOPO)}
                stroke="var(--tinta-fraca)"
                strokeOpacity={f === 0 ? 0.7 : 0.3}
                strokeWidth="1"
              />
              <text
                x={EIXO_Y - 8}
                y={BASE - f * (BASE - TOPO) + 3}
                textAnchor="end"
                className="fill-[var(--tinta-suave)] text-[10px] tabular-nums"
              >
                {brlEixo(teto * f)}
              </text>
            </g>
          ))}

          {/* O ANTERIOR PRIMEIRO, pra a linha de hoje passar por cima dele
              onde as duas se cruzam. Quem está sendo lido é o de hoje. */}
          {anterior.length > 1 && (
            <path
              d={caminho(anterior)}
              fill="none"
              stroke="var(--acento)"
              strokeOpacity="0.4"
              strokeWidth="2"
              strokeDasharray="5 4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
          {serie.length > 1 && (
            <path
              d={caminho(serie)}
              fill="none"
              stroke="var(--acento)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
          {/* Um ponto só, quando a série tem um balde: linha de um ponto não
              desenha nada, e "ainda não deu uma hora" viraria gráfico vazio. */}
          {serie.length === 1 && (
            <circle cx={x(0)} cy={y(serie[0].receitaBrl)} r="4" fill="var(--acento)" />
          )}

          {ativo !== null && (
            <g className="pointer-events-none">
              <line
                x1={x(ativo)}
                x2={x(ativo)}
                y1={TOPO}
                y2={BASE}
                stroke="var(--tinta-fraca)"
                strokeOpacity="0.8"
                strokeWidth="1"
              />
              {pAntes && (
                <circle
                  cx={x(ativo)}
                  cy={y(pAntes.receitaBrl)}
                  r="3.5"
                  fill="var(--acento)"
                  fillOpacity="0.45"
                />
              )}
              {pAtual && (
                <circle
                  cx={x(ativo)}
                  cy={y(pAtual.receitaBrl)}
                  r="4.5"
                  fill="var(--acento)"
                  stroke="var(--papel-fundo)"
                  strokeWidth="2"
                />
              )}
            </g>
          )}

          {marcas.map((i) => (
            <text
              key={eixo[i].inicio}
              x={x(i)}
              y={ALTURA - 14}
              // Âncora pra dentro nas pontas, senão a primeira e a última data
              // saem pela borda do SVG.
              textAnchor={i === 0 ? "start" : i === eixo.length - 1 ? "end" : "middle"}
              className="fill-[var(--tinta-suave)] text-[10px] tabular-nums"
            >
              {eixo[i].rotulo}
            </text>
          ))}
        </svg>

        {/* LEGENDA. Com duas séries ela não é opcional: cor sozinha não pode
            ser o único jeito de saber qual linha é qual. */}
        <div className="mt-1 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-[var(--tinta-suave)]">
          <span className="inline-flex items-center gap-1.5">
            <svg width="18" height="6" aria-hidden="true">
              <line
                x1="0"
                y1="3"
                x2="18"
                y2="3"
                stroke="var(--acento)"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            {rotuloPeriodo}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <svg width="18" height="6" aria-hidden="true">
              <line
                x1="0"
                y1="3"
                x2="18"
                y2="3"
                stroke="var(--acento)"
                strokeOpacity="0.4"
                strokeWidth="2"
                strokeDasharray="5 4"
                strokeLinecap="round"
              />
            </svg>
            {rotuloAnterior}
          </span>
        </div>

        {ativo !== null && (pAtual || pAntes) && (
          <div
            className="pointer-events-none absolute top-0 z-10 min-w-[9rem] rounded-xl border border-[var(--tinta-fraca)]/50 bg-[var(--papel)] px-3 py-2 text-xs shadow-lg"
            style={{
              left: x(ativo),
              transform: x(ativo) > largura - 170 ? "translateX(-100%)" : "translateX(-50%)",
            }}
          >
            <p className="font-medium">
              {(pAtual ?? pAntes)!.rotulo}
              {granularidade === "hora" ? "h" : ""}
            </p>
            {pAtual && (
              <p className="mt-1 tabular-nums">
                {brlExato(pAtual.receitaBrl)}
                {pAtual.vendas > 0 && (
                  <span className="text-[var(--tinta-suave)]">
                    {" "}
                    · {pAtual.vendas} {pAtual.vendas === 1 ? "venda" : "vendas"}
                  </span>
                )}
              </p>
            )}
            {pAntes && (
              <p className="tabular-nums text-[var(--tinta-suave)]">
                {brlExato(pAntes.receitaBrl)} no anterior
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
