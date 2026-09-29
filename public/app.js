let salesChart;


// =================================
// FUNÇÃO PRINCIPAL DA API
// =================================

async function api(url, options = {}) {

    const response = await fetch(url, {

        headers: {
            "Content-Type": "application/json"
        },

        ...options

    });


    const data = await response.json();


    if (!response.ok) {

        throw new Error(
            data.erro || "Erro na API."
        );

    }


    return data;

}



// =================================
// FORMATAÇÃO DE DINHEIRO
// =================================

function dinheiro(valor) {

    return Number(valor).toLocaleString(
        "pt-BR",
        {
            style: "currency",
            currency: "BRL"
        }
    );

}



// =================================
// NAVEGAÇÃO
// =================================

document
    .querySelectorAll(".menu-item")
    .forEach(button => {

        button.addEventListener(
            "click",
            () => {

                document
                    .querySelectorAll(".menu-item")
                    .forEach(item => {

                        item.classList.remove(
                            "active"
                        );

                    });


                document
                    .querySelectorAll(".page")
                    .forEach(page => {

                        page.classList.remove(
                            "active"
                        );

                    });


                button.classList.add(
                    "active"
                );


                const page =
                    button.dataset.page;


                document
                    .getElementById(page)
                    .classList.add("active");


                const titles = {

                    dashboard: "Dashboard",

                    produtos: "Produtos",

                    clientes: "Clientes",

                    pedidos: "Pedidos"

                };


                document
                    .getElementById(
                        "page-title"
                    )
                    .textContent =
                    titles[page];


                if (page === "dashboard") {

                    carregarDashboard();

                }


                if (page === "produtos") {

                    carregarProdutos();

                }


                if (page === "clientes") {

                    carregarClientes();

                }


                if (page === "pedidos") {

                    carregarPedidos();

                }

            }

        );

    });



// =================================
// DASHBOARD
// =================================

async function carregarDashboard() {

    try {

        const dados =
            await api(
                "/api/dashboard"
            );


        document
            .getElementById(
                "faturamento"
            )
            .textContent =
            dinheiro(
                dados.faturamento
            );


        document
            .getElementById(
                "total-pedidos"
            )
            .textContent =
            dados.pedidos;


        document
            .getElementById(
                "total-clientes"
            )
            .textContent =
            dados.clientes;


        document
            .getElementById(
                "total-produtos"
            )
            .textContent =
            dados.produtos;


        carregarGrafico();

        carregarStatus();

    }

    catch (error) {

        console.error(error);

    }

}



// =================================
// GRÁFICO
// =================================

async function carregarGrafico() {

    const dados =
        await api(
            "/api/relatorios/faturamento"
        );


    const labels =
        dados.map(item => item.mes);


    const valores =
        dados.map(
            item => item.faturamento
        );


    const canvas =
        document.getElementById(
            "salesChart"
        );


    if (salesChart) {

        salesChart.destroy();

    }


    salesChart =
        new Chart(
            canvas,
            {

                type: "line",

                data: {

                    labels,

                    datasets: [

                        {

                            label:
                                "Faturamento",

                            data:
                                valores,

                            borderWidth: 3,

                            tension: .3,

                            fill: true

                        }

                    ]

                },

                options: {

                    responsive: true,

                    maintainAspectRatio: false,

                    plugins: {

                        legend: {

                            display: false

                        },

                        tooltip: {

                            callbacks: {

                                label:
                                    context =>
                                        dinheiro(
                                            context.raw
                                        )

                            }

                        }

                    }

                }

            }

        );

}



// =================================
// STATUS DOS PEDIDOS
// =================================

async function carregarStatus() {

    const pedidos =
        await api(
            "/api/pedidos"
        );


    const contagem = {};


    pedidos.forEach(
        pedido => {

            if (!contagem[pedido.status]) {

                contagem[pedido.status] = 0;

            }

            contagem[pedido.status]++;

        }
    );


    const container =
        document.getElementById(
            "status-list"
        );


    container.innerHTML = "";


    Object.entries(contagem)
        .forEach(
            ([status, quantidade]) => {

                container.innerHTML += `

                    <div class="status-item">

                        <span>
                            ${status}
                        </span>

                        <strong>
                            ${quantidade}
                        </strong>

                    </div>

                `;

            }
        );

}



// =================================
// PRODUTOS
// =================================

async function carregarProdutos() {

    const busca =
        document
            .getElementById(
                "busca-produto"
            )
            .value;


    const produtos =
        await api(
            `/api/produtos?busca=${encodeURIComponent(busca)}`
        );


    const tabela =
        document.getElementById(
            "produtos-table"
        );


    tabela.innerHTML = "";


    produtos.forEach(
        produto => {

            tabela.innerHTML += `

                <tr>

                    <td>
                        <strong>
                            ${produto.nome}
                        </strong>
                    </td>

                    <td>
                        ${produto.categoria}
                    </td>

                    <td>
                        ${dinheiro(produto.preco)}
                    </td>

                    <td>
                        ${produto.estoque}
                    </td>

                    <td>

                        <button
                            onclick="
                                excluirProduto(
                                    ${produto.id}
                                )
                            "
                        >
                            Excluir
                        </button>

                    </td>

                </tr>

            `;

        }
    );

}



// =================================
// EXCLUIR PRODUTO
// =================================

async function excluirProduto(id) {

    const confirmar =
        confirm(
            "Deseja realmente excluir este produto?"
        );


    if (!confirmar) {

        return;

    }


    try {

        await api(
            `/api/produtos/${id}`,
            {
                method: "DELETE"
            }
        );


        carregarProdutos();

        carregarDashboard();

    }

    catch (error) {

        alert(
            error.message
        );

    }

}



// =================================
// MODAL PRODUTO
// =================================

function abrirProduto() {

    document
        .getElementById(
            "modal-content"
        )
        .innerHTML = `

            <h2>
                Novo produto
            </h2>


            <form
                class="form"
                onsubmit="
                    salvarProduto(event)
                "
            >

                <input
                    name="nome"
                    placeholder="Nome do produto"
                    required
                >


                <input
                    name="categoria"
                    placeholder="Categoria"
                >


                <input
                    name="preco"
                    type="number"
                    step="0.01"
                    placeholder="Preço"
                    required
                >


                <input
                    name="estoque"
                    type="number"
                    placeholder="Estoque"
                    required
                >


                <button
                    type="submit"
                >
                    Cadastrar produto
                </button>

            </form>

        `;


    document
        .getElementById(
            "modal"
        )
        .classList.remove(
            "hidden"
        );

}



// =================================
// SALVAR PRODUTO
// =================================

async function salvarProduto(event) {

    event.preventDefault();


    const form =
        new FormData(
            event.target
        );


    try {

        await api(
            "/api/produtos",
            {

                method: "POST",

                body: JSON.stringify({

                    nome:
                        form.get("nome"),

                    categoria:
                        form.get(
                            "categoria"
                        ),

                    preco:
                        form.get("preco"),

                    estoque:
                        form.get("estoque")

                })

            }
        );


        fecharModal();

        carregarProdutos();

        carregarDashboard();

    }

    catch (error) {

        alert(
            error.message
        );

    }

}



// =================================
// CLIENTES
// =================================

async function carregarClientes() {

    const busca =
        document
            .getElementById(
                "busca-cliente"
            )
            .value;


    const clientes =
        await api(
            `/api/clientes?busca=${encodeURIComponent(busca)}`
        );


    const tabela =
        document.getElementById(
            "clientes-table"
        );


    tabela.innerHTML = "";


    clientes.forEach(
        cliente => {

            tabela.innerHTML += `

                <tr>

                    <td>
                        <strong>
                            ${cliente.nome}
                        </strong>
                    </td>

                    <td>
                        ${cliente.email}
                    </td>

                    <td>
                        ${cliente.telefone || "-"}
                    </td>

                </tr>

            `;

        }
    );

}



// =================================
// NOVO CLIENTE
// =================================

function abrirCliente() {

    document
        .getElementById(
            "modal-content"
        )
        .innerHTML = `

            <h2>
                Novo cliente
            </h2>


            <form
                class="form"
                onsubmit="
                    salvarCliente(event)
                "
            >

                <input
                    name="nome"
                    placeholder="Nome completo"
                    required
                >


                <input
                    name="email"
                    type="email"
                    placeholder="Email"
                    required
                >


                <input
                    name="telefone"
                    placeholder="Telefone"
                >


                <button
                    type="submit"
                >
                    Cadastrar cliente
                </button>

            </form>

        `;


    document
        .getElementById(
            "modal"
        )
        .classList.remove(
            "hidden"
        );

}



// =================================
// SALVAR CLIENTE
// =================================

async function salvarCliente(event) {

    event.preventDefault();


    const form =
        new FormData(
            event.target
        );


    try {

        await api(
            "/api/clientes",
            {

                method: "POST",

                body: JSON.stringify({

                    nome:
                        form.get("nome"),

                    email:
                        form.get("email"),

                    telefone:
                        form.get(
                            "telefone"
                        )

                })

            }
        );


        fecharModal();

        carregarClientes();

        carregarDashboard();

    }

    catch (error) {

        alert(
            error.message
        );

    }

}



// =================================
// PEDIDOS
// =================================

async function carregarPedidos() {

    const busca =
        document
            .getElementById(
                "busca-pedido"
            )
            .value;


    const status =
        document
            .getElementById(
                "filtro-status"
            )
            .value;


    const pedidos =
        await api(

            `/api/pedidos?busca=${encodeURIComponent(busca)}&status=${encodeURIComponent(status)}`

        );


    const tabela =
        document.getElementById(
            "pedidos-table"
        );


    tabela.innerHTML = "";


    pedidos.forEach(
        pedido => {

            tabela.innerHTML += `

                <tr>

                    <td>
                        #${pedido.id}
                    </td>

                    <td>
                        ${pedido.cliente}
                    </td>

                    <td>
                        ${formatarData(
                            pedido.data
                        )}
                    </td>

                    <td>
                        ${dinheiro(
                            pedido.total
                        )}
                    </td>

                    <td>

                        <span class="badge">

                            ${pedido.status}

                        </span>

                    </td>

                </tr>

            `;

        }
    );

}



// =================================
// DATA
// =================================

function formatarData(data) {

    return new Date(
        data + "T00:00:00"
    ).toLocaleDateString(
        "pt-BR"
    );

}



// =================================
// MODAL
// =================================

function fecharModal() {

    document
        .getElementById(
            "modal"
        )
        .classList.add(
            "hidden"
        );

}



// =================================
// INICIALIZAÇÃO
// =================================

carregarDashboard();
