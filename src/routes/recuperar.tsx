import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  listarAbandonados, listarPagos, liberarAcesso, reverterAcesso, linkDeAcesso,
  marcarContato, type Abandonado, type Pago,
} from "@/lib/recuperacao";
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

const SITE_PUBLICO = "https://www.serenatagift.com";

const RELACAO: Record<string, string> = {
  mae: "mãe", pai: "pai", esposa: "esposa", marido: "marido",
  namorada: "namorada", namorado: "namorado", filha: "filha", filho: "filho",
  avo_f: "avó", avo_m: "avô", irma: "irmã", irmao: "irmão",
  neta: "neta", neto: "neto", familia: "família", amiga: "amiga",
  amigo: "amigo", pet: "pet", outro: "alguém especial",
};

/**
 * O que mandar pra quem JÁ PAGOU.
 *
 * Duas situações diferentes, e o texto respeita a diferença:
 *
 * `pediuWhatsapp` é quem digitou o número na tela de espera aceitando
 * "quer que eu te avise quando ficar pronta?". Com essa pessoa a gente tem
 * permissão explícita e pode abrir a conversa como quem cumpre o combinado.
 *
 * Quem não pediu deixou o telefone no CHECKOUT, pra comprar. Falar com ela
 * continua legítimo (é suporte de uma compra), mas o texto entra pedindo
 * licença, não como se ela tivesse pedido.
 *
 * Nos dois casos a mensagem diz que quem monta o presente é ELA. A gente não
 * monta, e prometer o contrário cria um trabalho que não existe.
 */
function mensagensPago(p: Pago): { rotulo: string; texto: string }[] {
  const quem = p.paraQuem || (p.locale === "es" ? "esa persona" : "essa pessoa");
  const oi = p.nome ? `Oi, ${p.nome}!` : "Oi!";
  const editor = p.linkEditor ?? "";
  const presente = p.linkPresente ?? "";

  if (p.locale === "es") {
    return [
      {
        rotulo: p.pediuWhatsapp ? "★ ela pediu contato" : "entrega por WhatsApp",
        texto:
          `¡Hola${p.nome ? `, ${p.nome}` : ""}! Aquí es de Serenata 🎵\n\n` +
          `${p.pediuWhatsapp ? "Como me pediste, te aviso por aquí: " : "Te escribo por aquí porque "}` +
          `la canción de ${quem} ya está lista. Te mando los dos audios en seguida, elige el que más te guste.\n\n` +
          `Y aquí armas la página del regalo, con las fotos de ustedes y el código QR:\n${editor}\n\n` +
          `Ese link es solo tuyo y es el único que deja editar. Cuando termines, mandas esta página a ${quem}:\n${presente}`,
      },
      {
        rotulo: "não conseguiu acessar",
        texto:
          `¡Hola${p.nome ? `, ${p.nome}` : ""}! Vi que tu compra está confirmada 🎵\n\n` +
          `A veces el correo se va a spam. Aquí está tu acceso directo, sin contraseña:\n${editor}\n\n` +
          `Ahí escuchas las dos versiones, subes las fotos y descargas el MP3. Cualquier cosa me respondes por aquí.`,
      },
    ];
  }

  return [
    {
      rotulo: p.pediuWhatsapp ? "★ ela pediu contato" : "entrega por WhatsApp",
      texto:
        `${oi} Aqui é da Serenata 🎵\n\n` +
        `${p.pediuWhatsapp ? "Como você pediu, te aviso por aqui: " : "Te chamo por aqui porque "}` +
        `a música de ${quem} ficou pronta. Já te mando os dois áudios, escolhe o que você mais gostar.\n\n` +
        `E aqui você monta a página do presente, com as fotos de vocês e o QR Code:\n${editor}\n\n` +
        `Esse link é só seu e é o único que deixa editar. Quando terminar, é essa página que você manda pra ${quem}:\n${presente}`,
    },
    {
      rotulo: "não conseguiu acessar",
      texto:
        `${oi} Vi aqui que sua compra está confirmada 🎵\n\n` +
        `Às vezes o e-mail cai no spam. Este é o seu acesso direto, sem senha:\n${editor}\n\n` +
        `Lá você ouve as duas versões, coloca as fotos e baixa o MP3. Qualquer coisa é só me responder por aqui.`,
    },
  ];
}

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
  const [gerandoLink, setGerandoLink] = useState<string | null>(null);
  const [horas, setHoras] = useState(72);
  const [soNaoContatados, setSoNaoContatados] = useState(false);
  const [aba, setAba] = useState<"abertos" | "recuperados" | "sozinhos" | "pagos">("abertos");
  const [pagos, setPagos] = useState<Pago[] | null>(null);
  const [busca, setBusca] = useState("");
  // Os três recortes que ele realmente usa na aba de pagos. Sem isso, os 5
  // que pediram WhatsApp ficam enterrados no meio de 85 cartões.
  const [filtroPago, setFiltroPago] = useState<"todos" | "pediram" | "sumidos">("todos");
  // Relógio de 1s: é o que faz o cronômetro da carência andar na tela.
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

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

  // A aba de pagos carrega sob demanda: são 85 pedidos em 7 dias e cada um
  // precisa de URL assinada de áudio, então não vale trazer junto da fila.
  useEffect(() => {
    if (aba !== "pagos" || !papel) return;
    listarPagos({ data: { dias: 7 } }).then(setPagos).catch(() => {});
  }, [aba, papel]);

  // A fila se atualiza sozinha a cada 45s. Antes só mexia quando ele apertava
  // "Atualizar" — ou seja, um Pix gerado agora só existia pra ele quando
  // lembrasse de clicar, e quem pagava continuava na tela como se devesse.
  useEffect(() => {
    if (!papel) return;
    const id = setInterval(() => {
      listarAbandonados({ data: { horas } })
        .then(setLista)
        .catch(() => {});
    }, 45000);
    return () => clearInterval(id);
  }, [papel, horas]);

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

  // TRÊS ABAS, e a do meio nasceu de uma queixa concreta: ao liberar o acesso,
  // a linha sumia da tela. O operador liberou dois pedidos em 12/08 e no dia
  // seguinte não sabia dizer se tinha liberado. Placar que some não é placar.
  const todosAbertos = (lista ?? []).filter((a) => !a.jaComprouDepois);
  const abertos = soNaoContatados ? todosAbertos.filter((a) => a.contatos.length === 0) : todosAbertos;
  const recuperados = (lista ?? []).filter((a) => a.recuperado);
  const resolvidos = (lista ?? []).filter((a) => a.jaComprouDepois && !a.recuperado);
  const semContato = todosAbertos.filter((a) => a.contatos.length === 0).length;
  const visiveis = aba === "abertos" ? abertos : aba === "recuperados" ? recuperados : resolvidos;
  const ganhoCentavos = recuperados.reduce((s, a) => s + (a.valorCentavos ?? 0), 0);

  return (
    <div className="min-h-screen bg-[var(--papel)] px-4 py-6 text-[var(--tinta)]" style={TEMA_CLARO}>
      <div className="mx-auto max-w-3xl">
        <header className="mb-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display text-2xl font-semibold">Recuperação</h1>
              <p className="text-sm text-[var(--tinta-suave)]">
                {semContato} ainda sem contato
                {recuperados.length > 0 && (
                  <>
                    {" · "}
                    <strong className="text-emerald-700">
                      R$ {(ganhoCentavos / 100).toFixed(2).replace(".", ",")} recuperados
                    </strong>
                  </>
                )}
              </p>
            </div>
            <Button onClick={() => carregar()} disabled={carregando} className="rounded-full" variant="outline">
              {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Atualizar"}
            </Button>
          </div>

          <div className="mt-3 grid grid-cols-4 gap-1 rounded-full bg-[var(--tinta-fraca)]/20 p-1">
            {([
              ["abertos", "A trabalhar", abertos.length],
              ["recuperados", "Recuperados", recuperados.length],
              ["sozinhos", "Pagaram sós", resolvidos.length],
            ["pagos", "Pagos · suporte", pagos?.length ?? 0],
            ] as const).map(([id, rotulo, n]) => (
              <button
                key={id}
                onClick={() => setAba(id)}
                className={
                  "rounded-full px-2 py-2 text-xs font-medium transition-colors " +
                  (aba === id ? "bg-white shadow-sm" : "text-[var(--tinta-suave)]")
                }
              >
                {rotulo} <span className="tabular-nums opacity-70">({n})</span>
              </button>
            ))}
          </div>

          {aba === "pagos" && (
            <>
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="buscar por e-mail (quem escreveu no suporte)"
                className="mt-3 bg-white"
              />
              <div className="mt-2 flex flex-wrap gap-2">
                {([
                  ["pediram", "★ pediram no WhatsApp", (pagos ?? []).filter((p) => p.pediuWhatsapp).length],
                  ["sumidos", "⚠️ não montaram o presente", (pagos ?? []).filter((p) => !p.montouPresente).length],
                  ["todos", "todos", (pagos ?? []).length],
                ] as const).map(([id, rotulo, n]) => (
                  <button
                    key={id}
                    onClick={() => setFiltroPago(id)}
                    className={
                      "rounded-full px-3 py-1.5 text-xs transition-colors " +
                      (filtroPago === id
                        ? "bg-[var(--acento)] font-semibold text-white"
                        : "border border-[var(--tinta-fraca)] text-[var(--tinta-suave)]")
                    }
                  >
                    {rotulo} ({n})
                  </button>
                ))}
              </div>
            </>
          )}

          <div className={"mt-3 flex flex-wrap items-center gap-2 " + (aba === "pagos" ? "hidden" : "")}>
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
            {aba === "abertos" && (
            <label className="ml-2 inline-flex cursor-pointer items-center gap-1.5 text-xs text-[var(--tinta-suave)]">
              <input
                type="checkbox"
                checked={soNaoContatados}
                onChange={(e) => setSoNaoContatados(e.target.checked)}
                className="h-3.5 w-3.5"
              />
              só quem ainda não foi contatado
            </label>
            )}
          </div>

          {/* A carência não é detalhe: sem ela o operador liga em quem está com
              o app do banco aberto naquele segundo. */}
          <p className="mt-2 text-[11px] text-[var(--tinta-suave)]">
            {aba === "abertos"
              ? "Só aparece quem gerou o Pix há mais de 30 minutos. Quem pagar depois muda de aba sozinho."
              : aba === "recuperados"
                ? "Quem você liberou no botão, ou pagou depois de um contato seu. É o seu placar."
                : "Pagaram sozinhos, sem contato registrado. Não conta como recuperação."}
          </p>
        </header>

        {lista === null && <p className="text-sm text-[var(--tinta-suave)]">carregando…</p>}
        {lista !== null && visiveis.length === 0 && (
          <p className="rounded-2xl border border-[var(--tinta-fraca)]/40 p-8 text-center text-[var(--tinta-suave)]">
            {aba === "abertos"
              ? "Nenhum Pix abandonado nessa janela."
              : aba === "recuperados"
                ? "Nada recuperado nessa janela ainda."
                : "Ninguém pagou sozinho nessa janela."}
          </p>
        )}

        {/* ── ABA DE QUEM JÁ PAGOU ─────────────────────────────
            Nasceu de dois casos do mesmo dia: um senhor pagou no cartão e não
            achou nada, e dois e-mails de entrega voltaram no Gmail. Nos três
            o produto estava pronto e o suporte não tinha como chegar nele. */}
        {aba === "pagos" && (
          <div className="space-y-4">
            {pagos === null && <p className="text-sm text-[var(--tinta-suave)]">carregando…</p>}
            {pagos?.length === 0 && (
              <p className="rounded-2xl border border-[var(--tinta-fraca)]/40 p-8 text-center text-[var(--tinta-suave)]">
                Nenhuma compra nos últimos 7 dias.
              </p>
            )}
            {(pagos ?? [])
              .filter((p) => !busca.trim() || (p.email ?? "").includes(busca.trim().toLowerCase()))
              .filter((p) =>
                filtroPago === "pediram" ? p.pediuWhatsapp
                : filtroPago === "sumidos" ? !p.montouPresente
                : true,
              )
              .map((p) => {
                const msgs = mensagensPago(p);
                return (
                  <div
                    key={p.pedidoId}
                    className={
                      "rounded-2xl border p-4 " +
                      (p.pediuWhatsapp
                        ? "border-[#25D366]/50 bg-[#25D366]/5"
                        : "border-[var(--tinta-fraca)]/40 bg-white")
                    }
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium">
                          {p.titulo ? `“${p.titulo}”` : "Música"}{" "}
                          {p.paraQuem && <span className="text-[var(--tinta-suave)]">pra {p.paraQuem}</span>}
                        </p>
                        <p className="text-sm text-[var(--tinta-suave)]">
                          {p.nome ? <strong className="text-[var(--tinta)]">{p.nome}</strong> : "sem nome"} · {p.email}
                        </p>
                        <p className="mt-1 text-xs text-[var(--tinta-suave)]">
                          há {p.horasAtras}h
                          {p.locale === "es" && " · 🇲🇽 espanhol"}
                          {p.pediuWhatsapp && " · ★ pediu contato no WhatsApp"}
                          {/* Quem não montou é o candidato natural a não ter
                              recebido o e-mail: ela nunca chegou na plataforma. */}
                          {!p.montouPresente && " · ⚠️ ainda não montou o presente"}
                        </p>
                      </div>
                      {p.whatsapp && (
                        <a
                          href={`https://wa.me/${p.whatsapp}?text=${encodeURIComponent(msgs[0].texto)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-2 text-sm font-semibold text-white"
                        >
                          <MessageCircle className="h-4 w-4" /> {p.telefone}
                        </a>
                      )}
                    </div>

                    {/* Os DOIS áudios, pra ele baixar e mandar no WhatsApp. */}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {p.audioV1 && (
                        <a href={p.audioV1} download className="inline-flex items-center gap-1.5 rounded-full border border-[var(--tinta-fraca)] px-3 py-1.5 text-xs">
                          <Download className="h-3.5 w-3.5" /> versão 1
                        </a>
                      )}
                      {p.audioV2 && (
                        <a href={p.audioV2} download className="inline-flex items-center gap-1.5 rounded-full border border-[var(--tinta-fraca)] px-3 py-1.5 text-xs">
                          <Download className="h-3.5 w-3.5" /> versão 2
                        </a>
                      )}
                      {p.linkEditor && (
                        <button
                          onClick={() => copiar(p.linkEditor!, `ed-${p.pedidoId}`)}
                          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--tinta-fraca)] px-3 py-1.5 text-xs"
                        >
                          <Copy className="h-3.5 w-3.5" />
                          {copiado === `ed-${p.pedidoId}` ? "copiado!" : "link do editor"}
                        </button>
                      )}
                      {p.linkPresente && (
                        <a href={p.linkPresente} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-[var(--tinta-fraca)] px-3 py-1.5 text-xs">
                          abrir o presente ↗
                        </a>
                      )}
                    </div>

                    <div className="mt-3 space-y-2">
                      {msgs.map((m) => (
                        <div key={m.rotulo} className="rounded-xl bg-[var(--tinta-fraca)]/10 p-3">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--tinta-suave)]">
                              {m.rotulo}
                            </p>
                            <button
                              onClick={() => copiar(m.texto, `${p.pedidoId}-${m.rotulo}`)}
                              className="shrink-0 text-[11px] text-[var(--acento)]"
                            >
                              {copiado === `${p.pedidoId}-${m.rotulo}` ? "copiado!" : "copiar"}
                            </button>
                          </div>
                          <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-[var(--tinta-suave)]">
                            {m.texto}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
          </div>
        )}

        <div className={"space-y-4 " + (aba === "pagos" ? "hidden" : "")}>
          {visiveis.map((a) => {
            const msgs = mensagens(a);
            // Cronômetro da carência. Enquanto corre, o cartão já está na tela
            // (ele vê a fila enchendo) mas os botões de falar ficam travados.
            const faltaMs = new Date(a.podeFalarEm).getTime() - agora;
            const esperando = !a.recuperado && !a.jaComprouDepois && faltaMs > 0;
            const relogio = esperando
              ? `${Math.floor(faltaMs / 60000)}:${String(Math.floor((faltaMs % 60000) / 1000)).padStart(2, "0")}`
              : null;
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

                  {a.recuperado ? (
                    <span className="inline-flex flex-col items-end gap-0.5">
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white">
                        <Check className="h-3 w-3" />
                        {a.recuperado.tipo === "liberado" ? "você liberou" : "pagou depois do contato"}
                      </span>
                      <span className="text-[11px] text-[var(--tinta-suave)]">
                        {new Date(a.recuperado.quando).toLocaleString("pt-BR", {
                          day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                        })}
                      </span>
                    </span>
                  ) : a.jaComprouDepois ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white">
                      <Check className="h-3 w-3" /> já pagou
                    </span>
                  ) : esperando ? (
                    /* Pix acabou de nascer. O cartão já aparece — ele precisa
                       ver a fila em tempo real — mas falar agora é ligar pra
                       quem está com o app do banco aberto neste segundo. */
                    <span className="inline-flex flex-col items-end gap-0.5">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold tabular-nums text-amber-800">
                        <Clock className="h-3 w-3" /> {relogio}
                      </span>
                      <span className="text-[11px] text-[var(--tinta-suave)]">dando tempo de pagar</span>
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

                {/* LINK DE ACESSO pra mandar no WhatsApp. O e-mail de entrega
                    pode cair em spam, e quem está com a pessoa na conversa
                    resolve isso em dez segundos. O texto pronto já ensina o
                    caminho do SEGUNDO acesso (/login), senão a pessoa volta a
                    depender de link toda vez. */}
                {a.jaComprouDepois && (
                  <div className="mt-3 border-t border-[var(--tinta-fraca)]/30 pt-3">
                    <button
                      disabled={gerandoLink === a.pedidoId}
                      onClick={async () => {
                        setGerandoLink(a.pedidoId);
                        const r = await linkDeAcesso({ data: { pedidoId: a.pedidoId } });
                        setGerandoLink(null);
                        if (!r.ok || !r.link) { alert(`Não deu: ${r.erro}`); return; }
                        const texto =
                          `Prontinho! 🎵 Aqui está o acesso à sua música:\n\n${r.link}\n\n` +
                          `É só tocar no link que você já entra direto, sem senha. ` +
                          `Lá dentro você coloca as fotos, pega o link pra enviar e baixa o MP3.\n\n` +
                          `(Da próxima vez, é só entrar em ${SITE_PUBLICO}/login com esse mesmo e-mail.)`;
                        if (a.whatsapp) {
                          window.open(`https://wa.me/${a.whatsapp}?text=${encodeURIComponent(texto)}`, "_blank");
                        } else {
                          copiar(texto, `link-${a.pedidoId}`);
                          alert("Sem telefone aqui. Copiei a mensagem com o link pra você colar.");
                        }
                      }}
                      className="rounded-full border border-[#25D366]/50 px-3 py-1.5 text-xs font-medium text-[#128C4A] disabled:opacity-40"
                    >
                      {gerandoLink === a.pedidoId
                        ? "gerando…"
                        : a.whatsapp
                          ? "mandar o link de acesso no WhatsApp"
                          : "copiar o link de acesso"}
                    </button>
                    <p className="mt-1.5 text-[11px] text-[var(--tinta-suave)]">
                      Entra direto, sem senha. Serve quando o e-mail de entrega cai no spam.
                    </p>
                  </div>
                )}

                {/* DESFAZER, e só pra quem ele mesmo liberou. O botão de
                    liberar é de um clique e o operador é humano: em 12/08 ele
                    liberou o Edivan sem querer e não tinha como voltar. */}
                {a.recuperado?.tipo === "liberado" && (
                  <div className="mt-3 border-t border-[var(--tinta-fraca)]/30 pt-3">
                    <button
                      disabled={liberando === a.pedidoId}
                      onClick={async () => {
                        if (
                          !confirm(
                            `Desfazer a liberação de ${a.email}?\n\n` +
                              `O pedido volta pra fila, a música sai do painel dela e o link que foi por e-mail para de abrir.\n\n` +
                              `O e-mail em si já foi enviado e não dá pra chamar de volta.`,
                          )
                        )
                          return;
                        setLiberando(a.pedidoId);
                        const r = await reverterAcesso({ data: { pedidoId: a.pedidoId } });
                        setLiberando(null);
                        if (r.ok) { alert("Desfeito. O pedido voltou pra aba 'A trabalhar'."); carregar(); }
                        else alert(`Não deu: ${r.erro}`);
                      }}
                      className="rounded-full border border-red-300 px-3 py-1.5 text-xs text-red-700 disabled:opacity-40"
                    >
                      {liberando === a.pedidoId ? "desfazendo…" : "liberei sem querer, desfazer"}
                    </button>
                  </div>
                )}

                {/* Enquanto o cronômetro corre, nada de roteiro nem de botão
                    de liberar: o cartão existe só pra ele VER que a fila
                    encheu. Ouvir a música continua permitido, que é trabalho
                    de preparo e não incomoda ninguém. */}
                {!a.jaComprouDepois && !esperando && (
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
                      {/* DUAS PERGUNTAS DIFERENTES, dois botões.
                          Era um só, e dizia "liberar acesso sem pagamento
                          (pagou por fora)" — as duas coisas na mesma frase. O
                          painel conta faturamento por pedido pago, então cada
                          clique virava R$ 37 de receita, tivesse entrado
                          dinheiro ou não: R$ 111 de venda fantasma em 12/08. */}
                      <p className="mb-1.5 text-[11px] text-[var(--tinta-suave)]">
                        Liberar o acesso desta pessoa:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {([
                          [true, "ela pagou (por fora)", "border-emerald-600/40 text-emerald-700"],
                          [false, "cortesia, não pagou", "border-[var(--tinta-fraca)] text-[var(--tinta-suave)]"],
                        ] as const).map(([pagou, rotulo, cor]) => (
                          <button
                            key={String(pagou)}
                            disabled={liberando === a.pedidoId || !a.temAudio}
                            onClick={async () => {
                              if (
                                !confirm(
                                  pagou
                                    ? `Confirmar que ${a.email} PAGOU e liberar o acesso?\n\nIsso entra como venda no faturamento.`
                                    : `Liberar o acesso de ${a.email} como CORTESIA?\n\nNão entra como venda.`,
                                )
                              )
                                return;
                              setLiberando(a.pedidoId);
                              const r = await liberarAcesso({
                                data: { pedidoId: a.pedidoId, motivo: "recuperação", pagou },
                              });
                              setLiberando(null);
                              if (r.ok) { alert("Liberado! O e-mail de entrega já foi enviado."); carregar(); }
                              else alert(`Não deu: ${r.erro}`);
                            }}
                            className={`rounded-full border px-3 py-1.5 text-xs disabled:opacity-40 ${cor}`}
                          >
                            {liberando === a.pedidoId ? "liberando…" : rotulo}
                          </button>
                        ))}
                      </div>
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
