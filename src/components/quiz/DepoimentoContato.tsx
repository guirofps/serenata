// O DEPOIMENTO, NO PASSO DO E-MAIL.
//
// Por que AQUI e não antes: este é o único passo do quiz que pede um dado que
// não é sobre a música. Até aqui a pessoa falava do presente — nome, relação,
// história, memória; agora ela é interrompida pra entregar contato. É o ponto
// da tela em que a pergunta muda de assunto, e é onde lembrar POR QUE ela está
// fazendo isso vale mais.
//
// Fica ABAIXO do campo de propósito. A barra do "continuar" é `sticky`
// (Quiz.tsx), então o botão nunca sai da vista por causa da altura daqui — o
// custo de um bloco alto neste lugar é rolagem, não alcance. Acima do campo
// seria outra conversa: empurraria o campo pra fora da dobra no celular, que é
// onde este funil roda.
//
// ── TEXTO REAL, E A REGRA QUE ISSO IMPÕE ─────────────────────────
//
// O CLAUDE.md proíbe depoimento fabricado, e não por delicadeza: alegação
// inventada em página com tráfego pago é risco de conta no Google Ads. Por
// isso este componente RENDERIZA NADA quando `TEXTO` está vazio, em vez de
// cair num exemplo. Fail-closed em conteúdo não verificado: a única forma de
// aparecer alguma coisa aqui é alguém ter dito de verdade.
//
// Mesma regra pra assinatura: sem nome, o bloco sai sem assinatura em vez de
// inventar um. Depoimento sem nome é mais fraco; depoimento com nome errado é
// outra categoria de problema.

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
 * topo deste arquivo existe pra evitar. E dito na cara costuma funcionar
 * melhor, não pior.
 */
const ASSINATURA = "Marcelo R.";

export function DepoimentoContato() {
  if (!TEXTO.trim()) return null;

  return (
    <figure className="mx-auto max-w-md text-left">
      <p className="text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
        de quem já fez
      </p>
      <blockquote className="mt-3 rounded-2xl bg-muted/60 px-5 py-4 text-sm leading-relaxed text-foreground">
        {TEXTO}
      </blockquote>
      {ASSINATURA.trim() && (
        <figcaption className="mt-2 text-center text-xs text-muted-foreground">
          {ASSINATURA}
        </figcaption>
      )}
    </figure>
  );
}
