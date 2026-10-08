// RODA DEPOIS QUE A PÁGINA CARREGOU E O CELULAR FICOU OCIOSO (08/10).
//
// Pra baixar ANTES da hora o que só vai ser usado minutos depois (o QR do
// PIX, por exemplo), sem disputar a rede e o processador com o que a pessoa
// precisa AGORA: o HTML, o CSS e o JavaScript que hidratam o quiz. Mesma
// régua do `__depoisDaPagina` dos pixels (`carregar-depois.ts`), só que do
// lado do React.
//
// No servidor não faz nada.
export function quandoOcioso(f: () => void): void {
  if (typeof window === "undefined") return;
  const ocioso = () => {
    const ric = (window as Window & {
      requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void;
    }).requestIdleCallback;
    if (ric) ric(f, { timeout: 4000 });
    else setTimeout(f, 1500);
  };
  if (document.readyState === "complete") ocioso();
  else window.addEventListener("load", ocioso, { once: true });
}
