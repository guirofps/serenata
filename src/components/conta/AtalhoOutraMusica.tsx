import { useEffect, useState } from "react";
import { Music } from "lucide-react";
import { OFERTAS, TEXTO_OFERTA } from "@/lib/creditos";
import { FolhaPixUpsell } from "@/components/conta/FolhaPixUpsell";
import { trackEvent } from "@/lib/track";
import { guardarCreditoNoNavegador } from "@/lib/credito-no-navegador";

// O ATALHO PRA SEGUNDA MÚSICA, MAIS BARATO E SEM REFAZER TUDO.
//
// ── O QUE ISTO CONSERTA ──────────────────────────────────────────
//
// Medido em 02/09, agosto inteiro: 101 compradores compraram 2 ou mais vezes,
// e 32 dessas recompras foram a PREÇO CHEIO. Somam R$ 1.317,40; pelo pacote
// de R$ 28 teriam custado R$ 896.
//
// Não é acaso: o `ConviteOutraMusica` (logo ao lado) manda pro `/criar`, que
// é o funil inteiro a R$ 38. Era a única porta que existia. Um comprador
// pagou CINCO PIX de R$ 55 antes de descobrir o pacote.
//
// E o pacote converte melhor que tudo nesta operação: 18 PIX gerados, 14
// pagos, 77,8%. Contra 57,1% do PIX da própria música. O problema nunca foi o
// produto, foi que ele só aparecia no `/dashboard` e no e-mail de dia 5 a 30,
// e 84% dos compradores nunca entram na conta.
//
// ── POR QUE ELE NÃO SUBSTITUI O CONVITE, E FICA AO LADO ──────────
//
// São duas intenções diferentes e o preço reflete isso:
//
//   quem NÃO decidiu  → funil pelo `/criar`: lê a letra de graça, decide
//                       depois, paga R$ 38 se quiser ouvir cantada.
//   quem JÁ decidiu   → este atalho: R$ 28, entra direto com o crédito.
//
// Trocar um pelo outro seria escolher pelo cliente. Mostrar os dois é mais
// honesto e cobre as duas cabeças.
//
// Consequência aceita, e ela é real: quem pagaria R$ 38 agora paga R$ 28. A
// aposta é que quem HOJE não recompra por não saber que dá é grupo maior que
// esse. Com 101 recompradores existindo quase sem oferta nenhuma, é aposta
// com lastro, mas continua sendo aposta.
//
// ── SEM LOGIN ────────────────────────────────────────────────────
//
// O PIX nasce pelo `token_edicao`, que é o mesmo link do e-mail de entrega.
// Exigir conta aqui seria repetir o erro que já enterrou este pacote: 84% dos
// compradores não têm login e não vão criar um pra comprar de novo.
//
// ── E EM ESPANHOL, NÃO ───────────────────────────────────────────
//
// A Woovi só faz PIX brasileiro. Lá o link vai pro checkout hospedado, que é
// a mesma regra que `BlocoCreditos` e `BlocoQuadro` já seguem.

export function AtalhoOutraMusica({
  locale,
  tokenEdicao,
  origem,
}: {
  locale: "pt" | "es";
  /** Do presente que ela ACABOU de comprar. É a credencial da cobrança. */
  tokenEdicao: string;
  origem: "obrigado" | "editor";
}) {
  const [aberto, setAberto] = useState(false);
  const es = locale === "es";
  const oferta = OFERTAS.find((o) => o.id === "extra");

  // QUEM VEIO DO E-MAIL JÁ CLICOU, ENTÃO A FOLHA ABRE SOZINHA.
  //
  // O link do e-mail diz "quero mais uma música" e cai em `#outra-musica`.
  // Fazer a pessoa clicar de novo no mesmo pedido é onde funil vaza, e aqui
  // não tem risco de cobrar sem querer: a folha só MOSTRA o PIX, o pagamento
  // continua sendo um ato dela no aplicativo do banco.
  //
  // Só em pt: no ES o link do e-mail já vai direto pro checkout hospedado.
  useEffect(() => {
    if (es || origem !== "editor") return;
    if (window.location.hash === "#outra-musica") {
      trackEvent("atalho_extra_click", { origem, locale, via: "email" });
      setAberto(true);
    }
  }, [es, origem, locale]);

  if (!oferta) return null;

  const t = (TEXTO_OFERTA[locale] ?? TEXTO_OFERTA.pt).extra;
  // Sem os centavos zerados: "R$ 28" cabe numa linha a mais no celular, que é
  // onde 99% lê isto, e "R$ 28,00" não diz nada que "R$ 28" não diga.
  const preco = `R$ ${oferta.precoBrl.toFixed(2).replace(".00", "").replace(".", ",")}`;
  // O preço sai em REAL nos dois idiomas, e não é descuido: os três upsells
  // são cobrados em real pela Perfect Pay, e é isso que o painel já mostra.
  // Escrever "US$ 6" aqui seria prometer uma moeda que a fatura não usa.
  const rotulo = es ? `¿Quién es la próxima? Por ${preco}` : `Quem é a próxima? Por ${preco}`;

  // ── POR QUE `inline` E NÃO `inline-flex` ─────────────────────
  //
  // Com flex, o ícone vira uma coluna do lado do texto: quando a frase quebra
  // em duas linhas no celular, ele fica flutuando sozinho à esquerda e a
  // segunda linha centraliza sob ele. Foi o que apareceu na primeira versão
  // desta linha, em 375px de largura.
  //
  // Como `inline`, o ícone é só mais um caractere: a frase quebra como texto
  // normal e as duas linhas centralizam juntas. O alvo de toque de 44px vem
  // do `py-3` com o `-my-3` devolvendo o espaço, então o dedo ganha área sem
  // nada se mexer de lugar.
  const classe =
    "-my-3 inline-block max-w-[17rem] py-3 text-[var(--tinta-suave)] underline underline-offset-4 hover:text-[var(--acento)]";
  const icone = <Music className="mr-1.5 inline h-4 w-4 align-[-3px]" />;

  return (
    <>
      <div className="mt-6 text-center">
        {es ? (
          <a
            href={oferta.checkout}
            onClick={() => trackEvent("atalho_extra_click", { origem, locale, via: "checkout" })}
            className={classe}
            style={{ fontSize: "var(--t-sm)" }}
          >
            {icone}
            {rotulo}
          </a>
        ) : (
          <button
            type="button"
            onClick={() => {
              trackEvent("atalho_extra_click", { origem, locale, via: "pix" });
              setAberto(true);
            }}
            className={classe}
            style={{ fontSize: "var(--t-sm)" }}
          >
            {icone}
            {rotulo}
          </button>
        )}
      </div>

      {aberto && (
        <FolhaPixUpsell
          ofertaId={oferta.id}
          titulo={t.titulo}
          precoTexto={preco}
          checkoutCartao={oferta.checkout}
          tokenEdicao={tokenEdicao}
          aoPagar={() => {
            trackEvent("atalho_extra_pago", { origem, locale });
            // O CRACHÁ, e ele não é opcional. O crédito vai pro razão pelo
            // e-mail, mas o resgate acontece no fim do PRÓXIMO quiz, numa
            // sessão anônima que não sabe quem é essa pessoa. Sem guardar a
            // prova de posse aqui, ela paga R$ 28 e a tela seguinte cobra
            // R$ 38 — que é exatamente o defeito do quadro, repetido.
            guardarCreditoNoNavegador(tokenEdicao);
            window.location.href = locale === "es" ? "/es/criar" : "/criar";
          }}
          aoFechar={() => setAberto(false)}
        />
      )}
    </>
  );
}
