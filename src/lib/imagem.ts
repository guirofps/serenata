// Prepara a foto do comprador ANTES de subir.
//
// Por que no cliente e não no servidor: foto de celular tem 4–12 MB, e o
// corte quadrado teria que acontecer de qualquer jeito. Fazendo aqui, sobe
// ~300 KB em vez de 8 MB — a diferença entre funcionar e não funcionar num
// 4G do interior.

const LADO = 1200; // cobre tela 2x sem exagero de peso
const QUALIDADE = 0.85;

export type FotoPreparada = { base64: string; kb: number };

export async function prepararFoto(arquivo: File): Promise<FotoPreparada> {
  if (!/^image\/(jpeg|png|webp)$/.test(arquivo.type)) {
    throw new Error("Use uma foto JPG, PNG ou WEBP.");
  }

  // `imageOrientation: "from-image"` respeita o EXIF: sem isso, foto tirada
  // na vertical sobe deitada — e é a maioria das fotos de celular.
  const bitmap = await createImageBitmap(arquivo, { imageOrientation: "from-image" });

  // Corte quadrado pelo CENTRO: é onde o rosto está em praticamente toda
  // foto de retrato.
  const lado = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - lado) / 2;
  const sy = (bitmap.height - lado) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = LADO;
  canvas.height = LADO;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não consegui preparar a foto neste navegador.");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, sx, sy, lado, lado, 0, 0, LADO, LADO);
  bitmap.close();

  // JPEG e não PNG: foto é fotografia, e PNG aqui triplicaria o tamanho.
  const base64 = canvas.toDataURL("image/jpeg", QUALIDADE);
  const kb = Math.round((base64.length * 3) / 4 / 1024);
  return { base64, kb };
}
