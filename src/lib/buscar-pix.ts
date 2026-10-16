import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/lib/supabase-admin";

// A LEITURA DE UM PIX PENDENTE PELA REFERÊNCIA.
//
// Morava dentro de `routes/pix.$referencia.tsx` (ver o cabeçalho de lá: o
// e-mail de PIX abandonado e quem volta pra aba fechada). Saiu pra cá em
// 16/10 porque a oferta passou a precisar da mesma leitura (teste
// `pix_reabre`, `pix-reabre.ts`): quem vai no app do banco e o iPhone
// recarrega a aba volta pra oferta sem o QR. Uma cópia só, pelo motivo de
// sempre: a segunda diverge no primeiro conserto.
//
// ── NÃO CRIA NADA ────────────────────────────────────────────────
//
// Só LÊ um pedido pendente que já existe. Uma rota pública que cria cobrança
// seria um jeito de qualquer um encher a conta do gateway de PIX morto.
//
// Devolve o mínimo (código, valor e título) e nunca e-mail, nome ou a letra.
// A SESSÃO só sai de pedido do funil ainda NÃO pago (ver o cabeçalho da rota).

export type DadosPix =
  | {
      ok: true;
      copiaECola: string;
      valorTexto: string;
      /**
       * O mesmo valor em centavos (16/10), pra quem reabre o QR dentro do
       * funil mostrar o número da COBRANÇA, não o da oferta.
       */
      valorCentavos: number;
      titulo: string | null;
      /** Upsell do painel (crédito, quadro) em vez da música do funil. */
      upsell: boolean;
      /** Só pedido do funil não pago. Ver o cabeçalho. */
      sessao: string | null;
      /** O cupom que baixou o preço desse pedido, pra o funil mostrar o mesmo valor. */
      cupom: string | null;
    }
  | {
      ok: false;
      motivo: "nao-achei" | "ja-pago" | "vencido";
      upsell: boolean;
      sessao: string | null;
      cupom: string | null;
    };

export const buscarPix = createServerFn({ method: "POST" })
  .validator((data: { referencia: string }) => data)
  .handler(async ({ data }): Promise<DadosPix> => {
    // `up:<oferta>:<uuid>` é upsell do painel; `serenata:<quizId>` é o funil.
    // Muda o texto e muda pra onde o botão de saída leva: mandar quem estava
    // comprando um quadro pro início do quiz seria fazê-la refazer uma música
    // que ela já tem.
    const upsell = data.referencia.startsWith("up:");
    const vazio = { sessao: null, cupom: null };

    const { data: p } = await supabaseAdmin()
      .from("pedidos")
      .select("status, pix_codigo, pix_expira, valor_centavos, musica_id, quiz_response_id, cupom")
      // Asaas também (auditoria 30/09): desde 11/09 o link do e-mail de PIX
      // não pago é `/pix/pay_...` do Asaas, e a busca só por `woovi:` dava
      // "Não achei esse PIX" pra todo mundo.
      .in("payment_id", [`woovi:${data.referencia}`, `asaas:${data.referencia}`])
      .limit(1)
      .maybeSingle();

    if (!p) return { ok: false, motivo: "nao-achei", upsell, ...vazio };
    // Pago: sem sessão, de propósito (ver o cabeçalho). A saída é `/obrigado`.
    if (p.status === "pago") return { ok: false, motivo: "ja-pago", upsell, ...vazio };

    // A SESSÃO DO QUIZ, pros botões de saída (08/10). Upsell não precisa: a
    // saída dele é o painel, e quem compra upsell já tem conta.
    let sessao: string | null = null;
    if (!upsell && p.quiz_response_id) {
      const { data: q } = await supabaseAdmin()
        .from("quiz_responses")
        .select("session_id")
        .eq("id", p.quiz_response_id)
        .maybeSingle();
      sessao = (q?.session_id as string | null) ?? null;
    }
    const volta = { sessao, cupom: (p.cupom as string | null) ?? null };

    if (!p.pix_codigo) return { ok: false, motivo: "nao-achei", upsell, ...volta };
    // O código da Woovi vale 1 hora. Passou disso, o QR não paga mais nada e
    // mostrar ele seria pior que não mostrar: a pessoa tentaria, o banco
    // recusaria, e ela concluiria que o problema é a nossa loja.
    if (p.pix_expira && Date.parse(p.pix_expira as string) < Date.now()) {
      return { ok: false, motivo: "vencido", upsell, ...volta };
    }

    let titulo: string | null = null;
    if (p.musica_id) {
      const { data: m } = await supabaseAdmin()
        .from("musicas")
        .select("titulo")
        .eq("id", p.musica_id)
        .maybeSingle();
      titulo = (m?.titulo as string | null) ?? null;
    }

    const centavos = (p.valor_centavos as number | null) ?? 0;
    return {
      ok: true,
      copiaECola: p.pix_codigo as string,
      valorTexto: `R$ ${(centavos / 100).toFixed(2).replace(".", ",").replace(",00", "")}`,
      valorCentavos: centavos,
      titulo,
      upsell,
      ...volta,
    };
  });
