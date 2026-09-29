import { Link } from "@tanstack/react-router";
import { Logo } from "@/components/marca/Logo";
import { MARCA, TEMA_CLARO } from "@/lib/marca";
import { EMPRESA, cnpjFormatado } from "@/lib/empresa";
import { LOCALE_PADRAO } from "@/lib/i18n";

/**
 * O canal único. Decisão registrada no CLAUDE.md: só e-mail no lançamento.
 * Vem da marca do deploy: `contato@serenatagift.com` na Serenata,
 * `support@balladgift.com` na Ballad.
 */
export const SUPORTE = MARCA.emailContato;

// A moldura fala o idioma do site. Na Serenata é português, sempre (o `/es`
// não tem termos próprios); na Ballad é inglês. O idioma vem do deploy, e não
// da rota, porque os dois documentos existem uma vez só por site.
const EN = LOCALE_PADRAO === "en";

// O espaço fica DENTRO da string, e não entre duas chaves no JSX: assim o
// português sai com os mesmos nós de texto de antes, e o HTML da Serenata não
// muda nem um byte.
const MOLDURA = EN
  ? {
      atualizado: "Last updated: ",
      // O americano não sabe o que é CNPJ: diz primeiro que é empresa
      // brasileira, e o número vem depois, como identificação.
      empresa: `${MARCA.nome} is operated by a company registered in Brazil`,
      duvidas: "Questions or requests:",
      voltar: "Back to the site",
    }
  : {
      atualizado: "Última atualização: ",
      empresa: EMPRESA.nome,
      duvidas: "Dúvidas ou pedidos:",
      voltar: "Voltar para o site",
    };

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
  /**
   * `27 de agosto de 2026` (ou `September 29, 2026` na Ballad). À vista,
   * porque documento sem data não vale nada.
   */
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
          {MOLDURA.atualizado}{atualizado}
        </p>

        <div className="prose-serenata mt-8 space-y-6 text-[15px] leading-relaxed">
          {children}
        </div>

        <div className="mt-12 border-t border-primary/10 pt-6 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">{MOLDURA.empresa}</p>
          {EN ? (
            <p>CNPJ (Brazilian company ID) {cnpjFormatado()}, São Caetano do Sul, SP, Brazil</p>
          ) : (
            <p>CNPJ {cnpjFormatado()}</p>
          )}
          <p className="mt-2">
            {MOLDURA.duvidas}{" "}
            <a href={`mailto:${SUPORTE}`} className="text-primary underline underline-offset-4">
              {SUPORTE}
            </a>
          </p>
          <p className="mt-4">
            <Link to="/" className="underline underline-offset-4">
              {MOLDURA.voltar}
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
