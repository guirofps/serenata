// O AVISO DE VENDAS DO WHATSAPP, às 12h e às 22h — a conta e o texto.
//
// Puro e sem banco pelo mesmo motivo de `fila-convite.ts`: o erro aqui é de
// FUSO e de JANELA, e os dois mentem calados. Um número errado no WhatsApp
// não estoura em lugar nenhum — ele só faz o dono achar que o dia está pior
// (ou melhor) do que está, que é o tipo de defeito que se descobre tarde e
// por acaso.
//
// SEM IMPORTS: lido por job do Inngest, que roda no ESM do Node na Vercel,
// onde o alias `@/` derruba o endpoint inteiro.

/** O deslocamento do Brasil. Fixo: o horário de verão acabou em 2019. */
const BR_MS = 3 * 3600000;

/** Quantos milissegundos se passaram desde a meia-noite BR de `agora`. */
export function desdeMeiaNoiteBr(agora: number): number {
  const br = new Date(agora - BR_MS);
  return (
    br.getUTCHours() * 3600000 +
    br.getUTCMinutes() * 60000 +
    br.getUTCSeconds() * 1000 +
    br.getUTCMilliseconds()
  );
}

/** A meia-noite BR do dia de `agora`, em instante UTC. */
export function meiaNoiteBr(agora: number): number {
  return agora - desdeMeiaNoiteBr(agora);
}

export type Venda = { pago_em: string; valor_centavos: number | null };

export type Balanco = {
  vendas: number;
  centavos: number;
  vendasOntem: number;
  centavosOntem: number;
};

/**
 * Hoje até agora, contra ONTEM ATÉ A MESMA HORA.
 *
 * A comparação é com a mesma hora, não com o dia inteiro de ontem: às 12h,
 * "23 vendas contra 61" pareceria desastre quando na verdade são 23 contra 19.
 * É a mesma leitura do gráfico do painel, e é o que faz o número querer dizer
 * alguma coisa em vez de só existir.
 */
export function balanco(vendas: Venda[], agora: number): Balanco {
  const inicioHoje = meiaNoiteBr(agora);
  const decorrido = agora - inicioHoje;
  const inicioOntem = inicioHoje - 86400000;
  const corteOntem = inicioOntem + decorrido;

  const b: Balanco = { vendas: 0, centavos: 0, vendasOntem: 0, centavosOntem: 0 };
  for (const v of vendas) {
    const t = Date.parse(v.pago_em);
    if (!Number.isFinite(t)) continue;
    const c = Number(v.valor_centavos) || 0;
    if (t >= inicioHoje && t <= agora) {
      b.vendas++;
      b.centavos += c;
    } else if (t >= inicioOntem && t <= corteOntem) {
      b.vendasOntem++;
      b.centavosOntem += c;
    }
  }
  return b;
}

/** "R$ 1.234,50" */
export function brl(centavos: number): string {
  const v = (centavos / 100).toFixed(2).replace(".", ",");
  return "R$ " + v.replace(/\B(?=(\d{3})+(?!\d),)/g, ".");
}

/**
 * A mensagem do WhatsApp. Curta de propósito: ela é lida na notificação,
 * sem abrir, e `*` é negrito no WhatsApp.
 *
 * A SETA SÓ APARECE QUANDO HÁ COM QUE COMPARAR. Num dia em que ontem não
 * houve venda nenhuma, "↑ ∞%" ou "↑ 100%" seriam ruído — e no primeiro dia
 * depois de uma queda do provedor, seria ruído celebrando uma recuperação
 * contra um dia quebrado.
 */
export function textoDoAviso(b: Balanco, agora: number): string {
  const hora = new Date(agora - BR_MS).getUTCHours();
  const titulo = hora < 18 ? "Vendas até agora" : "Vendas de hoje";

  const linhas = [
    `*${titulo}*`,
    "",
    `${b.vendas} ${b.vendas === 1 ? "venda" : "vendas"} · ${brl(b.centavos)}`,
  ];

  if (b.vendasOntem > 0) {
    const d = b.vendas - b.vendasOntem;
    const pct = Math.round((d / b.vendasOntem) * 100);
    const seta = d > 0 ? "↑" : d < 0 ? "↓" : "→";
    linhas.push(`ontem a esta hora: ${b.vendasOntem} · ${brl(b.centavosOntem)}`);
    linhas.push(`${seta} ${d === 0 ? "igual" : `${Math.abs(pct)}%`}`);
  } else {
    linhas.push("ontem a esta hora: nenhuma");
  }

  if (b.vendas > 0) {
    linhas.push("");
    linhas.push(`ticket médio ${brl(Math.round(b.centavos / b.vendas))}`);
  }

  return linhas.join("\n");
}
