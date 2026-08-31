import { create } from "zustand";
import { persist } from "zustand/middleware";

// Store das respostas do quiz, persistida em localStorage. Sobrevive a reload
// (junto com o passo na URL, garante retomada exata de onde parou).
// O sessionId vem do session-context (mp_session_id); aqui guardamos só as
// respostas e o contato, que são o insumo da letra e do lead.

/**
 * A letra JÁ FINALIZADA desta sessão.
 *
 * Sem isto, quem saía do reveal (pra ver a oferta, ou tocando em voltar sem
 * querer) e tentava retornar caía de novo em "Qual refrão fica melhor?": o
 * RevealStep recomeçava a coautoria do zero. A pessoa perdia a letra que
 * tinha escolhido e editado, e ainda queimava outra chamada de IA.
 *
 * Guardado aqui e não em estado de componente porque o passo vive na URL:
 * sair e voltar desmonta o componente inteiro.
 */
export type LetraFinal = {
  titulo: string;
  letra: string;
  estiloSuno: string;
  versoDestaque: string;
  /**
   * DE QUAL SESSÃO esta letra é.
   *
   * Sem isto, a letra guardada valia pra sempre e pra qualquer sessão. Quem
   * escrevia uma letra, NÃO comprava, e voltava depois pra fazer outra caía
   * numa tela de revelação da música ANTIGA — com o título velho e uma barra
   * de progresso que subia até ~93% e parava pra sempre, porque a checagem
   * procurava a música da sessão NOVA, que não existe.
   *
   * O `reset()` existia, mas só rodava pra quem já tinha COMPRADO
   * (`sessaoGasta()`), e é justamente quem não comprou que volta pra tentar
   * de novo. Reproduzido em 31/08: sessão nova às 23:53, tela mostrando o
   * título das 21:36.
   *
   * Opcional porque letra gravada antes desta versão não tem o campo — e
   * letra sem dono é tratada como de outra sessão, que é o lado seguro.
   */
  sessionId?: string;
};

type QuizState = {
  respostas: Record<string, string | string[]>;
  email: string | null;
  /**
   * O WhatsApp DO COMPRADOR, quando ela deixa na tela de espera. Fica aqui
   * (e não só no banco) por um motivo de conversão: o checkout da Perfect Pay
   * aceita `phone` na URL e pré-preenche o campo. Medido em 7 dias: 223
   * sessões clicaram em comprar e só 86 chegaram a gerar pedido — 137 se
   * perderam DENTRO do formulário do gateway. Cada campo a menos conta.
   */
  whatsapp: string | null;
  /**
   * Cupom que veio do e-mail de recuperação (`/retomar?...&cupom=SRN27`).
   *
   * Fica na store porque o caminho é longo: a pessoa clica no e-mail, cai no
   * `/retomar`, é levada pro reveal, ouve a música, vai pra oferta e só então
   * pro checkout. Perder o código em qualquer uma dessas pontes transformaria
   * a promessa do e-mail em preço cheio na tela do gateway.
   */
  cupom: string | null;
  letraFinal: LetraFinal | null;
  setResposta: (field: string, value: string | string[]) => void;
  setEmail: (email: string) => void;
  setWhatsapp: (w: string) => void;
  setCupom: (c: string | null) => void;
  setLetraFinal: (l: LetraFinal) => void;
  reset: () => void;
};

export const useQuizStore = create<QuizState>()(
  persist(
    (set) => ({
      respostas: {},
      email: null,
      whatsapp: null,
      cupom: null,
      letraFinal: null,
      // RESPONDER UMA PERGUNTA INVALIDA A LETRA ANTERIOR.
      //
      // `letraFinal` fica em localStorage e não expira. Quem já comprou e
      // clica em "Criar outra música" no painel volta pro /criar carregando a
      // letra da compra passada. Respondia o quiz novo inteiro, chegava na
      // revelação, e a tela via que JÁ EXISTIA uma letra — não gerava nada,
      // mostrava a antiga, e seguia pra oferta.
      //
      // Aconteceu em 11/08: um comprador respondeu um quiz pra filha, viu a
      // letra que ele tinha feito pra esposa três dias antes, pagou R$ 37, e
      // não existia nenhuma música pra entregar. Abriu ticket. Ele tinha
      // tentado duas vezes, o que sugere que a primeira falhou igual.
      //
      // Quebra a regra mais importante do projeto: nunca cobrar por algo que
      // ainda não foi produzido.
      //
      // Limpar aqui, e não no botão do painel, cobre TODOS os caminhos de
      // volta ao funil — painel, link salvo, histórico do navegador. E é o que
      // a semântica pede: se as respostas mudaram, a letra gerada com as
      // antigas não vale mais.
      //
      // Não atrapalha a coautoria: lá a pessoa mexe na LETRA (setLetraFinal),
      // não nas respostas. E o `/retomar` grava as respostas ANTES da letra,
      // então a ordem já está certa.
      setResposta: (field, value) =>
        set((s) => ({
          respostas: { ...s.respostas, [field]: value },
          letraFinal: null,
        })),
      setEmail: (email) => set({ email }),
      setWhatsapp: (whatsapp) => set({ whatsapp }),
      setCupom: (cupom) => set({ cupom }),
      setLetraFinal: (letraFinal) => set({ letraFinal }),
      reset: () => set({ respostas: {}, email: null, whatsapp: null, cupom: null, letraFinal: null }),
    }),
    { name: "mp_quiz" },
  ),
);
