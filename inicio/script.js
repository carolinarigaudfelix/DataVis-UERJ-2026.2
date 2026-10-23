// Página inicial UERJ Flix: pop-up do Jaccard e confete do botão "Fim" (sem som)

// ---------- pop-up ----------
document.querySelectorAll("[data-abre]").forEach(botao => {
  botao.addEventListener("click", () => document.getElementById(botao.dataset.abre).showModal());
});
document.querySelectorAll("dialog").forEach(pop => {
  pop.querySelector("[data-fecha]").addEventListener("click", () => pop.close());
  // fecha ao tocar fora da caixa
  pop.addEventListener("click", e => { if (e.target === pop) pop.close(); });
});

// ---------- confete ----------
const tela = document.getElementById("confete");
const ctx = tela.getContext("2d");
const CORES = ["#f0954a", "#5b9bff", "#b38cff", "#4cc38a", "#f3f1ec", "#ffd166"];
let pecas = [], animando = false;

function ajustarTela() {
  const r = window.devicePixelRatio || 1;
  tela.width = innerWidth * r; tela.height = innerHeight * r;
  ctx.setTransform(r, 0, 0, r, 0, 0);
}

function soltarConfete() {
  ajustarTela();
  const menos = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const total = menos ? 60 : 220;
  for (let i = 0; i < total; i++) {
    const deEsquerda = i % 2 === 0;               // dois "canhões", um de cada canto de baixo
    pecas.push({
      x: deEsquerda ? 0 : innerWidth,
      y: innerHeight,
      vx: (deEsquerda ? 1 : -1) * (4 + Math.random() * 9),
      vy: -(12 + Math.random() * 12),
      giro: Math.random() * Math.PI, vgiro: (Math.random() - .5) * .4,
      w: 7 + Math.random() * 7, h: 4 + Math.random() * 5,
      cor: CORES[i % CORES.length], vida: 0,
    });
  }
  if (!animando) { animando = true; requestAnimationFrame(quadro); }
}

function quadro() {
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  pecas.forEach(p => {
    p.vy += 0.35; p.vx *= 0.99;                   // gravidade e resistência do ar
    p.x += p.vx; p.y += p.vy; p.giro += p.vgiro; p.vida++;
    ctx.save();
    ctx.translate(p.x, p.y); ctx.rotate(p.giro);
    ctx.fillStyle = p.cor;
    ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.vida / 6)));
    ctx.restore();
  });
  pecas = pecas.filter(p => p.y < innerHeight + 40 && p.vida < 400);
  if (pecas.length) requestAnimationFrame(quadro);
  else { animando = false; ctx.clearRect(0, 0, innerWidth, innerHeight); }
}

document.getElementById("botaoFim").addEventListener("click", () => {
  soltarConfete();
  const fim = document.getElementById("letreiroFim");
  fim.textContent = "Obrigada pela sessão!";
  fim.classList.add("on");
  setTimeout(() => fim.scrollIntoView({ behavior: "smooth", block: "center" }), 200);
});
