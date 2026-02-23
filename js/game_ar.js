// =============================================================================
// CYBER HUNTER AR: CAÇADOR DE GIGANTES (MOVENET + REALIDADE AUMENTADA)
// LÓGICA PERFEITA: USA A IA DO CONSOLE PARA RASTREAR PESSOAS REAIS!
// =============================================================================

(function() {
    "use strict";

    let particles = [];
    let crosshairAngle = 0;

    const Game = {
        state: 'START', // START, PLAY, GAMEOVER
        score: 0,
        
        // Alvos e Capturas
        targetsCaptured: 0,
        targetGoal: 5, // Quantas pessoas/gigantes precisa escanear para vencer
        scanProgress: 0,
        
        // Cooldown para não escanear a mesma pessoa 100x por segundo
        cooldownTimer: 0, 
        
        // Estética
        hudColor: '#00ffff',
        alertColor: '#ff003c',

        init: function(faseData) {
            this.state = 'START';
            this.score = 0;
            this.targetsCaptured = 0;
            this.scanProgress = 0;
            this.cooldownTimer = 0;
            particles = [];
            
            // Se a fase enviou um objetivo, a gente usa
            if (faseData && faseData.goal) this.targetGoal = faseData.goal;

            window.System.msg("SISTEMA DE MIRA ATIVADO");
            this.setupInput();
        },

        setupInput: function() {
            window.System.canvas.onclick = () => {
                if (this.state === 'START') {
                    this.state = 'PLAY';
                    if (window.Sfx && window.Sfx.epic) window.Sfx.epic();
                }
            };
        },

        update: function(ctx, w, h, pose) {
            crosshairAngle += 0.02;

            // 1. DESENHA A CÂMERA DE FUNDO (A VISÃO DO CAMINHÃO)
            if (window.System.video && window.System.video.readyState === 4) {
                // Desenha o vídeo esticado para preencher o canvas
                ctx.drawImage(window.System.video, 0, 0, w, h);
            } else {
                ctx.fillStyle = '#050505'; ctx.fillRect(0, 0, w, h);
            }

            if (this.state === 'START') {
                this.drawOverlay(ctx, w, h, "CAÇADOR CIBERNÉTICO", "Toque na tela para ligar o scanner do Caminhão");
                return this.score;
            }

            if (this.state === 'PLAY') {
                this.playMode(ctx, w, h, pose);
            }

            return this.score;
        },

        drawOverlay: function(ctx, w, h, title, sub) {
            ctx.fillStyle = "rgba(0, 15, 30, 0.8)"; ctx.fillRect(0, 0, w, h);
            
            // Linhas de scanner de fundo
            ctx.fillStyle = "rgba(0, 255, 255, 0.1)";
            for(let i=0; i<h; i+=10) ctx.fillRect(0, i, w, 1);

            ctx.fillStyle = this.hudColor; ctx.textAlign = "center";
            ctx.font = "bold clamp(30px, 8vw, 60px) 'Russo One'";
            ctx.shadowColor = this.hudColor; ctx.shadowBlur = 15;
            ctx.fillText(title, w/2, h/2 - 20);
            ctx.shadowBlur = 0;
            
            ctx.fillStyle = "#fff"; ctx.font = "clamp(14px, 4vw, 24px) 'Chakra Petch'";
            ctx.fillText(sub, w/2, h/2 + 40);
        },

        playMode: function(ctx, w, h, pose) {
            const cx = w / 2;
            const cy = h / 2;
            let targetInSight = false;
            let isLockingOn = false;

            // ==============================================================
            // A MÁGICA: USANDO A IA (MOVENET) PARA LER AS PESSOAS REAIS!
            // ==============================================================
            
            if (this.cooldownTimer > 0) {
                this.cooldownTimer--; // Esfriando a arma/scanner
            }

            if (pose && pose.keypoints && window.System.video) {
                // Calcula a escala entre o tamanho real do vídeo e o tamanho do nosso canvas
                const scaleX = w / window.System.video.videoWidth;
                const scaleY = h / window.System.video.videoHeight;

                // Vamos focar no nariz/peito da pessoa para ser o "Alvo"
                const nose = pose.keypoints.find(k => k.name === 'nose');
                const lShoulder = pose.keypoints.find(k => k.name === 'left_shoulder');
                const rShoulder = pose.keypoints.find(k => k.name === 'right_shoulder');

                // Só processa se a IA tiver certeza que viu alguém (score > 0.3)
                if (nose && nose.score > 0.3) {
                    targetInSight = true;

                    // Mapeia a posição da IA para a tela do celular
                    const targetX = nose.x * scaleX;
                    const targetY = nose.y * scaleY;
                    
                    // Desenha o Esqueleto Cibernético na pessoa real!
                    this.drawCyberSkeleton(ctx, pose.keypoints, scaleX, scaleY);

                    // Verifica a distância do alvo para o centro da tela (Mira do Caminhão)
                    const distToCenter = Math.hypot(targetX - cx, targetY - cy);
                    
                    // Se o sobrinho manobrou o caminhão e botou a pessoa no meio da tela (raio de 100px)
                    if (distToCenter < 120 && this.cooldownTimer <= 0) {
                        isLockingOn = true;
                        this.scanProgress += 3; // Enche a barrinha rápido
                        
                        // Desenha linha conectando a mira ao alvo
                        ctx.strokeStyle = this.alertColor; ctx.lineWidth = 2;
                        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(targetX, targetY); ctx.stroke();
                        
                        if (this.scanProgress % 5 === 0 && window.Sfx && window.Sfx.hover) window.Sfx.hover();

                        // CAPTUROU A PESSOA!
                        if (this.scanProgress >= 100) {
                            this.targetsCaptured++;
                            this.score += 500;
                            this.scanProgress = 0;
                            this.cooldownTimer = 150; // Espera ~2.5 segundos para poder capturar de novo
                            
                            if(window.Gfx) window.Gfx.shakeScreen(20);
                            if(window.Sfx && window.Sfx.coin) window.Sfx.coin();
                            window.System.msg("ALVO NEUTRALIZADO!");
                            
                            this.spawnExplosion(targetX, targetY);
                        }
                    } else if (!isLockingOn) {
                        // Se a pessoa fugir da mira, o progresso zera aos poucos
                        this.scanProgress = Math.max(0, this.scanProgress - 2);
                    }

                    // Desenha a caixa de alvo ao redor do rosto da pessoa
                    this.drawTargetBox(ctx, targetX, targetY, isLockingOn);
                }
            }

            if (!targetInSight) {
                this.scanProgress = Math.max(0, this.scanProgress - 1);
            }

            // ==============================================================
            // DESENHA O HUD CIBERNÉTICO DA TELA (Visão do Caminhão)
            // ==============================================================
            this.drawHUD(ctx, w, h, cx, cy, targetInSight, isLockingOn);
            this.updateParticles(ctx);

            // Verifica Condição de Vitória
            if (this.targetsCaptured >= this.targetGoal) {
                this.state = 'GAMEOVER';
                window.System.msg("MISSÃO CUMPRIDA!");
                setTimeout(() => window.System.gameOver(this.score, true, 50), 2500);
            }
        },

        // Função que desenha o esqueleto da pessoa com estilo "Homem de Ferro / Exterminador"
        drawCyberSkeleton: function(ctx, keypoints, scaleX, scaleY) {
            ctx.strokeStyle = "rgba(0, 255, 255, 0.6)";
            ctx.lineWidth = 2;
            ctx.fillStyle = this.hudColor;

            // Desenha os pontos (juntas)
            keypoints.forEach(kp => {
                if (kp.score > 0.3) {
                    const x = kp.x * scaleX; const y = kp.y * scaleY;
                    ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI*2); ctx.fill();
                    
                    // Pequeno detalhe cibernético em cada junta
                    ctx.strokeRect(x - 6, y - 6, 12, 12);
                }
            });

            // Conecta as linhas (Braços, corpo)
            const connect = (p1Name, p2Name) => {
                const p1 = keypoints.find(k => k.name === p1Name);
                const p2 = keypoints.find(k => k.name === p2Name);
                if (p1 && p2 && p1.score > 0.3 && p2.score > 0.3) {
                    ctx.beginPath();
                    ctx.moveTo(p1.x * scaleX, p1.y * scaleY);
                    ctx.lineTo(p2.x * scaleX, p2.y * scaleY);
                    ctx.stroke();
                }
            };

            connect('left_shoulder', 'right_shoulder');
            connect('left_shoulder', 'left_elbow'); connect('left_elbow', 'left_wrist');
            connect('right_shoulder', 'right_elbow'); connect('right_elbow', 'right_wrist');
            connect('left_shoulder', 'left_hip'); connect('right_shoulder', 'right_hip');
            connect('left_hip', 'right_hip');
        },

        drawTargetBox: function(ctx, x, y, isLocking) {
            const size = 60;
            ctx.strokeStyle = isLocking ? this.alertColor : this.hudColor;
            ctx.lineWidth = 3;
            
            ctx.save();
            ctx.translate(x, y);
            
            // Quinas da caixa de alvo
            const d = size/2;
            const l = 15; // tamanho da linha da quina
            ctx.beginPath();
            // Cima Esquerda
            ctx.moveTo(-d, -d+l); ctx.lineTo(-d, -d); ctx.lineTo(-d+l, -d);
            // Cima Direita
            ctx.moveTo(d-l, -d); ctx.lineTo(d, -d); ctx.lineTo(d, -d+l);
            // Baixo Direita
            ctx.moveTo(d, d-l); ctx.lineTo(d, d); ctx.lineTo(d-l, d);
            // Baixo Esquerda
            ctx.moveTo(-d+l, d); ctx.lineTo(-d, d); ctx.lineTo(-d, d-l);
            ctx.stroke();

            // Texto identificando
            ctx.fillStyle = isLocking ? this.alertColor : this.hudColor;
            ctx.font = "12px 'Chakra Petch'";
            ctx.fillText("GIGANTE DETECTADO", 0, -d - 10);
            
            ctx.restore();
        },

        drawHUD: function(ctx, w, h, cx, cy, targetInSight, isLockingOn) {
            // Efeito de vinheta (bordas escuras)
            const grad = ctx.createRadialGradient(cx, cy, h*0.4, cx, cy, h);
            grad.addColorStop(0, "rgba(0,20,10,0)");
            grad.addColorStop(1, "rgba(0,20,10,0.8)");
            ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);

            // MIRA CENTRAL DO CAMINHÃO
            ctx.save();
            ctx.translate(cx, cy);
            
            // Roda da mira
            ctx.rotate(crosshairAngle);
            ctx.strokeStyle = isLockingOn ? this.alertColor : "rgba(0, 255, 255, 0.4)";
            ctx.lineWidth = 2;
            ctx.setLineDash([15, 10]);
            ctx.beginPath(); ctx.arc(0, 0, 120, 0, Math.PI*2); ctx.stroke();
            
            ctx.rotate(-crosshairAngle * 2);
            ctx.setLineDash([30, 20]);
            ctx.beginPath(); ctx.arc(0, 0, 90, 0, Math.PI*2); ctx.stroke();
            
            ctx.restore();

            // Ponto central
            ctx.fillStyle = isLockingOn ? this.alertColor : this.hudColor;
            ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI*2); ctx.fill();

            // Barra de Progresso (Carregando Laser)
            if (this.scanProgress > 0) {
                ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(cx - 100, cy + 140, 200, 20);
                ctx.fillStyle = this.alertColor; ctx.fillRect(cx - 100, cy + 140, this.scanProgress * 2, 20);
                ctx.strokeStyle = "#fff"; ctx.strokeRect(cx - 100, cy + 140, 200, 20);
                
                ctx.fillStyle = "#fff"; ctx.font = "bold 16px Arial"; ctx.textAlign="center";
                ctx.fillText("TRAVANDO ALVO: " + Math.floor(this.scanProgress) + "%", cx, cy + 175);
            }

            // TEXTOS E INFORMAÇÕES DO PAINEL
            ctx.fillStyle = this.hudColor; ctx.textAlign = "left";
            ctx.font = "bold 18px 'Chakra Petch'";
            ctx.fillText(`GIGANTES CAPTURADOS: ${this.targetsCaptured} / ${this.targetGoal}`, 20, 40);
            
            ctx.font = "14px 'Chakra Petch'";
            ctx.fillText(targetInSight ? ">> SENSOR: ALVO NA ÁREA" : ">> SENSOR: PROCURANDO...", 20, 70);

            if (this.cooldownTimer > 0) {
                ctx.fillStyle = "#f1c40f";
                ctx.fillText(`RECARREGANDO LASER...`, 20, 100);
            }

            // Interface inferior (Bateria/Motor do caminhão)
            ctx.textAlign = "right";
            ctx.fillStyle = this.hudColor;
            ctx.fillText("BATERIA DO ROVER", w - 20, h - 30);
            ctx.fillStyle = "rgba(0,255,255,0.3)"; ctx.fillRect(w - 120, h - 25, 100, 10);
            ctx.fillStyle = this.hudColor; ctx.fillRect(w - 120, h - 25, 80, 10); // 80%
        },

        spawnExplosion: function(x, y) {
            for(let i=0; i<40; i++) {
                const angle = Math.random() * Math.PI * 2;
                const speed = Math.random() * 15 + 5;
                particles.push({
                    x: x, y: y,
                    vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
                    life: 1.0, size: Math.random() * 8 + 4, 
                    color: Math.random() > 0.5 ? this.alertColor : '#fff'
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
        }
    };

    // Registra o jogo no Core
    const regLoop = setInterval(() => {
        if(window.System && window.System.registerGame) {
            // Nota: Manteve o opts.camera caso você já tenha adaptado no core, mas a mágica real agora é o MOVENET
            window.System.registerGame('ar_hunter', 'Caçador Cyber', '🎯', Game, {
                camera: 'environment', // Câmera Traseira
                phases: [
                    { id: 'f1', name: 'INVASÃO DOS GIGANTES', desc: 'Pilote o caminhão, mire nas pessoas da casa e capture 5 Gigantes!', goal: 5, reqLvl: 1 }
                ]
            });
            clearInterval(regLoop);
        }
    }, 100);

})();