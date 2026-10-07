// O CUPOM QUE CHEGA PELO LINK (campanha MUSICA10, 07/10).
//
// Qualquer página que abra com `?cupom=` guarda o código na store do quiz e
// TIRA o parâmetro da URL: link copiado, print e compartilhamento não levam o
// cupom adiante. Quem decide se ele vale é o servidor, na cobrança; aqui só se
// guarda o código, limpo (letras e números, até 20).

export function separarCupomDaUrl(href: string): { cupom: string | null; semCupom: string | null } {
  const u = new URL(href);
  const bruto = u.searchParams.get("cupom");
  if (bruto === null) return { cupom: null, semCupom: null };
  u.searchParams.delete("cupom");
  const limpo = bruto.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20);
  return { cupom: limpo || null, semCupom: u.toString() };
}

export function guardarCupomDaUrl(setCupom: (c: string) => void): void {
  try {
    const { cupom, semCupom } = separarCupomDaUrl(window.location.href);
    if (cupom) setCupom(cupom);
    if (semCupom) window.history.replaceState(window.history.state, "", semCupom);
  } catch {
    // Navegação privada / URL estranha: segue sem cupom, nunca quebra a página.
  }
}
