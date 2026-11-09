# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

delegated: Node.js + React (Vite) no front, servidor Express leve no back, banco local SQLite (node:sqlite nativo). Escolhido para rodar com um único comando na máquina do usuário, sem infraestrutura paga, e permitir que o time comercial acesse pela rede local.

## Users

- **Primário:** o dono da Synch (empresa de tecnologia que cria sites) prospectando comércios locais.
- **Secundário:** vendedores do time comercial da Synch, que dividem os leads e registram o andamento de cada abordagem.
- **Situação:** sessões de prospecção ativa — escolher cidade + segmento, ver quem não tem site, priorizar quem tem mais chance de comprar e abordar por WhatsApp/telefone.

## Product Purpose

Encontrar estabelecimentos comerciais que precisam de site e ordená-los pela probabilidade de fechar compra, para que o time gaste tempo só com leads quentes. Sucesso = mais reuniões e contratos por hora de prospecção.

## Positioning

Não é uma lista de empresas: é uma fila priorizada. Cada lead vem com uma pontuação de propensão de compra explicável (quais sinais somaram e quais subtraíram) e um roteiro de abordagem adaptado à dor detectada (sem site, site quebrado, só Instagram, site sem HTTPS/mobile, etc.).

## Operating Context

- Fonte de dados: OpenStreetMap (Overpass API, grátis, sem chave) sempre disponível; Google Places API (New) ativado quando o usuário cadastra a chave — traz avaliação, nº de reviews, telefone, horário, status e site.
- Verificação de presença digital: o servidor visita o site informado (quando existe) e audita HTTPS, responsividade mobile, ano do copyright, tempo de resposta, se é só link de rede social/agregador (Instagram, Linktree, iFood, Facebook).
- Abordagem: WhatsApp (link wa.me) e ligação; o time registra status (novo, contatado, em negociação, ganho, perdido).
- Uso em português do Brasil.

## Capabilities and Constraints

- Busca por cidade/bairro + segmento (nicho) com raio.
- Pontuação de propensão 0–100 com explicação por sinal.
- Pipeline compartilhado entre vendedores (atribuição + status + notas).
- Exportação CSV.
- Sem login/autenticação por senha nesta versão (uso em rede local confiável); vendedor se identifica por nome.
- Undecided: hospedagem em nuvem; integração com CRM externo.

## Brand Commitments

- Nome da empresa: **Synch**. Produto: Synch Search.
- Preferência visual confirmada pelo usuário (2026-11-06): o padrão da categoria de ferramentas de prospecção/CRM, executado no nível de acabamento de **Attio** e **Apollo.io**. Sem tema "fantasia"; a marca vive nos detalhes de precisão.
- **Cores da marca: preto e branco** (confirmado pelo usuário em 2026-11-06). Cor só aparece onde carrega significado (temperatura do lead, pontos +/−, WhatsApp, ganho/perdido).
- **Logo:** um "S" geométrico com linhas de velocidade, branco sobre preto. Original enviado pelo usuário em `brand/synch-logo-original.jpg` (150 px, baixa resolução); versão vetorial redesenhada a partir dele em `brand/synch-mark.svg` e `web/public/synch-mark.svg`. Se existir o arquivo vetorial oficial, ele substitui o redesenho.

## Evidence on Hand

- Nenhum dado histórico de vendas da Synch ainda. A pontuação começa com pesos heurísticos e deve aprender com os leads marcados como ganho/perdido. Não inventar taxas de conversão.

## Product Principles

1. Priorizar, não listar: o primeiro lead da tela é o que mais vale uma ligação agora.
2. Toda pontuação se explica — o vendedor precisa de argumento, não de número mágico.
3. A dor detectada vira o gancho da abordagem.
4. Aprender com o resultado real (ganho/perdido) em vez de pesos fixos para sempre.
