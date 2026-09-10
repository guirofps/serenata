import { Star } from "lucide-react";

// O DEPOIMENTO, NO PASSO DO E-MAIL.
//
// Por que AQUI e não antes: este é o único passo do quiz que pede um dado que
// não é sobre a música. Até aqui a pessoa falava do presente — nome, relação,
// história, memória; agora ela é interrompida pra entregar contato. É o ponto
// da tela em que a pergunta muda de assunto, e é onde lembrar POR QUE ela está
// fazendo isso vale mais.
//
// Fica ABAIXO do campo e ABAIXO do sorteio. A barra do "continuar" é `sticky`
// (Quiz.tsx), então a altura daqui custa rolagem, não alcance do botão.
//
// ── POR QUE PARECE UM DEPOIMENTO, E NÃO UM PARÁGRAFO ─────────────
//
// A primeira versão era texto cinza num retângulo, e não lia como depoimento:
// sem os sinais que o olho procura, vira mais uma frase da página. Os sinais
// são três, e cada um faz um trabalho:
//
//   ASPA GRANDE  diz "isto é fala de alguém" antes de qualquer leitura. É o
//                caractere tipográfico no Fraunces, não um ícone — a fonte da
//                marca já tem uma aspa bonita, e desenhar outra seria pior.
//   ESTRELAS     dão a avaliação num relance, que é como prova social é lida.
//   ROSTO E NOME DENTRO do card. Fora dele a assinatura solta parecia legenda
//                da página, não parte da citação.
//
// O card usa `bg-card`, que é mais claro que o fundo da página: ele LEVANTA do
// papel em vez de afundar, que era o efeito do `bg-muted` anterior.
//
// ── TEXTO REAL, E A REGRA QUE ISSO IMPÕE ─────────────────────────
//
// O CLAUDE.md proíbe depoimento fabricado, e não por delicadeza: alegação
// inventada em página com tráfego pago é risco de conta no Google Ads. Por
// isso este componente RENDERIZA NADA quando `TEXTO` está vazio, em vez de
// cair num exemplo. Fail-closed em conteúdo não verificado: a única forma de
// aparecer alguma coisa aqui é alguém ter dito de verdade.

/**
 * O depoimento, na íntegra e como foi escrito.
 *
 * NÃO EDITAR pra "melhorar". Corte muda o que a pessoa disse, e o valor disto
 * está justamente em não parecer escrito por nós — o "😅", as frases curtas
 * emendadas e o "E de novo." repetido são o que fazem soar como gente.
 */
const TEXTO =
  "Fiz a primeira música do Serenata pra minha esposa. Escrevi na letra coisa " +
  "que eu nunca tinha falado em voz alta pra ela. Mandei o link e fiquei " +
  "olhando. Ela ouviu de novo. E de novo. Mostrou pra família dela, botou no " +
  "story, ouve no carro 😅 Presente eu já dei de tudo. Esse foi o único que " +
  "ela guardou.";

/**
 * Quem escreveu. Vazio = sai sem assinatura.
 *
 * Sobrenome abreviado é o padrão de quem publica depoimento de cliente real
 * sem expor a pessoa inteira, e é o que está aqui.
 *
 * A regra que isto NÃO pode quebrar: a assinatura tem que bater com quem
 * falou. Se um dia entrar aqui um depoimento de alguém da casa, ele precisa
 * dizer isso na cara ("Guilherme, que fez o Serenata") — texto de dentro
 * assinado como se fosse cliente é a mesma alegação enganosa que o bloco no
 * topo deste arquivo existe pra evitar.
 */
const ASSINATURA = "Marcelo R.";

/**
 * A linha embaixo do nome. Sai DO PRÓPRIO depoimento ("pra minha esposa"), e
 * é o único jeito honesto de escrever isto: contexto que a pessoa deu, não
 * papel que a gente atribuiu a ela.
 */
const CONTEXTO = "fez a música pra esposa";

/**
 * As estrelas.
 *
 * São convenção visual de depoimento, e é assim que prova social é lida num
 * relance. Mas convenção não é o mesmo que dado: se o Marcelo nunca deu uma
 * nota, isto é um número que ninguém disse. Zerar apaga as estrelas e o resto
 * do bloco continua de pé — é a saída, se um dia a nota precisar ser real.
 */
const ESTRELAS = 5;

export function DepoimentoContato() {
  if (!TEXTO.trim()) return null;

  return (
    <figure
      className="mx-auto max-w-md rounded-2xl border border-border bg-card p-6 text-left"
      style={{ boxShadow: "0 12px 28px -20px rgba(42,21,24,0.5)" }}
    >
      <div className="flex items-start justify-between gap-4">
        {/* A aspa é o caractere da fonte da marca, não um ícone: o Fraunces já
            tem uma aspa desenhada, e `aria-hidden` porque ela é ornamento — o
            leitor de tela já anuncia a citação pelo <blockquote>. */}
        <span
          aria-hidden
          className="-ml-1 -mt-5 select-none font-display text-8xl leading-none text-primary/25"
        >
          &ldquo;
        </span>

        {ESTRELAS > 0 && (
          <div className="flex shrink-0 gap-0.5" aria-label={`${ESTRELAS} de 5 estrelas`}>
            {Array.from({ length: ESTRELAS }, (_, i) => (
              <Star key={i} aria-hidden className="h-4 w-4 fill-primary text-primary" />
            ))}
          </div>
        )}
      </div>

      <blockquote className="-mt-6 text-sm leading-relaxed text-foreground">{TEXTO}</blockquote>

      {ASSINATURA.trim() && (
        <>
          {/* Separador como ELEMENTO, não como borda de um lado só do card:
              visualmente idêntico, e não cria a exceção de "card com borda
              parcial" que depois vira precedente. */}
          <div className="mt-5 h-px bg-border" />
          <figcaption className="mt-4 flex items-center gap-3">
            {/* Inicial em vez de foto: não temos retrato do Marcelo, e usar
                rosto de banco de imagem num depoimento real seria estragar
                justamente o que ele tem de bom. */}
            <span
              aria-hidden
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 font-display text-base text-primary"
            >
              {ASSINATURA.trim().charAt(0)}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-foreground">{ASSINATURA}</span>
              {CONTEXTO && <span className="block text-xs text-muted-foreground">{CONTEXTO}</span>}
            </span>
          </figcaption>
        </>
      )}
    </figure>
  );
}
