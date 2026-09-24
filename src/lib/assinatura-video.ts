// A "IMPRESSÃO DIGITAL" do que entrou num vídeo.
//
// O vídeo é feito da página: fotos, dedicatória, título e a versão da música
// que ela escolheu. Quando qualquer um desses muda DEPOIS do render, o vídeo
// que ela tem já não é a página dela, e o editor oferece "atualizar meu
// vídeo". Comparar a assinatura gravada no render com a de agora é o que diz
// isso, sem guardar cópia de nada.
//
// Usa o CAMINHO da foto no Storage, nunca a URL assinada: a URL muda a cada
// carregamento e daria "desatualizado" pra sempre.

export type EntradaVideo = {
  versao: 1 | 2;
  fotos: string[];
  dedicatoria: string;
  titulo: string;
};

export function assinaturaDoVideo(e: EntradaVideo): string {
  const texto = JSON.stringify([
    e.versao,
    e.fotos,
    e.dedicatoria.trim().replace(/\s+/g, " "),
    e.titulo.trim(),
  ]);
  // FNV-1a de 32 bits: não é segurança, é só "mudou ou não mudou".
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/** As entradas do vídeo a partir da linha de `musicas`, igual pro job e pro editor. */
export function entradaDaMusica(m: {
  versao_preferida?: unknown;
  audio_path_v2?: unknown;
  foto_path?: unknown;
  galeria?: unknown;
  dedicatoria?: unknown;
  titulo?: unknown;
}): EntradaVideo {
  const galeria = Array.isArray(m.galeria) ? (m.galeria as unknown[]) : [];
  return {
    versao: m.versao_preferida === 2 && !!m.audio_path_v2 ? 2 : 1,
    fotos: [m.foto_path, ...galeria].filter((c): c is string => typeof c === "string" && !!c),
    dedicatoria: typeof m.dedicatoria === "string" ? m.dedicatoria : "",
    titulo: typeof m.titulo === "string" ? m.titulo : "",
  };
}
