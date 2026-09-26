// O E-MAIL DO FECHAMENTO DO DIA, pro dono e pro sócio. Interno: sem marca,
// sem floreio, tabela simples que abre bem no Gmail do celular.
import type { Resumo } from "../src/lib/resumo-diario.js";

const brl = (v: number) =>
  "R$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const brl0 = (v: number) => "R$ " + Math.round(v).toLocaleString("pt-BR");

/** "+12%" / "-8%" contra a referência, ou vazio quando não dá pra comparar. */
function variacao(atual: number, ref: number | null): string {
  if (ref == null || ref === 0) return "";
  const p = Math.round((100 * (atual - ref)) / Math.abs(ref));
  const cor = p >= 0 ? "#1e7a3c" : "#b3261e";
  return `<span style="color:${cor};font-size:12px;">${p >= 0 ? "+" : ""}${p}%</span>`;
}

const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
export function rotuloDoDia(dia: string): string {
  const d = new Date(`${dia}T12:00:00Z`);
  return `${DIAS[d.getUTCDay()]}, ${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
}

export function assuntoResumoDiario(dia: string, r: Resumo): string {
  return `Fechamento ${dia.slice(8, 10)}/${dia.slice(5, 7)}: ${brl0(r.receitaBrl)} em ${r.vendas} vendas, lucro ${brl0(r.lucroBrl)}`;
}

const td = "padding:6px 8px;border-bottom:1px solid #eee;font-size:14px;";
const tdN = td + "text-align:right;white-space:nowrap;";
const th =
  "padding:6px 8px;text-align:left;font-size:12px;color:#777;font-weight:normal;border-bottom:1px solid #ddd;";
const thN = th + "text-align:right;";
const secao = (t: string) =>
  `<h3 style="margin:26px 0 6px;font-size:15px;color:#2a1518;">${t}</h3>`;

export function emailResumoDiario(args: {
  dia: string;
  hoje: Resumo;
  ontem: Resumo | null;
  media7: { receitaBrl: number; vendas: number; lucroBrl: number; ticketBrl: number } | null;
  /** Saques de indicação esperando o dono pagar (PIX manual). */
  saques?: { n: number; centavos: number } | null;
}): string {
  const { dia, hoje: r, ontem, media7, saques } = args;

  const linhaTopo = (
    rotulo: string,
    valor: string,
    a: number,
    o: number | null,
    m: number | null,
  ) =>
    `<tr><td style="${td}">${rotulo}</td><td style="${tdN}"><b>${valor}</b></td><td style="${tdN}">${variacao(a, o)}</td><td style="${tdN}">${variacao(a, m)}</td></tr>`;

  const gastoOutros = Object.entries(r.gastoOutrosBrl);
  const upsellLinhas = (["video", "quadro", "extra", "outro"] as const)
    .filter((k) => r.upsells[k].n > 0)
    .map((k) => {
      const nome = {
        video: "Vídeo-presente",
        quadro: "Quadro",
        extra: "Música extra",
        outro: "Outros",
      }[k];
      return `<tr><td style="${td}">${nome}</td><td style="${tdN}">${r.upsells[k].n}</td><td style="${tdN}">${brl(r.upsells[k].brl)}</td></tr>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f6f3ee;font-family:Helvetica,Arial,sans-serif;color:#2a1518;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f6f3ee;padding:20px 10px;"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:12px;padding:22px 18px;">
<tr><td>
  <div style="font-size:12px;letter-spacing:2px;color:#7d2b3a;">SERENATA · FECHAMENTO DO DIA</div>
  <h2 style="margin:6px 0 2px;font-size:22px;">${rotuloDoDia(dia)}</h2>
  <div style="font-size:13px;color:#777;">Dia inteiro, horário de Brasília.</div>
  ${
    saques && saques.n > 0
      ? `<div style="margin-top:14px;padding:10px 12px;border-radius:8px;background:#fff4e0;color:#7a4b00;font-size:14px;">
      <b>${saques.n} ${saques.n === 1 ? "saque de indicação esperando" : "saques de indicação esperando"}</b> pagamento, ${brl(saques.centavos / 100)} no total.
      <a href="https://www.serenatagift.com/admin?aba=indicacoes" style="color:#7a4b00;">Abrir no painel</a>
    </div>`
      : ""
  }

  <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;border-collapse:collapse;">
    <tr><th style="${th}"></th><th style="${thN}">dia</th><th style="${thN}">vs ontem</th><th style="${thN}">vs média 7d</th></tr>
    ${linhaTopo("Faturamento", brl(r.receitaBrl), r.receitaBrl, ontem?.receitaBrl ?? null, media7?.receitaBrl ?? null)}
    ${linhaTopo("Vendas (música)", String(r.vendas), r.vendas, ontem?.vendas ?? null, media7?.vendas ?? null)}
    ${linhaTopo("Ticket por comprador", brl(r.ticketBrl), r.ticketBrl, ontem?.ticketBrl ?? null, media7?.ticketBrl ?? null)}
    ${linhaTopo("Lucro de operação", brl(r.lucroBrl), r.lucroBrl, ontem?.lucroBrl ?? null, media7?.lucroBrl ?? null)}
  </table>

  ${secao("Para onde foi o dinheiro")}
  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
    <tr><td style="${td}">Faturamento</td><td style="${tdN}">${brl(r.receitaBrl)}</td></tr>
    <tr><td style="${td}">Google Ads</td><td style="${tdN}">- ${brl(r.gastoGoogleBrl)}</td></tr>
    ${
      gastoOutros.length
        ? gastoOutros
            .map(
              ([o, v]) => `<tr><td style="${td}">${o}</td><td style="${tdN}">- ${brl(v)}</td></tr>`,
            )
            .join("")
        : `<tr><td style="${td};color:#b3261e;">TikTok e outros</td><td style="${tdN};color:#b3261e;">não informado</td></tr>`
    }
    <tr><td style="${td}">Produção (letra, música, vídeo)</td><td style="${tdN}">- ${brl(r.custoProducaoBrl)}</td></tr>
    <tr><td style="${td}">Taxas de pagamento</td><td style="${tdN}">- ${brl(r.taxasBrl)}</td></tr>
    <tr><td style="${td}"><b>Lucro de operação</b></td><td style="${tdN}"><b>${brl(r.lucroBrl)}</b></td></tr>
  </table>
  ${
    gastoOutros.length
      ? ""
      : `<div style="font-size:12px;color:#777;margin-top:6px;">O gasto do TikTok não chega sozinho: sem ele, o lucro acima está maior do que o real. Dá pra digitar no painel (gastos de mídia).</div>`
  }

  ${secao("Vendas por canal")}
  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
    <tr><th style="${th}">canal</th><th style="${thN}">vendas</th><th style="${thN}">receita</th><th style="${thN}">CPA</th></tr>
    ${r.porCanal
      .map((c) => {
        const gasto =
          c.canal === "Google"
            ? r.gastoGoogleBrl
            : (r.gastoOutrosBrl[c.canal.toLowerCase()] ?? null);
        const cpa = gasto != null && c.vendas ? brl(gasto / c.vendas) : "";
        return `<tr><td style="${td}">${c.canal}</td><td style="${tdN}">${c.vendas}</td><td style="${tdN}">${brl(c.receitaBrl)}</td><td style="${tdN}">${cpa}</td></tr>`;
      })
      .join("")}
  </table>

  ${secao("Upsells e bumps")}
  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
    ${upsellLinhas || `<tr><td style="${td};color:#777;">Nenhum upsell no dia.</td></tr>`}
    <tr><td style="${td}">Bump no checkout</td><td style="${tdN}" colspan="2">${r.bumps.quadro} quadro · ${r.bumps.video} vídeo</td></tr>
  </table>

  ${secao("Google, por campanha (CPA real, pelo nosso banco)")}
  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
    <tr><th style="${th}">campanha</th><th style="${thN}">gasto</th><th style="${thN}">vendas</th><th style="${thN}">CPA</th></tr>
    ${r.porCampanha
      .map((c) => {
        const ruim = c.cpaBrl == null ? c.gastoBrl >= 76 : c.cpaBrl > 33.8;
        const cor = ruim ? "color:#b3261e;" : "";
        return `<tr><td style="${td}">${c.nome}</td><td style="${tdN}">${brl0(c.gastoBrl)}</td><td style="${tdN}">${c.vendas}</td><td style="${tdN}${cor}">${c.cpaBrl != null ? brl(c.cpaBrl) : c.vendas === 0 && c.gastoBrl >= 76 ? "sem venda" : "-"}</td></tr>`;
      })
      .join("")}
  </table>
  <div style="font-size:12px;color:#777;margin-top:6px;">Vermelho: CPA acima do break-even (R$ 33,80), ou R$ 76 gastos sem venda.</div>
</td></tr></table>
</td></tr></table>
</body></html>`;
}
