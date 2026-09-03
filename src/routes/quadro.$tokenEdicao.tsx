import { createFileRoute, notFound } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { carregarQuadro, type Quadro } from "@/lib/quadro";
import { QuadroEfeitos } from "@/components/presente/QuadroEfeitos";
import { AjusteDaFoto } from "@/components/presente/AjusteDaFoto";
import {
  CORES_QUADRO,
  corDoQuadro,
  paleta,
  lerEstilo,
  gravarEstilo,
  ESTILO_PADRAO,
  type Estilo,
  posicaoDaFoto,
  limitarFoco,
} from "@/lib/quadro-estilo";
import { EFEITOS, rotuloEfeito } from "@/components/presente/Efeitos";
import { FONTES, MARCA } from "@/lib/marca";
import { Printer, Lock, Check, ChevronLeft } from "lucide-react";
import { supabase } from "@/lib/supabase-client";
import { acessoAoQuadro, salvarQuadro, confirmarQuadro } from "@/lib/meus-quadros";
import { OFERTAS } from "@/lib/creditos";
import { FolhaPixUpsell } from "@/components/conta/FolhaPixUpsell";
import { trackEvent } from "@/lib/track";

// A FOLHA A4 PRA EMOLDURAR.
//
// ── O HISTÓRICO DE ERROS, porque cada um custou uma rodada ────────
//
// 1. Primeira versão: folha branca com um filete de cor, sem nada da Serenata,
//    e o texto VAZANDO por cima da foto e do título.
//
// 2. O vazamento resistiu a quatro tentativas de conserto. A raiz:
//    `scrollHeight` de um elemento com `column-count`, dentro de um pai com
//    `overflow: hidden`, devolve a altura LIMITADA da caixa, não a do texto.
//    Todas as medições liam esse número e "cabia" quando não cabia. A versão
//    boa mede num clone fora da tela, uma coluna, sem limite de altura.
//
// 3. O PDF saía com DUAS páginas. Esconder o botão não bastava: o container em
//    volta mantinha padding e altura de tela cheia, e a sobra virava folha
//    vazia. Agora a moldura de tela é zerada na impressão.
//
// 4. Ao aumentar o QR, a letra apareceu CORTADA: o rodapé cresceu depois que o
//    corpo já tinha sido calculado. Um ResizeObserver na caixa resolve a
//    família inteira, em vez de perseguir cada imagem que carrega depois.

export const Route = createFileRoute("/quadro/$tokenEdicao")({
  loader: async ({ params }) => {
    const q = await carregarQuadro({ data: { tokenEdicao: params.tokenEdicao } });
    if (!q) throw notFound();
    return q;
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData?.titulo ? `${loaderData.titulo} · para imprimir` : "Para imprimir" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Pagina,
});

const T = {
  pt: {
    acao: "Baixar o meu quadro em PDF",
    baixando: "Preparando o arquivo...",
    // O texto mudou junto com o botão. Antes ele ensinava a achar “Salvar
    // como PDF” dentro da folha de impressão do sistema, que é exatamente o
    // passo que ninguém achava no celular. Agora o arquivo chega pronto e
    // não há nada pra ensinar.
    dica: "O arquivo baixa pronto pra imprimir. Numa gráfica, peça papel fosco A4.",
    ouvir: "Aponte a câmera e ouça",
    para: "para",
    modo: "Fundo",
    escuro: "Escuro",
    claro: "Claro",
    cor: "Cor",
    efeito: "Detalhe",
    dicaClaro: "O fundo claro gasta muito menos tinta em impressora de casa.",
    // Os textos das três portas: quem tem, quem comprou e não escolheu, e
    // quem ainda não comprou.
    previaTexto: "Você tem um quadro pra montar. Confirme que ele é o desta música pra liberar a impressão.",
    previaCta: "Escolher esta música",
    ofertaTexto: "Este é o quadro da sua música: a letra e a foto de vocês numa folha A4, pronta pra você imprimir e emoldurar.",
    ofertaCta: "Quero este quadro por R$ 24,90",
    ofertaNota: "Depois de comprar você volta e escolhe de qual música é.",
    deOndeVieram: "Estes textos vieram da sua página presente. Mude aqui se quiser: muda só o quadro.",
    rotuloFoto: "Foto",
    dicaFoto: "Arraste a foto pra escolher o que aparece.",
    rotuloTitulo: "Título",
    rotuloMensagem: "Mensagem de baixo",
    salvando: "salvando...",
    salvo: "salvo",
    conferindo: "conferindo...",
    voltarMontar: "Voltar e escolher outra música",
    voltarPainel: "Voltar pra minhas músicas",
    voltarEditor: "Voltar pro presente",
  },
  es: {
    acao: "Descargar mi cuadro en PDF",
    baixando: "Preparando el archivo...",
    dica: "El archivo se descarga listo para imprimir. Pide papel mate A4.",
    ouvir: "Apunta la cámara y escucha",
    para: "para",
    modo: "Fondo",
    escuro: "Oscuro",
    claro: "Claro",
    cor: "Color",
    efeito: "Detalle",
    dicaClaro: "El fondo claro gasta mucha menos tinta en impresora de casa.",
    previaTexto: "Tienes un cuadro para armar. Confirma que es el de esta canción para liberar la impresión.",
    previaCta: "Elegir esta canción",
    ofertaTexto: "Este es el cuadro de tu canción. Todavía no está disponible en tu país; te avisamos por correo cuando lo esté.",
    // SEM PREÇO E SEM BOTÃO NO ES: o produto do quadro não existe no México.
    // A oferta inteira é escondida lá, então este texto não é usado; fica
    // vazio pra ninguém achar que basta traduzir pra vender.
    ofertaCta: "",
    ofertaNota: "",
    deOndeVieram: "Estos textos vinieron de tu página regalo. Cámbialos aquí si quieres: solo cambia el cuadro.",
    rotuloFoto: "Foto",
    dicaFoto: "Arrastra la foto para elegir qué aparece.",
    rotuloTitulo: "Título",
    rotuloMensagem: "Mensaje de abajo",
    salvando: "guardando...",
    salvo: "guardado",
    conferindo: "comprobando...",
    voltarMontar: "Volver y elegir otra canción",
    voltarPainel: "Volver a mis canciones",
    voltarEditor: "Volver al regalo",
  },
};

const NOVA_LINHA = String.fromCharCode(10);

/**
 * O corpo que faz a letra caber. MEDE num clone e escala.
 *
 * Medir o elemento real não funciona (ver o histórico no topo). O clone tem
 * uma coluna só, a largura de UMA coluna do layout final, e nenhum limite de
 * altura: ali o `scrollHeight` volta a ser o que diz ser.
 */
function corpoQueCabe(
  texto: string,
  larguraColunaPx: number,
  colunas: number,
  caixaPx: number,
  entrelinha: number,
  maxPt: number,
): number {
  if (!caixaPx || !larguraColunaPx) return maxPt;
  const REF = 10;
  const clone = document.createElement("p");
  clone.textContent = texto;
  Object.assign(clone.style, {
    position: "absolute",
    left: "-99999px",
    top: "0",
    visibility: "hidden",
    whiteSpace: "pre-wrap",
    width: `${larguraColunaPx}px`,
    fontSize: `${REF}pt`,
    lineHeight: String(entrelinha),
    fontFamily: getComputedStyle(document.body).fontFamily,
  });
  document.body.appendChild(clone);
  const alturaUmaColuna = clone.scrollHeight;
  clone.remove();
  if (!alturaUmaColuna) return maxPt;
  // Em N colunas a altura vira ~1/N. O 0,94 cobre o arredondamento da quebra
  // de coluna, que nunca divide exatamente ao meio.
  const alvo = (REF * caixaPx * 0.94) / (alturaUmaColuna / colunas);
  // Piso de 7pt: abaixo disso não se lê num quadro na parede.
  return Math.max(7, Math.min(maxPt, Math.floor(alvo * 4) / 4));
}

function Pagina() {
  const q = Route.useLoaderData() as Quadro;
  const { tokenEdicao } = Route.useParams();
  const t = T[q.locale] ?? T.pt;
  const token = q.linkPresente.split("/p/")[1] ?? "";
  const [pixAberto, setPixAberto] = useState(false);
  const [confirmando, setConfirmando] = useState(false);

  const [estilo, setEstilo] = useState<Estilo>(ESTILO_PADRAO);
  const [qr, setQr] = useState<string | null>(null);
  const [corpoPt, setCorpoPt] = useState(11);
  const [pronto, setPronto] = useState(false);
  // ── O DIREITO DE IMPRIMIR ──────────────────────────────────────
  //
  // O loader roda no servidor, onde não existe sessão pra ler: ele devolve
  // `nenhum` pra todo mundo (e `confirmado` só pro exemplo). Então a folha
  // aparece primeiro, que é o que ela veio ver, e o direito chega logo depois.
  //
  // Enquanto não chega, a tela mostra a folha SEM o botão de imprimir. O
  // contrário (mostrar e tirar) seria pior: ela clica, some, e ela acha que
  // quebrou.
  const [acesso, setAcesso] = useState<Quadro["acesso"]>(q.acesso);
  const [conferindo, setConferindo] = useState(q.acesso !== "confirmado");
  // ── OS TEXTOS DO QUADRO ────────────────────────────────────────
  //
  // Nascem copiados da página presente, na confirmação. Ela já escreveu isso
  // uma vez, e pedir de novo é onde as pessoas desistem. Mas são PEÇAS
  // DIFERENTES: o que cabe num parágrafo na tela pode não caber embaixo de uma
  // foto emoldurada, então daqui pra frente os dois textos são independentes.
  const [titulo, setTitulo] = useState(q.titulo);
  const [dedicatoria, setDedicatoria] = useState(q.dedicatoria ?? "");
  const [salvo, setSalvo] = useState<"nao" | "salvando" | "sim">("nao");
  // ── A FOLHA CABENDO NO CELULAR ─────────────────────────────────
  //
  // A4 tem 210mm, que dão 794px. Num celular de 375px a folha vazava e a
  // página rolava PRA O LADO: a pessoa via um pedaço do quadro e tinha que
  // arrastar pra ler o resto, num produto cuja graça é ver a coisa inteira.
  //
  // A saída é encolher a EXIBIÇÃO, não o conteúdo. Um `scale` mantém tudo em
  // milímetros por dentro (o cálculo do corpo da letra, a caixa, a impressão)
  // e só muda o tamanho na tela. Na hora de imprimir o `scale` é anulado por
  // CSS, então o papel sai em A4 de verdade.
  // DE ONDE ELA VEIO, pra o botão de voltar dizer pra onde vai.
  //
  // Antes esta página abria em ABA NOVA, e aba nova é beco sem saída pra quem
  // não sabe alternar entre abas no celular: a pessoa personalizava o quadro e
  // não achava mais o caminho de volta pra escolher outra música. Agora ela
  // navega na mesma aba, e o caminho de volta é um botão com nome, não uma
  // seta genérica: destino escrito é o que essa gente consegue seguir.
  //
  // `editor` entrou em 02/09, quando o cartão do quadro no editor passou a
  // mandar pra cá em vez de abrir o PIX direto. Sem ele o botão de voltar
  // apontava pro `/dashboard`, que exige login: quem chega por token não tem
  // conta, e o caminho de volta virava porta fechada bem no meio da compra.
  const [de, setDe] = useState<"montar" | "editor" | "painel">("painel");
  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get("de");
    if (v === "montar" || v === "editor") setDe(v);
  }, []);

  const [escala, setEscala] = useState(1);
  useEffect(() => {
    const medir = () => {
      // 24px de respiro nas laterais, senão a folha encosta na borda.
      setEscala(Math.min(1, (window.innerWidth - 24) / 794));
    };
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, []);
  useEffect(() => {
    if (!q.musicaId) {
      setConferindo(false);
      return;
    }
    let vivo = true;
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      const tk = sess.session?.access_token;
      // ── AQUI SE PERDIA O QUADRO PAGO ─────────────────────────
      //
      // Até 02/09 esta função DESISTIA quando não havia sessão, e o `acesso`
      // ficava em `nenhum`. Como 84% dos compradores não têm conta, quem tinha
      // pago o quadro e abria a folha pelo link do e-mail via o botão "Quero
      // este quadro por R$ 24,90": a tela pedia dinheiro por uma coisa que já
      // era dela.
      //
      // Explica o número melhor que esquecimento: 34 vendidos, 7 montados.
      //
      // Agora o `token_edicao` da própria URL vai junto e serve de credencial,
      // como já servia pro editor, pro PIX do upsell e pra própria folha.
      const r = await acessoAoQuadro({
        data: { token: tk, tokenEdicao, musicaId: q.musicaId as string },
      });
      if (vivo) {
        setAcesso(r.acesso);
        // O QUE ELA GRAVOU MANDA. O loader roda sem sessão, então ele devolve
        // o título e a dedicatória da PÁGINA PRESENTE. Sem isto, um título
        // editado aqui voltaria ao original no primeiro reload, e ela
        // reescreveria a mesma coisa toda vez.
        if (r.titulo) setTitulo(r.titulo);
        if (r.dedicatoria !== null && r.dedicatoria !== undefined) setDedicatoria(r.dedicatoria);
        // E o estilo também: o quadro é montado no celular e impresso no
        // computador. Estilo só no localStorage não atravessa aparelho.
        if (r.estilo) setEstilo((v) => ({ ...v, ...(r.estilo as Partial<Estilo>) }));
        setConferindo(false);
      }
    })().catch(() => {
      if (vivo) setConferindo(false);
    });
    return () => {
      vivo = false;
    };
  }, [q.musicaId]);

  // O FORMATO DA FOTO decide o arranjo, e isso não é detalhe.
  //
  // A faixa que sangra de borda a borda funciona pra foto DEITADA: `cover`
  // corta um pouco das laterais e a cena continua inteira. Numa foto EM PÉ ela
  // faz o oposto: a imagem é escalada pra preencher os 210mm de largura, fica
  // muito mais alta que a faixa, e o corte come cabeça e pés. Justamente os
  // rostos.
  //
  // Metade das fotos de celular é retrato, então isso não é caso raro.
  const [formato, setFormato] = useState<"paisagem" | "quadrada" | "retrato">("paisagem");
  // `formato` ja NASCE com "paisagem", entao ele nunca serve como "a foto
  // carregou" — checar a verdade dele daria sempre verdadeiro e o PDF sairia
  // com o layout do palpite inicial. Este aqui e o sinal de verdade.
  const [fotoMedida, setFotoMedida] = useState(false);
  const caixaRef = useRef<HTMLDivElement>(null);
  const letraRef = useRef<HTMLDivElement>(null);

  // O ponto de partida do ajuste quando a pessoa nunca mexeu: o mesmo palpite
  // que a folha usa, pra o controle abrir mostrando exatamente o que ela ja
  // esta vendo. Abrir centralizado daria um pulo na foto antes de qualquer
  // arrasto, e ela pensaria que o controle estragou alguma coisa.
  const focoPadrao = formato === "retrato" ? { x: 50, y: 50 } : { x: 50, y: 22 };

  const p = paleta(estilo.modo);
  const acento = corDoQuadro(estilo.cor, estilo.modo);

  // DUAS COLUNAS QUANDO A LETRA É LONGA, e não é escolha estética: 49 linhas
  // com entrelinha legível ocupam ~270mm, e o A4 tem 297mm no total. Numa
  // coluna só, com foto, não cabe em tamanho nenhum que se leia.
  const duasColunas = q.letra.split(NOVA_LINHA).filter((l) => l.trim()).length > 26;

  // ── O ESTILO PRECISA SOBREVIVER AO APARELHO ─────────────────────
  //
  // `gravarEstilo` e localStorage, e so isso deixava a escolha presa no
  // celular. O servidor so recebia o estilo de carona no `gravarTextos`, que
  // dispara no BLUR do titulo ou da dedicatoria — quem nao escreve nada nos
  // campos (a maioria: o titulo ja vem preenchido) nunca salvava nada.
  //
  // Medido no quadro da Mausina, 02/09: ela escolheu fundo claro e coracoes
  // (o evento `quadro_imprimir` registrou `modo:"claro", efeito:"coracoes"`),
  // e a coluna `estilo` da linha dela ficou `null`. Abrir no computador da
  // grafica devolveria o escuro sem efeito, que nao e o quadro que ela montou.
  //
  // E o mesmo motivo que o comentario do `gravarTextos` ja da pros textos:
  // "o que ela escreveu tem que existir no outro aparelho". O estilo e o
  // desenho da folha, entao vale ainda mais.
  //
  // Com folga de 800ms porque mexer na cor e clicar varias vezes seguidas, e
  // cada clique viraria uma escrita.
  const gravandoEstilo = useRef<ReturnType<typeof setTimeout> | null>(null);

  const mudar = (novo: Partial<Estilo>) => {
    const e = { ...estilo, ...novo };
    setEstilo(e);
    gravarEstilo(token, e);
    trackEvent("quadro_personalizou", novo as Record<string, string>);
    if (gravandoEstilo.current) clearTimeout(gravandoEstilo.current);
    gravandoEstilo.current = setTimeout(() => {
      void guardarNoServidor(e);
    }, 800);
  };

  /**
   * Manda titulo, dedicatoria e estilo pro servidor.
   *
   * Falha em silencio de proposito: o localStorage ja guardou a escolha, e
   * uma tela de erro em cima de "escolhi a cor errada" atrapalharia mais do
   * que ajuda. O que nao pode e a pessoa achar que salvou quando nao salvou —
   * por isso o indicador de "salvo" continua saindo so do `gravarTextos`,
   * que e acao deliberada dela.
   */
  const [baixando, setBaixando] = useState(false);

  /**
   * Baixa a folha como PDF, feita pelo Chrome do servidor.
   *
   * ── POR QUE NAO E MAIS `window.print()` ─────────────────────────
   *
   * Porque no celular ele nao funciona, e o celular e 100% de quem usa isto.
   * Medido em 30 dias: 76 cliques no botao, 74 de celular e ZERO de
   * computador, e 15 das 33 sessoes apertaram mais de uma vez (a pior, 14
   * vezes em 109 minutos). Ninguem aperta imprimir catorze vezes querendo
   * catorze copias.
   *
   * Dentro do navegador embutido de um aplicativo de e-mail, que e por onde
   * a maioria chega, `window.print()` costuma nem existir: o toque nao faz
   * nada, sem erro. Foi o que aconteceu com a compradora que respondeu
   * "Vou procurar alguem pra fazer para mim" tres minutos depois de apertar.
   *
   * ── O SALVAR ANTES NAO E ZELO, E CORRECAO ───────────────────────
   *
   * O servidor renderiza a pagina LENDO O BANCO. A troca de estilo salva com
   * 800ms de folga, entao quem escolhe a cor e aperta o botao em seguida
   * pediria um PDF do estilo ANTERIOR. Esperar a gravacao fecha essa janela.
   *
   * ── O `download` AQUI FUNCIONA, AO CONTRARIO DO MP3 ─────────────
   *
   * O atributo `download` e ignorado quando o arquivo mora em outro dominio,
   * que foi o defeito do botao de baixar a musica em 02/09. Aqui a URL e um
   * blob de MESMA ORIGEM, entao ele vale. E o servidor ainda manda
   * `Content-Disposition: attachment` por cima, que e o que convence
   * navegador embutido de aplicativo.
   */
  async function baixarPdf() {
    if (baixando) return;
    setBaixando(true);
    trackEvent("quadro_imprimir", { modo: estilo.modo, efeito: estilo.efeito, via: "servidor" });
    let url: string | null = null;
    try {
      await guardarNoServidor(estilo);
      const r = await fetch(`/api/quadro-pdf/${tokenEdicao}`);
      if (!r.ok) throw new Error(String(r.status));
      const blob = await r.blob();
      url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(titulo || "quadro").replace(/[^\p{L}\p{N} ]/gu, "").trim() || "quadro"}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      // NUNCA DEIXA A PESSOA SEM CAMINHO. Se o servidor falhou, a impressao
      // do navegador continua ali: no computador ela sempre funcionou, e no
      // celular e melhor uma chance do que nenhuma.
      console.error("[quadro] pdf falhou:", err);
      trackEvent("quadro_pdf_falhou", { erro: String(err).slice(0, 80) });
      window.print();
    } finally {
      if (url) URL.revokeObjectURL(url);
      setBaixando(false);
    }
  }

  async function guardarNoServidor(e: Estilo) {
    if (!q.musicaId) return;
    try {
      const { data: sess } = await supabase.auth.getSession();
      await salvarQuadro({
        data: { token: sess.session?.access_token, tokenEdicao, musicaId: q.musicaId, titulo, dedicatoria, estilo: e },
      });
    } catch {
      // localStorage ja tem; a proxima acao dela tenta de novo
    }
  }

  useEffect(() => {
    if (token) setEstilo(lerEstilo(token));
  }, [token]);

  // Mede a imagem ANTES de decidir o layout. Uma imagem em memória, sem tocar
  // na tela: só precisamos da proporção.
  useEffect(() => {
    if (!q.fotoUrl) return;
    const img = new Image();
    img.onload = () => {
      const r = img.naturalWidth / img.naturalHeight;
      setFormato(r > 1.15 ? "paisagem" : r < 0.85 ? "retrato" : "quadrada");
      setFotoMedida(true);
    };
    // Foto que nao carrega nao pode travar a folha pra sempre: a impressao
    // segue com o formato palpitado, que e o que acontecia antes deste sinal
    // existir.
    img.onerror = () => setFotoMedida(true);
    img.src = q.fotoUrl;
  }, [q.fotoUrl]);

  useEffect(() => {
    QRCode.toDataURL(q.linkPresente, {
      margin: 0,
      width: 400,
      // O QR inverte com o modo: leitor de celular precisa de contraste, e QR
      // escuro sobre fundo escuro simplesmente não lê.
      color: { dark: p.qrEscuro, light: p.qrFundo },
    })
      .then(setQr)
      .catch(() => {});
  }, [q.linkPresente, p.qrEscuro, p.qrFundo]);

  // ── A BANDEIRINHA QUE O RENDERIZADOR DO PDF ESPERA ──────────────
  //
  // `/api/quadro-pdf/<token>` abre esta mesma pagina num Chrome no servidor e
  // imprime. Sem um sinal explicito de "acabei", ele teria que dormir um
  // tanto arbitrario e torcer — e a folha sai errada de um jeito que ninguem
  // ve antes da grafica: letra no corpo velho porque a medicao ainda nao
  // rodou, QR em branco, foto ausente.
  //
  // Entao a pagina AVISA. Tres coisas precisam estar de pe, e cada uma ja
  // quebrou a folha sozinha em algum momento:
  //
  //   `pronto`      a medicao do corpo da letra rodou (senao a letra vaza)
  //   `qr`          o QR Code foi gerado (senao imprime um quadrado vazio)
  //   `fotoMedida`  a foto carregou e o formato foi decidido de verdade
  //
  // Fica no <html> e nao em estado do React porque quem le e o Puppeteer,
  // de fora, com `waitForSelector`.
  useEffect(() => {
    const ok = pronto && Boolean(qr) && (!q.fotoUrl || fotoMedida);
    if (ok) document.documentElement.dataset.quadroPronto = "1";
    else delete document.documentElement.dataset.quadroPronto;
  }, [pronto, qr, fotoMedida, q.fotoUrl]);

  useLayoutEffect(() => {
    const medir = () => {
      const el = letraRef.current;
      const caixa = caixaRef.current;
      if (!el || !caixa) return;
      const colunas = duasColunas ? 2 : 1;
      const vao = duasColunas ? 12 * 3.7795 : 0; // 12mm de vão entre colunas
      const larguraColuna = (el.clientWidth - vao) / colunas;
      setCorpoPt(corpoQueCabe(q.letra, larguraColuna, colunas, caixa.clientHeight, duasColunas ? 1.42 : 1.6, 11));
      setPronto(true);
    };

    medir();
    const rAF = requestAnimationFrame(medir);
    // SEMPRE QUE A CAIXA MUDAR DE TAMANHO. O rodapé cresce quando o QR e a
    // logo carregam, e cada milímetro que ele ganha a letra perde. Foi assim
    // que ela apareceu cortada depois que aumentei o QR.
    const obs = new ResizeObserver(medir);
    if (caixaRef.current) obs.observe(caixaRef.current);
    let vivo = true;
    document.fonts?.ready.then(() => {
      if (vivo) medir();
    });
    return () => {
      vivo = false;
      cancelAnimationFrame(rAF);
      obs.disconnect();
    };
  }, [q.letra, duasColunas, estilo.modo, formato]);
  // A REDE DE SEGURANÇA, e ela já existiu e eu deixei cair numa reescrita.
  //
  // O cálculo do clone acerta quase sempre, mas erra pra cima quando algo muda
  // a altura da caixa depois dele: o rodapé crescendo, a foto trocando de
  // arranjo, o CSS partindo as duas colunas de forma desigual. Quando erra, a
  // letra aparece CORTADA em cima e embaixo, porque a caixa tem
  // `overflow: hidden` e o conteúdo está centralizado.
  //
  // `scrollHeight` não detecta transbordo em multicoluna. A posição REAL do
  // primeiro e do último pedaço de texto na tela detecta: se algum estiver
  // fora da caixa, encolhe 0,25pt e o efeito roda de novo, até parar de vazar.
  //
  // ── ISTO MEDIA UM RANGE DE TEXTO, E PAROU DE PODER ──────────────
  //
  // Enquanto a letra era um <p> com um nó de texto só, dava pra medir os dois
  // primeiros e os dois últimos CARACTERES com um Range. Em 03/09 cada verso
  // virou um <span> de bloco (pra a coluna não partir uma linha no meio), e
  // `el.firstChild` deixou de ser texto: os offsets 0 e 2 de um Range sobre
  // ELEMENTO contam nós filhos, não letras, então a medição passaria a
  // responder outra pergunta — em silêncio, que é o pior jeito.
  //
  // Medir o primeiro e o último verso dá a mesma resposta e não depende da
  // forma interna do texto.
  useLayoutEffect(() => {
    const el = letraRef.current;
    const caixa = caixaRef.current;
    if (!el || !caixa || corpoPt <= 7) return;
    const versos = el.children;
    if (versos.length < 1) return;

    const primeiro = versos[0].getBoundingClientRect();
    const ultimo = versos[versos.length - 1].getBoundingClientRect();
    const cx = caixa.getBoundingClientRect();

    if (primeiro.top < cx.top - 1 || ultimo.bottom > cx.bottom + 1) {
      setCorpoPt((v) => Math.max(7, v - 0.25));
    }
  }, [corpoPt, estilo.modo, estilo.efeito, formato, qr]);

  // GRAVA NO SERVIDOR, não no localStorage. O quadro é montado no celular e
  // impresso no computador (ou na lan house): o que ela escreveu tem que
  // existir no outro aparelho. Salva no blur, que é quando ela terminou de
  // digitar, e não a cada tecla.
  async function gravarTextos() {
    if (!q.musicaId) return;
    setSalvo("salvando");
    try {
      const { data: sess } = await supabase.auth.getSession();
      const tk = sess.session?.access_token;
      // Sem sessão vale o token da URL: quem montou o quadro pelo link do
      // e-mail precisa que o que ela escreveu sobreviva ao reload, senão ela
      // digita a mesma dedicatória de novo no computador da impressão.
      const r = await salvarQuadro({
        data: { token: tk, tokenEdicao, musicaId: q.musicaId, titulo, dedicatoria, estilo },
      });
      setSalvo(r.ok ? "sim" : "nao");
    } catch {
      setSalvo("nao");
    }
  }

  // 44px de altura, que é o mínimo pra dedo. Estava em 30.
  const botao = (ativo: boolean) =>
    "inline-flex h-11 items-center rounded-full px-4 text-[13px] transition-colors " +
    (ativo ? "bg-white text-[#1a1512] font-semibold" : "border border-white/25 text-white/70");

  return (
    <>
      <style>{`
        @page { size: A4 portrait; margin: 0; }
        @media print {
          /* Esconder o botão NÃO basta: o container em volta mantinha padding
             e altura de tela cheia, e a sobra virava uma segunda folha. */
          .nao-imprime { display: none !important; }
          html, body { background: #fff !important; margin: 0 !important; padding: 0 !important; }
          .tela { min-height: 0 !important; padding: 0 !important; background: #fff !important; }
          .folha { box-shadow: none !important; margin: 0 !important; }
          /* O ENCOLHIMENTO É SÓ DE TELA. Ele existe pra folha caber num
             celular de 375px; no papel ela precisa sair em A4 inteiro, senão
             a pessoa imprime um quadro do tamanho de um cartão. */
          .palco { width: auto !important; height: auto !important; overflow: visible !important; }
          .folha { transform: none !important; }
        }
        /* Sem isto o navegador "economiza tinta" e imprime o fundo em branco. */
        .folha, .folha * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      `}</style>

      <div className="tela min-h-screen bg-[#1c1815] py-6">
        <div className="nao-imprime mx-auto mb-6 max-w-[210mm] space-y-4 px-4">
          {/* O CAMINHO DE VOLTA, primeira coisa da tela. Em cima e com nome,
              porque quem se perde aqui não volta sozinho. */}
          <a
            href={
              de === "montar"
                ? "/meu-quadro"
                : de === "editor"
                ? `/editar/${tokenEdicao}`
                : "/dashboard"
            }
            className="inline-flex h-11 items-center gap-2 rounded-full border border-white/25 px-4 text-[13px] text-white/75 transition-colors hover:border-white/50 hover:text-white"
          >
            <ChevronLeft className="h-4 w-4" />
            {de === "montar" ? t.voltarMontar : de === "editor" ? t.voltarEditor : t.voltarPainel}
          </a>

          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
            <div className="flex items-center gap-2">
              <span className="text-[11px] uppercase tracking-wider text-white/40">{t.modo}</span>
              <button onClick={() => mudar({ modo: "escuro" })} className={botao(estilo.modo === "escuro")}>
                {t.escuro}
              </button>
              <button onClick={() => mudar({ modo: "claro" })} className={botao(estilo.modo === "claro")}>
                {t.claro}
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] uppercase tracking-wider text-white/40">{t.cor}</span>
              {CORES_QUADRO.map((c) => (
                <button
                  key={c.chave}
                  onClick={() => mudar({ cor: c.chave })}
                  aria-label={q.locale === "es" ? c.nomeEs : c.nome}
                  title={q.locale === "es" ? c.nomeEs : c.nome}
                  // A BOLINHA CONTINUA PEQUENA, o ALVO é que cresceu: 44px de
                  // área invisível em volta de 26px de cor. Aumentar a bolinha
                  // faria a fileira de seis cores não caber num celular
                  // estreito; aumentar o alvo não muda nada visualmente.
                  className="grid h-11 w-11 place-items-center"
                >
                  <span
                    className={
                      "block h-[26px] w-[26px] rounded-full transition-transform " +
                      (estilo.cor === c.chave ? "ring-2 ring-white ring-offset-2 ring-offset-[#1c1815]" : "")
                    }
                    style={{ background: c.escuro }}
                  />
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="text-[11px] uppercase tracking-wider text-white/40">{t.efeito}</span>
            {EFEITOS.map((e) => (
              <button key={e.chave} onClick={() => mudar({ efeito: e.chave })} className={botao(estilo.efeito === e.chave)}>
                {rotuloEfeito(e, q.locale)}
              </button>
            ))}
          </div>

          {/* ── ONDE A PESSOA ENQUADRA A PRÓPRIA FOTO ──────────
              Vem DEPOIS de cor e efeito e ANTES dos textos, na mesma lógica
              do resto do painel: o que se resolve com o dedo vem primeiro, o
              que pede teclado vem por último.

              Só aparece pra quem já confirmou o quadro. Antes disso a folha é
              prévia e não há o que ajustar. */}
          {acesso === "confirmado" && q.fotoUrl && (
            <div className="mx-auto w-full max-w-md text-left">
              <AjusteDaFoto
                url={q.fotoUrl}
                foco={estilo.foco ?? focoPadrao}
                // A MESMA ALTURA RELATIVA DA FAIXA NA FOLHA. Se o controle
                // tivesse outra proporção, a pessoa enquadraria uma coisa e a
                // folha mostraria outra, que é pior que não ter controle.
                alturaCss={formato === "retrato" ? "160px" : formato === "quadrada" ? "150px" : "120px"}
                aoMudar={(f) => mudar({ foco: f })}
                rotulo={t.rotuloFoto}
                dica={t.dicaFoto}
              />
            </div>
          )}

          {/* ── OS TEXTOS, editáveis só por quem tem o quadro ──
              Aparecem DEPOIS das cores, e não antes: cor e fundo são um toque
              e mudam a folha inteira na hora, o que ensina que a tela é
              editável. Texto exige teclado, e teclado no celular tampa metade
              da tela: é o último passo, não o primeiro.

              A frase de onde os textos vieram é obrigatória. Sem ela a pessoa
              acha que o site inventou um título, ou pior, edita aqui achando
              que está mudando a página presente também. */}
          {acesso === "confirmado" && q.musicaId && (
            <div className="mx-auto w-full max-w-md space-y-3 text-left">
              <p className="text-center text-[12px] leading-relaxed text-white/45">
                {t.deOndeVieram}
              </p>
              <label className="block">
                <span className="mb-1 block text-[11px] uppercase tracking-wider text-white/40">
                  {t.rotuloTitulo}
                </span>
                <input
                  value={titulo}
                  onChange={(e) => { setTitulo(e.target.value.slice(0, 60)); setSalvo("nao"); }}
                  onBlur={gravarTextos}
                  className="h-12 w-full rounded-xl border border-white/20 bg-white/5 px-4 text-[15px] text-white outline-none focus:border-white/50"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] uppercase tracking-wider text-white/40">
                  {t.rotuloMensagem}
                </span>
                <textarea
                  value={dedicatoria}
                  onChange={(e) => { setDedicatoria(e.target.value.slice(0, 160)); setSalvo("nao"); }}
                  onBlur={gravarTextos}
                  rows={2}
                  className="w-full resize-none rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-[15px] leading-snug text-white outline-none focus:border-white/50"
                />
              </label>
              <p className="text-center text-[12px] text-white/40">
                {salvo === "salvando" ? t.salvando : salvo === "sim" ? t.salvo : " "}
              </p>
            </div>
          )}

          {/* ── O QUE ESTA PESSOA PODE FAZER AQUI ──────────────
              Três estados, e cada um mostra UMA ação só. Duas ações lado a
              lado numa tela de celular é onde a pessoa aperta a errada. */}
          {conferindo ? (
            <div className="text-center text-[13px] text-white/40">{t.conferindo}</div>
          ) : acesso === "confirmado" ? (
            <div className="text-center">
              <button
                disabled={baixando}
                onClick={baixarPdf}
                className="inline-flex h-12 w-full max-w-md items-center justify-center gap-2 rounded-full px-7 font-medium"
                style={{ fontSize: 15, background: "#f0b95f", color: "#0d0a08" }}
              >
                <Printer className="h-4 w-4" /> {baixando ? t.baixando : t.acao}
              </button>
              <p className="mx-auto mt-3 max-w-md text-[13px] leading-relaxed text-white/45">
                {t.dica} {estilo.modo === "escuro" && t.dicaClaro}
              </p>
            </div>
          ) : acesso === "previa" ? (
            /* COMPROU, AINDA NÃO ESCOLHEU. Não é hora de vender de novo: é
               hora de deixar ela terminar o que já pagou.

               O BOTÃO CONFIRMA AQUI, não manda pro `/meu-quadro`. Ela está
               olhando pra folha da música que quer; mandar pra uma lista pra
               escolher de novo é pedir a mesma decisão duas vezes, e a lista
               ainda ficava atrás de login. */
            <div className="mx-auto max-w-md text-center">
              <p className="text-[13px] leading-relaxed text-white/70">
                {t.previaTexto}
              </p>
              <button
                type="button"
                disabled={confirmando}
                onClick={async () => {
                  if (!q.musicaId) return;
                  setConfirmando(true);
                  try {
                    const { data: sess } = await supabase.auth.getSession();
                    const r = await confirmarQuadro({
                      data: {
                        token: sess.session?.access_token,
                        tokenEdicao,
                        musicaId: q.musicaId,
                      },
                    });
                    if (r.ok) {
                      trackEvent("quadro_confirmado", { origem: "folha" });
                      setAcesso("confirmado");
                    } else {
                      // Só sobra o caminho antigo quando o servidor recusa: aí
                      // é caso de conta, e a lista é onde ela se resolve.
                      window.location.href = "/meu-quadro";
                    }
                  } catch {
                    window.location.href = "/meu-quadro";
                  } finally {
                    setConfirmando(false);
                  }
                }}
                className="mt-3 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full px-7 font-medium disabled:opacity-60"
                style={{ fontSize: 15, background: "#f0b95f", color: "#0d0a08" }}
              >
                <Check className="h-4 w-4" /> {confirmando ? t.conferindo : t.previaCta}
              </button>
            </div>
          ) : (
            /* NÃO COMPROU. O quadro fica visível de propósito: é a vitrine
               dele. O que não sai é o papel. */
            <div className="mx-auto max-w-md text-center">
              <p className="text-[13px] leading-relaxed text-white/70">
                {t.ofertaTexto}
              </p>
              {/* O BOTÃO SÓ EXISTE ONDE EXISTE PRODUTO. No México o quadro
                  não foi criado na Perfect Pay: mostrar preço em real levaria
                  a um checkout que não é dela. */}
              {q.locale === "pt" && (
                <>
                  {/* Esta tela abre pelo TOKEN, sem login — então usa a porta
                      2 do upsell, a que prova posse pelo `token_edicao`. */}
                  <button
                    type="button"
                    onClick={() => {
                      trackEvent("credito_oferta_click", {
                        oferta: "quadro",
                        origem: "quadro",
                        via: "pix",
                      });
                      setPixAberto(true);
                    }}
                    className="mt-3 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full px-7 font-medium"
                    style={{ fontSize: 15, background: "#f0b95f", color: "#0d0a08" }}
                  >
                    <Lock className="h-4 w-4" /> {t.ofertaCta}
                  </button>
                  {pixAberto && (
                    <FolhaPixUpsell
                      ofertaId="quadro"
                      tokenEdicao={tokenEdicao}
                      titulo={t.ofertaCta}
                      precoTexto={`R$ ${(OFERTAS.find((o) => o.id === "quadro")?.precoBrl ?? 24.9)
                        .toFixed(2)
                        .replace(".", ",")}`}
                      checkoutCartao={
                        OFERTAS.find((o) => o.id === "quadro")?.checkout ?? "/dashboard"
                      }
                      aoPagar={() => window.location.reload()}
                      aoFechar={() => setPixAberto(false)}
                    />
                  )}
                  <p className="mt-2 text-[12px] text-white/40">{t.ofertaNota}</p>
                </>
              )}
            </div>
          )}
        </div>

        {/* O PALCO tem a LARGURA E A ALTURA da folha JÁ ENCOLHIDA. Sem ele, o
            `scale` deixaria em volta um vão do tamanho do que foi encolhido,
            porque transform não muda o espaço que o elemento ocupa.

            ── A FOLHA SAÍA CORTADA NO CELULAR ──────────────────
            Achado em 02/09, a 375px: dava pra ver só uns 40% da folha, o
            resto passava da borda direita. A origem era `top center` com uma
            folha de 794px dentro de um palco de 375: `mx-auto` não centra
            filho MAIOR que o pai (as margens automáticas viram zero), então
            ela começava em x=0 e o encolhimento acontecia em torno do centro
            DELA, em x=397, empurrando o resultado pra direita.

            Com `top left` o encolhimento acontece a partir da borda esquerda
            e o palco, agora com a largura final, centraliza o conjunto.

            Isto passou meses sem aparecer porque a tela só era alcançada pelo
            painel, onde quase ninguém entra. Agora o editor manda todo mundo
            pra cá, e 99% abre no celular. */}
        <div
          className="palco mx-auto overflow-hidden"
          style={{ width: 794 * escala, height: 1123 * escala }}
        >
        <div
          className="folha relative mx-auto overflow-hidden"
          style={{
            width: "210mm",
            height: "297mm",
            transform: escala < 1 ? `scale(${escala})` : undefined,
            transformOrigin: "top left",
            background: p.fundo,
            color: p.texto,
            boxShadow: "0 10px 50px rgba(0,0,0,.5)",
            opacity: pronto ? 1 : 0,
          }}
        >
          {/* A MARCA DE PRÉVIA.
              Esconder o botão de imprimir não impede Ctrl+P, e um quadro que
              sai inteiro sem pagar não é produto. A marca vai DENTRO da folha
              e imprime junto: quem burlar leva um papel que não serve pra
              emoldurar, que é exatamente a diferença entre ver e ter.
              O exemplo (`musicaId` nulo) não leva marca: ele é a vitrine. */}
          {q.musicaId && acesso !== "confirmado" && !conferindo && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 z-20 grid place-items-center"
              style={{ transform: "rotate(-28deg)" }}
            >
              <span
                style={{
                  fontSize: "34mm",
                  letterSpacing: "0.12em",
                  fontWeight: 700,
                  color: p.texto,
                  opacity: 0.14,
                  whiteSpace: "nowrap",
                }}
              >
                {q.locale === "es" ? "VISTA PREVIA" : "PRÉVIA"}
              </span>
            </div>
          )}
          {/* A FOTO. No escuro ela sangra e some no degradê, que é o gesto da
              página presente. No claro esse gesto não existe (não dá pra
              "escurecer até o creme" sem sujar a imagem), então ela vira um
              bloco com margem e o texto vive no papel. */}
          {q.fotoUrl && p.fotoSangra && (
            <div
              style={
                formato === "retrato"
                  ? {
                      // EM PÉ: não sangra. A foto vira um bloco centralizado,
                      // com a proporção quase intacta, e o fundo escuro é a
                      // moldura. Cortar uma foto vertical pra caber numa faixa
                      // deitada é o que destrói o rosto.
                      position: "absolute",
                      top: "14mm",
                      left: "50%",
                      transform: "translateX(-50%)",
                      width: "62mm",
                      height: "74mm",
                      overflow: "hidden",
                      borderRadius: 3,
                    }
                  : {
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      height: formato === "quadrada" ? "96mm" : "88mm",
                    }
              }
            >
              <img
                src={q.fotoUrl}
                alt=""
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  // O enquadramento sai de `posicaoDaFoto`, a MESMA funcao que
                  // o controle de ajuste usa. Duas contas separadas aqui e la
                  // significariam a pessoa enquadrar uma coisa e a grafica
                  // imprimir outra.
                  //
                  // Sem ajuste dela, vale o palpite de sempre: terco superior
                  // na deitada (onde ficam os rostos), centro na em pe.
                  objectPosition: posicaoDaFoto(estilo, formato),
                  display: "block",
                }}
              />
              {/* O DEGRADÊ SÓ ONDE ELE TRABALHA.
                  A função dele é uma só: dar fundo pro título, que encosta no
                  último quinto da faixa. A primeira versão começava
                  escurecendo a foto já no topo (18% de preto no 0%) e chegava
                  a 62% no primeiro terço, então a imagem respirava em menos de
                  um terço dela e o resto era apagamento. Numa foto de rosto
                  isso come justamente o que a pessoa quer ver.

                  Agora a metade de cima fica intacta e a transição inteira
                  acontece depois dos 55%, ficando opaca só onde o texto entra.

                  No arranjo em pé a foto não encosta no texto, então nem
                  existe: seria sombra sem função em cima da imagem. */}
              {formato !== "retrato" && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: `linear-gradient(to bottom, rgba(13,10,8,0) 0%, rgba(13,10,8,0) 52%, rgba(13,10,8,0.40) 68%, rgba(13,10,8,0.88) 80%, ${p.fundo} 93%)`,
                  }}
                />
              )}
            </div>
          )}

          <QuadroEfeitos tipo={estilo.efeito} cor={acento} />

          {/* Fio de acento: assina sem virar bloco de cor. */}
          <div
            style={{
              position: "absolute",
              top: "14mm",
              left: "50%",
              transform: "translateX(-50%)",
              width: "18mm",
              height: "0.6mm",
              background: acento,
              borderRadius: 1,
              zIndex: 2,
            }}
          />

          <div
            style={{
              position: "relative",
              zIndex: 2,
              height: "100%",
              display: "flex",
              flexDirection: "column",
              padding: "22mm 20mm 15mm",
            }}
          >
            {q.fotoUrl && !p.fotoSangra && (
              <div
                style={{
                  marginTop: "2mm",
                  // Em pé ganha altura e perde largura; deitada fica na faixa.
                  height: formato === "retrato" ? "84mm" : formato === "quadrada" ? "64mm" : "55mm",
                  width: formato === "retrato" ? "72mm" : "100%",
                  marginLeft: formato === "retrato" ? "auto" : undefined,
                  marginRight: formato === "retrato" ? "auto" : undefined,
                  overflow: "hidden",
                  borderRadius: 3,
                }}
              >
                <img
                  src={q.fotoUrl}
                  alt=""
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    objectPosition: posicaoDaFoto(estilo, formato),
                    display: "block",
                  }}
                />
              </div>
            )}

            <div
              style={{
                marginTop: q.fotoUrl
                  ? p.fotoSangra
                    ? formato === "quadrada"
                      ? "78mm"
                      : "70mm"
                    : "8mm"
                  : "10mm",
                textAlign: "center",
              }}
            >
              {q.nome && (
                <p style={{ fontSize: "7.5pt", letterSpacing: "0.42em", textTransform: "uppercase", color: acento }}>
                  {t.para} {q.nome}
                </p>
              )}
              <h1
                style={{
                  fontFamily: FONTES.display,
                  fontWeight: 500,
                  fontSize: "23pt",
                  lineHeight: 1.12,
                  marginTop: "3mm",
                  color: p.texto,
                }}
              >
                {titulo}
              </h1>
            </div>

            <div
              ref={caixaRef}
              style={{
                flex: 1,
                minHeight: 0,
                marginTop: "8mm",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              {/* ── UMA LINHA DA LETRA, UM BLOCO ────────────────────
                  Isto era um <p> so, com `pre-wrap` e duas colunas, e o
                  navegador despejava o texto inteiro como um rio: sem
                  fronteira de elemento, o corte entre as colunas caia no meio
                  de uma linha QUE JA TINHA QUEBRADO.

                  O estrago, pego no quadro de "Encontro no Golandim": o verso
                  "Do Golandim ate Bodo, foi la que a nossa historia comecou a
                  ter nome" quebrou, e a palavra `nome` foi parar sozinha no
                  TOPO DA SEGUNDA COLUNA — lida de longe parece marcador de
                  sistema vazando pra dentro do presente.

                  Com cada linha num bloco e `breakInside: "avoid"`, a coluna
                  so pode virar ENTRE versos. Linha nenhuma se parte no meio.

                  A linha vazia vira um bloco com espaco duro: `pre-wrap` dava
                  altura de linha pra ela, e sem isso as estrofes colariam. */}
              <div
                ref={letraRef}
                style={{
                  textAlign: "center",
                  fontSize: `${corpoPt}pt`,
                  lineHeight: duasColunas ? 1.42 : 1.6,
                  color: p.textoSuave,
                  maxWidth: duasColunas ? "100%" : "138mm",
                  ...(duasColunas ? { columnCount: 2, columnGap: "12mm", width: "100%" } : {}),
                }}
              >
                {q.letra.split(NOVA_LINHA).map((linha, i) => (
                  <span key={i} style={{ display: "block", breakInside: "avoid" }}>
                    {linha.trim() ? linha : " "}
                  </span>
                ))}
              </div>
            </div>

            {dedicatoria && (
              <p
                style={{
                  textAlign: "center",
                  fontFamily: FONTES.display,
                  fontSize: "11pt",
                  fontStyle: "italic",
                  color: acento,
                  margin: "6mm 0 0",
                }}
              >
                {dedicatoria}
              </p>
            )}

            {/* O RODAPÉ É O QR, não a assinatura. Quem olha o quadro na parede
                não precisa saber quem fez, precisa conseguir OUVIR. */}
            <div
              style={{
                marginTop: "5mm",
                paddingTop: "4mm",
                borderTop: `0.25mm solid ${p.linha}`,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "2mm",
              }}
            >
              <p
                style={{
                  fontSize: "9pt",
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: acento,
                  fontWeight: 600,
                }}
              >
                {t.ouvir}
              </p>
              {qr && (
                <img
                  src={qr}
                  alt=""
                  // Zona de silêncio em volta: sem margem clara o leitor erra
                  // os cantos e o celular não engata.
                  style={{
                    width: "24mm",
                    height: "24mm",
                    display: "block",
                    background: p.qrFundo,
                    padding: "1.8mm",
                    borderRadius: 2,
                  }}
                />
              )}
              <img
                src="/img/logo-serenata-alfa.png"
                alt={MARCA.nome}
                style={{
                  height: "7mm",
                  width: "auto",
                  display: "block",
                  marginTop: "0.5mm",
                  // A logo é vinho sobre transparente: no fundo escuro ela some,
                  // então clareia. No claro vai como é.
                  filter: p.fotoSangra ? "brightness(0) invert(1) opacity(0.82)" : "none",
                }}
              />
            </div>
          </div>
        </div>
        </div>
      </div>
    </>
  );
}
