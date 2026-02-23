// =============================================================================
// HOT WHEELS COLLECTOR AR (OBJ DETECTION + GPS TRACKING)
// ARQUITETO: PARCEIRO DE PROGRAMAÇÃO
// =============================================================================

(function() {
    "use strict";

    let particles = [];
    
    const Game = {
        state: 'LOADING', // LOADING, SET_BASE, SEARCHING, RETURNING
        score: 0,
        
        // IA de Detecção de Objetos
        objectModel: null,
        detectedItems: [],
        scanProgress: 0,
        
        // Inventário
        cargo: null, // null se vazio, ou o nome do item coletado
        itemsCollected: 0,

        // GPS e Base
        basePos: { lat: null, lng: null },
        currentPos: { lat: null, lng: null },
        distanceToBase: 0,
        gpsWatcher: null,

        // Estética
        hudColor: '#f1c40f', // Amarelo máquina
        
        init: function(faseData) {
            this.state = 'LOADING';
            this.score = 0;
            this.cargo = null;
            this.itemsCollected = 0;
            this.scanProgress = 0;
            particles = [];
            
            window.System.msg("CARREGANDO IA VISUAL...");
            this.loadAIModel();
        },

        // 1. CARREGA A IA DE RECONHECIMENTO DE OBJETOS DINAMICAMENTE
        loadAIModel: async function() {
            // Se o script do COCO-SSD ainda não existe, nós injetamos no HTML
            if (typeof cocoSsd === 'undefined') {
                const script = document.createElement('script');
                script.src = "https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd";
                document.head.appendChild(script);
                
                script.onload = async () => {
                    this.objectModel = await cocoSsd.load();
                    this.setupGame();
                };
            } else {
                this.objectModel = await cocoSsd.load();
                this.setupGame();
            }
        },

        setupGame: function() {
            this.state = 'SET_BASE';
            window.System.msg("IA PRONTA!");
            
            window.System.canvas.onclick = () => {
                if (this.state === 'SET_BASE') {
                    this.setDepotLocation();
                } else if (this.state === 'RETURNING') {
                    // Botão de emergência caso o GPS falhe dentro de casa
                    // Clicar na tela quando estiver voltando também descarrega o caminhão!
                    this.deliverCargo();
                }
            };
        },

        // 2. SISTEMA DE GPS
        setDepotLocation: function() {
            if ("geolocation" in navigator) {
                window.System.msg("MARCANDO DEPÓSITO...");
                
                navigator.geolocation.getCurrentPosition((position) => {
                    this.basePos.lat = position.coords.latitude;
                    this.basePos.lng = position.coords.longitude;
                    
                    this.state = 'SEARCHING';
                    if(window.Sfx) window.Sfx.epic();
                    
                    // Começa a rastrear o caminhão
                    this.gpsWatcher = navigator.geolocation.watchPosition((pos) => {
                        this.currentPos.lat = pos.coords.latitude;
                        this.currentPos.lng = pos.coords.longitude;
                        this.distanceToBase = this.calculateDistance(this.basePos.lat, this.basePos.lng, this.currentPos.lat, this.currentPos.lng);
                    }, null, { enableHighAccuracy: true });

                }, (err) => {
                    // Se o usuário negar o GPS ou der erro, usamos base "virtual"
                    console.log("Erro de GPS, usando modo manual.");
                    this.basePos = { lat: 0, lng: 0 };
                    this.state = 'SEARCHING';
                });
            } else {
                this.state = 'SEARCHING';
            }
        },

        // Fórmula Haversine para calcular distância em Metros entre 2 coordenadas GPS
        calculateDistance: function(lat1, lon1, lat2, lon2) {
            const R = 6371e3; // Raio da Terra em metros
            const φ1 = lat1 * Math.PI/180;
            const φ2 = lat2 * Math.PI/180;
            const Δφ = (lat2-lat1) * Math.PI/180;
            const Δλ = (lon2-lon1) * Math.PI/180;
            const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) * Math.sin(Δλ/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            return R * c; // Distância em metros
        },

        // O Loop do Jogo
        update: function(ctx, w, h, pose) {
            // Desenha a câmera traseira
            if (window.System.video && window.System.video.readyState === 4) {
                const videoRatio = window.System.video.videoWidth / window.System.video.videoHeight;
                const canvasRatio = w / h;
                let drawW = w, drawH = h, drawX = 0, drawY = 0;

                if (videoRatio > canvasRatio) {
                     drawW = h * videoRatio; drawX = (w - drawW) / 2;
                } else {
                     drawH = w / videoRatio; drawY = (h - drawH) / 2;
                }
                ctx.drawImage(window.System.video, drawX, drawY, drawW, drawH);
            } else {
                ctx.fillStyle = '#111'; ctx.fillRect(0, 0, w, h);
            }

            if (this.state === 'LOADING') {
                this.drawOverlay(ctx, w, h, "INICIANDO IA", "Baixando banco de dados de brinquedos...");
                return this.score;
            }

            if (this.state === 'SET_BASE') {
                this.drawOverlay(ctx, w, h, "MARCAR DEPÓSITO", "Coloque o caminhão no ponto inicial e TOQUE NA TELA");
                return this.score;
            }

            // MODO BUSCA OU RETORNO
            this.playMode(ctx, w, h);
            return this.score;
        },

        drawOverlay: function(ctx, w, h, title, sub) {
            ctx.fillStyle = "rgba(0, 0, 0, 0.8)"; ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = this.hudColor; ctx.textAlign = "center";
            ctx.font = "bold clamp(30px, 6vw, 50px) 'Russo One'";
            ctx.fillText(title, w/2, h/2 - 20);
            ctx.fillStyle = "#fff"; ctx.font = "clamp(14px, 4vw, 24px) 'Chakra Petch'";
            ctx.fillText(sub, w/2, h/2 + 30);
        },

        playMode: function(ctx, w, h) {
            const cx = w / 2;
            const cy = h / 2;
            let targetInSight = null;

            // ==========================================
            // LÓGICA DE DETECÇÃO (COCO-SSD)
            // ==========================================
            // Só faz a busca se a caçamba estiver vazia
            if (this.state === 'SEARCHING' && this.objectModel && window.System.video && window.System.video.readyState === 4) {
                
                // Pra não travar o celular, só pedimos pra IA ler a imagem a cada alguns frames
                if (Math.random() > 0.7) {
                    this.objectModel.detect(window.System.video).then(predictions => {
                        this.detectedItems = predictions;
                    });
                }

                // Escala para desenhar as caixas certas no Canvas
                const scaleX = w / window.System.video.videoWidth;
                const scaleY = h / window.System.video.videoHeight;

                this.detectedItems.forEach(item => {
                    // Hot Wheels geralmente são detectados como 'car', 'truck', ou 'bus'
                    const isVehicle = ['car', 'truck', 'bus', 'train', 'motorcycle'].includes(item.class);
                    
                    if (isVehicle && item.score > 0.5) {
                        const boxX = item.bbox[0] * scaleX;
                        const boxY = item.bbox[1] * scaleY;
                        const boxW = item.bbox[2] * scaleX;
                        const boxH = item.bbox[3] * scaleY;

                        // Desenha a caixa ao redor do brinquedo real!
                        ctx.strokeStyle = "#0f0"; ctx.lineWidth = 3;
                        ctx.strokeRect(boxX, boxY, boxW, boxH);
                        ctx.fillStyle = "#0f0"; ctx.font = "16px Arial";
                        ctx.fillText(`CARRINHO DETECTADO! (${Math.floor(item.score*100)}%)`, boxX, boxY - 10);

                        // O centro do brinquedo
                        const itemCx = boxX + (boxW/2);
                        const itemCy = boxY + (boxH/2);

                        // Verifica se o brinquedo está no centro da tela (mira do caminhão)
                        const distToCenter = Math.hypot(itemCx - cx, itemCy - cy);
                        
                        // Se estiver perto do centro E o objeto for grandinho (perto da câmera)
                        if (distToCenter < 150 && boxW > 80) {
                            targetInSight = item;
                            
                            // Linha de travamento (Tractor Beam)
                            ctx.strokeStyle = "#ff0000"; ctx.lineWidth = 4;
                            ctx.beginPath(); ctx.moveTo(cx, h); ctx.lineTo(itemCx, itemCy); ctx.stroke();
                        }
                    }
                });

                // Lógica de Captura
                if (targetInSight) {
                    this.scanProgress += 2;
                    if (this.scanProgress % 10 === 0 && window.Sfx) window.Sfx.hover();

                    if (this.scanProgress >= 100) {
                        // COLETADO!
                        this.cargo = 'HOT WHEELS';
                        this.state = 'RETURNING';
                        this.scanProgress = 0;
                        if(window.Gfx) window.Gfx.shakeScreen(15);
                        if(window.Sfx) window.Sfx.coin();
                        window.System.msg("CARRINHO COLETADO!");
                        this.spawnParticles(cx, cy, "#0f0");
                    }
                } else {
                    this.scanProgress = Math.max(0, this.scanProgress - 1);
                }
            }

            // ==========================================
            // LÓGICA DE RETORNO AO DEPÓSITO (GPS)
            // ==========================================
            if (this.state === 'RETURNING') {
                // Se a distância for menor que 3 metros, entrega automática!
                // (GPS de celular tem margem de erro, então 3 a 4 metros é ideal)
                if (this.distanceToBase > 0 && this.distanceToBase < 3.5) {
                    this.deliverCargo();
                }
            }

            // ==========================================
            // DESENHA O HUD DO CAMINHÃO
            // ==========================================
            this.drawHUD(ctx, w, h, cx, cy, targetInSight);
            this.updateParticles(ctx);
        },

        deliverCargo: function() {
            this.cargo = null;
            this.state = 'SEARCHING';
            this.itemsCollected++;
            this.score += 500;
            
            if(window.Gfx) window.Gfx.shakeScreen(20);
            if(window.Sfx) window.Sfx.epic();
            window.System.msg("DESCARREGADO NO DEPÓSITO!");
            this.spawnParticles(window.innerWidth/2, window.innerHeight, this.hudColor);

            // Se coletou 5, ganha o jogo!
            if (this.itemsCollected >= 5) {
                setTimeout(() => window.System.gameOver(this.score, true, 100), 2000);
            }
        },

        drawHUD: function(ctx, w, h, cx, cy, isLocking) {
            // Borda do para-brisa
            ctx.strokeStyle = "#222"; ctx.lineWidth = 20;
            ctx.strokeRect(0, 0, w, h);

            // MIRA CENTRAL
            if (this.state === 'SEARCHING') {
                ctx.strokeStyle = isLocking ? "#f00" : "rgba(255, 255, 255, 0.5)";
                ctx.lineWidth = 3;
                ctx.beginPath(); ctx.arc(cx, cy, 100, 0, Math.PI*2); ctx.stroke();
                
                // Barra de carregamento
                if (this.scanProgress > 0) {
                    ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(cx - 80, cy + 120, 160, 15);
                    ctx.fillStyle = "#f00"; ctx.fillRect(cx - 80, cy + 120, (this.scanProgress/100)*160, 15);
                    ctx.strokeStyle = "#fff"; ctx.strokeRect(cx - 80, cy + 120, 160, 15);
                    ctx.fillStyle = "#fff"; ctx.font = "bold 14px Arial"; ctx.textAlign="center";
                    ctx.fillText("COLETANDO...", cx, cy + 155);
                }
            }

            // PAINEL DE INFORMAÇÕES (Fundo e Estilo)
            ctx.fillStyle = "rgba(0, 0, 0, 0.85)"; ctx.fillRect(0, 0, w, 80);
            ctx.strokeStyle = this.hudColor; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(0, 80); ctx.lineTo(w, 80); ctx.stroke();

            // Texto de Ação Principal
            ctx.fillStyle = this.hudColor; ctx.textAlign = "center";
            ctx.font = "bold clamp(18px, 4vw, 26px) 'Russo One'";
            
            if (this.state === 'SEARCHING') {
                ctx.fillText(`MISSÃO: ENCONTRE CARRINHOS (${this.itemsCollected}/5)`, w/2, 35);
                ctx.fillStyle = "#ccc"; ctx.font = "14px Arial";
                ctx.fillText("Pilote até achar um Hot Wheels", w/2, 60);
            } else if (this.state === 'RETURNING') {
                ctx.fillStyle = "#2ecc71"; // Verde sucesso
                ctx.fillText("CAÇAMBA CHEIA! VOLTE AO DEPÓSITO!", w/2, 35);
                
                // Radar / Distância
                ctx.fillStyle = "#fff"; ctx.font = "16px 'Chakra Petch'";
                let distText = this.distanceToBase > 0 ? `${this.distanceToBase.toFixed(1)} metros` : "Calculando...";
                ctx.fillText(`Distância da Base: ${distText}`, w/2, 60);

                // BOTÃO DE EMERGÊNCIA (Para caso o GPS não funcione direito dentro de casa)
                ctx.fillStyle = "rgba(46, 204, 113, 0.3)";
                ctx.fillRect(w/2 - 120, h - 100, 240, 60);
                ctx.strokeStyle = "#2ecc71"; ctx.strokeRect(w/2 - 120, h - 100, 240, 60);
                ctx.fillStyle = "#fff"; ctx.font = "bold 16px 'Russo One'";
                ctx.fillText("TOQUE PARA DESCARREGAR", w/2, h - 65);
            }

            // CAÇAMBA (Canto inferior esquerdo)
            ctx.textAlign = "left";
            ctx.fillStyle = "#fff"; ctx.font = "bold 14px 'Chakra Petch'";
            ctx.fillText("CAÇAMBA:", 20, h - 40);
            ctx.fillStyle = this.cargo ? "#2ecc71" : "#e74c3c";
            ctx.font = "bold 18px 'Russo One'";
            ctx.fillText(this.cargo ? "[ HOT WHEELS ]" : "[ VAZIA ]", 20, h - 20);
        },

        spawnParticles: function(x, y, color) {
            for(let i=0; i<30; i++) {
                const angle = Math.random() * Math.PI * 2;
                const speed = Math.random() * 15 + 5;
                particles.push({
                    x: x, y: y,
                    vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
                    life: 1.0, size: Math.random() * 8 + 4, color: color
                });
            }
        },

        updateParticles: function(ctx) {
            particles.forEach(p => {
                p.x += p.vx; p.y += p.vy; 
                p.life -= 0.04; p.size *= 0.95;
                ctx.fillStyle = p.color;
                ctx.globalAlpha = Math.max(0, p.life);
                ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill();
            });
            ctx.globalAlpha = 1.0;
            particles = particles.filter(p => p.life > 0);
        },

        cleanup: function() {
            // Para o GPS quando sair do jogo
            if (this.gpsWatcher !== null) {
                navigator.geolocation.clearWatch(this.gpsWatcher);
            }
        }
    };

    // Registra o jogo no Core
    const regLoop = setInterval(() => {
        if(window.System && window.System.registerGame) {
            window.System.registerGame('ar_collector', 'Hot Wheels Collector', '🚙', Game, {
                camera: 'environment', // Câmera Traseira do celular
                phases: [
                    { id: 'f1', name: 'OPERAÇÃO LIMPEZA', desc: 'Ache os Hot Wheels espalhados e traga para a base.', reqLvl: 1 }
                ]
            });
            clearInterval(regLoop);
        }
    }, 100);

})();