# O vídeo com fotos e letra na tela

Plano técnico, levantado em 02/09/2026. Nada foi construído ainda.

## Por que ele

É o plano marcado como **"MAIS ESCOLHIDA"** na vitrine da LoveTune, que é o
concorrente escalado do nosso mercado: *"5 fotos + letra no vídeo + as 2
músicas"*. Lá fora, a Songfinch vende verso extra a US$ 65,99, lançamento no
Spotify a US$ 49,99 e vinil a US$ 59,99, e **não entrega página
compartilhável nem letra sincronizada** — o presente deles é o arquivo.

É o maior upsell que existe hoje e que a gente não tem.

## O material bruto já está no banco

Medido em 02/09, sobre 949 músicas prontas com foto:

| | |
|---|---|
| Timestamps palavra a palavra | **944 de 949** (99,5%) |
| Fotos por presente, na média | **6,0** |
| Presentes com 5 fotos ou mais | 478 (50,4%) |
| MP3 limpo no Storage | todas |
| Duração média | ~4 minutos |

Os timestamps vêm do `get-timestamped-lyrics` da kie.ai, custam 0,5 crédito
(R$ 0,013) e **já são gerados hoje** para o karaokê da página presente. O
vídeo não precisa de nenhuma chamada nova de IA: ele é montagem do que já
existe.

Detalhe a tratar: o primeiro timestamp vem sujo com o marcador de estrutura
(`"[Short Intro - máx 8s]\nElzanira, "`). O karaokê da página já limpa isso;
o render precisa da mesma limpeza.

## Onde renderizar

Vercel não tem ffmpeg (está anotado no CLAUDE.md, foi o motivo de a rota de
prévia cortar ID3 na aritmética de buffer em vez de chamar ffmpeg). Então o
render tem que sair de casa. Quatro caminhos, com número:

| caminho | custo por vídeo | infra nova | controle do visual |
|---|---|---|---|
| **Remotion Lambda** | **~R$ 0,11** | AWS: Lambda, S3, IAM | total, é React |
| Creatomate / Shotstack | R$ 1,60 a R$ 13 | nenhuma | template deles |
| ffmpeg num VPS | ~R$ 0,02 + R$ 30/mês | servidor e ops | total, em linha de comando |
| Canvas no navegador | zero | nenhuma | total, mas **inviável** |

O Canvas está na tabela para ficar registrado por que **não** serve: 99% do
tráfego é celular, e gravar 4 minutos de canvas num aparelho intermediário
trava ou sai picotado. O produto é entregue, não renderizado pelo cliente.

**Recomendação: Remotion Lambda.** A licença é gratuita para empresa de até
3 pessoas, que é o nosso caso, e o custo é AWS direto, sem margem de
intermediário. R$ 0,11 é 0,4% de um upsell de R$ 24,90. As APIs prontas
custam de 15 a 120 vezes mais e ainda amarram o visual num template que não
é o nosso.

## O que construir, em ordem

1. **A composição em Remotion.** Foto com movimento lento ao fundo, letra
   acendendo palavra por palavra pelos timestamps, título e dedicatória na
   abertura, marca no fim. Precisa funcionar com **1 foto só**: metade dos
   presentes tem menos de 5.
2. **Deploy do renderizador na Lambda**, uma vez. Bucket S3 próprio.
3. **Job `gerarVideo` no Inngest**, disparado pela compra do upsell. Mesmo
   esqueleto do `gerarMusica`: chama, espera, baixa, limpa metadados, sobe no
   Storage.
4. **Bucket `videos` no Supabase**, com a mesma política dos áudios.
5. **A oferta**, e aqui vale a lição que o quadro acabou de dar: mostrar o
   produto antes de pedir dinheiro. O quadro vendia 23,7% enquanto a folha só
   aparecia depois do pagamento. O vídeo deve ter **prévia de 10 segundos
   renderizada da própria música da pessoa** antes do checkout.
6. **Entrega**: link no editor, na `/obrigado` e no e-mail, pelo
   `token_edicao`, nunca atrás de login. Ver `dono-por-token.ts`.

## Riscos, e o que fazer com cada um

**Dependência nova de nuvem.** Hoje o sistema é Vercel, Supabase, Inngest e
os provedores de IA. A AWS entra como quinta peça, com credencial própria e
um modo de falhar que ninguém conhece ainda. Mitigação: o vídeo é upsell, não
o produto principal — se ele cair, ninguém deixa de receber o que comprou.

**A regra de ouro.** "Nunca cobrar por algo que ainda não foi produzido" vale
aqui também. Ou o vídeo é renderizado antes de cobrar, como a música, ou a
falha do render tem que devolver o dinheiro sozinha. A segunda é mais simples
e o valor é menor; decidir antes de construir.

**Meio da base tem menos de 5 fotos.** A composição precisa ser boa com uma
foto. Se ficar pobre com uma e boa com cinco, a oferta tem que pedir as fotos
ANTES de vender, e aí vira um passo a mais no caminho.

**Tempo de render.** Um vídeo de 4 minutos leva minutos num processo só; a
Lambda paraleliza e devolve em segundos, ao mesmo custo (ela cobra por
GB-segundo, então 10 lambdas de 1 minuto custam o mesmo que 1 de 10). Isso é
o que torna a prévia de 10 segundos viável.

## O que isso vale

A R$ 24,90, com R$ 0,11 de render e ~R$ 0,50 de gateway, a margem é ~R$ 24.
O quadro, que é o upsell comparável e mais barato de produzir, vendeu 35
unidades desde que existe. Se o vídeo vender na mesma faixa, são ~R$ 850 por
mês de margem quase pura, e ele tem a vantagem de ser o formato que o líder
do mercado já provou que vende.

O que ele NÃO deve virar: um substituto da página presente. A página é o
produto e o diferencial contra quem entrega só arquivo. O vídeo é o que a
pessoa manda no status do WhatsApp.
