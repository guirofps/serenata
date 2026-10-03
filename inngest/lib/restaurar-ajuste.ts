import type { SupabaseClient } from "@supabase/supabase-js";

// O AJUSTE QUE FALHOU NÃO PODE DEIXAR O COMPRADOR SEM MÚSICA (03/10).
//
// O ajuste (`refacao.ts`) arquiva a versão atual em `versoes_musica` (com cópia
// dos MP3 em `<id>/versoes/<ordem>/`) e LIMPA o áudio da linha principal antes
// de mandar regravar, pra página não tocar a gravação velha com a letra nova.
// Se o provedor falha ("recusou 4x: 500"), a música ficava `falhou` e sem áudio:
// em 03/10 eram 4 compradores sem nada, um deles com aniversário no dia.
//
// Aqui, na falha: se a linha está sem áudio e existe a versão arquivada do
// ajuste em curso, ela volta inteira (letra, título, áudio, karaokê), a música
// volta pra `pronta` e o direito de ajuste é devolvido (a versão daquela ordem
// sai do histórico e `refacoes_usadas` desce 1). A pessoa pode pedir de novo.
//
// Devolve true se restaurou. Qualquer coisa fora do formato esperado devolve
// false e o fluxo de falha de sempre segue (status `falhou` + alerta).
export async function restaurarSeAjusteFalhou(sb: SupabaseClient, musicaId: string): Promise<boolean> {
  const { data: m } = await sb
    .from("musicas")
    .select("id, audio_path, refacoes_usadas")
    .eq("id", musicaId)
    .maybeSingle();
  const ordem = Number(m?.refacoes_usadas ?? 0);
  if (!m || m.audio_path || ordem < 1) return false;

  const { data: v } = await sb
    .from("versoes_musica")
    .select("letra, titulo, estilo_suno, audio_path, audio_path_v2, timestamps, timestamps_v2")
    .eq("musica_id", musicaId)
    .eq("ordem", ordem)
    .maybeSingle();
  if (!v?.audio_path) return false;

  const { error } = await sb
    .from("musicas")
    .update({
      letra: v.letra,
      titulo: v.titulo,
      estilo_suno: v.estilo_suno,
      audio_path: v.audio_path,
      audio_path_v2: v.audio_path_v2,
      timestamps: v.timestamps,
      timestamps_v2: v.timestamps_v2,
      status: "pronta",
      erro: "ajuste falhou no provedor; versão anterior restaurada",
      refacoes_usadas: ordem - 1,
    })
    .eq("id", musicaId)
    .is("audio_path", null);
  if (error) {
    console.error("[restaurar-ajuste] não restaurou:", musicaId, error.message);
    return false;
  }
  await sb.from("versoes_musica").delete().eq("musica_id", musicaId).eq("ordem", ordem);
  return true;
}
