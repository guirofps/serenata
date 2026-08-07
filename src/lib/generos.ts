import type { Locale } from "@/lib/i18n";

// OS GÊNEROS, num lugar só.
//
// Antes viviam em TRÊS arquivos que precisavam concordar entre si: o chip do
// quiz (`quiz-flow.ts`), o rótulo mandado pro Claude (`letra-prompt.ts`) e o
// prompt de estilo do Suno (`gerarMusica.ts`). Somar um idioma nesse arranjo
// daria SEIS listas pra manter alinhadas, e a primeira a sair de sincronia
// entrega música do gênero errado sem erro nenhum no log.
//
// Cada gênero carrega as três faces. Os valores em português são cópia exata
// do que já rodava, pra que o funil brasileiro não mude nada.

export type Genero = {
  /** O que vai no banco. NUNCA muda: é o que casa com respostas já gravadas. */
  value: string;
  /** O chip do quiz. */
  label: string;
  emoji: string;
  /** Como o gênero é descrito pro Claude na hora de escrever a letra. */
  rotuloPrompt: string;
  /**
   * O prompt de estilo do Suno, usado como fallback quando o estilo escrito
   * pela IA precisa ser limpo por citar artista ou banda (o Suno recusa).
   */
  estiloSuno: string;
};

// ── PORTUGUÊS (Brasil) ────────────────────────────────────────────
// Ordenados por quanto se pede. Sem "Outro": num seletor de GÊNERO, "outro"
// virava "à escolha do compositor" e o Suno precisa de um estilo concreto.
const PT: Genero[] = [
  { value: "sertanejo", label: "Sertanejo", emoji: "🤠",
    rotuloPrompt: "sertanejo",
    estiloSuno: "sertanejo romântico brasileiro, viola e violão, batida moderada, clima emotivo" },
  { value: "sertanejo_univ", label: "Sertanejo universitário", emoji: "🎸",
    rotuloPrompt: "sertanejo universitário",
    estiloSuno: "sertanejo universitário, violão e viola, produção pop, romântico" },
  { value: "piseiro", label: "Piseiro / arrocha", emoji: "🎹",
    rotuloPrompt: "piseiro/arrocha romântico",
    estiloSuno: "piseiro romântico brasileiro, teclado marcante, batida eletrônica dançante, vocal melódico, clima apaixonado" },
  { value: "pagode", label: "Pagode / samba", emoji: "🥁",
    rotuloPrompt: "pagode/samba",
    estiloSuno: "pagode romântico, cavaquinho, pandeiro, banjo, clima alegre e caloroso" },
  { value: "forro", label: "Forró", emoji: "🪗",
    rotuloPrompt: "forró",
    estiloSuno: "forró brasileiro, sanfona, zabumba e triângulo, clima nordestino" },
  { value: "pop_romantico", label: "Pop romântico", emoji: "💕",
    rotuloPrompt: "pop romântico",
    estiloSuno: "balada pop romântica, piano, cordas suaves, emocional e cinematográfica" },
  { value: "mpb", label: "MPB / voz e violão", emoji: "🎙️",
    rotuloPrompt: "MPB (voz e violão)",
    estiloSuno: "MPB intimista, violão acústico dedilhado, andamento lento, arranjo minimalista" },
  { value: "bossa", label: "Bossa nova", emoji: "🌙",
    rotuloPrompt: "bossa nova",
    estiloSuno: "bossa nova, violão de nylon dedilhado, batida suave, vocal intimista e sussurrado, clima sofisticado" },
  { value: "rock", label: "Rock", emoji: "🤘",
    rotuloPrompt: "rock nacional romântico",
    estiloSuno: "rock nacional romântico, guitarra com distorção suave, bateria marcada, vocal emotivo, clima de balada rock" },
  { value: "reggae", label: "Reggae", emoji: "🌴",
    rotuloPrompt: "reggae romântico brasileiro",
    estiloSuno: "reggae romântico brasileiro, guitarra no contratempo, baixo marcante, batida cadenciada, vocal suave, clima praiano e apaixonado" },
  { value: "gospel", label: "Gospel", emoji: "📖",
    rotuloPrompt: "gospel",
    estiloSuno: "gospel brasileiro, piano e órgão, cordas, clima reverente e inspirador" },
  { value: "rap", label: "Rap / hip-hop", emoji: "🎤",
    rotuloPrompt: "rap/hip-hop melódico",
    estiloSuno: "rap/hip-hop melódico brasileiro, batida boom-bap suave, piano, vocal falado e cantado, clima intimista" },
  { value: "infantil", label: "Infantil", emoji: "⭐",
    rotuloPrompt: "infantil",
    estiloSuno: "canção infantil suave, caixinha de música, ukulele, clima doce" },
];

// ── ESPANHOL (México primeiro) ────────────────────────────────────
//
// NÃO é a lista de cima traduzida. Sertanejo, piseiro, forró e pagode não
// existem no México, e mariachi, banda e corrido tumbado não têm equivalente
// no Brasil. É outra lista.
//
// A ordem veio do que a Cántale (cantale.mx, o concorrente escalado de lá)
// oferece e destaca no próprio site, mais o peso cultural de cada gênero como
// PRESENTE: mariachi vem primeiro porque *llevar serenata* com mariachi na
// janela é a tradição que dá nome à nossa marca, e é o pedido óbvio.
//
// Espanhol NEUTRO-MEXICANO nos rótulos. Regionais fortes de outros países
// (vallenato colombiano, tango argentino, merengue dominicano) ficam de fora
// enquanto o teste for México: chip que ninguém escolhe é chip que só faz o
// seletor parecer mais longo.
const ES: Genero[] = [
  { value: "mariachi", label: "Mariachi", emoji: "🎺",
    rotuloPrompt: "mariachi mexicano",
    estiloSuno: "mariachi mexicano tradicional, trompetas, violines, guitarrón y vihuela, voz sentida con gritos suaves, ritmo de ranchera lenta" },
  { value: "banda", label: "Banda", emoji: "🎷",
    rotuloPrompt: "banda sinaloense",
    estiloSuno: "banda sinaloense, tuba, tarola, clarinetes y trompetas, ritmo de balada romántica, voz potente y emotiva" },
  { value: "balada", label: "Balada romántica", emoji: "💕",
    rotuloPrompt: "balada romántica latina",
    estiloSuno: "balada romántica latina, piano, cuerdas suaves, voz emotiva, clima cinematográfico e íntimo" },
  { value: "nortena", label: "Norteño", emoji: "🪗",
    rotuloPrompt: "norteño",
    estiloSuno: "norteño mexicano, acordeón y bajo sexto, ritmo moderado, voz cálida, clima de canción de amor de rancho" },
  { value: "cumbia", label: "Cumbia", emoji: "🥁",
    rotuloPrompt: "cumbia",
    estiloSuno: "cumbia romántica latinoamericana, güira, congas y teclado, ritmo bailable y cadencioso, voz alegre" },
  { value: "bolero", label: "Bolero", emoji: "🌙",
    rotuloPrompt: "bolero",
    estiloSuno: "bolero clásico latinoamericano, guitarra de nylon arpegiada, contrabajo, voz aterciopelada, clima nocturno y romántico" },
  { value: "corrido", label: "Corrido tumbado", emoji: "🤠",
    rotuloPrompt: "corrido tumbado",
    estiloSuno: "corrido tumbado, guitarra acústica de doce cuerdas, requinto, tuba suave, voz joven y narrativa, clima íntimo" },
  { value: "pop_latino", label: "Pop latino", emoji: "✨",
    rotuloPrompt: "pop latino",
    estiloSuno: "pop latino moderno, guitarra acústica, percusión suave, producción limpia, voz cercana y emotiva" },
  { value: "bachata", label: "Bachata", emoji: "💃",
    rotuloPrompt: "bachata",
    estiloSuno: "bachata romántica, guitarra requinto con síncopa, bongó y güira, ritmo sensual y cadencioso, voz dulce" },
  { value: "reggaeton", label: "Reggaetón romántico", emoji: "🔥",
    rotuloPrompt: "reggaetón romántico",
    estiloSuno: "reggaetón romántico melódico, ritmo dembow suave, sintetizadores cálidos, voz cantada y cercana" },
  { value: "salsa", label: "Salsa", emoji: "🎉",
    rotuloPrompt: "salsa romántica",
    estiloSuno: "salsa romántica, piano montuno, metales, timbales y congas, ritmo alegre, voz sabrosa" },
  { value: "trova", label: "Trova / voz y guitarra", emoji: "🎙️",
    rotuloPrompt: "trova (voz y guitarra)",
    estiloSuno: "trova latinoamericana intimista, guitarra acústica arpegiada, tempo lento, arreglo mínimo, voz susurrada" },
  { value: "rock_esp", label: "Rock en español", emoji: "🤘",
    rotuloPrompt: "rock en español romántico",
    estiloSuno: "rock en español romántico, guitarra eléctrica con distorción suave, batería marcada, voz emotiva, clima de balada rock" },
  { value: "cristiana", label: "Música cristiana", emoji: "📖",
    rotuloPrompt: "música cristiana",
    estiloSuno: "música cristiana latina, piano y cuerdas, coro suave, clima reverente e inspirador" },
  { value: "infantil_es", label: "Infantil", emoji: "⭐",
    rotuloPrompt: "infantil",
    estiloSuno: "canción infantil suave, caja de música, ukulele, clima dulce" },
];

const POR_IDIOMA: Record<Locale, Genero[]> = { pt: PT, es: ES };

export function generos(locale: Locale): Genero[] {
  return POR_IDIOMA[locale] ?? PT;
}

/**
 * Busca em TODOS os idiomas, não só no atual.
 *
 * De propósito: uma letra é gerada por um job que roda depois, e a página
 * presente é aberta meses adiante. Procurar só na lista do idioma "atual"
 * faria um pedido em espanhol não achar "mariachi" e cair no fallback
 * genérico — música errada, silenciosamente.
 */
export function acharGenero(value: string | null | undefined): Genero | null {
  if (!value) return null;
  for (const lista of Object.values(POR_IDIOMA)) {
    const g = lista.find((x) => x.value === value);
    if (g) return g;
  }
  return null;
}
