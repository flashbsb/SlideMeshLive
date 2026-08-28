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
      questionFeedback: document.getElementById('question-feedback')
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
      
      this.realtime.startPresence(this.sessionId);

      this.realtime.subscribeToSession(this.sessionId, (sessionState) => {
        this.handleRemoteSessionUpdate(sessionState);
      });

      // Escuta eventos em tempo real
      if (this.realtime.channel) {
        this.realtime.channel.addEventListener('message', (e) => {
          if (!e.data || e.data.sessionId !== this.sessionId) return;
          if (e.data.type === 'VOTE_CAST' && this.pollState.showResults) {
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
      this.dom.questionModal.classList.add('active');
    }
  }

  closeQuestionModal() {
    if (this.dom.questionModal) {
      this.dom.questionModal.classList.remove('active');
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

    if (this.dom.btnGoogleLogin) {
      this.dom.btnGoogleLogin.addEventListener('click', async () => {
        try {
          this.dom.btnGoogleLogin.disabled = true;
          this.dom.btnGoogleLogin.textContent = 'Autenticando...';
          await this.auth.signInWithGoogle();
          this.closeAuthModal();
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
            <span>Continuar com Google</span>
          `;
        }
      });
    }

    if (this.dom.btnLogout) {
      this.dom.btnLogout.addEventListener('click', async () => {
        await this.auth.signOut();
        this.closeProfileModal();
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

    this.engine.on('onSlideChange', () => {
      this.updateView();
    });
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
