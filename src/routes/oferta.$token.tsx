import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { criarPixOferta, type ResultadoPixOferta } from "@/lib/criar-pix-oferta";
import { PixPagamento } from "@/components/quiz/PixPagamento";
import { TelaCpf } from "@/components/quiz/TelaCpf";
import { caminhoDeVolta } from "@/lib/volta-ao-funil";
import { Logo } from "@/components/marca/Logo";
import { TEMA_CLARO } from "@/lib/marca";
import { trackEvent } from "@/lib/track";
import { Button } from "@/components/ui/button";

// A OFERTA DA ESCADA, com o PIX na nossa página.
//
// ── DE ONDE VEM QUEM CHEGA AQUI ──────────────────────────────────
//
// Dos e-mails de recuperação, do segundo ao décimo primeiro, que descem o
// preço com o tempo (R$ 38 → 29 → 19 → 9). Antes o link ia direto pro
// checkout da Perfect Pay, porque cada degrau era um PRODUTO cadastrado lá
// com aquele preço.
//
// Com o checkout próprio a Woovi cobra qualquer valor, então o degrau vira só
// um número — e a economia de taxa (11,39% contra R$ 0,50) passa a valer
// também na recuperação, que é onde a margem já está mais fina por causa do
// desconto.
//
// ── POR QUE O PIX NASCE SOZINHO AQUI, SEM PASSO DE RESUMO ────────
//
// No funil existe um passo antes do QR, porque lá a pessoa acabou de ouvir a
// música e ainda está decidindo. Aqui não: ela clicou num e-mail que dizia o
// preço no assunto. O resumo seria repetir o que ela leu pra chegar, e um
// clique a mais entre a decisão e o pagamento.

export const Route = createFileRoute("/oferta/$token")({
  component: Pagina,
  // Uma tela de pagamento com o preço de uma pessoa dentro não tem por que
  // existir em buscador nenhum.
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }] }),
});

// ── O CPF, DESDE 08/10 ───────────────────────────────────────────
//
// O PIX foi pro Asaas, que exige CPF, e esta página recusava em vez de
// perguntar: todo mundo via "Esse link não vale mais". Agora o servidor
// devolve `cpf-necessario`, a página mostra a MESMA `TelaCpf` do funil, e a
// segunda chamada leva o número. Com a Woovi (sem CPF) o QR continua
// nascendo direto, como antes.

type PedidoDeCpf = Extract<ResultadoPixOferta, { erro: "cpf-necessario" | "cpf-invalido" }>;

type Fase =
  | { t: "abrindo" }
  | { t: "cpf"; aviso: string | null; valorTexto: string; titulo: string | null; nome: string }
  | { t: "gerando" }
  | { t: "fim"; r: Exclude<ResultadoPixOferta, PedidoDeCpf> };

function pedeCpf(r: ResultadoPixOferta): r is PedidoDeCpf {
  return !r.ok && (r.erro === "cpf-necessario" || r.erro === "cpf-invalido");
}

function Pagina() {
  const { token } = Route.useParams();
  const [fase, setFase] = useState<Fase>({ t: "abrindo" });
  // O CPF da última tentativa, pra "Tentar de novo" repetir o mesmo pedido
  // sem fazer a pessoa digitar outra vez. Só em memória, nunca em storage.
  const ultimoCpf = useRef<string | undefined>(undefined);

  async function gerar(cpf?: string) {
    ultimoCpf.current = cpf;
    setFase(cpf ? { t: "gerando" } : { t: "abrindo" });
    try {
      const r = await criarPixOferta({ data: { token, cpf } });
      if (pedeCpf(r)) {
        // Nome próprio, e não o `pix_cpf_pedido` do funil: a lista de "parou
        // no CPF" da recuperação lê aquele evento por sessão, e a sessão
        // deste navegador pode nem ser a do quiz.
        trackEvent("oferta_escada_cpf_pedido", { motivo: r.erro });
        setFase({
          t: "cpf",
          aviso: r.erro === "cpf-invalido" ? "Esse CPF não confere. Confere os números?" : null,
          valorTexto: r.valorTexto,
          titulo: r.titulo,
          nome: r.nome,
        });
        return;
      }
      if (r.ok) trackEvent("oferta_escada_pix_gerado", { valor: r.valorCentavos });
      else trackEvent("oferta_escada_falhou", { erro: r.erro });
      setFase({ t: "fim", r });
    } catch {
      trackEvent("oferta_escada_falhou", { erro: "excecao" });
      setFase({ t: "fim", r: { ok: false, erro: "gateway", sessao: "" } });
    }
  }

  useEffect(() => {
    trackEvent("oferta_escada_aberta");
    void gerar();
    // `gerar` é recriada a cada render; o que importa é o token.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const r = fase.t === "fim" ? fase.r : null;

  return (
    <div className={`${TEMA_CLARO} min-h-dvh bg-background`}>
      <div className="mx-auto w-full max-w-md px-5 py-8">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>

        {(fase.t === "abrindo" || fase.t === "gerando") && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              {fase.t === "gerando" ? "Gerando o seu PIX..." : "Abrindo a sua oferta..."}
            </p>
          </div>
        )}

        {fase.t === "cpf" && (
          <>
            {/* O preço do e-mail ANTES do campo: um pedido de documento solto,
                sem dizer o que se paga, parece golpe. */}
            <p className="mb-5 text-center text-sm text-muted-foreground">
              <span className="font-medium text-foreground">
                {fase.titulo ?? `A música de ${fase.nome}`}
              </span>{" "}
              está gravada e esperando. Sai por{" "}
              <span className="font-semibold text-foreground">{fase.valorTexto}</span> no PIX.
            </p>
            <TelaCpf aviso={fase.aviso} aoEnviar={(cpf) => void gerar(cpf)} />
          </>
        )}

        {r?.ok && (
          <>
            <p className="mb-5 text-center text-sm text-muted-foreground">
              <span className="font-medium text-foreground">
                {r.titulo ?? `A música de ${r.nome}`}
              </span>{" "}
              está gravada e esperando.
            </p>
            <PixPagamento
              copiaECola={r.copiaECola}
              valorTexto={r.valorTexto}
              referencia={r.referencia}
              aoPagar={() => {
                window.location.href = "/obrigado";
              }}
              // Sem cartão aqui desde 26/09: ele ia pra Perfect Pay, e venda
              // agora sai só pelo Asaas (pedido do dono).
            />
          </>
        )}

        {r && !r.ok && r.erro === "gateway" && (
          // Mesma tela de erro do funil (`PixTransparente`): a falha costuma
          // ser o Asaas fora por minutos, e o caminho é tentar de novo AQUI,
          // com o preço do e-mail. Mandar pro funil seria trocar R$ 19 por R$ 38.
          <div className="space-y-3 rounded-2xl border border-amber-500/30 bg-amber-50 px-4 py-4 text-left">
            <p className="text-sm font-semibold text-amber-900">Não consegui gerar o PIX agora</p>
            <p className="text-xs leading-snug text-amber-800/80">
              Nada foi cobrado. O banco que gera o PIX está instável neste momento. Tenta de novo em
              um minutinho, a sua música continua aqui.
            </p>
            <Button
              size="lg"
              className="w-full"
              onClick={() => {
                trackEvent("oferta_escada_tentou_de_novo");
                void gerar(ultimoCpf.current);
              }}
            >
              Tentar de novo
            </Button>
            <button
              type="button"
              onClick={() => {
                window.location.href = caminhoDeVolta(r.sessao);
              }}
              className="w-full text-xs text-amber-900/70 underline underline-offset-4"
            >
              Ouvir a minha música
            </button>
          </div>
        )}

        {r && !r.ok && r.erro !== "gateway" && (
          <div className="space-y-4 rounded-2xl border border-primary/10 bg-secondary/30 px-5 py-6 text-center">
            <p className="font-medium">
              {r.erro === "sem-musica"
                ? "Não achei a sua música"
                : r.erro === "ja-pago"
                  ? "Essa música já é sua"
                  : "Esse link não vale mais"}
            </p>
            <p className="text-sm leading-snug text-muted-foreground">
              {r.erro === "sem-musica"
                ? "Pode ser que ela ainda esteja sendo gravada. Escreva pra contato@serenatagift.com que a gente resolve."
                : r.erro === "ja-pago"
                  ? "O pagamento já entrou, e nada foi cobrado de novo. É só abrir pra ouvir e montar o presente."
                  : "Nada foi cobrado. Dá pra continuar a compra por aqui, com o mesmo preço da sua tela."}
            </p>
            <Button
              size="lg"
              className="w-full"
              onClick={() => {
                // ── PRA MÚSICA DELA, NÃO PRA ABERTURA DO QUIZ (08/10) ────
                //
                // Era `/criar`: a pessoa caía na abertura e "começar" girava a
                // sessão, longe da música que já existe. Com o token
                // conferido, a sessão volta do servidor e o `/retomar`
                // reidrata tudo (quem já pagou vai direto pro editor). Token
                // inválido não tem sessão confiável e segue indo pro `/criar`.
                window.location.href = caminhoDeVolta("sessao" in r ? r.sessao : null);
              }}
            >
              {r.erro === "ja-pago" ? "Abrir a minha música" : "Continuar a compra"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
