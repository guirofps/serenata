import { createServerFn } from "@tanstack/react-start";
import {
  LETRA_SYSTEM,
  buildUserMessage,
  sanitizeNome,
  type LetraGerada,
} from "@/lib/letra-prompt";

// Geração da letra via Claude Sonnet 5. Roda no servidor (createServerFn):
// a chave nunca vai pro cliente. Custo medido ~R$ 0,06/letra numa tacada.
//
// Chamada por fetch na forma que já validamos (medir-custo-letra.mjs), pra
// não depender de detalhes de versão do SDK. Pede JSON no prompt e parseia —
// robusto e sob nosso controle.

const MODEL = "claude-sonnet-5";

export const gerarLetra = createServerFn({ method: "POST" })
  .validator((data: { respostas: Record<string, unknown> }) => data)
  .handler(async ({ data }): Promise<LetraGerada> => {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error("ANTHROPIC_API_KEY ausente no servidor");

    // Sanitiza o nome no CÓDIGO também, não só no prompt (bug da Cantoria).
    const nome = sanitizeNome(data.respostas.nome);
    const respostas = { ...data.respostas, nome: nome || "essa pessoa" };
    const userMsg = buildUserMessage(respostas);

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2000,
        output_config: { effort: "medium" },
        // System cacheável (prefixo estável).
        system: [{ type: "text", text: LETRA_SYSTEM, cache_control: { type: "ephemeral" } }],
        messages: [
          {
            role: "user",
            content: `${userMsg}

Escreva a letra completa no formato do sistema. Responda APENAS com um objeto JSON válido, sem texto antes ou depois, com as chaves: "titulo", "letra", "estilo_suno" (prompt de estilo pro gerador de música), "verso_destaque" (as duas linhas mais fortes).`,
          },
        ],
      }),
    });

    if (!r.ok) {
      const txt = await r.text();
      throw new Error(`Anthropic ${r.status}: ${txt.slice(0, 300)}`);
    }
    const j = await r.json();
    const text: string = j.content?.find((b: { type: string }) => b.type === "text")?.text ?? "";

    // Extrai o primeiro objeto JSON da resposta.
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1) {
      throw new Error("Resposta do modelo não continha JSON");
    }
    const parsed = JSON.parse(text.slice(start, end + 1)) as LetraGerada;
    return {
      titulo: String(parsed.titulo ?? "Sua música"),
      letra: String(parsed.letra ?? ""),
      estilo_suno: String(parsed.estilo_suno ?? ""),
      verso_destaque: String(parsed.verso_destaque ?? ""),
    };
  });
