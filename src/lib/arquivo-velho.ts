// A PÁGINA ABERTA ANTES DE UMA PUBLICAÇÃO (29/10).
//
// Cada publicação troca o nome dos arquivos que o site carrega sob demanda (o
// caixa do Stripe, a oferta, a revelação da letra). Quem abriu a página antes
// fica com a lista velha e, ao tocar em comprar, pede um arquivo que já não
// existe: o caixa da Ballad mostrava "tente de novo" e o "tente de novo" pedia
// o MESMO arquivo morto. Medido na Ballad: de 1 sessão por dia (25/10) a 20 até
// as 13h de 29/10, dias de muita publicação, e essas sessões pagaram metade
// (10% × 20%).
//
// O Vite avisa a falha pelo evento `vite:preloadError`. A saída é recarregar a
// página, que vem com a lista nova; o quiz volta do `mp_quiz` e do passo na URL.
// Uma vez por minuto no máximo: se o arquivo faltar até numa página nova, a
// falha segue pro caminho de erro de sempre em vez de virar laço de recarga.

import { trackEvent } from "@/lib/track";

const CHAVE = "mp_recarregou_arquivo";
const AVISADO = "mp_recarregou_arquivo_avisado";
export const JANELA_MS = 60_000;

/** Recarrega só se a última recarga por arquivo velho foi há mais de um minuto. */
export function deveRecarregar(agora: number, ultima: number | null): boolean {
  return ultima === null || !Number.isFinite(ultima) || agora - ultima > JANELA_MS;
}

function lerUltima(): number | null {
  try {
    const v = sessionStorage.getItem(CHAVE);
    return v ? Number(v) : null;
  } catch {
    return null;
  }
}

/**
 * Liga a recarga automática e conta a recarga que acabou de acontecer (o
 * evento sai DEPOIS de recarregar: antes, a requisição morreria junto com a
 * página). Devolve a função que desliga.
 */
export function recarregarSeArquivoVelho(): () => void {
  try {
    const ultima = lerUltima();
    if (ultima !== null && Date.now() - ultima < JANELA_MS && sessionStorage.getItem(AVISADO) !== String(ultima)) {
      sessionStorage.setItem(AVISADO, String(ultima));
      trackEvent("arquivo_velho_recarregou", {});
    }
  } catch {
    // Sem sessionStorage (aba privada antiga): segue sem a contagem.
  }

  const aoFalhar = (ev: Event) => {
    const agora = Date.now();
    if (!deveRecarregar(agora, lerUltima())) {
      trackEvent("arquivo_velho_falhou", {});
      return;
    }
    try {
      sessionStorage.setItem(CHAVE, String(agora));
      // O caixa estava aberto: depois de recarregar, a oferta o reabre.
      if (sessionStorage.getItem(CAIXA_ABERTO)) sessionStorage.setItem(REABRIR_CAIXA, String(agora));
    } catch {
      // Sem como guardar a trava, não arrisca um laço de recarga.
      trackEvent("arquivo_velho_falhou", { sem_storage: true });
      return;
    }
    ev.preventDefault();
    window.location.reload();
  };
  window.addEventListener("vite:preloadError", aoFalhar);
  return () => window.removeEventListener("vite:preloadError", aoFalhar);
}

// ── O CAIXA QUE A RECARGA FECHAVA (12/11) ──────────────────────────
//
// A recarga acima resolve o arquivo, mas a pessoa tinha acabado de tocar em
// PAGAR: volta pra oferta com o caixa fechado e precisa achar o botão de novo.
// Medido na Ballad em 10-11/11 (dias de várias publicações): 27 sessões
// recarregaram com o caixa do Stripe abrindo, 15 tocaram em comprar de novo e
// 12 nunca mais. Agora o caixa marca que está aberto e, se a recarga por
// arquivo velho acontece com ele aberto, a oferta o reabre uma vez ao voltar.

const CAIXA_ABERTO = "mp_caixa_aberto";
const REABRIR_CAIXA = "mp_reabrir_caixa";

/** O pedido de reabrir vale só logo depois da recarga (não reabre num retorno horas depois). */
export function deveReabrirCaixa(agora: number, marcadoEm: number | null): boolean {
  return marcadoEm !== null && Number.isFinite(marcadoEm) && agora - marcadoEm >= 0 && agora - marcadoEm <= JANELA_MS;
}

/** O caixa abriu (`true`) ou fechou (`false`). Fechar à mão nunca deixa pedido de reabrir. */
export function marcarCaixaAberto(aberto: boolean): void {
  try {
    if (aberto) sessionStorage.setItem(CAIXA_ABERTO, "1");
    else {
      sessionStorage.removeItem(CAIXA_ABERTO);
      sessionStorage.removeItem(REABRIR_CAIXA);
    }
  } catch {
    // Sem sessionStorage: segue como antes (não reabre).
  }
}

/** A oferta pergunta ao montar: a recarga de agora fechou o caixa? Consome o pedido (uma vez só). */
export function consumirReabrirCaixa(): boolean {
  try {
    const v = sessionStorage.getItem(REABRIR_CAIXA);
    sessionStorage.removeItem(REABRIR_CAIXA);
    sessionStorage.removeItem(CAIXA_ABERTO);
    return deveReabrirCaixa(Date.now(), v ? Number(v) : null);
  } catch {
    return false;
  }
}
