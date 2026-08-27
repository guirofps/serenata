import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { mercadoEs } from "@/lib/mercado-es";

// O ALARME DO INTERRUPTOR.
//
// `mercado-es.ts` troca prompt da letra, gêneros, exemplo da abertura, quiz e
// moldura — tudo por sobreposição, tudo reversível. A tela de oferta é a
// exceção: a copy dela foi reescrita DIRETO em rioplatense porque são arrays
// de objetos com ícone, e um irmão inteiro custaria mais do que rende.
//
// Uma exceção sem alarme vira armadilha. Este teste é o alarme: no dia em que
// alguém virar a chave pra México ou Espanha, a suíte quebra aqui e diz o que
// falta fazer, em vez de a pessoa descobrir por um mexicano lendo "elegís".
describe("acoplamento entre o mercado ES e a copy da oferta", () => {
  // A oferta e os E-MAILS. Os dois foram reescritos direto, e os dois têm que
  // ser revisitados juntos quando o mercado mudar: quem recebe "Guardá este
  // correo" sendo mexicano lê um site estrangeiro na caixa de entrada.
  const arquivos = [
    "src/components/quiz/TelaOferta.tsx",
    "emails/presente-pronto.ts",
    "emails/acesso.ts",
    "emails/guarde-o-link.ts",
    "emails/letra-pronta.ts",
  ];
  const oferta = arquivos.map((f) => readFileSync(f, "utf8")).join(" ");
  // Formas que SÓ existem em voseo. Possessivo (`tuya`, `tu cuenta`) fica de
  // fora: é igual nos dois espanhóis e não prova nada.
  const voseo = [
    "mandás", "elegís", "podés", "pedís", "recibís", "sos vos", "escribís",
    "vos querés", "Escuchá", "Guardá", "Entrás",
  ];

  it("a copy ES escrita direto está em voseo, como o mercado argentino pede", () => {
    const achadas = voseo.filter((v) => oferta.includes(v));
    if (mercadoEs() === "argentina") {
      // Se isto falhar, alguém desfez a adaptação argentina sem querer.
      expect(achadas.length).toBeGreaterThan(3);
    } else {
      // Se ISTO falhar, o interruptor mudou e a oferta ficou pra trás.
      // Reescreva ENTREGAVEIS_ES e DUVIDAS_ES no espanhol do mercado novo.
      expect(achadas).toEqual([]);
    }
  });
});
