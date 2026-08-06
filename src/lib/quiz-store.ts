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
};

type QuizState = {
  respostas: Record<string, string | string[]>;
  email: string | null;
  letraFinal: LetraFinal | null;
  setResposta: (field: string, value: string | string[]) => void;
  setEmail: (email: string) => void;
  setLetraFinal: (l: LetraFinal) => void;
  reset: () => void;
};

export const useQuizStore = create<QuizState>()(
  persist(
    (set) => ({
      respostas: {},
      email: null,
      letraFinal: null,
      setResposta: (field, value) =>
        set((s) => ({ respostas: { ...s.respostas, [field]: value } })),
      setEmail: (email) => set({ email }),
      setLetraFinal: (letraFinal) => set({ letraFinal }),
      reset: () => set({ respostas: {}, email: null, letraFinal: null }),
    }),
    { name: "mp_quiz" },
  ),
);
