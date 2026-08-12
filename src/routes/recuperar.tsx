import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { listarAbandonados, liberarAcesso, marcarContato, type Abandonado } from "@/lib/recuperacao";
import { entrarAdmin } from "@/lib/admin-auth";
import { TEMA_CLARO, MARCA } from "@/lib/marca";
import { Logo } from "@/components/marca/Logo";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MessageCircle, Play, Pause, Check, Loader2, Copy, Clock, Download } from "lucide-react";

// TELA DE RECUPERAÇÃO DE CARRINHO ABANDONADO.
//
// Feita para UMA pessoa: quem trabalha o WhatsApp de quem gerou o Pix e não
// pagou. Em 11/08 isso era 43% dos pedidos do dia — a maior intenção de compra
// do funil e a única lista que ninguém conseguia trabalhar, porque o telefone
// só existia dentro da Perfect Pay.
//
// O que ela mostra é o que serve pra CONVERSAR: quem é, o telefone, pra quem é
// a música e há quanto tempo travou. Não mostra faturamento, custo nem CPA —
// senha própria, papel próprio, e quem sai leva só o acesso dele embora.
//
// A regra que decide o desenho: o operador precisa OUVIR a música pra
// argumentar ("está aqui, gravada, com o nome da sua mãe"), mas NUNCA deve
// mandar o arquivo. Por isso o player fica aqui dentro, com URL assinada de
// 2h, e o link que ele copia é o `/retomar` — a própria sessão da pessoa, com
// o trecho e o paywall no lugar.

export const Route = createFileRoute("/recuperar")({
  head: () => ({
    meta: [{ title: `Recuperação · ${MARCA.nome}` }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: Recuperar,
});

const RELACAO: Record<string, string> = {
  mae: "mãe", pai: "pai", esposa: "esposa", marido: "marido",
  namorada: "namorada", namorado: "namorado", filha: "filha", filho: "filho",
  avo_f: "avó", avo_m: "avô", irma: "irmã", irmao: "irmão",
  neta: "neta", neto: "neto", familia: "família", amiga: "amiga",
  amigo: "amigo", pet: "pet", outro: "alguém especial",
};

/** O roteiro. Muda conforme o tempo, porque a conversa muda. */
function mensagens(a: Abandonado): { rotulo: string; texto: string }[] {
  const quem = a.paraQuem || "essa pessoa";
  const rel = a.relacao ? RELACAO[a.relacao] ?? "" : "";
  const de = rel ? ` pra ${rel}` : "";
  const link = a.linkPreviaCliente ?? "";
  const pix = !a.pixExpirou && a.pixCodigo ? a.pixCodigo : null;
  return [
    {
      rotulo: "1 · primeiro contato (até 2h)",
      texto:
        `Oi${a.nome ? ", " + a.nome : ""}! Aqui é da Serenata 🎵\n\n` +
        `Vi que você chegou a gerar o Pix da música${de}, pra ${quem}, mas o pagamento não caiu. Aconteceu alguma coisa?\n\n` +
        `Só pra você saber: a música JÁ ESTÁ GRAVADA, com a letra que você mesmo escreveu. Está aqui esperando.\n\n` +
        `Quer ouvir um pedaço antes de decidir? ${link}`,
    },
    // Só existe quando o código ainda vale. Mandar copia-e-cola vencido é pior
    // que não mandar: a pessoa cola no banco, dá erro, e a conversa morre ali.
    ...(pix
      ? [
          {
            rotulo: "★ com o código Pix (o que mais converte)",
            texto:
              `Oi${a.nome ? ", " + a.nome : ""}! Aqui é da Serenata 🎵\n\n` +
              `A música de ${quem} já está gravada e é sua — só o Pix que não caiu.\n\n` +
              `Pra facilitar, aqui está o código copia e cola (é só colar no seu banco):\n\n` +
              `${pix}\n\n` +
              `Assim que cair, mando tudo na hora. Qualquer dúvida é só chamar!`,
          },
        ]
      : []),
    {
      rotulo: "2 · se não respondeu (12 a 24h)",
      texto:
        `Oi${a.nome ? ", " + a.nome : ""}! Não quero incomodar 🙏\n\n` +
        `A música de ${quem} continua aqui, gravada e pronta. Se foi alguma dúvida ou algum problema no pagamento, me fala que eu resolvo pra você.\n\n` +
        `Se preferir, é só abrir aqui e ouvir: ${link}`,
    },
    {
      rotulo: "3 · quebra de objeção",
      texto:
        `Se ajudar a decidir: você recebe DUAS versões da mesma letra pra escolher, mais a página pronta com as fotos de vocês, o karaokê e o QR Code pra imprimir.\n\n` +
        `E tem garantia de 7 dias — se não gostar, devolvo o valor sem perguntar nada.\n\n` +
        `${link}`,
    },
    {
      rotulo: "4 · último (48h+)",
      texto:
        `Oi! Esse é o último que eu mando, prometo 😊\n\n` +
        `A música de ${quem} vai continuar guardada aqui. Se um dia quiser, é só abrir este link que ela está esperando: ${link}\n\n` +
        `Um abraço!`,
    },
  ];
}

function Recuperar() {
  const [papel, setPapel] = useState<string | null>(null);
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [lista, setLista] = useState<Abandonado[] | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [tocando, setTocando] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);
  const [liberando, setLiberando] = useState<string | null>(null);
  const [horas, setHoras] = useState(72);
  const [soNaoContatados, setSoNaoContatados] = useState(false);

  async function carregar(h = horas) {
    setCarregando(true);
    try {
      setLista(await listarAbandonados({ data: { horas: h } }));
    } catch {
      setErro("Sessão expirada. Entre de novo.");
      setPapel(null);
    }
    setCarregando(false);
  }

  useEffect(() => {
    // Tenta direto: se o cookie ainda vale, nem pede senha.
    listarAbandonados({ data: { horas: 72 } })
      .then((l) => { setLista(l); setPapel("ok"); })
      .catch(() => {});
  }, []);

  function copiar(texto: string, id: string) {
    navigator.clipboard.writeText(texto);
    setCopiado(id);
    setTimeout(() => setCopiado(null), 1500);
  }

  if (!papel) {
    return (
      <div className="grid min-h-screen place-items-center bg-[var(--papel)] px-6" style={TEMA_CLARO}>
        <form
          className="w-full max-w-xs text-center"
          onSubmit={async (e) => {
            e.preventDefault();
            const r = await entrarAdmin({ data: { senha } });
            if (r.ok) { setPapel(r.papel ?? "ok"); setSenha(""); setErro(""); carregar(); }
            else setErro("Senha inválida.");
          }}
        >
          <div className="mb-6 flex justify-center"><Logo tamanho="md" /></div>
          <p className="mb-4 text-sm text-[var(--tinta-suave)]">Recuperação de vendas</p>
          <Input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Senha" autoFocus />
          {erro && <p className="mt-2 text-sm text-red-600">{erro}</p>}
          <Button type="submit" className="cta mt-4 w-full rounded-full border-0">Entrar</Button>
        </form>
      </div>
    );
  }

  const todosAbertos = (lista ?? []).filter((a) => !a.jaComprouDepois);
  const abertos = soNaoContatados ? todosAbertos.filter((a) => a.contatos.length === 0) : todosAbertos;
  const resolvidos = (lista ?? []).filter((a) => a.jaComprouDepois);
  const semContato = todosAbertos.filter((a) => a.contatos.length === 0).length;

  return (
    <div className="min-h-screen bg-[var(--papel)] px-4 py-6 text-[var(--tinta)]" style={TEMA_CLARO}>
      <div className="mx-auto max-w-3xl">
        <header className="mb-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display text-2xl font-semibold">Carrinhos abandonados</h1>
              <p className="text-sm text-[var(--tinta-suave)]">
                {abertos.length} na tela · {semContato} sem contato · {resolvidos.length} já pagaram
              </p>
            </div>
            <Button onClick={() => carregar()} disabled={carregando} className="rounded-full" variant="outline">
              {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Atualizar"}
            </Button>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {[
              [24, "24h"], [72, "3 dias"], [168, "7 dias"], [720, "30 dias"],
            ].map(([h, rot]) => (
              <button
                key={h as number}
                onClick={() => { setHoras(h as number); carregar(h as number); }}
                className={
                  "rounded-full px-3 py-1.5 text-xs transition-colors " +
                  (horas === h
                    ? "bg-[var(--acento)] font-semibold text-white"
                    : "border border-[var(--tinta-fraca)] text-[var(--tinta-suave)]")
                }
              >
                {rot as string}
              </button>
            ))}
            <label className="ml-2 inline-flex cursor-pointer items-center gap-1.5 text-xs text-[var(--tinta-suave)]">
              <input
                type="checkbox"
                checked={soNaoContatados}
                onChange={(e) => setSoNaoContatados(e.target.checked)}
                className="h-3.5 w-3.5"
              />
              só quem ainda não foi contatado
            </label>
          </div>

          {/* A carência não é detalhe: sem ela o operador liga em quem está com
              o app do banco aberto naquele segundo. */}
          <p className="mt-2 text-[11px] text-[var(--tinta-suave)]">
            Só aparece quem gerou o Pix há mais de 30 minutos. Quem pagar depois some da fila sozinho.
          </p>
        </header>

        {lista === null && <p className="text-sm text-[var(--tinta-suave)]">carregando…</p>}
        {lista?.length === 0 && (
          <p className="rounded-2xl border border-[var(--tinta-fraca)]/40 p-8 text-center text-[var(--tinta-suave)]">
            Nenhum Pix abandonado nas últimas 72 horas.
          </p>
        )}

        <div className="space-y-4">
          {[...abertos, ...resolvidos].map((a) => {
            const msgs = mensagens(a);
            return (
              <div
                key={a.pedidoId}
                className={
                  "rounded-2xl border p-4 " +
                  (a.jaComprouDepois
                    ? "border-emerald-600/30 bg-emerald-50/40 opacity-70"
                    : "border-[var(--tinta-fraca)]/40 bg-white")
                }
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {a.paraQuem ? `Música pra ${a.paraQuem}` : "Música"}{" "}
                      {a.relacao && (
                        <span className="text-[var(--tinta-suave)]">({RELACAO[a.relacao] ?? a.relacao})</span>
                      )}
                    </p>
                    <p className="text-sm text-[var(--tinta-suave)]">
                      {a.nome ? <strong className="text-[var(--tinta)]">{a.nome}</strong> : "sem nome"} · {a.email}
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-[var(--tinta-suave)]">
                      <Clock className="h-3 w-3" />
                      há {a.horasAtras}h · R$ {((a.valorCentavos ?? 0) / 100).toFixed(2)}
                      {a.locale === "es" && " · 🇲🇽 espanhol"}
                      {!a.temAudio && " · ⚠️ música não ficou pronta"}
                    </p>
                  </div>

                  {a.jaComprouDepois ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white">
                      <Check className="h-3 w-3" /> já pagou
                    </span>
                  ) : (
                    a.whatsapp && (
                      <a
                        href={`https://wa.me/${a.whatsapp}?text=${encodeURIComponent(msgs[0].texto)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-2 text-sm font-semibold text-white"
                      >
                        <MessageCircle className="h-4 w-4" /> {a.telefone}
                      </a>
                    )
                  )}
                </div>

                {!a.jaComprouDepois && (
                  <>
                    {/* O operador OUVE aqui. Nunca manda o arquivo. */}
                    {a.temAudio && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {[["v1", a.audioV1], ["v2", a.audioV2]].map(([rot, url]) =>
                          url ? (
                            <button
                              key={rot as string}
                              onClick={() => {
                                const id = `${a.pedidoId}-${rot}`;
                                const el = document.getElementById(id) as HTMLAudioElement | null;
                                if (!el) return;
                                document.querySelectorAll("audio").forEach((x) => { if (x !== el) x.pause(); });
                                if (el.paused) { el.play(); setTocando(id); } else { el.pause(); setTocando(null); }
                              }}
                              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--tinta-fraca)] px-3 py-1.5 text-xs"
                            >
                              {tocando === `${a.pedidoId}-${rot}` ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                              ouvir {rot as string}
                              <audio id={`${a.pedidoId}-${rot}`} src={url as string} preload="none" onEnded={() => setTocando(null)} />
                            </button>
                          ) : null,
                        )}
                        {a.linkPreviaCliente && (
                          <button
                            onClick={() => copiar(a.linkPreviaCliente!, `${a.pedidoId}-link`)}
                            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--acento)]/40 px-3 py-1.5 text-xs font-semibold text-[var(--acento)]"
                          >
                            <Copy className="h-3 w-3" />
                            {copiado === `${a.pedidoId}-link` ? "copiado!" : "copiar link da prévia ← use este"}
                          </button>
                        )}
                        {/* DOWNLOAD do arquivo inteiro. Existe porque às vezes é
                            preciso, mas fica de propósito atrás de um aviso: o
                            MP3 É o produto, e quem recebe não tem mais motivo
                            pra pagar. O link da prévia acima faz o mesmo
                            trabalho de convencer sem entregar. */}
                        {[["1", a.audioV1], ["2", a.audioV2]].map(([rot, url]) =>
                          url ? (
                            <a
                              key={`dl${rot}`}
                              href={url as string}
                              download={`${a.titulo ?? "musica"} - v${rot}.mp3`}
                              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--tinta-fraca)] px-3 py-1.5 text-xs text-[var(--tinta-suave)]"
                              title="Cuidado: o arquivo é o produto. Prefira o link da prévia."
                            >
                              <Download className="h-3 w-3" /> baixar v{rot as string}
                            </a>
                          ) : null,
                        )}
                      </div>
                    )}

                    {/* O CÓDIGO PIX. É o botão mais valioso da tela: com ele a
                        pessoa paga no banco em 15 segundos, sem voltar ao
                        site. Vem do gateway e vale 3 dias. */}
                    {a.pixCodigo && !a.pixExpirou && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          onClick={() => copiar(a.pixCodigo!, `${a.pedidoId}-pix`)}
                          className="inline-flex items-center gap-1.5 rounded-full bg-[var(--tinta)] px-4 py-2 text-xs font-semibold text-[var(--papel)]"
                        >
                          <Copy className="h-3 w-3" />
                          {copiado === `${a.pedidoId}-pix` ? "código copiado!" : "copiar código Pix"}
                        </button>
                        {a.pixUrl && (
                          <a
                            href={a.pixUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--tinta-fraca)] px-3 py-2 text-xs text-[var(--tinta-suave)]"
                          >
                            ver QR Code
                          </a>
                        )}
                      </div>
                    )}
                    {a.pixCodigo && a.pixExpirou && (
                      <p className="mt-3 text-[11px] text-amber-700">
                        O código Pix venceu. Mande o link da prévia — ela gera uma cobrança nova.
                      </p>
                    )}

                    {/* MINI CRM: o histórico e o carimbo de contato. */}
                    <div className="mt-3 rounded-xl bg-[var(--papel-fundo)] p-3">
                      {a.contatos.length > 0 ? (
                        <div className="mb-2 space-y-1">
                          {a.contatos.map((c, i) => (
                            <p key={i} className="text-[11px] text-[var(--tinta-suave)]">
                              ✓ {new Date(c.quando).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                              {" · "}{c.canal}
                              {c.nota && <span className="text-[var(--tinta)]"> — {c.nota}</span>}
                            </p>
                          ))}
                        </div>
                      ) : (
                        <p className="mb-2 text-[11px] font-semibold text-amber-700">ainda não foi contatado</p>
                      )}
                      <div className="flex gap-2">
                        <input
                          id={`nota-${a.pedidoId}`}
                          placeholder="o que ela respondeu? (ex: paga sexta)"
                          className="flex-1 rounded-lg border border-[var(--tinta-fraca)] bg-white px-2.5 py-1.5 text-xs outline-none"
                        />
                        <button
                          onClick={async () => {
                            const el = document.getElementById(`nota-${a.pedidoId}`) as HTMLInputElement | null;
                            await marcarContato({ data: { pedidoId: a.pedidoId, nota: el?.value || undefined } });
                            if (el) el.value = "";
                            carregar();
                          }}
                          className="rounded-lg bg-[var(--tinta)] px-3 py-1.5 text-xs font-semibold text-[var(--papel)]"
                        >
                          registrar contato
                        </button>
                      </div>
                    </div>

                    <details className="mt-3">
                      <summary className="cursor-pointer text-xs text-[var(--tinta-suave)]">
                        mensagens prontas ({msgs.length})
                      </summary>
                      <div className="mt-2 space-y-2">
                        {msgs.map((m, i) => (
                          <div key={i} className="rounded-xl bg-[var(--papel-fundo)] p-3">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--acento)]">{m.rotulo}</p>
                              <button
                                onClick={() => copiar(m.texto, `${a.pedidoId}-m${i}`)}
                                className="text-[11px] underline underline-offset-2"
                              >
                                {copiado === `${a.pedidoId}-m${i}` ? "copiado!" : "copiar"}
                              </button>
                            </div>
                            <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-[var(--tinta-suave)]">{m.texto}</p>
                          </div>
                        ))}
                      </div>
                    </details>

                    <div className="mt-3 border-t border-[var(--tinta-fraca)]/30 pt-3">
                      <button
                        disabled={liberando === a.pedidoId || !a.temAudio}
                        onClick={async () => {
                          if (!confirm(`Liberar o acesso de ${a.email} SEM pagamento pelo gateway?`)) return;
                          setLiberando(a.pedidoId);
                          const r = await liberarAcesso({ data: { pedidoId: a.pedidoId, motivo: "recuperação" } });
                          setLiberando(null);
                          if (r.ok) { alert("Liberado! O e-mail de entrega já foi enviado."); carregar(); }
                          else alert(`Não deu: ${r.erro}`);
                        }}
                        className="text-xs text-[var(--tinta-suave)] underline underline-offset-4 disabled:opacity-40"
                      >
                        {liberando === a.pedidoId ? "liberando…" : "liberar acesso sem pagamento (pagou por fora)"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
