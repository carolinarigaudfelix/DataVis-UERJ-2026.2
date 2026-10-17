// Force-directed graph: países ligados por sobreposição de catálogo (índice de Jaccard)
// Exemplo de referência: https://observablehq.com/@d3/force-directed-graph/2

const svg = d3.select("svg");
const width = window.innerWidth, height = window.innerHeight;
const g = svg.append("g");

const zoom = d3.zoom().scaleExtent([0.05, 10])
  .on("zoom", e => g.attr("transform", e.transform));
svg.call(zoom).on("dblclick.zoom", null);

function enquadrar() {
  const b = g.node().getBBox();
  if (!b.width) return;
  const k = 0.9 * Math.min(width / b.width, height / b.height);
  const tx = width / 2 - k * (b.x + b.width / 2);
  const ty = height / 2 - k * (b.y + b.height / 2);
  svg.transition().duration(600)
     .call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(k));
}

const virgula = (n, casas) => n.toFixed(casas).replace(".", ",");

d3.json("data/meta.json").then(meta => {
  document.getElementById("rodape").textContent =
    `Fonte: ${meta.fonte}. Filmes lançados de ${meta.ano_inicial} a ${meta.ano_final}. ` +
    `Só entram países com pelo menos 1.000 filmes.`;
}).catch(() => {});

d3.json("data/graph.json").then(data => {
  const links = data.links.map(d => ({...d}));
  const nodes = data.nodes.map(d => ({...d}));

  let mult = 1, distMult = 2, selecionado = null;
  const raioBase = d3.scaleSqrt(d3.extent(nodes, d => d.filmes), [8, 30]);
  const R = d => raioBase(d.filmes) * mult;
  const cor = d3.scaleSequential(d3.extent(nodes, d => d.nota), d3.interpolateYlGnBu);
  const larg = d3.scaleLinear(d3.extent(links, d => d.value), [0.5, 6]);

  // ---------- legenda de cor (nota média) ----------
  {
    const [n0, n1] = cor.domain();
    const lg = d3.select("#legendaCor").append("svg").attr("viewBox", [0, 0, 260, 34]);
    const grad = lg.append("defs").append("linearGradient").attr("id", "gradNota");
    d3.range(0, 1.01, 0.1).forEach(t => grad.append("stop")
      .attr("offset", t).attr("stop-color", cor(n0 + t * (n1 - n0))));
    lg.append("rect").attr("x", 0).attr("y", 2).attr("width", 260).attr("height", 12)
      .attr("rx", 3).attr("fill", "url(#gradNota)");
    lg.append("text").attr("x", 0).attr("y", 28).text(`nota ${virgula(n0, 2)}`);
    lg.append("text").attr("x", 260).attr("y", 28).attr("text-anchor", "end")
      .text(`nota ${virgula(n1, 2)}`);
  }
  const distancia = d => (220 - 180 * d.value) * distMult;

  const sim = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).id(d => d.id).distance(distancia))
      .force("charge", d3.forceManyBody().strength(-600))
      .force("collide", d3.forceCollide(d => R(d) + 6))
      .force("x", d3.forceX(width / 2).strength(0.03))
      .force("y", d3.forceY(height / 2).strength(0.03));

  const link = g.append("g").selectAll("line").data(links).join("line")
      .attr("stroke", "#999").attr("stroke-opacity", 0.5)
      .attr("stroke-width", d => larg(d.value));

  const node = g.append("g").selectAll("circle").data(nodes).join("circle")
      .attr("r", R).attr("fill", d => cor(d.nota))
      .attr("stroke", "#fff").attr("stroke-width", 1.5)
      .call(d3.drag()
        .on("start", (e, d) => { if (!e.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
        .on("drag",  (e, d) => { d.fx = e.x; d.fy = e.y; })
        .on("end",   (e, d) => { if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null; }));

  node.append("title").text(d =>
    `${nomePaisComCodigo(d.id)}\n${d.filmes.toLocaleString("pt-BR")} filmes\nnota média ${virgula(d.nota, 2)}`);
  link.append("title").text(d =>
    `${nomePais(d.source.id)} e ${nomePais(d.target.id)}\n` +
    `Proporção de filmes em comum (Jaccard): ${virgula(d.value, 3)}` +
    (d.comuns ? `\n${d.comuns.toLocaleString("pt-BR")} filmes em comum` : ""));

  const label = g.append("g").selectAll("text").data(nodes).join("text")
      .attr("text-anchor", "middle").attr("dy", "0.35em").text(d => d.id);

  // ---------- destaque do país selecionado ----------
  const ehLigado = (l, d) => l.source.id === d.id || l.target.id === d.id;

  function atualizarDestaque() {
    const sel = document.getElementById("sel");
    if (!selecionado) {
      link.attr("stroke", "#999").attr("stroke-opacity", 0.5).attr("stroke-width", d => larg(d.value));
      node.attr("opacity", 1).attr("stroke", "#fff").attr("stroke-width", 1.5);
      label.attr("opacity", 1);
      sel.textContent = "Selecione um país no gráfico ou na lista acima para destacar as ligações dele.";
      seletor.value = "";
      return;
    }
    const vizinhos = new Set([selecionado.id]);
    const minhas = links.filter(l => ehLigado(l, selecionado));
    minhas.forEach(l => { vizinhos.add(l.source.id); vizinhos.add(l.target.id); });

    link.attr("stroke", l => ehLigado(l, selecionado) ? "#d62728" : "#999")
        .attr("stroke-opacity", l => ehLigado(l, selecionado) ? 0.95 : 0.05)
        .attr("stroke-width", l => ehLigado(l, selecionado) ? larg(l.value) + 1.5 : larg(l.value));
    node.attr("opacity", d => vizinhos.has(d.id) ? 1 : 0.12)
        .attr("stroke", d => d.id === selecionado.id ? "#d62728" : "#fff")
        .attr("stroke-width", d => d.id === selecionado.id ? 4 : 1.5);
    label.attr("opacity", d => vizinhos.has(d.id) ? 1 : 0.12);

    const lista = minhas
      .map(l => ({ pais: l.source.id === selecionado.id ? l.target.id : l.source.id,
                   v: l.value, comuns: l.comuns }))
      .sort((a, b) => b.v - a.v)
      .map(x => `<li><b>${nomePaisComCodigo(x.pais)}</b> — ${virgula(x.v, 3)}` +
        (x.comuns ? ` · ${x.comuns.toLocaleString("pt-BR")} filmes em comum` : "") + `</li>`)
      .join("");
    sel.innerHTML = `<b>${nomePaisComCodigo(selecionado.id)}</b>: ${selecionado.filmes.toLocaleString("pt-BR")} filmes,
      nota média ${virgula(selecionado.nota, 2)}<br>
      Ligações, da mais forte para a mais fraca (índice de Jaccard, de 0 a 1):<ol>${lista}</ol>`;
    seletor.value = selecionado.id;
  }

  // ---------- lista de países (alternativa ao toque/clique no gráfico) ----------
  const seletor = document.getElementById("pais");
  d3.select(seletor).selectAll("option.pais")
    .data([...nodes].sort((a, b) => nomePais(a.id).localeCompare(nomePais(b.id), "pt-BR")))
    .join("option").attr("class", "pais")
    .attr("value", d => d.id).text(d => nomePaisComCodigo(d.id));
  seletor.onchange = () => {
    selecionado = nodes.find(n => n.id === seletor.value) || null;
    atualizarDestaque();
  };

  node.on("click", (e, d) => {
    e.stopPropagation();
    selecionado = (selecionado && selecionado.id === d.id) ? null : d;
    atualizarDestaque();
  });
  svg.on("click", () => { selecionado = null; atualizarDestaque(); });

  sim.on("tick", () => {
    link.attr("x1", d => d.source.x).attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x).attr("y2", d => d.target.y);
    node.attr("cx", d => d.x).attr("cy", d => d.y);
    label.attr("x", d => d.x).attr("y", d => d.y);
  });
  sim.on("end", enquadrar);
  setTimeout(enquadrar, 2500);

  // ---------- controles ----------
  const $ = id => document.getElementById(id);
  const mostra = () => {
    $("vCharge").textContent = $("charge").value;
    $("vDist").textContent = $("dist").value;
    $("vRaio").textContent = $("raio").value;
  };
  mostra();
  $("charge").oninput = e => { sim.force("charge").strength(-+e.target.value); sim.alpha(0.6).restart(); mostra(); };
  $("dist").oninput = e => { distMult = +e.target.value; sim.force("link").distance(distancia); sim.alpha(0.6).restart(); mostra(); };
  $("raio").oninput = e => {
    mult = +e.target.value; node.attr("r", R);
    sim.force("collide", d3.forceCollide(d => R(d) + 6));
    sim.alpha(0.3).restart(); mostra();
  };
  $("fit").onclick = enquadrar;
});
