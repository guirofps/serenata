# Auditoria da Serenata contra o Playbook Movify

Aplicação do *Playbook de Páginas de Venda — Movify (v1)* ao nosso produto.
Feita em 24/07/2026. Só o que é verificável: cada item foi conferido no
código ou medido.

---

## O que o playbook já valida do que fizemos

| Nossa decisão | Regra do playbook |
|---|---|
| Removi a foto de "cliente emocionada" gerada por IA | §3.5: *"Se não tem depoimento ainda, use número, logo ou dado de mercado. **Nunca invente**"* |
| Paleta derivada de "papel e vinho", não do preset escuro | §3.4 (autocrítica): *"a paleta vem do universo do cliente, não do nosso último projeto"* |
| Stack React+Vite+TS, Tailwind, shadcn, Supabase, Vercel | §10: é exatamente o stack padrão |
| Promessa conservadora de tempo, sem barra de progresso falsa | §9: *"Específico ganha de esperto"* |

---

## Violações encontradas (por gravidade)

### 🔴 P1 — Peso e performance

| Item | Estado | Meta |
|---|---|---|
| Rascunhos de logo em `public/` | **21 MB** sendo publicados | — |
| Logo PNG | 447 KB | §6: ícone não é PNG pesado |
| Página total | não medido em 4G | < 1,5 MB |

**Corrigido:** rascunhos movidos pra `docs/marca-rascunhos/`; logo convertida
pra WebP (**447 KB → 37 KB**, 12x menor), com `width`/`height` declarados
(anti-CLS) e `fetchpriority="high"`.

### 🔴 P1 — Arquitetura da página (§2)

O playbook define 12 blocos, com objeção que cada um derruba. Temos 4.

| # | Bloco | Objeção | Temos? |
|---|---|---|---|
| 01 | Herói: promessa + mecanismo + CTA | "O que é isso?" | ✅ |
| 02 | Prova imediata (número, selo) | "Isso é sério?" | ❌ |
| 03 | Dor nomeada | "Isso é pra mim?" | ❌ |
| 04 | Mecanismo em 3 passos | "Por que funciona?" | ✅ |
| 05 | Benefícios em cards | "O que eu ganho?" | ❌ |
| 06 | Demonstração | "Me mostra" | ✅ (exemplo tocável) |
| 07 | Prova social | "Funcionou pra alguém?" | ❌ bloqueado (sem cliente real) |
| 08 | Ancoragem de valor | "Tá caro" | ❌ |
| 09 | Oferta + garantia | "E se der errado?" | ❌ |
| 10 | FAQ (6 objeções) | dúvidas residuais | ❌ |
| 11 | CTA final | fechamento | ✅ |
| 12 | Barra flutuante de CTA | resgate de scroll | ❌ |

**Faltam 7 blocos obrigatórios.** É a causa do "está seco" — não é falta de
animação, é falta de argumento.

### 🟡 P2 — Motion (§4, §5)

Zero animação hoje. O playbook libera GSAP (100% gratuito desde 04/2025,
todos os plugins) e manda: **estado → Framer Motion, scroll e tempo → GSAP**.

Regras a respeitar quando implementar:
- Só `transform` e `opacity`
- Reveal curto: 24–40px, 300–600ms, stagger 60–100ms
- **O H1 do herói NÃO pode depender de JS** (mata o LCP — §5.5)
- `gsap.matchMedia()` com `prefers-reduced-motion`
- `useGSAP()` pra cleanup automático no React

### 🟡 P2 — Tipografia e espaçamento (§3.2, §3.3)

- Sem escala fluida com `clamp()` — hoje são breakpoints soltos
- Sem escala de espaçamento 4/8 documentada
- Espaço entre seções: playbook pede 96–128px desktop / 56–72px mobile

### 🟡 P2 — Uma cor de destaque só (§3.4)

Temos **vinho + ouro**. A regra é *"máximo 1 cor de destaque; a cor do CTA
não aparece em mais nada"*. Decisão: **vinho é o CTA**, ouro fica restrito a
fio/detalhe e ao mundo escuro do presente — nunca em botão.

### 🟡 P2 — Estados de componente (§3.7)

Playbook exige 5 estados (padrão, hover, foco **visível**, ativo/carregando,
desabilitado) e 3 condições de tela (conteúdo, vazio, erro). Nosso quiz tem
loading e erro; falta foco visível consistente e estado vazio desenhado.

### 🟢 P3 — Medição (§8)

Temos painel próprio com funil e custos. Falta o que o playbook exige pra
tráfego pago: GTM, Pixel + CAPI, UTM por criativo, e o teste final —
*"faz uma compra real com Pix e confere se o Purchase cai"*.

---

## Ordem sugerida (custo × impacto)

1. ✅ **Peso** — feito (21 MB fora, logo 12x menor)
2. **Os 7 blocos que faltam** — é o que faz o site parecer incompleto
3. **Escala tipográfica com `clamp()`** + espaçamento 4/8
4. **Motion com GSAP** — depois do conteúdo existir, nunca antes
5. **Estados e foco visível**
6. **Medição** — quando houver tráfego

> Regra do playbook que vale repetir aqui: *"Estética é a quinta prioridade."*
> Animação antes de conteúdo é o erro que a gente estava prestes a cometer.
