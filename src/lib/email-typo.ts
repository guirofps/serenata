// E-MAIL DIGITADO ERRADO.
//
// Em 08/08, no primeiro disparo pelo subdomínio novo, um endereço voltou:
// `marciocabanhas64@gmail.comm`. Um "m" a mais. Antes dele, no mesmo dia,
// `gleyciannearaujo247@gmail.com.br` — domínio que não existe.
//
// O prejuízo tem dois tamanhos, e o segundo é o que importa:
//
// 1. Bounce queima reputação de remetente, e `envio.serenatagift.com` nasceu
//    hoje, sem histórico nenhum pra amortecer.
// 2. Muito pior: se quem digita errado for um COMPRADOR, ele paga e a música
//    nunca chega. O e-mail é o único canal — não tem WhatsApp no produto. O
//    dinheiro entra, a entrega não sai, e a pessoa não tem como reclamar
//    porque também não recebe o link de acesso.
//
// A validação do quiz era `/.+@.+\..+/`, que aprova `gmail.comm` sem piscar.
//
// Duas funções porque são duas situações diferentes:
//
// - `sugerirEmail` roda na TELA, onde a pessoa pode discordar. Pode arriscar
//   um palpite por semelhança, porque o custo de errar é ela ignorar.
// - `pareceTypo` roda no SERVIDOR, onde não tem ninguém pra confirmar. Só
//   acusa o que é typo com quase-certeza, porque o custo de errar é deixar
//   de falar com alguém real.

/** Os domínios que aparecem de verdade na nossa base, BR e MX. */
const DOMINIOS = [
  "gmail.com",
  "hotmail.com",
  "hotmail.com.br",
  "outlook.com",
  "outlook.com.br",
  "yahoo.com",
  "yahoo.com.br",
  "icloud.com",
  "live.com",
  "msn.com",
  "me.com",
  "bol.com.br",
  "uol.com.br",
  "terra.com.br",
  "globo.com",
  "prodigy.net.mx",
];

function partes(email: string): [string, string] | null {
  const e = (email ?? "").trim().toLowerCase();
  const at = e.lastIndexOf("@");
  if (at <= 0 || at === e.length - 1) return null;
  return [e.slice(0, at), e.slice(at + 1)];
}

/**
 * Damerau, não Levenshtein.
 *
 * A diferença decide o caso mais comum: `gmial.com`. Trocar duas letras de
 * lugar é o erro de digitação que mais acontece, e Levenshtein cobra 2 por
 * isso (apaga uma, insere outra) — mesmo preço de um domínio genuinamente
 * diferente. Damerau conta transposição como 1, que é o que ela é.
 *
 * Sem isso, ou o `gmial.com` passa batido, ou o limite tem que subir pra 2 e
 * aí começa a sugerir besteira pra domínio de empresa.
 */
function distancia(a: string, b: string): number {
  const m: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array(b.length + 1).fill(0),
  );
  for (let i = 0; i <= a.length; i++) m[i][0] = i;
  for (let j = 0; j <= b.length; j++) m[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const custo = a[i - 1] === b[j - 1] ? 0 : 1;
      m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + custo);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        m[i][j] = Math.min(m[i][j], m[i - 2][j - 2] + 1);
      }
    }
  }
  return m[a.length][b.length];
}

/** O domínio conhecido mais parecido, com a distância. */
function maisProximo(dominio: string): { bom: string; n: number } | null {
  let melhor: { bom: string; n: number } | null = null;
  for (const bom of DOMINIOS) {
    const n = distancia(dominio, bom);
    if (!melhor || n < melhor.n) melhor = { bom, n };
  }
  return melhor;
}

/**
 * Typo de quase-certeza: o domínio COMEÇA com um provedor conhecido e
 * continua. `gmail.comm`, `gmail.com.br`, `hotmail.combr`.
 *
 * Essa forma é praticamente impossível de ser um domínio real — ninguém
 * registra um domínio que é outro domínio mais um sufixo. Por isso é a única
 * regra que o servidor usa sozinho.
 */
export function pareceTypo(email: string): boolean {
  const p = partes(email);
  if (!p) return true; // sem "@" ou sem nada depois dele: não dá pra entregar
  const [, dominio] = p;
  if (DOMINIOS.includes(dominio)) return false;
  if (!dominio.includes(".")) return true; // "gmail" sozinho não é entregável
  if (DOMINIOS.some((bom) => dominio.startsWith(bom))) return true;

  // Uma única letra de diferença de um provedor GRANDE. `icloud.con`,
  // `hotmail.con`. Ninguém registra um domínio a um caractere do Gmail e
  // manda e-mail de lá.
  //
  // O piso de 9 caracteres não é enfeite: `me.com` tem 6, e a um caractere
  // dele estão `he.com` e `we.com`, que podem ser domínios de verdade de
  // alguém. Em domínio curto, "quase igual" não prova nada.
  const perto = maisProximo(dominio);
  return Boolean(perto && perto.n <= 1 && perto.bom.length >= 9);
}

/**
 * O palpite da tela. Inclui semelhança (`gmial.com`, `hotmial.com`), que é
 * chute demais pro servidor mas certeiro o bastante pra sugerir a alguém que
 * pode olhar e discordar.
 *
 * Devolve o e-mail corrigido inteiro, ou null quando não há o que sugerir.
 */
export function sugerirEmail(email: string): string | null {
  const p = partes(email);
  if (!p) return null;
  const [conta, dominio] = p;
  if (DOMINIOS.includes(dominio)) return null;

  // Primeiro a regra dura, que é a mais confiável.
  const sufixo = DOMINIOS.find((bom) => dominio.startsWith(bom));
  if (sufixo) return `${conta}@${sufixo}`;

  // Depois a semelhança. Com Damerau, 1 já cobre transposição, letra trocada,
  // letra a mais e letra a menos — o repertório inteiro do dedo escorregando.
  // O teto só sobe em domínio longo, onde há mais espaço pra errar duas vezes
  // sem virar outro domínio.
  const perto = maisProximo(dominio);
  if (!perto) return null;
  const teto = perto.bom.length > 12 ? 2 : 1;
  return perto.n <= teto ? `${conta}@${perto.bom}` : null;
}
