import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { FONTES } from "@/lib/marca";

// O botão pro quiz. No artigo de louvor ele leva `?t=gospel`, que é o que abre
// a abertura gospel do /criar — sem isso a pessoa cai no quiz comum.

type Props = { tema?: "gospel"; texto?: string; final?: boolean; compacto?: boolean };

const CLASSE_BOTAO = "cta inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-base font-medium";

export function BotaoCriar({ tema, texto, compacto }: Omit<Props, "final">) {
  const rotulo = texto ?? (tema === "gospel" ? "Criar meu louvor" : "Criar a música agora");
  const classe = compacto ? "cta rounded-full px-5 py-2.5 text-sm font-medium" : CLASSE_BOTAO;
  const conteudo = (
    <>
      {rotulo} {!compacto && <ArrowRight className="h-4 w-4" />}
    </>
  );
  return tema === "gospel" ? (
    <Link to="/criar" search={{ t: "gospel" }} className={classe}>
      {conteudo}
    </Link>
  ) : (
    <Link to="/criar" className={classe}>
      {conteudo}
    </Link>
  );
}

export function CtaCriar({ tema, texto, final }: Props) {
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
          {tema === "gospel" ? "Conte o que Deus fez na sua vida" : "Conte a história de quem você ama"}
        </h2>
      )}
      <BotaoCriar tema={tema} texto={texto} />
      <p className="mt-3 text-sm text-[var(--tinta-suave)]">
        A letra fica pronta na hora e é de graça. Você só paga se quiser a música completa.
      </p>
    </div>
  );
}
