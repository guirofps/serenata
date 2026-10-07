import { expect, it } from "vitest";
import { useQuizStore } from "./quiz-store";

it("reset() apaga o quiz mas guarda o cupom (quem comprou e volta pra criar outra)", () => {
  useQuizStore.getState().setCupom("MUSICA10");
  useQuizStore.getState().setEmail("a@b.com");
  useQuizStore.getState().reset();
  expect(useQuizStore.getState().email).toBeNull();
  expect(useQuizStore.getState().cupom).toBe("MUSICA10");
});
