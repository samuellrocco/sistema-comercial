const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3000;

const DB_PATH = path.join(__dirname, "db.json");

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));


// ==============================
// FUNÇÕES DO BANCO
// ==============================

function lerBanco() {
    const dados = fs.readFileSync(DB_PATH, "utf8");
    return JSON.parse(dados);
}

function salvarBanco(dados) {
    fs.writeFileSync(
        DB_PATH,
        JSON.stringify(dados, null, 2)
    );
}


// ==============================
// DASHBOARD
// ==============================

app.get("/api/dashboard", (req, res) => {

    const db = lerBanco();

    const pedidosValidos = db.pedidos.filter(
        pedido => pedido.status !== "Cancelado"
    );

    const faturamento = pedidosValidos.reduce(
        (total, pedido) => total + pedido.total,
        0
    );

    res.json({
        faturamento,
        pedidos: db.pedidos.length,
        clientes: db.clientes.length,
        produtos: db.produtos.length
    });
});


// ==============================
// PRODUTOS
// ==============================

// Listar produtos
app.get("/api/produtos", (req, res) => {

    const db = lerBanco();

    const busca = (req.query.busca || "").toLowerCase();

    let produtos = db.produtos;

    if (busca) {

        produtos = produtos.filter(produto =>
            produto.nome.toLowerCase().includes(busca) ||
            produto.categoria.toLowerCase().includes(busca)
        );

    }

    res.json(produtos);
});


// Criar produto
app.post("/api/produtos", (req, res) => {

    const db = lerBanco();

    const {
        nome,
        categoria,
        preco,
        estoque
    } = req.body;

    if (!nome || preco === undefined || estoque === undefined) {

        return res.status(400).json({
            erro: "Nome, preço e estoque são obrigatórios."
        });

    }

    const novoProduto = {

        id: Date.now(),

        nome,

        categoria: categoria || "Geral",

        preco: Number(preco),

        estoque: Number(estoque)

    };

    db.produtos.push(novoProduto);

    salvarBanco(db);

    res.status(201).json(novoProduto);
});


// Atualizar produto
app.put("/api/produtos/:id", (req, res) => {

    const db = lerBanco();

    const id = Number(req.params.id);

    const produto = db.produtos.find(
        produto => produto.id === id
    );

    if (!produto) {

        return res.status(404).json({
            erro: "Produto não encontrado."
        });

    }

    produto.nome = req.body.nome;
    produto.categoria = req.body.categoria;
    produto.preco = Number(req.body.preco);
    produto.estoque = Number(req.body.estoque);

    salvarBanco(db);

    res.json(produto);
});


// Excluir produto
app.delete("/api/produtos/:id", (req, res) => {

    const db = lerBanco();

    const id = Number(req.params.id);

    const tamanhoAntes = db.produtos.length;

    db.produtos = db.produtos.filter(
        produto => produto.id !== id
    );

    if (db.produtos.length === tamanhoAntes) {

        return res.status(404).json({
            erro: "Produto não encontrado."
        });

    }

    salvarBanco(db);

    res.json({
        mensagem: "Produto excluído com sucesso."
    });
});


// ==============================
// CLIENTES
// ==============================

// Listar clientes
app.get("/api/clientes", (req, res) => {

    const db = lerBanco();

    const busca = (req.query.busca || "").toLowerCase();

    let clientes = db.clientes;

    if (busca) {

        clientes = clientes.filter(cliente =>

            cliente.nome.toLowerCase().includes(busca) ||

            cliente.email.toLowerCase().includes(busca)

        );

    }

    res.json(clientes);
});


// Criar cliente
app.post("/api/clientes", (req, res) => {

    const db = lerBanco();

    const {
        nome,
        email,
        telefone
    } = req.body;

    if (!nome || !email) {

        return res.status(400).json({
            erro: "Nome e email são obrigatórios."
        });

    }

    const novoCliente = {

        id: Date.now(),

        nome,

        email,

        telefone: telefone || ""

    };

    db.clientes.push(novoCliente);

    salvarBanco(db);

    res.status(201).json(novoCliente);
});


// ==============================
// PEDIDOS
// ==============================

// Listar pedidos
app.get("/api/pedidos", (req, res) => {

    const db = lerBanco();

    const busca = (req.query.busca || "").toLowerCase();

    const status = req.query.status || "";

    let pedidos = db.pedidos;

    if (busca) {

        pedidos = pedidos.filter(pedido => {

            const cliente = db.clientes.find(
                cliente => cliente.id === pedido.clienteId
            );

            return cliente &&
                cliente.nome.toLowerCase().includes(busca);

        });

    }

    if (status) {

        pedidos = pedidos.filter(
            pedido => pedido.status === status
        );

    }

    const resultado = pedidos.map(pedido => {

        const cliente = db.clientes.find(
            cliente => cliente.id === pedido.clienteId
        );

        return {

            ...pedido,

            cliente: cliente
                ? cliente.nome
                : "Cliente desconhecido"

        };

    });

    res.json(resultado);
});


// ==============================
// RELATÓRIO
// ==============================

app.get("/api/relatorios/faturamento", (req, res) => {

    const db = lerBanco();

    const meses = {};

    db.pedidos
        .filter(pedido => pedido.status !== "Cancelado")
        .forEach(pedido => {

            const mes = pedido.data.substring(0, 7);

            if (!meses[mes]) {
                meses[mes] = 0;
            }

            meses[mes] += pedido.total;

        });

    const resultado = Object.keys(meses).map(mes => ({

        mes,

        faturamento: meses[mes]

    }));

    res.json(resultado);
});


// ==============================
// STATUS DA API
// ==============================

app.get("/api/status", (req, res) => {

    res.json({
        online: true,
        mensagem: "API funcionando corretamente."
    });

});


// ==============================
// SERVIDOR
// ==============================

app.listen(PORT, () => {

    console.log("");
    console.log("================================");
    console.log("   PAINEL DE VENDAS");
    console.log("================================");
    console.log("");
    console.log(`Servidor: http://localhost:${PORT}`);
    console.log("");
});