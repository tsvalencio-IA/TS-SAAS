// =============================================================================
// USR AR COLLECTOR - MODO "EU, ROBÔ" (CAÇA AOS CARRINHOS/ROBÔS PERDIDOS)
// ARQUITETO: PARCEIRO DE PROGRAMAÇÃO
// =============================================================================

(function() {
    "use strict";

    let particles = [];
    let time = 0;

    const Game = {
        state: 'BOOT', // BOOT, SCANNING, EXTRACTING
        score: 0,
        
        // IA Visual (COCO-SSD)
        objectModel: null,
        detectedItems: [],
        lastDetectTime: 0,
        
        // Mecânica de Captura
        scanProgress: 0,
        targetItem: null,
        cooldown: 0,
        
        // Missão
        itemsRecovered: 0,
        moneyEarned: 0, 

        // Estética Corporativa "USR"
        colorMain: '#00ffff', // Ciano brilhante
        colorDanger: '#ff003c', // Vermelho alerta
        colorSuccess: '#00ff66', // Verde sucesso

        init: function(faseData) {
            this.state = 'BOOT';
            this.score = 0;
            this.itemsRecovered = 0;
            this.moneyEarned = 0;
            this.scanProgress = 0;
            this.cooldown = 0;
            particles = [];
            time = 0;
            
            this.loadAIModel();
        },

        loadAIModel: async function() {
            // Carrega a IA do Google (TensorFlow)
            if (typeof cocoSsd === 'undefined') {
                const script = document.createElement('script');
                script.src = "https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd";
                document.head.appendChild(script);
                
                script.onload = async () => {
                    this.objectModel = await cocoSsd.load();
                    this.state = 'SCANNING';
                    if(window.Sfx) window.Sfx.play(800, 'square', 0.5, 0.2);
                };
            } else {
                this.objectModel = await cocoSsd.load();
                this.state = 'SCANNING';
            }
        },

        update: function(ctx, w, h, pose) {
            time += 0.05;

            // 1. DESENHA A CÂMERA DE FUNDO (VISÃO DO CAMINHÃO)
            if (window.System.video && window.System.video.readyState === 4) {
                const videoRatio = window.System.video.videoWidth / window.System.video.videoHeight;
                const canvasRatio = w / h;
                let drawW = w, drawH = h, drawX = 0, drawY = 0;
                // Preenche a tela inteira sem distorcer
                if (videoRatio > canvasRatio) { drawW = h * videoRatio; drawX = (w - drawW) / 2; } 
                else { drawH = w / videoRatio; drawY = (h - drawH) / 2; }
                ctx.drawImage(window.System.video, drawX, drawY, drawW, drawH);
            } else {
                ctx.fillStyle = '#050505'; ctx.fillRect(0, 0, w, h);
            }

            if (this.state === 'BOOT') {
                this.drawGiantOverlay(ctx, w, h, "CONECTANDO IA", "AGUARDE...");
                return this.score;
            }

            this.playMode(ctx, w, h);
            return this.score;
        },

        drawGiantOverlay: function(ctx, w, h, title, sub) {
            ctx.fillStyle = "rgba(0, 10, 20, 0.85)"; ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = this.colorMain; ctx.textAlign = "center";
            ctx.font = "bold clamp(40px, 8vw, 70px) 'Russo One'";
            ctx.fillText(title, w/2, h/2);
            ctx.fillStyle = "#fff"; ctx.font = "bold clamp(20px, 5vw, 40px) 'Chakra Petch'";
            ctx.fillText(sub, w/2, h/2 + 60);
        },

        playMode: function(ctx, w, h) {
            const cx = w / 2;
            const cy = h / 2;
            let potentialTarget = null;

            if (this.cooldown > 0) this.cooldown--;

            // =========================================================================
            // LÓGICA DA IA (MODO "ASPIRADOR": EXTREMAMENTE PERMISSIVO PARA BRINQUEDOS)
            // =========================================================================
            if (this.objectModel && window.System.video && window.System.video.readyState === 4) {
                
                // Analisa a imagem a cada 200ms
                if (Date.now() - this.lastDetectTime > 200) {
                    this.objectModel.detect(window.System.video).then(predictions => {
                        this.detectedItems = predictions;
                    });
                    this.lastDetectTime = Date.now();
                }

                const scaleX = w / window.System.video.videoWidth;
                const scaleY = h / window.System.video.videoHeight;

                this.detectedItems.forEach(item => {
                    // Ignora se for pessoa ou coisas gigantes estruturais (sofá, cama, tv)
                    const ignoredClasses = ['person', 'bed', 'sofa', 'tv', 'refrigerator', 'door', 'dining table'];
                    if (ignoredClasses.includes(item.class)) return;

                    // O SEGREDO: Threshold absurdamente baixo (20%). 
                    // Se a IA achar que o carrinho é um "mouse" ou um "pássaro" com 20% de certeza, nós aceitamos!
                    if (item.score < 0.20) return;

                    const boxW = item.bbox[2] * scaleX;
                    const boxH = item.bbox[3] * scaleY;
                    
                    // Se for do tamanho da tela inteira, ignora. Queremos objetos soltos no chão.
                    if (boxW > w * 0.8 || boxH > h * 0.8) return;

                    const boxX = item.bbox[0] * scaleX;
                    const boxY = item.bbox[1] * scaleY;
                    const itemCx = boxX + (boxW/2);
                    const itemCy = boxY + (boxH/2);

                    // Desenha a moldura no objeto
                    this.drawHologramBox(ctx, boxX, boxY, boxW, boxH, "ROBÔ/SUCATA");

                    // HITBOX GIGANTE NO CENTRO: Se o centro do objeto estiver perto do centro da tela
                    const distToCenter = Math.hypot(itemCx - cx, itemCy - cy);
                    
                    if (distToCenter < 250 && this.cooldown <= 0 && this.state === 'SCANNING') {
                        potentialTarget = { cx: itemCx, cy: itemCy, w: boxW, h: boxH };
                    }
                });
            }

            // ==========================================
            // MÁQUINA DE ESTADOS (TRAVAMENTO E CAPTURA)
            // ==========================================

            if (this.state === 'SCANNING') {
                if (potentialTarget) {
                    this.targetItem = potentialTarget;
                    this.state = 'EXTRACTING';
                    if(window.Sfx) window.Sfx.play(1000, 'sawtooth', 0.1, 0.1);
                }
            }

            if (this.state === 'EXTRACTING') {
                if (potentialTarget) {
                    this.targetItem = potentialTarget; 
                    
                    // Barra de travamento enche em cerca de 1 segundo
                    this.scanProgress += 4;
                    
                    if (this.scanProgress % 10 === 0 && window.Sfx) window.Sfx.hover();

                    // MIRA TRAVANDO (Animação visual gigante)
                    ctx.save();
                    ctx.translate(cx, cy); 
                    ctx.rotate(time * 2);
                    ctx.strokeStyle = this.colorDanger; 
                    ctx.lineWidth = 15; 
                    
                    // Círculo fechando
                    const ringSize = Math.max(100, 300 - (this.scanProgress * 2));
                    ctx.beginPath(); ctx.arc(0, 0, ringSize, 0, Math.PI*2); ctx.stroke();
                    ctx.restore();

                    // Feixe de luz até o objeto
                    ctx.strokeStyle = "rgba(255, 0, 0, 0.8)"; ctx.lineWidth = 10;
                    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(this.targetItem.cx, this.targetItem.cy); ctx.stroke();

                    // CAPTURADO!
                    if (this.scanProgress >= 100) {
                        this.itemsRecovered++;
                        let reward = Math.floor(Math.random() * 500) + 500; // R$ 500 a 1000
                        this.moneyEarned += reward;
                        this.score += reward / 10;
                        
                        this.state = 'SCANNING';
                        this.scanProgress = 0;
                        this.cooldown = 60; // 1 segundo de pausa até a próxima captura
                        
                        if(window.Gfx) window.Gfx.shakeScreen(30);
                        if(window.Sfx) window.Sfx.epic();
                        
                        this.spawnCaptureEffect(this.targetItem.cx, this.targetItem.cy);
                        this.targetItem = null;

                        window.System.msg("RECOLHIDO: + R$ " + reward);
                    }
                } else {
                    // Objeto fugiu da mira (Carrinho andou muito rápido)
                    this.scanProgress = Math.max(0, this.scanProgress - 6);
                    if (this.scanProgress <= 0) {
                        this.state = 'SCANNING';
                        this.targetItem = null;
                    }
                }
            }

            // RENDERIZA O HUD GIGANTE
            this.drawMachineHUD(ctx, w, h, cx, cy);
            this.updateParticles(ctx);
        },

        drawHologramBox: function(ctx, x, y, bw, bh, label) {
            ctx.strokeStyle = "rgba(0, 255, 255, 0.8)"; ctx.lineWidth = 6;
            const l = 30; // Quinas grandes
            
            ctx.beginPath();
            ctx.moveTo(x, y+l); ctx.lineTo(x, y); ctx.lineTo(x+l, y);
            ctx.moveTo(x+bw-l, y); ctx.lineTo(x+bw, y); ctx.lineTo(x+bw, y+l);
            ctx.moveTo(x+bw, y+bh-l); ctx.lineTo(x+bw, y+bh); ctx.lineTo(x+bw-l, y+bh);
            ctx.moveTo(x+l, y+bh); ctx.lineTo(x, y+bh); ctx.lineTo(x, y+bh-l);
            ctx.stroke();

            ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
            ctx.font = "bold clamp(18px, 4vw, 24px) 'Russo One'";
            const textW = ctx.measureText(label).width;
            ctx.fillRect(x, y - 35, textW + 20, 35);
            ctx.fillStyle = this.colorMain; ctx.textAlign = "left";
            ctx.fillText(label, x + 10, y - 10);
        },

        drawMachineHUD: function(ctx, w, h, cx, cy) {
            // Efeito de sombra pesada nas bordas (foco no centro)
            const grad = ctx.createRadialGradient(cx, cy, h*0.4, cx, cy, h);
            grad.addColorStop(0, "rgba(0,0,0,0)");
            grad.addColorStop(1, "rgba(0,0,0,0.8)");
            ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);

            // =====================================
            // ESTADO DE ALERTA NO TOPO
            // =====================================
            if (this.state === 'EXTRACTING') {
                ctx.fillStyle = `rgba(255, 0, 60, ${Math.abs(Math.sin(time*5))*0.4})`;
                ctx.fillRect(0, 0, w, h); // Tela pisca em vermelho

                ctx.fillStyle = this.colorDanger; ctx.textAlign = "center";
                ctx.font = "bold clamp(40px, 8vw, 80px) 'Russo One'";
                ctx.fillText("TRAVANDO ALVO!", w/2, 80);
                
                // BARRA DE PROGRESSO GIGANTE
                ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
                ctx.fillRect(w*0.1, h*0.75, w*0.8, 50);
                ctx.fillStyle = this.colorDanger;
                ctx.fillRect(w*0.1, h*0.75, (this.scanProgress/100) * (w*0.8), 50);
                ctx.strokeStyle = "#fff"; ctx.lineWidth = 4;
                ctx.strokeRect(w*0.1, h*0.75, w*0.8, 50);
            } 
            else if (this.state === 'SCANNING') {
                // MIRA GIGANTE CONSTANTE
                ctx.strokeStyle = "rgba(0, 255, 255, 0.3)"; ctx.lineWidth = 6;
                ctx.beginPath(); ctx.arc(cx, cy, 200, 0, Math.PI*2); ctx.stroke();
                ctx.beginPath(); ctx.arc(cx, cy, 100, 0, Math.PI*2); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(cx-220, cy); ctx.lineTo(cx+220, cy); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(cx, cy-220); ctx.lineTo(cx, cy+220); ctx.stroke();
                
                ctx.fillStyle = this.colorMain; ctx.textAlign = "center";
                ctx.font = "bold clamp(30px, 6vw, 60px) 'Russo One'";
                ctx.fillText("BUSCANDO MATÉRIA", w/2, 60);
            }

            // =====================================
            // PAINEL DE COLETAS (RODAPÉ GIGANTE)
            // =====================================
            ctx.fillStyle = "rgba(0, 20, 30, 0.95)"; ctx.fillRect(0, h - 110, w, 110);
            ctx.strokeStyle = this.colorMain; ctx.lineWidth = 5; 
            ctx.beginPath(); ctx.moveTo(0, h - 110); ctx.lineTo(w, h - 110); ctx.stroke();

            ctx.textAlign = "left";
            ctx.fillStyle = "#fff"; ctx.font = "bold clamp(20px, 4vw, 30px) 'Chakra Petch'";
            ctx.fillText(`UNIDADES RECOLHIDAS: ${this.itemsRecovered}`, 20, h - 65);
            
            ctx.fillStyle = this.colorSuccess; ctx.font = "bold clamp(35px, 7vw, 60px) 'Russo One'";
            ctx.fillText(`R$ ${this.moneyEarned.toLocaleString('pt-BR')}`, 20, h - 20);

            if (this.cooldown > 0) {
                ctx.textAlign = "right";
                ctx.fillStyle = "#f39c12"; ctx.font = "bold clamp(20px, 4vw, 30px) 'Russo One'";
                ctx.fillText("REINICIANDO...", w - 20, h - 45);
            }
        },

        spawnCaptureEffect: function(x, y) {
            // Explosão de energia cibernética
            for(let i=0; i<60; i++) {
                const angle = Math.random() * Math.PI * 2;
                const speed = Math.random() * 25 + 5;
                particles.push({
                    type: 'boom', x: x, y: y,
                    vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
                    life: 1.0, size: Math.random() * 12 + 4, color: this.colorMain
                });
            }
            // Flash Gigante
            particles.push({ type: 'flash', life: 1.0 });
        },

        updateParticles: function(ctx) {
            ctx.globalCompositeOperation = 'screen';
            
            particles.forEach(p => {
                if (p.type === 'boom') {
                    p.x += p.vx; p.y += p.vy; 
                    p.life -= 0.05; p.size *= 0.90;
                    ctx.fillStyle = p.color;
                    ctx.globalAlpha = Math.max(0, p.life);
                    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill();
                } 
                else if (p.type === 'flash') {
                    ctx.globalAlpha = Math.max(0, p.life * 0.5);
                    ctx.fillStyle = "#ffffff";
                    ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
                    p.life -= 0.1; 
                }
            });
            
            ctx.globalAlpha = 1.0;
            ctx.globalCompositeOperation = 'source-over';
            particles = particles.filter(p => p.life > 0);
        },

        cleanup: function() {}
    };

    const regLoop = setInterval(() => {
        if(window.System && window.System.registerGame) {
            window.System.registerGame('ar_collector', 'AR USR Collector', '🤖', Game, {
                camera: 'environment', // Câmera Traseira
                phases: [
                    { id: 'f1', name: 'LIMPEZA DO SETOR', desc: 'Pilote o veículo e recolha objetos perdidos pela casa.', reqLvl: 1 }
                ]
            });
            clearInterval(regLoop);
        }
    }, 100);

})();