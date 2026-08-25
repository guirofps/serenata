import { trackEvent } from "@/lib/track";

// OS DOMÍNIOS A UM TOQUE, embaixo do campo de e-mail.
//
// ── POR QUE ISTO EXISTE ──────────────────────────────────────────
//
// O e-mail é o ÚNICO canal do produto: quem digita errado paga, não recebe a
// música, não recebe o link de acesso e não tem como reclamar. Medido na base:
// 9 pessoas escreveram `gmail..com`, e a validação do quiz (`/.+@.+\..+/`)
// aprova isso sem piscar.
//
// Já existe a correção de typo (`sugerirEmail`), que age DEPOIS do erro. Isto
// aqui age antes: a parte mais fácil de errar é justamente a que é sempre
// igual, e digitar "@gmail.com" no teclado do celular, com o arroba escondido
// atrás de uma tecla de símbolos, é onde a mão escorrega.
//
// ── QUAIS DOMÍNIOS, E POR QUE SÓ QUATRO ──────────────────────────
//
// Medido em 8.607 e-mails da base: gmail 91%, hotmail 6%, yahoo.com.br 1,2%,
// outlook 0,8%. Estes quatro cobrem 98%.
//
// Mais botões não cobrem mais gente, cobrem menos: numa fileira de dez, a
// pessoa lê todos antes de escolher, e a decisão que era automática vira
// trabalho. Quem usa domínio de empresa digita inteiro, como sempre digitou.

const DOMINIOS = ["gmail.com", "hotmail.com", "outlook.com", "yahoo.com.br"];

export function SugestoesDominio({
  valor,
  onEscolher,
}: {
  valor: string;
  onEscolher: (email: string) => void;
}) {
  const bruto = (valor ?? "").trim();
  // Nada a sugerir antes de a pessoa começar. Dois caracteres é o suficiente
  // pra saber que ela está digitando e não só tocou no campo.
  if (bruto.length < 2) return null;

  const at = bruto.lastIndexOf("@");
  const local = at > 0 ? bruto.slice(0, at) : bruto;
  const depoisDoArroba = at >= 0 ? bruto.slice(at + 1).toLowerCase() : "";

  // Já terminou de escrever um domínio da lista? Então os botões viraram
  // ruído, e ruído embaixo de um campo preenchido parece erro.
  if (DOMINIOS.includes(depoisDoArroba)) return null;
  // Sem parte local não há o que completar ("@gmail.com" sozinho não é e-mail).
  if (!local) return null;

  // Enquanto ela digita o domínio, a lista se estreita. É o mesmo movimento de
  // uma busca: quem escreveu "@ho" já disse que não quer gmail.
  const candidatos = depoisDoArroba
    ? DOMINIOS.filter((d) => d.startsWith(depoisDoArroba))
    : DOMINIOS;
  if (!candidatos.length) return null;

  return (
    <div className="mx-auto flex max-w-md flex-wrap items-center justify-center gap-2">
      {candidatos.map((d) => (
        <button
          key={d}
          type="button"
          // `onMouseDown` com `preventDefault`, e não `onClick`: no celular o
          // toque tira o foco do campo antes do clique chegar, o teclado
          // desce, a tela pula e o botão erra o alvo. Assim o foco fica onde
          // está e a pessoa continua digitando se quiser.
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            const completo = `${local}@${d}`;
            trackEvent("email_dominio_sugerido", { dominio: d });
            onEscolher(completo);
          }}
          className="inline-flex h-11 items-center rounded-full border border-[var(--tinta-fraca)] px-4 text-sm text-muted-foreground transition-colors hover:border-[var(--acento)] hover:text-[var(--acento)]"
        >
          @{d}
        </button>
      ))}
    </div>
  );
}
