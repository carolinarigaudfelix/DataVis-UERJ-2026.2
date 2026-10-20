// Dumbbell (variação do dot plot): filmes exclusivos de cada país x compartilhados com outros países
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
    exclusivo: d => d.nota_exclusivo,
    compartilhado: d => d.nota_compartilhado,
    dif: d => d.dif_nota,
    escala: dominio => d3.scaleLinear(dominio, [MARGEM.left, LARGURA - MARGEM.right]).nice(),
    eixo: d => String(d).replace(".", ","),
    valor: fmtNota,
    textoDif: v => { const r = Math.round(v * 100) / 100;
      return (r > 0 ? "+" : r < 0 ? "−" : "") + Math.abs(r).toFixed(2).replace(".", ","); },
    sinal: v => Math.round(v * 100) / 100,          // > 0: exclusivos com nota maior
  },
  votos: {
    exclusivo: d => d.votos_exclusivo,
    compartilhado: d => d.votos_compartilhado,
    dif: d => d.razao_votos,
    escala: dominio => d3.scaleLog(dominio, [MARGEM.left, LARGURA - MARGEM.right]).nice(),
    // escala logarítmica: rotula só 1, 2 e 5 de cada potência de 10 (1.000, 2.000, 5.000...)
    eixo: d => { const k = Math.round(d / 10 ** Math.floor(Math.log10(d)));
      return [1, 2, 5].includes(k) ? fmtBR(d) : ""; },
    valor: v => fmtBR(v) + " votos",
    textoDif: v => "×" + v.toFixed(1).replace(".", ","),
    sinal: v => Math.round((v - 1) * 10) / 10,      // > 0: exclusivos com mais votos
  },
};

const svg = d3.select("#grafico").append("svg");
const tooltip = d3.select("#tooltip");

// Uma coluna da dica: resumo do grupo + lista dos filmes mais votados
function colunaTooltip(classe, nome, nota, votos, filmes, top = []) {
  const lista = top.map(f =>
    `<li><span class="tt-titulo">${f.titulo}</span>` +
    `<span class="tt-info">${f.ano ?? "—"} · nota ${f.nota.toFixed(1).replace(".", ",")} · ` +
    `${fmtBR(f.votos)} votos</span></li>`).join("");
  return `<div class="tt-col"><span class="tt-grupo ${classe}">● ${nome}</span>` +
    `<span class="tt-resumo">Nota média (qualidade): <b>${fmtNota(nota)}</b></span>` +
    `<span class="tt-resumo">Votos, mediana (alcance): <b>${fmtBR(votos)}</b></span>` +
    `<span class="tt-resumo">${fmtBR(filmes)} filmes no grupo</span>` +
    `<span class="tt-sub">Mais votados no IMDb:</span><ol>${lista}</ol></div>`;
}

// Mantém a dica dentro da tela (vira para a esquerda/para cima perto das bordas)
function posicionarTooltip(e) {
  const no = tooltip.node(), w = no.offsetWidth, h = no.offsetHeight, m = 14;
  let x = e.clientX + m, y = e.clientY + m;
  if (x + w > window.innerWidth - 8) x = Math.max(8, e.clientX - w - m);
  if (y + h > window.innerHeight - 8) y = Math.max(8, window.innerHeight - h - 8);
  tooltip.style("left", x + "px").style("top", y + "px");
}

Promise.all([
  d3.json("data/dumbbell.json"),
  d3.json("data/meta.json").catch(() => null),
]).then(([dados, meta]) => {
  const slider = document.getElementById("minFilmes");
  slider.max = d3.max(dados, d => Math.min(d.filmes_exclusivo, d.filmes_compartilhado));
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
      `menos 50 votos. "Exclusivo": o filme aparece registrado no IMDb em um único país. ` +
      `"Compartilhado": aparece em dois ou mais países.`);
  }

  desenhar();

  function desenhar() {
    const minimo = +slider.value;
    document.getElementById("vMin").textContent = fmtBR(minimo);
    const ordem = document.querySelector("input[name=ordem]:checked").value;
    const m = MEDIDAS[document.querySelector("input[name=medida]:checked").value];

    const linhas = dados
      .filter(d => d.filmes_exclusivo >= minimo && d.filmes_compartilhado >= minimo)
      .sort(ordem === "pais"
        ? (a, b) => nomePais(a.Regiao).localeCompare(nomePais(b.Regiao), "pt-BR")
        : (a, b) => m.dif(b) - m.dif(a));

    if (destacado && !linhas.some(d => d.Regiao === destacado)) {
      msg.textContent = `${nomePais(destacado)} está escondido pelo mínimo de filmes. Diminua o controle abaixo.`;
    } else if (destacado) {
      msg.textContent = "";
    }

    // eixo x fixo para todas as ordenações e filtros (a comparação entre telas não muda)
    const x = m.escala(d3.extent(dados.flatMap(d => [m.exclusivo(d), m.compartilhado(d)])));

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
        g.append("circle").attr("class", "compartilhado").attr("r", 5.5);
        g.append("circle").attr("class", "exclusivo").attr("r", 5.5);
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
      .attr("x1", d => x(m.compartilhado(d))).attr("x2", d => x(m.exclusivo(d)));
    linha.select("circle.compartilhado").transition(t).attr("cx", d => x(m.compartilhado(d)));
    linha.select("circle.exclusivo").transition(t).attr("cx", d => x(m.exclusivo(d)));
    linha.select(".gap").attr("x", LARGURA - MARGEM.right + 10)
      .attr("class", d => { const s = m.sinal(m.dif(d)); return "gap" + (s > 0 ? " positivo" : s < 0 ? " negativo" : ""); })
      .text(d => m.textoDif(m.dif(d)));

    linha.on("mousemove click", (e, d) => {
      tooltip.html(
        `<b>${nomePaisComCodigo(d.Regiao)}</b>` +
        `<div class="tt-colunas">` +
        colunaTooltip("exclusivo", "Exclusivos", d.nota_exclusivo, d.votos_exclusivo,
                      d.filmes_exclusivo, d.top_exclusivo) +
        colunaTooltip("compartilhado", "Compartilhados", d.nota_compartilhado, d.votos_compartilhado,
                      d.filmes_compartilhado, d.top_compartilhado) +
        `</div><span class="tt-nota">Mediana de votos: metade dos filmes do grupo tem menos votos que esse número, e metade tem mais.</span>`)
        .style("opacity", 1);
      posicionarTooltip(e);
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
