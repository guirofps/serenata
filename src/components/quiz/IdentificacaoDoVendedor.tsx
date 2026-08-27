import { EMPRESA, cnpjFormatado, temIdentificacao } from "@/lib/empresa";

// QUEM ESTÁ RECEBENDO O DINHEIRO, no rodapé da tela de pagamento.
//
// No checkout hospedado isso vinha de graça: a marca do gateway na tela já
// dizia "tem empresa por trás disso". Ao trazer o pagamento pra dentro do
// nosso site, a prova sumiu junto, e a tela passou a pedir dinheiro sem dizer
// pra quem.
//
// Vale mais no PIX do que valeria no cartão: PIX é transferência, não existe
// chargeback, e o comprador sabe disso. O que substitui a rede de segurança é
// saber quem recebeu — e é por isso que a Cantoria põe o CNPJ no checkout.
//
// Discreto de propósito. Isto não é argumento de venda, é lastro: quem está
// tranquilo nem lê, e quem hesitou procura exatamente por isso.

export function IdentificacaoDoVendedor() {
  // Sem o dado, nada é mostrado. Meia identificação é pior que nenhuma.
  if (!temIdentificacao()) return null;
  return (
    <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
      {EMPRESA.nome}
      <br />
      CNPJ {cnpjFormatado()}
    </p>
  );
}
