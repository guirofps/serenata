import { Resend } from "resend";

// O AVISO DE QUE A OPERAÇÃO PAROU.
//
// ── POR QUE ISTO EXISTE ──────────────────────────────────────────
//
// Duas vezes em doze dias um SALDO DE PROVEDOR zerou e derrubou a produção
// sem que nada avisasse ninguém:
//
//   08/08 — o kie.ai zerou às 21:47. Treze horas paradas, 38 músicas presas
//           em "gerando", 7 delas já pagas. Nasceu daí o `vigiarSaldo`.
//   19/08 — a Anthropic devolveu 400 "credit balance is too low". O funil
//           parou de escrever letra. Descoberto por acaso, porque o dono foi
//           testar o quiz por outro motivo.
//
// O modo de falha é o mesmo nos dois: o site continua de pé, o deploy está
// certo, nenhum monitor de uptime acusa nada — só que ninguém mais consegue
// comprar. É a pior categoria de defeito, porque parece que está tudo bem.
//
// ── POR QUE NÃO É UM CRON COMO O `vigiarSaldo` ───────────────────
//
// O kie.ai publica o saldo num endpoint (`/api/v1/chat/credit`), então dá pra
// perguntar de duas em duas horas e avisar ANTES de acabar. A Anthropic não
// expõe saldo pela API: não existe o que perguntar.
//
// Então aqui o gatilho é a própria falha. Perde-se o aviso antecipado, mas
// ganha-se imediatismo: o alerta sai no primeiro usuário que bate no erro, e
// não até duas horas depois como um cron daria. Para uma falha que já está
// acontecendo, imediato vence antecipado.

// O e-mail PESSOAL do dono, não o contato@. Mesma escolha do `vigiarSaldo`:
// alerta de operação tem que chegar em quem pode recarregar, e a caixa de
// suporte é onde ele se perderia no meio dos tickets.
const PARA = "guilhermerojasiqueira@gmail.com";

/**
 * Um aviso por assunto a cada 30 minutos.
 *
 * Sem isto, uma noite de tráfego normal com o saldo zerado mandaria centenas
 * de e-mails — e caixa cheia de alerta repetido é caixa que se aprende a
 * ignorar, que é o oposto do que este arquivo quer.
 *
 * LIMITAÇÃO CONHECIDA E ACEITA: a memória é da INSTÂNCIA serverless, e a
 * Vercel roda várias. Na prática saem alguns e-mails em vez de um, não
 * centenas. Guardar isso no banco tiraria a duplicata, mas poria uma escrita
 * no caminho de um código que só roda quando as coisas já estão quebradas —
 * e um alerta que depende do banco é um alerta que some junto com ele.
 */
const JANELA_MS = 30 * 60 * 1000;
const ultimoAviso = new Map<string, number>();

function passouDaJanela(chave: string): boolean {
  const agora = Date.now();
  const antes = ultimoAviso.get(chave) ?? 0;
  if (agora - antes < JANELA_MS) return false;
  ultimoAviso.set(chave, agora);
  return true;
}

/**
 * Manda o e-mail. Nunca lança.
 *
 * Se o alerta explodisse, ele derrubaria o caminho que estava só tentando
 * reportar um problema — e o usuário trocaria um erro por outro, pior de
 * diagnosticar.
 */
async function enviar(assunto: string, html: string): Promise<void> {
  try {
    const chave = process.env.RESEND_API_KEY;
    if (!chave) return;
    await new Resend(chave).emails.send({
      from: "Serenata <contato@serenatagift.com>",
      to: [PARA],
      subject: assunto,
      html,
    });
  } catch (err) {
    console.error("[alerta] não consegui avisar o dono:", err);
  }
}

/** O que a gente sabe reconhecer numa falha da Anthropic. */
export type CausaClaude = "saldo" | "chave" | "transitorio";

/**
 * Classifica a falha pelo status e pelo corpo.
 *
 * A separação que importa é entre o que PRECISA DE UM HUMANO (saldo, chave) e
 * o que passa sozinho (429 de limite, 529 de sobrecarga). Mandar e-mail de
 * transitório é a maneira mais rápida de fazer o dono criar filtro pra este
 * remetente, e aí o aviso que importa também some.
 */
export function classificarFalhaClaude(status: number, corpo: string): CausaClaude {
  if (status === 400 && /credit balance/i.test(corpo)) return "saldo";
  if (status === 401 || status === 403) return "chave";
  return "transitorio";
}

const TEXTO: Record<
  Exclude<CausaClaude, "transitorio">,
  { assunto: string; titulo: string; corpo: string; onde: string }
> = {
  saldo: {
    assunto: "PAROU: sem crédito na Anthropic, o funil não escreve mais letra",
    titulo: "O funil parou de produzir.",
    corpo:
      "A Anthropic recusou a chamada com <strong>&ldquo;your credit balance is too low&rdquo;</strong>." +
      " Quem está no quiz agora chega no fim e vê &ldquo;Não consegui escrever agora&rdquo;." +
      " O site continua no ar e o deploy está certo — só ninguém consegue comprar.",
    onde: "https://console.anthropic.com/settings/billing",
  },
  chave: {
    assunto: "PAROU: a chave da Anthropic foi recusada",
    titulo: "O funil parou de produzir.",
    corpo:
      "A Anthropic recusou a chave (401/403). Ou ela foi revogada, ou a variável" +
      " <code>ANTHROPIC_API_KEY</code> na Vercel está com valor errado." +
      " Quem está no quiz agora chega no fim e vê &ldquo;Não consegui escrever agora&rdquo;.",
    onde: "https://console.anthropic.com/settings/keys",
  },
};

/**
 * Chamada quando a Anthropic recusa. Loga sempre, avisa quando precisa de gente.
 *
 * O LOG É METADE DO CONSERTO, e não é a metade menos importante. Até 19/08
 * esta falha não escrevia NADA no servidor: o erro nascia na server function,
 * voltava embrulhado numa resposta HTTP 200, e só aparecia no `console.error`
 * do navegador de quem sofreu. O dono procurou nos logs da Vercel por status
 * de erro e por "anthropic", e não achou nada — porque não havia nada.
 */
export async function alertarFalhaClaude(args: {
  status: number;
  corpo: string;
  onde: string;
}): Promise<void> {
  const causa = classificarFalhaClaude(args.status, args.corpo);

  // SEMPRE no log, inclusive transitório. É por aqui que se descobre um 429
  // frequente, que não merece e-mail mas merece saber.
  console.error(
    `[claude] ${args.onde} falhou: ${args.status} (${causa}) ${args.corpo.slice(0, 300)}`,
  );

  if (causa === "transitorio") return;
  if (!passouDaJanela(`claude:${causa}`)) return;

  const t = TEXTO[causa];
  await enviar(
    t.assunto,
    `<div style="font-family:-apple-system,Segoe UI,Arial,sans-serif;font-size:15px;line-height:1.6;color:#2a1518;">
      <p style="font-size:18px;font-weight:600;margin:0 0 12px;">${t.titulo}</p>
      <p style="margin:0 0 12px;">${t.corpo}</p>
      <p style="margin:0 0 12px;">
        Resolva em <a href="${t.onde}">${t.onde}</a>. Vale na hora, sem deploy.
      </p>
      <p style="margin:0 0 12px;color:#6b5a52;font-size:13px;">
        Origem: <code>${args.onde}</code> · resposta da API:
        <code>${args.status}</code>
      </p>
      <p style="margin:0;color:#6b5a52;font-size:13px;">
        Você recebe no máximo um aviso destes a cada 30 minutos.
      </p>
    </div>`,
  );
}
