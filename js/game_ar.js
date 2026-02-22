// =============================================================================
// CYBER TRUCK AR: MISSÕES NO MUNDO REAL (COM SUPER EFEITOS VISUAIS)
// =============================================================================

(function() {
    "use strict";

    let particles = [];
    let time = 0; // Para animar coisas na tela (como a grade e a mira)

    const Game = {
        state: 'START', // START, PLAY, MISSION_COMPLETE
        score: 0,
        
        // Dados dos Sensores
        currentForce: 0,
        
        // Missões Reais
        currentMissionIndex: 0,
        scanProgress: 0,
        
        missions: [
            { type: 'color', target: 'red',   colorCode: '#ff0044', label: 'EXTRAIR ENERGIA VERMELHA', desc: 'Pare de frente para um objeto VERMELHO para sugar a energia.' },
            { type: 'dark',  target: 'dark',  colorCode: '#00ff00', label: 'ENTRE NO TÚNEL ESCURO',   desc: 'Dirija para debaixo de algo (cama/sofá). Ativando Visão Noturna!' },
            { type: 'color', target: 'blue',  colorCode: '#0088ff', label: 'EXTRAIR ENERGIA AZUL',    desc: 'Pare de frente para um objeto AZUL para sugar a energia.' },
            { type: 'bump',  target: 'bump',  colorCode: '#ffaa00', label: 'ATRAVESSAR OBSTÁCULOS',   desc: 'Passe por cima de coisas para trepidar o caminhão (Cuidado com o chassi!)' },
            { type: 'color', target: 'green', colorCode: '#00ff44', label: 'EXTRAIR ENERGIA VERDE',   desc: 'Pare de frente para uma planta ou objeto VERDE.' }
        ],

        init: function(faseData) {
            this.state = 'START';
            this.score = 0;
            this.currentMissionIndex = 0;
            this.scanProgress = 0;
            particles = [];
            time = 0;
            
            window.System.msg("SISTEMA CYBER-TRUCK ON");
            this.setupInput();
        },

        setupInput: function() {
            window.System.canvas.onclick = async () => {
                if (this.state === 'START') {
                    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
                        try {
                            const permission = await DeviceMotionEvent.requestPermission();
                            if (permission === 'granted') this.startSensors();
                        } catch (e) { console.error("Erro sensor", e); }
                    } else {
                        this.startSensors();
                    }
                    this.state = 'PLAY';
                    window.Sfx.epic(); // Som mais épico de início
                }
            };
        },

        startSensors: function() {
            window.addEventListener('devicemotion', (event) => {
                let acc = event.acceleration; 
                if(!acc) acc = event.accelerationIncludingGravity;
                
                if(acc && acc.x !== null) {
                    let force = Math.abs(acc.x) + Math.abs(acc.y) + Math.abs(acc.z);
                    if(!event.acceleration) force = Math.abs(force - 9.8);
                    this.currentForce = force;
                }
            });
        },

        update: function(ctx, w, h, pose) {
            time += 0.05; // Faz o tempo passar para as animações

            // 1. DESENHA A CÂMERA DE FUNDO
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
                this.drawOverlay(ctx, w, h, "CYBER TRUCK AR", "Toque na tela para iniciar os motores");
                return this.score;
            }

            if (this.state === 'PLAY' || this.state === 'MISSION_COMPLETE') {
                this.playMode(ctx, w, h);
            }

            return this.score;
        },

        drawOverlay: function(ctx, w, h, title, sub) {
            ctx.fillStyle = "rgba(0, 20, 40, 0.85)"; ctx.fillRect(0, 0, w, h);
            
            // Desenha um grid cibernético de fundo no menu
            ctx.strokeStyle = "rgba(0, 255, 255, 0.2)"; ctx.lineWidth = 1;
            for(let i=0; i<w; i+=40) { ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,h); ctx.stroke(); }
            for(let i=0; i<h; i+=40) { ctx.beginPath(); ctx.moveTo(0,i); ctx.lineTo(w,i); ctx.stroke(); }

            ctx.fillStyle = "#0ff"; ctx.textAlign = "center";
            ctx.font = "bold clamp(30px, 8vw, 60px) 'Russo One'";
            ctx.shadowColor = "#0ff"; ctx.shadowBlur = 20;
            ctx.fillText(title, w/2, h/2 - 20);
            ctx.shadowBlur = 0;
            
            ctx.fillStyle = "#fff"; ctx.font = "clamp(14px, 4vw, 24px) 'Chakra Petch'";
            ctx.fillText(sub, w/2, h/2 + 40);
        },

        playMode: function(ctx, w, h) {
            const cx = w / 2;
            const cy = h / 2;
            const mission = this.missions[this.currentMissionIndex];
            
            let conditionMet = false;
            let currentBrightness = 100;

            // ==========================================
            // LÓGICA DE LEITURA DO MUNDO REAL
            // ==========================================
            if (this.state === 'PLAY' && window.System.video.readyState === 4) {
                try {
                    // Pega um quadrado maior (80x80) no centro para ler a cor/luz
                    let r = 0, g = 0, b = 0;
                    let imgData = ctx.getImageData(cx - 40, cy - 40, 80, 80).data;
                    
                    for(let i=0; i<imgData.length; i+=4) {
                        r += imgData[i]; g += imgData[i+1]; b += imgData[i+2];
                    }
                    
                    let count = imgData.length / 4;
                    r = r/count; g = g/count; b = b/count;
                    currentBrightness = (r + g + b) / 3;

                    // Verifica as missões
                    if (mission.type === 'color') {
                        if (mission.target === 'red' && r > 100 && r > g * 1.3 && r > b * 1.3) conditionMet = true;
                        if (mission.target === 'blue' && b > 90 && b > r * 1.2 && b > g * 1.2) conditionMet = true;
                        if (mission.target === 'green' && g > 90 && g > r * 1.2 && g > b * 1.2) conditionMet = true;
                    } 
                    else if (mission.type === 'dark') {
                        if (currentBrightness < 50) conditionMet = true; 
                    } 
                    else if (mission.type === 'bump') {
                        if (this.currentForce > 10) {
                            conditionMet = true;
                            // Gera faíscas subindo da parte de baixo se bater forte!
                            if(Math.random() > 0.5) this.spawnSparks(cx + (Math.random()*200 - 100), h, mission.colorCode);
                        }
                    }
                } catch (e) { }

                // ==========================================
                // PROGRESSO DA MISSÃO (SCANNER)
                // ==========================================
                if (conditionMet) {
                    this.scanProgress += 2.0; 
                    window.Gfx.addShake(1); // Treme a tela bem pouquinho enquanto suga a energia
                    if (this.scanProgress % 10 === 0) window.Sfx.hover(); 
                    
                    // Se for missão de cor, gera partículas sendo "sugadas" para o centro
                    if(mission.type === 'color' && Math.random() > 0.3) {
                        this.spawnEnergy(cx, cy, mission.colorCode);
                    }
                } else {
                    this.scanProgress = Math.max(0, this.scanProgress - 1.5); 
                }

                // MISSÃO CONCLUÍDA!
                if (this.scanProgress >= 100) {
                    this.state = 'MISSION_COMPLETE';
                    this.score += 250;
                    window.Sfx.epic(); 
                    window.Gfx.shakeScreen(20); // Treme forte!
                    this.spawnExplosion(cx, cy, mission.colorCode);
                    
                    setTimeout(() => {
                        this.currentMissionIndex++;
                        this.scanProgress = 0;
                        if (this.currentMissionIndex >= this.missions.length) {
                            window.System.msg("TESTE DO CAMINHÃO FINALIZADO!");
                            setTimeout(() => window.System.gameOver(this.score, true, 50), 2000);
                        } else {
                            this.state = 'PLAY';
                            window.Sfx.play(800, 'square', 0.3, 0.1); 
                        }
                    }, 3000); // 3 segundos comemorando
                }
            }

            // ==========================================
            // DESENHA OS EFEITOS VISUAIS E O HUD
            // ==========================================
            this.drawCyberHUD(ctx, w, h, cx, cy, mission, conditionMet, currentBrightness);
            this.updateParticles(ctx, cx, cy);
        },

        drawCyberHUD: function(ctx, w, h, cx, cy, mission, isScanning, brightness) {
            
            // 1. EFEITO VISÃO NOTURNA (Para missão no Escuro)
            if (mission.type === 'dark') {
                ctx.fillStyle = "rgba(0, 255, 0, 0.15)"; ctx.fillRect(0, 0, w, h);
                // Scanlines (linhas horizontais passando)
                ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
                for(let i=0; i<h; i+=8) ctx.fillRect(0, i + (time*10)%8, w, 2);
            }

            // 2. CYBER GRID (Chão 3D Holográfico)
            // Desenhamos apenas na metade de baixo da tela
            ctx.save();
            ctx.beginPath();
            ctx.rect(0, cy, w, h/2);
            ctx.clip(); // Corta para não desenhar no "céu"
            
            ctx.strokeStyle = mission.colorCode;
            ctx.globalAlpha = 0.3;
            ctx.lineWidth = 2;
            
            // Linhas verticais (perspectiva)
            for(let i = -w; i < w*2; i+= 100) {
                ctx.beginPath();
                ctx.moveTo(cx, cy); // Ponto de fuga no centro
                // O deslocamento (time) dá a sensação de que o caminhão está andando para frente
                let offsetX = i + Math.sin(time) * 50; 
                ctx.lineTo(offsetX, h);
                ctx.stroke();
            }
            
            // Linhas horizontais (aproximando)
            for(let i = 0; i < h/2; i+= 30) {
                let y = cy + Math.pow(i / (h/2), 2) * (h/2); // Aceleração da perspectiva
                // Move as linhas para baixo para dar ideia de movimento
                let moveY = (y + (time * 50) % 100); 
                if(moveY > cy && moveY < h) {
                    ctx.beginPath(); ctx.moveTo(0, moveY); ctx.lineTo(w, moveY); ctx.stroke();
                }
            }
            ctx.restore();

            // 3. MIRA DE EXTRAÇÃO (Scanner Central)
            ctx.save();
            ctx.translate(cx, cy);
            
            // Anel exterior (Gira sempre)
            ctx.rotate(time * 0.5);
            ctx.strokeStyle = isScanning ? mission.colorCode : "rgba(255, 255, 255, 0.3)";
            ctx.lineWidth = 3;
            ctx.setLineDash([20, 15]);
            ctx.beginPath(); ctx.arc(0, 0, 80, 0, Math.PI * 2); ctx.stroke();
            
            // Anel interior (Gira rápido ao escanear e para o outro lado)
            ctx.rotate(-time * (isScanning ? 2 : 0.8));
            ctx.setLineDash([40, 20]);
            ctx.beginPath(); ctx.arc(0, 0, 60, 0, Math.PI * 2); ctx.stroke();
            ctx.restore();

            // 4. LASER DE EXTRAÇÃO (Efeito principal das missões de cor)
            if (isScanning && mission.type === 'color' && this.state === 'PLAY') {
                ctx.save();
                ctx.shadowColor = mission.colorCode;
                ctx.shadowBlur = 20;
                ctx.strokeStyle = "#fff"; // Núcleo branco
                ctx.lineWidth = 8 + Math.random()*4; // Trepidando
                
                ctx.beginPath();
                ctx.moveTo(cx, h); // Sai de baixo (caminhão)
                // Vai até a mira no centro, balançando levemente
                ctx.lineTo(cx + (Math.random()*10 - 5), cy + 40); 
                ctx.stroke();
                
                // Brilho exterior do laser
                ctx.strokeStyle = mission.colorCode;
                ctx.lineWidth = 20 + Math.random()*10;
                ctx.globalAlpha = 0.5;
                ctx.stroke();
                ctx.restore();
            }

            // 5. INTERFACE DO COMPUTADOR (HUD)
            // Barra superior escurecida
            ctx.fillStyle = "rgba(0, 0, 0, 0.8)"; ctx.fillRect(0, 0, w, 90);
            ctx.strokeStyle = mission.colorCode; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(0, 90); ctx.lineTo(w, 90); ctx.stroke();

            // Texto da Missão
            ctx.fillStyle = mission.colorCode; ctx.textAlign = "center";
            ctx.font = "bold clamp(16px, 4vw, 24px) 'Russo One'";
            ctx.shadowColor = mission.colorCode; ctx.shadowBlur = 10;
            ctx.fillText(`MISSÃO ${this.currentMissionIndex + 1}: ${mission.label}`, w/2, 40);
            ctx.shadowBlur = 0;
            
            ctx.fillStyle = "#fff"; ctx.font = "clamp(10px, 2.5vw, 16px) 'Chakra Petch'";
            ctx.fillText(mission.desc, w/2, 70);

            // Barra de Progresso Circular (No centro)
            if (this.state === 'PLAY' && this.scanProgress > 0) {
                ctx.strokeStyle = "rgba(0,0,0,0.5)"; ctx.lineWidth = 10;
                ctx.beginPath(); ctx.arc(cx, cy, 100, 0, Math.PI * 2); ctx.stroke();
                
                ctx.strokeStyle = mission.colorCode; ctx.lineWidth = 10;
                ctx.lineCap = "round";
                let endAngle = (this.scanProgress / 100) * (Math.PI * 2);
                ctx.beginPath(); ctx.arc(cx, cy, 100, -Math.PI/2, -Math.PI/2 + endAngle); ctx.stroke();
                
                ctx.fillStyle = "#fff"; ctx.font = "bold 20px 'Russo One'"; ctx.textAlign = "center";
                ctx.fillText(Math.floor(this.scanProgress) + "%", cx, cy + 130);
            }

            // TELA DE SUCESSO!
            if (this.state === 'MISSION_COMPLETE') {
                ctx.fillStyle = "rgba(0, 0, 0, 0.7)"; ctx.fillRect(0, cy - 60, w, 120);
                ctx.fillStyle = mission.colorCode; ctx.font = "bold clamp(30px, 8vw, 60px) 'Russo One'";
                ctx.textAlign = "center"; ctx.textBaseline = "middle";
                ctx.shadowColor = mission.colorCode; ctx.shadowBlur = 20;
                ctx.fillText("ENERGIA EXTRAÍDA!", cx, cy);
                ctx.shadowBlur = 0; 
            }

            // SENSOR SÍSMICO (Tremor)
            ctx.textAlign = "left"; ctx.textBaseline = "bottom";
            ctx.fillStyle = "#fff"; ctx.font = "bold 14px 'Chakra Petch'";
            ctx.fillText("SENSOR SÍSMICO:", 20, h - 30);
            
            ctx.fillStyle = "rgba(255,255,255,0.2)"; ctx.fillRect(20, h - 25, 120, 12);
            const forcePct = Math.min(100, (this.currentForce / 20) * 100);
            ctx.fillStyle = forcePct > 50 ? "#ff0000" : "#00ffff";
            ctx.fillRect(20, h - 25, (forcePct/100)*120, 12);
            
            // Aviso de Cuidado
            if(forcePct > 80) {
                ctx.fillStyle = "#ff0000"; ctx.fillText("ALERTA DE COLISÃO!", 150, h-25);
            }
        },

        // --- SISTEMA DE PARTÍCULAS ---

        spawnSparks: function(x, y, color) {
            // Faíscas que pulam para cima (para quando trepidar)
            for(let i=0; i<10; i++) {
                particles.push({
                    type: 'spark', x: x, y: y,
                    vx: (Math.random() - 0.5) * 15, vy: -(Math.random() * 15 + 5),
                    life: 1.0, size: Math.random() * 6 + 2, color: color
                });
            }
        },

        spawnEnergy: function(cx, cy, color) {
            // Bolinhas de energia que nascem nas bordas e são sugadas pro centro (Laser)
            const angle = Math.random() * Math.PI * 2;
            const dist = 200 + Math.random() * 100;
            particles.push({
                type: 'suck',
                x: cx + Math.cos(angle) * dist, y: cy + Math.sin(angle) * dist,
                targetX: cx, targetY: cy,
                life: 1.0, size: Math.random() * 8 + 4, color: color
            });
        },

        spawnExplosion: function(x, y, color) {
            // Explosão gigante ao terminar a missão
            for(let i=0; i<50; i++) {
                const angle = Math.random() * Math.PI * 2;
                const speed = Math.random() * 20 + 5;
                particles.push({
                    type: 'explode', x: x, y: y,
                    vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
                    life: 1.0, size: Math.random() * 10 + 5, color: color
                });
            }
        },

        updateParticles: function(ctx, cx, cy) {
            ctx.globalCompositeOperation = 'lighter'; // Faz as cores "brilharem" quando se sobrepõem
            
            particles.forEach(p => {
                if (p.type === 'spark' || p.type === 'explode') {
                    p.x += p.vx; p.y += p.vy; 
                    p.vy += 0.5; // Gravidade puxa pra baixo
                    p.life -= 0.03; p.size *= 0.95;
                } 
                else if (p.type === 'suck') {
                    // Puxa a partícula na direção do centro (cx, cy)
                    p.x += (p.targetX - p.x) * 0.15;
                    p.y += (p.targetY - p.y) * 0.15;
                    p.life -= 0.05; // Morre rápido quando chega no meio
                }

                ctx.fillStyle = p.color;
                ctx.globalAlpha = Math.max(0, p.life);
                ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill();
            });
            
            ctx.globalAlpha = 1.0;
            ctx.globalCompositeOperation = 'source-over'; // Volta ao normal
            particles = particles.filter(p => p.life > 0);
        }
    };

    // Registra o jogo no Core
    const regLoop = setInterval(() => {
        if(window.System && window.System.registerGame) {
            window.System.registerGame('ar_safari', 'Cyber Truck AR', '⚡', Game, {
                camera: 'environment', // Exige câmera traseira
                phases: [
                    { id: 'f1', name: 'TREINAMENTO DE CAMPO', desc: 'Siga as instruções para testar os sensores do caminhão.', reqLvl: 1 }
                ]
            });
            clearInterval(regLoop);
        }
    }, 100);

})();