import { Variante } from "@/components/Variante";
import type { Locale } from "@/lib/i18n";
import type { Cupom } from "@/lib/cupom";
import { EXP_PRECO, planoControle, planoDe, variantesComPlano } from "@/lib/preco";

// O NÚMERO NA TELA, no formato que sobrevive ao servidor.
//
// `/criar?step=oferta` é uma URL renderizada no servidor — reload, botão
// voltar e o link do e-mail de recuperação caem direto nela. O servidor não
// sabe qual preço esta pessoa tirou no sorteio, porque o sorteio mora no
// navegador dela. Então as DUAS versões vêm no HTML e o CSS esconde a
// perdedora antes do primeiro pixel (ver `experimentos.ts`).
//
// A alternativa — ler a variante e renderizar um só — mostraria o preço do
// controle por um instante e trocaria na frente da pessoa, no exato momento
// em que ela está decidindo gastar. Preço que pisca é preço em que não se
// confia.
//
// Com o experimento desligado, o CSS deixa só o controle visível: esta tela
// volta a ser a de sempre sem nenhuma mudança aqui.

export function PrecoDaOferta({
  locale,
  hojePor,
  descontado,
}: {
  locale: Locale;
  /** "hoje por" / "hoy por" — a ponte entre o riscado e o preço. */
  hojePor: string;
  /** O cupom da recuperação, quando é MESMO o dela. Ver `TelaOferta`. */
  descontado: Cupom | null;
}) {
  // COM CUPOM NÃO HÁ TESTE.
  //
  // O e-mail de recuperação prometeu um número exato ("de R$ 38 por R$ 28") e
  // o cupom da Perfect Pay só existe no produto do controle. Quem chega por
  // esse caminho é tirado do sorteio em `varianteDePreco`, e a tela tem que
  // contar a mesma história: um preço só, o que o e-mail prometeu.
  if (descontado) {
    return (
      <>
        <p className="text-sm text-muted-foreground">
          <span className="line-through">{planoControle(locale).texto}</span> {hojePor}
        </p>
        <p className="font-display text-5xl font-semibold tracking-tight">{descontado.por}</p>
      </>
    );
  }

  return (
    <>
      {variantesComPlano(locale).map((v) => {
        const plano = planoDe(locale, v);
        return (
          <Variante key={v} exp={EXP_PRECO} v={v}>
            <p className="text-sm text-muted-foreground">
              <span className="line-through">{plano.ancora}</span> {hojePor}
            </p>
            <p className="font-display text-5xl font-semibold tracking-tight">{plano.texto}</p>
          </Variante>
        );
      })}
    </>
  );
}

/**
 * O mesmo preço na barra fixa do rodapé.
 *
 * Existe separado porque a barra é um `<p>` só, e `<Variante>` renderiza um
 * `<div>` — enfiar div dentro de p é HTML inválido e o navegador reescreve a
 * árvore, o que quebra a hidratação justamente na barra que tem o botão de
 * comprar. Então o `<p>` vai DENTRO da variante, um por preço.
 */
export function PrecoCurto({
  locale,
  descontado,
  className,
}: {
  locale: Locale;
  descontado: Cupom | null;
  className: string;
}) {
  if (descontado) {
    return <p className={className}>{descontado.por}</p>;
  }
  return (
    <>
      {variantesComPlano(locale).map((v) => (
        <Variante key={v} exp={EXP_PRECO} v={v}>
          <p className={className}>{planoDe(locale, v).texto}</p>
        </Variante>
      ))}
    </>
  );
}

/**
 * "A partir de R$ 38", na revelação — o primeiro preço que a pessoa lê.
 *
 * Aparece logo depois dela ouvir o trecho cantado, que é o pico emocional do
 * funil e, por isso mesmo, o pior lugar possível pra um número que não seja o
 * que ela vai pagar. Varia junto com a oferta, pela mesma máquina.
 */
export function APartirDe({
  locale,
  frase,
  className,
}: {
  locale: Locale;
  /** `T.aPartirDe`, que recebe o preço já formatado. */
  frase: (preco: string) => string;
  className: string;
}) {
  return (
    <>
      {variantesComPlano(locale).map((v) => (
        <Variante key={v} exp={EXP_PRECO} v={v}>
          <p className={className}>{frase(planoDe(locale, v).texto)}</p>
        </Variante>
      ))}
    </>
  );
}
