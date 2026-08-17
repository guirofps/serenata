import { useEffect, useState } from "react";
import { Play } from "lucide-react";
import { Efeitos } from "@/components/presente/Efeitos";
import { Logo } from "@/components/marca/Logo";
import { Button } from "@/components/ui/button";
import { CORES, FONTES } from "@/lib/marca";
import { type Locale } from "@/lib/i18n";

// A PRIMEIRA TELA DO FUNIL — o que a pessoa ganha, antes do que a gente pede.
//
// O buraco do funil está no primeiro instante e isso está medido (09/08): de
// 195 que viram a pergunta 1, só 41 tocaram em algum chip e 63% não geraram
// mais nenhum evento. Não é atrito de botão (só 6 escolheram sem avançar): a
// pessoa cai do anúncio direto num "Pra quem é esse presente?", sem saber que
// site é esse, e vai embora antes de responder.
//
// A tela mostra o ENTREGÁVEL em vez de explicar o processo. É a tese do
// projeto ("a página é o presente") e bate com o dado da home: quem abre um
// presente de exemplo entra no funil 31,4% das vezes contra 12,7% de quem não
// abre. Explicar em três passos ensina; mostrar dá vontade.
//
// ── POR QUE O CARTÃO NÃO NASCE VAZIO ──
//
// A ideia original era montar o presente do nada: capa aparece, nome digita,
// letra escreve. Não dá, e o motivo é o primeiro pixel. Esta tela é renderizada
// NO SERVIDOR e o HTML chega antes do JavaScript; com a montagem começando do
// zero, o servidor manda um cartão VAZIO e a pessoa encara um buraco até a
// hidratação terminar. Numa tela cuja única função é dar motivo pra continuar,
// meio segundo de vazio custa mais do que a animação rende.
//
// Então o cartão chega composto e o que anima é ele ACENDENDO: o play liga, os
// versos acendem um a um, o selo se desenha. É o mesmo gesto do produto de
// verdade (a letra acendendo palavra por palavra no karaokê), e o HTML do
// servidor já mostra um presente reconhecível.
//
// ── E POR QUE O MOVIMENTO É POR TEMPO, NÃO POR @keyframes ──
//
// Mesma razão do `Efeitos` e do `PresenteNoTopo`, aprendida na marra: keyframes
// dentro de `@layer` não pegam no Tailwind v4, e "Reduzir movimento" (comum no
// iPhone) desliga animação CSS inteira. Com o tempo em estado, dá pra pular
// direto pro fim quando a pessoa pediu menos movimento — e dá pra VERIFICAR,
// que é o que permitiu medir esta tela antes de subir.

// ── Roteiro, em segundos ──────────────────────────────────────────
const PLAY = { inicio: 0.4, dur: 0.4 };
const VERSO = { inicio: 0.9, passo: 0.55, dur: 0.5 };
const SELO = { traco: 3.2, tracoDur: 0.9, modulos: 3.6, modulosDur: 0.6 };
const FIM = 4.4;
/** Depois de montado, os versos acendem em rodízio, como no karaokê. */
const RODIZIO = 1.4;

/** Progresso 0→1 de um trecho do roteiro. */
const prog = (t: number, inicio: number, dur: number) =>
  Math.max(0, Math.min(1, (t - inicio) / dur));

// A copy é REDAÇÃO nos dois idiomas, não tradução: o título espelha o H1 da
// landing de cada idioma, pra quem veio da home encontrar a mesma promessa e
// quem veio do anúncio receber ela inteira.
//
// Os versos e as fotos NÃO são inventados: saem de presentes reais gerados por
// este funil, os mesmos que a home oferece pra ouvir. O português vem de
// "Desde a Escola, Isabela" (esposa, sertanejo universitário) e o espanhol de
// "El Mandil Azul", uma das três músicas da validação de 07/08.
//
// O espanhol segue na MÃE porque não existe verso nem capa do exemplo de
// esposa espanhol ("El Café de las Cinco") em lugar nenhum do repositório, e
// escrever letra pra ilustrar seria fabricar prova.
const COPY: Record<
  Locale,
  {
    tituloAntes: string;
    tituloOuro: string;
    tituloDepois: string;
    explicacao: string;
    cta: string;
    micro: string;
    rotulo: string;
    nome: string;
    foto: string;
    versos: string[];
  }
> = {
  pt: {
    tituloAntes: "Uma música feita da ",
    tituloOuro: "história",
    tituloDepois: " de quem você ama",
    explicacao:
      "Você conta a história. A letra fica pronta na hora, de graça — e você ouve um trecho cantado antes de decidir qualquer coisa.",
    cta: "CRIAR MINHA MÚSICA GRÁTIS",
    // "grátis" saiu daqui porque agora está no botão, e dizer duas vezes na
    // mesma dobra não convence mais — só ocupa a linha que ainda podia
    // derrubar uma objeção. "Sem cartão" é verdade e é a objeção real de
    // quem desconfia de "grátis": a letra e o trecho cantado saem sem
    // pagamento nenhum.
    micro: "sem cadastro · sem cartão",
    rotulo: "uma música para",
    // ESPOSA e não pai: é a relação que mais vende, e a primeira tela tem que
    // mostrar o caso mais provável de quem está chegando. O cartão da home
    // (`PresenteNoTopo`) continua no Antônio — lá a pessoa já rolou até um
    // seletor de exemplos por relação, aqui ela tem um cartão só e ele
    // precisa acertar de primeira.
    //
    // "Desde a Escola, Isabela" é o exemplo de esposa que já roda no site
    // (`ExemplosReais`, token e406f9b4356f4a5a9e7d8e). Os versos saem dele,
    // literais: nada aqui é escrito pra ilustrar.
    nome: "Isabela",
    foto: "/img/exemplos/isabela.webp",
    versos: [
      "Isabela, deixa eu te contar",
      "uma história que já é nossa há dez anos.",
      "Eu te vi ainda no colégio",
      "e o mundo mudou de lugar",
    ],
  },
  es: {
    tituloAntes: "Una canción hecha de la ",
    tituloOuro: "historia",
    tituloDepois: " de quien amas",
    explicacao:
      "Tú cuentas la historia. La letra queda lista al instante, gratis — y escuchas un pedazo cantado antes de decidir nada.",
    cta: "CREAR MI CANCIÓN GRATIS",
    micro: "sin registro · sin tarjeta",
    rotulo: "una canción para",
    nome: "Lupita",
    foto: "/img/exemplos/mae.webp",
    versos: [
      "Hoy le canto a mi Lupita",
      "la que nunca se quejó",
      "Desde las cinco en el mercado",
      "ya se oía tu voz",
    ],
  },
};

export function AberturaPresente({
  locale = "pt",
  aoComecar,
}: {
  locale?: Locale;
  aoComecar: () => void;
}) {
  const C = COPY[locale] ?? COPY.pt;
  const [t, setT] = useState(0);

  useEffect(() => {
    // "Reduzir movimento" ligado: vai direto pro presente montado e fica
    // parado. Sem relógio, sem rodízio de versos, sem partículas.
    const reduz = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (reduz) {
      setT(FIM);
      return;
    }
    const id = setInterval(() => setT((v) => v + 0.1), 100);
    return () => clearInterval(id);
  }, []);

  const montado = t >= FIM;
  // Antes de montar, o verso em destaque é o que está chegando; depois, o
  // rodízio suave do karaokê.
  const ativa = montado
    ? Math.floor(((t - FIM) / RODIZIO) % C.versos.length)
    : Math.max(0, Math.min(C.versos.length - 1, Math.floor((t - VERSO.inicio) / VERSO.passo)));

  return (
    <div className="flex flex-col items-center text-center">
      {/* Quem cai do anúncio não sabe em que site está. A logo responde isso
          em 28px, que é mais barato que uma linha de texto. */}
      <Logo tamanho="sm" />

      {/* CLASSES DO QUIZ, não as variáveis da landing.
          Este componente nasceu copiando o herói da home, que estiliza por
          `var(--t-3xl)` e `var(--tinta-suave)` — variáveis que vêm do
          `TEMA_CLARO`, aplicado no `<div>` raiz da landing e em lugar nenhum
          do quiz. Aqui elas não resolvem, e `font-size: var(--indefinida)` é
          declaração inválida: o título caía nos 16px herdados do corpo, ou
          seja, MENOR que o enunciado de qualquer pergunta do funil.
          Medido no navegador, não no olho — 16px de computed style.

          Um degrau acima das perguntas (`text-2xl sm:text-3xl`) de propósito:
          esta é a tela que faz a promessa.

          Só o iPhone SE antigo (≤600px de altura) recebe o tamanho menor, e
          lá o cartão sozinho já não paga a conta. Faixas fechadas de novo,
          pelo mesmo motivo do cartão: sobrepostas, quem ganha é a ordem do
          arquivo. Sem degrau por LARGURA (`sm:`) porque este funil é 99%
          celular e um segundo eixo aqui só reabriria o conflito de ordem. */}
      <h1 className="mt-4 text-balance font-display font-semibold leading-tight tracking-tight [@media(max-height:600px)]:text-2xl [@media(min-height:601px)]:text-3xl">
        {C.tituloAntes}
        <span className="texto-ouro">{C.tituloOuro}</span>
        {C.tituloDepois}
      </h1>

      {/* ── O PRESENTE ────────────────────────────────────────── */}
      {/* O CARTÃO É QUEM CEDE ESPAÇO.
          Com aspecto 4/5, cada pixel de largura custa 1,25 de altura, então
          ele é o regulador natural da tela. O título e o botão carregam a
          mensagem e não encolhem; o cartão ilustra e pode.

          Os degraus são de ALTURA, não de largura, e sem `vh`: no celular
          `100vh` é a tela SEM a barra do navegador, ou seja, mede mais do que
          se enxerga — foi essa armadilha que derrubou o funil em 09/08.

          Medido, não estimado (`main` tem 686px a 375x667 com o cartão cheio):
            >720px       228px  o tamanho de projeto
            661–720px    196px  iPhone comum (375x667) e afins
            601–660px    172px  Android pequeno (360x640)
            ≤600px       132px  iPhone SE antigo (320x568)

          As faixas são MUTUAMENTE EXCLUSIVAS de propósito. Com `max-height`
          solto elas se sobrepõem, todas têm a mesma especificidade, e quem
          vence é a última que o Tailwind escrever no arquivo — a 360x640 o
          cartão saía com o tamanho do degrau de 720px. Faixa fechada não
          depende de ordem de CSS. */}
      <div
        className="mt-5 w-full [@media(min-height:721px)]:max-w-[228px] [@media(max-height:720px)_and_(min-height:661px)]:max-w-[196px] [@media(max-height:660px)_and_(min-height:601px)]:max-w-[172px] [@media(max-height:600px)]:max-w-[132px]"
        aria-hidden
      >
        <div
          className="relative aspect-[4/5] overflow-hidden rounded-[22px] border"
          style={{
            borderColor: "rgba(247,240,232,0.16)",
            boxShadow: "0 24px 50px -22px rgba(42,21,24,0.55)",
            background: CORES.noite,
          }}
        >
          <img
            src={C.foto}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            loading="eager"
          />
          {/* Véu escuro: a letra precisa ler por cima de qualquer foto.
              O meio é mais fechado que o do cartão da home (0,54 contra 0,38):
              lá o cartão tem 310px e a letra respira, aqui ela cai em cima do
              rosto num espaço 26% menor e sumia contra a pele clara. */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, rgba(16,10,12,0.66) 0%, rgba(16,10,12,0.54) 38%, rgba(16,10,12,0.90) 100%)",
            }}
          />

          {/* Os corações são o efeito que o comprador escolhe na página dele,
              então aparecer aqui é mostrar produto, não enfeitar. Mas em 0,42
              eles cobriam o rosto e disputavam com a letra — que é o que a
              gente está vendendo. Em 0,25 viram acento, e a marca pede
              "romântico clássico sem ser piegas". */}
          <Efeitos tipo="coracoes" ativo={montado} tempo={t} contido escala={0.25} />

          <div className="relative flex h-full flex-col px-4 py-4">
            <p
              className="text-center text-[8px] uppercase tracking-[0.3em]"
              style={{ color: "rgba(247,240,232,0.7)" }}
            >
              {C.rotulo}
            </p>
            <p
              className="mt-0.5 text-center text-[19px] leading-tight"
              style={{ fontFamily: FONTES.display, color: CORES.creme }}
            >
              {C.nome}
            </p>

            {/* Os versos ACENDEM um a um. É o gesto do produto de verdade:
                no presente entregue a letra acende palavra por palavra pelos
                timestamps da música cantada. */}
            <div className="flex flex-1 flex-col justify-center gap-1">
              {C.versos.map((verso, i) => {
                const p = prog(t, VERSO.inicio + i * VERSO.passo, VERSO.dur);
                const acesa = i === ativa;
                return (
                  <p
                    key={verso}
                    // `text-balance`: os versos são letra de verdade e alguns
                    // não cabem numa linha (o mais longo do exemplo estoura
                    // por 6px). Sem isto a sobra vira uma palavra órfã —
                    // "anos." sozinha embaixo. Balanceada, a quebra parece
                    // verso, que é o que ela é.
                    className="text-balance text-[10.5px] leading-snug transition-colors duration-300"
                    style={{
                      opacity: 0.12 + p * 0.88,
                      color: acesa ? "oklch(0.86 0.13 78)" : "rgba(247,240,232,0.45)",
                      textShadow: acesa ? "0 0 16px oklch(0.86 0.13 78 / 0.35)" : "none",
                    }}
                  >
                    {verso}
                  </p>
                );
              })}
            </div>

            {/* O player: existe pra dizer "isto TOCA". Acende primeiro, antes
                da letra, porque é ele que promete a música. */}
            <div className="flex items-center gap-2">
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-transform"
                style={{
                  background: "oklch(0.86 0.13 78)",
                  opacity: 0.25 + prog(t, PLAY.inicio, PLAY.dur) * 0.75,
                  transform: `scale(${0.86 + prog(t, PLAY.inicio, PLAY.dur) * 0.14})`,
                }}
              >
                <Play className="h-3 w-3 fill-current text-[#22120f]" />
              </span>
              <span
                className="h-[3px] flex-1 rounded-full"
                style={{ background: "rgba(247,240,232,0.25)" }}
              >
                {/* A barra anda só depois de montado: antes ela competiria
                    com os versos pela atenção. */}
                <span
                  className="block h-full rounded-full"
                  style={{
                    width: montado ? `${((t - FIM) * 4) % 100}%` : "0%",
                    background: "oklch(0.86 0.13 78 / 0.75)",
                  }}
                />
              </span>
            </div>
          </div>

          {/* O SELO, no canto — um QR que se desenha sozinho.
              É o que transforma o digital em coisa que se dá na mão: o
              comprador imprime e cola numa caixa de bombom. Fica no canto
              como selo de carta, que é de onde a marca inteira sai. */}
          <SeloQr
            traco={prog(t, SELO.traco, SELO.tracoDur)}
            modulos={prog(t, SELO.modulos, SELO.modulosDur)}
          />
        </div>
      </div>

      {/* A PROPOSTA em uma frase: o que ela faz, o que recebe, o que custa. */}
      {/* `text-muted-foreground` e não `var(--tinta-suave)`: mesma armadilha
          do título. A variável não existe no quiz, então esta frase saía na
          tinta cheia, com o mesmo peso do título logo acima. */}
      <p className="mt-4 max-w-[19rem] text-sm leading-relaxed text-muted-foreground">
        {C.explicacao}
      </p>

      {/* `tracking-wide` porque o rótulo é caixa alta: sem folga entre as
          letras, maiúscula em Poppins fica empastada. */}
      <Button
        size="lg"
        className="cta mt-5 w-full rounded-full border-0 tracking-wide"
        onClick={aoComecar}
      >
        {C.cta}
      </Button>
      <p className="mt-2 text-[11px] text-muted-foreground">{C.micro}</p>
    </div>
  );
}

// ── O selo ────────────────────────────────────────────────────────
// Um QR estilizado: as três âncoras são desenhadas a traço (stroke-dasharray)
// e os módulos aparecem depois. As posições são FIXAS de propósito — um
// Math.random aqui faria o servidor e o cliente desenharem QRs diferentes, e
// a hidratação do React descartaria a árvore inteira.
const ANCORAS = [
  [1, 1],
  [14, 1],
  [1, 14],
];
const MODULOS = [
  [9, 2],
  [11, 4],
  [9, 6],
  [13, 7],
  [15, 9],
  [11, 8],
  [3, 10],
  [5, 12],
  [7, 10],
  [9, 12],
  [11, 11],
  [13, 13],
  [15, 15],
  [17, 11],
  [7, 15],
  [9, 17],
  [13, 17],
  [17, 17],
  [11, 15],
  [5, 17],
];
/** Perímetro de uma âncora 6×6 — o traço que precisa ser "desenhado". */
const PERIMETRO = 24;

function SeloQr({ traco, modulos }: { traco: number; modulos: number }) {
  if (traco <= 0) return null;
  return (
    <div
      className="absolute right-2.5 top-2.5 rounded-md p-[3px]"
      style={{
        background: CORES.creme,
        opacity: 0.25 + traco * 0.75,
        boxShadow: "0 4px 10px -4px rgba(0,0,0,0.5)",
      }}
    >
      <svg viewBox="0 0 21 21" className="h-[30px] w-[30px]" role="presentation">
        {ANCORAS.map(([x, y]) => (
          <g key={`${x}-${y}`}>
            <rect
              x={x + 0.6}
              y={y + 0.6}
              width={4.8}
              height={4.8}
              fill="none"
              stroke={CORES.noite}
              strokeWidth={1.2}
              strokeDasharray={PERIMETRO}
              strokeDashoffset={PERIMETRO * (1 - traco)}
            />
            <rect
              x={x + 2.2}
              y={y + 2.2}
              width={1.6}
              height={1.6}
              fill={CORES.noite}
              opacity={modulos}
            />
          </g>
        ))}
        {MODULOS.map(([x, y], i) => (
          <rect
            key={`${x}-${y}`}
            x={x}
            y={y}
            width={1.5}
            height={1.5}
            fill={CORES.noite}
            // Escalonado: os módulos não aparecem todos no mesmo quadro, senão
            // vira um piscar só em vez de algo sendo impresso.
            opacity={Math.max(0, Math.min(1, modulos * MODULOS.length - i))}
          />
        ))}
      </svg>
    </div>
  );
}
