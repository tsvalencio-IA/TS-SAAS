// =====================================================================
// APP SUPER ADMIN - thIAguinho.Digital SaaS
// Versão completa e corrigida
// =====================================================================

window.app = window.app || {};

// Configuração Firebase
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

// =====================================================================
// INICIALIZAÇÃO
// =====================================================================
document.addEventListener('DOMContentLoaded', () => {
    console.log("✅ Super Admin carregado!");
    
    const role = sessionStorage.getItem('t_role');
    if (role !== 'superadmin') {
        console.warn("⚠️ Usuário não é superadmin");
    }
    
    app.carregarDashboardStats();
    app.carregarListaClientes();
    app.carregarFinanceiroMaster();
    app.configurarListeners();
});

// =====================================================================
// NAVEGAÇÃO
// =====================================================================
app.mostrarSecao = function(id) {
    console.log("🔄 Navegando para:", id);
    
    document.querySelectorAll('.secao').forEach(el => {
        if (el) el.style.display = 'none';
    });
        const alvo = document.getElementById('secao-' + id);
    if (alvo) alvo.style.display = 'block';
    
    document.querySelectorAll('.nav-link').forEach(el => {
        el.classList.remove('active');
    });
    if (event && event.target) {
        const link = event.target.closest('.nav-link');
        if (link) link.classList.add('active');
    }
};

app.sair = function() {
    sessionStorage.clear();
    window.location.href = 'index.html';
};

// =====================================================================
// DASHBOARD
// =====================================================================
app.carregarDashboardStats = function() {
    console.log("📊 Carregando stats...");
    
    app.db.collection('oficinas').onSnapshot(snap => {
        let ativos = 0, suspensos = 0;
        
        snap.forEach(doc => {
            const d = doc.data();
            const status = (d.status || '').toLowerCase();
            if (status === 'liberado' || status === 'ativo') {
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
        
        console.log(`📈 Stats: ${ativos} ativos, ${suspensos} suspensos, ${snap.size} total`);
        
        app.atualizarSelectOnboarding(snap);
    }, error => {
        console.error("❌ Erro ao carregar stats:", error);
    });};

app.atualizarSelectOnboarding = function(snap) {
    const sel = document.getElementById('selectEmpresaOnboarding');
    if (!sel) return;
    
    sel.innerHTML = '<option value="">Escolha a Empresa...</option>';
    
    snap.forEach(doc => {
        const nome = doc.data().nome || 'Sem nome';
        sel.innerHTML += `<option value="${doc.id}">${nome}</option>`;
    });
    
    console.log(`🔄 Select atualizado com ${snap.size} empresas`);
};

// =====================================================================
// LISTA DE CLIENTES
// =====================================================================
app.carregarListaClientes = function() {
    console.log("👥 Carregando lista de clientes...");
    
    const tbody = document.getElementById('tabelaClientesCorpo');
    if (!tbody) {
        console.error("❌ Elemento tabelaClientesCorpo não encontrado!");
        return;
    }
    
    app.db.collection('oficinas').onSnapshot(snap => {
        tbody.innerHTML = '';
        
        if (snap.empty) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted p-4">Nenhum cliente cadastrado.</td></tr>';
            console.log("ℹ️ Nenhum cliente encontrado");
            return;
        }
        
        console.log(`✅ ${snap.size} clientes encontrados`);
        
        snap.forEach(doc => {
            const d = doc.data();
            const status = (d.status || 'Liberado').toLowerCase();
            const statusClass = (status === 'liberado' || status === 'ativo') ? 'bg-success' : 'bg-danger';
            const statusText = d.status || 'Liberado';
            
            const row = `
                <tr>
                    <td class="text-muted small font-monospace">${doc.id.substring(0, 8)}...</td>
                    <td class="fw-bold">${d.nome || 'Sem nome'}</td>
                    <td><span class="badge bg-info text-dark">${d.nicho || 'N/A'}</span></td>                    <td>${d.usuarioAdmin || '-'}</td>
                    <td><span class="badge ${statusClass}">${statusText}</span></td>
                    <td>
                        <button class="btn btn-sm btn-outline-info me-1" onclick="app.editarCliente('${doc.id}')" title="Editar">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger" onclick="app.excluirCliente('${doc.id}', '${(d.nome||'').replace(/'/g, "\\'") }')" title="Excluir">
                            <i class="bi bi-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
            tbody.innerHTML += row;
        });
    }, error => {
        console.error("❌ Erro ao carregar clientes:", error);
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger p-4">Erro: ${error.message}</td></tr>`;
    });
};

// =====================================================================
// EDITAR CLIENTE
// =====================================================================
app.editarCliente = async function(id) {
    console.log("✏️ Editando cliente:", id);
    
    try {
        const doc = await app.db.collection('oficinas').doc(id).get();
        
        if (!doc.exists) {
            alert('Cliente não encontrado!');
            return;
        }
        
        const d = doc.data();
        
        document.getElementById('nomeEmpresa').value = d.nome || '';
        document.getElementById('whatsappFaturamento').value = d.whatsapp || '';
        document.getElementById('nichoOperacional').value = d.nicho || '';
        document.getElementById('usuarioAdmin').value = d.usuarioAdmin || '';
        document.getElementById('senhaAdmin').value = d.senhaAdmin || '';
        document.getElementById('statusSistema').value = d.status || 'Liberado';
        document.getElementById('geminiKey').value = d.configuracoes?.geminiKey || '';
        document.getElementById('cloudinaryName').value = d.configuracoes?.cloudinaryName || 'dmuvm1o6m';
        document.getElementById('cloudinaryPreset').value = d.configuracoes?.cloudinaryPreset || 'evolution';
        
        if (d.modulos) {
            document.getElementById('moduloFinanceiro').checked = !!d.modulos.financeiro;
            document.getElementById('moduloCRM').checked = !!d.modulos.crm;
            document.getElementById('moduloEstoqueVendas').checked = !!d.modulos.estoqueVendas;            document.getElementById('moduloEstoqueInterno').checked = !!d.modulos.estoqueInterno;
            document.getElementById('moduloKanban').checked = !!d.modulos.kanban;
            document.getElementById('moduloPDF').checked = !!d.modulos.pdf;
            document.getElementById('moduloChat').checked = !!d.modulos.chat;
            document.getElementById('moduloIA').checked = !!d.modulos.ia;
        }
        
        sessionStorage.setItem('editandoClienteId', id);
        
        app.mostrarSecao('criar');
        
        const btn = document.getElementById('btnImplantar');
        if (btn) {
            btn.innerText = '💾 SALVAR ALTERAÇÕES';
            btn.classList.add('btn-warning');
        }
        
        alert('✅ Dados carregados! Edite e clique em "SALVAR ALTERAÇÕES"');
        
    } catch (error) {
        console.error("❌ Erro ao editar:", error);
        alert('Erro: ' + error.message);
    }
};

// =====================================================================
// EXCLUIR CLIENTE
// =====================================================================
app.excluirCliente = async function(id, nome) {
    console.log("🗑️ Excluindo cliente:", id, nome);
    
    if (!confirm(`⚠️ ATENÇÃO!\n\nExcluir PERMANENTEMENTE:\n\n"${nome}"\n\nIsso apagará TODOS os dados da empresa!\n\nContinuar?`)) {
        return;
    }
    
    const confirmacao = prompt('Digite EXCLUIR para confirmar:');
    if (confirmacao !== 'EXCLUIR') {
        alert('❌ Exclusão cancelada');
        return;
    }
    
    try {
        await app.db.collection('oficinas').doc(id).delete();
        alert('✅ Cliente excluído com sucesso!');
        console.log("✅ Exclusão concluída");
    } catch (error) {
        console.error("❌ Erro ao excluir:", error);
        alert('Erro ao excluir: ' + error.message);
    }
};
// =====================================================================
// FINANCEIRO MASTER
// =====================================================================
app.carregarFinanceiroMaster = function() {
    console.log("💰 Carregando financeiro master...");
    
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
                    
                    const badgeClass = d.tipo === 'ENTRADA' ? 'bg-success' : 'bg-danger';
                    const textClass = d.tipo === 'ENTRADA' ? 'text-success' : 'text-danger';
                    
                    const row = `
                        <tr>
                            <td>${d.data || '-'}</td>
                            <td><span class="badge ${badgeClass}">${d.tipo}</span></td>
                            <td>${d.desc || '-'}</td>
                            <td>${d.metodo || '-'}</td>
                            <td class="fw-bold ${textClass}">R$ ${(d.valor || 0).toFixed(2)}</td>
                            <td>
                                <button class="btn btn-sm btn-outline-danger" onclick="app.deletarLancamento('${doc.id}')">
                                    <i class="bi bi-trash"></i>
                                </button>
                            </td>
                        </tr>
                    `;
                    tbody.innerHTML += row;
                });
            }
            
            if (lblRec) lblRec.innerText = 'R$ ' + totalRec.toFixed(2).replace('.', ',');            if (lblDesp) lblDesp.innerText = 'R$ ' + totalDesp.toFixed(2).replace('.', ',');
            if (lblLucro) lblLucro.innerText = 'R$ ' + (totalRec - totalDesp).toFixed(2).replace('.', ',');
            
        }, error => {
            console.error("❌ Erro financeiro:", error);
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

// =====================================================================
// CONFIGURAR EVENTOS
// =====================================================================
app.configurarListeners = function() {
    console.log("🔗 Configurando listeners...");
    
    const btnImplantar = document.getElementById('btnImplantar');
    if (btnImplantar) {
        btnImplantar.addEventListener('click', app.salvarCliente);
    }
    
    const btnLancar = document.getElementById('btnLancarMaster');
    if (btnLancar) {
        btnLancar.addEventListener('click', app.lancarFinanceiro);
    }
    
    const btnInjetar = document.getElementById('btnInjetarDados');
    if (btnInjetar) {
        btnInjetar.addEventListener('click', app.injetarDados);
    }
};

// =====================================================================
// SALVAR CLIENTE (CRIAR OU EDITAR)
// =====================================================================
app.salvarCliente = async function() {
    const editandoId = sessionStorage.getItem('editandoClienteId');
    const isEdit = !!editandoId;
    
    console.log(isEdit ? "✏️ Salvando edição" : "➕ Criando novo cliente");
    
    const dados = {        nome: document.getElementById('nomeEmpresa')?.value || '',
        whatsapp: document.getElementById('whatsappFaturamento')?.value || '',
        nicho: document.getElementById('nichoOperacional')?.value || '',
        usuarioAdmin: document.getElementById('usuarioAdmin')?.value || '',
        senhaAdmin: document.getElementById('senhaAdmin')?.value || '',
        status: document.getElementById('statusSistema')?.value || 'Liberado',
        configuracoes: {
            geminiKey: document.getElementById('geminiKey')?.value || null,
            cloudinaryName: document.getElementById('cloudinaryName')?.value || 'dmuvm1o6m',
            cloudinaryPreset: document.getElementById('cloudinaryPreset')?.value || 'evolution'
        },
        modulos: {
            financeiro: document.getElementById('moduloFinanceiro')?.checked || false,
            crm: document.getElementById('moduloCRM')?.checked || false,
            estoqueVendas: document.getElementById('moduloEstoqueVendas')?.checked || false,
            estoqueInterno: document.getElementById('moduloEstoqueInterno')?.checked || false,
            kanban: document.getElementById('moduloKanban')?.checked || false,
            pdf: document.getElementById('moduloPDF')?.checked || false,
            chat: document.getElementById('moduloChat')?.checked || false,
            ia: document.getElementById('moduloIA')?.checked || false
        }
    };
    
    if (!dados.nome || !dados.usuarioAdmin || !dados.senhaAdmin) {
        alert('❌ Preencha: Nome, Usuário Admin e Senha!');
        return;
    }
    
    const btn = document.getElementById('btnImplantar');
    if (btn) {
        btn.disabled = true;
        btn.innerText = 'Processando...';
    }
    
    try {
        if (isEdit) {
            const docRef = app.db.collection('oficinas').doc(editandoId);
            const docSnap = await docRef.get();
            
            if (!docSnap.exists) {
                console.warn("⚠️ Documento não existe. Criando novo...");
                delete dados.dataAtualizacao;
                dados.dataCriacao = firebase.firestore.FieldValue.serverTimestamp();
                dados.ultimoAcesso = null;
                
                await app.db.collection('oficinas').add(dados);
                alert('✅ Cliente excluído anteriormente. Novo cliente criado!');
            } else {
                dados.dataAtualizacao = firebase.firestore.FieldValue.serverTimestamp();
                await docRef.update(dados);                alert('✅ Cliente atualizado!');
            }
            
            sessionStorage.removeItem('editandoClienteId');
            
            if (btn) {
                btn.innerText = 'IMPLANTAR SISTEMA NA NUVEM';
                btn.classList.remove('btn-warning');
            }
        } else {
            dados.dataCriacao = firebase.firestore.FieldValue.serverTimestamp();
            dados.ultimoAcesso = null;
            
            await app.db.collection('oficinas').add(dados);
            alert('✅ Cliente criado!\n\nLogin: ' + dados.usuarioAdmin);
        }
        
        document.getElementById('nomeEmpresa').value = '';
        document.getElementById('usuarioAdmin').value = '';
        document.getElementById('senhaAdmin').value = '';
        
        app.mostrarSecao('dashboard');
        
    } catch (error) {
        console.error("❌ Erro ao salvar:", error);
        alert('Erro: ' + error.message);
    } finally {
        const btn = document.getElementById('btnImplantar');
        if (btn && !sessionStorage.getItem('editandoClienteId')) {
            btn.disabled = false;
            btn.innerText = 'IMPLANTAR SISTEMA NA NUVEM';
        }
    }
};

// =====================================================================
// LANÇAR FINANCEIRO
// =====================================================================
app.lancarFinanceiro = async function() {
    const tipo = document.getElementById('tipoFinanceiroMaster')?.value || 'ENTRADA';
    const desc = document.getElementById('descFinanceiroMaster')?.value || '';
    const valor = parseFloat(document.getElementById('valorFinanceiroMaster')?.value || 0);
    const metodo = document.getElementById('metodoFinanceiroMaster')?.value || 'Pix / Transferência';
    const data = document.getElementById('dataFinanceiroMaster')?.value || new Date().toISOString().split('T')[0];
    
    if (!desc || valor <= 0) {
        alert('❌ Preencha descrição e valor!');
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
        
        alert('✅ Lançamento registrado!');
        
        const modal = bootstrap.Modal.getInstance(document.getElementById('modalFinanceiroMaster'));
        if (modal) modal.hide();
        
        document.getElementById('descFinanceiroMaster').value = '';
        document.getElementById('valorFinanceiroMaster').value = '';
        
    } catch (error) {
        alert('Erro: ' + error.message);
    }
};

// =====================================================================
// INJETAR DADOS (ONBOARDING)
// =====================================================================
app.injetarDados = async function() {
    const tenantSelect = document.getElementById('selectEmpresaOnboarding');
    const moduloDestino = document.getElementById('selectModuloDestino')?.value || 'crm';
    const jsonStr = document.getElementById('jsonInput')?.value || '';
    
    if (!tenantSelect?.value) {
        alert('❌ Selecione uma empresa!');
        return;
    }
    if (!jsonStr) {
        alert('❌ Cole o JSON!');
        return;
    }
    if (!confirm('Isso vai escrever no banco do cliente. Continuar?')) return;
    
    const btn = document.getElementById('btnInjetarDados');
    if (btn) {
        btn.disabled = true;
        btn.innerText = 'Injetando...';
    }
    
    try {
        const dados = JSON.parse(jsonStr);
        const tenantId = tenantSelect.value;        
        const colecoes = {
            'crm': 'clientes_base',
            'estoque': 'estoque',
            'historico': 'ordens_servico'
        };
        const collectionName = colecoes[moduloDestino];
        if (!collectionName) throw new Error('Módulo desconhecido');
        
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
        alert('❌ Erro no JSON: ' + e.message);
    } finally {
        const btn = document.getElementById('btnInjetarDados');
        if (btn) {
            btn.disabled = false;
            btn.innerText = 'INJETAR DADOS NA NUVEM';
        }
    }
};

// =====================================================================
// MODAL FINANCEIRO
// =====================================================================
app.abrirModalFinanceiro = function(tipo) {
    const modalEl = document.getElementById('modalFinanceiroMaster');
    if (!modalEl) return;
    
    const tipoField = document.getElementById('tipoFinanceiroMaster');
    if (tipoField) tipoField.value = tipo;    
    const titulo = document.getElementById('modalFinanceiroTitulo');
    if (titulo) {
        titulo.innerText = tipo === 'ENTRADA' ? 'Lançar Recebimento' : 'Lançar Pagamento';
    }
    
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
};

console.log("🚀 app_superadmin.js inicializado!");