window.app = {};

// =====================================================================
// 1. CONFIGURAÇÃO NUVEM E SESSÃO (MULTI-TENANT)
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

// Credenciais dinâmicas
app.CLOUDINARY_CLOUD_NAME = sessionStorage.getItem('t_cloudName') || 'dmuvm1o6m'; 
app.CLOUDINARY_UPLOAD_PRESET = sessionStorage.getItem('t_cloudPreset') || 'evolution'; 
app.t_id = sessionStorage.getItem('t_id');
app.t_nome = sessionStorage.getItem('t_nome');
app.t_role = sessionStorage.getItem('t_role'); 
app.user_nome = sessionStorage.getItem('f_nome');
app.user_comissao_mo = parseFloat(sessionStorage.getItem('f_comissao') || 0); 
app.user_comissao_pecas = parseFloat(sessionStorage.getItem('f_comissao_pecas') || 0);

// CHAVE GEMINI: Busca do localStorage da oficina (cada um usa a sua)
app.minhaGeminiKey = localStorage.getItem(`geminiKey_${app.t_id}`) || null;

if (!app.t_id) window.location.replace('index.html');

// Bancos de Dados Locais na Memória
app.bancoOSCompleto = [];
app.bancoEstoque = [];
app.bancoFin = [];
app.bancoCrm = [];
app.bancoIA = [];
app.bancoMensagens = [];
app.bancoAuditoria = [];
app.bancoEquipe = []; 
app.bancoVales = [];
app.fotosOSAtual = [];
app.historicoOSAtual = [];
app.chatActiveClienteId = null;
app.osParaFaturar = null;

app.filtroFinDataInicio = null;
app.filtroFinDataFim = null;
app.bancoFinFiltrado = [];
// =====================================================================
// MOTOR DE AUDITORIA GLOBAL
// =====================================================================
app.registrarAuditoriaGlobal = async function(modulo, acaoRealizada) {
    try {
        await app.db.collection('lixeira_auditoria').add({
            tenantId: app.t_id,
            apagadoEm: new Date().toISOString(),
            apagadoPor: app.user_nome,
            placaOriginal: modulo,
            motivo: acaoRealizada
        });
    } catch(e) { console.error("Erro auditoria: ", e); }
};

// =====================================================================
// 2. INICIALIZAÇÃO + RESPONSIVIDADE MOBILE
// =====================================================================
document.addEventListener('DOMContentLoaded', () => {
    // Ajuste de responsividade mobile
    app.ajustarResponsividade();
    window.addEventListener('resize', app.ajustarResponsividade);
    
    const lblEmpresa = document.getElementById('lblEmpresa'); 
    if(lblEmpresa) lblEmpresa.innerText = app.t_nome;
    
    const lblUsuario = document.getElementById('lblUsuario'); 
    if(lblUsuario) lblUsuario.innerText = app.user_nome;
    
    const style = document.createElement('style');
    if (app.t_role === 'equipe') {
        style.innerHTML = '.admin-only, .gestao-only { display: none !important; } .mecanico-only { display: flex !important; display: block !important; }';
        const lblCom = document.getElementById('lblComissaoUser');
        if(lblCom) lblCom.innerText = `Mecânico (MO: ${app.user_comissao_mo}% | Pç: ${app.user_comissao_pecas}%)`;
    } else if (app.t_role === 'gerente') {
        style.innerHTML = '.admin-only, .mecanico-only { display: none !important; } .gestao-only { display: block !important; display: inline-block !important; } tr .gestao-only, th.gestao-only, td.gestao-only { display: table-cell !important; }';
        const lblCom = document.getElementById('lblComissaoUser');
        if(lblCom) lblCom.innerText = `Gestor / Vendedor`;
    } else {
        style.innerHTML = '.mecanico-only { display: none !important; } .gestao-only, .admin-only { display: block !important; display: inline-block !important; } tr .gestao-only, th.gestao-only, td.gestao-only { display: table-cell !important; }';
        const lblCom = document.getElementById('lblComissaoUser');
        if(lblCom) lblCom.innerText = `Admin Proprietário`;
    }
    document.head.appendChild(style);

    app.construirMenuLateral();
    const linkInicio = document.querySelector('.nav-sidebar .nav-link');
    if(linkInicio) app.mostrarTela('tela_jarvis', 'thIAguinho Inteligência Automotiva', linkInicio);
        app.iniciarEscutaOS();
    app.iniciarEscutaCrm();
    app.iniciarEscutaMensagens();
    app.iniciarEscutaMensagensInternas();
    app.iniciarEscutaEquipeInternaParaBox(); 
    app.iniciarEscutaIA();
    
    if(app.t_role === 'admin' || app.t_role === 'gerente') {
        app.iniciarEscutaEstoque();
        app.iniciarEscutaFinanceiro();
        app.iniciarEscutaValesRH();
    }
    if(app.t_role === 'admin') {
        app.iniciarEscutaLixeira();
    }
    app.configurarCloudinary();

    // Configuração da chave Gemini na UI (se for admin)
    if(app.t_role === 'admin') {
        app.renderizarConfigGemini();
    }

    const selectCategoria = document.getElementById('fin_categoria');
    if (selectCategoria) {
        selectCategoria.addEventListener('change', (e) => {
            const divVinculo = document.getElementById('div_vinculo_rh');
            if (['COMISSAO', 'SALARIO', 'VALE', 'PROLABORE'].includes(e.target.value)) {
                if(divVinculo) divVinculo.style.display = 'block';
                const el = document.getElementById('fin_vinculo_rh');
                if(el) el.setAttribute('required', 'required');
            } else {
                if(divVinculo) divVinculo.style.display = 'none';
                const el = document.getElementById('fin_vinculo_rh');
                if(el) {
                    el.removeAttribute('required');
                    el.value = '';
                }
            }
        });
    }
});

// =====================================================================
// RESPONSIVIDADE MOBILE
// =====================================================================
app.ajustarResponsividade = function() {
    const isMobile = window.innerWidth < 768;
    const sidebar = document.getElementById('sidebar');
    
    if (isMobile && sidebar) {        sidebar.classList.add('collapsed');
    }
    
    // Ajusta tabelas para scroll horizontal no mobile
    document.querySelectorAll('.table-responsive').forEach(el => {
        if (isMobile) {
            el.style.overflowX = 'auto';
            el.style.webkitOverflowScrolling = 'touch';
        }
    });
    
    // Ajusta tamanho de fontes e botões no mobile
    if (isMobile) {
        document.body.classList.add('mobile-view');
    } else {
        document.body.classList.remove('mobile-view');
    }
};

// =====================================================================
// CONFIGURAÇÃO GEMINI NA UI (PARA O GESTOR DA OFICINA)
// =====================================================================
app.renderizarConfigGemini = function() {
    // Adiciona botão de configuração da IA no menu Jarvis se não existir
    const telaJarvis = document.getElementById('tela_jarvis');
    if (!telaJarvis) return;
    
    // Verifica se já existe a seção de configuração
    if (document.getElementById('configGeminiSection')) return;
    
    const configSection = document.createElement('div');
    configSection.id = 'configGeminiSection';
    configSection.className = 'mt-4 p-4 bg-dark border border-secondary rounded-3';
    configSection.innerHTML = `
        <h6 class="text-warning fw-bold mb-3"><i class="bi bi-key-fill me-2"></i>Configurar Inteligência Artificial</h6>
        <p class="text-white-50 small mb-3">Insira sua chave API do Google Gemini para ativar o Consultor Técnico.</p>
        <div class="input-group mb-3">
            <input type="password" class="form-control bg-black text-white border-secondary" id="inputGeminiKey" placeholder="Cole sua chave API aqui (AIza...)" value="${app.minhaGeminiKey ? '••••••••••••' : ''}">
            <button class="btn btn-outline-info" type="button" onclick="app.salvarChaveGemini()">💾 Salvar</button>
        </div>
        <small class="text-white-50 d-block">
            <i class="bi bi-info-circle me-1"></i>
            <a href="https://aistudio.google.com/app/apikey" target="_blank" class="text-info text-decoration-none">Obter chave gratuita aqui</a>
        </small>
        <div id="geminiStatus" class="mt-2 small"></div>
    `;
    
    // Insere após o campo de busca do Jarvis
    const jarvisInput = document.getElementById('jarvisInput');
    if (jarvisInput && jarvisInput.closest('.card')) {        jarvisInput.closest('.card').insertAdjacentElement('afterend', configSection);
    }
    
    // Atualiza status
    app.atualizarStatusGemini();
};

app.atualizarStatusGemini = function() {
    const statusEl = document.getElementById('geminiStatus');
    if (!statusEl) return;
    
    if (app.minhaGeminiKey) {
        statusEl.innerHTML = '<span class="text-success"><i class="bi bi-check-circle-fill me-1"></i>IA Ativada ✓</span>';
    } else {
        statusEl.innerHTML = '<span class="text-warning"><i class="bi bi-exclamation-triangle me-1"></i>Chave não configurada</span>';
    }
};

app.salvarChaveGemini = function() {
    const input = document.getElementById('inputGeminiKey');
    const novaChave = input?.value?.trim() || '';
    
    if (!novaChave) {
        // Limpar chave
        localStorage.removeItem(`geminiKey_${app.t_id}`);
        app.minhaGeminiKey = null;
        app.showToast("Chave removida.", "warning");
    } else {
        // Salvar chave
        localStorage.setItem(`geminiKey_${app.t_id}`, novaChave);
        app.minhaGeminiKey = novaChave;
        app.showToast("Chave salva com sucesso!", "success");
    }
    
    app.atualizarStatusGemini();
    if (input) input.value = '';
};

// =====================================================================
// NAVEGAÇÃO
// =====================================================================
app.mostrarTela = function(id, titulo, btn) {
    document.querySelectorAll('.modulo-tela').forEach(t => t.style.display = 'none');
    const tela = document.getElementById(id); 
    if(tela) tela.style.display = 'block';
    
    const hTitulo = document.getElementById('tituloPagina'); 
    if(hTitulo) hTitulo.innerText = titulo;
    
    if(btn) {         document.querySelectorAll('.nav-link').forEach(b => b.classList.remove('active')); 
        btn.classList.add('active'); 
    }
    
    // Fecha sidebar no mobile após navegar
    if (window.innerWidth < 768) {
        const sidebar = document.getElementById('sidebar');
        if (sidebar) sidebar.classList.add('collapsed');
    }
};

app.sair = function() { 
    sessionStorage.clear(); 
    window.location.href = 'index.html'; 
};

// =====================================================================
// MENU LATERAL
// =====================================================================
app.construirMenuLateral = function() {
    const menu = document.getElementById('menuLateral'); 
    if (!menu) return;
    
    let html = `<a class="nav-link active" onclick="app.mostrarTela('tela_jarvis', 'Central thIAguinho', this)"><i class="bi bi-robot"></i> Central thIAguinho (I.A)</a>`;
    html += `<a class="nav-link" onclick="app.mostrarTela('tela_os', 'Pátio Kanban', this)"><i class="bi bi-kanban text-info"></i> Pátio Kanban (O.S)</a>`;
    html += `<a class="nav-link" onclick="app.mostrarTela('tela_arquivo', 'Arquivo Morto', this); app.renderizarTabelaArquivo();"><i class="bi bi-archive text-warning"></i> Arquivo Morto / Entregues</a>`;
    html += `<a class="nav-link" onclick="app.mostrarTela('tela_chat_interno', 'Chat Equipe', this)"><i class="bi bi-headset text-warning"></i> Chat Equipe Interna</a>`;
    
    if (app.t_role === 'admin' || app.t_role === 'gerente') {
        html += `<a class="nav-link" onclick="app.mostrarTela('tela_crm', 'Base CRM', this)"><i class="bi bi-person-vcard text-info"></i> CRM e Clientes</a>`;
        html += `<a class="nav-link" onclick="app.mostrarTela('tela_chat', 'Chat CRM Global', this)"><i class="bi bi-chat-dots-fill text-primary"></i> Chat Global c/ Cliente <span id="chatBadgeGlobal" class="badge bg-danger badge-nav d-none">0</span></a>`;
        html += `<a class="nav-link" onclick="app.mostrarTela('tela_estoque', 'Armazém / Estoque', this)"><i class="bi bi-box-seam text-primary"></i> Estoque Físico e NFs</a>`;
        html += `<a class="nav-link" onclick="app.mostrarTela('tela_financeiro', 'DRE e Caixas', this)"><i class="bi bi-bank text-success"></i> Financeiro / DRE</a>`;
        html += `<a class="nav-link" onclick="app.mostrarTela('tela_equipe', 'Gestão de RH e Equipe', this); app.renderizarEquipeRH();"><i class="bi bi-people-fill text-success"></i> Equipe e RH</a>`;
    }
    if (app.t_role === 'admin') {
        html += `<a class="nav-link" onclick="app.mostrarTela('tela_ia', 'Treinamento I.A.', this)"><i class="bi bi-database-fill-up text-warning"></i> Base RAG / Manuais I.A.</a>`;
    }
    menu.innerHTML = html;
};

// =====================================================================
// TOASTS
// =====================================================================
app.showToast = function(msg, type='success') {
    const bg = type === 'success' ? 'bg-success' : type === 'error' ? 'bg-danger' : 'bg-warning text-dark';
    const icon = type === 'success' ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill';
    
    const wrap = document.createElement('div');
    wrap.innerHTML = `<div class="toast align-items-center text-white ${bg} border-0 show p-3 mt-2 shadow-lg rounded-3" role="alert" aria-live="assertive" aria-atomic="true" style="transition: opacity 0.5s ease; max-width: 90vw;">                        <div class="d-flex">
                            <div class="toast-body fw-bold"><i class="bi ${icon} me-2"></i> ${msg}</div>
                            <button type="button" class="btn-close btn-close-white me-2 m-auto" onclick="this.parentElement.parentElement.remove()"></button>
                        </div>
                      </div>`;
                      
    const toastEl = wrap.firstElementChild;
    const container = document.getElementById('toastContainer');
    if (container) {
        container.appendChild(toastEl);
        setTimeout(() => {
            toastEl.style.opacity = '0';
            setTimeout(() => toastEl.remove(), 500);
        }, 4000);
    }
};

// =====================================================================
// 3. CRM
// =====================================================================
app.buscarCEP = function(cep) {
    cep = cep.replace(/\D/g, ''); 
    if(cep.length !== 8) return;
    
    fetch(`https://viacep.com.br/ws/${cep}/json/`).then(res => res.json()).then(data => {
        if(!data.erro) {
            const elRua = document.getElementById('c_rua');
            const elBairro = document.getElementById('c_bairro');
            const elCidade = document.getElementById('c_cidade');
            if(elRua) elRua.value = data.logradouro;
            if(elBairro) elBairro.value = data.bairro;
            if(elCidade) elCidade.value = data.localidade;
        }
    }).catch(err => console.error("Erro CEP:", err));
};

app.validarDocUI = function(input) {
    if(!input) return;
    const val = input.value.replace(/\D/g, '');
    if(val.length > 0) { 
        input.classList.remove('border-danger'); 
        input.classList.add('border-success'); 
    }
};

app.iniciarEscutaCrm = function() {
    app.db.collection('clientes_base').where('tenantId', '==', app.t_id).onSnapshot(snap => {
        app.bancoCrm = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const tb = document.getElementById('tabelaCrmCorpo');
        if(tb) {            tb.innerHTML = app.bancoCrm.map(c => `<tr><td><strong class="text-white">${c.nome}</strong></td><td>${c.documento||'-'}</td><td>${c.telefone}</td><td class="text-info">${c.usuario || 'S/Acesso'}</td><td class="gestao-only text-end"><button class="btn btn-sm btn-outline-info me-1 border-0 shadow-sm" onclick="app.abrirModalCRM('edit', '${c.id}')"><i class="bi bi-pencil"></i> Editar</button><button class="btn btn-sm btn-outline-danger border-0 admin-only shadow-sm" onclick="app.apagarCliente('${c.id}')"><i class="bi bi-trash"></i></button></td></tr>`).join('');
        }
        const list = document.getElementById('listaClientesCRM');
        if(list) list.innerHTML = app.bancoCrm.map(c => `<option value="${c.nome}" data-id="${c.id}">Tel: ${c.telefone}</option>`).join('');
        app.renderListaChatCRM();
    });
};

app.abrirModalCRM = function(mode = 'nova', id = '') {
    const frm = document.getElementById('formCrm'); 
    if(frm) frm.reset();
    
    const idField = document.getElementById('crm_id');
    if(idField) idField.value = '';
    
    const passField = document.getElementById('c_pass');
    if(passField) passField.value = Math.random().toString(36).slice(-6);
    
    if(mode === 'edit') {
        const c = app.bancoCrm.find(x => x.id === id);
        if(c) {
            ['crm_id','c_nome','c_tel','c_doc','c_email','c_cep','c_rua','c_num','c_bairro','c_cidade','c_user','c_pass','c_notas'].forEach(k => {
                const el = document.getElementById(k);
                if(el) { 
                    let prop = k.replace('c_', ''); 
                    if(k==='crm_id') prop='id'; 
                    if(k==='c_doc') prop='documento'; 
                    if(k==='c_tel') prop='telefone'; 
                    if(k==='c_user') prop='usuario'; 
                    if(k==='c_pass') prop='senha'; 
                    if(k==='c_notas') prop='anotacoes'; 
                    el.value = c[prop] || ''; 
                }
            });
        }
    }
    const modal = document.getElementById('modalCrm'); 
    if(modal) new bootstrap.Modal(modal).show();
};

app.salvarClienteCRM = async function(e) {
    e.preventDefault();
    const idField = document.getElementById('crm_id'); 
    const id = idField ? idField.value : '';
    const docElem = document.getElementById('c_doc'); 
    const docValue = docElem ? docElem.value.replace(/\D/g, '') : '';
    const nomeCli = document.getElementById('c_nome') ? document.getElementById('c_nome').value : '';
    
    const payload = { 
        tenantId: app.t_id,         nome: nomeCli, 
        telefone: document.getElementById('c_tel').value, 
        documento: docValue, 
        email: document.getElementById('c_email').value,
        cep: document.getElementById('c_cep').value, 
        rua: document.getElementById('c_rua').value, 
        num: document.getElementById('c_num').value, 
        bairro: document.getElementById('c_bairro').value, 
        cidade: document.getElementById('c_cidade').value, 
        usuario: document.getElementById('c_user').value.trim(), 
        senha: document.getElementById('c_pass').value.trim(), 
        anotacoes: document.getElementById('c_notas').value 
    };
    
    try {
        if(id) { 
            await app.db.collection('clientes_base').doc(id).update(payload); 
            app.showToast("Ficha do cliente atualizada com sucesso.");
            app.registrarAuditoriaGlobal("CRM", `Editou cliente: ${nomeCli}`);
        } else { 
            await app.db.collection('clientes_base').add(payload); 
            app.showToast("Novo cliente registrado."); 
            app.registrarAuditoriaGlobal("CRM", `Cadastrou cliente: ${nomeCli}`);
        }
    } catch(err) {
        console.error("Erro salvar cliente:", err);
        app.showToast("Erro: " + err.message, "error");
    }
    
    e.target.reset(); 
    const modalInst = bootstrap.Modal.getInstance(document.getElementById('modalCrm'));
    if(modalInst) modalInst.hide();
};

app.apagarCliente = async function(id) {
    if(app.t_role !== 'admin') { 
        app.showToast("Apenas proprietário pode apagar.", "error"); 
        return; 
    }
    if(confirm("Apagar cliente?")) { 
        try {
            const c = app.bancoCrm.find(x => x.id === id);
            await app.db.collection('clientes_base').doc(id).delete(); 
            app.showToast("Cliente Removido.", "success"); 
            app.registrarAuditoriaGlobal("CRM", `Deletou cliente: ${c ? c.nome : id}`);
        } catch(err) {
            console.error("Erro apagar:", err);
            app.showToast("Erro: " + err.message, "error");
        }
    }};

app.aoSelecionarClienteOS = function() {
    const nomeDigitado = document.getElementById('os_cliente').value.trim();
    const cliente = app.bancoCrm.find(c => c.nome.toLowerCase() === nomeDigitado.toLowerCase());
    if(cliente) { 
        const elCel = document.getElementById('os_celular');
        const elId = document.getElementById('os_cliente_id');
        if(elCel) elCel.value = cliente.telefone || ''; 
        if(elId) elId.value = cliente.id; 
    }
};

app.editarClienteRapido = function() {
    const nome = document.getElementById('os_cliente').value.trim();
    const cliente = app.bancoCrm.find(c => c.nome.toLowerCase() === nome.toLowerCase());
    if(cliente) { 
        app.abrirModalCRM('edit', cliente.id); 
    } else { 
        const cNome = document.getElementById('c_nome');
        if(cNome) cNome.value = nome; 
        app.abrirModalCRM('nova'); 
    }
};

app.enviarWhatsAppAprovacao = function() {
    const nome = document.getElementById('os_cliente').value;
    const cel = document.getElementById('os_celular').value;
    const cZ = app.bancoCrm.find(x => x.nome === nome);
    if(!cel) return app.showToast("Celular não informado.", "error");
    
    let baseURL = window.location.origin + window.location.pathname.replace('painel_oficina.html', '');
    const u = baseURL + 'clientes/projeto_oficina.html';
    
    let txt = `Olá ${nome}! A O.S. foi atualizada na *${app.t_nome}*.\nAcesse: ${u}`;
    if(cZ && cZ.usuario) { 
        txt += `\nLogin: ${cZ.usuario}\nPIN: ${cZ.senha}`; 
    }
    
    window.open(`https://wa.me/55${cel.replace(/\D/g, '')}?text=${encodeURIComponent(txt)}`, '_blank');
};

// =====================================================================
// 4. CHAT
// =====================================================================
app.iniciarEscutaMensagens = function() {
    app.db.collection('mensagens').where('tenantId', '==', app.t_id).onSnapshot(snap => {
        app.bancoMensagens = snap.docs.map(d => ({id: d.id, ...d.data()}));
        app.bancoMensagens.sort((a,b) => (a.timestamp?.toMillis()||0) - (b.timestamp?.toMillis()||0));
                let nL = app.bancoMensagens.filter(m => m.sender === 'cliente' && !m.lidaAdmin).length;
        const badge = document.getElementById('chatBadgeGlobal');
        if(badge) { 
            if(nL > 0) { 
                badge.innerText = nL; 
                badge.classList.remove('d-none'); 
            } else { 
                badge.classList.add('d-none'); 
            } 
        }
        
        app.renderListaChatCRM();
        if(app.chatActiveClienteId) {
            const chatNomeEl = document.getElementById('chatNomeCliente');
            if(chatNomeEl) {
                app.abrirChatCRM(app.chatActiveClienteId, chatNomeEl.innerText.replace('Atendimento Ativo: ', ''));
            }
        }
    });
};

app.renderListaChatCRM = function() {
    const lista = document.getElementById('chatListaClientesCRM'); 
    if(!lista) return;
    
    lista.innerHTML = app.bancoCrm.map(c => {
        const naoLidas = app.bancoMensagens.filter(m => m.clienteId === c.id && m.sender === 'cliente' && !m.lidaAdmin).length;
        const bHtml = naoLidas > 0 ? `<span class="badge bg-danger ms-2">${naoLidas}</span>` : '';
        return `<button class="list-group-item list-group-item-action bg-transparent text-white border-secondary py-3 d-flex justify-content-between align-items-center" onclick="app.abrirChatCRM('${c.id}', '${c.nome}')">
            <span><i class="bi bi-person-circle text-primary me-2"></i> ${c.nome}</span>${bHtml}
        </button>`;
    }).join('');
};

app.abrirChatCRM = function(clienteId, nomeCliente) {
    app.chatActiveClienteId = clienteId;
    const chatNomeEl = document.getElementById('chatNomeCliente');
    if(chatNomeEl) {
        chatNomeEl.innerHTML = `<span class="text-white-50">Atendimento Ativo:</span> <b class="text-accent fs-5">${nomeCliente}</b>`;
    }
    
    const chatInputArea = document.getElementById('chatAreaInputGlobal');
    if(chatInputArea) chatInputArea.style.display = 'flex';
    
    const area = document.getElementById('chatAreaMsgGlobal'); 
    if(!area) return;
    area.innerHTML = '';
    
    const mD = app.bancoMensagens.filter(x => x.clienteId === clienteId);
    if(mD.length === 0) {        area.innerHTML = '<div class="text-center text-white-50 mt-5 pt-5"><i class="bi bi-chat-dots display-1 mb-4 opacity-50"></i><p>Inicie o Atendimento.</p></div>';
    } else {
        mD.forEach(x => {
            if(x.sender === 'cliente' && !x.lidaAdmin) { 
                app.db.collection('mensagens').doc(x.id).update({lidaAdmin: true}); 
            }
            const t = x.timestamp ? new Date(x.timestamp.toDate()).toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'}) : 'agora';
            let c = x.text || '';
            
            if(x.fileUrl) {
                if(x.fileType === 'video' || x.fileUrl.includes('.mp4')) {
                    c += `<br><video src="${x.fileUrl}" controls style="max-width:100%; border-radius:8px; margin-top:5px;"></video>`;
                } else if(x.fileType === 'audio' || x.fileUrl.includes('.mp3') || x.fileUrl.includes('.ogg')) {
                    c += `<br><audio src="${x.fileUrl}" controls style="max-width:100%; margin-top:5px;"></audio>`;
                } else if(x.fileUrl.includes('.pdf')) {
                    c += `<br><a href="${x.fileUrl}" target="_blank" class="btn btn-sm btn-dark mt-2"><i class="bi bi-file-pdf text-danger"></i> Abrir PDF</a>`;
                } else {
                    c += `<br><img src="${x.fileUrl}" onclick="window.open('${x.fileUrl}')" style="max-width:100%; border-radius:8px; cursor:pointer; margin-top:5px;">`;
                }
            }
            area.innerHTML += `<div class="message ${x.sender === 'admin' ? 'admin shadow-sm' : 'cliente shadow-sm'}">${c}<small class="d-block text-end mt-1" style="font-size:0.7rem;opacity:0.7;">${t}</small></div>`;
        });
        area.scrollTop = area.scrollHeight;
    }
};

app.enviarMensagemChatGlobal = async function() {
    const input = document.getElementById('inputChatGlobal'); 
    const val = input ? input.value.trim() : '';
    if(!val || !app.chatActiveClienteId) return;
    
    try {
        await app.db.collection('mensagens').add({ 
            tenantId: app.t_id, 
            clienteId: app.chatActiveClienteId, 
            sender: 'admin', 
            text: val, 
            lidaCliente: false, 
            timestamp: firebase.firestore.FieldValue.serverTimestamp() 
        });
        if(input) input.value = '';
    } catch(err) {
        console.error("Erro chat:", err);
        app.showToast("Erro: " + err.message, "error");
    }
};

app.enviarAnexoChatGlobal = async function() {
    const inp = document.getElementById('chatFileInputGlobal');
    if(!inp || !inp.files || inp.files.length === 0 || !app.chatActiveClienteId) return;    
    app.showToast("Upload...", "warning");
    try {
        const fd = new FormData(); 
        fd.append('file', inp.files[0]); 
        fd.append('upload_preset', app.CLOUDINARY_UPLOAD_PRESET);
        
        const res = await fetch(`https://api.cloudinary.com/v1_1/${app.CLOUDINARY_CLOUD_NAME}/auto/upload`, {method:'POST', body:fd});
        const data = await res.json();
        
        if(data.secure_url) {
            await app.db.collection('mensagens').add({ 
                tenantId: app.t_id, 
                clienteId: app.chatActiveClienteId, 
                sender: 'admin', 
                text: "📎 Evidência:", 
                fileUrl: data.secure_url, 
                fileType: data.resource_type, 
                lidaCliente: false, 
                timestamp: firebase.firestore.FieldValue.serverTimestamp() 
            });
            inp.value = ''; 
            app.showToast("Enviado!", "success");
        }
    } catch(e) { 
        console.error(e); 
        app.showToast("Falha: " + e.message, "error"); 
    }
};

app.iniciarEscutaMensagensInternas = function() {
    app.db.collection('chat_interno').where('tenantId', '==', app.t_id).onSnapshot(snap => {
        let msgs = snap.docs.map(d => d.data());
        msgs.sort((a,b) => (a.timestamp?.toMillis()||0) - (b.timestamp?.toMillis()||0));
        const area = document.getElementById('chatAreaMsgInterno');
        if(area) {
            if(msgs.length === 0) {
                area.innerHTML = '<div class="text-center text-white-50 mt-5 pt-5"><i class="bi bi-headset display-1 opacity-25"></i><p>Chat limpo.</p></div>';
            } else {
                area.innerHTML = msgs.map(m => {
                    const t = m.timestamp ? new Date(m.timestamp.toDate()).toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'}) : 'agora';
                    const cssClass = m.usuario === app.user_nome ? 'admin' : 'cliente'; 
                    return `<div class="message ${cssClass} shadow-sm"><strong>${m.usuario}:</strong><br>${m.text||''}<small class="d-block text-end mt-1" style="font-size:0.7rem;opacity:0.7;">${t}</small></div>`;
                }).join('');
                area.scrollTop = area.scrollHeight;
            }
        }
    });
};
app.enviarMensagemInterna = async function() {
    const inp = document.getElementById('inputChatInterno'); 
    if(!inp || !inp.value.trim()) return;
    
    try {
        await app.db.collection('chat_interno').add({ 
            tenantId: app.t_id, 
            usuario: app.user_nome, 
            text: inp.value.trim(), 
            timestamp: firebase.firestore.FieldValue.serverTimestamp() 
        });
        inp.value = '';
    } catch(err) {
        console.error("Erro chat interno:", err);
        app.showToast("Erro: " + err.message, "error");
    }
};

// =====================================================================
// 5. ESTOQUE
// =====================================================================
app.iniciarEscutaEstoque = function() {
    app.db.collection('estoque').where('tenantId', '==', app.t_id).onSnapshot(snap => {
        app.bancoEstoque = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const tbody = document.getElementById('tabelaEstoqueCorpo');
        if(tbody) {
            tbody.innerHTML = app.bancoEstoque.map(p => `<tr><td><small class="text-white-50">${p.fornecedor||'N/A'}</small><br><span class="badge bg-primary">NF: ${p.nf||'S/N'}</span></td><td><span class="text-warning fw-bold font-monospace">${p.sku||'-'}</span></td><td><span class="text-info small">[NCM: ${p.ncm||'-'}]</span></td><td><strong class="text-white">${p.desc}</strong></td><td><span class="badge bg-secondary px-3 py-2 fs-6 shadow-sm">${p.qtd} un</span></td><td class="gestao-only text-danger fw-bold">R$ ${p.custo.toFixed(2)}</td><td class="text-success fw-bold fs-6">R$ ${p.venda.toFixed(2)}</td><td class="gestao-only text-end"><button class="btn btn-sm btn-outline-info shadow-sm me-1" onclick="app.abrirModalNF('edit', '${p.id}')"><i class="bi bi-pencil"></i></button><button class="btn btn-sm btn-outline-danger shadow-sm admin-only" onclick="app.apagarProduto('${p.id}')"><i class="bi bi-trash-fill"></i></button></td></tr>`).join('');
        }
        const sel = document.getElementById('selectProdutoEstoque');
        if(sel) {
            sel.innerHTML = '<option value="">Puxar Peça...</option>' + app.bancoEstoque.filter(p=>p.qtd>0).map(p => `<option value="${p.id}" data-venda="${p.venda}" data-custo="${p.custo}" data-desc="${p.desc}" data-ncm="${p.ncm||'-'}">[Est: ${p.qtd}] - ${p.sku ? '('+p.sku+') ' : ''}${p.desc} (R$ ${p.venda.toFixed(2)})</option>`).join('');
        }
    });
};

app.abrirModalNF = function(mode='nova', id='') {
    const frm = document.getElementById('formNF'); 
    if(frm) frm.reset();
    
    const corpoItens = document.getElementById('corpoItensNF');
    if(corpoItens) corpoItens.innerHTML = '';
    
    const pId = document.getElementById('p_id');
    if(pId) pId.value = '';
    
    const nfData = document.getElementById('nf_data');
    if(nfData) nfData.value = new Date().toISOString().split('T')[0];
    
    if(mode === 'edit') {
        const p = app.bancoEstoque.find(x => x.id === id);        if(p) {
            const pIdField = document.getElementById('p_id');
            if(pIdField) pIdField.value = p.id;
            
            const nfForn = document.getElementById('nf_fornecedor');
            if(nfForn) nfForn.value = p.fornecedor || '';
            
            const nfNum = document.getElementById('nf_numero');
            if(nfNum) nfNum.value = p.nf || '';
            
            const nfDataField = document.getElementById('nf_data');
            if(nfDataField) nfDataField.value = p.dataEntrada ? p.dataEntrada.split('T')[0] : new Date().toISOString().split('T')[0];
            
            app.adicionarLinhaNF(p.desc, p.ncm, p.cfop, p.qtd, p.custo, p.venda, p.sku);
        }
    } else { 
        app.adicionarLinhaNF('', '', '', 1, 0, 0, ''); 
    }
    
    const modal = document.getElementById('modalNF');
    if(modal) new bootstrap.Modal(modal).show();
};

app.processarXML = function(event) {
    const file = event.target.files[0]; 
    if(!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const xmlDoc = new DOMParser().parseFromString(e.target.result, "text/xml");
            const emit = xmlDoc.getElementsByTagName("emit")[0]; 
            if(emit) {
                const nfForn = document.getElementById('nf_fornecedor');
                if(nfForn) nfForn.value = emit.getElementsByTagName("xNome")[0]?.textContent || '';
            }
            
            const ide = xmlDoc.getElementsByTagName("ide")[0]; 
            if(ide) {
                const nfNum = document.getElementById('nf_numero');
                if(nfNum) nfNum.value = ide.getElementsByTagName("nNF")[0]?.textContent || '';
            }
            
            const det = xmlDoc.getElementsByTagName("det");
            const corpoItens = document.getElementById('corpoItensNF');
            if(corpoItens) corpoItens.innerHTML = '';
            
            for(let i=0; i<det.length; i++) {
                const prod = det[i].getElementsByTagName("prod")[0];
                if(prod) {                    const sku = prod.getElementsByTagName("cProd")[0]?.textContent || '';
                    const desc = prod.getElementsByTagName("xProd")[0]?.textContent || ''; 
                    const ncm = prod.getElementsByTagName("NCM")[0]?.textContent || ''; 
                    const cfop = prod.getElementsByTagName("CFOP")[0]?.textContent || '';
                    const qtd = parseFloat(prod.getElementsByTagName("qCom")[0]?.textContent || 0); 
                    const vUnCom = parseFloat(prod.getElementsByTagName("vUnCom")[0]?.textContent || 0);
                    app.adicionarLinhaNF(desc, ncm, cfop, qtd, vUnCom, (vUnCom * 1.8), sku); 
                }
            }
            app.showToast("XML lido!", "success");
        } catch(err) {
            console.error("Erro XML:", err);
            app.showToast("Erro XML: " + err.message, "error");
        }
    };
    reader.readAsText(file);
};

app.adicionarLinhaNF = function(desc='', ncm='', cfop='', qtd=1, custo=0, venda=0, sku='') {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td><input type="text" class="form-control form-control-sm bg-dark text-warning border-secondary p-2 font-monospace it-sku" value="${sku}" placeholder="Cód..."></td>
                    <td><input type="text" class="form-control form-control-sm bg-dark text-white border-secondary p-2 it-desc" value="${desc}" required></td>
                    <td><input type="text" class="form-control form-control-sm bg-dark text-white border-secondary p-2 it-ncm" value="${ncm}"></td>
                    <td><input type="text" class="form-control form-control-sm bg-dark text-white border-secondary p-2 it-cfop" value="${cfop}"></td>
                    <td><input type="number" class="form-control form-control-sm bg-dark text-white border-secondary p-2 it-qtd" value="${qtd}" min="1"></td>
                    <td><input type="number" step="0.01" class="form-control form-control-sm bg-dark text-danger border-secondary p-2 it-custo" value="${custo}"></td>
                    <td><input type="number" step="0.01" class="form-control form-control-sm bg-dark text-success border-secondary p-2 it-venda fw-bold" value="${venda}"></td>
                    <td><button type="button" class="btn btn-sm btn-outline-danger p-0 px-2 mt-1" onclick="this.closest('tr').remove()"><i class="bi bi-trash"></i></button></td>`;
    
    const corpoItens = document.getElementById('corpoItensNF');
    if(corpoItens) corpoItens.appendChild(tr);
};

app.verificarPgtoCompraNF = function() {
    const f = document.getElementById('nf_metodo_pagamento')?.value || ''; 
    const d = document.getElementById('nf_div_parcelas');
    if(d) { 
        if(f.includes('Parcelado') || f.includes('Prazo')) {
            d.style.display = 'block'; 
        } else { 
            d.style.display = 'none'; 
            const parc = document.getElementById('nf_parcelas');
            if(parc) parc.value = "1x"; 
        } 
    }
};

app.salvarEntradaEstoque = async function(e) {
    e.preventDefault();
    const id = document.getElementById('p_id')?.value || '';     const fornecedor = document.getElementById('nf_fornecedor')?.value || ''; 
    const nf = document.getElementById('nf_numero')?.value || ''; 
    const dtBase = document.getElementById('nf_data')?.value || ''; 
    const fp = document.getElementById('nf_metodo_pagamento')?.value || ''; 
    const parc = document.getElementById('nf_parcelas')?.value || ''; 
    const gerarFinanceiro = document.getElementById('nf_gerar_financeiro')?.checked || false;
    
    let totalCustoGlobalNF = 0; 
    const batch = app.db.batch();
    
    try {
        if(id) {
            const tr = document.querySelector('#corpoItensNF tr');
            if(tr) {
                const itDesc = tr.querySelector('.it-desc');
                const itSku = tr.querySelector('.it-sku');
                const itQtd = tr.querySelector('.it-qtd');
                const itCusto = tr.querySelector('.it-custo');
                const itVenda = tr.querySelector('.it-venda');
                const itNcm = tr.querySelector('.it-ncm');
                const itCfop = tr.querySelector('.it-cfop');
                
                batch.update(app.db.collection('estoque').doc(id), { 
                    fornecedor: fornecedor, 
                    nf: nf, 
                    desc: itDesc ? itDesc.value : '', 
                    sku: itSku ? itSku.value.trim() : '', 
                    qtd: itQtd ? parseFloat(itQtd.value) : 0, 
                    custo: itCusto ? parseFloat(itCusto.value) : 0, 
                    venda: itVenda ? parseFloat(itVenda.value) : 0, 
                    ncm: itNcm ? itNcm.value : '', 
                    cfop: itCfop ? itCfop.value : '' 
                });
                app.registrarAuditoriaGlobal("Estoque", `Editou item ${fornecedor}`);
            }
        } else {
            document.querySelectorAll('#corpoItensNF tr').forEach(tr => {
                const itDesc = tr.querySelector('.it-desc');
                const itSku = tr.querySelector('.it-sku');
                const itQtd = tr.querySelector('.it-qtd');
                const itCusto = tr.querySelector('.it-custo');
                const itVenda = tr.querySelector('.it-venda');
                const itNcm = tr.querySelector('.it-ncm');
                const itCfop = tr.querySelector('.it-cfop');
                
                const desc = itDesc ? itDesc.value.trim() : '';
                const sku = itSku ? itSku.value.trim() : '';
                const q = itQtd ? parseFloat(itQtd.value) || 0 : 0;
                const c = itCusto ? parseFloat(itCusto.value) || 0 : 0;
                const v = itVenda ? parseFloat(itVenda.value) || 0 : 0;                
                if(desc !== '' && q > 0) {
                    totalCustoGlobalNF += (q * c);
                    batch.set(app.db.collection('estoque').doc(), { 
                        tenantId: app.t_id, 
                        fornecedor: fornecedor, 
                        nf: nf, 
                        sku: sku, 
                        desc: desc, 
                        qtd: q, 
                        custo: c, 
                        venda: v, 
                        ncm: itNcm ? itNcm.value : '', 
                        cfop: itCfop ? itCfop.value : '', 
                        usuarioEntrada: app.user_nome, 
                        dataEntrada: new Date().toISOString() 
                    });
                }
            });
            
            if(totalCustoGlobalNF === 0) {
                return app.showToast("Nenhum item válido.", "error");
            }

            if(gerarFinanceiro) {
                let nP = 1; 
                if(fp.includes('Parcelado') || fp.includes('Prazo')) { 
                    if(parc.includes('2x')) nP = 2; 
                    else if(parc.includes('3x')) nP = 3; 
                    else if(parc.includes('4x')) nP = 4; 
                    else if(parc.includes('6x')) nP = 6; 
                }
                const vP = totalCustoGlobalNF / nP; 
                const stsPgto = (fp.includes('Boleto') || fp.includes('Pendente') || fp.includes('Parcelado') || fp.includes('Crédito') || fp.includes('Prazo')) ? 'pendente' : 'pago';
                
                for(let i=0; i<nP; i++) { 
                    let dV = new Date(dtBase); 
                    if(nP>1 || stsPgto==='pendente') dV.setDate(dV.getDate() + (i*30)); 
                    
                    let fDoc = { 
                        tenantId: app.t_id, 
                        tipo: 'SAIDA', 
                        categoria: 'OUTROS', 
                        desc: nP>1 ? `NF Compra: ${nf} (${fornecedor}) - Parc ${i+1}/${nP}` : `NF Compra: ${nf} (${fornecedor})`, 
                        valor: vP, 
                        parcelaAtual: i+1, 
                        totalParcelas: nP, 
                        metodo: fp, 
                        vencimento: dV.toISOString().split('T')[0], 
                        status: stsPgto,                        pessoaId: null, 
                        pessoaNome: fornecedor, 
                        origem: "MANUAL", 
                         new Date().toISOString()
                    };
                    batch.set(app.db.collection('financeiro').doc(), fDoc); 
                }
            }
            app.registrarAuditoriaGlobal("Estoque/DRE", `Entrada NF ${fornecedor}, R$ ${totalCustoGlobalNF.toFixed(2)}`);
        }

        await batch.commit(); 
        app.showToast("Estoque Atualizado!", "success"); 
        e.target.reset(); 
        
        const modalInst = bootstrap.Modal.getInstance(document.getElementById('modalNF'));
        if(modalInst) modalInst.hide();
        
    } catch(err) {
        console.error("Erro estoque:", err);
        app.showToast("Erro: " + err.message, "error");
    }
};

app.apagarProduto = async function(id) {
    if(app.t_role !== 'admin') {
        return app.showToast("Apenas Master.", "error");
    }
    if(confirm("Excluir?")) { 
        try {
            await app.db.collection('estoque').doc(id).delete(); 
            app.registrarAuditoriaGlobal("Estoque", `Deletou produto ${id}`); 
            app.showToast("Excluído.", "success"); 
        } catch(err) {
            console.error("Erro:", err);
            app.showToast("Erro: " + err.message, "error");
        }
    }
};

// =====================================================================
// 6. KANBAN OS
// =====================================================================
app.iniciarEscutaOS = function() {
    app.db.collection('ordens_servico').where('tenantId', '==', app.t_id).onSnapshot(snap => {
        app.bancoOSCompleto = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        if(app.t_role === 'equipe') {
            let minhaCom = 0; 
            app.bancoOSCompleto.filter(o => o.status === 'entregue' && o.comissoesDetalhadas && Array.isArray(o.comissoesDetalhadas)).forEach(o => {                const minhaParte = o.comissoesDetalhadas.find(c => c.nome === app.user_nome);
                if(minhaParte) minhaCom += minhaParte.valor;
            });
            let meusVales = 0;
            if(app.bancoVales) { 
                app.bancoVales.filter(v => v.nomeFuncionario === app.user_nome).forEach(v => meusVales += v.valor); 
            }
            
            const divKpi = document.getElementById('kpiMinhaComissao'); 
            if(divKpi) divKpi.innerText = `R$ ${(minhaCom - meusVales).toFixed(2).replace('.',',')}`;
        }
        
        app.renderizarKanban(); 
        app.renderizarTabelaArquivo();
        
        if(app.t_role === 'admin' || app.t_role === 'gerente') {
            if(document.getElementById('tabelaEquipe')) app.renderizarEquipeRH();
        }
    });
};

app.filtrarGlobal = function() { 
    app.renderizarKanban(); 
    app.renderizarTabelaArquivo(); 
};

app.renderizarKanban = function() {
    const buscaEl = document.getElementById('buscaGeral');
    const t = buscaEl?.value.toLowerCase().trim() || '';
    
    let ativos = app.bancoOSCompleto.filter(os => os.status !== 'entregue');
    if(t) {
        ativos = ativos.filter(os => 
            (os.placa && os.placa.toLowerCase().includes(t)) || 
            (os.cliente && os.cliente.toLowerCase().includes(t)) || 
            (os.veiculo && os.veiculo.toLowerCase().includes(t))
        );
    }

    const cols = { patio: '', orcamento: '', aprovacao: '', box: '', pronto: '' }; 
    let counts = { patio: 0, orcamento: 0, aprovacao: 0, box: 0, pronto: 0 }; 
    const ordem = ['patio', 'orcamento', 'aprovacao', 'box', 'pronto'];

    ativos.forEach(os => {
        const s = os.status || 'patio'; 
        counts[s]++;
        
        let cor = s === 'pronto' ? 'border-success' : 
                  s === 'aprovacao' ? 'border-warning' : 
                  s === 'box' ? 'border-info' :                   s === 'orcamento' ? 'border-primary' : 'border-secondary';
                  
        const idx = ordem.indexOf(s); 
        const nextS = idx < ordem.length-1 ? ordem[idx+1] : null; 
        const prevS = idx > 0 ? ordem[idx-1] : null;
        
        let btnBack = prevS ? `<button class="btn btn-sm btn-dark p-1 px-2 border-secondary shadow-sm me-1" onclick="event.stopPropagation(); app.mudarStatusRapido('${os.id}', '${prevS}')"><i class="bi bi-arrow-left-circle text-white-50"></i></button>` : '';
        
        let btnFwd = s === 'pronto' ? 
            `<button class="btn btn-sm btn-success p-1 px-3 shadow fw-bold gestao-only" onclick="event.stopPropagation(); app.abrirFaturamentoDireto('${os.id}')"><i class="bi bi-cash-coin me-1"></i> FATURAR</button>` : 
            `<button class="btn btn-sm btn-dark p-1 px-2 border-secondary shadow-sm" onclick="event.stopPropagation(); app.mudarStatusRapido('${os.id}', '${nextS}')"><i class="bi bi-arrow-right-circle text-info"></i></button>`;
        
        let tagsBox = '';
        if (s === 'box' || s === 'pronto') { 
            tagsBox = `<div class="mt-2 d-flex gap-1 flex-wrap"><span class="badge bg-dark border border-info text-info"><i class="bi bi-people"></i> ${os.mecanicoAtribuido || 'S/ Eqp'}</span><span class="badge bg-dark border border-warning text-warning"><i class="bi bi-geo-alt"></i> ${os.boxAtribuido || 'Box ?'}</span></div>`; 
        }
        
        cols[s] += `<div class="os-card border-start border-4 ${cor}" onclick="app.abrirModalOS('edit', '${os.id}')"><div class="fast-actions">${btnBack}${btnFwd}</div><div class="d-flex justify-content-between mb-2"><span class="badge bg-dark border border-secondary text-white py-2 px-3 fw-bold tracking-wide">${os.placa||''}</span></div><h6 class="text-white fw-bold mb-1 w-75 text-truncate">${os.veiculo||''}</h6><small class="text-white-50"><i class="bi bi-person-fill"></i> ${os.cliente||''}</small>${tagsBox}</div>`;
    });
    
    ordem.forEach(id => { 
        const col = document.getElementById('col_'+id); 
        const cnt = document.getElementById('count_'+id); 
        if(col) col.innerHTML = cols[id]; 
        if(cnt) cnt.innerText = counts[id]; 
    });
};

app.mudarStatusRapido = async function(id, novoStatus) {
    if (novoStatus === 'box') return app.iniciarAtribuicaoBox(id);
    
    try {
        const osRef = app.db.collection('ordens_servico').doc(id); 
        const doc = await osRef.get(); 
        let h = doc.data().historico || [];
        h.push({ data: new Date().toISOString(), usuario: app.user_nome, acao: `Moveu para: ${novoStatus.toUpperCase()}` });
        await osRef.update({ status: novoStatus, historico: h, ultimaAtualizacao: new Date().toISOString() });
        if (novoStatus === 'pronto') app.abrirModalNotificacaoWhatsApp(id, 'pronto');
    } catch(err) {
        console.error("Erro status:", err);
        app.showToast("Erro: " + err.message, "error");
    }
};

app.iniciarAtribuicaoBox = function(id) {
    const atribOsId = document.getElementById('atrib_os_id');
    if(atribOsId) atribOsId.value = id; 
    
    const listContainer = document.getElementById('atrib_mecanicos_list');
    if (listContainer) {        let html = ''; 
        app.bancoEquipe.filter(f => f.role === 'equipe').forEach((f, idx) => { 
            html += `<div class="form-check mb-2"><input class="form-check-input border-secondary" type="checkbox" value="${f.nome}" id="mec_chk_${idx}" name="mec_check"><label class="form-check-label text-white" for="mec_chk_${idx}">${f.nome}</label></div>`; 
        });
        listContainer.innerHTML = html || '<div class="text-white-50 small">Nenhum mecânico.</div>';
    }
    
    const modal = document.getElementById('modalAtribuicaoBox');
    if(modal) new bootstrap.Modal(modal).show();
};

app.confirmarAtribuicaoBox = async function() {
    const id = document.getElementById('atrib_os_id')?.value || ''; 
    const box = document.getElementById('atrib_box')?.value || '';
    const checkboxes = document.querySelectorAll('input[name="mec_check"]:checked');
    
    if (checkboxes.length === 0) {
        return app.showToast("Defina 1 mecânico.", "warning");
    }
    
    let mecanicosArray = []; 
    checkboxes.forEach(c => mecanicosArray.push(c.value)); 
    const mecanicosStr = mecanicosArray.join(' + ');
    
    try {
        const osRef = app.db.collection('ordens_servico').doc(id); 
        const doc = await osRef.get(); 
        let h = doc.data().historico || [];
        h.push({ data: new Date().toISOString(), usuario: app.user_nome, acao: `Aprovado. [${box}] equipe: [${mecanicosStr}]. Status: BOX` });
        await osRef.update({ status: 'box', mecanicoAtribuido: mecanicosStr, boxAtribuido: box, historico: h, ultimaAtualizacao: new Date().toISOString() });
        app.showToast("Para Box!", "success"); 
        
        const modalInst = bootstrap.Modal.getInstance(document.getElementById('modalAtribuicaoBox'));
        if(modalInst) modalInst.hide();
    } catch(err) {
        console.error("Erro atribuição:", err);
        app.showToast("Erro: " + err.message, "error");
    }
};

app.abrirModalNotificacaoWhatsApp = function(id, tipo) {
    const whatsOsId = document.getElementById('whats_os_id');
    const whatsTipoMsg = document.getElementById('whats_tipo_msg');
    
    if(whatsOsId) whatsOsId.value = id; 
    if(whatsTipoMsg) whatsTipoMsg.value = tipo;
    
    const os = app.bancoOSCompleto.find(x => x.id === id);
    if(os) {
        if(tipo === 'pronto') {             const titulo = document.getElementById('whatsTituloModal');
            const texto = document.getElementById('whatsTextoModal');
            if(titulo) titulo.innerText = 'Veículo Pronto!'; 
            if(texto) texto.innerText = `Notificar ${os.cliente||''}?`; 
        }
        const modal = document.getElementById('modalNotificaWhatsApp');
        if(modal) new bootstrap.Modal(modal).show();
    }
};

app.dispararWhatsAppAtivo = function() {
    const id = document.getElementById('whats_os_id')?.value || ''; 
    const tipo = document.getElementById('whats_tipo_msg')?.value || ''; 
    const os = app.bancoOSCompleto.find(x => x.id === id);
    
    if (os && os.celular) {
        let texto = ''; 
        if (tipo === 'pronto') {
            texto = `Olá ${os.cliente||''}! Serviço concluído na *${app.t_nome}*. Aguardamos sua retirada.`;
        }
        window.open(`https://wa.me/55${os.celular.replace(/\D/g, '')}?text=${encodeURIComponent(texto)}`, '_blank');
        
        const h = os.historico || []; 
        h.push({  new Date().toISOString(), usuario: app.user_nome, acao: `WhatsApp CONCLUSÃO.` });
        app.db.collection('ordens_servico').doc(id).update({ historico: h });
    } else { 
        app.showToast("Sem celular.", "error"); 
    }
    
    const modalInst = bootstrap.Modal.getInstance(document.getElementById('modalNotificaWhatsApp'));
    if(modalInst) modalInst.hide();
};

// =====================================================================
// 7. MODAL OS
// =====================================================================
app.verificarStatusLink = function() {
    const a = document.getElementById('alertaLinkCliente'); 
    if(!a) return;
    
    const osStatus = document.getElementById('os_status');
    const osId = document.getElementById('os_id');
    
    if (osStatus?.value === 'aprovacao' && osId?.value) {
        a.classList.remove('d-none'); 
    } else {
        a.classList.add('d-none'); 
    }
};
app.abrirModalOS = function(mode = 'nova', id = '') {
    const formOS = document.getElementById('formOS');
    if(formOS) formOS.reset(); 
    
    const listaPecas = document.getElementById('listaPecasCorpo');
    if(listaPecas) listaPecas.innerHTML = '';
    
    app.fotosOSAtual = []; 
    app.historicoOSAtual = [];
    
    const headerPlaca = document.getElementById('header_placa');
    if(headerPlaca) headerPlaca.innerText = '';
    
    const listaHistorico = document.getElementById('listaHistorico');
    if(listaHistorico) listaHistorico.innerHTML = '';
    
    ['btnFaturar','btnGerarPDF','btnDeletarOS'].forEach(k => {
        const el = document.getElementById(k);
        if(el) el.classList.add('d-none');
    });
    
    ['chk_combustivel', 'chk_arranhado', 'chk_bateria', 'chk_pneus'].forEach(i => { 
        const el = document.getElementById(i);
        if(el) el.checked = false; 
    });

    if (mode === 'edit') {
        const os = app.bancoOSCompleto.find(x => x.id === id);
        if (os) {
            const osId = document.getElementById('os_id');
            const osPlaca = document.getElementById('os_placa');
            const headerPlaca = document.getElementById('header_placa');
            
            if(osId) osId.value = os.id; 
            if(osPlaca) osPlaca.value = os.placa || ''; 
            if(headerPlaca) headerPlaca.innerText = `[${os.placa||''}]`;
            
            ['os_veiculo','os_cliente','os_cliente_cpf','os_celular','os_status','os_relato_cliente','os_diagnostico'].forEach(k => { 
                const el = document.getElementById(k);
                if(el) {
                    const prop = k.replace('os_','');
                    if(prop === 'clienteCpf') el.value = os.clienteCpf || '';
                    else if(prop === 'status') el.value = os.status || 'patio';
                    else el.value = os[prop] || '';
                }
            });
            
            ['chk_combustivel','chk_arranhado','chk_bateria','chk_pneus'].forEach(k => { 
                const el = document.getElementById(k);
                if(os[k] && el) el.checked = true;             });
            
            if (os.fotos) { 
                app.fotosOSAtual = os.fotos; 
                app.renderizarGaleria(); 
            }
            if (os.historico) { 
                app.historicoOSAtual = os.historico; 
                app.renderizarHistorico(); 
            }
            if (os.pecas) { 
                os.pecas.forEach(p => app.adicionarLinhaPeca(p.desc, p.ncm||'', p.qtd, p.custo, p.venda, p.idEstoque, p.isMaoObra)); 
            }
            
            const btnPDF = document.getElementById('btnGerarPDF');
            if(btnPDF) btnPDF.classList.remove('d-none');
            
            if (os.status === 'pronto' && (app.t_role === 'admin' || app.t_role === 'gerente')) {
                const btnFat = document.getElementById('btnFaturar');
                if(btnFat) btnFat.classList.remove('d-none');
            }
            if (app.t_role === 'admin') {
                const btnDel = document.getElementById('btnDeletarOS');
                if(btnDel) btnDel.classList.remove('d-none');
            }
        }
    } else { 
        app.adicionarMaoDeObra(); 
    }
    
    app.verificarStatusLink(); 
    
    const modal = document.getElementById('modalOS');
    if(modal) new bootstrap.Modal(modal).show();
};

app.adicionarDoEstoque = function() {
    const sel = document.getElementById('selectProdutoEstoque'); 
    if(!sel || !sel.value) return; 
    
    const opt = sel.options[sel.selectedIndex];
    app.adicionarLinhaPeca(opt.dataset.desc, opt.dataset.ncm, 1, parseFloat(opt.dataset.custo), parseFloat(opt.dataset.venda), sel.value, false); 
    sel.value = '';
};

app.adicionarMaoDeObra = function() { 
    app.adicionarLinhaPeca("Mão de Obra / Serviço", "-", 1, 0, 0, null, true); 
};

app.adicionarLinhaPeca = function(desc, ncm, qtd, custo, venda, idEstoque, isMaoObra) {    const tr = document.createElement('tr'); 
    const mo = isMaoObra ? `data-maoobra="true"` : ''; 
    const est = idEstoque ? `data-idestoque="${idEstoque}" readonly` : '';
    
    tr.innerHTML = `<td><input type="text" class="form-control form-control-sm bg-dark text-white border-secondary peca-desc p-2" value="${desc}" ${est} ${mo}></td><td><span class="text-white-50 small d-block">NCM: ${ncm||'-'}</span></td><td><input type="number" class="form-control form-control-sm bg-dark text-white border-secondary peca-qtd p-2" value="${qtd}" min="1" onchange="app.calcularTotalOS()"></td><td class="gestao-only"><input type="number" step="0.01" class="form-control form-control-sm bg-dark text-danger border-secondary peca-custo p-2" value="${custo}" onchange="app.calcularTotalOS()"></td><td><input type="number" step="0.01" class="form-control form-control-sm bg-dark text-success border-secondary peca-venda p-2 fw-bold" value="${venda}" onchange="app.calcularTotalOS()"></td><td><input type="text" class="form-control form-control-sm bg-black text-white border-0 peca-total fw-bold p-2" readonly value="${(qtd*venda).toFixed(2)}"></td><td class="text-center" data-html2canvas-ignore><button type="button" class="btn btn-sm btn-outline-danger border-0 mt-1" onclick="this.closest('tr').remove(); app.calcularTotalOS()"><i class="bi bi-trash"></i></button></td>`;
    
    const listaPecas = document.getElementById('listaPecasCorpo');
    if(listaPecas) listaPecas.appendChild(tr); 
    
    app.calcularTotalOS();
};

app.calcularTotalOS = function() {
    let t = 0, tc = 0, tMO = 0, tPecas = 0;
    
    document.querySelectorAll('#listaPecasCorpo tr').forEach(tr => {
        const descInput = tr.querySelector('.peca-desc');
        const isMaoObra = descInput?.dataset.maoobra === "true";
        const q = parseFloat(tr.querySelector('.peca-qtd')?.value || 0) || 0;
        const v = parseFloat(tr.querySelector('.peca-venda')?.value || 0) || 0;
        const c = parseFloat(tr.querySelector('.peca-custo')?.value || 0) || 0;
        
        const totalEl = tr.querySelector('.peca-total');
        if(totalEl) totalEl.value = (q*v).toFixed(2);
        
        t += (q*v); 
        tc += (q*c); 
        if(isMaoObra) tMO += (q*v); 
        else tPecas += (q*v);
    });
    
    const totalEl = document.getElementById('os_total_geral');
    if(totalEl) totalEl.innerText = `R$ ${t.toFixed(2).replace('.',',')}`; 
    
    return { total: t, custo: tc, maoObra: tMO, pecas: tPecas };
};

app.salvarOS = async function() {
    try {
        const id = document.getElementById('os_id')?.value || ''; 
        let pecasArray = []; 
        const metricasTotais = app.calcularTotalOS(); 
        
        const cpfOS = document.getElementById('os_cliente_cpf')?.value || '';
        const clienteOS = (document.getElementById('os_cliente')?.value || '').trim();
        const telOS = (document.getElementById('os_celular')?.value || '').trim();

        let cId = '';
        if(clienteOS && !app.bancoCrm.find(c => c.nome.toLowerCase() === clienteOS.toLowerCase())) {
            const d = await app.db.collection('clientes_base').add({                 tenantId: app.t_id, 
                nome: clienteOS, 
                telefone: telOS, 
                documento: cpfOS, 
                anotacoes: "Criado via O.S." 
            }); 
            cId = d.id;
        } else { 
            const cExist = app.bancoCrm.find(c => c.nome.toLowerCase() === clienteOS.toLowerCase()); 
            if(cExist) cId = cExist.id; 
        }

        document.querySelectorAll('#listaPecasCorpo tr').forEach(tr => {
            const descInput = tr.querySelector('.peca-desc'); 
            const desc = descInput?.value.trim() || '';
            if (desc !== '') { 
                pecasArray.push({ 
                    desc: desc, 
                    qtd: parseFloat(tr.querySelector('.peca-qtd')?.value || 0) || 1, 
                    custo: parseFloat(tr.querySelector('.peca-custo')?.value || 0) || 0, 
                    venda: parseFloat(tr.querySelector('.peca-venda')?.value || 0) || 0, 
                    idEstoque: descInput?.dataset.idestoque || null, 
                    isMaoObra: descInput?.dataset.maoobra === "true" 
                }); 
            }
        });
        
        const osStatus = document.getElementById('os_status');
        const novoStatus = osStatus?.value || 'patio';
        
        if(novoStatus === 'box' && id) { 
            const oldData = app.bancoOSCompleto.find(o => o.id === id); 
            if(oldData && oldData.status !== 'box' && !oldData.mecanicoAtribuido) {
                return app.iniciarAtribuicaoBox(id); 
            }
        }

        app.historicoOSAtual.push({ 
            data: new Date().toISOString(), 
            usuario: app.user_nome, 
            acao: id ? `Editou O.S. Status: ${novoStatus.toUpperCase()}` : "Abriu Ficha." 
        });
        
        const osPlaca = document.getElementById('os_placa');
        const osVeiculo = document.getElementById('os_veiculo');
        const osRelato = document.getElementById('os_relato_cliente');
        const osDiagnostico = document.getElementById('os_diagnostico');
        const chkCombustivel = document.getElementById('chk_combustivel');
        const chkArranhado = document.getElementById('chk_arranhado');
        const chkBateria = document.getElementById('chk_bateria');        const chkPneus = document.getElementById('chk_pneus');
        
        const payload = { 
            tenantId: app.t_id, 
            placa: osPlaca ? osPlaca.value.toUpperCase() : '', 
            veiculo: osVeiculo ? osVeiculo.value : '', 
            cliente: clienteOS, 
            clienteId: cId, 
            celular: telOS, 
            clienteCpf: cpfOS, 
            status: novoStatus, 
            relatoCliente: osRelato ? osRelato.value : '', 
            diagnostico: osDiagnostico ? osDiagnostico.value : '', 
            chk_combustivel: chkCombustivel ? chkCombustivel.checked : false, 
            chk_arranhado: chkArranhado ? chkArranhado.checked : false, 
            chk_bateria: chkBateria ? chkBateria.checked : false, 
            chk_pneus: chkPneus ? chkPneus.checked : false, 
            pecas: pecasArray, 
            total: metricasTotais.total, 
            custoTotal: metricasTotais.custo, 
            maoObraTotal: metricasTotais.maoObra, 
            pecasTotal: metricasTotais.pecas, 
            fotos: app.fotosOSAtual, 
            historico: app.historicoOSAtual, 
            ultimaAtualizacao: new Date().toISOString() 
        };
        
        if (novoStatus === 'entregue') {
            return app.showToast("Use Faturar para baixar estoque.", "warning");
        }
        
        if (id) {
            await app.db.collection('ordens_servico').doc(id).update(payload); 
        } else {
            await app.db.collection('ordens_servico').add(payload); 
        }
        
        app.showToast("Salvo.", "success"); 
        
        const modalInst = bootstrap.Modal.getInstance(document.getElementById('modalOS'));
        if(modalInst) modalInst.hide();
        
    } catch(err) {
        console.error("Erro OS:", err);
        app.showToast("Erro: " + err.message, "error");
    }
};

// =====================================================================
// 8. FATURAMENTO// =====================================================================
app.abrirFaturamentoDireto = function(id) {
    app.osParaFaturar = app.bancoOSCompleto.find(o => o.id === id);
    if(app.osParaFaturar) {
        const fatValorTotal = document.getElementById('fat_valor_total');
        if(fatValorTotal) {
            fatValorTotal.innerText = `R$ ${(app.osParaFaturar.total||0).toFixed(2).replace('.',',')}`;
        }
    }
    const modal = document.getElementById('modalFaturamento');
    if(modal) new bootstrap.Modal(modal).show();
};

app.abrirFaturamentoOS = function() { 
    app.salvarOS(); 
    setTimeout(() => { 
        const id = document.getElementById('os_id')?.value || ''; 
        if(id) app.abrirFaturamentoDireto(id); 
    }, 1000); 
};

app.processarFaturamentoCompleto = async function() {
    if(!app.osParaFaturar) return;
    
    const fatMetodo = document.getElementById('fat_metodo');
    const fatParcelas = document.getElementById('fat_parcelas');
    
    const fp = fatMetodo?.value || '';
    const parcelasText = fatParcelas?.value || '';
    const totalVenda = app.osParaFaturar.total || 0; 
    const batch = app.db.batch();
    
    let nP = 1; 
    if(fp.includes('Boleto') || fp.includes('Cartao') || fp.includes('Parcelado') || fp.includes('Crediario')) {
        nP = parseInt(parcelasText) || 1;
    }
    const vP = totalVenda / nP; 
    const stsPgto = (fp.includes('Boleto') || fp.includes('Crediario')) ? 'pendente' : 'pago';
    const dtBase = new Date().toISOString().split('T')[0];

    try {
        for(let i=0; i<nP; i++) { 
            let dV = new Date(dtBase); 
            if(nP>1 || stsPgto==='pendente') dV.setDate(dV.getDate() + (i*30)); 
            
            let fDocReceita = { 
                tenantId: app.t_id, 
                tipo: 'ENTRADA',
                categoria: 'OUTROS', 
                desc: nP>1 ? `O.S: [${app.osParaFaturar.placa}] - Parc ${i+1}/${nP}` : `O.S: [${app.osParaFaturar.placa}] - ${app.osParaFaturar.cliente}`,                 valor: vP, 
                parcelaAtual: i+1, 
                totalParcelas: nP, 
                metodo: fp, 
                vencimento: dV.toISOString().split('T')[0], 
                status: stsPgto,
                origem: "OS",
                referenciaId: app.osParaFaturar.id,
                pessoaId: app.osParaFaturar.clienteId || null,
                pessoaNome: app.osParaFaturar.cliente || null,
                data: new Date().toISOString()
            };
            batch.set(app.db.collection('financeiro').doc(), fDocReceita); 
        }

        if(app.osParaFaturar.pecas && !app.osParaFaturar.baixaEstoqueFeita) {
            for (const p of app.osParaFaturar.pecas) { 
                if (p.idEstoque) { 
                    const estRef = app.db.collection('estoque').doc(p.idEstoque); 
                    const estDoc = await estRef.get(); 
                    if(estDoc.exists) {
                        batch.update(estRef, { qtd: Math.max(0, estDoc.data().qtd - p.qtd) }); 
                    }
                } 
            }
        }

        let comissoesDetalhadas = []; 
        let somaComissaoGlobal = 0;
        
        if (app.osParaFaturar.mecanicoAtribuido) {
            let mecanicosArray = app.osParaFaturar.mecanicoAtribuido.split('+').map(m => m.trim());
            let qtdeMec = mecanicosArray.length;
            
            mecanicosArray.forEach(nomeMec => {
                let func = app.bancoEquipe.find(f => f.nome === nomeMec);
                if (func) {
                    let valMO = ((app.osParaFaturar.maoObraTotal || 0) / qtdeMec) * (parseFloat(func.comissao || 0) / 100);
                    let valPc = ((app.osParaFaturar.pecasTotal || 0) / qtdeMec) * (parseFloat(func.comissao_pecas || 0) / 100);
                    let totalMec = valMO + valPc;
                    comissoesDetalhadas.push({ nome: func.nome, id: func.id, valor: totalMec });
                    somaComissaoGlobal += totalMec;

                    if(totalMec > 0) {
                        let fDocComissao = {
                            tenantId: app.t_id, 
                            tipo: 'SAIDA', 
                            categoria: 'COMISSAO', 
                            desc: `Comissão O.S: [${app.osParaFaturar.placa}]`,
                            valor: totalMec,                             parcelaAtual: 1, 
                            totalParcelas: 1, 
                            metodo: 'Dinheiro', 
                            vencimento: dtBase, 
                            status: 'pendente', 
                            pessoaId: func.id, 
                            pessoaNome: func.nome, 
                            origem: 'OS', 
                            referenciaId: app.osParaFaturar.id, 
                            data: new Date().toISOString()
                        };
                        batch.set(app.db.collection('financeiro').doc(), fDocComissao);
                    }
                }
            });
        }
        
        let h = app.osParaFaturar.historico || []; 
        h.push({  new Date().toISOString(), usuario: app.user_nome, acao: `FATURAMENTO CONCLUÍDO.` });
        
        batch.update(app.db.collection('ordens_servico').doc(app.osParaFaturar.id), { 
            status: 'entregue', 
            baixaEstoqueFeita: true, 
            comissaoProcessada: somaComissaoGlobal, 
            comissoesDetalhadas: comissoesDetalhadas, 
            historico: h, 
            ultimaAtualizacao: new Date().toISOString() 
        });
        
        await batch.commit(); 
        app.registrarAuditoriaGlobal("Faturamento", `Faturou ${app.osParaFaturar.placa||''}.`);
        app.showToast("CHECKOUT CONCLUÍDO!", "success");
        
        const modalFat = document.getElementById('modalFaturamento');
        if(modalFat) {
            const inst = bootstrap.Modal.getInstance(modalFat);
            if(inst) inst.hide();
        }
        
        const modOS = document.getElementById('modalOS'); 
        if(modOS && modOS.classList.contains('show')) {
            const inst = bootstrap.Modal.getInstance(modOS);
            if(inst) inst.hide();
        }
    } catch(err) {
        console.error("Erro faturamento:", err);
        app.showToast("Erro: " + err.message, "error");
    }
};
// =====================================================================
// 9. FINANCEIRO
// =====================================================================
app.abrirModalFinanceiro = function(mode='nova', tipo='', id='') {
    const formFin = document.getElementById('formFinanceiro');
    if(formFin) formFin.reset();
    
    const finId = document.getElementById('fin_id');
    if(finId) finId.value = '';
    
    app.popularSelectVinculoRH(); 
    
    const divVinculo = document.getElementById('div_vinculo_rh');
    if(divVinculo) divVinculo.style.display = 'none';
    
    const finVinculoRh = document.getElementById('fin_vinculo_rh');
    if(finVinculoRh) finVinculoRh.removeAttribute('required');

    if(mode === 'edit' && !tipo) { 
        const f = app.bancoFin.find(x => x.id === id); 
        if(f) tipo = f.tipo === 'ENTRADA' ? 'receita' : 'despesa'; 
    }
    
    const finTipo = document.getElementById('fin_tipo');
    if(finTipo) finTipo.value = tipo;
    
    const finTitulo = document.getElementById('fin_titulo');
    if(finTitulo) {
        finTitulo.innerHTML = tipo === 'receita' ? '<i class="bi bi-plus-circle text-success me-2"></i> Receita' : '<i class="bi bi-dash-circle text-danger me-2"></i> Despesa';
    }
    
    const finData = document.getElementById('fin_data');
    if(finData) finData.value = new Date().toISOString().split('T')[0];
    
    if(mode === 'edit') {
        const f = app.bancoFin.find(x => x.id === id);
        if(f) {
            const finIdField = document.getElementById('fin_id');
            const finDesc = document.getElementById('fin_desc');
            const finValor = document.getElementById('fin_valor');
            const finDataField = document.getElementById('fin_data');
            const finMetodo = document.getElementById('fin_metodo');
            const finCategoria = document.getElementById('fin_categoria');
            const finVinculo = document.getElementById('fin_vinculo_rh');
            const divStatusEdit = document.getElementById('divStatusEdit');
            const finStatus = document.getElementById('fin_status');
            const divParcelas = document.getElementById('divParcelas');
            
            if(finIdField) finIdField.value = f.id; 
            if(finDesc) finDesc.value = f.desc || '';             if(finValor) finValor.value = f.valor || 0; 
            if(finDataField) finDataField.value = f.vencimento ? f.vencimento.split('T')[0] : ''; 
            if(finMetodo) finMetodo.value = f.metodo || 'Dinheiro'; 
            
            if(finCategoria) { 
                finCategoria.value = f.categoria || 'OUTROS'; 
                finCategoria.dispatchEvent(new Event('change')); 
            }
            if(finVinculo && f.pessoaId) { 
                finVinculo.value = `${f.pessoaId}|${f.pessoaNome}`; 
            }
            if(divStatusEdit) divStatusEdit.style.display = 'block'; 
            if(finStatus) finStatus.value = f.status || 'pendente'; 
            if(divParcelas) divParcelas.style.display = 'none';
        }
    } else { 
        const divStatusEdit = document.getElementById('divStatusEdit');
        const divParcelas = document.getElementById('divParcelas');
        const finParcelas = document.getElementById('fin_parcelas');
        
        if(divStatusEdit) divStatusEdit.style.display = 'none'; 
        if(divParcelas) divParcelas.style.display = 'block'; 
        if(tipo === 'receita' && finParcelas) finParcelas.value = '1'; 
    }
    
    const modal = document.getElementById('modalFin');
    if(modal) new bootstrap.Modal(modal).show();
};

app.verificarPgtoFinManual = function() {
    const f = document.getElementById('fin_metodo')?.value || ''; 
    const d = document.getElementById('divParcelas');
    if(d) { 
        if(f.includes('Parcelado') || f.includes('Boleto')) {
            d.style.display = 'block'; 
        } else { 
            d.style.display = 'none'; 
            const finParcelas = document.getElementById('fin_parcelas');
            if(finParcelas) finParcelas.value = '1'; 
        } 
    }
};

app.salvarLancamentoFinanceiro = async function(e) {
    e.preventDefault();
    try {
        const finId = document.getElementById('fin_id');
        const id = finId ? finId.value : '';
        
        const finTipo = document.getElementById('fin_tipo');        const tipoBruto = finTipo ? finTipo.value : '';
        
        const finDesc = document.getElementById('fin_desc');
        const desc = finDesc ? finDesc.value : '';
        
        const finValor = document.getElementById('fin_valor');
        const valorTotal = finValor ? parseFloat(finValor.value) : 0;
        
        const finData = document.getElementById('fin_data');
        const dataInicial = finData ? new Date(finData.value) : new Date();
        
        const finMetodo = document.getElementById('fin_metodo');
        const fp = finMetodo ? finMetodo.value : '';
        
        const finCategoria = document.getElementById('fin_categoria');
        const categoria = finCategoria ? finCategoria.value : 'OUTROS';
        
        const vinculoField = document.getElementById('fin_vinculo_rh'); 
        const vinculoData = (vinculoField && vinculoField.value) ? vinculoField.value.split('|') : null;

        let pessoaId = vinculoData ? vinculoData[0] : null; 
        let pessoaNome = vinculoData ? vinculoData[1] : null;
        const tipoPadrao = tipoBruto === 'receita' ? 'ENTRADA' : 'SAIDA';

        if(id) {
            const m = prompt("JUSTIFICATIVA:"); 
            if(!m || m.trim() === '') {
                return app.showToast("Justificativa obrigatória.", "error");
            }
            
            const finStatus = document.getElementById('fin_status');
            const sts = finStatus ? finStatus.value : 'pendente';
            
            await app.db.collection('financeiro').doc(id).update({ 
                desc: desc, 
                valor: valorTotal, 
                vencimento: dataInicial.toISOString().split('T')[0], 
                metodo: fp, 
                status: sts, 
                categoria: categoria, 
                pessoaId: pessoaId, 
                pessoaNome: pessoaNome, 
                dataAtualizacao: new Date().toISOString() 
            });
            app.showToast(`Atualizado.`, "success"); 
            app.registrarAuditoriaGlobal("Financeiro", `Editou. Motivo: ${m}`);
        } else {
            const batch = app.db.batch(); 
            let nP = 1; 
            if(fp.includes('Boleto') || fp.includes('Cartão') || fp.includes('Parcelado')) {                const finParcelas = document.getElementById('fin_parcelas');
                nP = finParcelas ? parseInt(finParcelas.value) || 1 : 1;
            }
            const vP = valorTotal / nP; 
            const stsPgto = (fp.includes('Boleto') || fp.includes('Pendente') || fp.includes('Crédito') || fp.includes('Parcelado')) ? 'pendente' : 'pago';

            for(let i=0; i<nP; i++) {
                let v = new Date(dataInicial); 
                if(nP>1 || stsPgto==='pendente') v.setMonth(v.getMonth() + i);
                
                let fDoc = { 
                    tenantId: app.t_id, 
                    tipo: tipoPadrao, 
                    categoria: categoria, 
                    desc: nP>1 ? `${desc} - Parc ${i+1}/${nP}`: desc, 
                    valor: vP, 
                    parcelaAtual: i+1, 
                    totalParcelas: nP, 
                    metodo: fp, 
                    vencimento: v.toISOString().split('T')[0], 
                    status: stsPgto, 
                    pessoaId: pessoaId, 
                    pessoaNome: pessoaNome, 
                    origem: "MANUAL", 
                    referenciaId: null, 
                    data: new Date().toISOString() 
                };
                batch.set(app.db.collection('financeiro').doc(), fDoc);
            }
            
            if (tipoPadrao === 'SAIDA' && (categoria === 'VALE' || categoria === 'SALARIO') && pessoaId) {
                batch.set(app.db.collection('vales_rh').doc(), { 
                    tenantId: app.t_id, 
                    idFuncionario: pessoaId, 
                    nomeFuncionario: pessoaNome, 
                    valor: valorTotal, 
                    motivo: desc, 
                    categoria: categoria, 
                    dataRealizacao: new Date().toISOString(), 
                    responsavel: app.user_nome 
                });
            }
            
            await batch.commit(); 
            app.showToast(`Lançado.`, "success");
        }
        
        const modalInst = bootstrap.Modal.getInstance(document.getElementById('modalFin'));
        if(modalInst) modalInst.hide(); 
                e.target.reset();
    } catch(err) {
        console.error("Erro financeiro:", err);
        app.showToast("Erro: " + err.message, "error");
    }
};

app.iniciarEscutaFinanceiro = function() { 
    app.db.collection('financeiro').where('tenantId', '==', app.t_id).onSnapshot(snap => { 
        app.bancoFin = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })); 
        app.filtrarFinanceiro(true); 
    }); 
};

app.filtrarFinanceiro = function(silent = false) { 
    const filtroInicio = document.getElementById('filtroFinInicio');
    const filtroFim = document.getElementById('filtroFinFim');
    
    app.filtroFinDataInicio = filtroInicio ? filtroInicio.value : null; 
    app.filtroFinDataFim = filtroFim ? filtroFim.value : null;
    
    let base = [...app.bancoFin];
    if(app.filtroFinDataInicio && app.filtroFinDataFim) { 
        const d1 = new Date(app.filtroFinDataInicio); 
        const d2 = new Date(app.filtroFinDataFim); 
        base = base.filter(f => { 
            const dV = new Date(f.vencimento); 
            return dV >= d1 && dV <= d2; 
        }); 
    }
    app.bancoFinFiltrado = base; 
    app.renderizarFinanceiroGeral(); 
    if(!silent) app.showToast("Filtros aplicados.", "success");
};

app.renderizarFinanceiroGeral = function() {
    if(!document.getElementById('tela_financeiro')) return;
    
    let totRec = 0, totPag = 0; 
    let hPagar = '', hReceber = '';
    
    app.bancoFinFiltrado.sort((a,b) => new Date(a.vencimento) - new Date(b.vencimento)).forEach(f => {
        const isR = f.tipo === 'ENTRADA';
        if(isR && f.status === 'pago') totRec += f.valor; 
        if(!isR && f.status === 'pago') totPag += f.valor;
        
        const cor = isR ? 'text-success' : 'text-danger';
        const st = f.status === 'pago' ? '<span class="badge bg-success px-2 py-1"><i class="bi bi-check2-all"></i> Quitado</span>' : '<span class="badge bg-warning text-dark px-2 py-1"><i class="bi bi-hourglass-split"></i> Pendente</span>';
        const rhBadge = f.pessoaNome ? `<br><span class="badge bg-warning text-dark mt-1"><i class="bi bi-person-badge"></i> ${f.pessoaNome} (${f.categoria||''})</span>` : '';
                const dataFmt = f.vencimento ? new Date(f.vencimento).toLocaleDateString('pt-BR') : '';
        
        const html = `<tr><td class="text-white-50 fw-bold"><i class="bi bi-calendar-event me-2"></i> ${dataFmt}</td><td class="text-white fw-bold">${f.desc||''}${rhBadge}</td><td><span class="badge bg-dark border border-secondary px-3 py-1 text-white-50">${f.parcelaAtual||1}/${f.totalParcelas||1}</span></td><td class="text-white-50 small">${f.metodo || 'Dinheiro'}</td><td class="${cor} fw-bold fs-6">R$ ${(f.valor||0).toFixed(2).replace('.',',')}</td><td>${st}</td><td class="gestao-only text-end"><button class="btn btn-sm btn-outline-info shadow-sm me-1" onclick="app.abrirModalFinanceiro('edit', '${f.tipo}', '${f.id}')"><i class="bi bi-pencil"></i></button><button class="btn btn-sm btn-link text-danger admin-only" onclick="app.db.collection('financeiro').doc('${f.id}').delete()"><i class="bi bi-trash"></i></button></td></tr>`;
        if(isR) hReceber += html; 
        else hPagar += html;
    });

    const pagarCorpo = document.getElementById('tabelaPagarCorpo');
    const receberCorpo = document.getElementById('tabelaReceberCorpo');
    
    if(pagarCorpo) pagarCorpo.innerHTML = hPagar || '<tr><td colspan="7" class="text-center text-white-50 py-5">Sem dívidas.</td></tr>';
    if(receberCorpo) receberCorpo.innerHTML = hReceber || '<tr><td colspan="7" class="text-center text-white-50 py-5">Sem faturamento.</td></tr>';
    
    let totCom = 0;
    app.bancoOSCompleto.filter(o=>o.status==='entregue').forEach(o => {
        if(app.filtroFinDataInicio && app.filtroFinDataFim) { 
            const dV = new Date(o.ultimaAtualizacao); 
            const d1 = new Date(app.filtroFinDataInicio); 
            const d2 = new Date(app.filtroFinDataFim); 
            if(dV >= d1 && dV <= d2) totCom += (o.comissaoProcessada||0); 
        } else { 
            totCom += (o.comissaoProcessada||0); 
        }
    });
    
    const dreRec = document.getElementById('dreReceitas');
    const dreDesp = document.getElementById('dreDespesas');
    const dreCom = document.getElementById('dreComissoes');
    const dreLucro = document.getElementById('dreLucro');
    
    if(dreRec) dreRec.innerText = `R$ ${totRec.toFixed(2).replace('.',',')}`; 
    if(dreDesp) dreDesp.innerText = `R$ ${totPag.toFixed(2).replace('.',',')}`; 
    if(dreCom) dreCom.innerText = `R$ ${totCom.toFixed(2).replace('.',',')}`; 
    if(dreLucro) dreLucro.innerText = `R$ ${(totRec - totPag).toFixed(2).replace('.',',')}`;
};

app.exportarRelatorioFinanceiro = function() {
    try {
        const { jsPDF } = window.jspdf; 
        const doc = new jsPDF('p', 'mm', 'a4'); 
        let y = 15;
        
        doc.setFont("helvetica", "bold"); 
        doc.setFontSize(20); 
        doc.text(app.t_nome.toUpperCase(), 105, y, { align: "center" }); 
        y += 10;
        doc.setFontSize(12); 
        doc.text(`DRE`, 105, y, { align: "center" }); 
        y += 20;
                let bR = []; 
        app.bancoFinFiltrado.filter(x=>x.tipo==='ENTRADA').forEach(x => { 
            bR.push([x.vencimento?.split('-').reverse().join('/') || '', x.desc||'', x.metodo||'', `R$ ${(x.valor||0).toFixed(2)}`, (x.status||'').toUpperCase()]); 
        });
        if(bR.length > 0) { 
            doc.autoTable({ startY: y, head: [['Data', 'Referência', 'Modalidade', 'Vlr.', 'Status']], body: bR }); 
            y = doc.lastAutoTable.finalY + 15; 
        }
        
        let bP = []; 
        app.bancoFinFiltrado.filter(x=>x.tipo==='SAIDA').forEach(x => { 
            bP.push([x.vencimento?.split('-').reverse().join('/') || '', x.desc||'', x.metodo||'', `R$ ${(x.valor||0).toFixed(2)}`, (x.status||'').toUpperCase()]); 
        });
        if(bP.length > 0) {
            doc.autoTable({ startY: y, head: [['Data', 'Motivo', 'Modalidade', 'Vlr.', 'Status']], body: bP }); 
        }
        
        doc.save(`DRE_${app.t_nome}.pdf`); 
        app.showToast("PDF Exportado", "success");
    } catch(e) { 
        app.showToast("Erro PDF.", "error"); 
    }
};

// =====================================================================
// 10. EQUIPE E LIXEIRA
// =====================================================================
app.renderizarEquipeRH = function() {
    const tbody = document.getElementById('tabelaEquipe'); 
    if(!tbody) return;
    
    if(app.bancoEquipe.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-white-50 py-5">Sem equipe.</td></tr>';
        return;
    }
    
    tbody.innerHTML = app.bancoEquipe.map(f => {
        const nAcesso = f.role === 'gerente' ? '<span class="badge bg-warning text-dark">Gestão</span>' : '<span class="badge bg-secondary">Mecânico</span>';
        
        let totalCom = 0; 
        app.bancoOSCompleto.filter(o => o.status === 'entregue' && o.comissoesDetalhadas).forEach(o => { 
            let p = o.comissoesDetalhadas.find(c => c.id === f.id); 
            if(p) totalCom += p.valor; 
        });
        
        let totalVales = 0; 
        app.bancoVales.filter(v => v.idFuncionario === f.id).forEach(v => totalVales += v.valor);
        let saldoReal = totalCom - totalVales;
        
        return `<tr><td class="fw-bold text-white fs-6"><i class="bi bi-person-circle text-success me-2"></i> ${f.nome||''}</td><td>${nAcesso}</td><td class="text-warning fw-bold">${f.comissao||0}% / ${f.comissao_pecas||0}%</td><td class="text-info fw-bold fs-5">R$ ${saldoReal.toFixed(2).replace('.',',')}</td><td><span class="bg-dark px-2 rounded text-info">${f.usuario||''}</span></td><td class="admin-only text-end"><button class="btn btn-sm btn-outline-warning px-3 me-2" onclick="app.abrirModalValeRH('${f.id}', '${f.nome||''}')"><i class="bi bi-cash-stack"></i> Vale</button><button class="btn btn-sm btn-outline-danger px-3" onclick="app.apagarFuncionario('${f.id}')"><i class="bi bi-slash-circle"></i></button></td></tr>`;    }).join('');
};

app.abrirModalEquipe = function() { 
    const form = document.getElementById('formEquipe');
    if(form) form.reset(); 
    const modal = document.getElementById('modalEquipe');
    if(modal) new bootstrap.Modal(modal).show(); 
};

app.salvarFuncionario = async function(e) { 
    e.preventDefault(); 
    try { 
        await app.db.collection('funcionarios').add({ 
            tenantId: app.t_id, 
            nome: document.getElementById('f_nome')?.value || '', 
            role: document.getElementById('f_cargo')?.value || '', 
            comissao: parseFloat(document.getElementById('f_comissao_mo')?.value || 0), 
            comissao_pecas: parseFloat(document.getElementById('f_comissao_pecas')?.value || 0), 
            usuario: document.getElementById('f_user')?.value || '', 
            senha: document.getElementById('f_pass')?.value || '' 
        }); 
        app.showToast("Criado.", "success"); 
        e.target.reset(); 
        const modalInst = bootstrap.Modal.getInstance(document.getElementById('modalEquipe'));
        if(modalInst) modalInst.hide(); 
    } catch(err) { 
        console.error("Erro:", err); 
        app.showToast("Erro: " + err.message, "error"); 
    } 
};

app.apagarFuncionario = async function(id) { 
    if(confirm("Bloquear?")) { 
        try { 
            await app.db.collection('funcionarios').doc(id).delete(); 
            app.showToast("Removido.", "success"); 
        } catch(err) { 
            console.error("Erro:", err); 
            app.showToast("Erro: " + err.message, "error"); 
        } 
    } 
};

app.abrirModalValeRH = function(idFunc, nomeFunc) { 
    const valeIdFunc = document.getElementById('vale_id_func');
    const valeNomeFunc = document.getElementById('vale_nome_func');
    const lblNomeValeFunc = document.getElementById('lblNomeValeFunc');
    
    if(valeIdFunc) valeIdFunc.value = idFunc;     if(valeNomeFunc) valeNomeFunc.value = nomeFunc; 
    if(lblNomeValeFunc) lblNomeValeFunc.innerText = nomeFunc; 
    
    const form = document.getElementById('formValeRH');
    if(form) form.reset(); 
    
    const modal = document.getElementById('modalValeRH');
    if(modal) new bootstrap.Modal(modal).show(); 
};

app.confirmarValeRH = async function(e) {
    e.preventDefault(); 
    try { 
        const valeIdFunc = document.getElementById('vale_id_func');
        const idFunc = valeIdFunc ? valeIdFunc.value : '';
        
        const valeNomeFunc = document.getElementById('vale_nome_func');
        const nomeFunc = valeNomeFunc ? valeNomeFunc.value : '';
        
        const valeValor = document.getElementById('vale_valor');
        const valor = valeValor ? parseFloat(valeValor.value) : 0;
        
        const valeMotivo = document.getElementById('vale_motivo');
        const motivo = valeMotivo ? valeMotivo.value : '';
        
        if (valor <= 0) {
            return app.showToast("Valor inválido.", "error");
        }
        
        const batch = app.db.batch(); 
        const dataH = new Date().toISOString();
        
        batch.set(app.db.collection('vales_rh').doc(), { 
            tenantId: app.t_id, 
            idFuncionario: idFunc, 
            nomeFuncionario: nomeFunc, 
            valor: valor, 
            motivo: motivo, 
            categoria: 'VALE', 
            dataRealizacao: dataH, 
            responsavel: app.user_nome 
        });
        
        batch.set(app.db.collection('financeiro').doc(), { 
            tenantId: app.t_id, 
            tipo: 'SAIDA', 
            categoria: 'VALE', 
            desc: `[VALE] ${nomeFunc} - ${motivo}`, 
            valor: valor, 
            parcelaAtual: 1,             totalParcelas: 1, 
            metodo: 'Dinheiro', 
            vencimento: dataH.split('T')[0], 
            status: 'pago', 
            pessoaId: idFunc, 
            pessoaNome: nomeFunc, 
            origem: 'MANUAL', 
            referenciaId: null, 
            data: dataH 
        });
        
        await batch.commit(); 
        app.showToast("Vale lançado.", "success"); 
        
        const modalInst = bootstrap.Modal.getInstance(document.getElementById('modalValeRH'));
        if(modalInst) modalInst.hide(); 
    } catch(err) { 
        console.error("Erro:", err); 
        app.showToast("Erro: " + err.message, "error"); 
    } 
};

app.renderizarTabelaArquivo = function() {
    let entregues = app.bancoOSCompleto.filter(os => os.status === 'entregue').sort((a,b) => new Date(b.ultimaAtualizacao) - new Date(a.ultimaAtualizacao));
    const corpo = document.getElementById('tabelaArquivoCorpo');
    if(corpo) {
        corpo.innerHTML = entregues.map(os => `<tr><td class="text-white-50 small"><i class="bi bi-calendar-check text-success me-2"></i> ${new Date(os.ultimaAtualizacao).toLocaleDateString('pt-BR')}</td><td><span class="badge bg-dark border px-3 py-2">${os.placa||''}</span></td><td class="text-white fw-bold">${os.veiculo||''}</td><td class="text-white-50">${os.cliente||''}</td><td class="gestao-only text-success fw-bold">R$ ${(os.total||0).toFixed(2)}</td><td class="text-center"><button class="btn btn-outline-info shadow-sm fw-bold px-4" onclick="app.abrirModalOS('edit', '${os.id}')"><i class="bi bi-folder-symlink-fill"></i></button></td></tr>`).join('');
    }
};

app.iniciarEscutaLixeira = function() {
    app.db.collection('lixeira_auditoria').where('tenantId', '==', app.t_id).onSnapshot(snap => {
        app.bancoAuditoria = snap.docs.map(d => d.data()); 
        app.bancoAuditoria.sort((a,b) => new Date(b.apagadoEm) - new Date(a.apagadoEm));
        const tb = document.getElementById('tabelaLixeiraCorpo'); 
        if(tb) {
            tb.innerHTML = app.bancoAuditoria.map(l => `<tr><td class="text-white-50 small">${new Date(l.apagadoEm).toLocaleString('pt-BR')}</td><td class="text-white fw-bold">${l.placaOriginal||''}</td><td><i class="bi bi-person-badge text-danger"></i> ${l.apagadoPor||''}</td><td class="text-warning">${l.motivo||''}</td></tr>`).join('');
        }
    });
};

app.apagarOS = async function() {
    if(app.t_role !== 'admin') {
        return app.showToast("Apenas Admin.", "error");
    }
    const m = prompt("JUSTIFICATIVA:"); 
    if(!m || m.trim() === '') {
        return app.showToast("Abortado.", "error");
    }
    const id = document.getElementById('os_id')?.value || '';     const osC = app.bancoOSCompleto.find(x => x.id === id);
    if(osC) { 
        try { 
            await app.registrarAuditoriaGlobal(`OS Cancelada: ${osC.placa||''}`, `Motivo: ${m}`); 
            await app.db.collection('ordens_servico').doc(id).delete(); 
            app.showToast("Lixeira.", "success"); 
        } catch(err) { 
            console.error("Erro:", err); 
            app.showToast("Erro: " + err.message, "error"); 
        } 
    }
    const modalInst = bootstrap.Modal.getInstance(document.getElementById('modalOS'));
    if(modalInst) modalInst.hide();
};

// =====================================================================
// 11. CLOUDINARY E PDF
// =====================================================================
app.configurarCloudinary = function() {
    if (!app.CLOUDINARY_CLOUD_NAME) return;
    try {
        var w = cloudinary.createUploadWidget({ 
            cloudName: app.CLOUDINARY_CLOUD_NAME, 
            uploadPreset: app.CLOUDINARY_UPLOAD_PRESET, 
            sources: ['local', 'camera'], 
            language: 'pt' 
        }, (err, res) => {
            if (!err && res && res.event === "success") { 
                app.fotosOSAtual.push(res.info.secure_url); 
                app.historicoOSAtual.push({ 
                     new Date().toISOString(), 
                    usuario: app.user_nome, 
                    acao: "Foto." 
                }); 
                app.renderizarGaleria(); 
            }
        });
        const btn = document.getElementById("btnUploadCloudinary");
        if(btn) btn.addEventListener("click", () => w.open(), false);
    } catch(e) { 
        console.error("Erro Cloudinary:", e); 
    }
};

app.renderizarGaleria = function() { 
    const galeria = document.getElementById('galeriaFotosOS');
    if(!galeria) return;
    galeria.innerHTML = app.fotosOSAtual.map((url, i) => `<div class="position-relative shadow-sm" style="width: 140px; height: 140px;"><img src="${url}" crossorigin="anonymous" class="img-thumbnail bg-dark border-secondary w-100 h-100 object-fit-cover rounded-3"><button type="button" data-html2canvas-ignore class="btn btn-sm btn-danger position-absolute top-0 end-0 m-2 p-0 px-2 rounded-circle" onclick="app.removerFoto(${i})"><i class="bi bi-x"></i></button></div>`).join(''); 
};
app.removerFoto = function(index) { 
    app.fotosOSAtual.splice(index, 1); 
    app.historicoOSAtual.push({ 
         new Date().toISOString(), 
        usuario: app.user_nome, 
        acao: "Excluiu Foto." 
    }); 
    app.renderizarGaleria(); 
};

app.renderizarHistorico = function() { 
    const hist = document.getElementById('listaHistorico'); 
    if(!hist) return;
    hist.innerHTML = app.historicoOSAtual.length === 0 ? '<p class="text-white-50 px-3">Virgem.</p>' : [...app.historicoOSAtual].sort((a,b) => new Date(b.data) - new Date(a.data)).map(h => `<li class="timeline-item"><div class="timeline-item-header"><strong class="text-white">${h.usuario||''}</strong><span class="text-info small fw-bold">${new Date(h.data).toLocaleString('pt-BR')}</span></div><div class="timeline-item-body text-warning shadow-sm">${h.acao||''}</div></li>`).join(''); 
};

async function carregarImagemBase64(url) { 
    try { 
        const res = await fetch(url); 
        const blob = await res.blob(); 
        return new Promise(resolve => { 
            const r = new FileReader(); 
            r.onloadend = () => resolve(r.result); 
            r.readAsDataURL(blob); 
        });
    } catch(e) { 
        console.error("Erro imagem:", e); 
        return null; 
    } 
}

app.exportarPDFMenechelli = async function() {
    const btn = document.getElementById('btnGerarPDF'); 
    if(btn) { 
        btn.innerHTML = 'Renderizando...'; 
        btn.disabled = true; 
    }
    const osPlaca = document.getElementById('os_placa');
    const placa = osPlaca ? osPlaca.value : '';
    
    try {
        const { jsPDF } = window.jspdf; 
        const doc = new jsPDF('p', 'mm', 'a4'); 
        const w = doc.internal.pageSize.getWidth(); 
        let y = 15;
        
        doc.setFillColor(30, 41, 59); 
        doc.rect(0, 0, w, 40, 'F'); 
        doc.setTextColor(255, 255, 255); 
        doc.setFont("helvetica", "bold");         doc.setFontSize(26); 
        doc.text(app.t_nome.toUpperCase(), w/2, 22, { align: "center" }); 
        doc.setFontSize(10); 
        doc.setFont("helvetica", "normal"); 
        doc.text(`LAUDO`, w/2, 30, { align: "center" }); 
        y = 50; 
        doc.setTextColor(0, 0, 0);
        
        doc.setDrawColor(200, 200, 200); 
        doc.rect(15, y, w-30, 25); 
        doc.setFont("helvetica", "bold"); 
        doc.text(`Cliente:`, 20, y+8); 
        doc.setFont("helvetica", "normal"); 
        
        const osCliente = document.getElementById('os_cliente');
        doc.text(osCliente ? osCliente.value : '', 50, y+8); 
        
        doc.setFont("helvetica", "bold"); 
        doc.text(`Tel:`, 130, y+8); 
        doc.setFont("helvetica", "normal"); 
        
        const osCelular = document.getElementById('os_celular');
        doc.text(osCelular ? osCelular.value : '', 150, y+8); 
        
        doc.setFont("helvetica", "bold"); 
        doc.text(`Placa:`, 20, y+18); 
        doc.setFont("helvetica", "normal"); 
        doc.text(placa, 60, y+18); 
        
        doc.setFont("helvetica", "bold"); 
        doc.text(`Veículo:`, 130, y+18); 
        doc.setFont("helvetica", "normal"); 
        
        const osVeiculo = document.getElementById('os_veiculo');
        doc.text(osVeiculo ? osVeiculo.value : '', 148, y+18); 
        
        y += 35;
        doc.setFont("helvetica", "bold"); 
        doc.setFontSize(12); 
        doc.text(`QUEIXA`, 15, y); 
        doc.line(15, y+2, w-15, y+2); 
        y += 10; 
        doc.setFont("helvetica", "normal"); 
        doc.setFontSize(10); 
        
        const osRelato = document.getElementById('os_relato_cliente');
        const txtQ = doc.splitTextToSize(osRelato ? osRelato.value : '', w - 30); 
        doc.text(txtQ, 15, y); 
        y += (txtQ.length * 6) + 10;
                doc.setFont("helvetica", "bold"); 
        doc.setFontSize(12); 
        doc.text(`DIAGNÓSTICO`, 15, y); 
        doc.line(15, y+2, w-15, y+2); 
        y += 10; 
        doc.setFont("helvetica", "normal"); 
        doc.setFontSize(10); 
        
        const osDiagnostico = document.getElementById('os_diagnostico');
        const txtL = doc.splitTextToSize(osDiagnostico ? osDiagnostico.value : '', w - 30); 
        doc.text(txtL, 15, y); 
        y += (txtL.length * 6) + 10;
        
        let tB = []; 
        document.querySelectorAll('#listaPecasCorpo tr').forEach(tr => { 
            const pecaDesc = tr.querySelector('.peca-desc');
            const pecaQtd = tr.querySelector('.peca-qtd');
            const pecaVenda = tr.querySelector('.peca-venda');
            const pecaTotal = tr.querySelector('.peca-total');
            tB.push([
                pecaDesc ? pecaDesc.value : '', 
                pecaQtd ? pecaQtd.value : '', 
                `R$ ${pecaVenda ? pecaVenda.value : '0'}`, 
                `R$ ${pecaTotal ? pecaTotal.value : '0'}`
            ]); 
        });
        doc.autoTable({ startY: y, head: [['Serviço/Peça', 'Qtd', 'Vlr. Unit', 'Subtotal']], body: tB, theme: 'grid' }); 
        y = doc.lastAutoTable.finalY + 15;
        
        if (app.fotosOSAtual.length > 0) { 
            if (y > 220) { 
                doc.addPage(); 
                y = 20; 
            } 
            doc.setFont("helvetica", "bold"); 
            doc.text(`FOTOS`, 15, y); 
            doc.line(15, y+2, w-15, y+2); 
            y += 10; 
            let iX = 15; 
            let iY = y; 
            for (let i = 0; i < app.fotosOSAtual.length; i++) { 
                const b64 = await carregarImagemBase64(app.fotosOSAtual[i]); 
                if(!b64) continue;
                if (iX + 45 > w - 15) { 
                    iX = 15; 
                    iY += 53; 
                } 
                if (iY + 45 > 280) { 
                    doc.addPage(); 
                    iY = 20;                     iX = 15; 
                } 
                doc.addImage(b64, 'JPEG', iX, iY, 45, 45); 
                iX += 53; 
            } 
            y = iY + 60; 
        }
        doc.save(`OS_${placa}.pdf`); 
        app.showToast("PDF Exportado", "success");
    } catch (e) { 
        console.error("Erro PDF:", e); 
        app.showToast("Erro PDF: " + e.message, "error"); 
    } finally { 
        if(btn) { 
            btn.innerHTML = '<i class="bi bi-file-pdf-fill me-1"></i> Exportar'; 
            btn.disabled = false; 
        } 
    }
};

// =====================================================================
// 12. IA GEMINI - CHAVE NO LOCALSTORAGE DA OFICINA
// =====================================================================
app.iaTrabalhando = false;

// Chamar Gemini usando a chave do localStorage da oficina
app.chamarGemini = async function(promptCompleto) {
    // Usa a chave do localStorage (cada oficina tem a sua)
    const chaveAtual = app.minhaGeminiKey;
    
    if (!chaveAtual) {
        console.error("[IA] Chave não configurada no localStorage");
        app.showToast("Erro IA: Configure sua chave API nas configurações", "error");
        return "Erro: Chave API não configurada. Vá em Central thIAguinho e insira sua chave.";
    }
    
    try {
        const parts = [{ text: promptCompleto }];
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${chaveAtual}`, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ contents: [{ parts }] }) 
        });
        
        const data = await res.json(); 
        
        if (!res.ok || data.error) {
            const msg = data.error ? data.error.message : "Erro API";
            console.error("[IA] Erro:", msg);
            app.showToast("Erro IA: " + msg, "error");            return "Erro: " + msg;
        }
        
        const respostaTexto = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!respostaTexto) {
            console.error("[IA] Resposta vazia");
            app.showToast("Erro IA: Resposta inválida", "error");
            return "Erro: Resposta inválida";
        }
        
        return respostaTexto;
        
    } catch(e) { 
        console.error("[IA] Falha:", e); 
        app.showToast("Erro IA: " + e.message, "error");
        return "Erro: " + e.message; 
    }
};

app.perguntarJarvis = async function() {
    if (app.iaTrabalhando) return;
    const inp = document.getElementById('jarvisInput'); 
    const resDiv = document.getElementById('jarvisResposta');
    if (!inp || !inp.value.trim()) return; 
    
    // Verifica se tem chave configurada
    if(!app.minhaGeminiKey) {
        app.showToast("IA não configurada. Vá em Configurações e insira sua chave Gemini.", "error");
        return;
    }

    app.iaTrabalhando = true; 
    if(resDiv) {
        resDiv.classList.remove('d-none'); 
        resDiv.innerHTML = '<span class="spinner-border text-info spinner-border-sm me-2"></span> Processando...';
    }
    
    try {
        const manuaisPuros = app.bancoIA.map(ia => ia.texto).join('\n').substring(0, 4000);
        const promptUnificado = `Atue como Consultor Técnico da oficina "${app.t_nome}".\n\nMANUAIS:\n${manuaisPuros}\n\nRegra: Se não souber, diga "Não consta".\n\nPERGUNTA: "${inp.value}"`;
        const resposta = await app.chamarGemini(promptUnificado);
        if(resDiv) resDiv.innerHTML = resposta.replace(/\n/g, '<br>'); 
        if(inp) inp.value = '';
    } catch (error) { 
        if(resDiv) resDiv.innerHTML = `<span class="text-danger"><i class="bi bi-exclamation-triangle"></i> Falha: ${error.message}</span>`; 
    } finally { 
        app.iaTrabalhando = false; 
    }
};
app.jarvisAnalisarRevisoes = async function() {
    if(app.iaTrabalhando) return app.showToast("Aguarde.", "warning");
    const div = document.getElementById('jarvisCRMInsights'); 
    if(!div) return;
    
    if(!app.minhaGeminiKey) {
        app.showToast("IA não configurada. Configure sua chave primeiro.", "error");
        return;
    }

    app.iaTrabalhando = true; 
    div.innerHTML = '<span class="spinner-border text-warning spinner-border-sm me-2"></span> Escaneando...';
    
    try {
        const historicoMorto = app.bancoOSCompleto.filter(o => o.status === 'entregue');
        if(historicoMorto.length === 0) { 
            div.innerHTML = '<span class="text-white-50">Sem registros.</span>'; 
            app.iaTrabalhando = false; 
            return; 
        }
        const ctx = { h: historicoMorto.slice(-30).map(o => ({ 
            d: new Date(o.ultimaAtualizacao).toLocaleDateString('pt-BR'), 
            c: o.cliente, 
            p: o.placa 
        })) };
        const promptUnificado = `Atue como Gestor de Remarketing da oficina ${app.t_nome}.\nDADOS:\n${JSON.stringify(ctx)}\n\nTarefa: Indique 3 clientes para revisão. Formato HTML (<ul><li>).`;
        const resposta = await app.chamarGemini(promptUnificado);
        div.innerHTML = resposta;
    } catch (error) { 
        div.innerHTML = `<span class="text-danger">Erro: ${error.message}</span>`; 
    } finally { 
        app.iaTrabalhando = false; 
    }
};

// =====================================================================
// BASE RAG / CONHECIMENTO IA
// =====================================================================
app.iniciarEscutaIA = function() {
    app.db.collection('conhecimento_ia').where('tenantId', '==', app.t_id).onSnapshot(snap => {
        app.bancoIA = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if(app.renderizarListaIA) app.renderizarListaIA();
    });
};

app.renderizarListaIA = function() {
    const div = document.getElementById('listaConhecimentosIA'); 
    if(!div) return;
    div.innerHTML = app.bancoIA.length === 0 ? '<p class="text-white-50">RAG vazio.</p>' : app.bancoIA.map(ia => `<div class="d-flex justify-content-between align-items-center bg-dark p-3 mb-2 border border-secondary rounded"><span class="text-white-50 text-truncate" style="max-width: 85%;">${ia.texto||''}</span><button class="btn btn-sm btn-outline-danger border-0" onclick="app.apagarConhecimentoIA('${ia.id}')"><i class="bi bi-trash-fill"></i></button></div>`).join('');
};
app.salvarConhecimentoIA = async function(textoAvulso = null) {
    const iaTexto = document.getElementById('iaConhecimentoTexto');
    const val = textoAvulso || (iaTexto ? iaTexto.value.trim() : '');
    if(!val) return app.showToast("Vazio.", "warning");
    try {
        await app.db.collection('conhecimento_ia').add({ 
            tenantId: app.t_id, 
            texto: val, 
            dataImportacao: new Date().toISOString() 
        }); 
        app.showToast("Gravado.", "success"); 
        if(!textoAvulso && iaTexto) iaTexto.value = '';
    } catch(err) {
        console.error("[IA] Erro:", err);
        app.showToast("Erro: " + err.message, "error");
    }
};

app.apagarConhecimentoIA = async function(id) { 
    if(confirm("Apagar?")) { 
        try {
            await app.db.collection('conhecimento_ia').doc(id).delete(); 
            app.showToast("Apagada.", "success"); 
        } catch(err) {
            console.error("[IA] Erro:", err);
            app.showToast("Erro: " + err.message, "error");
        }
    } 
};

app.processarArquivoParaIA = function(event) { 
    const file = event.target.files[0]; 
    if(!file) return; 
    const r = new FileReader(); 
    r.onload = async function(e) { 
        try {
            await app.salvarConhecimentoIA(`[ARQUIVO: ${file.name}]\n\n${e.target.result.substring(0, 10000)}`); 
            app.showToast("Concluído!", "success"); 
        } catch(err) {
            console.error("[IA] Erro:", err);
            app.showToast("Erro: " + err.message, "error");
        }
    }; 
    r.readAsText(file); 
};

console.log("🚀 app_oficina.js carregado com sucesso!");