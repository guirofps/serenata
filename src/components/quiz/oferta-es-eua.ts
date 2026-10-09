import {
  Music,
  Images,
  Sparkles,
  QrCode,
  Download,
  Infinity as InfinityIcon,
  Pencil,
  RefreshCw,
} from "lucide-react";

// A OFERTA EM ESPANHOL DA BALLAD GIFT (hispanos dos EUA, `/es` no balladgift.com).
//
// Não é a copy espanhola da `TelaOferta` com o voseo trocado. Aquela é da
// Serenata e fala com a Argentina: voseo, `celu`, caixa de bombons, checkout da
// Centerpag e "verás el precio en la moneda de tu país". Quem lê ESTA mora nos
// EUA, paga pelo Stripe em dólar e nunca ouviu falar de Centerpag.
//
// O que se manteve do inglês da Ballad (que é o mesmo produto, no mesmo caixa):
//   - sem WhatsApp: o link vai "por mensaje", como o americano manda;
//   - o cartão e a caixa do presente no lugar da caixa de bombons;
//   - a pergunta da FATURA ("STRIPEONLI* BALLADGIFT"), porque quem não reconhece
//     a cobrança abre contestação, e cada uma custa US$ 15 e marca a conta;
//   - Apple Pay e Google Pay no selo, que é o que o Stripe mostra.
//
// `tú` e `ustedes` em tudo, nunca `vos` nem `vosotros`. Sem travessão.
//
// Arquivo à parte (e não mais uma lista dentro da `TelaOferta`) pra o teste
// `oferta-es-eua.test.ts` conseguir ler a copy sem montar a tela, e pra que o
// alarme do voseo (`mercado-copy.test.ts`), que lê a `TelaOferta`, continue
// medindo só a copy da Serenata.

export const ENTREGAVEIS_ES_EUA = [
  {
    Icone: Music,
    titulo: "La canción completa, cantada",
    detalhe:
      "De principio a fin, sin cortes. Y en dos grabaciones distintas de la misma letra, para que elijas la que más te emocione.",
  },
  {
    Icone: Images,
    titulo: "La página regalo, con sus fotos",
    detalhe:
      "Hasta 12 fotos que van cambiando solas con la canción. Esa página es lo que mandas, no un archivo suelto.",
  },
  {
    Icone: Sparkles,
    titulo: "La letra para cantar, palabra por palabra",
    detalhe:
      "Cada palabra se ilumina justo cuando se canta. Quien la recibe puede seguirla y cantar contigo.",
  },
  {
    Icone: QrCode,
    titulo: "Link y código QR para regalar",
    detalhe:
      "Mándale el link por mensaje, o imprime el código QR y ponlo en una tarjeta o en la caja del regalo. El regalo digital se vuelve un regalo que se entrega en la mano.",
  },
  {
    Icone: Download,
    titulo: "El MP3 para descargar y guardar",
    detalhe: "La canción se queda en tu celular, para escucharla cuando quieras, con o sin internet.",
  },
  {
    Icone: RefreshCw,
    titulo: "¿No quedó como querías? La rehacemos",
    detalhe:
      "Después de comprar, pides un ajuste desde tu cuenta: cambiar una parte de la letra, el estilo o la voz. La volvemos a grabar y te mandamos la nueva versión.",
  },
  {
    Icone: Pencil,
    titulo: "Tú armas el regalo a tu manera",
    detalhe:
      "Eliges el color de la página, un efecto en pantalla y escribes una frase tuya. Puedes cambiarlo todas las veces que quieras.",
  },
  {
    Icone: InfinityIcon,
    titulo: "Es tuya para siempre",
    detalhe: "La página no expira y el link nunca deja de funcionar. Pago único, sin suscripción.",
  },
];

export const DUVIDAS_ES_EUA = [
  {
    p: "¿Es un pago único o una suscripción?",
    r: "Único. Pagas una vez y la canción es tuya para siempre. Sin mensualidad, sin renovación automática, y no guardamos tu tarjeta.",
  },
  // A FATURA, a mesma pergunta do inglês (ver `DUVIDAS_EN` na `TelaOferta`).
  // Trocar junto com ela quando o dono renomear a conta Stripe.
  {
    p: "¿Cómo aparece el cargo en mi tarjeta?",
    r: "Como STRIPEONLI* BALLADGIFT. Es un solo cargo en dólares a través de Stripe, nuestro procesador de pagos, sin suscripción.",
  },
  {
    p: "¿Cuánto tarda?",
    r: "Hasta 30 minutos, y normalmente menos de 5. Te avisamos por correo en cuanto esté lista, y también puedes armar el regalo aquí mismo, en la pantalla.",
  },
  {
    p: "¿La canción va a ser igual a la letra que leí?",
    r: "Sí. Esa misma letra es la que se canta, palabra por palabra. Nada cambia después de que pagas.",
  },
  {
    p: "¿Y si no me gusta la grabación?",
    r: "Recibes dos versiones de la misma letra, con interpretaciones distintas, y eliges cuál se abre cuando la persona la reciba. Si ninguna te convence, responde el correo y lo arreglamos.",
  },
  {
    p: "¿Cómo entrego el regalo?",
    r: "Cuando esté lista, te damos el link y un mensaje para copiar y pegar en un texto. Quien lo entrega eres tú.",
  },
];

/**
 * O que muda na moldura da oferta, por cima da copy espanhola da `TelaOferta`
 * (os campos que não aparecem aqui já estão em `tú` lá).
 */
export const OFERTA_ES_EUA = {
  entregaveis: ENTREGAVEIS_ES_EUA,
  duvidas: DUVIDAS_ES_EUA,
  sub: "Escuchaste un pedazo. Sigue, y termina justo como tú la escribiste.",
  // Flores, e não o compositor de US$ 300 do inglês: é a comparação que a
  // pessoa já fez na cabeça antes de chegar aqui ("¿le compro flores?"), e
  // custa parecido nos EUA.
  ancora: "Un ramo de flores cuesta casi lo mismo, dura una semana y nadie lo recuerda.",
  // O preço em dólar numa tela em espanhol levanta "¿son dólares o pesos?". A
  // resposta vai antes do clique, e diz também que é o total (o Stripe não
  // soma nada no caixa).
  conversao: "El precio es en dólares (USD) y es el total: no se suma nada al pagar.",
  creditoValor: "US$ 0",
  gateway: "Tarjeta, Apple Pay o Google Pay. Pago único y seguro",
};
