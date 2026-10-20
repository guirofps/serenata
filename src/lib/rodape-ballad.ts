// O rodapé da Ballad (home em inglês, home em espanhol e blog em espanhol):
// textos e links aqui, o desenho em `RodapeBallad.tsx`. Só Ballad, por isso lê
// `MARCAS.ballad` direto, sem depender da env.
//
// Sem promessa de devolução nem garantia (regra da casa, `rodape-ballad.test.ts`).
// Quem vende é o EMPRESA: o RESPONSAVEL do `empresa.ts` é só da Serenata.
import { cnpjFormatado } from "./empresa";
import type { Locale } from "./i18n";
import { MARCAS } from "./marca-identidade";

export type RotaRodape =
  "/" | "/criar" | "/termos" | "/privacidade" | "/es" | "/es/criar" | "/es/blog";

export type LinkRodape =
  | { tipo: "rota"; rotulo: string; to: RotaRodape; hash?: string }
  | { tipo: "artigo"; rotulo: string; slug: string }
  | { tipo: "email"; rotulo: string; href: string };

export type Rodape = {
  chamada: { titulo: string; sub: string; botao: string; link: LinkRodape };
  promessa: string;
  selos: string[];
  meios: string;
  colunas: { titulo: string; links: LinkRodape[] }[];
  idiomas: { locale: Locale; rotulo: string; atual: boolean; link: LinkRodape }[];
  empresa: string;
  copyright: string;
};

const BALLAD = MARCAS.ballad;
const EMAIL: LinkRodape = {
  tipo: "email",
  rotulo: BALLAD.emailContato,
  href: `mailto:${BALLAD.emailContato}`,
};
const MEIOS = "Visa · Mastercard · Amex · Apple Pay · Google Pay";

export function rodapeBallad(idioma: "en" | "es", ano: number = new Date().getFullYear()): Rodape {
  const idiomas: Rodape["idiomas"] = [
    {
      locale: "en",
      rotulo: "English",
      atual: idioma === "en",
      link: { tipo: "rota", rotulo: "English", to: "/" },
    },
    {
      locale: "es",
      rotulo: "Español",
      atual: idioma === "es",
      link: { tipo: "rota", rotulo: "Español", to: "/es" },
    },
  ];
  const copyright = `© ${ano} ${BALLAD.nome}`;

  if (idioma === "es") {
    return {
      chamada: {
        titulo: "Convierte su historia en una canción",
        sub: "Cuéntanos de quien amas, lee la letra gratis y escúchala antes de pagar.",
        botao: "Crea tu canción",
        link: { tipo: "rota", rotulo: "Crea tu canción", to: "/es/criar" },
      },
      promessa: "Una canción hecha con la historia de quien amas.",
      selos: ["Escúchala antes de pagar", "Pago seguro con Stripe"],
      meios: MEIOS,
      colunas: [
        {
          titulo: "Producto",
          links: [
            { tipo: "rota", rotulo: "Cómo funciona", to: "/es", hash: "como-funciona" },
            { tipo: "rota", rotulo: "Ejemplos", to: "/es", hash: "ejemplo" },
            { tipo: "rota", rotulo: "Crear canción", to: "/es/criar" },
          ],
        },
        {
          titulo: "Ayuda",
          links: [
            EMAIL,
            { tipo: "rota", rotulo: "Términos", to: "/termos" },
            { tipo: "rota", rotulo: "Privacidad", to: "/privacidade" },
          ],
        },
        {
          titulo: "Blog",
          links: [
            { tipo: "rota", rotulo: "Todas las ideas", to: "/es/blog" },
            {
              tipo: "artigo",
              rotulo: "Canción para mi esposa",
              slug: "cancion-personalizada-para-mi-esposa",
            },
            { tipo: "artigo", rotulo: "Canción para mi mamá", slug: "cancion-para-mi-mama" },
            {
              tipo: "artigo",
              rotulo: "Canción de cumpleaños",
              slug: "cancion-de-cumpleanos-personalizada",
            },
          ],
        },
      ],
      idiomas,
      empresa: `Operada por una empresa registrada en Brasil · CNPJ ${cnpjFormatado()}`,
      copyright,
    };
  }

  return {
    chamada: {
      titulo: "Turn their story into a song",
      sub: "Tell us about someone you love, read the lyrics for free and hear it before you pay.",
      botao: "Create your song",
      link: { tipo: "rota", rotulo: "Create your song", to: "/criar" },
    },
    promessa: `${BALLAD.promessa}.`,
    selos: ["Hear it before you pay", "Secure checkout by Stripe"],
    meios: MEIOS,
    colunas: [
      {
        titulo: "Product",
        links: [
          { tipo: "rota", rotulo: "How it works", to: "/", hash: "como-funciona" },
          { tipo: "rota", rotulo: "Examples", to: "/", hash: "exemplo" },
          { tipo: "rota", rotulo: "Create a song", to: "/criar" },
        ],
      },
      {
        titulo: "Help",
        links: [
          EMAIL,
          { tipo: "rota", rotulo: "Terms", to: "/termos" },
          { tipo: "rota", rotulo: "Privacy", to: "/privacidade" },
        ],
      },
      {
        // O blog só existe em espanhol: no inglês a coluna avisa o idioma.
        titulo: "En español",
        links: [
          { tipo: "rota", rotulo: "Blog de regalos", to: "/es/blog" },
          { tipo: "rota", rotulo: "Crea tu canción", to: "/es/criar" },
        ],
      },
    ],
    idiomas,
    empresa: `Operated by a company registered in Brazil · CNPJ ${cnpjFormatado()}`,
    copyright,
  };
}
