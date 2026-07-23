import { createFileRoute } from "@tanstack/react-router";
import { FONTES } from "@/lib/marca";
import { Play } from "lucide-react";

// Página interna de exploração da MARCA.
//
// Existe porque a gente estava escolhendo logo sem ter fechado a paleta —
// e sem paleta, cada peça nasce brigando com a anterior (foi como o símbolo
// saiu dourado-metálico enquanto o sistema era âmbar chapado).
//
// Ordem correta: paleta → tipografia → wordmark → símbolo.
// Aqui a paleta é julgada APLICADA no produto (capa do presente), não em
// quadradinho de cor solto — que é como se decide de verdade.
//
// Rota temporária, morre quando a marca estiver fechada.

export const Route = createFileRoute("/marca")({
  head: () => ({
    meta: [{ title: "Serenata — exploração de marca" }],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600&family=Cormorant+Garamond:wght@400;500;600&family=Playfair+Display:wght@400;500;600&display=swap",
      },
    ],
  }),
  component: Marca,
});

type Paleta = {
  id: string;
  nome: string;
  ideia: string;
  fundo: string; // fundo do "presente"
  superficie: string;
  texto: string;
  suave: string;
  acento: string;
  acentoTexto: string;
  claroFundo: string; // como fica o site (mundo claro)
  claroTexto: string;
};

const PALETAS: Paleta[] = [
  {
    id: "noite",
    nome: "Noite e âmbar",
    ideia: "A serenata é cantada à noite. Íntimo, quente, premium.",
    fundo: "#0d0a08",
    superficie: "#161110",
    texto: "#f5efe6",
    suave: "rgba(245,239,230,0.5)",
    acento: "oklch(0.84 0.13 78)",
    acentoTexto: "#0d0a08",
    claroFundo: "#fbf7f0",
    claroTexto: "#20180f",
  },
  {
    id: "vinho",
    nome: "Papel e vinho",
    ideia: "Carta antiga, lacre, coisa guardada. Romântico clássico.",
    fundo: "#1a0f12",
    superficie: "#251519",
    texto: "#f7f0e8",
    suave: "rgba(247,240,232,0.5)",
    acento: "oklch(0.55 0.16 18)",
    acentoTexto: "#fff8f4",
    claroFundo: "#faf5ee",
    claroTexto: "#2a1518",
  },
  {
    id: "terracota",
    nome: "Terracota e creme",
    ideia: "Brasileiro, caseiro, afetivo. Foge do romântico clichê.",
    fundo: "#17100c",
    superficie: "#221812",
    texto: "#f6efe6",
    suave: "rgba(246,239,230,0.5)",
    acento: "oklch(0.63 0.15 44)",
    acentoTexto: "#fff6f0",
    claroFundo: "#faf4ea",
    claroTexto: "#2b1c13",
  },
  {
    id: "meianoite",
    nome: "Meia-noite e champanhe",
    ideia: "Elegante e contemporâneo. Cara de marca de presente cara.",
    fundo: "#0b0f16",
    superficie: "#131a24",
    texto: "#f2f3f5",
    suave: "rgba(242,243,245,0.5)",
    acento: "oklch(0.86 0.09 90)",
    acentoTexto: "#0b0f16",
    claroFundo: "#f7f6f3",
    claroTexto: "#141a22",
  },
];

const TIPOS = [
  { id: "fraunces", nome: "Fraunces", css: "'Fraunces', serif", nota: "Calor e imperfeição. Parece escrita por gente." },
  { id: "playfair", nome: "Playfair Display", css: "'Playfair Display', serif", nota: "Contraste alto, editorial, elegante." },
  { id: "cormorant", nome: "Cormorant Garamond", css: "'Cormorant Garamond', serif", nota: "Fina e clássica. Cara de convite de casamento." },
];

function Marca() {
  return (
    <main
      className="min-h-screen bg-neutral-100 px-6 py-12"
      style={{ fontFamily: "Inter, sans-serif" }}
    >
      <div className="mx-auto max-w-6xl">
        <header className="mb-12">
          <h1 className="text-3xl font-semibold">Exploração de marca</h1>
          <p className="mt-2 max-w-2xl text-neutral-600">
            Paleta julgada aplicada no produto — a capa do presente, que é a
            tela que mais importa. Escolha uma paleta e uma tipografia; o
            símbolo é desenhado depois, dentro dela.
          </p>
        </header>

        {/* ── PALETAS ── */}
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-neutral-500">
          1. Paleta
        </h2>
        <div className="mb-16 grid gap-6 sm:grid-cols-2">
          {PALETAS.map((p) => (
            <div key={p.id} className="overflow-hidden rounded-2xl bg-white shadow-sm">
              {/* aplicação real: a capa do presente */}
              <div
                className="px-6 py-10 text-center"
                style={{ background: p.fundo, color: p.texto }}
              >
                <p
                  className="text-[10px] uppercase tracking-[0.3em]"
                  style={{ color: p.suave }}
                >
                  uma música para
                </p>
                <p
                  className="mt-2 text-4xl"
                  style={{ fontFamily: "'Fraunces', serif", fontWeight: 500 }}
                >
                  Eva
                </p>
                <p className="mt-1 text-xs" style={{ color: p.suave }}>
                  Domingo na Casa da Eva
                </p>
                <div
                  className="mx-auto mt-6 flex h-14 w-14 items-center justify-center rounded-full"
                  style={{ background: p.acento, color: p.acentoTexto }}
                >
                  <Play className="h-6 w-6 translate-x-0.5" fill="currentColor" />
                </div>
                <div className="mt-6 space-y-1.5 text-left text-[13px]">
                  <p style={{ color: "rgba(255,255,255,0.22)" }}>
                    Domingo é sagrado, Eva, é de lei
                  </p>
                  <p style={{ color: p.acento }}>Sua mesa posta esperando por mim</p>
                  <p style={{ color: "rgba(255,255,255,0.22)" }}>
                    O cheiro que vem lá da sua cozinha
                  </p>
                </div>
              </div>

              {/* como fica o site (mundo claro) */}
              <div
                className="flex items-center justify-between px-6 py-4"
                style={{ background: p.claroFundo, color: p.claroTexto }}
              >
                <span style={{ fontFamily: "'Fraunces', serif", fontSize: 18, fontWeight: 500 }}>
                  Serenata
                </span>
                <span
                  className="rounded-full px-4 py-2 text-xs font-medium"
                  style={{ background: p.acento, color: p.acentoTexto }}
                >
                  Criar minha música
                </span>
              </div>

              <div className="px-6 py-4">
                <p className="font-medium">{p.nome}</p>
                <p className="mt-1 text-sm text-neutral-500">{p.ideia}</p>
                <div className="mt-3 flex gap-1.5">
                  {[p.fundo, p.superficie, p.acento, p.claroFundo].map((c) => (
                    <span
                      key={c}
                      className="h-6 w-6 rounded-full ring-1 ring-black/10"
                      style={{ background: c }}
                    />
                  ))}
                </div>
                <p className="mt-2 text-xs text-neutral-400">?paleta={p.id}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── TIPOGRAFIA ── */}
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-neutral-500">
          2. Tipografia do logotipo
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {TIPOS.map((t) => (
            <div key={t.id} className="rounded-2xl bg-white p-6 shadow-sm">
              <p className="text-4xl" style={{ fontFamily: t.css, fontWeight: 500 }}>
                Serenata
              </p>
              <p
                className="mt-3 text-xl tracking-[0.2em]"
                style={{ fontFamily: t.css, fontWeight: 400 }}
              >
                SERENATA
              </p>
              <p className="mt-4 text-sm font-medium">{t.nome}</p>
              <p className="text-xs text-neutral-500">{t.nota}</p>
            </div>
          ))}
        </div>

        <p className="mt-12 text-sm text-neutral-500">
          Escolhida a paleta e a tipografia, o símbolo é desenhado dentro
          delas — nem clipart chapado, nem barroco dourado.
        </p>
      </div>
    </main>
  );
}
