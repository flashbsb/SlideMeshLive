/**
 * SlideMeshLive — Stage FX Engine (Efeitos Visuais Dinâmicos de Palco)
 * Camada não-destrutiva de sobreposição (Canvas 2D Overlay) para momentos-chave:
 * 1. 'confetti': Chuva de confetes coloridos com física suave.
 * 2. 'impact_shake': Onda de choque radial + tremor sutil de tela.
 * 3. 'spotlight': Holofote com vinheta suave para foco de atenção.
 * 4. 'countdown_burst': Contagem regressiva 3-2-1 gigante com partículas.
 * 5. 'glitch_flash': Flash de energia e faíscas geométricas.
 * 
 * Auto-limpeza automática em 1.5 a 2.5 segundos, zero interferência no DOM de slides.
 */

export class StageFX {
  constructor(canvasElement = null) {
    this.canvas = canvasElement || document.getElementById('stage-fx-canvas');
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    this.animId = null;
    this.activeFx = null;
    this.startTime = 0;
    this.duration = 2500;
    this.particles = [];
    this.shakeTimeout = null;

    if (this.canvas) {
      this._resizeCanvas();
      window.addEventListener('resize', () => this._resizeCanvas());
    }
  }

  _resizeCanvas() {
    if (!this.canvas) return;
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
  }

  /**
   * Dispara um efeito visual no telão
   * @param {string} fxType - 'confetti' | 'impact_shake' | 'spotlight' | 'countdown_burst' | 'glitch_flash'
   * @param {object} options - Parâmetros customizados opcionais
   */
  play(fxType, options = {}) {
    if (!this.canvas || !this.ctx) return;
    this.stop(); // Interrompe e limpa qualquer efeito em execução anterior

    this._resizeCanvas();
    this.canvas.style.display = 'block';
    this.activeFx = fxType;
    this.startTime = performance.now();
    this.particles = [];

    switch (fxType) {
      case 'confetti':
        this.duration = options.duration || 2600;
        this._initConfetti();
        break;
      case 'impact_shake':
        this.duration = options.duration || 1600;
        this._initImpactShake();
        break;
      case 'spotlight':
        this.duration = options.duration || 2600;
        this._initSpotlight();
        break;
      case 'countdown_burst':
        this.duration = options.duration || 2400;
        this._initCountdown();
        break;
      case 'glitch_flash':
        this.duration = options.duration || 1800;
        this._initGlitchFlash();
        break;
      default:
        this.duration = 2000;
        this._initConfetti();
    }

    const loop = (now) => {
      const elapsed = now - this.startTime;
      const progress = Math.min(1, elapsed / this.duration);

      this.ctx.clearRect(0, 0, this.width, this.height);
      this._renderFrame(progress, elapsed);

      if (progress < 1) {
        this.animId = requestAnimationFrame(loop);
      } else {
        this.stop();
      }
    };

    this.animId = requestAnimationFrame(loop);
  }

  stop() {
    if (this.animId) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
    if (this.shakeTimeout) {
      clearTimeout(this.shakeTimeout);
      this.shakeTimeout = null;
    }
    const stageCanvas = document.getElementById('slide-canvas');
    if (stageCanvas) {
      stageCanvas.style.transform = '';
      stageCanvas.style.filter = '';
    }
    if (this.ctx && this.canvas) {
      this.ctx.clearRect(0, 0, this.width, this.height);
      this.canvas.style.display = 'none';
    }
    this.particles = [];
    this.activeFx = null;
  }

  // =========================================================================
  // 1. EFEITO: CONFETTI 🎉
  // =========================================================================
  _initConfetti() {
    const colors = ['#38bdf8', '#818cf8', '#a855f7', '#ec4899', '#f59e0b', '#10b981', '#ffffff'];
    const count = 130;
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: Math.random() * this.width,
        y: -20 - Math.random() * (this.height * 0.4),
        vx: (Math.random() - 0.5) * 6,
        vy: Math.random() * 5 + 3,
        size: Math.random() * 8 + 6,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        vRot: (Math.random() - 0.5) * 12,
        shape: Math.random() > 0.4 ? 'rect' : 'circle'
      });
    }
  }

  _renderConfetti(progress) {
    const fade = progress > 0.75 ? (1 - progress) / 0.25 : 1;
    this.ctx.globalAlpha = fade;

    this.particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.rotation += p.vRot;
      p.vy += 0.08; // Gravidade

      this.ctx.save();
      this.ctx.translate(p.x, p.y);
      this.ctx.rotate((p.rotation * Math.PI) / 180);
      this.ctx.fillStyle = p.color;

      if (p.shape === 'rect') {
        this.ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      } else {
        this.ctx.beginPath();
        this.ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        this.ctx.fill();
      }
      this.ctx.restore();
    });

    this.ctx.globalAlpha = 1.0;
  }

  // =========================================================================
  // 2. EFEITO: IMPACT SHAKE & SHOCKWAVE 💥
  // =========================================================================
  _initImpactShake() {
    const stageCanvas = document.getElementById('slide-canvas');
    if (stageCanvas) {
      let shakes = 0;
      const maxShakes = 10;
      const shakeInterval = setInterval(() => {
        if (shakes >= maxShakes) {
          clearInterval(shakeInterval);
          stageCanvas.style.transform = '';
        } else {
          const intensity = (1 - (shakes / maxShakes)) * 10;
          const rx = (Math.random() - 0.5) * intensity;
          const ry = (Math.random() - 0.5) * intensity;
          stageCanvas.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
          shakes++;
        }
      }, 35);
    }
  }

  _renderImpactShake(progress) {
    const cx = this.width / 2;
    const cy = this.height / 2;
    const maxRadius = Math.max(this.width, this.height) * 0.65;
    const currentRadius = progress * maxRadius;
    const alpha = Math.max(0, 1 - progress);

    // Onda de Choque Principal
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, currentRadius, 0, Math.PI * 2);
    this.ctx.strokeStyle = `rgba(56, 189, 248, ${alpha * 0.8})`;
    this.ctx.lineWidth = Math.max(2, (1 - progress) * 12);
    this.ctx.shadowColor = '#38bdf8';
    this.ctx.shadowBlur = 20;
    this.ctx.stroke();

    // Onda Secundária Concêntrica
    if (progress > 0.15) {
      const p2 = (progress - 0.15) / 0.85;
      this.ctx.beginPath();
      this.ctx.arc(cx, cy, p2 * maxRadius, 0, Math.PI * 2);
      this.ctx.strokeStyle = `rgba(168, 85, 247, ${(1 - p2) * 0.6})`;
      this.ctx.lineWidth = Math.max(1, (1 - p2) * 6);
      this.ctx.stroke();
    }
    this.ctx.restore();
  }

  // =========================================================================
  // 3. EFEITO: SPOTLIGHT 🔦
  // =========================================================================
  _initSpotlight() {}

  _renderSpotlight(progress) {
    const cx = this.width / 2;
    const cy = this.height * 0.46;
    const radius = Math.min(this.width, this.height) * 0.32;
    const fade = progress > 0.8 ? (1 - progress) / 0.2 : (progress < 0.1 ? progress / 0.1 : 1);

    this.ctx.save();
    this.ctx.fillStyle = `rgba(0, 0, 0, ${0.72 * fade})`;
    this.ctx.fillRect(0, 0, this.width, this.height);

    // Abre recorte suave de holofote circular
    this.ctx.globalCompositeOperation = 'destination-out';
    const grad = this.ctx.createRadialGradient(cx, cy, radius * 0.3, cx, cy, radius);
    grad.addColorStop(0, `rgba(0, 0, 0, ${1.0 * fade})`);
    grad.addColorStop(0.8, `rgba(0, 0, 0, ${0.8 * fade})`);
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    this.ctx.fillStyle = grad;
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.restore();
  }

  // =========================================================================
  // 4. EFEITO: COUNTDOWN BURST ⏱️
  // =========================================================================
  _initCountdown() {}

  _renderCountdown(progress, elapsed) {
    const stepDuration = this.duration / 4;
    const currentStep = Math.min(3, Math.floor(elapsed / stepDuration));
    const stepProgress = (elapsed % stepDuration) / stepDuration;

    const texts = ['3', '2', '1', '🚀 AGORA!'];
    const text = texts[currentStep];
    const cx = this.width / 2;
    const cy = this.height / 2;

    const scale = 1.4 - (stepProgress * 0.4);
    const alpha = stepProgress > 0.8 ? (1 - stepProgress) / 0.2 : 1;

    this.ctx.save();
    this.ctx.translate(cx, cy);
    this.ctx.scale(scale, scale);
    this.ctx.font = '900 clamp(64px, 12vw, 130px) "Inter", sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';

    this.ctx.shadowColor = currentStep === 3 ? '#ec4899' : '#38bdf8';
    this.ctx.shadowBlur = 30;
    this.ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    this.ctx.fillText(text, 0, 0);

    this.ctx.lineWidth = 3;
    this.ctx.strokeStyle = currentStep === 3 ? `rgba(236, 72, 153, ${alpha})` : `rgba(56, 189, 248, ${alpha})`;
    this.ctx.strokeText(text, 0, 0);

    this.ctx.restore();
  }

  // =========================================================================
  // 5. EFEITO: GLITCH FLASH & ENERGY SPARKS ✨
  // =========================================================================
  _initGlitchFlash() {
    for (let i = 0; i < 60; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 8 + 4;
      this.particles.push({
        x: this.width / 2,
        y: this.height / 2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        length: Math.random() * 20 + 10,
        color: Math.random() > 0.5 ? '#38bdf8' : '#ec4899'
      });
    }
  }

  _renderGlitchFlash(progress) {
    const alpha = Math.max(0, 1 - progress);

    // Flash inicial rápido
    if (progress < 0.15) {
      const flashAlpha = (1 - (progress / 0.15)) * 0.35;
      this.ctx.fillStyle = `rgba(255, 255, 255, ${flashAlpha})`;
      this.ctx.fillRect(0, 0, this.width, this.height);
    }

    // Faíscas radiais
    this.ctx.save();
    this.particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;

      this.ctx.beginPath();
      this.ctx.moveTo(p.x, p.y);
      this.ctx.lineTo(p.x - p.vx * 2, p.y - p.vy * 2);
      this.ctx.strokeStyle = p.color;
      this.ctx.lineWidth = 2.5 * alpha;
      this.ctx.shadowColor = p.color;
      this.ctx.shadowBlur = 10;
      this.ctx.stroke();
    });
    this.ctx.restore();
  }

  // Despachante interno de frames
  _renderFrame(progress, elapsed) {
    switch (this.activeFx) {
      case 'confetti':
        this._renderConfetti(progress);
        break;
      case 'impact_shake':
        this._renderImpactShake(progress);
        break;
      case 'spotlight':
        this._renderSpotlight(progress);
        break;
      case 'countdown_burst':
        this._renderCountdown(progress, elapsed);
        break;
      case 'glitch_flash':
        this._renderGlitchFlash(progress);
        break;
      default:
        this._renderConfetti(progress);
    }
  }
}
