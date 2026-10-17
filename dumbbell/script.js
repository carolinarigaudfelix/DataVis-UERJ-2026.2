// Dumbbell (variação do dot plot): nota média de filmes próprios x importados por região
// Exemplo de referência: https://observablehq.com/@d3/dot-plot/2

const LARGURA = 900;
const MARGEM = { top: 30, right: 70, bottom: 10, left: 200 };
const ALTURA_LINHA = 22;

const fmtNota = n => n.toFixed(2).replace(".", ",");
const fmtGap = n => { const r = Math.round(n * 100) / 100;
  return (r > 0 ? "+" : r < 0 ? "−" : "") + Math.abs(r).toFixed(2).replace(".", ","); };
// verde se os próprios têm nota maior, vermelho se os importados têm, neutro se empatam
const classeGap = n => { const r = Math.round(n * 100) / 100;
  return r > 0 ? "gap positivo" : r < 0 ? "gap negativo" : "gap"; };
const fmtBR = n => d3.format(",d")(n).replace(/,/g, ".");

const svg = d3.select("#grafico").append("svg");
const tooltip = d3.select("#tooltip");

Promise.all([
  d3.json("data/dumbbell.json"),
  d3.json("data/meta.json").catch(() => null),
]).then(([dados, meta]) => {
  const slider = document.getElementById("minFilmes");
  slider.max = d3.max(dados, d => Math.min(d.filmes_propria, d.filmes_importada));

  slider.oninput = desenhar;
  d3.selectAll("input[name=ordem]").on("change", desenhar);

  if (meta) {
    d3.select("#rodape").text(
      `Fonte: ${meta.fonte}. Filmes lançados de ${meta.ano_inicial} a ${meta.ano_final}, ` +
      `com pelo menos 50 votos. "Próprio" é o filme exibido na região com o mesmo título original; ` +
      `"importado" é o exibido com título traduzido. É uma aproximação: coproduções e títulos que ` +
      `não são traduzidos (comum em países de língua inglesa) podem cair no grupo "próprio".`);
  }

  // eixo x fixo para todas as ordenações (a comparação entre telas não muda)
  const dominio = d3.extent(dados.flatMap(d => [d.nota_propria, d.nota_importada]));
  const x = d3.scaleLinear(dominio, [MARGEM.left, LARGURA - MARGEM.right]).nice();

  desenhar();

  function desenhar() {
    const minimo = +slider.value;
    document.getElementById("vMin").textContent = fmtBR(minimo);
    const ordem = document.querySelector("input[name=ordem]:checked").value;

    const linhas = dados
      .filter(d => d.filmes_propria >= minimo && d.filmes_importada >= minimo)
      .sort(ordem === "Regiao"
        ? (a, b) => nomePais(a.Regiao).localeCompare(nomePais(b.Regiao), "pt-BR")
        : (a, b) => b[ordem] - a[ordem]);

    const altura = MARGEM.top + linhas.length * ALTURA_LINHA + MARGEM.bottom;
    svg.attr("viewBox", [0, 0, LARGURA, altura]);
    const y = d3.scaleBand(linhas.map(d => d.Regiao), [MARGEM.top, altura - MARGEM.bottom])
      .padding(0.2);
    const t = svg.transition().duration(500);

    svg.selectAll("g.eixo").data([null]).join("g").attr("class", "eixo")
      .attr("transform", `translate(0,${MARGEM.top - 6})`)
      .call(d3.axisTop(x).ticks(8).tickSize(-(altura - MARGEM.top - MARGEM.bottom + 6))
        .tickFormat(d => String(d).replace(".", ",")));

    const linha = svg.selectAll("g.linhas").data([null]).join("g").attr("class", "linhas")
      .selectAll("g.linha")
      .data(linhas, d => d.Regiao)
      .join(enter => {
        const g = enter.append("g").attr("class", "linha")
          .attr("transform", d => `translate(0,${y(d.Regiao) + y.bandwidth() / 2})`)
          .attr("opacity", 0);
        g.append("rect").attr("class", "alvo");
        g.append("text").attr("class", "regiao").attr("text-anchor", "end").attr("dy", "0.35em");
        g.append("line").attr("class", "haste");
        g.append("circle").attr("class", "importada").attr("r", 5.5);
        g.append("circle").attr("class", "propria").attr("r", 5.5);
        g.append("text").attr("class", "gap").attr("dy", "0.35em");
        return g;
      }, update => update, exit => exit.transition(t).attr("opacity", 0).remove());

    linha.transition(t)
      .attr("opacity", 1)
      .attr("transform", d => `translate(0,${y(d.Regiao) + y.bandwidth() / 2})`);

    linha.select(".alvo")
      .attr("x", 0).attr("width", LARGURA)
      .attr("y", -ALTURA_LINHA / 2).attr("height", ALTURA_LINHA);
    linha.select(".regiao").attr("x", MARGEM.left - 12).text(d => nomePais(d.Regiao));
    linha.select(".haste")
      .attr("x1", d => x(d.nota_importada)).attr("x2", d => x(d.nota_propria));
    linha.select("circle.importada").attr("cx", d => x(d.nota_importada));
    linha.select("circle.propria").attr("cx", d => x(d.nota_propria));
    linha.select(".gap").attr("x", LARGURA - MARGEM.right + 10)
      .attr("class", d => classeGap(d.gap)).text(d => fmtGap(d.gap));

    linha.on("mousemove click", (e, d) => {
      tooltip.html(
        `<b>${nomePaisComCodigo(d.Regiao)}</b><br>` +
        `<span style="color:var(--propria)">●</span> Próprios: ${fmtNota(d.nota_propria)} ` +
        `(${fmtBR(d.filmes_propria)} filmes)<br>` +
        `<span style="color:var(--importada)">●</span> Importados: ${fmtNota(d.nota_importada)} ` +
        `(${fmtBR(d.filmes_importada)} filmes)<br>Diferença: ${fmtGap(d.gap)}`)
        .style("left", e.clientX + 14 + "px").style("top", e.clientY + 14 + "px")
        .style("opacity", 1);
    }).on("mouseleave", () => tooltip.style("opacity", 0));
  }
}).catch(() => {
  d3.select("#grafico").html(
    "<p>Não encontrei <code>data/dumbbell.json</code>. Rode " +
    "<code>preparacao/preparar_dados.py</code> e copie o arquivo para esta pasta. " +
    "Para abrir localmente, use <code>python -m http.server</code> na raiz do projeto.</p>");
});
