/**
 * Presenter & Clean Stage Application Controller
 * Coordena projeção em tela cheia limpa, atalhos de palco, cronômetro, QR Code retrátil e reações.
 */

import { PresentationEngine } from '../core/presentation-engine.js';
import { QREngine } from '../core/qr-engine.js';
import { RealtimeEngine } from '../core/realtime-engine.js';
import { AuthEngine } from '../core/auth-engine.js';
import { InteractionEngine } from '../core/interaction-engine.js';
import { ModerationEngine } from '../core/moderation-engine.js';

class PresenterApp {
  constructor() {
    this.engine = new PresentationEngine({ basePath: '../presentations' });
    this.realtime = new RealtimeEngine();
    this.auth = new AuthEngine();
    this.interaction = new InteractionEngine(this.realtime, this.auth);
    this.moderation = new ModerationEngine(this.realtime, this.auth);
    
    this.presentationId = PresentationEngine.getPresentationIdFromURL();
    this.sessionId = PresentationEngine.getSessionIdFromURL() || QREngine.generateSessionCode();

    this.pollState = {
      activePollId: null,
      pollStatus: 'draft',
      showResults: false
    };

    this.timerSeconds = 0;
    this.timerInterval = null;

    // DOM Elements
    this.dom = {
      root: document.getElementById('presenter-root'),
      title: document.getElementById('presentation-title'),
      canvas: document.getElementById('slide-canvas'),
      notes: document.getElementById('speaker-notes-content'),
      slideCounter: document.getElementById('slide-counter'),
      btnFullscreen: document.getElementById('btn-fullscreen'),
      btnTogglePulpit: document.getElementById('btn-toggle-pulpit'),
      
      // QR Code Widget
      qrWidget: document.getElementById('qr-stage-widget'),
      qrContainer: document.getElementById('qr-code-box'),
      sessionCodeDisplay: document.getElementById('session-code-display'),
      audienceLink: document.getElementById('audience-direct-link'),
      btnToggleQR: document.getElementById('btn-toggle-qr'),

      // Timer
      timerDisplay: document.getElementById('timer-display'),

      // Featured Question
      featuredBanner: document.getElementById('featured-question-banner'),
      featuredText: document.getElementById('featured-question-text'),
      featuredAuthor: document.getElementById('featured-author'),
      btnDismissFeatured: document.getElementById('btn-dismiss-featured'),

      // Reactions Stream
      reactionStream: document.getElementById('reaction-stream'),
      badgeLiveStatus: document.getElementById('badge-live-status')
    };

    this.init();
  }

  async init() {
    this.bindEvents();
    this.startPresentationTimer();

    if (this.dom.sessionCodeDisplay) {
      this.dom.sessionCodeDisplay.textContent = `#${this.sessionId}`;
    }

    try {
      await this.engine.loadPresentation(this.presentationId);
      this.dom.title.textContent = this.engine.manifest.title || 'Apresentação';

      this.setupQRCode();
      this.updateSlideView();
      await this.broadcastCurrentSlide();

      // Inicia presença e conexão Realtime
      this.realtime.startPresence(this.sessionId, true);

      this.realtime.subscribeToSession(this.sessionId, (state) => {
        this.handleRemoteSessionUpdate(state);
      });

      // Escuta eventos em tempo real
      if (this.realtime.channel) {
        this.realtime.channel.addEventListener('message', (e) => {
          if (!e.data || e.data.sessionId !== this.sessionId) return;
          if (e.data.type === 'REACTION_SENT') {
            this.spawnFloatingReaction(e.data.emoji);
          } else if (e.data.type === 'VOTE_CAST') {
            this.updateSlideView();
          } else if (e.data.type === 'QUESTION_STATUS_CHANGE') {
            this.checkFeaturedQuestion();
          }
        });
      }

      window.addEventListener('storage', (e) => {
        if (e.key && e.key.startsWith(`session_questions_${this.sessionId}`)) {
          this.checkFeaturedQuestion();
        } else if (e.key && e.key.startsWith(`session_votes_${this.sessionId}`)) {
          this.updateSlideView();
        }
      });

      this.checkFeaturedQuestion();
    } catch (err) {
      this.dom.canvas.innerHTML = `
        <div class="card" style="text-align: center; color: #ef4444; max-width: 500px;">
          <h3>Erro ao carregar apresentação</h3>
          <p style="margin-top: 10px; color: #94a3b8; font-size: 14px;">${err.message}</p>
        </div>
      `;
    }
  }

  setupQRCode() {
    const audienceUrl = QREngine.getAudienceUrl(this.presentationId, this.sessionId);
    if (this.dom.audienceLink) {
      this.dom.audienceLink.textContent = audienceUrl.replace(/^https?:\/\//, '');
    }
    QREngine.renderQR(this.dom.qrContainer, audienceUrl);
  }

  startPresentationTimer() {
    this.timerInterval = setInterval(() => {
      this.timerSeconds++;
      const hrs = String(Math.floor(this.timerSeconds / 3600)).padStart(2, '0');
      const mins = String(Math.floor((this.timerSeconds % 3600) / 60)).padStart(2, '0');
      const secs = String(this.timerSeconds % 60).padStart(2, '0');
      if (this.dom.timerDisplay) {
        this.dom.timerDisplay.textContent = `${hrs}:${mins}:${secs}`;
      }
    }, 1000);
  }

  handleRemoteSessionUpdate(sessionState) {
    if (!sessionState) return;

    if (typeof sessionState.currentSlide === 'number' && this.engine.currentSlideIndex !== sessionState.currentSlide) {
      this.engine.goToSlide(sessionState.currentSlide);
      this.updateSlideView();
    }

    if (sessionState.pollStatus) {
      this.pollState.pollStatus = sessionState.pollStatus;
    }
    if (typeof sessionState.showResults === 'boolean') {
      this.pollState.showResults = sessionState.showResults;
    }

    if (sessionState.featuredQuestion) {
      this.showFeaturedBanner(sessionState.featuredQuestion.text, sessionState.featuredQuestion.authorAlias);
    } else {
      this.hideFeaturedBanner();
    }

    if (sessionState.status === 'closed') {
      if (this.dom.badgeLiveStatus) {
        this.dom.badgeLiveStatus.className = 'badge';
        this.dom.badgeLiveStatus.style.background = 'rgba(239, 68, 68, 0.2)';
        this.dom.badgeLiveStatus.style.color = '#fca5a5';
        this.dom.badgeLiveStatus.textContent = '🔴 ENCERRADA';
      }
    }

    this.updateSlideView();
  }

  checkFeaturedQuestion() {
    const questions = this.moderation.getQuestions(this.sessionId);
    const featured = questions.find(q => q.status === 'featured');
    if (featured) {
      this.showFeaturedBanner(featured.text, featured.authorAlias);
    } else {
      this.hideFeaturedBanner();
    }
  }

  showFeaturedBanner(text, author) {
    if (!this.dom.featuredBanner) return;
    this.dom.featuredText.textContent = text;
    this.dom.featuredAuthor.textContent = author || 'Participante';
    this.dom.featuredBanner.style.display = 'flex';
  }

  hideFeaturedBanner() {
    if (this.dom.featuredBanner) {
      this.dom.featuredBanner.style.display = 'none';
    }
  }

  spawnFloatingReaction(emoji) {
    if (!this.dom.reactionStream) return;
    const bubble = document.createElement('div');
    bubble.className = 'floating-reaction-bubble';
    bubble.textContent = emoji || '👏';
    
    // Pequena variação horizontal aleatória
    const offset = Math.floor(Math.random() * 60) - 30;
    bubble.style.right = `${20 + offset}px`;

    this.dom.reactionStream.appendChild(bubble);
    setTimeout(() => {
      if (bubble.parentNode) bubble.parentNode.removeChild(bubble);
    }, 2300);
  }

  updateSlideView() {
    // Se o Moderador ativou a projeção de Analytics Final
    const sessionRaw = localStorage.getItem(`session_state_${this.sessionId}`);
    let isFinalAnalytics = false;
    if (sessionRaw) {
      try {
        const state = JSON.parse(sessionRaw);
        isFinalAnalytics = !!state.showFinalAnalytics;
      } catch (e) {}
    }

    if (isFinalAnalytics) {
      this.renderPresenterFinalAnalytics();
      return;
    }

    const slide = this.engine.currentSlide;
    let pollRenderData = {
      pollStatus: this.pollState.pollStatus,
      showResults: this.pollState.showResults,
      results: null
    };

    if (slide && slide.interaction && slide.interaction.poll) {
      this.pollState.activePollId = slide.interaction.poll.id;
      if (this.pollState.showResults) {
        pollRenderData.results = this.interaction.computePollResults(this.sessionId, slide.interaction.poll);
      }
    }

    this.engine.renderPresenterSlide(this.dom.canvas, this.dom.notes, pollRenderData);

    const current = this.engine.currentSlideIndex + 1;
    const total = this.engine.totalSlides;
    this.dom.slideCounter.textContent = `${current} / ${total}`;
  }

  renderPresenterFinalAnalytics() {
    const stats = this.realtime.getOnlineStats(this.sessionId);
    const questions = this.moderation.getQuestions(this.sessionId);
    const approvedQ = questions.filter(q => q.status === 'approved' || q.status === 'featured');

    const polls = [];
    if (this.engine.slidesData && this.engine.slidesData.slides) {
      this.engine.slidesData.slides.forEach(s => {
        if (s.interaction && s.interaction.poll) {
          polls.push({
            title: s.title,
            poll: s.interaction.poll,
            res: this.interaction.computePollResults(this.sessionId, s.interaction.poll)
          });
        }
      });
    }

    const pollsCardsHtml = polls.map(p => `
      <div class="card" style="background: rgba(15, 23, 42, 0.7); border: 1px solid var(--border-subtle); padding: 18px; border-radius: var(--radius-md);">
        <div style="font-size: 11px; font-weight: 700; color: var(--accent-primary); text-transform: uppercase; margin-bottom: 4px;">ENQUETE</div>
        <div style="font-size: 15px; font-weight: 700; color: #ffffff; margin-bottom: 12px;">${p.poll.question}</div>
        ${p.res.options.map(opt => `
          <div style="margin-bottom: 8px;">
            <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 3px;">
              <span style="color: #e2e8f0;">${opt.id}. ${opt.text}</span>
              <strong style="color: var(--accent-primary); font-family: var(--font-mono); font-size: 14px;">${opt.percentage}% (${opt.votes})</strong>
            </div>
            <div class="poll-progress-track" style="height: 8px;">
              <div class="poll-progress-fill" style="width: ${opt.percentage}%;"></div>
            </div>
          </div>
        `).join('')}
      </div>
    `).join('');

    this.dom.canvas.innerHTML = `
      <div class="slide-content-wrapper" style="text-align: center; max-width: 1100px;">
        <div style="font-size: 32px; margin-bottom: 6px;">🏁</div>
        <div class="slide-category" style="margin-bottom: 6px;">BALANÇO GERAL DO EVENTO</div>
        <h2 class="slide-headline" style="font-size: 34px; margin-bottom: 24px;">Resultados Consolidados da Apresentação</h2>

        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-bottom: 24px;">
          <div class="card" style="padding: 16px; text-align: center; background: rgba(15,23,42,0.8);">
            <div style="font-size: 12px; color: var(--text-muted); text-transform: uppercase;">Participantes Conectados</div>
            <div style="font-size: 28px; font-weight: 800; color: var(--accent-primary); font-family: var(--font-mono); margin-top: 4px;">
              ${stats.total}
            </div>
          </div>
          <div class="card" style="padding: 16px; text-align: center; background: rgba(15,23,42,0.8);">
            <div style="font-size: 12px; color: var(--text-muted); text-transform: uppercase;">Perguntas Aprovadas</div>
            <div style="font-size: 28px; font-weight: 800; color: #34d399; font-family: var(--font-mono); margin-top: 4px;">
              ${approvedQ.length}
            </div>
          </div>
          <div class="card" style="padding: 16px; text-align: center; background: rgba(15,23,42,0.8);">
            <div style="font-size: 12px; color: var(--text-muted); text-transform: uppercase;">Enquetes Realizadas</div>
            <div style="font-size: 28px; font-weight: 800; color: #fbbf24; font-family: var(--font-mono); margin-top: 4px;">
              ${polls.length}
            </div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px; text-align: left;">
          ${pollsCardsHtml}
        </div>

        <div style="margin-top: 24px; font-size: 14px; color: var(--text-muted);">
          Obrigado pela sua presença e participação ativa!
        </div>
      </div>
    `;

    if (this.dom.notes) {
      this.dom.notes.textContent = 'Slide executivo de encerramento com métricas e consolidação dos votos da audiência.';
    }
  }

  async broadcastCurrentSlide() {
    await this.realtime.setSlide(
      this.sessionId,
      this.engine.currentSlideIndex,
      this.engine.currentSlide
    );
  }

  toggleQRWidget() {
    if (this.dom.qrWidget) {
      this.dom.qrWidget.classList.toggle('collapsed');
    }
  }

  togglePulpitMode() {
    if (this.dom.root) {
      this.dom.root.classList.toggle('pulpit-mode');
      const isPulpit = this.dom.root.classList.contains('pulpit-mode');
      if (this.dom.btnTogglePulpit) {
        this.dom.btnTogglePulpit.textContent = isPulpit ? '🖥️ Modo Telão' : '🎛️ Púlpito com Notas';
      }
    }
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

  bindEvents() {
    // Atalhos de teclado para palco
    window.addEventListener('keydown', (e) => {
      // Ignora se estiver digitando em inputs
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

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
        e.preventDefault();
        this.toggleFullscreen();
      } else if (e.key.toLowerCase() === 'q') {
        e.preventDefault();
        this.toggleQRWidget();
      }
    });

    if (this.dom.btnTogglePulpit) {
      this.dom.btnTogglePulpit.addEventListener('click', () => this.togglePulpitMode());
    }

    if (this.dom.btnFullscreen) {
      this.dom.btnFullscreen.addEventListener('click', () => this.toggleFullscreen());
    }

    if (this.dom.btnToggleQR) {
      this.dom.btnToggleQR.addEventListener('click', () => this.toggleQRWidget());
    }

    if (this.dom.btnDismissFeatured) {
      this.dom.btnDismissFeatured.addEventListener('click', async () => {
        await this.moderation.clearFeatured(this.sessionId);
        this.hideFeaturedBanner();
      });
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.presenterApp = new PresenterApp();
});
