import { useEffect, useState } from "react";
import { useQuizStore } from "@/lib/quiz-store";
import { irParaCheckout } from "@/lib/checkout";
import { temMusicaDaSessao, finalizarLetra } from "@/lib/coautoria";
import { meusCreditos } from "@/lib/meus-creditos";
import { usarCredito } from "@/lib/usar-credito";
import {
  creditoNoNavegador,
  esquecerCreditoNoNavegador,
} from "@/lib/credito-no-navegador";
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
import { varianteDe } from "@/lib/experimentos";
import { PixTransparente } from "@/components/quiz/PixTransparente";
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

// ── ATENÇÃO: ESTA COPY ESTÁ EM RIOPLATENSE ────────────────────────
//
// O entregável e o FAQ em espanhol foram reescritos pro mercado ARGENTINO —
// voseo (`mandás`, `elegís`, `podés`, `sos vos`) e vocabulário local (`celu`,
// `bombones`). Não é o espanhol neutro-mexicano em que o resto do funil
// nasceu.
//
// Diferente de `textos.ts`, `textos-presente.ts` e `quiz-flow-ar.ts`, aqui a
// troca é DIRETA e não uma sobreposição por mercado: são arrays de objetos
// com ícone, e duplicá-los inteiros criaria o irmão que o CLAUDE.md manda
// evitar.
//
// O preço disso é um acoplamento: virar `mercado-es.ts` de volta pra `latam`
// ou `espanha` entrega voseo a quem não fala voseo. Pra esse acoplamento não
// ser silencioso, existe `src/lib/mercado-copy.test.ts`, que FALHA se o
// interruptor sair de `argentina` sem esta copy ser revisitada. Se o teste te
// trouxe até aqui: reescreva as duas listas abaixo no espanhol do mercado
// novo, e só então mude a lista do teste.
const ENTREGAVEIS_ES = [
  { Icone: Music, titulo: "La canción completa, cantada",
    detalhe: "De principio a fin, sin cortes. Y en dos grabaciones distintas de la misma letra, para que elijas la que más te emocione." },
  { Icone: Images, titulo: "La página regalo, con las fotos de ustedes",
    detalhe: "Hasta 12 fotos, que pasan solas en los cambios de la canción. Es esa página la que mandás, no un archivo suelto." },
  { Icone: Sparkles, titulo: "El karaoke, palabra por palabra",
    detalhe: "Cada palabra se enciende justo cuando se canta. Quien la recibe la sigue y canta con vos." },
  { Icone: QrCode, titulo: "Link y código QR para regalar",
    detalhe: "Mandás el link por WhatsApp, o imprimís el código QR y lo pegás en una caja de bombones. El regalo digital se vuelve regalo de mano." },
  { Icone: Download, titulo: "El MP3 para descargar y guardar",
    detalhe: "La canción queda en tu celu, para escucharla cuando quieras, con o sin internet." },
  { Icone: RefreshCw, titulo: "¿No quedó a tu gusto? La rehacemos",
    detalhe: "Después de comprar, pedís un ajuste en tu cuenta: cambiar una parte de la letra, el estilo o la voz. La volvemos a grabar y te mandamos la nueva versión." },
  { Icone: Pencil, titulo: "Armás el regalo a tu manera",
    detalhe: "Elegís el color de la página, el efecto en pantalla y escribís una frase tuya. Podés cambiarlo las veces que quieras." },
  { Icone: InfinityIcon, titulo: "Es tuya para siempre",
    detalhe: "La página no expira y el link no deja de funcionar. Pago único, sin mensualidad." },
];

const DUVIDAS_ES = [
  { p: "¿Es un pago único o una suscripción?",
    r: "Único. Pagás una vez y la canción es tuya para siempre. No hay mensualidad, no hay renovación automática, no guardamos tu tarjeta." },
  { p: "¿Cuánto tarda?",
    r: "Hasta 30 minutos, y normalmente menos de 5. Te avisamos por correo en cuanto esté lista, y también podés armar el regalo ahí mismo, en la pantalla." },
  { p: "¿La canción va a ser igual a la letra que leí?",
    r: "Sí. Es exactamente esa letra la que se va a cantar, palabra por palabra. Nada de cambiarla por otra cosa después del pago." },
  { p: "¿Y si no me gusta la grabación?",
    r: "Recibís dos versiones de la misma letra, con interpretaciones distintas, y elegís cuál se abre cuando la persona la reciba. Si ninguna te sirve, respondé el correo y lo resolvemos." },
  { p: "¿Cómo entrego el regalo?",
    r: "Después de armarlo te damos el link listo y un mensaje para copiar y pegar en WhatsApp. El que lo entrega sos vos." },
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
    // SEM CITAR PROCESSADOR, e não por preguiça de atualizar.
    //
    // Até 27/08 dizia "processado pela Perfect Pay", e isso virou mentira no
    // minuto em que o PIX passou pra Woovi — mentira num SELO DE CONFIANÇA,
    // que é o pior lugar possível pra ela estar.
    //
    // Nomear os dois ("PIX pela Woovi, cartão pela Perfect Pay") seria
    // verdade e seria pior: são dois nomes que o comprador nunca ouviu, na
    // linha logo abaixo do botão de pagar. O que tranquiliza ali não é QUEM
    // processa, é que o dinheiro é rastreável e o pagamento é único.
    gateway: "PIX ou cartão. Pagamento único, em ambiente seguro",
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
    sub: "Escuchaste un pedazo. Sigue, y termina justo como la escribiste vos.",
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
  // ── O BARRAMENTO NÃO MANDA MAIS EMBORA ────────────────────────
  //
  // Medido em 3 dias: 40 sessões clicaram em comprar e foram barradas por
  // falta de música, 205 cliques no total (a mesma pessoa insistindo 5 vezes).
  // A tela dizia "volte pra sua letra e ouça daqui a dois minutinhos", e a
  // medição de 11/08 já dizia o que acontece depois: NENHUMA volta.
  //
  // É o pior lugar do funil pra mandar alguém embora — o dedo já estava no
  // botão. E o motivo do barramento é sempre o mesmo: a música ainda está
  // gravando, ou falhou e acabou de ser recolocada na fila por
  // `temMusicaDaSessao`. Nos dois casos ela existe em ~90 segundos.
  //
  // Então a pessoa fica AQUI. A tela passa a esperar junto com ela e, quando
  // o arquivo aparece, segue pro pagamento sozinha. Zero clique a mais.
  //
  // `semMusica` virou máquina de 3 estados em vez de booleano:
  //   null       -> nada aconteceu
  //   "esperando"-> gravando, o relógio corre na tela
  //   "demorou"  -> passou o teto, aí sim oferece a saída manual
  const [semMusica, setSemMusica] = useState<null | "esperando" | "demorou">(null);
  const [esperaSeg, setEsperaSeg] = useState(0);
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
  // `token` é a sessão (quando existe) e `tokenEdicao` é o crachá de posse.
  // Um dos dois é sempre preenchido; ver o efeito que consulta o saldo.
  const [credito, setCredito] = useState<{
    saldo: number;
    token: string | null;
    tokenEdicao: string | null;
  } | null>(null);
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
  // O PIX na própria página. Guarda o preço JÁ formatado, porque a folha só
  // repete o que a pessoa acabou de ler na oferta: quem decide o valor de
  // verdade é o servidor, em `criar-pix.ts`, e nunca este componente.
  // `valor` entra junto do texto porque o order bump do quadro precisa somar
  // em cima do preco DAQUELE braco, e mostrar o total certo na folha. O texto
  // sozinho ("R$ 38") nao se soma.
  const [pagandoComPix, setPagandoComPix] = useState<{ texto: string; ancora?: string; valor: number } | null>(
    null,
  );
  const [aberta, setAberta] = useState<number | null>(null);
  const nome = (respostas.nome as string)?.trim() || (locale === "es" ? "quien vos querés" : "quem você ama");
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
      // Dinâmico pelo mesmo motivo do `lead-capture`: 207 KB de SDK não
      // podem estar no caminho que precisa terminar antes de o botão
      // "continuar" ganhar comportamento.
      const { supabase } = await import("@/lib/supabase-client");
      const { data } = await supabase.auth.getSession();
      const tk = data.session?.access_token;
      // ── AS DUAS CREDENCIAIS ──────────────────────────────
      //
      // Até 02/09 esta consulta parava aqui quando não havia sessão, e isso
      // fechava o crédito pra 84% dos compradores — os que nunca clicam no
      // magic link. Deixou de ser detalhe no dia em que o pacote de R$ 28
      // passou a ser vendido na `/obrigado` e no e-mail de entrega, ou seja,
      // exatamente pra quem não tem login: a pessoa pagava R$ 28 e esta tela
      // pedia R$ 38 de novo.
      //
      // O crachá é o `token_edicao` guardado no navegador quando ela pagou
      // (`credito-no-navegador.ts`). Ele é PROVA de posse, não afirmação: o
      // servidor resolve o dono por ele e tira o e-mail de `pedidos`.
      const cracha = tk ? null : creditoNoNavegador();
      if ((!tk && !cracha) || !vivo) return;
      const c = await meusCreditos({
        data: tk ? { token: tk } : { tokenEdicao: cracha as string },
      });
      if (!vivo) return;
      if (c.saldo > 0) {
        setCredito({ saldo: c.saldo, token: tk ?? null, tokenEdicao: cracha });
        trackEvent("oferta_com_credito", { saldo: c.saldo, via: tk ? "sessao" : "cracha" });
      } else if (cracha) {
        // Saldo zerado com crachá na mão: ele já foi gasto. Some, senão a
        // próxima música consulta de novo e a tela promete crédito a quem não
        // tem mais.
        esquecerCreditoNoNavegador();
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
  // Sem argumento: as credenciais vivem no estado `credito`, preenchido pelo
  // efeito que consulta o saldo. Passar o token por parametro era resto de
  // quando so existia a sessao.
  async function resgatar() {
    setIndo(true);
    setErroCredito(null);
    try {
      const r = await usarCredito({
        data: {
          token: credito?.token ?? undefined,
          tokenEdicao: credito?.tokenEdicao ?? undefined,
          sessionId: getOrCreateSessionId(),
        },
      });
      if (r.ok) {
        trackEvent("credito_resgatado", { saldo: r.saldo });
        // Gastou: o crachá não serve mais e não pode sobreviver pra prometer
        // crédito na próxima.
        if (r.saldo <= 0) esquecerCreditoNoNavegador();
        window.location.href = "/obrigado";
        return;
      }
      if (r.erro === "sem-musica") {
        // Mesma tela do barramento normal: não entrega o que não existe, e o
        // crédito continua intocado porque o servidor confere antes de debitar.
        trackEvent("credito_barrado_sem_musica");
        esperarMusica("credito");
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

  // ESPERA A MÚSICA NA PRÓPRIA TELA, e segue sozinha quando ela chega.
  //
  // Teto de 4 minutos: a medição real do pipeline é 84s a 110s do pedido ao
  // arquivo, e uma repescagem inteira cabe folgada em 240s. Passou disso, o
  // problema não é tempo — é falha — e aí a saída manual é honesta.
  //
  // O `setIndo(true)` FICA LIGADO de propósito: o botão continua em estado de
  // carregando, que é exatamente o que está acontecendo. Desligar faria a
  // pessoa clicar de novo, que é o que os 205 cliques de 40 sessões eram.
  const TETO_ESPERA = 240;

  /**
   * TENTA CRIAR A MÚSICA QUE NUNCA FOI CRIADA.
   *
   * Existe um estado em que a pessoa tem a letra pronta no navegador e o banco
   * não tem música nenhuma: `finalizarLetra` rodou antes de a linha do quiz
   * existir e desistiu em silêncio. Foram 12 casos em 7 dias, e o desfecho de
   * todos foi este botão barrando alguém que queria pagar.
   *
   * A causa está consertada nos dois lados (o servidor cria o lead que falta,
   * o `RevealStep` tenta de novo). Isto aqui é pra quem JÁ está nesse estado:
   * a letra dela está no `letraFinal` da store, e é tudo que falta pra criar a
   * música. Sem isto, a espera abaixo giraria quatro minutos esperando algo
   * que ninguém pediu.
   *
   * Não gasta Suno à toa: se a música existir, o servidor devolve a existente
   * pela idempotência e não gera nada.
   */
  async function tentarRecriarMusica() {
    const letra = useQuizStore.getState().letraFinal;
    if (!letra?.letra || !letra.titulo) return;
    try {
      trackEvent("oferta_recriou_musica", { locale });
      await finalizarLetra({
        data: {
          sessionId: getOrCreateSessionId(),
          respostas: useQuizStore.getState().respostas,
          letra: letra.letra,
          titulo: letra.titulo,
          estiloSuno: letra.estiloSuno,
          versoDestaque: letra.versoDestaque ?? "",
          locale,
        },
      });
    } catch (err) {
      console.error("[oferta] recriar música falhou:", err);
    }
  }

  function esperarMusica(origem: "checkout" | "credito") {
    setIndo(true);
    setSemMusica("esperando");
    setEsperaSeg(0);
    // Dispara antes do relógio: quem chegou aqui sem música ou está gerando
    // (e o poll resolve) ou nunca foi criada (e só isto resolve).
    void tentarRecriarMusica();
    const t0 = Date.now();
    const relogio = setInterval(() => {
      setEsperaSeg(Math.round((Date.now() - t0) / 1000));
    }, 1000);
    const parar = () => {
      clearInterval(relogio);
      clearInterval(sonda);
    };
    const sonda = setInterval(async () => {
      const decorrido = (Date.now() - t0) / 1000;
      if (decorrido > TETO_ESPERA) {
        parar();
        trackEvent("espera_musica_estourou", { origem, locale });
        setSemMusica("demorou");
        setIndo(false);
        return;
      }
      try {
        const { existe } = await temMusicaDaSessao({
          data: { sessionId: getOrCreateSessionId() },
        });
        if (!existe) return;
        parar();
        trackEvent("espera_musica_resolvida", {
          origem,
          locale,
          segundos: Math.round(decorrido),
        });
        setSemMusica(null);
        // Segue o caminho que ela tinha escolhido. `pagar` é declaração de
        // função e está içada, então dá pra chamar daqui de cima.
        if (origem === "credito" && credito) void resgatar();
        else void pagar();
      } catch {
        // Consulta caiu: tenta de novo no próximo tique. Não desiste por uma
        // falha de rede em cima de alguém que quer pagar.
      }
    }, 5000);
  }

  async function pagar() {
    // O TOQUE, ANTES DE QUALQUER ESPERA.
    //
    // Em 31/08 o `checkout_click` caiu de 15 pra 4 numa janela em que
    // `oferta_vista` ficou igual (16 contra 18) e o funil inteiro a montante
    // nao mudou (musica_pronta 11x11, preview_limite 15x15). Ficou impossivel
    // saber o que tinha acontecido, porque o primeiro evento desta funcao so
    // dispara DEPOIS de um `await` a uma server function — se ela travar, nao
    // sai evento nenhum e o sintoma e indistinguivel de "ninguem clicou".
    //
    // Este evento separa as duas coisas. `botao_comprar` sem `checkout_click`
    // logo em seguida significa que a pessoa TOCOU e a tela engasgou; sem os
    // dois, ela nao tocou. Custa um evento e transforma o proximo incidente
    // de mistério em leitura.
    trackEvent("botao_comprar", { locale, braco_bump: varianteDe("bump_quadro") });
    if (credito) {
      await resgatar();
      return;
    }
    setIndo(true);
    try {
      const { existe } = await temMusicaDaSessao({
        data: { sessionId: getOrCreateSessionId() },
      });
      if (!existe) {
        trackEvent("checkout_barrado_sem_musica", { locale });
        esperarMusica("checkout");
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

    // ── O CHECKOUT TRANSPARENTE ──────────────────────────────────
    //
    // O QR do PIX aparece AQUI, sem a pessoa sair do site. Dois ganhos
    // medidos: 70% de quem clica em comprar não gera pedido nenhum (~250 por
    // dia), e a taxa cai de 11,39% (R$ 4,63 de média) pra R$ 0,50 por venda.
    //
    // Cartão NÃO se perde: é 12,8% das vendas (uns R$ 8.000/mês) e sai pelo
    // botão "Pagar com cartão" da folha, que cai no `aoDesistir` logo abaixo
    // e vai pro checkout da Perfect Pay de sempre.
    //
    // DUAS EXCEÇÕES, e as duas por moeda/produto e não por gosto:
    //   - o funil espanhol cobra em DÓLAR na Perfect Pay, e a Woovi só faz
    //     PIX brasileiro;
    //   - quem chega com cupom da recuperação: o desconto existe como PRODUTO
    //     da Perfect Pay, e o e-mail já prometeu aquele número exato.
    //
    // `checkout_pix` é interruptor, não teste (ver a nota em experimentos.ts):
    // desligar o `ativo` no painel devolve TODO MUNDO pro checkout antigo no
    // próximo carregamento, inclusive quem já tinha a variante guardada.
    if (
      locale === "pt" &&
      !cupom &&
      varianteDe("checkout_pix") === "B"
    ) {
      // `trackEvent`, NÃO `trackEventOnce`.
      //
      // O `Once` deduplica por navegador, e aqui isso apagava o funil: quem
      // fecha a folha e clica em comprar de novo gera um `checkout_click`
      // novo (que é evento normal) e NENHUM `abriu`. A razão click→folha,
      // que é o número que esta migração existe pra mover, saía menor que a
      // realidade e piorando a cada reabertura.
      //
      // Visto ao vivo às 19:04, na primeira hora: três cliques em comprar e
      // um `abriu` só.
      trackEvent("pix_transparente_abriu", { valor: plano.valor });
      setPagandoComPix({ texto: plano.texto, ancora: plano.ancora, valor: Number(plano.valor) || 0 });
      setIndo(false);
      return;
    }

    irParaCheckout({
      email: email || undefined,
      telefone: whatsapp || undefined,
      cupom: cupom || undefined,
      locale,
    });
  }

  return (
    <div className="space-y-8 pb-28">
      {/* ── A FOLHA DO PIX ──────────────────────────────────────
          POR CIMA da oferta, não no lugar dela. A pessoa acabou de ouvir a
          música nesta tela; tirar isso de baixo dela na hora de pagar seria
          jogar fora o motivo pelo qual ela clicou.

          Folha de baixo pra cima porque 99% é celular: é onde o polegar
          alcança, e é o gesto que o aplicativo do banco já ensinou. */}
      {pagandoComPix && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <button
            aria-label="Fechar"
            onClick={() => {
              trackEvent("pix_transparente_fechou");
              setPagandoComPix(null);
            }}
            className="absolute inset-0 bg-foreground/40 backdrop-blur-[2px]"
          />
          <div className="relative max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-primary/10 bg-background px-5 pb-8 pt-4 shadow-2xl sm:rounded-3xl">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted-foreground/25 sm:hidden" />
            <PixTransparente
              nome={nome}
              titulo={letraFinal?.titulo ?? null}
              valorTexto={pagandoComPix.texto}
              valorBase={pagandoComPix.valor}
              ancora={pagandoComPix.ancora}
              email={email ?? ""}
              // A SAÍDA DE EMERGÊNCIA. Fecha a folha e vai pro checkout de
              // sempre: cartão, e o caminho de volta se o nosso PIX falhar.
              aoDesistir={() => {
                trackEvent("pix_transparente_desistiu");
                setPagandoComPix(null);
                irParaCheckout({
                  email: email || undefined,
                  telefone: whatsapp || undefined,
                  cupom: cupom || undefined,
                  locale,
                });
              }}
            />
          </div>
        </div>
      )}

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
        {/* ESPERANDO: a pessoa não sai da tela, e o pagamento abre sozinho.
            O texto conta a verdade (está gravando) e mostra o relógio, que é
            o oposto da barra que trava em 99% da Cantoria. */}
        {semMusica === "esperando" && (
          <div className="mt-5 rounded-2xl border border-primary/25 bg-secondary/50 px-4 py-3 text-left">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <RefreshCw className="h-4 w-4 animate-spin text-primary" />
              {locale === "es"
                ? "Estamos terminando de grabar tu canción"
                : "Estamos terminando de gravar a sua música"}
            </p>
            <p className="mt-1 text-xs leading-snug text-muted-foreground">
              {locale === "es"
                ? "No te cobramos por algo que todavía no existe. Quédate aquí: en cuanto esté, el pago se abre solo."
                : "A gente não cobra por algo que ainda não existe. Fica aqui: assim que ficar pronta, o pagamento abre sozinho."}
            </p>
            <p className="mt-2 text-xs font-medium tabular-nums text-primary">
              {Math.floor(esperaSeg / 60)}:{String(esperaSeg % 60).padStart(2, "0")}
            </p>
          </div>
        )}

        {/* DEMOROU DEMAIS: aí sim é falha, e a saída manual é honesta. */}
        {semMusica === "demorou" && (
          <div className="mt-5 rounded-2xl border border-amber-500/30 bg-amber-50 px-4 py-3 text-left">
            <p className="text-sm font-semibold text-amber-900">
              {locale === "es"
                ? "La grabación está tardando más de lo normal"
                : "A gravação está demorando mais que o normal"}
            </p>
            <p className="mt-1 text-xs leading-snug text-amber-800/80">
              {locale === "es"
                ? "Tu letra está guardada y la canción sigue en la fila. Te la mandamos por correo en cuanto salga, y no pagas nada hasta escucharla."
                : "A sua letra está guardada e a música continua na fila. Mandamos por e-mail assim que sair, e você não paga nada antes de ouvir."}
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
