// O CONTRATO entre o job que pede o render (`inngest/functions/renderizarVideo.ts`)
// e a composição. Sem import nenhum de propósito: o job importa só o TIPO
// daqui, e um import de runtime puxaria o Remotion pra dentro da Vercel.

export type PalavraKaraoke = { t: string; s: number; e: number };
export type LinhaKaraoke = { start: number; end: number; words: PalavraKaraoke[] };

export type PropsPresente = {
  /** URL assinada do MP3 (bucket `musicas`), da versão que ela escolheu. */
  audioUrl: string;
  /** URLs assinadas das fotos (bucket `fotos`): capa primeiro, galeria depois. Pode ser vazio. */
  fotos: string[];
  /** Linhas da letra com o tempo de cada palavra, já sem as tags de seção. */
  karaoke: LinhaKaraoke[];
  titulo: string;
  dedicatoria: string;
  /** Duração do vídeo em segundos (a música inteira + o card de fechamento). */
  duracaoS: number;
  locale: "pt" | "es";
  /** Quem ganha o presente ("Daiane"). Abre o vídeo e sai em itálico dourado na letra. */
  para?: string;
  /**
   * Um PEDAÇO do vídeo, sem abertura nem fechamento: é como ele aparece
   * dentro do celular no anúncio. O vídeo de verdade nunca manda isto.
   */
  trecho?: boolean;
  /**
   * Prévia tocando no editor, antes da compra. Carimba "prévia" no canto: a
   * prévia é o vídeo inteiro de verdade, e sem marca ela bastaria gravada da
   * tela. O render pago nunca manda isto.
   */
  previa?: boolean;
};
