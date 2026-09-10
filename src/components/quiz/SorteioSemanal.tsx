// O SORTEIO DA SEMANA, NO PASSO DO E-MAIL.
//
// ── O QUE A COPY PODE E NÃO PODE DIZER ───────────────────────────
//
// Nesta tela a pessoa ainda NÃO comprou: ela está entregando o e-mail pra
// receber a letra, que é de graça. E o número do sorteio vem da COMPRA, não do
// e-mail (decisão do dono, 10/09).
//
// Então escrever "deixe seu e-mail e concorra" seria falso. Num sorteio isso
// não é só perda de confiança — é a parte regulada: promessa de prêmio que não
// corresponde à mecânica é propaganda enganosa. A frase tem que ligar o número
// à música comprada, e é por isso que ela está escrita do jeito que está.
//
// ── O QUE FALTA, E É JURÍDICO ────────────────────────────────────
//
// Distribuição de prêmio mediante sorteio no Brasil exige AUTORIZAÇÃO PRÉVIA
// da SPA/MF, e a modalidade escolhida aqui (número atrelado à compra) é a mais
// regulada das que existem — foi avisado e a decisão foi mantida.
//
// Enquanto não houver certificado, `REGULAMENTO` fica vazio e o link não
// aparece. Isso NÃO torna a promoção regular; só evita que a página aponte pra
// uma página de regras que não existe. Ligar o bloco sem regulamento é decisão
// de negócio, não descuido de código.
const REGULAMENTO = "";

/**
 * A foto do prêmio.
 *
 * Se o arquivo não estiver lá, a imagem se esconde sozinha e sobra o texto,
 * que já se sustenta. Ícone quebrado numa tela de conversão custa mais que
 * bloco sem foto — e um `onError` é mais barato que descobrir isso em produção.
 */
const FOTO = "/img/jbl-boombox-4.webp";

export function SorteioSemanal() {
  return (
    <div className="mx-auto flex max-w-md items-center gap-4 rounded-2xl border border-border/60 px-4 py-3 text-left">
      {/* `width`/`height` batem com o `h-16 w-16` do CSS (64px). Eles reservam
          o espaço antes de a imagem carregar, pra o bloco não pular quando ela
          chega — divergir do tamanho real só confunde quem lê depois. */}
      <img
        src={FOTO}
        alt="JBL Boombox 4"
        width={64}
        height={64}
        loading="lazy"
        onError={(e) => {
          e.currentTarget.hidden = true;
        }}
        className="h-16 w-16 shrink-0 object-contain"
      />
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
          toda semana
        </p>
        <p className="mt-1 text-sm font-medium leading-snug text-foreground">
          Sorteamos uma JBL Boombox 4
        </p>
        {/* "comprada" e não "criada": a letra é de graça e não vale número.
            Ver o bloco de comentário no topo deste arquivo. */}
        <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
          Cada música comprada na semana é um número.
          {REGULAMENTO && (
            <>
              {" "}
              <a href={REGULAMENTO} className="underline underline-offset-2 hover:text-foreground">
                Ver o regulamento
              </a>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
