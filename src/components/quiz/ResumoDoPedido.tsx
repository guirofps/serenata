import { useRef, useState } from "react";
import { emailPlausivel } from "@/lib/email-limpo";
import { useFarolDaFolha } from "@/lib/farol-folha";
import {
  Check,
  ChevronDown,
  CreditCard,
  Loader2,
  Mail,
  MessageCircle,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { GARANTIA } from "@/lib/garantia";
import { IdentificacaoDoVendedor } from "@/components/quiz/IdentificacaoDoVendedor";
import { BUMPS, TEXTO_BUMP, type ItemBump } from "@/lib/bump";
import { mascaraTelefone, telefoneValido } from "@/lib/telefone";
import { varianteDe } from "@/lib/experimentos";
import { sugerirEmail } from "@/lib/email-typo";
import { trackEvent } from "@/lib/track";
import { cpfValido, soDigitosCpf } from "@/lib/cpf";
import { cpfNoResumo, rotuloGerar, type BracoFolha } from "@/lib/folha-pix";
import { CampoCpf } from "@/components/quiz/CampoCpf";

// O preco sai do MESMO catalogo que o servidor usa pra compor a cobranca
// (`src/lib/bump.ts`). Cravar o valor aqui deixaria a tela e a cobranca livres
// pra discordar, que e a unica forma deste bump virar reclamacao.
const precoDoItem = (item: ItemBump) => BUMPS[item].centavos / 100;
const reais = (v: number) =>
  `R$ ${v.toFixed(2).replace(".", ",").replace(/,00$/, "")}`;

// O PASSO ANTES DO QR.
//
// ── POR QUE ELE EXISTE ───────────────────────────────────────────
//
// A primeira versão do checkout transparente ia do botão direto pro QR. Isso
// tem duas consequências, e a segunda só apareceu com o painel da Woovi
// aberto na frente:
//
// 1. CREDIBILIDADE. Um QR sozinho não diz o que está sendo comprado, nem
//    quanto valia antes, nem que existe garantia. O checkout hospedado dizia
//    tudo isso de graça, porque tinha uma página inteira pra isso. A Cantoria
//    põe um passo aqui pelo mesmo motivo — e o CPF que eles pedem não é o
//    ponto, o COMPROMISSO é.
//
// 2. COBRANÇA NASCIDA DE UM TOQUE. Sem este passo, tocar no botão já criava
//    uma cobrança na Woovi. Em 28 minutos foram 11 delas, quase todas de
//    gente que só foi ver quanto custava. Não custa dinheiro (cobrança não
//    paga não tem taxa), mas suja a leitura: o "PIX gerado -> pago" deixa de
//    ser comparável com o histórico, onde o PIX só nascia depois do
//    formulário do gateway.
//
// ── E O E-MAIL AQUI NÃO É ENFEITE ────────────────────────────────
//
// É a última chance de consertar endereço errado ANTES de a pessoa pagar. O
// suporte já mostrou qual é o gargalo real desta operação: quase nunca é
// defeito de produto, é comprador que não achou o caminho de volta. E-mail
// digitado errado no quiz é a origem mais comum disso, e depois da compra
// custa uma conversa; aqui custa um toque.

export function ResumoDoPedido({
  nome,
  titulo,
  precoTexto,
  precoBase,
  ancora,
  email,
  telefoneInicial,
  quadro,
  item = "quadro",
  aoTrocarQuadro,
  aoConfirmar,
  aoEscolherCartao,
  gerando,
  braco = "A",
  cpfInicial = "",
}: {
  /** Pra quem é o presente. */
  nome: string;
  /** O nome da música, que já existe e ela já ouviu. */
  titulo: string | null;
  precoTexto: string;
  /** O preco em reais, pra somar o quadro e mostrar o total. */
  precoBase: number;
  ancora?: string;
  email: string;
  /** O WhatsApp que o quiz ja capturou, se existir. */
  telefoneInicial: string;
  /** `null` desliga o order bump (braco de controle do experimento). */
  quadro: boolean | null;
  /** QUAL item a caixinha oferece: o braço do experimento `bump_quadro` decide. */
  item?: ItemBump;
  aoTrocarQuadro: (v: boolean) => void;
  /**
   * Recebe o e-mail final, já conferido pela pessoa. O CPF só vem nos braços
   * B e C do `folha_pix` (já conferido nos dígitos); no A ele é `undefined` e
   * o servidor pede pela tela do CPF, como sempre.
   */
  aoConfirmar: (email: string, telefone: string, cpf?: string) => void;
  /** Sai pro checkout hospedado SEM criar cobrança nenhuma. */
  aoEscolherCartao: () => void;
  gerando: boolean;
  /** Braço do teste `folha_pix`. Sem ele, a folha de sempre (A). */
  braco?: BracoFolha;
  /** CPF que este navegador já usou (`lerCpfGuardado`). Só B e C leem. */
  cpfInicial?: string;
}) {
  const [valor, setValor] = useState(email);
  const [editando, setEditando] = useState(false);
  // ── O WHATSAPP ───────────────────────────────────────
  //
  // Comeca com o que o quiz ja tem. Medido em 11/09: 38% dos pedidos ja
  // chegam aqui com numero, e pra esses NAO existe campo nenhum — existe uma
  // linha dizendo que o codigo tambem vai pro WhatsApp deles. Isso nao e
  // atrito, e promessa de entrega no instante da decisao.
  //
  // Os outros 62% veem o campo. E o unico jeito de a automacao da Woovi
  // (que manda o codigo do PIX no WhatsApp) alcancar mais que uma minoria.
  const [tel, setTel] = useState(telefoneInicial ?? "");
  const [editandoTel, setEditandoTel] = useState(false);
  const telOk = telefoneValido(tel, "pt");
  // O campo do MEIO do funil continua onde esta, e isto aqui nao o substitui:
  // 72% dos numeros que a gente coleta vem de gente que nunca chega a gerar
  // PIX (799 em 4 dias). Tirar de la pra "nao perguntar duas vezes" trocaria
  // ~200 contatos/dia por um atrito que este pre-preenchimento ja elimina.
  const pedirWhats = varianteDe("whats_no_pix") === "B";
  // Pra levar a pessoa ate o campo quando o botao recusa: dizer "confere o
  // e-mail" sem mostrar onde ele esta e a mesma falha, so que educada.
  const caixaEmail = useRef<HTMLDivElement | null>(null);
  // O que a pessoa fez aqui dentro, pra quem abandona parar de ser um
  // numero unico e virar dois grupos com remedios opostos. Ver `farol-folha.ts`.
  const farol = useFarolDaFolha();
  const g = GARANTIA.pt;
  const valido = emailPlausivel(valor);

  // ── TESTE `folha_pix` (08/10) ──────────────────────────────────
  //
  // B e C trazem o CPF pra cá, colado no botão; o C ainda enxuga o resumo.
  // No A nada disto aparece e a folha é a de sempre. Ver `folha-pix.ts`.
  const comCpf = cpfNoResumo(braco);
  const [cpf, setCpf] = useState(() => soDigitosCpf(cpfInicial));
  const [tentouPagar, setTentouPagar] = useState(false);
  const campoCpf = useRef<HTMLInputElement | null>(null);
  const [abriuRecebo, setAbriuRecebo] = useState(false);
  const totalTexto = quadro === true ? reais(precoBase + precoDoItem(item)) : precoTexto;

  function confirmar() {
    // ── BOTÃO MORTO NÃO EXPLICA NADA ──────────────────
    //
    // Antes ele nascia `disabled` quando o e-mail não passava no
    // regex, e o passo do contato já ensinou o que isso produz: a
    // pessoa toca, nada acontece, e ela conclui que o site quebrou.
    //
    // Medido: entre quem NÃO gerou o PIX, 5,7% estava sem e-mail na
    // sessão, contra 0,4% entre quem gerou. É 14x, e pra essas
    // pessoas o botão era literalmente impossível de usar.
    //
    // Agora ele responde: abre o campo e diz o que falta.
    if (!valido) {
      farol.email();
      setEditando(true);
      caixaEmail.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    // Mesma regra pro CPF nos braços B e C: o toque sem CPF não morre, ele
    // leva até o campo e diz o que falta. Focar dentro do próprio toque é o
    // que abre o teclado numérico no iPhone (fora do gesto ele ignora).
    if (comCpf && !cpfValido(cpf)) {
      setTentouPagar(true);
      trackEvent("pix_cpf_inline_faltou", { braco, digitos: cpf.length });
      campoCpf.current?.focus();
      campoCpf.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    farol.gerou();
    // Telefone invalido NAO barra a venda: o campo e opcional e o
    // gateway recusa a cobranca inteira se receber numero torto.
    // Manda vazio e segue — a mensagem de WhatsApp e um bonus, o
    // pagamento e o produto.
    aoConfirmar(valor.trim(), telOk ? tel : "", comCpf ? cpf : undefined);
  }

  const listaEntregaveis = (
    <ul className="space-y-2 rounded-2xl bg-secondary/40 px-4 py-3.5">
      {[
        "A música completa, nas duas gravações",
        "A página presente, com as fotos de vocês",
        "O karaokê, palavra por palavra",
        "Link e QR Code pra mandar, e o MP3 pra baixar",
      ].map((item) => (
        <li key={item} className="flex items-start gap-2 text-sm leading-snug">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          {item}
        </li>
      ))}
    </ul>
  );

  const precoComAncora = (
    <div className="flex items-baseline justify-center gap-2">
      {ancora && (
        <span className="text-sm text-muted-foreground line-through">{ancora}</span>
      )}
      <span className="font-display text-3xl font-semibold">{precoTexto}</span>
    </div>
  );

  // ── "VOCÊ QUIS DIZER…?" TAMBÉM AQUI (28/09) ─────────────
  // O quiz já sugere a correção, mas dá pra ignorar. Em dois dias, dois
  // compradores pagaram com `@gmail.co` e a entrega foi pro nada: um
  // abriu contestação em potencial, o outro ficou sem a música. Esta é
  // a última tela antes do dinheiro sair, e aqui o aviso aparece MESMO
  // sem a pessoa tocar em "trocar". Sugere, não bloqueia, pelo mesmo
  // motivo do quiz: domínio de empresa é imprevisível.
  const sugestaoEmail = (() => {
    const sugestao = sugerirEmail(valor);
    if (!sugestao || sugestao === valor.trim().toLowerCase()) return null;
    return (
      <button
        type="button"
        onClick={() => {
          trackEvent("email_typo_corrigido", { de: valor, para: sugestao, onde: "resumo" });
          setValor(sugestao);
          setEditando(false);
        }}
        className="mt-2 w-full rounded-lg bg-amber-50 px-3 py-2 text-left text-xs text-amber-900 ring-1 ring-amber-200"
      >
        Esse e-mail parece ter um erro. Você quis dizer{" "}
        <strong className="font-semibold underline underline-offset-2">{sugestao}</strong>? Toque pra corrigir.
      </button>
    );
  })();

  const campoEmail = (
    <input
      type="email"
      inputMode="email"
      autoComplete="email"
      value={valor}
      onChange={(e) => setValor(e.target.value)}
      className="mt-1 w-full rounded-lg border border-primary/20 bg-background px-2.5 py-1.5 text-sm"
      autoFocus
    />
  );

  const botaoTrocarEmail = (
    <button
      type="button"
      onClick={() => {
        farol.email();
        setEditando(true);
      }}
      className="shrink-0 text-xs text-primary underline underline-offset-4"
    >
      trocar
    </button>
  );

  /* ── PRA ONDE VAI ────────────────────────────────────────
     Mostrado sempre, editável em um toque. Ver o cabeçalho: endereço
     errado consertado aqui custa um toque; consertado depois custa uma
     conversa com o suporte. */
  const blocoEmail = (
    <div ref={caixaEmail} className="rounded-2xl border border-primary/15 px-4 py-3">
      <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
        <Mail className="h-3.5 w-3.5" /> Enviamos pra
      </p>
      {editando ? (
        campoEmail
      ) : (
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium">{valor || "sem e-mail"}</span>
          {botaoTrocarEmail}
        </div>
      )}
      {editando && !valido && (
        <p className="mt-1 text-xs text-amber-700">Confere esse endereço.</p>
      )}
      {sugestaoEmail}
    </div>
  );

  /* O mesmo e-mail, numa linha só (braço C). Mesma edição, mesmo aviso,
     mesma sugestão de correção: enxugar a folha não pode tirar a última
     chance de consertar endereço antes de pagar. */
  const linhaEmail = (
    <div ref={caixaEmail} className="px-1">
      {editando ? (
        <>
          <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
            <Mail className="h-3.5 w-3.5" /> Enviamos pra
          </p>
          {campoEmail}
        </>
      ) : (
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
            <Mail className="h-3.5 w-3.5 shrink-0" />
            <span className="shrink-0">Enviamos pra</span>
            <span className="truncate font-medium text-foreground">{valor || "sem e-mail"}</span>
          </span>
          {botaoTrocarEmail}
        </div>
      )}
      {editando && !valido && (
        <p className="mt-1 text-xs text-amber-700">Confere esse endereço.</p>
      )}
      {sugestaoEmail}
    </div>
  );

  /* ── O CÓDIGO TAMBÉM NO WHATSAPP ────────────────────
     Atrás de experimento porque é decisão nova nesta tela, e foi
     exatamente isso que derrubou a conversão em 31/08 com o order bump.
     Com espelho dá pra saber se caiu por causa disto ou por causa da
     noite; sem espelho, vira adivinhação. */
  const blocoWhats = pedirWhats && (
    <div className="rounded-2xl border border-primary/15 px-4 py-3">
      <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
        <MessageCircle className="h-3.5 w-3.5" /> O código também no WhatsApp
      </p>
      {telOk && !editandoTel ? (
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium">{mascaraTelefone(tel, "pt")}</span>
          <button
            type="button"
            onClick={() => setEditandoTel(true)}
            className="shrink-0 text-xs text-primary underline underline-offset-4"
          >
            trocar
          </button>
        </div>
      ) : (
        <>
          <input
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            value={mascaraTelefone(tel, "pt")}
            onChange={(e) => setTel(e.target.value)}
            placeholder="(11) 91234-5678"
            className="mt-1 w-full rounded-lg border border-primary/20 bg-background px-2.5 py-1.5 text-sm"
            aria-label="WhatsApp"
          />
          {/* Só reclama quando já há número suficiente pra julgar: avisar
              "inválido" no terceiro dígito é reclamar de algo que a pessoa
              ainda está fazendo. */}
          {tel.replace(/\D/g, "").length >= 10 && !telOk && (
            <p className="mt-1 text-xs text-amber-700">Confere esse número.</p>
          )}
        </>
      )}
      <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
        Opcional. Serve pra você receber o código sem precisar voltar aqui.
      </p>
    </div>
  );

  /* ── O QUADRO, COMPRADO JUNTO ────────────────────────────
     Uma caixa, DESMARCADA por padrao, entre o e-mail e o botao.

     Aqui e nao no painel por causa da INTENCAO. Medido de 17 a 31/08,
     PIX gerados contra pagos: R$ 38 paga 56,3%, R$ 29 paga 60,5%,
     R$ 19 paga 68,1% — e o quadro a R$ 24,90, vendido depois da compra,
     paga 26,5%. Sao 86 cobrancas mortas em 14 dias. No painel a pessoa
     abre a folha pra ver quanto custa; aqui ela ja decidiu pagar.

     Uma linha, sem tela nova e sem segundo passo: o unico jeito de um
     order bump nao custar conversao na venda principal e ele nao pedir
     uma segunda decisao de verdade. Desmarcada por padrao porque marcar
     sozinho e cobrar por descuido, e isso volta como reembolso. */
  const blocoBump = quadro !== null && (
    <button
      type="button"
      onClick={() => {
        farol.bump();
        aoTrocarQuadro(!quadro);
      }}
      aria-pressed={quadro}
      className={`flex w-full items-start gap-3 rounded-2xl border px-4 py-3 text-left transition-colors ${
        quadro ? "border-primary/50 bg-primary/5" : "border-primary/15"
      }`}
    >
      <span
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
          quadro ? "border-primary bg-primary text-primary-foreground" : "border-primary/30"
        }`}
      >
        {quadro && <Check className="h-3.5 w-3.5" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-medium">{TEXTO_BUMP[item].titulo}</span>
          <span className="shrink-0 text-right">
            {TEXTO_BUMP[item].de && (
              <span className="mr-1.5 text-xs text-muted-foreground line-through">
                {TEXTO_BUMP[item].de}
              </span>
            )}
            <span className="text-sm font-semibold text-primary">
              + {reais(precoDoItem(item))}
            </span>
          </span>
        </span>
        <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
          {TEXTO_BUMP[item].sub}
        </span>
      </span>
    </button>
  );

  const blocoTotal = quadro === true && (
    <p className="text-center text-sm text-muted-foreground">
      Total: <span className="font-semibold text-foreground">{reais(precoBase + precoDoItem(item))}</span>
    </p>
  );

  /* ── O CARTÃO SAI DAQUI, ANTES DE EXISTIR COBRANÇA ────────
     Este botão estava só na tela do QR, e isso obrigava quem queria
     cartão a gerar um PIX que nunca seria pago só pra descobrir onde
     clicar. Errado por dois motivos: enche a conta da Woovi de cobrança
     morta, e faz a pessoa passar por uma tela que não é pra ela.

     Cartão é 12,8% das vendas (uns R$ 8.000/mês). Merece a saída no
     primeiro passo, não no segundo. */
  const blocoCartao = (
    <div className="border-t border-primary/10 pt-4">
      <p className="mb-2 text-center text-xs text-muted-foreground">
        Prefere cartão, ou quer parcelar?
      </p>
      <Button variant="outline" size="lg" className="w-full" onClick={aoEscolherCartao}>
        <CreditCard className="mr-2 h-4 w-4" /> Pagar com cartão
      </Button>
    </div>
  );

  const campoCpfNoResumo = comCpf && (
    <CampoCpf
      ref={campoCpf}
      valor={cpf}
      aoMudar={setCpf}
      tentouPagar={tentouPagar}
      lembrado={cpfValido(cpfInicial)}
      aoEnter={confirmar}
      aoComecar={() => trackEvent("pix_cpf_inline_digitou", { braco })}
    />
  );

  const linhaGarantia = (
    <p className="mt-2 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
      <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
      {g.curto}
    </p>
  );

  // ── BRAÇO C: O RESUMO ENXUTO ───────────────────────────────────
  //
  // 44% de quem não toca em gerar sai em menos de 5s sem rolar: bate num
  // resumo comprido. Aqui fica só o que decide a compra (o que é, quanto
  // custa, pra onde vai, o CPF e o botão com o valor). A lista do que vem
  // não sumiu, foi pra trás de "O que eu recebo?", fechada.
  //
  // A barra fixa fica no MEIO do DOM, logo depois do CPF, e não no fim como
  // no A: com o resumo curto ela cabe na tela sem rolar, e cartão e CNPJ
  // vêm depois, na ordem em que alguém hesitante procura por eles.
  if (braco === "C") {
    return (
      <div className="space-y-4">
        <div className="text-center">
          <h2 className="font-display text-xl font-semibold leading-tight">
            {titulo ?? `A música de ${nome}`}
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">para {nome}</p>
        </div>

        <div className="space-y-1.5">
          {precoComAncora}
          <button
            type="button"
            aria-expanded={abriuRecebo}
            onClick={() => {
              if (!abriuRecebo) trackEvent("pix_folha_recebo_abriu", { braco });
              setAbriuRecebo(!abriuRecebo);
            }}
            className="mx-auto flex items-center gap-1 text-xs text-primary underline underline-offset-4"
          >
            O que eu recebo?
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${abriuRecebo ? "rotate-180" : ""}`}
            />
          </button>
        </div>

        {abriuRecebo && listaEntregaveis}

        {linhaEmail}

        {blocoWhats}

        {blocoBump}

        {blocoTotal}

        <div
          ref={farol.refDoBotao}
          className="sticky bottom-0 -mx-5 border-t border-primary/10 bg-background px-5 pb-3 pt-3"
        >
          {campoCpfNoResumo}
          <Button
            size="lg"
            className="h-14 w-full text-base font-semibold"
            disabled={gerando}
            onClick={confirmar}
          >
            {gerando ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gerando o seu PIX...
              </>
            ) : (
              rotuloGerar("C", totalTexto)
            )}
          </Button>
          {linhaGarantia}
        </div>

        {blocoCartao}

        <div className="pb-1">
          <IdentificacaoDoVendedor />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="text-center">
        <p className="text-[11px] uppercase tracking-[0.25em] text-primary">Seu pedido</p>
        <h2 className="mt-1 font-display text-xl font-semibold leading-tight">
          {titulo ?? `A música de ${nome}`}
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">para {nome}</p>
      </div>

      {listaEntregaveis}

      {precoComAncora}

      {blocoEmail}

      {blocoWhats}

      {blocoBump}

      {blocoTotal}

      {/* FICA ACIMA DO BOTÃO DE PIX no DOM porque o de PIX virou barra fixa
          (abaixo). Quem não rola vê a barra; quem rola encontra o cartão. */}
      {blocoCartao}

      {/* O respiro existe pra a barra fixa não comer o CNPJ quando a folha
          chega no fim. Medido: sem ele sobram 11px de sobreposição, e a linha
          coberta é justamente a que prova que existe empresa atrás disto. */}
      <div className="pb-3">
        <IdentificacaoDoVendedor />
      </div>

      {/* ── O BOTÃO DE PAGAR NASCIA FORA DA TELA ────────────────
          Medido em 02/09, na folha real a 375px: o conteúdo tem 879px e a
          folha mostra 747px. O "Gerar meu PIX" terminava a 647px do topo
          dela, ou seja, só aparecia sem rolar em aparelho com mais de ~704px
          de viewport VISÍVEL. Com a barra de endereço aberta, num iPhone SE
          ou num Android intermediário, ele não existia até a pessoa descobrir
          que aquela folha rola por dentro — e ela não parece rolar, porque a
          página atrás não se mexe.

          O que isso produzia: 1.006 sessões abriram a folha em 7 dias, 460
          geraram o código, e 488 sumiram SEM TOCAR EM NADA. Sem fechar, sem
          ir pro cartão, sem marcar o bump. É o comportamento de quem não
          achou o botão, não o de quem desistiu do preço.

          Como barra fixa ele existe em qualquer tela. É a última posição do
          DOM de propósito: `sticky bottom-0` fica colado até o fim do
          conteúdo, então qualquer bloco depois dele seria coberto.

          No braço B (`folha_pix`) o CPF entra AQUI, em cima do botão: é o
          "colado no botão" do teste, e quem não rola vê os dois juntos. */}
      <div
        ref={farol.refDoBotao}
        className="sticky bottom-0 -mx-5 -mb-8 border-t border-primary/10 bg-background px-5 pb-6 pt-3"
      >
        {campoCpfNoResumo}
        <Button size="lg" className="w-full" disabled={gerando} onClick={confirmar}>
          {gerando ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gerando o seu PIX...
            </>
          ) : (
            rotuloGerar(braco, totalTexto)
          )}
        </Button>

        {linhaGarantia}
      </div>
    </div>
  );
}
