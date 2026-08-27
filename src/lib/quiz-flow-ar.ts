import type { FlowStep } from "@/lib/flow-engine";

// A CAMADA RIOPLATENSE — o que muda no quiz quando o mercado é a ARGENTINA.
//
// ── POR QUE ISTO EXISTE ───────────────────────────────────────────
//
// O interruptor de `mercado-es.ts` já trocava o prompt da letra, os gêneros
// e o exemplo da abertura. O QUIZ ficou de fora, e é ele que a pessoa lê por
// oito telas antes de qualquer outra coisa.
//
// O que ela lia era espanhol MEXICANO, escrito assim de propósito quando o
// alvo era o México e registrado no cabeçalho do `quiz-flow-es.ts`:
// `tú` em todo verbo, `Lupita` e `Chuy` como exemplos de apelido,
// `Xóchitl` como exemplo de pronúncia e `frijoles` como exemplo de comida.
//
// Um argentino não fala nenhuma dessas coisas. Ele diz `vos`, `decís`,
// `contame`, `querés`; o apelido do avô é `Beto`, não `Chuy`; e a comida da
// mãe são ñoquis ou milanesas. É o mesmo defeito que a gente passou o dia
// consertando na abertura: mostrar a um mercado o retrato de outro.
//
// E não é preciosismo linguístico. O voseo é a marca mais barata e mais
// visível de "este site é daqui" — a mesma função que o `você` cumpre no
// Brasil contra um site português. Numa tela que só precisa fazer a pessoa
// confiar o suficiente pra começar, isso é o produto.
//
// ── POR QUE SOBREPOSIÇÃO E NÃO UM ARQUIVO NOVO ────────────────────
//
// Copiar `quiz-flow-es.ts` inteiro criaria um IRMÃO — exatamente o erro que
// o CLAUDE.md já registra sobre a home ES: "melhoria numa não aparece na
// outra". A ordem das perguntas, os `value` gravados no banco, os `mostrarSe`
// e as regras de pulo são estrutura compartilhada e têm que continuar
// compartilhadas; o que muda aqui é REDAÇÃO, e só ela mora neste arquivo.
//
// Efeito colateral bom: dá pra ler este arquivo inteiro e saber, em uma tela,
// tudo que separa um argentino de um mexicano no nosso funil.

type Sobrepor = Record<string, Record<string, unknown>>;

const AR: Sobrepor = {
  nome: {
    text: "¿Cómo le decís a esa persona?",
    // A dica de pronúncia MEXICANA saiu. Ela existia porque `Xóchitl` é um
    // nome náhuatl que ninguém de fora lê certo — problema real no México e
    // inexistente na Argentina, onde os nomes são espanhóis e italianos e se
    // leem como se escrevem. O espaço volta pra instrução que importa.
    subtext: "Escribilo como le decís todos los días, un apodo también vale.",
    placeholder: "Mamá, mi Sole, el abuelo Beto...",
    eco: "Así se va a cantar",
    ecoModelo: "“{v}, esta canción es para vos…”",
  },
  historia1: {
    text: "¿Qué es {nome} para vos?",
    subtext: "Escribí a tu manera. Mientras más real, más única queda la letra.",
    placeholder:
      "Ej: mi vieja nos crió a mis hermanos y a mí sola, siempre con una sonrisa...",
    triggers: [
      { rotulo: "cómo se conocieron", inicio: "Nos conocimos " },
      { rotulo: "lo que admiro", inicio: "Lo que más admiro de {nome} es " },
      { rotulo: "lo que hace por mí", inicio: "Lo que {nome} hace por mí y casi nadie ve es " },
      { rotulo: "lo que aprendí", inicio: "Lo que aprendí de {nome} fue " },
      { rotulo: "nunca se lo dije", inicio: "Algo que nunca le dije a {nome} es que " },
      { rotulo: "cómo me siento", inicio: "Al lado de {nome} me siento " },
    ],
  },
  historia2: {
    // "Cuéntame una tontería" -> "Contame una pavada". `pavada` é a palavra
    // exata: bobagem sem importância, dita com carinho.
    text: "Contame una pavada de {nome}",
    subtext:
      "Una maña, un apodo, una comida. No tiene que ser lindo, tiene que ser verdad.",
    // `frijoles` é comida mexicana. Ñoquis é o prato de mãe argentina — o do
    // dia 29, que todo mundo reconhece sem precisar explicar.
    placeholder: "Hace unos ñoquis que...",
    triggers: [
      { rotulo: "un apodo", inicio: "El apodo que le digo a {nome} es " },
      { rotulo: "una comida", inicio: "La comida que me acuerda a {nome} es " },
      { rotulo: "un lugar", inicio: "Hay un lugar que es re nuestro: " },
      { rotulo: "una maña", inicio: "Una maña que solo {nome} tiene: " },
      { rotulo: "una frase", inicio: "Una frase que {nome} siempre dice es " },
      { rotulo: "una canción", inicio: "Hay una canción que me acuerda a {nome}: " },
    ],
  },
  recado: {
    // `coro` é o uso mexicano; na Argentina a parte que se repete é o
    // ESTRIBILLO, e chamar de outro nome soa a tradução automática.
    text: "Si {nome} pudiera escuchar UNA frase tuya en el estribillo, ¿cuál sería?",
    subtext: "Opcional, pero suele volverse la parte más fuerte.",
    placeholder: "La frase que te gustaría que quedara para siempre",
    triggers: [
      { rotulo: "gracias por…", inicio: "Gracias por " },
      { rotulo: "nunca te dije", inicio: "Nunca te lo dije, pero " },
      { rotulo: "me enseñaste", inicio: "Me enseñaste a " },
      { rotulo: "mientras yo viva", inicio: "Mientras yo viva, " },
      { rotulo: "nadie sabe", inicio: "Nadie lo sabe, pero vos " },
      { rotulo: "si yo pudiera", inicio: "Si yo pudiera, " },
    ],
    extra: {
      field: "filhos",
      pergunta: "¿Querés que la canción nombre a los hijos?",
      subtexto:
        "Escribí los nombres como les dicen en casa, así es como se van a cantar. Si preferís no nombrar a nadie, seguí nomás.",
      placeholder: "Ej.: Juanchi, Anita y el Colo",
      maxLength: 80,
      eco: "Así se van a cantar",
      ecoModelo: "“…y {v}, el amor que quedó”",
      // A REGRA DE EXIBIÇÃO VEM JUNTO, e isso não é opcional.
      //
      // `extra` é substituído INTEIRO, não mesclado campo a campo. Sem repetir
      // o `mostrarSe`, a pergunta sobre filhos apareceria pra quem está
      // fazendo música PRA um filho — "¿Querés que la canción nombre a los
      // hijos?" pra quem acabou de dizer que o presente é pro filho.
      //
      // Mantido idêntico ao `quiz-flow-es.ts` de propósito: é estrutura, não
      // redação. Se um dia a lista mudar lá, muda aqui junto.
      mostrarSe: (r: Record<string, unknown>) =>
        !["filha", "filho", "neta", "neto", "pet", "amiga", "amigo"].includes(
          String(r.relacao),
        ),
    },
  },
  contato: {
    text: "¿Adónde te mando tu letra?",
    subtext:
      "La letra queda lista en la siguiente pantalla. El mail es solo para que no la pierdas.",
  },
};

/**
 * Devolve o funil ES com a redação rioplatense por cima.
 *
 * Sobreposição RASA e por `id`: cada chave de `AR` substitui a mesma chave do
 * passo original e nada mais. Um `id` que não existe no funil é ignorado em
 * silêncio — de propósito, porque um passo removido lá não pode quebrar aqui.
 */
export function comVoseo(flow: FlowStep[]): FlowStep[] {
  return flow.map((passo) => {
    const troca = AR[passo.id];
    return troca ? ({ ...passo, ...troca } as FlowStep) : passo;
  });
}

/** Só pro teste: quais passos a camada toca. */
export const PASSOS_AR = Object.keys(AR);
