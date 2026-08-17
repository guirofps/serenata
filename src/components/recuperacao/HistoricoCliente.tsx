import { useState } from "react";
import { historicoDoCliente, type LinhaHistorico } from "@/lib/recuperacao-historico";
import { Loader2, Mail, MailOpen, MousePointerClick, AlertTriangle, MessageCircle, Send } from "lucide-react";

// "O E-MAIL CHEGOU?" é a primeira pergunta de metade dos tickets, e até hoje o
// atendente não tinha como responder: ele só tinha a palavra do cliente.
//
// Com a linha do tempo ele responde outra coisa. Entregue às 13:41, aberto às
// 13:56, clicado às 13:56 significa que reenviar não resolve nada, o problema
// é outro. Bounce significa que o e-mail está errado e a conversa tem que ser
// sobre corrigir o endereço, não sobre a música.

const ICONE: Record<string, typeof Mail> = {
  email_letra_enviado: Send,
  email_sequencia_enviado: Send,
  email_delivered: Mail,
  email_opened: MailOpen,
  email_clicked: MousePointerClick,
  email_bounced: AlertTriangle,
  recuperacao_contato: MessageCircle,
};

export function HistoricoCliente({
  emails,
  pedidoIds,
  desde,
}: {
  emails: string[];
  pedidoIds: string[];
  /** Data do pedido mais antigo. Limita a busca; sem isso o banco estoura. */
  desde: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [linhas, setLinhas] = useState<LinhaHistorico[] | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function abrir() {
    setAberto(true);
    if (linhas) return;
    setCarregando(true);
    setErro(null);
    try {
      setLinhas(await historicoDoCliente({ data: { emails, pedidoIds, desde } }));
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setCarregando(false);
    }
  }

  if (!aberto) {
    return (
      <button
        onClick={abrir}
        className="mt-3 rounded-full border border-[var(--tinta-fraca)] px-2.5 py-1 text-[11px]"
      >
        histórico de e-mails e contatos
      </button>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-[var(--tinta-fraca)]/60 p-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--tinta-suave)]">
          histórico
        </p>
        <button onClick={() => setAberto(false)} className="text-[11px] underline">
          fechar
        </button>
      </div>

      {carregando && (
        <p className="mt-2 flex items-center gap-2 text-[11px] text-[var(--tinta-suave)]">
          <Loader2 className="h-3 w-3 animate-spin" /> buscando…
        </p>
      )}
      {erro && <p className="mt-2 text-[11px] text-red-600">{erro}</p>}

      {linhas && linhas.length === 0 && (
        <p className="mt-2 text-[11px] text-[var(--tinta-suave)]">
          Nenhum e-mail registrado. Se ele diz que não recebeu, provavelmente não recebeu mesmo.
        </p>
      )}

      {linhas && linhas.length > 0 && (
        <ol className="mt-2 space-y-1.5">
          {linhas.map((l, i) => {
            const Icone = ICONE[l.evento] ?? Mail;
            return (
              <li key={i} className="flex items-start gap-2 text-[11px]">
                <Icone
                  className={`mt-0.5 h-3 w-3 shrink-0 ${l.ruim ? "text-red-600" : "text-[var(--tinta-suave)]"}`}
                />
                <span className="text-[var(--tinta-suave)]">
                  {new Date(l.quando).toLocaleString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <span className={l.ruim ? "font-semibold text-red-600" : ""}>{l.rotulo}</span>
                {l.detalhe && <span className="text-[var(--tinta-suave)]">· {l.detalhe}</span>}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
