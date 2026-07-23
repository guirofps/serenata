# Roadmap — Serenata

Auditoria honesta do que existe, do que falta e do que depende do quê.
Escrito em 23/07/2026 porque o trabalho estava pulando de assunto e coisas
começadas ficavam pelo caminho.

**Regra deste documento:** nada entra como "pronto" sem ter sido verificado
funcionando. Nada sai daqui sem estar feito.

---

## Estado atual em uma frase

O **motor funciona** (quiz → letra → música → karaokê, automático, medido e
barato). Falta **tudo em volta**: o site com cara de produto, o entregável
completo, o pagamento e a plataforma.

---

## ✅ Pronto e verificado

| O quê | Prova |
|---|---|
| Quiz de 8 passos + contato | Rodando em produção |
| Captura de lead a cada passo | 17 leads no banco |
| Ditado por voz (Web Speech) | Testado pelo dono |
| Validação anti-lixo da história | 5 casos reais barrados |
| Letra (Sonnet 5) | 97% de detalhes concretos, R$ 0,06–0,22 |
| Letra persistida (a lida = a cantada) | Bug de race corrigido |
| Música automática (Suno/kie.ai) | 6 músicas, 118–247s, R$ 0,32 |
| Karaokê real por timestamps | 211–262 palavras alinhadas |
| Página-presente `/p/$token` | 6 páginas no ar |
| Painel com funil, produção e custos | `/admin`, auth HMAC |
| Marca: nome, paleta, tipografia | Serenata, serenatagift.com |

---

## FASE A — Site que vende (o mais urgente)

A landing tem 4 seções; a referência (Cantoria) tem 7. Não é questão de
gosto: **falta estrutura de persuasão**.

| # | Item | Depende de | Status |
|---|---|---|---|
| A1 | **Logo definitiva** (opções geradas, escolher 1) | — | 2 opções prontas, faltam mais |
| A2 | Seção **"Ouça antes de pagar"** com 3–4 músicas reais | músicas prontas ✅ | falta |
| A3 | Seção **Ocasiões** (aniversário, casamento, mãe, memorial…) | — | falta |
| A4 | Seção **Preço** (âncora + o que inclui) | definir preço | falta |
| A5 | Seção **Depoimentos** — só quando houver cliente real | primeiras vendas | bloqueado |
| A6 | Seção **FAQ** | — | falta |
| A7 | **Animações e transições** (entrada de seção, hover, player) | — | falta |
| A8 | Aplicar a marca no **quiz** (hoje é cinza placeholder) | A1 | falta |
| A9 | Aplicar a marca na **página-presente** (logo + tipografia) | A1 | falta |
| A10 | **OG image** e favicon (o link no WhatsApp precisa ser bonito) | A1 | falta |

---

## FASE B — Entregável completo

Hoje a página-presente mostra letra + música. Falta o que a torna **presente**.

| # | Item | Depende de | Status |
|---|---|---|---|
| B1 | **Foto na capa** da página | upload | falta |
| B2 | **Upload de foto** (pós-pagamento ou na espera) | decisão de fluxo | falta |
| B3 | **Mensagem do comprador** exibida no presente | editor | falta |
| B4 | **QR Code** gerado no servidor, pronto pra imprimir | — | falta |
| B5 | **Download do MP3** com nome bonito | ✅ existe, falta polir | parcial |
| B6 | **Área do comprador**: link + mensagem pronta pra copiar | contas | falta |
| B7 | **Agendamento** (quando a página "abre") | B6 | falta |
| B8 | Segunda versão como **brinde** ("quer outra versão?") | ✅ v2 salva | falta UI |

---

## FASE C — A espera vira construção

Decisão já tomada: os ~2 min de geração da música viram **montagem do
presente**, não spinner. Cuidado combinado: **não pode virar trabalho** —
duas interações de um toque, tudo pulável.

| # | Item | Depende de | Status |
|---|---|---|---|
| C1 | Tela de espera com progresso **honesto** (estágios reais do provedor) | — | parcial (texto fixo) |
| C2 | Upload de 1 foto durante a espera | B2 | falta |
| C3 | Mensagem sugerida (editável em 1 toque) | — | falta |
| C4 | "Sair não é fatal": música continua e chega por e-mail | e-mail | falta |
| C5 | A música **interrompe** a montagem quando fica pronta | C1 | falta |

---

## FASE D — Pagamento

**Bloqueado:** Mercado Pago exige site em produção pra liberar credenciais.
Destravado assim que o domínio estiver no ar.

| # | Item | Depende de | Status |
|---|---|---|---|
| D1 | Registrar `serenatagift.com` | — | com o dono |
| D2 | Apontar domínio pra Vercel | D1 | falta |
| D3 | Credenciais de produção do MP | D2 | bloqueado |
| D4 | Chave PIX na conta MP | conta real | falta |
| D5 | Cobrança PIX transparente (QR na nossa página) | D3 | falta |
| D6 | Webhook assinado, fail-closed, idempotente | D3 | falta |
| D7 | Publicar o presente só após confirmação | D6 | falta |
| D8 | E-mail de entrega (Resend, chave já validada) | D7 | falta |

---

## FASE E — Plataforma (a visão de SaaS)

| # | Item | Depende de | Status |
|---|---|---|---|
| E1 | **Contas de comprador** (hoje o funil é anônimo) | — | falta |
| E2 | Entidade **`presentes`** (documento editável ≠ música) | E1 | falta |
| E3 | Editor da página pós-compra | E2 | falta |
| E4 | Publicação/despublicação (o link só vive se pago) | E2 | falta |
| E5 | Planos (24h vs vitalício — o truque do Lovepanda) | D5 | falta |
| E6 | Multi-produto e créditos por geração | E5 | futuro |

---

## Dívidas técnicas conhecidas

| Item | Gravidade |
|---|---|
| **v2 como principal não pega em geração nova** — promovo na mão (R$ 0,013) | alta |
| Músicas antigas presas em `aguardando` sem retry automático | média |
| Só **um** provedor de música (o PLANO exige failover testado) | média |
| Script de link nomeia arquivos por ordem, não por qual é principal | baixa |
| Revisão do quiz ainda com cara de debug | baixa |

---

## Ordem sugerida

1. **A1** (logo) → destrava A8, A9, A10
2. **A2–A4, A6, A7** — o site vira vendável
3. **D1–D2** (domínio) → **destrava o Mercado Pago**
4. **B1–B4** — o entregável fica completo
5. **D3–D8** — passa a vender de verdade
6. **C1–C5** — a espera deixa de ser atrito
7. **E1–E4** — vira plataforma

O item 3 é o mais barato e destrava o mais caro. Vale fazer cedo.
