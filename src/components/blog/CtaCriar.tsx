import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import type { SiteBlog } from "@/lib/blog/site";
import { FONTES } from "@/lib/marca";

// O botão pro quiz do site (`site.destinoCriar`). No artigo de louvor da Serenata
// ele leva `?t=gospel`, que é o que abre a abertura gospel do /criar — sem isso a
// pessoa cai no quiz comum. O espanhol da Ballad não tem essa porta: lá o botão
// vai sempre pro /es/criar.

type Props = { site: SiteBlog; tema?: "gospel"; texto?: string; final?: boolean; compacto?: boolean };

const CLASSE_BOTAO = "cta inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-base font-medium";

export function BotaoCriar({ site, tema, texto, compacto }: Omit<Props, "final">) {
  const t = site.textos.cta;
  const rotulo = texto ?? (tema === "gospel" ? t.botaoGospel : t.botao);
  const classe = compacto ? "cta rounded-full px-5 py-2.5 text-sm font-medium" : CLASSE_BOTAO;
  const conteudo = (
    <>
      {rotulo} {!compacto && <ArrowRight className="h-4 w-4" />}
    </>
  );
  return tema === "gospel" && site.destinoCriar === "/criar" ? (
    <Link to="/criar" search={{ t: "gospel" }} className={classe}>
      {conteudo}
    </Link>
  ) : (
    <Link to={site.destinoCriar} className={classe}>
      {conteudo}
    </Link>
  );
}

export function CtaCriar({ site, tema, texto, final }: Props) {
  const t = site.textos.cta;
  return (
    <div
      className={
        final ? "mt-16 rounded-3xl bg-[var(--papel-fundo)] px-6 py-10 text-center" : "my-10 text-center"
      }
    >
      {final && (
        <h2
          className="mx-auto mb-6 max-w-lg text-balance"
          style={{ fontFamily: FONTES.display, fontWeight: 500, fontSize: "var(--t-2xl)", lineHeight: 1.15 }}
        >
          {tema === "gospel" ? t.tituloFinalGospel : t.tituloFinal}
        </h2>
      )}
      <BotaoCriar site={site} tema={tema} texto={texto} />
      <p className="mt-3 text-sm text-[var(--tinta-suave)]">{t.nota}</p>
    </div>
  );
}
