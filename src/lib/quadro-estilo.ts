// AS ESCOLHAS DO QUADRO: modo, cor e efeito.
//
// Separado da rota porque são decisões de produto, não de layout, e porque a
// próxima etapa (salvar no banco, atrás do pagamento) vai importar isto sem
// arrastar a página inteira junto.

export type Modo = "escuro" | "claro";

export type Estilo = {
  modo: Modo;
  /** Chave de `CORES_QUADRO`. */
  cor: string;
  /** Chave de EFEITOS (`nenhum`, `coracoes`, `estrelas`, `petalas`, `luzes`). */
  efeito: string;
  /**
   * Que ponto da foto fica no centro da faixa, em porcentagem.
   *
   * ── POR QUE ISTO EXISTE ─────────────────────────────────────────
   *
   * A faixa da foto e larga e baixa; a foto que a pessoa mandou quase nunca
   * tem esse formato. Alguem precisa decidir que pedaco aparece, e ate 03/09
   * quem decidia era um palpite fixo no codigo: `center 22%` pra foto
   * deitada, `center center` pra em pe.
   *
   * O palpite acerta as vezes. Quando erra, corta a cara: no quadro de
   * "Encontro no Golandim" a testa dela ficou raspada e a cabeca dele ficou
   * de fora. Num presente cuja graca inteira e a foto de voces dois, isso e o
   * defeito mais caro que a folha pode ter, e nenhuma escolha de cor conserta.
   *
   * Agora quem decide e o dono da foto, arrastando. E o mesmo gesto de trocar
   * foto de perfil ou por banner em qualquer lugar, entao ninguem precisa
   * aprender nada.
   *
   * Fica no estilo (e nao numa coluna propria) porque e escolha visual do
   * quadro e viaja pelo mesmo caminho que ja salva no servidor a cada troca.
   */
  foco?: { x: number; y: number };
};

/**
 * Sem `foco` de proposito: `undefined` quer dizer "a pessoa nunca ajustou", e
 * ai vale o palpite por formato (`center 22%` pra deitada). Cravar um padrao
 * aqui obrigaria toda foto em pe a nascer no enquadramento errado.
 */
export const ESTILO_PADRAO: Estilo = { modo: "escuro", cor: "ambar", efeito: "nenhum" };

/** Limita ao quadrado 0-100: arrastar nunca pode empurrar a foto pra fora. */
export function limitarFoco(x: number, y: number): { x: number; y: number } {
  const trava = (v: number) => Math.max(0, Math.min(100, Number.isFinite(v) ? v : 50));
  return { x: trava(x), y: trava(y) };
}

/**
 * O `object-position` final da faixa.
 *
 * Uma funcao so, usada pela tela E pela folha, pra as duas nunca discordarem:
 * o dia em que o ajuste valer no controle e nao na impressao, a pessoa manda
 * pra grafica uma foto diferente da que ela enquadrou.
 */
export function posicaoDaFoto(estilo: Estilo, formato: string): string {
  if (estilo.foco) return `${estilo.foco.x}% ${estilo.foco.y}%`;
  return formato === "retrato" ? "center center" : "center 22%";
}

// CADA COR TEM DOIS VALORES, e isso não é capricho.
//
// As seis cores da página presente têm luminância 0,78 a 0,86: foram afinadas
// pra BRILHAR sobre o preto e manter contraste com o texto escuro do botão de
// play. Sobre o creme do modo claro elas somem, viram texto quase branco em
// fundo quase branco.
//
// Então o modo claro usa a mesma matiz com luminância baixa. É a mesma cor, no
// papel certo.
export const CORES_QUADRO = [
  { chave: "ambar", nome: "Âmbar", nomeEs: "Ámbar", escuro: "oklch(0.84 0.13 78)", claro: "oklch(0.48 0.12 62)" },
  { chave: "rose", nome: "Rosé", nomeEs: "Rosé", escuro: "oklch(0.80 0.12 8)", claro: "oklch(0.46 0.15 14)" },
  { chave: "coral", nome: "Coral", nomeEs: "Coral", escuro: "oklch(0.78 0.16 40)", claro: "oklch(0.48 0.16 38)" },
  { chave: "lavanda", nome: "Lavanda", nomeEs: "Lavanda", escuro: "oklch(0.80 0.10 300)", claro: "oklch(0.44 0.13 300)" },
  { chave: "ceu", nome: "Céu", nomeEs: "Cielo", escuro: "oklch(0.80 0.11 235)", claro: "oklch(0.45 0.13 240)" },
  { chave: "menta", nome: "Menta", nomeEs: "Menta", escuro: "oklch(0.84 0.12 165)", claro: "oklch(0.44 0.11 165)" },
] as const;

export function corDoQuadro(chave: string, modo: Modo): string {
  const c = CORES_QUADRO.find((x) => x.chave === chave) ?? CORES_QUADRO[0];
  return modo === "claro" ? c.claro : c.escuro;
}

/**
 * A paleta inteira do modo, e o modo claro NÃO é o escuro invertido.
 *
 * No escuro a foto sangra de borda a borda e some num degradê até o preto: é
 * esse degradê que entrega o título legível. No claro esse gesto não existe
 * (não dá pra "escurecer até o creme" sem sujar a foto), então a foto vira um
 * bloco com margem e o texto vive no papel, não por cima da imagem. São dois
 * arranjos, não um interruptor de cor.
 */
export function paleta(modo: Modo) {
  return modo === "claro"
    ? {
        fundo: "#faf5ee",
        texto: "#2a1518",
        textoSuave: "rgba(42,21,24,0.72)",
        linha: "rgba(42,21,24,0.16)",
        qrFundo: "#ffffff",
        qrEscuro: "#2a1518",
        fotoSangra: false,
      }
    : {
        fundo: "#0d0a08",
        texto: "#fdfaf5",
        textoSuave: "rgba(247,240,232,0.82)",
        linha: "rgba(247,240,232,0.14)",
        qrFundo: "#f7f0e8",
        qrEscuro: "#0d0a08",
        fotoSangra: true,
      };
}

// A escolha vive no navegador, por token.
//
// Ainda NÃO vai pro banco de propósito: a coluna e a server function entram
// junto do gate de pagamento, e criar migration agora significaria mexer no
// esquema duas vezes. Pra um produto que se imprime uma vez, guardar local
// resolve; quando o quadro virar item pago com configuração salva, isto vira
// uma linha em `musicas`.
const CHAVE = (token: string) => `mp_quadro_${token}`;

export function lerEstilo(token: string): Estilo {
  if (typeof window === "undefined") return ESTILO_PADRAO;
  try {
    const cru = localStorage.getItem(CHAVE(token));
    if (!cru) return ESTILO_PADRAO;
    return { ...ESTILO_PADRAO, ...(JSON.parse(cru) as Partial<Estilo>) };
  } catch {
    return ESTILO_PADRAO;
  }
}

export function gravarEstilo(token: string, e: Estilo): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CHAVE(token), JSON.stringify(e));
  } catch {
    // Navegador com storage bloqueado não pode derrubar a impressão.
  }
}

/**
 * O tamanho da moldura da foto na folha, a partir da proporcao REAL da imagem.
 *
 * ── POR QUE ISTO NAO E MAIS TRES BALDES ─────────────────────────
 *
 * Antes a foto caia em `paisagem`, `quadrada` ou `retrato`, e cada balde tinha
 * uma moldura fixa. O balde do meio era o pior negocio da folha: uma foto 1:1
 * era jogada numa faixa de 210x96mm, ou seja 2,2:1, e METADE DA IMAGEM ficava
 * de fora. Ninguem ajusta o que sobrou de um corte desses; so da pra escolher
 * qual metade se perde.
 *
 * A regra agora e uma so: a moldura tenta ter a PROPORCAO DA FOTO. Quando ela
 * consegue, `object-fit: cover` nao corta nada, porque nao ha sobra pra
 * cortar. E o que um emoldurador faz — o papel se ajusta a foto, nao o
 * contrario.
 *
 * ── O QUE LIMITA ────────────────────────────────────────────────
 *
 * A folha tem 297mm e a letra precisa do resto. Entao a altura da foto vive
 * numa faixa: nunca menos que 62mm (abaixo disso a foto vira selo e o rosto
 * some), nunca mais que 104mm (acima disso a letra nao cabe e o corpo dela
 * encolhe ate ficar ilegivel).
 *
 * Foto MUITO larga (panoramica) ou MUITO alta bate no limite e volta a ter
 * corte — mas ai o corte e pequeno e o ajuste por arrasto resolve. O corte
 * catastrofico, o de metade da imagem, deixa de existir.
 *
 * ── SANGRAR OU NAO ──────────────────────────────────────────────
 *
 * Foto larga sangra de ponta a ponta: encostar nas bordas e o que da a ela
 * cara de capa, e o degrade por cima segura o titulo.
 *
 * Foto quadrada ou em pe vira bloco centralizado com respiro dos lados. O
 * fundo da folha vira o passe-partout, que e como quadro de verdade se monta.
 * Esticar uma foto vertical de parede a parede seria o corte que este arquivo
 * existe pra evitar.
 */
export function molduraDaFoto(proporcao: number | null): {
  sangra: boolean;
  larguraMm: number;
  alturaMm: number;
} {
  // Sem medida ainda (a imagem nao carregou): o palpite antigo de foto deitada,
  // que e o formato mais comum. Ele so vale pelo instante ate o onload.
  const r = proporcao && Number.isFinite(proporcao) && proporcao > 0 ? proporcao : 1.5;

  const ALTURA_MIN = 62;
  const ALTURA_MAX = 104;
  const LARGURA_SANGRA = 210;
  const LARGURA_MAX_BLOCO = 150;

  // ── ONDE FICA A LINHA DA SANGRIA ────────────────────────────────
  //
  // Sangrar prende a largura em 210mm, e ai so a altura negocia — o que
  // significa que a moldura NAO consegue ter a proporcao da foto, e o corte
  // volta. Com a linha em 1,5 (a primeira tentativa) uma foto 3:2, que e a
  // mais comum que sai de celular, perdia 26% da area: a moldura virava
  // 210x104mm, ou 2,02:1, contra os 1,5:1 da foto.
  //
  // Em 2,0 so sangra o que ja e panoramico de verdade, e ai a moldura fica
  // colada na proporcao da foto de novo. Todo o resto vira bloco centralizado
  // com a proporcao exata: 1:1, 3:4, 3:2 e 16:9 passam a cortar ZERO.
  //
  // O preco e que a maioria das fotos deixa de encostar nas bordas. Nao e
  // perda: foto com respiro dos lados e o fundo servindo de passe-partout e
  // como quadro de verdade se monta, e vale mais que a cara de capa quando a
  // alternativa e comer um quarto da imagem.
  if (r >= 2) {
    // Sangra: a largura esta cravada em 210mm, entao so a altura negocia.
    const alta = Math.min(ALTURA_MAX, Math.max(ALTURA_MIN, LARGURA_SANGRA / r));
    return { sangra: true, larguraMm: LARGURA_SANGRA, alturaMm: Math.round(alta) };
  }

  // Bloco: comeca pela altura maxima e deriva a largura da proporcao. Se a
  // largura estourar (foto quase quadrada), e ela que manda e a altura cede.
  let altura = ALTURA_MAX;
  let largura = altura * r;
  if (largura > LARGURA_MAX_BLOCO) {
    largura = LARGURA_MAX_BLOCO;
    altura = largura / r;
  }
  return {
    sangra: false,
    larguraMm: Math.round(largura),
    alturaMm: Math.round(Math.min(ALTURA_MAX, Math.max(ALTURA_MIN, altura))),
  };
}
