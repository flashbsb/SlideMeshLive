/**
 * Presenter Application Controller
 * Coordena os eventos de tela, atalhos de teclado e ciclo de vida da apresentação.
 */

import { PresentationEngine } from '../core/presentation-engine.js';
import { QREngine } from '../core/qr-engine.js';

class PresenterApp {
  constructor() {
    this.engine = new PresentationEngine({ basePath: '../presentations' });
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
      connectionStatus: document.getElementById('connection-status')
    };

    this.init();
  }

  async init() {
    this.bindEvents();
    this.setupQRCode();

    try {
      await this.engine.loadPresentation(this.presentationId);
      this.dom.title.textContent = this.engine.manifest.title || 'Apresentação';
      this.updateSlideView();
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
      this.updateSlideView();
    });

    this.dom.btnNext.addEventListener('click', () => {
      this.engine.nextSlide();
      this.updateSlideView();
    });

    // Atalhos de teclado
    window.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault();
        this.engine.nextSlide();
        this.updateSlideView();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        this.engine.prevSlide();
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
