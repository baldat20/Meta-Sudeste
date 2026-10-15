// =============================
// Recebendo parâmetros da URL
// =============================
const urlParams = new URLSearchParams(window.location.search);

if (!urlParams.get("nome") || !urlParams.get("cargo")) {
  window.location.href = "index.html";
}

const nome  = urlParams.get("nome");
const cargo = urlParams.get("cargo");

// ✅ Grava no sessionStorage para uso em outras páginas (acompanhamento, credenciais)
sessionStorage.setItem("nome",  nome);
sessionStorage.setItem("cargo", cargo);

const CORES_NIVEL = {
  "SUPERAÇÃO":    "nivel-super",
  "DEFINIDA":     "nivel-defin",
  "TOLERÁVEL":    "nivel-toler",
  "INSUFICIENTE": "nivel-nao",
  "NÃO ATINGIU":  "nivel-nao"
};

// Colunas exibidas em cada aba: [título, campo devolvido pela API]
const COLUNAS_TABELA = {
  analistas: [
    ["CA Reparo",  "caReparo"],
    ["CA Mud End", "caMudEnd"],
    ["% ABS",      "abs"],
    ["Tempo Prod", "tempoProd"]
  ],
  auxiliares: [
    ["CA Mud End",  "caMudEnd"],
    ["CA Ativação", "caAtivacao"],
    ["% ABS",       "abs"],
    ["Tempo Prod",  "tempoProd"]
  ]
};

let supervisaoSelecionada = null;
let tipoAtual = "analistas";


// =============================
// Inicialização
// =============================
document.addEventListener("DOMContentLoaded", () => {

  document.getElementById("supNome").innerText = nome;

  document.getElementById("tabAnal").onclick = () => selecionarAba("analistas");
  document.getElementById("tabAux").onclick  = () => selecionarAba("auxiliares");
  document.getElementById("btnVoltarSup").onclick = voltarParaSupervisoras;

  // A API (aba Gestão) diz se a pessoa é coordenação ou supervisão
  iniciar();
});

// =============================
// Descobre o perfil da pessoa logada (coordenação x supervisão)
// =============================
async function iniciar() {
  try {
    const resp  = await fetch(`/api/gestao?cargo=${encodeURIComponent(cargo)}`);
    const dados = await resp.json();

    if (resp.status === 403) {
      window.location.href = "index.html";
      return;
    }

    if (dados.erro) {
      alert("Erro ao carregar: " + dados.erro);
      return;
    }

    // supervisão e coordenação têm acesso ao Acompanhamento
    const btn = document.getElementById("btnAcomp");
    if (btn) btn.style.display = "inline-block";

    if (dados.supervisores) {
      // COORDENAÇÃO: vê todas as supervisões
      montarMenuSupervisoras(dados.supervisores);
    } else {
      // SUPERVISÃO: vê só os seus colaboradores
      supervisaoSelecionada = dados.supervisao || nome;
      document.getElementById("tabsRow").style.display = "flex";
      selecionarAba("analistas");
    }
  } catch (e) {
    console.error("Erro ao iniciar:", e);
    alert("Erro ao carregar: " + e.message);
  }
}

// =============================
// Lista supervisoras
// =============================
function montarMenuSupervisoras(supervisoresAPI) {
  const div = document.getElementById("menuCoord");
  div.style.display = "flex";
  div.innerHTML = `
    <h2 style="color:white; font-weight:800; margin-bottom:10px;">
      Supervisores sob sua gestão
    </h2>
  `;

  Object.keys(supervisoresAPI).forEach((sup, index) => {
    const info = supervisoresAPI[sup] || {};
    const analistasQtd  = (info.analistas  || []).length;
    const auxiliaresQtd = (info.auxiliares || []).length;

    const btn = document.createElement("button");
    btn.className = "sup-btn";
    btn.innerHTML = `
      <div>
        <strong>${index + 1}. ${sup}</strong><br>
        <span class="sup-count">${analistasQtd} consultores • ${auxiliaresQtd} auxiliares</span>
      </div>
      <span class="sup-arrow">→</span>
    `;
    btn.onclick = () => selecionarSupervisora(sup);
    div.appendChild(btn);
  });
}

// =============================
function selecionarSupervisora(nomeSup) {
  supervisaoSelecionada = nomeSup;
  document.getElementById("menuCoord").style.display  = "none";
  document.getElementById("tabsRow").style.display    = "flex";
  document.getElementById("btnVoltarSup").style.display = "inline-block";
  selecionarAba("analistas");
}

function voltarParaSupervisoras() {
  supervisaoSelecionada = null;
  document.getElementById("menuCoord").style.display  = "flex";
  document.getElementById("tabsRow").style.display    = "none";
  document.getElementById("cardArea").style.display   = "none";
  document.getElementById("btnVoltarSup").style.display = "none";
}

function montarCabecalho(tipo) {
  const cols = COLUNAS_TABELA[tipo] || [];
  document.getElementById("tabelaHead").innerHTML =
    `<th>Nome</th>` +
    cols.map(c => `<th>${c[0]}</th>`).join("") +
    `<th style="text-align:center;">Nível</th>`;
}

function selecionarAba(tipo) {
  tipoAtual = tipo;
  montarCabecalho(tipo);
  document.getElementById("tabAnal").classList.toggle("active", tipo === "analistas");
  document.getElementById("tabAux").classList.toggle("active",  tipo === "auxiliares");
  carregarRelatorio(tipoAtual);
}

// =============================
// Carregar relatório
// =============================
async function carregarRelatorio(tipo) {
  if (!supervisaoSelecionada) return;

  document.getElementById("cardArea").style.display = "block";
  document.getElementById("tabelaBody").innerHTML = `
    <tr><td colspan="6" style="padding:20px">Carregando...</td></tr>
  `;

  const url = `/api/gestao?tipo=${tipo}&supervisao=${encodeURIComponent(supervisaoSelecionada)}&cargo=${encodeURIComponent(cargo)}`;

  try {
    const resp  = await fetch(url);
    const dados = await resp.json();
    const lista = tipo === "analistas" ? dados.analistas : dados.auxiliares;
    montarTabela(lista, tipo);
  } catch (e) {
    document.getElementById("tabelaBody").innerHTML = `
      <tr><td colspan="6">Erro ao carregar: ${e.message}</td></tr>
    `;
  }
}

// =============================
function montarTabela(lista, tipo) {
  if (!lista || lista.length === 0) {
    document.getElementById("tabelaBody").innerHTML = `
      <tr><td colspan="6" style="padding:20px">Nenhum dado encontrado.</td></tr>
    `;
    return;
  }

  const cols = COLUNAS_TABELA[tipo] || [];
  let html = "";
  lista.forEach(row => {
    const corClass = CORES_NIVEL[(row.nivel || "").toUpperCase()] || "";
    html += `
      <tr>
        <td class="col-name">${row.nome}</td>
        ${cols.map(c => `<td>${row[c[1]] || ""}</td>`).join("")}
        <td style="text-align:center"><span class="badge ${corClass}">${row.nivel}</span></td>
      </tr>
    `;
  });

  document.getElementById("tabelaBody").innerHTML = html;
}

// =============================
// Credenciais
// =============================
function abrirCredenciais() {
  window.location.href = `credenciais.html?nome=${encodeURIComponent(nome)}&cargo=${encodeURIComponent(cargo)}`;
}

// =============================
// Trocar minha senha
// =============================
function trocarMinhaSenha() {
  const nova = prompt("Digite sua nova senha:");
  if (!nova) return;

  fetch("/api/gestao", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      acao:       "trocarSenha",
      usuario:    nome,
      solicitante: nome,
      novaSenha:  nova
    })
  })
  .then(r => r.json())
  .then(d => {
    if (d.ok) {
      alert("Senha alterada com sucesso");
    } else {
      alert(d.erro);
    }
  });
}
