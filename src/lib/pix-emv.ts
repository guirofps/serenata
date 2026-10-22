// O NOME QUE O BANCO VAI MOSTRAR, lido do próprio código PIX (22/10/2026).
//
// O copia-e-cola é um EMV (BR Code): campos "id de 2 dígitos + tamanho de 2
// dígitos + valor". O campo 59 é o nome do recebedor, o mesmo que o app do
// banco mostra antes de confirmar. Ler daqui, e não de uma constante, faz o
// aviso da tela de pagamento dizer a verdade em qualquer cobrança: a da conta
// nova ("ROCKETFY TECNOLOGIA LTDA"), a da antiga reaberta pelo e-mail
// ("45835258 GUILHERME ROJA"), Woovi ou Asaas.
//
// Puro, sem imports.

/** O valor de um campo de primeiro nível do EMV, ou `null`. */
export function campoEmv(codigo: string, id: string): string | null {
  const s = String(codigo ?? "");
  let i = 0;
  while (i + 4 <= s.length) {
    const tag = s.slice(i, i + 2);
    const tam = Number(s.slice(i + 2, i + 4));
    if (!/^\d{2}$/.test(tag) || !Number.isInteger(tam)) return null;
    if (tag === id) return s.slice(i + 4, i + 4 + tam);
    i += 4 + tam;
  }
  return null;
}

/** O nome do recebedor (campo 59), sem espaço sobrando. Vazio = `null`. */
export function recebedorDoPix(codigo: string): string | null {
  const nome = campoEmv(codigo, "59")?.trim();
  return nome ? nome : null;
}
