// Nome em português para os códigos de região do IMDb.
// Códigos ISO comuns (BR, US, JP...) são traduzidos pelo próprio navegador;
// esta lista cobre os códigos históricos e regionais que o navegador não conhece.

const NOMES_ESPECIAIS = {
  SUHH: "União Soviética",
  CSHH: "Tchecoslováquia",
  DDDE: "Alemanha Oriental",
  XWG: "Alemanha Ocidental",
  XYU: "Iugoslávia",
  YUCS: "Iugoslávia",
  XKO: "Coreia (antes da divisão)",
  BUMM: "Birmânia",
  ZRCD: "Zaire",
  VDVN: "Vietnã do Norte",
  XWW: "Mundial (lançamento internacional)",
  XEU: "Europa (lançamento regional)",
  XAS: "Ásia (lançamento regional)",
  XSA: "América do Sul (lançamento regional)",
  XNA: "América do Norte (lançamento regional)",
  XAU: "Oceania (lançamento regional)",
  XPI: "Ilhas do Pacífico",
  HK: "Hong Kong",
};

const _nomesNavegador = (() => {
  try { return new Intl.DisplayNames(["pt-BR"], { type: "region" }); }
  catch (e) { return null; }
})();

// "BR" → "Brasil"
function nomePais(codigo) {
  if (NOMES_ESPECIAIS[codigo]) return NOMES_ESPECIAIS[codigo];
  try {
    const nome = _nomesNavegador && _nomesNavegador.of(codigo);
    if (nome && nome !== codigo) return nome;
  } catch (e) { /* código fora do padrão ISO */ }
  return codigo;
}

// "BR" → "Brasil (BR)"
function nomePaisComCodigo(codigo) {
  const nome = nomePais(codigo);
  return nome === codigo ? codigo : `${nome} (${codigo})`;
}
