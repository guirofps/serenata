import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Check, Copy, CreditCard, Loader2 } from "lucide-react";
import { pixFoiPago } from "@/lib/criar-pix";
import { trackEvent, trackEventOnce } from "@/lib/track";
import { CORES } from "@/lib/marca";
import { Button } from "@/components/ui/button";

// A TELA DO PIX: QR, copia-e-cola, e a espera.
//
// Só isso. Quem CRIA a cobrança é o `PixTransparente` (dentro do funil) ou a
// rota `/pix/$referencia` (voltando por e-mail, ou depois de fechar a aba).
// Separado porque a mesma tela precisa nascer dos dois jeitos, e uma cópia
// divergiria no primeiro conserto.
//
// ── O QR APARECE, MAS O BOTÃO É DE COPIAR ────────────────────────
//
// 99% do tráfego é celular, e no celular ninguém aponta a câmera pra própria
// tela: o gesto real é copiar o código e colar no aplicativo do banco. Por
// isso o botão grande é "Copiar código PIX".
//
// Mas o QR fica VISÍVEL mesmo assim, e a primeira versão errou nisso. Ele não
// está ali só pra ser escaneado, está ali pra PROVAR que a cobrança existe:
// uma tela de pagamento com um campo de texto e nada mais parece incompleta.
//
// ── E O CARTÃO É BOTÃO, NÃO RODAPÉ ───────────────────────────────
//
// Medido em 27/08, desde 11/08: cartão é 12,8% das vendas, R$ 4.498 em 17
// dias, uns R$ 8.000 por mês. Isso não cabe num link sublinhado no rodapé.
// A Woovi só faz PIX, então o cartão sai daqui pro checkout da Perfect Pay —
// e a saída precisa ter a dignidade do dinheiro que ela carrega.

export function PixPagamento({
  copiaECola,
  valorTexto,
  referencia,
  aoPagar,
  aoEscolherCartao,
}: {
  copiaECola: string;
  /** O preço como a pessoa viu na oferta, só pra confirmar na tela. */
  valorTexto: string;
  /** `serenata:<quizId>`, usada pra perguntar ao nosso banco se caiu. */
  referencia: string;
  /** Chamado quando o pagamento é confirmado. */
  aoPagar: () => void;
  /** Vai pro checkout hospedado. A saída pro cartão é sempre visível. */
  aoEscolherCartao: () => void;
}) {
  const [copiado, setCopiado] = useState(false);
  const [png, setPng] = useState<string | null>(null);
  const [pago, setPago] = useState(false);
  const [segundos, setSegundos] = useState(0);

  // 1. DESENHA O QR no navegador, a partir do copia-e-cola.
  useEffect(() => {
    QRCode.toDataURL(copiaECola, {
      width: 640,
      margin: 2, // a "zona quieta"; sem ela o leitor falha
      errorCorrectionLevel: "M",
      color: { dark: CORES.tinta, light: "#ffffff" },
    })
      .then(setPng)
      // Sem QR a tela continua útil: o copia-e-cola é o caminho principal.
      .catch(() => setPng(null));
  }, [copiaECola]);

  // 2. ESPERA O PAGAMENTO.
  //
  // Pergunta ao NOSSO banco, não à Woovi: quem escreve lá é o webhook, que já
  // conferiu assinatura e valor. Bater no gateway a cada 4 segundos por
  // pessoa seria gastar a API deles pra saber o que a gente já sabe.
  useEffect(() => {
    const t0 = Date.now();
    const relogio = setInterval(() => setSegundos(Math.round((Date.now() - t0) / 1000)), 1000);
    const sonda = setInterval(async () => {
      try {
        const r = await pixFoiPago({ data: { referencia } });
        if (!r.pago) return;
        clearInterval(sonda);
        clearInterval(relogio);
        trackEvent("pix_transparente_pago", { segundos: Math.round((Date.now() - t0) / 1000) });
        setPago(true);
        aoPagar();
      } catch {
        // Rede piscou: tenta no próximo tique. Não desiste em cima de alguém
        // que talvez já tenha pago.
      }
    }, 4000);
    return () => {
      clearInterval(sonda);
      clearInterval(relogio);
    };
    // `aoPagar` de fora não entra na lista: um pai que recria a função a cada
    // render reiniciaria a sonda sem parar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [referencia]);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(copiaECola);
    } catch {
      // Safari antigo e contexto sem permissão: o `select()` deixa a pessoa
      // copiar à mão, e é melhor que um erro que não explica nada.
      const campo = document.getElementById("pix-codigo") as HTMLTextAreaElement | null;
      campo?.select();
    }
    setCopiado(true);
    // Este FICA com `Once`, e o motivo é o oposto dos outros: copiar duas
    // vezes é gesto de quem está pagando (colou errado, voltou, copiou de
    // novo), não etapa nova do funil. Contar cada toque inflaria o degrau.
    trackEventOnce("pix_transparente_copiou", "v1");
    setTimeout(() => setCopiado(false), 2500);
  }

  if (pago) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <Check className="h-8 w-8 text-emerald-600" />
        <p className="font-medium">Pagamento confirmado</p>
        <p className="text-sm text-muted-foreground">Abrindo a sua música...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="text-center">
        <p className="text-[11px] uppercase tracking-[0.25em] text-primary">Pague com PIX</p>
        <p className="mt-1 font-display text-2xl font-semibold">{valorTexto}</p>
        {/* SEM PEDIR CPF, e vale registrar por quê.
            A Cantoria pede CPF/CNPJ pra gerar o Pix, e a MillionsPay obriga
            (descobri com um 412: "customer.document is required"). A Woovi
            não exige nada além do valor. Então esta tela tem um campo a menos
            que a do concorrente escalado, no exato momento em que a pessoa
            mais desiste. Se um dia alguém for trocar de gateway, isto aqui é
            parte do que se perde. */}
        <p className="mt-1 text-xs text-muted-foreground">
          Sem cadastro e sem CPF. É só copiar e pagar.
        </p>
      </div>

      {png ? (
        <img
          src={png}
          alt="QR Code do PIX"
          className="mx-auto h-52 w-52 rounded-xl border border-primary/10 bg-white p-2.5"
        />
      ) : (
        <div className="mx-auto flex h-52 w-52 items-center justify-center rounded-xl border border-primary/10 bg-secondary/30">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      )}

      <div className="space-y-2">
        <textarea
          id="pix-codigo"
          readOnly
          value={copiaECola}
          rows={3}
          onFocus={(e) => e.currentTarget.select()}
          className="w-full resize-none rounded-xl border border-primary/15 bg-secondary/40 px-3 py-2.5 font-mono text-[11px] leading-snug text-muted-foreground"
        />
        <Button size="lg" className="w-full" onClick={copiar}>
          {copiado ? (
            <>
              <Check className="mr-2 h-4 w-4" /> Código copiado
            </>
          ) : (
            <>
              <Copy className="mr-2 h-4 w-4" /> Copiar código PIX
            </>
          )}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Abra o aplicativo do seu banco, escolha PIX, e use{" "}
          <span className="font-medium text-foreground">Pix Copia e Cola</span>.
        </p>
      </div>

      {/* A ESPERA, honesta. Sem barra que trava em 99%. */}
      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        Esperando o pagamento cair
        {segundos > 20 && <span className="tabular-nums opacity-60">({segundos}s)</span>}
      </div>
      <p className="text-center text-xs leading-snug text-muted-foreground">
        Assim que o banco confirmar, a sua música abre sozinha aqui. Não precisa
        fazer mais nada.
      </p>

      {/* ── A SAÍDA PRO CARTÃO ───────────────────────────────────
          Separada por uma linha, e com o motivo escrito: quem quer cartão
          quase sempre quer PARCELAR, e parcelamento é uma palavra que faz a
          pessoa procurar em vez de desistir. */}
      <div className="border-t border-primary/10 pt-4">
        <p className="mb-2 text-center text-xs text-muted-foreground">
          Prefere cartão, ou quer parcelar?
        </p>
        <Button
          variant="outline"
          size="lg"
          className="w-full"
          onClick={aoEscolherCartao}
        >
          <CreditCard className="mr-2 h-4 w-4" /> Pagar com cartão
        </Button>
      </div>
    </div>
  );
}
