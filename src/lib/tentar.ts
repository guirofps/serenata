// UM PASSO QUE FALHA NÃO DERRUBA OS OUTROS. No `puxarCriativosAds` os passos
// rodam em sequência: um nome de campo errado na consulta dos anúncios
// esgotava os retries e matava a execução antes de ligar venda a anúncio
// (revisão de 08/10). Com isto o erro fica no log e no resultado do passo.
export async function tentar<T>(nome: string, fn: () => Promise<T>): Promise<T | { erro: string }> {
  try {
    return await fn();
  } catch (err) {
    const erro = err instanceof Error ? err.message : String(err);
    console.error(`[criativos] passo ${nome} falhou:`, erro);
    return { erro };
  }
}
