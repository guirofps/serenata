import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Check, Copy, Loader2 } from "lucide-react";
import { criarPix, pixFoiPago, type ResultadoPix } from "@/lib/criar-pix";
import { getOrCreateSessionId } from "@/lib/session-context";
import { trackEvent, trackEventOnce } from "@/lib/track";
import { CORES } from "@/lib/marca";
import { Button } from "@/components/ui/button";

// O CHECKOUT DE PIX NA NOSSA PROPRIA PAGINA.
//
// == O QUE ELE EXISTE PRA CONSERTAR ==
//
// Medido em 27/08: 70% de quem clica em comprar NAO gera pedido nenhum, uns
// 250 por dia. Parte disso e a troca de dominio: a pessoa sai de
// serenatagift.com, cai num checkout de outra marca, e desiste.
//
// Aqui ela nao sai. O QR aparece na mesma tela onde ela ouviu a musica.
//
// == E A OUTRA METADE DO GANHO E TAXA ==
//
// Woovi cobra R$ 0,50 num ticket de R$ 38; a Perfect Pay cobra ~R$ 4,41. No
// volume de agosto isso sao ~R$ 3.800 por mes, e nao depende de a conversao
// melhorar nem um ponto.
//
// == O QR APARECE, MAS O BOTAO E DE COPIAR ==
//
// 99% do trafego e celular, e no celular ninguem aponta a camera pra propria
// tela: o gesto real e copiar o codigo e colar no aplicativo do banco. Por
// isso o botao grande e "Copiar codigo PIX".
//
// Mas o QR fica VISIVEL mesmo assim, e a primeira versao errou nisso. Ele nao
// esta ali so pra ser escaneado, esta ali pra PROVAR que a cobranca existe:
// uma tela de pagamento com um campo de texto e nada mais parece incompleta.
// E tambem o que a Cantoria faz, e o padrao que esse publico ja viu.

type Fase =
  | { t: "criando" }
  | { t: "pronto"; dados: Extract<ResultadoPix, { ok: true }> }
  | { t: "pago" }
  | { t: "erro"; motivo: string };

export function PixTransparente({
  valorTexto,
  aoDesistir,
}: {
  /** O preço como a pessoa viu na oferta, só pra confirmar na tela. */
  valorTexto: string;
  /** Volta pro checkout hospedado. A saída de emergência é sempre visível. */
  aoDesistir: () => void;
}) {
  const [fase, setFase] = useState<Fase>({ t: "criando" });
  const [copiado, setCopiado] = useState(false);
  const [png, setPng] = useState<string | null>(null);
  const [segundos, setSegundos] = useState(0);
  const jaPediu = useRef(false);

  // 1. CRIA A COBRANÇA, uma vez só.
  useEffect(() => {
    if (jaPediu.current) return;
    jaPediu.current = true;
    (async () => {
      try {
        const r = await criarPix({ data: { sessionId: getOrCreateSessionId() } });
        if (!r.ok) {
          trackEvent("pix_transparente_falhou", { erro: r.erro });
          setFase({ t: "erro", motivo: r.erro });
          return;
        }
        trackEventOnce("pix_transparente_gerado", "v1", { valor: r.valorCentavos });
        setFase({ t: "pronto", dados: r });
      } catch (err) {
        console.error("[pix] criar falhou:", err);
        trackEvent("pix_transparente_falhou", { erro: "excecao" });
        setFase({ t: "erro", motivo: "excecao" });
      }
    })();
  }, []);

  // 2. DESENHA O QR no navegador, a partir do copia-e-cola.
  useEffect(() => {
    if (fase.t !== "pronto") return;
    QRCode.toDataURL(fase.dados.copiaECola, {
      width: 640,
      margin: 2, // a "zona quieta"; sem ela o leitor falha
      errorCorrectionLevel: "M",
      color: { dark: CORES.tinta, light: "#ffffff" },
    })
      .then(setPng)
      .catch(() => {
        // Sem QR a tela continua útil: o copia-e-cola é o caminho principal.
        setPng(null);
      });
  }, [fase]);

  // 3. ESPERA O PAGAMENTO.
  //
  // Pergunta ao NOSSO banco, não à Woovi: quem escreve lá é o webhook, que já
  // conferiu assinatura e valor. Bater no gateway a cada 4 segundos por
  // pessoa seria gastar a API deles pra saber o que a gente já sabe.
  useEffect(() => {
    if (fase.t !== "pronto") return;
    const referencia = fase.dados.referencia;
    const t0 = Date.now();
    const relogio = setInterval(() => setSegundos(Math.round((Date.now() - t0) / 1000)), 1000);
    const sonda = setInterval(async () => {
      try {
        const { pago } = await pixFoiPago({ data: { referencia } });
        if (!pago) return;
        clearInterval(sonda);
        clearInterval(relogio);
        trackEvent("pix_transparente_pago", { segundos: Math.round((Date.now() - t0) / 1000) });
        setFase({ t: "pago" });
        // A tela de obrigado é a mesma de quem pagou pelo checkout antigo:
        // um só lugar decide o que acontece depois da compra.
        window.location.href = "/obrigado";
      } catch {
        // Rede piscou: tenta no próximo tique. Não desiste em cima de alguém
        // que talvez já tenha pago.
      }
    }, 4000);
    return () => {
      clearInterval(sonda);
      clearInterval(relogio);
    };
  }, [fase]);

  async function copiar(codigo: string) {
    try {
      await navigator.clipboard.writeText(codigo);
    } catch {
      // Safari antigo e contexto sem permissão: o `select()` deixa a pessoa
      // copiar à mão, e é melhor que um erro que não explica nada.
      const campo = document.getElementById("pix-codigo") as HTMLTextAreaElement | null;
      campo?.select();
    }
    setCopiado(true);
    trackEventOnce("pix_transparente_copiou", "v1");
    setTimeout(() => setCopiado(false), 2500);
  }

  if (fase.t === "criando") {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Gerando o seu PIX...</p>
      </div>
    );
  }

  if (fase.t === "erro") {
    // NUNCA deixa a pessoa sem caminho. Ela quer pagar; se o nosso PIX
    // falhou, o checkout de sempre continua ali.
    return (
      <div className="space-y-3 rounded-2xl border border-amber-500/30 bg-amber-50 px-4 py-4 text-left">
        <p className="text-sm font-semibold text-amber-900">
          Não consegui gerar o PIX agora
        </p>
        <p className="text-xs leading-snug text-amber-800/80">
          Nada foi cobrado. Dá pra concluir pelo nosso checkout normal, que aceita
          PIX e cartão.
        </p>
        <Button size="lg" className="w-full" onClick={aoDesistir}>
          Continuar pelo checkout
        </Button>
      </div>
    );
  }

  if (fase.t === "pago") {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <Check className="h-8 w-8 text-emerald-600" />
        <p className="font-medium">Pagamento confirmado</p>
        <p className="text-sm text-muted-foreground">Abrindo a sua música...</p>
      </div>
    );
  }

  const { copiaECola } = fase.dados;

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
        <Button size="lg" className="w-full" onClick={() => copiar(copiaECola)}>
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

      <button
        onClick={aoDesistir}
        className="mx-auto block text-xs text-muted-foreground underline underline-offset-4"
      >
        Prefiro pagar com cartão
      </button>
    </div>
  );
}
