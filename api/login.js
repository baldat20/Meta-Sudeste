// /api/login.js
const { google } = require("googleapis");
const { COLUNAS, RANGES, normalize } = require("./_config");
const { lerGestao } = require("./_gestao");

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

    // 1) aba Gestão primeiro (Nomes | Usuario | senha | Cargo)
    let gestao = [];
    try {
      gestao = await lerGestao(sheets, sheetId);
    } catch (e) {
      // se a aba não puder ser lida, colaboradores ainda conseguem entrar
      console.error("Erro ao ler aba Gestão:", e.message);
    }

    const matchGestao = gestao.find(p =>
      (normalize(p.usuario) === normalize(usuario) || normalize(p.nome) === normalize(usuario)) &&
      p.senha === senha
    );

    if (matchGestao) {
      if (!matchGestao.papel) {
        return res.status(403).json({ erro: "Seu cargo não tem acesso ao painel." });
      }
      return res.json({
        success: true,
        perfil: "gestao",
        nome: matchGestao.nome,      // nome usado para filtrar os colaboradores (coluna Hierarquia)
        cargo: matchGestao.cargo
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
