/**
 * Audience Mobile Application Controller
 * Coordena a visualização no smartphone, cards expansíveis e estado de interação.
 */

import { PresentationEngine } from '../core/presentation-engine.js';

class AudienceApp {
  constructor() {
    this.engine = new PresentationEngine({ basePath: '../presentations' });
    this.presentationId = PresentationEngine.getPresentationIdFromURL();
    this.sessionId = PresentationEngine.getSessionIdFromURL();

    // DOM Elements
    this.dom = {
      headerTitle: document.getElementById('audience-pres-name'),
      slideIndicator: document.getElementById('audience-slide-indicator'),
      contentArea: document.getElementById('audience-content-area'),
      sessionBadge: document.getElementById('session-badge-code'),
      navPrev: document.getElementById('btn-audience-prev'),
      navNext: document.getElementById('btn-audience-next')
    };

    this.init();
  }

  async init() {
    this.bindEvents();

    if (this.dom.sessionBadge) {
      this.dom.sessionBadge.textContent = this.sessionId;
    }

    try {
      await this.engine.loadPresentation(this.presentationId);
      this.dom.headerTitle.textContent = this.engine.manifest.title || 'Apresentação';
      this.updateView();
    } catch (error) {
      this.dom.contentArea.innerHTML = `
        <div class="card" style="text-align: center; color: #ef4444; margin-top: 30px;">
          <h3>Não foi possível carregar a apresentação</h3>
          <p style="margin-top: 8px; color: #94a3b8; font-size: 13px;">${error.message}</p>
        </div>
      `;
    }
  }

  updateView() {
    this.engine.renderAudienceSlide(this.dom.contentArea);

    const current = this.engine.currentSlideIndex + 1;
    const total = this.engine.totalSlides;
    this.dom.slideIndicator.textContent = `${current}/${total}`;

    if (this.dom.navPrev) this.dom.navPrev.disabled = (this.engine.currentSlideIndex === 0);
    if (this.dom.navNext) this.dom.navNext.disabled = (this.engine.currentSlideIndex === total - 1);

    // Scroll suave para o topo ao trocar de slide
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  bindEvents() {
    if (this.dom.navPrev) {
      this.dom.navPrev.addEventListener('click', () => {
        this.engine.prevSlide();
        this.updateView();
      });
    }

    if (this.dom.navNext) {
      this.dom.navNext.addEventListener('click', () => {
        this.engine.nextSlide();
        this.updateView();
      });
    }

    // Delegação de cliques para botões de opção de enquete (preparatório para fases 3 e 4)
    this.dom.contentArea.addEventListener('click', (e) => {
      const pollBtn = e.target.closest('.poll-option-btn');
      if (pollBtn) {
        const pollId = pollBtn.dataset.pollId;
        const optionId = pollBtn.dataset.optionId;
        
        // Remove seleção de outras opções da mesma enquete
        const container = document.getElementById(`poll-options-${pollId}`);
        if (container) {
          container.querySelectorAll('.poll-option-btn').forEach(btn => btn.classList.remove('selected'));
        }
        pollBtn.classList.add('selected');

        const feedback = document.getElementById(`poll-feedback-${pollId}`);
        if (feedback) {
          feedback.innerHTML = `<span style="color: #38bdf8; font-weight: 600;">Opção ${optionId} selecionada.</span> Na Fase 4, a autenticação enviará este voto ao Realtime Database.`;
        }
      }
    });

    this.engine.on('onSlideChange', () => {
      this.updateView();
    });
  }
}

// Inicializa no smartphone quando pronto
document.addEventListener('DOMContentLoaded', () => {
  window.audienceApp = new AudienceApp();
});
