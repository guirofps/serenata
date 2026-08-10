import { type Locale } from "@/lib/i18n";

// VARIANTE B DA PRIMEIRA TELA — a prova antes da primeira pergunta.
//
// O que o dado disse (09/08, medição própria do toque no chip):
//
//   195 viram a pergunta 1
//    41 tocaram em algum chip ........... 21%
//     6 tocaram e não avançaram ......... atrito de botão, quase nada
//   154 não tocaram em NADA ............. o resto inteiro
//
// E 63% das sessões que viram a pergunta 1 não geraram mais nenhum evento:
// chegaram e saíram. Nos passos seguintes o mesmo evento mostra 89% a 93% de
// toque, o que prova que a medição funciona e que o buraco é só aqui.
//
// Ou seja: não é o botão, não é a lista de opções, não é atrito. A pessoa cai
// do anúncio direto numa pergunta e vai embora antes de responder qualquer
// coisa. Falta o motivo pra responder.
//
// A prova mais forte do projeto é o vídeo de reações REAIS, e hoje ele está no
// passo 4 — atrás da parede. Quem desiste nunca chega a vê-lo. B move a prova
// pra antes do pedido, junto de uma frase que responde "quanto custa" e "e se
// eu não gostar" sem que a pessoa tenha que perguntar.
//
// Curto de propósito: a tela do celular já foi ajustada pra caber pergunta,
// opções e botão, e um bloco alto aqui joga tudo isso pra baixo de novo.

// A promessa é A LETRA **E UM TRECHO CANTADO**, não só a letra.
//
// A primeira versão desta frase dizia só "a letra fica pronta". Estava
// vendendo menos do que o funil entrega: a pessoa lê a letra na hora e ouve
// um pedaço da música cantada logo depois, tudo antes de pagar. Numa tela
// cuja função é dar motivo pra responder a primeira pergunta, prometer menos
// que a verdade é o pior erro possível.
//
// A redação segue a que já roda na barra das duas homes ("A letra e um trecho
// da música, grátis"), de propósito: a pessoa que veio da home encontra a
// mesma frase, e a que veio direto do anúncio recebe a promessa completa.
const COPY: Record<Locale, { olho: string; frase: string }> = {
  pt: {
    olho: "reações reais de quem ouviu",
    frase: "A letra e um trecho da música, de graça. Você lê e ouve antes de decidir qualquer coisa.",
  },
  es: {
    olho: "reacciones reales de quien la escuchó",
    frase: "La letra y un pedazo de la canción, gratis. Los lees y escuchas antes de decidir nada.",
  },
};

export function AberturaProva({ locale = "pt" }: { locale?: Locale }) {
  const C = COPY[locale] ?? COPY.pt;
  return (
    <div className="mb-5 space-y-2">
      <p className="text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
        {C.olho}
      </p>
      {/* Mudo, sem controles e em loop, igual ao passo 4: emociona sem virar
          um player que rouba a atenção de quem veio responder. `preload` em
          metadata porque isto agora está na PRIMEIRA tela de toda visita, e
          baixar o vídeo inteiro antes do primeiro pixel seria trocar um
          problema de conversão por um de velocidade. */}
      <div className="overflow-hidden rounded-2xl">
        <video
          src="/video/reacoes.mp4"
          poster="/video/reacoes-poster.jpg"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          className="block max-h-[26vh] w-full object-cover"
        />
      </div>
      <p className="text-center text-xs leading-snug text-muted-foreground">
        {C.frase}
      </p>
    </div>
  );
}
