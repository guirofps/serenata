// QUEM ESTÁ COBRANDO, com nome e CNPJ.
//
// ── POR QUE ISTO IMPORTA NUMA TELA DE PAGAMENTO ──────────────────
//
// No checkout hospedado a identificação do vendedor vinha de graça: a marca
// do gateway na tela já dizia "tem empresa por trás disso". Ao trazer o
// pagamento pra dentro do nosso site, essa prova sumiu junto — e a tela
// passou a pedir dinheiro sem dizer pra quem.
//
// A Cantoria mostra o CNPJ no checkout, e não é decoração: PIX é
// transferência, não compra com cartão. Não existe chargeback, e a pessoa
// sabe disso. O que substitui a rede de segurança é saber quem recebeu.
//
// ── O BLOCO SÓ APARECE SE O DADO EXISTIR ─────────────────────────
//
// `cnpj` vazio esconde o bloco inteiro, de propósito. Meia identificação
// ("Serenata" sem número) é pior que nenhuma: parece que tentaram e não
// conseguiram. E CNPJ é dado que ninguém deve chutar — errar um dígito é
// dizer que a empresa é outra.

export const EMPRESA = {
  /** Razão social ou nome fantasia, como aparece no comprovante do PIX. */
  nome: "Serenata",
  /** Só dígitos. A formatação é feita na hora de mostrar. */
  cnpj: "45835258000146",
} as const;

// QUEM RESPONDE PELA SERENATA no rodapé, nos termos e na privacidade (18/10).
// É a empresa da conta do Google Ads, e o que o site mostra tem que bater com
// ela na verificação de operações comerciais. O bloco da tela de pagamento
// continua no EMPRESA acima, que é quem recebe hoje (bate com o comprovante do
// PIX); quando o Asaas migrar pra este CNPJ, o EMPRESA passa a ser este.
// Só Serenata: a Ballad segue com o EMPRESA.
export const RESPONSAVEL = {
  razaoSocial: "EM CIMA ASSISTÊNCIA MÉDICA LTDA",
  cnpj: "06974663000193",
  endereco:
    "Rua Manuel de Oliveira, 269, salas 212, 213 e 220, Vila Mogilar, Mogi das Cruzes/SP, CEP 08773-130",
} as const;

/** `12345678000190` -> `12.345.678/0001-90`. Vazio devolve vazio. */
export function cnpjFormatado(cnpj: string = EMPRESA.cnpj): string {
  const d = cnpj.replace(/\D/g, "");
  if (d.length !== 14) return "";
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

/** Tem o suficiente pra identificar o vendedor na tela? */
export function temIdentificacao(): boolean {
  return Boolean(EMPRESA.nome && cnpjFormatado());
}
