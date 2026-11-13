import { useEffect, useRef, useState } from "react";
import { Lock, RefreshCw } from "lucide-react";
import { criarCartaoDlocal, confirmarCartaoDlocal } from "@/lib/dlocalgo-cartao";
import { getOrCreateSessionId } from "@/lib/session-context";
import { bracoLocalParaEnviar } from "@/lib/preco-local-tela";
import { guardarTransacao } from "@/lib/google-ads";
import { trackEvent } from "@/lib/track";
import { varianteDe } from "@/lib/experimentos";
import { Button } from "@/components/ui/button";
import { NaMoeda } from "@/components/quiz/PrecoDaOferta";
import { nomeCompletoValido } from "@/lib/documento-mx";
import { CAMPO_DOCUMENTO, validarDocumento } from "@/lib/documento-pais";
import {
  EXP_CARTAO_DLOCAL,
  SDK_SMARTFIELDS,
  TEXTO_CARTAO_DLOCAL as T,
  TEXTO_RECUSA_CARTAO,
  type GrupoRecusaCartao,
  type PaisCartaoDlocal,
} from "@/lib/cartao-dlocal";

// O CARTÃO PELA dLOCAL GO NA NOSSA FOLHA (teste `cartao_dlocal`, braço B).
// Regra e desenho em `cartao-dlocal.ts`; o servidor em `dlocalgo-cartao.ts`.
//
// O campo do cartão é um iframe dos SmartFields (o número nunca passa pelo
// nosso código). O SDK só baixa quando esta tela abre, como o Stripe.js.

type CampoDlocal = { mount: (el: HTMLElement) => void; on?: (ev: string, cb: (e: { error?: unknown; complete?: boolean }) => void) => void; destroy?: () => void };
type SdkDlocal = {
  initialize: (chave: string, token: string) => Promise<void> | void;
  fields: () => { create: (tipo: string, opcoes: Record<string, unknown>) => CampoDlocal };
  createCardToken: (campo: CampoDlocal, opcoes: { name: string }) => Promise<{ token?: string }>;
};
declare global {
  interface Window {
    dlocalGo?: SdkDlocal;
  }
}

let sdkPromise: Promise<SdkDlocal> | null = null;
function carregarSdk(): Promise<SdkDlocal> {
  sdkPromise ??= new Promise<SdkDlocal>((ok, falha) => {
    if (window.dlocalGo) return ok(window.dlocalGo);
    const s = document.createElement("script");
    s.src = SDK_SMARTFIELDS;
    s.async = true;
    s.onload = () => (window.dlocalGo ? ok(window.dlocalGo) : falha(new Error("sdk sem dlocalGo")));
    s.onerror = () => falha(new Error("sdk não carregou"));
    document.head.appendChild(s);
  }).catch((e) => {
    sdkPromise = null;
    throw e;
  });
  return sdkPromise;
}

const ESTILO = {
  base: {
    fontSize: "15px",
    lineHeight: "24px",
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    fontSmoothing: "antialiased",
    color: "#2a1a1f",
    "::placeholder": { color: "#9a8a8f" },
    iconColor: "#7a2a3a",
  },
  invalid: { color: "#b45309", iconColor: "#b45309" },
};

type Fase = "abrindo" | "pronto" | "pagando" | "recusado" | "pendente" | "erro";

export function CartaoDlocal({
  pais,
  precoTexto,
  aoSemMusica,
  aoSemCartao,
}: {
  pais: PaisCartaoDlocal;
  precoTexto: string;
  aoSemMusica: () => void;
  /** "Pagar en efectivo o transferencia": a folha da dLocal de sempre. Sem ela, o botão não aparece. */
  aoSemCartao?: () => void;
}) {
  const [fase, setFase] = useState<Fase>("abrindo");
  const [tentativa, setTentativa] = useState(0);
  const [grupo, setGrupo] = useState<GrupoRecusaCartao | null>(null);
  const [nome, setNome] = useState("");
  const [documento, setDocumento] = useState("");
  const [pedeDocumento, setPedeDocumento] = useState(false);
  const [tocou, setTocou] = useState(false);
  const [erroCartao, setErroCartao] = useState(false);
  // O campo do cartão é um iframe da dLocal que leva de 5 a 10s pra aparecer
  // DEPOIS de montado (medido em 13/11). Até ele dizer que está pronto (ou a
  // pessoa tocar nele), a caixa segue com o aviso de carregando: antes ela
  // ficava vazia e sem aviso, com cara de tela quebrada.
  const [campoPronto, setCampoPronto] = useState(false);
  // O valor que o servidor VAI cobrar nesta cobrança (`valorTexto`). Enquanto
  // ele não chega, o botão (desligado) mostra o da tela.
  const [valorCobrado, setValorCobrado] = useState<string | null>(null);
  const caixa = useRef<HTMLDivElement>(null);
  const campo = useRef<CampoDlocal | null>(null);
  const pagamento = useRef<string | null>(null);
  const sdk = useRef<SdkDlocal | null>(null);
  const braco = varianteDe(EXP_CARTAO_DLOCAL);

  const docOk = validarDocumento(pais, documento);
  const nomeOk = nomeCompletoValido(nome);
  const rotuloDoc = CAMPO_DOCUMENTO[pais].rotulo;

  // Cada abertura (e cada "otra tarjeta") é uma cobrança nova: o token do SDK
  // serve pra uma tentativa só.
  useEffect(() => {
    let vivo = true;
    const abertoEm = Date.now();
    setFase("abrindo");
    setErroCartao(false);
    campo.current?.destroy?.();
    campo.current = null;
    Promise.all([criarCartaoDlocal({ data: { sessionId: getOrCreateSessionId(), bracoLocal: bracoLocalParaEnviar() } }), carregarSdk()])
      .then(async ([r, s]) => {
        if (!vivo) return;
        if (!r.ok) {
          trackEvent("cartao_dlocal_erro", { etapa: "criar", erro: r.erro, pais, braco });
          if (r.erro === "sem-musica") return aoSemMusica();
          if (r.erro === "ja-pago") {
            window.location.href = "/es/gracias";
            return;
          }
          setFase("erro");
          return;
        }
        pagamento.current = r.pagamentoId;
        setValorCobrado(r.valorTexto || null);
        setPedeDocumento((p) => p || r.documento);
        sdk.current = s;
        await s.initialize(r.chaveSmartfields, r.checkoutToken);
        if (!vivo || !caixa.current) return;
        caixa.current.innerHTML = "";
        setCampoPronto(false);
        const c = s.fields().create("card", { style: ESTILO });
        const montadoEm = Date.now();
        let avisou = false;
        const pronto = (via: string) => {
          if (!vivo || avisou) return;
          avisou = true;
          setCampoPronto(true);
          // `ms` = do mount do campo até ele avisar; `ms_total` = do toque em
          // "pagar con tarjeta" até aqui (cobrança + SDK + campo), o que a pessoa espera.
          trackEvent("cartao_dlocal_campo_pronto", { pais, braco, via, ms: Date.now() - montadoEm, ms_total: Date.now() - abertoEm });
        };
        c.mount(caixa.current);
        c.on?.("ready", () => pronto("ready"));
        c.on?.("focus", () => pronto("focus"));
        c.on?.("change", (e) => {
          pronto("change");
          setErroCartao(Boolean(e?.error));
        });
        // Rede: se o SDK não avisar, o aviso sai depois de 15s de qualquer jeito.
        window.setTimeout(() => pronto("tempo"), 15000);
        campo.current = c;
        setFase("pronto");
        trackEvent("cartao_dlocal_form_aberto", { pais, braco, pagamento: r.pagamentoId });
      })
      .catch((e) => {
        if (!vivo) return;
        trackEvent("cartao_dlocal_erro", { etapa: "sdk", erro: String(e?.message ?? e).slice(0, 80), pais, braco });
        setFase("erro");
      });
    return () => {
      vivo = false;
    };
    // `aoSemMusica` muda a cada render do pai; só a tentativa refaz.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tentativa]);

  const pagar = async () => {
    setTocou(true);
    if (!nomeOk || (pedeDocumento && !docOk.ok)) return;
    const s = sdk.current;
    const c = campo.current;
    const id = pagamento.current;
    if (!s || !c || !id) return;
    setFase("pagando");
    let cardToken: string | undefined;
    try {
      cardToken = (await s.createCardToken(c, { name: nome.trim().replace(/\s+/g, " ") }))?.token;
    } catch (e) {
      // O SDK rejeita com objeto ({ error: {...} }), não com Error: String() dava "[object Object]".
      const bruto = (e as Error)?.message ?? e;
      let erro: string;
      try { erro = typeof bruto === "string" ? bruto : JSON.stringify(bruto); } catch { erro = String(bruto); }
      trackEvent("cartao_dlocal_token_falhou", { pais, braco, erro: String(erro).slice(0, 160) });
    }
    if (!cardToken) {
      setErroCartao(true);
      setFase("pronto");
      return;
    }
    trackEvent("cartao_dlocal_token_criado", { pais, braco });
    try {
      const r = await confirmarCartaoDlocal({
        data: {
          sessionId: getOrCreateSessionId(),
          pagamentoId: id,
          cardToken,
          nome,
          ...(pedeDocumento && docOk.ok ? { documento: docOk.documento } : {}),
        },
      });
      trackEvent("cartao_dlocal_confirmado", { pais, braco, estado: r.estado, ...("grupo" in r ? { grupo: r.grupo } : {}), ...("erro" in r ? { erro: r.erro } : {}) });
      if (r.estado === "pago") {
        trackEvent("cartao_dlocal_pago", { pais, braco });
        // O MESMO ID QUE O SERVIDOR MANDA PRO TIKTOK (ver `CheckoutDlocal.tsx`).
        guardarTransacao(id);
        window.location.href = "/es/gracias?metodo=tarjeta";
        return;
      }
      if (r.estado === "3ds") {
        guardarTransacao(id);
        window.location.assign(r.url);
        return;
      }
      if (r.estado === "pendente") return setFase("pendente");
      if (r.estado === "recusado") {
        trackEvent("cartao_dlocal_recusado", { pais, braco, grupo: r.grupo });
        if (r.grupo === "documento") setPedeDocumento(true);
        setGrupo(r.grupo);
        return setFase("recusado");
      }
      if (r.erro === "documento") {
        setPedeDocumento(true);
        return setFase("pronto");
      }
      if (r.erro === "dados") return setFase("pronto");
      setFase("erro");
    } catch {
      trackEvent("cartao_dlocal_erro", { etapa: "confirmar", erro: "rede", pais, braco });
      setFase("erro");
    }
  };

  const outraTentativa = () => {
    trackEvent("cartao_dlocal_outro_cartao", { pais, braco, grupo });
    setGrupo(null);
    setTentativa((n) => n + 1);
  };

  return (
    <div className="mx-2 text-left">
      {fase === "erro" ? (
        <div className="px-1 py-6 text-center">
          <p className="text-sm text-amber-900">{T.erro}</p>
          <button
            onClick={() => setTentativa((n) => n + 1)}
            className="cta mt-4 inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-medium"
          >
            <RefreshCw className="h-4 w-4" /> {T.tentar}
          </button>
          {aoSemCartao ? (
            <button onClick={aoSemCartao} className="mt-4 block w-full text-sm font-medium text-primary underline">
              {T.semCartao}
            </button>
          ) : null}
        </div>
      ) : fase === "pendente" ? (
        <p className="rounded-xl bg-muted/50 px-3 py-4 text-sm leading-relaxed text-muted-foreground">{T.pendente}</p>
      ) : fase === "recusado" && grupo ? (
        <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
          <p className="text-sm leading-relaxed text-amber-950">{TEXTO_RECUSA_CARTAO[grupo]}</p>
          <Button size="lg" className="w-full" onClick={outraTentativa}>
            {grupo === "documento" || grupo === "dados" ? T.tentar : T.outroCartao}
          </Button>
          {aoSemCartao ? (
            <button
              onClick={() => {
                trackEvent("cartao_dlocal_foi_sem_cartao", { pais, braco, grupo });
                aoSemCartao();
              }}
              className="w-full rounded-xl border border-primary/25 bg-background px-3 py-3 text-sm font-medium text-primary"
            >
              {T.semCartao}
            </button>
          ) : null}
        </div>
      ) : (
        <div className="space-y-4 rounded-2xl border border-border bg-card px-4 py-5">
          <div>
            <p className="text-sm font-semibold">{T.titulo}</p>
            <p className="text-xs text-muted-foreground">{T.sub}</p>
          </div>
          {/* O iframe da dLocal entra aqui. Fica montado durante o "abrindo". */}
          <div className="space-y-1.5">
            <div
              ref={caixa}
              className="min-h-[48px] rounded-xl border border-input bg-background px-3 py-3"
              aria-busy={fase === "abrindo"}
            />
            {fase === "abrindo" || (fase === "pronto" && !campoPronto) ? (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <RefreshCw className="h-3.5 w-3.5 animate-spin" /> {T.abrindo}
              </p>
            ) : erroCartao ? (
              <p className="text-xs text-amber-700">{T.cartaoErro}</p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              autoComplete="cc-name"
              placeholder={T.nome}
              aria-label={T.nome}
              className="w-full rounded-xl border border-input bg-background px-3 py-3 text-base outline-none focus:border-ring"
            />
            {tocou && !nomeOk ? <p className="text-xs text-amber-700">{T.nomeErro}</p> : null}
          </div>
          {pedeDocumento ? (
            <div className="space-y-1.5">
              <input
                value={documento}
                onChange={(e) => setDocumento(e.target.value.toUpperCase().slice(0, 24))}
                autoComplete="off"
                autoCapitalize="characters"
                inputMode={pais === "CO" || pais === "PE" ? "numeric" : "text"}
                spellCheck={false}
                placeholder={rotuloDoc}
                aria-label={rotuloDoc}
                aria-invalid={tocou && !docOk.ok}
                className="w-full rounded-xl border border-input bg-background px-3 py-3 text-base uppercase tracking-wide outline-none focus:border-ring"
              />
              <p className="text-xs leading-snug text-muted-foreground">{T.documentoSub}</p>
              {tocou && !docOk.ok ? <p className="text-xs text-amber-700">{docOk.mensagem}</p> : null}
            </div>
          ) : null}
          <Button size="lg" className="w-full" disabled={fase !== "pronto"} onClick={pagar}>
            {fase === "pagando" ? (
              <span className="inline-flex items-center gap-2">
                <RefreshCw className="h-4 w-4 animate-spin" /> {T.pagando}
              </span>
            ) : valorCobrado ? (
              // O número do SERVIDOR, não o da tela: é o que a cobrança debita.
              T.pagar(valorCobrado)
            ) : (
              <NaMoeda texto={precoTexto} como={T.pagar} />
            )}
          </Button>
          <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground">
            <Lock className="h-3 w-3" /> {T.seguro}
          </p>
        </div>
      )}
    </div>
  );
}
