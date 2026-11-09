---
version: 1
slug: "web-src-app-jsx"
primary_target: "web/src/App.jsx"
related_targets: []
---

# Synch Search — app (Prospectar, Fila de hoje, Pipeline, Pontuação, Configurações)

Mode: Operate. Audience: dono da Synch + vendedores, prospecção diária em notebook (1366–1920 px), com o celular ao lado para o WhatsApp. Job: buscar comércios por cidade + segmento, ver quem precisa de site, abordar os de maior propensão primeiro e registrar o resultado. Constraints: pt-BR; sem login; dados reais de OSM/Google; nada de métricas inventadas.

## Direction contract

THESIS: A fila priorizada, não a lista. O padrão da categoria (Attio + Apollo.io) executado com acabamento de primeira: filtros à esquerda, tabela densa e ordenável no centro, painel do lead à direita. Recusa o dashboard de cartões de métricas no topo; o primeiro dado é o lead que mais vale uma ligação agora.

OWN-WORLD: Identidade Synch em preto e branco (pedido do usuário em 2026-11-06). Trilho lateral preto #0A0A0A com a marca "S" branca; área de trabalho branca, neutros puros (bordas #E8E8E8, texto #0A0A0A, secundário #565656); ações primárias em preto. Cor só onde carrega significado: quente (vermelho-coral), morno (âmbar), frio (cinza), +/− da conta, verde do WhatsApp, ganho/perdido. Inter variável auto-hospedada, números tabulares, escala 11.5–16 com 20 e 26 para títulos e nota. Raio 5–12 px, sombras neutras com deslocamento, ícones Lucide em traço 1.75.

STORY: O vendedor entende em segundos por que um lead está no topo (a conta dos sinais), acredita no argumento (a dor auditada), e age (WhatsApp com mensagem pronta, status registrado). O modelo aprende com ganho/perdido.

FIRST VIEWPORT: Sidebar 232 px (marca, vendedor ativo, navegação, status da fonte Google). Topo: barra de busca composta (Segmentos, Cidade, Bairro, Raio, Buscar). Abaixo: faixa de progresso durante a busca. Coluna de filtros 248 px (Temperatura com contagens, Dor, Segmento, Status, Responsável, toggles). Tabela: Nota, Estabelecimento, Dor, Google, Contato, Status, Responsável. Painel 448 px do lead selecionado: nota + probabilidade, "Por que essa nota" em barras divergentes de pontos, presença digital, abordagem (WhatsApp/Ligação), pipeline. Ação primária: Buscar; no painel, Abrir no WhatsApp.

FORM: Category standard (canon), chosen by the user over the roll; reference bar Attio and Apollo.io. Position: canon, outside the ordered list. seed:04b5e46f7a5665e0. Signature interaction: a explicação da nota como barras divergentes de contribuição (+/− pontos) que somam exatamente a nota. Motion grammar: painel desliza 220 ms cubic-bezier(0.23,1,0.32,1); popovers escalam de 0.96 a partir do gatilho; botões pressionam a 0.97; linhas novas entram com fade curto só durante a busca ao vivo; nada anima em navegação por teclado.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
