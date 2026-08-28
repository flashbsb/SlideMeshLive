/**
 * Presenter Application Controller
 * Coordena eventos de tela, atalhos, sincronização, controle de enquetes e moderação de perguntas.
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

    this.activeModerationTab = 'pending';

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
      btnToggleResults: document.getElementById('btn-toggle-results'),

      // Moderation Drawer & Featured Question
      btnToggleModeration: document.getElementById('btn-toggle-moderation'),
      badgeQuestionCount: document.getElementById('badge-question-count'),
      moderationDrawer: document.getElementById('moderation-drawer'),
      btnCloseModeration: document.getElementById('btn-close-moderation'),
      moderationList: document.getElementById('moderation-list'),
      featuredBanner: document.getElementById('featured-question-banner'),
      featuredText: document.getElementById('featured-question-text'),
      featuredAuthor: document.getElementById('featured-author'),
      btnDismissFeatured: document.getElementById('btn-dismiss-featured'),

      // Session & Connectivity Controls
      btnEndSession: document.getElementById('btn-end-session'),
      badgeLiveStatus: document.getElementById('badge-live-status'),
      btnExportReport: document.getElementById('btn-export-report')
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
      this.updateModerationList();

      if (this.dom.connectionStatus) {
        this.dom.connectionStatus.textContent = this.realtime.isFirebaseReady ? 'Firebase Conectado' : 'Sincronização Ativa';
      }

      // Escuta eventos de votação e novas perguntas
      if (this.realtime.channel) {
        this.realtime.channel.addEventListener('message', (e) => {
          if (!e.data || e.data.sessionId !== this.sessionId) return;
          if (e.data.type === 'VOTE_CAST') {
            this.updatePollDisplay();
          } else if (e.data.type === 'NEW_QUESTION' || e.data.type === 'QUESTION_STATUS_CHANGE') {
            this.updateModerationList();
          }
        });
      }

      // Storage event listener para redundância local
      window.addEventListener('storage', (e) => {
        if (e.key && e.key.startsWith(`session_votes_${this.sessionId}`)) {
          this.updatePollDisplay();
        } else if (e.key && e.key.startsWith(`session_questions_${this.sessionId}`)) {
          this.updateModerationList();
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
        pollStatus: hasPoll ? 'open' : 'draft',
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
        resultsContainer.innerHTML = poll.options.map(opt => `
          <div style="padding: 10px 14px; background: rgba(255,255,255,0.03); border-radius: 6px; margin-bottom: 8px; font-size: 14px; display: flex; align-items: center;">
            <span class="poll-letter-badge" style="width: 24px; height: 24px; font-size: 12px; margin-right: 10px;">${opt.id}</span>
            <span>${opt.text}</span>
          </div>
        `).join('');
      }
    }
  }

  updateModerationList() {
    const allQuestions = this.moderation.getQuestions(this.sessionId);
    const pendingQuestions = allQuestions.filter(q => q.status === 'pending');
    
    // Atualiza badge de contagem
    if (this.dom.badgeQuestionCount) {
      this.dom.badgeQuestionCount.textContent = pendingQuestions.length;
      this.dom.badgeQuestionCount.style.display = pendingQuestions.length > 0 ? 'inline-block' : 'none';
    }

    // Verifica se há pergunta destacada
    const featured = allQuestions.find(q => q.status === 'featured');
    if (featured) {
      this.dom.featuredText.textContent = featured.text;
      this.dom.featuredAuthor.textContent = featured.authorAlias || 'Participante';
      this.dom.featuredBanner.style.display = 'flex';
    } else {
      this.dom.featuredBanner.style.display = 'none';
    }

    // Filtra pela aba ativa
    const filtered = allQuestions.filter(q => {
      if (this.activeModerationTab === 'pending') return q.status === 'pending';
      if (this.activeModerationTab === 'approved') return q.status === 'approved' || q.status === 'featured';
      if (this.activeModerationTab === 'rejected') return q.status === 'rejected';
      return true;
    });

    if (!this.dom.moderationList) return;

    if (filtered.length === 0) {
      this.dom.moderationList.innerHTML = `
        <div style="text-align: center; color: var(--text-muted); padding: 40px 10px; font-size: 13px;">
          Nenhuma pergunta ${this.activeModerationTab === 'pending' ? 'pendente' : 'nesta categoria'}.
        </div>
      `;
      return;
    }

    this.dom.moderationList.innerHTML = filtered.map(q => {
      const isFeatured = q.status === 'featured';
      let actionsHtml = '';

      if (q.status === 'pending') {
        actionsHtml = `
          <button class="btn btn-sm btn-primary btn-mod-action" data-action="feature" data-qid="${q.id}" style="padding: 4px 8px; font-size: 11px;">
            ⭐ Destacar
          </button>
          <button class="btn btn-sm btn-mod-action" data-action="approve" data-qid="${q.id}" style="padding: 4px 8px; font-size: 11px; color: #6ee7b7; border-color: rgba(16,185,129,0.3);">
            ✓ Aprovar
          </button>
          <button class="btn btn-sm btn-mod-action" data-action="reject" data-qid="${q.id}" style="padding: 4px 8px; font-size: 11px; color: #fca5a5; border-color: rgba(239,68,68,0.3);">
            ✕
          </button>
        `;
      } else if (q.status === 'approved' || q.status === 'featured') {
        actionsHtml = `
          <button class="btn btn-sm ${isFeatured ? 'btn-primary' : ''} btn-mod-action" data-action="${isFeatured ? 'unfeature' : 'feature'}" data-qid="${q.id}" style="padding: 4px 8px; font-size: 11px;">
            ${isFeatured ? '⭐ Destacada' : '⭐ Destacar'}
          </button>
          <button class="btn btn-sm btn-mod-action" data-action="reject" data-qid="${q.id}" style="padding: 4px 8px; font-size: 11px; color: #fca5a5;">
            Remover
          </button>
        `;
      } else if (q.status === 'rejected') {
        actionsHtml = `
          <button class="btn btn-sm btn-mod-action" data-action="approve" data-qid="${q.id}" style="padding: 4px 8px; font-size: 11px;">
            Restaurar
          </button>
        `;
      }

      return `
        <div class="question-card ${isFeatured ? 'featured' : ''}">
          <div class="question-author">
            <span>${q.authorAlias || 'Participante'}</span>
            <span style="font-size: 10px; color: var(--text-muted); font-weight: normal;">
              ${new Date(q.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <div class="question-text">${q.text}</div>
          <div class="question-actions">
            ${actionsHtml}
          </div>
        </div>
      `;
    }).join('');
  }

  bindEvents() {
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

    // Enquetes
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

    // Moderação Drawer
    if (this.dom.btnToggleModeration) {
      this.dom.btnToggleModeration.addEventListener('click', () => {
        this.dom.moderationDrawer.classList.toggle('active');
      });
    }

    if (this.dom.btnCloseModeration) {
      this.dom.btnCloseModeration.addEventListener('click', () => {
        this.dom.moderationDrawer.classList.remove('active');
      });
    }

    // Abas de moderação
    document.querySelectorAll('.moderation-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.moderation-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeModerationTab = btn.dataset.tab;
        this.updateModerationList();
      });
    });

    // Monitoramento de Rede e Contingência Offline
    window.addEventListener('online', () => {
      if (this.dom.connectionStatus) {
        this.dom.connectionStatus.textContent = this.realtime.isFirebaseReady ? 'Firebase Conectado' : 'Sincronização Ativa';
      }
      if (this.dom.statusDot) {
        this.dom.statusDot.className = 'status-dot-connected';
      }
    });

    window.addEventListener('offline', () => {
      if (this.dom.connectionStatus) {
        this.dom.connectionStatus.textContent = 'Modo Local / Offline';
      }
      if (this.dom.statusDot) {
        this.dom.statusDot.className = 'status-dot-live';
      }
    });

    // Encerramento Formal da Sessão
    if (this.dom.btnEndSession) {
      this.dom.btnEndSession.addEventListener('click', async () => {
        const confirmEnd = confirm('Deseja realmente encerrar esta sessão de apresentação? Os smartphones conectados serão finalizados.');
        if (confirmEnd) {
          await this.realtime.updateSessionState(this.sessionId, {
            status: 'closed',
            pollStatus: 'closed'
          });

          if (this.dom.badgeLiveStatus) {
            this.dom.badgeLiveStatus.className = 'badge';
            this.dom.badgeLiveStatus.style.background = 'rgba(239, 68, 68, 0.2)';
            this.dom.badgeLiveStatus.style.color = '#fca5a5';
            this.dom.badgeLiveStatus.textContent = '🔴 ENCERRADA';
          }
          if (this.dom.btnEndSession) {
            this.dom.btnEndSession.disabled = true;
            this.dom.btnEndSession.textContent = 'Sessão Fechada';
          }
          alert('Sessão encerrada com sucesso! Nenhuma nova interação será aceita.');
        }
      });
    }

    // Exportação de Relatório da Sessão
    if (this.dom.btnExportReport) {
      this.dom.btnExportReport.addEventListener('click', () => {
        this.exportSessionReport();
      });
    }

    // Ações de moderação nos cards
    if (this.dom.moderationList) {
      this.dom.moderationList.addEventListener('click', async (e) => {
        const actionBtn = e.target.closest('.btn-mod-action');
        if (actionBtn) {
          const action = actionBtn.dataset.action;
          const qid = actionBtn.dataset.qid;
          const uid = actionBtn.dataset.uid;

          if (action === 'approve') {
            await this.moderation.setQuestionStatus(this.sessionId, qid, 'approved');
          } else if (action === 'feature') {
            await this.moderation.setQuestionStatus(this.sessionId, qid, 'featured');
          } else if (action === 'unfeature') {
            await this.moderation.clearFeatured(this.sessionId);
          } else if (action === 'reject') {
            await this.moderation.setQuestionStatus(this.sessionId, qid, 'rejected');
          } else if (action === 'block' && uid) {
            const isBlocked = this.moderation.toggleBlockUser(this.sessionId, uid);
            alert(`Participante ${isBlocked ? 'bloqueado' : 'desbloqueado'} com sucesso.`);
          }
          this.updateModerationList();
        }
      });
    }

    if (this.dom.btnDismissFeatured) {
      this.dom.btnDismissFeatured.addEventListener('click', async () => {
        await this.moderation.clearFeatured(this.sessionId);
        this.updateModerationList();
      });
    }

    // Teclado
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

  exportSessionReport() {
    const questions = this.moderation.getQuestions(this.sessionId);
    
    // Coleta todas as enquetes e computa resultados de cada uma
    const pollsSummary = [];
    if (this.engine.slidesData && this.engine.slidesData.slides) {
      this.engine.slidesData.slides.forEach(s => {
        if (s.interaction && s.interaction.poll) {
          const res = this.interaction.computePollResults(this.sessionId, s.interaction.poll);
          pollsSummary.push({
            slideId: s.id,
            slideTitle: s.title,
            poll: s.interaction.poll,
            results: res
          });
        }
      });
    }

    const report = {
      presentationId: this.presentationId,
      presentationTitle: this.engine.manifest ? this.engine.manifest.title : '',
      sessionId: this.sessionId,
      exportedAt: new Date().toISOString(),
      sessionStatus: this.pollState.status || 'active',
      summary: {
        totalSlides: this.engine.totalSlides,
        totalQuestionsReceived: questions.length,
        totalPolls: pollsSummary.length
      },
      polls: pollsSummary,
      questions: questions
    };

    // Gera arquivo JSON para download
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio_sessao_${this.sessionId}_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
