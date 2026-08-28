/**
 * Audience Mobile Application Controller
 * Coordena sincronização, presença, enquetes e envio de perguntas à moderação.
 */

import { PresentationEngine } from '../core/presentation-engine.js';
import { RealtimeEngine } from '../core/realtime-engine.js';
import { AuthEngine } from '../core/auth-engine.js';
import { InteractionEngine } from '../core/interaction-engine.js';
import { ModerationEngine } from '../core/moderation-engine.js';

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

      // Final Analytics
      audienceFinalAnalytics: document.getElementById('audience-final-analytics'),
      audienceAnalyticsContent: document.getElementById('audience-analytics-content')
    };

    this.init();
  }

  async init() {
    this.bindEvents();
    this.setupAuthObserver();

    if (this.dom.sessionBadge) {
      this.dom.sessionBadge.textContent = this.sessionId;
    }

    try {
      await this.engine.loadPresentation(this.presentationId);
      this.dom.headerTitle.textContent = this.engine.manifest.title || 'Apresentação';
      
      this.checkPresentationAccess();

      this.realtime.startPresence(this.sessionId, false, this.auth.user);

      this.realtime.subscribeToSession(this.sessionId, (sessionState) => {
        this.handleRemoteSessionUpdate(sessionState);
      });

      // Escuta eventos em tempo real
      if (this.realtime.channel) {
        this.realtime.channel.addEventListener('message', (e) => {
          if (!e.data || e.data.sessionId !== this.sessionId) return;
          if ((e.data.type === 'VOTE_CAST' || e.data.type === 'VOTE_RESET') && this.pollState.showResults) {
            this.updateView();
          }
        });
      }

      window.addEventListener('storage', (e) => {
        if (e.key && e.key.startsWith(`session_votes_${this.sessionId}`) && this.pollState.showResults) {
          this.updateView();
        }
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

  setupAuthObserver() {
    this.auth.onAuthStateChanged((user) => {
      if (user) {
        this.dom.authUserLabel.innerHTML = `<span>👤</span> <span>${user.anonymousAlias || 'Participante'}</span>`;
        this.dom.authStatusBtn.style.borderColor = 'rgba(16, 185, 129, 0.4)';
        this.dom.authStatusBtn.style.background = 'rgba(16, 185, 129, 0.15)';
        this.dom.authStatusBtn.style.color = '#6ee7b7';

        if (this.dom.profileAlias) this.dom.profileAlias.textContent = user.anonymousAlias || 'Participante';
        if (this.dom.profileUid) this.dom.profileUid.textContent = `ID: ${user.uid.substring(0, 14)}...`;

        if (this.pendingAction) {
          const action = this.pendingAction;
          this.pendingAction = null;
          action();
        }
      } else {
        this.dom.authUserLabel.innerHTML = `<span>🔐</span> <span>Entrar</span>`;
        this.dom.authStatusBtn.style.borderColor = 'rgba(56, 189, 248, 0.3)';
        this.dom.authStatusBtn.style.background = 'rgba(56, 189, 248, 0.12)';
        this.dom.authStatusBtn.style.color = '#7dd3fc';
      }

      this.updateView();
    });
  }

  handleRemoteSessionUpdate(sessionState) {
    if (!sessionState) return;

    if (sessionState.pollStatus) {
      this.pollState.pollStatus = sessionState.pollStatus;
    }
    if (typeof sessionState.showResults === 'boolean') {
      this.pollState.showResults = sessionState.showResults;
    }

    // Exibe ou oculta pergunta destacada no smartphone
    if (sessionState.featuredQuestion && this.dom.audienceFeaturedBanner) {
      this.dom.audienceFeaturedText.textContent = sessionState.featuredQuestion.text;
      this.dom.audienceFeaturedAuthor.textContent = sessionState.featuredQuestion.authorAlias || 'Participante';
      this.dom.audienceFeaturedBanner.style.display = 'block';
    } else if (this.dom.audienceFeaturedBanner) {
      this.dom.audienceFeaturedBanner.style.display = 'none';
    }

    // Exibe Analytics Final se projetado pelo Moderador
    if (sessionState.showFinalAnalytics && this.dom.audienceFinalAnalytics) {
      this.renderAudienceFinalAnalytics();
      this.dom.audienceFinalAnalytics.style.display = 'block';
    } else if (this.dom.audienceFinalAnalytics) {
      this.dom.audienceFinalAnalytics.style.display = 'none';
    }

    // Tratamento de Sessão Encerrada
    if (sessionState.status === 'closed') {
      if (this.dom.sessionClosedNotice) this.dom.sessionClosedNotice.style.display = 'block';
      if (this.dom.btnAsk) {
        this.dom.btnAsk.disabled = true;
        this.dom.btnAsk.style.opacity = '0.4';
      }
    } else {
      if (this.dom.sessionClosedNotice) this.dom.sessionClosedNotice.style.display = 'none';
      if (this.dom.btnAsk) {
        this.dom.btnAsk.disabled = false;
        this.dom.btnAsk.style.opacity = '1';
      }
    }

    if (typeof sessionState.currentSlide === 'number') {
      this.presenterSlideIndex = sessionState.currentSlide;

      if (this.isLiveSync) {
        if (this.engine.currentSlideIndex !== this.presenterSlideIndex) {
          this.engine.goToSlide(this.presenterSlideIndex);
          this.updateView();
        } else {
          this.updateView();
        }
      } else {
        this.showSyncToast();
        this.updateView();
      }
    } else {
      this.updateView();
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
    const slide = this.engine.currentSlide;
    let pollRenderData = {
      pollStatus: this.pollState.pollStatus,
      showResults: this.pollState.showResults,
      userVoteOption: null,
      results: null
    };

    if (slide && slide.interaction && slide.interaction.poll) {
      const poll = slide.interaction.poll;
      pollRenderData.userVoteOption = this.interaction.getUserVoteOption(this.sessionId, poll.id);
      if (this.pollState.showResults) {
        pollRenderData.results = this.interaction.computePollResults(this.sessionId, poll);
      }
    }

    this.engine.renderAudienceSlide(this.dom.contentArea, pollRenderData);

    const current = this.engine.currentSlideIndex + 1;
    const total = this.engine.totalSlides;
    this.dom.slideIndicator.textContent = `${current}/${total}`;

    if (this.dom.navPrev) this.dom.navPrev.disabled = (this.engine.currentSlideIndex === 0);
    if (this.dom.navNext) this.dom.navNext.disabled = (this.engine.currentSlideIndex === total - 1);
  }

  openAuthModal(onSuccessAction = null) {
    this.pendingAction = onSuccessAction;
    if (this.dom.authModal) {
      this.dom.authModal.classList.add('active');
    }
  }

  closeAuthModal() {
    if (this.dom.authModal) {
      this.dom.authModal.classList.remove('active');
    }
  }

  openProfileModal() {
    if (this.dom.profileModal) {
      this.dom.profileModal.classList.add('active');
    }
  }

  closeProfileModal() {
    if (this.dom.profileModal) {
      this.dom.profileModal.classList.remove('active');
    }
  }

  openQuestionModal() {
    if (!this.auth.isAuthenticated) {
      this.openAuthModal(() => this.openQuestionModal());
      return;
    }
    if (this.dom.questionModal) {
      if (this.dom.questionFeedback) this.dom.questionFeedback.style.display = 'none';
      if (this.dom.questionInput) this.dom.questionInput.value = '';
      if (this.dom.questionCharCount) this.dom.questionCharCount.textContent = '0 / 300';
      this.renderMyQuestionsList();
      this.dom.questionModal.classList.add('active');
    }
  }

  closeQuestionModal() {
    if (this.dom.questionModal) {
      this.dom.questionModal.classList.remove('active');
    }
  }

  renderMyQuestionsList() {
    const listEl = document.getElementById('my-questions-list');
    if (!listEl) return;

    const myQuestions = this.moderation.getMyQuestions(this.sessionId);
    if (myQuestions.length === 0) {
      listEl.innerHTML = `
        <div style="color: var(--text-muted); font-size: 11px; text-align: center; padding: 8px;">
          Você ainda não enviou perguntas nesta apresentação.
        </div>
      `;
      return;
    }

    listEl.innerHTML = myQuestions.map(q => {
      let statusBadge = '';
      if (q.answered) {
        statusBadge = `<span class="badge" style="background: rgba(16,185,129,0.2); color: #6ee7b7; font-size: 9.5px; padding: 1px 6px;">✓ Respondida pelo Palestrante</span>`;
      } else if (q.status === 'featured') {
        statusBadge = `<span class="badge badge-accent" style="font-size: 9.5px; padding: 1px 6px;">⭐ Em Destaque no Telão</span>`;
      } else if (q.status === 'approved') {
        statusBadge = `<span class="badge" style="background: rgba(56,189,248,0.2); color: #7dd3fc; font-size: 9.5px; padding: 1px 6px;">💬 No Mural do Telão</span>`;
      } else if (q.status === 'pending') {
        statusBadge = `<span class="badge" style="background: rgba(148,163,184,0.15); color: #94a3b8; font-size: 9.5px; padding: 1px 6px;">⏳ Em Moderação</span>`;
      } else if (q.status === 'rejected') {
        statusBadge = `<span class="badge" style="background: rgba(239,68,68,0.15); color: #fca5a5; font-size: 9.5px; padding: 1px 6px;">✕ Não Aprovada</span>`;
      }

      return `
        <div style="background: rgba(15,23,42,0.6); border: 1px solid var(--border-subtle); border-radius: 6px; padding: 8px 10px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            ${statusBadge}
            <span style="font-size: 9px; color: var(--text-muted);">${new Date(q.timestamp).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}</span>
          </div>
          <div style="font-size: 12px; color: #ffffff; line-height: 1.3;">${q.text}</div>
        </div>
      `;
    }).join('');
  }

  checkPresentationAccess() {
    const check = this.auth.isAuthorizedForPresentation(this.engine.manifest);
    if (!check.authorized) {
      if (check.reason === 'PIN_REQUIRED') {
        if (this.dom.sessionPinHint) this.dom.sessionPinHint.textContent = check.hint;
        if (this.dom.sessionPinModal) this.dom.sessionPinModal.classList.add('active');
      } else if (check.reason === 'AUTH_REQUIRED' || check.reason === 'DOMAIN_FORBIDDEN') {
        if (this.dom.authModal) this.dom.authModal.classList.add('active');
        if (check.message) alert(check.message);
      }
    } else {
      if (this.dom.sessionPinModal) this.dom.sessionPinModal.classList.remove('active');
    }
  }

  async handleLocalLogin() {
    const u = this.dom.inputLocalUsername ? this.dom.inputLocalUsername.value : '';
    const p = this.dom.inputLocalPassword ? this.dom.inputLocalPassword.value : '';

    try {
      if (this.dom.btnLocalLogin) {
        this.dom.btnLocalLogin.disabled = true;
        this.dom.btnLocalLogin.textContent = 'Autenticando...';
      }
      await this.auth.signInWithLocalCredentials(u, p);
      if (this.dom.localLoginError) this.dom.localLoginError.style.display = 'none';
      this.closeAuthModal();
      this.checkPresentationAccess();
    } catch (err) {
      if (this.dom.localLoginError) {
        this.dom.localLoginError.style.display = 'block';
        this.dom.localLoginError.textContent = `✕ ${err.message}`;
      }
    } finally {
      if (this.dom.btnLocalLogin) {
        this.dom.btnLocalLogin.disabled = false;
        this.dom.btnLocalLogin.textContent = '👤 Entrar com Conta Local';
      }
    }
  }

  handleSessionPinSubmit() {
    const entered = this.dom.inputSessionPin ? this.dom.inputSessionPin.value : '';
    const check = this.auth.isAuthorizedForPresentation(this.engine.manifest, entered);
    if (check.authorized) {
      if (this.dom.sessionPinModal) this.dom.sessionPinModal.classList.remove('active');
      if (this.dom.sessionPinError) this.dom.sessionPinError.style.display = 'none';
      this.updateView();
    } else {
      if (this.dom.sessionPinError) this.dom.sessionPinError.style.display = 'block';
    }
  }

  bindEvents() {
    if (this.dom.authStatusBtn) {
      this.dom.authStatusBtn.addEventListener('click', () => {
        if (this.auth.isAuthenticated) {
          this.openProfileModal();
        } else {
          this.openAuthModal();
        }
      });
    }

    if (this.dom.btnCloseAuthModal) {
      this.dom.btnCloseAuthModal.addEventListener('click', () => this.closeAuthModal());
    }

    if (this.dom.btnCloseProfileModal) {
      this.dom.btnCloseProfileModal.addEventListener('click', () => this.closeProfileModal());
    }

    // Login Offline / Local
    if (this.dom.btnLocalLogin) {
      this.dom.btnLocalLogin.addEventListener('click', () => this.handleLocalLogin());
    }
    if (this.dom.inputLocalPassword) {
      this.dom.inputLocalPassword.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this.handleLocalLogin();
      });
    }

    // PIN de Apresentação
    if (this.dom.btnSubmitSessionPin) {
      this.dom.btnSubmitSessionPin.addEventListener('click', () => this.handleSessionPinSubmit());
    }
    if (this.dom.inputSessionPin) {
      this.dom.inputSessionPin.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this.handleSessionPinSubmit();
      });
    }

    if (this.dom.btnGoogleLogin) {
      this.dom.btnGoogleLogin.addEventListener('click', async () => {
        try {
          this.dom.btnGoogleLogin.disabled = true;
          this.dom.btnGoogleLogin.textContent = 'Autenticando...';
          await this.auth.signInWithGoogle();
          this.closeAuthModal();
          this.checkPresentationAccess();
        } catch (err) {
          alert('Erro ao autenticar com Google: ' + err.message);
        } finally {
          this.dom.btnGoogleLogin.disabled = false;
          this.dom.btnGoogleLogin.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 18 18">
              <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.616z"/>
              <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
              <path fill="#FBBC05" d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.039l3.007-2.332z"/>
              <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z"/>
            </svg>
            <span>Continuar com Google (Online)</span>
          `;
        }
      });
    }

    if (this.dom.btnLogout) {
      this.dom.btnLogout.addEventListener('click', async () => {
        await this.auth.signOut();
        this.closeProfileModal();
        this.checkPresentationAccess();
      });
    }

    // Question Modal
    if (this.dom.btnAsk) {
      this.dom.btnAsk.addEventListener('click', () => this.openQuestionModal());
    }

    if (this.dom.btnCloseQuestionModal) {
      this.dom.btnCloseQuestionModal.addEventListener('click', () => this.closeQuestionModal());
    }

    if (this.dom.questionInput) {
      this.dom.questionInput.addEventListener('input', () => {
        const len = this.dom.questionInput.value.length;
        if (this.dom.questionCharCount) this.dom.questionCharCount.textContent = `${len} / 300`;
      });
    }

    if (this.dom.btnSubmitQuestion) {
      this.dom.btnSubmitQuestion.addEventListener('click', async () => {
        const text = this.dom.questionInput.value;
        try {
          this.dom.btnSubmitQuestion.disabled = true;
          this.dom.btnSubmitQuestion.textContent = 'Enviando...';

          await this.moderation.submitQuestion(this.sessionId, text);

          if (this.dom.questionFeedback) {
            this.dom.questionFeedback.style.display = 'block';
            this.dom.questionFeedback.style.background = 'rgba(16, 185, 129, 0.15)';
            this.dom.questionFeedback.style.border = '1px solid rgba(16, 185, 129, 0.4)';
            this.dom.questionFeedback.style.color = '#6ee7b7';
            this.dom.questionFeedback.innerHTML = '✓ Pergunta enviada à fila de moderação do apresentador!';
          }

          setTimeout(() => {
            this.closeQuestionModal();
          }, 1500);

        } catch (err) {
          if (this.dom.questionFeedback) {
            this.dom.questionFeedback.style.display = 'block';
            this.dom.questionFeedback.style.background = 'rgba(239, 68, 68, 0.15)';
            this.dom.questionFeedback.style.border = '1px solid rgba(239, 68, 68, 0.4)';
            this.dom.questionFeedback.style.color = '#fca5a5';
            this.dom.questionFeedback.textContent = err.message;
          }
        } finally {
          this.dom.btnSubmitQuestion.disabled = false;
          this.dom.btnSubmitQuestion.textContent = 'Enviar Pergunta';
        }
      });
    }

    window.addEventListener('click', (e) => {
      if (e.target === this.dom.authModal) this.closeAuthModal();
      if (e.target === this.dom.profileModal) this.closeProfileModal();
      if (e.target === this.dom.questionModal) this.closeQuestionModal();
    });

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

    if (this.dom.btnSync) {
      this.dom.btnSync.addEventListener('click', () => {
        this.syncToLive();
      });
    }

    // Interação com enquetes
    this.dom.contentArea.addEventListener('click', async (e) => {
      const pollBtn = e.target.closest('.poll-option-btn');
      if (pollBtn) {
        const pollId = pollBtn.dataset.pollId;
        const optionId = pollBtn.dataset.optionId;

        if (!this.auth.isAuthenticated) {
          this.openAuthModal(async () => {
            await this.processVote(pollId, optionId);
          });
          return;
        }

        await this.processVote(pollId, optionId);
      }
    });

    // Reações ao Vivo da Audiência
    document.querySelectorAll('.btn-reaction').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const emoji = btn.dataset.emoji || '👏';
        
        // Efeito de feedback tátil e animação local
        btn.style.transform = 'scale(1.35)';
        setTimeout(() => { btn.style.transform = 'scale(1)'; }, 180);

        this.realtime.sendReaction(this.sessionId, emoji);
      });
    });

    this.engine.on('onSlideChange', () => {
      this.updateView();
    });
  }

  renderAudienceFinalAnalytics() {
    if (!this.dom.audienceAnalyticsContent) return;

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

    const questions = this.moderation.getQuestions(this.sessionId);
    const approvedQ = questions.filter(q => q.status === 'approved' || q.status === 'featured');

    const pollsHtml = polls.map(p => `
      <div style="margin-bottom: 12px; background: rgba(15,23,42,0.6); padding: 10px; border-radius: 6px;">
        <div style="font-size: 12px; font-weight: 700; color: #ffffff; margin-bottom: 6px;">${p.poll.question}</div>
        ${p.res.options.map(opt => `
          <div style="font-size: 11px; margin-bottom: 4px;">
            <div style="display: flex; justify-content: space-between; color: #94a3b8;">
              <span>${opt.id}. ${opt.text}</span>
              <strong style="color: var(--accent-primary);">${opt.percentage}% (${opt.votes})</strong>
            </div>
            <div class="poll-progress-track" style="height: 4px; margin-top: 2px;">
              <div class="poll-progress-fill" style="width: ${opt.percentage}%;"></div>
            </div>
          </div>
        `).join('')}
      </div>
    `).join('');

    this.dom.audienceAnalyticsContent.innerHTML = `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px;">
        <div class="stat-box" style="padding: 8px;">
          <span style="font-size: 11px; color: var(--text-muted);">Perguntas Aprovadas</span>
          <span class="stat-value" style="font-size: 16px;">${approvedQ.length}</span>
        </div>
        <div class="stat-box" style="padding: 8px;">
          <span style="font-size: 11px; color: var(--text-muted);">Enquetes Realizadas</span>
          <span class="stat-value" style="font-size: 16px;">${polls.length}</span>
        </div>
      </div>
      <div>${pollsHtml}</div>
    `;
  }

  async processVote(pollId, optionId) {
    try {
      await this.interaction.submitVote(this.sessionId, pollId, optionId);
      this.updateView();
    } catch (err) {
      alert(err.message);
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.audienceApp = new AudienceApp();
});
