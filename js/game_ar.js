// =============================================================================
// AR NEON HIGHWAY: PISTA HOLOGRÁFICA NO MUNDO REAL
// =============================================================================

(function() {
    "use strict";

    let particles = [];
    
    // Configurações da Pista 3D
    const roadWidth = 2000;
    const segmentLength = 200;
    const drawDistance = 50;

    const Game = {
        state: 'START', // START, CALIBRATE, PLAY, GAMEOVER
        score: 0,
        speed: 0,
        maxSpeed: 150, // Velocidade da pista virtual
        
        // Dados do Jogador e Sensores
        position: 0, // Posição lateral no mundo virtual (-1000 a 1000)
        playerZ: 0,  // Distância percorrida
        baseAlpha: 0,// Calibração da direção do caminhão
        currentAlpha: 0,
        health: 100,

        // A Pista
        track: [],
        items: [],

        init: function(faseData) {
            this.state = 'START';
            this.score = 0;
            this.speed = 0;
            this.position = 0;
            this.playerZ = 0;
            this.health = 100;
            particles = [];
            this.generateTrack();
            
            window.System.msg("INICIALIZANDO PISTA AR");
            this.setupInput();
        },

        generateTrack: function() {
            this.track = [];
            this.items = [];
            let currentCurve = 0;
            
            // Cria 1000 segmentos de pista (longa!)
            for (let i = 0; i < 1000; i++) {
                // A cada 50 segmentos, muda a curva da pista
                if (i % 50 === 0) {
                    currentCurve = (Math.random() * 4 - 2); // Curva entre -2 (esq) e +2 (dir)
                    if (i < 50) currentCurve = 0; // Começa reto
                }

                this.track.push({
                    y: 0, // Altura do chão
                    curve: currentCurve
                });

                // Adiciona obstáculos ou moedas na pista
                if (i > 50 && i % 15 === 0) {
                    let type = Math.random() > 0.3 ? 'coin' : 'block';
                    this.items.push({
                        segmentIndex: i,
                        offset: (Math.random() * 1.5) - 0.75, // Posição lateral (-0.75 a 0.75)
                        type: type,
                        active: true
                    });
                }
            }
        },

        setupInput: function() {
            window.System.canvas.onclick = async () => {
                if (this.state === 'START') {
                    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
                        try {
                            const permission = await DeviceOrientationEvent.requestPermission();
                            if (permission === 'granted') this.startSensors();
                        } catch (e) { console.error("Erro sensor", e); }
                    } else {
                        this.startSensors();
                    }
                    this.state = 'CALIBRATE';
                    window.Sfx.click();
                } else if (this.state === 'CALIBRATE') {
                    // Define o "Norte" como a direção atual do caminhão
                    this.baseAlpha = this.currentAlpha;
                    this.state = 'PLAY';
                    this.speed = 20; // Começa a acelerar
                    window.Sfx.epic();
                }
            };
        },

        startSensors: function() {
            window.addEventListener('deviceorientation', (event) => {
                this.currentAlpha = event.alpha || 0;
            });
        },

        // Função para calcular a menor diferença angular (direção do volante)
        getSteering: function() {
            let diff = this.currentAlpha - this.baseAlpha;
            while (diff <= -180) diff += 360;
            while (diff > 180) diff -= 360;
            return diff; // Retorna graus (ex: -15 = esquerda, +15 = direita)
        },

        update: function(ctx, w, h, pose) {
            // 1. DESENHA A CÂMERA DE FUNDO (O mundo real)
            if (window.System.video && window.System.video.readyState === 4) {
                const videoRatio = window.System.video.videoWidth / window.System.video.videoHeight;
                const canvasRatio = w / h;
                let drawW = w, drawH = h, drawX = 0, drawY = 0;
                if (videoRatio > canvasRatio) { drawW = h * videoRatio; drawX = (w - drawW) / 2; } 
                else { drawH = w / videoRatio; drawY = (h - drawH) / 2; }
                ctx.drawImage(window.System.video, drawX, drawY, drawW, drawH);
            } else {
                ctx.fillStyle = '#111'; ctx.fillRect(0, 0, w, h);
            }

            // CONTROLE DE ESTADOS
            if (this.state === 'START') {
                this.drawOverlay(ctx, w, h, "AR NEON HIGHWAY", "Toque para ligar a Rodovia Holográfica");
                return this.score;
            }

            if (this.state === 'CALIBRATE') {
                this.drawOverlay(ctx, w, h, "ALINHAMENTO", "Aponte o caminhão para FRENTE e toque na tela");
                return this.score;
            }

            if (this.state === 'PLAY') {
                this.playMode(ctx, w, h);
            }

            return this.score;
        },

        drawOverlay: function(ctx, w, h, title, sub) {
            ctx.fillStyle = "rgba(0, 10, 20, 0.8)"; ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = "#0ff"; ctx.textAlign = "center";
            ctx.font = "bold clamp(30px, 6vw, 50px) 'Russo One'";
            ctx.shadowColor = "#0ff"; ctx.shadowBlur = 15;
            ctx.fillText(title, w/2, h/2 - 20);
            ctx.shadowBlur = 0;
            ctx.fillStyle = "#fff"; ctx.font = "clamp(14px, 4vw, 20px) Arial";
            ctx.fillText(sub, w/2, h/2 + 30);
        },

        playMode: function(ctx, w, h) {
            // ==========================================
            // LÓGICA DE MOVIMENTO E FÍSICA
            // ==========================================
            
            // Aceleração
            if (this.speed < this.maxSpeed) this.speed += 0.5;
            this.playerZ += this.speed;

            // Encontra em qual segmento da pista estamos agora
            let currentSegIndex = Math.floor(this.playerZ / segmentLength);
            let currentSeg = this.track[currentSegIndex];

            // Direção (Volante)
            let steering = this.getSteering(); // Graus que o caminhão real virou
            
            // Move a posição virtual baseada em quanto o caminhão real virou, 
            // mas também é puxado pela curva da pista!
            // Se a pista vira pra direita (curve positiva), ele é jogado para a esquerda se não virar junto.
            const curveForce = (currentSeg ? currentSeg.curve : 0) * (this.speed * 0.1);
            
            // O caminhão vira na direção física (steering) contra a força da curva
            this.position += (steering * 2) - curveForce;

            // Atrito/Bater nas bordas (Fora da estrada)
            let offRoad = false;
            if (this.position < -roadWidth/1.5 || this.position > roadWidth/1.5) {
                offRoad = true;
                this.speed *= 0.95; // Perde velocidade
                this.health -= 0.2; // Toma dano
                window.Gfx.addShake(2); // Treme a tela
            }

            if (this.health <= 0) {
                this.state = 'GAMEOVER';
                window.System.msg("CAMINHÃO DESTRUÍDO!");
                setTimeout(() => window.System.gameOver(this.score, false, 0), 2000);
            }

            // Fim da pista
            if (currentSegIndex >= this.track.length - drawDistance) {
                this.state = 'GAMEOVER';
                window.System.msg("RODOVIA CONCLUÍDA!");
                setTimeout(() => window.System.gameOver(this.score, true, 50), 2000);
            }

            // ==========================================
            // RENDERIZAÇÃO 3D DA PISTA
            // ==========================================
            const camH = 1000 + (offRoad ? Math.sin(Date.now()*0.05)*50 : 0); // Pula se estiver fora da pista
            let maxy = h;
            let dX = 0; // Deslocamento X para a curva

            // Função mágica de projeção 3D
            const project = (pX, pY, pZ, camX, camY, camZ) => {
                let scale = 0.8 / (pZ - camZ); // Fator de profundidade
                let x = (w / 2) + (scale * (pX - camX) * w);
                let y = (h / 2) - (scale * (pY - camY) * h);
                let w_scale = scale * roadWidth * w;
                return { x, y, w: w_scale, scale };
            };

            // Desenha os segmentos de trás pra frente (Painter's algorithm)
            for (let i = drawDistance; i > 0; i--) {
                let segIdx = currentSegIndex + i;
                if (segIdx >= this.track.length) continue;
                
                let seg = this.track[segIdx];
                let p1 = project(0, seg.y, segIdx * segmentLength, this.position - dX, camH, this.playerZ);
                
                // Calcula a curva para o próximo segmento
                dX += seg.curve;
                
                let p2 = project(0, seg.y, (segIdx + 1) * segmentLength, this.position - dX, camH, this.playerZ);

                // Só desenha se estiver na tela
                if (p1.y >= maxy) continue;
                maxy = p1.y;

                // Cores da pista Holográfica (Alterna para dar sensação de movimento)
                let isDark = Math.floor(segIdx / 3) % 2 === 0;
                
                // --- DESENHA O CHÃO DA PISTA (Translúcido) ---
                ctx.fillStyle = isDark ? "rgba(0, 50, 100, 0.4)" : "rgba(0, 80, 150, 0.4)";
                ctx.beginPath();
                ctx.moveTo(p1.x - p1.w, p1.y);
                ctx.lineTo(p1.x + p1.w, p1.y);
                ctx.lineTo(p2.x + p2.w, p2.y);
                ctx.lineTo(p2.x - p2.w, p2.y);
                ctx.fill();

                // --- DESENHA AS BORDAS NEON ---
                ctx.strokeStyle = isDark ? "#0ff" : "#f0f";
                ctx.lineWidth = 3;
                
                // Borda Esquerda
                ctx.beginPath(); ctx.moveTo(p1.x - p1.w, p1.y); ctx.lineTo(p2.x - p2.w, p2.y); ctx.stroke();
                // Borda Direita
                ctx.beginPath(); ctx.moveTo(p1.x + p1.w, p1.y); ctx.lineTo(p2.x + p2.w, p2.y); ctx.stroke();
                
                // Linha central
                if (isDark) {
                    ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 2;
                    ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
                }

                // --- DESENHA OBSTÁCULOS/ITENS ---
                this.items.forEach(item => {
                    if (item.segmentIndex === segIdx && item.active) {
                        let itemX = p1.x + (p1.w * item.offset);
                        let itemScale = p1.scale * w * 300; // Tamanho visual
                        
                        if (item.type === 'coin') {
                            ctx.fillStyle = "#f1c40f";
                            ctx.beginPath(); ctx.arc(itemX, p1.y - (itemScale/2), itemScale/2, 0, Math.PI*2); ctx.fill();
                            ctx.strokeStyle = "#fff"; ctx.lineWidth=2; ctx.stroke();
                        } else {
                            ctx.fillStyle = "#e74c3c"; // Bloco de perigo
                            ctx.fillRect(itemX - itemScale/2, p1.y - itemScale, itemScale, itemScale);
                            ctx.strokeStyle = "#fff"; ctx.strokeRect(itemX - itemScale/2, p1.y - itemScale, itemScale, itemScale);
                        }

                        // Colisão (quando o item chega muito perto da câmera)
                        if (i < 3) {
                            let distToCenter = Math.abs(this.position - (roadWidth * item.offset));
                            if (distToCenter < 600) { // Hitbox
                                item.active = false;
                                if (item.type === 'coin') {
                                    this.score += 100;
                                    window.Sfx.coin();
                                    this.spawnParticles(w/2, h - 100, '#f1c40f');
                                } else {
                                    this.speed *= 0.5; // Bateu no bloco!
                                    this.health -= 15;
                                    window.Sfx.error();
                                    window.Gfx.shakeScreen(15);
                                    this.spawnParticles(w/2, h - 100, '#e74c3c');
                                }
                            }
                        }
                    }
                });
            }

            // ==========================================
            // DESENHA O HUD E O CAPÔ DO CAMINHÃO
            // ==========================================
            
            // Efeito vermelho se estiver fora da pista
            if (offRoad) {
                ctx.fillStyle = "rgba(255, 0, 0, 0.2)";
                ctx.fillRect(0, 0, w, h);
            }

            // O Capô Cibernético
            ctx.fillStyle = "#2c3e50";
            ctx.beginPath();
            ctx.moveTo(w*0.1, h);
            ctx.lineTo(w*0.3, h - 80);
            ctx.lineTo(w*0.7, h - 80);
            ctx.lineTo(w*0.9, h);
            ctx.fill();
            ctx.strokeStyle = "#0ff"; ctx.lineWidth = 4; ctx.stroke();
            
            // Grades de ventilação do caminhão
            ctx.fillStyle = "#1a252f";
            ctx.fillRect(w*0.4, h - 60, w*0.2, 20);

            // Interface
            ctx.fillStyle = "#fff"; ctx.font = "bold 20px 'Chakra Petch'"; ctx.textAlign="left";
            ctx.fillText(`KM/H: ${Math.floor(this.speed * 1.5)}`, 20, 40);
            ctx.fillText(`DIST: ${Math.floor(this.playerZ / 100)}m`, 20, 70);
            
            ctx.textAlign="right";
            ctx.fillText(`GIRO: ${Math.floor(steering)}°`, w - 20, 40);

            // Barra de Vida
            ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(20, h - 40, 200, 20);
            ctx.fillStyle = this.health > 40 ? "#2ecc71" : "#e74c3c";
            ctx.fillRect(20, h - 40, this.health * 2, 20);
            ctx.strokeStyle = "#fff"; ctx.strokeRect(20, h - 40, 200, 20);

            this.updateParticles(ctx);
        },

        spawnParticles: function(x, y, color) {
            for(let i=0; i<20; i++) {
                particles.push({
                    x: x, y: y,
                    vx: (Math.random() - 0.5) * 15,
                    vy: (Math.random() - 0.5) * 15 - 5, // Pula pra cima
                    life: 1.0,
                    size: Math.random() * 8 + 4,
                    color: color
                });
            }
        },

        updateParticles: function(ctx) {
            particles.forEach(p => {
                p.x += p.vx; p.y += p.vy; 
                p.vy += 0.5; // Gravidade
                p.life -= 0.05; p.size *= 0.95;
                ctx.fillStyle = p.color;
                ctx.globalAlpha = Math.max(0, p.life);
                ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill();
            });
            ctx.globalAlpha = 1.0;
            particles = particles.filter(p => p.life > 0);
        }
    };

    // Registra o jogo no Core
    const regLoop = setInterval(() => {
        if(window.System && window.System.registerGame) {
            window.System.registerGame('ar_safari', 'Neon Highway', '🛣️', Game, {
                camera: 'environment', // Pede câmera traseira!
                phases: [
                    { id: 'f1', name: 'RODOVIA CIBERNÉTICA', desc: 'Siga a pista, desvie dos blocos vermelhos e pegue as moedas.', reqLvl: 1 }
                ]
            });
            clearInterval(regLoop);
        }
    }, 100);

})();