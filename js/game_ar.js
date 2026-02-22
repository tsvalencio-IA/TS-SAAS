// =============================================================================
// AR SAFARI V2: MISSÃO RESGATE (TOY STORY ROVER EDITION)
// =============================================================================

(function() {
    "use strict";

    let aliens = [];
    let particles = [];

    const Game = {
        state: 'START', // START, CALIBRATE, PLAY
        score: 0,
        
        // Dados do Giroscópio
        orientation: { alpha: 0, beta: 0, gamma: 0 },
        baseAlpha: 0, // A direção "frente" do caminhãozinho
        
        init: function(faseData) {
            this.state = 'START';
            this.score = 0;
            aliens = [];
            particles = [];
            
            window.System.msg("INICIANDO SISTEMAS DO ROVER");
            this.setupInput();
        },

        setupInput: function() {
            window.System.canvas.onclick = async () => {
                if (this.state === 'START') {
                    // Pede permissão do sensor (obrigatório em iOS, ignorado no Android)
                    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
                        try {
                            const permission = await DeviceOrientationEvent.requestPermission();
                            if (permission === 'granted') {
                                this.startSensors();
                            }
                        } catch (error) {
                            console.error("Erro no sensor", error);
                        }
                    } else {
                        this.startSensors();
                    }
                    this.state = 'CALIBRATE';
                    window.Sfx.click();
                } else if (this.state === 'CALIBRATE') {
                    // Define a direção atual do celular como o "Norte" (Frente do caminhão)
                    this.baseAlpha = this.orientation.alpha;
                    
                    // Cria os ETs espalhados em relação à frente do caminhão (-120 graus a +120 graus)
                    for(let i=0; i<8; i++) {
                        this.spawnAlien();
                    }
                    
                    this.state = 'PLAY';
                    window.Sfx.play(400, 'square', 0.5, 0.2); // Som de nave ligando
                }
            };
        },

        startSensors: function() {
            window.addEventListener('deviceorientation', (event) => {
                this.orientation.alpha = event.alpha || 0;
                this.orientation.beta = event.beta || 0;
            });
        },

        spawnAlien: function() {
            // Cria ETs apenas num arco na frente e nos lados do caminhão, não muito atrás
            let angleOffset = (Math.random() * 240) - 120; // -120 a +120 graus
            let targetAlpha = this.baseAlpha + angleOffset;
            
            // Corrige se passar de 360
            if (targetAlpha >= 360) targetAlpha -= 360;
            if (targetAlpha < 0) targetAlpha += 360;

            aliens.push({
                alpha: targetAlpha, 
                beta: (Math.random() * 40) - 20, // Altura virtual
                type: Math.random() > 0.5 ? '👽' : '👾',
                scanProgress: 0,
                captured: false,
                floatOffset: Math.random() * Math.PI * 2 // Para eles flutuarem
            });
        },

        // Função mágica para calcular a menor distância angular (para o ET não dar a volta no mundo)
        getShortestAngle: function(target, current) {
            let diff = target - current;
            while (diff <= -180) diff += 360;
            while (diff > 180) diff -= 360;
            return diff;
        },

        update: function(ctx, w, h, pose) {
            // 1. DESENHA A CÂMERA DE FUNDO (REALIDADE AUMENTADA)
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
                ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
            }

            // CONTROLE DE ESTADOS
            if (this.state === 'START') {
                this.drawOverlay(ctx, w, h, "TELA DE COMANDO INATIVA", "Toque para ligar os sensores");
                return this.score;
            }

            if (this.state === 'CALIBRATE') {
                this.drawOverlay(ctx, w, h, "CALIBRAÇÃO DO ROVER", "Aponte o caminhão para a FRENTE e toque na tela");
                return this.score;
            }

            if (this.state === 'PLAY') {
                this.playMode(ctx, w, h);
            }

            return this.score;
        },

        drawOverlay: function(ctx, w, h, title, sub) {
            ctx.fillStyle = "rgba(0, 20, 40, 0.8)";
            ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = "#0ff";
            ctx.textAlign = "center";
            ctx.font = "bold clamp(20px, 5vw, 40px) 'Russo One'";
            ctx.fillText(title, w/2, h/2 - 20);
            ctx.fillStyle = "#fff";
            ctx.font = "clamp(12px, 3vw, 20px) Arial";
            ctx.fillText(sub, w/2, h/2 + 30);
        },

        playMode: function(ctx, w, h) {
            const cx = w / 2;
            const cy = h / 2;
            let targetLocked = false; // Tem algo na mira?

            // 2. LÓGICA DE DETECÇÃO E CAPTURA
            aliens.forEach(alien => {
                if (alien.captured) return;

                // Calcula onde o ET está em relação para onde o celular aponta
                let diffAlpha = this.getShortestAngle(alien.alpha, this.orientation.alpha);
                let diffBeta = alien.beta - this.orientation.beta;

                // Transforma o grau em Posição na Tela (Velocidade de movimento da câmera)
                const screenX = cx + (diffAlpha * 18); // Multiplicador de sensibilidade
                
                // Animação do ET flutuando suavemente
                alien.floatOffset += 0.05;
                const floatY = Math.sin(alien.floatOffset) * 20;
                const screenY = cy + (diffBeta * 18) + floatY;

                // Só desenha se estiver perto de aparecer na tela
                if (screenX > -150 && screenX < w + 150) {
                    
                    // Desenha o Brilho do ET
                    const gradient = ctx.createRadialGradient(screenX, screenY, 10, screenX, screenY, 60);
                    gradient.addColorStop(0, "rgba(50, 255, 50, 0.5)");
                    gradient.addColorStop(1, "rgba(50, 255, 50, 0)");
                    ctx.fillStyle = gradient;
                    ctx.beginPath(); ctx.arc(screenX, screenY, 60, 0, Math.PI*2); ctx.fill();
                    
                    // Desenha o ET
                    ctx.font = "60px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
                    ctx.fillText(alien.type, screenX, screenY);

                    // --- SISTEMA DE MIRA FACILITADA (TRAVA DE MIRA) ---
                    // Se o ET estiver num raio GIGANTE do centro (120 pixels)
                    const distToCenter = Math.hypot(screenX - cx, screenY - cy);
                    
                    if (distToCenter < 120) {
                        targetLocked = true;
                        alien.scanProgress += 2.5; // Enche rápido!
                        
                        // Desenha a mira focada nele! (Tractor Beam)
                        ctx.strokeStyle = "#f00"; ctx.lineWidth = 4;
                        ctx.beginPath();
                        ctx.arc(screenX, screenY, 80 - (alien.scanProgress/2), 0, Math.PI*2);
                        ctx.stroke();

                        // Linha puxando para o centro da tela
                        ctx.strokeStyle = "rgba(255, 0, 0, 0.5)"; ctx.lineWidth = 2;
                        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(screenX, screenY); ctx.stroke();

                        if (alien.scanProgress % 5 === 0) window.Sfx.hover(); // Bip de travamento

                        // CAPTUROU!
                        if (alien.scanProgress >= 100) {
                            alien.captured = true;
                            this.score += 150;
                            window.Sfx.coin();
                            window.Gfx.shakeScreen(15);
                            this.spawnParticles(screenX, screenY);
                            window.System.msg("ALIENÍGENA RESGATADO!");
                        }
                    } else {
                        // Se sair da mira, perde o progresso devagarinho (perdoa a tremedeira do carrinho)
                        alien.scanProgress = Math.max(0, alien.scanProgress - 0.5);
                    }
                }
            });

            // 3. DESENHA O PAINEL DA NAVE (COCKPIT)
            this.drawCockpit(ctx, w, h, targetLocked);
            this.updateParticles(ctx);

            // Verifica se ganhou
            const activeAliens = aliens.filter(a => !a.captured);
            if (activeAliens.length === 0) {
                window.System.msg("MISSÃO COMPLETA!");
                setTimeout(() => window.System.gameOver(this.score, true, 5), 2000);
            }
        },

        drawCockpit: function(ctx, w, h, isLocked) {
            const cx = w / 2;
            const cy = h / 2;

            // Borda do parabrisa da nave
            ctx.strokeStyle = "#2c3e50"; ctx.lineWidth = 15;
            ctx.strokeRect(0, 0, w, h);
            
            // Vidro com reflexo azulado suave
            ctx.fillStyle = "rgba(0, 150, 255, 0.05)";
            ctx.fillRect(0, 0, w, h);

            // MIRA CENTRAL (Gigante e perdoadora)
            ctx.strokeStyle = isLocked ? "#f00" : "rgba(0, 255, 255, 0.5)";
            ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(cx, cy, 120, 0, Math.PI * 2); ctx.stroke();
            
            // Retículas
            ctx.beginPath(); ctx.moveTo(cx - 140, cy); ctx.lineTo(cx - 100, cy); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(cx + 140, cy); ctx.lineTo(cx + 100, cy); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(cx, cy - 140); ctx.lineTo(cx, cy - 100); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(cx, cy + 140); ctx.lineTo(cx, cy + 100); ctx.stroke();

            // ==========================================
            // RADAR DE NAVEGAÇÃO (Canto inferior direito)
            // ==========================================
            const radarX = w - 70;
            const radarY = h - 70;
            const radarRadius = 50;

            // Fundo do Radar
            ctx.fillStyle = "rgba(0, 50, 0, 0.8)";
            ctx.beginPath(); ctx.arc(radarX, radarY, radarRadius, 0, Math.PI*2); ctx.fill();
            ctx.strokeStyle = "#0f0"; ctx.lineWidth = 2; ctx.stroke();
            
            // Linhas do Radar
            ctx.beginPath(); ctx.moveTo(radarX - radarRadius, radarY); ctx.lineTo(radarX + radarRadius, radarY); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(radarX, radarY - radarRadius); ctx.lineTo(radarX, radarY + radarRadius); ctx.stroke();

            // Ponto central (O Caminhão)
            ctx.fillStyle = "#fff";
            ctx.beginPath(); ctx.arc(radarX, radarY, 3, 0, Math.PI*2); ctx.fill();

            // Desenha os ETs no radar
            aliens.forEach(alien => {
                if (alien.captured) return;
                
                // Calcula a posição do ET no radar em relação para onde o celular aponta agora
                let radarAngle = this.getShortestAngle(alien.alpha, this.orientation.alpha);
                
                // Converte graus para radianos (ajustado para o topo do radar ser a frente)
                let rad = (radarAngle - 90) * (Math.PI / 180);
                
                // Posiciona o ponto vermelho no radar
                let dotX = radarX + Math.cos(rad) * (radarRadius * 0.7); // 0.7 para ficar dentro do círculo
                let dotY = radarY + Math.sin(rad) * (radarRadius * 0.7);

                ctx.fillStyle = "#f00";
                ctx.beginPath(); ctx.arc(dotX, dotY, 4, 0, Math.PI*2); ctx.fill();
            });

            // Informações Textuais
            ctx.fillStyle = "#0ff";
            ctx.font = "bold 16px 'Chakra Petch'";
            ctx.textAlign = "left";
            const capturados = aliens.filter(a => a.captured).length;
            ctx.fillText(`ALVOS RESGATADOS: ${capturados}/${aliens.length}`, 20, h - 30);
            
            if (isLocked) {
                ctx.fillStyle = "#f00";
                ctx.textAlign = "center";
                ctx.fillText("TRAVANDO MIRA...", cx, cy - 140);
            }
        },

        spawnParticles: function(x, y) {
            for(let i=0; i<30; i++) {
                particles.push({
                    x: x, y: y,
                    vx: (Math.random() - 0.5) * 20,
                    vy: (Math.random() - 0.5) * 20,
                    life: 1.0,
                    color: Math.random() > 0.5 ? '#0f0' : '#0ff'
                });
            }
        },

        updateParticles: function(ctx) {
            particles.forEach(p => {
                p.x += p.vx; p.y += p.vy; p.life -= 0.05;
                ctx.fillStyle = p.color;
                ctx.globalAlpha = Math.max(0, p.life);
                ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI*2); ctx.fill();
                ctx.globalAlpha = 1.0;
            });
            particles = particles.filter(p => p.life > 0);
        }
    };

    // Registra o jogo no Core
    const regLoop = setInterval(() => {
        if(window.System && window.System.registerGame) {
            window.System.registerGame('ar_safari', 'Missão Resgate', '🚀', Game, {
                camera: 'environment', // Pede câmera traseira
                phases: [
                    { id: 'f1', name: 'PATRULHA ESPACIAL', desc: 'Pilote o Rover e resgate 8 ETs.', reqLvl: 1 }
                ]
            });
            clearInterval(regLoop);
        }
    }, 100);

})();