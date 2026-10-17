// Beeswarm: filmes por gênero, posicionados pela nota, destacando "gemas escondidas"
// Exemplo de referência: https://observablehq.com/@d3/beeswarm/2

const LARGURA = 1000;
const MARGEM = { top: 30, right: 20, bottom: 10, left: 110 };
const ALTURA_FAIXA = 62;          // altura de cada gênero
const NOTA_GEMA = 7.5;            // mesmo valor do preparar_dados.py

const fmtBR = n => d3.format(",d")(n).replace(/,/g, ".");
const fmtNota = n => n.toFixed(1).replace(".", ",");

const svg = d3.select("#grafico").append("svg");
const tooltip = d3.select("#tooltip");

Promise.all([
  d3.json("data/titulos_genero.json"),
  d3.json("data/meta.json").catch(() => null),
]).then(([filmes, meta]) => {
  const porRegiao = d3.group(filmes, d => d.Regiao);
  const regioes = [...porRegiao.keys()].sort((a, b) => nomePais(a).localeCompare(nomePais(b), "pt-BR"));

  const select = d3.select("#regiao");
  select.selectAll("option").data(regioes).join("option")
    .attr("value", d => d).text(d => nomePaisComCodigo(d));
  select.property("value", regioes.includes("BR") ? "BR" : regioes[0]);

  select.on("change", desenhar);
  d3.select("#soGemas").on("change", desenhar);

  if (meta) {
    d3.select("#rodape").text(
      `Fonte: ${meta.fonte}. Filmes lançados de ${meta.ano_inicial} a ${meta.ano_final}. ` +
      `A classificação de gema usa todos os filmes de cada região e gênero; o gráfico desenha ` +
      `uma amostra aleatória de até 60 filmes por gênero para manter a leitura possível.`);
  }

  // escala de raio fixa para todas as regiões (compara tamanhos entre telas)
  const raio = d3.scaleSqrt(d3.extent(filmes, d => d.NumVotos), [3.5, 10]);

  desenhar();

  function desenhar() {
    const regiao = select.property("value");
    const soGemas = d3.select("#soGemas").property("checked");
    let dados = porRegiao.get(regiao);
    if (soGemas) dados = dados.filter(d => d.gema);

    // gêneros ordenados pela proporção de gemas (mais "garimpáveis" primeiro)
    const generos = d3.rollups(porRegiao.get(regiao), v => ({
      gemas: v[0].gemas_total, total: v[0].total_grupo
    }), d => d.Genero)
      .sort((a, b) => b[1].gemas / b[1].total - a[1].gemas / a[1].total);
    const ordem = generos.map(g => g[0]);

    const altura = MARGEM.top + ordem.length * ALTURA_FAIXA + MARGEM.bottom;
    svg.attr("viewBox", [0, 0, LARGURA, altura]);

    const x = d3.scaleLinear([1, 10], [MARGEM.left, LARGURA - MARGEM.right]);
    const y = d3.scaleBand(ordem, [MARGEM.top, altura - MARGEM.bottom]);

    // posições do enxame: cada ponto puxado para sua nota (x) e para a faixa do gênero (y)
    const nos = dados.map(d => ({ ...d, x: x(d.NotaMedia), y: y(d.Genero) + y.bandwidth() / 2 }));
    const sim = d3.forceSimulation(nos)
      .force("x", d3.forceX(d => x(d.NotaMedia)).strength(1))
      .force("y", d3.forceY(d => y(d.Genero) + y.bandwidth() / 2).strength(0.15))
      .force("colisao", d3.forceCollide(d => raio(d.NumVotos) + 0.6))
      .stop();
    for (let i = 0; i < 160; i++) sim.tick();
    // mantém cada ponto dentro da própria faixa
    nos.forEach(d => {
      const topo = y(d.Genero) + 4, base = y(d.Genero) + y.bandwidth() - 4;
      d.y = Math.max(topo, Math.min(base, d.y));
    });

    // ---------- eixos e faixas ----------
    svg.selectAll("g.eixo").data([null]).join("g").attr("class", "eixo")
      .attr("transform", `translate(0,${MARGEM.top - 6})`)
      .call(d3.axisTop(x).ticks(9).tickSize(-(altura - MARGEM.top - MARGEM.bottom + 6))
        .tickFormat(d => d));

    svg.selectAll("line.faixa").data(ordem).join("line").attr("class", "faixa")
      .attr("x1", MARGEM.left).attr("x2", LARGURA - MARGEM.right)
      .attr("y1", d => y(d) + y.bandwidth()).attr("y2", d => y(d) + y.bandwidth());

    svg.selectAll("text.rotulo-genero").data(generos).join("text")
      .attr("class", "rotulo-genero")
      .attr("x", MARGEM.left - 10).attr("y", d => y(d[0]) + y.bandwidth() / 2)
      .attr("dy", "0.35em").attr("text-anchor", "end")
      .text(d => d[0]);

    // linha de corte da nota de gema
    svg.selectAll("line.corte").data([NOTA_GEMA]).join("line").attr("class", "corte")
      .attr("x1", x).attr("x2", x)
      .attr("y1", MARGEM.top).attr("y2", altura - MARGEM.bottom)
      .attr("stroke", "var(--gema)").attr("stroke-dasharray", "3 3").attr("opacity", 0.6);

    // ---------- pontos ----------
    svg.selectAll("g.pontos").data([null]).join("g").attr("class", "pontos")
      .selectAll("circle")
      .data(nos.sort((a, b) => a.gema - b.gema), d => d.ID + d.Genero)   // gemas por cima
      .join("circle")
      .attr("class", d => "filme " + (d.gema ? "gema" : "comum"))
      .attr("r", d => raio(d.NumVotos))
      .attr("cx", d => d.x).attr("cy", d => d.y)
      .on("mousemove", (e, d) => {
        tooltip.html(
          `<b>${d.TituloPrimario}</b>${d.AnoLancamento ? ` (${d.AnoLancamento})` : ""}<br>` +
          `${nomePais(d.Regiao)} · ${d.Genero} · nota ${fmtNota(d.NotaMedia)} · ${fmtBR(d.NumVotos)} votos` +
          (d.gema ? "<br><b style='color:var(--gema)'>Gema escondida</b>" : ""))
          .style("left", e.clientX + 14 + "px").style("top", e.clientY + 14 + "px")
          .style("opacity", 1);
      })
      .on("mouseleave", () => tooltip.style("opacity", 0));

    // ---------- resumo lateral (tabela = leitura sem depender da cor) ----------
    const totalGemas = d3.sum(generos, g => g[1].gemas);
    d3.select("#resumo").html(
      `<b>${nomePaisComCodigo(regiao)}</b>: ${fmtBR(totalGemas)} gemas no total ` +
      `(contando cada gênero do filme)<table>` +
      generos.map(([g, v]) =>
        `<tr><td>${g}</td><td>${fmtBR(v.gemas)} de ${fmtBR(v.total)}</td></tr>`).join("") +
      `</table>`);
  }
}).catch(() => {
  d3.select("#grafico").html(
    "<p>Não encontrei <code>data/titulos_genero.json</code>. Rode " +
    "<code>preparacao/preparar_dados.py</code> e copie o arquivo para esta pasta. " +
    "Para abrir localmente, use <code>python -m http.server</code> na raiz do projeto.</p>");
});
