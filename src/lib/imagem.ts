// Prepara a foto do comprador ANTES de subir.
//
// Por que no cliente e não no servidor: foto de celular tem 4–12 MB. Fazendo
// aqui, sobe ~400 KB em vez de 8 MB — a diferença entre funcionar e não
// funcionar num 4G do interior.
//
// A FOTO SOBE INTEIRA, só reduzida. Até 14/10 ela era cortada num quadrado
// pelo CENTRO, e em foto em pé o centro é a barriga: o rosto, que fica no
// terço de cima, saía pela metade ou nem saía. A Edna pagou o vídeo e 3 das
// fotos chegaram sem rosto. Quem decide o enquadramento agora é quem mostra:
// a página (`FotoAdaptativa`), o quadro (`AjusteDaFoto`) e o vídeo
// (`Presente.tsx`) medem a proporção real e cortam com cuidado. Cortar aqui,
// antes de saber onde a foto vai aparecer, só perdia informação.

const MAIOR_LADO = 1600; // cobre tela 2x em pé sem exagero de peso
const QUALIDADE = 0.85;

export type FotoPreparada = { base64: string; kb: number };

/** Largura e altura finais: o maior lado vira no máximo `MAIOR_LADO`, proporção mantida, nunca amplia. */
export function tamanhoFinal(largura: number, altura: number, maiorLado = MAIOR_LADO): { w: number; h: number } {
  const escala = Math.min(1, maiorLado / Math.max(largura, altura));
  return { w: Math.max(1, Math.round(largura * escala)), h: Math.max(1, Math.round(altura * escala)) };
}

export async function prepararFoto(arquivo: File): Promise<FotoPreparada> {
  if (!/^image\/(jpeg|png|webp)$/.test(arquivo.type)) {
    throw new Error("Use uma foto JPG, PNG ou WEBP.");
  }

  // `imageOrientation: "from-image"` respeita o EXIF: sem isso, foto tirada
  // na vertical sobe deitada — e é a maioria das fotos de celular.
  const bitmap = await createImageBitmap(arquivo, { imageOrientation: "from-image" });
  const { w, h } = tamanhoFinal(bitmap.width, bitmap.height);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não consegui preparar a foto neste navegador.");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  // JPEG e não PNG: foto é fotografia, e PNG aqui triplicaria o tamanho.
  const base64 = canvas.toDataURL("image/jpeg", QUALIDADE);
  const kb = Math.round((base64.length * 3) / 4 / 1024);
  return { base64, kb };
}
