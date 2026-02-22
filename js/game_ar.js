// =============================================================================
// AR SAFARI: MISSÃO ESPACIAL (REALIDADE AUMENTADA + GIROSCÓPIO)
// =============================================================================

(function() {
    "use strict";

    let aliens = [];
    let particles = [];

    const Game = {
        state: 'START', // START, PLAY, GAMEOVER
        score: 0,
        
        // Dados do Giroscópio
        orientation: { alpha: 0, beta: 0, gamma: 0 },
        permissionGranted: false,

        init: function(faseData) {
            this.state = 'START';
            this.score = 0;
            aliens = [];
            particles = [];
            
            // Cria 10 alienígenas espalhados em 360 graus
            for(let i=0; i<10; i++) {
                this.spawnAlien();
            }

            window.System.msg("INICIAR SCANNER");
            this.setupInput();
        },

        spawnAlien: function() {
            aliens.push({
                // Posição virtual em graus (0 a 360 para os lados, -45 a 45 para cima/baixo)
                alpha: Math.random() * 360, 
                beta: (Math.random() * 60) - 30, 
                type: Math.random() > 0.5 ? '👾' : '🛸',
                scanProgress: 0,
                captured: false
            });
        },

        setupInput: function() {
            // No clique inicial, pedimos permissão para o Giroscópio (obrigatório em iPhones)
            window.System.canvas.onclick = async () => {
                if (this.state === 'START') {
                    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
                        try {
                            const permission = await DeviceOrientationEvent.requestPermission();
                            if (permission === 'granted') {
                                this.startSensors();
                            }
                        } catch (error) {
                            console.error("Erro ao pedir sensor", error);
                        }
                    } else {
                        // Android e outros navegadores que não pedem permissão explícita
                        this.startSensors();
                    }
                    this.state = 'PLAY';
                    window.Sfx.play(800, 'square', 0.5, 0.1);
                }
            };
        },

        startSensors: function() {
            this.permissionGranted = true;
            window.addEventListener('deviceorientation', (event) => {
                // alpha = rotação Z (bússola), beta = inclinação frente/trás
                this.orientation.alpha = event.alpha || 0;
                this.orientation.beta = event.beta || 0;
            });
        },

        update: function(ctx, w, h, pose) {
            // 1. DESENHA A CÂMERA DE FUNDO
            if (window.System.video && window.System.video.readyState === 4) {
                // Desenhamos o vídeo preenchendo o canvas para dar o efeito de AR
                // Como removemos o espelhamento da câmera traseira no core.js, a imagem fica certa!
                const videoRatio = window.System.video.videoWidth / window.System.video.videoHeight;
                const canvasRatio = w / h;
                let drawWidth = w, drawHeight = h, drawX = 0, drawY = 0;

                // Garante que o vídeo cubra toda a tela sem distorcer (efeito object-fit: cover)
                if (videoRatio > canvasRatio) {
                     drawWidth = h * videoRatio;
                     drawX = (w - drawWidth) / 2;
                } else {
                     drawHeight = w / videoRatio;
                     drawY = (h - drawHeight) / 2;
                }
                ctx.drawImage(window.System.video, drawX, drawY, drawWidth, drawHeight);
            } else {
                ctx.fillStyle = '#111'; ctx.fillRect(0, 0, w, h);
            }

            if (this.state === 'START') {
                this.drawStartScreen(ctx, w, h);
                return this.score;
            }

            if (this.state === 'PLAY') {
                this.playMode(ctx, w, h);
                return this.score;
            }

            return this.score;
        },

        playMode: function(ctx, w, h) {
            const cx = w / 2;
            const cy = h / 2;
            let scanningSomething = false;

            // 2. LÓGICA DE REALIDADE AUMENTADA (Posicionamento)
            aliens.forEach(alien => {
                if (alien.captured) return;

                // Diferença de ângulo (ajustado para o menor caminho no círculo de 360 graus)
                let diffAlpha = alien.alpha - this.orientation.alpha;
                if (diffAlpha > 180) diffAlpha -= 360;
                if (diffAlpha < -180) diffAlpha += 360;

                let diffBeta = alien.beta - this.orientation.beta;

                // Transforma a diferença de graus em pixels na tela (Campo de Visão)
                const screenX = cx + (diffAlpha * 15);
                const screenY = cy + (diffBeta * 15);

                // Desenha o Alienígena se estiver dentro ou perto da tela
                if (screenX > -100 && screenX < w + 100 && screenY > -100 && screenY < h + 100) {
                    
                    // Alvo ao redor do alien
                    ctx.fillStyle = "rgba(0, 255, 0, 0.2)";
                    ctx.beginPath(); ctx.arc(screenX, screenY, 40, 0, Math.PI*2); ctx.fill();
                    
                    ctx.font = "50px Arial"; ctx.textAlign = "center";
                    ctx.fillText(alien.type, screenX, screenY + 15);

                    // 3. LÓGICA DE CAPTURA (O SCANNER HUD)
                    const distToCenter = Math.hypot(screenX - cx, screenY - cy);
                    
                    if (distToCenter < 60) { // Raio da mira central
                        scanningSomething = true;
                        alien.scanProgress += 2; // Enche a barra
                        
                        // Barra de progresso do alien
                        ctx.fillStyle = "#f00"; ctx.fillRect(screenX - 30, screenY + 30, 60, 10);
                        ctx.fillStyle = "#0f0"; ctx.fillRect(screenX - 30, screenY + 30, (alien.scanProgress/100)*60, 10);

                        if (alien.scanProgress % 10 === 0) window.Sfx.hover();

                        if (alien.scanProgress >= 100) {
                            alien.captured = true;
                            this.score += 100;
                            window.Sfx.coin();
                            window.Gfx.shakeScreen(10);
                            this.spawnParticles(screenX, screenY);
                            window.System.msg("ESPÉCIME CAPTURADO!");
                        }
                    } else {
                        alien.scanProgress = Math.max(0, alien.scanProgress - 1);
                    }
                }
            });

            // 4. DESENHA O HUD VIRTUAL (Visão de Robô)
            this.drawHUD(ctx, w, h, scanningSomething);
            this.updateParticles(ctx);

            // Verifica Vitória
            const activeAliens = aliens.filter(a => !a.captured);
            if (activeAliens.length === 0) {
                window.System.msg("ZONA LIMPA!");
                setTimeout(() => window.System.gameOver(this.score, true, 5), 2000);
            }
        },

        drawHUD: function(ctx, w, h, isScanning) {
            const cx = w / 2;
            const cy = h / 2;

            // Filtro estilo visão noturna / robô
            ctx.fillStyle = "rgba(0, 50, 0, 0.15)";
            ctx.fillRect(0, 0, w, h);

            // Mira Central
            ctx.strokeStyle = isScanning ? "#0f0" : "rgba(0, 255, 255, 0.6)";
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(cx, cy, 60, 0, Math.PI * 2);
            ctx.stroke();

            ctx.beginPath(); ctx.moveTo(cx - 80, cy); ctx.lineTo(cx - 20, cy); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(cx + 80, cy); ctx.lineTo(cx + 20, cy); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(cx, cy - 80); ctx.lineTo(cx, cy - 20); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(cx, cy + 80); ctx.lineTo(cx, cy + 20); ctx.stroke();

            // Painel de Dados
            ctx.fillStyle = "#0ff";
            ctx.font = "bold 16px 'Chakra Petch'";
            ctx.textAlign = "left";
            ctx.fillText(`GIRO X: ${Math.floor(this.orientation.alpha)}°`, 20, h - 60);
            ctx.fillText(`GIRO Y: ${Math.floor(this.orientation.beta)}°`, 20, h - 40);
            
            ctx.textAlign = "right";
            const capturados = aliens.filter(a => a.captured).length;
            ctx.fillText(`CAPTURADOS: ${capturados}/${aliens.length}`, w - 20, h - 40);
        },

        drawStartScreen: function(ctx, w, h) {
            ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
            ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = "#0ff";
            ctx.textAlign = "center";
            ctx.font = "bold 30px 'Russo One'";
            ctx.fillText("MODO EXPLORADOR AR", w/2, h/2 - 20);
            
            ctx.fillStyle = "#fff";
            ctx.font = "16px Arial";
            ctx.fillText("Toque na tela para ligar os sensores", w/2, h/2 + 20);
        },

        spawnParticles: function(x, y) {
            for(let i=0; i<20; i++) {
                particles.push({
                    x: x, y: y,
                    vx: (Math.random() - 0.5) * 15,
                    vy: (Math.random() - 0.5) * 15,
                    life: 1.0
                });
            }
        },

        updateParticles: function(ctx) {
            particles.forEach(p => {
                p.x += p.vx; p.y += p.vy; p.life -= 0.05;
                ctx.fillStyle = `rgba(0, 255, 255, ${Math.max(0, p.life)})`;
                ctx.fillRect(p.x, p.y, 5, 5);
            });
            particles = particles.filter(p => p.life > 0);
        }
    };

    // Note o parâmetro { camera: 'environment' } -> É isso que avisa ao core.js para virar a câmera!
    const regLoop = setInterval(() => {
        if(window.System && window.System.registerGame) {
            window.System.registerGame('ar_safari', 'AR Safari', '🛸', Game, {
                camera: 'environment',
                phases: [
                    { id: 'f1', name: 'ZONA DE TESTES', desc: 'Capture os 10 alienígenas na sua sala.', reqLvl: 1 }
                ]
            });
            clearInterval(regLoop);
        }
    }, 100);

})();