import { useCallback, useEffect, useRef, useState } from "react";

// Ditado por voz usando a Web Speech API do navegador (pt-BR).
// Escolha deliberada pra Fase 1: zero chave, zero custo, zero servidor —
// e é o passo de maior abandono do quiz (falar 60s rende muito mais detalhe
// que digitar 120 caracteres no ônibus).
// Quem não tiver suporte continua digitando normalmente (o campo nunca some).
//
// Quando a qualidade exigir, dá pra trocar por MediaRecorder + Whisper
// server-side sem mexer na UI: a interface deste hook continua a mesma.

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  0: { transcript: string };
};
type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: { length: number; [i: number]: SpeechRecognitionResultLike };
};
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * O que deu errado no ditado, como CÓDIGO (16/10). A frase sai em quem mostra
 * (`StoryStep`, pelos textos do idioma do funil): o hook não sabe o idioma da
 * tela, e as frases em português daqui apareciam no inglês e no espanhol.
 */
export type ErroDitado = "sem_suporte" | "sem_permissao" | "sem_fala" | "falhou";

/** O código do `onerror` da Web Speech API traduzido pro nosso. */
export function erroDoReconhecedor(cod: string | undefined): ErroDitado {
  if (cod === "not-allowed") return "sem_permissao";
  if (cod === "no-speech") return "sem_fala";
  return "falhou";
}

export type DictationState = {
  suportado: boolean;
  gravando: boolean;
  erro: ErroDitado | null;
  parcial: string;
  alternar: () => void;
};

export function useDictation(
  onTexto: (trecho: string) => void,
  lang: string = "pt-BR",
): DictationState {
  const [suportado, setSuportado] = useState(false);
  const [gravando, setGravando] = useState(false);
  const [erro, setErro] = useState<ErroDitado | null>(null);
  const [parcial, setParcial] = useState("");
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  // Guarda o callback num ref: evita recriar o reconhecedor a cada tecla.
  const onTextoRef = useRef(onTexto);
  onTextoRef.current = onTexto;
  // O interino também num ref: `parar` precisa lê-lo no instante do clique,
  // e um closure sobre o state leria o valor do render anterior.
  const parcialRef = useRef("");

  useEffect(() => {
    setSuportado(getRecognitionCtor() !== null);
  }, []);

  const parar = useCallback(() => {
    // Aproveita o que estava sendo falado e ainda não virou resultado final.
    // Sem isso, a última frase (justamente a que a pessoa acabou de dizer
    // antes de apertar "parar") é jogada fora.
    const restante = parcialRef.current.trim();
    if (restante) onTextoRef.current(restante);
    parcialRef.current = "";
    recRef.current?.stop();
    recRef.current = null;
    setGravando(false);
    setParcial("");
  }, []);

  const iniciar = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setErro("sem_suporte");
      return;
    }
    setErro(null);
    const rec = new Ctor();
    // O idioma do FUNIL, não do navegador: um mexicano com o Chrome em
    // inglês ditando em espanhol tem que ser reconhecido em espanhol.
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (e) => {
      let interino = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const t = r[0].transcript;
        if (r.isFinal) {
          // Só o texto FINAL entra no campo (o interino é só preview).
          onTextoRef.current(t.trim());
        } else {
          interino += t;
        }
      }
      parcialRef.current = interino;
      setParcial(interino);
    };
    rec.onerror = (e) => {
      setErro(erroDoReconhecedor(e.error));
      setGravando(false);
      recRef.current = null;
    };
    // O reconhecedor encerra sozinho por silêncio, sem passar pelo `parar`.
    // Aqui o interino também precisa ser aproveitado, pelo mesmo motivo.
    rec.onend = () => {
      const restante = parcialRef.current.trim();
      if (restante) onTextoRef.current(restante);
      parcialRef.current = "";
      setGravando(false);
      setParcial("");
      recRef.current = null;
    };

    recRef.current = rec;
    rec.start();
    setGravando(true);
  }, [lang]);

  // Solta o microfone se o componente sair da tela no meio da gravação.
  useEffect(() => () => recRef.current?.stop(), []);

  const alternar = useCallback(() => {
    if (gravando) parar();
    else iniciar();
  }, [gravando, iniciar, parar]);

  return { suportado, gravando, erro, parcial, alternar };
}
