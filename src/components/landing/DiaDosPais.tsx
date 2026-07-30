import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { FONTES } from "@/lib/marca";
import { ArrowRight } from "lucide-react";

// Seção sazonal de DIA DOS PAIS (2º domingo de agosto = 9/8/2026).
//
// Ângulo roubado do concorrente mais direto (Eternizado), melhorado onde ele
// falha: ele não tem contador nem prova. A urgência aqui é HONESTA — é a data
// real chegando, não escassez inventada.
//
// Os "tipos de pai" cobrem o mercado inteiro, inclusive o "em memória", que
// abre a homenagem póstuma (emocionalmente o mais forte).

const DIA_DOS_PAIS = new Date("2026-08-09T23:59:59-03:00");

const TIPOS = [
  { emoji: "🎣", titulo: "O pai raiz", texto: "O da pescaria, do churrasco de domingo, do time que ele te ensinou a torcer." },
  { emoji: "👴", titulo: "O vô babão", texto: "Que virou criança de novo quando os netos chegaram." },
  { emoji: "🧡", titulo: "O padrasto", texto: "O pai que a vida deu, e que fez por escolha o que ninguém pediu." },
  { emoji: "✈️", titulo: "O pai à distância", texto: "Longe de vista, perto no coração. A música chega onde você não alcança." },
  { emoji: "🕊️", titulo: "Em memória", texto: "A homenagem de saudade pra quem partiu, mas continua sendo seu pai." },
  { emoji: "🤍", titulo: "Aquele pai que 'não chora'", texto: "O durão que se desmancha quando ouve, em música, o que você nunca teve coragem de dizer." },
];

function useContagem() {
  const [t, setT] = useState<{ d: number; h: number; m: number } | null>(null);
  useEffect(() => {
    const calc = () => {
      const ms = DIA_DOS_PAIS.getTime() - Date.now();
      if (ms <= 0) return setT({ d: 0, h: 0, m: 0 });
      setT({
        d: Math.floor(ms / 86400000),
        h: Math.floor((ms % 86400000) / 3600000),
        m: Math.floor((ms % 3600000) / 60000),
      });
    };
    calc();
    const id = setInterval(calc, 30000);
    return () => clearInterval(id);
  }, []);
  return t;
}

export function DiaDosPais({ exemploToken }: { exemploToken?: string }) {
  const c = useContagem();

  return (
    <section
      id="dia-dos-pais"
      className="luz-vinho bg-[var(--papel-fundo)]"
      style={{ paddingBlock: "var(--secao)" }}
    >
      <div className="mx-auto max-w-5xl px-6">
        <div className="text-center">
          <span
            className="inline-flex items-center gap-2 rounded-full border border-[var(--acento)]/30 bg-[var(--acento)]/10 px-4 py-1.5 font-medium text-[var(--acento)]"
            style={{ fontSize: "var(--t-xs)" }}
          >
            Dia dos Pais · 9 de agosto
            {c && c.d > 0 && <span className="opacity-70">·  faltam {c.d} dias</span>}
          </span>

          <h2
            className="mx-auto mt-4 max-w-2xl text-balance sm:mt-6"
            style={{ fontFamily: FONTES.display, fontWeight: 500, fontSize: "var(--t-2xl)", lineHeight: 1.12 }}
          >
            Gravata ele guarda na gaveta.
            <br className="hidden sm:block" /> Isso aqui ele mostra pros amigos.
          </h2>
          <p
            className="mx-auto mt-3 max-w-xl text-[var(--tinta-suave)] sm:mt-5"
            style={{ fontSize: "var(--t-base)", lineHeight: 1.55 }}
          >
            Uma música com o nome dele, as memórias de vocês e o "obrigado" que a
            gente sempre esquece de dizer. Ele vai reouvir, mostrar pros amigos e
            guardar pra vida toda.
          </p>
        </div>

        {/* Contador honesto: a data real chegando. */}
        {c && c.d >= 0 && (
          <div className="mx-auto mt-6 flex max-w-xs items-stretch justify-center gap-2 sm:mt-9 sm:max-w-sm sm:gap-3">
            {[
              { v: c.d, l: "dias" },
              { v: c.h, l: "horas" },
              { v: c.m, l: "min" },
            ].map((u) => (
              <div
                key={u.l}
                className="flex-1 rounded-2xl border border-[var(--tinta-fraca)]/40 bg-[var(--papel)] py-3 text-center"
              >
                <p
                  className="tabular-nums leading-none"
                  style={{ fontFamily: FONTES.display, fontWeight: 600, fontSize: "var(--t-2xl)" }}
                >
                  {String(u.v).padStart(2, "0")}
                </p>
                <p className="mt-1 text-[var(--tinta-suave)]" style={{ fontSize: "10px" }}>
                  {u.l}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Tipos de pai: cobre o mercado inteiro. */}
        <div className="mt-9 grid grid-cols-2 gap-3 sm:mt-14 sm:gap-4 lg:grid-cols-3">
          {TIPOS.map((t) => (
            <div
              key={t.titulo}
              className="card-lift rounded-[var(--raio-lg)] border border-[var(--tinta-fraca)]/35 bg-[var(--papel)] p-3.5 sm:p-5"
            >
              <span className="text-xl sm:text-2xl" aria-hidden>
                {t.emoji}
              </span>
              <h3
                className="mt-1.5 leading-snug sm:mt-2"
                style={{ fontFamily: FONTES.display, fontWeight: 500, fontSize: "var(--t-base)" }}
              >
                {t.titulo}
              </h3>
              <p
                className="mt-1 text-[var(--tinta-suave)]"
                style={{ fontSize: "var(--t-xs)", lineHeight: 1.5 }}
              >
                {t.texto}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-8 text-center sm:mt-12">
          <Link
            to="/criar"
            className="cta inline-flex items-center gap-2 rounded-full px-8 py-4 text-base font-medium"
          >
            Criar a música do meu pai <ArrowRight className="h-4 w-4" />
          </Link>
          <p className="mt-4 text-[var(--tinta-suave)]" style={{ fontSize: "var(--t-sm)" }}>
            A letra fica pronta na hora, de graça. Você só paga se amar.
          </p>
          {exemploToken && (
            <p className="mt-5" style={{ fontSize: "var(--t-sm)" }}>
              <a
                href={`/p/${exemploToken}`}
                target="_blank"
                rel="noreferrer"
                className="text-[var(--acento)] underline underline-offset-4 hover:opacity-80"
              >
                Ver um presente pronto pra pai (exemplo) →
              </a>
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
