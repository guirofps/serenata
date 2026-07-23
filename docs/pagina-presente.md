# A página presente — análise e desenho

O entregável nunca foi desenhado. Este doc fecha isso, depois de dissecar a
página-presente real do Lovepanda (`/presente/demo-panda`, 23/07/2026).

## O que o Lovepanda entrega de verdade

A página deles é uma **imitação do Spotify**: barra inferior com
"Início / Pesquisar / Sua biblioteca" e uma faixa tocando no topo.

Seções, na ordem:

1. **Capa** — título ("Juntos para sempre ❤️") + faixa tocando com player
   (`Still Loving You · Panda`, 0:00 / -4:48)
2. **Sobre o casal** — nomes, "juntos desde 2022" e um **contador ao vivo**
   (3 anos, 10 meses, 12 dias, 10 horas, 32 min, 2 s)
3. **Mensagem especial** — texto longo escrito pelo comprador
4. **Galerias por categoria** — "Nossos Dates", "Fotos aleatórias",
   "Primeira viagem"
5. **Conquistas 17/30** — gamificação
6. **Wrapped** — a retrospectiva animada
7. **CTA final** — "Leonardo separou um presente especial! Ver Presente"

**Preços:** R$ 24,90 (24h) e R$ 29,90 (vitalício), ancorados em R$ 39,90 e
R$ 69,90. Pagamento único, PIX (EFI Bank) + cartão (Stripe), garantia de 14
dias. Cobram por **permanência** — a diferença entre os planos é só por
quanto tempo a página fica no ar (custo marginal zero).

**Eles estão entrando em música**: existe `/criar?produto=musica` no site.

## A leitura estratégica

A página inteira deles é construída **em volta de um player de música** —
eles sabem que a música é o que carrega a emoção. Mas a música deles é
**genérica, de catálogo** ("Panda" cantando "Still Loving You").

Nós temos a música **original, feita da história daquela pessoa**, com a
letra e os **timestamps palavra a palavra**. Mesma casca, carga emocional
incomparável. É exatamente a tese do CLAUDE.md, agora com evidência:

> A página é o presente. A música original é o que faz ela não ser igual
> às outras.

## O nosso desenho: a página é um DISCO, não um perfil

Em vez de imitar o Spotify (derivado e juridicamente arriscado), a página
se apresenta como **o lançamento de um disco de uma música só** — feita
para uma pessoa. A referência visual é uma página de release, não um app.

### Rota `/p/$token` — o que o presenteado vê

| # | Seção | Conteúdo |
|---|---|---|
| 1 | **Capa** | Foto (1 no plano base) + "uma música para {nome}" + título da música + "de {comprador}" |
| 2 | **O disco** | Player da música completa + **a letra acendendo palavra a palavra** (nosso karaokê real, via timestamps) |
| 3 | **A história** | O texto que o comprador contou, apresentado como encarte |
| 4 | **Fotos** | 1 no base; galeria é order bump |
| 5 | **Rodapé** | QR Code + "baixar a música" |

A seção 2 é a **nossa assinatura**: ninguém consegue copiar sem ter gerado a
música a partir daquela letra. O Lovepanda não pode fazer isso com música de
catálogo.

### O que NÃO construir (decisão mantida do CLAUDE.md)

Retrospectiva animada, timeline, álbum interativo, conquistas gamificadas.
É o negócio deles, feito há mais tempo e com custo zero. A gente compete com
a música original, não com galeria.

### Área do comprador (`/meu-presente`)

O comprador é quem entrega. A área dá:

- **Link da página** + **mensagem pronta pra copiar e colar** (variando por
  relação e ocasião)
- **QR Code** pra imprimir e colar numa caixa de bombom
- **Download do MP3** (as duas versões — o Suno entrega 2)
- **Agendamento**: escolher quando a página "abre" pro presenteado

## Preço — o que a comparação permite

O Lovepanda cobra R$ 24,90–29,90 por uma página **sem música original**.
Nós entregamos página + música original + letra + karaokê + MP3. O alvo de
R$ 37–50 fica defensável por comparação direta, e ainda por baixo do
LoveTune (R$ 67–97), que entrega a música mas **não tem página**.

Cobrar por permanência (24h vs vitalício) é o truque a copiar: custo
marginal zero, e vira upsell natural.

## Ordem de construção sugerida

1. `/p/$token` com capa + player + letra sincronizada (o coração)
2. Área do comprador com link, mensagem pronta e QR Code
3. Upload de foto (pós-pagamento)
4. Agendamento
