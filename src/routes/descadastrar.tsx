import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { TEMA_CLARO, MARCA } from "@/lib/marca";
import { Logo } from "@/components/marca/Logo";
import { normalizarLocale } from "@/lib/i18n";
import { Check, Loader2 } from "lucide-react";

// DESCADASTRO em um clique.
//
// Existe antes do primeiro disparo, não depois: Gmail e Yahoo exigem
// descadastro fácil de quem manda em volume, e um link que não funciona é o
// caminho mais curto pro botão de "marcar como spam" — que derruba o domínio
// inteiro, inclusive o e-mail de ENTREGA de quem pagou.
//
// A chave é o `session_id`, não o e-mail em claro. Dois motivos: e-mail na
// URL vaza no histórico e nos logs de referrer, e um endereço adivinhável
// deixaria qualquer um descadastrar qualquer pessoa. O session_id é um UUID
// que só quem recebeu o e-mail tem.

const sair = createServerFn({ method: "POST" })
  .validator((data: { sessao: string }) => data)
  .handler(async ({ data }): Promise<{ ok: boolean; email: string | null }> => {
    const db = supabaseAdmin();
    const { data: lead } = await db
      .from("quiz_responses")
      .select("email, locale")
      .eq("session_id", data.sessao)
      .maybeSingle();
    if (!lead?.email) return { ok: false, email: null };

    await db.from("descadastros").upsert(
      { email: lead.email, motivo: "link no e-mail" },
      { onConflict: "email" },
    );
    return { ok: true, email: lead.email };
  });

const COPY = {
  pt: {
    titulo: "Pronto, você saiu da lista.",
    corpo: "Não mandamos mais e-mail de recuperação pra este endereço.",
    ressalva:
      "Se você comprar uma música, o e-mail com a entrega continua chegando — aquele não é divulgação, é o seu pedido.",
    erro: "Não encontrei este link.",
    erroCorpo: "Ele pode ter sido copiado pela metade. Responda o e-mail que a gente tira você da lista na mão.",
    saindo: "saindo da lista…",
  },
  es: {
    titulo: "Listo, saliste de la lista.",
    corpo: "No te mandamos más correos de recuperación a esta dirección.",
    ressalva:
      "Si compras una canción, el correo con la entrega sigue llegando — ese no es publicidad, es tu pedido.",
    erro: "No encontré este link.",
    erroCorpo: "Puede que se haya copiado a la mitad. Responde el correo y te sacamos de la lista a mano.",
    saindo: "saliendo de la lista…",
  },
} as const;

export const Route = createFileRoute("/descadastrar")({
  validateSearch: (b: Record<string, unknown>) => ({
    s: typeof b.s === "string" ? b.s : undefined,
    lang: typeof b.lang === "string" ? b.lang : undefined,
  }),
  head: () => ({
    meta: [
      { title: `Descadastrar · ${MARCA.nome}` },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Descadastrar,
});

function Descadastrar() {
  const { s, lang } = Route.useSearch();
  const C = COPY[normalizarLocale(lang)] ?? COPY.pt;
  const [estado, setEstado] = useState<"indo" | "ok" | "erro">("indo");

  // Um clique só: nada de tela de confirmação. Quem clicou já decidiu, e
  // pedir "tem certeza?" é o tipo de atrito que faz a pessoa desistir e
  // marcar como spam — que é muito pior pra gente.
  useEffect(() => {
    if (!s) { setEstado("erro"); return; }
    sair({ data: { sessao: s } })
      .then((r) => setEstado(r.ok ? "ok" : "erro"))
      .catch(() => setEstado("erro"));
  }, [s]);

  return (
    <div
      className="grid min-h-screen place-items-center bg-[var(--papel)] px-6 text-center text-[var(--tinta)]"
      style={TEMA_CLARO}
    >
      <main className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo tamanho="md" />
        </div>

        {estado === "indo" && (
          <p className="flex items-center justify-center gap-2 text-[var(--tinta-suave)]" style={{ fontSize: "var(--t-sm)" }}>
            <Loader2 className="h-4 w-4 animate-spin" /> {C.saindo}
          </p>
        )}

        {estado === "ok" && (
          <>
            <div className="mx-auto mb-5 grid h-12 w-12 place-items-center rounded-full bg-[var(--acento)]/10 text-[var(--acento)]">
              <Check className="h-5 w-5" />
            </div>
            <p style={{ fontSize: "var(--t-xl)" }}>{C.titulo}</p>
            <p className="mt-3 text-[var(--tinta-suave)]" style={{ fontSize: "var(--t-sm)", lineHeight: 1.6 }}>
              {C.corpo}
            </p>
            <p className="mt-4 text-[var(--tinta-fraca)]" style={{ fontSize: "var(--t-xs)", lineHeight: 1.6 }}>
              {C.ressalva}
            </p>
          </>
        )}

        {estado === "erro" && (
          <>
            <p style={{ fontSize: "var(--t-xl)" }}>{C.erro}</p>
            <p className="mt-3 text-[var(--tinta-suave)]" style={{ fontSize: "var(--t-sm)", lineHeight: 1.6 }}>
              {C.erroCorpo}
            </p>
          </>
        )}
      </main>
    </div>
  );
}
