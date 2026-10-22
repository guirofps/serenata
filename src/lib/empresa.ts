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

// QUEM RECEBE O PAGAMENTO DA SERENATA (22/10): o titular da conta do Asaas
// (PIX e cartão) e da Woovi desde a troca de CNPJ de 21/10. É o nome que o app
// do banco mostra na hora de pagar ("ROCKETFY TECNOLOGIA LTDA", Santo André),
// e a tela de pagamento tem que dizer o MESMO nome. Até 21/10 o banco mostrava
// "45835258 GUILHERME ROJA" e a tela o CNPJ 45.835.258: batiam. Com a conta
// nova, a tela seguiu dizendo "Serenata, CNPJ 45.835.258" e o banco outra
// empresa em outra cidade, cara de golpe no instante de transferir.
// Só a tela de pagamento lê isto; rodapé, termos e a Ballad seguem no EMPRESA.
export const RECEBEDOR = {
  /** Como o banco mostra (campo 59 do código PIX). */
  nome: "ROCKETFY TECNOLOGIA LTDA",
  cnpj: "69498792000172",
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
