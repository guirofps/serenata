# AnimaVida (animavidaoficial.com.br) — engenharia reversa (16/10/2026)

## Quem é
- **É do mesmo grupo da LoveTune.** As mídias do site saem de `lovetune-media.encanta-midia-fc13cb.workers.dev`
  (Cloudflare Workers da "encanta-midia"), o mesmo CDN da LoveTune.
- Stack: **Lovable** (`~flock.js`, `__l5e/events`), TanStack Start (`createServerFn`), **Supabase**
  (`cclwdmhbpxzabxyafpri`), **Resend**, checkout transparente **Pagar.me** (cartão tokenizado no front), pixel da Meta.
- "Mais de 300 vídeos criados" no topo da home.

## O produto
- **Trailer de animação 3D da história do casal/família/amigos/pet**, com os personagens criados a partir das fotos.
- 3 estilos: Cinema 3D (Pixar), Miniaturas 3D, Massinha 3D.
- **Vertical 9:16, 40s, 5 cenas: R$ 97.** Cinema 16:9, 7 cenas, + pôster digital + álbum "diário": **R$ 197**.
- Até 3 personagens; 4 a 6 por **+R$ 29,90**. Duração maior e **entrega expressa** opcionais no checkout. Resolução
  maior ("mais nitidez") também é opcional.
- Inclui: roteiro a partir da história, introdução e encerramento com a mensagem, **narração e trilha**, vídeo pra
  baixar, **pôster PDF com QR Code** pro filme. Portal do cliente com os vídeos ("Vídeo disponível no seu portal").
- **Entrega em até 8h** na home, "até 24h" no rodapé do plano (a mesma contradição de prazo da ForeverSongs).
- Funil: quiz (quem aparece, lembrança, mensagem, estilo) → **proposta de roteiro pra revisar antes de pagar**
  (2 opções: "Sua história" e "Conto emocionante") → checkout → fotos depois do pagamento (até 6) → produção.
- **"Cliente influencer":** grava a reação, posta Reels com @animavida.oficial como colaboradora → 30% de desconto
  no próximo vídeo. Gera UGC de reação de graça.
- Ajustes depois da entrega: tela "AdjustmentConversation" com **Claude Haiku 4.5** (custo da IA medido por pedido)
  e respostas padrão no admin, entre elas **"não parece a gente"** — a reclamação recorrente é semelhança.

## Como produzem (pelo painel de admin no bundle)
- Tela **"Fluxo de produção do pedido / Mapa de produção"**, por TAKE: "Imagem inicial: posição, expressão e
  cenário", "Imagem final: onde a ação termina", "Movimento de câmera", "O que acontece neste take", "Continuidade:
  roupa, objetos, luz e direção do olhar", "Narração e falas em português", "Custo realizado (R$)".
- Ou seja: **imagem-para-vídeo com quadro inicial e final** (Kling/Seedance/Veo/Wan), keyframes gerados com os
  personagens consistentes (Nano Banana/GPT-Image/Seedream a partir das fotos), narração por TTS e trilha, e
  montagem. **Semi-manual**: um operador monta o mapa de takes e confere (por isso 8-24h).
- Admin também tem: exportar públicos, filmes entregues, vendas avulsas, alterações de vídeo, acervo, presentes,
  influenciadores, integrações.

## O anúncio (Instagram DdpC7x-sEpr, 1min55)
- Tela dividida: **em cima o trailer 3D** (castelo, falésias, celular, letreiros "This Spring… will change… Will
  you marry me?"); **embaixo a reação do casal no sofá** vendo na TV. É um **pedido de casamento**: o trailer
  termina com a pergunta e ele pede. Fecha com o cartão da AnimaVida.
- Mesmo formato do nosso "letra + reação" (split-screen), com um gancho de proposta de casamento.

## Custo estimado de produção (preços do kie.ai, conta que já temos)
| etapa | estimativa |
|---|---|
| Ficha dos personagens a partir das fotos (Nano Banana/Seedream, ~4-6 imagens) | US$ 0,10-0,25 |
| Keyframes (inicial + final) de 6-8 takes, com refação | US$ 0,30-0,80 |
| Imagem-para-vídeo, 6-8 clipes de 5s (Wan 2.6 flash 1080p US$ 0,15; Seedance/Kling ~2-4x), com 1 refação | US$ 1,80-6 |
| Roteiro e prompts (Claude) | US$ 0,05 |
| Narração (opcional: no nosso caso a trilha é A MÚSICA da pessoa) | US$ 0-0,30 |
| Montagem (Remotion na Lambda, já temos) | US$ 0,04 |
| **Total** | **~US$ 2,5-7,5 ≈ R$ 13-40 por vídeo** |

## Como vira upsell da Serenata (proposta)
- **"Clipe animado da sua música"**: os personagens do casal em 3D vivendo as cenas da LETRA, com a MÚSICA deles
  de trilha e a letra acendendo. A AnimaVida tem trilha genérica; a gente teria a música original. É a união dos
  dois produtos e nenhum concorrente tem.
- Insumos que já temos: a história (quiz), a letra com timestamps (cada verso vira um take), a música, as fotos que
  o comprador sobe no editor, Remotion + Lambda pra montar, kie.ai pra imagem e vídeo, Claude pra roteiro.
- Preço de teste: **R$ 47 a R$ 67** (vertical, ~45s, refrão + 1 verso), ancorado nos R$ 97 da AnimaVida. Versão
  "música inteira" maior depois. Custo ~R$ 15-40 → margem de 40-70%, menor que a do vídeo de fotos (R$ 24,90 com
  custo de R$ 0,20), então só vale se vender pra uma fatia nova (casais, pedido de casamento, bodas).
- **Riscos:** (1) semelhança com as fotos é a reclamação nº 1 deles; (2) a regra da casa é 100% automático, sem
  operador, então precisa de portão de qualidade (rosto detectado, contagem de personagens, refazer take que sair
  ruim); (3) prazo: gerar 8 clipes leva 5-15 min, a entrega seria "em até 1 hora", não na hora.
- **Teste barato primeiro:** fazer 5 clipes à mão (com fotos de clientes que autorizaram ou de banco de imagem),
  medir custo e tempo reais, mostrar pro dono, e só então automatizar. Vender como A/B no editor (A = sem a oferta).
