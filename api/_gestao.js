// api/_gestao.js
// Leitura da aba "Gestão" (Nomes | Usuario | senha | Cargo) e identificação de quem está logado.
// Arquivos com "_" no início não viram endpoint na Vercel.
const { ABAS, GESTAO, RANGES, normalize, papelDoCargo } = require("./_config");

// Devolve a lista de pessoas da gestão, já com o "papel" (coordenacao | supervisao | null)
async function lerGestao(sheets, sheetId) {
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `'${ABAS.gestao}'!${RANGES.gestao}`
  });

  return (resp.data.values || [])
    .map(row => ({
      nome: String(row[GESTAO.nome] || "").trim(),
      usuario: String(row[GESTAO.usuario] || "").trim(),
      senha: String(row[GESTAO.senha] || ""),
      cargo: String(row[GESTAO.cargo] || "").trim(),
      papel: papelDoCargo(row[GESTAO.cargo])
    }))
    .filter(p => p.nome);
}

// Encontra a pessoa pelo nome (o front envia o NOME da pessoa logada no parâmetro "cargo")
function identificar(gestao, nome) {
  const alvo = normalize(nome);
  if (!alvo) return null;
  return gestao.find(p => normalize(p.nome) === alvo) || null;
}

// Nomes de todas as supervisões cadastradas na aba
function listarSupervisores(gestao) {
  return gestao.filter(p => p.papel === "supervisao").map(p => p.nome);
}

module.exports = { lerGestao, identificar, listarSupervisores };
