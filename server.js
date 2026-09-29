// server.js — API REST do Painel Comercial
// Sessão isolada por visitante (cookie), dados vazios por padrão.
// Persistência simples em arquivo JSON (data/db.json).

const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, "data", "db.json");

const SESSAO_TTL_MS = 24 * 60 * 60 * 1000; // sessões somem após 24h sem uso
const MAX_SESSOES = 500;

app.set("trust proxy", 1);
app.use(express.json());

// ---------- camada de dados ----------
function lerDB() {
  if (!fs.existsSync(DB_PATH)) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify({ sessoes: {} }, null, 2));
  }
  const db = JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
  if (!db.sessoes) db.sessoes = {};
  return db;
}
function salvarDB(db) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}
const uid = () => crypto.randomBytes(6).toString("hex");

// ---------- estado inicial de cada sessão (vazio por padrão) ----------
function estadoInicial() {
  return { produtos: [], clientes: [], pedidos: [] };
}

// ---------- sessão por cookie ----------
function lerSid(req) {
  const m = (req.headers.cookie || "").match(/(?:^|;\s*)sid=([a-f0-9]{24})/);
  return m ? m[1] : null;
}
function sessao(req, res, next) {
  const p = req.path;
  if (!(p === "/" || p === "/index.html" || p.startsWith("/api"))) return next();

  const db = lerDB();
  let sid = lerSid(req);

  if (!sid || !db.sessoes[sid]) {
    const agora = Date.now();
    for (const [id, s] of Object.entries(db.sessoes)) {
      if (agora - s.ultimoAcesso > SESSAO_TTL_MS) delete db.sessoes[id];
    }
    const ids = Object.keys(db.sessoes);
    if (ids.length >= MAX_SESSOES) {
      ids.sort((a, b) => db.sessoes[a].ultimoAcesso - db.sessoes[b].ultimoAcesso);
      delete db.sessoes[ids[0]];
    }
    sid = crypto.randomBytes(12).toString("hex");
    db.sessoes[sid] = { ...estadoInicial(), ultimoAcesso: agora };
  } else {
    db.sessoes[sid].ultimoAcesso = Date.now();
  }
  salvarDB(db);

  res.setHeader("Set-Cookie",
    `sid=${sid}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSAO_TTL_MS / 1000}${req.secure ? "; Secure" : ""}`);
  req.sid = sid;
  next();
}
app.use(sessao);
app.use(express.static(path.join(__dirname, "public")));

function contexto(req) {
  const db = lerDB();
  return { db, s: db.sessoes[req.sid] };
}

app.post("/api/reset", (req, res) => {
  const { db, s } = contexto(req);
  Object.assign(s, estadoInicial());
  salvarDB(db);
  res.json({ ok: true });
});

// ---------- produtos ----------
app.get("/api/produtos", (req, res) => {
  res.json(contexto(req).s.produtos);
});

app.post("/api/produtos", (req, res) => {
  const { nome, categoria, preco, estoque } = req.body;
  if (!nome || !nome.trim()) return res.status(400).json({ erro: "O campo 'nome' é obrigatório." });
  const { db, s } = contexto(req);
  const produto = {
    id: uid(), nome: nome.trim(), categoria: categoria || "",
    preco: Number(preco) || 0, estoque: Number.isFinite(Number(estoque)) ? Number(estoque) : 0
  };
  s.produtos.push(produto);
  salvarDB(db);
  res.status(201).json(produto);
});

app.put("/api/produtos/:id", (req, res) => {
  const { db, s } = contexto(req);
  const idx = s.produtos.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ erro: "Produto não encontrado." });
  s.produtos[idx] = { ...s.produtos[idx], ...req.body, id: req.params.id };
  salvarDB(db);
  res.json(s.produtos[idx]);
});

app.delete("/api/produtos/:id", (req, res) => {
  const { db, s } = contexto(req);
  s.produtos = s.produtos.filter(p => p.id !== req.params.id);
  salvarDB(db);
  res.status(204).end();
});

// ---------- clientes ----------
app.get("/api/clientes", (req, res) => {
  res.json(contexto(req).s.clientes);
});

app.post("/api/clientes", (req, res) => {
  const { nome, empresa, email, fone } = req.body;
  if (!nome || !nome.trim()) return res.status(400).json({ erro: "O campo 'nome' é obrigatório." });
  const { db, s } = contexto(req);
  const cliente = { id: uid(), nome: nome.trim(), empresa: empresa || "", email: email || "", fone: fone || "" };
  s.clientes.push(cliente);
  salvarDB(db);
  res.status(201).json(cliente);
});

app.put("/api/clientes/:id", (req, res) => {
  const { db, s } = contexto(req);
  const idx = s.clientes.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ erro: "Cliente não encontrado." });
  s.clientes[idx] = { ...s.clientes[idx], ...req.body, id: req.params.id };
  salvarDB(db);
  res.json(s.clientes[idx]);
});

app.delete("/api/clientes/:id", (req, res) => {
  const { db, s } = contexto(req);
  s.clientes = s.clientes.filter(c => c.id !== req.params.id);
  salvarDB(db);
  res.status(204).end();
});

// ---------- pedidos ----------
// GET /api/pedidos?status=&clienteId=&de=YYYY-MM-DD&ate=YYYY-MM-DD
app.get("/api/pedidos", (req, res) => {
  const { status, clienteId, de, ate } = req.query;
  let lista = contexto(req).s.pedidos;
  if (status) lista = lista.filter(p => p.status === status);
  if (clienteId) lista = lista.filter(p => p.clienteId === clienteId);
  if (de) lista = lista.filter(p => p.data >= de);
  if (ate) lista = lista.filter(p => p.data <= ate);
  res.json(lista.sort((a, b) => b.data.localeCompare(a.data)));
});

app.post("/api/pedidos", (req, res) => {
  const { clienteId, itens, data, status } = req.body;
  if (!Array.isArray(itens) || itens.length === 0) {
    return res.status(400).json({ erro: "O pedido precisa de ao menos um item." });
  }
  const { db, s } = contexto(req);

  // valida e congela nome/preço do produto no momento do pedido
  const itensValidados = [];
  for (const it of itens) {
    const produto = s.produtos.find(p => p.id === it.produtoId);
    if (!produto) return res.status(400).json({ erro: "Produto inválido em um dos itens." });
    const quantidade = Number(it.quantidade) || 0;
    if (quantidade <= 0) return res.status(400).json({ erro: "Quantidade inválida em um dos itens." });
    itensValidados.push({ produtoId: produto.id, nome: produto.nome, precoUnit: produto.preco, quantidade });
  }
  // baixa de estoque
  for (const it of itensValidados) {
    const p = s.produtos.find(x => x.id === it.produtoId);
    p.estoque = Math.max(0, (p.estoque || 0) - it.quantidade);
  }

  const pedido = {
    id: uid(),
    clienteId: clienteId || "",
    itens: itensValidados,
    data: data || new Date().toISOString().slice(0, 10),
    status: status || "Pendente"
  };
  s.pedidos.push(pedido);
  salvarDB(db);
  res.status(201).json(pedido);
});

app.put("/api/pedidos/:id", (req, res) => {
  // usado para trocar o status (Pendente / Faturado / Cancelado)
  const { db, s } = contexto(req);
  const idx = s.pedidos.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ erro: "Pedido não encontrado." });
  const antes = s.pedidos[idx];
  const depois = { ...antes, ...req.body, id: req.params.id, itens: antes.itens };

  // se cancelou um pedido que não estava cancelado, devolve o estoque
  if (depois.status === "Cancelado" && antes.status !== "Cancelado") {
    for (const it of antes.itens) {
      const p = s.produtos.find(x => x.id === it.produtoId);
      if (p) p.estoque = (p.estoque || 0) + it.quantidade;
    }
  }
  s.pedidos[idx] = depois;
  salvarDB(db);
  res.json(depois);
});

app.delete("/api/pedidos/:id", (req, res) => {
  const { db, s } = contexto(req);
  const pedido = s.pedidos.find(p => p.id === req.params.id);
  if (pedido && pedido.status !== "Cancelado") {
    for (const it of pedido.itens) {
      const p = s.produtos.find(x => x.id === it.produtoId);
      if (p) p.estoque = (p.estoque || 0) + it.quantidade;
    }
  }
  s.pedidos = s.pedidos.filter(p => p.id !== req.params.id);
  salvarDB(db);
  res.status(204).end();
});

// ---------- dashboard (dados já agregados para os gráficos) ----------
app.get("/api/dashboard", (req, res) => {
  const { s } = contexto(req);
  const total = it => it.itens.reduce((sum, x) => sum + x.precoUnit * x.quantidade, 0);

  const faturados = s.pedidos.filter(p => p.status === "Faturado");
  const faturamentoTotal = faturados.reduce((sum, p) => sum + total(p), 0);
  const ticketMedio = faturados.length ? faturamentoTotal / faturados.length : 0;

  // faturamento por mês (últimos 6 meses)
  const meses = [];
  const d = new Date();
  d.setDate(1);
  for (let i = 5; i >= 0; i--) {
    const dm = new Date(d.getFullYear(), d.getMonth() - i, 1);
    meses.push(dm.toISOString().slice(0, 7)); // YYYY-MM
  }
  const porMes = meses.map(m => ({
    mes: m,
    valor: faturados.filter(p => p.data.slice(0, 7) === m).reduce((sum, p) => sum + total(p), 0)
  }));

  // top produtos por quantidade vendida (todos os pedidos, exceto cancelados)
  const qtdPorProduto = {};
  for (const p of s.pedidos) {
    if (p.status === "Cancelado") continue;
    for (const it of p.itens) {
      qtdPorProduto[it.nome] = (qtdPorProduto[it.nome] || 0) + it.quantidade;
    }
  }
  const topProdutos = Object.entries(qtdPorProduto)
    .sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([nome, quantidade]) => ({ nome, quantidade }));

  res.json({
    totalProdutos: s.produtos.length,
    totalClientes: s.clientes.length,
    totalPedidos: s.pedidos.length,
    pedidosPendentes: s.pedidos.filter(p => p.status === "Pendente").length,
    faturamentoTotal,
    ticketMedio,
    porMes,
    topProdutos
  });
});

app.listen(PORT, () => console.log(`Painel comercial rodando em http://localhost:${PORT}`));
