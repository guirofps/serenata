// QUAL VÍDEO PAGO QUE FALHOU VOLTA SOZINHO PRA FILA (02/10).
//
// Em 01 e 02/10 três vídeos pagos falharam e ficaram sem entrega até alguém
// ver o alerta: dois por "Rate Exceeded" (a cota de 10 Lambdas simultâneas da
// conta nova da AWS) e um por foto que não carregou. Os três saíram na primeira
// nova tentativa. Falha de render quase sempre é passageira, então o vigia de
// hora em hora (`videoPendente`) tenta de novo sem esperar ninguém.
//
// Com TETO, porque falha que não é passageira (foto apagada, música sem áudio)
// repetiria pra sempre, gastando Lambda a cada hora. Passou do teto ou da
// janela, fica `falhou` e o alerta pro dono continua sendo o caminho.

/** Quantas vezes o vigia devolve o mesmo vídeo pra fila. */
export const RESGATES_MAX = 3;
/** Depois disso já é caso de olhar à mão, não de insistir. */
export const RESGATE_JANELA_H = 72;

export function podeResgatar(
  v: { status: string; video_path: string | null; tentativas: number | null; created_at: string },
  agora: number,
): boolean {
  if (v.status !== "falhou") return false;
  // Com arquivo, ela já tem um vídeo (falhou uma ATUALIZAÇÃO): não é este caso.
  if (v.video_path) return false;
  if ((v.tentativas ?? 0) >= RESGATES_MAX) return false;
  return agora - Date.parse(v.created_at) <= RESGATE_JANELA_H * 3600_000;
}
