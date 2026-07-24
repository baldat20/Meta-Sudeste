const { google } = require("googleapis");

// ----------------------------------------
const SUPERVISORES_LIST = [
  "Erika Silvestre Nunes",
  "Joyce Francieli Silva",
  "Joyce Carla Santos Marques",
  "Renata Ferreira de Oliveira",
  "Lucas",
  "Poliana"
];

// ----------------------------------------
const NIVEL_ORDER = {
  "SUPERAÇÃO": 1,
  "DEFINIDA": 2,
  "TOLERÁVEL": 3,
  "NÃO ATINGIU": 4
};

// ----------------------------------------
function normalize(str) {
  return (str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

// ----------------------------------------
function sortByNivel(a, b) {
  const aRank = NIVEL_ORDER[(a.nivel || "").toUpperCase()] || 999;
  const bRank = NIVEL_ORDER[(b.nivel || "").toUpperCase()] || 999;
  if (aRank !== bRank) return aRank - bRank;
  return (a.nome || "").localeCompare(b.nome || "");
}

// ----------------------------------------
async function acessarPlanilha() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key:
        process.env.GOOGLE_PRIVATE_KEY &&
        process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return google.sheets({ version: "v4", auth });
}

// ----------------------------------------
module.exports = async (req, res) => {

  // 🔐 TROCAR SENHA (ANTES DO RESTO)
  if (req.method === "POST" && req.body?.acao === "trocarSenha") {
    return alterarSenha(req, res);
  }

  try {
    const query = req.method === "GET" ? req.query : req.body;

    const tipo = (query.tipo || "").toLowerCase();
    const supervisao = query.supervisao || "";
    const cargo = (query.cargo || "").trim();

    const sheets = await acessarPlanilha();
    const sheetId = process.env.SHEET_ID;

    // ---------------- ANALISTAS
    const analistasResp = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: "Relatorio Analistas!A2:P",
    });

    const analistasRows = analistasResp.data.values || [];

    const analistas = analistasRows.map(row => ({
      nome: row[0] || "",
      login: row[0] || "",
      senha: row[2] || "",
      tma: row[4] || "",
      tme: row[5] || "",
      tempoProd: row[6] || "",
      abs: row[7] || "",
      nivel: row[14] || "",
      supervisao: row[15] || ""
    }));

    // ---------------- AUX
    const auxResp = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: "Relatorio Auxiliares!A2:L",
    });

    const auxRows = auxResp.data.values || [];

    const auxiliares = auxRows.map(row => ({
      nome: row[0] || "",
      login: row[0] || "",
      senha: row[1] || "",
      eficiencia: row[2] || "",
      vrep: row[3] || "",
      abs: row[4] || "",
      nivel: row[10] || "",
      supervisao: row[11] || ""
    }));

    // ---------------- FILTROS
    function filtrarAnalistasPor(supervisorNome) {
      const target = normalize(supervisorNome);

      return analistas
        .filter(a => normalize(a.supervisao) === target)
        .map(a => ({
          nome: a.nome,
          login: a.login,
          senha: a.senha,
          tma: a.tma,
          tme: a.tme,
          tempoProd: a.tempoProd,
          abs: a.abs,
          nivel: a.nivel
        }))
        .sort(sortByNivel);
    }

    function filtrarAuxiliaresPor(supervisorNome) {
      const target = normalize(supervisorNome);

      return auxiliares
        .filter(a => normalize(a.supervisao) === target)
        .map(a => ({
          nome: a.nome,
          login: a.login,
          senha: a.senha,
          eficiencia: a.eficiencia,
          vrep: a.vrep,
          abs: a.abs,
          nivel: a.nivel
        }))
        .sort(sortByNivel);
    }

    const isCoord = cargo === "Leticia Caroline Da Silva";

    // ---------------- COORD TODAS
    if (isCoord && !supervisao) {
      const resultado = {};
      for (const sup of SUPERVISORES_LIST) {
        resultado[sup] = {
          analistas: filtrarAnalistasPor(sup),
          auxiliares: filtrarAuxiliaresPor(sup)
        };
      }
      return res.json({ supervisores: resultado });
    }

    const targetSupervisao = supervisao || cargo;

    // ---------------- COORD UMA
    if (isCoord && SUPERVISORES_LIST.includes(targetSupervisao)) {
      const respObj = {
        supervisao: targetSupervisao,
        analistas: filtrarAnalistasPor(targetSupervisao),
        auxiliares: filtrarAuxiliaresPor(targetSupervisao),
      };

      if (tipo === "analistas") return res.json({ analistas: respObj.analistas });
      if (tipo === "auxiliares") return res.json({ auxiliares: respObj.auxiliares });

      return res.json(respObj);
    }

    // ---------------- SUPERVISORA
    if (!isCoord && SUPERVISORES_LIST.includes(cargo)) {
      const respObj = {
        supervisao: cargo,
        analistas: filtrarAnalistasPor(cargo),
        auxiliares: filtrarAuxiliaresPor(cargo),
      };

      if (tipo === "analistas") return res.json({ analistas: respObj.analistas });
      if (tipo === "auxiliares") return res.json({ auxiliares: respObj.auxiliares });

      return res.json(respObj);
    }

    return res.status(403).json({ erro: "Acesso não autorizado." });

  } catch (e) {
    console.error("Erro API:", e);
    return res.status(500).json({ erro: e.message });
  }
};

// ----------------------------------------
// 🔐 ALTERAR SENHA
// ----------------------------------------
async function alterarSenha(req, res){
try{

const {usuario,novaSenha,solicitante}=req.body;

if(!usuario || !novaSenha){
 return res.status(400).json({erro:"Dados inválidos"});
}

const sheets = await acessarPlanilha();
const sheetId = process.env.SHEET_ID;

const isCoord = solicitante==="Leticia Caroline Da Silva";

// ===== ANALISTAS
const analistasResp = await sheets.spreadsheets.values.get({
 spreadsheetId:sheetId,
 range:"Relatorio Analistas!A2:P"
});

const analistas = analistasResp.data.values||[];

for(let i=0;i<analistas.length;i++){

 const nomeUser = analistas[i][0];
 const sup = analistas[i][15];

 if(nomeUser===usuario){

   if(isCoord || solicitante===sup || solicitante===usuario){

     await sheets.spreadsheets.values.update({
       spreadsheetId:sheetId,
       range:`Relatorio Analistas!C${i+2}`,
       valueInputOption:"RAW",
       requestBody:{values:[[novaSenha]]}
     });

     return res.json({ok:true});
   }

   return res.status(403).json({erro:"Sem permissão"});
 }
}

// ===== AUX
const auxResp = await sheets.spreadsheets.values.get({
 spreadsheetId:sheetId,
 range:"Relatorio Auxiliares!A2:L"
});

const aux = auxResp.data.values||[];

for(let i=0;i<aux.length;i++){

 const nomeUser = aux[i][0];
 const sup = aux[i][11];

 if(nomeUser===usuario){

   if(isCoord || solicitante===sup || solicitante===usuario){

     await sheets.spreadsheets.values.update({
       spreadsheetId:sheetId,
       range:`Relatorio Auxiliares!B${i+2}`,
       valueInputOption:"RAW",
       requestBody:{values:[[novaSenha]]}
     });

     return res.json({ok:true});
   }

   return res.status(403).json({erro:"Sem permissão"});
 }
}

return res.status(404).json({erro:"Usuário não encontrado"});

}catch(e){
return res.status(500).json({erro:e.message});
}
}
