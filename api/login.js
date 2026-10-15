// /api/login.js
const { google } = require("googleapis");
const { COLUNAS, RANGES } = require("./_config");

async function acessarPlanilha() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key:
        process.env.GOOGLE_PRIVATE_KEY &&
        process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  return google.sheets({ version: "v4", auth });
}

module.exports = async (req, res) => {
  try {
    const query = req.method === "GET" ? req.query : req.body;
    const usuario = query.usuario;
    const senha = query.senha;

    if (!usuario || !senha) {
      return res.status(400).json({ erro: "Credenciais faltando." });
    }

    const sheets = await acessarPlanilha();
    const sheetId = process.env.SHEET_ID;

    // 1) verificar aba usuarios primeiro (A: Usuario | B: Senha | C: Cargo/Nome da pessoa)
    const usuariosResp = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: "usuarios!A:C"
    });
    const usuariosRows = usuariosResp.data.values || [];
    const matchGestao = usuariosRows.find(row => (row[0] === usuario && row[1] === senha));

    if (matchGestao) {
      return res.json({
        success: true,
        perfil: "gestao",
        nome: matchGestao[0],
        cargo: matchGestao[2] || "Gestão"
      });
    }

    // 2) Analistas (Consultor de COP)
    const A = COLUNAS.analistas;
    const analResp = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `Relatorio Analistas!${RANGES.analistas}`
    });

    for (let row of (analResp.data.values || [])) {
      // usuário pode digitar o nome (COLABORADORES) ou o LOGIN
      if ((row[A.nome] === usuario || row[A.login] === usuario) && row[A.senha] === senha) {
        return res.json({
          tipo: "analista",
          nome: row[A.nome],
          "CA Reparo": row[A.caReparo],
          "CA Mud End": row[A.caMudEnd],
          "% ABS": row[A.abs],
          "Tempo Prod": row[A.tempoProd],
          "Percentual Salário": row[A.salario],
          Nivel: row[A.nivel]
        });
      }
    }

    // 3) Auxiliares (Auxiliar de COP)
    const X = COLUNAS.auxiliares;
    const auxResp = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `Relatorio Auxiliares!${RANGES.auxiliares}`
    });

    for (let row of (auxResp.data.values || [])) {
      if ((row[X.nome] === usuario || row[X.login] === usuario) && row[X.senha] === senha) {
        return res.json({
          tipo: "auxiliar",
          nome: row[X.nome],
          "CA Mud End": row[X.caMudEnd],
          "CA Ativação": row[X.caAtivacao],
          "% ABS": row[X.abs],
          "Tempo Prod": row[X.tempoProd],
          "Percentual Salário": row[X.salario],
          Nivel: row[X.nivel]
        });
      }
    }

    return res.status(401).json({ erro: "Usuário ou senha incorretos." });

  } catch (err) {
    console.error("Erro /api/login:", err);
    return res.status(500).json({ erro: err.message });
  }
};
