import { useEffect } from "react";
import { trackEventOnce } from "@/lib/track";

// PROFUNDIDADE DE ROLAGEM da home.
//
// A maior perda do funil é o topo: 236 de 297 visitantes vão embora sem
// entrar no quiz (medido em 02 e 03/08). Só que não dá pra saber se eles
// SAEM SEM ROLAR ou se rolam a página inteira e mesmo assim não clicam. São
// dois problemas opostos: um pede o argumento mais acima, o outro pede
// argumento melhor.
//
// Sem este evento a pergunta fica sem resposta, e ela existe desde o começo.
//
// Marcos e não porcentagem contínua: quatro eventos por sessão no máximo, com
// dedupe por sessão. O `funnel_events` já leva 1.000+ linhas por dia e não
// vale poluir a tabela pra ganhar granularidade que ninguém vai olhar.

const MARCOS = [25, 50, 75, 100] as const;

export function useProfundidadeRolagem(pagina: string) {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const disparados = new Set<number>();

    function medir() {
      const doc = document.documentElement;
      const rolavel = doc.scrollHeight - window.innerHeight;
      // Página que cabe na tela não tem o que medir: marcar 100% aqui diria
      // "leu tudo" pra quem nem rolou.
      if (rolavel < 200) return;

      const pct = ((window.scrollY + window.innerHeight) / doc.scrollHeight) * 100;
      for (const m of MARCOS) {
        if (pct >= m && !disparados.has(m)) {
          disparados.add(m);
          trackEventOnce("scroll_profundidade", `${pagina}:${m}`, { pagina, marco: m });
        }
      }
    }

    // Throttle por RELÓGIO, não por requestAnimationFrame.
    //
    // rAF é congelado por qualquer navegador que não esteja compondo frames
    // (aba em segundo plano, navegador headless). É a mesma armadilha que já
    // mordeu os efeitos da página-presente: com rAF, a medição simplesmente
    // não roda e o dado nunca aparece — sem erro nenhum, o que é pior.
    let ultima = 0;
    function aoRolar() {
      const agora = Date.now();
      if (agora - ultima < 150) return;
      ultima = agora;
      medir();
    }

    medir(); // quem entra já no meio da página (link com âncora)
    // `passive` porque o listener nunca chama preventDefault: sem isso o
    // navegador espera o handler antes de rolar, e a rolagem trava no dedo.
    window.addEventListener("scroll", aoRolar, { passive: true });
    window.addEventListener("resize", aoRolar, { passive: true });
    return () => {
      window.removeEventListener("scroll", aoRolar);
      window.removeEventListener("resize", aoRolar);
    };
  }, [pagina]);
}
