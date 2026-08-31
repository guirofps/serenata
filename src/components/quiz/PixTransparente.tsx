import { useState } from "react";
import { criarPix, type ResultadoPix } from "@/lib/criar-pix";
import { varianteDe } from "@/lib/experimentos";

// Mesmo formato do resumo: "R$ 38" quando e redondo, "R$ 62,90" quando nao e.
const reais = (v: number) =>
  `R$ ${v.toFixed(2).replace(".", ",").replace(/,00$/, "")}`;
import { getOrCreateSessionId } from "@/lib/session-context";
import { trackEvent } from "@/lib/track";
import { PixPagamento } from "@/components/quiz/PixPagamento";
import { ResumoDoPedido } from "@/components/quiz/ResumoDoPedido";
import { Button } from "@/components/ui/button";

// O CHECKOUT DE PIX NA NOSSA PRÓPRIA PÁGINA.
//
// Dois passos, e o primeiro foi acrescentado depois de a coisa estar no ar:
//
//   1. RESUMO  — o que é, quanto custa, pra onde vai, garantia
//   2. QR      — o pagamento em si (`PixPagamento`, compartilhado com /pix)
//
// ── POR QUE O RESUMO ENTROU ──────────────────────────────────────
//
// A primeira versão ia do botão direto pro QR, e isso estava errado de dois
// jeitos que só ficaram visíveis com o painel do gateway aberto:
//
//   - CREDIBILIDADE. Um QR sozinho não diz o que está sendo comprado. O
//     checkout hospedado dizia tudo isso de graça, porque tinha uma página
//     inteira pra isso; ao trazer o pagamento pra cá eu trouxe o QR e deixei
//     a página pra trás.
//
//   - COBRANÇA NASCIDA DE UM TOQUE. Em 28 minutos nasceram 11 cobranças na
//     Woovi, quase todas de quem só foi ver o preço. Não custa dinheiro, mas
//     destrói a comparação: na Perfect Pay o PIX só nascia DEPOIS do
//     formulário do gateway, então "PIX gerado" lá e aqui não eram a mesma
//     coisa, e o número novo parecia catastrófico sem ser.
//
// ── O QUE EXISTE PRA CONSERTAR ───────────────────────────────────
//
// 70% de quem clica em comprar não gera pedido nenhum, uns 250 por dia.
// Parte disso é a troca de domínio: a pessoa sai de serenatagift.com, cai num
// checkout de outra marca, e desiste. Aqui ela não sai.
//
// E a taxa cai de 11,39% (R$ 4,63 de média, medido) pra R$ 0,50 — uns
// R$ 5.500 por mês que não dependem de a conversão melhorar um ponto.

type Fase =
  | { t: "resumo" }
  | { t: "gerando" }
  | { t: "pronto"; dados: Extract<ResultadoPix, { ok: true }> }
  | { t: "erro" };

export function PixTransparente({
  nome,
  titulo,
  valorTexto,
  valorBase,
  ancora,
  email,
  aoDesistir,
}: {
  nome: string;
  titulo: string | null;
  /** O preço como a pessoa viu na oferta. Quem manda de verdade é o servidor. */
  valorTexto: string;
  /** O mesmo preço em reais, pra somar o quadro e mostrar o total. */
  valorBase: number;
  ancora?: string;
  email: string;
  /** Vai pro checkout hospedado: é por onde sai o cartão. */
  aoDesistir: () => void;
}) {
  const [fase, setFase] = useState<Fase>({ t: "resumo" });

  // ── O ORDER BUMP DO QUADRO ───────────────────────────────────────
  //
  // Atrás de experimento, e não solto: esta é a folha por onde passam ~87%
  // das vendas, e uma decisão a mais antes do botão de pagar mexe na
  // conversão principal. Com experimento dá pra desligar pelo `ativo` no
  // painel sem deploy, que é o mesmo interruptor do `checkout_pix`.
  //
  // A ESCOLHA É FEITA AQUI, ANTES DE GERAR, e não dá pra mudar depois. Não é
  // preferência de desenho: a referência do PIX carrega o bump (`:q`), a
  // Woovi recusa reaproveitar um correlationID com outro valor, e deixar
  // marcar e desmarcar depois criaria duas cobranças vivas do mesmo quiz.
  const bumpLigado = varianteDe("bump_quadro") === "B";
  const [quadro, setQuadro] = useState(false);

  async function gerar(emailFinal: string) {
    setFase({ t: "gerando" });
    try {
      const r = await criarPix({
        // Vai um SIM OU NÃO, nunca um valor: quanto o quadro custa é o
        // catálogo do servidor que decide.
        data: { sessionId: getOrCreateSessionId(), email: emailFinal, quadro },
      });
      if (!r.ok) {
        trackEvent("pix_transparente_falhou", { erro: r.erro });
        setFase({ t: "erro" });
        return;
      }
      trackEvent("pix_transparente_gerado", { valor: r.valorCentavos, quadro });
      setFase({ t: "pronto", dados: r });
    } catch (err) {
      console.error("[pix] criar falhou:", err);
      trackEvent("pix_transparente_falhou", { erro: "excecao" });
      setFase({ t: "erro" });
    }
  }

  if (fase.t === "erro") {
    // NUNCA deixa a pessoa sem caminho. Ela quer pagar; se o nosso PIX
    // falhou, o checkout de sempre continua ali.
    return (
      <div className="space-y-3 rounded-2xl border border-amber-500/30 bg-amber-50 px-4 py-4 text-left">
        <p className="text-sm font-semibold text-amber-900">
          Não consegui gerar o PIX agora
        </p>
        <p className="text-xs leading-snug text-amber-800/80">
          Nada foi cobrado. Dá pra concluir pelo nosso checkout normal, que aceita
          PIX e cartão.
        </p>
        <Button size="lg" className="w-full" onClick={aoDesistir}>
          Continuar pelo checkout
        </Button>
      </div>
    );
  }

  if (fase.t === "pronto") {
    return (
      <PixPagamento
        copiaECola={fase.dados.copiaECola}
        // O VALOR AQUI SAI DA COBRANCA, NAO DA OFERTA.
        //
        // `valorTexto` e o preco do braco ("R$ 38"), e com o quadro marcado a
        // cobranca e de R$ 62,90. A tela do QR mostrava 38 em cima de um
        // codigo que cobra 62,90 — a pessoa le um numero, o banco mostra
        // outro, e isso vira reclamacao mesmo tendo ela mesma marcado a
        // caixinha. Pego no primeiro PIX real do bump.
        //
        // `dados.valorCentavos` e o que o SERVIDOR compos e mandou pro
        // gateway: e a unica fonte que nao pode divergir do codigo na tela.
        valorTexto={reais(fase.dados.valorCentavos / 100)}
        referencia={fase.dados.referencia}
        // A tela de obrigado é a mesma de quem pagou pelo checkout antigo: um
        // só lugar decide o que acontece depois da compra.
        aoPagar={() => {
          window.location.href = "/obrigado";
        }}
        aoEscolherCartao={aoDesistir}
      />
    );
  }

  return (
    <ResumoDoPedido
      nome={nome}
      titulo={titulo}
      precoTexto={valorTexto}
      precoBase={valorBase}
      ancora={ancora}
      email={email}
      gerando={fase.t === "gerando"}
      quadro={bumpLigado ? quadro : null}
      aoTrocarQuadro={(v) => {
        setQuadro(v);
        trackEvent("bump_quadro_marcou", { marcado: v });
      }}
      aoConfirmar={gerar}
      aoEscolherCartao={aoDesistir}
    />
  );
}
