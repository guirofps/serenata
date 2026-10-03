import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Logo } from "@/components/marca/Logo";
import { EMPRESA, cnpjFormatado } from "@/lib/empresa";
import { MARCA, TEMA_CLARO } from "@/lib/marca";
import { BotaoCriar } from "./CtaCriar";

export function LayoutBlog({ children, tema }: { children: ReactNode; tema?: "gospel" }) {
  return (
    <div className="min-h-screen bg-[var(--papel)] text-[var(--tinta)]" style={TEMA_CLARO}>
      <div className="fio-marca fixed inset-x-0 top-0 z-40" aria-hidden />
      <header className="sticky top-0 z-30 border-b border-[var(--tinta-fraca)]/30 bg-[var(--papel)]/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
          <Link to="/" aria-label={`${MARCA.nome}, página inicial`}>
            <Logo tamanho="sm" />
          </Link>
          <BotaoCriar tema={tema} texto="Criar minha música" compacto />
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 pb-20">{children}</main>
      <footer
        className="border-t border-[var(--tinta-fraca)]/30 py-10 text-center text-[var(--tinta-suave)]"
        style={{ fontSize: "var(--t-xs)" }}
      >
        <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm">
          <Link to="/">{MARCA.nome}</Link>
          <Link to="/blog">Blog</Link>
          <Link to="/criar">Criar música</Link>
          <Link to="/termos">Termos</Link>
          <Link to="/privacidade">Privacidade</Link>
        </nav>
        <p className="mt-4">
          {EMPRESA.nome} · CNPJ {cnpjFormatado()}
        </p>
      </footer>
    </div>
  );
}
