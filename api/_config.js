// api/_config.js
// Configuração central dos indicadores (out/26).
// Arquivos com "_" no início não viram endpoint na Vercel.

// ------------------------------------------------------------------
// COLUNAS DA PLANILHA (índice começa em 0: A=0, B=1, C=2, D=3...)
// Se alguma coluna da planilha mudar, ajuste SOMENTE aqui.
// ------------------------------------------------------------------
const COLUNAS = {
  // Aba "Relatorio Analistas" (Consultor de COP)
  // COLABORADORES | SMART | LOGIN | SENHA | ... | CA REPARO | CA MUD END | % ABS | TEMPO PROD |
  // ATG x4 | ATG TOTAL | % SALARIO | NÍVEL ATINGIDO | (hierarquia)
  analistas: {
    nome: 0,        // A  COLABORADORES
    login: 2,       // C  LOGIN
    senha: 3,       // D  SENHA
    caReparo: 4,    // E  CA REPARO
    caMudEnd: 5,    // F  CA MUD END
    abs: 6,         // G  % ABS
    tempoProd: 7,   // H  TEMPO PROD
    salario: 13,    // N  % SALARIO
    nivel: 14,      // O  NÍVEL ATINGIDO
    supervisao: 15  // P  ⚠ CONFIRMAR: coluna de hierarquia/supervisor (não veio no cabeçalho enviado)
  },
  // Aba "Relatorio Auxiliares" (Auxiliar de COP)
  // COLABORADORES | SMART | LOGIN | SENHA | ... | CA MUD END | CA ATIVAÇÃO | % ABS | TEMPO PROD |
  // ATG x4 | ATG TOTAL | % SALARIO | NÍVEL ATINGIDO | Hierarquia
  auxiliares: {
    nome: 0,        // A  COLABORADORES
    login: 2,       // C  LOGIN
    senha: 3,       // D  SENHA
    caMudEnd: 4,    // E  CA MUD END
    caAtivacao: 5,  // F  CA ATIVAÇÃO
    abs: 6,         // G  % ABS
    tempoProd: 7,   // H  TEMPO PROD
    salario: 13,    // N  % SALARIO
    nivel: 14,      // O  NÍVEL ATINGIDO
    supervisao: 15  // P  Hierarquia
  }
};

// ------------------------------------------------------------------
// ABA DE GESTÃO (supervisão e coordenação)
// Nomes | Usuario | senha | Cargo
// ------------------------------------------------------------------
const ABAS = {
  gestao: "Gestão"   // nome exato da aba na planilha
};

const GESTAO = {
  nome: 0,      // A  Nomes   (também é o nome que aparece na coluna Hierarquia dos colaboradores)
  usuario: 1,   // B  Usuario
  senha: 2,     // C  senha
  cargo: 3      // D  Cargo
};

// Intervalos lidos de cada aba (precisam cobrir a última coluna usada)
const RANGES = {
  analistas: "A2:P",
  auxiliares: "A2:P",
  gestao: "A2:D"
};

function normalize(str) {
  return (str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

// ------------------------------------------------------------------
// PERMISSÕES a partir do texto da coluna "Cargo" da aba Gestão
//   começa com "coordena" (Coordenador, Coordenadora...) -> vê todos os colaboradores
//   começa com "supervis" (Supervisor, Supervisora...)   -> vê só os seus colaboradores
//   qualquer outro cargo                                  -> sem acesso ao painel
// Para liberar outro cargo (ex.: Gerente), adicione o prefixo na lista certa.
// ------------------------------------------------------------------
const CARGOS_COORDENACAO = ["coordena"];
const CARGOS_SUPERVISAO  = ["supervis"];

function papelDoCargo(cargo) {
  const c = normalize(cargo);
  if (!c) return null;
  if (CARGOS_COORDENACAO.some(p => c.startsWith(p))) return "coordenacao";
  if (CARGOS_SUPERVISAO.some(p => c.startsWith(p))) return "supervisao";
  return null;
}

// índice da coluna -> letra (0 = A, 1 = B ...), usado ao gravar senha
function colLetra(i) {
  return String.fromCharCode(65 + i);
}

// ------------------------------------------------------------------
// METAS POR FAIXA (out/26)
// ------------------------------------------------------------------
const METAS = {
  caReparo:   { superacao: 87.0, definida: 84.0, toleravel: 81.0 },
  caMudEnd:   { superacao: 85.0, definida: 82.0, toleravel: 79.0 },
  caAtivacao: { superacao: 85.0, definida: 82.0, toleravel: 79.0 },
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

module.exports = { COLUNAS, METAS, RANGES, ABAS, GESTAO, colLetra, normalize, papelDoCargo, parseTime, parsePct };
