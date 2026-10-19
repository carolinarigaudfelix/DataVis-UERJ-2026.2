# =============================================================================
#  Amostra para conferir a análise do dumbbell (importado x original)
#  Rode DEPOIS do preparar_dados.py:   python preparacao/amostra_traducao.py
#  Opcional: escolha os países →       python preparacao/amostra_traducao.py BR JP FR
# =============================================================================
import os, sys
import polars as pl

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ARQ = os.path.join(RAIZ, "saida", "titulos_traduzidos.parquet")
PAISES = sys.argv[1:] or ["BR", "FR", "JP", "US", "GB"]
EXEMPLOS = 8

if not os.path.exists(ARQ):
    sys.exit("Rode primeiro: python preparacao/preparar_dados.py")

pl.Config.set_tbl_rows(50)
pl.Config.set_fmt_str_lengths(45)
pl.Config.set_tbl_width_chars(160)
pl.Config.set_thousands_separator(".")
pl.Config.set_decimal_separator(",")

df = (pl.read_parquet(ARQ)
        .with_columns(pl.col("startYear").cast(pl.Utf8).alias("ano"))
        .with_columns(pl.col("Grupo").replace({"traduzido": "importado", "mantido": "original"}))
        .rename({"originalTitle": "título original", "TituloNoPais": "título no país",
                 "averageRating": "nota", "numVotes": "votos"}))

for pais in PAISES:
    d = df.filter(pl.col("region") == pais)
    if d.is_empty():
        print(f"\n### {pais}: sem dados"); continue
    print(f"\n{'=' * 90}\n### {pais}\n{'=' * 90}")

    resumo = (d.group_by("Grupo")
               .agg(pl.len().alias("filmes"),
                    pl.col("nota").mean().round(2).alias("nota média"),
                    pl.col("votos").median().cast(pl.Int64).alias("votos (mediana)"))
               .sort("Grupo"))
    print(resumo)

    for grupo in ["importado", "original"]:
        g = d.filter(pl.col("Grupo") == grupo)
        colunas = ["título original", "título no país", "ano", "nota", "votos"]
        print(f"\n-- {grupo.upper()}: os {EXEMPLOS} mais votados")
        print(g.sort("votos", descending=True).head(EXEMPLOS).select(colunas))
        print(f"-- {grupo.upper()}: {EXEMPLOS} sorteados")
        print(g.sample(min(EXEMPLOS, g.height), seed=1).select(colunas))
