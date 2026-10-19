# Consumo audiovisual por região — IMDb + D3.js

**Visualizações publicadas:** <https://carolinarigaudfelix.github.io/DataVis-UERJ-2026.2/>

Três visualizações em D3.js sobre preferência de consumo de filmes por país/região,
a partir da base pública do IMDb.

## 1. Base de dados

- **Fonte:** [Kaggle — rahulsaranm/imdb-dataset](https://www.kaggle.com/datasets/rahulsaranm/imdb-dataset),
  que reúne os arquivos dos [IMDb Non-Commercial Datasets](https://developer.imdb.com/non-commercial-datasets/).
- **Arquivos:** `title.basics.tsv`, `title.ratings.tsv`, `title.akas.tsv`.
- **Base completa:** todas as linhas dos três arquivos são processadas, sem limite de linhas.
  A leitura usa Polars em modo *streaming*, o que permite tratar o `title.akas` inteiro no
  computador comum.
- **Recorte:** filmes (`titleType = movie`) com nota no IMDb e pelo menos uma região registrada.
  Ficam de fora dos três gráficos os códigos do IMDb que não são países (títulos de lançamento
  mundial `XWW` e regional, como `XEU` e `XAS`) e os países que não existem mais (União Soviética,
  Iugoslávia, Alemanha Ocidental e Oriental, Tchecoslováquia). Os filmes continuam na base pelos
  países atuais em que também foram lançados.

## 2. Período da base

| | |
|---|---|
| Ano do filme mais antigo | **1894** |
| Ano do filme mais recente | **2025** |

> Calculado pelo script a partir de `startYear` (ano de lançamento dos filmes). O valor também
> fica em `meta.json` e aparece no rodapé dos três gráficos.

**O que entrou em cada gráfico**

| Gráfico | Recorte |
|---|---|
| Force-directed | 73 países (com pelo menos 1.000 filmes) e 285 ligações |
| Beeswarm | 30 regiões com mais filmes; 41.575 pontos desenhados (até 60 por região e gênero) |
| Dumbbell | países com pelo menos 30 filmes exclusivos e 30 compartilhados |

## 3. Estrutura do repositório

```
├── index.html                  # página inicial com links para os 3 gráficos
├── requirements.txt            # bibliotecas Python do script
├── comum/paises.js             # nome em português de cada código de região (usado nos 3 gráficos)
├── preparacao/
│   ├── preparar_dados.py       # baixa do Kaggle, trata tudo e grava os JSONs nas pastas data/
│   └── amostra_dumbbell.py     # mostra exemplos de filmes exclusivos x compartilhados para conferência
├── rede-paises/                # Gráfico 1 — force-directed
│   ├── index.html · style.css · script.js
│   └── data/graph.json
├── beeswarm/                   # Gráfico 2 — beeswarm
│   ├── index.html · style.css · script.js
│   └── data/titulos_genero.json · meta.json
└── dumbbell/                   # Gráfico 3 — dumbbell
    ├── index.html · style.css · script.js
    └── data/dumbbell.json · meta.json
```

## 4. Gráficos

### Gráfico 1 — Force-directed graph (rede de países)

**Pergunta:** que proporção do catálogo de filmes cada país tem em comum com os outros?

**Como ler**

- **Bolinha = país**, identificado pela sigla; o nome completo aparece na lista de países e na
  dica de cada bolinha. O tamanho é o número de filmes disponíveis no país: filmes com nota no
  IMDb que têm registro de lançamento ou título naquela região (tabela `title.akas`).
- **Cor = nota média** desses filmes no IMDb (escala do amarelo, nota menor, ao azul-escuro,
  nota maior). É a nota global, dada por usuários do mundo todo.
- **Ligação = catálogo em comum**, medido pelo índice de Jaccard:

  ```
  Jaccard(A, B) = filmes em comum entre A e B ÷ filmes presentes em A ou em B
  ```

  Vai de 0 (nenhum filme em comum) a 1 (catálogos idênticos). Exemplo: o valor 0,437 entre
  Brasil e Espanha significa que 43,7% de todos os filmes presentes em pelo menos um dos dois
  países estão nos dois. Quanto maior o valor, mais grossa a linha e mais próximos os países
  ficam no desenho. É uma **proporção**, não uma quantidade: a quantidade de filmes em comum
  aparece na lista do país selecionado.
- **Quais ligações aparecem:** cada país traz as suas 5 ligações mais fortes. Um país pode ter
  mais de 5, porque também entra entre as 5 mais fortes de outros países (o Brasil, por
  exemplo, aparece com 11).
- **Quais países entram:** só regiões com pelo menos 1.000 filmes, para que o índice não seja
  distorcido por catálogos muito pequenos.
- **Posição na tela:** cada país é puxado por todas as suas linhas ao mesmo tempo, e a posição
  final é um equilíbrio entre elas. A distância na tela é aproximada: dois países podem ficar
  colados por terem os mesmos vizinhos, mesmo que a ligação direta entre eles não seja a mais
  forte. A ordem exata está na lista do país selecionado.
- **Ajustar o desenho:** repulsão (o quanto as bolinhas se afastam umas das outras), distância
  das ligações (comprimento de todas as linhas, mantendo a ordem) e tamanho dos nós (raio de
  todas as bolinhas, mantendo a proporção). Esses controles mudam só a arrumação, não os dados.
- Ao selecionar um país (no gráfico ou na lista "Destacar um país"), o painel lista as ligações dele da mais forte para a mais fraca, com o
  número de filmes em comum.

**Módulo D3:** [d3-force](https://d3js.org/d3-force) ·
**Exemplo de referência:** <https://observablehq.com/@d3/force-directed-graph/2>

### Gráfico 2 — Beeswarm (gemas escondidas)

**Pergunta:** em cada país e gênero, onde estão os filmes muito bem avaliados, mas pouco vistos?

**Como ler**

- **Ponto = filme**, posicionado na horizontal pela nota no IMDb (1 a 10). O tamanho é o
  número de votos, usado como medida de visibilidade.
- **Gema escondida (laranja):** nota ≥ 7,5 **e** número de votos entre os 30% menores daquela
  região e gênero. A comparação é feita dentro do gênero porque um documentário com poucos
  votos não é comparável a um filme de ação com poucos votos.
- **Linha tracejada:** a nota de corte (7,5).
- **Amostra:** cada gênero mostra até 60 filmes sorteados, porque o navegador não comporta
  milhares de pontos por linha. A classificação de gema, porém, usa todos os filmes, e a tabela
  lateral mostra os totais reais ("1.657 de 13.454" = 1.657 gemas entre 13.454 documentários
  dos EUA).
- **Busca:** o campo "País" aceita digitar o nome, e o campo "Buscar filme" destaca no gráfico os
  filmes cujo título contém o texto digitado. A busca cobre os filmes desenhados; se o filme não
  estiver entre os sorteados do país, a página indica em quais outros países ele aparece.
- Os gêneros vêm ordenados pela proporção de gemas: os mais "garimpáveis" ficam em cima.
- Só entram filmes com pelo menos 50 votos, já que abaixo disso a nota é instável.

**Módulo D3:** [d3-force](https://d3js.org/d3-force) (`forceX`, `forceY`, `forceCollide`) ·
**Exemplo de referência:** <https://observablehq.com/@d3/beeswarm/2>

### Gráfico 3 — Dumbbell (exclusivos x compartilhados)

**Pergunta:** em cada país, os filmes exclusivos (lançados só ali) são mais ou menos bem avaliados
e vistos que os que também foram lançados em outros países?

**Como separamos:** o `title.akas` registra em quais países cada filme foi lançado. Se o filme
aparece em um único país, ele é **exclusivo** desse país. Se aparece em dois ou mais, é
**compartilhado**. A definição usa só o registro do IMDb, sem interpretação.

**Ligação com os outros gráficos:** a rede mostra o catálogo que os países compartilham; o
dumbbell mostra o que é só de cada um; o beeswarm mostra as gemas escondidas.

**Como ler**

- **Linha = país**, com duas bolinhas:
  - **Laranja, exclusivo:** filmes lançados só naquele país. Ex.: um filme brasileiro que nunca
    saiu do Brasil.
  - **Azul, compartilhado:** filmes também lançados em outros países. Ex.: "Titanic" ou
    "Cidade de Deus".
- **Comparar:**
  - **Nota média** de cada grupo. Diferença = exclusivos − compartilhados (verde: exclusivos com
    nota maior; vermelho: menor).
  - **Votos (mediana)**, usados como medida de alcance. A mediana evita que poucos sucessos
    enormes distorçam o resultado. Diferença = quantas vezes os exclusivos têm os votos dos
    compartilhados ("×0,5" = a metade). O eixo é logarítmico.
- **Dica de cada linha:** além dos números, mostra os 5 filmes mais votados de cada grupo
  naquele país, para dar uma ideia concreta de que filmes são exclusivos e quais são
  compartilhados.
- **Buscar país:** destaca a linha do país e leva até ela.
- **Mínimo de filmes por grupo:** esconde países com poucos filmes em algum dos grupos (padrão 30).
- Só entram filmes com pelo menos 50 votos.

**O que pode explicar a diferença** (hipóteses para discussão, que o gráfico sozinho não comprova):

- **Filtro de circulação:** os filmes lançados em outros países costumam ser os que já fizeram
  sucesso, o que puxaria votos e nota dos compartilhados para cima.
- **Mercado interno:** muitos exclusivos são produções para o público local que não viajam.
- **Público fiel:** exclusivos com poucos votos podem ter nota alta, avaliados por quem já gosta
  daquele cinema.
- **Registro incompleto:** alguns filmes aparecem em um só país porque o IMDb não registrou os
  outros lançamentos.

**Conferir os dados:** depois de rodar o `preparar_dados.py`, o comando
`python preparacao/amostra_dumbbell.py BR JP FR` mostra, para cada país, o resumo dos dois grupos
e exemplos de filmes (os mais votados e alguns sorteados), com o número de países em que cada um
aparece.

**Módulos D3:** [d3-scale](https://d3js.org/d3-scale) + [d3-axis](https://d3js.org/d3-axis)
(o dumbbell é uma variação do *dot plot*) ·
**Exemplo de referência:** <https://observablehq.com/@d3/dot-plot/2>

## 5. Como reproduzir

Na raiz do repositório (Linux/WSL):

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python preparacao/preparar_dados.py
```

O script faz login no Kaggle (usuário e token em kaggle.com → Settings → API), baixa o
dataset `rahulsaranm/imdb-dataset`, processa a base inteira e grava os JSONs direto nas
pastas `data/` de cada gráfico. Se o download pela API falhar, baixe o zip pelo botão
**Download** da página do dataset, descompacte e rode
`python preparacao/preparar_dados.py caminho/da/pasta`.

Para ver os gráficos:

```bash
python -m http.server
```

e abra `http://localhost:8000`.

## 6. Limites da análise

- O IMDb não informa votos ou notas por país: a nota é global. Os gráficos comparam
  **o catálogo disponível em cada região**, não a opinião do público daquela região.
- Um filme com vários gêneros entra em cada um deles no beeswarm.
- No dumbbell, "exclusivo" depende do registro do IMDb: um filme pode aparecer em um só país
  porque os outros lançamentos não foram registrados.
- Códigos de região seguem o IMDb (ISO 3166-1). Os gráficos mostram o nome em português; a
  tradução fica em `comum/paises.js`.
