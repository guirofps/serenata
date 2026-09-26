import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase-client";
import { TEMA_CLARO, FONTES, MARCA } from "@/lib/marca";
import { Logo } from "@/components/marca/Logo";
import { minhaIndicacao, pedirSaque, type MinhaIndicacao } from "@/lib/indicacao-fns";
import { CARENCIA_DIAS, reaisDeCentavos } from "@/lib/indicacao";
import { trackEvent } from "@/lib/track";
import { ArrowLeft, Check, Copy, Gift, Loader2, Share2, Wallet } from "lucide-react";

// INDIQUE E GANHE: o link de quem já comprou, o saldo e o saque.
//
// Uma tela só, e na ordem em que a pessoa pergunta: o que eu ganho, qual é o
// meu link, quanto eu tenho, como eu saco. As regras que decidem dinheiro não
// moram aqui (`indicacao.ts` e a migração); esta tela só mostra o que o
// servidor devolveu.
//
// Guard CLIENT-SIDE, pelo mesmo motivo do `/dashboard`: a sessão vive no
// localStorage, que não existe no SSR.

export const Route = createFileRoute("/indique")({
  head: () => ({
    meta: [
      { title: `Indique e ganhe · ${MARCA.nome}` },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Indique,
});

const QUANDO = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
  timeZone: "America/Sao_Paulo",
});
const data = (iso: string) => QUANDO.format(new Date(iso));

function mensagemPronta(link: string, pct: number) {
  return `Fiz uma música personalizada no Serenata e ficou linda. Com o meu link você ganha ${pct}% de desconto na sua: ${link}`;
}

type Estado =
  | { t: "carregando" }
  | { t: "pronto"; dados: Extract<MinhaIndicacao, { ok: true }> }
  | { t: "sem-compra" }
  | { t: "erro" };

function Indique() {
  const navigate = useNavigate();
  const [estado, setEstado] = useState<Estado>({ t: "carregando" });
  const [token, setToken] = useState<string | null>(null);

  async function carregar(tk: string) {
    try {
      const r = await minhaIndicacao({ data: { token: tk } });
      if (r.ok) setEstado({ t: "pronto", dados: r });
      else if (r.motivo === "sem-sessao") navigate({ to: "/login" });
      else if (r.motivo === "sem-compra") setEstado({ t: "sem-compra" });
      else setEstado({ t: "erro" });
    } catch {
      setEstado({ t: "erro" });
    }
  }

  useEffect(() => {
    let vivo = true;
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!vivo) return;
      if (!sess.session) {
        navigate({ to: "/login" });
        return;
      }
      setToken(sess.session.access_token);
      await carregar(sess.session.access_token);
      trackEvent("indique_aberto");
    })();
    return () => {
      vivo = false;
    };
  }, [navigate]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-[var(--papel)] text-[var(--tinta)]" style={TEMA_CLARO}>
      <header className="border-b border-[var(--tinta-fraca)]/30">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-6 py-4">
          <Logo tamanho="sm" />
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1.5 text-[var(--tinta-suave)] hover:text-[var(--tinta)]"
            style={{ fontSize: "var(--t-sm)" }}
          >
            <ArrowLeft className="h-4 w-4" /> minhas músicas
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-10">
        {estado.t === "carregando" && (
          <div
            className="flex items-center gap-3 text-[var(--tinta-suave)]"
            style={{ fontSize: "var(--t-sm)" }}
          >
            <Loader2 className="h-4 w-4 animate-spin" /> carregando...
          </div>
        )}

        {estado.t === "sem-compra" && (
          <Caixa>
            <Titulo>Indique e ganhe</Titulo>
            <p
              className="mt-3 text-[var(--tinta-suave)]"
              style={{ fontSize: "var(--t-base)", lineHeight: 1.6 }}
            >
              O seu link aparece aqui depois da sua primeira compra. Aí, cada amigo que comprar por
              ele ganha desconto, e você ganha parte do que ele pagar.
            </p>
          </Caixa>
        )}

        {estado.t === "erro" && (
          <Caixa>
            <p style={{ fontSize: "var(--t-base)" }}>
              Não consegui carregar a sua indicação agora. Tenta de novo em alguns minutos.
            </p>
          </Caixa>
        )}

        {estado.t === "pronto" && token && (
          <Painel dados={estado.dados} token={token} aoAtualizar={() => carregar(token)} />
        )}
      </main>
    </div>
  );
}

function Painel({
  dados,
  token,
  aoAtualizar,
}: {
  dados: Extract<MinhaIndicacao, { ok: true }>;
  token: string;
  aoAtualizar: () => void;
}) {
  const [copiado, setCopiado] = useState(false);
  const msg = mensagemPronta(dados.link, dados.pctDesconto);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(msg);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
      trackEvent("indique_copiou");
    } catch {
      // Clipboard bloqueado (iframe, navegador antigo): o link continua
      // escrito na tela, dá pra selecionar à mão.
    }
  }

  async function compartilhar() {
    trackEvent("indique_compartilhou");
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({ text: msg });
        return;
      } catch {
        // Cancelou a folha de compartilhar: não é erro.
        return;
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank", "noopener");
  }

  const aberto = dados.saques.find((s) => s.status === "solicitado");
  const podeSacar = !aberto && dados.disponivelCentavos >= dados.minimoCentavos;
  const falta = Math.max(0, dados.minimoCentavos - dados.disponivelCentavos);

  return (
    <div className="space-y-6">
      <div>
        <Titulo>Indique e ganhe</Titulo>
        <p
          className="mt-3 text-[var(--tinta-suave)]"
          style={{ fontSize: "var(--t-base)", lineHeight: 1.6 }}
        >
          Quem comprar pelo seu link ganha{" "}
          <strong className="text-[var(--tinta)]">{dados.pctDesconto}% de desconto</strong> na
          primeira música. Você ganha{" "}
          <strong className="text-[var(--tinta)]">{dados.pctComissao}% do que ela pagar</strong>, e
          saca por PIX a partir de {reaisDeCentavos(dados.minimoCentavos)}.
        </p>
      </div>

      {/* O LINK. É o motivo da tela existir, então vem antes do dinheiro. */}
      <Caixa>
        <p className="font-medium" style={{ fontSize: "var(--t-sm)" }}>
          Seu link
        </p>
        <p
          className="mt-2 break-all rounded-[var(--raio)] bg-[var(--papel-fundo)] px-3 py-2.5 font-mono"
          style={{ fontSize: "var(--t-sm)" }}
        >
          {dados.link}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            onClick={copiar}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-[var(--raio)] border border-[var(--tinta-fraca)]/50 font-medium"
            style={{ fontSize: "var(--t-sm)" }}
          >
            {copiado ? (
              <Check className="h-4 w-4 text-[var(--acento)]" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
            {copiado ? "Copiado" : "Copiar mensagem"}
          </button>
          <button
            onClick={compartilhar}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-[var(--raio)] bg-[var(--acento)] font-medium text-white"
            style={{ fontSize: "var(--t-sm)" }}
          >
            <Share2 className="h-4 w-4" /> Compartilhar
          </button>
        </div>
        <p
          className="mt-3 text-[var(--tinta-suave)]"
          style={{ fontSize: "var(--t-xs)", lineHeight: 1.5 }}
        >
          A mensagem que vai junto: “{msg}”
        </p>
      </Caixa>

      {/* O SALDO, nos dois estados. "A liberar" existe pra ninguém achar que
          o dinheiro sumiu: ele está lá, esperando o prazo de reembolso. */}
      <div className="grid grid-cols-2 gap-3">
        <Numero
          rotulo="A liberar"
          valor={dados.pendenteCentavos}
          nota={`em até ${CARENCIA_DIAS} dias`}
        />
        <Numero rotulo="Disponível" valor={dados.disponivelCentavos} destaque />
      </div>

      <Caixa>
        <p className="flex items-center gap-2 font-medium" style={{ fontSize: "var(--t-sm)" }}>
          <Wallet className="h-4 w-4 text-[var(--acento)]" /> Sacar por PIX
        </p>
        {aberto ? (
          <p
            className="mt-2 text-[var(--tinta-suave)]"
            style={{ fontSize: "var(--t-sm)", lineHeight: 1.5 }}
          >
            Você pediu um saque de {reaisDeCentavos(aberto.valorCentavos)} em {data(aberto.quando)}.
            Ele cai na sua chave PIX em até 5 dias úteis.
          </p>
        ) : podeSacar ? (
          <FormSaque token={token} valor={dados.disponivelCentavos} aoPedir={aoAtualizar} />
        ) : (
          <>
            <p
              className="mt-2 text-[var(--tinta-suave)]"
              style={{ fontSize: "var(--t-sm)", lineHeight: 1.5 }}
            >
              O saque abre a partir de {reaisDeCentavos(dados.minimoCentavos)} disponíveis. Faltam{" "}
              {reaisDeCentavos(falta)}.
            </p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--tinta-fraca)]/25">
              <div
                className="h-full rounded-full bg-[var(--acento)]"
                style={{
                  width: `${Math.min(100, Math.max(0, (dados.disponivelCentavos / dados.minimoCentavos) * 100))}%`,
                }}
              />
            </div>
          </>
        )}
      </Caixa>

      <Caixa>
        <p className="font-medium" style={{ fontSize: "var(--t-sm)" }}>
          Suas indicações
        </p>
        {dados.comissoes.length === 0 && dados.saques.length === 0 ? (
          <p
            className="mt-2 text-[var(--tinta-suave)]"
            style={{ fontSize: "var(--t-sm)", lineHeight: 1.5 }}
          >
            Ninguém comprou pelo seu link ainda. Quando alguém comprar, aparece aqui.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-[var(--tinta-fraca)]/25">
            {dados.comissoes.map((c, i) => (
              <li key={`c${i}`} className="flex items-center justify-between gap-3 py-3">
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5" style={{ fontSize: "var(--t-sm)" }}>
                    <Gift className="h-3.5 w-3.5 shrink-0 text-[var(--acento)]" /> Compra pelo seu
                    link
                  </span>
                  <span
                    className="block text-[var(--tinta-suave)]"
                    style={{ fontSize: "var(--t-xs)" }}
                  >
                    {data(c.quando)} ·{" "}
                    {c.estado === "a-liberar"
                      ? `libera em ${data(c.liberaEm)}`
                      : c.estado === "liberada"
                        ? "liberada"
                        : "compra reembolsada"}
                  </span>
                </span>
                <span
                  className={
                    "shrink-0 font-medium " +
                    (c.estado === "estornada" ? "text-[var(--tinta-suave)] line-through" : "")
                  }
                  style={{ fontSize: "var(--t-sm)" }}
                >
                  +{reaisDeCentavos(c.valorCentavos)}
                </span>
              </li>
            ))}
            {dados.saques.map((q, i) => (
              <li key={`s${i}`} className="flex items-center justify-between gap-3 py-3">
                <span className="min-w-0">
                  <span className="block" style={{ fontSize: "var(--t-sm)" }}>
                    Saque por PIX
                  </span>
                  <span
                    className="block text-[var(--tinta-suave)]"
                    style={{ fontSize: "var(--t-xs)" }}
                  >
                    {data(q.quando)} ·{" "}
                    {q.status === "solicitado"
                      ? "em análise"
                      : q.status === "pago"
                        ? "pago"
                        : "não aprovado"}
                  </span>
                </span>
                <span
                  className={
                    "shrink-0 font-medium " +
                    (q.status === "recusado" ? "text-[var(--tinta-suave)] line-through" : "")
                  }
                  style={{ fontSize: "var(--t-sm)" }}
                >
                  −{reaisDeCentavos(q.valorCentavos)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Caixa>

      <div
        className="space-y-2 text-[var(--tinta-suave)]"
        style={{ fontSize: "var(--t-xs)", lineHeight: 1.55 }}
      >
        <p>
          Vale a primeira compra de cada pessoa que usar o seu link. Compras suas pelo próprio link
          não contam.
        </p>
        <p>
          O valor fica {CARENCIA_DIAS} dias a liberar, que é o prazo de reembolso. Se a compra for
          reembolsada, ele sai do seu saldo.
        </p>
      </div>
    </div>
  );
}

function FormSaque({
  token,
  valor,
  aoPedir,
}: {
  token: string;
  valor: number;
  aoPedir: () => void;
}) {
  const [chave, setChave] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar() {
    setErro(null);
    setEnviando(true);
    try {
      const r = await pedirSaque({ data: { token, chavePix: chave } });
      if (r.ok) {
        trackEvent("indique_saque_pedido", { valor: r.valorCentavos });
        aoPedir();
        return;
      }
      setErro(
        r.motivo === "chave-invalida"
          ? "Confere a chave PIX: CPF, e-mail, celular ou chave aleatória."
          : r.motivo === "saque-em-aberto"
            ? "Você já tem um saque em análise."
            : r.motivo === "saldo-insuficiente"
              ? "O saldo disponível mudou. Atualiza a página."
              : "Não consegui pedir o saque agora. Tenta de novo em alguns minutos.",
      );
    } catch {
      setErro("Não consegui pedir o saque agora. Tenta de novo em alguns minutos.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="mt-3 space-y-2">
      <label
        className="block text-[var(--tinta-suave)]"
        style={{ fontSize: "var(--t-xs)" }}
        htmlFor="chave-pix"
      >
        Sua chave PIX
      </label>
      <input
        id="chave-pix"
        value={chave}
        onChange={(e) => setChave(e.target.value)}
        placeholder="CPF, e-mail, celular ou chave aleatória"
        autoComplete="off"
        maxLength={140}
        className="h-11 w-full rounded-[var(--raio)] border border-[var(--tinta-fraca)]/50 bg-white px-3"
        style={{ fontSize: "16px" }}
      />
      {erro && (
        <p className="text-red-700" style={{ fontSize: "var(--t-xs)" }}>
          {erro}
        </p>
      )}
      <button
        onClick={enviar}
        disabled={enviando || chave.trim().length < 5}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[var(--raio)] bg-[var(--acento)] font-medium text-white disabled:opacity-50"
        style={{ fontSize: "var(--t-sm)" }}
      >
        {enviando && <Loader2 className="h-4 w-4 animate-spin" />}
        Sacar {reaisDeCentavos(valor)}
      </button>
      <p className="text-[var(--tinta-suave)]" style={{ fontSize: "var(--t-xs)", lineHeight: 1.5 }}>
        O saque leva todo o saldo disponível e cai em até 5 dias úteis.
      </p>
    </div>
  );
}

function Titulo({ children }: { children: ReactNode }) {
  return (
    <h1 style={{ fontFamily: FONTES.display, fontWeight: 500, fontSize: "var(--t-2xl)" }}>
      {children}
    </h1>
  );
}

function Caixa({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[var(--raio-lg)] border border-[var(--tinta-fraca)]/40 bg-[var(--papel-fundo)] p-5">
      {children}
    </div>
  );
}

function Numero({
  rotulo,
  valor,
  nota,
  destaque,
}: {
  rotulo: string;
  valor: number;
  nota?: string;
  destaque?: boolean;
}) {
  return (
    <div
      className={
        "rounded-[var(--raio-lg)] border p-4 " +
        (destaque
          ? "border-[var(--acento)]/40 bg-[var(--acento)]/[0.06]"
          : "border-[var(--tinta-fraca)]/40 bg-[var(--papel-fundo)]")
      }
    >
      <p className="text-[var(--tinta-suave)]" style={{ fontSize: "var(--t-xs)" }}>
        {rotulo}
      </p>
      <p
        className="mt-1"
        style={{ fontFamily: FONTES.display, fontWeight: 500, fontSize: "var(--t-xl)" }}
      >
        {reaisDeCentavos(valor)}
      </p>
      {nota && (
        <p className="text-[var(--tinta-suave)]" style={{ fontSize: "var(--t-xs)" }}>
          {nota}
        </p>
      )}
    </div>
  );
}
