import { useEffect, useState } from "react";
import { Clock, Music } from "lucide-react";
import { OFERTAS, PRECO_CHEIO, TEXTO_OFERTA } from "@/lib/creditos";
import { FolhaPixUpsell } from "@/components/conta/FolhaPixUpsell";
import { trackEvent, trackEventOnce } from "@/lib/track";
import { guardarCreditoNoNavegador } from "@/lib/credito-no-navegador";
import { novaSessao } from "@/lib/session-context";
import { useQuizStore } from "@/lib/quiz-store";
import { useBraco, useContextoPosCompra } from "@/lib/use-pos-compra";
import {
  EXP_OUTRA_MUSICA_24H,
  horasDesdeCompra,
  msRestantesOutraMusica,
  textoRestanteOutraMusica,
} from "@/lib/janela-outra-musica";

// TESTE `outra_musica_24h` (08/10). A = como era (nada aqui). B = o cartão
// "Faça outra pra mais alguém", por 24h a partir do pagamento da música.
//
// ── O QUE ELE VENDE E POR ONDE ───────────────────────────────────
//
// O pacote "extra" do catálogo (`creditos.ts`), pelo MESMO caminho do atalho
// "Quem é a próxima?" (`AtalhoOutraMusica`): `FolhaPixUpsell` com o
// `token_edicao`, PIX ou cartão pelo Asaas. Preço do catálogo, cobrado pelo
// servidor; nada aqui decide valor.
//
// ── DEPOIS DE PAGAR: MÚSICA NOVA É SESSÃO NOVA ───────────────────
//
// O crachá do crédito (`guardarCreditoNoNavegador`) e, ANTES de ir pro
// `/criar`, sessão nova e quiz zerado. Sem isso a segunda música cairia na
// linha da primeira em `quiz_responses` e sobrescreveria um presente já pago
// (CLAUDE.md, 04/10). O único dado que atravessa é o e-mail de quem pagou, pra
// pessoa não digitar de novo. O cupom da store sobrevive ao `reset()` por
// desenho (`quiz-store.ts`), igual ao resto do funil.
//
// ── O PRAZO ──────────────────────────────────────────────────────
//
// É de VISIBILIDADE, não de preço: ver `janela-outra-musica.ts`. A frase diz
// que o convite fica aqui por mais tanto tempo, e é exatamente o que acontece.

export function CartaoOutraMusica24h({
  tokenEdicao,
  tokenPublico,
  origem,
  emailConhecido,
  className = "",
}: {
  /** Da música que ela acabou de comprar: credencial da cobrança e do contexto. */
  tokenEdicao: string;
  /** Só pra ligar o evento à música na leitura (o GA4 descarta chave com "token"). */
  tokenPublico?: string | null;
  origem: "obrigado" | "editor";
  /** Reserva pro e-mail da música nova, quando o servidor não devolver. */
  emailConhecido?: string | null;
  className?: string;
}) {
  const braco = useBraco(EXP_OUTRA_MUSICA_24H);
  const emB = braco === "B";
  const ctx = useContextoPosCompra(tokenEdicao, emB);
  const [agora, setAgora] = useState(() => Date.now());
  const [aberto, setAberto] = useState(false);
  const [saindo, setSaindo] = useState(false);
  const oferta = OFERTAS.find((o) => o.id === "extra");

  // EXPOSIÇÃO, nos DOIS braços: é o denominador da leitura. No A nada aparece,
  // mas a pessoa estava no lugar onde o cartão estaria. A janela de 24h é
  // conferida na leitura (evento contra `pedidos.paid_at`), não aqui: no A
  // não se faz consulta nenhuma a mais.
  useEffect(() => {
    if (!braco) return;
    void trackEventOnce("outra_musica_24h_exposto", `${origem}:${tokenEdicao}`, {
      exp_outra_musica_24h: braco,
      origem,
      token_publico: tokenPublico ?? null,
    });
  }, [braco, origem, tokenEdicao, tokenPublico]);

  // O relógio do prazo. Minuto é a menor unidade mostrada; 30s basta.
  useEffect(() => {
    if (!emB) return;
    const id = setInterval(() => setAgora(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [emB]);

  const restante = emB && ctx ? msRestantesOutraMusica(ctx.pagoEm, agora) : null;
  const visivel = restante !== null && Boolean(oferta);

  useEffect(() => {
    if (!visivel || !ctx) return;
    void trackEventOnce("outra_musica_24h_visto", `${origem}:${tokenEdicao}`, {
      exp_outra_musica_24h: "B",
      origem,
      token_publico: tokenPublico ?? null,
      horas_desde_compra: horasDesdeCompra(ctx.pagoEm, Date.now()),
    });
  }, [visivel, ctx, origem, tokenEdicao, tokenPublico]);

  // Com a folha aberta o cartão NÃO some, mesmo que o prazo vença no meio do
  // pagamento: desmontar aqui levaria o PIX junto, com o dinheiro a caminho.
  if (!oferta || !emB || !ctx || (!visivel && !aberto)) return null;

  const preco = (v: number) => `R$ ${v.toFixed(2).replace(".00", "").replace(".", ",")}`;
  const t = TEXTO_OFERTA.pt.extra;

  async function depoisDePagar() {
    if (saindo) return;
    setSaindo(true);
    // O evento sai ANTES da sessão nova: ele é da sessão que comprou.
    const evento = trackEvent("outra_musica_24h_pago", {
      exp_outra_musica_24h: "B",
      origem,
      token_publico: tokenPublico ?? null,
      horas_desde_compra: horasDesdeCompra(ctx?.pagoEm, Date.now()),
    });
    guardarCreditoNoNavegador(tokenEdicao);
    const email = ctx?.email ?? emailConhecido ?? useQuizStore.getState().email ?? null;
    novaSessao();
    const store = useQuizStore.getState();
    store.reset();
    if (email) store.setEmail(email);
    // Dá ao insert do evento até 1,5s antes de trocar de página.
    await Promise.race([evento, new Promise((r) => setTimeout(r, 1500))]);
    window.location.href = "/criar";
  }

  return (
    <section
      className={`rounded-3xl border border-[var(--acento)]/30 bg-[var(--papel-fundo)] p-6 text-center ${className}`}
    >
      <div className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-[var(--acento)]/10 text-[var(--acento)]">
        <Music className="h-5 w-5" />
      </div>
      <h2 className="mt-3 font-medium" style={{ fontSize: "var(--t-lg)", lineHeight: 1.3 }}>
        Faça outra pra mais alguém
      </h2>
      <p
        className="mx-auto mt-2 max-w-sm text-[var(--tinta-suave)]"
        style={{ fontSize: "var(--t-sm)", lineHeight: 1.55 }}
      >
        Uma música nova e completa, com página, link e MP3, pra outra pessoa que você ama. Você
        conta a história e a gente faz tudo de novo, do zero.
      </p>
      <p className="mt-4 flex items-baseline justify-center gap-2">
        <span className="text-[var(--tinta-suave)] line-through" style={{ fontSize: "var(--t-sm)" }}>
          {preco(PRECO_CHEIO)}
        </span>
        <span className="font-semibold text-[var(--acento)]" style={{ fontSize: "var(--t-xl)" }}>
          {preco(oferta.precoBrl)}
        </span>
      </p>
      <button
        type="button"
        disabled={saindo}
        onClick={() => {
          trackEvent("outra_musica_24h_click", {
            exp_outra_musica_24h: "B",
            origem,
            token_publico: tokenPublico ?? null,
            horas_desde_compra: horasDesdeCompra(ctx.pagoEm, Date.now()),
          });
          setAberto(true);
        }}
        className="cta mx-auto mt-4 flex h-12 w-full max-w-[300px] items-center justify-center gap-2 rounded-full px-6 font-medium disabled:opacity-60"
        style={{ fontSize: "var(--t-sm)" }}
      >
        Fazer outra música
      </button>
      {restante !== null && (
        <p
          className="mt-3 inline-flex items-center justify-center gap-1.5 text-[var(--tinta-suave)]"
          style={{ fontSize: "var(--t-xs)" }}
        >
          <Clock className="h-3.5 w-3.5" />
          Este convite fica aqui por mais {textoRestanteOutraMusica(restante)}.
        </p>
      )}

      {aberto && (
        <FolhaPixUpsell
          ofertaId={oferta.id}
          titulo={t.titulo}
          precoTexto={preco(oferta.precoBrl)}
          tokenEdicao={tokenEdicao}
          aoPagar={() => void depoisDePagar()}
          aoFechar={() => setAberto(false)}
        />
      )}
    </section>
  );
}
