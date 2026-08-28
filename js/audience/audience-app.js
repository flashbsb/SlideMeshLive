/**
 * Audience Mobile Application Controller
 * Coordena a sincronização em tempo real no smartphone, presença e modo ao vivo.
 */

import { PresentationEngine } from '../core/presentation-engine.js';
import { RealtimeEngine } from '../core/realtime-engine.js';

class AudienceApp {
  constructor() {
    this.engine = new PresentationEngine({ basePath: '../presentations' });
    this.realtime = new RealtimeEngine();

    this.presentationId = PresentationEngine.getPresentationIdFromURL();
    this.sessionId = PresentationEngine.getSessionIdFromURL();
    this.isLiveSync = true;
    this.presenterSlideIndex = 0;

    // DOM Elements
    this.dom = {
      headerTitle: document.getElementById('audience-pres-name'),
      slideIndicator: document.getElementById('audience-slide-indicator'),
      contentArea: document.getElementById('audience-content-area'),
      sessionBadge: document.getElementById('session-badge-code'),
      navPrev: document.getElementById('btn-audience-prev'),
      navNext: document.getElementById('btn-audience-next'),
      btnSync: document.getElementById('btn-audience-sync'),
      syncToast: document.getElementById('sync-toast')
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
      
      // Inicia registro de presença em tempo real
      this.realtime.startPresence(this.sessionId);

      // Inscreve-se nas atualizações de estado do apresentador
      this.realtime.subscribeToSession(this.sessionId, (sessionState) => {
        this.handleRemoteSessionUpdate(sessionState);
      });

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

  handleRemoteSessionUpdate(sessionState) {
    if (!sessionState) return;

    if (typeof sessionState.currentSlide === 'number') {
      this.presenterSlideIndex = sessionState.currentSlide;

      if (this.isLiveSync) {
        if (this.engine.currentSlideIndex !== this.presenterSlideIndex) {
          this.engine.goToSlide(this.presenterSlideIndex);
          this.updateView();
        }
      } else {
        // Se o usuário estiver navegando manualmente, mostra toast informativo
        this.showSyncToast();
      }
    }
  }

  showSyncToast() {
    if (!this.dom.syncToast) return;
    if (this.engine.currentSlideIndex !== this.presenterSlideIndex) {
      this.dom.syncToast.innerHTML = `
        <span>🔴 Apresentador está no slide <strong>${this.presenterSlideIndex + 1}</strong></span>
        <button id="btn-toast-sync" class="btn btn-sm btn-primary" style="padding: 4px 10px; font-size: 11px;">Sincronizar</button>
      `;
      this.dom.syncToast.style.display = 'flex';
      
      const syncBtn = document.getElementById('btn-toast-sync');
      if (syncBtn) {
        syncBtn.onclick = () => this.syncToLive();
      }
    } else {
      this.dom.syncToast.style.display = 'none';
    }
  }

  syncToLive() {
    this.isLiveSync = true;
    if (this.dom.btnSync) {
      this.dom.btnSync.classList.add('active');
    }
    if (this.dom.syncToast) {
      this.dom.syncToast.style.display = 'none';
    }
    this.engine.goToSlide(this.presenterSlideIndex);
    this.updateView();
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
    // Navegação manual desativa temporariamente o lock estrito se o usuário quiser ler outros slides
    if (this.dom.navPrev) {
      this.dom.navPrev.addEventListener('click', () => {
        this.isLiveSync = false;
        if (this.dom.btnSync) this.dom.btnSync.classList.remove('active');
        this.engine.prevSlide();
        this.updateView();
        this.showSyncToast();
      });
    }

    if (this.dom.navNext) {
      this.dom.navNext.addEventListener('click', () => {
        this.isLiveSync = false;
        if (this.dom.btnSync) this.dom.btnSync.classList.remove('active');
        this.engine.nextSlide();
        this.updateView();
        this.showSyncToast();
      });
    }

    // Botão de sincronização ao vivo
    if (this.dom.btnSync) {
      this.dom.btnSync.addEventListener('click', () => {
        this.syncToLive();
      });
    }

    // Delegação de cliques para opções de enquete
    this.dom.contentArea.addEventListener('click', (e) => {
      const pollBtn = e.target.closest('.poll-option-btn');
      if (pollBtn) {
        const pollId = pollBtn.dataset.pollId;
        const optionId = pollBtn.dataset.optionId;
        
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
