import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { guardarCreditoNoNavegador } from "@/lib/credito-no-navegador";
import { trackEvent } from "@/lib/track";

// A PORTA DE ENTRADA DE QUEM TEM CRÉDITO E VEIO DO E-MAIL.
//
// ── POR QUE ELA EXISTE, E NÃO É UM `?credito=` NO /criar ─────────
//
// O crédito é resgatado no FIM do quiz seguinte, numa sessão anônima que não
// sabe quem é a pessoa. Quem amarra as duas pontas é o `token_edicao`, guardado
// no navegador (`credito-no-navegador.ts`).
//
// Quando ela compra o pacote na `/obrigado`, o crachá é guardado ali mesmo.
// Mas quem chega dias depois, pelo e-mail, num aparelho que talvez nem seja o
// mesmo, precisa que o token venha no LINK.
//
// E aí bate a regra que o CLAUDE.md trata como inegociável: token de cliente
// não entra em URL que terceiro lê. O `/criar` NÃO está em `rotas-sensiveis`,
// de propósito, porque é lá que a conversão do Google Ads dispara — então o
// gtag e a UTMify carregam e mandam a URL inteira, com token e tudo, pros
// servidores deles.
//
// Esta rota resolve as duas coisas: ela ESTÁ na lista de sensíveis, guarda o
// crachá e sai imediatamente pro `/criar`, que recebe a pessoa com a URL
// limpa. O token nunca chega perto de um script de terceiro.
//
// ── TROCA DE APARELHO ────────────────────────────────────────────
//
// Como o crachá é gravado no navegador que ABRE o link, o e-mail funciona no
// celular, no computador do trabalho e na casa da mãe. É a mesma propriedade
// do link do editor, e é o que faz o pós-compra desta operação funcionar sem
// login.

export const Route = createFileRoute("/credito/$tokenEdicao")({
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }] }),
  component: Pagina,
});

function Pagina() {
  const { tokenEdicao } = Route.useParams();

  useEffect(() => {
    guardarCreditoNoNavegador(tokenEdicao);
    trackEvent("credito_link_aberto", {});
    // `replace`, não `push`: o botão de voltar do celular não pode trazer a
    // pessoa de volta pra uma tela que só redireciona.
    //
    // E `location.replace` em vez do router: a troca de rota do TanStack
    // manteria o token no histórico do navegador, que é justamente o lugar de
    // onde a extensão de terceiro lê.
    const es = window.location.pathname.startsWith("/es/");
    window.location.replace(es ? "/es/criar" : "/criar");
  }, [tokenEdicao]);

  // Uma tela de meio segundo. Sem texto de marketing e sem botão: se algo der
  // errado no redirecionamento, o que a pessoa precisa é do caminho, não de
  // uma explicação.
  return (
    <div className="flex min-h-screen items-center justify-center px-6 text-center">
      <div>
        <p className="text-[var(--tinta-suave)]" style={{ fontSize: "var(--t-sm)" }}>
          Abrindo o seu crédito...
        </p>
        <a
          href="/criar"
          className="mt-3 inline-block text-[var(--acento)] underline underline-offset-4"
          style={{ fontSize: "var(--t-sm)" }}
        >
          Continuar
        </a>
      </div>
    </div>
  );
}
