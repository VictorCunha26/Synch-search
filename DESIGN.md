---
name: Synch Search
description: Fila priorizada de comércios que precisam de site, com a nota explicada sinal por sinal.
colors:
  ink: "#0a0a0a"
  bg: "#ffffff"
  bg-subtle: "#fafafa"
  bg-muted: "#f2f2f2"
  bg-hover: "#f6f6f6"
  border: "#e8e8e8"
  border-strong: "#d6d6d6"
  border-hover: "#c4c4c4"
  border-hover-field: "#bdbdbd"
  text: "#0a0a0a"
  text-2: "#565656"
  text-3: "#6b6b6b"
  notice-fg: "#3d3d3d"
  accent: "#0a0a0a"
  accent-hover: "#2b2b2b"
  accent-soft: "#f0f0f0"
  accent-text: "#0a0a0a"
  rail: "#0a0a0a"
  rail-hover: "#1a1a1a"
  rail-active: "#222222"
  rail-border: "#262626"
  rail-border-hover: "#3a3a3a"
  rail-text: "#a3a3a3"
  rail-text-strong: "#ffffff"
  hot: "#e5484d"
  hot-fg: "#b92b30"
  hot-bg: "#fdeeee"
  warm: "#f5a524"
  warm-fg: "#925000"
  warm-bg: "#fff4e0"
  cold: "#a3a3a3"
  cold-fg: "#525252"
  cold-bg: "#f2f2f2"
  pos: "#1f9d55"
  pos-fg: "#16723e"
  pos-bg: "#e8f6ee"
  pos-border: "#cdebd9"
  neg: "#e5484d"
  neg-fg: "#b92b30"
  need-bg: "#fff3ed"
  need-fg: "#a6400f"
  whatsapp: "#1c8d4c"
  whatsapp-hover: "#167a40"
  google-on: "#3ccf7a"
  google-on-halo: "rgba(60, 207, 122, 0.18)"
  knob-shadow: "rgba(0, 0, 0, 0.2)"
typography:
  score-display:
    fontFamily: "Inter Variable, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "26px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.02em"
    fontFeature: "'tnum'"
  headline:
    fontFamily: "Inter Variable, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "20px"
    fontWeight: 650
    lineHeight: 1.3
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Inter Variable, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "16px"
    fontWeight: 650
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  title-md:
    fontFamily: "Inter Variable, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "15px"
    fontWeight: 650
    lineHeight: 1.45
    letterSpacing: "-0.01em"
  title-sm:
    fontFamily: "Inter Variable, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "14px"
    fontWeight: 650
    lineHeight: 1.45
  body:
    fontFamily: "Inter Variable, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "13.5px"
    fontWeight: 400
    lineHeight: 1.45
    fontFeature: "'cv11', 'ss01'"
  body-sm:
    fontFamily: "Inter Variable, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.45
  caption:
    fontFamily: "Inter Variable, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "12.5px"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "Inter Variable, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "12px"
    fontWeight: 550
    lineHeight: 1.45
  label-xs:
    fontFamily: "Inter Variable, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "11.5px"
    fontWeight: 600
    lineHeight: 1.45
  micro:
    fontFamily: "Inter Variable, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "10.5px"
    fontWeight: 650
    lineHeight: 1
    letterSpacing: "0.02em"
  micro-sm:
    fontFamily: "Inter Variable, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "9.5px"
    fontWeight: 650
    lineHeight: 1
    letterSpacing: "0.02em"
rounded:
  bar: "2px"
  xs: "4px"
  sm: "5px"
  chip: "6px"
  md: "7px"
  toast: "8px"
  lg: "10px"
  score-lg: "12px"
spacing:
  "2": "2px"
  "4": "4px"
  "6": "6px"
  "8": "8px"
  "10": "10px"
  "12": "12px"
  "14": "14px"
  "16": "16px"
  "20": "20px"
  "24": "24px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.bg}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "32px"
    typography: "{typography.body}"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  button-secondary:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "32px"
  button-secondary-hover:
    backgroundColor: "{colors.bg-hover}"
    textColor: "{colors.text}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text-2}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "32px"
  button-ghost-hover:
    backgroundColor: "{colors.bg-muted}"
    textColor: "{colors.text}"
  button-sm:
    padding: "0 9px"
    height: "28px"
  button-whatsapp:
    backgroundColor: "{colors.whatsapp}"
    textColor: "{colors.bg}"
    rounded: "{rounded.md}"
    height: "32px"
  button-whatsapp-hover:
    backgroundColor: "{colors.whatsapp-hover}"
  input:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    padding: "0 10px"
    height: "32px"
  chip:
    backgroundColor: "{colors.bg-muted}"
    textColor: "{colors.text-2}"
    rounded: "{rounded.chip}"
    padding: "0 8px"
    height: "22px"
    typography: "{typography.label}"
  chip-accent:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent-text}"
  chip-need:
    backgroundColor: "{colors.need-bg}"
    textColor: "{colors.need-fg}"
  chip-broken:
    backgroundColor: "{colors.hot-bg}"
    textColor: "{colors.hot-fg}"
  chip-ok:
    backgroundColor: "{colors.pos-bg}"
    textColor: "{colors.pos-fg}"
  score-quente:
    backgroundColor: "{colors.hot-bg}"
    textColor: "{colors.hot-fg}"
    rounded: "{rounded.chip}"
    height: "22px"
    width: "34px"
  score-morno:
    backgroundColor: "{colors.warm-bg}"
    textColor: "{colors.warm-fg}"
    rounded: "{rounded.chip}"
    height: "22px"
    width: "34px"
  score-frio:
    backgroundColor: "{colors.cold-bg}"
    textColor: "{colors.cold-fg}"
    rounded: "{rounded.chip}"
    height: "22px"
    width: "34px"
  score-big:
    rounded: "{rounded.score-lg}"
    size: "64px"
    typography: "{typography.score-display}"
  sidebar:
    backgroundColor: "{colors.rail}"
    textColor: "{colors.rail-text-strong}"
    width: "232px"
  nav-item:
    textColor: "{colors.rail-text}"
    rounded: "{rounded.sm}"
    padding: "0 10px"
    height: "32px"
  nav-item-hover:
    backgroundColor: "{colors.rail-hover}"
    textColor: "{colors.rail-text-strong}"
  nav-item-active:
    backgroundColor: "{colors.rail-active}"
    textColor: "{colors.rail-text-strong}"
  avatar:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.bg}"
    size: "24px"
    typography: "{typography.micro}"
  avatar-sm:
    size: "20px"
    typography: "{typography.micro-sm}"
  table-row:
    height: "48px"
    padding: "0 10px"
  table-row-selected:
    backgroundColor: "{colors.accent-soft}"
  card:
    backgroundColor: "{colors.bg}"
    rounded: "{rounded.md}"
    padding: "10px"
  container-box:
    backgroundColor: "{colors.bg}"
    rounded: "{rounded.lg}"
    padding: "16px"
  notice:
    backgroundColor: "{colors.bg-subtle}"
    padding: "10px 20px"
  notice-error:
    backgroundColor: "{colors.hot-bg}"
    textColor: "{colors.hot-fg}"
  toast:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.bg}"
    padding: "9px 14px"
    rounded: "{rounded.toast}"
  lead-panel:
    backgroundColor: "{colors.bg}"
    width: "448px"
  filters-column:
    width: "248px"
---

# Design System: Synch Search

## Overview

**Creative North Star: "A Mesa de Prospecção"**

Synch Search é uma ferramenta de trabalho, não uma vitrine. O sistema segue o padrão da categoria de CRM e prospecção (filtros à esquerda, tabela densa no centro, painel do lead à direita) executado no nível de acabamento de Attio e Apollo.io, vestido com a identidade da Synch: preto e branco. Um trilho lateral preto carrega a marca em branco; a área de trabalho é branca, com cinzas neutros puros, e a ação é preta. Cor aparece só onde carrega significado: temperatura do lead, pontos que somam ou subtraem, o canal WhatsApp, ganho e perdido. A marca vive no contraste e na precisão dos detalhes (números tabulares, linhas de 1 px, raios contidos, sombras que mal se notam), não em ornamento.

A densidade é alta e deliberada: linhas de tabela de 48 px, controles de 32 px, texto de interface em 13,5 px. O primeiro dado da tela é sempre o lead que mais vale uma ligação agora; como quase tudo é preto, branco e cinza, a cor quente/morno/frio salta e a ordem é lida em um relance. Toda nota tem sua conta visível no ledger "Por que essa nota", com barras divergentes que somam exatamente a nota.

O movimento é curto e funcional: o painel entra em 220 ms, popovers escalam a partir do gatilho, botões cedem a 0,97 ao serem pressionados, linhas novas só aparecem com fade durante a busca ao vivo. Nada anima em navegação por teclado e tudo colapsa com `prefers-reduced-motion`.

**Key Characteristics:**
- Preto e branco como marca: trilho lateral preto com o "S" da Synch em branco, conteúdo branco, ação preta.
- Cinzas neutros puros, sem matiz; cor reservada para significado (temperatura, +/−, WhatsApp, ganho/perdido, dor auditada).
- Inter Variable auto-hospedada, pesos intermediários (550, 650) e números tabulares em toda nota, contagem e valor.
- Estrutura feita de bordas de 1 px, não de caixas sombreadas; sombras em preto neutro de baixa opacidade.
- Ícones Lucide em traço 1,75, 13–17 px, sempre acompanhando texto ou com rótulo acessível.
- Movimento com uma curva só, ease-out forte, entre 120 e 240 ms.

## Colors

Paleta de marca em preto e branco: superfícies brancas e cinzas neutros quase imperceptíveis, preto para texto, ação, seleção e foco, e um conjunto pequeno de cores de significado que nunca decora.

### Primary
- **Preto Synch** (ink / accent / text / accent-text): a cor da marca. Texto principal e cabeçalhos, botão primário ("Buscar leads", "Auditar"), checkboxes e toggles ligados, anel de foco, cursor de texto, barra de progresso, topo do spinner, links, avatares de iniciais, toasts, etapas intermediárias do pipeline e contorno do marcador selecionado no mapa.
- **Preto Grafite** (accent-hover): hover do botão primário.
- **Cinza Seleção** (accent-soft): fundo da linha selecionada na tabela, chip de destaque e coluna do pipeline sob arraste.

### Trilho (sidebar)
Única superfície escura do sistema; carrega a marca.
- **Trilho Preto** (rail): fundo da sidebar.
- **Trilho Hover** (rail-hover) e **Trilho Ativo** (rail-active): hover e item atual da navegação.
- **Borda do Trilho** (rail-border): borda direita da sidebar, contorno do status da fonte, badge inativo.
- **Borda do Trilho Hover** (rail-border-hover): contorno do status da fonte no hover.
- **Texto do Trilho** (rail-text): itens inativos, subtítulo da marca, status da fonte.
- **Branco do Trilho** (rail-text-strong): nome da marca, logo, item atual, hover, seletor de vendedor.

### Secondary (temperatura)
Cada temperatura tem três tons: o sinal puro (pontos, marcadores do mapa, barra do medidor), o texto (`-fg`, legível sobre o fundo) e o fundo suave (`-bg`).
- **Coral Quente** (hot / hot-fg / hot-bg): leads quentes; também erros, aviso de erro e o chip "Site fora do ar".
- **Âmbar Morno** (warm / warm-fg / warm-bg): leads mornos e avisos de auditoria.
- **Cinza Frio** (cold / cold-fg / cold-bg): leads frios, status "novo", fonte desconectada. Na identidade preto e branco, frio é a ausência de cor.

### Tertiary (sinais e canais)
- **Verde Ganho** (pos / pos-fg / pos-bg): contribuição positiva no ledger, status "ganho", valor ganho na coluna do pipeline, chip "Site ok", texto e fundo do tier A.
- **Coral Perda** (neg / neg-fg): contribuição negativa no ledger. Hoje tem o mesmo valor de `hot`, mas é um papel distinto: sinal que subtrai pontos, não temperatura.
- **Laranja Dor** (need-bg / need-fg): chip de dor explorável ("Sem site", "Só rede social", "Só Linktree", "Só Google").
- **Verde WhatsApp** (whatsapp / whatsapp-hover): exclusivo do botão "Abrir no WhatsApp" e do ícone de celular na coluna Contato.
- **Verde Conectado** (google-on / google-on-halo): só o ponto de 7 px e seu halo de 3 px no status da fonte quando o Google Places está conectado. É mais claro que `pos` porque vive sobre o trilho preto.
- **Borda Ganho** (pos-border): contorno do badge de tier A no seletor de segmentos.

### Neutral
Todos os cinzas são neutros puros (R = G = B).
- **Branco** (bg): fundo da área de trabalho, tabela, painel, popovers, cards; texto sobre preto.
- **Névoa** (bg-subtle): faixa de progresso, aviso informativo, colunas do pipeline, cabeçalho da tabela de pesos.
- **Cinza Claro** (bg-muted): chips neutros, trilho dos medidores, controle segmentado, hover de ghost, ícone de estado vazio.
- **Cinza Hover** (bg-hover): hover de linha de tabela, de fila e de botão secundário.
- **Linha** (border): toda divisória estrutural de 1 px.
- **Linha Forte** (border-strong): contorno de inputs e botões secundários; eixo central das barras divergentes; trilho do spinner.
- **Linha Hover** (border-hover): borda do botão secundário no hover.
- **Linha Hover de Campo** (border-hover-field): borda de campo, select e gatilho de segmentos no hover; borda da coluna do pipeline sob arraste.
- **Cinza Médio** (text-2): texto secundário, rótulos de campo, cabeçalhos de coluna.
- **Cinza Suave** (text-3): placeholders, contagens, posição na fila.
- **Grafite de Aviso** (notice-fg): texto do aviso informativo sobre Névoa.

### Named Rules
**A Regra do Preto e Branco.** A marca Synch é preto e branco. Superfícies, texto, ação, seleção, foco, links e avatares vivem na escala neutra; nenhum acento com matiz substitui o preto.

**A Regra da Cor Significante.** Cor só aparece onde carrega significado: temperatura (quente/morno/frio), pontos +/− do ledger, o canal WhatsApp, ganho/perdido, dor e resultado de auditoria, erro. Nunca como decoração, nunca como cor de seção, nunca como cor de marca.

**A Regra do Verde do Canal.** O verde do WhatsApp pertence ao canal WhatsApp. Sucesso e contribuição positiva usam `pos`, não `whatsapp`.

## Typography

**Fonte de interface:** Inter Variable (auto-hospedada via @fontsource), com fallback system-ui, -apple-system, Segoe UI, sans-serif
**Recursos:** `cv11` e `ss01` ligados globalmente; `tabular-nums` em notas, contagens, preços, datas e tempos.

**Character:** Uma família, muitos pesos intermediários. A hierarquia vem de peso (400 / 550 / 600 / 650 / 700) e de tons de cinza, não de saltos grandes de tamanho; a tela inteira vive entre 11,5 e 20 px, com o número da nota (26 px) como único momento de display.

### Hierarchy
- **Score display** (700, 26 px, -0.02em, tabular): só o número grande da nota no painel do lead.
- **Headline** (650, 20 px, -0.015em): título de estado vazio inicial ("Comece por uma cidade e um segmento").
- **Title** (650, 16 px, -0.01em): título de página, nome do lead no painel, título de estado vazio.
- **Title-md** (650, 15 px, -0.01em): nome da marca no trilho (em 700) e título da barra de capacidade da Fila.
- **Title-sm** (650, 14 px): cabeçalho de caixa em Configurações, linha de temperatura do scorecard.
- **Body** (400, 13,5 px, 1.45): controles, células da tabela, botões (550), navegação (500).
- **Body-sm** (400, 13 px): ledger, achados, chave-valor, avisos, toasts.
- **Caption** (400–550, 12,5 px): metadados sob o nome, contagens, status, pontos do ledger (650).
- **Label** (550–600, 12 px): rótulos de campo, cabeçalhos de coluna, títulos de grupo de filtro, chips, subtítulo da marca (500).
- **Label-xs** (600, 11,5 px): badge de contagem na navegação, títulos de grupo no seletor de segmentos.
- **Micro** (650, 10,5 px): só iniciais de avatar e o badge de tier (A/B/C) no seletor de segmentos; nunca texto corrido.
- **Micro-sm** (650, 9,5 px): só a inicial do avatar pequeno de 20 px.

### Named Rules
**A Regra do Número Tabular.** Todo número que se compara com outro (nota, contagem, avaliações, R$, km, pontos) usa `tabular-nums`. Uma coluna de notas desalinhada é um defeito.

**A Regra do Peso, não do Tamanho.** Para destacar, suba o peso (550 → 650) ou escureça o tom (text-2 → text) antes de aumentar o tamanho. Nada de texto em caixa alta com espaçamento largo.

## Layout

Aplicação de tela cheia sem rolagem do documento: grade de shell com trilho preto fixo de 232 px e área principal branca. Na tela Prospectar, a área principal empilha cabeçalho de página (57 px), barra de busca composta (grade Segmentos 1.5fr, Cidade 1fr, Bairro 0.8fr, Raio 104 px, botão), faixas condicionais de progresso e aviso, e o espaço de trabalho em três colunas: filtros de 248 px, resultados fluidos, painel do lead de 448 px encaixado como terceira coluna quando há seleção.

Cada coluna rola de forma independente; cabeçalhos de tabela são sticky. As divisões entre regiões são sempre bordas de 1 px, nunca espaçamento vazio nem sombra.

**Ritmo de espaçamento:** passos de 2 px, concentrados em 6, 8, 10, 12, 14, 16 e 20. Gutters horizontais de página em 20 px; dentro do painel e das colunas, 16 px; dentro de controles, 10–12 px.

**Responsivo:**
- ≤ 1680 px com painel aberto: a coluna de filtros some e vira o botão "Filtros · n" na toolbar; CSV e colunas Google/Contato/Responsável saem da tabela (já estão no painel).
- ≤ 1180 px: filtros 220 px, painel 400 px, barra de busca em três colunas.
- ≤ 900 px: o trilho vira barra horizontal preta, sticky e rolável, com a marca reduzida a 24 px sem o texto; filtros ocultos; tabela mostra só Nota, Estabelecimento (com a dor em linha) e Contato como botão de 32 px; painel ocupa a tela inteira.

Páginas de leitura (Fila 980 px, Pontuação 1040 px, Configurações 760 px) usam largura máxima com padding 20–24 px.

### Named Rules
**A Regra do Trilho Preto.** A sidebar é a única superfície escura e é onde a marca mora: trilho preto, logo branca no topo. O conteúdo de trabalho é sempre branco; nenhuma outra região, cabeçalho ou painel fica preto.

## Elevation & Depth

Sistema plano com sombras macias e curtas. Estrutura vem de bordas e de três tons de superfície (branco, névoa, cinza claro); sombra só indica que algo é pressionável ou que flutua acima do conteúdo. Todas as sombras são preto neutro (rgba 0, 0, 0) com deslocamento vertical e spread negativo.

### Shadow Vocabulary
- **Repouso** (`0 1px 2px rgba(0,0,0,0.06)`): botões, card do pipeline e segmento ativo (combinada com anel de 1 px na cor `border`).
- **Elevado** (`0 4px 12px -2px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.06)`): hover do card do pipeline, legenda do mapa.
- **Flutuante** (`0 16px 40px -12px rgba(0,0,0,0.24), 0 4px 10px -4px rgba(0,0,0,0.08)`): popovers, toasts, painel do lead em sobreposição.
- **Botão primário** (`0 1px 2px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.1)`): sombra preta curta e brilho interno de 1 px.
- **Anel de foco de campo** (`0 0 0 3px rgba(10,10,10,0.1)`) com borda preta.
- **Item ativo do trilho** (`inset 0 0 0 1px #2e2e2e`): contorno interno em vez de sombra, porque sombra não se lê sobre preto.
- **Bolinha do toggle** (`0 1px 2px` em `knob-shadow`): sombra mínima que destaca a bolinha branca sobre o trilho.

### Named Rules
**A Regra do Painel Encaixado.** Quando o painel do lead vive como terceira coluna, ele não tem sombra: é separado por uma borda. A sombra flutuante só aparece quando ele se sobrepõe ao conteúdo.

## Shapes

Cantos contidos, escalonados pelo tamanho do objeto: 4 px em marcas mínimas (kbd, tier, trilhos de 4 px), 5 px em itens de navegação e segmentos internos, 6 px em chips e chips de nota, 7 px em botões, campos e cards, 10 px em contêineres (popovers, caixas de configuração, lista da fila, colunas do pipeline, ícone de estado vazio), 12 px apenas no quadrado da nota grande. 8 px só no toast e no botão de contato quadrado de 32 px do celular. Pontos de status, avatares e marcadores do mapa são círculos; o marcador de etapa do pipeline é um quadrado de 6 px com raio 2 px (`bar`), e as pontas das barras do ledger e da tabela de pesos também têm raio 2 px. O favicon é o "S" branco sobre quadrado preto de raio 7/32. A sidebar, a toolbar, o cabeçalho da tabela e o painel encaixado não têm cantos: são regiões, não objetos.

## Components

### Marca (logo)
O "S" geométrico da Synch com linhas de velocidade, em vetor branco (`/synch-mark.svg`, redesenhado de `brand/synch-logo-original.jpg`). Fica no topo do trilho, 30 px de largura (24 px no celular), gap de 11 px para "Synch Search" (15/700 branco) e o subtítulo "Prospecção de sites" (12/500 em Texto do Trilho). É um link para Prospectar com rótulo acessível. Fora do trilho, a marca aparece só no favicon (mesmo vetor sobre quadrado preto). Se o vetor oficial da Synch chegar, ele substitui o redesenho sem mudar posição nem tamanho.

### Buttons
Discretos e firmes; afundam ao toque.
- **Shape:** cantos suaves (7 px), altura 32 px (28 px no tamanho pequeno), padding horizontal 12 px (9 px no pequeno), ícone de 14–16 px com gap de 7 px.
- **Primary:** fundo Preto Synch, texto branco, peso 550, sombra preta curta com brilho interno. Um por região: "Buscar leads" no topo, "Auditar" no painel. Desabilitado a 55% de opacidade lê como cinza médio ("Validar e salvar" sem chave).
- **Secondary:** fundo branco, borda Linha Forte, sombra de repouso; hover em Cinza Hover com borda Linha Hover.
- **Ghost:** sem borda nem sombra, texto Cinza Médio; hover em Cinza Claro. Usado nos ícones de navegação do painel (anterior, próximo, fechar) e ações de seção.
- **WhatsApp:** fundo Verde WhatsApp, texto branco; ação primária do painel. Sem celular, vira botão secundário inerte com o motivo no rótulo.
- **Press / Disabled:** `scale(0.97)` em 140 ms ease-out; desabilitado a 55% de opacidade sem escala.

### Score chip
- **Style:** pílula de 22 px de altura, mínimo 34 px de largura, raio 6 px, peso 650, 12,5 px tabular, fundo e texto da temperatura (`hot-bg`/`hot-fg`, `warm-bg`/`warm-fg`, `cold-bg`/`cold-fg`).
- **Nota grande:** quadrado de 64 px, raio 12 px, 26 px peso 700, mesmas cores; ao lado, ponto de temperatura de 7 px, linha "Temperatura · Dor", explicação e medidor de 6 px preenchido com a cor pura da temperatura.

### Chips
- **Style:** 22 px de altura, raio 6 px, 12 px peso 550, sem borda. Neutro em Cinza Claro; variações por dor: Laranja Dor (explorável), Coral (quebrado), Verde Ganho (ok); destaque em Cinza Seleção com texto preto.
- **Status pill:** não é chip: texto 12,5 px peso 550 em Cinza Médio precedido de um quadrado de 6 px que marca a etapa (ver Etapas do pipeline).

### Etapas do pipeline
Marcador monocromático para o caminho, cor só para o desfecho.
- **Novo:** quadrado cheio em Cinza Frio.
- **Contatado / Respondeu:** anel vazado preto (contorno interno de 1,5 px, miolo transparente).
- **Reunião / Proposta:** quadrado cheio preto.
- **Ganho:** Verde Ganho. **Perdido / Descartado:** Coral Quente.

**A Regra da Etapa Monocromática.** As etapas intermediárias do funil são preto: vazado enquanto a conversa começa, cheio quando há reunião ou proposta. Cor fica reservada para o resultado (ganho, perdido).

### "Por que essa nota" (ledger de barras divergentes)
A assinatura do sistema. Cada sinal é uma linha de 26 px em grade `rótulo 1fr | trilho 96 px | pontos 34 px`. O trilho tem um eixo central de 1 px em Linha Forte; contribuições positivas crescem para a direita em `pos`, negativas para a esquerda em `neg`, barra de 8 px com raio 2 px, largura proporcional ao maior sinal (metade do trilho = maior valor absoluto). Pontos alinhados à direita, peso 650, tabular, com sinal "+" ou "−" e cor `pos-fg`/`neg-fg`. Fecha com uma linha de total separada por borda: "Ponto de partida N + sinais" e a nota, que soma exatamente. A tabela de pesos em "Como pontuamos" reutiliza o mesmo trilho divergente (260 px), com o valor prévio em contorno tracejado.

### Lead panel (painel do lead)
- **Encaixado:** terceira coluna de 448 px com borda esquerda, sem sombra; entra com fade + 12 px de deslocamento em 220 ms ease-out.
- **Sobreposto:** absoluto à direita com sombra flutuante; desliza por `translateX` em 220 ms ease-out.
- **Estrutura:** cabeçalho (nome 16/650, meta 12,5 px, links pretos com ícone de 13 px, sublinhados só no hover, botões ghost anterior/próximo/fechar), corpo rolável dividido em seções de padding 14×16 px separadas por borda, cada uma com título 12,5/600 em Cinza Médio. Seções: nota, "Por que essa nota", Presença digital (achados com ícone de 15 px colorido pelo estado + lista chave-valor de coluna 120 px), Abordagem (abas sublinhadas em preto de 2 px), Pipeline (grade 2×2 de campos), Histórico (linha do tempo com pontos de 6 px).

### Filters column (coluna de filtros)
248 px, borda direita, padding 6×16 px. Grupos separados por borda, título 12/600 em Cinza Médio com ação "Limpar" em preto 550 à direita. Checkboxes de 15 px com `accent-color` preto e contagem alinhada à direita em Cinza Suave; temperatura com ponto colorido de 7 px. Toggles: trilho 28×16 px cinza claro (#d0d0d0), preto quando ligado, bolinha branca de 12 px com sombra mínima deslizando em 180 ms ease-out.

### Toolbar
Linha de 49 px com padding 10×16 px e borda inferior: controle segmentado de escopo (fundo Cinza Claro, padding 2 px, opção ativa branca com sombra de repouso e anel de 1 px), contagem ("**23** leads · 12 quentes"), espaçador, busca em linha com ícone de 14 px à esquerda (altura 30 px), segmentado Lista/Mapa, botão pequeno CSV.

### Lead table
Cabeçalho sticky de 34 px, 12/550 em Cinza Médio; colunas ordenáveis mostram seta de 12 px e passam a preto. Linhas de 48 px separadas por borda, primeira célula com 16 px de recuo. Hover em Cinza Hover (100 ms), selecionada em Cinza Seleção. Estabelecimento em duas linhas: nome 600 e meta 12,5 px em Cinza Médio, truncados com reticências. Linhas novas durante a busca ao vivo entram com fade e 3 px de deslocamento em 360 ms.

### Map
Marcadores circulares preenchidos com a cor pura da temperatura (opacidade 0,92), contorno branco de 1,5 px; o lead selecionado ganha contorno preto de 2,5 px. Legenda flutuante branca no canto inferior esquerdo com sombra elevada.

### Inputs / Fields
- **Style:** 32 px, raio 7 px, borda Linha Forte, fundo branco, 13,5 px; rótulo acima em 12/550 Cinza Médio com gap de 5 px. Select com chevron Lucide de 16 px embutido.
- **Hover:** borda Linha Hover de Campo.
- **Focus:** borda preta + anel de 3 px em preto a 10%; sem outline extra. Cursor de texto preto.
- **Erro:** mensagem em linha `hot-fg` 13 px; erros de página usam a faixa de aviso de erro.

### Notices (avisos)
Faixa de largura total sob a barra de busca, padding 10×20 px, borda inferior, 13 px, ícone de 15 px alinhado ao topo. Informativo é neutro: fundo Névoa, texto Grafite de Aviso, link preto sublinhado. Erro em `hot-bg`/`hot-fg` com `role="alert"`. Dispensável por botão ghost pequeno com X.

### Navigation (sidebar)
Trilho Preto com borda direita em Borda do Trilho, padding 14×10 px; marca no topo, status da fonte e vendedor no rodapé. Itens de 32 px, raio 5 px, 13,5 px peso 500 em Texto do Trilho com ícone de 16 px em cinza médio. Hover em Trilho Hover com texto branco. Atual: fundo Trilho Ativo, contorno interno de 1 px, texto e ícone brancos, badge de contagem invertido (branco com número preto); badge inativo em Borda do Trilho com texto cinza claro. Rótulos de grupo em 11,5/600 Texto do Trilho. Rodapé: caixa de status da fonte (fundo quase preto, Borda do Trilho que passa a Borda do Trilho Hover no hover, ponto de 7 px cinza; Verde Conectado com halo quando o Google está conectado) e seletor de vendedor com avatar invertido (círculo branco, inicial preta). O foco de teclado dentro do trilho é branco.

### Avatares
Círculos de 24 px com a inicial em Micro (20 px com Micro-sm no pequeno) em Preto Synch, inicial branca; diferenciados pelas iniciais, nunca por cor. Sobre o trilho preto, invertidos.

### Containers
- **Caixas e listas** (Configurações, Fila, Pontuação): raio 10 px, borda Linha, sem sombra, cabeçalho 14×16 px separado por borda.
- **Card do pipeline:** raio 7 px, padding 10 px, sombra de repouso, sombra elevada no hover; coluna em Névoa com raio 10 px que vira Cinza Seleção com borda Linha Hover de Campo sob arraste.
- **Popover:** raio 10 px, sombra flutuante, entra com escala de 0,96 a partir do canto do gatilho em 160 ms.
- **Toast:** fundo Preto Synch, texto branco, raio 8 px, centralizado embaixo; ação em branco sublinhado, peso 600.

### Loading
Spinner de 14 px (anel em Linha Forte com topo preto), barra de progresso preta de 4 px determinada ou indeterminada sobre trilho em Linha, e esqueleto de linhas de 48 px com shimmer linear de 1,4 s.

## Do's and Don'ts

### Do:
- **Do** usar preto (#0a0a0a) para ação, seleção, foco e links; um botão primário preto por região.
- **Do** manter a marca no trilho preto: o "S" branco da Synch no topo da sidebar e no favicon.
- **Do** usar cor só onde carrega significado: temperatura, +/− do ledger, WhatsApp, ganho/perdido, dor e auditoria, erro.
- **Do** codificar temperatura sempre com o trio sinal/`-fg`/`-bg` da mesma família, e manter o mesmo trio em chip, nota grande, ponto, medidor e marcador do mapa.
- **Do** marcar etapas intermediárias do pipeline em preto (anel vazado para contatado/respondeu, cheio para reunião/proposta) e reservar cor para o desfecho.
- **Do** mostrar a conta de toda nota com o ledger de barras divergentes, total somando exatamente.
- **Do** usar `tabular-nums` em todo número comparável.
- **Do** separar regiões com bordas de 1 px (#e8e8e8) e reservar sombra para o que é pressionável ou flutua.
- **Do** usar ícones Lucide com `strokeWidth` 1,75, 13–17 px, acompanhados de texto ou com `aria-label`.
- **Do** animar com `cubic-bezier(0.23, 1, 0.32, 1)` entre 120 e 240 ms, e respeitar `prefers-reduced-motion`.
- **Do** manter controles em 32 px (28 px no tamanho pequeno) e linhas de tabela em 48 px.

### Don't:
- **Don't** introduzir uma cor de acento ou de marca com matiz; ação, seleção, foco e links são preto.
- **Don't** tingir os neutros (cinza-frio, azulado ou quente); bordas, fundos e textos cinza são neutros puros.
- **Don't** recolorir, contornar ou pôr a logo sobre fundo claro; ela é branca sobre preto.
- **Don't** colorir avatares para diferenciar vendedores; a diferença está nas iniciais.
- **Don't** colocar cartões de métricas no topo das telas de trabalho; o primeiro dado é o lead.
- **Don't** usar coral, âmbar ou verde como decoração ou cor de seção.
- **Don't** usar o verde do WhatsApp para sucesso genérico.
- **Don't** escrever rótulos em caixa alta com espaçamento largo nem pôr sobretítulos acima de títulos.
- **Don't** dar sombra ao painel quando ele está encaixado como coluna.
- **Don't** exibir taxas de conversão ou probabilidades que o modelo ainda não calibrou com resultados reais.
