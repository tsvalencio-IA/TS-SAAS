// =============================================================================
// AR TOY EXTRACTOR V5: MISSÃO DE COLETA (OBJ DETECTION + BASE COMMAND)
// FILTRO DE OBJETOS PEQUENOS + MENSAGENS ANIMADAS + 100% AUTÔNOMO
// =============================================================================

(function() {
    "use strict";

    let particles = [];
    let time = 0;

    const Game = {
        state: 'BOOT', // BOOT, CALIBRATE, SEARCHING, EXTRACTING, RETURNING
        score: 0,
        
        // IA Visual (COCO-SSD)
        objectModel: null,
        detectedItems: [],
        lastDetectTime: 0,
        
        // Lista de objetos permitidos (Coisas que costumam ser pequenas/brinquedos)
        allowedClasses: ['car', 'truck', 'bus', 'sports ball', 'teddy bear', 'cup', 'bottle', 'mouse', 'remote', 'cell phone', 'book'],
        
        // Mecânica de Captura
        scanProgress: 0,
        targetItem: null,
        cooldown: 0,
        
        // Inventário e Missão
        cargo: null, 
        itemsCollected: 0,
        missionGoal: 5,

        // GPS e Navegação
        basePos: { lat: null, lng: null },
        currentPos: { lat: null, lng: null },
        distanceToBase: 999,
        gpsWatcher: null,
        compassHeading: 0,
        returnTimer: 0, // Timer de segurança caso o GPS falhe dentro de casa
        
        // Sistema de Mensagens da Base
        baseMessage: "",
        baseMessageTimer: 0,
        typingIndex: 0,

        init: function(faseData) {
            this.state = 'BOOT';
            this.score = 0;
            this.cargo = null;
            this.itemsCollected = 0;
            this.scanProgress = 0;
            this.cooldown = 0;
            particles = [];
            time = 0;
            
            this.transmit("COMANDO: Iniciando Sistemas do Rover...");
            this.startSensors();
            this.loadAIModel();
        },

        // --- SISTEMA DE COMUNICAÇÃO DA BASE ---
        transmit: function(msg) {
            if (this.baseMessage === msg) return; // Não repete a mesma mensagem atoa
            this.baseMessage = msg;
            this.typingIndex = 0;
            this.baseMessageTimer = 150; // Mensagem fica na tela por ~3 segundos
            if(window.Sfx) window.Sfx.play(1200, 'square', 0.1, 0.05); // Bip de rádio
        },

        startSensors: function() {
            window.addEventListener('deviceorientation', (event) => {
                this.compassHeading = event.alpha || 0;
            });
        },

        loadAIModel: async function() {
            if (typeof cocoSsd === 'undefined') {
                const script = document.createElement('script');
                script.src = "https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd";
                document.head.appendChild(script);
                
                script.onload = async () => {
                    this.objectModel = await cocoSsd.load();
                    this.state = 'CALIBRATE';
                    this.returnTimer = 100; // Tempo de calibração
                };
            } else {
                this.objectModel = await cocoSsd.load();
                this.state = 'CALIBRATE';
                this.returnTimer = 100;
            }
        },

        setupGPS: function() {
            if ("geolocation" in navigator) {
                navigator.geolocation.getCurrentPosition((pos) => {
                    this.basePos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                    this.gpsWatcher = navigator.geolocation.watchPosition((newPos) => {
                        this.currentPos = { lat: newPos.coords.latitude, lng: newPos.coords.longitude };
                        this.distanceToBase = this.calculateDistance(this.basePos.lat, this.basePos.lng, this.currentPos.lat, this.currentPos.lng);
                    }, null, { enableHighAccuracy: true });
                }, () => {
                    this.basePos = { lat: 0, lng: 0 }; this.distanceToBase = 0;
                });
            }
        },

        calculateDistance: function(lat1, lon1, lat2, lon2) {
            const R = 6371e3;
            const p1 = lat1 * Math.PI/180; const p2 = lat2 * Math.PI/180;
            const dp = (lat2-lat1) * Math.PI/180; const dl = (lon2-lon1) * Math.PI/180;
            const a = Math.sin(dp/2) * Math.sin(dp/2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl/2) * Math.sin(dl/2);
            return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        },

        update: function(ctx, w, h, pose) {
            time += 0.05;

            // 1. DESENHA A CÂMERA DE FUNDO
            if (window.System.video && window.System.video.readyState === 4) {
                const videoRatio = window.System.video.videoWidth / window.System.video.videoHeight;
                const canvasRatio = w / h;
                let drawW = w, drawH = h, drawX = 0, drawY = 0;
                if (videoRatio > canvasRatio) { drawW = h * videoRatio; drawX = (w - drawW) / 2; } 
                else { drawH = w / videoRatio; drawY = (h - drawH) / 2; }
                ctx.drawImage(window.System.video, drawX, drawY, drawW, drawH);
            } else {
                ctx.fillStyle = '#050505'; ctx.fillRect(0, 0, w, h);
            }

            // CONTROLE DE ESTADOS (100% AUTOMÁTICO)
            if (this.state === 'BOOT') {
                this.drawHUD(ctx, w, h, w/2, h/2);
                return this.score;
            }

            if (this.state === 'CALIBRATE') {
                this.transmit("COMANDO: Estabelecendo Ponto Base. Fique parado.");
                this.returnTimer--;
                
                ctx.strokeStyle = "#0ff"; ctx.lineWidth = 4;
                ctx.beginPath(); ctx.arc(w/2, h/2, 100 + Math.sin(time*5)*20, 0, Math.PI*2); ctx.stroke();

                if (this.returnTimer <= 0) {
                    this.setupGPS();
                    this.state = 'SEARCHING';
                    this.transmit("BASE: Varredura ativada. Procure por pequenos objetos ou carrinhos.");
                    if(window.Sfx) window.Sfx.epic();
                }
                this.drawHUD(ctx, w, h, w/2, h/2);
                return this.score;
            }

            this.playMode(ctx, w, h);
            return this.score;
        },

        playMode: function(ctx, w, h) {
            const cx = w / 2;
            const cy = h / 2;
            let potentialTarget = null;

            if (this.cooldown > 0) this.cooldown--;

            // ==========================================
            // LÓGICA DA IA (FILTRO DE PEQUENOS OBJETOS)
            // ==========================================
            if (this.objectModel && window.System.video && window.System.video.readyState === 4 && this.state !== 'RETURNING') {
                
                // Roda a IA a cada 200ms
                if (Date.now() - this.lastDetectTime > 200) {
                    this.objectModel.detect(window.System.video).then(predictions => {
                        this.detectedItems = predictions;
                    });
                    this.lastDetectTime = Date.now();
                }

                const scaleX = w / window.System.video.videoWidth;
                const scaleY = h / window.System.video.videoHeight;

                this.detectedItems.forEach(item => {
                    // 1º FILTRO: É um objeto que queremos? E tem boa certeza?
                    if (!this.allowedClasses.includes(item.class) || item.score < 0.45) return;

                    const boxW = item.bbox[2] * scaleX;
                    const boxH = item.bbox[3] * scaleY;
                    
                    // 2º FILTRO DE TAMANHO: O objeto DEVE ser pequeno! (Menor que 60% da tela)
                    // Se a IA achar que o seu sofá gigante é um "carro", o jogo ignora.
                    if (boxW > w * 0.6 || boxH > h * 0.6 || boxW < 40) return;

                    const boxX = item.bbox[0] * scaleX;
                    const boxY = item.bbox[1] * scaleY;
                    const itemCx = boxX + (boxW/2);
                    const itemCy = boxY + (boxH/2);

                    // Desenha os marcadores de análise passiva (Em volta de todos os objetos válidos)
                    this.drawHologramBox(ctx, boxX, boxY, boxW, boxH, item.class.toUpperCase());

                    // Verifica se está na mira central do caminhão
                    const distToCenter = Math.hypot(itemCx - cx, itemCy - cy);
                    
                    if (distToCenter < 150 && this.cooldown <= 0) {
                        potentialTarget = { ...item, cx: itemCx, cy: itemCy, w: boxW, h: boxH };
                    }
                });
            }

            // ==========================================
            // MÁQUINA DE ESTADOS DO GAMEPLAY
            // ==========================================

            if (this.state === 'SEARCHING') {
                if (potentialTarget) {
                    this.targetItem = potentialTarget;
                    this.state = 'EXTRACTING';
                    this.transmit(`COMANDO: Alvo [${this.targetItem.class.toUpperCase()}] detectado. Mantenha a mira!`);
                } else {
                    if (this.baseMessageTimer <= 0) this.transmit("BASE: Rastreando perímetro... Caçamba Vazia.");
                }
            }

            if (this.state === 'EXTRACTING') {
                if (potentialTarget && potentialTarget.class === this.targetItem.class) {
                    // Atualiza a posição do alvo
                    this.targetItem = potentialTarget;
                    this.scanProgress += 2.5;
                    
                    if (this.scanProgress % 10 === 0 && window.Sfx) window.Sfx.hover();

                    // --- ANIMAÇÃO DO LASER E MIRA TRAVANDO ---
                    // Os colchetes vão diminuindo conforme o progresso
                    const lockSize = 100 - (this.scanProgress * 0.6);
                    ctx.strokeStyle = "#f00"; ctx.lineWidth = 4;
                    
                    ctx.save();
                    ctx.translate(this.targetItem.cx, this.targetItem.cy);
                    ctx.rotate(time); // Gira a mira
                    ctx.strokeRect(-lockSize/2, -lockSize/2, lockSize, lockSize);
                    ctx.restore();

                    // Laser de extração
                    ctx.strokeStyle = "rgba(0, 255, 255, 0.8)"; ctx.lineWidth = 15 + Math.random()*10;
                    ctx.beginPath(); ctx.moveTo(cx, h); ctx.lineTo(this.targetItem.cx, this.targetItem.cy); ctx.stroke();

                    // CAPTURADO!
                    if (this.scanProgress >= 100) {
                        this.cargo = this.targetItem.class.toUpperCase();
                        this.state = 'RETURNING';
                        this.scanProgress = 0;
                        this.returnTimer = 400; // ~20 segundos para voltar
                        
                        if(window.Gfx) window.Gfx.shakeScreen(15);
                        if(window.Sfx) window.Sfx.coin();
                        this.transmit("COMANDO: Extração confirmada! Volte para a base imediatamente.");
                        this.spawnParticles(this.targetItem.cx, this.targetItem.cy, "#0ff");
                        this.targetItem = null;
                    }
                } else {
                    // Perdeu o alvo
                    this.scanProgress = Math.max(0, this.scanProgress - 3);
                    if (this.scanProgress <= 0) {
                        this.state = 'SEARCHING';
                        this.transmit("BASE: Alvo perdido. Realinhe o Rover.");
                        this.targetItem = null;
                    }
                }
            }

            if (this.state === 'RETURNING') {
                this.returnTimer--;
                
                // Se a distância for menor que 3 metros OU o tempo limite acabar (fallback de segurança indoor)
                if ((this.distanceToBase > 0 && this.distanceToBase < 3.0) || this.returnTimer <= 0) {
                    
                    this.cargo = null;
                    this.state = 'SEARCHING';
                    this.itemsCollected++;
                    this.score += 300;
                    this.cooldown = 100; // Esfria o laser
                    
                    if(window.Gfx) window.Gfx.shakeScreen(20);
                    if(window.Sfx) window.Sfx.epic();
                    this.transmit(`BASE: Carga entregue! (${this.itemsCollected}/${this.missionGoal}). Continue a missão.`);
                    this.spawnParticles(cx, h - 100, "#2ecc71");

                    if (this.itemsCollected >= this.missionGoal) {
                        setTimeout(() => window.System.gameOver(this.score, true, 100), 2000);
                    }
                }
            }

            // DESENHA O HUD PRINCIPAL
            this.drawHUD(ctx, w, h, cx, cy);
            this.updateParticles(ctx);
        },

        drawHologramBox: function(ctx, x, y, bw, bh, label) {
            ctx.strokeStyle = "rgba(0, 255, 255, 0.5)"; ctx.lineWidth = 2;
            const l = 15; 
            
            ctx.beginPath();
            ctx.moveTo(x, y+l); ctx.lineTo(x, y); ctx.lineTo(x+l, y);
            ctx.moveTo(x+bw-l, y); ctx.lineTo(x+bw, y); ctx.lineTo(x+bw, y+l);
            ctx.moveTo(x+bw, y+bh-l); ctx.lineTo(x+bw, y+bh); ctx.lineTo(x+bw-l, y+bh);
            ctx.moveTo(x+l, y+bh); ctx.lineTo(x, y+bh); ctx.lineTo(x, y+bh-l);
            ctx.stroke();

            // Rótulo da IA flutuando
            ctx.fillStyle = "rgba(0, 30, 60, 0.8)";
            ctx.fillRect(x, y - 22, ctx.measureText(label).width + 16, 22);
            ctx.fillStyle = "#0ff"; ctx.font = "bold 12px 'Chakra Petch'"; ctx.textAlign="left";
            ctx.fillText(label, x + 8, y - 7);
        },

        drawHUD: function(ctx, w, h, cx, cy) {
            // Efeito de vinheta (Sombra nas bordas)
            const grad = ctx.createRadialGradient(cx, cy, h*0.4, cx, cy, h);
            grad.addColorStop(0, "rgba(0,0,0,0)"); grad.addColorStop(1, "rgba(0,0,0,0.6)");
            ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);

            // =====================================
            // CAIXA DE MENSAGENS DA BASE (TOPO)
            // =====================================
            ctx.fillStyle = "rgba(0, 20, 40, 0.85)"; ctx.fillRect(10, 10, w - 20, 60);
            ctx.strokeStyle = "#0ff"; ctx.lineWidth = 2; ctx.strokeRect(10, 10, w - 20, 60);
            
            // Efeito de digitação (Máquina de escrever)
            if (this.typingIndex < this.baseMessage.length) this.typingIndex += 1.5;
            let currentText = this.baseMessage.substring(0, Math.floor(this.typingIndex));
            
            // Ícone do Avatar da Base piscando
            ctx.fillStyle = (Math.floor(time*5) % 2 === 0) ? "#0ff" : "#fff";
            ctx.fillRect(20, 20, 40, 40);
            ctx.fillStyle = "#000"; ctx.font = "bold 20px 'Russo One'"; ctx.textAlign="center";
            ctx.fillText("HQ", 40, 48);

            ctx.fillStyle = "#0ff"; ctx.textAlign="left"; ctx.font = "bold 14px 'Chakra Petch'";
            ctx.fillText(currentText + (Math.floor(time*5)%2===0 ? "_" : ""), 70, 45);
            
            if (this.baseMessageTimer > 0) this.baseMessageTimer--;

            // =====================================
            // MIRA CENTRAL PERMANENTE
            // =====================================
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(time * 0.3);
            ctx.strokeStyle = this.state === 'EXTRACTING' ? "#f00" : "rgba(0, 255, 255, 0.4)";
            ctx.lineWidth = 2; ctx.setLineDash([10, 15]);
            ctx.beginPath(); ctx.arc(0, 0, 80, 0, Math.PI*2); ctx.stroke();
            ctx.restore();

            // Ponto central
            ctx.fillStyle = "rgba(0, 255, 255, 0.8)";
            ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI*2); ctx.fill();

            // =====================================
            // PAINEL INFERIOR DO CAMINHÃO
            // =====================================
            ctx.fillStyle = "rgba(0, 0, 0, 0.8)"; ctx.fillRect(0, h - 90, w, 90);
            ctx.strokeStyle = this.state === 'RETURNING' ? "#2ecc71" : "#0ff"; 
            ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, h - 90); ctx.lineTo(w, h - 90); ctx.stroke();

            // Informações Esquerda (Inventário)
            ctx.textAlign = "left";
            ctx.fillStyle = "#fff"; ctx.font = "bold 14px 'Chakra Petch'";
            ctx.fillText(`ENTREGAS: ${this.itemsCollected} / ${this.missionGoal}`, 20, h - 60);
            
            ctx.fillStyle = this.cargo ? "#2ecc71" : "#e74c3c";
            ctx.font = "bold 20px 'Russo One'";
            ctx.fillText(`CARGA: ${this.cargo ? this.cargo : 'VAZIA'}`, 20, h - 30);

            // Informações Direita (Navegação)
            ctx.textAlign = "right";
            if (this.state === 'RETURNING') {
                ctx.fillStyle = "#fff"; ctx.font = "14px 'Chakra Petch'";
                let distText = this.distanceToBase > 0 ? `${this.distanceToBase.toFixed(1)}m` : "SINAL FRACO";
                ctx.fillText(`GPS BASE: ${distText}`, w - 70, h - 60);
                
                ctx.fillStyle = "#2ecc71"; ctx.font = "12px Arial";
                ctx.fillText(`AUTO-DESCARGA: ${Math.ceil(this.returnTimer/20)}s`, w - 70, h - 35);

                // Bússola
                this.drawCompass(ctx, w - 35, h - 45);
                
                // Alerta Central Gigante
                ctx.textAlign = "center"; ctx.fillStyle = "#2ecc71";
                ctx.font = "bold clamp(25px, 6vw, 40px) 'Russo One'";
                ctx.shadowColor = "#000"; ctx.shadowBlur = 10;
                ctx.fillText("RETORNE PARA A BASE!", cx, cy - 100);
                ctx.shadowBlur = 0;
            } else {
                ctx.fillStyle = "#0ff"; ctx.font = "14px 'Chakra Petch'";
                ctx.fillText("RADAR ATIVO", w - 20, h - 45);
            }
        },

        drawCompass: function(ctx, x, y) {
            ctx.save();
            ctx.translate(x, y);
            ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.strokeStyle = "#2ecc71"; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(0, 0, 25, 0, Math.PI*2); ctx.fill(); ctx.stroke();
            
            ctx.rotate(this.compassHeading * (Math.PI / 180));
            ctx.fillStyle = "#2ecc71";
            ctx.beginPath(); ctx.moveTo(0, -15); ctx.lineTo(10, 8); ctx.lineTo(-10, 8); ctx.fill();
            ctx.restore();
        },

        spawnParticles: function(x, y, color) {
            for(let i=0; i<30; i++) {
                const angle = Math.random() * Math.PI * 2;
                const speed = Math.random() * 15 + 5;
                particles.push({
                    x: x, y: y,
                    vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
                    life: 1.0, size: Math.random() * 6 + 2, color: color
                });
            }
        },

        updateParticles: function(ctx) {
            ctx.globalCompositeOperation = 'lighter';
            particles.forEach(p => {
                p.x += p.vx; p.y += p.vy; 
                p.life -= 0.04; p.size *= 0.95;
                ctx.fillStyle = p.color;
                ctx.globalAlpha = Math.max(0, p.life);
                ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill();
            });
            ctx.globalAlpha = 1.0;
            ctx.globalCompositeOperation = 'source-over';
            particles = particles.filter(p => p.life > 0);
        },

        cleanup: function() {
            if (this.gpsWatcher !== null) navigator.geolocation.clearWatch(this.gpsWatcher);
        }
    };

    // Registra o jogo no Core
    const regLoop = setInterval(() => {
        if(window.System && window.System.registerGame) {
            window.System.registerGame('ar_collector', 'AR Extractor', '🛸', Game, {
                camera: 'environment', // Câmera Traseira obrigatória!
                phases: [
                    { id: 'f1', name: 'OPERAÇÃO LIMPEZA', desc: 'Pilote o caminhão. A IA coleta pequenos brinquedos automaticamente.', goal: 5, reqLvl: 1 }
                ]
            });
            clearInterval(regLoop);
        }
    }, 100);

})();