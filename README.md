# Consumo audiovisual por região — IMDb + D3.js

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

## 2. Período da base

| | |
|---|---|
| Ano do filme mais antigo | **ANO_INICIAL** |
| Ano do filme mais recente | **ANO_FINAL** |

> Calculado pelo script a partir de `startYear` (ano de lançamento) e impresso na linha
> `PERÍODO DA BASE:`. O valor também fica em `meta.json` e aparece no rodapé do beeswarm
> e do dumbbell.

## 3. Estrutura do repositório

```
├── index.html                  # página inicial com links para os 3 gráficos
├── requirements.txt            # bibliotecas Python do script
├── preparacao/
│   └── preparar_dados.py       # baixa do Kaggle, trata tudo e grava os JSONs nas pastas data/
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

**Pergunta:** quais países compartilham o mesmo catálogo de filmes?

**Como ler**

- **Bolinha = país.** O tamanho é o número de filmes disponíveis no país: filmes com nota no
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
  ficam no desenho.
- **Quais ligações aparecem:** cada país traz as suas 5 ligações mais fortes. Um país pode ter
  mais de 5, porque também entra entre as 5 mais fortes de outros países (o Brasil, por
  exemplo, aparece com 11).
- **Quais países entram:** só regiões com pelo menos 1.000 filmes, para que o índice não seja
  distorcido por catálogos muito pequenos.
- Ao clicar num país, o painel lista as ligações dele da mais forte para a mais fraca, com o
  número de filmes em comum.

**Módulo D3:** [d3-force](https://d3js.org/d3-force) ·
**Exemplo de referência:** <https://observablehq.com/@d3/force-directed-graph/2>

### Gráfico 2 — Beeswarm (gemas escondidas)

**Pergunta:** em cada país e gênero, onde estão os filmes muito bem avaliados e pouco vistos?

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
- Os gêneros vêm ordenados pela proporção de gemas: os mais "garimpáveis" ficam em cima.
- Só entram filmes com pelo menos 50 votos, já que abaixo disso a nota é instável.

**Módulo D3:** [d3-force](https://d3js.org/d3-force) (`forceX`, `forceY`, `forceCollide`) ·
**Exemplo de referência:** <https://observablehq.com/@d3/beeswarm/2>

### Gráfico 3 — Dumbbell (próprios x importados)

**Pergunta:** os filmes próprios de cada país são mais bem avaliados que os importados?

**Como ler**

- **Linha = país**, com duas bolinhas:
  - **Azul, próprio:** nota média dos filmes exibidos no país com o mesmo título original.
    Na prática, produção local ou filme que não precisou de tradução.
  - **Laranja, importado:** nota média dos filmes exibidos com título traduzido ou adaptado.
- **Diferença** (número à direita) = nota média dos próprios − nota média dos importados.
  - Positiva: os filmes próprios têm nota maior.
  - Negativa: os importados têm nota maior.
- **Filtro "mínimo de filmes por grupo":** esconde países com poucos filmes em algum dos dois
  grupos, onde a média fica instável. O padrão é 30.
- Só entram filmes com pelo menos 50 votos.
- **Ordenação:** pela diferença, pela nota dos próprios ou em ordem alfabética.

**Por que um lado ganha?** Hipóteses para discussão, que o gráfico sozinho não comprova:

- **Filtro de importação:** só costuma ganhar tradução o filme estrangeiro que já fez sucesso
  lá fora, o que puxa a nota dos importados para cima.
- **Volume da indústria local:** países que produzem muito (Índia, Turquia, Filipinas) têm
  muitos filmes populares de massa, o que baixa a média dos próprios.
- **Prestígio exportado:** quando a produção local que chega ao IMDb é sobretudo de festival e
  cinema de autor, a média dos próprios sobe.
- **Idioma:** em países de língua inglesa quase nada é traduzido, então "próprio" mistura
  produção local com Hollywood e a diferença tende a zero.

Lembrando que a nota é global: o gráfico compara o catálogo de cada país, não mede o quanto
o público daquele país aprova um ou outro.

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
- "Próprio x importado" é uma aproximação pelo título: coproduções e filmes que mantêm o
  título original fora do país de origem (comum em países de língua inglesa) podem cair no
  grupo "próprio".
- Códigos de região seguem o IMDb (ISO 3166-1), incluindo históricos como `SUHH`
  (União Soviética), `DDDE` (Alemanha Oriental) e `XWW` (mundial).
