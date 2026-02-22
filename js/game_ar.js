// =============================================================================
// RC TRUCK SIMULATOR: MISSÕES NO MUNDO REAL (VISÃO COMPUTACIONAL + SENSORES)
// =============================================================================

(function() {
    "use strict";

    let particles = [];

    const Game = {
        state: 'START', // START, PLAY, MISSION_COMPLETE
        score: 0,
        
        // Dados dos Sensores
        currentForce: 0, // Mede os solavancos do caminhão
        
        // Missões Reais
        currentMissionIndex: 0,
        scanProgress: 0,
        
        missions: [
            { type: 'color', target: 'red',   label: 'ENCONTRE ALGO VERMELHO', desc: 'Pilote e pare de frente para um objeto VERMELHO.' },
            { type: 'dark',  target: 'dark',  label: 'ENTRE EM UM TÚNEL',      desc: 'Dirija para um local ESCURO (ex: debaixo da cama).' },
            { type: 'color', target: 'blue',  label: 'ENCONTRE ALGO AZUL',     desc: 'Pilote e pare de frente para um objeto AZUL.' },
            { type: 'bump',  target: 'bump',  label: 'TERRENO ACIDENTADO!',    desc: 'Passe por cima de obstáculos para trepidar o caminhão.' },
            { type: 'color', target: 'green', label: 'ENCONTRE ALGO VERDE',    desc: 'Estacione de frente para algo VERDE (planta, tapete).' }
        ],

        init: function(faseData) {
            this.state = 'START';
            this.score = 0;
            this.currentMissionIndex = 0;
            this.scanProgress = 0;
            particles = [];
            
            window.System.msg("LIGANDO MOTORES...");
            this.setupInput();
        },

        setupInput: function() {
            window.System.canvas.onclick = async () => {
                if (this.state === 'START') {
                    // Pede permissão para o sensor de movimento (para sentir os buracos/aceleração)
                    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
                        try {
                            const permission = await DeviceMotionEvent.requestPermission();
                            if (permission === 'granted') this.startSensors();
                        } catch (e) { console.error("Erro sensor", e); }
                    } else {
                        this.startSensors();
                    }
                    this.state = 'PLAY';
                    window.Sfx.play(300, 'square', 0.8, 0.2); // Som de motor ligando
                }
            };
        },

        startSensors: function() {
            window.addEventListener('devicemotion', (event) => {
                let acc = event.acceleration; 
                if(!acc) acc = event.accelerationIncludingGravity;
                
                if(acc && acc.x !== null) {
                    // Calcula a força total do movimento do celular (trepidação)
                    let force = Math.abs(acc.x) + Math.abs(acc.y) + Math.abs(acc.z);
                    // Se estiver usando gravidade, tentamos ignorar o peso base (aprox 9.8)
                    if(!event.acceleration) force = Math.abs(force - 9.8);
                    
                    this.currentForce = force;
                }
            });
        },

        update: function(ctx, w, h, pose) {
            // 1. DESENHA A CÂMERA DE FUNDO (O "Para-brisa" do Caminhão)
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

            // CONTROLE DE ESTADOS
            if (this.state === 'START') {
                this.drawOverlay(ctx, w, h, "COMPUTADOR DE BORDO", "Toque na tela para ligar o caminhão");
                return this.score;
            }

            if (this.state === 'PLAY' || this.state === 'MISSION_COMPLETE') {
                this.playMode(ctx, w, h);
            }

            return this.score;
        },

        drawOverlay: function(ctx, w, h, title, sub) {
            ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
            ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = "#f1c40f"; ctx.textAlign = "center";
            ctx.font = "bold clamp(20px, 5vw, 40px) 'Russo One'";
            ctx.fillText(title, w/2, h/2 - 20);
            ctx.fillStyle = "#fff"; ctx.font = "clamp(12px, 3vw, 20px) Arial";
            ctx.fillText(sub, w/2, h/2 + 30);
        },

        playMode: function(ctx, w, h) {
            const cx = w / 2;
            const cy = h / 2;
            const mission = this.missions[this.currentMissionIndex];
            
            let conditionMet = false;

            // ==========================================
            // LÓGICA DE LEITURA DO MUNDO REAL
            // ==========================================
            if (this.state === 'PLAY' && window.System.video.readyState === 4) {
                
                // Pega as cores do centro da tela (um quadrado de 40x40 pixels)
                // AVISO: Isso só funciona se não houver erro de CORS no vídeo, o que é o caso da webcam local.
                try {
                    let r = 0, g = 0, b = 0;
                    let imgData = ctx.getImageData(cx - 20, cy - 20, 40, 40).data;
                    
                    for(let i=0; i<imgData.length; i+=4) {
                        r += imgData[i]; g += imgData[i+1]; b += imgData[i+2];
                    }
                    
                    let count = imgData.length / 4;
                    r = r/count; g = g/count; b = b/count;
                    let brightness = (r + g + b) / 3;

                    // Verifica qual é o objetivo atual e se o mundo real corresponde!
                    if (mission.type === 'color') {
                        if (mission.target === 'red' && r > 120 && r > g * 1.5 && r > b * 1.5) conditionMet = true;
                        if (mission.target === 'blue' && b > 100 && b > r * 1.2 && b > g * 1.2) conditionMet = true;
                        if (mission.target === 'green' && g > 100 && g > r * 1.2 && g > b * 1.2) conditionMet = true;
                    } 
                    else if (mission.type === 'dark') {
                        if (brightness < 40) conditionMet = true; // Muito escuro!
                    } 
                    else if (mission.type === 'bump') {
                        if (this.currentForce > 12) conditionMet = true; // Trepidação alta!
                    }
                } catch (e) {
                    // Ignora erro silenciosamente se a câmera ainda não estiver pintando o canvas
                }

                // ==========================================
                // PROGRESSO DA MISSÃO (SCANNER)
                // ==========================================
                if (conditionMet) {
                    this.scanProgress += 2.0; // Enche a barrinha aos poucos
                    if (this.scanProgress % 10 === 0) window.Sfx.hover(); // Bip de scan
                } else {
                    this.scanProgress = Math.max(0, this.scanProgress - 1.0); // Esvazia se ele sair do alvo
                }

                // MISSÃO CONCLUÍDA!
                if (this.scanProgress >= 100) {
                    this.state = 'MISSION_COMPLETE';
                    this.score += 200;
                    window.Sfx.coin(); window.Gfx.shakeScreen(15);
                    this.spawnParticles(cx, cy);
                    
                    setTimeout(() => {
                        this.currentMissionIndex++;
                        this.scanProgress = 0;
                        if (this.currentMissionIndex >= this.missions.length) {
                            window.System.msg("TESTE DO CAMINHÃO FINALIZADO!");
                            setTimeout(() => window.System.gameOver(this.score, true, 20), 2000);
                        } else {
                            this.state = 'PLAY';
                            window.Sfx.play(600, 'square', 0.2, 0.1); // Bip de nova missão
                        }
                    }, 2500); // Fica 2.5s comemorando antes da próxima missão
                }
            }

            // ==========================================
            // DESENHA O PAINEL DO CAMINHÃO
            // ==========================================
            this.drawDashboard(ctx, w, h, cx, cy, mission, conditionMet);
            this.updateParticles(ctx);
        },

        drawDashboard: function(ctx, w, h, cx, cy, mission, isScanning) {
            // Efeito de Para-brisa sujo nas bordas
            const grad = ctx.createRadialGradient(cx, cy, h*0.3, cx, cy, h);
            grad.addColorStop(0, "rgba(0,0,0,0)");
            grad.addColorStop(1, "rgba(0,0,0,0.6)");
            ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);

            // UI do Computador de Bordo (Topo)
            ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
            ctx.fillRect(0, 0, w, 80);
            ctx.strokeStyle = "#f1c40f"; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(0, 80); ctx.lineTo(w, 80); ctx.stroke();

            // Texto da Missão
            ctx.fillStyle = "#f1c40f"; ctx.textAlign = "center";
            ctx.font = "bold clamp(16px, 4vw, 24px) 'Russo One'";
            ctx.fillText(`MISSÃO ${this.currentMissionIndex + 1}: ${mission.label}`, w/2, 35);
            ctx.fillStyle = "#ccc"; ctx.font = "clamp(10px, 2.5vw, 16px) 'Chakra Petch'";
            ctx.fillText(mission.desc, w/2, 60);

            // MIRA CENTRAL DO SCANNER (Onde a câmera lê a cor/luz)
            if (this.state === 'PLAY') {
                ctx.strokeStyle = isScanning ? "#0f0" : "rgba(255, 255, 255, 0.5)";
                ctx.lineWidth = isScanning ? 4 : 2;
                
                // Desenha o quadrado da mira no centro
                ctx.strokeRect(cx - 40, cy - 40, 80, 80);
                
                // Cruz no meio
                ctx.beginPath(); ctx.moveTo(cx - 10, cy); ctx.lineTo(cx + 10, cy); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(cx, cy - 10); ctx.lineTo(cx, cy + 10); ctx.stroke();

                // Barra de Progresso do Scanner
                if (this.scanProgress > 0) {
                    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
                    ctx.fillRect(cx - 60, cy + 60, 120, 15);
                    ctx.fillStyle = "#0f0";
                    ctx.fillRect(cx - 60, cy + 60, (this.scanProgress / 100) * 120, 15);
                    ctx.strokeStyle = "#fff"; ctx.lineWidth = 2;
                    ctx.strokeRect(cx - 60, cy + 60, 120, 15);
                    
                    ctx.fillStyle = "#0f0"; ctx.font = "bold 14px Arial";
                    ctx.fillText(isScanning ? "ESCANEAANDO..." : "ALVO PERDIDO!", cx, cy + 90);
                }
            } else if (this.state === 'MISSION_COMPLETE') {
                // Mensagem de Sucesso GIGANTE
                ctx.fillStyle = "rgba(0, 255, 0, 0.3)"; ctx.fillRect(0, cy - 50, w, 100);
                ctx.fillStyle = "#fff"; ctx.font = "bold clamp(30px, 8vw, 60px) 'Russo One'";
                ctx.textAlign = "center"; ctx.textBaseline = "middle";
                ctx.shadowColor = "#000"; ctx.shadowBlur = 10;
                ctx.fillText("OBJETIVO CONCLUÍDO!", cx, cy);
                ctx.shadowBlur = 0; // reseta sombra
            }

            // SENSORES LATERAIS (Velocímetro/Tremor)
            ctx.textAlign = "left"; ctx.textBaseline = "bottom";
            ctx.fillStyle = "#fff"; ctx.font = "bold 14px 'Chakra Petch'";
            ctx.fillText("SENSOR SÍSMICO:", 20, h - 30);
            
            // Barrinha do sensor de tremor
            ctx.fillStyle = "rgba(255,255,255,0.3)"; ctx.fillRect(20, h - 25, 100, 10);
            const forcePct = Math.min(100, (this.currentForce / 20) * 100);
            ctx.fillStyle = forcePct > 60 ? "#e74c3c" : "#3498db";
            ctx.fillRect(20, h - 25, forcePct, 10);
        },

        spawnParticles: function(x, y) {
            for(let i=0; i<40; i++) {
                particles.push({
                    x: x, y: y,
                    vx: (Math.random() - 0.5) * 25,
                    vy: (Math.random() - 0.5) * 25,
                    life: 1.0,
                    size: Math.random() * 15 + 5,
                    color: ['#f1c40f', '#2ecc71', '#3498db'][Math.floor(Math.random()*3)]
                });
            }
        },

        updateParticles: function(ctx) {
            particles.forEach(p => {
                p.x += p.vx; p.y += p.vy; p.life -= 0.03;
                p.size *= 0.95;
                ctx.fillStyle = p.color;
                ctx.globalAlpha = Math.max(0, p.life);
                ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill();
                ctx.globalAlpha = 1.0;
            });
            particles = particles.filter(p => p.life > 0);
        }
    };

    // Registra o jogo no Core
    const regLoop = setInterval(() => {
        if(window.System && window.System.registerGame) {
            window.System.registerGame('ar_safari', 'Missões Reais', '🚛', Game, {
                camera: 'environment', // Exige câmera traseira
                phases: [
                    { id: 'f1', name: 'TESTE-DRIVE DO ROVER', desc: 'Pilote o caminhão e conclua as missões lendo o mundo real.', reqLvl: 1 }
                ]
            });
            clearInterval(regLoop);
        }
    }, 100);

})();