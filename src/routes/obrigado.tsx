import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { TEMA_CLARO, FONTES, MARCA } from "@/lib/marca";
import { Logo } from "@/components/marca/Logo";
import { Check, Mail, Inbox, Pencil } from "lucide-react";

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
  validateSearch: z.object({ email: z.string().optional() }),
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
  const { email } = Route.useSearch();

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
            Enviamos {email ? <>para <strong className="text-[var(--tinta)]">{email}</strong></> : "para o seu e-mail"}{" "}
            o link pra montar o presente. Ele chega em instantes.
          </p>
        </div>

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

        <p
          className="mt-8 text-center text-[var(--tinta-suave)]"
          style={{ fontSize: "var(--t-xs)", lineHeight: 1.6 }}
        >
          Pode fechar esta página, o e-mail chega sozinho. Qualquer coisa, é só
          responder o e-mail ou falar com a gente em{" "}
          <a href="mailto:contato@serenatagift.com" className="text-[var(--acento)] underline underline-offset-2">
            contato@serenatagift.com
          </a>
          .
        </p>
      </main>
    </div>
  );
}
