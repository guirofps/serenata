import { useState } from "react";
import { Check, CreditCard, Loader2, Mail, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GARANTIA } from "@/lib/garantia";
import { IdentificacaoDoVendedor } from "@/components/quiz/IdentificacaoDoVendedor";

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
  ancora,
  email,
  aoConfirmar,
  aoEscolherCartao,
  gerando,
}: {
  /** Pra quem é o presente. */
  nome: string;
  /** O nome da música, que já existe e ela já ouviu. */
  titulo: string | null;
  precoTexto: string;
  ancora?: string;
  email: string;
  /** Recebe o e-mail final, já conferido pela pessoa. */
  aoConfirmar: (email: string) => void;
  /** Sai pro checkout hospedado SEM criar cobrança nenhuma. */
  aoEscolherCartao: () => void;
  gerando: boolean;
}) {
  const [valor, setValor] = useState(email);
  const [editando, setEditando] = useState(false);
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
      <div className="rounded-2xl border border-primary/15 px-4 py-3">
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
              onClick={() => setEditando(true)}
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

      <Button
        size="lg"
        className="w-full"
        disabled={gerando || !valido}
        onClick={() => aoConfirmar(valor.trim())}
      >
        {gerando ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gerando o seu PIX...
          </>
        ) : (
          "Gerar meu PIX"
        )}
      </Button>

      <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
        {g.curto}
      </p>

      {/* ── O CARTÃO SAI DAQUI, ANTES DE EXISTIR COBRANÇA ────────
          Este botão estava só na tela do QR, e isso obrigava quem queria
          cartão a gerar um PIX que nunca seria pago só pra descobrir onde
          clicar. Errado por dois motivos: enche a conta da Woovi de cobrança
          morta, e faz a pessoa passar por uma tela que não é pra ela.

          Cartão é 12,8% das vendas (uns R$ 8.000/mês). Merece a saída no
          primeiro passo, não no segundo. */}
      <div className="border-t border-primary/10 pt-4">
        <p className="mb-2 text-center text-xs text-muted-foreground">
          Prefere cartão, ou quer parcelar?
        </p>
        <Button variant="outline" size="lg" className="w-full" onClick={aoEscolherCartao}>
          <CreditCard className="mr-2 h-4 w-4" /> Pagar com cartão
        </Button>
      </div>

      <IdentificacaoDoVendedor />
    </div>
  );
}
