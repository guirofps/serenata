import { ehBallad } from "@/lib/marca-identidade";
import { configAtual } from "@/lib/experimentos";
import { MERCADOS_LOCAIS, type Mercado } from "@/lib/mercados";
import { bracoLocalCobravel, configDoTesteLocal, limparBraco } from "@/lib/preco-local";
import { pctNoMercado } from "@/lib/black-friday";

// O CABEÇALHO DO SELO DE BLACK FRIDAY (teste `black_friday`, `black-friday.ts`).
//
// Nasce escondido (`.bf-topo` em `styles.css`); só o braço B acende.
//
// Na Serenata é um número só. Na Ballad o desconto muda com a moeda e com o
// braço do teste de preço do país, então vai um bloco por moeda (e por braço),
// escolhido pelo MESMO CSS que escolhe o preço (`.preco-<moeda>` e
// `data-v="<teste>:<braço>"`): o número do selo é sempre o do preço que está
// na tela, que é o do caixa.

function Numero({ pct }: { pct: number | null }) {
  // Conta abaixo do mínimo naquela moeda: fica só o "Black Friday".
  if (pct === null) return null;
  return (
    <>
      <span className="mt-1 block font-display text-7xl font-semibold leading-none tracking-tight">
        {pct}%
      </span>
      <span className="block text-sm font-semibold uppercase tracking-[0.3em]">off</span>
    </>
  );
}

/** Os números de um mercado: um só, ou um por braço do teste de preço do país. */
function NoMercado({ m, plano }: { m: Mercado; plano: { texto: string; ancora: string } }) {
  const cfg = m.teste ? configDoTesteLocal(m, configAtual()) : null;
  if (cfg && m.teste) {
    const bracos: Array<{ nome: string; pct: number | null }> = [];
    for (const v of cfg.variantes ?? []) {
      const nome = limparBraco(v?.nome);
      if (!nome) continue;
      bracos.push({ nome, pct: pctNoMercado(m, plano, bracoLocalCobravel(m, cfg, nome)) });
    }
    if (bracos.length >= 2 && !bracos.every((b) => b.pct === bracos[0].pct)) {
      const id = m.teste.id;
      return (
        <>
          {bracos.map((b) => (
            <span key={b.nome} data-v={`${id}:${b.nome}`}>
              <Numero pct={b.pct} />
            </span>
          ))}
        </>
      );
    }
  }
  return <Numero pct={pctNoMercado(m, plano)} />;
}

export function SeloBlackFriday({
  pct,
  plano,
}: {
  /** O número do selo (na Ballad, o do dólar). */
  pct: number;
  /** O plano em dólar do controle: de onde saem os números das outras moedas. */
  plano: { texto: string; ancora: string };
}) {
  return (
    <div className="bf-topo" style={{ color: "#F3D9A4" }}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em]">Black Friday</p>
      {ehBallad() ? (
        <>
          <span className="preco-usd">
            <Numero pct={pct} />
          </span>
          {MERCADOS_LOCAIS.map((m) => (
            <span key={m.moeda} className={`preco-${m.moeda}`}>
              <NoMercado m={m} plano={plano} />
            </span>
          ))}
        </>
      ) : (
        <Numero pct={pct} />
      )}
    </div>
  );
}
