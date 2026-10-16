// TESTE `pix_reabre` (Serenata, funil pt): o QR do PIX volta sozinho quando
// a aba recarrega.
//
// ── O QUE ACONTECE HOJE ──────────────────────────────────────────
//
// A pessoa gera o PIX, copia o código e vai pro app do banco. No iPhone, o
// Safari descarta a aba que ficou pra trás e, na volta, RECARREGA: ela cai na
// oferta sem a folha, sem o QR, e o "esperando o pagamento cair" (que é o que
// leva pra /obrigado sozinho) morreu junto. Ela pagou e não vê nada, ou não
// pagou ainda e precisa gerar tudo de novo.
//
// ── OS BRAÇOS ────────────────────────────────────────────────────
//
//   A = como é hoje: recarregou, a folha não volta.
//   B = quando o QR aparece, a referência do PIX (e o preço que a folha
//       mostrava) fica guardada no `sessionStorage`, que sobrevive ao
//       recarregamento da MESMA aba. A oferta, ao montar, acha o registro com
//       menos de uma hora, pergunta ao servidor (`buscarPix`, a mesma leitura
//       da rota `/pix/<ref>`, que só LÊ pedido pendente) e reabre a folha
//       direto no QR. Já pago vai pra /obrigado; vencido ou não achado só
//       apaga o registro. Fechar a folha ou pagar também apaga.
//
// ── POR QUE `sessionStorage` E NÃO `localStorage` ────────────────
//
// A promessa é "a aba que você deixou pra trás volta como estava". Outra aba,
// ou o navegador aberto amanhã, não é essa aba: reabrir um PIX ali seria uma
// folha surgindo do nada. E o registro não tem nada de pessoal, só a
// referência (que a rota `/pix/<ref>` já aceita) e o preço da tela.

export const EXP_PIX_REABRE = "pix_reabre";

export const CHAVE_PIX_ABERTO = "mp_pix_aberto";

/**
 * Uma hora: o tempo de vida do código da Woovi. O servidor confere o
 * vencimento de verdade (`pix_expira`); isto só evita perguntar por um PIX
 * que certamente já morreu.
 */
export const JANELA_REABRE_MS = 60 * 60 * 1000;

export type PixAberto = {
  referencia: string;
  /** De QUAL sessão do quiz. Sessão nova (outra música) nunca herda o PIX. */
  sessionId: string;
  criadoEm: number;
  /** O preço como a folha mostrava, pra o resumo e o cartão saírem iguais. */
  texto: string;
  ancora?: string;
  valor: number;
};

/** O braço B vale aqui? Só no funil pt. Pela inicial, como em `folha-pix.ts`. */
export function pixReabreLigado(variante: string | null | undefined, locale: string): boolean {
  if (locale !== "pt") return false;
  return String(variante ?? "").trim().toUpperCase().startsWith("B");
}

/**
 * O registro guardado vale pra reabrir AGORA, nesta sessão? Devolve o
 * registro limpo, ou `null`. Desconfia de tudo: o `sessionStorage` é do
 * navegador, e um valor torto aqui não pode quebrar a oferta.
 */
export function pixParaReabrir(cru: unknown, agora: number, sessaoAtual: string): PixAberto | null {
  if (!cru || typeof cru !== "object") return null;
  const r = cru as Record<string, unknown>;
  const referencia = typeof r.referencia === "string" ? r.referencia.trim() : "";
  // A referência vira caminho de consulta: só o formato que o checkout gera.
  if (!referencia || referencia.length > 120 || !/^[A-Za-z0-9:_-]+$/.test(referencia)) return null;
  if (typeof r.sessionId !== "string" || !r.sessionId || r.sessionId !== sessaoAtual) return null;
  const criadoEm = Number(r.criadoEm);
  if (!Number.isFinite(criadoEm)) return null;
  const idade = agora - criadoEm;
  // Relógio que andou pra trás (ou registro do futuro) não vale.
  if (idade < 0 || idade >= JANELA_REABRE_MS) return null;
  const texto = typeof r.texto === "string" ? r.texto : "";
  const valor = Number(r.valor);
  if (!texto || !Number.isFinite(valor) || valor <= 0) return null;
  return {
    referencia,
    sessionId: r.sessionId,
    criadoEm,
    texto,
    ancora: typeof r.ancora === "string" && r.ancora ? r.ancora : undefined,
    valor,
  };
}

type Guarda = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function guardaPadrao(): Guarda | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null; // Safari com cookies bloqueados lança só de encostar
  }
}

export function guardarPixAberto(p: PixAberto, guarda: Guarda | null = guardaPadrao()): void {
  try {
    guarda?.setItem(CHAVE_PIX_ABERTO, JSON.stringify(p));
  } catch {
    // Modo anônimo cheio: o teste perde a reabertura, a venda não perde nada.
  }
}

export function lerPixAberto(guarda: Guarda | null = guardaPadrao()): unknown {
  try {
    const cru = guarda?.getItem(CHAVE_PIX_ABERTO);
    return cru ? JSON.parse(cru) : null;
  } catch {
    return null;
  }
}

export function esquecerPixAberto(guarda: Guarda | null = guardaPadrao()): void {
  try {
    guarda?.removeItem(CHAVE_PIX_ABERTO);
  } catch {
    // idem
  }
}
