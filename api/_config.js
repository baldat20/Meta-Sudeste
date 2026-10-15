// api/_config.js
// Configuração central dos indicadores (set/26).
// Arquivos com "_" no início não viram endpoint na Vercel.

// ------------------------------------------------------------------
// COLUNAS DA PLANILHA (índice começa em 0: A=0, B=1, C=2, D=3...)
// Se alguma coluna da planilha mudar, ajuste SOMENTE aqui.
// ------------------------------------------------------------------
const COLUNAS = {
  // Aba "Relatorio Analistas" (Consultor de COP)
  // COLABORADORES | LOGIN | (senha) | CLUSTER | CA REPARO | CA MUD END | % ABS | TEMPO PROD |
  // ATG x4 | ATG TOTAL | % SALARIO | NÍVEL ATINGIDO | (hierarquia)
  analistas: {
    nome: 0,        // A  COLABORADORES
    login: 1,       // B  LOGIN
    senha: 2,       // C  ⚠ CONFIRMAR: no cabeçalho enviado esta coluna aparece como "CARGO"
    caReparo: 4,    // E  CA REPARO
    caMudEnd: 5,    // F  CA MUD END
    abs: 6,         // G  % ABS
    tempoProd: 7,   // H  TEMPO PROD
    salario: 13,    // N  % SALARIO
    nivel: 14,      // O  NÍVEL ATINGIDO
    supervisao: 15  // P  ⚠ CONFIRMAR: coluna de hierarquia/supervisor (não veio no cabeçalho enviado)
  },
  // Aba "Relatorio Auxiliares" (Auxiliar de COP)
  // COLABORADORES | LOGIN | SENHA | CLUSTER | CA MUD END | CA ATIVAÇÃO | % ABS | TEMPO PROD |
  // ATG x4 | ATG TOTAL | % SALARIO | NÍVEL ATINGIDO | Hierarquia
  auxiliares: {
    nome: 0,        // A  COLABORADORES
    login: 1,       // B  LOGIN
    senha: 2,       // C  SENHA
    caMudEnd: 4,    // E  CA MUD END
    caAtivacao: 5,  // F  CA ATIVAÇÃO
    abs: 6,         // G  % ABS
    tempoProd: 7,   // H  TEMPO PROD
    salario: 13,    // N  % SALARIO
    nivel: 14,      // O  NÍVEL ATINGIDO
    supervisao: 15  // P  Hierarquia
  }
};

// Intervalos lidos de cada aba (precisam cobrir a última coluna usada)
const RANGES = {
  analistas: "A2:P",
  auxiliares: "A2:P"
};

// índice da coluna -> letra (0 = A, 1 = B ...), usado ao gravar senha
function colLetra(i) {
  return String.fromCharCode(65 + i);
}

// ------------------------------------------------------------------
// METAS POR FAIXA (set/26)
// ------------------------------------------------------------------
const METAS = {
  caReparo:   { superacao: 91.4, definida: 86.4, toleravel: 81.4 },
  caMudEnd:   { superacao: 88.9, definida: 83.9, toleravel: 78.9 },
  caAtivacao: { superacao: 89.1, definida: 84.1, toleravel: 79.1 },
  abs:        { superacao: 7.5,  definida: 10.0, toleravel: 12.5 },   // menor é melhor
  tempoProd:  { superacao: "06:35:00", definida: "06:20:00", toleravel: "06:05:00" }
};

// ------------------------------------------------------------------
function parseTime(str) {
  if (!str) return 0;
  const p = String(str).split(":").map(Number);
  return (p[0] || 0) * 3600 + (p[1] || 0) * 60 + (p[2] || 0);
}

function parsePct(str) {
  return parseFloat(String(str || "0").replace("%", "").replace(",", ".")) || 0;
}

module.exports = { COLUNAS, METAS, RANGES, colLetra, parseTime, parsePct };
