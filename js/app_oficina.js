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

app.CLOUDINARY_CLOUD_NAME = sessionStorage.getItem('t_cloudName') || 'dmuvm1o6m';
app.CLOUDINARY_UPLOAD_PRESET = sessionStorage.getItem('t_cloudPreset') || 'evolution';
app.API_KEY_GEMINI = sessionStorage.getItem('t_gemini');
app.t_id = sessionStorage.getItem('t_id');
app.t_nome = sessionStorage.getItem('t_nome');
app.t_role = sessionStorage.getItem('t_role');
app.user_nome = sessionStorage.getItem('f_nome');
app.user_comissao = parseFloat(sessionStorage.getItem('f_comissao') || 0);
app.t_mods = JSON.parse(sessionStorage.getItem('t_mods') || '{}');

if (!app.t_id && !sessionStorage.getItem('thiaguinho_master')) window.location.replace('index.html');

app.bancoOSCompleto = [];
app.bancoEstoque = [];
app.bancoFin = [];
app.bancoCrm = [];
app.bancoIA = [];
app.bancoMensagens = [];
app.fotosOSAtual = [];
app.historicoOSAtual = [];
app.osParaFaturar = null;
app.chatActiveClienteId = null;

// =====================================================================
// 2. INICIALIZAÇÃO DA INTERFACE (RBAC)
// =====================================================================
document.addEventListener('DOMContentLoaded', () => {
    const lblEmpresa = document.getElementById('lblEmpresa');
    if (lblEmpresa) lblEmpresa.innerText = app.t_nome;
    const lblUsuario = document.getElementById('lblUsuario');
    if (lblUsuario) lblUsuario.innerText = app.user_nome;
    
    const style = document.createElement('style');    const lblComissao = document.getElementById('lblComissaoUser');
    if (app.t_role === 'equipe') {
        style.innerHTML = '.admin-only, .gestao-only { display: none !important; } .mecanico-only { display: flex !important;}';
        if (lblComissao) lblComissao.innerText = `Mecânico - Produção: ${app.user_comissao}%`;
    } else if (app.t_role === 'gerente') {
        style.innerHTML = '.admin-only, .mecanico-only { display: none !important; } .gestao-only { display: block !important;} tr .gestao-only { display: table-cell !important; }';
        if (lblComissao) lblComissao.innerText = `Gestor / Vendedor`;
    } else {
        style.innerHTML = '.mecanico-only { display: none !important;}';
        if (lblComissao) lblComissao.innerText = `Admin Proprietário`;
    }
    document.head.appendChild(style);

    app.construirMenuLateral();
    const linkInicio = document.querySelector('.nav-sidebar .nav-link');
    if(linkInicio) app.mostrarTela('tela_jarvis', 'Inteligência Automotiva', linkInicio);
    
    app.iniciarEscutaOS();
    app.iniciarEscutaCrm();
    app.iniciarEscutaMensagens();
    
    if(app.t_role === 'admin' || app.t_role === 'gerente') {
        app.iniciarEscutaEstoque();
        app.iniciarEscutaFinanceiro();
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
    const t = document.createElement('div');
    t.innerHTML = `<div class="toast align-items-center text-white ${bg} border-0 show p-3 mt-2 shadow-lg rounded-3"><div class="d-flex"><div class="toast-body fw-bold">${msg}</div><button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button></div></div>`;
    document.getElementById('toastContainer').appendChild(t.firstChild);
    setTimeout(() => { if(t.firstChild) t.firstChild.remove() }, 5000);
};

app.sair = function() { sessionStorage.clear(); window.location.href = 'index.html'; };

app.construirMenuLateral = function() {
    const menu = document.getElementById('menuLateral');
    if (!menu) return;

    let html = `<a class="nav-link active" onclick="app.mostrarTela('tela_jarvis', 'Inteligência Automotiva', this)"><i class="bi bi-robot"></i> Central J.A.R.V.I.S</a>`;
    html += `<a class="nav-link" onclick="app.mostrarTela('tela_os', 'Pátio Ativo', this)"><i class="bi bi-kanban text-info"></i> Pátio Kanban</a>`;
    html += `<a class="nav-link" onclick="app.mostrarTela('tela_arquivo', 'Arquivo Histórico', this); app.renderizarTabelaArquivo();"><i class="bi bi-archive text-warning"></i> Arquivo Morto</a>`;    
    if (app.t_role === 'admin' || app.t_role === 'gerente') {
        html += `<a class="nav-link" onclick="app.mostrarTela('tela_crm', 'Base CRM', this)"><i class="bi bi-person-vcard text-info"></i> CRM e Clientes</a>`;
        html += `<a class="nav-link" onclick="app.mostrarTela('tela_chat', 'Chat CRM Global', this)"><i class="bi bi-chat-dots-fill text-primary"></i> Chat Global <span id="chatBadgeGlobal" class="badge bg-danger badge-nav d-none">0</span></a>`;
        html += `<a class="nav-link" onclick="app.mostrarTela('tela_estoque', 'Almoxarifado', this)"><i class="bi bi-box-seam text-primary"></i> Estoque Físico</a>`;
        html += `<a class="nav-link" onclick="app.mostrarTela('tela_financeiro', 'DRE e Caixas', this)"><i class="bi bi-bank text-success"></i> Financeiro (Caixa)</a>`;
    }
    if (app.t_role === 'admin') {
        html += `<a class="nav-link" onclick="app.mostrarTela('tela_ia', 'Treinamento I.A.', this)"><i class="bi bi-database-fill-up text-warning"></i> Treinamento I.A.</a>`;
        html += `<a class="nav-link" onclick="app.mostrarTela('tela_equipe', 'Gestão da Equipe', this)"><i class="bi bi-people-fill text-success"></i> Equipe e Acessos</a>`;
    }
    menu.innerHTML = html;
};

app.mostrarTela = function(id, titulo, btn) {
    document.querySelectorAll('.modulo-tela').forEach(t => t.style.display = 'none');
    const tela = document.getElementById(id);
    if(tela) tela.style.display = 'block';
    const hTitulo = document.getElementById('tituloPagina');
    if(hTitulo) hTitulo.innerText = titulo;
    if(btn) { document.querySelectorAll('.nav-link').forEach(b => b.classList.remove('active')); btn.classList.add('active'); }
};

// =====================================================================
// 3. BASE CRM E CREDENCIAIS
// =====================================================================
app.iniciarEscutaCrm = function() {
    app.db.collection('clientes_base').where('tenantId', '==', app.t_id).onSnapshot(snap => {
        app.bancoCrm = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const tb = document.getElementById('tabelaCrmCorpo');
        if(tb) {
            tb.innerHTML = app.bancoCrm.map(c => `<tr><td><strong class="text-white">${c.nome}</strong></td><td>${c.telefone}</td><td>${c.documento||'-'}</td><td><span class="text-info">${c.usuario || 'Sem Acesso'}</span></td><td class="gestao-only text-end"><button class="btn btn-sm btn-outline-info me-1 border-0" onclick="app.abrirModalCRM('edit', '${c.id}')"><i class="bi bi-pencil"></i></button><button class="btn btn-sm btn-outline-danger border-0 admin-only" onclick="app.apagarCliente('${c.id}')"><i class="bi bi-trash"></i></button></td></tr>`).join('');
        }
        const list = document.getElementById('listaClientesCRM');
        if(list) list.innerHTML = app.bancoCrm.map(c => `<option value="${c.nome}" data-id="${c.id}">Tel: ${c.telefone}</option>`).join('');
        app.renderListaChatCRM();
    });
};

app.abrirModalCRM = function(mode = 'nova', id = '') {
    document.getElementById('c_id').value = '';
    document.getElementById('c_nome').value = ''; document.getElementById('c_tel').value = ''; document.getElementById('c_doc').value = '';
    document.getElementById('c_user').value = ''; document.getElementById('c_pass').value = Math.random().toString(36).slice(-6); document.getElementById('c_notas').value = '';
    
    if(mode === 'edit') {
        const c = app.bancoCrm.find(x => x.id === id);
        if(c) {
            document.getElementById('c_id').value = c.id; document.getElementById('c_nome').value = c.nome; document.getElementById('c_tel').value = c.telefone; document.getElementById('c_doc').value = c.documento||'';
            document.getElementById('c_user').value = c.usuario||''; document.getElementById('c_pass').value = c.senha||''; document.getElementById('c_notas').value = c.anotacoes||'';
        }    }
};

app.salvarClienteCRM = async function(e) {
    e.preventDefault();
    const id = document.getElementById('c_id').value;
    const doc = document.getElementById('c_doc').value.replace(/\D/g, '');
    const payload = { tenantId: app.t_id, nome: document.getElementById('c_nome').value, telefone: document.getElementById('c_tel').value, documento: doc, usuario: document.getElementById('c_user').value.trim(), senha: document.getElementById('c_pass').value.trim(), anotacoes: document.getElementById('c_notas').value };
    
    if(id) { await app.db.collection('clientes_base').doc(id).update(payload); app.showToast("Ficha atualizada.", "success"); } 
    else { await app.db.collection('clientes_base').add(payload); app.showToast("Novo cliente registrado.", "success"); }
    e.target.reset(); bootstrap.Modal.getInstance(document.getElementById('modalCrm')).hide();
};

app.apagarCliente = async function(id) {
    if(app.t_role !== 'admin') { app.showToast("Apenas proprietário pode apagar cliente.", "error"); return; }
    if(confirm("Apagar cliente? A base de dados será impactada.")) { await app.db.collection('clientes_base').doc(id).delete(); app.showToast("Removido.", "success"); }
};

app.aoSelecionarClienteOS = function() {
    const nomeDigitado = document.getElementById('os_cliente').value.trim();
    const cliente = app.bancoCrm.find(c => c.nome.toLowerCase() === nomeDigitado.toLowerCase());
    if(cliente) { document.getElementById('os_celular').value = cliente.telefone || ''; document.getElementById('os_cliente_id').value = cliente.id; }
};

app.enviarWhatsAppAprovacao = function() {
    const nome = document.getElementById('os_cliente').value;
    const cel = document.getElementById('os_celular').value;
    const cZ = app.bancoCrm.find(x => x.nome === nome);
    if(!cel) return app.showToast("Cliente sem celular cadastrado.", "error");
    
    let baseURL = window.location.origin + window.location.pathname.replace('painel_oficina.html', '');
    const u = baseURL + 'clientes/projeto_oficina.html';
    
    let txt = `Olá ${nome}! A O.S. do seu veículo foi atualizada na *${app.t_nome}*.\n\nAcesse o nosso portal oficial para visualizar o orçamento detalhado, ver fotos e nos contatar pelo chat da plataforma:\n👉 ${u}`;
    if(cZ && cZ.usuario) { txt += `\n\n*Suas Credenciais Seguras:*\nLogin: ${cZ.usuario}\nPIN: ${cZ.senha}`; }
    
    window.open(`https://wa.me/55${cel.replace(/\D/g, '')}?text=${encodeURIComponent(txt)}`, '_blank');
};

// =====================================================================
// 4. MÓDULO DE CHAT GLOBAL CRM
// =====================================================================
app.iniciarEscutaMensagens = function() {
    app.db.collection('mensagens').where('tenantId', '==', app.t_id).onSnapshot(snap => {
        app.bancoMensagens = snap.docs.map(d => ({id: d.id, ...d.data()}));
        app.bancoMensagens.sort((a,b) => (a.timestamp?.toMillis()||0) - (b.timestamp?.toMillis()||0));
        
        let nL = 0;
        app.bancoMensagens.forEach(m => { if(m.sender === 'cliente' && !m.lidaAdmin) nL++; });        
        const badge = document.getElementById('chatBadgeGlobal');
        if(badge) {
            if(nL > 0) { badge.innerText = nL; badge.classList.remove('d-none'); } 
            else { badge.classList.add('d-none'); }
        }
        
        app.renderListaChatCRM();
        if(app.chatActiveClienteId) {
            const h = document.getElementById('chatNomeCliente');
            app.abrirChatCRM(app.chatActiveClienteId, h ? h.innerText.replace('Ativo com: ', '') : 'Cliente');
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
    const header = document.getElementById('chatNomeCliente');
    if(header) header.innerHTML = `<span class="text-white-50">Ativo com:</span> <b class="text-accent fs-5">${nomeCliente}</b>`;
    
    const inputArea = document.getElementById('chatAreaInputGlobal');
    if(inputArea) inputArea.style.display = 'flex';
    
    const area = document.getElementById('chatAreaMsgGlobal');
    if(!area) return;
    area.innerHTML = '';
    
    const mD = app.bancoMensagens.filter(x => x.clienteId === clienteId);
    if(mD.length === 0) {
        area.innerHTML = '<div class="text-center text-white-50 mt-5 pt-5"><i class="bi bi-chat-dots display-1 mb-4 opacity-50"></i><p>Inicie o Atendimento.</p></div>';
    } else {
        mD.forEach(x => {
            if(x.sender === 'cliente' && !x.lidaAdmin) { app.db.collection('mensagens').doc(x.id).update({lidaAdmin: true}); }
            const t = x.timestamp ? new Date(x.timestamp.toDate()).toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'}) : 'agora';
            let c = x.text;
            
            if(x.fileUrl) {                if(x.fileType === 'video' || x.fileUrl.includes('.mp4')) c += `<br><video src="${x.fileUrl}" controls style="max-width:100%; border-radius:8px; margin-top:5px;"></video>`;
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
    const input = document.getElementById('inputChatGlobal');
    const val = input ? input.value.trim() : '';
    if(!val || !app.chatActiveClienteId) return;
    
    await app.db.collection('mensagens').add({
        tenantId: app.t_id, clienteId: app.chatActiveClienteId, sender: 'admin', 
        text: val, lidaCliente: false, timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    input.value = '';
};

app.enviarAnexoChatGlobal = async function() {
    const inp = document.getElementById('chatFileInputGlobal');
    if(!inp || !inp.files || inp.files.length === 0 || !app.chatActiveClienteId) return;
    
    app.showToast("Fazendo upload e enviando o anexo...", "warning");
    try {
        const fd = new FormData();
        fd.append('file', inp.files[0]); fd.append('upload_preset', app.CLOUDINARY_UPLOAD_PRESET);
        const res = await fetch(`https://api.cloudinary.com/v1_1/${app.CLOUDINARY_CLOUD_NAME}/auto/upload`, {method:'POST', body:fd});
        const data = await res.json();
        if(data.secure_url) {
            await app.db.collection('mensagens').add({
                tenantId: app.t_id, clienteId: app.chatActiveClienteId, sender: 'admin', 
                text: "📎 Mídia da Oficina:", fileUrl: data.secure_url, fileType: data.resource_type, 
                lidaCliente: false, timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
            inp.value = ''; app.showToast("Anexo enviado para o portal do cliente!", "success");
        }
    } catch(e) { console.error(e); app.showToast("Falha no upload do Cloudinary.", "error"); }
};

// =====================================================================
// 5. ESTOQUE E ENTRADA N.F. INFINITA
// =====================================================================
app.iniciarEscutaEstoque = function() {
    app.db.collection('estoque').where('tenantId', '==', app.t_id).onSnapshot(snap => {
        app.bancoEstoque = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));        const tbody = document.getElementById('tabelaEstoqueCorpo');
        if(tbody) {
            tbody.innerHTML = app.bancoEstoque.map(p => `<tr><td><small class="text-white-50">${p.fornecedor||'N/A'}</small><br><span class="badge bg-primary">NF: ${p.nf||'S/N'}</span></td><td><strong class="text-white">${p.desc}</strong></td><td><span class="badge bg-secondary px-3 py-2 fs-6 shadow-sm">${p.qtd} un</span></td><td class="gestao-only text-danger fw-bold">R$ ${p.custo.toFixed(2)}</td><td class="text-success fw-bold fs-6">R$ ${p.venda.toFixed(2)}</td><td class="admin-only text-end"><button class="btn btn-sm btn-outline-danger shadow-sm" onclick="app.db.collection('estoque').doc('${p.id}').delete()"><i class="bi bi-trash-fill"></i></button></td></tr>`).join('');
        }
        const sel = document.getElementById('selectProdutoEstoque');
        if(sel) {
            sel.innerHTML = '<option value="">Puxar Peça do Estoque Físico...</option>' + app.bancoEstoque.filter(p=>p.qtd>0).map(p => `<option value="${p.id}" data-venda="${p.venda}" data-custo="${p.custo}" data-desc="${p.desc}">[Est: ${p.qtd}] - ${p.desc} (R$ ${p.venda.toFixed(2)})</option>`).join('');
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
                app.adicionarLinhaNF(desc, ncm, cfop, qtd, vUnCom, (vUnCom * 1.8));
            }
        }
        app.showToast("XML processado. Itens inseridos!", "success");
    };
    reader.readAsText(file);
};

app.adicionarLinhaNF = function(desc='', ncm='', cfop='', qtd=1, custo=0, venda=0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td><input type="text" class="form-control form-control-sm bg-dark text-white border-secondary p-1 it-desc" value="${desc}" required></td><td><input type="text" class="form-control form-control-sm bg-dark text-white border-secondary p-1 it-ncm" value="${ncm}"></td><td><input type="text" class="form-control form-control-sm bg-dark text-white border-secondary p-1 it-cfop" value="${cfop}"></td><td><input type="number" class="form-control form-control-sm bg-dark text-white border-secondary p-1 it-qtd" value="${qtd}" min="1"></td><td><input type="number" step="0.01" class="form-control form-control-sm bg-dark text-danger border-secondary p-1 it-custo" value="${custo}"></td><td><input type="number" step="0.01" class="form-control form-control-sm bg-dark text-success border-secondary p-1 it-venda fw-bold" value="${venda}"></td><td><button type="button" class="btn btn-sm btn-outline-danger p-1 border-0" onclick="this.closest('tr').remove()"><i class="bi bi-trash"></i></button></td>`;
    document.getElementById('corpoItensNF').appendChild(tr);};

app.verificarPgtoCompraNF = function() {
    const f = document.getElementById('nf_metodo_pagamento').value;
    const d = document.getElementById('nf_div_parcelas');
    if(d) d.style.display = f.includes('Parcelado') ? 'block' : 'none';
};

app.salvarEntradaEstoque = async function(e) {
    e.preventDefault();
    const fornecedor = document.getElementById('nf_fornecedor').value; 
    const nf = document.getElementById('nf_numero').value;
    const dtBase = document.getElementById('nf_data').value || new Date().toISOString().split('T')[0];
    const fp = document.getElementById('nf_metodo_pagamento').value; 
    const parc = document.getElementById('nf_parcelas').value;
    const gerarFinanceiro = document.getElementById('nf_gerar_financeiro').checked;
    
    let totalCustoGlobalNF = 0;
    const batch = app.db.batch();
    
    document.querySelectorAll('#corpoItensNF tr').forEach(tr => {
        const desc = tr.querySelector('.it-desc').value.trim();
        const q = parseFloat(tr.querySelector('.it-qtd').value)||0;
        const c = parseFloat(tr.querySelector('.it-custo').value)||0;
        const v = parseFloat(tr.querySelector('.it-venda').value)||0;
        
        if(desc !== '' && q > 0) {
            totalCustoGlobalNF += (q * c);
            const ref = app.db.collection('estoque').doc();
            batch.set(ref, { tenantId: app.t_id, fornecedor: fornecedor, nf: nf, desc: desc, qtd: q, custo: c, venda: v, ncm: tr.querySelector('.it-ncm').value, cfop: tr.querySelector('.it-cfop').value, usuarioEntrada: app.user_nome, dataEntrada: new Date().toISOString() });
        }
    });

    if(totalCustoGlobalNF === 0) {
        app.showToast("Nenhum item válido para dar entrada.", "error"); return;
    }

    if(gerarFinanceiro) {
        let nP = 1; 
        if(fp.includes('Parcelado')) { 
            if(parc.includes('2x')) nP = 2; else if(parc.includes('3x')) nP = 3; else if(parc.includes('4x')) nP = 4; else if(parc.includes('6x')) nP = 6; 
        }
        const vP = totalCustoGlobalNF / nP; 
        const stsPgto = (fp.includes('Boleto') || fp.includes('Pendente') || fp.includes('Parcelado') || fp.includes('Crédito')) ? 'pendente' : 'pago';
        
        for(let i=0; i<nP; i++) { 
            let dV = new Date(dtBase); 
            if(nP>1 || stsPgto==='pendente') dV.setDate(dV.getDate() + (i*30)); 
            batch.set(app.db.collection('financeiro').doc(), { 
                tenantId: app.t_id, tipo: 'despesa',                 desc: nP>1 ? `NF Compra: ${nf} (${fornecedor}) - Parc ${i+1}/${nP}` : `NF Compra: ${nf} (${fornecedor})`, 
                valor: vP, parcelaAtual: i+1, totalParcelas: nP, metodo: fp, vencimento: dV.toISOString().split('T')[0], status: stsPgto 
            }); 
        }
    }

    await batch.commit();
    app.showToast("NF processada. Estoque alimentado e Financeiro integrado!", "success");
    e.target.reset(); 
    bootstrap.Modal.getInstance(document.getElementById('modalNF')).hide();
};

// =====================================================================
// 6. MOTOR KANBAN E PRONTUÁRIO
// =====================================================================
app.iniciarEscutaOS = function() {
    app.db.collection('ordens_servico').where('tenantId', '==', app.t_id).onSnapshot(snap => {
        app.bancoOSCompleto = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        if(app.t_role === 'equipe') {
            let minhaCom = 0;
            app.bancoOSCompleto.filter(o => o.status === 'entregue' && o.mecanicoReal === app.user_nome).forEach(o => minhaCom += (o.comissaoProcessada||0));
            const lbl = document.getElementById('kpiMinhaComissao'); if(lbl) lbl.innerText = `R$ ${minhaCom.toFixed(2).replace('.',',')}`;
        }
        
        app.renderizarKanban();
        app.renderizarTabelaArquivo();
    });
};

app.filtrarGlobal = function() { app.renderizarKanban(); app.renderizarTabelaArquivo(); };

app.renderizarKanban = function() {
    const t = document.getElementById('buscaGeral').value.toLowerCase().trim();
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
        
        let btnBack = prevS ? `<button class="btn btn-sm btn-dark p-1 px-2 border-secondary shadow-sm me-1" onclick="event.stopPropagation(); app.mudarStatusRapido('${os.id}', '${prevS}')" title="Voltar Fase"><i class="bi bi-arrow-left-circle text-white-50"></i></button>` : '';        let btnFwd = s === 'pronto' ? `<button class="btn btn-sm btn-success p-1 px-3 shadow fw-bold gestao-only" onclick="event.stopPropagation(); app.abrirFaturamentoDireto('${os.id}')"><i class="bi bi-cash-coin me-1"></i> FATURAR</button>` : `<button class="btn btn-sm btn-dark p-1 px-2 border-secondary shadow-sm" onclick="event.stopPropagation(); app.mudarStatusRapido('${os.id}', '${nextS}')" title="Avançar Fase"><i class="bi bi-arrow-right-circle text-info"></i></button>`;

        cols[s] += `<div class="os-card border-start border-4 ${cor}" onclick="app.abrirModalOS('edit', '${os.id}')"><div class="fast-actions">${btnBack}${btnFwd}</div><div class="d-flex justify-content-between mb-2"><span class="badge bg-dark border border-secondary text-white py-2 px-3">${os.placa}</span></div><h6 class="text-white fw-bold mb-1 w-75 text-truncate">${os.veiculo}</h6><small class="text-white-50"><i class="bi bi-person-fill"></i> ${os.cliente}</small></div>`;
    });
    
    ordem.forEach(id => { 
        const el = document.getElementById('col_'+id); 
        const countEl = document.getElementById('count_'+id);
        if(el) el.innerHTML = cols[id]; 
        if(countEl) countEl.innerText = counts[id]; 
    });
};

app.mudarStatusRapido = async function(id, novoStatus) {
    const osRef = app.db.collection('ordens_servico').doc(id);
    const doc = await osRef.get();
    let h = doc.data().historico || [];
    h.push({  new Date().toISOString(), usuario: app.user_nome, acao: `Card movido pelo pátio para: ${novoStatus.toUpperCase()}` });
    await osRef.update({ status: novoStatus, historico: h, ultimaAtualizacao: new Date().toISOString() });
};

// =====================================================================
// 7. MODAL DA O.S E COMPOSIÇÃO INFINITA DE ORÇAMENTO
// =====================================================================
app.verificarStatusLink = function() {
    const a = document.getElementById('alertaLinkCliente');
    if(!a) return;
    if (document.getElementById('os_status').value === 'aprovacao' && document.getElementById('os_id').value) a.classList.remove('d-none'); else a.classList.add('d-none');
};

app.abrirModalOS = function(mode = 'nova', id = '') {
    document.getElementById('formOS').reset();
    document.getElementById('listaPecasCorpo').innerHTML = '';
    app.fotosOSAtual = []; app.historicoOSAtual = [];
    document.getElementById('header_placa').innerText = '';
    document.getElementById('listaHistorico').innerHTML = '';
    document.getElementById('galeriaFotosOS').innerHTML = '';
    
    const btnFat = document.getElementById('btnFaturar'); if(btnFat) btnFat.classList.add('d-none');
    const btnPdf = document.getElementById('btnGerarPDF'); if(btnPdf) btnPdf.classList.add('d-none');
    const btnDel = document.getElementById('btnDeletarOS'); if(btnDel) btnDel.classList.add('d-none');
    
    ['chk_combustivel', 'chk_arranhado', 'chk_bateria', 'chk_pneus'].forEach(i => { const chk = document.getElementById(i); if(chk) chk.checked = false; });

    if (mode === 'edit') {
        const os = app.bancoOSCompleto.find(x => x.id === id);
        if (os) {
            document.getElementById('os_id').value = os.id;
            document.getElementById('os_placa').value = os.placa || '';
            document.getElementById('header_placa').innerText = `[${os.placa}]`;            document.getElementById('os_veiculo').value = os.veiculo || '';
            document.getElementById('os_cliente').value = os.cliente || '';
            document.getElementById('os_cliente_id').value = os.clienteId || '';
            
            const cZ = app.bancoCrm.find(c => c.nome === os.cliente);
            document.getElementById('os_celular').value = cZ ? cZ.telefone : (os.celular || '');
            
            document.getElementById('os_status').value = os.status || 'patio';
            document.getElementById('os_relato_cliente').value = os.relatoCliente || '';
            document.getElementById('os_diagnostico').value = os.diagnostico || '';
            
            if(os.chk_combustivel) document.getElementById('chk_combustivel').checked = true;
            if(os.chk_arranhado) document.getElementById('chk_arranhado').checked = true;
            if(os.chk_bateria) document.getElementById('chk_bateria').checked = true;
            if(os.chk_pneus) document.getElementById('chk_pneus').checked = true;
            
            if (os.fotos) { app.fotosOSAtual = os.fotos; app.renderizarGaleria(); }
            if (os.historico) { app.historicoOSAtual = os.historico; app.renderizarHistorico(); }
            
            if (os.pecas) os.pecas.forEach(p => app.adicionarLinhaPeca(p.desc, p.qtd, p.custo, p.venda, p.idEstoque, p.isMaoObra));
            
            if(btnPdf) btnPdf.classList.remove('d-none');
            if (os.status === 'pronto' && (app.t_role === 'admin' || app.t_role === 'gerente') && btnFat) btnFat.classList.remove('d-none');
            if (app.t_role === 'admin' && btnDel) btnDel.classList.remove('d-none');
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
    app.adicionarLinhaPeca(opt.dataset.desc, 1, parseFloat(opt.dataset.custo), parseFloat(opt.dataset.venda), sel.value, false);
    sel.value = '';
};

app.adicionarMaoDeObra = function() { app.adicionarLinhaPeca("Serviço / Mão de Obra", 1, 0, 0, null, true); };

app.adicionarLinhaPeca = function(desc, qtd, custo, venda, idEstoque, isMaoObra) {
    const tr = document.createElement('tr');
    const mo = isMaoObra ? `data-maoobra="true"` : '';
    const est = idEstoque ? `data-idestoque="${idEstoque}" readonly` : '';
    tr.innerHTML = `<td><input type="text" class="form-control form-control-sm bg-dark text-white border-secondary peca-desc p-2" value="${desc}" ${est} ${mo} placeholder="Descreva..."></td>
        <td><input type="number" class="form-control form-control-sm bg-dark text-white border-secondary peca-qtd p-2" value="${qtd}" min="1" onchange="app.calcularTotalOS()"></td>
        <td class="gestao-only"><input type="number" step="0.01" class="form-control form-control-sm bg-dark text-danger border-secondary peca-custo p-2" value="${custo}" onchange="app.calcularTotalOS()"></td>
        <td><input type="number" step="0.01" class="form-control form-control-sm bg-dark text-success border-secondary peca-venda p-2 fw-bold" value="${venda}" onchange="app.calcularTotalOS()"></td>
        <td><input type="text" class="form-control form-control-sm bg-black text-white border-0 peca-total fw-bold p-2" readonly value="0.00"></td>        <td class="text-center"><button type="button" class="btn btn-sm btn-outline-danger border-0 mt-1" onclick="this.closest('tr').remove(); app.calcularTotalOS()"><i class="bi bi-trash"></i></button></td>`;
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
    if(divGeral) divGeral.innerText = `R$ ${t.toFixed(2).replace('.',',')}`;
    return t;
};

app.salvarOS = async function() {
    const id = document.getElementById('os_id').value;
    let pecasArray = []; let tVenda = 0; let tCusto = 0; let tMO = 0;
    const clienteOS = document.getElementById('os_cliente').value.trim();
    const telOS = document.getElementById('os_celular').value.trim();

    let cId = document.getElementById('os_cliente_id').value;
    if(clienteOS && !app.bancoCrm.find(c => c.nome.toLowerCase() === clienteOS.toLowerCase())) {
        const p = { tenantId: app.t_id, nome: clienteOS, telefone: telOS, usuario: '', senha: '' };
        const d = await app.db.collection('clientes_base').add(p);
        cId = d.id;
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
        veiculo: document.getElementById('os_veiculo').value, cliente: clienteOS, clienteId: cId, celular: telOS,
        status: document.getElementById('os_status').value, relatoCliente: document.getElementById('os_relato_cliente').value,
        diagnostico: document.getElementById('os_diagnostico').value,
        chk_combustivel: document.getElementById('chk_combustivel') ? document.getElementById('chk_combustivel').checked : false, 
        chk_arranhado: document.getElementById('chk_arranhado') ? document.getElementById('chk_arranhado').checked : false,
        chk_bateria: document.getElementById('chk_bateria') ? document.getElementById('chk_bateria').checked : false, 
        chk_pneus: document.getElementById('chk_pneus') ? document.getElementById('chk_pneus').checked : false,        pecas: pecasArray, total: tVenda, custoTotal: tCusto, maoObraTotal: tMO, fotos: app.fotosOSAtual,
        historico: app.historicoOSAtual, ultimaAtualizacao: new Date().toISOString()
    };
    
    if (!id) payload.mecanico = app.user_nome;
    
    if (document.getElementById('os_status').value === 'entregue') { app.showToast("Para fechar e entregar, use o botão Verde de FATURAR.", "warning"); return; }
    
    if (id) await app.db.collection('ordens_servico').doc(id).update(payload);
    else await app.db.collection('ordens_servico').add(payload);
    
    app.showToast("Ficha salva no Pátio.", "success");
    bootstrap.Modal.getInstance(document.getElementById('modalOS')).hide();
};

app.apagarOS = async function() {
    if(app.t_role !== 'admin') { app.showToast("Cancelamento Bloqueado.", "error"); return; }
    const m = prompt("ATENÇÃO: A Ficha Técnica será cancelada. Digite a JUSTIFICATIVA:");
    if(!m || m.trim() === '') { app.showToast("Operação Abortada.", "error"); return; }
    const id = document.getElementById('os_id').value;
    const osCancelada = app.bancoOSCompleto.find(x => x.id === id);
    await app.db.collection('lixeira_auditoria').add({ tenantId: app.t_id, placaOriginal: osCancelada.placa, apagadoPor: app.user_nome, apagadoEm: new Date().toISOString(), motivo: m, dadosAntigos: osCancelada });
    await app.db.collection('ordens_servico').doc(id).delete();
    app.showToast("O.S. Deletada com sucesso. Arquivada na Lixeira.", "success");
    bootstrap.Modal.getInstance(document.getElementById('modalOS')).hide();
};

// =====================================================================
// 8. FATURAMENTO (LÓGICA DRE INTEGRAL)
// =====================================================================
app.verificarPgtoOS = function() {
    const f = document.getElementById('fat_metodo').value;
    const d = document.getElementById('fat_div_parcelas');
    if(d) d.style.display = f.includes('Parcelado') ? 'block' : 'none';
};

app.abrirFaturamentoDireto = function(id) {
    app.osParaFaturar = app.bancoOSCompleto.find(o => o.id === id);
    document.getElementById('fat_valor_total').innerText = `R$ ${(app.osParaFaturar.total||0).toFixed(2).replace('.',',')}`;
    new bootstrap.Modal(document.getElementById('modalFaturamento')).show();
};

app.processarFaturamentoCompleto = async function() {
    if(!app.osParaFaturar) return;
    const fp = document.getElementById('fat_metodo').value;
    const parcelasText = document.getElementById('fat_parcelas').value;
    const totalVenda = app.osParaFaturar.total;
    const batch = app.db.batch();
    
    let nP = 1;     if(fp.includes('Parcelado')) { 
        if(parcelasText.includes('2x')||parcelasText.includes('30/60')) nP = 2; 
        else if(parcelasText.includes('3x')||parcelasText.includes('90')) nP = 3; 
        else if(parcelasText.includes('4x')) nP = 4; 
        else if(parcelasText.includes('5x')) nP = 5; 
        else if(parcelasText.includes('6x')) nP = 6; 
        else if(parcelasText.includes('10x')) nP = 10; 
        else if(parcelasText.includes('12x')) nP = 12; 
    }
    
    const vP = totalVenda / nP; 
    const stsPgto = (fp.includes('Boleto') || fp.includes('Pendente') || fp.includes('Parcelado') || fp.includes('Crédito')) ? 'pendente' : 'pago';
    const dtBase = new Date().toISOString().split('T')[0];

    for(let i=0; i<nP; i++) { 
        let dV = new Date(dtBase); 
        if(nP>1 || stsPgto==='pendente') dV.setDate(dV.getDate() + (i*30)); 
        batch.set(app.db.collection('financeiro').doc(), { 
            tenantId: app.t_id, tipo: 'receita', 
            desc: nP>1 ? `O.S: [${app.osParaFaturar.placa}] - Parc ${i+1}/${nP}` : `O.S: [${app.osParaFaturar.placa}] - ${app.osParaFaturar.cliente}`, 
            valor: vP, parcelaAtual: i+1, totalParcelas: nP, metodo: fp, vencimento: dV.toISOString().split('T')[0], status: stsPgto 
        }); 
    }

    if(app.osParaFaturar.pecas && !app.osParaFaturar.baixaEstoqueFeita) {
        for (const p of app.osParaFaturar.pecas) {
            if (p.idEstoque) {
                const estRef = app.db.collection('estoque').doc(p.idEstoque);
                const estDoc = await estRef.get();
                if(estDoc.exists) batch.update(estRef, { qtd: Math.max(0, estDoc.data().qtd - p.qtd) });
            }
        }
    }

    let usrComissao = app.user_comissao; if(app.t_role === 'admin') usrComissao = 0;
    const comissaoReais = ((app.osParaFaturar.maoObraTotal||0) * (usrComissao / 100));
    
    let h = app.osParaFaturar.historico || [];
    h.push({  new Date().toISOString(), usuario: "Caixa Master", acao: `ENTREGUE: Forma ${fp} (${nP}x). Estoque Baixado.` });
    
    batch.update(app.db.collection('ordens_servico').doc(app.osParaFaturar.id), { status: 'entregue', baixaEstoqueFeita: true, comissaoProcessada: comissaoReais, mecanicoReal: app.osParaFaturar.mecanico || app.user_nome, historico: h, ultimaAtualizacao: new Date().toISOString() });
    
    await batch.commit();
    app.showToast("ENTREGA CONFIRMADA! Pagamentos integrados ao DRE.", "success");
    bootstrap.Modal.getInstance(document.getElementById('modalFaturamento')).hide();
    const modalOS = bootstrap.Modal.getInstance(document.getElementById('modalOS'));
    if(modalOS) modalOS.hide();
};

// =====================================================================// 9. FINANCEIRO AVULSO E EQUIPE (COM CONTROLE FINANCEIRO PESSOAL)
// =====================================================================
app.abrirModalFinanceiro = function(tipo) {
    document.getElementById('fin_tipo').value = tipo;
    document.getElementById('fin_titulo').innerHTML = tipo === 'receita' ? '<i class="bi bi-plus-circle text-success me-2"></i> Lançar Receita' : '<i class="bi bi-dash-circle text-danger me-2"></i> Lançar Despesa';
    document.getElementById('fin_data').value = new Date().toISOString().split('T')[0];
    app.verificarPgtoFinManual();
    new bootstrap.Modal(document.getElementById('modalFin')).show();
};

app.verificarPgtoFinManual = function() {
    const f = document.getElementById('fin_metodo').value;
    const d = document.getElementById('divParcelas');
    if(d) d.style.display = f.includes('Parcelado') ? 'block' : 'none';
};

app.salvarLancamentoFinanceiro = async function(e) {
    e.preventDefault();
    const tipo = document.getElementById('fin_tipo').value; const desc = document.getElementById('fin_desc').value;
    const valorTotal = parseFloat(document.getElementById('fin_valor').value); const dataInicial = new Date(document.getElementById('fin_data').value);
    const fp = document.getElementById('fin_metodo').value; const parcelasText = document.getElementById('fin_parcelas').value;
    const batch = app.db.batch();
    let nP = 1; 
    if(fp.includes('Parcelado')) { 
        if(parcelasText === '2') nP = 2; else if(parcelasText === '3') nP = 3; else if(parcelasText === '4') nP = 4; else if(parcelasText === '6') nP = 6; else if(parcelasText === '12') nP = 12; 
    }
    const vP = valorTotal / nP; 
    const stsPgto = (fp.includes('Boleto') || fp.includes('Pendente') || fp.includes('Parcelado') || fp.includes('Crédito')) ? 'pendente' : 'pago';

    for(let i=0; i<nP; i++) {
        let v = new Date(dataInicial); if(nP>1 || stsPgto==='pendente') v.setMonth(v.getMonth() + i);
        batch.set(app.db.collection('financeiro').doc(), { tenantId: app.t_id, tipo: tipo, desc: nP>1 ? `${desc} - Parc ${i+1}/${nP}`: desc, valor: vP, parcelaAtual: i+1, totalParcelas: nP, metodo: fp, vencimento: v.toISOString().split('T')[0], status: stsPgto });
    }
    await batch.commit(); app.showToast(`Registros injetados no Caixa.`, "success");
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
        const st = f.status === 'pago' ? `<span class="badge bg-success px-2 py-1"><i class="bi bi-check2-all"></i> Pago</span>` : `<span class="badge bg-warning text-dark px-2 py-1"><i class="bi bi-hourglass-split"></i> Aberto</span>`;
        const btn = f.status === 'pendente' ? `<button class="btn btn-sm btn-outline-${isR?'success':'danger'} shadow-sm fw-bold px-3" onclick="app.db.collection('financeiro').doc('${f.id}').update({status:'pago'})"><i class="bi bi-currency-dollar"></i> Baixar</button>` : '';
        const html = `<tr><td class="text-white-50"><i class="bi bi-calendar-event me-2"></i> ${new Date(f.vencimento).toLocaleDateString('pt-BR')}</td><td class="text-white fw-bold">${f.desc}</td><td><span class="badge bg-dark border border-secondary px-3 py-1 text-white-50">${f.parcelaAtual}/${f.totalParcelas}</span></td><td class="text-info small fw-bold">${f.metodo || 'Dinheiro'}</td><td class="${cor} fw-bold fs-6">R$ ${f.valor.toFixed(2).replace('.',',')}</td><td>${st}</td><td class="gestao-only">${btn} <button class="btn btn-sm btn-link text-danger admin-only" onclick="app.db.collection('financeiro').doc('${f.id}').delete()"><i class="bi bi-trash"></i></button></td></tr>`;
        if(isR) hReceber += html; else hPagar += html;
    });

    if(tPagar) tPagar.innerHTML = hPagar || '<tr><td colspan="7" class="text-center text-white-50 py-4">Nenhuma conta a pagar aberta.</td></tr>';
    if(tReceber) tReceber.innerHTML = hReceber || '<tr><td colspan="7" class="text-center text-white-50 py-4">Nenhuma fatura a receber.</td></tr>';

    let totCom = 0;
    app.bancoOSCompleto.filter(o=>o.status==='entregue').forEach(o => totCom += (o.comissaoProcessada||0));
    
    document.getElementById('dreReceitas').innerText = `R$ ${totRec.toFixed(2).replace('.',',')}`;
    document.getElementById('dreDespesas').innerText = `R$ ${totPag.toFixed(2).replace('.',',')}`;
    document.getElementById('dreComissoes').innerText = `R$ ${totCom.toFixed(2).replace('.',',')}`;
    document.getElementById('dreLucro').innerText = `R$ ${(totRec - totPag - totCom).toFixed(2).replace('.',',')}`;
};

app.iniciarEscutaEquipe = function() {
    app.db.collection('funcionarios').where('tenantId', '==', app.t_id).onSnapshot(snap => {
        const tbody = document.getElementById('tabelaEquipe');
        if(!tbody) return;
        if(snap.empty) { tbody.innerHTML = '<tr><td colspan="5" class="text-center text-white-50 py-5 fs-5">Sem equipe.</td></tr>'; return; }
        tbody.innerHTML = snap.docs.map(doc => {
            const f = doc.data();
            const comissoes = app.bancoOSCompleto.filter(o => o.status === 'entregue' && o.mecanico === f.nome).reduce((acc, o) => acc + (o.maoObraTotal * (f.comissao || 0) / 100), 0);
            const avancos = (f.avancos || []).reduce((acc, a) => acc + (a.valor || 0), 0);
            const saldo = comissoes - avancos;
            const nAcesso = f.role === 'gerente' ? '<span class="badge bg-warning text-dark">Gerente/Vendedor</span>' : '<span class="badge bg-secondary text-white">Mecânico/Produção</span>';
            return `<tr><td class="fw-bold text-white fs-6"><i class="bi bi-person-circle text-success me-2"></i> ${f.nome}</td><td>${nAcesso}</td><td class="text-warning">${f.comissao||0}%</td><td><span class="bg-dark px-3 py-1 rounded text-info">${f.usuario}</span><br><small class="text-white-50">Gerado: R$${comissoes.toFixed(2)} | Retirado: R$${avancos.toFixed(2)}</small></td><td class="admin-only"><button class="btn btn-sm btn-outline-warning shadow-sm px-3" onclick="app.gerenciarFinancasFunc('${doc.id}', '${f.nome}')"><i class="bi bi-wallet2 me-1"></i> Financ.</button> <button class="btn btn-sm btn-outline-danger shadow-sm px-3" onclick="app.apagarFuncionario('${doc.id}')"><i class="bi bi-slash-circle me-1"></i> Revogar</button></td></tr>`;
        }).join('');
    });
};

app.gerenciarFinancasFunc = async function(id, nome) {
    const val = prompt(`Registrar Adiantamento/Desconto para ${nome}. Use negativo para estorno:`);
    if (val !== null && val !== '') {
        const v = parseFloat(val);
        if (!isNaN(v)) {
            const docRef = app.db.collection('funcionarios').doc(id);
            const doc = await docRef.get();
            let avancos = doc.data().avancos || [];
            avancos.push({ valor: v,  new Date().toISOString(), obs: 'Ajuste Manual' });
            await docRef.update({ avancos: avancos });
            app.showToast("Registro financeiro atualizado.");
        }    }
};

app.salvarFuncionario = async function(e) {
    e.preventDefault();
    await app.db.collection('funcionarios').add({ tenantId: app.t_id, nome: document.getElementById('f_nome').value, role: document.getElementById('f_cargo').value, comissao: parseFloat(document.getElementById('f_comissao').value), usuario: document.getElementById('f_user').value, senha: document.getElementById('f_pass').value, avancos: [] });
    app.showToast("Acesso corporativo criado.", "success"); e.target.reset(); bootstrap.Modal.getInstance(document.getElementById('modalEquipe')).hide();
};

app.apagarFuncionario = async function(id) { if(confirm("Deseja bloquear permanentemente o acesso deste usuário?")) { await app.db.collection('funcionarios').doc(id).delete(); app.showToast("Acesso destruído.", "success"); } };

// =====================================================================
// 10. ARQUIVO E LIXEIRA
// =====================================================================
app.renderizarTabelaArquivo = function() {
    let entregues = app.bancoOSCompleto.filter(os => os.status === 'entregue').sort((a,b) => new Date(b.ultimaAtualizacao) - new Date(a.ultimaAtualizacao));
    const t = document.getElementById('buscaGeral').value.toLowerCase().trim();
    if (t) entregues = entregues.filter(o => (o.placa&&o.placa.toLowerCase().includes(t)) || (o.cliente&&o.cliente.toLowerCase().includes(t)));
    const tbody = document.getElementById('tabelaArquivoCorpo');
    if(tbody) tbody.innerHTML = entregues.map(os => `<tr><td class="text-white-50 small"><i class="bi bi-calendar-check text-success me-2"></i> ${new Date(os.ultimaAtualizacao).toLocaleDateString('pt-BR')}</td><td><span class="badge bg-dark border px-3 py-2 fs-6 shadow-sm">${os.placa}</span></td><td class="text-white fw-bold">${os.veiculo}</td><td class="text-white-50">${os.cliente}</td><td class="gestao-only text-success fw-bold">R$ ${(os.total||0).toFixed(2).replace('.',',')}</td><td class="text-center"><button class="btn btn-outline-info shadow-sm fw-bold px-4" onclick="app.abrirModalOS('edit', '${os.id}')"><i class="bi bi-folder-symlink-fill me-2"></i> Ver Prontuário</button></td></tr>`).join('');
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

// =====================================================================
// 11. CLOUDINARY E LAUDO PDF
// =====================================================================
app.configurarCloudinary = function() {
    if (!app.CLOUDINARY_CLOUD_NAME || !app.CLOUDINARY_UPLOAD_PRESET) return;
    var w = cloudinary.createUploadWidget({ cloudName: app.CLOUDINARY_CLOUD_NAME, uploadPreset: app.CLOUDINARY_UPLOAD_PRESET, sources: ['local', 'camera'], language: 'pt' }, (err, res) => {
        if (!err && res && res.event === "success") { app.fotosOSAtual.push(res.info.secure_url); app.historicoOSAtual.push({ data: new Date().toISOString(), usuario: app.user_nome, acao: "Anexou evidência visual." }); app.renderizarGaleria(); }
    });
    const btn = document.getElementById("btnUploadCloudinary"); if(btn) btn.addEventListener("click", () => w.open(), false);
};

app.renderizarGaleria = function() {
    const gal = document.getElementById('galeriaFotosOS');
    if(gal) gal.innerHTML = app.fotosOSAtual.map((url, i) => `<div class="position-relative shadow-sm" style="width: 140px; height: 140px;"><img src="${url}" crossorigin="anonymous" class="img-thumbnail bg-dark border-secondary w-100 h-100 object-fit-cover rounded-3"><button type="button" data-html2canvas-ignore class="btn btn-sm btn-danger position-absolute top-0 end-0 m-2 p-0 px-2 rounded-circle" onclick="app.removerFoto(${i})"><i class="bi bi-x"></i></button></div>`).join('');
};

app.removerFoto = function(index) { app.fotosOSAtual.splice(index, 1); app.historicoOSAtual.push({  new Date().toISOString(), usuario: app.user_nome, acao: "Removeu foto." }); app.renderizarGaleria(); };
app.renderizarHistorico = function() { 
    const hist = document.getElementById('listaHistorico');
    if(hist) hist.innerHTML = app.historicoOSAtual.length === 0 ? '' : [...app.historicoOSAtual].sort((a,b) => new Date(b.data) - new Date(a.data)).map(h => `<li class="timeline-item"><strong class="text-white">${h.usuario}</strong> - <span class="text-info">${new Date(h.data).toLocaleString('pt-BR')}</span><p class="mb-0 mt-1 bg-dark d-inline-block px-3 py-1 rounded border border-secondary">${h.acao}</p></li>`).join(''); 
};

async function carregarImagemParaPDF(url) {
    return new Promise((resolve, reject) => {
        const img = new Image(); img.crossOrigin = 'Anonymous';
        img.onload = () => {
            const canvas = document.createElement('canvas'); canvas.width = img.width; canvas.height = img.height;
            const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0); resolve(canvas.toDataURL('image/jpeg'));
        };
        img.onerror = reject; img.src = url;
    });
}

app.exportarPDFMenechelli = async function() {
    const btn = document.getElementById('btnGerarPDF'); btn.innerHTML = 'Renderizando...'; btn.disabled = true; const placa = document.getElementById('os_placa').value;
    try {
        const { jsPDF } = window.jspdf; const doc = new jsPDF('p', 'mm', 'a4'); const pageWidth = doc.internal.pageSize.getWidth(); let y = 15;
        doc.setFillColor(30, 41, 59); doc.rect(0, 0, pageWidth, 40, 'F'); doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(26); doc.text(app.t_nome.toUpperCase(), pageWidth/2, 22, { align: "center" }); doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.text(`LAUDO TÉCNICO VEICULAR E ORÇAMENTO`, pageWidth/2, 30, { align: "center" }); y = 50; doc.setTextColor(0, 0, 0);
        doc.setDrawColor(200, 200, 200); doc.rect(15, y, pageWidth-30, 25); doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.text(`Cliente / Dono:`, 20, y+8); doc.setFont("helvetica", "normal"); doc.text(document.getElementById('os_cliente').value, 50, y+8); doc.setFont("helvetica", "bold"); doc.text(`Contato:`, 130, y+8); doc.setFont("helvetica", "normal"); doc.text(document.getElementById('os_celular').value, 150, y+8); doc.setFont("helvetica", "bold"); doc.text(`Identificação (Placa):`, 20, y+18); doc.setFont("helvetica", "normal"); doc.text(placa, 60, y+18); doc.setFont("helvetica", "bold"); doc.text(`Veículo:`, 130, y+18); doc.setFont("helvetica", "normal"); doc.text(document.getElementById('os_veiculo').value, 148, y+18); y += 35;
        doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.text(`QUEIXA / RECLAMAÇÃO DO CLIENTE`, 15, y); doc.line(15, y+2, pageWidth-15, y+2); y += 10; doc.setFont("helvetica", "normal"); doc.setFontSize(10); const txtQ = doc.splitTextToSize(document.getElementById('os_relato_cliente').value || 'Não reportada.', pageWidth - 30); doc.text(txtQ, 15, y); y += (txtQ.length * 6) + 10;
        doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.text(`DIAGNÓSTICO TÉCNICO (MECÂNICO)`, 15, y); doc.line(15, y+2, pageWidth-15, y+2); y += 10; doc.setFont("helvetica", "normal"); doc.setFontSize(10); const txtL = doc.splitTextToSize(document.getElementById('os_diagnostico').value || 'Inspeção padrão de revisão.', pageWidth - 30); doc.text(txtL, 15, y); y += (txtL.length * 6) + 10;
        let tableBody = []; document.querySelectorAll('#listaPecasCorpo tr').forEach(tr => { tableBody.push([tr.querySelector('.peca-desc').value, tr.querySelector('.peca-qtd').value, `R$ ${tr.querySelector('.peca-venda').value}`, `R$ ${tr.querySelector('.peca-total').value}`]); });
        doc.autoTable({ startY: y, head: [['Serviço / Peça de Reposição', 'Qtd', 'Vlr. Unitário', 'Subtotal']], body: tableBody, theme: 'grid', headStyles: { fillColor: [30, 41, 59] }, margin: { left: 15, right: 15 }}); y = doc.lastAutoTable.finalY + 15;
        
        if (app.fotosOSAtual && app.fotosOSAtual.length > 0) {
            if (y > 220) { doc.addPage(); y = 20; }
            doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.text(`EVIDÊNCIAS FOTOGRÁFICAS (LAUDO VISUAL)`, 15, y); doc.line(15, y+2, pageWidth-15, y+2); y += 10;
            let imgX = 15; let imgY = y; const imgSize = 40; const margin = 5;
            for (let i = 0; i < app.fotosOSAtual.length; i++) {
                try {
                    const base64Img = await carregarImagemParaPDF(app.fotosOSAtual[i]);
                    if (imgX + imgSize > pageWidth - 15) { imgX = 15; imgY += imgSize + margin; }
                    if (imgY + imgSize > 280) { doc.addPage(); imgY = 20; imgX = 15; }
                    doc.addImage(base64Img, 'JPEG', imgX, imgY, imgSize, imgSize);
                    imgX += imgSize + margin;
                } catch (e) { console.error("Erro ao carregar imagem para o PDF", e); }
            }
            y = imgY + imgSize + 15;
        }

        if (y > 240) { doc.addPage(); y = 20; }
        if(app.t_role === 'admin' || app.t_role === 'gerente') {
            doc.setFillColor(240, 240, 240); doc.rect(pageWidth - 85, y, 70, 15, 'F'); doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.text(`ORÇAMENTO FINAL:`, pageWidth - 80, y + 10);
            const totalOS = document.getElementById('os_total_geral').innerText; doc.setTextColor(0, 128, 0); doc.text(totalOS, pageWidth - 35, y + 10);
        }
        doc.save(`OS_Oficina_${placa}_${new Date().getTime()}.pdf`); app.showToast("PDF gerado com sucesso!", "success");
    } catch (erro) { console.error("Erro na geração do PDF:", erro); app.showToast("Erro ao gerar o documento PDF. Verifique o console.", "error"); } finally { btn.innerHTML = '<i class="bi bi-file-earmark-pdf-fill me-1"></i> Imprimir Laudo Oficial'; btn.disabled = false; }};

// =====================================================================
// 12. MÓDULO DE INTELIGÊNCIA ARTIFICIAL (GEMINI 2.5 FLASH - EXATO)
// =====================================================================
app.iniciarEscutaIA = function() {
    app.db.collection('conhecimento_ia').where('tenantId', '==', app.t_id).onSnapshot(snap => {
        app.bancoIA = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        app.renderizarListaIA();
    });
};

app.renderizarListaIA = function() {
    const div = document.getElementById('listaConhecimentosIA'); if(!div) return;
    if(app.bancoIA.length === 0) { div.innerHTML = '<p class="text-white-50 text-center mt-3">A sua I.A. ainda não possui manuais cadastrados.</p>'; return; }
    div.innerHTML = app.bancoIA.map(ia => `<div class="d-flex justify-content-between align-items-center bg-dark p-3 mb-2 rounded border border-secondary shadow-sm"><span class="text-white-50 text-truncate fw-bold" style="max-width: 85%;">${ia.texto}</span><button class="btn btn-sm btn-outline-danger border-0" onclick="app.apagarConhecimentoIA('${ia.id}')"><i class="bi bi-trash-fill"></i></button></div>`).join('');
};

app.salvarConhecimentoIA = async function(textoAvulso = null) {
    const textarea = document.getElementById('iaConhecimentoTexto'); const valor = textoAvulso || (textarea ? textarea.value.trim() : '');
    if(!valor) { app.showToast("O conhecimento não pode estar vazio.", "warning"); return; }
    await app.db.collection('conhecimento_ia').add({ tenantId: app.t_id, texto: valor, dataImportacao: new Date().toISOString() });
    app.showToast("Conhecimento gravado! Sua I.A. ficou mais inteligente.", "success"); if(textarea && !textoAvulso) textarea.value = '';
};

app.apagarConhecimentoIA = async function(id) { if(confirm("Deseja apagar este conhecimento da I.A.?")) { await app.db.collection('conhecimento_ia').doc(id).delete(); app.showToast("Arquivo removido.", "success"); } };

app.processarArquivoParaIA = function(event) {
    const file = event.target.files[0]; if(!file) return;
    const statusLabel = document.getElementById('iaFileStatus'); if(statusLabel) { statusLabel.className = "text-warning fw-bold d-block text-center"; statusLabel.innerText = "Lendo arquivo e injetando conhecimento..."; }
    const reader = new FileReader();
    reader.onload = async function(e) {
        const text = e.target.result; const txtLimpo = text.substring(0, 5000); 
        await app.salvarConhecimentoIA(`[Arquivo Importado: ${file.name}]\n\n${txtLimpo}`);
        if(statusLabel) { statusLabel.className = "text-success fw-bold d-block text-center"; statusLabel.innerText = "Arquivo processado e absorvido pela I.A.!"; setTimeout(() => { statusLabel.innerText = ""; }, 4000); }
    };
    reader.readAsText(file); 
};

app.chamarGemini = async function(prompt) {
    if(!app.API_KEY_GEMINI) { app.showToast("Chave da API do Google Gemini não encontrada.", "error"); return "Erro: Google Gemini API Key ausente."; }
    try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${app.API_KEY_GEMINI}`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        const data = await res.json(); return data.candidates[0].content.parts[0].text;
    } catch(e) { return "Erro na conexão com a Inteligência Artificial."; }
};
app.perguntarJarvis = async function() {
    const inp = document.getElementById('jarvisInput'); const resDiv = document.getElementById('jarvisResposta');
    if(!inp.value) return; resDiv.classList.remove('d-none'); resDiv.innerHTML = '<span class="spinner-border text-info spinner-border-sm me-2"></span> J.A.R.V.I.S está processando...';
    
    const contexto = app.bancoIA.map(ia => ia.texto).join('\n\n');
    const dadosOS = app.bancoOSCompleto.filter(o=>o.status !== 'entregue').map(o => `[Placa: ${o.placa} | Cliente: ${o.cliente} | Veículo: ${o.veiculo} | Status: ${o.status} | Problema: ${o.relatoCliente || ''}]`).join('\n');
    const promptMaster = `Você é o J.A.R.V.I.S, assistente virtual da oficina "${app.t_nome}". Responda de forma clara e técnica. MANUAIS DA OFICINA: ${contexto} VEÍCULOS NO PÁTIO AGORA: ${dadosOS} PERGUNTA: ${inp.value}`;

    const resposta = await app.chamarGemini(promptMaster);
    if(resDiv) resDiv.innerHTML = resposta.replace(/\n/g, '<br>'); inp.value = '';
};

app.jarvisAnalisarRevisoes = async function() {
    const div = document.getElementById('jarvisCRMInsights'); if(!div) return;
    div.innerHTML = '<span class="spinner-border text-warning spinner-border-sm me-2"></span> Escaneando o Histórico Morto...';
    const historicoMorto = app.bancoOSCompleto.filter(o => o.status === 'entregue');
    if(historicoMorto.length === 0) { div.innerHTML = '<span class="text-white-50">Não há registros suficientes para remarketing.</span>'; return; }
    const dadosParaIA = historicoMorto.map(o => `Data Baixa: ${new Date(o.ultimaAtualizacao).toLocaleDateString('pt-BR')} | Cliente: ${o.cliente} | Carro: ${o.veiculo} | Placa: ${o.placa}`).join('\n');
    const promptRadar = `Você é o Gestor de Remarketing Automotivo da oficina ${app.t_nome}. Leia o banco de dados abaixo de ordens de serviço finalizadas da nossa oficina. Encontre os clientes que fizeram serviço há mais tempo para oferecermos revisões preventivas (ex: troca de óleo). Retorne uma lista formatada em HTML (com <ul> e <li>) explicando por que ligar para cada um. Seja breve e comercial. BANCO DE DADOS:\n${dadosParaIA}`;
    const respostaRadar = await app.chamarGemini(promptRadar); div.innerHTML = respostaRadar;
};