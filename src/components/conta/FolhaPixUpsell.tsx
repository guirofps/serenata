import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  criarPixUpsell,
  criarPixUpsellPorToken,
  type ResultadoPixUpsell,
} from "@/lib/criar-pix-upsell";
import { supabase } from "@/lib/supabase-client";
import { PixPagamento } from "@/components/quiz/PixPagamento";
import { trackEvent } from "@/lib/track";
import { Button } from "@/components/ui/button";
import { cpfValido, formatarCpf, soDigitosCpf } from "@/lib/cpf";

// A FOLHA DE PIX DO PAINEL: crédito de música extra e quadro.
//
// Mesma tela do funil (`PixPagamento`), outra origem. O que muda aqui:
//
//   - quem paga está LOGADO, então o servidor sabe quem é sem perguntar;
//   - depois de pagar a pessoa NÃO vai pro `/obrigado`: ela já é cliente, e
//     o certo é ela ver o saldo novo no lugar onde clicou;
//   - o cartão continua saindo pro checkout da Perfect Pay, que é onde os
//     três produtos de upsell existem cadastrados.
//
// ── SÓ EM PORTUGUÊS ──────────────────────────────────────────────
//
// Quem comprou no funil espanhol pagou em dólar, e a Woovi só faz PIX
// brasileiro. Lá o upsell segue no checkout hospedado — quem decide isso é o
// componente que abre esta folha, não ela.

type Fase =
  /**
   * O PASSO DE RESUMO, que esta folha nao tinha.
   *
   * Ate 11/09/2026 a cobranca nascia no `useEffect` de montagem: abrir a
   * folha pra ver o preco ja criava PIX na conta do gateway. E o mesmo
   * defeito que a folha do funil tinha e que foi consertado em 27/08 ("em 28
   * minutos nasceram 11 cobrancas, quase todas de quem so foi ver quanto
   * custava").
   *
   * E e ele que da lugar pra pedir o CPF quando o gateway exige, sem o que
   * este caminho ficava indisponivel inteiro.
   */
  | { t: "resumo" }
  | { t: "criando" }
  | { t: "pronto"; dados: Extract<ResultadoPixUpsell, { ok: true }> }
  | { t: "erro" };

export function FolhaPixUpsell({
  ofertaId,
  titulo,
  precoTexto,
  checkoutCartao,
  tokenEdicao,
  aoPagar,
  aoFechar,
}: {
  ofertaId: string;
  /** Presente: quem chegou pelo link do editor, sem login. */
  tokenEdicao?: string;
  /** O que fazer depois de pagar. Por padrão, recarrega a tela. */
  aoPagar?: () => void;
  /** "Música extra", "Quadro para imprimir" — só pra pessoa se situar. */
  titulo: string;
  precoTexto: string;
  /** Link da Perfect Pay, pra quem preferir cartão. */
  checkoutCartao: string;
  aoFechar: () => void;
}) {
  const [fase, setFase] = useState<Fase>({ t: "resumo" });
  // Quando o servidor diz que o gateway exige CPF, o campo aparece. A tela
  // NAO sabe (nem deve saber) com qual gateway esta falando: com a Woovi o
  // campo nunca aparece, e nada aqui muda.
  const [precisaCpf, setPrecisaCpf] = useState(false);
  const [cpf, setCpf] = useState("");
  const [avisoCpf, setAvisoCpf] = useState<string | null>(null);
  const cpfOk = cpfValido(cpf);

  async function gerar() {
    setFase({ t: "criando" });
    setAvisoCpf(null);
    try {
      // ── DUAS PORTAS, PORQUE SAO DUAS TELAS DIFERENTES ────
      //
      // O painel exige login (Supabase Auth). O editor do presente e aberto
      // pelo TOKEN do link, e nao tem login nenhum — foi por la que saiu a
      // primeira venda de quadro depois da migracao, ainda pela Perfect Pay.
      //
      // Nenhuma das duas aceita e-mail vindo do navegador: o que prova quem
      // esta comprando e a sessao assinada ou a posse do token.
      const r = tokenEdicao
        ? await criarPixUpsellPorToken({ data: { tokenEdicao, ofertaId, cpf: cpf || undefined } })
        : await (async () => {
            const { data: sess } = await supabase.auth.getSession();
            const token = sess.session?.access_token;
            if (!token) return { ok: false, erro: "sem-sessao" } as const;
            return criarPixUpsell({ data: { token, ofertaId, cpf: cpf || undefined } });
          })();
      if (!r.ok) {
        // CPF nao e falha, e pedido de correcao: volta pro resumo com o
        // campo aberto em vez de mandar pra tela de erro.
        if (r.erro === "cpf-necessario" || r.erro === "cpf-invalido") {
          trackEvent("pix_upsell_cpf_pedido", { oferta: ofertaId, motivo: r.erro });
          setPrecisaCpf(true);
          setAvisoCpf(r.erro === "cpf-invalido" ? "Esse CPF nao confere. Confere os numeros?" : null);
          setFase({ t: "resumo" });
          return;
        }
        trackEvent("pix_upsell_falhou", { oferta: ofertaId, erro: r.erro });
        setFase({ t: "erro" });
        return;
      }
      trackEvent("pix_upsell_gerado", { oferta: ofertaId, reaproveitado: r.reaproveitado });
      setFase({ t: "pronto", dados: r });
    } catch (err) {
      console.error("[pix-upsell] falhou:", err);
      trackEvent("pix_upsell_falhou", { oferta: ofertaId, erro: "excecao" });
      setFase({ t: "erro" });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        aria-label="Fechar"
        onClick={() => {
          trackEvent("pix_upsell_fechou", { oferta: ofertaId });
          aoFechar();
        }}
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
      />
      <div className="relative max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-[var(--papel)] px-5 pb-8 pt-4 shadow-2xl sm:rounded-3xl">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[var(--tinta-fraca)]/40 sm:hidden" />
        <p className="mb-4 text-center text-sm text-[var(--tinta-fraca)]">{titulo}</p>

        {fase.t === "resumo" && (
          <div className="space-y-4 py-2">
            <p className="text-center font-display text-3xl font-semibold">{precoTexto}</p>

            {precisaCpf && (
              <div className="space-y-1.5 rounded-2xl border border-[var(--tinta-fraca)]/20 px-4 py-3 text-left">
                <p className="text-[11px] uppercase tracking-wide text-[var(--tinta-fraca)]">
                  Seu CPF
                </p>
                <input
                  inputMode="numeric"
                  autoComplete="off"
                  value={formatarCpf(cpf)}
                  onChange={(e) => setCpf(soDigitosCpf(e.target.value))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && cpfOk) void gerar();
                  }}
                  placeholder="000.000.000-00"
                  className="w-full rounded-xl border border-[var(--tinta-fraca)]/25 bg-[var(--papel)] px-3 py-2.5 text-base tabular-nums outline-none"
                  aria-label="CPF"
                  autoFocus
                />
                {avisoCpf && !cpf ? <p className="text-xs text-amber-700">{avisoCpf}</p> : null}
                {cpf.length === 11 && !cpfOk ? (
                  <p className="text-xs text-amber-700">Esse CPF nao confere. Confere os numeros?</p>
                ) : null}
                <p className="text-[11px] leading-snug text-[var(--tinta-fraca)]">
                  O banco pede pra emitir o PIX no seu nome.
                </p>
              </div>
            )}

            <Button
              size="lg"
              className="w-full"
              disabled={precisaCpf && !cpfOk}
              onClick={() => void gerar()}
            >
              Gerar o PIX
            </Button>
            <button
              type="button"
              onClick={() => {
                trackEvent("pix_upsell_cartao", { oferta: ofertaId });
                window.location.href = checkoutCartao;
              }}
              className="w-full text-xs text-[var(--tinta-fraca)] underline underline-offset-4"
            >
              Prefiro pagar com cartao
            </button>
          </div>
        )}

        {fase.t === "criando" && (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <Loader2 className="h-6 w-6 animate-spin text-[var(--acento)]" />
            <p className="text-sm text-[var(--tinta-fraca)]">Gerando o seu PIX...</p>
          </div>
        )}

        {fase.t === "erro" && (
          // Nunca deixa sem caminho: o checkout de sempre continua ali.
          <div className="space-y-3 py-4 text-center">
            <p className="text-sm font-semibold">Não consegui gerar o PIX agora</p>
            <p className="text-xs leading-snug text-[var(--tinta-fraca)]">
              Nada foi cobrado. Dá pra concluir pelo nosso checkout normal.
            </p>
            <Button
              size="lg"
              className="w-full"
              onClick={() => {
                window.location.href = checkoutCartao;
              }}
            >
              Continuar pelo checkout
            </Button>
          </div>
        )}

        {fase.t === "pronto" && (
          <PixPagamento
            copiaECola={fase.dados.copiaECola}
            valorTexto={precoTexto}
            referencia={fase.dados.referencia}
            // NÃO manda pro `/obrigado`: quem compra aqui já é cliente. O
            // certo é ver o saldo novo no lugar onde clicou, e o recarregar
            // é o jeito honesto de garantir que o painel inteiro (saldo,
            // extrato, quadros) venha do servidor já atualizado.
            aoPagar={() => {
              trackEvent("pix_upsell_pago", { oferta: ofertaId });
              // Recarregar é o padrão porque é o jeito honesto de garantir
              // que saldo, extrato e quadros venham do servidor já
              // atualizados — nenhum estado local finge que a compra entrou.
              if (aoPagar) aoPagar();
              else window.location.reload();
            }}
            aoEscolherCartao={() => {
              trackEvent("pix_upsell_cartao", { oferta: ofertaId });
              window.location.href = checkoutCartao;
            }}
          />
        )}
      </div>
    </div>
  );
}
