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

// Credenciais dinâmicas instaladas pelo SuperAdmin
app.CLOUDINARY_CLOUD_NAME = sessionStorage.getItem('t_cloudName') || 'dmuvm1o6m'; 
app.CLOUDINARY_UPLOAD_PRESET = sessionStorage.getItem('t_cloudPreset') || 'evolution'; 
app.API_KEY_GEMINI = sessionStorage.getItem('t_gemini');
app.t_id = sessionStorage.getItem('t_id');
app.t_nome = sessionStorage.getItem('t_nome');
app.t_role = sessionStorage.getItem('t_role'); 
app.user_nome = sessionStorage.getItem('f_nome');
app.user_comissao_mo = parseFloat(sessionStorage.getItem('f_comissao') || 0); 
app.user_comissao_pecas = parseFloat(sessionStorage.getItem('f_comissao_pecas') || 0);

if (!app.t_id) window.location.replace('index.html');

// Bancos de Dados Locais na Memória
app.bancoOSCompleto = [];
app.bancoEstoque = [];
app.bancoFin = [];
app.bancoCrm = [];
app.bancoIA = [];
app.bancoMensagens = [];
app.bancoAuditoria = [];
app.bancoEquipeGlobal = []; // Para seleção de mecânico no Box
app.fotosOSAtual = [];
app.historicoOSAtual = [];
app.chatActiveClienteId = null;
app.osParaFaturar = null;
app.osVincularBoxId = null; // ID da OS aguardando vinculação de Box

app.filtroFinDataInicio = null;
app.filtroFinDataFim = null;
app.bancoFinFiltrado = [];

// =====================================================================
// MOTOR DE AUDITORIA GLOBAL (PADRÃO CHEVRON B2B)
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
    } catch(e) { console.error("Erro ao registrar auditoria: ", e); }
};

// =====================================================================
// 2. INICIALIZAÇÃO DA INTERFACE (RBAC) E NAVEGAÇÃO
// =====================================================================
document.addEventListener('DOMContentLoaded', () => {
    const lblEmpresa = document.getElementById('lblEmpresa'); if(lblEmpresa) lblEmpresa.innerText = app.t_nome;
    const lblUsuario = document.getElementById('lblUsuario'); if(lblUsuario) lblUsuario.innerText = app.user_nome;
    
    // Controle de Acesso Dinâmico (RBAC)
    const style = document.createElement('style');
    if (app.t_role === 'equipe') {
        style.innerHTML = '.admin-only, .gestao-only { display: none !important; } .mecanico-only { display: flex !important; }';
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
    if(linkInicio) app.mostrarTela('tela_jarvis', 'Inteligência Automotiva', linkInicio);
    
    app.iniciarEscutaOS();
    app.iniciarEscutaCrm();
    app.iniciarEscutaMensagens();
    app.iniciarEscutaMensagensInternas();
    
    if(app.t_role === 'admin' || app.t_role === 'gerente') {
        app.iniciarEscutaEstoque();
        app.iniciarEscutaFinanceiro();
        app.iniciarEscutaEquipeParaVinculacao(); // Gerente e Admin precisam ver mecânicos para vincular ao Box
    }
    if(app.t_role === 'admin') {
        app.iniciarEscutaEquipe();
        app.iniciarEscutaLixeira();
        app.iniciarEscutaIA();
    }
    app.configurarCloudinary();
});

app.showToast = function(msg, type='success') {
    const bg = type === 'success' ? 'bg-success' : type === 'error' ? 'bg-danger' : 'bg-warning text-dark';
    const icon = type === 'success' ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill';
    const t = document.createElement('div');
    t.innerHTML = `<div class="toast align-items-center text-white ${bg} border-0 show p-3 mt-2 shadow-lg rounded-3"><div class="d-flex"><div class="toast-body fw-bold"><i class="bi ${icon} me-2"></i> ${msg}</div><button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button></div></div>`;
    document.getElementById('toastContainer').appendChild(t.firstChild);
    setTimeout(() => { if(t.firstChild) t.firstChild.remove() }, 5000);
};

app.sair = function() { sessionStorage.clear(); window.location.href = 'index.html'; };

app.construirMenuLateral = function() {
    const menu = document.getElementById('menuLateral'); if (!menu) return;
    let html = `<a class="nav-link active" onclick="app.mostrarTela('tela_jarvis', 'Central J.A.R.V.I.S', this)"><i class="bi bi-robot"></i> Central J.A.R.V.I.S</a>`;
    html += `<a class="nav-link" onclick="app.mostrarTela('tela_os', 'Pátio Kanban', this)"><i class="bi bi-kanban text-info"></i> Pátio Kanban (O.S)</a>`;
    html += `<a class="nav-link" onclick="app.mostrarTela('tela_arquivo', 'Arquivo Morto', this); app.renderizarTabelaArquivo();"><i class="bi bi-archive text-warning"></i> Arquivo Morto / Entregues</a>`;
    html += `<a class="nav-link" onclick="app.mostrarTela('tela_chat_interno', 'Chat Equipe', this)"><i class="bi bi-headset text-warning"></i> Chat Equipe Interna</a>`;
    
    if (app.t_role === 'admin' || app.t_role === 'gerente') {
        html += `<a class="nav-link" onclick="app.mostrarTela('tela_crm', 'Base CRM', this)"><i class="bi bi-person-vcard text-info"></i> CRM e Clientes</a>`;
        html += `<a class="nav-link" onclick="app.mostrarTela('tela_chat', 'Chat CRM Global', this)"><i class="bi bi-chat-dots-fill text-primary"></i> Chat Global c/ Cliente <span id="chatBadgeGlobal" class="badge bg-danger badge-nav d-none">0</span></a>`;
        html += `<a class="nav-link" onclick="app.mostrarTela('tela_estoque', 'Armazém / Estoque', this)"><i class="bi bi-box-seam text-primary"></i> Estoque Físico e NFs</a>`;
        html += `<a class="nav-link" onclick="app.mostrarTela('tela_financeiro', 'DRE e Caixas', this)"><i class="bi bi-bank text-success"></i> Financeiro / DRE</a>`;
    }
    if (app.t_role === 'admin') {
        html += `<a class="nav-link" onclick="app.mostrarTela('tela_ia', 'Treinamento I.A.', this)"><i class="bi bi-database-fill-up text-warning"></i> Base RAG / Manuais I.A.</a>`;
        html += `<a class="nav-link" onclick="app.mostrarTela('tela_equipe', 'Gestão da Equipe', this)"><i class="bi bi-people-fill text-success"></i> Equipe e Acessos</a>`;
    }
    menu.innerHTML = html;
};

app.mostrarTela = function(id, titulo, btn) {
    document.querySelectorAll('.modulo-tela').forEach(t => t.style.display = 'none');
    const tela = document.getElementById(id); if(tela) tela.style.display = 'block';
    const hTitulo = document.getElementById('tituloPagina'); if(hTitulo) hTitulo.innerText = titulo;
    if(btn) { document.querySelectorAll('.nav-link').forEach(b => b.classList.remove('active')); btn.classList.add('active'); }
};

// =====================================================================
// 3. CRM E INTEGRAÇÃO PORTAL DO CLIENTE
// =====================================================================
app.buscarCEP = function(cep) {
    cep = cep.replace(/\D/g, ''); if(cep.length !== 8) return;
    fetch(`https://viacep.com.br/ws/${cep}/json/`).then(res => res.json()).then(data => {
        if(!data.erro) {
            if(document.getElementById('c_rua')) document.getElementById('c_rua').value = data.logradouro;
            if(document.getElementById('c_bairro')) document.getElementById('c_bairro').value = data.bairro;
            if(document.getElementById('c_cidade')) document.getElementById('c_cidade').value = data.localidade;
        }
    });
};

app.validarDocUI = function(input) {
    const val = input.value.replace(/\D/g, '');
    if(val.length > 0) { input.classList.remove('border-danger'); input.classList.add('border-success'); }
};

app.iniciarEscutaCrm = function() {
    app.db.collection('clientes_base').where('tenantId', '==', app.t_id).onSnapshot(snap => {
        app.bancoCrm = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const tb = document.getElementById('tabelaCrmCorpo');
        if(tb) {
            tb.innerHTML = app.bancoCrm.map(c => `<tr><td><strong class="text-white">${c.nome}</strong></td><td>${c.documento||'-'}</td><td>${c.telefone}</td><td class="text-info">${c.usuario || 'S/Acesso'}</td><td class="gestao-only text-end"><button class="btn btn-sm btn-outline-info me-1 border-0 shadow-sm" onclick="app.abrirModalCRM('edit', '${c.id}')"><i class="bi bi-pencil"></i> Editar</button><button class="btn btn-sm btn-outline-danger border-0 admin-only shadow-sm" onclick="app.apagarCliente('${c.id}')"><i class="bi bi-trash"></i></button></td></tr>`).join('');
        }
        const list = document.getElementById('listaClientesCRM');
        if(list) list.innerHTML = app.bancoCrm.map(c => `<option value="${c.nome}" data-id="${c.id}">Tel: ${c.telefone}</option>`).join('');
        app.renderListaChatCRM();
    });
};

app.abrirModalCRM = function(mode = 'nova', id = '') {
    const frm = document.getElementById('formCrm'); if(frm) frm.reset();
    if(document.getElementById('crm_id')) document.getElementById('crm_id').value = '';
    if(document.getElementById('c_pass')) document.getElementById('c_pass').value = Math.random().toString(36).slice(-6);
    
    if(mode === 'edit') {
        const c = app.bancoCrm.find(x => x.id === id);
        if(c) {
            if(document.getElementById('crm_id')) document.getElementById('crm_id').value = c.id; 
            if(document.getElementById('c_nome')) document.getElementById('c_nome').value = c.nome || ''; 
            if(document.getElementById('c_tel')) document.getElementById('c_tel').value = c.telefone || ''; 
            if(document.getElementById('c_doc')) document.getElementById('c_doc').value = c.documento || ''; 
            if(document.getElementById('c_email')) document.getElementById('c_email').value = c.email || '';
            if(document.getElementById('c_cep')) document.getElementById('c_cep').value = c.cep || ''; 
            if(document.getElementById('c_rua')) document.getElementById('c_rua').value = c.rua || '';
            if(document.getElementById('c_num')) document.getElementById('c_num').value = c.num || ''; 
            if(document.getElementById('c_bairro')) document.getElementById('c_bairro').value = c.bairro || '';
            if(document.getElementById('c_cidade')) document.getElementById('c_cidade').value = c.cidade || '';
            if(document.getElementById('c_user')) document.getElementById('c_user').value = c.usuario || ''; 
            if(document.getElementById('c_pass')) document.getElementById('c_pass').value = c.senha || ''; 
            if(document.getElementById('c_notas')) document.getElementById('c_notas').value = c.anotacoes || '';
        }
    }
    const modal = document.getElementById('modalCrm'); if(modal) new bootstrap.Modal(modal).show();
};

app.salvarClienteCRM = async function(e) {
    e.preventDefault();
    const idField = document.getElementById('crm_id'); const id = idField ? idField.value : '';
    const docElem = document.getElementById('c_doc'); const docValue = docElem ? docElem.value.replace(/\D/g, '') : '';
    const nomeCli = document.getElementById('c_nome') ? document.getElementById('c_nome').value : '';
    
    const payload = { 
        tenantId: app.t_id, nome: nomeCli, telefone: document.getElementById('c_tel') ? document.getElementById('c_tel').value : '', 
        documento: docValue, email: document.getElementById('c_email') ? document.getElementById('c_email').value : '',
        cep: document.getElementById('c_cep') ? document.getElementById('c_cep').value : '', rua: document.getElementById('c_rua') ? document.getElementById('c_rua').value : '', 
        num: document.getElementById('c_num') ? document.getElementById('c_num').value : '', bairro: document.getElementById('c_bairro') ? document.getElementById('c_bairro').value : '', 
        cidade: document.getElementById('c_cidade') ? document.getElementById('c_cidade').value : '', usuario: document.getElementById('c_user') ? document.getElementById('c_user').value.trim() : '', 
        senha: document.getElementById('c_pass') ? document.getElementById('c_pass').value.trim() : '', anotacoes: document.getElementById('c_notas') ? document.getElementById('c_notas').value : '' 
    };
    
    if(id) { 
        await app.db.collection('clientes_base').doc(id).update(payload); 
        app.showToast("Ficha do cliente atualizada com sucesso.");
        app.registrarAuditoriaGlobal("CRM Cliente", `Editou os dados do cliente: ${nomeCli}`);
    } else { 
        await app.db.collection('clientes_base').add(payload); 
        app.showToast("Novo cliente registrado no CRM."); 
        app.registrarAuditoriaGlobal("CRM Cliente", `Cadastrou o novo cliente: ${nomeCli}`);
    }
    
    e.target.reset(); const modal = document.getElementById('modalCrm'); if(modal) bootstrap.Modal.getInstance(modal).hide();
};

app.apagarCliente = async function(id) {
    if(app.t_role !== 'admin') { app.showToast("Apenas o proprietário pode apagar clientes.", "error"); return; }
    if(confirm("Apagar cliente? O histórico associado não será apagado, mas o perfil deixará de existir.")) { 
        const c = app.bancoCrm.find(x => x.id === id);
        await app.db.collection('clientes_base').doc(id).delete(); 
        app.showToast("Cliente Removido.", "success"); 
        app.registrarAuditoriaGlobal("CRM Cliente", `Deletou permanentemente o cliente: ${c ? c.nome : id}`);
    }
};

app.aoSelecionarClienteOS = function() {
    const nomeDigitado = document.getElementById('os_cliente').value.trim();
    const cliente = app.bancoCrm.find(c => c.nome.toLowerCase() === nomeDigitado.toLowerCase());
    if(cliente) { 
        if(document.getElementById('os_celular')) document.getElementById('os_celular').value = cliente.telefone || ''; 
        if(document.getElementById('os_cliente_id')) document.getElementById('os_cliente_id').value = cliente.id; 
    }
};

app.editarClienteRapido = function() {
    const nome = document.getElementById('os_cliente').value.trim();
    const cliente = app.bancoCrm.find(c => c.nome.toLowerCase() === nome.toLowerCase());
    if(cliente) { app.abrirModalCRM('edit', cliente.id); } 
    else { if(document.getElementById('c_nome')) document.getElementById('c_nome').value = nome; app.abrirModalCRM('nova'); }
};

app.enviarWhatsAppAprovacao = function() {
    const nome = document.getElementById('os_cliente').value;
    const cel = document.getElementById('os_celular').value;
    const cZ = app.bancoCrm.find(x => x.nome === nome);
    if(!cel) return app.showToast("Celular não informado na O.S.", "error");
    
    let baseURL = window.location.origin + window.location.pathname.replace('painel_oficina.html', '');
    const u = baseURL + 'clientes/projeto_oficina.html';
    
    let txt = `Olá ${nome}! A O.S. do seu veículo foi atualizada na *${app.t_nome}*.\nAcesse o nosso portal oficial para acompanhar as fotos da revisão, verificar o orçamento e aprovar os serviços pelo chat:\n👉 ${u}`;
    if(cZ && cZ.usuario) { txt += `\n\n*Suas Credenciais Seguras:*\nLogin: ${cZ.usuario}\nPIN: ${cZ.senha}`; }
    
    window.open(`https://wa.me/55${cel.replace(/\D/g, '')}?text=${encodeURIComponent(txt)}`, '_blank');
};

// =====================================================================
// NOTIFICAÇÃO AUTOMÁTICA VIA WHATSAPP (MUDANÇA DE STATUS)
// =====================================================================
app.notificarClienteWhatsApp = function(osData, novoStatus) {
    const cel = osData.celular;
    if (!cel || cel.replace(/\D/g,'').length < 10) return; // Sem celular, não notifica
    const celLimpo = cel.replace(/\D/g, '');
    const nome = osData.cliente || 'Cliente';
    const placa = osData.placa || '';
    const veiculo = osData.veiculo || '';
    const cliCrm = app.bancoCrm.find(x => x.id === osData.clienteId);

    let baseURL = window.location.origin + window.location.pathname.replace('painel_oficina.html', '');
    const portalURL = baseURL + 'clientes/projeto_oficina.html';

    let msg = '';

    if (novoStatus === 'orcamento') {
        msg = `Olá ${nome}! 👋\n\nO *orçamento* do seu veículo *${placa}${veiculo ? ' - ' + veiculo : ''}* está pronto na *${app.t_nome}*.\n\nAcesse o nosso portal para ver as fotos, o detalhamento dos serviços e *aprovar o orçamento*:\n👉 ${portalURL}`;
        if (cliCrm && cliCrm.usuario) { msg += `\n\n🔐 *Suas credenciais de acesso:*\nLogin: \`${cliCrm.usuario}\`\nSenha: \`${cliCrm.senha}\``; }
        msg += `\n\nAguardamos sua aprovação! 🙏`;
    } else if (novoStatus === 'box') {
        const boxNum = osData.boxNumero || '';
        const mecResp = osData.mecanicoResponsavel || '';
        msg = `Olá ${nome}! 🔧\n\nBoa notícia! O orçamento do seu veículo *${placa}${veiculo ? ' - ' + veiculo : ''}* foi *aprovado* e o serviço já está em andamento na *${app.t_nome}*!`;
        if (boxNum) msg += `\n\n📍 Box de Serviço: *${boxNum}*`;
        if (mecResp) msg += `\n👨‍🔧 Mecânico Responsável: *${mecResp}*`;
        msg += `\n\nEm breve avisaremos quando o seu veículo estiver pronto! 🚗💨`;
    } else if (novoStatus === 'pronto') {
        msg = `Olá ${nome}! 🎉\n\nSeu veículo *${placa}${veiculo ? ' - ' + veiculo : ''}* está *PRONTO* para retirada na *${app.t_nome}*!\n\n⏰ *Agende o horário da sua retirada* respondendo esta mensagem com a hora desejada.\n\nEstamos aguardando você! 🙏`;
    }

    if (msg) {
        window.open(`https://wa.me/55${celLimpo}?text=${encodeURIComponent(msg)}`, '_blank');
    }
};

// =====================================================================
// VINCULAÇÃO DE BOX + MECÂNICO (PÓS-APROVAÇÃO)
// =====================================================================
app.iniciarEscutaEquipeParaVinculacao = function() {
    // Carrega lista de mecânicos para o select do modal de vinculação de Box
    app.db.collection('funcionarios').where('tenantId', '==', app.t_id).onSnapshot(snap => {
        app.bancoEquipeGlobal = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Popula o select do modal de vinculação
        const sel = document.getElementById('vbox_mecanico');
        if (sel) {
            sel.innerHTML = '<option value="">-- Selecione o Mecânico Responsável --</option>' +
                app.bancoEquipeGlobal
                    .filter(f => f.role === 'equipe' || f.role === 'mecanico')
                    .map(f => `<option value="${f.nome}">${f.nome}</option>`)
                    .join('');
        }
    });
};

app.abrirModalVincularBox = function(osId, novoStatus) {
    // Guarda o contexto para quando o gestor confirmar
    app.osVincularBoxId = osId;
    const sel = document.getElementById('vbox_mecanico');
    if (sel) {
        sel.innerHTML = '<option value="">-- Selecione o Mecânico Responsável --</option>' +
            app.bancoEquipeGlobal
                .filter(f => f.role === 'equipe' || f.role === 'mecanico')
                .map(f => `<option value="${f.nome}">${f.nome}</option>`)
                .join('');
    }
    if (document.getElementById('vbox_osId')) document.getElementById('vbox_osId').value = osId;
    if (document.getElementById('vbox_box')) document.getElementById('vbox_box').value = '';
    if (document.getElementById('vbox_mecanico_texto')) document.getElementById('vbox_mecanico_texto').value = '';
    const mod = document.getElementById('modalVincularBox');
    if (mod) new bootstrap.Modal(mod).show();
};

app.confirmarVincularBox = async function() {
    const osId = document.getElementById('vbox_osId') ? document.getElementById('vbox_osId').value : app.osVincularBoxId;
    const boxNum = document.getElementById('vbox_box') ? document.getElementById('vbox_box').value.trim() : '';
    // Prioriza o select; se vazio, tenta o campo de texto manual
    const selMec = document.getElementById('vbox_mecanico');
    const mecTexto = document.getElementById('vbox_mecanico_texto') ? document.getElementById('vbox_mecanico_texto').value.trim() : '';
    const mecResp = (selMec && selMec.value) ? selMec.value : mecTexto;

    if (!boxNum) { app.showToast("Informe o número do Box de Serviço.", "error"); return; }
    if (!mecResp) { app.showToast("Selecione ou informe o Mecânico Responsável.", "error"); return; }

    const osRef = app.db.collection('ordens_servico').doc(osId);
    const osDoc = await osRef.get();
    if (!osDoc.exists) { app.showToast("O.S. não encontrada.", "error"); return; }

    let h = osDoc.data().historico || [];
    h.push({ data: new Date().toISOString(), usuario: app.user_nome, acao: `Vinculou ao Box ${boxNum} — Mecânico: ${mecResp}. Status: BOX (EXECUÇÃO)` });

    await osRef.update({
        status: 'box',
        boxNumero: boxNum,
        mecanicoResponsavel: mecResp,
        historico: h,
        ultimaAtualizacao: new Date().toISOString()
    });

    app.registrarAuditoriaGlobal("Pátio Kanban", `Vinculou O.S. ${osDoc.data().placa} ao Box ${boxNum} com mecânico ${mecResp}`);
    app.showToast(`Veículo vinculado ao Box ${boxNum} — Mecânico: ${mecResp}`, "success");

    // Notifica o cliente via WhatsApp com os dados do box e mecânico
    const osAtualizada = { ...osDoc.data(), boxNumero: boxNum, mecanicoResponsavel: mecResp };
    app.notificarClienteWhatsApp(osAtualizada, 'box');

    const mod = document.getElementById('modalVincularBox');
    if (mod) { const inst = bootstrap.Modal.getInstance(mod); if (inst) inst.hide(); }
};


// =====================================================================
// 4. MÓDULOS DE CHAT (GLOBAL PARA CLIENTES E INTERNO PARA EQUIPE)
// =====================================================================
app.iniciarEscutaMensagens = function() {
    app.db.collection('mensagens').where('tenantId', '==', app.t_id).onSnapshot(snap => {
        app.bancoMensagens = snap.docs.map(d => ({id: d.id, ...d.data()}));
        app.bancoMensagens.sort((a,b) => (a.timestamp?.toMillis()||0) - (b.timestamp?.toMillis()||0));
        
        let nL = 0; app.bancoMensagens.forEach(m => { if(m.sender === 'cliente' && !m.lidaAdmin) nL++; });
        const badge = document.getElementById('chatBadgeGlobal');
        if(badge) { if(nL > 0) { badge.innerText = nL; badge.classList.remove('d-none'); } else { badge.classList.add('d-none'); } }
        
        app.renderListaChatCRM();
        if(app.chatActiveClienteId) {
            const h = document.getElementById('chatNomeCliente');
            app.abrirChatCRM(app.chatActiveClienteId, h ? h.innerText.replace('Atendimento Ativo: ', '') : 'Cliente');
        }
    });
};

app.renderListaChatCRM = function() {
    const lista = document.getElementById('chatListaClientesCRM'); if(!lista) return;
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
    const header = document.getElementById('chatNomeCliente');
    if(header) header.innerHTML = `<span class="text-white-50">Atendimento Ativo:</span> <b class="text-accent fs-5">${nomeCliente}</b>`;
    
    const inputArea = document.getElementById('chatAreaInputGlobal'); if(inputArea) inputArea.style.display = 'flex';
    const area = document.getElementById('chatAreaMsgGlobal'); if(!area) return;
    area.innerHTML = '';
    
    const mD = app.bancoMensagens.filter(x => x.clienteId === clienteId);
    if(mD.length === 0) {
        area.innerHTML = '<div class="text-center text-white-50 mt-5 pt-5"><i class="bi bi-chat-dots display-1 mb-4 opacity-50"></i><p>Inicie o Atendimento.</p></div>';
    } else {
        mD.forEach(x => {
            if(x.sender === 'cliente' && !x.lidaAdmin) { app.db.collection('mensagens').doc(x.id).update({lidaAdmin: true}); }
            const t = x.timestamp ? new Date(x.timestamp.toDate()).toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'}) : 'agora';
            let c = x.text;
            
            if(x.fileUrl) {
                if(x.fileType === 'video' || x.fileUrl.includes('.mp4')) c += `<br><video src="${x.fileUrl}" controls style="max-width:100%; border-radius:8px; margin-top:5px;"></video>`;
                else if(x.fileType === 'audio' || x.fileUrl.includes('.mp3') || x.fileUrl.includes('.ogg')) c += `<br><audio src="${x.fileUrl}" controls style="max-width:100%; margin-top:5px;"></audio>`;
                else if(x.fileUrl.includes('.pdf')) c += `<br><a href="${x.fileUrl}" target="_blank" class="btn btn-sm btn-dark mt-2"><i class="bi bi-file-pdf text-danger"></i> Abrir PDF</a>`;
                else c += `<br><img src="${x.fileUrl}" onclick="window.open('${x.fileUrl}')" style="max-width:100%; border-radius:8px; cursor:pointer; margin-top:5px;">`;
            }
            area.innerHTML += `<div class="message ${x.sender === 'admin' ? 'admin shadow-sm' : 'cliente shadow-sm'}">${c}<small class="d-block text-end mt-1" style="font-size:0.7rem;opacity:0.7;">${t}</small></div>`;
        });
        area.scrollTop = area.scrollHeight;
    }
};

app.enviarMensagemChatGlobal = async function() {
    const input = document.getElementById('inputChatGlobal'); const val = input ? input.value.trim() : '';
    if(!val || !app.chatActiveClienteId) return;
    await app.db.collection('mensagens').add({ tenantId: app.t_id, clienteId: app.chatActiveClienteId, sender: 'admin', text: val, lidaCliente: false, timestamp: firebase.firestore.FieldValue.serverTimestamp() });
    input.value = '';
};

app.enviarAnexoChatGlobal = async function() {
    const inp = document.getElementById('chatFileInputGlobal');
    if(!inp || !inp.files || inp.files.length === 0 || !app.chatActiveClienteId) return;
    app.showToast("Realizando Upload Seguro na Nuvem...", "warning");
    try {
        const fd = new FormData(); fd.append('file', inp.files[0]); fd.append('upload_preset', app.CLOUDINARY_UPLOAD_PRESET);
        const res = await fetch(`https://api.cloudinary.com/v1_1/${app.CLOUDINARY_CLOUD_NAME}/auto/upload`, {method:'POST', body:fd});
        const data = await res.json();
        if(data.secure_url) {
            await app.db.collection('mensagens').add({ tenantId: app.t_id, clienteId: app.chatActiveClienteId, sender: 'admin', text: "📎 Evidência da Oficina:", fileUrl: data.secure_url, fileType: data.resource_type, lidaCliente: false, timestamp: firebase.firestore.FieldValue.serverTimestamp() });
            inp.value = ''; app.showToast("Anexo enviado com sucesso para o cliente!", "success");
        }
    } catch(e) { console.error(e); app.showToast("Falha no envio da imagem.", "error"); }
};

// Chat Interno Equipe <-> Gestor
app.iniciarEscutaMensagensInternas = function() {
    app.db.collection('chat_interno').where('tenantId', '==', app.t_id).onSnapshot(snap => {
        let msgs = snap.docs.map(d => d.data());
        msgs.sort((a,b) => (a.timestamp?.toMillis()||0) - (b.timestamp?.toMillis()||0));
        const area = document.getElementById('chatAreaMsgInterno');
        if(area) {
            if(msgs.length === 0) area.innerHTML = '<div class="text-center text-white-50 mt-5 pt-5"><i class="bi bi-headset display-1 opacity-25"></i><p>O chat da equipa está limpo. Comece a comunicação.</p></div>';
            else {
                area.innerHTML = msgs.map(m => {
                    const t = m.timestamp ? new Date(m.timestamp.toDate()).toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'}) : 'agora';
                    const cssClass = m.usuario === app.user_nome ? 'admin' : 'cliente'; 
                    return `<div class="message ${cssClass} shadow-sm"><strong>${m.usuario}:</strong><br>${m.text}<small class="d-block text-end mt-1" style="font-size:0.7rem;opacity:0.7;">${t}</small></div>`;
                }).join('');
                area.scrollTop = area.scrollHeight;
            }
        }
    });
};

app.enviarMensagemInterna = async function() {
    const inp = document.getElementById('inputChatInterno'); if(!inp || !inp.value.trim()) return;
    await app.db.collection('chat_interno').add({ tenantId: app.t_id, usuario: app.user_nome, text: inp.value.trim(), timestamp: firebase.firestore.FieldValue.serverTimestamp() });
    inp.value = '';
};

// =====================================================================
// 5. ESTOQUE FÍSICO E ENTRADA DE N.F. (XML MÁGICO)
// =====================================================================
app.iniciarEscutaEstoque = function() {
    app.db.collection('estoque').where('tenantId', '==', app.t_id).onSnapshot(snap => {
        app.bancoEstoque = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const tbody = document.getElementById('tabelaEstoqueCorpo');
        if(tbody) {
            tbody.innerHTML = app.bancoEstoque.map(p => `<tr><td><small class="text-white-50">${p.fornecedor||'N/A'}</small><br><span class="badge bg-primary">NF: ${p.nf||'S/N'}</span></td><td><span class="text-info small">[NCM: ${p.ncm||'-'}]</span></td><td><strong class="text-white">${p.desc}</strong></td><td><span class="badge bg-secondary px-3 py-2 fs-6 shadow-sm">${p.qtd} un</span></td><td class="gestao-only text-danger fw-bold">R$ ${p.custo.toFixed(2)}</td><td class="text-success fw-bold fs-6">R$ ${p.venda.toFixed(2)}</td><td class="gestao-only text-end"><button class="btn btn-sm btn-outline-info shadow-sm me-1" onclick="app.abrirModalNF('edit', '${p.id}')"><i class="bi bi-pencil"></i></button><button class="btn btn-sm btn-outline-danger shadow-sm admin-only" onclick="app.apagarProduto('${p.id}')"><i class="bi bi-trash-fill"></i></button></td></tr>`).join('');
        }
        const sel = document.getElementById('selectProdutoEstoque');
        if(sel) {
            sel.innerHTML = '<option value="">Puxar Peça do Almoxarifado / Estoque Físico...</option>' + app.bancoEstoque.filter(p=>p.qtd>0).map(p => `<option value="${p.id}" data-venda="${p.venda}" data-custo="${p.custo}" data-desc="${p.desc}" data-ncm="${p.ncm||'-'}">[Est: ${p.qtd}] - ${p.desc} (R$ ${p.venda.toFixed(2)})</option>`).join('');
        }
    });
};

app.abrirModalNF = function(mode='nova', id='') {
    const frm = document.getElementById('formNF'); if(frm) frm.reset();
    if(document.getElementById('corpoItensNF')) document.getElementById('corpoItensNF').innerHTML = '';
    if(document.getElementById('p_id')) document.getElementById('p_id').value = '';
    if(document.getElementById('nf_data')) document.getElementById('nf_data').value = new Date().toISOString().split('T')[0];
    
    if(mode === 'edit') {
        const p = app.bancoEstoque.find(x => x.id === id);
        if(p) {
            if(document.getElementById('p_id')) document.getElementById('p_id').value = p.id;
            if(document.getElementById('nf_fornecedor')) document.getElementById('nf_fornecedor').value = p.fornecedor || '';
            if(document.getElementById('nf_numero')) document.getElementById('nf_numero').value = p.nf || '';
            if(document.getElementById('nf_data')) document.getElementById('nf_data').value = p.dataEntrada ? p.dataEntrada.split('T')[0] : new Date().toISOString().split('T')[0];
            app.adicionarLinhaNF(p.desc, p.ncm, p.cfop, p.qtd, p.custo, p.venda);
        }
    } else { app.adicionarLinhaNF('', '', '', 1, 0, 0); }
    
    const mod = document.getElementById('modalNF'); if(mod) new bootstrap.Modal(mod).show();
};

app.processarXML = function(event) {
    const file = event.target.files[0]; if(!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        const xmlText = e.target.result; const parser = new DOMParser(); const xmlDoc = parser.parseFromString(xmlText, "text/xml");
        const emit = xmlDoc.getElementsByTagName("emit")[0]; 
        if(emit && document.getElementById('nf_fornecedor')) { const xNome = emit.getElementsByTagName("xNome")[0]; if(xNome) document.getElementById('nf_fornecedor').value = xNome.textContent; }
        const ide = xmlDoc.getElementsByTagName("ide")[0]; 
        if(ide && document.getElementById('nf_numero')) { const nNF = ide.getElementsByTagName("nNF")[0]; if(nNF) document.getElementById('nf_numero').value = nNF.textContent; }
        
        const det = xmlDoc.getElementsByTagName("det");
        if(document.getElementById('corpoItensNF')) document.getElementById('corpoItensNF').innerHTML = ''; 
        for(let i=0; i<det.length; i++) {
            const prod = det[i].getElementsByTagName("prod")[0];
            if(prod) {
                const desc = prod.getElementsByTagName("xProd")[0]?.textContent || ''; const ncm = prod.getElementsByTagName("NCM")[0]?.textContent || ''; const cfop = prod.getElementsByTagName("CFOP")[0]?.textContent || '';
                const qtd = parseFloat(prod.getElementsByTagName("qCom")[0]?.textContent || 0); const vUnCom = parseFloat(prod.getElementsByTagName("vUnCom")[0]?.textContent || 0);
                app.adicionarLinhaNF(desc, ncm, cfop, qtd, vUnCom, (vUnCom * 1.8)); 
            }
        }
        app.showToast("XML lido com sucesso. Modifique a sua margem de venda final na tabela.", "success");
    };
    reader.readAsText(file);
};

app.adicionarLinhaNF = function(desc='', ncm='', cfop='', qtd=1, custo=0, venda=0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td><input type="text" class="form-control form-control-sm bg-dark text-white border-secondary p-2 it-desc" value="${desc}" required></td><td><input type="text" class="form-control form-control-sm bg-dark text-white border-secondary p-2 it-ncm" value="${ncm}"></td><td><input type="text" class="form-control form-control-sm bg-dark text-white border-secondary p-2 it-cfop" value="${cfop}"></td><td><input type="number" class="form-control form-control-sm bg-dark text-white border-secondary p-2 it-qtd" value="${qtd}" min="1"></td><td><input type="number" step="0.01" class="form-control form-control-sm bg-dark text-danger border-secondary p-2 it-custo" value="${custo}"></td><td><input type="number" step="0.01" class="form-control form-control-sm bg-dark text-success border-secondary p-2 it-venda fw-bold" value="${venda}"></td><td><button type="button" class="btn btn-sm btn-outline-danger p-0 px-2 mt-1" onclick="this.closest('tr').remove()"><i class="bi bi-trash"></i></button></td>`;
    const tb = document.getElementById('corpoItensNF'); if(tb) tb.appendChild(tr);
};

app.verificarPgtoCompraNF = function() {
    const fElem = document.getElementById('nf_metodo_pagamento'); const d = document.getElementById('nf_div_parcelas');
    if(!fElem || !d) return; const f = fElem.value;
    if(f.includes('Parcelado') || f.includes('Prazo')) { d.style.display = 'block'; } else { d.style.display = 'none'; if(document.getElementById('nf_parcelas')) document.getElementById('nf_parcelas').value = "1x"; }
};

app.salvarEntradaEstoque = async function(e) {
    e.preventDefault();
    const idField = document.getElementById('p_id'); const id = idField ? idField.value : '';
    const fornecedor = document.getElementById('nf_fornecedor') ? document.getElementById('nf_fornecedor').value : ''; 
    const nf = document.getElementById('nf_numero') ? document.getElementById('nf_numero').value : '';
    const dtBase = document.getElementById('nf_data') ? document.getElementById('nf_data').value : new Date().toISOString().split('T')[0];
    const fp = document.getElementById('nf_metodo_pagamento') ? document.getElementById('nf_metodo_pagamento').value : ''; 
    const parc = document.getElementById('nf_parcelas') ? document.getElementById('nf_parcelas').value : '1x';
    const gerarFinanceiro = document.getElementById('nf_gerar_financeiro') ? document.getElementById('nf_gerar_financeiro').checked : false;
    
    let totalCustoGlobalNF = 0; const batch = app.db.batch();
    
    if(id) {
        const tr = document.querySelector('#corpoItensNF tr');
        if(tr) {
            batch.update(app.db.collection('estoque').doc(id), { fornecedor, nf, desc: tr.querySelector('.it-desc').value, qtd: parseFloat(tr.querySelector('.it-qtd').value), custo: parseFloat(tr.querySelector('.it-custo').value), venda: parseFloat(tr.querySelector('.it-venda').value), ncm: tr.querySelector('.it-ncm').value, cfop: tr.querySelector('.it-cfop').value });
            app.registrarAuditoriaGlobal("Estoque", `Editou o item do fornecedor ${fornecedor}`);
        }
    } else {
        document.querySelectorAll('#corpoItensNF tr').forEach(tr => {
            const desc = tr.querySelector('.it-desc').value.trim(); const q = parseFloat(tr.querySelector('.it-qtd').value)||0; const c = parseFloat(tr.querySelector('.it-custo').value)||0; const v = parseFloat(tr.querySelector('.it-venda').value)||0;
            if(desc !== '' && q > 0) {
                totalCustoGlobalNF += (q * c);
                batch.set(app.db.collection('estoque').doc(), { tenantId: app.t_id, fornecedor: fornecedor, nf: nf, desc: desc, qtd: q, custo: c, venda: v, ncm: tr.querySelector('.it-ncm').value, cfop: tr.querySelector('.it-cfop').value, usuarioEntrada: app.user_nome, dataEntrada: new Date().toISOString() });
            }
        });
        if(totalCustoGlobalNF === 0) { app.showToast("Nenhum item válido para dar entrada.", "error"); return; }

        if(gerarFinanceiro) {
            let nP = 1; if(fp.includes('Parcelado') || fp.includes('Prazo')) { if(parc.includes('2x')) nP = 2; else if(parc.includes('3x')) nP = 3; else if(parc.includes('4x')) nP = 4; else if(parc.includes('6x')) nP = 6; }
            const vP = totalCustoGlobalNF / nP; const stsPgto = (fp.includes('Boleto') || fp.includes('Pendente') || fp.includes('Parcelado') || fp.includes('Crédito') || fp.includes('Prazo')) ? 'pendente' : 'pago';
            for(let i=0; i<nP; i++) { 
                let dV = new Date(dtBase); if(nP>1 || stsPgto==='pendente') dV.setDate(dV.getDate() + (i*30)); 
                batch.set(app.db.collection('financeiro').doc(), { tenantId: app.t_id, tipo: 'despesa', desc: nP>1 ? `NF Compra: ${nf} (${fornecedor}) - Parc ${i+1}/${nP}` : `NF Compra: ${nf} (${fornecedor})`, valor: vP, parcelaAtual: i+1, totalParcelas: nP, metodo: fp, vencimento: dV.toISOString().split('T')[0], status: stsPgto }); 
            }
        }
        app.registrarAuditoriaGlobal("Estoque e DRE", `Deu entrada em nova nota fiscal de ${fornecedor}, total R$ ${totalCustoGlobalNF.toFixed(2)}`);
    }

    await batch.commit(); app.showToast("Estoque Atualizado e Compra Lançada!", "success"); e.target.reset(); 
    const mod = document.getElementById('modalNF'); if(mod) bootstrap.Modal.getInstance(mod).hide();
};

app.apagarProduto = async function(id) {
    if(app.t_role !== 'admin') { app.showToast("Apenas a Administração Master pode excluir produtos.", "error"); return; }
    if(confirm("Excluir produto permanentemente da base?")) { 
        await app.db.collection('estoque').doc(id).delete(); 
        app.registrarAuditoriaGlobal("Estoque", `Deletou um produto do estoque (ID: ${id}).`);
        app.showToast("Produto Excluído.", "success"); 
    }
};

// =====================================================================
// 6. MOTOR KANBAN E GESTÃO DE O.S.
// =====================================================================
app.iniciarEscutaOS = function() {
    app.db.collection('ordens_servico').where('tenantId', '==', app.t_id).onSnapshot(snap => {
        app.bancoOSCompleto = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if(app.t_role === 'equipe') {
            let minhaCom = 0; app.bancoOSCompleto.filter(o => o.status === 'entregue' && o.mecanicoReal === app.user_nome).forEach(o => minhaCom += (o.comissaoProcessada||0));
            const divKpi = document.getElementById('kpiMinhaComissao'); if(divKpi) divKpi.innerText = `R$ ${minhaCom.toFixed(2).replace('.',',')}`;
        }
        app.renderizarKanban(); app.renderizarTabelaArquivo();
    });
};

app.filtrarGlobal = function() { app.renderizarKanban(); app.renderizarTabelaArquivo(); };

app.renderizarKanban = function() {
    const busca = document.getElementById('buscaGeral'); const t = busca ? busca.value.toLowerCase().trim() : '';
    let ativos = app.bancoOSCompleto.filter(os => os.status !== 'entregue');
    if(t) ativos = ativos.filter(os => (os.placa&&os.placa.toLowerCase().includes(t)) || (os.cliente&&os.cliente.toLowerCase().includes(t)) || (os.veiculo&&os.veiculo.toLowerCase().includes(t)));

    const cols = { patio: '', orcamento: '', aprovacao: '', box: '', pronto: '' };
    let counts = { patio: 0, orcamento: 0, aprovacao: 0, box: 0, pronto: 0 };
    const ordem = ['patio', 'orcamento', 'aprovacao', 'box', 'pronto'];

    ativos.forEach(os => {
        const s = os.status || 'patio'; counts[s]++;
        let cor = s === 'pronto' ? 'border-success' : s === 'aprovacao' ? 'border-warning' : s === 'box' ? 'border-info' : s === 'orcamento' ? 'border-primary' : 'border-secondary';
        const idx = ordem.indexOf(s); const nextS = idx < ordem.length-1 ? ordem[idx+1] : null; const prevS = idx > 0 ? ordem[idx-1] : null;
        
        let btnBack = prevS ? `<button class="btn btn-sm btn-dark p-1 px-2 border-secondary shadow-sm me-1" onclick="event.stopPropagation(); app.mudarStatusRapido('${os.id}', '${prevS}')" title="Voltar Fase"><i class="bi bi-arrow-left-circle text-white-50"></i></button>` : '';
        let btnFwd = s === 'pronto' ? `<button class="btn btn-sm btn-success p-1 px-3 shadow fw-bold gestao-only" onclick="event.stopPropagation(); app.abrirFaturamentoDireto('${os.id}')"><i class="bi bi-cash-coin me-1"></i> FATURAR VEÍCULO</button>` : `<button class="btn btn-sm btn-dark p-1 px-2 border-secondary shadow-sm" onclick="event.stopPropagation(); app.mudarStatusRapido('${os.id}', '${nextS}')" title="Avançar Fase"><i class="bi bi-arrow-right-circle text-info"></i></button>`;

        // Exibe Box e Mecânico nas colunas onde já foram vinculados
        let boxMecInfo = '';
        if (os.boxNumero || os.mecanicoResponsavel) {
            boxMecInfo = `<small class="text-info d-block mt-1 fw-bold"><i class="bi bi-box-seam me-1"></i>Box ${os.boxNumero || '?'}${os.mecanicoResponsavel ? ' — ' + os.mecanicoResponsavel : ''}</small>`;
        }

        cols[s] += `<div class="os-card border-start border-4 ${cor}" onclick="app.abrirModalOS('edit', '${os.id}')"><div class="fast-actions">${btnBack}${btnFwd}</div><div class="d-flex justify-content-between mb-2"><span class="badge bg-dark border border-secondary text-white py-2 px-3">${os.placa}</span></div><h6 class="text-white fw-bold mb-1 w-75 text-truncate">${os.veiculo}</h6><small class="text-white-50"><i class="bi bi-person-fill"></i> ${os.cliente}</small>${boxMecInfo}</div>`;
    });
    ordem.forEach(id => { const col = document.getElementById('col_'+id); const cnt = document.getElementById('count_'+id); if(col) col.innerHTML = cols[id]; if(cnt) cnt.innerText = counts[id]; });
};

app.mudarStatusRapido = async function(id, novoStatus) {
    const osRef = app.db.collection('ordens_servico').doc(id); const doc = await osRef.get();
    const osData = doc.data();

    // ─── INTERCEPTAÇÃO: Aprovação → Box exige vincular mecânico e número do box ───
    if (novoStatus === 'box' && osData.status === 'aprovacao') {
        app.abrirModalVincularBox(id, novoStatus);
        return; // Não avança automaticamente — o modal confirmarVincularBox faz isso
    }

    let h = osData.historico || [];
    h.push({ data: new Date().toISOString(), usuario: app.user_nome, acao: `Arrastou o cartão da O.S. para a coluna: ${novoStatus.toUpperCase()}` });
    await osRef.update({ status: novoStatus, historico: h, ultimaAtualizacao: new Date().toISOString() });
    app.registrarAuditoriaGlobal("Pátio Kanban", `Moveu O.S. ${osData.placa} para ${novoStatus}`);

    // ─── NOTIFICAÇÕES AUTOMÁTICAS WHATSAPP POR STATUS ───
    if (novoStatus === 'orcamento' || novoStatus === 'pronto') {
        app.notificarClienteWhatsApp(osData, novoStatus);
    }
};

// =====================================================================
// 7. ABERTURA E EDIÇÃO DO PRONTUÁRIO O.S. 
// =====================================================================
app.verificarStatusLink = function() {
    const a = document.getElementById('alertaLinkCliente'); if(!a) return;
    if (document.getElementById('os_status') && document.getElementById('os_status').value === 'aprovacao' && document.getElementById('os_id').value) a.classList.remove('d-none'); else a.classList.add('d-none');
};

app.abrirModalOS = function(mode = 'nova', id = '') {
    const frm = document.getElementById('formOS'); if(frm) frm.reset();
    if(document.getElementById('listaPecasCorpo')) document.getElementById('listaPecasCorpo').innerHTML = ''; 
    app.fotosOSAtual = []; app.historicoOSAtual = [];
    if(document.getElementById('header_placa')) document.getElementById('header_placa').innerText = '';
    if(document.getElementById('listaHistorico')) document.getElementById('listaHistorico').innerHTML = '';
    
    const btnFat = document.getElementById('btnFaturar'); if(btnFat) btnFat.classList.add('d-none');
    const btnPdf = document.getElementById('btnGerarPDF'); if(btnPdf) btnPdf.classList.add('d-none');
    const btnDel = document.getElementById('btnDeletarOS'); if(btnDel) btnDel.classList.add('d-none');
    ['chk_combustivel', 'chk_arranhado', 'chk_bateria', 'chk_pneus'].forEach(i => { const chk = document.getElementById(i); if(chk) chk.checked = false; });

    if (mode === 'edit') {
        const os = app.bancoOSCompleto.find(x => x.id === id);
        if (os) {
            if(document.getElementById('os_id')) document.getElementById('os_id').value = os.id;
            if(document.getElementById('os_placa')) document.getElementById('os_placa').value = os.placa || '';
            if(document.getElementById('header_placa')) document.getElementById('header_placa').innerText = `[${os.placa}]`;
            if(document.getElementById('os_veiculo')) document.getElementById('os_veiculo').value = os.veiculo || '';
            if(document.getElementById('os_cliente')) document.getElementById('os_cliente').value = os.cliente || '';
            if(document.getElementById('os_cliente_cpf')) document.getElementById('os_cliente_cpf').value = os.clienteCpf || '';
            if(document.getElementById('os_celular')) document.getElementById('os_celular').value = os.celular || '';
            if(document.getElementById('os_status')) document.getElementById('os_status').value = os.status || 'patio';
            if(document.getElementById('os_relato_cliente')) document.getElementById('os_relato_cliente').value = os.relatoCliente || '';
            if(document.getElementById('os_diagnostico')) document.getElementById('os_diagnostico').value = os.diagnostico || '';
            if(os.chk_combustivel && document.getElementById('chk_combustivel')) document.getElementById('chk_combustivel').checked = true;
            if(os.chk_arranhado && document.getElementById('chk_arranhado')) document.getElementById('chk_arranhado').checked = true;
            if(os.chk_bateria && document.getElementById('chk_bateria')) document.getElementById('chk_bateria').checked = true;
            if(os.chk_pneus && document.getElementById('chk_pneus')) document.getElementById('chk_pneus').checked = true;
            
            if (os.fotos) { app.fotosOSAtual = os.fotos; app.renderizarGaleria(); }
            if (os.historico) { app.historicoOSAtual = os.historico; app.renderizarHistorico(); }
            if (os.pecas && Array.isArray(os.pecas)) { os.pecas.forEach(p => app.adicionarLinhaPeca(p.desc, p.ncm||'', p.qtd, p.custo, p.venda, p.idEstoque, p.isMaoObra)); }
            
            // Carrega campos de Box e Mecânico (vinculação pós-aprovação)
            if(document.getElementById('os_box_numero')) document.getElementById('os_box_numero').value = os.boxNumero || '';
            if(document.getElementById('os_mecanico_responsavel')) document.getElementById('os_mecanico_responsavel').value = os.mecanicoResponsavel || '';
            
            if(btnPdf) btnPdf.classList.remove('d-none');
            if (os.status === 'pronto' && (app.t_role === 'admin' || app.t_role === 'gerente') && btnFat) btnFat.classList.remove('d-none');
            if (app.t_role === 'admin' && btnDel) btnDel.classList.remove('d-none');
        }
    } else { app.adicionarMaoDeObra(); }
    app.verificarStatusLink(); const mod = document.getElementById('modalOS'); if(mod) new bootstrap.Modal(mod).show();
};

app.adicionarDoEstoque = function() {
    const sel = document.getElementById('selectProdutoEstoque'); if(!sel || !sel.value) return; const opt = sel.options[sel.selectedIndex];
    app.adicionarLinhaPeca(opt.dataset.desc, opt.dataset.ncm, 1, parseFloat(opt.dataset.custo), parseFloat(opt.dataset.venda), sel.value, false); sel.value = '';
};

app.adicionarMaoDeObra = function() { app.adicionarLinhaPeca("Mão de Obra / Serviço", "-", 1, 0, 0, null, true); };

app.adicionarLinhaPeca = function(desc, ncm, qtd, custo, venda, idEstoque, isMaoObra) {
    const tr = document.createElement('tr'); const mo = isMaoObra ? `data-maoobra="true"` : ''; const est = idEstoque ? `data-idestoque="${idEstoque}" readonly` : '';
    tr.innerHTML = `<td><input type="text" class="form-control form-control-sm bg-dark text-white border-secondary peca-desc p-2" value="${desc}" ${est} ${mo}></td>
        <td><span class="text-white-50 small d-block">NCM: ${ncm||'-'}</span></td>
        <td><input type="number" class="form-control form-control-sm bg-dark text-white border-secondary peca-qtd p-2" value="${qtd}" min="1" onchange="app.calcularTotalOS()"></td>
        <td class="gestao-only"><input type="number" step="0.01" class="form-control form-control-sm bg-dark text-danger border-secondary peca-custo p-2" value="${custo}" onchange="app.calcularTotalOS()"></td>
        <td><input type="number" step="0.01" class="form-control form-control-sm bg-dark text-success border-secondary peca-venda p-2 fw-bold" value="${venda}" onchange="app.calcularTotalOS()"></td>
        <td><input type="text" class="form-control form-control-sm bg-black text-white border-0 peca-total fw-bold p-2" readonly value="${(qtd*venda).toFixed(2)}"></td>
        <td class="text-center" data-html2canvas-ignore><button type="button" class="btn btn-sm btn-outline-danger border-0 mt-1" onclick="this.closest('tr').remove(); app.calcularTotalOS()"><i class="bi bi-trash"></i></button></td>`;
    const tb = document.getElementById('listaPecasCorpo'); if(tb) tb.appendChild(tr); app.calcularTotalOS();
};

app.calcularTotalOS = function() {
    let t = 0; let tc = 0; let tMO = 0; let tPecas = 0;
    document.querySelectorAll('#listaPecasCorpo tr').forEach(tr => {
        const descInput = tr.querySelector('.peca-desc'); const isMaoObra = descInput ? descInput.dataset.maoobra === "true" : false;
        const q = parseFloat(tr.querySelector('.peca-qtd').value)||0; const v = parseFloat(tr.querySelector('.peca-venda').value)||0; const c = parseFloat(tr.querySelector('.peca-custo').value)||0;
        const totElem = tr.querySelector('.peca-total'); if(totElem) totElem.value = (q*v).toFixed(2);
        t += (q*v); tc += (q*c); if(isMaoObra) tMO += (q*v); else tPecas += (q*v);
    });
    const divGeral = document.getElementById('os_total_geral'); if(divGeral) divGeral.innerText = `R$ ${t.toFixed(2).replace('.',',')}`;
    return { total: t, custo: tc, maoObra: tMO, pecas: tPecas };
};

app.salvarOS = async function() {
    const idElem = document.getElementById('os_id'); const id = idElem ? idElem.value : '';
    let pecasArray = []; const metricasTotais = app.calcularTotalOS(); 
    const cpfField = document.getElementById('os_cliente_cpf'); const cpfOS = cpfField ? cpfField.value : '';
    const cliElem = document.getElementById('os_cliente'); const clienteOS = cliElem ? cliElem.value.trim() : '';
    const telElem = document.getElementById('os_celular'); const telOS = telElem ? telElem.value.trim() : '';

    let cId = '';
    if(clienteOS && !app.bancoCrm.find(c => c.nome.toLowerCase() === clienteOS.toLowerCase())) {
        const d = await app.db.collection('clientes_base').add({ tenantId: app.t_id, nome: clienteOS, telefone: telOS, documento: cpfOS, anotacoes: "Criado via O.S." }); cId = d.id;
    } else { const cExist = app.bancoCrm.find(c => c.nome.toLowerCase() === clienteOS.toLowerCase()); if(cExist) cId = cExist.id; }

    document.querySelectorAll('#listaPecasCorpo tr').forEach(tr => {
        const descInput = tr.querySelector('.peca-desc'); const desc = descInput ? descInput.value.trim() : '';
        const idEstoque = descInput ? descInput.dataset.idestoque || null : null; const isMaoObra = descInput ? descInput.dataset.maoobra === "true" : false;
        const q = parseFloat(tr.querySelector('.peca-qtd').value)||1; const c = parseFloat(tr.querySelector('.peca-custo').value)||0; const v = parseFloat(tr.querySelector('.peca-venda').value)||0;
        if (desc !== '') { pecasArray.push({ desc, qtd:q, custo:c, venda:v, idEstoque, isMaoObra }); }
    });
    
    const novoStatus = document.getElementById('os_status') ? document.getElementById('os_status').value : 'patio';
    app.historicoOSAtual.push({ data: new Date().toISOString(), usuario: app.user_nome, acao: id ? `Editou o orçamento/evidências. Status: ${novoStatus.toUpperCase()}` : "Abriu a Ficha (Pátio)." });
    
    const payload = {
        tenantId: app.t_id, placa: document.getElementById('os_placa') ? document.getElementById('os_placa').value.toUpperCase() : '', veiculo: document.getElementById('os_veiculo') ? document.getElementById('os_veiculo').value : '', cliente: clienteOS, clienteId: cId, celular: telOS, clienteCpf: cpfOS, status: novoStatus, relatoCliente: document.getElementById('os_relato_cliente') ? document.getElementById('os_relato_cliente').value : '', diagnostico: document.getElementById('os_diagnostico') ? document.getElementById('os_diagnostico').value : '', chk_combustivel: document.getElementById('chk_combustivel') ? document.getElementById('chk_combustivel').checked : false, chk_arranhado: document.getElementById('chk_arranhado') ? document.getElementById('chk_arranhado').checked : false, chk_bateria: document.getElementById('chk_bateria') ? document.getElementById('chk_bateria').checked : false, chk_pneus: document.getElementById('chk_pneus') ? document.getElementById('chk_pneus').checked : false, pecas: pecasArray, total: metricasTotais.total, custoTotal: metricasTotais.custo, maoObraTotal: metricasTotais.maoObra, pecasTotal: metricasTotais.pecas, fotos: app.fotosOSAtual, historico: app.historicoOSAtual, ultimaAtualizacao: new Date().toISOString(),
        // Campos de vinculação de Box e Mecânico (preservados se já existirem)
        boxNumero: document.getElementById('os_box_numero') ? document.getElementById('os_box_numero').value.trim() : '',
        mecanicoResponsavel: document.getElementById('os_mecanico_responsavel') ? document.getElementById('os_mecanico_responsavel').value.trim() : ''
    };
    
    if (!id) payload.mecanico = app.user_nome; 
    if (novoStatus === 'entregue') { app.showToast("ATENÇÃO: Use o botão Verde de Faturar para Baixar Estoque.", "warning"); return; }
    if (id) await app.db.collection('ordens_servico').doc(id).update(payload); else await app.db.collection('ordens_servico').add(payload);
    
    app.showToast("Prontuário Salvo.", "success"); const mod = document.getElementById('modalOS'); if(mod) bootstrap.Modal.getInstance(mod).hide();
};

// =====================================================================
// 8. FATURAMENTO (BAIXA DE ESTOQUE E GERAÇÃO DE CONTAS A RECEBER NO DRE)
// =====================================================================
app.abrirFaturamentoDireto = function(id) {
    app.osParaFaturar = app.bancoOSCompleto.find(o => o.id === id);
    const vTotal = document.getElementById('fat_valor_total');
    if(vTotal && app.osParaFaturar) vTotal.innerText = `R$ ${(app.osParaFaturar.total||0).toFixed(2).replace('.',',')}`;
    const mod = document.getElementById('modalFaturamento'); if(mod) new bootstrap.Modal(mod).show();
};

app.abrirFaturamentoOS = function() {
    app.salvarOS();
    setTimeout(() => { const idElem = document.getElementById('os_id'); if(idElem && idElem.value) app.abrirFaturamentoDireto(idElem.value); }, 1000);
};

app.processarFaturamentoCompleto = async function() {
    if(!app.osParaFaturar) return;
    const fpElem = document.getElementById('fat_metodo'); const fp = fpElem ? fpElem.value : 'Dinheiro';
    const parcElem = document.getElementById('fat_parcelas'); const parcelasText = parcElem ? parcElem.value : '1';
    
    const totalVenda = app.osParaFaturar.total || 0; const batch = app.db.batch();
    let nP = 1; if(fp.includes('Boleto') || fp.includes('Cartao') || fp.includes('Parcelado') || fp.includes('Crediario')) { nP = parseInt(parcelasText) || 1; }
    const vP = totalVenda / nP; const stsPgto = (fp.includes('Boleto') || fp.includes('Crediario')) ? 'pendente' : 'pago';
    const dtBase = new Date().toISOString().split('T')[0];

    for(let i=0; i<nP; i++) { 
        let dV = new Date(dtBase); if(nP>1 || stsPgto==='pendente') dV.setDate(dV.getDate() + (i*30)); 
        batch.set(app.db.collection('financeiro').doc(), { tenantId: app.t_id, tipo: 'receita', desc: nP>1 ? `O.S: [${app.osParaFaturar.placa}] - Parc ${i+1}/${nP}` : `O.S: [${app.osParaFaturar.placa}] - Cliente: ${app.osParaFaturar.cliente}`, valor: vP, parcelaAtual: i+1, totalParcelas: nP, metodo: fp, vencimento: dV.toISOString().split('T')[0], status: stsPgto }); 
    }

    if(app.osParaFaturar.pecas && !app.osParaFaturar.baixaEstoqueFeita) {
        for (const p of app.osParaFaturar.pecas) {
            if (p.idEstoque) { const estRef = app.db.collection('estoque').doc(p.idEstoque); const estDoc = await estRef.get(); if(estDoc.exists) batch.update(estRef, { qtd: Math.max(0, estDoc.data().qtd - p.qtd) }); }
        }
    }

    let usrComissaoMO = app.user_comissao_mo; let usrComissaoPecas = app.user_comissao_pecas; 
    if(app.t_role === 'admin') { usrComissaoMO = 0; usrComissaoPecas = 0; }
    const calcMO = ((app.osParaFaturar.maoObraTotal||0) * (usrComissaoMO / 100)); const calcPecas = ((app.osParaFaturar.pecasTotal||0) * (usrComissaoPecas / 100)); const comissaoReais = calcMO + calcPecas;
    
    let h = app.osParaFaturar.historico || [];
    h.push({ data: new Date().toISOString(), usuario: app.user_nome, acao: `FATURAMENTO CONCLUÍDO: ${nP}x (${fp}). Estoque Baixado e comissão calculada.` });
    
    batch.update(app.db.collection('ordens_servico').doc(app.osParaFaturar.id), { status: 'entregue', baixaEstoqueFeita: true, comissaoProcessada: comissaoReais, mecanicoReal: app.osParaFaturar.mecanico || app.user_nome, historico: h, ultimaAtualizacao: new Date().toISOString() });
    
    await batch.commit(); 
    app.registrarAuditoriaGlobal("Faturamento O.S.", `Faturou a O.S placa ${app.osParaFaturar.placa} no valor de R$ ${totalVenda.toFixed(2)}`);
    app.showToast("CHECKOUT CONCLUÍDO! Veículo arquivado e Contas a Receber geradas.", "success");
    
    const modFat = document.getElementById('modalFaturamento'); if(modFat) bootstrap.Modal.getInstance(modFat).hide();
    const modOS = document.getElementById('modalOS'); if(modOS) bootstrap.Modal.getInstance(modOS).hide();
};

// =====================================================================
// 9. DRE, FLUXO DE CAIXA E HISTÓRICO PERMANENTE
// =====================================================================
app.abrirModalFinanceiro = function(mode='nova', tipo='', id='') {
    const frm = document.getElementById('formFinanceiro'); if(frm) frm.reset();
    if(document.getElementById('fin_id')) document.getElementById('fin_id').value = '';
    
    if(mode === 'edit' && !tipo) { const f = app.bancoFin.find(x => x.id === id); if(f) tipo = f.tipo; }
    
    if(document.getElementById('fin_tipo')) document.getElementById('fin_tipo').value = tipo;
    const finTitulo = document.getElementById('fin_titulo'); if(finTitulo) finTitulo.innerHTML = tipo === 'receita' ? '<i class="bi bi-plus-circle text-success me-2"></i> Receita Avulsa' : '<i class="bi bi-dash-circle text-danger me-2"></i> Lançar Despesa / NF';
    if(document.getElementById('fin_data')) document.getElementById('fin_data').value = new Date().toISOString().split('T')[0];
    
    const divStatus = document.getElementById('divStatusEdit'); const divParcelas = document.getElementById('divParcelas');
    
    if(mode === 'edit') {
        const f = app.bancoFin.find(x => x.id === id);
        if(f) {
            if(document.getElementById('fin_id')) document.getElementById('fin_id').value = f.id;
            if(document.getElementById('fin_desc')) document.getElementById('fin_desc').value = f.desc || '';
            if(document.getElementById('fin_valor')) document.getElementById('fin_valor').value = f.valor || 0;
            if(document.getElementById('fin_data')) document.getElementById('fin_data').value = f.vencimento ? f.vencimento.split('T')[0] : '';
            if(document.getElementById('fin_metodo')) document.getElementById('fin_metodo').value = f.metodo || 'Dinheiro';
            if(divStatus) { divStatus.style.display = 'block'; if(document.getElementById('fin_status')) document.getElementById('fin_status').value = f.status || 'pendente'; }
            if(divParcelas) divParcelas.style.display = 'none';
        }
    } else {
        if(divStatus) divStatus.style.display = 'none';
        if(divParcelas) divParcelas.style.display = 'block';
        if(tipo === 'receita' && document.getElementById('fin_parcelas')) document.getElementById('fin_parcelas').value = '1';
    }
    
    const mod = document.getElementById('modalFin'); if(mod) new bootstrap.Modal(mod).show();
};

app.verificarPgtoFinManual = function() {
    const f = document.getElementById('fin_metodo').value; const d = document.getElementById('divParcelas');
    if(d) { if(f.includes('Parcelado') || f.includes('Boleto')) d.style.display = 'block'; else { d.style.display = 'none'; document.getElementById('fin_parcelas').value = '1'; } }
};

app.salvarLancamentoFinanceiro = async function(e) {
    e.preventDefault();
    const idField = document.getElementById('fin_id'); const id = idField ? idField.value : '';
    const tipo = document.getElementById('fin_tipo') ? document.getElementById('fin_tipo').value : ''; 
    const desc = document.getElementById('fin_desc') ? document.getElementById('fin_desc').value : '';
    const valorTotal = document.getElementById('fin_valor') ? parseFloat(document.getElementById('fin_valor').value) : 0; 
    const dataInicial = document.getElementById('fin_data') ? new Date(document.getElementById('fin_data').value) : new Date();
    const fp = document.getElementById('fin_metodo') ? document.getElementById('fin_metodo').value : ''; 
    
    if(id) {
        // PROMPT OBRIGATÓRIO DE JUSTIFICATIVA PARA EDITAR/QUITAR (AUDITORIA CHEVRON)
        const m = prompt("ATENÇÃO: Você está modificando um título financeiro existente no DRE.\n\nPor favor, digite a JUSTIFICATIVA (Obrigatório para Auditoria e Rastreio de Caixa):");
        if(!m || m.trim() === '') { app.showToast("Operação Abortada. A justificativa de caixa é obrigatória.", "error"); return; }

        const sts = document.getElementById('fin_status') ? document.getElementById('fin_status').value : 'pendente';
        await app.db.collection('financeiro').doc(id).update({ desc: desc, valor: valorTotal, vencimento: dataInicial.toISOString().split('T')[0], metodo: fp, status: sts });
        app.showToast(`Obrigado. O Documento Financeiro foi atualizado. Status: ${sts.toUpperCase()}`, "success");
        app.registrarAuditoriaGlobal("Financeiro (DRE)", `Editou o título [${desc}]. Alterado para Status: ${sts.toUpperCase()}. Justificativa declarada: ${m}`);
    } else {
        const parcelasText = document.getElementById('fin_parcelas') ? document.getElementById('fin_parcelas').value : '1';
        const batch = app.db.batch();
        let nP = 1; if(fp.includes('Boleto') || fp.includes('Cartão') || fp.includes('Parcelado')) nP = parseInt(parcelasText) || 1;
        
        const vP = valorTotal / nP; 
        const stsPgto = (fp.includes('Boleto') || fp.includes('Pendente') || fp.includes('Crédito') || fp.includes('Parcelado')) ? 'pendente' : 'pago';

        for(let i=0; i<nP; i++) {
            let v = new Date(dataInicial); if(nP>1 || stsPgto==='pendente') v.setMonth(v.getMonth() + i);
            batch.set(app.db.collection('financeiro').doc(), { tenantId: app.t_id, tipo: tipo, desc: nP>1 ? `${desc} - Parc ${i+1}/${nP}`: desc, valor: vP, parcelaAtual: i+1, totalParcelas: nP, metodo: fp, vencimento: v.toISOString().split('T')[0], status: stsPgto });
        }
        await batch.commit(); 
        app.showToast(`Lançamento processado no DRE.`, "success");
        app.registrarAuditoriaGlobal("Financeiro (DRE)", `Inseriu novo lançamento contábil: ${desc} no valor total de R$ ${valorTotal.toFixed(2)}`);
    }
    
    const mod = document.getElementById('modalFin'); if(mod) bootstrap.Modal.getInstance(mod).hide(); e.target.reset();
};

app.iniciarEscutaFinanceiro = function() {
    app.db.collection('financeiro').where('tenantId', '==', app.t_id).onSnapshot(snap => {
        app.bancoFin = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        app.filtrarFinanceiro(true);
    });
};

app.filtrarFinanceiro = function(silent = false) {
    const dtIn = document.getElementById('filtroFinInicio') ? document.getElementById('filtroFinInicio').value : '';
    const dtFim = document.getElementById('filtroFinFim') ? document.getElementById('filtroFinFim').value : '';
    
    app.filtroFinDataInicio = dtIn; app.filtroFinDataFim = dtFim;
    
    let base = [...app.bancoFin];
    if(dtIn && dtFim) {
        const d1 = new Date(dtIn); const d2 = new Date(dtFim);
        base = base.filter(f => { const dV = new Date(f.vencimento); return dV >= d1 && dV <= d2; });
    }
    app.bancoFinFiltrado = base;
    app.renderizarFinanceiroGeral();
    if(!silent) app.showToast("Filtros Temporais aplicados no Fluxo de Caixa.", "success");
};

app.renderizarFinanceiroGeral = function() {
    if(!document.getElementById('tela_financeiro')) return;
    
    let totRec = 0, totPag = 0;
    const tPagar = document.getElementById('tabelaPagarCorpo'); const tReceber = document.getElementById('tabelaReceberCorpo');
    let hPagar = '', hReceber = '';
    
    app.bancoFinFiltrado.sort((a,b) => new Date(a.vencimento) - new Date(b.vencimento)).forEach(f => {
        const isR = f.tipo === 'receita';
        if(isR && f.status === 'pago') totRec += f.valor; // O DRE baseia-se em regime de Caixa (Pago Real)
        if(!isR && f.status === 'pago') totPag += f.valor;
        
        const cor = isR ? 'text-success' : 'text-danger';
        const st = f.status === 'pago' ? '<span class="badge bg-success px-2 py-1"><i class="bi bi-check2-all"></i> Quitado</span>' : '<span class="badge bg-warning text-dark px-2 py-1"><i class="bi bi-hourglass-split"></i> A Vencer / Pendente</span>';
        
        const btnEdit = `<button class="btn btn-sm btn-outline-info shadow-sm me-1" onclick="app.abrirModalFinanceiro('edit', '${f.tipo}', '${f.id}')" title="Inspecionar / Mudar Status"><i class="bi bi-pencil"></i> Editar ou Quitar Dívida</button>`;
        
        const html = `<tr><td class="text-white-50 fw-bold"><i class="bi bi-calendar-event me-2"></i> ${f.vencimento ? new Date(f.vencimento).toLocaleDateString('pt-BR') : ''}</td><td class="text-white fw-bold">${f.desc}</td><td><span class="badge bg-dark border border-secondary px-3 py-1 text-white-50">${f.parcelaAtual}/${f.totalParcelas}</span></td><td class="text-white-50 small">${f.metodo || 'Dinheiro'}</td><td class="${cor} fw-bold fs-6">R$ ${f.valor.toFixed(2).replace('.',',')}</td><td>${st}</td><td class="gestao-only text-end">${btnEdit} <button class="btn btn-sm btn-link text-danger admin-only" onclick="app.db.collection('financeiro').doc('${f.id}').delete()"><i class="bi bi-trash"></i></button></td></tr>`;
        if(isR) hReceber += html; else hPagar += html;
    });

    if(tPagar) tPagar.innerHTML = hPagar || '<tr><td colspan="7" class="text-center text-white-50 py-5"><i class="bi bi-check-circle text-success fs-3 d-block mb-2"></i> Caixa Respirando. Nenhuma dívida pendente neste período.</td></tr>';
    if(tReceber) tReceber.innerHTML = hReceber || '<tr><td colspan="7" class="text-center text-white-50 py-5">Não há previsões de faturamento ou histórico neste filtro.</td></tr>';

    let totCom = 0;
    app.bancoOSCompleto.filter(o=>o.status==='entregue').forEach(o => {
        if(app.filtroFinDataInicio && app.filtroFinDataFim) {
            const dV = new Date(o.ultimaAtualizacao); const d1 = new Date(app.filtroFinDataInicio); const d2 = new Date(app.filtroFinDataFim);
            if(dV >= d1 && dV <= d2) totCom += (o.comissaoProcessada||0);
        } else { totCom += (o.comissaoProcessada||0); }
    });
    
    if(document.getElementById('dreReceitas')) document.getElementById('dreReceitas').innerText = `R$ ${totRec.toFixed(2).replace('.',',')}`;
    if(document.getElementById('dreDespesas')) document.getElementById('dreDespesas').innerText = `R$ ${totPag.toFixed(2).replace('.',',')}`;
    if(document.getElementById('dreComissoes')) document.getElementById('dreComissoes').innerText = `R$ ${totCom.toFixed(2).replace('.',',')}`;
    if(document.getElementById('dreLucro')) document.getElementById('dreLucro').innerText = `R$ ${(totRec - totPag - totCom).toFixed(2).replace('.',',')}`;
};

app.exportarRelatorioFinanceiro = function() {
    try {
        const { jsPDF } = window.jspdf; const doc = new jsPDF('p', 'mm', 'a4'); let y = 15;
        doc.setFont("helvetica", "bold"); doc.setFontSize(20); doc.text(app.t_nome.toUpperCase(), 105, y, { align: "center" }); y += 10;
        doc.setFontSize(12); doc.text(`RELATÓRIO GERENCIAL - FLUXO DE CAIXA E TÍTULOS`, 105, y, { align: "center" }); y += 10;
        
        let pIn = app.filtroFinDataInicio ? new Date(app.filtroFinDataInicio).toLocaleDateString('pt-BR') : 'Início Geral';
        let pFim = app.filtroFinDataFim ? new Date(app.filtroFinDataFim).toLocaleDateString('pt-BR') : 'Atual';
        doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.text(`Período Auditado: ${pIn} até ${pFim}`, 15, y); y += 15;

        doc.setFont("helvetica", "bold"); doc.text("1. RECEBIMENTOS (Contas a Receber Faturadas)", 15, y); y += 5;
        let bR = []; app.bancoFinFiltrado.filter(x=>x.tipo==='receita').forEach(x => { bR.push([x.vencimento.split('-').reverse().join('/'), x.desc, x.metodo, `R$ ${x.valor.toFixed(2)}`, x.status.toUpperCase()]); });
        if(bR.length > 0) { doc.autoTable({ startY: y, head: [['Data Base', 'Cliente/Referência', 'Modalidade', 'Vlr.', 'Status']], body: bR, theme: 'grid' }); y = doc.lastAutoTable.finalY + 15; } else { doc.text("- Nenhuma entrada no período.", 15, y+5); y += 15; }

        doc.setFont("helvetica", "bold"); doc.text("2. DESPESAS (Contas a Pagar / Fornecedores)", 15, y); y += 5;
        let bP = []; app.bancoFinFiltrado.filter(x=>x.tipo==='despesa').forEach(x => { bP.push([x.vencimento.split('-').reverse().join('/'), x.desc, x.metodo, `R$ ${x.valor.toFixed(2)}`, x.status.toUpperCase()]); });
        if(bP.length > 0) { doc.autoTable({ startY: y, head: [['Data Base', 'Fornecedor/Motivo', 'Modalidade', 'Vlr.', 'Status']], body: bP, theme: 'grid' }); y = doc.lastAutoTable.finalY + 15; } else { doc.text("- Nenhuma despesa no período.", 15, y+5); y += 15; }

        doc.save(`Extrato_${app.t_nome.replace(' ', '_')}.pdf`);
        app.showToast("Relatório PDF emitido e exportado.", "success");
        app.registrarAuditoriaGlobal("Financeiro (DRE)", `Emitiu Relatório Contábil em PDF do período: ${pIn} até ${pFim}`);
    } catch(e) { console.error(e); app.showToast("Erro na geração do PDF DRE.", "error"); }
};

// =====================================================================
// 10. RECURSOS HUMANOS / EQUIPE E LIXEIRA DE AUDITORIA
// =====================================================================
app.iniciarEscutaEquipe = function() {
    app.db.collection('funcionarios').where('tenantId', '==', app.t_id).onSnapshot(snap => {
        const tbody = document.getElementById('tabelaEquipe'); if(!tbody) return;
        if(snap.empty) { tbody.innerHTML = '<tr><td colspan="6" class="text-center text-white-50 py-5 fs-5">Sem equipe cadastrada na nuvem.</td></tr>'; return; }
        
        tbody.innerHTML = snap.docs.map(doc => {
            const f = doc.data(); 
            const nAcesso = f.role === 'gerente' ? '<span class="badge bg-warning text-dark">Gerente/Vendedor</span>' : '<span class="badge bg-secondary text-white">Mecânico / Box</span>';
            return `<tr><td class="fw-bold text-white fs-6"><i class="bi bi-person-circle text-success me-2"></i> ${f.nome}</td><td>${nAcesso}</td><td class="text-warning fw-bold">${f.comissao||0}%</td><td class="text-success fw-bold">${f.comissao_pecas||0}%</td><td><span class="bg-dark border border-secondary px-3 py-1 rounded text-info">${f.usuario}</span> <small class="text-white-50 ms-2">[${f.senha}]</small></td><td class="admin-only text-end"><button class="btn btn-sm btn-outline-danger shadow-sm px-3" onclick="app.apagarFuncionario('${doc.id}')"><i class="bi bi-slash-circle me-1"></i> Revogar</button></td></tr>`;
        }).join('');
    });
};

app.abrirModalEquipe = function() {
    const frm = document.getElementById('formEquipe'); if(frm) frm.reset();
    const mod = document.getElementById('modalEquipe'); if(mod) new bootstrap.Modal(mod).show();
};

app.salvarFuncionario = async function(e) {
    e.preventDefault();
    await app.db.collection('funcionarios').add({ 
        tenantId: app.t_id, nome: document.getElementById('f_nome').value, role: document.getElementById('f_cargo').value, 
        comissao: parseFloat(document.getElementById('f_comissao_mo').value), comissao_pecas: parseFloat(document.getElementById('f_comissao_pecas').value),
        usuario: document.getElementById('f_user').value, senha: document.getElementById('f_pass').value 
    });
    app.showToast("Acesso corporativo Seguro criado.", "success"); 
    app.registrarAuditoriaGlobal("Gestão RH", `Criou credencial corporativa para: ${document.getElementById('f_nome').value}`);
    e.target.reset(); const mod = document.getElementById('modalEquipe'); if(mod) bootstrap.Modal.getInstance(mod).hide();
};

app.apagarFuncionario = async function(id) { 
    if(confirm("Deseja bloquear permanentemente o acesso à nuvem deste usuário?")) { 
        await app.db.collection('funcionarios').doc(id).delete(); 
        app.showToast("Acesso destruído e invalidado.", "success"); 
        app.registrarAuditoriaGlobal("Gestão RH", `Deletou o acesso de um funcionário (ID: ${id})`);
    } 
};

app.renderizarTabelaArquivo = function() {
    let entregues = app.bancoOSCompleto.filter(os => os.status === 'entregue').sort((a,b) => new Date(b.ultimaAtualizacao) - new Date(a.ultimaAtualizacao));
    const busca = document.getElementById('buscaGeral'); const t = busca ? busca.value.toLowerCase().trim() : '';
    if (t) entregues = entregues.filter(o => (o.placa&&o.placa.toLowerCase().includes(t)) || (o.cliente&&o.cliente.toLowerCase().includes(t)));
    
    const tbody = document.getElementById('tabelaArquivoCorpo');
    if(tbody) tbody.innerHTML = entregues.map(os => `<tr><td class="text-white-50 small"><i class="bi bi-calendar-check text-success me-2"></i> ${new Date(os.ultimaAtualizacao).toLocaleDateString('pt-BR')}</td><td><span class="badge bg-dark border px-3 py-2 fs-6 shadow-sm">${os.placa}</span></td><td class="text-white fw-bold">${os.veiculo}</td><td class="text-white-50">${os.cliente}</td><td class="gestao-only text-success fw-bold">R$ ${(os.total||0).toFixed(2).replace('.',',')}</td><td class="text-center"><button class="btn btn-outline-info shadow-sm fw-bold px-4" onclick="app.abrirModalOS('edit', '${os.id}')"><i class="bi bi-folder-symlink-fill me-2"></i> Prontuário</button></td></tr>`).join('');
};

// Aqui o Arquivo Morto se torna a verdadeira Central de Auditoria
app.iniciarEscutaLixeira = function() {
    app.db.collection('lixeira_auditoria').where('tenantId', '==', app.t_id).onSnapshot(snap => {
        app.bancoAuditoria = snap.docs.map(d => d.data());
        app.bancoAuditoria.sort((a,b) => new Date(b.apagadoEm) - new Date(a.apagadoEm));
        const tb = document.getElementById('tabelaLixeiraCorpo');
        if(tb) {
            tb.innerHTML = app.bancoAuditoria.map(l => `<tr><td class="text-white-50 small">${new Date(l.apagadoEm).toLocaleString('pt-BR')}</td><td class="text-white fw-bold">${l.placaOriginal}</td><td><i class="bi bi-person-badge text-danger"></i> ${l.apagadoPor}</td><td class="text-warning">${l.motivo}</td></tr>`).join('');
        }
        
        // Injeta Botão de Exportar Auditoria se não existir
        const lixeiraHeader = document.querySelector('#tela_arquivo .text-danger.fw-bold');
        if(lixeiraHeader && !document.getElementById('btnExportarAuditoria')) {
            lixeiraHeader.innerHTML += ` <button id="btnExportarAuditoria" class="btn btn-sm btn-outline-danger shadow-sm ms-3" onclick="app.exportarAuditoriaPDF()"><i class="bi bi-file-pdf"></i> Exportar Auditoria</button>`;
        }
    });
};

app.exportarAuditoriaPDF = function() {
    try {
        const { jsPDF } = window.jspdf; const doc = new jsPDF('p', 'mm', 'a4'); let y = 15;
        doc.setFont("helvetica", "bold"); doc.setFontSize(20); doc.text(app.t_nome.toUpperCase(), 105, y, { align: "center" }); y += 10;
        doc.setFontSize(12); doc.text(`RELATÓRIO DE AUDITORIA E RASTREIO`, 105, y, { align: "center" }); y += 15;
        
        let bodyTable = [];
        app.bancoAuditoria.forEach(l => { bodyTable.push([new Date(l.apagadoEm).toLocaleString('pt-BR'), l.placaOriginal, l.apagadoPor, l.motivo]); });
        
        if(bodyTable.length > 0) { doc.autoTable({ startY: y, head: [['Data/Hora', 'Módulo/Placa', 'Usuário', 'Ação / Justificativa']], body: bodyTable, theme: 'grid' }); } 
        else { doc.text("- Lixeira de auditoria vazia.", 15, y); }

        doc.save(`Auditoria_${app.t_nome.replace(' ', '_')}.pdf`);
        app.showToast("Log de Auditoria exportado em PDF.", "success");
    } catch(e) { console.error(e); app.showToast("Erro na geração do PDF de Auditoria.", "error"); }
};

app.apagarOS = async function() {
    if(app.t_role !== 'admin') { app.showToast("Cancelamento Bloqueado. Sistema Chevron Antifraude exige perfil de Dono.", "error"); return; }
    
    const m = prompt("ATENÇÃO: A Ficha Técnica será extirpada da nuvem. \nDigite a JUSTIFICATIVA REAL (Obrigatório para Auditoria Cruzada):");
    if(!m || m.trim() === '') { app.showToast("Operação Abortada pela Segurança. A justificativa é mandatória.", "error"); return; }
    
    const idField = document.getElementById('os_id'); const id = idField ? idField.value : '';
    if(!id) return;

    const osCancelada = app.bancoOSCompleto.find(x => x.id === id);
    if(osCancelada) {
        await app.registrarAuditoriaGlobal(`O.S Cancelada: ${osCancelada.placa}`, `Motivo: ${m}`);
        await app.db.collection('ordens_servico').doc(id).delete();
        app.showToast("O.S. Removida e gravada na Trilha Oculta (Lixeira).", "success");
    }
    const mod = document.getElementById('modalOS'); if(mod) bootstrap.Modal.getInstance(mod).hide();
};

// =====================================================================
// 11. CLOUDINARY E EXPORTAÇÃO LAUDO PDF (COM EVIDÊNCIAS DE AUDITORIA)
// =====================================================================
app.configurarCloudinary = function() {
    if (!app.CLOUDINARY_CLOUD_NAME || !app.CLOUDINARY_UPLOAD_PRESET) return;
    try {
        var w = cloudinary.createUploadWidget({ cloudName: app.CLOUDINARY_CLOUD_NAME, uploadPreset: app.CLOUDINARY_UPLOAD_PRESET, sources: ['local', 'camera'], language: 'pt' }, (err, res) => {
            if (!err && res && res.event === "success") { app.fotosOSAtual.push(res.info.secure_url); app.historicoOSAtual.push({ data: new Date().toISOString(), usuario: app.user_nome, acao: "Realizou injeção de Imagem / Evidência no Cloud." }); app.renderizarGaleria(); }
        });
        const btn = document.getElementById("btnUploadCloudinary"); if(btn) btn.addEventListener("click", () => w.open(), false);
    } catch(e) { console.error("Cloudinary Engine Failed: ", e); }
};

app.renderizarGaleria = function() {
    const gal = document.getElementById('galeriaFotosOS');
    if(gal) gal.innerHTML = app.fotosOSAtual.map((url, i) => `<div class="position-relative shadow-sm" style="width: 140px; height: 140px;"><img src="${url}" crossorigin="anonymous" class="img-thumbnail bg-dark border-secondary w-100 h-100 object-fit-cover rounded-3"><button type="button" data-html2canvas-ignore class="btn btn-sm btn-danger position-absolute top-0 end-0 m-2 p-0 px-2 rounded-circle" onclick="app.removerFoto(${i})"><i class="bi bi-x"></i></button></div>`).join('');
};

app.removerFoto = function(index) { app.fotosOSAtual.splice(index, 1); app.historicoOSAtual.push({ data: new Date().toISOString(), usuario: app.user_nome, acao: "Excluiu Prova Fotográfica da Base." }); app.renderizarGaleria(); };

app.renderizarHistorico = function() { 
    const hist = document.getElementById('listaHistorico');
    if(hist) {
        hist.innerHTML = app.historicoOSAtual.length === 0 ? '<p class="text-white-50 px-3">O prontuário deste veículo ainda está imaculado (Zero Edições).</p>' : [...app.historicoOSAtual].sort((a,b) => new Date(b.data) - new Date(a.data)).map(h => `
        <li class="timeline-item">
            <div class="timeline-item-header"><strong class="text-white">${h.usuario}</strong><span class="text-info small fw-bold">${new Date(h.data).toLocaleString('pt-BR')}</span></div>
            <div class="timeline-item-body text-warning shadow-sm">${h.acao}</div>
        </li>`).join(''); 
    }
};

async function carregarImagemBase64(url) {
    const res = await fetch(url); const blob = await res.blob();
    return new Promise((resolve) => { const reader = new FileReader(); reader.onloadend = () => resolve(reader.result); reader.readAsDataURL(blob); });
}

app.exportarPDFMenechelli = async function() {
    const btn = document.getElementById('btnGerarPDF'); if(!btn) return;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Renderizando Laudo...'; btn.disabled = true; 
    const placaElem = document.getElementById('os_placa'); const placa = placaElem ? placaElem.value : 'S-PLACA';
    
    try {
        const { jsPDF } = window.jspdf; const doc = new jsPDF('p', 'mm', 'a4'); const pageWidth = doc.internal.pageSize.getWidth(); let y = 15;
        
        doc.setFillColor(30, 41, 59); doc.rect(0, 0, pageWidth, 40, 'F'); doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold"); doc.setFontSize(26); doc.text(app.t_nome.toUpperCase(), pageWidth/2, 22, { align: "center" });
        doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.text(`LAUDO DE INTEGRIDADE, SERVIÇO E ORÇAMENTO`, pageWidth/2, 30, { align: "center" }); 
        y = 50; doc.setTextColor(0, 0, 0);

        doc.setDrawColor(200, 200, 200); doc.rect(15, y, pageWidth-30, 25);
        doc.setFont("helvetica", "bold"); doc.setFontSize(10);
        doc.text(`Proprietário:`, 20, y+8); doc.setFont("helvetica", "normal"); doc.text(document.getElementById('os_cliente') ? document.getElementById('os_cliente').value : '', 50, y+8);
        doc.setFont("helvetica", "bold"); doc.text(`Contato:`, 130, y+8); doc.setFont("helvetica", "normal"); doc.text(document.getElementById('os_celular') ? document.getElementById('os_celular').value : '', 150, y+8);
        doc.setFont("helvetica", "bold"); doc.text(`Identificação (Placa):`, 20, y+18); doc.setFont("helvetica", "normal"); doc.text(placa, 60, y+18);
        doc.setFont("helvetica", "bold"); doc.text(`Veículo:`, 130, y+18); doc.setFont("helvetica", "normal"); doc.text(document.getElementById('os_veiculo') ? document.getElementById('os_veiculo').value : '', 148, y+18); y += 35;
        
        doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.text(`QUEIXA NA RECEPÇÃO (CLIENTE)`, 15, y); doc.line(15, y+2, pageWidth-15, y+2); y += 10;
        doc.setFont("helvetica", "normal"); doc.setFontSize(10); 
        const relatoVal = document.getElementById('os_relato_cliente') ? document.getElementById('os_relato_cliente').value : 'Não reportada.';
        const txtQ = doc.splitTextToSize(relatoVal, pageWidth - 30); doc.text(txtQ, 15, y); y += (txtQ.length * 6) + 10;
        
        doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.text(`DIAGNÓSTICO PROFISSIONAL (OFICINA)`, 15, y); doc.line(15, y+2, pageWidth-15, y+2); y += 10;
        doc.setFont("helvetica", "normal"); doc.setFontSize(10); 
        const diagVal = document.getElementById('os_diagnostico') ? document.getElementById('os_diagnostico').value : 'Inspeção padrão de revisão técnica.';
        const txtL = doc.splitTextToSize(diagVal, pageWidth - 30); doc.text(txtL, 15, y); y += (txtL.length * 6) + 10;

        let tableBody = [];
        document.querySelectorAll('#listaPecasCorpo tr').forEach(tr => { 
            const d = tr.querySelector('.peca-desc') ? tr.querySelector('.peca-desc').value : '';
            const q = tr.querySelector('.peca-qtd') ? tr.querySelector('.peca-qtd').value : '0';
            const vu = tr.querySelector('.peca-venda') ? tr.querySelector('.peca-venda').value : '0';
            const vt = tr.querySelector('.peca-total') ? tr.querySelector('.peca-total').value : '0';
            tableBody.push([d, q, `R$ ${vu}`, `R$ ${vt}`]); 
        });
        doc.autoTable({ startY: y, head: [['Serviço ou Peça Genuína Acoplada', 'Qtd', 'Vlr. Unitário', 'Subtotal da Linha']], body: tableBody, theme: 'grid', headStyles: { fillColor: [30, 41, 59] }, margin: { left: 15, right: 15 }}); y = doc.lastAutoTable.finalY + 15;

        if (app.fotosOSAtual.length > 0) {
            if (y > 220) { doc.addPage(); y = 20; }
            doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.text(`EVIDÊNCIAS FOTOGRÁFICAS DA MANUTENÇÃO`, 15, y); doc.line(15, y+2, pageWidth-15, y+2); y += 10;
            
            let imgX = 15; let imgY = y; const imgSize = 45; const margin = 8;
            for (let i = 0; i < app.fotosOSAtual.length; i++) {
                try {
                    const b64 = await carregarImagemBase64(app.fotosOSAtual[i]);
                    if (imgX + imgSize > pageWidth - 15) { imgX = 15; imgY += imgSize + margin; }
                    if (imgY + imgSize > 280) { doc.addPage(); imgY = 20; imgX = 15; }
                    doc.addImage(b64, 'JPEG', imgX, imgY, imgSize, imgSize);
                    imgX += imgSize + margin;
                } catch (e) { console.error("Erro na imagem Base64 do PDF", e); }
            }
            y = imgY + imgSize + 15;
        }

        if (app.historicoOSAtual.length > 0) {
            if (y > 220) { doc.addPage(); y = 20; }
            doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.text(`TRILHA DE AUDITORIA E RESPONSABILIDADE (TIMELINE)`, 15, y); doc.line(15, y+2, pageWidth-15, y+2); y += 10;
            doc.setFont("helvetica", "normal"); doc.setFontSize(9);
            app.historicoOSAtual.slice().sort((a,b) => new Date(a.data) - new Date(b.data)).forEach(h => {
                const dataF = new Date(h.data).toLocaleString('pt-BR');
                const txtH = doc.splitTextToSize(`[${dataF}] ${h.usuario}: ${h.acao}`, pageWidth - 30);
                if (y + (txtH.length * 5) > 280) { doc.addPage(); y = 20; }
                doc.text(txtH, 15, y); y += (txtH.length * 5) + 3;
            });
            y += 10;
        }

        if (y > 250) { doc.addPage(); y = 20; }
        if(app.t_role === 'admin' || app.t_role === 'gerente') {
            doc.setFillColor(240, 240, 240); doc.rect(pageWidth - 85, y, 70, 15, 'F');
            doc.setFont("helvetica", "bold"); doc.setFontSize(12); 
            doc.text(`LIQUIDAÇÃO FINAL:`, pageWidth - 80, y + 10);
            const totalOSElem = document.getElementById('os_total_geral'); const totalOS = totalOSElem ? totalOSElem.innerText : 'R$ 0,00';
            doc.setTextColor(0, 128, 0); doc.text(totalOS, pageWidth - 35, y + 10);
        }

        doc.save(`OS_Auditada_${placa}_${new Date().getTime()}.pdf`);
        app.registrarAuditoriaGlobal(`Exportação de Laudo (PDF)`, `Exportou o PDF da placa ${placa}`);
        app.showToast("Laudo Oficial Auditado (PDF) Gerado e Exportado.", "success");

    } catch (erro) {
        console.error("Erro Crítico PDF Builder:", erro);
        app.showToast("Ocorreu um erro no processador PDF da Nuvem.", "error");
    } finally {
        btn.innerHTML = '<i class="bi bi-file-pdf-fill me-1"></i> Exportar Laudo e Auditoria'; btn.disabled = false;
    }
};

// =====================================================================
// 12. CÉREBRO DA I.A. (MOTOR SÊNIOR COM AUTO-FALLBACK SEGURO)
// =====================================================================
app.minhaGeminiKey = null;
app.iaTrabalhando = false; // Trava Global Anti-Spam de Simultaneidade

app.iniciarEscutaIA = function() {
    if(app.t_id) {
        app.db.collection('tenants').doc(app.t_id).onSnapshot(doc => { 
            if(doc.exists) {
                const d = doc.data();
                // Suporta tanto a estrutura nova (apiKeys.gemini) quanto legado
                app.minhaGeminiKey = (d.apiKeys && d.apiKeys.gemini) ? d.apiKeys.gemini : (d.geminiKey || d.gemini || d.apiGemini || d.api_gemini || d.apiKeyGemini || null);
                // Atualiza também as chaves de Cloudinary em tempo real
                if(d.apiKeys && d.apiKeys.cloudinaryName) { app.CLOUDINARY_CLOUD_NAME = d.apiKeys.cloudinaryName; app.configurarCloudinary(); }
                if(d.apiKeys && d.apiKeys.cloudinaryPreset) app.CLOUDINARY_UPLOAD_PRESET = d.apiKeys.cloudinaryPreset;
            }
        });
    }

    app.db.collection('conhecimento_ia').where('tenantId', '==', app.t_id).onSnapshot(snap => {
        app.bancoIA = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        app.renderizarListaIA();
    });
};

app.renderizarListaIA = function() {
    const div = document.getElementById('listaConhecimentosIA'); if(!div) return;
    if(app.bancoIA.length === 0) { div.innerHTML = '<p class="text-white-50 text-center mt-3">A Mente Cognitiva (RAG) está vazia. Importe dados.</p>'; return; }
    div.innerHTML = app.bancoIA.map(ia => `<div class="d-flex justify-content-between align-items-center bg-dark p-3 mb-2 rounded border border-secondary shadow-sm"><span class="text-white-50 text-truncate fw-bold" style="max-width: 85%;">${ia.texto}</span><button class="btn btn-sm btn-outline-danger border-0" onclick="app.apagarConhecimentoIA('${ia.id}')"><i class="bi bi-trash-fill"></i></button></div>`).join('');
};

app.salvarConhecimentoIA = async function(textoAvulso = null) {
    const textarea = document.getElementById('iaConhecimentoTexto'); const valor = textoAvulso || (textarea ? textarea.value.trim() : '');
    if(!valor) { app.showToast("O input de dados não pode ser vazio.", "warning"); return; }
    await app.db.collection('conhecimento_ia').add({ tenantId: app.t_id, texto: valor, dataImportacao: new Date().toISOString() });
    app.showToast("Conhecimento gravado.", "success"); if(textarea && !textoAvulso) textarea.value = '';
};

app.apagarConhecimentoIA = async function(id) {
    if(confirm("Deseja apagar esta memória?")) {
        await app.db.collection('conhecimento_ia').doc(id).delete(); app.showToast("Memória apagada.", "success");
    }
};

app.processarArquivoParaIA = function(event) {
    const file = event.target.files[0]; if(!file) return;
    const statusLabel = document.getElementById('iaFileStatus');
    if(statusLabel) { statusLabel.className = "text-warning fw-bold d-block text-center"; statusLabel.innerText = "Lendo matriz física do arquivo e traduzindo para RAG..."; }
    
    const reader = new FileReader();
    reader.onload = async function(e) {
        const text = e.target.result; const txtLimpo = text.substring(0, 10000);
        await app.salvarConhecimentoIA(`[ARQUIVO IMPORTADO: ${file.name}]\n\n${txtLimpo}`);
        if(statusLabel) { statusLabel.className = "text-success fw-bold d-block text-center"; statusLabel.innerText = "Aquisição concluída!"; setTimeout(() => { statusLabel.innerText = ""; }, 5000); }
    };
    reader.readAsText(file); 
};

// CONECTOR BLINDADO COM DESVIO INSTANTÂNEO DE ROTA (SEM ERRO 404)
app.chamarGemini = async function(prompt, sysInstruction) {
    const key = app.minhaGeminiKey || sessionStorage.getItem('t_gemini');
    
    if(!key || key === 'null' || key === 'undefined') { 
        app.showToast("A chave da IA não foi encontrada no banco.", "error"); 
        return "Erro: Google Gemini API Key ausente na oficina."; 
    }

    const payloadOptions = {
        method: 'POST', 
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            systemInstruction: { parts: [{ text: sysInstruction }] },
            generationConfig: { temperature: 0.1 }
        })
    };

    try {
        // Tenta PRIMEIRO o modelo do Admin (2.5-flash)
        // Rota principal: gemini-2.0-flash (modelo estável e amplamente disponível em 2025/2026)
        let res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`, payloadOptions);
        
        // Se a Google bloquear por Simultaneidade (429), quota (403) ou erro temporário...
        if (!res.ok) {
            console.warn("Rota 2.0-flash indisponível. Acionando rota secundária 1.5-flash-latest...");
            // Rota segura de fallback: gemini-1.5-flash-latest (nome correto com sufixo -latest)
            res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${key}`, payloadOptions);
        }

        const data = await res.json(); 
        if(data.error) throw new Error(data.error.message);
        
        return data.candidates[0].content.parts[0].text;
    } catch(e) { 
        console.error(e);
        return "A I.A. da Google bloqueou a requisição. Aguarde 1 minuto e faça a pergunta novamente sem clicar em outros botões ao mesmo tempo. Erro: " + e.message; 
    }
};

app.perguntarJarvis = async function() {
    if(app.iaTrabalhando) return; // Se o radar estiver rodando, ignora o clique
    
    const inp = document.getElementById('jarvisInput'); const resDiv = document.getElementById('jarvisResposta');
    if(!inp || !inp.value) return; 
    
    app.iaTrabalhando = true; // Trava a API
    resDiv.classList.remove('d-none'); 
    resDiv.innerHTML = '<span class="spinner-border text-info spinner-border-sm me-2"></span> J.A.R.V.I.S está analisando...';

    const ctx = { 
        manuais: app.bancoIA.map(ia => ia.texto), 
        patio: app.bancoOSCompleto.filter(o=>o.status !== 'entregue').map(o => ({placa: o.placa, def: o.relatoCliente, st: o.status})) 
    };
    
    const sys = `Você é o J.A.R.V.I.S, o consultor virtual da oficina "${app.t_nome}".\nDADOS DA OFICINA: ${JSON.stringify(ctx)}\nRegra absoluta: Responda de forma direta e COMPROVE as fontes se basear em algum manual. Não invente dados.`;
    
    const resposta = await app.chamarGemini(inp.value, sys);
    resDiv.innerHTML = resposta.replace(/\n/g, '<br>');
    
    inp.value = '';
    app.iaTrabalhando = false; // Libera a API
};

app.perguntarJarvisMecanico = async function() {
    if(app.iaTrabalhando) return;
    
    const inp = document.getElementById('jarvisInputMecanico'); const resDiv = document.getElementById('jarvisRespostaMecanico');
    if(!inp || !inp.value) return; 
    
    app.iaTrabalhando = true;
    resDiv.classList.remove('d-none'); 
    resDiv.innerHTML = '<span class="spinner-border text-info spinner-border-sm me-2"></span> Procurando nos manuais...';

    const ctx = { manuais: app.bancoIA.map(ia => ia.texto) };
    const sys = `Você atua como Mecânico Chefe da oficina "${app.t_nome}".\nMANUAIS (RAG): ${JSON.stringify(ctx)}\nRegra: Responda direto e CITE a fonte se usar um manual. Jamais invente especificações.`;
    
    const resposta = await app.chamarGemini(inp.value, sys);
    resDiv.innerHTML = resposta.replace(/\n/g, '<br>');
    
    inp.value = '';
    app.iaTrabalhando = false;
};

app.jarvisAnalisarRevisoes = async function() {
    if(app.iaTrabalhando) {
        app.showToast("Aguarde a IA terminar a tarefa atual.", "warning");
        return;
    }
    
    const div = document.getElementById('jarvisCRMInsights'); if(!div) return;
    
    app.iaTrabalhando = true;
    div.innerHTML = '<span class="spinner-border text-warning spinner-border-sm me-2"></span> Escaneando Histórico...';
    
    const historicoMorto = app.bancoOSCompleto.filter(o => o.status === 'entregue');
    if(historicoMorto.length === 0) { 
        div.innerHTML = '<span class="text-white-50">Não há registros suficientes.</span>'; 
        app.iaTrabalhando = false;
        return; 
    }
    
    const ctx = { 
        historico: historicoMorto.slice(-50).map(o => ({ dt: new Date(o.ultimaAtualizacao).toLocaleDateString('pt-BR'), cli: o.cliente, pl: o.placa })) 
    };

    const sys = `Gestor de Remarketing da oficina ${app.t_nome}.\nBASE:\n${JSON.stringify(ctx)}\nTarefa: Encontre clientes para telefonarmos HOJE oferecendo revisão. Devolva em HTML <li> com o motivo técnico.`;
    
    const resposta = await app.chamarGemini("Analise o histórico e me dê os clientes para remarketing.", sys);
    div.innerHTML = resposta;
    app.iaTrabalhando = false;
};
