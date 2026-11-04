// TESTE `pix_gateway` (Serenata, 04/11/2026): o PIX da música metade pela
// Woovi, metade pelo Asaas.
//
// ── POR QUÊ ──────────────────────────────────────────────────────
//
// Pago ÷ pessoa que gerou o PIX: Asaas 82% (11-16/10) e 78% (17-21/10, já com
// o tráfego da conta nova do Google), Woovi 73% (22/10-03/11). Lead a R$ 4 e
// CPA a R$ 37 batem com essa perda. Mas o período mudou junto (conta nova,
// CNPJ novo), então só o sorteio separa o gateway do resto.
//
// ── OS BRAÇOS ────────────────────────────────────────────────────
//
//   A = Woovi, como é desde 22/10 (o controle).
//   B = Asaas.
//
// A folha é a MESMA nos dois: os dois gateways pedem CPF (`exigeCpf`), o
// recebedor no banco é o mesmo CNPJ. Só muda quem gera o código.
//
// ── POR QUE PELA SESSÃO ──────────────────────────────────────────
//
// É a chave que o `criarPix` já recebe, e a mesma em todo clique, reload e
// volta pelo e-mail: a pessoa nunca troca de gateway no meio. Último caractere
// do id (hex do uuid), par = A, ímpar = B. Fora disso, A.
//
// ── DESLIGAR ─────────────────────────────────────────────────────
//
// `PIX_GATEWAY_AB_OFF=1` na Vercel (e redeploy) volta pro `gatewayPix()` de
// sempre (`PIX_GATEWAY`). Encerrar de vez: `LIGADO = false`.

export const EXP_PIX_GATEWAY = "pix_gateway";

export const LIGADO = true;

export type BracoPixGateway = "A" | "B";

export function bracoPixGateway(sessionId: string | null | undefined): BracoPixGateway {
  const ultimo = String(sessionId ?? "").trim().slice(-1);
  if (!/^[0-9a-f]$/i.test(ultimo)) return "A";
  return parseInt(ultimo, 16) % 2 === 1 ? "B" : "A";
}

/** Nome do gateway do braço. `null` = teste fora, vale o `gatewayPix()`. */
export function gatewayDoTeste(
  sessionId: string | null | undefined,
  env: Record<string, string | undefined> = process.env,
): "woovi" | "asaas" | null {
  if (!LIGADO || String(env.PIX_GATEWAY_AB_OFF ?? "").trim() === "1") return null;
  return bracoPixGateway(sessionId) === "B" ? "asaas" : "woovi";
}
