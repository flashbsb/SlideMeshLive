/**
 * Audience Mobile Application Controller
 * Coordena sincronização, presença, enquetes, reações, internacionalização (i18n),
 * temas visuais, resiliência offline e transição remota de apresentação em tempo real.
 */

import { PresentationEngine } from '../core/presentation-engine.js';
import { RealtimeEngine } from '../core/realtime-engine.js';
import { AuthEngine } from '../core/auth-engine.js';
import { InteractionEngine } from '../core/interaction-engine.js';
import { ModerationEngine } from '../core/moderation-engine.js';
import { i18n } from '../core/i18n-engine.js';
import { theme, THEMES } from '../core/theme-engine.js';

class AudienceApp {
  constructor() {
    this.engine = new PresentationEngine({ basePath: '../presentations' });
    this.realtime = new RealtimeEngine();
    this.auth = new AuthEngine();
    this.interaction = new InteractionEngine(this.realtime, this.auth);
    this.moderation = new ModerationEngine(this.realtime, this.auth);

    this.presentationId = PresentationEngine.getPresentationIdFromURL();
    this.sessionId = PresentationEngine.getSessionIdFromURL();
    this.isLiveSync = true;
    this.presenterSlideIndex = 0;
    this.pendingAction = null;

    this.pollState = {
      pollStatus: 'open',
      showResults: false
    };

    // DOM Elements
    this.dom = {
      headerTitle: document.getElementById('audience-pres-name'),
      slideIndicator: document.getElementById('audience-slide-indicator'),
      contentArea: document.getElementById('audience-content-area'),
      sessionBadge: document.getElementById('session-badge-code'),
      navPrev: document.getElementById('btn-audience-prev'),
      navNext: document.getElementById('btn-audience-next'),
      btnSync: document.getElementById('btn-audience-sync'),
      btnAsk: document.getElementById('btn-audience-ask'),
      syncToast: document.getElementById('sync-toast'),
      btnAudienceLang: document.getElementById('btn-audience-lang'),
      btnAudienceTheme: document.getElementById('btn-audience-theme'),
      offlineBanner: document.getElementById('audience-offline-banner'),
      
      // Auth elements
      authStatusBtn: document.getElementById('auth-status-btn'),
      authUserLabel: document.getElementById('auth-user-label'),
      authModal: document.getElementById('auth-modal'),
      btnCloseAuthModal: document.getElementById('btn-close-auth-modal'),
      btnGoogleLogin: document.getElementById('btn-google-login'),
      btnLocalLogin: document.getElementById('btn-local-login'),
      inputLocalUsername: document.getElementById('input-local-username'),
      inputLocalPassword: document.getElementById('input-local-password'),
      localLoginError: document.getElementById('local-login-error'),

      // Session PIN modal
      sessionPinModal: document.getElementById('session-pin-modal'),
      sessionPinHint: document.getElementById('session-pin-hint'),
      inputSessionPin: document.getElementById('input-session-pin'),
      sessionPinError: document.getElementById('session-pin-error'),
      btnSubmitSessionPin: document.getElementById('btn-submit-session-pin'),

      // Profile modal elements
      profileModal: document.getElementById('profile-modal'),
      btnCloseProfileModal: document.getElementById('btn-close-profile-modal'),
      profileAlias: document.getElementById('profile-modal-alias'),
      profileUid: document.getElementById('profile-modal-uid'),
      btnLogout: document.getElementById('btn-logout'),

      // Question modal elements
      questionModal: document.getElementById('question-modal'),
      btnCloseQuestionModal: document.getElementById('btn-close-question-modal'),
      questionInput: document.getElementById('question-input'),
      questionCharCount: document.getElementById('question-char-count'),
      btnSubmitQuestion: document.getElementById('btn-submit-question'),
      questionFeedback: document.getElementById('question-feedback'),

      // Featured question on audience
      audienceFeaturedBanner: document.getElementById('audience-featured-banner'),
      audienceFeaturedText: document.getElementById('audience-featured-text'),
      audienceFeaturedAuthor: document.getElementById('audience-featured-author'),
      sessionClosedNotice: document.getElementById('session-closed-notice'),
      audienceFinalAnalytics: document.getElementById('audience-final-analytics'),
      audienceAnalyticsContent: document.getElementById('audience-analytics-content')
    };

    this.init();
  }

  async init() {
    this.bindEvents();
    this.setupNetworkMonitor();
    this.updateLanguageButton();
    this.updateThemeButton();
    i18n.applyTranslations();

    if (this.dom.sessionBadge) {
      this.dom.sessionBadge.textContent = this.sessionId;
    }

    try {
      await this.engine.loadPresentation(this.presentationId);
      
      if (this.dom.headerTitle) {
        this.dom.headerTitle.textContent = this.engine.manifest.title || 'Apresentação';
      }

      this.checkSessionProtection();
      this.updateAuthStatusUI();

      // Inicia presença do participante
      const user = this.auth.getCurrentUser();
      this.realtime.startPresence(this.sessionId, false, user ? user.uid : null, user ? user.displayName : null, user ? user.isAuthenticated : false);

      // Inscreve-se nas atualizações de sessão
      this.realtime.subscribeToSession(this.sessionId, (state) => {
        this.handleRemoteSessionUpdate(state);
      });

      // Escuta unificada de eventos em tempo real
      this.realtime.onEvent((event) => {
        if (!event || event.sessionId !== this.sessionId) return;
        const type = event.type;
        const payload = event.payload || event;

        if (type === 'VOTE_CAST' || type === 'VOTE_RESET' || type === 'RESET_POLL' || type === 'RESET_ALL_POLLS') {
          this.renderAudienceSlide();
        } else if (type === 'QUESTION_STATUS_CHANGE' || type === 'CLEAR_ALL_QUESTIONS') {
          this.updateMyQuestionsStatus();
        } else if (type === 'USER_BLOCKED_STATUS') {
          const currentUser = this.auth.getCurrentUser();
          if (currentUser && currentUser.uid === (payload.uid || event.uid)) {
            if (payload.isBlocked || event.isBlocked) {
              alert('Aviso: Sua conta foi temporariamente bloqueada pela moderação.');
            }
          }
        } else if (type === 'SWITCH_ACTIVE_PRESENTATION') {
          const newPid = payload.presentationId || event.presentationId;
          if (newPid && newPid !== this.presentationId) {
            window.location.href = `?presentation=${encodeURIComponent(newPid)}&session=${encodeURIComponent(this.sessionId)}`;
          }
          // NB04: SESSION_STATE_UPDATE removido — já tratado por subscribeToSession
        }
      });

      this.renderAudienceSlide();
    } catch (err) {
      if (this.dom.contentArea) {
        this.dom.contentArea.innerHTML = `
          <div class="card" style="border-color: #ef4444; text-align: center; padding: 30px;">
            <div style="font-size: 28px; margin-bottom: 8px;">⚠️</div>
            <h3 style="font-size: 16px; font-weight: 700; color: #fca5a5; margin-bottom: 6px;">Erro ao carregar</h3>
            <p style="font-size: 13px; color: var(--text-secondary);">${err.message}</p>
          </div>
        `;
      }
    }
  }

  setupNetworkMonitor() {
    const updateStatus = () => {
      if (!navigator.onLine) {
        if (this.dom.offlineBanner) this.dom.offlineBanner.style.display = 'block';
      } else {
        if (this.dom.offlineBanner) this.dom.offlineBanner.style.display = 'none';
      }
    };
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
    updateStatus();
  }

  updateLanguageButton() {
    if (this.dom.btnAudienceLang) {
      this.dom.btnAudienceLang.textContent = i18n.language === 'pt-BR' ? '🇧🇷 PT' : '🇺🇸 EN';
    }
  }

  updateThemeButton() {
    if (this.dom.btnAudienceTheme) {
      const current = THEMES.find(t => t.id === theme.theme) || THEMES[0];
      this.dom.btnAudienceTheme.textContent = current.icon;
    }
  }

  checkSessionProtection() {
    const sec = this.engine.manifest && this.engine.manifest.security;
    // NB12: suporta tanto mode:'pin' (AuthEngine) quanto requirePIN (legado)
    if (sec && (sec.mode === 'pin' || sec.requirePIN)) {
      const isUnlocked = sessionStorage.getItem(`unlocked_session_${this.sessionId}`);
      if (!isUnlocked) {
        if (this.dom.sessionPinModal) {
          this.dom.sessionPinModal.classList.add('active');
          if (this.dom.sessionPinHint) {
            this.dom.sessionPinHint.textContent = (sec && sec.pinHint) ? sec.pinHint : `Apresentação "${this.engine.manifest.title}" protegida por PIN.`;
          }
        }
      }
    }
  }

  unlockWithPIN() {
    const entered = this.dom.inputSessionPin.value;
    const required = this.engine.manifest.security.pin;
    if (entered === required) {
      sessionStorage.setItem(`unlocked_session_${this.sessionId}`, 'true');
      this.dom.sessionPinModal.classList.remove('active');
    } else {
      this.dom.sessionPinError.style.display = 'block';
    }
  }

  updateAuthStatusUI() {
    const user = this.auth.getCurrentUser();
    if (this.dom.authUserLabel) {
      if (user && user.isAuthenticated) {
        this.dom.authUserLabel.textContent = `👤 ${user.displayName.split(' ')[0]}`;
        this.dom.authStatusBtn.classList.add('authenticated');
      } else {
        this.dom.authUserLabel.textContent = i18n.t('audience.btn_login');
        this.dom.authStatusBtn.classList.remove('authenticated');
      }
    }
  }

  handleRemoteSessionUpdate(state) {
    if (!state) return;
    // NB03: consolidar em 1 render ao invés de até 3x separados
    let needsRender = false;

    if (typeof state.currentSlide === 'number') {
      this.presenterSlideIndex = state.currentSlide;
      if (this.isLiveSync) {
        this.engine.goToSlide(this.presenterSlideIndex);
        needsRender = true;
      } else if (this.engine.currentSlideIndex === this.presenterSlideIndex) {
        this.hideSyncToast();
      } else {
        this.showSyncToast();
      }
    }

    if (typeof state.showResults === 'boolean') {
      this.pollState.showResults = state.showResults;
      needsRender = true;
    }

    if (state.pollStatus) {
      this.pollState.pollStatus = state.pollStatus;
      needsRender = true;
    }

    if (state.featuredQuestion) {
      this.showFeaturedQuestion(state.featuredQuestion);
    } else {
      this.hideFeaturedQuestion();
    }

    if (state.status === 'closed') {
      if (this.dom.sessionClosedNotice) this.dom.sessionClosedNotice.style.display = 'block';
    } else {
      if (this.dom.sessionClosedNotice) this.dom.sessionClosedNotice.style.display = 'none';
    }

    if (state.showFinalAnalytics) {
      this.renderFinalAnalytics();
    }

    if (needsRender) this.renderAudienceSlide(); // NB03: render único consolidado
  }

  showFeaturedQuestion(question) {
    if (!this.dom.audienceFeaturedBanner) return;
    this.dom.audienceFeaturedText.textContent = question.text;
    this.dom.audienceFeaturedAuthor.textContent = question.authorAlias || 'Participante';
    this.dom.audienceFeaturedBanner.style.display = 'block';
  }

  hideFeaturedQuestion() {
    if (this.dom.audienceFeaturedBanner) {
      this.dom.audienceFeaturedBanner.style.display = 'none';
    }
  }

  renderFinalAnalytics() {
    if (!this.dom.audienceFinalAnalytics || !this.dom.audienceAnalyticsContent) return;
    const summary = this.interaction.computeSessionSummary(this.sessionId, this.engine.slidesData);

    this.dom.audienceAnalyticsContent.innerHTML = `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px;">
        <div class="stat-box" style="padding: 10px; text-align: center; flex-direction: column;">
          <div style="font-size: 22px; font-weight: 800; color: var(--accent-primary); font-family: var(--font-mono);">${summary.totalPollVotes}</div>
          <div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">Votos Registrados</div>
        </div>
        <div class="stat-box" style="padding: 10px; text-align: center; flex-direction: column;">
          <div style="font-size: 22px; font-weight: 800; color: #34d399; font-family: var(--font-mono);">${summary.totalQuestions}</div>
          <div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">Perguntas Enviadas</div>
        </div>
      </div>
      <p style="font-size: 12px; color: var(--text-secondary); text-align: center;">Obrigado por sua colaboração ativa!</p>
    `;

    this.dom.audienceFinalAnalytics.style.display = 'block';
  }

  renderAudienceSlide() {
    const current = this.engine.currentSlideIndex + 1;
    const total = this.engine.totalSlides;
    const slide = this.engine.currentSlide;

    if (this.dom.slideIndicator) {
      this.dom.slideIndicator.textContent = `${current}/${total}`;
    }

    if (!this.dom.contentArea || !slide) return;

    const headline = (slide.presenter && slide.presenter.headline) || (slide.audience && (slide.audience.headline || slide.audience.summary)) || slide.headline || '';
    const summary = (slide.audience && slide.audience.summary) || '';
    const sections = (slide.audience && slide.audience.sections) || [];
    const presenterBullets = (slide.presenter && slide.presenter.bullets) || slide.bullets || [];

    let html = '';

    // Cabeçalho do Slide
    html += `
      <div class="card" style="margin-bottom: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <span class="badge badge-accent">Slide ${slide.id || current}</span>
          ${slide.tag ? `<span class="badge" style="font-size: 10px;">${slide.tag}</span>` : ''}
        </div>
        <h2 style="font-size: 19px; font-weight: 800; color: var(--text-primary); margin-bottom: 6px; line-height: 1.3;">
          ${slide.title || 'Slide ' + current}
        </h2>
        ${headline ? `
          <p style="font-size: 13.5px; color: var(--accent-primary); font-weight: 600; line-height: 1.4;">
            ${headline}
          </p>
        ` : ''}
        ${summary && summary !== headline ? `
          <p style="font-size: 12.5px; color: var(--text-secondary); margin-top: 8px; line-height: 1.5;">
            ${summary}
          </p>
        ` : ''}
      </div>
    `;

    // Seção Interativa: Enquete
    if (slide.interaction && slide.interaction.poll) {
      html += this.renderPollComponent(slide.interaction.poll);
    }

    // Seções de Detalhamento do Público (Textos, Listas, Tabelas)
    if (sections.length > 0) {
      sections.forEach(sec => {
        let contentHtml = '';
        if (sec.type === 'text') {
          contentHtml = `<p style="font-size: 13.5px; color: var(--text-primary); line-height: 1.5;">${sec.content}</p>`;
        } else if (sec.type === 'list' && Array.isArray(sec.items)) {
          contentHtml = `
            <ul style="list-style: none; display: flex; flex-direction: column; gap: 8px; font-size: 13px; color: var(--text-primary);">
              ${sec.items.map(item => `
                <li style="display: flex; align-items: flex-start; gap: 8px; line-height: 1.4;">
                  <span style="color: var(--accent-primary); font-size: 14px;">▹</span>
                  <span>${item}</span>
                </li>
              `).join('')}
            </ul>
          `;
        } else if (sec.type === 'table' && sec.headers && sec.rows) {
          const ths = sec.headers.map(h => `<th style="padding: 6px 10px; border-bottom: 1px solid var(--border-subtle); color: var(--accent-primary); font-size: 11px; text-align: left;">${h}</th>`).join('');
          const trs = sec.rows.map(row => `
            <tr>
              ${row.map(cell => `<td style="padding: 6px 10px; border-bottom: 1px solid var(--border-subtle); font-size: 12px; color: var(--text-primary);">${cell}</td>`).join('')}
            </tr>
          `).join('');
          contentHtml = `
            <div style="overflow-x: auto;">
              <table style="width: 100%; border-collapse: collapse;">
                <thead><tr>${ths}</tr></thead>
                <tbody>${trs}</tbody>
              </table>
            </div>
          `;
        }

        html += `
          <div class="card" style="margin-bottom: 16px;">
            <h3 style="font-size: 12.5px; font-weight: 700; text-transform: uppercase; color: var(--text-secondary); margin-bottom: 10px;">
              ${sec.title}
            </h3>
            ${contentHtml}
          </div>
        `;
      });
    } else if (presenterBullets.length > 0) {
      // Fallback para os tópicos do apresentador
      html += `
        <div class="card" style="margin-bottom: 16px;">
          <h3 style="font-size: 12.5px; font-weight: 700; text-transform: uppercase; color: var(--text-secondary); margin-bottom: 10px;">
            Pontos Principais
          </h3>
          <ul style="list-style: none; display: flex; flex-direction: column; gap: 8px;">
            ${presenterBullets.map(b => `
              <li style="font-size: 13px; color: var(--text-primary); display: flex; align-items: flex-start; gap: 8px; line-height: 1.4;">
                <span style="color: var(--accent-primary); font-size: 14px;">▹</span>
                <span>${b}</span>
              </li>
            `).join('')}
          </ul>
        </div>
      `;
    }

    // Links de Referência / Download
    if (slide.resources && slide.resources.length > 0) {
      html += `
        <div class="card" style="margin-bottom: 16px;">
          <h3 style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: var(--text-secondary); margin-bottom: 10px;">
            Materiais Complementares
          </h3>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            ${slide.resources.map(r => `
              <a href="${r.url}" target="_blank" class="btn btn-sm" style="justify-content: space-between; font-size: 12px; padding: 8px 12px;">
                <span>📄 ${r.title}</span>
                <span style="color: var(--accent-primary);">Acessar ↗</span>
              </a>
            `).join('')}
          </div>
        </div>
      `;
    }

    this.dom.contentArea.innerHTML = html;
    this.bindPollOptionClicks(slide);
  }

  renderPollComponent(poll) {
    const userVote = this.interaction.getUserVote(this.sessionId, poll.id);
    const hasVoted = !!userVote;
    const isClosed = (this.pollState.pollStatus === 'closed');
    const results = this.interaction.computePollResults(this.sessionId, poll);

    let optionsHtml = '';

    poll.options.forEach(opt => {
      const isSelected = (userVote === opt.id);
      const optStats = results.options.find(o => o.id === opt.id) || { percentage: 0, votes: 0 };

      optionsHtml += `
        <button class="poll-option-btn ${isSelected ? 'selected' : ''}" data-poll-id="${poll.id}" data-option-id="${opt.id}" ${isClosed ? 'disabled' : ''}>
          <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; position: relative; z-index: 2;">
            <span style="font-weight: 600; font-size: 13.5px; color: ${isSelected ? '#ffffff' : 'var(--text-primary)'}; text-align: left;">
              ${opt.id}. ${opt.text}
            </span>
            ${(hasVoted || this.pollState.showResults) ? `
              <span style="font-family: var(--font-mono); font-size: 12px; font-weight: 700; color: var(--accent-primary); margin-left: 8px;">
                ${optStats.percentage}%
              </span>
            ` : ''}
          </div>
          ${(hasVoted || this.pollState.showResults) ? `
            <div class="poll-option-fill" style="width: ${optStats.percentage}%;"></div>
          ` : ''}
        </button>
      `;
    });

    let statusText = i18n.t('audience.poll_open_feedback');
    if (isClosed) statusText = i18n.t('audience.poll_closed_feedback');
    else if (hasVoted) statusText = i18n.t('audience.poll_voted_feedback', { opt: userVote });

    return `
      <div class="card" style="margin-bottom: 16px; border-color: var(--accent-primary); background: rgba(15,23,42,0.85);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <span class="badge ${isClosed ? '' : 'badge-live'}" style="font-size: 10px;">
            ${isClosed ? i18n.t('audience.poll_closed') : i18n.t('audience.poll_open')}
          </span>
          <span style="font-size: 11px; color: var(--text-muted); font-family: var(--font-mono);">${results.totalVotes} votos</span>
        </div>
        <h3 style="font-size: 15px; font-weight: 700; color: #ffffff; margin-bottom: 14px; line-height: 1.4;">
          ${poll.question}
        </h3>
        <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px;">
          ${optionsHtml}
        </div>
        <div style="font-size: 11.5px; color: var(--text-secondary); text-align: center;">
          ${statusText}
        </div>
      </div>
    `;
  }

  /**
   * Dispara feedback tátil sutil em dispositivos móveis compatíveis
   */
  _triggerHapticFeedback(pattern = [30]) {
    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator && typeof navigator.vibrate === 'function') {
        navigator.vibrate(pattern);
      }
    } catch (e) {}
  }

  bindPollOptionClicks(slide) {
    if (!slide.interaction || !slide.interaction.poll) return;

    const btns = this.dom.contentArea.querySelectorAll('.poll-option-btn');
    btns.forEach(btn => {
      btn.addEventListener('click', async () => {
        const pollId = btn.dataset.pollId;
        const optId = btn.dataset.optionId;

        // Se bloqueado, impede
        const currentUser = this.auth.getCurrentUser();
        if (currentUser && this.moderation.isUserBlocked(this.sessionId, currentUser.uid)) {
          alert('Você está temporariamente bloqueado pela moderação.');
          return;
        }

        // Se a enquete exige autenticação e o usuário for anônimo
        if (slide.interaction.poll.requiresAuth && !this.auth.isAuthenticated()) {
          this.pendingAction = { type: 'vote', pollId, optId };
          this.dom.authModal.classList.add('active');
          return;
        }

        try {
          await this.interaction.castVote(this.sessionId, pollId, optId);
          this._triggerHapticFeedback([35]);
          this.renderAudienceSlide();
        } catch (err) {
          alert(err.message);
        }
      });
    });
  }

  showSyncToast() {
    if (!this.dom.syncToast) return;
    this.dom.syncToast.innerHTML = `
      <span>O apresentador está no slide <strong>#${this.presenterSlideIndex + 1}</strong>.</span>
      <button class="btn btn-sm btn-primary" id="btn-toast-resync" style="padding: 3px 8px; font-size: 11px;">
        Sincronizar
      </button>
    `;
    this.dom.syncToast.style.display = 'flex';

    document.getElementById('btn-toast-resync').addEventListener('click', () => {
      this.resyncToLive();
    });
  }

  hideSyncToast() {
    if (this.dom.syncToast) {
      this.dom.syncToast.style.display = 'none';
    }
  }

  resyncToLive() {
    this.isLiveSync = true;
    if (this.dom.btnSync) this.dom.btnSync.classList.add('active'); // NB08: guard null
    this.engine.goToSlide(this.presenterSlideIndex);
    this.hideSyncToast();
    this.renderAudienceSlide();
  }

  openQuestionModal() {
    const currentUser = this.auth.getCurrentUser();
    if (currentUser && this.moderation.isUserBlocked(this.sessionId, currentUser.uid)) {
      alert('Você está temporariamente bloqueado pela moderação.');
      return;
    }
    this.renderMyQuestionsList();
    this.dom.questionModal.classList.add('active');
    this.dom.questionInput.focus();
  }

  closeQuestionModal() {
    this.dom.questionModal.classList.remove('active');
    this.dom.questionInput.value = '';
    this.dom.questionCharCount.textContent = '0 / 300';
    this.dom.questionFeedback.style.display = 'none';
  }

  async submitQuestion() {
    const text = this.dom.questionInput.value.trim();
    if (!text) return;

    const currentUser = this.auth.getCurrentUser();
    if (currentUser && this.moderation.isUserBlocked(this.sessionId, currentUser.uid)) {
      alert('Você está temporariamente bloqueado pela moderação.');
      return;
    }

    try {
      this.dom.btnSubmitQuestion.disabled = true;
      this.dom.btnSubmitQuestion.textContent = 'Enviando...';

      await this.moderation.submitQuestion(this.sessionId, text);
      this._triggerHapticFeedback([40]);

      this.dom.questionInput.value = '';
      this.dom.questionCharCount.textContent = '0 / 300';
      this.dom.questionFeedback.textContent = '✓ Pergunta enviada com sucesso! Ela foi direcionada para a moderação.';
      this.dom.questionFeedback.style.display = 'block';
      this.dom.questionFeedback.style.background = 'rgba(16, 185, 129, 0.2)';
      this.dom.questionFeedback.style.color = '#6ee7b7';

      this.renderMyQuestionsList();
    } catch (e) {
      this.dom.questionFeedback.textContent = 'Erro ao enviar pergunta: ' + e.message;
      this.dom.questionFeedback.style.display = 'block';
      this.dom.questionFeedback.style.background = 'rgba(239, 68, 68, 0.2)';
      this.dom.questionFeedback.style.color = '#fca5a5';
    } finally {
      this.dom.btnSubmitQuestion.disabled = false;
      this.dom.btnSubmitQuestion.textContent = i18n.t('audience.btn_send_question');
    }
  }

  renderMyQuestionsList() {
    const list = document.getElementById('my-questions-list');
    if (!list) return;

    const myQuestions = this.moderation.getMyQuestions(this.sessionId);
    if (myQuestions.length === 0) {
      list.innerHTML = `<div style="color: var(--text-muted); font-size: 11px; text-align: center; padding: 8px;">Nenhuma pergunta enviada ainda.</div>`;
      return;
    }

    list.innerHTML = myQuestions.map(q => {
      let badge = '<span class="badge" style="font-size: 9px; padding: 1px 5px;">⏳ Moderação</span>';
      if (q.answered) {
        badge = '<span class="badge" style="background: rgba(16,185,129,0.2); color: #6ee7b7; font-size: 9px; padding: 1px 5px;">✓ Respondida</span>';
      } else if (q.status === 'featured') {
        badge = '<span class="badge badge-accent" style="font-size: 9px; padding: 1px 5px;">⭐ No Telão</span>';
      } else if (q.status === 'approved') {
        badge = '<span class="badge" style="background: rgba(56,189,248,0.2); color: #7dd3fc; font-size: 9px; padding: 1px 5px;">💬 Aprovada</span>';
      } else if (q.status === 'rejected') {
        badge = '<span class="badge" style="background: rgba(239,68,68,0.2); color: #fca5a5; font-size: 9px; padding: 1px 5px;">✕ Rejeitada</span>';
      }

      return `
        <div style="background: rgba(15,23,42,0.6); padding: 8px 10px; border-radius: 6px; border: 1px solid var(--border-subtle);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px;">
            ${badge}
            <span style="font-size: 9.5px; color: var(--text-muted);">${new Date(q.timestamp).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}</span>
          </div>
          <div style="font-size: 12px; color: #ffffff; line-height: 1.3;">${q.text}</div>
        </div>
      `;
    }).join('');
  }

  updateMyQuestionsStatus() {
    this.renderMyQuestionsList();
  }

  sendReaction(emoji) {
    const currentUser = this.auth.getCurrentUser();
    if (currentUser && this.moderation.isUserBlocked(this.sessionId, currentUser.uid)) {
      return;
    }
    this.realtime.sendReaction(this.sessionId, emoji);
  }

  bindEvents() {
    // Alternância de Idioma e Tema
    if (this.dom.btnAudienceLang) {
      this.dom.btnAudienceLang.addEventListener('click', () => {
        i18n.toggleLanguage();
        this.updateLanguageButton();
        this.renderAudienceSlide();
      });
    }

    if (this.dom.btnAudienceTheme) {
      this.dom.btnAudienceTheme.addEventListener('click', () => {
        theme.cycleTheme();
        this.updateThemeButton();
      });
    }

    // Navegação Inferior
    if (this.dom.navPrev) {
      this.dom.navPrev.addEventListener('click', () => {
        this.isLiveSync = false;
        if (this.dom.btnSync) this.dom.btnSync.classList.remove('active'); // guard null
        this.engine.prevSlide();
        this.renderAudienceSlide();
        if (this.engine.currentSlideIndex !== this.presenterSlideIndex) {
          this.showSyncToast();
        } else {
          this.hideSyncToast();
        }
      });
    }

    if (this.dom.navNext) {
      this.dom.navNext.addEventListener('click', () => {
        this.isLiveSync = false;
        if (this.dom.btnSync) this.dom.btnSync.classList.remove('active'); // guard null
        this.engine.nextSlide();
        this.renderAudienceSlide();
        if (this.engine.currentSlideIndex !== this.presenterSlideIndex) {
          this.showSyncToast();
        } else {
          this.hideSyncToast();
        }
      });
    }

    if (this.dom.btnSync) {
      this.dom.btnSync.addEventListener('click', () => {
        this.resyncToLive();
      });
    }

    if (this.dom.btnAsk) {
      this.dom.btnAsk.addEventListener('click', () => {
        this.openQuestionModal();
      });
    }

    // Reações Flutuantes
    document.querySelectorAll('.btn-reaction').forEach(btn => {
      btn.addEventListener('click', () => {
        const emoji = btn.dataset.emoji;
        this.sendReaction(emoji);
        btn.classList.add('animate-scale-up');
        setTimeout(() => btn.classList.remove('animate-scale-up'), 200);
      });
    });

    // Question Modal
    if (this.dom.btnCloseQuestionModal) {
      this.dom.btnCloseQuestionModal.addEventListener('click', () => this.closeQuestionModal());
    }
    if (this.dom.questionInput) {
      this.dom.questionInput.addEventListener('input', () => {
        const len = this.dom.questionInput.value.length;
        this.dom.questionCharCount.textContent = `${len} / 300`;
      });
    }
    if (this.dom.btnSubmitQuestion) {
      this.dom.btnSubmitQuestion.addEventListener('click', () => this.submitQuestion());
    }

    // Auth & Profile Modals
    if (this.dom.authStatusBtn) {
      this.dom.authStatusBtn.addEventListener('click', () => {
        if (this.auth.isAuthenticated()) {
          const user = this.auth.getCurrentUser();
          this.dom.profileAlias.textContent = user.displayName;
          this.dom.profileUid.textContent = `UID: ${user.uid}`;
          this.dom.profileModal.classList.add('active');
        } else {
          this.dom.authModal.classList.add('active');
        }
      });
    }

    if (this.dom.btnCloseAuthModal) {
      this.dom.btnCloseAuthModal.addEventListener('click', () => {
        this.dom.authModal.classList.remove('active');
      });
    }

    if (this.dom.btnCloseProfileModal) {
      this.dom.btnCloseProfileModal.addEventListener('click', () => {
        this.dom.profileModal.classList.remove('active');
      });
    }

    const btnSaveQuickName = document.getElementById('btn-save-quick-name');
    const inputQuickName = document.getElementById('input-quick-name');
    if (btnSaveQuickName && inputQuickName) {
      btnSaveQuickName.addEventListener('click', () => {
        const val = inputQuickName.value.trim();
        if (!val) {
          alert('Por favor, digite seu nome.');
          return;
        }
        this.auth.signInWithCustomName(val);
        this.dom.authModal.classList.remove('active');
        this.updateAuthStatusUI();
        this.renderAudienceSlide();

        // NC06: reiniciar presença com o novo alias identificado
        const user = this.auth.getCurrentUser();
        if (user) {
          this.realtime.startPresence(this.sessionId, false, user.uid, user.displayName, user.isAuthenticated);
          this._executePendingAction();
        }
      });
      inputQuickName.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          btnSaveQuickName.click();
        }
      });
    }

    if (this.dom.btnGoogleLogin) {
      this.dom.btnGoogleLogin.addEventListener('click', async () => {
        try {
          const user = await this.auth.signInWithGoogle();
          // NC02: só fecha o modal se a autenticação retornou nome válido.
          // No fallback local (displayName null), auth:request-name mantém o modal aberto e foca no campo.
          if (user && user.displayName) {
            this.dom.authModal.classList.remove('active');
            this.updateAuthStatusUI();
            this.renderAudienceSlide();
            this.realtime.startPresence(this.sessionId, false, user.uid, user.displayName, user.isAuthenticated);
            this._executePendingAction();
          }
        } catch (e) {
          alert('Identificação concluída: ' + (this.auth.user ? this.auth.user.displayName : ''));
        }
      });
    }

    if (this.dom.btnLocalLogin) {
      this.dom.btnLocalLogin.addEventListener('click', async () => {
        const u = this.dom.inputLocalUsername.value;
        const p = this.dom.inputLocalPassword.value;
        try {
          const user = await this.auth.signInWithLocalPassword(u, p);
          if (user) {
            this.dom.authModal.classList.remove('active');
            if (this.dom.localLoginError) this.dom.localLoginError.style.display = 'none';
            this.updateAuthStatusUI();
            this.renderAudienceSlide();
            this.realtime.startPresence(this.sessionId, false, user.uid, user.displayName, user.isAuthenticated);
            this._executePendingAction();
          }
        } catch (e) {
          if (this.dom.localLoginError) {
            this.dom.localLoginError.textContent = `✕ ${e.message || 'Usuário ou senha incorretos.'}`;
            this.dom.localLoginError.style.display = 'block';
          }
        }
      });
    }

    if (this.dom.btnLogout) {
      this.dom.btnLogout.addEventListener('click', async () => {
        // NE03: capturar uid antes do logout para enviar evento de saída ao servidor
        const leavingUser = this.auth.getCurrentUser();
        if (leavingUser && leavingUser.uid) {
          this.realtime.sendLocalServerEvent('PRESENCE_LEAVE', this.sessionId, {
            uid: leavingUser.uid
          });
        }
        await this.auth.signOut();
        this.dom.profileModal.classList.remove('active');
        this.updateAuthStatusUI();
        this.renderAudienceSlide();
        this.realtime.stopPresence(); // NF01: após logout parar presença
      });
    }

    // Session PIN Modal
    if (this.dom.btnSubmitSessionPin) {
      this.dom.btnSubmitSessionPin.addEventListener('click', () => this.unlockWithPIN());
    }

    // NC01: ouvir evento do AuthEngine para abrir modal e focar no campo de nome rápido
    window.addEventListener('auth:request-name', () => {
      if (this.dom.authModal) {
        this.dom.authModal.classList.add('active');
        const inputQuickName = document.getElementById('input-quick-name');
        if (inputQuickName) {
          setTimeout(() => {
            inputQuickName.focus();
            inputQuickName.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 100);
        }
      }
    });
  }

  async _executePendingAction() {
    if (!this.pendingAction) return;
    const action = this.pendingAction;
    this.pendingAction = null;
    if (action.type === 'vote' && action.pollId && action.optId) {
      try {
        await this.interaction.castVote(this.sessionId, action.pollId, action.optId);
        this._triggerHapticFeedback([35]);
        this.renderAudienceSlide();
      } catch (err) {
        console.warn('[AudienceApp] Erro ao executar voto pendente:', err);
      }
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.audienceApp = new AudienceApp();
});
