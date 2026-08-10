import { Music, Images, Sparkles, QrCode } from "lucide-react";
import { type Locale } from "@/lib/i18n";
import { t } from "@/lib/textos";
import { GARANTIA } from "@/lib/garantia";

// O QUE A PESSOA ESTÁ MONTANDO, visível o quiz inteiro.
//
// Medido em 01/08: de 119 que entram no quiz, 29 chegam na letra. Noventa
// desistem no meio respondendo perguntas sem nunca ver o que ganham. O quiz
// não dizia nada do entregável até a tela final: era formulário puro.
//
// Aqui não se vende, se lembra. Fica sob a barra de progresso, pequeno, e o
// título assume o nome do homenageado assim que ele existe — porque "o
// presente da Janes" compromete mais que "o seu presente".
//
// Deliberadamente SEM preço: a letra é grátis, e falar de dinheiro antes da
// pessoa ler a letra troca a ordem do funil.

export function FaixaPresente({
  nome,
  locale = "pt",
}: {
  nome?: string;
  locale?: Locale;
}) {
  const T = t(locale);
  const G = GARANTIA[locale] ?? GARANTIA.pt;
  const limpo = nome?.trim();

  // Dentro do componente porque cada texto depende do idioma. Fora dele o
  // array seria montado uma vez, no primeiro idioma que carregasse.
  const ITENS = [
    { Icone: Music, texto: T.musicaCantada },
    { Icone: Images, texto: T.paginaComFotos },
    { Icone: Sparkles, texto: T.karaoke },
    { Icone: QrCode, texto: T.qrCode },
  ];

  return (
    <div className="mb-6 rounded-2xl border border-primary/15 bg-secondary/40 px-3 py-2.5">
      <p className="text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
        {limpo ? `${T.oPresenteDe.toLowerCase()} ${limpo}` : T.oQueVaiMontar}
      </p>
      {/* 2x2 no celular: com flex-wrap os quatro itens quebravam 3+1 e o
          último ficava sozinho no meio, torto. Vira linha única no desktop. */}
      <ul className="mx-auto mt-2 grid w-fit grid-cols-2 gap-x-4 gap-y-1.5 sm:flex sm:items-center sm:justify-center sm:gap-x-3">
        {ITENS.map(({ Icone, texto }) => (
          <li
            key={texto}
            className="inline-flex items-center gap-1 text-[11px] leading-none text-muted-foreground"
          >
            <Icone className="h-3 w-3 shrink-0 text-primary/70" aria-hidden />
            {texto}
          </li>
        ))}
      </ul>

      {/* GARANTIA, acompanhando o quiz inteiro — igual ao concorrente, que
          carrega o selo dele em todas as telas.

          Vive DENTRO da faixa que já existia, e não num bloco novo, porque
          altura no celular é o recurso mais escasso do funil: em 10/08 sete
          dos onze passos tinham o botão de avançar fora da tela. Uma linha de
          ~18px cabe; um cartão a mais empurraria a pergunta pra baixo de novo.

          Sem ícone verde nem caixa colorida aqui: no quiz ela é lembrete de
          segurança, discreta. O peso visual fica reservado pra tela da oferta,
          onde a objeção realmente decide a compra. */}
      <p
        className="mt-2 border-t border-primary/10 pt-2 text-center text-[10px] text-muted-foreground"
        title={G.texto}
      >
        {G.curto}
      </p>
    </div>
  );
}
