import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Logo } from "@/components/marca/Logo";
import type { SiteBlog } from "@/lib/blog/site";
import { RESPONSAVEL, cnpjFormatado } from "@/lib/empresa";
import { MARCA, TEMA_CLARO } from "@/lib/marca";
import { BotaoCriar } from "./CtaCriar";
import { RodapeBallad } from "@/components/landing/RodapeBallad";

export function LayoutBlog({
  site,
  children,
  tema,
}: {
  site: SiteBlog;
  children: ReactNode;
  tema?: "gospel";
}) {
  const t = site.textos.layout;
  return (
    <div className="min-h-screen bg-[var(--papel)] text-[var(--tinta)]" style={TEMA_CLARO}>
      <div className="fio-marca fixed inset-x-0 top-0 z-40" aria-hidden />
      <header className="sticky top-0 z-30 border-b border-[var(--tinta-fraca)]/30 bg-[var(--papel)]/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
          <Link to={t.inicio} aria-label={t.inicioAria(MARCA.nome)}>
            <Logo tamanho="sm" />
          </Link>
          <BotaoCriar tema={tema} site={site} texto={t.criarCompacto} compacto />
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 pb-20">{children}</main>
      {site.chave === "ballad-es" ? (
        <RodapeBallad idioma="es" />
      ) : (
        <footer
          className="border-t border-[var(--tinta-fraca)]/30 py-10 text-center text-[var(--tinta-suave)]"
          style={{ fontSize: "var(--t-xs)" }}
        >
          <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm">
            <Link to={t.inicio}>{MARCA.nome}</Link>
            {t.rodape.map((l) => (
              <Link key={l.to} to={l.to}>
                {l.rotulo}
              </Link>
            ))}
          </nav>
          <p className="mt-4">
            {RESPONSAVEL.razaoSocial} · CNPJ {cnpjFormatado(RESPONSAVEL.cnpj)}
            <br />
            {RESPONSAVEL.endereco}
          </p>
        </footer>
      )}
    </div>
  );
}
