import { Music, Images, Sparkles, QrCode } from "lucide-react";

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

const ITENS = [
  { Icone: Music, texto: "música cantada" },
  { Icone: Images, texto: "página com fotos" },
  { Icone: Sparkles, texto: "karaokê" },
  { Icone: QrCode, texto: "QR Code" },
];

export function FaixaPresente({ nome }: { nome?: string }) {
  const limpo = nome?.trim();

  return (
    <div className="mb-6 rounded-2xl border border-primary/15 bg-secondary/40 px-3 py-2.5">
      <p className="text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
        {limpo ? `o presente de ${limpo}` : "o que você vai montar"}
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
    </div>
  );
}
