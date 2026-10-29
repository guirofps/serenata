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
