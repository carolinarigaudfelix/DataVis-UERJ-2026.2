// Dumbbell (variação do dot plot): filmes importados (título traduzido) x originais, por país
// Exemplo de referência: https://observablehq.com/@d3/dot-plot/2

const LARGURA = 900;
const MARGEM = { top: 30, right: 70, bottom: 10, left: 200 };
const ALTURA_LINHA = 22;

const fmtBR = n => d3.format(",d")(Math.round(n)).replace(/,/g, ".");
const fmtNota = n => n.toFixed(2).replace(".", ",");
const normalizar = t => (t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

// Cada medida sabe ler os dados, montar a escala e escrever a diferença
const MEDIDAS = {
  nota: {
    traduzido: d => d.nota_traduzido,
    mantido: d => d.nota_mantido,
    dif: d => d.dif_nota,
    escala: dominio => d3.scaleLinear(dominio, [MARGEM.left, LARGURA - MARGEM.right]).nice(),
    eixo: d => String(d).replace(".", ","),
    valor: fmtNota,
    textoDif: v => { const r = Math.round(v * 100) / 100;
      return (r > 0 ? "+" : r < 0 ? "−" : "") + Math.abs(r).toFixed(2).replace(".", ","); },
    sinal: v => Math.round(v * 100) / 100,          // > 0: traduzidos maior
  },
  votos: {
    traduzido: d => d.votos_traduzido,
    mantido: d => d.votos_mantido,
    dif: d => d.razao_votos,
    escala: dominio => d3.scaleLog(dominio, [MARGEM.left, LARGURA - MARGEM.right]).nice(),
    // escala logarítmica: rotula só 1, 2 e 5 de cada potência de 10 (1.000, 2.000, 5.000...)
    eixo: d => { const k = Math.round(d / 10 ** Math.floor(Math.log10(d)));
      return [1, 2, 5].includes(k) ? fmtBR(d) : ""; },
    valor: v => fmtBR(v) + " votos",
    textoDif: v => "×" + v.toFixed(1).replace(".", ","),
    sinal: v => Math.round((v - 1) * 10) / 10,      // > 0: traduzidos com mais votos
  },
};

const svg = d3.select("#grafico").append("svg");
const tooltip = d3.select("#tooltip");

Promise.all([
  d3.json("data/dumbbell.json"),
  d3.json("data/meta.json").catch(() => null),
]).then(([dados, meta]) => {
  const slider = document.getElementById("minFilmes");
  slider.max = d3.max(dados, d => Math.min(d.filmes_mantido, d.filmes_traduzido));
  let destacado = null;

  slider.oninput = desenhar;
  d3.selectAll("input[name=ordem], input[name=medida]").on("change", desenhar);

  // ---------- busca de país ----------
  const campo = document.getElementById("buscaPais");
  const msg = document.getElementById("msgBusca");
  d3.select("#listaPaises").selectAll("option")
    .data([...dados].sort((a, b) => nomePais(a.Regiao).localeCompare(nomePais(b.Regiao), "pt-BR")))
    .join("option").attr("value", d => nomePais(d.Regiao));

  campo.addEventListener("input", () => {
    const q = normalizar(campo.value);
    msg.textContent = "";
    if (!q) { destacado = null; desenhar(); return; }
    const achado = dados.find(d => normalizar(nomePais(d.Regiao)) === q || normalizar(d.Regiao) === q) ||
      (dados.filter(d => normalizar(nomePais(d.Regiao)).startsWith(q)).length === 1
        ? dados.find(d => normalizar(nomePais(d.Regiao)).startsWith(q)) : null);
    destacado = achado ? achado.Regiao : null;
    desenhar();
    if (!achado && q.length >= 3 && !dados.some(d => normalizar(nomePais(d.Regiao)).startsWith(q))) {
      msg.textContent = "País não encontrado. Ele pode não ter filmes suficientes nos dois grupos.";
    }
  });

  if (meta) {
    d3.select("#rodape").text(
      `Fonte: ${meta.fonte}. Filmes lançados de ${meta.ano_inicial} a ${meta.ano_final}, com pelo ` +
      `menos 50 votos. Cada filme entra em um único grupo por país: "original" se algum nome dele ` +
      `no país é igual ao nome original; "importado" se ele só aparece com nome traduzido.`);
  }

  desenhar();

  function desenhar() {
    const minimo = +slider.value;
    document.getElementById("vMin").textContent = fmtBR(minimo);
    const ordem = document.querySelector("input[name=ordem]:checked").value;
    const m = MEDIDAS[document.querySelector("input[name=medida]:checked").value];

    const linhas = dados
      .filter(d => d.filmes_mantido >= minimo && d.filmes_traduzido >= minimo)
      .sort(ordem === "pais"
        ? (a, b) => nomePais(a.Regiao).localeCompare(nomePais(b.Regiao), "pt-BR")
        : (a, b) => m.dif(b) - m.dif(a));

    if (destacado && !linhas.some(d => d.Regiao === destacado)) {
      msg.textContent = `${nomePais(destacado)} está escondido pelo mínimo de filmes. Diminua o controle abaixo.`;
    } else if (destacado) {
      msg.textContent = "";
    }

    // eixo x fixo para todas as ordenações e filtros (a comparação entre telas não muda)
    const x = m.escala(d3.extent(dados.flatMap(d => [m.traduzido(d), m.mantido(d)])));

    const altura = MARGEM.top + linhas.length * ALTURA_LINHA + MARGEM.bottom;
    svg.attr("viewBox", [0, 0, LARGURA, altura]);
    const y = d3.scaleBand(linhas.map(d => d.Regiao), [MARGEM.top, altura - MARGEM.bottom])
      .padding(0.2);
    const t = svg.transition().duration(500);

    svg.selectAll("g.eixo").data([null]).join("g").attr("class", "eixo")
      .attr("transform", `translate(0,${MARGEM.top - 6})`)
      .call(d3.axisTop(x).ticks(6, ",").tickSize(-(altura - MARGEM.top - MARGEM.bottom + 6))
        .tickFormat(m.eixo));

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
        g.append("circle").attr("class", "mantido").attr("r", 5.5);
        g.append("circle").attr("class", "traduzido").attr("r", 5.5);
        g.append("text").attr("class", "gap").attr("dy", "0.35em");
        return g;
      }, update => update, exit => exit.transition(t).attr("opacity", 0).remove());

    linha.classed("destacada", d => d.Regiao === destacado);
    linha.transition(t)
      .attr("opacity", 1)
      .attr("transform", d => `translate(0,${y(d.Regiao) + y.bandwidth() / 2})`);

    linha.select(".alvo")
      .attr("x", 0).attr("width", LARGURA)
      .attr("y", -ALTURA_LINHA / 2).attr("height", ALTURA_LINHA);
    linha.select(".regiao").attr("x", MARGEM.left - 12).text(d => nomePais(d.Regiao));
    linha.select(".haste").transition(t)
      .attr("x1", d => x(m.mantido(d))).attr("x2", d => x(m.traduzido(d)));
    linha.select("circle.mantido").transition(t).attr("cx", d => x(m.mantido(d)));
    linha.select("circle.traduzido").transition(t).attr("cx", d => x(m.traduzido(d)));
    linha.select(".gap").attr("x", LARGURA - MARGEM.right + 10)
      .attr("class", d => { const s = m.sinal(m.dif(d)); return "gap" + (s > 0 ? " positivo" : s < 0 ? " negativo" : ""); })
      .text(d => m.textoDif(m.dif(d)));

    linha.on("mousemove click", (e, d) => {
      tooltip.html(
        `<b>${nomePaisComCodigo(d.Regiao)}</b><br>` +
        `<span style="color:var(--traduzido)">●</span> Importados: nota ${fmtNota(d.nota_traduzido)} · ` +
        `${fmtBR(d.votos_traduzido)} votos (mediana) · ${fmtBR(d.filmes_traduzido)} filmes<br>` +
        `<span style="color:var(--mantido)">●</span> Originais: nota ${fmtNota(d.nota_mantido)} · ` +
        `${fmtBR(d.votos_mantido)} votos (mediana) · ${fmtBR(d.filmes_mantido)} filmes`)
        .style("left", e.clientX + 14 + "px").style("top", e.clientY + 14 + "px")
        .style("opacity", 1);
    }).on("mouseleave", () => tooltip.style("opacity", 0));

    // leva a linha do país buscado para a área visível
    if (destacado) {
      const no = linha.filter(d => d.Regiao === destacado).node();
      if (no) setTimeout(() => no.scrollIntoView({ behavior: "smooth", block: "center" }), 550);
    }
  }
}).catch(() => {
  d3.select("#grafico").html(
    "<p>Não encontrei <code>data/dumbbell.json</code>. Rode " +
    "<code>preparacao/preparar_dados.py</code> e copie o arquivo para esta pasta. " +
    "Para abrir localmente, use <code>python -m http.server</code> na raiz do projeto.</p>");
});
