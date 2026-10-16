import { useEffect, useRef } from "react";

// O QUE TODA FOLHA DE PAGAMENTO FAZ, NAS DUAS MARCAS (16/10).
//
// Nasceu no caixa do Stripe da Ballad em 08/10 e ficou só lá: a folha do PIX
// da Serenata (~87% das vendas) continuava com o voltar do Android saindo da
// oferta (o QR sumia e a espera do pagamento parava) e com o vídeo de reações
// tocando em loop por trás.

// O VOLTAR DO CELULAR FECHA A FOLHA, e só ela (08/10).
//
// Sem isto, o voltar com o pagamento aberto andava no histórico do quiz (cada
// passo é uma URL): a folha sumia e a pessoa caía na pergunta anterior, depois
// na outra, um toque por passo. Medido em 03-07/10: 3 das 17 sessões que
// abriram o checkout fizeram exatamente isso, e nenhuma voltou a pagar.
//
// A folha empurra uma entrada no histórico com a MESMA URL (e o mesmo estado
// do roteador, pra ele não achar que mudou de página). O voltar consome essa
// entrada e fecha a folha. Fechou pelo X ou pelo fundo: a entrada sobra, e o
// `back()` da desmontagem a tira, senão o próximo voltar não faria nada.
//
// O `back()` sai num timeout que a montagem seguinte cancela: em dev o React
// monta, desmonta e remonta na hora, e um `back()` imediato voltava pra entrada
// de ANTES da folha (o alvo do `back()` é fixado na chamada), fechando a folha
// que acabou de abrir. Visto no localhost em 08/10.
let backPendente: ReturnType<typeof setTimeout> | null = null;
export function useVoltarFechaAFolha(fechar: () => void) {
  const fecharRef = useRef(fechar);
  fecharRef.current = fechar;
  useEffect(() => {
    if (backPendente) {
      // Remontou antes do `back()`: a entrada da folha ainda está lá, reusa.
      clearTimeout(backPendente);
      backPendente = null;
    } else {
      window.history.pushState({ ...window.history.state, folhaPagamento: true }, "", window.location.href);
    }
    let consumida = false;
    const aoVoltar = () => {
      if (window.history.state?.folhaPagamento) return;
      consumida = true;
      fecharRef.current();
    };
    window.addEventListener("popstate", aoVoltar);
    return () => {
      window.removeEventListener("popstate", aoVoltar);
      if (consumida) return;
      backPendente = setTimeout(() => {
        backPendente = null;
        if (window.history.state?.folhaPagamento) window.history.back();
      }, 0);
    };
  }, []);
}

/**
 * OS VÍDEOS DA OFERTA PARAM ENQUANTO A FOLHA ESTÁ ABERTA (08/10). O vídeo de
 * reações toca em loop atrás da folha; somado ao iframe do Stripe, é o
 * suspeito das 2 sessões que RECARREGARAM 6-7s depois de abrir o pagamento
 * (aba do Safari estourando memória). Ninguém assiste o vídeo por trás do
 * cartão. Voltam a tocar quando a folha fecha.
 */
export function usePausarVideosAtras() {
  useEffect(() => {
    const pausados = [...document.querySelectorAll("video")].filter((v) => !v.paused);
    for (const v of pausados) v.pause();
    return () => {
      for (const v of pausados) void v.play().catch(() => {});
    };
  }, []);
}
