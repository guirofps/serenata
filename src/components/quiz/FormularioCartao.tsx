import { useEffect, useState } from "react";
import { CreditCard, Loader2, Lock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GARANTIA } from "@/lib/garantia";
import { IdentificacaoDoVendedor } from "@/components/quiz/IdentificacaoDoVendedor";
import { mascaraTelefone, telefoneValido } from "@/lib/telefone";
import {
  mascaraCpf, cpfValido,
  mascaraCep, cepValido,
  mascaraCartao, cartaoValido,
  mascaraValidade, validadeValida, partesValidade,
} from "@/lib/documentos";

// O CARTÃO, NA NOSSA TELA.
//
// ── O QUE ELE PEDE, E POR QUE NÃO DÁ PRA PEDIR MENOS ─────────────
//
// CPF, CEP, número do endereço e telefone são exigência do antifraude do
// Asaas, medida uma a uma contra a API deles: tirar qualquer um devolve 400.
// Mas eles NÃO pedem rua, bairro nem cidade — por isso "endereço" aqui são
// dois campos curtos, não um formulário de entrega.
//
// ── O CELULAR PREENCHE METADE DISSO SOZINHO ──────────────────────
//
// Os `autocomplete` de cartão (`cc-number`, `cc-exp`, `cc-csc`, `cc-name`) são
// o que faz o iPhone e o Android oferecerem o cartão salvo e preencherem os
// quatro campos de uma vez. Num funil 99% mobile, isso vale mais que qualquer
// máscara: transforma metade do formulário em um toque.
//
// ── O NOME NÃO VEM PRÉ-PREENCHIDO, E ISSO É DE PROPÓSITO ─────────
//
// A gente tem `respostas.nome`, mas é o nome da pessoa HOMENAGEADA, não o do
// comprador. Foi exatamente essa confusão que gravou um pedido como "Manuela"
// e fez a contestação do Antônio levar uma hora pra ser encontrada. Preencher
// isso como titular do cartão geraria recusa em massa.

type Campo = { valor: string; tocado: boolean };
const vazio = (): Campo => ({ valor: "", tocado: false });

export function FormularioCartao({
  precoTexto,
  emailDoQuiz,
  telefoneDoQuiz,
  cobrando,
  erro,
  aoPagar,
  aoVoltar,
}: {
  precoTexto: string;
  /** Vem do quiz, sempre existe. A pessoa pode corrigir. */
  emailDoQuiz: string;
  /** Vem da tela de espera, existe em ~34% dos casos. */
  telefoneDoQuiz?: string | null;
  cobrando: boolean;
  /** A recusa do banco, em português. Some quando ela mexe em algo. */
  erro: string | null;
  aoPagar: (dados: {
    cartao: { numero: string; titular: string; validadeMes: string; validadeAno: string; cvv: string };
    titular: { nome: string; email: string; cpf: string; cep: string; numeroEndereco: string; telefone: string };
  }) => void;
  aoVoltar: () => void;
}) {
  const [numero, setNumero] = useState(vazio);
  const [nome, setNome] = useState(vazio);
  const [validade, setValidade] = useState(vazio);
  const [cvv, setCvv] = useState(vazio);
  const [cpf, setCpf] = useState(vazio);
  const [cep, setCep] = useState(vazio);
  const [numEnd, setNumEnd] = useState(vazio);
  const [email, setEmail] = useState<Campo>({ valor: emailDoQuiz ?? "", tocado: false });
  const [tel, setTel] = useState<Campo>({
    valor: telefoneDoQuiz ? mascaraTelefone(telefoneDoQuiz, "pt") : "",
    tocado: false,
  });

  // ── O CEP CONFIRMADO EM VOZ ALTA ───────────────────────────
  //
  // O Asaas não usa a rua, então buscar o CEP não preenche campo nenhum. Ele
  // serve pra outra coisa: CEP errado é recusa do antifraude, e a pessoa não
  // descobre o porquê. Mostrar "Rua Tal, Blumenau" embaixo do campo faz ela
  // ver o erro antes de gastar a tentativa.
  const [lugar, setLugar] = useState<string | null>(null);
  useEffect(() => {
    const d = cep.valor.replace(/\D/g, "");
    if (d.length !== 8) {
      setLugar(null);
      return;
    }
    let vivo = true;
    fetch(`https://viacep.com.br/ws/${d}/json/`)
      .then((r) => r.json())
      .then((j) => {
        if (!vivo) return;
        // CEP inexistente devolve `{ erro: true }` com HTTP 200.
        setLugar(j?.erro ? "CEP não encontrado" : [j.logradouro, j.bairro, j.localidade].filter(Boolean).join(", "));
      })
      .catch(() => vivo && setLugar(null)); // busca fora do ar não trava a compra
    return () => {
      vivo = false;
    };
  }, [cep.valor]);

  const regras = {
    numero: cartaoValido(numero.valor) || "Confere o número do cartão.",
    nome: nome.valor.trim().length >= 3 || "Escreve o nome como está no cartão.",
    validade: validadeValida(validade.valor) || "Validade inválida ou vencida.",
    cvv: /^\d{3,4}$/.test(cvv.valor) || "O código de segurança tem 3 ou 4 números.",
    cpf: cpfValido(cpf.valor) || "Confere o CPF.",
    cep: cepValido(cep.valor) || "O CEP tem 8 números.",
    numEnd: numEnd.valor.trim().length >= 1 || "Falta o número.",
    email: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.valor) || "Confere o e-mail.",
    tel: telefoneValido(tel.valor, "pt") || "Confere o telefone com DDD.",
  } as const;
  const tudoOk = Object.values(regras).every((r) => r === true);

  function enviar() {
    if (!tudoOk || cobrando) return;
    const { mes, ano } = partesValidade(validade.valor);
    aoPagar({
      cartao: {
        numero: numero.valor.replace(/\D/g, ""),
        titular: nome.valor.trim(),
        validadeMes: mes,
        validadeAno: ano,
        cvv: cvv.valor,
      },
      titular: {
        nome: nome.valor.trim(),
        email: email.valor.trim().toLowerCase(),
        cpf: cpf.valor.replace(/\D/g, ""),
        cep: cep.valor.replace(/\D/g, ""),
        numeroEndereco: numEnd.valor.trim(),
        telefone: tel.valor.replace(/\D/g, ""),
      },
    });
  }

  const campo = (
    rotulo: string,
    c: Campo,
    set: (v: Campo) => void,
    regra: true | string,
    extra: React.InputHTMLAttributes<HTMLInputElement>,
    mascara?: (v: string) => string,
  ) => (
    <label className="block">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{rotulo}</span>
      <input
        {...extra}
        value={c.valor}
        onChange={(e) => set({ valor: mascara ? mascara(e.target.value) : e.target.value, tocado: c.tocado })}
        onBlur={() => set({ ...c, tocado: true })}
        className="mt-1 w-full rounded-xl border border-primary/20 bg-background px-3 py-2.5 text-base"
      />
      {c.tocado && regra !== true && (
        <span className="mt-1 block text-xs text-destructive">{regra}</span>
      )}
    </label>
  );

  return (
    <div className="space-y-4">
      <div className="text-center">
        <p className="text-[11px] uppercase tracking-[0.2em] text-primary">Pague com cartão</p>
        <p className="font-display text-3xl font-semibold">{precoTexto}</p>
      </div>

      {/* `autocomplete` de cartão junto, num bloco só: é o que faz o celular
          reconhecer o conjunto e oferecer o cartão salvo de uma vez. */}
      <div className="space-y-3 rounded-2xl border border-primary/15 p-4">
        {campo("Número do cartão", numero, setNumero, regras.numero, {
          inputMode: "numeric", autoComplete: "cc-number", placeholder: "0000 0000 0000 0000",
        }, mascaraCartao)}
        {campo("Nome impresso no cartão", nome, setNome, regras.nome, {
          autoComplete: "cc-name", autoCapitalize: "characters", placeholder: "COMO ESTÁ NO CARTÃO",
        })}
        <div className="grid grid-cols-2 gap-3">
          {campo("Validade", validade, setValidade, regras.validade, {
            inputMode: "numeric", autoComplete: "cc-exp", placeholder: "MM/AA",
          }, mascaraValidade)}
          {campo("Código", cvv, setCvv, regras.cvv, {
            inputMode: "numeric", autoComplete: "cc-csc", placeholder: "123", maxLength: 4,
          })}
        </div>
      </div>

      <div className="space-y-3 rounded-2xl border border-primary/15 p-4">
        <p className="text-xs text-muted-foreground">
          O banco pede estes dados pra autorizar a compra.
        </p>
        {campo("CPF do titular", cpf, setCpf, regras.cpf, {
          inputMode: "numeric", placeholder: "000.000.000-00",
        }, mascaraCpf)}
        <div className="grid grid-cols-[1fr_auto] gap-3">
          {campo("CEP", cep, setCep, regras.cep, {
            inputMode: "numeric", autoComplete: "postal-code", placeholder: "00000-000",
          }, mascaraCep)}
          {campo("Número", numEnd, setNumEnd, regras.numEnd, {
            inputMode: "numeric", placeholder: "123", className: "w-24",
          })}
        </div>
        {lugar && <p className="-mt-1 text-xs text-muted-foreground">{lugar}</p>}
        {campo("Telefone", tel, setTel, regras.tel, {
          inputMode: "tel", autoComplete: "tel", placeholder: "(00) 00000-0000",
        }, (v) => mascaraTelefone(v, "pt"))}
        {campo("E-mail", email, setEmail, regras.email, {
          inputMode: "email", autoComplete: "email", type: "email",
        })}
      </div>

      {erro && (
        <p className="rounded-xl bg-destructive/10 px-3 py-2.5 text-center text-sm text-destructive">
          {erro}
        </p>
      )}

      <Button size="lg" className="cta w-full" disabled={!tudoOk || cobrando} onClick={enviar}>
        {cobrando ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Autorizando…
          </>
        ) : (
          <>
            <CreditCard className="mr-2 h-4 w-4" /> Pagar {precoTexto}
          </>
        )}
      </Button>

      <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <Lock className="h-3 w-3" /> Os dados do cartão não ficam guardados aqui.
      </p>
      <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> {GARANTIA.pt.curto}
      </p>

      {/* SAÍDA SEMPRE VISÍVEL. Quem abriu o cartão e mudou de ideia volta pro
          PIX com um toque, em vez de fechar a folha e sumir. */}
      <button
        type="button"
        onClick={aoVoltar}
        disabled={cobrando}
        className="w-full text-center text-sm text-primary underline underline-offset-4"
      >
        Prefiro pagar por PIX
      </button>

      <IdentificacaoDoVendedor />
    </div>
  );
}
