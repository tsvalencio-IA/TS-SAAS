window.app = {};

// =====================================================================
// 1. NUVEM E SESSÃO DA OFICINA
// =====================================================================
app.firebaseConfig = {
    apiKey: "AIzaSyBqIuCsHHuy_f-mBWV4JBkbyOorXpqQvqg",
    authDomain: "hub-thiaguinho.firebaseapp.com",
    projectId: "hub-thiaguinho",
    storageBucket: "hub-thiaguinho.firebasestorage.app",
    messagingSenderId: "453508098543",
    appId: "1:453508098543:web:305f4d48edd9be40bd6e1a"
};

if (!firebase.apps.length) firebase.initializeApp(app.firebaseConfig);
app.db = firebase.firestore();

app.CLOUDINARY_CLOUD_NAME = sessionStorage.getItem('t_cloudName');
app.CLOUDINARY_UPLOAD_PRESET = sessionStorage.getItem('t_cloudPreset');
app.API_KEY_GEMINI = sessionStorage.getItem('t_gemini');
app.t_id = sessionStorage.getItem('t_id');
app.t_nome = sessionStorage.getItem('t_nome');
app.t_role = sessionStorage.getItem('t_role'); // 'admin', 'gerente' ou 'equipe'
app.user_nome = sessionStorage.getItem('f_nome');
app.user_comissao = parseFloat(sessionStorage.getItem('f_comissao') || 0);
app.t_mods = JSON.parse(sessionStorage.getItem('t_mods') || '{}');

if (!app.t_id) window.location.replace('index.html');

// Bancos Locais em Memória (Rápida Performance)
app.bancoOSCompleto = [];
app.bancoEstoque = [];
app.bancoFin = [];
app.bancoCrm = [];
app.bancoIA = [];
app.fotosOSAtual = [];
app.historicoOSAtual = [];
app.osParaFaturar = null;
app.chatListener = null;

// =====================================================================
// 2. INICIALIZAÇÃO E TRAVAS DE SEGURANÇA (RBAC)
// =====================================================================
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('lblEmpresa').innerText = app.t_nome;
    document.getElementById('lblUsuario').innerText = app.user_nome;
    
    // Controle de Acesso Dinâmico baseado no Cargo
    const style = document.createElement('style');
    if (app.t_role === 'equipe') {
        // Mecânico puro: esconde TUDO que for gerencial e de admin. Só vê mecânico.
        style.innerHTML = '.admin-only, .gestao-only { display: none !important; } .mecanico-only { display: flex !important;}';
        document.getElementById('lblComissaoUser').innerText = `Mecânico - Comissão: ${app.user_comissao}%`;
    } else if (app.t_role === 'gerente') {
        // Gerente/Vendedor: Vê gestão (custos, financeiro), mas não pode excluir (admin-only)
        style.innerHTML = '.admin-only, .mecanico-only { display: none !important; } .gestao-only { display: flex !important;}';
        document.getElementById('lblComissaoUser').innerText = `Acesso Gerencial / Vendas`;
    } else {
        // Master / Admin: O dono. Vê gestão e lixeiras/excluir. Só não vê dashboard de mecânico puro.
        style.innerHTML = '.mecanico-only { display: none !important;}';
        document.getElementById('lblComissaoUser').innerText = `Gestor Master (Dono)`;
    }
    document.head.appendChild(style);

    app.construirMenuLateral();
    
    const linkInicio = document.querySelector('.nav-sidebar .nav-link');
    if(linkInicio) app.mostrarTela('tela_dashboard', 'Inteligência Automotiva', linkInicio);
    
    // Liga os motores do banco de dados
    app.iniciarEscutaOS();
    app.iniciarEscutaCrm();
    
    if(app.t_role === 'admin' || app.t_role === 'gerente') {
        app.iniciarEscutaEstoque();
        app.iniciarEscutaFinanceiro();
    }
    if(app.t_role === 'admin') {
        app.iniciarEscutaIA();
        app.iniciarEscutaLixeira();
        app.iniciarEscutaEquipe();
    }
    app.configurarCloudinary();
});

app.construirMenuLateral = function() {
    const menu = document.getElementById('menuLateral');
    if (!menu) return;

    const hasMods = Object.keys(app.t_mods).length > 0;
    const showKanban = !hasMods || app.t_mods.kanban;
    const showCrm = !hasMods || app.t_mods.crm;
    const showEstoque = !hasMods || app.t_mods.estoque || app.t_mods.estoqueInterno;
    const showFin = !hasMods || app.t_mods.financeiro;
    const showIa = !hasMods || app.t_mods.ia;

    let html = `<a class="nav-link active" onclick="app.mostrarTela('tela_dashboard', 'Inteligência Automotiva', this)"><i class="bi bi-grid-1x2"></i> Início da Central</a>`;
    
    if (showKanban) {
        html += `<a class="nav-link" onclick="app.mostrarTela('tela_os', 'Pátio Ativo', this)"><i class="bi bi-kanban text-info"></i> Pátio Kanban</a>`;
        html += `<a class="nav-link" onclick="app.mostrarTela('tela_arquivo', 'Arquivo Histórico', this); app.renderizarTabelaArquivo();"><i class="bi bi-archive text-warning"></i> Arquivo Morto</a>`;
    }
    
    if (showCrm && (app.t_role === 'admin' || app.t_role === 'gerente')) {
        html += `<a class="nav-link" onclick="app.mostrarTela('tela_crm', 'Base CRM e Portal', this)"><i class="bi bi-person-lines-fill text-info"></i> CRM e Clientes</a>`;
    }
    
    if (showEstoque && (app.t_role === 'admin' || app.t_role === 'gerente')) {
        html += `<a class="nav-link" onclick="app.mostrarTela('tela_estoque', 'Almoxarifado / Estoque', this)"><i class="bi bi-box-seam text-primary"></i> Estoque Físico</a>`;
    }

    if (showFin && (app.t_role === 'admin' || app.t_role === 'gerente')) {
        html += `<a class="nav-link" onclick="app.mostrarTela('tela_financeiro', 'DRE e Caixas', this)"><i class="bi bi-bank text-success"></i> Financeiro (DRE)</a>`;
    }
    
    if (showIa && app.t_role === 'admin') {
        html += `<a class="nav-link" onclick="app.mostrarTela('tela_ia', 'Treinamento I.A.', this)"><i class="bi bi-database-fill-up text-warning"></i> Treinamento I.A.</a>`;
    }

    if (app.t_role === 'admin') {
        html += `<a class="nav-link" onclick="app.mostrarTela('tela_equipe', 'Gestão da Equipe', this)"><i class="bi bi-people-fill text-success"></i> Equipe e RH</a>`;
    }

    menu.innerHTML = html;
};

// Funções Globais
app.showToast = function(msg, type='success') {
    const bg = type === 'success' ? 'bg-success' : type === 'error' ? 'bg-danger' : 'bg-warning text-dark';
    const t = document.createElement('div');
    t.innerHTML = `<div class="toast align-items-center text-white ${bg} border-0 show p-3 mt-2 shadow-lg rounded-3"><div class="d-flex"><div class="toast-body fw-bold">${msg}</div><button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button></div></div>`;
    document.getElementById('toastContainer').appendChild(t.firstChild);
    setTimeout(() => { if(t.firstChild) t.firstChild.remove() }, 5000);
};

app.sair = function() { sessionStorage.clear(); window.location.href = 'index.html'; };

app.mostrarTela = function(id, titulo, btn) {
    document.querySelectorAll('.modulo-tela').forEach(t => t.style.display = 'none');
    const tela = document.getElementById(id);
    if(tela) tela.style.display = 'block';
    
    const hTitulo = document.getElementById('tituloPagina');
    if(hTitulo) hTitulo.innerText = titulo;
    
    if(btn) {
        document.querySelectorAll('.nav-link').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    }
};

// =====================================================================
// 3. CRM E CREDENCIAIS DO CLIENTE NO PORTAL
// =====================================================================
app.validarCPF = function(cpf) {
    cpf = cpf.replace(/[^\d]+/g,''); if(cpf == '') return false;
    if (cpf.length != 11 || /^(\d)\1{10}$/.test(cpf)) return false;
    let add = 0; for (let i=0; i < 9; i ++) add += parseInt(cpf.charAt(i)) * (10 - i);
    let rev = 11 - (add % 11); if (rev == 10 || rev == 11) rev = 0; if (rev != parseInt(cpf.charAt(9))) return false;
    add = 0; for (let i = 0; i < 10; i ++) add += parseInt(cpf.charAt(i)) * (11 - i);
    rev = 11 - (add % 11); if (rev == 10 || rev == 11) rev = 0; if (rev != parseInt(cpf.charAt(10))) return false;
    return true;
};

app.validarDocUI = function(input) {
    const val = input.value.replace(/\D/g, '');
    if(val.length === 11) {
        if(!app.validarCPF(val)) {
            app.showToast("CPF Inválido. Não será possível salvar.", "error");
            input.classList.add('border-danger'); input.classList.remove('border-warning');
        } else {
            input.classList.remove('border-danger'); input.classList.add('border-success');
            app.showToast("CPF Autenticado.", "success");
        }
    } else if(val.length > 11) {
        input.classList.remove('border-danger'); input.classList.add('border-success');
    }
};

app.buscarCEP = function(cep) {
    cep = cep.replace(/\D/g, ''); if(cep.length !== 8) return;
    fetch(`https://viacep.com.br/ws/${cep}/json/`).then(res => res.json()).then(data => {
        if(!data.erro) {
            document.getElementById('c_rua').value = data.logradouro;
            document.getElementById('c_bairro').value = data.bairro;
            document.getElementById('c_cidade').value = data.localidade;
        }
    });
};

app.iniciarEscutaCrm = function() {
    app.db.collection('clientes_base').where('tenantId', '==', app.t_id).onSnapshot(snap => {
        app.bancoCrm = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const tb = document.getElementById('tabelaCrmCorpo');
        if(tb) {
            tb.innerHTML = app.bancoCrm.map(c => `<tr><td><strong class="text-white">${c.nome}</strong></td><td>${c.documento||'-'}</td><td>${c.telefone}</td><td class="text-info">${c.usuario || 'Sem Acesso'}</td><td class="gestao-only text-end"><button class="btn btn-sm btn-outline-info me-1 border-0" onclick="app.abrirModalCRM('edit', '${c.id}')"><i class="bi bi-pencil"></i></button><button class="btn btn-sm btn-outline-danger border-0 admin-only" onclick="app.apagarCliente('${c.id}')"><i class="bi bi-trash"></i></button></td></tr>`).join('');
        }
        const list = document.getElementById('listaClientesCRM');
        if(list) list.innerHTML = app.bancoCrm.map(c => `<option value="${c.nome}">CPF/CNPJ: ${c.documento||'N/A'}</option>`).join('');
    });
};

app.abrirModalCRM = function(mode = 'nova', id = '') {
    document.getElementById('formCrm').reset();
    document.getElementById('crm_id').value = '';
    if(mode === 'edit') {
        const c = app.bancoCrm.find(x => x.id === id);
        if(c) {
            document.getElementById('crm_id').value = c.id; document.getElementById('c_nome').value = c.nome;
            document.getElementById('c_tel').value = c.telefone; document.getElementById('c_doc').value = c.documento||'';
            document.getElementById('c_email').value = c.email||''; document.getElementById('c_cep').value = c.cep||'';
            document.getElementById('c_rua').value = c.rua||''; document.getElementById('c_num').value = c.num||'';
            document.getElementById('c_bairro').value = c.bairro||''; document.getElementById('c_cidade').value = c.cidade||'';
            document.getElementById('c_notas').value = c.anotacoes||'';
            document.getElementById('c_user').value = c.usuario||''; document.getElementById('c_pass').value = c.senha||'';
        }
    }
    new bootstrap.Modal(document.getElementById('modalCrm')).show();
};

app.salvarClienteCRM = async function(e) {
    e.preventDefault();
    const id = document.getElementById('crm_id').value;
    const doc = document.getElementById('c_doc').value.replace(/\D/g, '');
    
    if(doc.length === 11 && !app.validarCPF(doc)) { app.showToast("Impossível salvar. CPF inválido.", "error"); return; }
    
    const p = { 
        tenantId: app.t_id, nome: document.getElementById('c_nome').value, telefone: document.getElementById('c_tel').value, documento: doc, email: document.getElementById('c_email').value, cep: document.getElementById('c_cep').value, rua: document.getElementById('c_rua').value, num: document.getElementById('c_num').value, bairro: document.getElementById('c_bairro').value, cidade: document.getElementById('c_cidade').value, anotacoes: document.getElementById('c_notas').value,
        usuario: document.getElementById('c_user').value.trim(),
        senha: document.getElementById('c_pass').value.trim()
    };
    
    if(id) { await app.db.collection('clientes_base').doc(id).update(p); app.showToast("Ficha do cliente e acessos atualizados.", "success"); } 
    else { await app.db.collection('clientes_base').add(p); app.showToast("Novo cliente registrado na base.", "success"); }
    
    e.target.reset();
    bootstrap.Modal.getInstance(document.getElementById('modalCrm')).hide();
    
    if(document.getElementById('os_cliente') && document.getElementById('os_cliente').value === '') {
        document.getElementById('os_cliente').value = p.nome;
        document.getElementById('os_celular').value = p.telefone;
        document.getElementById('os_cliente_cpf').value = p.documento;
    }
};

app.apagarCliente = async function(id) {
    if(app.t_role !== 'admin') { app.showToast("Apenas o gestor principal pode excluir cadastros.", "error"); return; }
    if(confirm("Apagar o cadastro deste cliente? O histórico de veículos no Arquivo Morto será mantido.")) {
        await app.db.collection('clientes_base').doc(id).delete();
    }
};

app.aoSelecionarClienteOS = function() {
    const nomeDigitado = document.getElementById('os_cliente').value.trim();
    const cliente = app.bancoCrm.find(c => c.nome.toLowerCase() === nomeDigitado.toLowerCase());
    if(cliente) {
        document.getElementById('os_celular').value = cliente.telefone || '';
        document.getElementById('os_cliente_cpf').value = cliente.documento || '';
    }
};

app.editarClienteRapido = function() {
    const nome = document.getElementById('os_cliente').value.trim();
    const cliente = app.bancoCrm.find(c => c.nome.toLowerCase() === nome.toLowerCase());
    if(cliente) { app.abrirModalCRM('edit', cliente.id); } 
    else { document.getElementById('c_nome').value = nome; app.abrirModalCRM('nova'); }
};

// =====================================================================
// 4. ESTOQUE E LEITURA DE XML
// =====================================================================
app.iniciarEscutaEstoque = function() {
    app.db.collection('estoque').where('tenantId', '==', app.t_id).onSnapshot(snap => {
        app.bancoEstoque = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const tbody = document.getElementById('tabelaEstoqueCorpo');
        if(tbody) {
            tbody.innerHTML = app.bancoEstoque.map(p => `<tr><td><small class="text-white-50">${p.fornecedor||'N/A'}</small><br><span class="badge bg-primary">NF: ${p.nf||'S/N'}</span></td><td><span class="text-info small">[NCM: ${p.ncm||'-'}]</span> <strong class="text-white">${p.desc}</strong></td><td><span class="badge bg-secondary px-3 py-2 fs-6 shadow-sm">${p.qtd} un</span></td><td class="gestao-only text-danger fw-bold">R$ ${p.custo.toFixed(2)}</td><td class="text-success fw-bold fs-6">R$ ${p.venda.toFixed(2)}</td><td class="gestao-only text-end"><button class="btn btn-sm btn-outline-danger shadow-sm admin-only" onclick="app.apagarProduto('${p.id}')"><i class="bi bi-trash-fill"></i></button></td></tr>`).join('');
        }
        const sel = document.getElementById('selectProdutoEstoque');
        if(sel) {
            sel.innerHTML = '<option value="">Puxar Peça ou Produto do Almoxarifado...</option>' + app.bancoEstoque.filter(p=>p.qtd>0).map(p => `<option value="${p.id}" data-venda="${p.venda}" data-custo="${p.custo}" data-desc="${p.desc}" data-ncm="${p.ncm||'-'}">[Est: ${p.qtd}] - ${p.desc} (R$ ${p.venda.toFixed(2)})</option>`).join('');
        }
    });
};

app.abrirModalNF = function() {
    document.getElementById('formNF').reset();
    document.getElementById('corpoItensNF').innerHTML = '';
    document.getElementById('nf_data').value = new Date().toISOString().split('T')[0];
    new bootstrap.Modal(document.getElementById('modalNF')).show();
};

app.processarXML = function(event) {
    const file = event.target.files[0]; if(!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        const xmlText = e.target.result; const parser = new DOMParser(); const xmlDoc = parser.parseFromString(xmlText, "text/xml");
        const emit = xmlDoc.getElementsByTagName("emit")[0]; 
        if(emit) { const xNome = emit.getElementsByTagName("xNome")[0]; if(xNome) document.getElementById('nf_fornecedor').value = xNome.textContent; }
        const ide = xmlDoc.getElementsByTagName("ide")[0]; 
        if(ide) { const nNF = ide.getElementsByTagName("nNF")[0]; if(nNF) document.getElementById('nf_numero').value = nNF.textContent; }
        
        const det = xmlDoc.getElementsByTagName("det");
        for(let i=0; i<det.length; i++) {
            const prod = det[i].getElementsByTagName("prod")[0];
            if(prod) {
                const desc = prod.getElementsByTagName("xProd")[0]?.textContent || '';
                const ncm = prod.getElementsByTagName("NCM")[0]?.textContent || '';
                const cfop = prod.getElementsByTagName("CFOP")[0]?.textContent || '';
                const qtd = parseFloat(prod.getElementsByTagName("qCom")[0]?.textContent || 0);
                const vUnCom = parseFloat(prod.getElementsByTagName("vUnCom")[0]?.textContent || 0);
                app.adicionarLinhaNF(desc, ncm, cfop, qtd, vUnCom, (vUnCom * 1.8)); // 80% de Margem Sugerida
            }
        }
        app.showToast("XML processado. Modifique a sua margem de Venda.", "success");
    };
    reader.readAsText(file);
};

app.adicionarLinhaNF = function(desc='', ncm='', cfop='', qtd=1, custo=0, venda=0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td><input type="text" class="form-control form-control-sm bg-dark text-white border-secondary p-1 it-desc" value="${desc}"></td><td><input type="text" class="form-control form-control-sm bg-dark text-white border-secondary p-1 it-ncm" value="${ncm}"></td><td><input type="text" class="form-control form-control-sm bg-dark text-white border-secondary p-1 it-cfop" value="${cfop}"></td><td><input type="number" class="form-control form-control-sm bg-dark text-white border-secondary p-1 it-qtd" value="${qtd}"></td><td><input type="number" step="0.01" class="form-control form-control-sm bg-dark text-danger border-secondary p-1 it-custo" value="${custo}"></td><td><input type="number" step="0.01" class="form-control form-control-sm bg-dark text-success border-secondary p-1 it-venda fw-bold" value="${venda}"></td><td><button type="button" class="btn btn-sm btn-outline-danger p-1 border-0" onclick="this.closest('tr').remove()"><i class="bi bi-trash"></i></button></td>`;
    document.getElementById('corpoItensNF').appendChild(tr);
};

app.salvarEntradaEstoque = async function(e) {
    e.preventDefault();
    const fornecedor = document.getElementById('nf_fornecedor').value;
    const nf = document.getElementById('nf_numero').value;
    const gerarPagamento = document.getElementById('nf_gerar_financeiro').checked;
    
    let totalCustoNF = 0;
    const batch = app.db.batch();
    
    document.querySelectorAll('#corpoItensNF tr').forEach(tr => {
        const desc = tr.querySelector('.it-desc').value.trim();
        const q = parseFloat(tr.querySelector('.it-qtd').value)||0;
        const c = parseFloat(tr.querySelector('.it-custo').value)||0;
        const v = parseFloat(tr.querySelector('.it-venda').value)||0;
        
        if(desc !== '' && q > 0) {
            totalCustoNF += (q * c);
            const ref = app.db.collection('estoque').doc();
            batch.set(ref, { tenantId: app.t_id, fornecedor: fornecedor, nf: nf, ncm: tr.querySelector('.it-ncm').value, cfop: tr.querySelector('.it-cfop').value, desc: desc, qtd: q, custo: c, venda: v, usuarioEntrada: app.user_nome, dataEntrada: new Date().toISOString() });
        }
    });

    if(gerarPagamento && totalCustoNF > 0) {
        const finRef = app.db.collection('financeiro').doc();
        batch.set(finRef, { tenantId: app.t_id, tipo: 'despesa', desc: `Nota Fiscal Fornecedor: ${fornecedor} (NF: ${nf})`, valor: totalCustoNF, parcelaAtual: 1, totalParcelas: 1, metodo: 'Boleto/Pix', vencimento: new Date(document.getElementById('nf_data').value).toISOString(), status: 'pendente' });
    }
    
    await batch.commit();
    app.showToast("Nota Fiscal importada e estoque abastecido!");
    bootstrap.Modal.getInstance(document.getElementById('modalNF')).hide();
};

app.apagarProduto = async function(id) {
    if(app.t_role !== 'admin') { app.showToast("Permissão Negada.", "error"); return; }
    if(confirm("Remover a peça permanentemente do estoque?")) {
        await app.db.collection('estoque').doc(id).delete();
    }
};

// =====================================================================
// 5. MOTOR KANBAN E PRONTUÁRIO
// =====================================================================
app.iniciarEscutaOS = function() {
    app.db.collection('ordens_servico').where('tenantId', '==', app.t_id).onSnapshot(snap => {
        app.bancoOSCompleto = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        if(app.t_role === 'equipe') {
            let minhaCom = 0;
            app.bancoOSCompleto.filter(o => o.status === 'entregue' && o.mecanicoReal === app.user_nome).forEach(o => minhaCom += (o.comissaoProcessada||0));
            const divComissao = document.getElementById('kpiMinhaComissao');
            if(divComissao) divComissao.innerText = `R$ ${minhaCom.toFixed(2).replace('.',',')}`;
        }
        
        app.renderizarKanban();
        app.renderizarTabelaArquivo();
        if(app.t_role === 'admin' || app.t_role === 'gerente') app.renderizarFinanceiroGeral();
    });
};

app.filtrarGlobal = function() {
    app.renderizarKanban();
    app.renderizarTabelaArquivo();
};

app.renderizarKanban = function() {
    const busca = document.getElementById('buscaGeral');
    const t = busca ? busca.value.toLowerCase().trim() : '';
    let ativos = app.bancoOSCompleto.filter(os => os.status !== 'entregue');
    
    if(t) ativos = ativos.filter(os => (os.placa&&os.placa.toLowerCase().includes(t)) || (os.cliente&&os.cliente.toLowerCase().includes(t)));

    const cols = { patio: '', orcamento: '', aprovacao: '', box: '', pronto: '' };
    let counts = { patio: 0, orcamento: 0, aprovacao: 0, box: 0, pronto: 0 };
    const ordem = ['patio', 'orcamento', 'aprovacao', 'box', 'pronto'];

    ativos.forEach(os => {
        const s = os.status || 'patio'; counts[s]++;
        let cor = s === 'pronto' ? 'border-success' : s === 'aprovacao' ? 'border-warning' : s === 'box' ? 'border-info' : s === 'orcamento' ? 'border-primary' : 'border-secondary';
        
        const idx = ordem.indexOf(s);
        const nextS = idx < ordem.length-1 ? ordem[idx+1] : null;
        const prevS = idx > 0 ? ordem[idx-1] : null;
        
        let btnBack = prevS ? `<button class="btn btn-sm btn-dark p-1 px-2 border-secondary shadow-sm me-1" onclick="event.stopPropagation(); app.mudarStatusRapido('${os.id}', '${prevS}')" title="Voltar Fase"><i class="bi bi-arrow-left-circle text-white-50"></i></button>` : '';
        let btnFwd = s === 'pronto' ? `<button class="btn btn-sm btn-success p-1 px-3 shadow fw-bold gestao-only" onclick="event.stopPropagation(); app.abrirFaturamentoDireto('${os.id}')"><i class="bi bi-cash-coin me-1"></i> FATURAR</button>` : `<button class="btn btn-sm btn-dark p-1 px-2 border-secondary shadow-sm" onclick="event.stopPropagation(); app.mudarStatusRapido('${os.id}', '${nextS}')" title="Avançar Fase"><i class="bi bi-arrow-right-circle text-info"></i></button>`;

        cols[s] += `<div class="os-card border-start border-4 ${cor}" onclick="app.abrirModalOS('edit', '${os.id}')"><div class="fast-actions">${btnBack}${btnFwd}</div><div class="d-flex justify-content-between mb-2"><span class="badge bg-dark border border-secondary text-white py-2 px-3">${os.placa}</span></div><h6 class="text-white fw-bold mb-1 w-75 text-truncate">${os.veiculo}</h6><small class="text-white-50"><i class="bi bi-person-fill"></i> ${os.cliente}</small></div>`;
    });
    
    ordem.forEach(id => { 
        const col = document.getElementById('col_'+id);
        const count = document.getElementById('count_'+id);
        if(col) col.innerHTML = cols[id]; 
        if(count) count.innerText = counts[id]; 
    });
};

app.mudarStatusRapido = async function(id, novoStatus) {
    const osRef = app.db.collection('ordens_servico').doc(id);
    const doc = await osRef.get();
    let h = doc.data().historico || [];
    h.push({ data: new Date().toISOString(), usuario: app.user_nome, acao: `Card movido pelo pátio para: ${novoStatus.toUpperCase()}` });
    
    await osRef.update({ status: novoStatus, historico: h, ultimaAtualizacao: new Date().toISOString() });
    
    if(confirm("Deseja notificar o cliente via WhatsApp sobre o novo status?")) {
        const url = `https://seusite.com/portal.html?t=${app.t_id}&os=${id}`;
        window.open(`https://wa.me/${(doc.data().celular||'').replace(/\D/g, '')}?text=${encodeURIComponent('Olá! A oficina atualizou o status do seu veículo. Acompanhe a ficha e as fotos ao vivo no seu painel: ' + url)}`, '_blank');
    }
};

// =====================================================================
// 6. LIXEIRA DE AUDITORIA E ARQUIVO MORTO
// =====================================================================
app.renderizarTabelaArquivo = function() {
    let entregues = app.bancoOSCompleto.filter(os => os.status === 'entregue').sort((a,b) => new Date(b.ultimaAtualizacao) - new Date(a.ultimaAtualizacao));
    const busca = document.getElementById('buscaGeral');
    const t = busca ? busca.value.toLowerCase().trim() : '';
    if (t) entregues = entregues.filter(o => (o.placa&&o.placa.toLowerCase().includes(t)) || (o.cliente&&o.cliente.toLowerCase().includes(t)));
    
    const tbody = document.getElementById('tabelaArquivoCorpo');
    if(tbody) tbody.innerHTML = entregues.map(os => `<tr><td class="text-white-50 small"><i class="bi bi-calendar-check text-success me-2"></i> ${new Date(os.ultimaAtualizacao).toLocaleDateString('pt-BR')}</td><td><span class="badge bg-dark border px-3 py-2 fs-6 shadow-sm">${os.placa}</span></td><td class="text-white fw-bold">${os.veiculo}</td><td class="text-white-50">${os.cliente}</td><td class="gestao-only text-success fw-bold">R$ ${(os.total||0).toFixed(2).replace('.',',')}</td><td class="text-center"><button class="btn btn-outline-info shadow-sm fw-bold px-4" onclick="app.abrirModalOS('edit', '${os.id}')"><i class="bi bi-folder-symlink-fill me-2"></i> Prontuário</button></td></tr>`).join('');
};

app.iniciarEscutaLixeira = function() {
    app.db.collection('lixeira_auditoria').where('tenantId', '==', app.t_id).onSnapshot(snap => {
        const tb = document.getElementById('tabelaLixeiraCorpo');
        if(tb) tb.innerHTML = snap.docs.map(d => {
            const l = d.data();
            return `<tr><td class="text-white-50 small">${new Date(l.apagadoEm).toLocaleDateString('pt-BR')}</td><td class="text-white fw-bold">${l.placaOriginal}</td><td><i class="bi bi-person-badge text-danger"></i> ${l.apagadoPor}</td><td class="text-warning">${l.motivo}</td></tr>`;
        }).join('');
    });
};

app.apagarOS = async function() {
    if(app.t_role !== 'admin') { app.showToast("Cancelamento Bloqueado. Apenas o Dono pode apagar.", "error"); return; }
    
    const m = prompt("ATENÇÃO: A Ficha Técnica será cancelada e destruída do pátio. \nDigite a JUSTIFICATIVA (Obrigatório para Auditoria):");
    if(!m || m.trim() === '') { app.showToast("Operação Abortada. A justificativa é obrigatória.", "error"); return; }
    
    const id = document.getElementById('os_id').value;
    const osCancelada = app.bancoOSCompleto.find(x => x.id === id);
    
    await app.db.collection('lixeira_auditoria').add({ tenantId: app.t_id, placaOriginal: osCancelada.placa, apagadoPor: app.user_nome, apagadoEm: new Date().toISOString(), motivo: m, dadosAntigos: osCancelada });
    await app.db.collection('ordens_servico').doc(id).delete();
    
    app.showToast("O.S. Deletada com sucesso. Arquivada na Lixeira.", "success");
    bootstrap.Modal.getInstance(document.getElementById('modalOS')).hide();
};

// =====================================================================
// 7. GERENCIAMENTO DA FICHA DE O.S.
// =====================================================================
app.verificarStatusLink = function() {
    const a = document.getElementById('alertaLinkCliente');
    if(!a) return;
    if (document.getElementById('os_status').value === 'aprovacao' && document.getElementById('os_id').value) a.classList.remove('d-none'); else a.classList.add('d-none');
};

app.enviarWhatsApp = function() {
    const url = `https://seusite.com/portal.html?t=${app.t_id}&os=${document.getElementById('os_id').value}`;
    const txt = `Olá! A Ordem de Serviço do seu veículo na *${app.t_nome}* foi atualizada. Acesse o nosso portal para visualizar o orçamento oficial, imagens técnicas e falar conosco pelo chat: \n\n👉 ${url}`;
    window.open(`https://wa.me/${document.getElementById('os_celular').value.replace(/\D/g, '')}?text=${encodeURIComponent(txt)}`, '_blank');
};

app.abrirModalOS = function(mode = 'nova', id = '') {
    document.getElementById('formOS').reset();
    document.getElementById('listaPecasCorpo').innerHTML = '';
    app.fotosOSAtual = []; app.historicoOSAtual = [];
    document.getElementById('header_placa').innerText = '';
    document.getElementById('listaHistorico').innerHTML = '';
    document.getElementById('caixaMensagens').innerHTML = '';
    
    const btnFat = document.getElementById('btnFaturar');
    if(btnFat) btnFat.classList.add('d-none');
    
    const btnPdf = document.getElementById('btnGerarPDF');
    if(btnPdf) btnPdf.classList.add('d-none');
    
    ['chk_combustivel', 'chk_arranhado', 'chk_bateria', 'chk_pneus'].forEach(i => {
        const chk = document.getElementById(i);
        if(chk) chk.checked = false;
    });

    if (mode === 'edit') {
        const os = app.bancoOSCompleto.find(x => x.id === id);
        if (os) {
            document.getElementById('os_id').value = os.id;
            document.getElementById('os_placa').value = os.placa || '';
            document.getElementById('header_placa').innerText = `[${os.placa}]`;
            document.getElementById('os_veiculo').value = os.veiculo || '';
            document.getElementById('os_cliente').value = os.cliente || '';
            document.getElementById('os_celular').value = os.celular || '';
            document.getElementById('os_status').value = os.status || 'patio';
            document.getElementById('os_relato_cliente').value = os.relatoCliente || '';
            document.getElementById('os_diagnostico').value = os.diagnostico || '';
            
            if(os.chk_combustivel) document.getElementById('chk_combustivel').checked = true;
            if(os.chk_arranhado) document.getElementById('chk_arranhado').checked = true;
            if(os.chk_bateria) document.getElementById('chk_bateria').checked = true;
            if(os.chk_pneus) document.getElementById('chk_pneus').checked = true;
            
            if (os.fotos) { app.fotosOSAtual = os.fotos; app.renderizarGaleria(); }
            if (os.historico) { app.historicoOSAtual = os.historico; app.renderizarHistorico(); }
            if (os.pecas) os.pecas.forEach(p => app.adicionarLinhaPeca(p.desc, p.ncm, p.qtd, p.custo, p.venda, p.idEstoque, p.isMaoObra));
            
            if(btnPdf) btnPdf.classList.remove('d-none');
            
            if (os.status === 'pronto' && (app.t_role === 'admin' || app.t_role === 'gerente') && btnFat) btnFat.classList.remove('d-none');
            
            const btnDel = document.getElementById('btnDeletarOS');
            if (app.t_role === 'admin' && btnDel) btnDel.classList.remove('d-none');
            
            app.iniciarEscutaChat(os.id);
        }
    } else {
        app.adicionarMaoDeObra();
    }
    app.verificarStatusLink();
    new bootstrap.Modal(document.getElementById('modalOS')).show();
};

app.adicionarDoEstoque = function() {
    const sel = document.getElementById('selectProdutoEstoque'); if(!sel || !sel.value) return;
    const opt = sel.options[sel.selectedIndex];
    app.adicionarLinhaPeca(opt.dataset.desc, opt.dataset.ncm, 1, parseFloat(opt.dataset.custo), parseFloat(opt.dataset.venda), sel.value, false);
    sel.value = '';
};

app.adicionarMaoDeObra = function() {
    app.adicionarLinhaPeca("Mão de Obra Mecânica / Serviço", "-", 1, 0, 0, null, true);
};

app.adicionarLinhaPeca = function(desc, ncm, qtd, custo, venda, idEstoque, isMaoObra) {
    const tr = document.createElement('tr');
    const mo = isMaoObra ? `data-maoobra="true"` : '';
    const est = idEstoque ? `data-idestoque="${idEstoque}" readonly` : '';
    tr.innerHTML = `<td><input type="text" class="form-control form-control-sm bg-dark text-white border-secondary peca-desc p-2" value="${desc}" ${est} ${mo} placeholder="Descreva o serviço..."></td>
        <td><span class="text-white-50 small d-block">NCM: ${ncm||'-'}</span></td>
        <td><input type="number" class="form-control form-control-sm bg-dark text-white border-secondary peca-qtd p-2" value="${qtd}" min="1" onchange="app.calcularTotalOS()"></td>
        <td class="gestao-only"><input type="number" step="0.01" class="form-control form-control-sm bg-dark text-danger border-secondary peca-custo p-2" value="${custo}" onchange="app.calcularTotalOS()"></td>
        <td><input type="number" step="0.01" class="form-control form-control-sm bg-dark text-success border-secondary peca-venda p-2 fw-bold" value="${venda}" onchange="app.calcularTotalOS()"></td>
        <td><input type="text" class="form-control form-control-sm bg-black text-white border-0 peca-total fw-bold p-2" readonly value="0.00"></td>
        <td class="text-center" data-html2canvas-ignore><button type="button" class="btn btn-sm btn-outline-danger border-0 mt-1" onclick="this.closest('tr').remove(); app.calcularTotalOS()"><i class="bi bi-trash"></i></button></td>`;
    document.getElementById('listaPecasCorpo').appendChild(tr);
    app.calcularTotalOS();
};

app.calcularTotalOS = function() {
    let t = 0; let tc = 0;
    document.querySelectorAll('#listaPecasCorpo tr').forEach(tr => {
        const q = parseFloat(tr.querySelector('.peca-qtd').value)||0;
        const v = parseFloat(tr.querySelector('.peca-venda').value)||0;
        const c = parseFloat(tr.querySelector('.peca-custo').value)||0;
        tr.querySelector('.peca-total').value = (q*v).toFixed(2);
        t += (q*v); tc += (q*c);
    });
    
    const divGeral = document.getElementById('os_total_geral');
    const divCusto = document.getElementById('os_total_custo');
    if(divGeral) divGeral.innerText = `R$ ${t.toFixed(2).replace('.',',')}`;
    if(divCusto) divCusto.innerText = `R$ ${tc.toFixed(2).replace('.',',')}`;
    
    return t;
};

app.salvarOS = async function() {
    const id = document.getElementById('os_id').value;
    let pecasArray = []; let tVenda = 0; let tCusto = 0; let tMO = 0;
    const cpfOS = document.getElementById('os_cliente_cpf').value || '';
    const clienteOS = document.getElementById('os_cliente').value.trim();
    const telOS = document.getElementById('os_celular').value.trim();
    
    // Cria Cliente Fast no CRM se não existir
    if(clienteOS && !app.bancoCrm.find(c => c.nome.toLowerCase() === clienteOS.toLowerCase())) {
        await app.db.collection('clientes_base').add({ tenantId: app.t_id, nome: clienteOS, telefone: telOS, documento: cpfOS, anotacoes: "Criado automaticamente via O.S." });
    }

    document.querySelectorAll('#listaPecasCorpo tr').forEach(tr => {
        const descInput = tr.querySelector('.peca-desc'); const desc = descInput.value.trim();
        const idEstoque = descInput.dataset.idestoque || null; const isMaoObra = descInput.dataset.maoobra === "true";
        const q = parseFloat(tr.querySelector('.peca-qtd').value)||1; const c = parseFloat(tr.querySelector('.peca-custo').value)||0; const v = parseFloat(tr.querySelector('.peca-venda').value)||0;
        if (desc !== '') { pecasArray.push({ desc, qtd:q, custo:c, venda:v, idEstoque, isMaoObra }); tVenda += (q*v); tCusto += (q*c); if(isMaoObra) tMO += (q*v); }
    });
    
    app.historicoOSAtual.push({ data: new Date().toISOString(), usuario: app.user_nome, acao: id ? "O.S e Orçamento atualizados." : "O.S. Técnica Aberta." });
    
    const payload = {
        tenantId: app.t_id, placa: document.getElementById('os_placa').value.toUpperCase(),
        veiculo: document.getElementById('os_veiculo').value, cliente: clienteOS, celular: telOS,
        status: document.getElementById('os_status').value, relatoCliente: document.getElementById('os_relato_cliente').value,
        diagnostico: document.getElementById('os_diagnostico').value,
        chk_combustivel: document.getElementById('chk_combustivel') ? document.getElementById('chk_combustivel').checked : false, 
        chk_arranhado: document.getElementById('chk_arranhado') ? document.getElementById('chk_arranhado').checked : false,
        chk_bateria: document.getElementById('chk_bateria') ? document.getElementById('chk_bateria').checked : false, 
        chk_pneus: document.getElementById('chk_pneus') ? document.getElementById('chk_pneus').checked : false,
        pecas: pecasArray, total: tVenda, custoTotal: tCusto, maoObraTotal: tMO, fotos: app.fotosOSAtual,
        historico: app.historicoOSAtual, ultimaAtualizacao: new Date().toISOString()
    };
    
    if (!id) payload.mecanico = app.user_nome; // Crava o dono da OS para dar comissão a ele na baixa
    
    if (document.getElementById('os_status').value === 'entregue') { app.showToast("Para fechar e entregar, use o botão Verde de FATURAMENTO.", "warning"); return; }
    
    if (id) await app.db.collection('ordens_servico').doc(id).update(payload);
    else await app.db.collection('ordens_servico').add(payload);
    
    app.showToast("Dados do veículo guardados no servidor.", "success");
    bootstrap.Modal.getInstance(document.getElementById('modalOS')).hide();
};

// =====================================================================
// 8. O MOTOR DE FATURAMENTO DA OFICINA
// =====================================================================
app.abrirFaturamentoDireto = function(id) {
    app.osParaFaturar = app.bancoOSCompleto.find(o => o.id === id);
    document.getElementById('fat_valor_total').innerText = `R$ ${(app.osParaFaturar.total||0).toFixed(2).replace('.',',')}`;
    new bootstrap.Modal(document.getElementById('modalFaturamento')).show();
};

app.abrirFaturamentoOS = function() {
    app.salvarOS();
    setTimeout(() => { app.abrirFaturamentoDireto(document.getElementById('os_id').value); }, 1000);
};

app.processarFaturamentoCompleto = async function() {
    if(!app.osParaFaturar) return;
    const metodo = document.getElementById('fat_metodo').value;
    const parcelas = parseInt(document.getElementById('fat_parcelas').value);
    const valorParcela = app.osParaFaturar.total / parcelas;
    const batch = app.db.batch();
    
    // 1. Gera Faturas (Contas a Receber)
    for(let i=0; i<parcelas; i++) {
        let v = new Date(); v.setMonth(v.getMonth() + i);
        batch.set(app.db.collection('financeiro').doc(), { tenantId: app.t_id, tipo: 'receita', desc: `O.S. Fechada: [${app.osParaFaturar.placa}] - ${app.osParaFaturar.cliente}`, valor: valorParcela, parcelaAtual: i+1, totalParcelas: parcelas, metodo: metodo, vencimento: v.toISOString(), status: (i===0 && (metodo==='Pix'||metodo==='Dinheiro')) ? 'pago' : 'pendente' });
    }

    // 2. Baixa Físico Real de Peças (NF)
    if(app.osParaFaturar.pecas && !app.osParaFaturar.baixaEstoqueFeita) {
        for (const p of app.osParaFaturar.pecas) {
            if (p.idEstoque) {
                const estRef = app.db.collection('estoque').doc(p.idEstoque);
                const estDoc = await estRef.get();
                if(estDoc.exists) batch.update(estRef, { qtd: Math.max(0, estDoc.data().qtd - p.qtd) });
            }
        }
    }

    // 3. Aplica Comissão Direto na Conta do Mecânico que abriu a OS
    let usrComissao = app.user_comissao; if(app.t_role === 'admin') usrComissao = 0;
    const comissaoReais = ((app.osParaFaturar.maoObraTotal||0) * (usrComissao / 100));
    
    let h = app.osParaFaturar.historico || [];
    h.push({ data: new Date().toISOString(), usuario: "Caixa Master", acao: `FATURAMENTO CONCLUÍDO: ${parcelas}x (${metodo}). Estoque Baixado. Comissão Equipe: R$ ${comissaoReais.toFixed(2)}` });
    
    batch.update(app.db.collection('ordens_servico').doc(app.osParaFaturar.id), { status: 'entregue', baixaEstoqueFeita: true, comissaoProcessada: comissaoReais, mecanicoReal: app.osParaFaturar.mecanico || app.user_nome, historico: h, ultimaAtualizacao: new Date().toISOString() });
    
    await batch.commit();
    app.showToast("ENTREGA CONFIRMADA! Pagamentos, Estoque e Comissão Liquidados.", "success");
    bootstrap.Modal.getInstance(document.getElementById('modalFaturamento')).hide();
    
    const modalOS = bootstrap.Modal.getInstance(document.getElementById('modalOS'));
    if(modalOS) modalOS.hide();
};

// =====================================================================
// 9. DRE E GESTÃO FINANCEIRA GLOBAL
// =====================================================================
app.abrirModalFinanceiro = function(tipo) {
    document.getElementById('fin_tipo').value = tipo;
    document.getElementById('fin_titulo').innerHTML = tipo === 'receita' ? '<i class="bi bi-plus-circle text-success me-2"></i> Lançar Receita Avulsa' : '<i class="bi bi-dash-circle text-danger me-2"></i> Lançar Despesa (Contas Pagar)';
    document.getElementById('modalFinContent').className = `modal-content bg-dark border-${tipo === 'receita' ? 'success' : 'danger'}`;
    document.getElementById('btnSalvarFin').className = `btn w-100 py-3 shadow fs-5 fw-bold btn-${tipo === 'receita' ? 'success' : 'danger'}`;
    
    if(tipo === 'receita') { document.getElementById('divParcelas').classList.add('d-none'); document.getElementById('fin_parcelas').value = '1'; } 
    else { document.getElementById('divParcelas').classList.remove('d-none'); }
    
    document.getElementById('fin_data').value = new Date().toISOString().split('T')[0];
    new bootstrap.Modal(document.getElementById('modalFin')).show();
};

app.salvarLancamentoFinanceiro = async function(e) {
    e.preventDefault();
    const tipo = document.getElementById('fin_tipo').value; const desc = document.getElementById('fin_desc').value;
    const valorTotal = parseFloat(document.getElementById('fin_valor').value); const dataInicial = new Date(document.getElementById('fin_data').value);
    const parcelas = parseInt(document.getElementById('fin_parcelas').value); const valorParcela = valorTotal / parcelas;
    
    const batch = app.db.batch();
    for(let i=0; i<parcelas; i++) {
        let v = new Date(dataInicial); v.setMonth(v.getMonth() + i);
        batch.set(app.db.collection('financeiro').doc(), { tenantId: app.t_id, tipo: tipo, desc: desc, valor: valorParcela, parcelaAtual: i+1, totalParcelas: parcelas, metodo: 'Boleto/Pix', vencimento: v.toISOString(), status: tipo==='receita' ? 'pago' : 'pendente' });
    }
    await batch.commit(); app.showToast(`Registros injetados no Caixa/DRE.`, "success");
    bootstrap.Modal.getInstance(document.getElementById('modalFin')).hide(); e.target.reset();
};

app.iniciarEscutaFinanceiro = function() {
    app.db.collection('financeiro').where('tenantId', '==', app.t_id).onSnapshot(snap => {
        app.bancoFin = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        app.renderizarFinanceiroGeral();
    });
};

app.renderizarFinanceiroGeral = function() {
    if(!document.getElementById('tela_financeiro')) return;
    let totRec = 0, totPag = 0;
    const tPagar = document.getElementById('tabelaPagarCorpo'); const tReceber = document.getElementById('tabelaReceberCorpo');
    let hPagar = '', hReceber = '';
    
    app.bancoFin.sort((a,b) => new Date(a.vencimento) - new Date(b.vencimento)).forEach(f => {
        const isR = f.tipo === 'receita';
        if(isR) totRec += f.valor; else totPag += f.valor;
        const cor = isR ? 'text-success' : 'text-danger';
        const st = f.status === 'pago' ? '<span class="badge bg-success px-2 py-1"><i class="bi bi-check2-all"></i> Pago</span>' : '<span class="badge bg-warning text-dark px-2 py-1"><i class="bi bi-hourglass-split"></i> Aberto</span>';
        const btn = f.status === 'pendente' ? `<button class="btn btn-sm btn-outline-${isR?'success':'danger'} shadow-sm fw-bold px-3" onclick="app.db.collection('financeiro').doc('${f.id}').update({status:'pago'})"><i class="bi bi-currency-dollar"></i> Baixar</button>` : '';
        const html = `<tr><td class="text-white-50"><i class="bi bi-calendar-event me-2"></i> ${new Date(f.vencimento).toLocaleDateString('pt-BR')}</td><td class="text-white fw-bold">${f.desc}</td><td><span class="badge bg-dark border border-secondary px-3 py-1 text-white-50">${f.parcelaAtual}/${f.totalParcelas}</span></td><td class="text-white-50 small">${f.metodo || 'Dinheiro'}</td><td class="${cor} fw-bold fs-6">R$ ${f.valor.toFixed(2).replace('.',',')}</td><td>${st}</td><td class="gestao-only">${btn} <button class="btn btn-sm btn-link text-danger admin-only" onclick="app.db.collection('financeiro').doc('${f.id}').delete()"><i class="bi bi-trash"></i></button></td></tr>`;
        if(isR) hReceber += html; else hPagar += html;
    });

    if(tPagar) tPagar.innerHTML = hPagar || '<tr><td colspan="6" class="text-center text-white-50 py-4">Nenhuma conta a pagar aberta.</td></tr>';
    if(tReceber) tReceber.innerHTML = hReceber || '<tr><td colspan="6" class="text-center text-white-50 py-4">Nenhuma fatura a receber.</td></tr>';

    let totCom = 0;
    app.bancoOSCompleto.filter(o=>o.status==='entregue').forEach(o => totCom += (o.comissaoProcessada||0));
    
    document.getElementById('dreReceitas').innerText = `R$ ${totRec.toFixed(2).replace('.',',')}`;
    document.getElementById('dreDespesas').innerText = `R$ ${totPag.toFixed(2).replace('.',',')}`;
    document.getElementById('dreComissoes').innerText = `R$ ${totCom.toFixed(2).replace('.',',')}`;
    document.getElementById('dreLucro').innerText = `R$ ${(totRec - totPag - totCom).toFixed(2).replace('.',',')}`;
};

// =====================================================================
// 10. RECURSOS HUMANOS / EQUIPE (ADICIONADO)
// =====================================================================
app.iniciarEscutaEquipe = function() {
    app.db.collection('funcionarios').where('tenantId', '==', app.t_id).onSnapshot(snap => {
        const tbody = document.getElementById('tabelaEquipe');
        if(snap.empty) { tbody.innerHTML = '<tr><td colspan="5" class="text-center text-white-50 py-5 fs-5"><i class="bi bi-person-x display-4 d-block mb-3 opacity-25"></i> Ninguém na equipe.</td></tr>'; return; }
        tbody.innerHTML = snap.docs.map(doc => {
            const f = doc.data(); 
            const nAcesso = f.role === 'gerente' ? '<span class="badge bg-warning text-dark">Gerente/Vendedor</span>' : '<span class="badge bg-secondary text-white">Mecânico/Produção</span>';
            return `<tr><td class="fw-bold text-white fs-6"><i class="bi bi-person-circle text-success me-2"></i> ${f.nome}</td><td>${nAcesso}</td><td class="text-warning">${f.comissao||0}%</td><td><span class="bg-dark px-3 py-1 rounded text-info">${f.usuario}</span></td><td class="admin-only"><button class="btn btn-sm btn-outline-danger shadow-sm px-3" onclick="app.apagarFuncionario('${doc.id}')"><i class="bi bi-slash-circle me-1"></i> Revogar</button></td></tr>`;
        }).join('');
    });
};

app.salvarFuncionario = async function(e) {
    e.preventDefault();
    await app.db.collection('funcionarios').add({ 
        tenantId: app.t_id, 
        nome: document.getElementById('f_nome').value, 
        role: document.getElementById('f_cargo').value, 
        comissao: parseFloat(document.getElementById('f_comissao').value),
        usuario: document.getElementById('f_user').value, 
        senha: document.getElementById('f_pass').value 
    });
    app.showToast("Acesso corporativo criado.", "success"); 
    e.target.reset(); 
    bootstrap.Modal.getInstance(document.getElementById('modalEquipe')).hide();
};

app.apagarFuncionario = async function(id) { 
    if(confirm("Deseja bloquear permanentemente o acesso deste usuário?")) { 
        await app.db.collection('funcionarios').doc(id).delete(); 
        app.showToast("Acesso destruído.", "success"); 
    } 
};

// =====================================================================
// 11. EXPORTAÇÃO DE PDF
// =====================================================================
app.exportarPDFMenechelli = async function() {
    const btn = document.getElementById('btnGerarPDF'); btn.innerHTML = 'Renderizando...'; btn.disabled = true;
    const placa = document.getElementById('os_placa').value;
    
    try {
        const { jsPDF } = window.jspdf; const doc = new jsPDF('p', 'mm', 'a4'); const pageWidth = doc.internal.pageSize.getWidth(); let y = 15;
        
        doc.setFillColor(30, 41, 59); doc.rect(0, 0, pageWidth, 40, 'F'); doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold"); doc.setFontSize(26); doc.text(app.t_nome.toUpperCase(), pageWidth/2, 22, { align: "center" });
        doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.text(`LAUDO TÉCNICO VEICULAR E ORÇAMENTO`, pageWidth/2, 30, { align: "center" }); 
        y = 50; doc.setTextColor(0, 0, 0);

        doc.setDrawColor(200, 200, 200); doc.rect(15, y, pageWidth-30, 25);
        doc.setFont("helvetica", "bold"); doc.setFontSize(10);
        doc.text(`Cliente / Dono:`, 20, y+8); doc.setFont("helvetica", "normal"); doc.text(document.getElementById('os_cliente').value, 50, y+8);
        doc.setFont("helvetica", "bold"); doc.text(`Contato:`, 130, y+8); doc.setFont("helvetica", "normal"); doc.text(document.getElementById('os_celular').value, 150, y+8);
        doc.setFont("helvetica", "bold"); doc.text(`Identificação (Placa):`, 20, y+18); doc.setFont("helvetica", "normal"); doc.text(placa, 60, y+18);
        doc.setFont("helvetica", "bold"); doc.text(`Veículo:`, 130, y+18); doc.setFont("helvetica", "normal"); doc.text(document.getElementById('os_veiculo').value, 148, y+18); y += 35;
        
        doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.text(`QUEIXA / RECLAMAÇÃO DO CLIENTE`, 15, y); doc.line(15, y+2, pageWidth-15, y+2); y += 10;
        doc.setFont("helvetica", "normal"); doc.setFontSize(10); const txtQ = doc.splitTextToSize(document.getElementById('os_relato_cliente').value || 'Não reportada.', pageWidth - 30); doc.text(txtQ, 15, y); y += (txtQ.length * 6) + 10;
        
        doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.text(`DIAGNÓSTICO TÉCNICO (MECÂNICO)`, 15, y); doc.line(15, y+2, pageWidth-15, y+2); y += 10;
        doc.setFont("helvetica", "normal"); doc.setFontSize(10); const txtL = doc.splitTextToSize(document.getElementById('os_diagnostico').value || 'Inspeção padrão de revisão.', pageWidth - 30); doc.text(txtL, 15, y); y += (txtL.length * 6) + 10;

        let tableBody = [];
        document.querySelectorAll('#listaPecasCorpo tr').forEach(tr => { tableBody.push([tr.querySelector('.peca-desc').value, tr.querySelector('.peca-qtd').value, `R$ ${tr.querySelector('.peca-venda').value}`, `R$ ${tr.querySelector('.peca-total').value}`]); });
        doc.autoTable({ startY: y, head: [['Serviço / Peça de Reposição', 'Qtd', 'Vlr. Unitário', 'Subtotal']], body: tableBody, theme: 'grid', headStyles: { fillColor: [30, 41, 59] }, margin: { left: 15, right: 15 }}); y = doc.lastAutoTable.finalY + 15;

        const areaFotos = document.getElementById('areaFotosExport');
        if (app.fotosOSAtual.length > 0 && areaFotos) {
            if (y > 220) { doc.addPage(); y = 20; }
            doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.text(`EVIDÊNCIAS FOTOGRÁFICAS (LAUDO VISUAL)`, 15, y); doc.line(15, y+2, pageWidth-15, y+2); y += 10;
            const canvas = await html2canvas(areaFotos, { useCORS: true, backgroundColor: "#ffffff", scale: 2 });
            const imgData = canvas.toDataURL('image/jpeg', 1.0); const pdfWidth = pageWidth - 30; const pdfHeight = (doc.getImageProperties(imgData).height * pdfWidth) / doc.getImageProperties(imgData).width;
            if(y + pdfHeight > 270) { doc.addPage(); y = 20; } doc.addImage(imgData, 'JPEG', 15, y, pdfWidth, pdfHeight); y += pdfHeight + 15;
        }

        if (y > 240) { doc.addPage(); y = 20; }
        
        if(app.t_role === 'admin' || app.t_role === 'gerente') {
            doc.setFillColor(240, 240, 240); doc.rect(pageWidth - 85, y, 70, 15, 'F');
            doc.setFont("helvetica", "bold"); doc.setFontSize(12); 
            doc.text(`ORÇAMENTO FINAL:`, pageWidth - 80, y + 10);
            
            const totalOS = document.getElementById('os_total_geral').innerText;
            doc.setTextColor(0, 128, 0); 
            doc.text(totalOS, pageWidth - 35, y + 10);
        }

        doc.save(`OS_Oficina_${placa}_${new Date().getTime()}.pdf`);
        app.showToast("PDF gerado com sucesso!", "success");

    } catch (erro) {
        console.error("Erro na geração do PDF:", erro);
        app.showToast("Erro ao gerar o documento PDF. Verifique o console.", "error");
    } finally {
        btn.innerHTML = '<i class="bi bi-file-earmark-pdf-fill me-2"></i> Exportar PDF';
        btn.disabled = false;
    }
};

// =====================================================================
// 12. MÓDULO DE INTELIGÊNCIA ARTIFICIAL
// =====================================================================
app.iniciarEscutaIA = function() {
    app.db.collection('conhecimento_ia').where('tenantId', '==', app.t_id).onSnapshot(snap => {
        app.bancoIA = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        app.renderizarListaIA();
    });
};

app.renderizarListaIA = function() {
    const div = document.getElementById('listaConhecimentosIA');
    if(!div) return;
    
    if(app.bancoIA.length === 0) {
        div.innerHTML = '<p class="text-white-50 text-center mt-3">A sua I.A. ainda não possui manuais cadastrados.</p>';
        return;
    }
    
    div.innerHTML = app.bancoIA.map(ia => `
        <div class="d-flex justify-content-between align-items-center bg-dark p-3 mb-2 rounded border border-secondary shadow-sm">
            <span class="text-white-50 text-truncate fw-bold" style="max-width: 85%;">${ia.texto}</span>
            <button class="btn btn-sm btn-outline-danger border-0" onclick="app.apagarConhecimentoIA('${ia.id}')"><i class="bi bi-trash-fill"></i></button>
        </div>
    `).join('');
};

app.salvarConhecimentoIA = async function(textoAvulso = null) {
    const textarea = document.getElementById('iaConhecimentoTexto');
    const valor = textoAvulso || (textarea ? textarea.value.trim() : '');
    
    if(!valor) {
        app.showToast("O conhecimento não pode estar vazio.", "warning");
        return;
    }
    
    await app.db.collection('conhecimento_ia').add({ tenantId: app.t_id, texto: valor, dataImportacao: new Date().toISOString() });
    app.showToast("Conhecimento gravado! Sua I.A. ficou mais inteligente.", "success");
    
    if(textarea && !textoAvulso) textarea.value = '';
};

app.apagarConhecimentoIA = async function(id) {
    if(confirm("Deseja apagar este conhecimento da I.A.?")) {
        await app.db.collection('conhecimento_ia').doc(id).delete();
        app.showToast("Arquivo removido da memória.", "success");
    }
};

app.processarArquivoParaIA = function(event) {
    const file = event.target.files[0];
    if(!file) return;
    
    const statusLabel = document.getElementById('iaFileStatus');
    if(statusLabel) {
        statusLabel.className = "text-warning fw-bold d-block text-center";
        statusLabel.innerText = "Lendo arquivo e injetando conhecimento...";
    }
    
    const reader = new FileReader();
    reader.onload = async function(e) {
        const text = e.target.result;
        const txtLimpo = text.substring(0, 5000); 
        await app.salvarConhecimentoIA(`[Arquivo Importado: ${file.name}]\n\n${txtLimpo}`);
        
        if(statusLabel) {
            statusLabel.className = "text-success fw-bold d-block text-center";
            statusLabel.innerText = "Arquivo processado e absorvido pela I.A.!";
            setTimeout(() => { statusLabel.innerText = ""; }, 4000);
        }
    };
    reader.readAsText(file); 
};

app.chamarGemini = async function(prompt) {
    if(!app.API_KEY_GEMINI) {
        app.showToast("Chave da API do Google Gemini não encontrada.", "error");
        return "Erro: Google Gemini API Key ausente.";
    }
    
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${app.API_KEY_GEMINI}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        
        const data = await response.json();
        if(data.error) throw new Error(data.error.message);
        
        return data.candidates[0].content.parts[0].text;
    } catch(e) {
        console.error("Erro Gemini:", e);
        return "Falha de conexão com a IA.";
    }
};

app.perguntarJarvis = async function() {
    const input = document.getElementById('jarvisInput');
    const respDiv = document.getElementById('jarvisResposta');
    if(!input || !input.value) return;
    
    if(respDiv) {
        respDiv.classList.remove('d-none');
        respDiv.innerHTML = '<span class="spinner-border text-info spinner-border-sm me-2"></span> t.h.I.A.g.u.i.n.h.o analisando os dados...';
    }
    
    const contexto = app.bancoIA.map(ia => ia.texto).join('\n\n');
    const pergunta = input.value;
    
    const promptMaster = `Você é o assistente virtual automotivo da oficina "${app.t_nome}". Responda a dúvida do usuário de forma clara, técnica e objetiva. 
    Use as regras e manuais abaixo para embasar sua resposta (se a pergunta fugir das regras, use seu conhecimento geral automotivo).
    
    MANUAIS E REGRAS DA OFICINA:
    ${contexto}
    
    PERGUNTA DO OPERADOR:
    ${pergunta}`;
    
    const respostaIlimitada = await app.chamarGemini(promptMaster);
    
    if(respDiv) respDiv.innerHTML = respostaIlimitada.replace(/\n/g, '<br>');
    input.value = '';
};

app.jarvisAnalisarRevisoes = async function() {
    const div = document.getElementById('jarvisCRMInsights');
    if(!div) return;
    
    div.innerHTML = '<span class="spinner-border text-warning spinner-border-sm me-2"></span> Escaneando o Histórico de Veículos...';
    
    const historicoMorto = app.bancoOSCompleto.filter(o => o.status === 'entregue');
    
    if(historicoMorto.length === 0) {
        div.innerHTML = '<span class="text-white-50">Não há registros suficientes para gerar previsões.</span>';
        return;
    }
    
    const dadosParaIA = historicoMorto.map(o => `Data Finalização: ${new Date(o.ultimaAtualizacao).toLocaleDateString('pt-BR')} | Cliente: ${o.cliente} | Veículo: ${o.veiculo} | Placa: ${o.placa} | Serviços Feitos: ${o.pecas ? o.pecas.map(p=>p.desc).join(', ') : 'Serviço Geral'}`).join('\n');
    
    const promptRadar = `Você é o Gestor de Pós-Venda Automotivo. Leia o banco de dados abaixo de ordens de serviço finalizadas da nossa oficina.
    Encontre os 3 melhores clientes para fazermos contato hoje oferecendo revisões preventivas, troca de óleo ou checkup, baseando-se no tempo que já passou ou no tipo de veículo.
    Retorne uma lista formatada em HTML simples (com <ul> e <li>) explicando brevemente por que devemos ligar para cada um.
    
    BANCO DE DADOS:
    ${dadosParaIA}`;
    
    const respostaRadar = await app.chamarGemini(promptRadar);
    
    div.innerHTML = respostaRadar;
};
