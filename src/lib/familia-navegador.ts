// A FAMÍLIA DO NAVEGADOR, num rótulo curto (08/10).
//
// Serve pra ler o `musica_play_falhou`: quando o play da prévia é recusado,
// a pergunta é QUAL ambiente recusa (navegador de app do Instagram, Safari do
// iPhone, Chrome do Android...). O user agent inteiro não vai pro evento: é
// longo, quase único por aparelho, e a leitura só precisa da família.
//
// Ordem importa: os navegadores de app se declaram Safari/Chrome também, então
// eles são testados primeiro.

export type FamiliaNavegador =
  | "instagram"
  | "facebook"
  | "tiktok"
  | "gmail-app"
  | "samsung"
  | "edge"
  | "firefox"
  | "chrome-ios"
  | "chrome-android"
  | "chrome"
  | "safari-ios"
  | "safari"
  | "webview-android"
  | "outro";

export function familiaDoNavegador(ua: string | null | undefined): FamiliaNavegador {
  const u = String(ua ?? "");
  if (!u) return "outro";
  if (/Instagram/i.test(u)) return "instagram";
  if (/FBAN|FBAV|FB_IAB/i.test(u)) return "facebook";
  if (/musical_ly|BytedanceWebview|TikTok/i.test(u)) return "tiktok";
  if (/GSA\/|Gmail/i.test(u)) return "gmail-app";
  if (/SamsungBrowser/i.test(u)) return "samsung";
  if (/EdgA?\/|EdgiOS/i.test(u)) return "edge";
  if (/Firefox|FxiOS/i.test(u)) return "firefox";
  if (/CriOS/i.test(u)) return "chrome-ios";
  const android = /Android/i.test(u);
  // `; wv)` é a marca do WebView do Android (app que abre link dentro dele).
  if (android && /; wv\)/i.test(u)) return "webview-android";
  if (/Chrome\//i.test(u)) return android ? "chrome-android" : "chrome";
  const ios = /iPhone|iPad|iPod/i.test(u);
  if (/Safari\//i.test(u)) return ios ? "safari-ios" : "safari";
  if (ios) return "safari-ios";
  return "outro";
}
