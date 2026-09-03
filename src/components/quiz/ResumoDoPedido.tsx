import { useRef, useState } from "react";
import { useFarolDaFolha } from "@/lib/farol-folha";
import { Check, CreditCard, Loader2, Mail, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GARANTIA } from "@/lib/garantia";
import { IdentificacaoDoVendedor } from "@/components/quiz/IdentificacaoDoVendedor";
import { OFERTAS } from "@/lib/creditos";

// O preco sai do MESMO catalogo que o servidor usa pra compor a cobranca
// (`criar-pix.ts`). Cravar 24,90 aqui deixaria a tela e a cobranca livres pra
// discordar, que e a unica forma deste bump virar reclamacao.
const PRECO_QUADRO = OFERTAS.find((o) => o.id === "quadro")?.precoBrl ?? 24.9;
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
  quadro,
  aoTrocarQuadro,
  aoConfirmar,
  aoEscolherCartao,
  gerando,
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
  /** `null` desliga o order bump (braco de controle do experimento). */
  quadro: boolean | null;
  aoTrocarQuadro: (v: boolean) => void;
  /** Recebe o e-mail final, já conferido pela pessoa. */
  aoConfirmar: (email: string) => void;
  /** Sai pro checkout hospedado SEM criar cobrança nenhuma. */
  aoEscolherCartao: () => void;
  gerando: boolean;
}) {
  const [valor, setValor] = useState(email);
  const [editando, setEditando] = useState(false);
  // Pra levar a pessoa ate o campo quando o botao recusa: dizer "confere o
  // e-mail" sem mostrar onde ele esta e a mesma falha, so que educada.
  const caixaEmail = useRef<HTMLDivElement | null>(null);
  // O que a pessoa fez aqui dentro, pra quem abandona parar de ser um
  // numero unico e virar dois grupos com remedios opostos. Ver `farol-folha.ts`.
  const farol = useFarolDaFolha();
  const g = GARANTIA.pt;
  const valido = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(valor.trim());

  return (
    <div className="space-y-5">
      <div className="text-center">
        <p className="text-[11px] uppercase tracking-[0.25em] text-primary">Seu pedido</p>
        <h2 className="mt-1 font-display text-xl font-semibold leading-tight">
          {titulo ?? `A música de ${nome}`}
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">para {nome}</p>
      </div>

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

      <div className="flex items-baseline justify-center gap-2">
        {ancora && (
          <span className="text-sm text-muted-foreground line-through">{ancora}</span>
        )}
        <span className="font-display text-3xl font-semibold">{precoTexto}</span>
      </div>

      {/* ── PRA ONDE VAI ────────────────────────────────────────
          Mostrado sempre, editável em um toque. Ver o cabeçalho: endereço
          errado consertado aqui custa um toque; consertado depois custa uma
          conversa com o suporte. */}
      <div ref={caixaEmail} className="rounded-2xl border border-primary/15 px-4 py-3">
        <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
          <Mail className="h-3.5 w-3.5" /> Enviamos pra
        </p>
        {editando ? (
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            className="mt-1 w-full rounded-lg border border-primary/20 bg-background px-2.5 py-1.5 text-sm"
            autoFocus
          />
        ) : (
          <div className="mt-0.5 flex items-center justify-between gap-2">
            <span className="truncate text-sm font-medium">{valor || "sem e-mail"}</span>
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
          </div>
        )}
        {editando && !valido && (
          <p className="mt-1 text-xs text-amber-700">Confere esse endereço.</p>
        )}
      </div>

      {/* ── O QUADRO, COMPRADO JUNTO ────────────────────────────
          Uma caixa, DESMARCADA por padrao, entre o e-mail e o botao.

          Aqui e nao no painel por causa da INTENCAO. Medido de 17 a 31/08,
          PIX gerados contra pagos: R$ 38 paga 56,3%, R$ 29 paga 60,5%,
          R$ 19 paga 68,1% — e o quadro a R$ 24,90, vendido depois da compra,
          paga 26,5%. Sao 86 cobrancas mortas em 14 dias. No painel a pessoa
          abre a folha pra ver quanto custa; aqui ela ja decidiu pagar.

          Uma linha, sem tela nova e sem segundo passo: o unico jeito de um
          order bump nao custar conversao na venda principal e ele nao pedir
          uma segunda decisao de verdade. Desmarcada por padrao porque marcar
          sozinho e cobrar por descuido, e isso volta como reembolso. */}
      {quadro !== null && (
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
              <span className="text-sm font-medium">Levar o quadro pra imprimir</span>
              <span className="shrink-0 text-sm font-semibold text-primary">
                + {reais(PRECO_QUADRO)}
              </span>
            </span>
            <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
              A letra e a foto numa folha pronta pra emoldurar. Sai no mesmo PIX.
            </span>
          </span>
        </button>
      )}

      {quadro === true && (
        <p className="text-center text-sm text-muted-foreground">
          Total: <span className="font-semibold text-foreground">{reais(precoBase + PRECO_QUADRO)}</span>
        </p>
      )}

      {/* ── O CARTÃO SAI DAQUI, ANTES DE EXISTIR COBRANÇA ────────
          Este botão estava só na tela do QR, e isso obrigava quem queria
          cartão a gerar um PIX que nunca seria pago só pra descobrir onde
          clicar. Errado por dois motivos: enche a conta da Woovi de cobrança
          morta, e faz a pessoa passar por uma tela que não é pra ela.

          Cartão é 12,8% das vendas (uns R$ 8.000/mês). Merece a saída no
          primeiro passo, não no segundo.

          FICA ACIMA DO BOTÃO DE PIX no DOM porque o de PIX virou barra fixa
          (abaixo). Quem não rola vê a barra; quem rola encontra o cartão. */}
      <div className="border-t border-primary/10 pt-4">
        <p className="mb-2 text-center text-xs text-muted-foreground">
          Prefere cartão, ou quer parcelar?
        </p>
        <Button variant="outline" size="lg" className="w-full" onClick={aoEscolherCartao}>
          <CreditCard className="mr-2 h-4 w-4" /> Pagar com cartão
        </Button>
      </div>

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
          conteúdo, então qualquer bloco depois dele seria coberto. */}
      <div
        ref={farol.refDoBotao}
        className="sticky bottom-0 -mx-5 -mb-8 border-t border-primary/10 bg-background px-5 pb-6 pt-3"
      >
        <Button
          size="lg"
          className="w-full"
          disabled={gerando}
          onClick={() => {
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
            farol.gerou();
            aoConfirmar(valor.trim());
          }}
        >
          {gerando ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gerando o seu PIX...
            </>
          ) : (
            "Gerar meu PIX"
          )}
        </Button>

        <p className="mt-2 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
          {g.curto}
        </p>
      </div>
    </div>
  );
}
