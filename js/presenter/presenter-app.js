/**
 * Presenter Application Controller
 * Coordena os eventos de tela, atalhos de teclado e sincronização em tempo real.
 */

import { PresentationEngine } from '../core/presentation-engine.js';
import { QREngine } from '../core/qr-engine.js';
import { RealtimeEngine } from '../core/realtime-engine.js';

class PresenterApp {
  constructor() {
    this.engine = new PresentationEngine({ basePath: '../presentations' });
    this.realtime = new RealtimeEngine();
    
    this.presentationId = PresentationEngine.getPresentationIdFromURL();
    this.sessionId = PresentationEngine.getSessionIdFromURL() || QREngine.generateSessionCode();

    // DOM Elements
    this.dom = {
      title: document.getElementById('presentation-title'),
      canvas: document.getElementById('slide-canvas'),
      notes: document.getElementById('speaker-notes-content'),
      slideCounter: document.getElementById('slide-counter'),
      btnPrev: document.getElementById('btn-prev'),
      btnNext: document.getElementById('btn-next'),
      btnFullscreen: document.getElementById('btn-fullscreen'),
      qrContainer: document.getElementById('qr-code-box'),
      sessionCodeDisplay: document.getElementById('session-code-display'),
      audienceLink: document.getElementById('audience-direct-link'),
      participantCount: document.getElementById('participant-count'),
      connectionStatus: document.getElementById('connection-status'),
      statusDot: document.getElementById('status-dot')
    };

    this.init();
  }

  async init() {
    this.bindEvents();
    this.setupQRCode();

    try {
      await this.engine.loadPresentation(this.presentationId);
      this.dom.title.textContent = this.engine.manifest.title || 'Apresentação';
      
      // Publica o estado inicial da sessão em tempo real
      this.broadcastCurrentSlide();
      this.updateSlideView();

      // Atualiza status de conexão
      if (this.dom.connectionStatus) {
        this.dom.connectionStatus.textContent = this.realtime.isFirebaseReady ? 'Firebase Conectado' : 'Sincronização Ativa';
      }
    } catch (error) {
      this.dom.canvas.innerHTML = `
        <div style="text-align: center; color: #ef4444; padding: 40px;">
          <h2>Erro ao carregar apresentação</h2>
          <p style="margin-top: 10px; color: #94a3b8;">${error.message}</p>
        </div>
      `;
    }
  }

  setupQRCode() {
    const audienceUrl = QREngine.getAudienceUrl(this.presentationId, this.sessionId);
    this.dom.sessionCodeDisplay.textContent = this.sessionId;
    if (this.dom.audienceLink) {
      this.dom.audienceLink.href = audienceUrl;
      this.dom.audienceLink.textContent = audienceUrl;
    }
    QREngine.renderQR(this.dom.qrContainer, audienceUrl);
  }

  broadcastCurrentSlide() {
    if (this.realtime && this.engine.currentSlide) {
      this.realtime.setSlide(this.sessionId, this.engine.currentSlideIndex, this.engine.currentSlide);
    }
  }

  updateSlideView() {
    this.engine.renderPresenterSlide(this.dom.canvas, this.dom.notes);
    
    // Atualiza contadores
    const current = this.engine.currentSlideIndex + 1;
    const total = this.engine.totalSlides;
    this.dom.slideCounter.textContent = `${current} / ${total}`;

    // Atualiza estado dos botões
    this.dom.btnPrev.disabled = (this.engine.currentSlideIndex === 0);
    this.dom.btnNext.disabled = (this.engine.currentSlideIndex === total - 1);
  }

  bindEvents() {
    // Botões de navegação
    this.dom.btnPrev.addEventListener('click', () => {
      this.engine.prevSlide();
      this.broadcastCurrentSlide();
      this.updateSlideView();
    });

    this.dom.btnNext.addEventListener('click', () => {
      this.engine.nextSlide();
      this.broadcastCurrentSlide();
      this.updateSlideView();
    });

    // Atalhos de teclado
    window.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault();
        this.engine.nextSlide();
        this.broadcastCurrentSlide();
        this.updateSlideView();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        this.engine.prevSlide();
        this.broadcastCurrentSlide();
        this.updateSlideView();
      } else if (e.key.toLowerCase() === 'f') {
        this.toggleFullscreen();
      }
    });

    // Botão Fullscreen
    if (this.dom.btnFullscreen) {
      this.dom.btnFullscreen.addEventListener('click', () => this.toggleFullscreen());
    }

    // Callback de mudança de slide na engine
    this.engine.on('onSlideChange', () => {
      this.updateSlideView();
    });
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.warn('Fullscreen bloqueado:', err);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  }
}

// Inicializa a aplicação quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
  window.presenterApp = new PresenterApp();
});
