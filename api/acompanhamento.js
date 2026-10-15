const { google } = require("googleapis");
const { COLUNAS, METAS, RANGES, parseTime, parsePct } = require("./_config");
const { lerGestao, identificar, listarSupervisores } = require("./_gestao");

function normalize(str) {
  return (str || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
}

async function acessarPlanilha() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY && process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

async function lerAba(sheets, sheetId, range, tipo) {
  const resp = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range });
  const rows = resp.data.values || [];
  const C = COLUNAS[tipo];
  return rows.map(row => {
    const base = {
      nome: row[C.nome] || "",
      abs: row[C.abs] || "",
      tempoProd: row[C.tempoProd] || "",
      nivel: (row[C.nivel] || "").toUpperCase().trim(),
      supervisao: row[C.supervisao] || ""
    };
    if (tipo === "analistas") {
      return { ...base, caReparo: row[C.caReparo] || "", caMudEnd: row[C.caMudEnd] || "" };
    }
    return { ...base, caMudEnd: row[C.caMudEnd] || "", caAtivacao: row[C.caAtivacao] || "" };
  }).filter(r => r.nome);
}

// Abas de histórico (M-1 / M-2) estão vazias por enquanto (indicadores novos desde set/26).
// Se a aba estiver vazia ou der erro, devolve lista vazia em vez de derrubar a API.
async function lerAbaHistorico(sheets, sheetId, range, tipo) {
  try {
    return await lerAba(sheets, sheetId, range, tipo);
  } catch (e) {
    console.warn("Histórico indisponível:", range, e.message);
    return [];
  }
}

// ---------- indicadores fora do padrão (abaixo da meta DEFINIDA) ----------
const temValor = v => v !== undefined && v !== null && String(v).trim() !== "";
const pctAbaixo = (v, meta) => temValor(v) && parsePct(v) < meta;

function indicadoresFora_analista(row) {
  const fora = [];
  if (pctAbaixo(row.caReparo, METAS.caReparo.definida)) fora.push("CA Reparo");
  if (pctAbaixo(row.caMudEnd, METAS.caMudEnd.definida)) fora.push("CA Mud End");
  if (temValor(row.abs) && parsePct(row.abs) > METAS.abs.definida) fora.push("ABS");
  if (temValor(row.tempoProd) && parseTime(row.tempoProd) < parseTime(METAS.tempoProd.definida)) fora.push("Tempo Prod.");
  return fora;
}

function indicadoresFora_auxiliar(row) {
  const fora = [];
  if (pctAbaixo(row.caMudEnd, METAS.caMudEnd.definida)) fora.push("CA Mud End");
  if (pctAbaixo(row.caAtivacao, METAS.caAtivacao.definida)) fora.push("CA Ativação");
  if (temValor(row.abs) && parsePct(row.abs) > METAS.abs.definida) fora.push("ABS");
  if (temValor(row.tempoProd) && parseTime(row.tempoProd) < parseTime(METAS.tempoProd.definida)) fora.push("Tempo Prod.");
  return fora;
}

const NIVEL_ORDER = { "SUPERAÇÃO": 1, "DEFINIDA": 2, "TOLERÁVEL": 3, "INSUFICIENTE": 4, "NÃO ATINGIU": 4 };

function calcTendencia(m2, m1, atual) {
  const v2 = NIVEL_ORDER[m2] || 0, v1 = NIVEL_ORDER[m1] || 0, va = NIVEL_ORDER[atual] || 0;
  if (!v2 && !v1 && !va) return "sem_dados";
  const vals = [v2, v1, va].filter(v => v > 0);
  if (vals.length < 2) return "neutro";
  const primeiro = vals[0], ultimo = vals[vals.length - 1];
  if (ultimo < primeiro) return "melhora";
  if (ultimo > primeiro) return "piora";
  if (vals.length === 3 && (vals[1] !== vals[0] || vals[1] !== vals[2])) return "instavel";
  return "estavel";
}

function buildMap(arr) {
  const map = {};
  arr.forEach(r => { map[normalize(r.nome)] = r; });
  return map;
}

// Média da equipe de auxiliares (CA Mud End e CA Ativação) x meta de SUPERAÇÃO
function calcIndicadoresGeraisAux(auxAtual, supervisorFiltro) {
  const lista = supervisorFiltro
    ? auxAtual.filter(r => normalize(r.supervisao) === normalize(supervisorFiltro))
    : auxAtual;
  const metas = {
    metaCaMudEnd: METAS.caMudEnd.superacao,
    metaCaAtivacao: METAS.caAtivacao.superacao
  };
  if (!lista.length) return { caMudEnd: null, caAtivacao: null, ...metas };
  const mud  = lista.map(r => parsePct(r.caMudEnd)).filter(v => v > 0);
  const ativ = lista.map(r => parsePct(r.caAtivacao)).filter(v => v > 0);
  const media = arr => arr.length ? +(arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1) : null;
  return { caMudEnd: media(mud), caAtivacao: media(ativ), ...metas };
}

module.exports = async (req, res) => {
  try {
    const query = req.method === "GET" ? req.query : req.body;
    // O front envia o NOME da pessoa logada no parâmetro "cargo"
    const nomeLogado = (query.cargo || "").trim();
    const supervisao = query.supervisao || "";

    const sheets  = await acessarPlanilha();
    const sheetId = process.env.SHEET_ID;

    // quem é a pessoa e o que ela pode ver (aba Gestão)
    const gestao = await lerGestao(sheets, sheetId);
    const pessoa = identificar(gestao, nomeLogado);
    if (!pessoa || !pessoa.papel) return res.status(403).json({ erro: "Acesso não autorizado." });

    const isCoord = pessoa.papel === "coordenacao";
    const SUPERVISORES = listarSupervisores(gestao);

    // supervisão vê SEMPRE só os seus colaboradores; coordenação vê todos (ou filtra por uma supervisão)
    const targetSup = isCoord ? (supervisao || null) : pessoa.nome;

    const [analistasAtual, auxAtual, analistasM1, auxM1, analistasM2, auxM2] = await Promise.all([
      lerAba(sheets, sheetId, `Relatorio Analistas!${RANGES.analistas}`,  "analistas"),
      lerAba(sheets, sheetId, `Relatorio Auxiliares!${RANGES.auxiliares}`, "auxiliares"),
      lerAbaHistorico(sheets, sheetId, `META M-1 Analistas!${RANGES.analistas}`,   "analistas"),
      lerAbaHistorico(sheets, sheetId, `META M-1 Auxiliares!${RANGES.auxiliares}`, "auxiliares"),
      lerAbaHistorico(sheets, sheetId, `META M-2 Analistas!${RANGES.analistas}`,   "analistas"),
      lerAbaHistorico(sheets, sheetId, `META M-2 Auxiliares!${RANGES.auxiliares}`, "auxiliares"),
    ]);

    const mapAtualAnal = buildMap(analistasAtual);
    const mapAtualAux  = buildMap(auxAtual);
    const mapM1Anal    = buildMap(analistasM1);
    const mapM1Aux     = buildMap(auxM1);
    const mapM2Anal    = buildMap(analistasM2);
    const mapM2Aux     = buildMap(auxM2);

    function montarColaboradores(mapAtual, mapM1, mapM2, tipoStr, supervisorFiltro) {
      return Object.entries(mapAtual)
        .filter(([, data]) => !supervisorFiltro || normalize(data.supervisao) === normalize(supervisorFiltro))
        .map(([nomeNorm, data]) => {
          const src = tipoStr === "analista" ? analistasAtual : auxAtual;
          const nomeOriginal = src.find(r => normalize(r.nome) === nomeNorm)?.nome || nomeNorm;
          const m2 = mapM2[nomeNorm]?.nivel || "", m1 = mapM1[nomeNorm]?.nivel || "", atual = data.nivel || "";

          // Sem M-1 e M-2 consolidados → "Sem dados consolidados"
          const tend = (!m2 && !m1) ? "sem_dados" : calcTendencia(m2, m1, atual);

          const indicadoresFora = (tend === "piora" || tend === "instavel")
            ? (tipoStr === "analista" ? indicadoresFora_analista(data) : indicadoresFora_auxiliar(data))
            : [];
          const base = { nome: nomeOriginal, supervisao: data.supervisao, historico: { m2, m1, atual }, tendencia: tend, indicadoresFora };

          if (tipoStr === "analista") {
            return { ...base, caReparo: data.caReparo, caMudEnd: data.caMudEnd, abs: data.abs, tempoProd: data.tempoProd };
          }
          return { ...base, caMudEnd: data.caMudEnd, caAtivacao: data.caAtivacao, abs: data.abs, tempoProd: data.tempoProd };
        });
    }

    function montarPorSupervisao(sup) {
      return {
        analistas:  montarColaboradores(mapAtualAnal, mapM1Anal, mapM2Anal, "analista", sup),
        auxiliares: montarColaboradores(mapAtualAux,  mapM1Aux,  mapM2Aux,  "auxiliar", sup),
        indicadoresGeraisAux: calcIndicadoresGeraisAux(auxAtual, sup)
      };
    }

    if (isCoord && !targetSup) {
      const resultado = {};
      for (const sup of SUPERVISORES) resultado[sup] = montarPorSupervisao(sup);
      return res.json({ papel: pessoa.papel, supervisores: resultado, indicadoresGeraisAux: calcIndicadoresGeraisAux(auxAtual, null) });
    }

    return res.json({ papel: pessoa.papel, supervisao: targetSup, ...montarPorSupervisao(targetSup) });

  } catch (e) {
    console.error("Erro acompanhamento:", e);
    return res.status(500).json({ erro: e.message });
  }
};
