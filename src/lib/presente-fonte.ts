// DE ONDE A PÁGINA PRESENTE TIRA A GRAVAÇÃO (08/10).
//
// O ajuste (`refacao.ts`) arquiva a gravação atual em `versoes_musica`, LIMPA o
// áudio da linha principal e põe a música em `gerando`. Até 08/10 a página
// presente só respondia com `status = "pronta"`: durante a regravação (1 a 2
// minutos; horas, se o Inngest cair) quem abria o link recebia "Esse link
// parece incompleto". Foram 129 ajustes em 7 dias, e o link quase sempre já
// tinha sido mandado pro presenteado: era o presente "quebrando" na mão dele.
//
// A regra: fora de `pronta`, a página toca a ÚLTIMA versão arquivada que tem
// áudio. Versão arquivada só existe depois de um ajuste pago, então música que
// nunca ficou pronta continua sem página (não há nada pra mostrar).
//
// Pura de propósito: o teste segura a escolha sem banco.

export type GravacaoDoPresente = {
  titulo: string | null;
  letra: string | null;
  audio_path: string | null;
  audio_path_v2: string | null;
  timestamps: unknown;
  timestamps_v2: unknown;
};

export type FonteDoPresente = GravacaoDoPresente & {
  /** true quando veio do arquivo porque a música está sendo regravada. */
  atualizando: boolean;
};

export function escolherFonteDoPresente(
  musica: GravacaoDoPresente & { status: string | null },
  arquivadas: GravacaoDoPresente[] | null | undefined,
): FonteDoPresente | null {
  if (musica.status === "pronta") return { ...pick(musica), atualizando: false };
  // A mais recente primeiro (quem chama ordena por `ordem` desc), e só a que
  // tem o que tocar: uma versão sem áudio daria página muda, que é pior que
  // a tela de link incompleto.
  const anterior = (arquivadas ?? []).find((v) => Boolean(v.audio_path));
  if (!anterior) return null;
  return { ...pick(anterior), atualizando: true };
}

function pick(g: GravacaoDoPresente): GravacaoDoPresente {
  return {
    titulo: g.titulo,
    letra: g.letra,
    audio_path: g.audio_path,
    audio_path_v2: g.audio_path_v2,
    timestamps: g.timestamps,
    timestamps_v2: g.timestamps_v2,
  };
}
