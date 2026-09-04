// PAGOU E A MÚSICA AINDA NÃO EXISTE.
//
// ── O E-MAIL QUE ESTE ARQUIVO EXISTE PRA NÃO MANDAR ──────────────
//
// Até 04/09/2026 o webhook de pagamento mandava SEMPRE o mesmo e-mail:
// "A música de Fernanda está pronta", com o link do editor. Em dia normal
// isso é verdade, porque a música é gerada antes do pagamento.
//
// Naquele dia o Inngest ficou 58 minutos sem executar nada. Um comprador
// pagou às 15h29, o e-mail saiu às 15h29:25 anunciando uma música que só
// passou a existir às 16h20, e o link levava a uma página sem áudio. Ele
// clicou duas vezes, não achou nada, e abriu contestação. Depois disse "não
// recebi nada por email" — e, do lado dele, essa é uma descrição justa: o que
// chegou não era o que o assunto prometia.
//
// O erro não foi o atraso, foi o e-mail MENTIR sobre o atraso. Cinquenta
// minutos de espera com aviso honesto é um contratempo; cinquenta minutos com
// um "está pronta" na frente é motivo pra achar que caiu num golpe.
//
// ── AS DECISÕES DE TOM ───────────────────────────────────────────
//
// 1. O ASSUNTO NÃO PROMETE O QUE NÃO EXISTE. Ele confirma o pagamento, que é
//    a única coisa verdadeira naquele instante.
// 2. DIZ QUANTO TEMPO. "Em breve" é o que se escreve quando não se quer se
//    comprometer, e é exatamente o que faz a pessoa achar que sumiram com o
//    dinheiro. O número é conservador de propósito (a mediana medida é 112s).
// 3. O LINK VAI JUNTO, e o texto avisa que a página vai avisar sozinha quando
//    o áudio entrar. Assim o clique não vira decepção.
// 4. NÃO PEDE PACIÊNCIA e não pede desculpa por algo que ainda pode sair em
//    dois minutos. Quem pede desculpa cedo demais transforma espera normal em
//    problema. Se de fato demorar, quem pede desculpa é o `desculpa-atraso`.

type IdiomaEmail = "pt" | "es";

const COPY: Record<IdiomaEmail, {
  assunto: (n: string) => string;
  titulo: string;
  confirmado: string;
  quanto: string;
  botao: string;
  rodapeAviso: string;
  rodape: string;
}> = {
  pt: {
    assunto: (n) => `Pagamento confirmado — a música de ${n} está sendo gravada`,
    titulo: "Recebemos o seu pagamento. A música está sendo gravada agora.",
    confirmado:
      "Está tudo certo com a sua compra. A letra já está escrita, e neste momento ela está sendo cantada. É a última etapa.",
    quanto:
      "Normalmente leva menos de 5 minutos. Se o nosso fornecedor estiver com fila, pode chegar a 30. Você não precisa fazer nada nem ficar atualizando: assim que ficar pronta, mandamos outro e-mail com tudo.",
    botao: "ACOMPANHAR PELO MEU LINK →",
    rodapeAviso:
      "Este link já é seu e não muda. A página avisa sozinha quando o áudio entrar, e é por ela que você monta o presente e baixa o MP3.",
    rodape: "Serenata · uma música feita da história de quem você ama",
  },
  es: {
    assunto: (n) => `Pago confirmado — la canción de ${n} se está grabando`,
    titulo: "Recibimos tu pago. La canción se está grabando ahora.",
    confirmado:
      "Tu compra está en orden. La letra ya está escrita, y en este momento se está cantando. Es la última etapa.",
    quanto:
      "Normalmente toma menos de 5 minutos. Si nuestro proveedor tiene fila, puede llegar a 30. No tienes que hacer nada ni estar actualizando: en cuanto esté lista, te mandamos otro correo con todo.",
    botao: "SEGUIR POR MI ENLACE →",
    rodapeAviso:
      "Este enlace ya es tuyo y no cambia. La página avisa sola cuando entre el audio, y es por ahí que armas el regalo y descargas el MP3.",
    rodape: "Serenata · una canción hecha de la historia de quien vos querés",
  },
};

export function assuntoEmProducao(nome: string, locale: IdiomaEmail = "pt") {
  return COPY[locale]?.assunto(nome) ?? COPY.pt.assunto(nome);
}

export function emailEmProducao(args: {
  nome: string;
  linkEditor: string;
  locale?: IdiomaEmail;
}): string {
  const C = COPY[args.locale ?? "pt"] ?? COPY.pt;

  return `<!DOCTYPE html>
<html lang="${args.locale === "es" ? "es" : "pt-BR"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#faf5ee;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf5ee;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(42,21,24,0.06);">
        <tr><td style="height:5px;background:linear-gradient(90deg,#7d2b3a,#c9a227);"></td></tr>
        <tr><td style="padding:36px 32px 8px;">
          <h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:25px;line-height:1.3;color:#2a1518;font-weight:500;">
            ${C.titulo}
          </h1>
        </td></tr>
        <tr><td style="padding:16px 32px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:15px;line-height:1.65;color:#5a4448;">
          ${C.confirmado}
        </td></tr>
        <tr><td style="padding:16px 32px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:15px;line-height:1.65;color:#2a1518;">
          ${C.quanto}
        </td></tr>
        <tr><td align="center" style="padding:28px 32px 8px;">
          <a href="${args.linkEditor}" style="display:inline-block;background:#7d2b3a;color:#ffffff;text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:14px;font-weight:600;letter-spacing:0.04em;padding:16px 28px;border-radius:999px;">
            ${C.botao}
          </a>
        </td></tr>
        <tr><td style="padding:20px 32px 36px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:13px;line-height:1.6;color:#8a7276;">
          ${C.rodapeAviso}
        </td></tr>
      </table>
      <p style="margin:20px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:12px;color:#8a7276;">
        ${C.rodape}
      </p>
    </td></tr>
  </table>
</body></html>`;
}
