/**
 * Presenter Application Controller
 * Coordena os eventos de tela, atalhos de teclado, sincronização e controle de enquetes ao vivo.
 */

import { PresentationEngine } from '../core/presentation-engine.js';
import { QREngine } from '../core/qr-engine.js';
import { RealtimeEngine } from '../core/realtime-engine.js';
import { AuthEngine } from '../core/auth-engine.js';
import { InteractionEngine } from '../core/interaction-engine.js';

class PresenterApp {
  constructor() {
    this.engine = new PresentationEngine({ basePath: '../presentations' });
    this.realtime = new RealtimeEngine();
    this.auth = new AuthEngine();
    this.interaction = new InteractionEngine(this.realtime, this.auth);
    
    this.presentationId = PresentationEngine.getPresentationIdFromURL();
    this.sessionId = PresentationEngine.getSessionIdFromURL() || QREngine.generateSessionCode();

    this.pollState = {
      activePollId: null,
      pollStatus: 'draft', // 'draft', 'open', 'closed'
      showResults: false
    };

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
      statusDot: document.getElementById('status-dot'),
      
      // Poll Controls
      pollControlsWrapper: document.getElementById('poll-controls-wrapper'),
      btnOpenPoll: document.getElementById('btn-open-poll'),
      btnClosePoll: document.getElementById('btn-close-poll'),
      btnToggleResults: document.getElementById('btn-toggle-results')
    };

    this.init();
  }

  async init() {
    this.bindEvents();
    this.setupQRCode();

    try {
      await this.engine.loadPresentation(this.presentationId);
      this.dom.title.textContent = this.engine.manifest.title || 'Apresentação';
      
      this.broadcastCurrentSlide();
      this.updateSlideView();

      if (this.dom.connectionStatus) {
        this.dom.connectionStatus.textContent = this.realtime.isFirebaseReady ? 'Firebase Conectado' : 'Sincronização Ativa';
      }

      // Escuta eventos de votação para atualizar contadores e gráficos na hora
      if (this.realtime.channel) {
        this.realtime.channel.addEventListener('message', (e) => {
          if (e.data && e.data.type === 'VOTE_CAST' && e.data.sessionId === this.sessionId) {
            this.updatePollDisplay();
          }
        });
      }

      // Storage event listener para votos locais
      window.addEventListener('storage', (e) => {
        if (e.key && e.key.startsWith(`session_votes_${this.sessionId}`)) {
          this.updatePollDisplay();
        }
      });

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
      const slide = this.engine.currentSlide;
      const hasPoll = slide.interaction && slide.interaction.poll;
      
      this.pollState = {
        activePollId: hasPoll ? slide.interaction.poll.id : null,
        pollStatus: hasPoll ? 'open' : 'draft', // Votação abre automaticamente ao entrar no slide
        showResults: false
      };

      this.realtime.updateSessionState(this.sessionId, {
        currentSlide: this.engine.currentSlideIndex,
        slideId: slide.id || (this.engine.currentSlideIndex + 1),
        slideTitle: slide.title || '',
        activePoll: this.pollState.activePollId,
        pollStatus: this.pollState.pollStatus,
        showResults: this.pollState.showResults,
        status: 'running'
      });
    }
  }

  updateSlideView() {
    this.engine.renderPresenterSlide(this.dom.canvas, this.dom.notes);
    
    const current = this.engine.currentSlideIndex + 1;
    const total = this.engine.totalSlides;
    this.dom.slideCounter.textContent = `${current} / ${total}`;

    this.dom.btnPrev.disabled = (this.engine.currentSlideIndex === 0);
    this.dom.btnNext.disabled = (this.engine.currentSlideIndex === total - 1);

    this.setupPollControls();
    this.updatePollDisplay();
  }

  setupPollControls() {
    const slide = this.engine.currentSlide;
    const hasPoll = slide && slide.interaction && slide.interaction.poll;

    if (hasPoll) {
      this.dom.pollControlsWrapper.style.display = 'flex';
      this.renderPollControlButtons();
    } else {
      this.dom.pollControlsWrapper.style.display = 'none';
    }
  }

  renderPollControlButtons() {
    const isOpen = (this.pollState.pollStatus === 'open');
    const isShowingResults = this.pollState.showResults;

    if (isOpen) {
      this.dom.btnOpenPoll.style.display = 'none';
      this.dom.btnClosePoll.style.display = 'inline-flex';
    } else {
      this.dom.btnOpenPoll.style.display = 'inline-flex';
      this.dom.btnClosePoll.style.display = 'none';
    }

    this.dom.btnToggleResults.style.display = 'inline-flex';
    this.dom.btnToggleResults.innerHTML = isShowingResults 
      ? '<span>🙈 Ocultar Resultados</span>' 
      : '<span>📊 Mostrar Resultados</span>';
  }

  updatePollDisplay() {
    const slide = this.engine.currentSlide;
    if (!slide || !slide.interaction || !slide.interaction.poll) return;

    const poll = slide.interaction.poll;
    const results = this.interaction.computePollResults(this.sessionId, poll);

    const voteCountEl = document.getElementById(`presenter-poll-vote-count-${poll.id}`);
    const badgeEl = document.getElementById(`presenter-poll-badge-${poll.id}`);
    const resultsContainer = document.getElementById(`presenter-poll-results-${poll.id}`);

    if (voteCountEl) {
      voteCountEl.textContent = `${results.totalVotes} voto(s) registrado(s)`;
    }

    if (badgeEl) {
      if (this.pollState.pollStatus === 'open') {
        badgeEl.className = 'badge badge-success';
        badgeEl.textContent = '🟢 VOTAÇÃO ABERTA';
      } else {
        badgeEl.className = 'badge';
        badgeEl.style.background = 'rgba(239, 68, 68, 0.2)';
        badgeEl.style.color = '#fca5a5';
        badgeEl.textContent = '🔴 ENCERRADA';
      }
    }

    if (resultsContainer) {
      if (this.pollState.showResults) {
        // Renderiza gráfico de barras com percentuais no telão
        resultsContainer.innerHTML = results.options.map(opt => `
          <div class="poll-result-item animate-fade-in" style="margin-bottom: 16px;">
            <div class="poll-result-header" style="font-size: 15px;">
              <span class="poll-result-text">
                <span class="poll-letter-badge">${opt.id}</span>
                <span>${opt.text}</span>
              </span>
              <span class="poll-result-percentage" style="font-size: 16px;">${opt.percentage}% (${opt.votes})</span>
            </div>
            <div class="poll-progress-track" style="height: 14px;">
              <div class="poll-progress-fill" style="width: ${opt.percentage}%;"></div>
            </div>
          </div>
        `).join('');
      } else {
        // Exibe apenas a lista das opções sem revelar percentuais
        resultsContainer.innerHTML = poll.options.map(opt => `
          <div style="padding: 10px 14px; background: rgba(255,255,255,0.03); border-radius: 6px; margin-bottom: 8px; font-size: 14px; display: flex; align-items: center;">
            <span class="poll-letter-badge" style="width: 24px; height: 24px; font-size: 12px; margin-right: 10px;">${opt.id}</span>
            <span>${opt.text}</span>
          </div>
        `).join('');
      }
    }
  }

  bindEvents() {
    // Navegação
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

    // Controles de Votação
    if (this.dom.btnOpenPoll) {
      this.dom.btnOpenPoll.addEventListener('click', async () => {
        const slide = this.engine.currentSlide;
        if (slide && slide.interaction && slide.interaction.poll) {
          this.pollState.pollStatus = 'open';
          await this.interaction.openPoll(this.sessionId, slide.interaction.poll.id);
          this.renderPollControlButtons();
          this.updatePollDisplay();
        }
      });
    }

    if (this.dom.btnClosePoll) {
      this.dom.btnClosePoll.addEventListener('click', async () => {
        const slide = this.engine.currentSlide;
        if (slide && slide.interaction && slide.interaction.poll) {
          this.pollState.pollStatus = 'closed';
          await this.interaction.closePoll(this.sessionId, slide.interaction.poll.id);
          this.renderPollControlButtons();
          this.updatePollDisplay();
        }
      });
    }

    if (this.dom.btnToggleResults) {
      this.dom.btnToggleResults.addEventListener('click', async () => {
        this.pollState.showResults = !this.pollState.showResults;
        await this.interaction.toggleShowResults(this.sessionId, this.pollState.showResults);
        this.renderPollControlButtons();
        this.updatePollDisplay();
      });
    }

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

    if (this.dom.btnFullscreen) {
      this.dom.btnFullscreen.addEventListener('click', () => this.toggleFullscreen());
    }

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

document.addEventListener('DOMContentLoaded', () => {
  window.presenterApp = new PresenterApp();
});
