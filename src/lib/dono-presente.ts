// "Este navegador é o DONO deste presente?"
//
// Serve pra mostrar o botão de baixar o MP3 na própria página-presente, que é
// onde o comprador volta quando quer o arquivo depois de já ter enviado o
// link. Virou ticket de suporte em 03/08 ("como baixa a música?"): o botão só
// existia no editor, e quem já mandou o presente não lembra do link do editor.
//
// A marca é gravada no editor (só quem tem o `token_edicao` chega lá) e lida
// na página pública. É localStorage e não URL de propósito: pôr o
// `token_edicao` no endereço da página que vai colada no WhatsApp entregaria
// a edição do presente pra quem RECEBE — o erro que o próprio CLAUDE.md manda
// não cometer.
//
// Consequência aceita: dono que abre o presente em outro aparelho não vê o
// botão. Pra esse caso continuam existindo o e-mail e o painel da conta.

const PREFIXO = "mp_dono:";

export function marcarDono(tokenPublico: string) {
  try {
    localStorage.setItem(PREFIXO + tokenPublico, "1");
  } catch {
    // Navegação privada ou storage cheio: só não mostra o botão extra.
  }
}

export function ehDono(tokenPublico: string): boolean {
  try {
    return localStorage.getItem(PREFIXO + tokenPublico) === "1";
  } catch {
    return false;
  }
}
