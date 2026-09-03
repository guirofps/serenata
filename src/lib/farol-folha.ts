import { useEffect, useRef } from "react";
import { getOrCreateSessionId, getStoredAttribution, getDevice } from "@/lib/session-context";

// O FAROL DA FOLHA DE PAGAMENTO.
//
// ── POR QUE ISTO EXISTE ──────────────────────────────────────────
//
// Entre "abriu a folha" e "gerou o código" some quase metade das pessoas, e
// até 03/09 a gente não registrava NADA nesse intervalo. Sem dado, sobrou
// palpite: em 02/09 eu li "488 sumiram sem tocar em nada", concluí que o
// botão de pagar nascia fora da tela, virei ele em barra fixa — e a taxa não
// mexeu (44,7% -> 41,2%, z = -1,08, dentro do ruído).
//
// A hipótese pode até estar certa em parte, mas ela foi testada CEGA: eu
// mudei a tela e fui olhar o agregado, que é a medição mais fraca possível.
// Este arquivo troca o palpite por observação, pra a próxima mudança na folha
// sair de um número e não de uma intuição minha.
//
// ── A PERGUNTA QUE ELE RESPONDE ──────────────────────────────────
//
// Quem abandona a folha se divide em dois grupos com remédios OPOSTOS:
//
//   - saiu em segundos, sem tocar em nada   -> susto de preço, ou clique sem
//     intenção. Mexer no botão não resolve; mexer em preço/oferta resolve.
//   - ficou, rolou, mexeu, e mesmo assim não gerou -> travou em alguma coisa
//     nossa. Aí sim é tela.
//
// O agregado de hoje não separa os dois, e por isso qualquer conserto é tiro
// no escuro.
//
// ── POR QUE `sendBeacon` E NÃO O `trackEvent` NORMAL ─────────────
//
// O evento mais importante nasce na hora em que a pessoa VAI EMBORA, e é
// exatamente aí que um fetch comum morre: no celular, fechar a aba ou trocar
// de aplicativo mata a requisição em voo, e o dado que faltava continua
// faltando. `sendBeacon` entrega a carga ao sistema operacional, que envia
// depois de a página já ter morrido.
//
// O preço disso é que beacon NÃO manda cabeçalho, e o PostgREST quer a
// `apikey`. Ela vai na query string, que o Supabase aceita (testado: 201).
// Não é vazamento: a chave anônima já está no bundle público, é o mesmo
// segredo que o `supabase-client` carrega há meses. RLS é quem protege a
// tabela, não a obscuridade da chave.
const URL_SB = (import.meta.env?.VITE_SUPABASE_URL ?? "") as string;
const CHAVE_SB = (import.meta.env?.VITE_SUPABASE_ANON_KEY ?? "") as string;

function mandarPorBaliza(nome: string, dados: Record<string, unknown>): void {
  if (typeof window === "undefined" || !URL_SB || !CHAVE_SB) return;
  const corpo = JSON.stringify({
    session_id: getOrCreateSessionId(),
    event_name: nome,
    event_data: { ...dados, device: getDevice(), attribution: getStoredAttribution(), path: window.location.pathname },
  });
  const alvo = `${URL_SB}/rest/v1/funnel_events?apikey=${encodeURIComponent(CHAVE_SB)}`;
  try {
    // O tipo importa: sem `application/json` o PostgREST devolve 415 e o
    // beacon falha em silêncio, que é o pior dos mundos (parece instrumentado
    // e não está).
    const pacote = new Blob([corpo], { type: "application/json" });
    if (navigator.sendBeacon?.(alvo, pacote)) return;
  } catch {
    // segue pro fetch abaixo
  }
  // Plano B pra navegador sem beacon. `keepalive` faz o mesmo papel, com
  // limite de 64KB que a nossa carga nem chega perto.
  void fetch(alvo, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: corpo,
    keepalive: true,
  }).catch(() => {});
}

/** O que a pessoa fez enquanto esteve na folha. */
export type Farol = {
  /** Ela abriu o campo de e-mail. */
  email: () => void;
  /** Ela tocou na caixinha do quadro. */
  bump: () => void;
  /** Ela apertou "Gerar meu PIX" com e-mail válido: acabou o abandono. */
  gerou: () => void;
  /** O botão de pagar entrou na tela alguma vez (valida a barra fixa). */
  refDoBotao: (el: HTMLElement | null) => void;
};

export function useFarolDaFolha(): Farol {
  const nasceuEm = useRef(Date.now());
  const rolou = useRef(false);
  const email = useRef(false);
  const bump = useRef(false);
  const gerou = useRef(false);
  const viuOBotao = useRef(false);
  // Trava de disparo único. Sem ela, `visibilitychange` seguido do unmount
  // manda o mesmo abandono duas vezes e dobra o número no relatório.
  const jaContou = useRef(false);

  const observador = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const marcarRolagem = () => {
      rolou.current = true;
    };
    // `capture: true` porque a folha rola num container interno, não na
    // janela: sem capturar, o evento nunca sobe até aqui e "rolou" daria
    // falso pra todo mundo — um dado errado é pior que dado nenhum.
    document.addEventListener("scroll", marcarRolagem, { capture: true, passive: true });

    const contar = (saiuPor: string) => {
      if (jaContou.current || gerou.current) return;
      jaContou.current = true;
      mandarPorBaliza("pix_folha_abandonou", {
        segundos: Math.round((Date.now() - nasceuEm.current) / 1000),
        rolou: rolou.current,
        mexeuNoEmail: email.current,
        tocouNoBump: bump.current,
        viuOBotao: viuOBotao.current,
        // A altura é o que liga (ou desliga) a teoria do botão escondido: se
        // o abandono se concentrar nas telas baixas, ela volta a ter pé.
        alturaTela: window.innerHeight,
        saiuPor,
      });
    };

    // No celular o unmount muitas vezes NUNCA acontece: a pessoa troca de
    // aplicativo ou fecha a aba e o React não roda cleanup nenhum. Este é o
    // gancho que pega a maioria dos casos reais.
    const aoEsconder = () => {
      if (document.visibilityState === "hidden") contar("escondeu");
    };
    document.addEventListener("visibilitychange", aoEsconder);

    return () => {
      document.removeEventListener("scroll", marcarRolagem, { capture: true });
      document.removeEventListener("visibilitychange", aoEsconder);
      observador.current?.disconnect();
      contar("fechou");
    };
  }, []);

  return {
    email: () => {
      email.current = true;
    },
    bump: () => {
      bump.current = true;
    },
    gerou: () => {
      gerou.current = true;
    },
    refDoBotao: (el) => {
      observador.current?.disconnect();
      if (!el || typeof IntersectionObserver === "undefined") return;
      const o = new IntersectionObserver(
        (entradas) => {
          for (const e of entradas) if (e.isIntersecting) viuOBotao.current = true;
        },
        { threshold: 0.6 },
      );
      o.observe(el);
      observador.current = o;
    },
  };
}
