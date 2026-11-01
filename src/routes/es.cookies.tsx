import { createFileRoute } from "@tanstack/react-router";
import { Logo } from "@/components/marca/Logo";
import { esquecerCookies } from "@/lib/consentimento-cookies";
import { MARCA, TEMA_CLARO } from "@/lib/marca";

// Política de cookies em espanhol, de quem vê o aviso (`AvisoCookies.tsx`).
//
// Este texto descreve o que o site faz, como o resto dos documentos legais: se
// entrar outro pixel ou cookie, ESTE ARQUIVO MUDA JUNTO. Fica fora do `Documento`
// porque, na Ballad, a moldura dele é em inglês.
export const Route = createFileRoute("/es/cookies")({
  component: Pagina,
  head: () => ({
    meta: [
      { title: `Política de cookies · ${MARCA.nome}` },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function Pagina() {
  return (
    <div style={TEMA_CLARO} lang="es-ES" className="min-h-dvh bg-background">
      <div className="mx-auto w-full max-w-2xl px-6 py-10">
        <a href="/es" className="inline-block">
          <Logo tamanho="sm" />
        </a>
        <h1 className="mt-8 font-display text-3xl font-semibold leading-tight">Política de cookies</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">Última actualización: 1 de noviembre de 2026</p>

        <div className="mt-8 space-y-6 text-[15px] leading-relaxed">
          <section className="space-y-3">
            <h2 className="font-display text-lg font-semibold">Las que solo se usan si aceptas</h2>
            <p>
              <strong>Google (Google Ads y Analytics).</strong> Nos dicen qué anuncios traen a las personas que
              compran y cómo se usa la web.
            </p>
            <p>
              <strong>TikTok.</strong> Hace lo mismo con los anuncios de TikTok.
            </p>
            <p>Si las rechazas, puedes crear y comprar tu canción igual.</p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-lg font-semibold">Las que necesita la web</h2>
            <p>
              Guardamos en tu navegador lo que escribes en el cuestionario, para que no lo pierdas si recargas la
              página, y tu respuesta a este aviso. Stripe, que procesa los pagos, usa sus propias cookies para
              evitar fraudes. Sin esto, la web no funciona, por eso no se pregunta.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-lg font-semibold">Cambiar de opinión</h2>
            <p>Puedes cambiar tu elección cuando quieras. La página se recarga y el aviso vuelve a aparecer.</p>
            <button
              type="button"
              onClick={esquecerCookies}
              className="h-11 rounded-md border border-foreground/30 px-4 text-sm font-medium"
            >
              Cambiar mi elección
            </button>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-lg font-semibold">Contacto</h2>
            <p>
              Si tienes alguna duda, escríbenos a{" "}
              <a href={`mailto:${MARCA.emailContato}`} className="underline underline-offset-4">
                {MARCA.emailContato}
              </a>
              .
            </p>
          </section>
        </div>

        <p className="mt-10 text-sm">
          <a href="/es" className="underline underline-offset-4">
            Volver a la web
          </a>
        </p>
      </div>
    </div>
  );
}
