import type { Locale } from "@/lib/i18n";
import { tp } from "@/lib/textos-presente";

// OS MOTIVOS DE RECUSA DO EDITOR, como CÓDIGO (16/10).
//
// O servidor (`personalizar.ts`) e o preparo da foto no navegador
// (`imagem.ts`) devolviam a frase pronta, em português, e o editor mostrava
// crua: o comprador da Ballad via "A imagem é grande demais." numa tela em
// inglês. O servidor não sabe em que idioma a tela está; o editor sabe. Então
// quem recusa diz O QUÊ, e quem mostra escolhe as palavras.

export type ErroPersonalizar =
  | "nao_encontrado"
  | "galeria_cheia"
  | "nenhuma_foto"
  | "frase_longa"
  | "formato"
  | "grande"
  | "subir"
  | "salvar";

/** O que dá errado ao preparar a foto no navegador, antes de subir. */
export type ErroPrepararFoto = "tipo" | "navegador";

/**
 * Erro do preparo da foto, com o código. A `message` continua em português de
 * propósito: é ela que vai pro log e pro `motivo` do evento de falha, e trocar
 * o texto quebraria a leitura dos eventos antigos.
 */
export class ErroFoto extends Error {
  constructor(
    readonly codigo: ErroPrepararFoto,
    mensagem: string,
  ) {
    super(mensagem);
    this.name = "ErroFoto";
  }
}

/** Os limites que entram na frase. Moram aqui pra tela e servidor dizerem o mesmo número. */
export const MAX_GALERIA = 12;
export const MAX_DEDICATORIA = 280;

/** A frase do motivo no idioma da tela. */
export function mensagemDoErro(
  codigo: ErroPersonalizar | ErroPrepararFoto,
  locale: Locale,
): string {
  const T = tp(locale);
  switch (codigo) {
    case "nao_encontrado":
      return T.erroNaoEncontrado;
    case "galeria_cheia":
      return T.galeriaCheia(MAX_GALERIA);
    case "nenhuma_foto":
      return T.erroNenhumaFoto;
    case "frase_longa":
      return T.erroFraseLonga(MAX_DEDICATORIA);
    case "formato":
      return T.erroFormatoFoto;
    case "grande":
      return T.erroFotoGrande;
    case "subir":
      return T.erroSubirFoto;
    case "salvar":
      return T.erroSalvarAgora;
    case "tipo":
      return T.erroTipoFoto;
    case "navegador":
      return T.erroNavegadorFoto;
  }
}
