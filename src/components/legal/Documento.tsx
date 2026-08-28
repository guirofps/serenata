import { Link } from "@tanstack/react-router";
import { Logo } from "@/components/marca/Logo";
import { TEMA_CLARO } from "@/lib/marca";
import { EMPRESA, cnpjFormatado } from "@/lib/empresa";

/** O canal único. Decisão registrada no CLAUDE.md: só e-mail no lançamento. */
export const SUPORTE = "contato@serenatagift.com";

// A MOLDURA DOS DOCUMENTOS LEGAIS.
//
// Uma só pras duas páginas, porque elas são a mesma coisa com texto
// diferente: cabeçalho, data de atualização, corpo legível, e a
// identificação de quem responde por aquilo no fim.
//
// ── LEGIBILIDADE É PARTE DO CUMPRIMENTO ──────────────────────────
//
// O CDC e a LGPD pedem informação clara e acessível, não juridiquês num
// bloco cinza de 8px. `max-w-2xl` e entrelinha alta não são estética: é o
// que faz alguém conseguir ler até o fim.

export function Documento({
  titulo,
  atualizado,
  children,
}: {
  titulo: string;
  /** `27 de agosto de 2026`. À vista, porque documento sem data não vale nada. */
  atualizado: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`${TEMA_CLARO} min-h-dvh bg-background`}>
      <div className="mx-auto w-full max-w-2xl px-6 py-10">
        <Link to="/" className="inline-block">
          <Logo tamanho="sm" />
        </Link>

        <h1 className="mt-8 font-display text-3xl font-semibold leading-tight">{titulo}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Última atualização: {atualizado}
        </p>

        <div className="prose-serenata mt-8 space-y-6 text-[15px] leading-relaxed">
          {children}
        </div>

        <div className="mt-12 border-t border-primary/10 pt-6 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">{EMPRESA.nome}</p>
          <p>CNPJ {cnpjFormatado()}</p>
          <p className="mt-2">
            Dúvidas ou pedidos:{" "}
            <a href={`mailto:${SUPORTE}`} className="text-primary underline underline-offset-4">
              {SUPORTE}
            </a>
          </p>
          <p className="mt-4">
            <Link to="/" className="underline underline-offset-4">
              Voltar para o site
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

/** Um título de seção. Numerado, porque documento legal se cita por número. */
export function Secao({ n, titulo, children }: { n: number; titulo: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-lg font-semibold">
        {n}. {titulo}
      </h2>
      {children}
    </section>
  );
}
