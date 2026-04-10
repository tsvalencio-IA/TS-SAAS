// =====================================================================
// APP SUPER ADMIN - thIAguinho.Digital SaaS (VERSÃO CORRIGIDA)
// =====================================================================

window.app = window.app || {};

// 1. CONFIGURAÇÃO FIREBASE
app.firebaseConfig = {
    apiKey: "AIzaSyBqIuCsHHuy_f-mBWV4JBkbyOorXpqQvqg",
    authDomain: "hub-thiaguinho.firebaseapp.com",
    projectId: "hub-thiaguinho",
    storageBucket: "hub-thiaguinho.firebasestorage.app",
    messagingSenderId: "453508098543",
    appId: "1:453508098543:web:305f4d48edd9be40bd6e1a"
};

// Inicializa Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(app.firebaseConfig);
}
app.db = firebase.firestore();

// 2. INICIALIZAÇÃO
document.addEventListener('DOMContentLoaded', () => {
    console.log("Super Admin iniciado!");
    app.carregarDashboardStats();
    app.carregarListaClientes();
    app.carregarFinanceiroMaster();
    app.configurarListenersFormularios();
});

// 3. NAVEGAÇÃO ENTRE SEÇÕES
app.mostrarSecao = function(id) {
    console.log("Navegando para:", id);
    document.querySelectorAll('.secao').forEach(el => el.style.display = 'none');
    const secaoAlvo = document.getElementById('secao-' + id);
    if (secaoAlvo) secaoAlvo.style.display = 'block';
    
    document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
    event.target.closest('.nav-link')?.classList.add('active');
};

// 4. SAIR DO SISTEMA
app.sair = function() {
    sessionStorage.clear();
    window.location.href = 'index.html';
};

// 5. DASHBOARD
app.carregarDashboardStats = function() {
    app.db.collection('oficinas').onSnapshot(snap => {
        let ativos = 0, suspensos = 0;
        snap.forEach(doc => {
            const data = doc.data();
            if (data.status === 'Liberado' || data.status === 'ativo' || data.status === 'Ativo') {
                ativos++;
            } else {
                suspensos++;
            }
        });
        
        const elAtivos = document.getElementById('lblAtivos');
        const elSuspensos = document.getElementById('lblSuspensos');
        const elTotal = document.getElementById('lblTotalAmbientes');
        
        if (elAtivos) elAtivos.innerText = ativos;
        if (elSuspensos) elSuspensos.innerText = suspensos;
        if (elTotal) elTotal.innerText = snap.size;
        
        app.atualizarSelectOnboarding(snap);
    });
};

// 6. ATUALIZAR SELECT
app.atualizarSelectOnboarding = function(snap) {
    const sel = document.getElementById('selectEmpresaOnboarding');
    if (!sel) return;
    
    sel.innerHTML = '<option value="">Escolha a Empresa...</option>';
    snap.forEach(doc => {
        const nome = doc.data().nome || 'Sem nome';
        sel.innerHTML += `<option value="${doc.id}">${nome}</option>`;
    });
};

// 7. LISTAR CLIENTES - VERSÃO CORRIGIDA COM ESTILO
app.carregarListaClientes = function() {
    console.log("Carregando lista de clientes...");
    app.db.collection('oficinas').onSnapshot(snap => {
        const tbody = document.getElementById('tabelaClientesCorpo');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        
        if (snap.empty) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted p-4">Nenhum cliente cadastrado.</td></tr>';
            return;
        }
        
        snap.forEach(doc => {
            const d = doc.data();
            const statusClass = (d.status === 'Liberado' || d.status === 'ativo' || d.status === 'Ativo') ? 'bg-success' : 'bg-danger';
            const statusText = d.status || 'Liberado';
            
            const row = `
                <tr class="table-row-hover">
                    <td class="text-muted small font-monospace">${doc.id.substr(0,8)}...</td>
                    <td class="fw-bold">${d.nome || 'Sem nome'}</td>
                    <td><span class="badge bg-info text-dark">${d.nicho || 'N/A'}</span></td>
                    <td>${d.usuarioAdmin || '-'}</td>
                    <td><span class="badge ${statusClass}">${statusText}</span></td>
                    <td>
                        <button class="btn btn-sm btn-outline-info me-1" onclick="app.editarCliente('${doc.id}')" title="Editar">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger" onclick="app.excluirCliente('${doc.id}', '${d.nome}')" title="Excluir">
                            <i class="bi bi-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
            tbody.innerHTML += row;
        });
    });
};

// 8. EDITAR CLIENTE
app.editarCliente = async function(id) {
    try {
        const doc = await app.db.collection('oficinas').doc(id).get();
        if (!doc.exists) {
            alert('Cliente não encontrado!');
            return;
        }
        
        const data = doc.data();
        
        // Preenche o formulário de criação com os dados
        document.getElementById('nomeEmpresa').value = data.nome || '';
        document.getElementById('whatsappFaturamento').value = data.whatsapp || '';
        document.getElementById('nichoOperacional').value = data.nicho || '';
        document.getElementById('usuarioAdmin').value = data.usuarioAdmin || '';
        document.getElementById('senhaAdmin').value = data.senhaAdmin || '';
        document.getElementById('statusSistema').value = data.status || 'Liberado';
        document.getElementById('geminiKey').value = data.configuracoes?.geminiKey || '';
        document.getElementById('cloudinaryName').value = data.configuracoes?.cloudinaryName || '';
        document.getElementById('cloudinaryPreset').value = data.configuracoes?.cloudinaryPreset || '';
        
        // Módulos
        if (data.modulos) {
            document.getElementById('moduloFinanceiro').checked = data.modulos.financeiro || false;
            document.getElementById('moduloCRM').checked = data.modulos.crm || false;
            document.getElementById('moduloEstoqueVendas').checked = data.modulos.estoqueVendas || false;
            document.getElementById('moduloEstoqueInterno').checked = data.modulos.estoqueInterno || false;
            document.getElementById('moduloKanban').checked = data.modulos.kanban || false;
            document.getElementById('moduloPDF').checked = data.modulos.pdf || false;
            document.getElementById('moduloChat').checked = data.modulos.chat || false;
            document.getElementById('moduloIA').checked = data.modulos.ia || false;
        }
        
        // Armazena o ID para edição
        sessionStorage.setItem('editandoClienteId', id);
        
        // Vai para tela de criação
        app.mostrarSecao('criar');
        
        // Muda o texto do botão
        const btn = document.getElementById('btnImplantar');
        btn.innerText = 'SALVAR ALTERAÇÕES';
        
        alert('Dados carregados para edição. Altere o necessário e salve.');
        
    } catch (error) {
        console.error("Erro ao carregar cliente:", error);
        alert('Erro: ' + error.message);
    }
};

// 9. EXCLUIR CLIENTE
app.excluirCliente = async function(id, nome) {
    if (!confirm(`⚠️ ATENÇÃO!\n\nVocê está prestes a EXCLUIR permanentemente:\n\n"${nome}"\n\nIsso apagará TODOS os dados da empresa incluindo:\n- Clientes\n- Ordens de Serviço\n- Financeiro\n- Estoque\n\nTem certeza?`)) {
        return;
    }
    
    const confirmacao = prompt('Digite "EXCLUIR" para confirmar:');
    if (confirmacao !== 'EXCLUIR') {
        alert('Exclusão cancelada.');
        return;
    }
    
    try {
        await app.db.collection('oficinas').doc(id).delete();
        alert('Cliente excluído com sucesso!');
    } catch (error) {
        console.error("Erro ao excluir:", error);
        alert('Erro ao excluir: ' + error.message);
    }
};

// 10. FINANCEIRO MASTER
app.carregarFinanceiroMaster = function() {
    app.db.collection('financeiro_master')
        .orderBy('data', 'desc')
        .onSnapshot(snap => {
            const tbody = document.getElementById('tabelaFinanceiroMasterCorpo');
            const lblRec = document.getElementById('lblReceitas');
            const lblDesp = document.getElementById('lblDespesas');
            const lblLucro = document.getElementById('lblLucro');
            
            if (!tbody) return;
            
            tbody.innerHTML = '';
            let totalRec = 0, totalDesp = 0;
            
            if (snap.empty) {
                tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted p-4">Sem lançamentos.</td></tr>';
            } else {
                snap.forEach(doc => {
                    const d = doc.data();
                    if (d.tipo === 'ENTRADA') totalRec += (d.valor || 0);
                    if (d.tipo === 'SAIDA') totalDesp += (d.valor || 0);
                    
                    const cor = d.tipo === 'ENTRADA' ? 'text-success' : 'text-danger';
                    const row = `
                        <tr>
                            <td>${d.data || '-'}</td>
                            <td><span class="badge ${d.tipo === 'ENTRADA' ? 'bg-success' : 'bg-danger'}">${d.tipo}</span></td>
                            <td>${d.desc || '-'}</td>
                            <td>${d.metodo || '-'}</td>
                            <td class="fw-bold ${cor}">R$ ${(d.valor || 0).toFixed(2)}</td>
                            <td>
                                <button class="btn btn-sm btn-danger" onclick="app.deletarLancamento('${doc.id}')">
                                    <i class="bi bi-trash"></i>
                                </button>
                            </td>
                        </tr>
                    `;
                    tbody.innerHTML += row;
                });
            }
            
            if (lblRec) lblRec.innerText = 'R$ ' + totalRec.toFixed(2).replace('.', ',');
            if (lblDesp) lblDesp.innerText = 'R$ ' + totalDesp.toFixed(2).replace('.', ',');
            if (lblLucro) lblLucro.innerText = 'R$ ' + (totalRec - totalDesp).toFixed(2).replace('.', ',');
        });
};

app.deletarLancamento = async function(id) {
    if (confirm('Excluir este lançamento?')) {
        try {
            await app.db.collection('financeiro_master').doc(id).delete();
        } catch (error) {
            alert('Erro: ' + error.message);
        }
    }
};

// 11. CONFIGURAR LISTENERS
app.configurarListenersFormularios = function() {
    const btnImplantar = document.getElementById('btnImplantar');
    if (btnImplantar) {
        btnImplantar.addEventListener('click', app.implantarSistema);
    }
    
    const btnLancarMaster = document.getElementById('btnLancarMaster');
    if (btnLancarMaster) {
        btnLancarMaster.addEventListener('click', app.lancarFinanceiroMaster);
    }
    
    const btnInjetar = document.getElementById('btnInjetarDados');
    if (btnInjetar) {
        btnInjetar.addEventListener('click', app.injetarDadosOnboarding);
    }
};

// 12. IMPLANTAR/EDITAR SISTEMA
app.implantarSistema = async function() {
    const editandoId = sessionStorage.getItem('editandoClienteId');
    
    const nomeEmpresa = document.getElementById('nomeEmpresa')?.value || '';
    const whatsapp = document.getElementById('whatsappFaturamento')?.value || '';
    const nicho = document.getElementById('nichoOperacional')?.value || '';
    const usuario = document.getElementById('usuarioAdmin')?.value || '';
    const senha = document.getElementById('senhaAdmin')?.value || '';
    const status = document.getElementById('statusSistema')?.value || 'Liberado';
    
    if (!nomeEmpresa || !usuario || !senha) {
        alert('Preencha: Nome, Usuário Admin e Senha!');
        return;
    }
    
    const btn = document.getElementById('btnImplantar');
    btn.disabled = true;
    btn.innerText = 'Processando...';
    
    try {
        const modulos = {
            financeiro: document.getElementById('moduloFinanceiro')?.checked || false,
            crm: document.getElementById('moduloCRM')?.checked || false,
            estoqueVendas: document.getElementById('moduloEstoqueVendas')?.checked || false,
            estoqueInterno: document.getElementById('moduloEstoqueInterno')?.checked || false,
            kanban: document.getElementById('moduloKanban')?.checked || false,
            pdf: document.getElementById('moduloPDF')?.checked || false,
            chat: document.getElementById('moduloChat')?.checked || false,
            ia: document.getElementById('moduloIA')?.checked || false
        };
        
        const config = {
            geminiKey: document.getElementById('geminiKey')?.value || null,
            cloudinaryName: document.getElementById('cloudinaryName')?.value || 'dmuvm1o6m',
            cloudinaryPreset: document.getElementById('cloudinaryPreset')?.value || 'evolution'
        };
        
        const dados = {
            nome: nomeEmpresa,
            nicho: nicho,
            whatsapp: whatsapp,
            status: status,
            usuarioAdmin: usuario,
            senhaAdmin: senha,
            modulos: modulos,
            configuracoes: config,
            dataAtualizacao: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        if (editandoId) {
            // Edição
            await app.db.collection('oficinas').doc(editandoId).update(dados);
            alert('✅ Cliente atualizado com sucesso!');
            sessionStorage.removeItem('editandoClienteId');
            btn.innerText = 'IMPLANTAR SISTEMA NA NUVEM';
        } else {
            // Criação
            dados.dataCriacao = firebase.firestore.FieldValue.serverTimestamp();
            dados.ultimoAcesso = null;
            
            await app.db.collection('oficinas').add(dados);
            alert('✅ SUCESSO!\n\nCliente criado!\n\nLogin: ' + usuario);
        }
        
        // Limpa formulário
        document.getElementById('nomeEmpresa').value = '';
        document.getElementById('whatsappFaturamento').value = '';
        document.getElementById('usuarioAdmin').value = '';
        document.getElementById('senhaAdmin').value = '';
        
        app.mostrarSecao('dashboard');
        
    } catch (error) {
        console.error("Erro:", error);
        alert('Erro: ' + error.message);
    } finally {
        const btn = document.getElementById('btnImplantar');
        btn.disabled = false;
        if (!sessionStorage.getItem('editandoClienteId')) {
            btn.innerText = 'IMPLANTAR SISTEMA NA NUVEM';
        }
    }
};

// 13. LANÇAR FINANCEIRO
app.lancarFinanceiroMaster = async function() {
    const tipo = document.getElementById('tipoFinanceiroMaster')?.value || 'ENTRADA';
    const desc = document.getElementById('descFinanceiroMaster')?.value || '';
    const valor = parseFloat(document.getElementById('valorFinanceiroMaster')?.value || 0);
    const metodo = document.getElementById('metodoFinanceiroMaster')?.value || 'Pix / Transferência';
    const data = document.getElementById('dataFinanceiroMaster')?.value || new Date().toISOString().split('T')[0];
    
    if (!desc || valor <= 0) {
        alert('Preencha descrição e valor!');
        return;
    }
    
    try {
        await app.db.collection('financeiro_master').add({
            tipo: tipo,
            desc: desc,
            valor: valor,
            metodo: metodo,
            data: data,
            dataRegistro: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        alert('Lançamento registrado!');
        
        const modal = bootstrap.Modal.getInstance(document.getElementById('modalFinanceiroMaster'));
        if (modal) modal.hide();
        
        document.getElementById('descFinanceiroMaster').value = '';
        document.getElementById('valorFinanceiroMaster').value = '';
        
    } catch (error) {
        alert('Erro: ' + error.message);
    }
};

// 14. INJETAR DADOS
app.injetarDadosOnboarding = async function() {
    const tenantSelect = document.getElementById('selectEmpresaOnboarding');
    const moduloDestino = document.getElementById('selectModuloDestino')?.value || 'crm';
    const jsonStr = document.getElementById('jsonInput')?.value || '';
    
    if (!tenantSelect || tenantSelect.value === "") {
        alert('Selecione uma empresa!');
        return;
    }
    
    if (!jsonStr) {
        alert('Cole o JSON!');
        return;
    }
    
    if (!confirm('Isso vai escrever no banco do cliente. Continuar?')) return;
    
    const btn = document.getElementById('btnInjetarDados');
    btn.disabled = true;
    btn.innerText = 'Injetando...';
    
    try {
        const dados = JSON.parse(jsonStr);
        const tenantId = tenantSelect.value;
        
        let collectionName = "";
        if (moduloDestino === "crm") collectionName = "clientes_base";
        else if (moduloDestino === "estoque") collectionName = "estoque";
        else if (moduloDestino === "historico") collectionName = "ordens_servico";
        else throw new Error("Módulo desconhecido");
        
        const batch = app.db.batch();
        let count = 0;
        
        if (Array.isArray(dados)) {
            dados.forEach(item => {
                const docRef = app.db.collection(collectionName).doc();
                item.tenantId = tenantId;
                batch.set(docRef, item);
                count++;
            });
        } else {
            const docRef = app.db.collection(collectionName).doc();
            dados.tenantId = tenantId;
            batch.set(docRef, dados);
            count = 1;
        }
        
        await batch.commit();
        alert(`✅ Injeção concluída!\n${count} itens enviados.`);
        document.getElementById('jsonInput').value = '';
        
    } catch (e) {
        alert('Erro no JSON: ' + e.message);
    } finally {
        const btn = document.getElementById('btnInjetarDados');
        btn.disabled = false;
        btn.innerText = 'INJETAR DADOS NA NUVEM';
    }
};

// 15. ABRIR MODAL FINANCEIRO
app.abrirModalFinanceiro = function(tipo) {
    const modalEl = document.getElementById('modalFinanceiroMaster');
    if (!modalEl) return;
    
    const tipoField = document.getElementById('tipoFinanceiroMaster');
    if (tipoField) tipoField.value = tipo;
    
    const titulo = document.getElementById('modalFinanceiroTitulo');
    if (titulo) titulo.innerText = tipo === 'ENTRADA' ? 'Lançar Recebimento' : 'Lançar Pagamento';
    
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
};

console.log("app_superadmin.js carregado!");
