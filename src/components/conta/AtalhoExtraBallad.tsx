import { useEffect, useState } from "react";
import { Music } from "lucide-react";
import { precoUsdTexto } from "@/lib/creditos";
import { FolhaStripeVideo } from "@/components/presente/FolhaStripeVideo";
import { NaMoeda } from "@/components/quiz/PrecoDaOferta";
import { trackEvent, trackEventOnce } from "@/lib/track";
import { guardarCreditoNoNavegador } from "@/lib/credito-no-navegador";
import { meusCreditos } from "@/lib/meus-creditos";
import { novaSessao } from "@/lib/session-context";
import { useQuizStore } from "@/lib/quiz-store";
import { emDolarExplicito } from "@/lib/i18n";
import { EXP_EXTRA_BALLAD, TEXTO_EXTRA_BALLAD, bracoExtraBallad } from "@/lib/extra-ballad";

// O ATALHO DA SEGUNDA MÚSICA NA BALLAD (teste `extra_ballad`, 28/10).
//
// O irmão do `AtalhoOutraMusica` da Serenata, pago pelo Stripe em vez do PIX
// (a mesma folha do vídeo, `FolhaStripeVideo`, com `oferta="extra"`). A regra
// e o porquê moram em `extra-ballad.ts`.
//
// O braço sai do `token_edicao`, então o servidor e o navegador desenham a
// mesma coisa (sem a espera do `useBraco`). A exposição é medida nos DOIS
// braços, uma vez por presente e lugar: é o denominador da leitura.

export function AtalhoExtraBallad({
  locale,
  tokenEdicao,
  origem,
}: {
  locale: "en" | "es";
  /** Do presente que ela ACABOU de comprar: a credencial da cobrança. */
  tokenEdicao: string;
  origem: "obrigado" | "editor";
}) {
  const braco = bracoExtraBallad(tokenEdicao);
  const [aberto, setAberto] = useState(false);
  const [saldo, setSaldo] = useState(0);
  const [saindo, setSaindo] = useState(false);

  useEffect(() => {
    void trackEventOnce("extra_ballad_exposto", `${tokenEdicao}:${origem}`, {
      [`exp_${EXP_EXTRA_BALLAD}`]: braco,
      origem,
      locale,
    });
    if (braco !== "B") return;
    let vivo = true;
    // Quem já tem crédito (comprou e não usou) não vê cobrança: segue pro quiz.
    meusCreditos({ data: { tokenEdicao } })
      .then((c) => {
        if (vivo) setSaldo(c.saldo ?? 0);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenEdicao, origem, braco]);

  const usd = precoUsdTexto("extra");
  if (braco !== "B" || !usd) return null;
  const t = TEXTO_EXTRA_BALLAD[locale];
  // "US$" explícito no espanhol, como a oferta da música (`emDolarExplicito`).
  const preco = locale === "es" ? emDolarExplicito(usd) : usd;

  // Pra o quiz: o crachá (prova de posse do crédito), uma sessão NOVA (senão a
  // segunda música sobrescreve a primeira no mesmo navegador) e o e-mail de
  // antes, pra ela não digitar de novo.
  async function irProQuiz(evento: string) {
    if (saindo) return;
    setSaindo(true);
    const ev = trackEvent(evento, { [`exp_${EXP_EXTRA_BALLAD}`]: braco, origem, locale });
    guardarCreditoNoNavegador(tokenEdicao);
    const email = useQuizStore.getState().email ?? null;
    novaSessao();
    const store = useQuizStore.getState();
    store.reset();
    if (email) store.setEmail(email);
    await Promise.race([ev, new Promise((r) => setTimeout(r, 1500))]);
    window.location.href = locale === "es" ? "/es/criar" : "/criar";
  }

  return (
    <>
      <div className="mt-6 text-center">
        <button
          type="button"
          disabled={saindo}
          onClick={() => {
            if (saldo > 0) return void irProQuiz("extra_ballad_com_credito");
            trackEvent("extra_ballad_click", { [`exp_${EXP_EXTRA_BALLAD}`]: braco, origem, locale });
            setAberto(true);
          }}
          className="mx-auto flex min-h-12 w-full max-w-[320px] items-center justify-center gap-2 rounded-full border border-[var(--acento)]/40 px-5 py-3 font-medium text-[var(--acento)] disabled:opacity-50"
          style={{ fontSize: "var(--t-sm)" }}
        >
          <Music className="h-4 w-4 shrink-0" />
          <span>
            {t.pergunta}{" "}
            {saldo > 0 ? t.jaTem(saldo) : <NaMoeda texto={preco} como={t.rotulo} />}
          </span>
        </button>
        {saldo === 0 && (
          <p
            className="mx-auto mt-2 max-w-[300px] text-[var(--tinta-suave)]"
            style={{ fontSize: "var(--t-xs)", lineHeight: 1.5 }}
          >
            <NaMoeda texto={t.cheio} como={t.fino} />
          </p>
        )}
      </div>

      {aberto && (
        <FolhaStripeVideo
          oferta="extra"
          locale={locale}
          tokenEdicao={tokenEdicao}
          precoTexto={preco}
          aoPagar={() => {
            setAberto(false);
            void irProQuiz("extra_ballad_pago");
          }}
          aoFechar={() => setAberto(false)}
        />
      )}
    </>
  );
}
