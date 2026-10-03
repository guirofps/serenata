// O TESTE DA ABERTURA DA BALLAD (`abertura_en`, 02/10).
//
// Medido em 02/10: de 139 visitas pagas no `/criar` da Ballad (Google e
// TikTok), 34 ficaram mais de 30s na abertura e só 6 tocaram no botão (4%).
// Na Serenata passam 43% a 53%. Ninguém deu play na música de exemplo. Todos
// os 12 criativos do Google mostram o mesmo padrão, então o gargalo é a tela,
// não o anúncio.
//
//   A  a abertura de hoje (controle)
//   B  sem abertura: quem chega no `/criar` cai direto na primeira pergunta
//   C  a abertura reformulada (`AberturaPresente`, variante C): preço às
//      claras no lugar do "free", botão grande pra ouvir o exemplo e os três
//      passos do que acontece
//
// A linha do experimento existe SÓ no banco da Ballad. Na Serenata o <html>
// nunca recebe o carimbo, e nada daqui roda.
//
// ── POR QUE O B É UM REDIRECIONAMENTO NO <head> ──────────────────
//
// O quiz é renderizado no servidor. Pular a abertura no React mostraria a
// abertura por 1 a 3 segundos e trocaria de tela na frente da pessoa. Aqui o
// sorteio já carimbou o <html> (o script dele vem antes deste), e o
// `location.replace` sai antes de qualquer pixel do corpo: o servidor já
// devolve a primeira pergunta pronta (`?step=relacao`). Os parâmetros do
// anúncio (gclid, ttclid, utm) vão junto.
//
// UMA vez por aba (`sessionStorage`): quem volta pra abertura com o botão de
// voltar, ou recarrega nela, fica nela. Pular de novo seria prender a pessoa.
//
// ── O QUE MEDIR ──────────────────────────────────────────────────
//
// "Passou da abertura" não serve pra comparar: no B todo mundo "passa". O
// número justo é quem RESPONDEU a primeira pergunta (`quiz_step` com q >= 2),
// depois letra, oferta e venda, por braço (`attribution.exp.abertura_en`).

export const EXP_ABERTURA_EN = "abertura_en";
const CHAVE_PULOU = "mp_pulou_abertura";

/**
 * Pra onde ir, ou null pra ficar. Pura, pra teste: o script abaixo é a mesma
 * regra escrita pro navegador.
 */
export function destinoPularAbertura(args: {
  variante: string | null;
  pathname: string;
  search: string;
  jaPulou: boolean;
}): string | null {
  if (args.variante !== "B" || args.jaPulou) return null;
  if (args.pathname !== "/criar") return null;
  const q = new URLSearchParams(args.search);
  if (q.has("step")) return null;
  q.set("step", "relacao");
  return `/criar?${q.toString()}`;
}

/** O script do <head>. Vem DEPOIS do sorteio (`scriptExperimentos`). */
export function scriptPularAbertura(): string {
  return `(function(){try{var v=document.documentElement.getAttribute("data-exp-${EXP_ABERTURA_EN}");if(v!=="B")return;if(location.pathname!=="/criar")return;if(sessionStorage.getItem("${CHAVE_PULOU}"))return;var q=new URLSearchParams(location.search);if(q.has("step"))return;sessionStorage.setItem("${CHAVE_PULOU}","1");q.set("step","relacao");location.replace("/criar?"+q.toString()+location.hash)}catch(e){}})();`;
}
