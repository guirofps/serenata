import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { type Locale, LOCALES, localeDaRota } from "@/lib/i18n";
import { ArrowRight } from "lucide-react";

// "¿Prefieres español?" — a rede pra quem cai no idioma errado.
//
// O buraco: um comprador mexicano volta pra buscar o presente dele e digita
// `serenatagift.com`, que é o domínio que ele lembra. Cai na home BRASILEIRA.
// Tudo funciona (o e-mail, o editor e a página-presente saem do banco, em
// espanhol), mas a tela na frente dele está na língua errada.
//
// NÃO É REDIRECIONAMENTO. Continua valendo a decisão do CLAUDE.md: redirecionar
// automático quebra o Google Ads (anuncia-se uma URL e a pessoa cai em outra),
// impede indexar as duas versões, e um brasileiro com VPN cairia no espanhol.
// Isto é uma OFERTA: uma linha discreta, que a pessoa toca se quiser.
//
// E não adivinha nada. Só aparece pra quem JÁ passou pelo funil do outro
// idioma neste navegador — o que cobre exatamente o caso que existe (voltar
// pra buscar o próprio presente), sem inventar sobre visitante novo.

const CHAVE = "mp_idioma_visto";

/** Marca que este navegador já esteve no funil deste idioma. */
export function lembrarIdioma(locale: Locale) {
  try {
    localStorage.setItem(CHAVE, locale);
  } catch {
    // Modo anônimo ou storage cheio: perder a lembrança é aceitável, é rede.
  }
}

const ROTULO: Record<Locale, string> = {
  pt: "Ver em português",
  es: "¿Prefieres español?",
};

export function OfereceIdioma() {
  // Renderiza vazio no servidor e no primeiro render do cliente: o localStorage
  // não existe no SSR, e divergir aqui daria erro de hidratação.
  const [outro, setOutro] = useState<Locale | null>(null);

  useEffect(() => {
    let visto: string | null = null;
    try {
      visto = localStorage.getItem(CHAVE);
    } catch {
      return;
    }
    if (!visto || !LOCALES.includes(visto as Locale)) return;
    const atual = localeDaRota(window.location.pathname);
    // Só oferece se o idioma lembrado for DIFERENTE do que está na tela.
    if (visto !== atual) setOutro(visto as Locale);
  }, []);

  if (!outro) return null;

  return (
    <div className="border-b border-[var(--tinta-fraca)]/30 bg-[var(--papel-fundo)]">
      <div className="mx-auto flex max-w-6xl items-center justify-center gap-2 px-6 py-2">
        <Link
          to={outro === "es" ? "/es" : "/"}
          className="inline-flex items-center gap-1.5 text-[var(--acento)] underline underline-offset-4"
          style={{ fontSize: "var(--t-xs)" }}
        >
          {ROTULO[outro]} <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}
