import { linkSuporte } from "@/lib/suporte-whatsapp";
import { trackEvent } from "@/lib/track";

// O WHATSAPP FLUTUANTE, e ONDE ele pode existir.
//
// ── A REGRA CONTINUA VALENDO, O ALCANCE DELA É QUE MUDOU ─────────
//
// "Número visível antes do pagamento é uma saída do funil" segue verdade: a
// pessoa sai da tela de pagamento pra tirar uma dúvida e a conversa vira
// negociação, desconto ou nada. Por isso este componente NÃO entra em `/criar`
// nem em nenhuma tela do quiz, e quem colocar lá está errado.
//
// O que mudou é que o funil não passa pela home: as campanhas mandam direto
// pro `/criar`. Então a home não é "antes do pagamento" no caminho de
// ninguém; ela é onde vai parar quem já comprou e digitou serenatagift.com no
// navegador procurando socorro, que é exatamente a pessoa que hoje some.
//
// ── POR QUE ISSO É URGENTE ───────────────────────────────────────
//
// Medido em 18/08: 248 dos 294 compradores NUNCA entraram na conta. Eles
// vivem do e-mail de entrega. Quem digitou o e-mail errado, ou não achou o
// e-mail, não tem canal nenhum: não consegue logar (o login é por e-mail) e
// não sabe pra onde escrever. Essa pessoa pagou e não recebeu.

export function ZapFlutuante({ locale = "pt" }: { locale?: "pt" | "es" }) {
  const zap = linkSuporte({ locale, motivo: "receber" });
  if (!zap) return null;

  const rotulo =
    locale === "es" ? "Ya compré y no encuentro mi canción" : "Já comprei e não achei minha música";

  return (
    <a
      href={zap}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => trackEvent("suporte_zap_click", { origem: "home" })}
      aria-label={rotulo}
      title={rotulo}
      // FIXO NO CANTO, mas discreto: quem está lendo a página não é o
      // destinatário. O tamanho é o mínimo de toque (48px), não o máximo de
      // atenção.
      // ACIMA DA BARRA DE CTA, não em cima dela. A home tem uma barra
      // flutuante de "criar minha música" colada no rodapé, e as duas no
      // mesmo lugar viram um amontoado onde a pessoa aperta a errada. A de
      // vender continua sendo a maior e a mais embaixo.
      className="fixed bottom-24 right-4 z-40 inline-flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition-transform hover:scale-105"
      style={{ background: "#25D366" }}
    >
      {/* O ícone do WhatsApp em SVG: nenhuma requisição, e ele é reconhecido
          por essa gente mais rápido que qualquer palavra que a gente escreva. */}
      <svg viewBox="0 0 24 24" width="26" height="26" fill="#fff" aria-hidden>
        <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.64-2.05-.17-.3-.02-.46.13-.6.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.06 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.69.25-1.28.17-1.41-.07-.13-.27-.2-.57-.35z" />
        <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.87 9.87 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2zm5.77 15.68c-.24.68-1.43 1.31-1.96 1.39-.5.07-1.14.11-1.83-.11-.42-.13-.97-.31-1.67-.61-2.94-1.27-4.86-4.23-5.01-4.43-.15-.2-1.2-1.6-1.2-3.06 0-1.45.76-2.17 1.03-2.46.27-.3.6-.37.8-.37h.57c.18 0 .43-.07.67.51.25.6.84 2.05.91 2.2.08.15.13.32.03.52-.1.2-.15.32-.3.5-.15.17-.31.38-.45.51-.15.14-.3.3-.13.6.17.3.76 1.27 1.64 2.05 1.13 1.01 2.08 1.32 2.38 1.47.3.14.47.12.64-.08.17-.2.74-.86.94-1.16.2-.3.4-.25.67-.15.27.1 1.72.81 2.02.96.3.15.5.22.57.35.08.13.08.72-.17 1.41z" />
      </svg>
    </a>
  );
}
