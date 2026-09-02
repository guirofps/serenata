// O DOSSIÊ DE UMA CONTESTAÇÃO, montado a partir dos nossos registros.
//
// Uso:
//   node scripts/dossie-disputa.mjs --pedido PPCPMTB5HJEG3FWNNP
//   node scripts/dossie-disputa.mjs --email fulano@gmail.com
//   node scripts/dossie-disputa.mjs --pedido woovi:336d62a5 --e2e E607011902026
//
// Passe o `--e2e` (o identificador do Banco Central) e o `--cobranca` (o id da
// Woovi) quando o aviso da contestação trouxer: eles não existem no nosso
// banco e são justamente os números pelos quais o adquirente localiza o caso.
//
// ── O QUE ESTE DOCUMENTO PRECISA PROVAR ──────────────────────────
//
// Quase toda contestação nossa chega como "não reconheço a compra" ou "fraude".
// Não é sobre o produto existir: é sobre o TITULAR ter agido.
//
// Por isso a ordem das provas não é cronológica, é por força:
//
//   1. O QUE ELE FEZ DEPOIS DE PAGAR. É a prova mais forte que existe, e é a
//      que quase ninguém tem. Subir 12 fotos da própria família e escrever uma
//      dedicatória exige posse do aparelho E do acervo pessoal do titular.
//      Fraudador não faz isso: ele não tem as fotos.
//   2. O QUE ELE FEZ ANTES DE PAGAR. Um questionário de oito passos com nome,
//      parentesco e história familiar. Levou minutos, não segundos.
//   3. A ENTREGA. E-mail entregue, aberto e clicado, com id do provedor.
//      Sozinha ela é fraca (ninguém contesta que o arquivo existe), mas fecha
//      a linha do tempo.
//
// ── O QUE NÃO ENTRA NO DOCUMENTO ─────────────────────────────────
//
// As FOTOS não são reproduzidas, nunca. Elas costumam retratar crianças e
// familiares de terceiros, e mandar isso pra uma fila de análise de adquirente
// é expor gente que não tem nada a ver com a disputa. O documento diz quantas
// são e aponta a URL da página, que o analista abre se quiser conferir.
//
// A LETRA da música também fica de fora por padrão: é longa e não prova nada
// que o título e a dedicatória já não provem.

import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => l.includes("=")).map((l) => {
    const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/[\r\n]/g, "")];
  }),
);
const db = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// ── argumentos ───────────────────────────────────────────────────
const arg = (nome) => {
  const i = process.argv.indexOf("--" + nome);
  return i > -1 ? process.argv[i + 1] : null;
};
const PEDIDO = arg("pedido");
const EMAIL = arg("email");
const E2E = arg("e2e");
const COBRANCA = arg("cobranca");
const SEM_PDF = process.argv.includes("--sem-pdf");
// ── O PRINT DA PÁGINA PRESENTE, e por que ele é OPCIONAL ────────
//
// É a peça mais persuasiva que existe: mostra o produto montado, com o nome de
// quem ganhou e a dedicatória escrita pelo comprador. Um analista entende em
// dois segundos o que levaria três parágrafos.
//
// E mesmo assim não é padrão, porque a página costuma trazer o ROSTO de
// terceiros. No primeiro caso que a gente defendeu era uma criança, e mandar
// isso pra uma fila de análise de adquirente é errado independentemente de
// ajudar na disputa. Quando as fotos são do próprio comprador com um adulto,
// a conta muda — mas quem decide é quem está olhando o caso, não o script.
const COM_PRINT = process.argv.includes("--print-presente");
const MOTIVO = arg("motivo") ?? "Contestação por alegação de fraude";

if (!PEDIDO && !EMAIL) {
  console.error("Faltou --pedido <payment_id> ou --email <endereco>.");
  process.exit(1);
}

const SITE = "https://www.serenatagift.com";
const CNPJ = "45.835.258/0001-46";

// Tudo em Brasília. O adquirente lê horário local, e uma linha do tempo em UTC
// parece um dia diferente do que o cliente viveu.
const BRT = (iso) => {
  if (!iso) return null;
  const d = new Date(Date.parse(iso) - 3 * 3600000);
  return {
    data: `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`,
    hora: `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}:${String(d.getUTCSeconds()).padStart(2, "0")}`,
    ms: Date.parse(iso),
  };
};
const dataHora = (iso) => { const b = BRT(iso); return b ? `${b.data} às ${b.hora}` : "—"; };
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const brl = (c) => `R$ ${(c / 100).toFixed(2).replace(".", ",")}`;
const duracao = (ms) => {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} segundos`;
  const m = Math.floor(s / 60);
  return s % 60 ? `${m} min ${s % 60} s` : `${m} minutos`;
};

// ── 1. O PEDIDO ──────────────────────────────────────────────────
let pedido = null;
if (PEDIDO) {
  const { data } = await db.from("pedidos").select("*").eq("payment_id", PEDIDO).maybeSingle();
  pedido = data;
  if (!pedido) {
    // Busca frouxa: o aviso da contestação às vezes traz só um pedaço da
    // referência, e digitar o id inteiro à mão é onde se erra.
    const { data: parecidos } = await db.from("pedidos").select("*").ilike("payment_id", `%${PEDIDO}%`).limit(5);
    if ((parecidos ?? []).length === 1) pedido = parecidos[0];
    else if ((parecidos ?? []).length > 1) {
      console.error("Mais de um pedido casa com isso. Escolha um:");
      for (const p of parecidos) console.error("  ", p.payment_id, brl(p.valor_centavos), p.email, p.paid_at);
      process.exit(1);
    }
  }
}
if (!pedido && EMAIL) {
  const { data } = await db.from("pedidos").select("*").eq("email", EMAIL).eq("status", "pago")
    .order("paid_at", { ascending: false }).limit(5);
  if ((data ?? []).length > 1) {
    console.error(`${data.length} compras pagas nesse e-mail. Rode de novo com --pedido:`);
    for (const p of data) console.error("  ", p.payment_id, brl(p.valor_centavos), dataHora(p.paid_at));
    process.exit(1);
  }
  pedido = (data ?? [])[0];
}
if (!pedido) { console.error("Não achei o pedido."); process.exit(1); }
if (pedido.status !== "pago") console.warn(`AVISO: o pedido está como "${pedido.status}", não "pago".`);

// ── 2. QUIZ, MÚSICA, SESSÃO ──────────────────────────────────────
const { data: quiz } = pedido.quiz_response_id
  ? await db.from("quiz_responses").select("*").eq("id", pedido.quiz_response_id).maybeSingle()
  : { data: null };
const { data: musica } = pedido.musica_id
  ? await db.from("musicas").select("*").eq("id", pedido.musica_id).maybeSingle()
  : { data: null };

const respostas = (quiz?.respostas ?? {});
const atrib = (quiz?.attribution ?? {});
const sessionId = quiz?.session_id ?? null;

// ── 3. A LINHA DO TEMPO ──────────────────────────────────────────
//
// Só eventos DAQUELA sessão. É o que amarra o pagamento a um navegador que
// passou vinte minutos respondendo perguntas sobre a família do titular.
let eventos = [];
if (sessionId) {
  for (let i = 0; i < 20000; i += 1000) {
    const { data } = await db.from("funnel_events")
      .select("event_name, event_data, created_at")
      .eq("session_id", sessionId).order("created_at").range(i, i + 999);
    if (!data) break;
    eventos.push(...data);
    if (data.length < 1000) break;
  }
}

// Nome humano de cada marco. O que não está aqui não entra na linha do tempo:
// documento de disputa não é log, é narrativa verificável.
const MARCOS = {
  quiz_started: "Início do questionário",
  letra_finalizada: "Letra concluída pelo comprador",
  musica_pronta: "Música gerada e armazenada",
  musica_play: "Comprador reproduz a música",
  preview_limite: "Prévia ouvida até o limite gratuito",
  oferta_vista: "Comprador visualiza a oferta e o preço",
  botao_comprar: "Comprador aciona a compra",
  checkout_click: "Comprador aciona a compra",
  pix_transparente_abriu: "Resumo do pedido aberto",
  pix_transparente_gerado: "Código PIX gerado no navegador do comprador",
  pix_transparente_copiou: "Comprador copia o código PIX",
  pix_transparente_pago: "Pagamento reconhecido pela página",
  quadro_imprimir: "Comprador imprime o quadro",
  credito_resgatado: "Comprador resgata crédito",
};

const linha = [];
const primeiroDe = new Map();
// DEDUPE PELO TEXTO, nao pelo nome do evento. `botao_comprar` e
// `checkout_click` disparam juntos e descrevem o mesmo gesto: duas linhas
// identicas no mesmo segundo fazem a linha do tempo parecer log copiado, e
// quem le procura motivo pra desconfiar.
const textosNaLinha = new Set();
for (const e of eventos) {
  if (!MARCOS[e.event_name]) continue;
  if (!primeiroDe.has(e.event_name)) primeiroDe.set(e.event_name, e.created_at);
  if (textosNaLinha.has(MARCOS[e.event_name])) continue;
  textosNaLinha.add(MARCOS[e.event_name]);
  linha.push({ quando: e.created_at, texto: MARCOS[e.event_name] });
}
// A previa so entra se aconteceu ANTES do pagamento, que e o unico momento em
// que ela prova alguma coisa (a pessoa ouviu e so entao decidiu pagar). A
// coluna e mutavel: uma regeracao posterior jogaria a linha pro fim do
// documento, depois da personalizacao, e uma cronologia impossivel derruba a
// credibilidade do resto.
if (musica?.previa_em && pedido.paid_at && Date.parse(musica.previa_em) < Date.parse(pedido.paid_at)) {
  linha.push({ quando: musica.previa_em, texto: "Prévia disponibilizada ao comprador" });
}
if (pedido.paid_at) linha.push({ quando: pedido.paid_at, texto: `Pagamento confirmado — ${brl(pedido.valor_centavos)}` });

// ── 4. A ENTREGA POR E-MAIL ──────────────────────────────────────
const { data: enviados } = await db.from("emails_enviados")
  .select("email_id, template, para, created_at").eq("para", pedido.email)
  .order("created_at", { ascending: true });
const entrega = (enviados ?? []).find((e) => e.template === "entrega" || e.template === "presente_pronto")
  ?? (enviados ?? [])[0] ?? null;

// O QUE O PROVEDOR REGISTROU, e nada alem disso. A conclusao dizia "entregue"
// mesmo quando nenhum evento tinha chegado ainda — e-mail mandado ha vinte
// minutos costuma nao ter registro nenhum. Afirmar entrega sem o evento e a
// unica linha do dossie que o outro lado consegue derrubar, e derrubar uma
// derruba a leitura das outras.
let estadoEmail = { entregue: false, aberto: false, clicado: false, assunto: null };
if (entrega?.email_id) {
  const { data: evs } = await db.from("funnel_events")
    .select("event_name, event_data")
    .in("event_name", ["email_delivered", "email_opened", "email_clicked"])
    .contains("event_data", { email_id: entrega.email_id }).limit(50);
  for (const e of evs ?? []) {
    if (e.event_name === "email_delivered") estadoEmail.entregue = true;
    if (e.event_name === "email_opened") estadoEmail.aberto = true;
    if (e.event_name === "email_clicked") estadoEmail.clicado = true;
    if (e.event_data?.assunto) estadoEmail.assunto = e.event_data.assunto;
  }
  linha.push({ quando: entrega.created_at, texto: `E-mail de entrega enviado para ${pedido.email}` });
}

// ── A PALAVRA FINAL É DO PROVEDOR, NÃO DO NOSSO WEBHOOK ─────────
//
// O Resend guarda o `last_event` de cada envio e devolve o HTML exato que saiu.
// Nosso webhook grava a mesma coisa, mas com atraso: neste caso ele dizia
// "sem abertura registrada" enquanto o provedor já marcava `clicked`.
//
// Num documento de disputa isso é a diferença entre "enviado" e "aberto e com
// link clicado", que é a linha mais forte da seção de entrega. Então a fonte
// passa a ser o provedor, e o nosso registro vira reforço.
let emailDoProvedor = null;
if (entrega?.email_id && env.RESEND_API_KEY) {
  try {
    const r = await fetch(`https://api.resend.com/emails/${entrega.email_id}`, {
      headers: { Authorization: "Bearer " + env.RESEND_API_KEY },
    });
    if (r.ok) {
      emailDoProvedor = await r.json();
      const ev = String(emailDoProvedor.last_event ?? "");
      // `clicked` implica aberto, e aberto implica entregue: o Resend guarda só
      // o ÚLTIMO evento, não a lista.
      if (["delivered", "opened", "clicked"].includes(ev)) estadoEmail.entregue = true;
      if (["opened", "clicked"].includes(ev)) estadoEmail.aberto = true;
      if (ev === "clicked") estadoEmail.clicado = true;
      if (emailDoProvedor.subject) estadoEmail.assunto = emailDoProvedor.subject;
    }
  } catch {
    // Provedor fora do ar não impede o dossiê: o que temos no nosso banco vale.
  }
}

const textoEstadoEmail = estadoEmail.clicado
  ? "comprovadamente aberto e com link clicado"
  : estadoEmail.aberto ? "comprovadamente aberto"
  : estadoEmail.entregue ? "registrado como entregue pelo provedor"
  : "registrado como enviado pelo provedor";

// ── 5. O USO DEPOIS DO PAGAMENTO ─────────────────────────────────
//
// A prova mais forte do dossiê. Buscada por CAMINHO, não por sessão: o
// comprador abre o presente no celular, no computador e manda pra família, e
// cada um desses é uma sessão diferente. É exatamente isso que se quer mostrar.
let acessos = [];
if (musica?.token || musica?.token_edicao) {
  const desde = pedido.paid_at ?? pedido.created_at;
  for (let i = 0; i < 20000; i += 1000) {
    const { data } = await db.from("funnel_events")
      .select("session_id, event_data, created_at")
      .eq("event_name", "page_view").gte("created_at", desde)
      .order("created_at").range(i, i + 999);
    if (!data) break;
    for (const e of data) {
      const p = String(e.event_data?.path ?? "");
      if ((musica.token && p.includes(musica.token)) || (musica.token_edicao && p.includes(musica.token_edicao))) {
        acessos.push({ quando: e.created_at, path: p, sessao: e.session_id });
      }
    }
    if (data.length < 1000) break;
  }
}
const dispositivos = new Set(acessos.map((a) => a.sessao)).size;

// ── COMPARTILHAMENTO SO SE HOUVER COMO SUSTENTAR ────────────────
//
// Sessao nova nao e aparelho novo: recarregar a pagina, abrir pelo aplicativo
// do e-mail e voltar depois ja criam ids diferentes no MESMO celular. Na
// primeira versao deste gerador, tres acessos em OITO SEGUNDOS viraram "o
// produto foi acessado por 2 outros dispositivos" — uma frase que o analista
// derruba olhando os horarios, e que leva junto a credibilidade das provas
// boas que estao na mesma pagina.
//
// A regra: so afirma compartilhamento quando existe distancia no tempo. Uma
// hora entre o primeiro e o ultimo acesso e o minimo pra a frase parar de pe.
const HORA = 3600000;
const janelaAcessos = acessos.length > 1
  ? Date.parse(acessos[acessos.length - 1].quando) - Date.parse(acessos[0].quando) : 0;
const houveCompartilhamento = dispositivos > 1 && janelaAcessos >= HORA;
const acessosEditor = acessos.filter((a) => a.path.includes("/editar/"));
const acessosPresente = acessos.filter((a) => a.path.includes("/p/"));
if (acessosEditor.length) linha.push({ quando: acessosEditor[0].quando, texto: "Comprador acessa a área de edição do presente" });
if (acessosPresente.length) linha.push({ quando: acessosPresente[0].quando, texto: "Página do presente acessada" });

linha.sort((a, b) => Date.parse(a.quando) - Date.parse(b.quando));

const galeria = Array.isArray(musica?.galeria) ? musica.galeria : [];
const totalFotos = (musica?.foto_path ? 1 : 0) + galeria.length;
const inicio = primeiroDe.get("quiz_started") ?? quiz?.created_at ?? null;
const tempoAtePagar = inicio && pedido.paid_at ? Date.parse(pedido.paid_at) - Date.parse(inicio) : null;
const tempoAteMontar = pedido.paid_at && musica?.personalizada_em
  ? Date.parse(musica.personalizada_em) - Date.parse(pedido.paid_at) : null;
const copiouPix = primeiroDe.get("pix_transparente_copiou");
const entreCopiaEPagamento = copiouPix && pedido.paid_at ? Date.parse(pedido.paid_at) - Date.parse(copiouPix) : null;

// A referência que ENCABEÇA o documento é a que o adquirente conhece. O nosso
// `payment_id` interno ("woovi:serenata:548bf46d…") não localiza nada na fila
// de análise dele, e abrir um documento de disputa com um número que o leitor
// não reconhece é começar perdendo.
const referencia = E2E ?? COBRANCA ?? pedido.payment_id;

// ── O NOME QUE A PESSOA DIGITOU NO PRÓPRIO BANCO ─────────────────
//
// `titular_pix` é quem a instituição diz que é o dono da conta. `nome_pagador`
// é o texto que a PESSOA escreveu, e às vezes ela escreve ali o apelido de
// quem vai ganhar o presente.
//
// Quando esse texto bate com uma resposta do quiz, é a prova mais forte que um
// dossiê destes pode ter: são dois sistemas independentes, o nosso e o do banco
// dela, guardando a mesma palavra escrita pela mesma pessoa. Fraudador não sabe
// o apelido, e não teria motivo pra digitá-lo.
const inicioQuiz = quiz?.created_at ?? pedido.created_at;
const nomeNoQuiz = String(respostas.nome ?? "").trim();
const nomeNoPix = String(pedido.nome_pagador ?? "").trim();
const normal = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
const batemOsNomes = Boolean(
  nomeNoQuiz && nomeNoPix &&
  nomeNoPix !== (pedido.titular_pix ?? "") &&
  (normal(nomeNoPix).includes(normal(nomeNoQuiz)) || normal(nomeNoQuiz).includes(normal(nomeNoPix))),
);
const nomeArquivo = `evidencias-${String(referencia).replace(/[^A-Za-z0-9_-]/g, "-")}`;

// ── 5b. O PRINT DA PÁGINA, quando pedido ────────────────────────
let printPresente = null;
const acharChrome = () => [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
].find((c) => existsSync(c));

if (COM_PRINT && musica?.token) {
  const chrome = acharChrome();
  const destino = `${process.cwd()}/docs/disputas/.print-presente.png`;
  if (chrome) {
    try {
      if (!existsSync("docs/disputas")) mkdirSync("docs/disputas", { recursive: true });
      execFileSync(chrome, [
        "--headless", "--disable-gpu", "--hide-scrollbars",
        "--window-size=500,1000",
        // A página monta no cliente e as fotos vêm do Storage: sem orçamento de
        // tempo o print sai preto, que é pior que print nenhum.
        "--virtual-time-budget=9000",
        `--screenshot=${destino}`,
        `${SITE}/p/${musica.token}`,
      ], { stdio: "ignore", timeout: 90000 });
      if (existsSync(destino)) {
        printPresente = readFileSync(destino).toString("base64");
        // APAGA O ARQUIVO SOLTO. Ele vai embutido no documento; deixado em
        // disco, viraria uma foto do rosto de um cliente versionada no git,
        // que é exatamente o que a regra das fotos existe pra evitar.
        rmSync(destino, { force: true });
      }
    } catch (e) {
      console.warn("print da página não saiu:", String(e.message).slice(0, 100));
    }
  }
}

// ── 6. O DOCUMENTO ───────────────────────────────────────────────
const bloco = (rotulo, valor) => valor == null || valor === "" ? "" :
  `<div class="par"><dt>${esc(rotulo)}</dt><dd>${valor}</dd></div>`;

const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8">
<title>Evidências · Transação ${esc(referencia)}</title>
<style>
  @page { size: A4; margin: 16mm 14mm; }
  * { box-sizing: border-box; }
  body { margin:0; font-family: "Helvetica Neue", Arial, sans-serif; color:#1b1b1b; font-size:11pt; line-height:1.5; }
  .capa { border-bottom:2px solid #1b1b1b; padding-bottom:14px; margin-bottom:22px; }
  h1 { font-size:19pt; margin:0 0 4px; letter-spacing:-0.01em; }
  .sub { font-size:11pt; color:#444; margin:0; }
  .ident { font-size:9.5pt; color:#666; margin-top:10px; }
  h2 { font-size:12.5pt; margin:26px 0 10px; padding-bottom:5px; border-bottom:1px solid #bbb; page-break-after:avoid; }
  dl { margin:0; }
  .par { display:grid; grid-template-columns: 34% 1fr; gap:10px; padding:5px 0; border-bottom:1px solid #eee; page-break-inside:avoid; }
  dt { color:#555; font-size:10pt; margin:0; }
  dd { margin:0; font-size:10.5pt; }
  .forte { font-weight:700; }
  table.tempo { width:100%; border-collapse:collapse; font-size:10pt; }
  table.tempo td { padding:4px 8px; border-bottom:1px solid #eee; vertical-align:top; }
  table.tempo td.h { width:78px; font-variant-numeric:tabular-nums; color:#555; white-space:nowrap; }
  p { margin:0 0 10px; }
  ul { margin:0 0 10px; padding-left:18px; }
  li { margin-bottom:4px; }
  .caixa { border:1px solid #bbb; padding:12px 14px; margin:12px 0; page-break-inside:avoid; }
  .rodape { margin-top:28px; padding-top:10px; border-top:1px solid #bbb; font-size:9pt; color:#666; }
  .nota { font-size:9.5pt; color:#555; font-style:italic; }
</style></head>
<body>

<div class="capa">
  <h1>Evidências de autenticidade e entrega</h1>
  <p class="sub">Transação <strong>${esc(referencia)}</strong> · ${esc(MOTIVO)}</p>
  <p class="ident">Serenata · CNPJ ${CNPJ} · contato@serenatagift.com · ${SITE}</p>
</div>

<h2>1. Modelo de negócio</h2>
<dl>
  ${bloco("Natureza do produto", "Produto <span class='forte'>100% digital</span>. Não há envio físico, transportadora ou código de rastreio.")}
  ${bloco("Canal de venda", `Site próprio, ${SITE}. A compra é feita pelo próprio cliente, sem intermediário e sem atendimento humano.`)}
  ${bloco("Como é produzido", "O cliente preenche um questionário sobre a pessoa homenageada. A partir dessas respostas é composta uma música original e montada uma página digital de presente, com link e QR Code.")}
  ${bloco("Forma de entrega", "E-mail com o link de acesso, enviado automaticamente após a confirmação do pagamento, mais acesso permanente pela página do presente.")}
  ${bloco("Prazo de entrega", "Imediato. A música é produzida <span class='forte'>antes</span> do pagamento, e o cliente ouve uma amostra antes de decidir comprar.")}
</dl>

<h2>2. Identificação da transação</h2>
<dl>
  ${E2E ? bloco("ID da transação (Banco Central)", `<span class="forte">${esc(E2E)}</span>`) : ""}
  ${COBRANCA ? bloco("ID da cobrança no gateway", esc(COBRANCA)) : ""}
  ${bloco("Identificador interno do pedido", esc(pedido.payment_id))}
  ${bloco("Meio de pagamento", esc(pedido.gateway))}
  ${bloco("Valor", `<span class="forte">${brl(pedido.valor_centavos)}</span>`)}
  ${bloco("Cobrança criada em", dataHora(pedido.created_at))}
  ${bloco("Pagamento confirmado em", `<span class="forte">${dataHora(pedido.paid_at)}</span>`)}
  ${bloco("Titular da conta pagadora", esc(pedido.titular_pix ?? pedido.nome_pagador))}
  ${nomeNoPix && nomeNoPix !== (pedido.titular_pix ?? "") ? bloco("Descrição escrita pelo pagador", `“${esc(nomeNoPix)}”`) : ""}
  ${bloco("E-mail informado pelo comprador", esc(pedido.email))}
  ${bloco("Telefone informado pelo comprador", esc(pedido.telefone))}
</dl>

${batemOsNomes ? `<div class="caixa">
  <p style="margin:0"><strong>Coincidência entre dois sistemas independentes.</strong>
  A descrição escrita pelo pagador no aplicativo do próprio banco (“${esc(nomeNoPix)}”) é a mesma
  identificação que o comprador havia digitado no nosso questionário, ${Math.round((Date.parse(pedido.paid_at) - Date.parse(inicioQuiz)) / 60000)} minutos antes, ao
  informar para quem era o presente (“${esc(nomeNoQuiz)}”). São dois registros produzidos em
  sistemas distintos, o do banco e o nosso, contendo o mesmo texto escrito pela mesma pessoa.</p>
</div>` : ""}

<h2>3. O que foi comprado</h2>
<dl>
  ${bloco("Produto", "Música personalizada composta a partir de história enviada pelo próprio comprador, com página digital de presente e QR Code.")}
  ${bloco("Título gerado", musica?.titulo ? `<span class="forte">“${esc(musica.titulo)}”</span>` : null)}
  ${bloco("Situação do arquivo", musica?.gerada_em ? `Produzido e armazenado, disponível ao comprador desde ${dataHora(musica.gerada_em)}` : "Produzido e armazenado")}
  ${bloco("Página de entrega", musica?.token ? `${SITE}/p/${esc(musica.token)}` : null)}
</dl>

<h2>4. O pagamento foi feito pelo próprio titular, de forma deliberada</h2>
<p>
  Antes de pagar, a pessoa preencheu um questionário pessoal, em etapas, com informações que
  somente ela poderia fornecer. O conteúdo enviado identifica a relação e a destinatária do presente:
</p>
<dl>
  ${atrib.gclid ? bloco("Origem do acesso", `Clique em anúncio do Google, identificador de clique <span style="font-size:8.5pt;word-break:break-all">${esc(atrib.gclid)}</span>`) : ""}
  ${bloco("Relação declarada", esc(respostas.relacao))}
  ${bloco("Nome da homenageada", esc(respostas.nome))}
  ${bloco("Ocasião informada", esc(respostas.ocasiao))}
  ${bloco("Dedicatória escrita pelo comprador", musica?.dedicatoria ? `“${esc(musica.dedicatoria)}”` : null)}
  ${bloco("Trecho da história enviada", respostas.historia1 ? `“${esc(String(respostas.historia1).slice(0, 260))}${String(respostas.historia1).length > 260 ? "…" : ""}”` : null)}
  ${tempoAtePagar ? bloco("Tempo entre o início e o pagamento", `<span class="forte">${duracao(tempoAtePagar)}</span>`) : ""}
  ${entreCopiaEPagamento != null ? bloco("Entre copiar o código PIX e pagar", `<span class="forte">${duracao(entreCopiaEPagamento)}</span>`) : ""}
</dl>
<p class="nota">
  O código PIX foi gerado e copiado pelo próprio navegador do comprador, no mesmo aparelho em que
  o questionário foi respondido.
</p>

<h2>5. Linha do tempo registrada nos nossos sistemas</h2>
<table class="tempo">
${linha.map((l) => `  <tr><td class="h">${BRT(l.quando).hora}</td><td>${esc(l.texto)}</td></tr>`).join("\n")}
</table>
<p class="nota">Horários no fuso de Brasília (UTC−3), data de ${BRT(pedido.paid_at ?? pedido.created_at).data}.</p>

${totalFotos || musica?.personalizada_em ? `
<h2>6. Uso do produto após o pagamento</h2>
<p>
  O produto entregue é uma página digital que o comprador personaliza${tempoAteMontar ? `. Os registros mostram que,
  <span class="forte">${duracao(tempoAteMontar)} depois de pagar</span>, o titular acessou a área de edição e montou o presente` : ""}:
</p>
<dl>
  ${musica?.personalizada_em ? bloco("Personalização concluída em", dataHora(musica.personalizada_em)) : ""}
  ${totalFotos ? bloco("Fotografias enviadas", `<span class="forte">${totalFotos} ${totalFotos === 1 ? "imagem" : "imagens"}</span>${galeria.length ? ` — 1 foto de capa e ${galeria.length} na galeria` : ""}, carregadas pelo comprador a partir do próprio dispositivo`) : ""}
  ${musica?.dedicatoria ? bloco("Dedicatória escrita", `“${esc(musica.dedicatoria)}”`) : ""}
  ${musica?.versao_preferida ? bloco("Escolha da gravação", `O comprador ouviu as duas versões produzidas e definiu a versão ${esc(musica.versao_preferida)} como preferida`) : ""}
  ${musica?.efeito || musica?.cor_destaque ? bloco("Personalização visual", `Cor de destaque e efeito visual selecionados pelo comprador`) : ""}
</dl>
${totalFotos ? `<p>
  O envio de ${totalFotos === 1 ? "uma fotografia pessoal" : `${totalFotos} fotografias pessoais`}, a redação de uma dedicatória e a escolha entre
  as gravações são atos deliberados, executados depois da confirmação do pagamento e que exigem
  acesso ao conteúdo pessoal do titular. <span class="nota">As imagens não são reproduzidas neste documento
  por retratarem pessoas que não são parte da disputa; a página permanece disponível para verificação
  direta no endereço indicado no item 3.</span>
</p>` : ""}` : ""}

<h2>${totalFotos || musica?.personalizada_em ? "7" : "6"}. Comprovação da entrega</h2>
<dl>
  ${entrega ? bloco("E-mail de entrega", `Enviado em ${dataHora(entrega.created_at)}${estadoEmail.assunto ? `, assunto “${esc(estadoEmail.assunto)}”` : ""}, de contato@serenatagift.com para ${esc(pedido.email)}.`) : ""}
  ${entrega ? bloco("Situação registrada pelo provedor", `<span class="forte">${esc(textoEstadoEmail.replace("comprovadamente ", "").replace("registrado como ", "").replace(" pelo provedor", ""))}</span>`) : ""}
  ${entrega?.email_id ? bloco("ID do envio", `<span style="font-size:9pt">${esc(entrega.email_id)}</span>`) : ""}
  ${acessos.length ? bloco("Acesso ao produto", `<span class="forte">${acessos.length} acessos registrados</span> à página do presente e à área de edição, a partir de <span class="forte">${dispositivos} ${dispositivos === 1 ? "sessão distinta" : "sessões distintas"}</span>, entre ${dataHora(acessos[0].quando)} e ${dataHora(acessos[acessos.length - 1].quando)}.`) : ""}
  ${houveCompartilhamento ? bloco("Compartilhamento", "O produto foi acessado ao longo de horas, a partir de sessões distintas. O compartilhamento do link é a finalidade do produto: trata-se de um presente digital destinado a terceiros.") : ""}
</dl>

${printPresente ? `
<h2>${totalFotos || musica?.personalizada_em ? "8" : "7"}. O produto entregue</h2>
<p>
  Reprodução da página de presente tal como está publicada em
  ${SITE}/p/${esc(musica.token)}, montada pelo próprio comprador
  ${musica?.personalizada_em ? `em ${dataHora(musica.personalizada_em)}` : ""}.
</p>
<div style="text-align:center;margin:12px 0">
  <img src="data:image/png;base64,${printPresente}" style="width:74mm;border:1px solid #999" alt="Página de presente">
</div>` : ""}

${emailDoProvedor?.html ? `
<h2>${(totalFotos || musica?.personalizada_em ? 8 : 7) + (printPresente ? 1 : 0)}. Reprodução do e-mail de entrega</h2>
<p>
  Cópia fiel do e-mail enviado ao cliente em ${dataHora(entrega.created_at)},
  <span class="forte">recuperada do provedor de envio</span>. O provedor registra este envio como
  <span class="forte">${esc(textoEstadoEmail.replace("comprovadamente ", "").replace("registrado como ", "").replace(" pelo provedor", ""))}</span>.
</p>
<dl>
  ${bloco("De", esc(emailDoProvedor.from))}
  ${bloco("Para", esc([].concat(emailDoProvedor.to ?? []).join(", ")))}
  ${bloco("Assunto", esc(emailDoProvedor.subject))}
  ${bloco("Enviado em", dataHora(emailDoProvedor.created_at))}
  ${bloco("ID do envio", `<span style="font-size:9pt">${esc(emailDoProvedor.id)}</span>`)}
</dl>
<div style="border:1px solid #999;margin:10px 0;overflow:hidden">
  <iframe srcdoc="${esc(emailDoProvedor.html)}" style="width:100%;height:250mm;border:0" title="E-mail de entrega"></iframe>
</div>` : ""}

<h2>${(totalFotos || musica?.personalizada_em ? 8 : 7) + (printPresente ? 1 : 0) + (emailDoProvedor?.html ? 1 : 0)}. Conclusão</h2>
<ul>
  ${tempoAtePagar ? `<li>O pagamento foi originado no próprio navegador do comprador, após ${duracao(tempoAtePagar)} de preenchimento de um questionário com informações pessoais.</li>` : ""}
  ${primeiroDe.get("musica_play") ? "<li>O comprador ouviu uma amostra do produto antes de decidir pagar.</li>" : ""}
  ${entrega && pedido.paid_at ? `<li>O produto foi entregue ${(() => { const d = Date.parse(entrega.created_at) - Date.parse(pedido.paid_at); return d < 60000 ? "no mesmo minuto da" : duracao(d) + " após a"; })()} confirmação do pagamento, por e-mail ${textoEstadoEmail}.</li>` : ""}
  ${acessos.length ? `<li>O comprador acessou o produto ${acessos.length} vezes após o pagamento.</li>` : ""}
  ${totalFotos ? `<li>O comprador enviou ${totalFotos} ${totalFotos === 1 ? "fotografia pessoal" : "fotografias pessoais"}${musica?.dedicatoria ? " e escreveu uma dedicatória" : ""}${tempoAteMontar ? ` ${duracao(tempoAteMontar)} após o pagamento` : ""}.</li>` : ""}
  ${houveCompartilhamento ? `<li>O produto foi acessado a partir de ${dispositivos} sessões distintas, ao longo de ${duracao(janelaAcessos)}.</li>` : ""}
</ul>
<div class="caixa">
  O conjunto de registros é incompatível com a hipótese de fraude ou uso não autorizado da conta:
  o produto é personalizado, foi construído com informações fornecidas pelo próprio titular,
  foi entregue integralmente e permaneceu em uso após o pagamento${totalFotos ? ", inclusive com o envio de fotografias pessoais, ato que pressupõe posse do dispositivo e do acervo pessoal do titular" : ""}.
  A entrega permanece disponível e o acesso do comprador não foi restringido.
</div>

<p class="rodape">
  Documento gerado a partir dos registros operacionais da Serenata em ${dataHora(new Date().toISOString())}.
  Todos os horários estão no fuso de Brasília (UTC−3).
  Registros adicionais podem ser fornecidos mediante solicitação.
</p>

</body></html>`;

// ── 7. GRAVA E IMPRIME ───────────────────────────────────────────
const pasta = "docs/disputas";
if (!existsSync(pasta)) mkdirSync(pasta, { recursive: true });
const caminhoHtml = `${pasta}/${nomeArquivo}.html`;

// ── NÃO SOBRESCREVE DOSSIÊ QUE JÁ EXISTE ────────────────────────
//
// Um dossiê que já foi gerado provavelmente JÁ FOI ENVIADO, e aí ele deixa de
// ser um relatório e passa a ser o registro do que a gente afirmou. Se o caso
// reabrir, o que importa é o documento exato que o adquirente recebeu, não uma
// versão nova montada com dados de hoje.
//
// Isto entrou depois de eu apagar o dossiê original do E607011902026 rodando
// o gerador em cima do caso antigo pra testar. O arquivo estava em `scratch/`,
// que é gitignored, e não teve como voltar.
if (existsSync(caminhoHtml) && !process.argv.includes("--refazer")) {
  console.error(`\nJá existe um dossiê deste caso:\n  ${caminhoHtml}`);
  console.error(`\nSe ele já foi enviado, ele é o registro do que foi afirmado e não deve ser`);
  console.error(`trocado. Pra gerar uma versão nova mesmo assim, repita com --refazer;`);
  console.error(`pra guardar as duas, mude o nome do arquivo antigo antes.\n`);
  process.exit(1);
}
writeFileSync(caminhoHtml, html, "utf8");

let caminhoPdf = null;
if (!SEM_PDF) {
  // O Chrome que já está na máquina. Sem dependência nova por causa de um
  // documento que sai uma vez por semana.
  const chromes = [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  ];
  const chrome = chromes.find((c) => existsSync(c));
  if (chrome) {
    caminhoPdf = `${pasta}/${nomeArquivo}.pdf`;
    try {
      execFileSync(chrome, [
        "--headless", "--disable-gpu", "--no-pdf-header-footer",
        `--print-to-pdf=${process.cwd()}/${caminhoPdf}`,
        `file:///${process.cwd().replace(/\\/g, "/")}/${caminhoHtml}`,
      ], { stdio: "ignore", timeout: 90000 });
    } catch (e) {
      console.warn("PDF não saiu automaticamente:", e.message.slice(0, 120));
      caminhoPdf = null;
    }
  }
}

// ── 8. O RESUMO, pra conferir antes de mandar ────────────────────
console.log("\n" + "=".repeat(70));
console.log("DOSSIÊ MONTADO");
console.log("=".repeat(70));
console.log("  referência .....", referencia);
console.log("  comprador ......", pedido.email, "|", pedido.titular_pix ?? pedido.nome_pagador ?? "(titular não gravado)");
console.log("  valor ..........", brl(pedido.valor_centavos), "|", pedido.gateway, "|", dataHora(pedido.paid_at));
console.log("  música .........", musica?.titulo ?? "(sem música)");
console.log("");
console.log("  FORÇA DAS PROVAS:");
const prova = (ok, texto) => console.log("   ", ok ? "[forte]" : "[falta]", texto);
prova(totalFotos > 0, `${totalFotos} foto(s) enviada(s) depois do pagamento`);
prova(Boolean(musica?.dedicatoria), "dedicatória escrita pelo comprador");
prova(Boolean(tempoAtePagar && tempoAtePagar > 3 * 60000), `${tempoAtePagar ? duracao(tempoAtePagar) : "?"} preenchendo o questionário antes de pagar`);
prova(Boolean(primeiroDe.get("musica_play")), "ouviu a música antes de pagar");
prova(estadoEmail.aberto, `e-mail de entrega ${estadoEmail.aberto ? "aberto" : "sem abertura registrada"}${estadoEmail.clicado ? " e clicado" : ""}`);
prova(acessos.length > 0, `${acessos.length} acesso(s) ao produto depois do pagamento, ${dispositivos} sessao(oes)`);
prova(houveCompartilhamento, houveCompartilhamento
  ? `acessos espalhados por ${duracao(janelaAcessos)} — da pra falar em compartilhamento`
  : "acessos concentrados demais pra afirmar compartilhamento (nao entrou no documento)");
prova(Boolean(pedido.titular_pix ?? pedido.nome_pagador), "titular da conta pagadora identificado");
prova(Boolean(emailDoProvedor?.html), emailDoProvedor?.html
  ? `copia fiel do e-mail recuperada do provedor (last_event: ${emailDoProvedor.last_event})`
  : "sem copia do e-mail — o provedor nao devolveu o HTML");
prova(Boolean(printPresente), printPresente
  ? "print da pagina presente embutido (--print-presente)"
  : "sem print da pagina (use --print-presente se as fotos permitirem)");
prova(batemOsNomes, batemOsNomes
  ? `a descricao no PIX ("${nomeNoPix}") repete o nome digitado no quiz`
  : "descricao do PIX nao coincide com o quiz (nem sempre existe)");
console.log("");
console.log("  arquivos:");
console.log("   ", caminhoHtml);
if (caminhoPdf) console.log("   ", caminhoPdf);
else console.log("    (PDF não gerado — abra o HTML e use Imprimir → Salvar como PDF)");
if (!E2E) console.log("\n  Sem --e2e: o documento usou o id interno. Se o aviso da contestação trouxer\n  o identificador do Banco Central, rode de novo com --e2e para o adquirente\n  localizar o caso pelo número que ele conhece.");
console.log("");
