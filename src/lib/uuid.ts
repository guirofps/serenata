// UUID v4 MESMO SEM `crypto.randomUUID` (29/10).
//
// `randomUUID` só existe em contexto seguro e em navegador recente (Safari
// 15.4+, Chrome 92+). Celular velho e webview de aplicativo (o navegador de
// dentro do Instagram/TikTok em Android antigo) lançavam no primeiro passo do
// funil: sem sessão, sem lead, sem letra. `getRandomValues` existe há uma
// década e dá a mesma aleatoriedade; o formato sai idêntico (versão 4,
// variante 10xx), então nada do lado do servidor percebe a diferença.

type CryptoParcial = {
  randomUUID?: () => string;
  getRandomValues?: <T extends ArrayBufferView>(a: T) => T;
};

export function uuidV4(c: CryptoParcial | undefined = globalThis.crypto as CryptoParcial | undefined): string {
  if (typeof c?.randomUUID === "function") {
    try {
      return c.randomUUID();
    } catch {
      // contexto inseguro em alguns webviews: cai no de baixo
    }
  }
  const b = new Uint8Array(16);
  if (typeof c?.getRandomValues === "function") c.getRandomValues(b);
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
