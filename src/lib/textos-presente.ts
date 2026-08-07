import type { Locale } from "@/lib/i18n";

// Textos da PÁGINA-PRESENTE e do EDITOR.
//
// Separados de `textos.ts` (que é do quiz) porque a fonte do idioma é outra:
// aqui ele vem da COLUNA `locale` do registro, não da rota. A página presente
// é aberta pelo presenteado, que nunca passou pelo nosso funil e não tem
// prefixo `/es` nenhum no link que recebeu no WhatsApp.

const PT = {
  umaMusicaPara: "uma música para",
  umPresente: "Um presente",
  descricao: (n?: string) =>
    n ? `Uma música feita só para ${n}.` : "Uma música feita só para você.",
  ogTitulo: (n?: string) => (n ? `Uma música para ${n}` : "Um presente"),
  soVoceVe: "só você vê isto",
  baixarMusica: "Baixar a música",
  guardarOuEnviar: "Guardar ou enviar",
  comoBaixa: "como baixa a música?",
  ajudaCelular:
    "No celular abre as opções do aparelho: escolha “Salvar em Arquivos” pra guardar, ou o WhatsApp pra mandar direto.",
  ajudaDesktop: "Baixa o MP3 no seu computador.",
  baixarOuEnviar: "Baixar ou enviar a música",
  preparandoAudio: "preparando o áudio…",
  pronto: "pronto",
  posicaoMusica: "Posição da música",
};

type TextosPresente = typeof PT;

const ES: TextosPresente = {
  umaMusicaPara: "una canción para",
  umPresente: "Un regalo",
  descricao: (n?: string) =>
    n ? `Una canción hecha solo para ${n}.` : "Una canción hecha solo para ti.",
  ogTitulo: (n?: string) => (n ? `Una canción para ${n}` : "Un regalo"),
  soVoceVe: "solo tú ves esto",
  baixarMusica: "Descargar la canción",
  guardarOuEnviar: "Guardar o enviar",
  comoBaixa: "¿cómo se descarga?",
  ajudaCelular:
    "En el celular abre las opciones del teléfono: elige “Guardar en Archivos” para guardarla, o WhatsApp para mandarla directo.",
  ajudaDesktop: "Descarga el MP3 en tu computadora.",
  baixarOuEnviar: "Descargar o enviar la canción",
  preparandoAudio: "preparando el audio…",
  pronto: "listo",
  posicaoMusica: "Posición de la canción",
};

const POR_IDIOMA: Record<Locale, TextosPresente> = { pt: PT, es: ES };

export function tp(locale: Locale): TextosPresente {
  return POR_IDIOMA[locale] ?? PT;
}
