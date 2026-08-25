import { useEffect, useState } from "react";
import { useQuizStore } from "@/lib/quiz-store";
import { irParaCheckout } from "@/lib/checkout";
import { temMusicaDaSessao } from "@/lib/coautoria";
import { meusCreditos } from "@/lib/meus-creditos";
import { usarCredito } from "@/lib/usar-credito";
import { supabase } from "@/lib/supabase-client";
import { getOrCreateSessionId } from "@/lib/session-context";
import { trackEvent, trackEventOnce } from "@/lib/track";
import { VitrineVideo } from "@/components/landing/VitrineVideo";
import { TEMA_CLARO } from "@/lib/marca";
import { type Locale } from "@/lib/i18n";
import { meuPlano } from "@/lib/preco";
import { PrecoCurto, PrecoDaOferta } from "@/components/quiz/PrecoDaOferta";
import { cupomAtivo } from "@/lib/cupom";
import { GARANTIA } from "@/lib/garantia";
import { Button } from "@/components/ui/button";
import {
  Music, Images, Sparkles, QrCode, Download, Infinity as InfinityIcon,
  Pencil, ShieldCheck, ChevronLeft, ChevronDown, Check, RefreshCw,
} from "lucide-react";

// A OFERTA, entre a letra e o gateway.
//
// Versão 2 (05/08). A primeira era cinco bullets e um preço. Refeita no
// padrão das paywalls dos projetos anteriores (Mensagem Angelical, Numaya):
// lista longa e específica do entregável, ancoragem contra o que a
// alternativa custa de verdade, prova, FAQ que mata objeção, e botão sempre
// à mão.
//
// A prova é o vídeo de reações reais — a mesma peça da home, gente de
// verdade ouvindo música feita por nós. É a coisa mais forte que existe pra
// colocar logo antes do preço.

const ENTREGAVEIS_PT = [
  {
    Icone: Music,
    titulo: "A música completa, cantada",
    detalhe: "Do começo ao fim, sem corte. E em duas gravações diferentes da mesma letra, pra você escolher a que emocionar mais.",
  },
  {
    Icone: Images,
    titulo: "A página presente, com as fotos de vocês",
    detalhe: "Até 12 fotos, que passam sozinhas nas viradas da música. É essa página que você manda, não um arquivo solto.",
  },
  {
    Icone: Sparkles,
    titulo: "O karaokê, palavra por palavra",
    detalhe: "Cada palavra acende no instante exato em que é cantada. Quem recebe acompanha e canta junto.",
  },
  {
    Icone: QrCode,
    titulo: "Link e QR Code pra presentear",
    detalhe: "Manda o link no WhatsApp, ou imprime o QR Code e cola numa caixa de bombom. O presente digital vira presente de mão.",
  },
  {
    Icone: Download,
    titulo: "O MP3 pra baixar e guardar",
    detalhe: "A música fica no seu celular, pra ouvir quando quiser, com ou sem internet.",
  },
  {
    // O AJUSTE DA MÚSICA, e ele fica DEPOIS do pagamento de propósito.
    //
    // A vontade de mexer aparece na hora que a pessoa ouve, e é onde ela mais
    // desiste ("gostei, mas aquele trecho..."). Prometer aqui que dá pra
    // ajustar tira o medo de comprar algo quase certo.
    //
    // Antes do pagamento não tem: cada regeração custa R$ 0,32 de alguém que
    // ainda não pagou nada, e a decisão do dono é que isso vira produto do
    // pós-compra, no painel.
    Icone: RefreshCw,
    titulo: "Não ficou do seu jeito? A gente refaz",
    detalhe: "Depois de comprar, você pede um ajuste na sua conta: trocar um trecho da letra, mudar o estilo ou a voz. A gente regrava e te manda a nova versão.",
  },
  {
    Icone: Pencil,
    titulo: "Você monta o presente do seu jeito",
    detalhe: "Escolhe a cor da página, o efeito na tela e escreve uma frase sua. Dá pra mexer quantas vezes quiser.",
  },
  {
    Icone: InfinityIcon,
    titulo: "É seu pra sempre",
    detalhe: "A página não expira e o link não para de funcionar. Pagamento único, sem mensalidade.",
  },
];

const DUVIDAS_PT = [
  {
    p: "É cobrança única ou assinatura?",
    r: "Única. Você paga uma vez e a música é sua pra sempre. Não tem mensalidade, não tem renovação automática, não guardamos seu cartão.",
  },
  {
    p: "Quanto tempo demora?",
    r: "Até 30 minutos, e normalmente menos de 5. Você recebe um e-mail assim que ficar pronta, e também consegue montar o presente na hora, na própria tela.",
  },
  {
    p: "A música vai ser igual à letra que eu li?",
    r: "Sim. É exatamente essa letra que vai ser cantada, palavra por palavra. Nada de trocar por outra coisa depois do pagamento.",
  },
  {
    p: "E se eu não gostar da gravação?",
    r: "Você recebe duas versões da mesma letra, com interpretações diferentes, e escolhe qual vai abrir quando a pessoa receber. Se as duas não servirem, responda o e-mail que a gente resolve.",
  },
  {
    p: "Como eu entrego o presente?",
    r: "Depois de montar, a gente te dá o link pronto e uma mensagem pra copiar e colar no WhatsApp. Quem entrega é você.",
  },
];

const ENTREGAVEIS_ES = [
  { Icone: Music, titulo: "La canción completa, cantada",
    detalhe: "De principio a fin, sin cortes. Y en dos grabaciones distintas de la misma letra, para que elijas la que más te emocione." },
  { Icone: Images, titulo: "La página regalo, con las fotos de ustedes",
    detalhe: "Hasta 12 fotos, que pasan solas en los cambios de la canción. Es esa página la que mandas, no un archivo suelto." },
  { Icone: Sparkles, titulo: "El karaoke, palabra por palabra",
    detalhe: "Cada palabra se enciende justo cuando se canta. Quien la recibe la sigue y canta contigo." },
  { Icone: QrCode, titulo: "Link y código QR para regalar",
    detalhe: "Mandas el link por WhatsApp, o imprimes el código QR y lo pegas en una caja de chocolates. El regalo digital se vuelve regalo de mano." },
  { Icone: Download, titulo: "El MP3 para descargar y guardar",
    detalhe: "La canción queda en tu celular, para escucharla cuando quieras, con o sin internet." },
  { Icone: RefreshCw, titulo: "¿No quedó a tu gusto? La rehacemos",
    detalhe: "Después de comprar, pides un ajuste en tu cuenta: cambiar una parte de la letra, el estilo o la voz. La volvemos a grabar y te mandamos la nueva versión." },
  { Icone: Pencil, titulo: "Armas el regalo a tu manera",
    detalhe: "Eliges el color de la página, el efecto en pantalla y escribes una frase tuya. Puedes cambiarlo las veces que quieras." },
  { Icone: InfinityIcon, titulo: "Es tuya para siempre",
    detalhe: "La página no expira y el link no deja de funcionar. Pago único, sin mensualidad." },
];

const DUVIDAS_ES = [
  { p: "¿Es un pago único o una suscripción?",
    r: "Único. Pagas una vez y la canción es tuya para siempre. No hay mensualidad, no hay renovación automática, no guardamos tu tarjeta." },
  { p: "¿Cuánto tarda?",
    r: "Hasta 30 minutos, y normalmente menos de 5. Te avisamos por correo en cuanto esté lista, y también puedes armar el regalo ahí mismo, en la pantalla." },
  { p: "¿La canción va a ser igual a la letra que leí?",
    r: "Sí. Es exactamente esa letra la que se va a cantar, palabra por palabra. Nada de cambiarla por otra cosa después del pago." },
  { p: "¿Y si no me gusta la grabación?",
    r: "Recibes dos versiones de la misma letra, con interpretaciones distintas, y eliges cuál se abre cuando la persona la reciba. Si ninguna te sirve, responde el correo y lo resolvemos." },
  { p: "¿Cómo entrego el regalo?",
    r: "Después de armarlo te damos el link listo y un mensaje para copiar y pegar en WhatsApp. Quien lo entrega eres tú." },
];

const COPY = {
  pt: {
    entregaveis: ENTREGAVEIS_PT, duvidas: DUVIDAS_PT,
    voltar: "Voltar pra minha música",
    eyebrow: "falta um passo",
    titulo: (n: string) => `A música de ${n} está gravada.`,
    sub: "Você ouviu um trecho. Ela continua, e termina do jeito que você escreveu.",
    daLetra: (n: string) => `da letra que você escreveu pra ${n}`,
    oQueLeva: "O que você leva",
    provaLegenda: "reações de quem ouviu uma música feita por nós",
    provaSelo: "reações reais",
    ancora: "Encomendar uma música original a um compositor custa a partir de R$ 300, e leva semanas.",
    hojePor: "hoje por", pagamentoUnico: "Pagamento único. Não é assinatura.",
    // Só o ES precisa: o BR cobra na moeda de quem compra.
    conversao: "",
    cta: (n: string) => `Quero a música de ${n}`, ctaCurto: "Quero a música",
    creditoTitulo: (n: number) => (n === 1 ? "Você tem 1 crédito" : `Você tem ${n} créditos`),
    creditoSub: "Esta música já está paga. É só desbloquear.",
    creditoCta: "Usar meu crédito e desbloquear",
    creditoCtaCurto: "Usar meu crédito",
    creditoLabel: "já pago",
    creditoValor: "R$ 0",
    creditoIndo: "Desbloqueando...",
    abrindo: "Abrindo o pagamento…", abrindoCurto: "Abrindo…",
    gateway: "PIX ou cartão, processado pela Perfect Pay",
    antesDePagar: "Antes de pagar",
    suporte: "Qualquer dúvida, escreva pra",
    respondemos: ". A gente responde de verdade.",
    unicoLabel: "pagamento único",
  },
  es: {
    entregaveis: ENTREGAVEIS_ES, duvidas: DUVIDAS_ES,
    voltar: "Regresar a mi canción",
    eyebrow: "falta un paso",
    titulo: (n: string) => `La canción de ${n} ya está grabada.`,
    sub: "Escuchaste un pedazo. Sigue, y termina justo como tú la escribiste.",
    daLetra: (n: string) => `de la letra que escribiste para ${n}`,
    oQueLeva: "Lo que te llevas",
    provaLegenda: "reacciones de quien escuchó una canción hecha por nosotros",
    provaSelo: "reacciones reales",
    // A ANCORAGEM NÃO PODE CITAR MOEDA DE OUTRO PAÍS.
    //
    // Era "mariachi para una serenata cuesta desde $1,500 MXN", escrita quando
    // o alvo era o México. A campanha roda Argentina, Chile, Peru e Colômbia:
    // nesses quatro, mariachi não é o presente concorrente e peso mexicano não
    // é dinheiro. E isto aqui não é a home, é o PAYWALL: a última coisa que a
    // pessoa lê antes de decidir, num idioma que já é o dela, citando uma
    // moeda que não é.
    //
    // A comparação nova vale nos quatro e não precisa de conversão mental.
    ancora: "Un ramo de flores cuesta parecido, dura una semana y nadie lo recuerda.",
    hojePor: "hoy por", pagamentoUnico: "Pago único. No es suscripción.",
    // O checkout da Perfect Pay converte pra moeda local — confirmado pelo
    // dono. Dizer isso ANTES do pulo importa: o preço em dólar numa tela em
    // espanhol levanta a dúvida "vou pagar câmbio?" bem no clique.
    conversao: "Verás el precio en la moneda de tu país al pagar.",
    cta: (n: string) => `Quiero la canción de ${n}`, ctaCurto: "Quiero la canción",
    creditoTitulo: (n: number) => (n === 1 ? "Tienes 1 crédito" : `Tienes ${n} créditos`),
    creditoSub: "Esta canción ya está pagada. Solo falta desbloquearla.",
    creditoCta: "Usar mi crédito y desbloquear",
    creditoCtaCurto: "Usar mi crédito",
    creditoLabel: "ya pagado",
    creditoValor: "$ 0",
    creditoIndo: "Desbloqueando...",
    abrindo: "Abriendo el pago…", abrindoCurto: "Abriendo…",
    // CENTERPAG, não Perfect Pay. É a mesma empresa, mas o checkout
    // internacional se apresenta como Centerpag: aparece no rodapé, no
    // "estás comprando a Centerpag" e no e-mail de suporte da tela.
    // Prometer um nome e mostrar outro no momento do pagamento é o mesmo
    // problema do preço que mudava no caixa, e num público que já desconfia
    // de compra internacional custa mais caro ainda.
    gateway: "Tarjeta, procesado por Centerpag (Perfect Pay)",
    antesDePagar: "Antes de pagar",
    suporte: "Cualquier duda, escríbenos a",
    respondemos: ". Te respondemos de verdad.",
    unicoLabel: "pago único",
  },
} as const;

export function TelaOferta({ aoVoltar, locale = "pt" }: { aoVoltar: () => void; locale?: Locale }) {
  const C = COPY[locale] ?? COPY.pt;
  const G = GARANTIA[locale] ?? GARANTIA.pt;
  // NÃO EXISTE MAIS UM `preco` NESTE CORPO, e isso é a trava.
  //
  // O preço que a pessoa VÊ sai de `PrecoDaOferta`/`PrecoCurto` (as duas
  // versões no HTML, CSS esconde a perdedora — sem piscada no servidor). O
  // preço que vira DINHEIRO sai de `meuPlano` dentro do handler, depois da
  // hidratação, junto do link do checkout. Uma variável só aqui em cima
  // convidaria a usar o número do controle num dos dois lugares errados.
  const [semMusica, setSemMusica] = useState(false);
  // ── O MODO CRÉDITO ────────────────────────────────────────────
  //
  // Quem já pagou por um crédito não pode ser cobrado de novo. Esta tela é o
  // último ponto antes do gateway, então é aqui que a checagem tem que estar:
  // qualquer caminho que chegue no botão de pagar passa por ela.
  //
  // NÃO DEPENDE DO `?credito=1`. O link do painel manda o parâmetro, mas ele
  // se perde no primeiro reload, e um crédito que some porque a pessoa
  // atualizou a página seria cobrança dupla por bug de navegação. A pergunta
  // certa é "esta conta tem saldo?", e ela é respondida pelo servidor.
  //
  // Custo: uma chamada a mais SÓ pra quem está logado. Tráfego de anúncio é
  // anônimo e nem chega no `if`.
  const [credito, setCredito] = useState<{ saldo: number; token: string } | null>(null);
  const [erroCredito, setErroCredito] = useState<string | null>(null);
  const respostas = useQuizStore((s) => s.respostas);
  const email = useQuizStore((s) => s.email);
  const whatsapp = useQuizStore((s) => s.whatsapp);
  // Cupom vindo do e-mail de recuperação. Se existe, o preço na tela TEM que
  // ser o com desconto: o e-mail prometeu um número, e ver outro aqui é o
  // mesmo problema do checkout internacional que a gente acabou de consertar.
  const cupom = useQuizStore((s) => s.cupom);
  const letraFinal = useQuizStore((s) => s.letraFinal);
  const [indo, setIndo] = useState(false);
  const [aberta, setAberta] = useState<number | null>(null);
  const nome = (respostas.nome as string)?.trim() || (locale === "es" ? "quien tú quieres" : "quem você ama");
  // Só mostra desconto se o cupom da store for MESMO o da recuperação: um
  // código digitado na URL por curiosidade não pode reescrever o preço da tela.
  const doFunil = cupomAtivo(locale);
  const descontado = cupom && doFunil && cupom.toUpperCase() === doFunil.codigo ? doFunil : null;

  // O degrau novo do funil: sem este evento, "viu a oferta" e "foi pro
  // checkout" ficariam colados e a tela não serviria de medida.
  useEffect(() => {
    trackEventOnce("oferta_vista", "v1");
  }, []);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const tk = data.session?.access_token;
      if (!tk || !vivo) return;
      const c = await meusCreditos({ data: { token: tk } });
      if (vivo && c.saldo > 0) {
        setCredito({ saldo: c.saldo, token: tk });
        trackEvent("oferta_com_credito", { saldo: c.saldo });
      }
    })().catch(() => {
      // Consulta indisponível: a tela segue cobrando. Ver `pagar`.
    });
    return () => {
      vivo = false;
    };
  }, []);

  // A TRAVA FINAL: não vai pro gateway sem música gravada no servidor.
  //
  // "Nunca cobrar por algo que ainda não foi produzido" é a regra que o
  // projeto trata como inegociável, e até 11/08 ela era só uma consequência do
  // fluxo — nada a verificava. Um comprador pagou R$ 37 e não havia nada pra
  // entregar: ele voltou ao funil com a letra da compra anterior guardada no
  // navegador, o quiz não gerou nada de novo, e o caminho até o checkout
  // confiou no que o navegador dizia.
  //
  // A causa daquele caso já foi consertada no `quiz-store`. Isto aqui é a
  // segunda camada, e é a que vale pra QUALQUER causa futura: pergunta ao
  // servidor, que é o único que sabe o que existe de verdade.
  //
  // Falha do servidor não trava a venda (`catch` deixa passar): indisponível
  // não é o mesmo que inexistente, e barrar comprador por causa de uma
  // consulta que caiu seria trocar um problema raro por um pior.
  // O RESGATE. Não passa pelo gateway: debita o crédito no servidor, grava o
  // pedido e manda pro /obrigado, que é a mesma porta de quem pagou.
  async function resgatar(tk: string) {
    setIndo(true);
    setErroCredito(null);
    try {
      const r = await usarCredito({
        data: { token: tk, sessionId: getOrCreateSessionId() },
      });
      if (r.ok) {
        trackEvent("credito_resgatado", { saldo: r.saldo });
        window.location.href = "/obrigado";
        return;
      }
      if (r.erro === "sem-musica") {
        // Mesma tela do barramento normal: não entrega o que não existe, e o
        // crédito continua intocado porque o servidor confere antes de debitar.
        trackEvent("credito_barrado_sem_musica");
        setSemMusica(true);
        setIndo(false);
        return;
      }
      if (r.erro === "sem-saldo" || r.erro === "sem-conta") {
        // Saldo acabou ou a sessão venceu: volta a ser uma venda normal.
        trackEvent("credito_indisponivel", { erro: r.erro });
        setCredito(null);
        setIndo(false);
        return;
      }
      // `falhou` NÃO cai pro checkout. Mandar pro gateway quem tem crédito
      // seria cobrar duas vezes por causa de um erro nosso.
      setErroCredito(
        locale === "es"
          ? "No pudimos usar tu crédito ahora. Inténtalo de nuevo en un momento."
          : "Não deu pra usar seu crédito agora. Tente de novo daqui a pouco.",
      );
      setIndo(false);
    } catch {
      setErroCredito(
        locale === "es"
          ? "No pudimos usar tu crédito ahora. Inténtalo de nuevo en un momento."
          : "Não deu pra usar seu crédito agora. Tente de novo daqui a pouco.",
      );
      setIndo(false);
    }
  }

  async function pagar() {
    if (credito) {
      await resgatar(credito.token);
      return;
    }
    setIndo(true);
    try {
      const { existe } = await temMusicaDaSessao({
        data: { sessionId: getOrCreateSessionId() },
      });
      if (!existe) {
        trackEvent("checkout_barrado_sem_musica", { locale });
        setSemMusica(true);
        setIndo(false);
        return;
      }
    } catch {
      // Consulta indisponível: segue. Ver comentário acima.
    }
    // O VALOR DO EVENTO É O DAQUELA PESSOA, não o do catálogo.
    //
    // Aqui já passou a hidratação, então `meuPlano` sabe a variante sorteada.
    // Um `valor` fixo faria o painel somar 38 em cima de cliques que iam pagar
    // outra coisa — e o degrau "clicou em comprar" é justamente onde o teste
    // de preço tem que ser lido.
    const plano = meuPlano(locale, { temCupom: Boolean(cupom && descontado) });
    trackEvent("checkout_click", { valor: plano.valor, locale, preco: plano.texto });
    irParaCheckout({
      email: email || undefined,
      telefone: whatsapp || undefined,
      cupom: cupom || undefined,
      locale,
    });
  }

  return (
    <div className="space-y-8 pb-28">
      <button
        onClick={aoVoltar}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> {C.voltar}
      </button>

      {/* ── O QUE ESTÁ EM JOGO ──────────────────────────────── */}
      <div className="space-y-3 text-center">
        <p className="text-[11px] uppercase tracking-[0.25em] text-primary">
          {C.eyebrow}
        </p>
        <h1 className="font-display text-3xl font-semibold leading-tight tracking-tight">
          {C.titulo(nome)}
        </h1>
        <p className="mx-auto max-w-sm text-muted-foreground">
          {C.sub}
        </p>
      </div>

      {/* O verso que a própria pessoa escolheu, devolvido a ela. Não é copy
          nossa: é a linha que ela aprovou minutos atrás. */}
      {letraFinal?.versoDestaque && (
        <blockquote className="mx-auto max-w-sm rounded-2xl border-l-2 border-primary/40 bg-secondary/40 py-4 pl-5 pr-4 text-left">
          <p className="whitespace-pre-line font-display text-lg leading-snug">
            {letraFinal.versoDestaque.split("\n").slice(0, 2).join("\n")}
          </p>
          <footer className="mt-2 text-xs text-muted-foreground">
            {C.daLetra(nome)}
          </footer>
        </blockquote>
      )}

      {/* ── O QUE VEM JUNTO ─────────────────────────────────── */}
      <div>
        <h2 className="mb-4 text-center font-display text-xl font-semibold">
          {C.oQueLeva}
        </h2>
        <ul className="space-y-4 rounded-2xl border bg-card p-5">
          {C.entregaveis.map(({ Icone, titulo, detalhe }) => (
            <li key={titulo} className="flex gap-3">
              <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                <Icone className="h-3.5 w-3.5" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-snug">{titulo}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  {detalhe}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* ── PROVA, logo antes do preço ──────────────────────────
          O TEMA_CLARO vai aqui de propósito: o VitrineVideo usa as variáveis
          da marca (--noite, --tinta-suave) e a rota /criar não as declara —
          sem isto a moldura e a legenda saem sem cor. */}
      <div style={TEMA_CLARO}>
        <VitrineVideo caption={C.provaLegenda} selo={C.provaSelo} />
      </div>

      {/* ── CRÉDITO NO LUGAR DO PREÇO ───────────────────────────
          Ancoragem, cupom e "hoje por" existem pra vencer a decisão de gastar.
          Quem já gastou não tem essa decisão pela frente: mostrar preço aqui
          só levanta a dúvida de estar sendo cobrada de novo. */}
      <div className="rounded-2xl border-2 border-primary/25 bg-primary/5 px-5 py-6 text-center">
        {credito ? (
          <>
            <p className="font-display text-2xl font-semibold tracking-tight">
              {C.creditoTitulo(credito.saldo)}
            </p>
            <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
              {C.creditoSub}
            </p>
          </>
        ) : (
          <>
        <p className="mx-auto max-w-xs text-sm leading-relaxed text-muted-foreground">
          {C.ancora}
        </p>
        <div className="mt-4">
          {/* Com cupom, a âncora deixa de ser o preço inventado e passa a ser
              o preço REAL de quem não tem cupom. É mais forte e é verdade. */}
          <PrecoDaOferta
            locale={locale}
            hojePor={C.hojePor}
            descontado={descontado}
          />
          {descontado && (
            <p className="mt-1.5 inline-block rounded-full bg-emerald-600/10 px-3 py-1 text-xs font-semibold text-emerald-700">
              {locale === "es"
                ? `Cupón ${descontado.codigo} aplicado: ${descontado.texto} de descuento`
                : `Cupom ${descontado.codigo} aplicado: ${descontado.texto} de desconto`}
            </p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            {C.pagamentoUnico}
          </p>
          {C.conversao && (
            <p className="mx-auto mt-2 max-w-xs text-[11px] leading-relaxed text-muted-foreground">
              {C.conversao}
            </p>
          )}
        </div>

        {/* GARANTIA logo ACIMA do botão, não abaixo.
            É a última objeção que passa pela cabeça de quem já quer comprar
            ("e se não ficar bom?"), e ela precisa estar resolvida no instante
            em que o dedo vai no botão — não depois, quando a pessoa já
            desistiu. Verde, e não cor da marca, porque aqui o trabalho é
            parecer seguro, não parecer nosso. */}
        <div className="mt-5 flex items-start gap-2.5 rounded-2xl border border-emerald-600/25 bg-emerald-50/60 px-4 py-3 text-left">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
          <div>
            <p className="text-sm font-semibold text-emerald-900">{G.titulo}</p>
            <p className="text-xs leading-snug text-emerald-800/80">{G.texto}</p>
          </div>
        </div>
          </>
        )}

        {/* Só aparece se a trava barrar. Manda de volta pra revelação, que é
            onde a letra e a música nascem — e não deixa a pessoa presa numa
            tela que não explica nada. */}
        {semMusica && (
          <div className="mt-5 rounded-2xl border border-amber-500/30 bg-amber-50 px-4 py-3 text-left">
            <p className="text-sm font-semibold text-amber-900">
              {locale === "es"
                ? "Tu canción todavía no está lista"
                : "A sua música ainda não está pronta"}
            </p>
            <p className="mt-1 text-xs leading-snug text-amber-800/80">
              {locale === "es"
                ? "No te vamos a cobrar por algo que aún no existe. Ya la pusimos a grabar de nuevo: vuelve a tu letra y escúchala en un par de minutos."
                : "A gente não cobra por algo que ainda não existe. Já colocamos pra gravar de novo: volte pra sua letra e ouça daqui a dois minutinhos."}
            </p>
            <button
              onClick={aoVoltar}
              className="mt-2 text-xs font-semibold text-amber-900 underline underline-offset-4"
            >
              {locale === "es" ? "Volver a mi letra" : "Voltar pra minha letra"}
            </button>
          </div>
        )}

        {erroCredito && (
          <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
            {erroCredito}
          </p>
        )}

        <Button
          size="lg"
          className="cta mt-4 w-full rounded-full border-0"
          disabled={indo}
          onClick={pagar}
        >
          {credito
            ? indo
              ? C.creditoIndo
              : C.creditoCta
            : indo
              ? C.abrindo
              : C.cta(nome)}
        </Button>

        {/* SEGURANÇA NO CLIQUE, e não em letra miúda cinza.
            Medido em 13/08: a taxa de Pix gerado que vira pago caiu de 78% pra
            33% em dois dias, e o suporte encheu de gente dizendo que o banco
            mostrou aviso de golpe. O aviso é do banco e a gente não controla,
            mas ele só mata a venda porque pega a pessoa de surpresa.
            NÃO diz "loja nova": isso confirmaria a suspeita do banco em vez de
            desarmá-la. Diz quem processa (empresa que a pessoa reconhece) e a
            garantia, que responde exatamente o medo que o aviso planta —
            "e se eu pagar e não receber?".
            Os dois elementos já existiam, um acima e outro abaixo do botão, em
            cinza pequeno. Juntar e dar contraste é o que faz virar leitura. */}
        <div className="mt-3 rounded-2xl border border-emerald-600/20 bg-emerald-50/50 px-4 py-2.5">
          <p className="flex items-center justify-center gap-1.5 text-xs font-medium text-emerald-900">
            <ShieldCheck className="h-4 w-4 shrink-0" />
            {C.gateway}
          </p>
          <p className="mt-0.5 text-center text-[11px] leading-snug text-emerald-800/75">
            {G.texto}
          </p>
        </div>
      </div>

      {/* ── OBJEÇÕES ────────────────────────────────────────── */}
      <div>
        <h2 className="mb-3 text-center font-display text-xl font-semibold">
          {C.antesDePagar}
        </h2>
        <div className="divide-y rounded-2xl border bg-card">
          {C.duvidas.map((d, i) => (
            <div key={d.p}>
              <button
                onClick={() => setAberta(aberta === i ? null : i)}
                className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
              >
                <span className="text-sm font-medium">{d.p}</span>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                    aberta === i ? "rotate-180" : ""
                  }`}
                />
              </button>
              {aberta === i && (
                <p className="px-5 pb-4 text-sm leading-relaxed text-muted-foreground">
                  {d.r}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      <p className="text-center text-xs leading-relaxed text-muted-foreground">
        {C.suporte}{" "}
        <a href="mailto:contato@serenatagift.com" className="text-primary underline underline-offset-2">
          contato@serenatagift.com
        </a>
        {C.respondemos}
      </p>

      {/* ── BARRA FIXA ──────────────────────────────────────────
          A página ficou longa de propósito (lista, prova, objeções). Sem a
          barra, quem rola até o fim das dúvidas fica sem botão à mão — que é
          exatamente o erro que a gente acabou de consertar na home. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-xl items-center gap-3 px-4 py-3">
          <div className="min-w-0 shrink-0">
            <p className="text-[10px] leading-none text-muted-foreground">
              {credito ? C.creditoLabel : C.unicoLabel}
            </p>
            {credito ? (
              <p className="font-display text-lg font-semibold leading-tight">
                {C.creditoValor}
              </p>
            ) : (
              <PrecoCurto
                locale={locale}
                descontado={descontado}
                className="font-display text-lg font-semibold leading-tight"
              />
            )}
          </div>
          <Button
            className="cta h-12 flex-1 rounded-full border-0"
            disabled={indo}
            onClick={pagar}
          >
            {indo ? (
              credito ? C.creditoIndo : C.abrindoCurto
            ) : (
              <>
                <Check className="h-4 w-4" /> {credito ? C.creditoCtaCurto : C.ctaCurto}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
