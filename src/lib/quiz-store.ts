import { create } from "zustand";
import { persist } from "zustand/middleware";

// Store das respostas do quiz, persistida em localStorage. Sobrevive a reload
// (junto com o passo na URL, garante retomada exata de onde parou).
// O sessionId vem do session-context (mp_session_id); aqui guardamos só as
// respostas e o contato, que são o insumo da letra e do lead.

type QuizState = {
  respostas: Record<string, string | string[]>;
  email: string | null;
  setResposta: (field: string, value: string | string[]) => void;
  setEmail: (email: string) => void;
  reset: () => void;
};

export const useQuizStore = create<QuizState>()(
  persist(
    (set) => ({
      respostas: {},
      email: null,
      setResposta: (field, value) =>
        set((s) => ({ respostas: { ...s.respostas, [field]: value } })),
      setEmail: (email) => set({ email }),
      reset: () => set({ respostas: {}, email: null }),
    }),
    { name: "mp_quiz" },
  ),
);
