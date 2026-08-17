import { Star } from "lucide-react";
import { type Locale } from "@/lib/i18n";

// PROVA SOCIAL DO HERÓI — o bloco que fica logo abaixo do CTA principal.
//
// Formato copiado do concorrente NossaCanção: selo de prazo em itálico, cinco
// estrelas, fileira de rostos sobrepostos com um contador, e a linha de
// famílias atendidas. É um padrão que funciona porque responde, em dois
// segundos e sem texto, as três perguntas de quem acabou de chegar: demora?
// é bom? tem gente usando?
//
// OS ROSTOS SÃO NOSSOS, e essa é a única coisa que fiz diferente deles.
// Saíram de `public/video/reacoes.mp4` — o vídeo de reações reais que a gente
// gravou — recortados em quadrado a 96px por ffmpeg. Pegar as fotos de cliente
// do concorrente traria duas dores que não valem o atalho: são rostos de
// pessoas identificáveis usados pra sugerir que compraram da gente, e são
// ativos de outra empresa. O resultado visual é o mesmo, e estes são de gente
// que ouviu música NOSSA.

const ROSTOS = [1, 2, 3, 4, 5];

// Um lugar só pra mexer no número.
const FAMILIAS = "1000+";
const CONTADOR = "+998";

const T: Record<Locale, { prazo: string; amado: (n: string) => string }> = {
  pt: {
    prazo: "Entregue com amor em minutos",
    amado: (n) => `${n} famílias`,
  },
  es: {
    prazo: "Entregado con amor en minutos",
    amado: (n) => `${n} familias`,
  },
};

export function ProvaSocial({
  locale = "pt",
  centralizado = false,
  compacto = false,
}: {
  locale?: Locale;
  /**
   * Centra em TODA largura. Na home o bloco acompanha o herói, que vira duas
   * colunas no desktop e por isso encosta à esquerda; no quiz a coluna é uma
   * só e centrada, e o `lg:items-start` deixaria o bloco torto.
   *
   * Default `false` pra home não mudar nada.
   */
  centralizado?: boolean;
  /**
   * Duas fileiras em vez de quatro: estrelas ao lado do prazo, rostos ao lado
   * do "amado por".
   *
   * Na home o bloco empilhado cabe — ele fica num herói que ocupa a tela
   * inteira. Na abertura do quiz ele vem DEPOIS do botão, e quatro fileiras
   * empurram a única coisa que ainda podia ser lida pra ainda mais longe.
   * Emparelhado, o mesmo conteúdo ocupa pouco mais da metade da altura.
   *
   * Os rostos encolhem de 40 pra 32px só aqui: emparelhados com o texto, os
   * 40 estouram a linha num celular de 375px.
   *
   * Default `false` pra home não mudar nada.
   */
  compacto?: boolean;
}) {
  const t = T[locale] ?? T.pt;

  const estrelas = (
    <div className="flex gap-0.5" aria-label="cinco estrelas">
      {[0, 1, 2, 3, 4].map((i) => (
        <Star
          key={i}
          className={compacto ? "h-4 w-4 text-[var(--ouro)]" : "h-5 w-5 text-[var(--ouro)]"}
          fill="currentColor"
          strokeWidth={0}
          aria-hidden
        />
      ))}
    </div>
  );

  const prazo = (
    <p className="italic text-[var(--tinta-suave)]" style={{ fontSize: "var(--t-sm)" }}>
      {t.prazo}
    </p>
  );

  const rostos = (
    <div className="flex items-center gap-2">
      {/* `-space-x-3` é o que faz um rosto montar no outro. A borda cor de
          papel separa um do outro sem precisar de sombra. */}
      <div className={compacto ? "flex -space-x-2" : "flex -space-x-3"}>
        {ROSTOS.map((n) => (
          <img
            key={n}
            src={`/img/rostos/rosto${n}.jpg`}
            alt=""
            width={40}
            height={40}
            // `eager`, e não lazy: são 2,4 KB cada, logo abaixo do CTA
            // principal. Adiar prova social que fica na primeira tela é
            // trocar bytes por confiança na hora exata em que a pessoa
            // decide se rola ou fecha. `fetchPriority=low` mantém o vídeo e
            // a fonte na frente na fila.
            loading="eager"
            fetchPriority="low"
            decoding="async"
            className={
              compacto
                ? "h-8 w-8 rounded-full border-2 border-[var(--papel)] object-cover"
                : "h-10 w-10 rounded-full border-2 border-[var(--papel)] object-cover"
            }
          />
        ))}
        <span
          className={
            compacto
              ? "grid h-8 w-8 place-items-center rounded-full border-2 border-[var(--papel)] bg-[var(--acento)] text-[10px] font-semibold text-white"
              : "grid h-10 w-10 place-items-center rounded-full border-2 border-[var(--papel)] bg-[var(--acento)] font-semibold text-white"
          }
          style={compacto ? undefined : { fontSize: "var(--t-xs)" }}
        >
          {CONTADOR}
        </span>
      </div>
    </div>
  );

  const amado = (
    <p className="text-[var(--tinta-suave)]" style={{ fontSize: "var(--t-sm)" }}>
      {/* "Amado por" é igual nos dois idiomas; só o substantivo muda. */}
      Amado por <strong className="text-[var(--tinta)]">{t.amado(FAMILIAS)}</strong>
    </p>
  );

  if (compacto) {
    return (
      <div className="mt-8 flex flex-col items-center gap-3">
        <div className="flex items-center gap-2">
          {estrelas}
          {prazo}
        </div>
        <div className="flex items-center gap-2.5">
          {rostos}
          {amado}
        </div>
      </div>
    );
  }

  return (
    <div
      className={
        centralizado
          ? "mt-8 flex flex-col items-center gap-3"
          : "mt-8 flex flex-col items-center gap-3 lg:items-start"
      }
    >
      {prazo}
      {estrelas}
      {rostos}
      {amado}
    </div>
  );
}
