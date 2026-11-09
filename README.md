# Synch Search

Plataforma de prospecção da Synch: encontra comércios locais que precisam de site e os ordena pela **propensão de fechar compra**.

## Rodar

```bash
npm install
npm run dev        # API em :3000 + interface em http://localhost:5173 (também acessível na rede local)
```

Produção (um processo só, serve a interface compilada):

```bash
npm run build
npm start          # http://localhost:3000  (porta: SYNCH_PORT)
```

Testes do modelo de pontuação: `npm test`.

Os dados ficam em `data/synch.db` (SQLite). Para começar do zero, apague esse arquivo. Com a base do Brasil inteiro importada, ele ocupa alguns GB.

Uso dos dados: a base CNPJ é pública e serve para prospecção B2B. Respeite quem pedir para não ser contatado: marque o lead como *Descartado*.

## Fontes de dados

| Fonte | Custo | O que traz |
|---|---|---|
| **Base nacional de CNPJ (Receita Federal)** | grátis | **Todas** as empresas ativas do Brasil nos segmentos, com telefone, e-mail, data de abertura, porte (MEI/ME/EPP) e capital social. Cobre qualquer cidade. |
| Google Places API (New) | chave própria, com cota gratuita mensal | nota, número de avaliações, fotos e o site informado no Google. Até 60 resultados por termo. |
| OpenStreetMap (Overpass) | grátis, sem chave | complemento: site, Instagram e localização no mapa. Os servidores públicos às vezes ficam lotados. |

**Importe a base CNPJ antes de tudo** em *Configurações → Base nacional de empresas*. Escolha os estados ou o Brasil inteiro. O download é de cerca de 7 GB, porque a Receita não separa os arquivos por estado, e leva uns 30 a 60 minutos. O app lê os arquivos direto do zip e guarda só os estabelecimentos **ativos** dos CNAEs dos segmentos. Depois disso, as buscas consultam a base local. A Receita publica uma base nova todo mês, e a tela avisa quando houver atualização. É preciso ter o comando `unzip` instalado.

Como o site é descoberto para empresas que vêm da base CNPJ:
- **E-mail com domínio próprio** (ex.: `contato@clinicax.com.br`): o app visita `clinicax.com.br`. Se não abrir nada, a dor é **"Domínio sem site"**: a empresa já paga pelo domínio, mas não tem site.
- **E-mail gratuito** (Gmail, Hotmail…) e nenhum site: a dor é **"Sem site encontrado"**. É mais fraca que o "Sem site" confirmado pelo Google.
- **E-mail ou telefone do contador:** domínios e telefones que aparecem em 3 ou mais empresas diferentes, ou e-mails com "contab", "escritório" etc. no nome, são tratados como do contador e não da empresa.

Com a chave do Google cadastrada, cada busca soma os dados das três fontes. Para usar um Overpass próprio: `SYNCH_OSM_ENDPOINTS=https://meu-overpass/api/interpreter`.

## Como a nota é calculada

Cada estabelecimento passa por uma **auditoria de presença digital**. O servidor visita o site informado e verifica:

- se o site está fora do ar (domínio expirado, erro, página de "em construção");
- se o link leva só para Instagram, Linktree ou WhatsApp;
- se é um marketplace (iFood, Doctoralia…) ou um `business.site` (desativado pelo Google em 2024);
- se tem HTTPS e se abre bem no celular;
- o ano no rodapé, se é lento e se foi feito em construtor gratuito.

Depois, uma regressão logística soma sinais de cinco grupos:

1. **Necessidade**: sem site, site quebrado, só rede social, site fraco.
2. **Capacidade**: volume de avaliações, nota, nicho de ticket alto, faixa de preço.
3. **Intenção**: o dono cuida do perfil do Google (fotos, horário) ou já investe em Instagram.
4. **Alcance**: tem celular para WhatsApp. Sem telefone, a nota cai bastante.
5. **Contexto**: % de concorrentes do mesmo nicho que já têm site, num raio de 2 km ou no mesmo bairro. Franquias e redes saem da lista.

Na base CNPJ entram também:
- **empresa nova**: menos de 1 ano de CNPJ aberto pesa muito a favor, porque é quem mais precisa aparecer;
- **porte e capital social**: EPP ou maior, ou capital de R$ 100 mil ou mais, pesam a favor;
- **MEI** pesa um pouco contra (ticket menor);
- **e-mail gratuito** sem site pesa a favor.

A nota vai de 0 a 100. **Quente** é 70 ou mais, **morno** vai de 45 a 69 e **frio** fica abaixo de 45. O painel de cada lead mostra quantos pontos cada sinal somou ou tirou, e esses pontos fecham exatamente na nota. Sinais que não foram medidos (por exemplo, avaliações sem o Google) entram no ponto de partida como valor médio. Eles nunca aparecem como argumento.

**O modelo aprende com o time.** Quando houver pelo menos 6 leads marcados como *Ganho* ou *Perdido* (mínimo de 2 de cada), os pesos são reajustados com esse histórico. O ajuste é regularizado para não se afastar demais dos pesos iniciais. A partir daí, a nota passa a ser uma probabilidade calibrada com os resultados reais da Synch. Veja e reajuste em **Como pontuamos**.

## Fluxo de trabalho

1. **Prospectar**: escolha segmentos (até 8), cidade, bairro e raio. Os leads aparecem pontuados conforme a auditoria avança.
2. **Painel do lead**: mostra por que a nota é essa, a presença digital, a mensagem de WhatsApp pronta (montada a partir da dor detectada), o roteiro de ligação, as objeções e o melhor horário.
3. **Fila de hoje**: os retornos combinados e os leads quentes e mornos com telefone, limitados à capacidade diária de cada vendedor.
4. **Pipeline**: arraste os cartões de Contatado até Ganho ou Perdido. Cada resultado alimenta o modelo.

Cada pessoa do time escolhe seu nome no canto inferior esquerdo. Não há login, então use o app só numa rede confiável.

## Estrutura

```
server/            API Express + SQLite (node:sqlite)
  sources/         OpenStreetMap (Overpass), Google Places, geocodificação (Nominatim)
  audit.js         auditoria do site de cada comércio
  scoring.js       modelo de propensão + aprendizado
  approach.js      mensagens e roteiros de abordagem
  jobs.js          execução das buscas com progresso ao vivo (SSE)
  niches.js        catálogo de 45 segmentos com nível de ticket
web/src/           interface React (Vite)
```
