// =============================================================================
// J.A.R.V.I.S. RC TRUCK: RECUPERAÇÃO DE SUCATA E CARRINHOS (VISÃO À DISTÂNCIA)
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
        
        // Dicionário de objetos que a IA reconhece transformados em "Sucata"
        // Colocamos mouse, celular e controle porque a IA confunde Hot Wheels com eles!
        targetMappings: {
            'car': { name: 'VEÍCULO', val: 5000, color: '#f39c12' },
            'truck': { name: 'VEÍCULO PESADO', val: 7500, color: '#f39c12' },
            'bus': { name: 'ÔNIBUS', val: 8000, color: '#f39c12' },
            'train': { name: 'VAGÃO', val: 9000, color: '#f39c12' },
            'mouse': { name: 'PEÇA METÁLICA', val: 1500, color: '#00ffff' },
            'cell phone': { name: 'MÓDULO', val: 2000, color: '#00ffff' },
            'remote': { name: 'CONTROLE', val: 1800, color: '#00ffff' },
            'bottle': { name: 'CILINDRO', val: 1000, color: '#2ecc71' },
            'cup': { name: 'RECIPIENTE', val: 800, color: '#2ecc71' },
            'sports ball': { name: 'NÚCLEO REDONDO', val: 3000, color: '#e74c3c' }
        },
        
        // Mecânica de Captura
        scanProgress: 0,
        targetItem: null,
        cooldown: 0,
        
        // Missão
        itemsRecovered: 0,
        moneyEarned: 0, 

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
            if (typeof cocoSsd === 'undefined') {
                const script = document.createElement('script');
                script.src = "https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd";
                document.head.appendChild(script);
                
                script.onload = async () => {
                    this.objectModel = await cocoSsd.load();
                    this.state = 'SCANNING';
                    if(window.Sfx) window.Sfx.play(600, 'square', 0.5, 0.2);
                };
            } else {
                this.objectModel = await cocoSsd.load();
                this.state = 'SCANNING';
            }
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
                ctx.fillStyle = '#0a0a0a'; ctx.fillRect(0, 0, w, h);
            }

            if (this.state === 'BOOT') {
                this.drawOverlayGigante(ctx, w, h, "INICIANDO IA...", "AGUARDE");
                return this.score;
            }

            this.playMode(ctx, w, h);
            return this.score;
        },

        drawOverlayGigante: function(ctx, w, h, title, sub) {
            ctx.fillStyle = "rgba(0, 0, 0, 0.85)"; ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = "#00ffff"; ctx.textAlign = "center";
            // Fontes GIGANTES para ler de longe
            ctx.font = "bold clamp(40px, 10vw, 80px) 'Russo One'";
            ctx.fillText(title, w/2, h/2);
            ctx.fillStyle = "#fff"; ctx.font = "bold clamp(20px, 5vw, 40px) 'Chakra Petch'";
            ctx.fillText(sub, w/2, h/2 + 60);
        },

        playMode: function(ctx, w, h) {
            const cx = w / 2;
            const cy = h / 2;
            let potentialTarget = null;

            if (this.cooldown > 0) this.cooldown--;

            // ==========================================
            // LÓGICA DA IA (DETECÇÃO BAIXOU O FILTRO PARA 35%)
            // ==========================================
            if (this.objectModel && window.System.video && window.System.video.readyState === 4) {
                
                // Roda a IA super rápido
                if (Date.now() - this.lastDetectTime > 200) {
                    this.objectModel.detect(window.System.video).then(predictions => {
                        this.detectedItems = predictions;
                    });
                    this.lastDetectTime = Date.now();
                }

                const scaleX = w / window.System.video.videoWidth;
                const scaleY = h / window.System.video.videoHeight;

                this.detectedItems.forEach(item => {
                    const mappedData = this.targetMappings[item.class];
                    // Diminuí a exigência da IA para 30% (ela vai achar muito mais coisas agora)
                    if (!mappedData || item.score < 0.30) return;

                    const boxW = item.bbox[2] * scaleX;
                    const boxH = item.bbox[3] * scaleY;
                    
                    // Se for gigante (ex: um sofá), ignora. Tem que ser brinquedo/pequeno.
                    if (boxW > w * 0.75) return;

                    const boxX = item.bbox[0] * scaleX;
                    const boxY = item.bbox[1] * scaleY;
                    const itemCx = boxX + (boxW/2);
                    const itemCy = boxY + (boxH/2);

                    // Desenha HUD no objeto
                    this.drawSmartBox(ctx, boxX, boxY, boxW, boxH, mappedData.name, mappedData.color);

                    // Verifica se está no centro da tela
                    const distToCenter = Math.hypot(itemCx - cx, itemCy - cy);
                    
                    // Aumentei o raio de captura para ficar mais fácil com o carrinho tremendo
                    if (distToCenter < 180 && this.cooldown <= 0 && this.state === 'SCANNING') {
                        potentialTarget = { ...item, cx: itemCx, cy: itemCy, w: boxW, h: boxH, data: mappedData };
                    }
                });
            }

            // ==========================================
            // LÓGICA DE EXTRAÇÃO
            // ==========================================
            if (this.state === 'SCANNING') {
                if (potentialTarget) {
                    this.targetItem = potentialTarget;
                    this.state = 'EXTRACTING';
                    if(window.Sfx) window.Sfx.play(1000, 'sawtooth', 0.1, 0.1);
                }
            }

            if (this.state === 'EXTRACTING') {
                if (potentialTarget && potentialTarget.data.name === this.targetItem.data.name) {
                    this.targetItem = potentialTarget; 
                    
                    // Carrega a barra BEM MAIS RÁPIDO (1 segundo já captura)
                    this.scanProgress += 3.5;
                    
                    if (this.scanProgress % 10 === 0 && window.Sfx) window.Sfx.hover();

                    // --- EFEITO GIGANTE DE MIRA TRAVANDO ---
                    ctx.save();
                    ctx.translate(cx, cy); // Mira fixa no centro da tela
                    ctx.rotate(time);
                    ctx.strokeStyle = "#ff0000"; 
                    ctx.lineWidth = 15; // Linha muito grossa para ver de longe
                    
                    // O círculo vai fechando
                    const ringSize = Math.max(80, 200 - this.scanProgress);
                    ctx.beginPath(); ctx.arc(0, 0, ringSize, 0, Math.PI*2); ctx.stroke();
                    ctx.restore();

                    // Linha do centro até o objeto
                    ctx.strokeStyle = "rgba(255, 0, 0, 0.8)"; ctx.lineWidth = 8;
                    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(this.targetItem.cx, this.targetItem.cy); ctx.stroke();

                    // CONCLUIU A EXTRAÇÃO!
                    if (this.scanProgress >= 100) {
                        this.itemsRecovered++;
                        let reward = this.targetItem.data.val;
                        this.moneyEarned += reward;
                        this.score += reward / 10;
                        
                        this.state = 'SCANNING';
                        this.scanProgress = 0;
                        this.cooldown = 90; // Espera ~1.5 seg para focar em outro
                        
                        if(window.Gfx) window.Gfx.shakeScreen(30);
                        if(window.Sfx) window.Sfx.epic();
                        
                        this.spawnOrbitalStrike(this.targetItem.cx, this.targetItem.cy, this.targetItem.data.color);
                        this.targetItem = null;

                        // Notificação Gigante de Dinheiro
                        window.System.msg("+ R$ " + reward);
                    }
                } else {
                    // Perdeu
                    this.scanProgress = Math.max(0, this.scanProgress - 5);
                    if (this.scanProgress <= 0) {
                        this.state = 'SCANNING';
                        this.targetItem = null;
                        if(window.Sfx) window.Sfx.error();
                    }
                }
            }

            // DESENHA O HUD PRINCIPAL GIGANTE
            this.drawMassiveHUD(ctx, w, h, cx, cy);
            this.updateParticles(ctx, w, h);
        },

        drawSmartBox: function(ctx, x, y, bw, bh, label, color) {
            // Desenha a caixa no objeto
            ctx.strokeStyle = color; ctx.lineWidth = 6;
            ctx.strokeRect(x, y, bw, bh);

            // Fundo escuro para a letra dar contraste
            ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
            // Letras GIGANTES para ler de longe
            ctx.font = "bold clamp(20px, 4vw, 30px) 'Russo One'";
            const textW = ctx.measureText(label).width;
            ctx.fillRect(x, y - 40, textW + 20, 40);
            
            ctx.fillStyle = color; ctx.textAlign = "left";
            ctx.fillText(label, x + 10, y - 10);
        },

        drawMassiveHUD: function(ctx, w, h, cx, cy) {
            // Efeito visual na tela (Filtro escuro nas bordas para destacar o meio)
            const grad = ctx.createRadialGradient(cx, cy, h*0.3, cx, cy, h);
            grad.addColorStop(0, "rgba(0,0,0,0)");
            grad.addColorStop(1, "rgba(0,0,0,0.6)");
            ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);

            // =====================================
            // AVISOS GIGANTES NA TELA
            // =====================================
            if (this.state === 'EXTRACTING') {
                // Tela pisca em vermelho suave
                ctx.fillStyle = `rgba(255, 0, 0, ${Math.abs(Math.sin(time*5))*0.3})`;
                ctx.fillRect(0, 0, w, h);

                ctx.fillStyle = "#ff0000"; ctx.textAlign = "center";
                ctx.font = "bold clamp(40px, 8vw, 80px) 'Russo One'";
                ctx.shadowColor = "#000"; ctx.shadowBlur = 10;
                ctx.fillText("TRAVANDO ALVO!", w/2, 80);
                
                // Barra de Loading GIGANTE no meio
                ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
                ctx.fillRect(w*0.1, h*0.7, w*0.8, 60);
                ctx.fillStyle = "#ff0000";
                ctx.fillRect(w*0.1, h*0.7, (this.scanProgress/100) * (w*0.8), 60);
                ctx.strokeStyle = "#fff"; ctx.lineWidth = 4;
                ctx.strokeRect(w*0.1, h*0.7, w*0.8, 60);
            } 
            else if (this.state === 'SCANNING') {
                // Tela normal, mira central gigante
                ctx.strokeStyle = "rgba(0, 255, 255, 0.5)"; ctx.lineWidth = 4;
                ctx.beginPath(); ctx.arc(cx, cy, 150, 0, Math.PI*2); ctx.stroke();
                // Cruz
                ctx.beginPath(); ctx.moveTo(cx-170, cy); ctx.lineTo(cx+170, cy); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(cx, cy-170); ctx.lineTo(cx, cy+170); ctx.stroke();
                
                // Texto superior
                ctx.fillStyle = "#00ffff"; ctx.textAlign = "center";
                ctx.font = "bold clamp(30px, 6vw, 60px) 'Russo One'";
                ctx.shadowColor = "#000"; ctx.shadowBlur = 10;
                ctx.fillText("PROCURANDO SUCATA", w/2, 60);
            }

            ctx.shadowBlur = 0; // reseta sombra

            // =====================================
            // PAINEL DE DINHEIRO (RODAPÉ GIGANTE)
            // =====================================
            ctx.fillStyle = "rgba(0, 0, 0, 0.85)"; ctx.fillRect(0, h - 100, w, 100);
            ctx.strokeStyle = "#00ffff"; ctx.lineWidth = 4; 
            ctx.beginPath(); ctx.moveTo(0, h - 100); ctx.lineTo(w, h - 100); ctx.stroke();

            ctx.textAlign = "left";
            ctx.fillStyle = "#00ffff"; ctx.font = "bold clamp(20px, 4vw, 30px) 'Chakra Petch'";
            ctx.fillText(`ITENS: ${this.itemsRecovered}`, 20, h - 60);
            
            ctx.fillStyle = "#2ecc71"; ctx.font = "bold clamp(30px, 6vw, 50px) 'Russo One'";
            ctx.fillText(`R$ ${this.moneyEarned.toLocaleString('pt-BR')}`, 20, h - 20);

            // Cooldown alert
            if (this.cooldown > 0) {
                ctx.textAlign = "right";
                ctx.fillStyle = "#f39c12"; ctx.font = "bold clamp(20px, 4vw, 30px) 'Russo One'";
                ctx.fillText("RECARREGANDO...", w - 20, h - 45);
            }
        },

        // Efeito visual quando o brinquedo é sugado
        spawnOrbitalStrike: function(x, y, color) {
            for(let i=0; i<80; i++) {
                const angle = Math.random() * Math.PI * 2;
                const speed = Math.random() * 30 + 10;
                particles.push({
                    type: 'boom', x: x, y: y,
                    vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
                    life: 1.0, size: Math.random() * 15 + 5, color: color
                });
            }
            
            // O Raio Laser descendo do teto
            particles.push({ type: 'laser', x: x, y: y, life: 1.0, color: '#00ffff' });
        },

        updateParticles: function(ctx, w, h) {
            ctx.globalCompositeOperation = 'screen';
            
            particles.forEach(p => {
                if (p.type === 'boom') {
                    p.x += p.vx; p.y += p.vy; 
                    p.life -= 0.04; p.size *= 0.92;
                    ctx.fillStyle = p.color;
                    ctx.globalAlpha = Math.max(0, p.life);
                    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill();
                } 
                else if (p.type === 'laser') {
                    ctx.globalAlpha = Math.max(0, p.life);
                    ctx.fillStyle = "rgba(0, 255, 255, 0.9)";
                    // Laser gigante cobrindo o objeto
                    ctx.fillRect(p.x - 60, 0, 120, p.y);
                    ctx.fillStyle = "#ffffff";
                    ctx.fillRect(p.x - 25, 0, 50, p.y);
                    p.life -= 0.05; 
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
            window.System.registerGame('ar_recovery', 'Recuperador AR', '🚁', Game, {
                camera: 'environment', // Câmera Traseira obrigatória!
                phases: [
                    { id: 'f1', name: 'PATRULHA DE SUCATA', desc: 'Pilote e colete os brinquedos perdidos pelo chão.', reqLvl: 1 }
                ]
            });
            clearInterval(regLoop);
        }
    }, 100);

})();