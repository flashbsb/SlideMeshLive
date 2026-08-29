/**
 * Presenter & Clean Stage Application Controller
 * Coordena projeção limpa no palco, controle de enquetes ao vivo, modal gigante de QR Code,
 * atalhos de teclado (Q, V, R, B), grade de miniaturas no púlpito (P),
 * reatividade a host dinâmico, troca sincronizada de apresentação e suporte a i18n e temas.
 */

import { PresentationEngine } from '../core/presentation-engine.js';
import { QREngine } from '../core/qr-engine.js';
import { RealtimeEngine } from '../core/realtime-engine.js';
import { AuthEngine } from '../core/auth-engine.js';
import { InteractionEngine } from '../core/interaction-engine.js';
import { ModerationEngine } from '../core/moderation-engine.js';
import { i18n } from '../core/i18n-engine.js';
import { theme, THEMES } from '../core/theme-engine.js';

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
      pollStatus: 'open',
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
      pulpitSlideSorter: document.getElementById('pulpit-slide-sorter'),
      btnToggleLang: document.getElementById('btn-toggle-lang'),
      btnToggleTheme: document.getElementById('btn-toggle-theme'),
      
      // QR Code Widgets
      qrWidget: document.getElementById('qr-stage-widget'),
      qrContainer: document.getElementById('qr-code-box'),
      sessionCodeDisplay: document.getElementById('session-code-display'),
      audienceLink: document.getElementById('audience-direct-link'),
      btnToggleMiniQR: document.getElementById('btn-toggle-mini-qr'),
      btnHideMiniQR: document.getElementById('btn-hide-mini-qr'),
      btnMaximizeQR: document.getElementById('btn-maximize-qr'),

      // Large QR Modal
      qrCenterModal: document.getElementById('qr-center-modal'),
      qrLargeBox: document.getElementById('qr-large-box'),
      qrLargeSessionCode: document.getElementById('qr-large-session-code'),
      qrLargeUrlText: document.getElementById('qr-large-url-text'),
      btnToggleLargeQR: document.getElementById('btn-toggle-large-qr'),
      btnCloseLargeQR: document.getElementById('btn-close-large-qr'),

      // Stage Poll Dock
      stagePollDock: document.getElementById('stage-poll-dock'),
      stagePollVotesCount: document.getElementById('stage-poll-votes-count'),
      btnStagePollToggle: document.getElementById('btn-stage-poll-toggle'),
      btnStageResultsToggle: document.getElementById('btn-stage-results-toggle'),

      // Timer & Badges
      timerDisplay: document.getElementById('timer-display'),
      badgeLiveStatus: document.getElementById('badge-live-status'),

      // Featured Question
      featuredBanner: document.getElementById('featured-question-banner'),
      featuredText: document.getElementById('featured-question-text'),
      featuredAuthor: document.getElementById('featured-author'),
      btnDismissFeatured: document.getElementById('btn-dismiss-featured'),

      // Questions Drawer (Mural - Atalho M)
      btnToggleQuestions: document.getElementById('btn-toggle-questions'),
      questionsDrawer: document.getElementById('stage-questions-drawer'),
      questionsList: document.getElementById('stage-questions-list'),
      unansweredBadge: document.getElementById('stage-unanswered-badge'),
      btnCloseQuestionsDrawer: document.getElementById('btn-close-questions-drawer'),

      // Reactions Stream
      reactionStream: document.getElementById('reaction-stream')
    };

    this.init();
  }

  async init() {
    this.bindEvents();
    this.updateLanguageButton();
    this.updateThemeButton();
    i18n.applyTranslations();
    this.startPresentationTimer();

    if (this.dom.sessionCodeDisplay) {
      this.dom.sessionCodeDisplay.textContent = `#${this.sessionId}`;
    }

    try {
      await this.engine.loadPresentation(this.presentationId);
      this.dom.title.textContent = this.engine.manifest.title || 'Apresentação';

      this.setupQRCodes();
      this.updateSlideView();
      this.renderPulpitSlideSorter();
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
          } else if (e.data.type === 'VOTE_CAST' || e.data.type === 'VOTE_RESET') {
            this.updatePollResultsInStage();
          } else if (e.data.type === 'QUESTION_STATUS_CHANGE' || e.data.type === 'NEW_QUESTION') {
            this.updateQuestionsDrawer();
          } else if (e.data.type === 'QR_HOST_CONFIG_CHANGED') {
            this.setupQRCodes();
          } else if (e.data.type === 'SWITCH_ACTIVE_PRESENTATION') {
            if (e.data.presentationId && e.data.presentationId !== this.presentationId) {
              window.location.href = `?presentation=${encodeURIComponent(e.data.presentationId)}&session=${encodeURIComponent(this.sessionId)}`;
            }
          }
        });
      }

      window.addEventListener('storage', (e) => {
        if (e.key && (e.key.startsWith(`session_votes_${this.sessionId}`) || e.key.startsWith(`vote_`))) {
          this.updatePollResultsInStage();
        } else if (e.key && e.key.startsWith(`session_questions_${this.sessionId}`)) {
          this.updateQuestionsDrawer();
        } else if (e.key && e.key.startsWith(`session_qr_host_${this.sessionId}`)) {
          this.setupQRCodes();
        }
      });

      this.updateQuestionsDrawer();
    } catch (err) {
      this.dom.canvas.innerHTML = `
        <div style="color: #ef4444; font-size: 20px; font-weight: 700; text-align: center; padding: 40px;">
          ❌ Erro ao carregar apresentação: ${err.message}
        </div>
      `;
    }
  }

  updateLanguageButton() {
    if (this.dom.btnToggleLang) {
      this.dom.btnToggleLang.textContent = i18n.language === 'pt-BR' ? '🇧🇷 PT' : '🇺🇸 EN';
    }
  }

  updateThemeButton() {
    if (this.dom.btnToggleTheme) {
      const current = THEMES.find(t => t.id === theme.theme) || THEMES[0];
      this.dom.btnToggleTheme.textContent = current.icon;
    }
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

  setupQRCodes() {
    const audienceUrl = QREngine.getAudienceUrl(this.presentationId, this.sessionId);
    
    // QR Mini Rodapé
    if (this.dom.qrContainer) {
      QREngine.renderQR(this.dom.qrContainer, audienceUrl, 74);
    }
    if (this.dom.audienceLink) {
      this.dom.audienceLink.textContent = audienceUrl.replace(/^https?:\/\//, '');
      this.dom.audienceLink.title = audienceUrl;
    }

    // QR Gigante Central
    if (this.dom.qrLargeBox) {
      QREngine.renderQR(this.dom.qrLargeBox, audienceUrl, 260);
    }
    if (this.dom.qrLargeSessionCode) {
      this.dom.qrLargeSessionCode.textContent = `#${this.sessionId}`;
    }
    if (this.dom.qrLargeUrlText) {
      this.dom.qrLargeUrlText.textContent = audienceUrl;
    }
  }

  updateSlideView() {
    const current = this.engine.currentSlideIndex + 1;
    const total = this.engine.totalSlides;
    const slide = this.engine.currentSlide;

    if (this.dom.slideCounter) {
      this.dom.slideCounter.textContent = `${current} / ${total}`;
    }

    // Renderiza o Slide HTML com animações
    if (this.dom.canvas && slide) {
      this.dom.canvas.innerHTML = this.engine.renderSlideHtml(slide);
      this.applySlideAnimations();
    }

    // Notas do Orador no Púlpito
    if (this.dom.notes) {
      this.dom.notes.innerHTML = slide && slide.speakerNotes 
        ? slide.speakerNotes.replace(/\n/g, '<br>')
        : `<em style="color: var(--text-muted);">${i18n.t('presenter.no_notes')}</em>`;
    }

    // Atualiza destaque no Slide Sorter do Púlpito
    this.updatePulpitSorterActive();

    // Gerencia o Dock de Enquete no Palco
    this.handleSlidePoll(slide);
  }

  renderPulpitSlideSorter() {
    if (!this.dom.pulpitSlideSorter || !this.engine.slidesData) return;
    const slides = this.engine.slidesData.slides || [];

    this.dom.pulpitSlideSorter.innerHTML = slides.map((s, idx) => `
      <div class="sorter-item ${idx === this.engine.currentSlideIndex ? 'active' : ''}" data-index="${idx}" style="cursor: pointer; padding: 4px; border: 1px solid ${idx === this.engine.currentSlideIndex ? 'var(--accent-primary)' : 'var(--border-subtle)'}; border-radius: 4px; background: ${idx === this.engine.currentSlideIndex ? 'var(--bg-tertiary)' : 'rgba(15,23,42,0.8)'}; text-align: center;">
        <div style="font-size: 10px; font-weight: 700; color: ${idx === this.engine.currentSlideIndex ? 'var(--accent-primary)' : '#ffffff'};">#${idx + 1}</div>
        <div style="font-size: 8.5px; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${s.title || 'Slide'}</div>
      </div>
    `).join('');

    this.dom.pulpitSlideSorter.querySelectorAll('.sorter-item').forEach(item => {
      item.addEventListener('click', async () => {
        const targetIdx = parseInt(item.dataset.index, 10);
        this.engine.goToSlide(targetIdx);
        this.updateSlideView();
        await this.broadcastCurrentSlide();
      });
    });
  }

  updatePulpitSorterActive() {
    if (!this.dom.pulpitSlideSorter) return;
    const items = this.dom.pulpitSlideSorter.querySelectorAll('.sorter-item');
    items.forEach((item, idx) => {
      const isCurrent = (idx === this.engine.currentSlideIndex);
      item.classList.toggle('active', isCurrent);
      item.style.borderColor = isCurrent ? 'var(--accent-primary)' : 'var(--border-subtle)';
      item.style.background = isCurrent ? 'var(--bg-tertiary)' : 'rgba(15,23,42,0.8)';
    });
  }

  handleSlidePoll(slide) {
    if (slide && slide.interaction && slide.interaction.poll) {
      this.pollState.activePollId = slide.interaction.poll.id;
      this.dom.stagePollDock.style.display = 'flex';
      this.updatePollResultsInStage();
    } else {
      this.pollState.activePollId = null;
      this.dom.stagePollDock.style.display = 'none';
    }
  }

  updatePollResultsInStage() {
    if (!this.pollState.activePollId || !this.engine.currentSlide) return;
    const poll = this.engine.currentSlide.interaction.poll;
    const res = this.interaction.computePollResults(this.sessionId, poll);

    if (this.dom.stagePollVotesCount) {
      this.dom.stagePollVotesCount.textContent = `${res.totalVotes} voto(s)`;
    }

    if (this.pollState.showResults) {
      this.renderPollResultsOverlay(res);
    }
  }

  renderPollResultsOverlay(results) {
    let overlay = document.getElementById('stage-poll-results-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'stage-poll-results-overlay';
      overlay.className = 'poll-overlay-stage animate-scale-up';
      this.dom.canvas.appendChild(overlay);
    }

    const barsHtml = results.options.map(opt => `
      <div class="poll-bar-stage-row">
        <div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: 600; margin-bottom: 4px;">
          <span>${opt.id}. ${opt.text}</span>
          <span style="font-family: var(--font-mono); color: var(--accent-primary); font-weight: 700;">${opt.percentage}% (${opt.votes})</span>
        </div>
        <div class="poll-progress-track" style="height: 12px; border-radius: 6px;">
          <div class="poll-progress-fill" style="width: ${opt.percentage}%;"></div>
        </div>
      </div>
    `).join('');

    overlay.innerHTML = `
      <div style="background: var(--bg-secondary); border: 2px solid var(--border-medium); border-radius: var(--radius-lg); padding: 24px 32px; width: 100%; max-width: 680px; box-shadow: var(--shadow-lg);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <span class="badge badge-accent" style="font-size: 11px;">📊 RESULTADOS DA AUDIÊNCIA</span>
          <span style="font-family: var(--font-mono); font-size: 12px; color: var(--text-muted);">${results.totalVotes} votos computados</span>
        </div>
        <h3 style="font-size: 18px; font-weight: 800; color: var(--text-primary); margin-bottom: 18px;">${results.question}</h3>
        <div style="display: flex; flex-direction: column; gap: 14px;">${barsHtml}</div>
      </div>
    `;
  }

  hidePollResultsOverlay() {
    const overlay = document.getElementById('stage-poll-results-overlay');
    if (overlay) overlay.remove();
  }

  async broadcastCurrentSlide() {
    await this.realtime.setSlide(
      this.sessionId,
      this.engine.currentSlideIndex,
      this.engine.currentSlide
    );
  }

  handleRemoteSessionUpdate(state) {
    if (!state) return;

    if (typeof state.currentSlide === 'number' && state.currentSlide !== this.engine.currentSlideIndex) {
      this.engine.goToSlide(state.currentSlide);
      this.updateSlideView();
    }

    if (typeof state.showResults === 'boolean') {
      this.pollState.showResults = state.showResults;
      if (this.pollState.showResults) {
        this.updatePollResultsInStage();
      } else {
        this.hidePollResultsOverlay();
      }
    }

    if (state.featuredQuestion) {
      this.showFeaturedQuestion(state.featuredQuestion);
    } else {
      this.hideFeaturedQuestion();
    }

    if (state.showFinalAnalytics) {
      this.renderFinalAnalyticsOnStage();
    }
  }

  showFeaturedQuestion(question) {
    if (!this.dom.featuredBanner) return;
    this.dom.featuredText.textContent = question.text;
    this.dom.featuredAuthor.textContent = question.authorAlias || 'Participante';
    this.dom.featuredBanner.style.display = 'flex';
  }

  hideFeaturedQuestion() {
    if (this.dom.featuredBanner) {
      this.dom.featuredBanner.style.display = 'none';
    }
  }

  renderFinalAnalyticsOnStage() {
    const report = this.interaction.computeSessionSummary(this.sessionId, this.engine.slidesData);
    let overlay = document.getElementById('stage-analytics-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'stage-analytics-overlay';
      overlay.className = 'poll-overlay-stage animate-scale-up';
      overlay.style.zIndex = '50';
      this.dom.canvas.appendChild(overlay);
    }

    overlay.innerHTML = `
      <div style="background: var(--bg-secondary); border: 2px solid var(--border-medium); border-radius: var(--radius-lg); padding: 32px 40px; width: 100%; max-width: 800px; text-align: center; box-shadow: var(--shadow-lg);">
        <span class="badge badge-accent" style="font-size: 13px; margin-bottom: 12px;">📢 APRESENTAÇÃO CONCLUÍDA</span>
        <h2 style="font-size: 26px; font-weight: 800; color: var(--text-primary); margin-bottom: 8px;">Resumo Analítico da Sessão</h2>
        <p style="font-size: 14px; color: var(--text-secondary); margin-bottom: 24px;">Obrigado a todos pela participação interativa!</p>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px;">
          <div class="stat-box" style="padding: 16px; text-align: center; flex-direction: column;">
            <div style="font-size: 32px; font-weight: 800; color: var(--accent-primary); font-family: var(--font-mono);">${report.totalPollVotes}</div>
            <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">Votos Computados</div>
          </div>
          <div class="stat-box" style="padding: 16px; text-align: center; flex-direction: column;">
            <div style="font-size: 32px; font-weight: 800; color: #34d399; font-family: var(--font-mono);">${report.totalQuestions}</div>
            <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">Perguntas Recebidas</div>
          </div>
        </div>

        <button class="btn btn-sm" id="btn-close-stage-analytics" style="padding: 6px 18px; font-size: 12px;">
          ✕ Fechar Resumo
        </button>
      </div>
    `;

    document.getElementById('btn-close-stage-analytics').addEventListener('click', () => {
      overlay.remove();
    });
  }

  updateQuestionsDrawer() {
    const questions = this.moderation.getApprovedQuestions(this.sessionId);
    const unanswered = questions.filter(q => !q.answered);

    if (this.dom.unansweredBadge) {
      this.dom.unansweredBadge.textContent = `${unanswered.length} pendentes`;
    }

    if (!this.dom.questionsList) return;

    if (questions.length === 0) {
      this.dom.questionsList.innerHTML = `
        <div style="color: var(--text-muted); font-size: 12px; text-align: center; padding: 24px;">
          Nenhuma pergunta aprovada no mural.
        </div>
      `;
      return;
    }

    this.dom.questionsList.innerHTML = questions.map(q => `
      <div class="stage-question-card ${q.answered ? 'answered' : ''}">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
          <span style="font-size: 12px; font-weight: 700; color: ${q.answered ? 'var(--text-muted)' : 'var(--text-primary)'};">
            ${q.authorAlias || 'Participante'}
          </span>
          <span style="font-size: 10px; color: var(--text-muted);">
            ${new Date(q.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        <div style="font-size: 13.5px; color: ${q.answered ? 'var(--text-muted)' : '#ffffff'}; line-height: 1.4;">
          ${q.text}
        </div>
      </div>
    `).join('');
  }

  spawnFloatingReaction(emoji) {
    if (!this.dom.reactionStream || !emoji) return;
    const el = document.createElement('div');
    el.className = 'floating-emoji animate-float-up';
    el.textContent = emoji;
    el.style.left = `${Math.floor(Math.random() * 80) + 10}%`;
    this.dom.reactionStream.appendChild(el);
    setTimeout(() => el.remove(), 2500);
  }

  applySlideAnimations() {
    const cards = this.dom.canvas.querySelectorAll('.card, .stat-box, .comparison-col');
    cards.forEach((c, i) => {
      c.style.animationDelay = `${(i + 1) * 0.08}s`;
      c.classList.add('animate-fade-in');
    });
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.warn('Fullscreen bloqueado:', err);
      });
    } else {
      document.exitFullscreen();
    }
  }

  togglePulpitMode() {
    this.dom.root.classList.toggle('pulpit-active');
  }

  toggleLargeQR() {
    const isVisible = (this.dom.qrCenterModal.style.display === 'flex');
    this.dom.qrCenterModal.style.display = isVisible ? 'none' : 'flex';
  }

  toggleMiniQR() {
    const isHidden = (this.dom.qrWidget.style.display === 'none');
    this.dom.qrWidget.style.display = isHidden ? 'flex' : 'none';
  }

  toggleQuestionsDrawer() {
    const isVisible = (this.dom.questionsDrawer.style.display === 'flex');
    this.dom.questionsDrawer.style.display = isVisible ? 'none' : 'flex';
  }

  bindEvents() {
    // Alternância de Idioma e Tema
    if (this.dom.btnToggleLang) {
      this.dom.btnToggleLang.addEventListener('click', () => {
        i18n.toggleLanguage();
        this.updateLanguageButton();
        this.updateThemeButton();
      });
    }

    if (this.dom.btnToggleTheme) {
      this.dom.btnToggleTheme.addEventListener('click', () => {
        theme.cycleTheme();
        this.updateThemeButton();
      });
    }

    // Navegação via Teclado e Atalhos
    document.addEventListener('keydown', async (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault();
        this.engine.nextSlide();
        this.updateSlideView();
        await this.broadcastCurrentSlide();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        this.engine.prevSlide();
        this.updateSlideView();
        await this.broadcastCurrentSlide();
      } else if (e.key.toLowerCase() === 'f') {
        this.toggleFullscreen();
      } else if (e.key.toLowerCase() === 'p') {
        this.togglePulpitMode();
      } else if (e.key.toLowerCase() === 'q') {
        this.toggleLargeQR();
      } else if (e.key.toLowerCase() === 'w') {
        this.toggleMiniQR();
      } else if (e.key.toLowerCase() === 'm') {
        this.toggleQuestionsDrawer();
      } else if (e.key.toLowerCase() === 'r') {
        this.pollState.showResults = !this.pollState.showResults;
        await this.interaction.toggleShowResults(this.sessionId, this.pollState.showResults);
      } else if (e.key.toLowerCase() === 'v') {
        if (this.pollState.activePollId) {
          const next = this.pollState.pollStatus === 'open' ? 'closed' : 'open';
          this.pollState.pollStatus = next;
          if (next === 'open') {
            await this.interaction.openPoll(this.sessionId, this.pollState.activePollId);
          } else {
            await this.interaction.closePoll(this.sessionId, this.pollState.activePollId);
          }
        }
      } else if (e.key.toLowerCase() === 'b') {
        this.dom.root.classList.toggle('blackout-mode');
      } else if (e.key === 'Escape') {
        this.dom.qrCenterModal.style.display = 'none';
        this.dom.questionsDrawer.style.display = 'none';
      }
    });

    // Botões do Header
    if (this.dom.btnFullscreen) this.dom.btnFullscreen.addEventListener('click', () => this.toggleFullscreen());
    if (this.dom.btnTogglePulpit) this.dom.btnTogglePulpit.addEventListener('click', () => this.togglePulpitMode());
    if (this.dom.btnToggleLargeQR) this.dom.btnToggleLargeQR.addEventListener('click', () => this.toggleLargeQR());
    if (this.dom.btnCloseLargeQR) this.dom.btnCloseLargeQR.addEventListener('click', () => this.toggleLargeQR());
    if (this.dom.btnToggleMiniQR) this.dom.btnToggleMiniQR.addEventListener('click', () => this.toggleMiniQR());
    if (this.dom.btnHideMiniQR) this.dom.btnHideMiniQR.addEventListener('click', () => this.toggleMiniQR());
    if (this.dom.btnMaximizeQR) this.dom.btnMaximizeQR.addEventListener('click', () => this.toggleLargeQR());
    if (this.dom.btnToggleQuestions) this.dom.btnToggleQuestions.addEventListener('click', () => this.toggleQuestionsDrawer());
    if (this.dom.btnCloseQuestionsDrawer) this.dom.btnCloseQuestionsDrawer.addEventListener('click', () => this.toggleQuestionsDrawer());

    // Dismiss Pergunta Destacada
    if (this.dom.btnDismissFeatured) {
      this.dom.btnDismissFeatured.addEventListener('click', async () => {
        await this.moderation.clearFeatured(this.sessionId);
      });
    }

    // Controles de Enquete no Palco
    if (this.dom.btnStagePollToggle) {
      this.dom.btnStagePollToggle.addEventListener('click', async () => {
        if (this.pollState.activePollId) {
          const next = this.pollState.pollStatus === 'open' ? 'closed' : 'open';
          this.pollState.pollStatus = next;
          this.dom.btnStagePollToggle.textContent = next === 'open' ? '🔴 Fechar Votação' : '🟢 Abrir Votação';
          if (next === 'open') {
            await this.interaction.openPoll(this.sessionId, this.pollState.activePollId);
          } else {
            await this.interaction.closePoll(this.sessionId, this.pollState.activePollId);
          }
        }
      });
    }

    if (this.dom.btnStageResultsToggle) {
      this.dom.btnStageResultsToggle.addEventListener('click', async () => {
        this.pollState.showResults = !this.pollState.showResults;
        await this.interaction.toggleShowResults(this.sessionId, this.pollState.showResults);
      });
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.presenterApp = new PresenterApp();
});
