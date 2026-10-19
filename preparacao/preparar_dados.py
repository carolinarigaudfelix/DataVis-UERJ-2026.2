# =============================================================================
#  Preparação dos dados — IMDb
#  Processa a BASE INTEIRA (todas as linhas de basics, ratings e akas)
#  e gera os JSONs dos três gráficos em D3:
#    1. Force-directed  → rede-paises/data/graph.json
#    2. Beeswarm        → beeswarm/data/titulos_genero.json
#    3. Dumbbell        → dumbbell/data/dumbbell.json
#
#  Usa Polars em modo "lazy + streaming": lê os TSVs em paralelo, filtra
#  durante a leitura e não carrega o title.akas inteiro na RAM de uma vez.
#
#  Uso:
#    python preparar_dados.py            → baixa do Kaggle pela API
#    python preparar_dados.py /pasta     → usa o zip do Kaggle já descompactado
# =============================================================================

# !pip install -q polars pyarrow scipy       # <- descomente no Colab

import json, os, sys
import numpy as np
import polars as pl
from scipy.sparse import csr_matrix

# ---------- CONFIG ----------
TIPOS = ["movie"]          # só filmes, como no dicionário de dados do projeto

# Regiões que ficam de fora dos três gráficos:
#  - códigos que não são países (títulos de lançamento mundial ou regional do IMDb);
#  - países que não existem mais. Os filmes continuam na base pelos países atuais
#    em que também foram lançados.
REGIOES_NAO_PAISES = ["XWW", "XEU", "XAS", "XSA", "XNA", "XAU", "XPI"]
PAISES_EXTINTOS = ["SUHH",   # União Soviética
                   "XWG",    # Alemanha Ocidental
                   "DDDE",   # Alemanha Oriental
                   "CSHH",   # Tchecoslováquia
                   "XYU", "YUCS",  # Iugoslávia
                   "XKO",    # Coreia (antes da divisão)
                   "BUMM",   # Birmânia
                   "ZRCD",   # Zaire
                   "VDVN",   # Vietnã do Norte
                   "ANHH"]   # Antilhas Holandesas
REGIOES_EXCLUIDAS = REGIOES_NAO_PAISES + PAISES_EXTINTOS
# Pastas resolvidas a partir da raiz do projeto (funciona de qualquer diretório)
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PASTA_SAIDA = os.path.join(RAIZ, "saida")   # parquet intermediário (fora do git)

# Rede de países (force-directed)
MIN_TITULOS_REDE = 1000    # só regiões com pelo menos N filmes
VIZINHOS_REDE = 5          # cada país mantém suas K ligações mais fortes

# Beeswarm
MIN_VOTOS = 50             # ignora filmes com pouquíssimos votos (nota instável)
REGIOES_BEESWARM = 30      # nº de regiões (as com mais filmes); ou uma lista ["US","BR",...]
AMOSTRA_POR_GRUPO = 60     # pontos desenhados por região+gênero (amostra aleatória)
NOTA_GEMA = 7.5            # gema = nota >= NOTA_GEMA ...
QUANTIL_GEMA = 0.30        # ... e votos abaixo do quantil 30% da região+gênero

# Dumbbell
MIN_FILMES_GRUPO = 30      # país precisa de N filmes exclusivos e N compartilhados

# Fonte ÚNICA: dataset do Kaggle rahulsaranm/imdb-dataset.
# Duas formas de obter:
#   1) API (kagglehub, pede login)      → python preparar_dados.py
#   2) zip baixado pelo site do Kaggle   → python preparar_dados.py pasta_descompactada
KAGGLE_DATASET = "rahulsaranm/imdb-dataset"
VERSAO_KAGGLE = None      # ex.: 906 para fixar uma versão; None = mais recente

os.makedirs(PASTA_SAIDA, exist_ok=True)



def baixar_kaggle():
    import kagglehub
    if not (os.path.exists(os.path.expanduser("~/.kaggle/kaggle.json"))
            or os.environ.get("KAGGLE_KEY")):
        kagglehub.login()
    handle = KAGGLE_DATASET
    if VERSAO_KAGGLE:
        handle += f"/versions/{VERSAO_KAGGLE}"
    return kagglehub.dataset_download(handle)


# ---------- 0) OBTER OS ARQUIVOS (sempre do Kaggle) ----------
if len(sys.argv) > 1 and os.path.isdir(sys.argv[1]):
    path = sys.argv[1]             # pasta do zip baixado no site do Kaggle
else:
    path = baixar_kaggle()
print("Arquivos em:", path)


def achar(nome):
    """Procura o TSV dentro da pasta do Kaggle (o zip às vezes cria subpastas,
    e algumas versões guardam cada arquivo como <nome>/data.tsv)."""
    for raiz, _, arquivos in os.walk(path):
        if nome in arquivos:
            return os.path.join(raiz, nome)
        if os.path.basename(raiz) == nome and "data.tsv" in arquivos:
            return os.path.join(raiz, "data.tsv")
    raise FileNotFoundError(f"{nome} não encontrado em {path}")


def ler_tsv(nome, colunas):
    """Leitura preguiçosa (lazy) de um TSV do IMDb, tudo como texto."""
    arq = achar(nome)
    print("lendo", arq)
    return (pl.scan_csv(arq, separator="\t", null_values="\\N", quote_char=None,
                        infer_schema=False)
              .select(colunas))


def salvar(obj, nome):
    json.dump(obj, open(f"{PASTA_SAIDA}/{nome}", "w"), ensure_ascii=False,
              separators=(",", ":"))


# ---------- 1) FILMES + NOTAS ----------
titulos = (ler_tsv("title.basics.tsv",
                   ["tconst", "titleType", "primaryTitle", "originalTitle", "startYear", "genres"])
           .filter(pl.col("titleType").is_in(TIPOS))
           .join(ler_tsv("title.ratings.tsv", ["tconst", "averageRating", "numVotes"]),
                 on="tconst", how="inner")
           .with_columns(pl.col("averageRating").cast(pl.Float64),
                         pl.col("numVotes").cast(pl.Int64),
                         pl.col("startYear").cast(pl.Int32, strict=False))
           .collect(engine="streaming"))
print("Filmes com nota:", titulos.height)

# ---------- 2) AKAS: todas as linhas dos filmes acima ----------
akas = (ler_tsv("title.akas.tsv", ["titleId", "title", "region", "language", "isOriginalTitle"])
        .rename({"titleId": "tconst", "title": "TituloLocal"})
        .filter(pl.col("region").is_not_null() & ~pl.col("region").is_in(REGIOES_EXCLUIDAS))
        .join(titulos.lazy().select("tconst"), on="tconst", how="semi")
        .with_columns((pl.col("isOriginalTitle") == "1").alias("isOriginalTitle"))
        .collect(engine="streaming"))
print("Linhas de akas (filmes com região):", akas.height)

# ---------- 3) BASE TRATADA: um registro por filme + região ----------
base = (akas.sort("isOriginalTitle", descending=True)
            .unique(["tconst", "region"], keep="first")
            .drop("TituloLocal")
            .join(titulos, on="tconst", how="inner")
            .rename({"tconst": "ID", "primaryTitle": "TituloPrimario", "originalTitle": "TituloOriginal",
                     "region": "Regiao",
                     "language": "Idioma", "titleType": "Tipo", "genres": "Generos",
                     "averageRating": "NotaMedia", "numVotes": "NumVotos",
                     "isOriginalTitle": "EUmTipoOriginal", "startYear": "AnoLancamento"})
            .filter(pl.col("Generos").is_not_null()))
base.write_parquet(f"{PASTA_SAIDA}/base_tratada.parquet")
print("Base tratada:", base.shape, "|", base["Regiao"].n_unique(), "regiões")

# ---------- 4) PERÍODO E RESUMO ----------
anos = base.select(pl.col("AnoLancamento").min().alias("min"),
                   pl.col("AnoLancamento").max().alias("max")).row(0, named=True)
meta = {
    "fonte": f"Kaggle — {KAGGLE_DATASET}",
    "tipos": TIPOS,
    "ano_inicial": anos["min"],
    "ano_final": anos["max"],
    "filmes_unicos": base["ID"].n_unique(),
    "linhas_filme_regiao": base.height,
    "regioes": base["Regiao"].n_unique(),
}
salvar(meta, "meta.json")
print("PERÍODO DA BASE:", anos["min"], "a", anos["max"])

# ---------- 5) GRÁFICO 1 — REDE DE PAÍSES (Jaccard) ----------
pares = base.select("ID", "Regiao").unique()
_, ti = np.unique(pares["ID"].to_numpy(), return_inverse=True)
regs, ri = np.unique(pares["Regiao"].to_numpy(), return_inverse=True)
regs = regs.tolist()
X = csr_matrix((np.ones(len(ti), dtype=np.int32), (ti, ri)))
inter = (X.T @ X).toarray()
tam = np.asarray(X.sum(axis=0)).ravel()
uniao = tam[:, None] + tam[None, :] - inter
jac = np.divide(inter, uniao, out=np.zeros(uniao.shape), where=uniao > 0)
np.fill_diagonal(jac, 0)

ok = np.where(tam >= MIN_TITULOS_REDE)[0]
sub = jac[np.ix_(ok, ok)]
arestas = set()
for a in range(len(ok)):
    for b in np.argsort(sub[a])[::-1][:VIZINHOS_REDE]:
        if sub[a, b] > 0:
            arestas.add(tuple(sorted((a, b))))

stats = {r["Regiao"]: r for r in
         base.group_by("Regiao").agg(pl.col("ID").n_unique().alias("filmes"),
                                     pl.col("NotaMedia").mean().round(2).alias("nota"),
                                     pl.col("NumVotos").sum().alias("votos")).to_dicts()}
salvar({
    "nodes": [{"id": regs[i], "filmes": stats[regs[i]]["filmes"],
               "nota": stats[regs[i]]["nota"], "votos": stats[regs[i]]["votos"]} for i in ok],
    "links": [{"source": regs[ok[a]], "target": regs[ok[b]],
               "value": round(float(sub[a, b]), 3),
               "comuns": int(inter[ok[a], ok[b]])} for a, b in sorted(arestas)],
}, "graph.json")
print("Rede:", len(ok), "países,", len(arestas), "ligações")

# ---------- 6) GRÁFICO 2 — BEESWARM (gemas escondidas) ----------
# A gema é calculada sobre TODOS os filmes de cada região+gênero;
# só o desenho usa amostra, porque o navegador não aguenta milhões de pontos.
if isinstance(REGIOES_BEESWARM, int):
    regioes_bs = (base.group_by("Regiao").agg(pl.col("ID").n_unique().alias("n"))
                      .sort("n", descending=True).head(REGIOES_BEESWARM)["Regiao"].to_list())
else:
    regioes_bs = REGIOES_BEESWARM

bs = (base.filter(pl.col("Regiao").is_in(regioes_bs) & (pl.col("NumVotos") >= MIN_VOTOS))
          .with_columns(pl.col("Generos").str.split(",").alias("Genero"))
          .explode("Genero")
          .with_columns(pl.col("Genero").str.strip_chars())
          .with_columns(pl.col("NumVotos").quantile(QUANTIL_GEMA)
                          .over(["Regiao", "Genero"]).alias("corte_votos"),
                        pl.len().over(["Regiao", "Genero"]).alias("total_grupo"))
          .with_columns(((pl.col("NotaMedia") >= NOTA_GEMA) &
                         (pl.col("NumVotos") <= pl.col("corte_votos"))).alias("gema")))

gemas_total = bs.group_by(["Regiao", "Genero"]).agg(pl.col("gema").sum().alias("gemas_total"))
amostra = (bs.with_columns(pl.int_range(pl.len()).shuffle(seed=1)
                             .over(["Regiao", "Genero"]).alias("_ordem"))
             .filter(pl.col("_ordem") < AMOSTRA_POR_GRUPO)      # amostra aleatória simples
             .join(gemas_total, on=["Regiao", "Genero"])
             .select("ID", "TituloPrimario", "Regiao", "Genero", "NotaMedia", "NumVotos",
                     "AnoLancamento", "gema", "total_grupo", "gemas_total"))
salvar(amostra.to_dicts(), "titulos_genero.json")
print("Beeswarm:", amostra.height, "pontos,", int(amostra["gema"].sum()), "gemas desenhadas,",
      len(regioes_bs), "regiões")

# ---------- 7) GRÁFICO 3 — DUMBBELL (filmes exclusivos x compartilhados) ----------
# Para cada filme, conta em quantos países ele aparece registrado no title.akas:
#   "exclusivo"    = aparece em um único país (só foi lançado ali, segundo o IMDb);
#   "compartilhado" = aparece em dois ou mais países.
# Depois compara, por país, a nota média e a mediana de votos (alcance) dos dois grupos.
paises_por_filme = (akas.select("tconst", "region").unique()
                        .group_by("tconst").agg(pl.len().alias("n_paises")))
por_filme = (akas.select("tconst", "region", "TituloLocal")
                 .join(titulos.filter(pl.col("numVotes") >= MIN_VOTOS)
                              .select("tconst", "originalTitle", "averageRating", "numVotes", "startYear"),
                       on="tconst", how="inner")
                 .group_by(["region", "tconst"])
                 .agg(pl.col("TituloLocal").unique().sort().str.join(" | ").alias("TituloNoPais"),
                      pl.col("originalTitle").first(), pl.col("startYear").first(),
                      pl.col("averageRating").first(), pl.col("numVotes").first())
                 .join(paises_por_filme, on="tconst")
                 .with_columns(pl.when(pl.col("n_paises") == 1).then(pl.lit("exclusivo"))
                                 .otherwise(pl.lit("compartilhado")).alias("Grupo")))
por_filme.write_parquet(f"{PASTA_SAIDA}/exclusivos.parquet")   # usado pela amostra

db = (por_filme.group_by(["region", "Grupo"])
               .agg(pl.col("averageRating").mean().alias("nota"),
                    pl.col("numVotes").median().alias("votos"),
                    pl.len().alias("filmes")))
piv = (db.pivot(on="Grupo", index="region", values=["nota", "votos", "filmes"])
         .rename({"region": "Regiao"}))
for col in ["nota_exclusivo", "nota_compartilhado", "votos_exclusivo", "votos_compartilhado",
            "filmes_exclusivo", "filmes_compartilhado"]:
    if col not in piv.columns:
        piv = piv.with_columns(pl.lit(None).alias(col))
piv = (piv.drop_nulls(["nota_exclusivo", "nota_compartilhado"])
          .filter((pl.col("filmes_exclusivo") >= MIN_FILMES_GRUPO) &
                  (pl.col("filmes_compartilhado") >= MIN_FILMES_GRUPO))
          # diferença de nota = exclusivos − compartilhados; votos = quantas vezes exclusivos/compartilhados
          .with_columns((pl.col("nota_exclusivo") - pl.col("nota_compartilhado")).alias("dif_nota"),
                        (pl.col("votos_exclusivo") / pl.col("votos_compartilhado")).alias("razao_votos"))
          .with_columns(pl.col("nota_exclusivo", "nota_compartilhado", "dif_nota", "razao_votos").round(2),
                        pl.col("votos_exclusivo", "votos_compartilhado").round(0).cast(pl.Int64))
          .select("Regiao", "nota_exclusivo", "nota_compartilhado", "dif_nota",
                  "votos_exclusivo", "votos_compartilhado", "razao_votos",
                  "filmes_exclusivo", "filmes_compartilhado")
          .sort("dif_nota", descending=True))
# os 5 filmes mais votados de cada grupo, por país (aparecem na dica do gráfico)
TOP_FILMES = 5
top = (por_filme.sort("numVotes", descending=True)
                .group_by(["region", "Grupo"], maintain_order=True).head(TOP_FILMES)
                .with_columns(pl.col("TituloNoPais").str.split(" | ").list.first().alias("titulo")))
principais = {}
for r in top.iter_rows(named=True):
    principais.setdefault(r["region"], {}).setdefault(r["Grupo"], []).append(
        {"titulo": r["titulo"], "ano": r["startYear"],
         "nota": r["averageRating"], "votos": r["numVotes"]})
linhas = piv.to_dicts()
for d in linhas:
    d["top_exclusivo"] = principais.get(d["Regiao"], {}).get("exclusivo", [])
    d["top_compartilhado"] = principais.get(d["Regiao"], {}).get("compartilhado", [])
salvar(linhas, "dumbbell.json")
print("Dumbbell:", piv.height, "países")

# ---------- 8) COPIAR OS JSONs PARA AS PASTAS DOS GRÁFICOS ----------
import shutil
DESTINOS = {
    "graph.json": ["rede-paises"],
    "titulos_genero.json": ["beeswarm"],
    "dumbbell.json": ["dumbbell"],
    "meta.json": ["rede-paises", "beeswarm", "dumbbell"],
}
for arquivo, pastas in DESTINOS.items():
    for pasta in pastas:
        destino = os.path.join(RAIZ, pasta, "data")
        os.makedirs(destino, exist_ok=True)
        shutil.copy(os.path.join(PASTA_SAIDA, arquivo), destino)
        print("copiado:", os.path.join(pasta, "data", arquivo))
