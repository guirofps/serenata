import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { conversaoCompra } from "@/lib/google-ads";
import { buscarPresenteDaCompra, type PresenteDaCompra } from "@/lib/pos-compra";
import { TEMA_CLARO, FONTES, MARCA } from "@/lib/marca";
import { Logo } from "@/components/marca/Logo";
import { Check, Mail, Inbox, Pencil, Loader2 } from "lucide-react";

// Página de PÓS-COMPRA — o destino do redirect do checkout (Cakto/Perfect Pay).
//
// Ela existe por um motivo bem prático: o e-mail com o link (montar o presente)
// pode cair em Promoções/Spam num domínio novo. Se a pessoa não souber disso,
// paga e acha que não recebeu nada. Aqui a gente AVISA, na hora, com a compra
// fresca na cabeça.
//
// Sem gateway acoplado: é uma página informativa. Se o checkout mandar `?email=`
// no redirect, personaliza; se não mandar, funciona igual.

export const Route = createFileRoute("/obrigado")({
  // `code`: a Perfect Pay costuma devolver o id da venda no redirect. Serve de
  // transaction_id da conversão, o que impede um F5 aqui contar a venda 2x.
  validateSearch: z.object({ email: z.string().optional(), code: z.string().optional() }),
  head: () => ({
    meta: [
      { title: `Compra confirmada · ${MARCA.nome}` },
      // Página de conversão: fora do índice dos buscadores.
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Obrigado,
});

function Obrigado() {
  const { email, code } = Route.useSearch();
  const [presente, setPresente] = useState<PresenteDaCompra | null>(null);
  const [procurando, setProcurando] = useState(Boolean(code));

  // Conversão do Google Ads: é aqui que o algoritmo aprende quem comprou.
  useEffect(() => {
    conversaoCompra({ valor: 37, transactionId: code });
  }, [code]);

  // Busca o presente pelo código da transação, pra dar o botão AQUI em vez de
  // mandar a pessoa caçar e-mail. Faz polling porque o redirect pode chegar
  // antes do webhook: a pessoa é devolvida pelo gateway em milissegundos e o
  // pedido pode levar alguns segundos pra existir.
  useEffect(() => {
    if (!code) return;
    let vivo = true;
    let tentativas = 0;

    async function procurar() {
      if (!vivo) return;
      try {
        const p = await buscarPresenteDaCompra({ data: { code: code! } });
        if (!vivo) return;
        if (p) {
          setPresente(p);
          setProcurando(false);
          return;
        }
      } catch (err) {
        console.error("[obrigado] busca falhou:", err);
      }
      tentativas += 1;
      // ~90s. Passou disso, o e-mail assume (e ele já foi enviado).
      if (tentativas >= 30) {
        setProcurando(false);
        return;
      }
      setTimeout(procurar, 3000);
    }

    procurar();
    return () => {
      vivo = false;
    };
  }, [code]);

  return (
    <div
      className="grid min-h-screen place-items-center bg-[var(--papel)] px-6 py-12 text-[var(--tinta)]"
      style={TEMA_CLARO}
    >
      <main className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo tamanho="md" />
        </div>

        <div className="text-center">
          <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-full bg-[var(--acento)]/10 text-[var(--acento)]">
            <Check className="h-6 w-6" />
          </div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-[var(--tinta-suave)]">
            pagamento confirmado
          </p>
          <h1
            className="mt-3 text-balance"
            style={{ fontFamily: FONTES.display, fontWeight: 500, fontSize: "var(--t-2xl)", lineHeight: 1.2 }}
          >
            Deu tudo certo. Sua música é sua.
          </h1>
          <p
            className="mx-auto mt-4 max-w-sm text-[var(--tinta-suave)]"
            style={{ fontSize: "var(--t-base)", lineHeight: 1.6 }}
          >
            {presente ? (
              <>Falta um passo, e ele é aqui embaixo mesmo.</>
            ) : (
              <>
                Enviamos{" "}
                {email ? <>para <strong className="text-[var(--tinta)]">{email}</strong></> : "para o seu e-mail"}{" "}
                o link pra montar o presente. Ele chega em instantes.
              </>
            )}
          </p>
        </div>

        {/* O CAMINHO CURTO: o botão que leva direto ao editor, sem passar por
            e-mail nenhum. É o momento de maior intenção que existe, e até
            03/08 a gente o gastava mandando a pessoa procurar na caixa de
            entrada — com 3 de 6 compradores nunca montando o presente. */}
        {procurando && (
          <div className="mt-8 flex items-center justify-center gap-3 rounded-[var(--raio-lg)] border border-[var(--tinta-fraca)]/50 bg-[var(--papel-fundo)] px-5 py-6 text-[var(--tinta-suave)]">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span style={{ fontSize: "var(--t-sm)" }}>Preparando o seu presente…</span>
          </div>
        )}

        {presente && (
          <div className="mt-8 rounded-[var(--raio-lg)] border-2 border-[var(--acento)]/30 bg-[var(--acento)]/5 p-6 text-center">
            <p className="text-[11px] uppercase tracking-[0.25em] text-[var(--acento)]">
              o próximo passo
            </p>
            <p
              className="mt-2"
              style={{ fontFamily: FONTES.display, fontSize: "var(--t-xl)", lineHeight: 1.25 }}
            >
              Monte o presente {presente.nome ? `de ${presente.nome}` : ""}
            </p>
            <p
              className="mx-auto mt-2 max-w-xs text-[var(--tinta-suave)]"
              style={{ fontSize: "var(--t-sm)", lineHeight: 1.6 }}
            >
              Escolha a gravação, ponha as fotos de vocês e uma frase sua. Leva
              dois minutos.
            </p>
            <a
              href={`/editar/${presente.tokenEdicao}`}
              className="cta mt-5 inline-flex items-center gap-2 rounded-full px-8 py-4 font-medium"
              style={{ fontSize: "var(--t-base)" }}
            >
              <Pencil className="h-4 w-4" /> Montar o presente
            </a>
            {presente.gerando && (
              <p className="mt-3 text-[var(--tinta-suave)]" style={{ fontSize: "var(--t-xs)" }}>
                A gravação ainda está saindo do forno. Pode ir montando: ela
                aparece sozinha quando ficar pronta.
              </p>
            )}
          </div>
        )}

        {/* Com o botão na tela, o caça-ao-e-mail vira ruído: os três passos
            começavam com "abra o e-mail", que passa a contradizer o caminho
            curto. Vira uma linha de rodapé. */}
        {presente ? (
          <p
            className="mt-6 text-center text-[var(--tinta-suave)]"
            style={{ fontSize: "var(--t-sm)", lineHeight: 1.6 }}
          >
            Também mandamos esse link{" "}
            {email ? <>para <strong className="text-[var(--tinta)]">{email}</strong></> : "pro seu e-mail"},
            pra você não perder. Se não achar, olhe em Promoções e no Spam.
          </p>
        ) : (
        <>
        {/* O AVISO que justifica a página: olhar o spam. Em destaque, porque é
            o ponto onde a pessoa mais se perde num remetente novo. */}
        <div className="mt-8 rounded-[var(--raio-lg)] border border-[var(--acento)]/25 bg-[var(--acento)]/5 p-5">
          <div className="flex gap-3">
            <Inbox className="mt-0.5 h-5 w-5 shrink-0 text-[var(--acento)]" />
            <div>
              <p className="font-medium" style={{ fontSize: "var(--t-sm)" }}>
                Não achou o e-mail em 1 minuto?
              </p>
              <p
                className="mt-1 text-[var(--tinta-suave)]"
                style={{ fontSize: "var(--t-sm)", lineHeight: 1.6 }}
              >
                Olhe na aba <strong className="text-[var(--tinta)]">Promoções</strong> e no{" "}
                <strong className="text-[var(--tinta)]">Spam</strong>. Se estiver lá, marque como
                "não é spam" e mova pra Caixa de entrada. Assim os próximos chegam direto.
              </p>
            </div>
          </div>
        </div>

        {/* Os 3 passos, pra não deixar dúvida do que fazer com o e-mail. */}
        <ol className="mt-8 space-y-4">
          {[
            { icon: Mail, txt: "Abra o e-mail da Serenata (confira o spam também)." },
            { icon: Pencil, txt: "Clique no link e monte o presente: uma foto e uma frase sua." },
            { icon: Check, txt: "Copie o link pronto e mande pra quem você ama." },
          ].map((p, i) => (
            <li key={i} className="flex items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[var(--tinta-fraca)] text-[var(--acento)]">
                <p.icon className="h-4 w-4" />
              </span>
              <span style={{ fontSize: "var(--t-sm)", lineHeight: 1.5 }}>{p.txt}</span>
            </li>
          ))}
        </ol>
        </>
        )}

        <p
          className="mt-8 text-center text-[var(--tinta-suave)]"
          style={{ fontSize: "var(--t-xs)", lineHeight: 1.6 }}
        >
          {presente
            ? "Sem pressa: o link acima também está no seu e-mail e não expira. "
            : "Pode fechar esta página, o e-mail chega sozinho. "}
          Qualquer coisa, é só responder o e-mail ou falar com a gente em{" "}
          <a href="mailto:contato@serenatagift.com" className="text-[var(--acento)] underline underline-offset-2">
            contato@serenatagift.com
          </a>
          .
        </p>
      </main>
    </div>
  );
}
