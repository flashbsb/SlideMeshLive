/**
 * Admin & Moderator Application Controller
 * Coordena o console de moderação de perguntas, controle de enquetes e sessão para a equipe técnica.
 */

import { PresentationEngine } from '../core/presentation-engine.js';
import { QREngine } from '../core/qr-engine.js';
import { RealtimeEngine } from '../core/realtime-engine.js';
import { AuthEngine } from '../core/auth-engine.js';
import { InteractionEngine } from '../core/interaction-engine.js';
import { ModerationEngine } from '../core/moderation-engine.js';

class AdminApp {
  constructor() {
    this.engine = new PresentationEngine({ basePath: '../presentations' });
    this.realtime = new RealtimeEngine();
    this.auth = new AuthEngine();
    this.interaction = new InteractionEngine(this.realtime, this.auth);
    this.moderation = new ModerationEngine(this.realtime, this.auth);

    this.presentationId = PresentationEngine.getPresentationIdFromURL();
    this.sessionId = PresentationEngine.getSessionIdFromURL();
    this.activeTab = 'pending';

    // DOM Elements
    this.dom = {
      presTitle: document.getElementById('admin-pres-title'),
      sessionCode: document.getElementById('admin-session-code'),
      slideIndicator: document.getElementById('admin-slide-indicator'),
      currentSlideTitle: document.getElementById('admin-current-slide-title'),
      btnPrev: document.getElementById('admin-btn-prev'),
      btnNext: document.getElementById('admin-btn-next'),
      btnEndSession: document.getElementById('admin-btn-end-session'),
      qrBox: document.getElementById('admin-qr-box'),
      audienceLink: document.getElementById('admin-audience-link'),
      connectionStatus: document.getElementById('admin-connection-status'),
      statusDot: document.getElementById('admin-status-dot'),
      
      // Moderation
      pendingCount: document.getElementById('admin-pending-count'),
      moderationList: document.getElementById('admin-moderation-list'),
      
      // Polls & Export
      pollsContainer: document.getElementById('admin-polls-container'),
      btnExport: document.getElementById('admin-btn-export')
    };

    this.init();
  }

  async init() {
    this.bindEvents();
    this.setupQRCode();

    if (this.dom.sessionCode) {
      this.dom.sessionCode.textContent = `SESSÃO: ${this.sessionId}`;
    }

    try {
      await this.engine.loadPresentation(this.presentationId);
      this.dom.presTitle.textContent = this.engine.manifest.title || 'Apresentação';

      // Inscreve-se nas atualizações da sessão
      this.realtime.subscribeToSession(this.sessionId, (state) => {
        this.handleSessionUpdate(state);
      });

      // Escuta eventos em tempo real
      if (this.realtime.channel) {
        this.realtime.channel.addEventListener('message', (e) => {
          if (!e.data || e.data.sessionId !== this.sessionId) return;
          if (e.data.type === 'NEW_QUESTION' || e.data.type === 'QUESTION_STATUS_CHANGE') {
            this.renderModerationList();
          } else if (e.data.type === 'VOTE_CAST') {
            this.renderPollsList();
          }
        });
      }

      window.addEventListener('storage', (e) => {
        if (e.key && e.key.startsWith(`session_questions_${this.sessionId}`)) {
          this.renderModerationList();
        } else if (e.key && e.key.startsWith(`session_votes_${this.sessionId}`)) {
          this.renderPollsList();
        }
      });

      this.updateView();
      this.renderModerationList();
      this.renderPollsList();

      if (this.dom.connectionStatus) {
        this.dom.connectionStatus.textContent = this.realtime.isFirebaseReady ? 'Firebase Conectado' : 'Sincronização Ativa';
      }
    } catch (err) {
      alert('Erro ao carregar painel de moderação: ' + err.message);
    }
  }

  setupQRCode() {
    const audienceUrl = QREngine.getAudienceUrl(this.presentationId, this.sessionId);
    if (this.dom.audienceLink) {
      this.dom.audienceLink.href = audienceUrl;
      this.dom.audienceLink.textContent = audienceUrl;
    }
    QREngine.renderQR(this.dom.qrBox, audienceUrl);
  }

  handleSessionUpdate(state) {
    if (!state) return;
    if (typeof state.currentSlide === 'number' && this.engine.currentSlideIndex !== state.currentSlide) {
      this.engine.goToSlide(state.currentSlide);
      this.updateView();
    }
    this.renderPollsList();
    this.renderModerationList();
  }

  updateView() {
    const current = this.engine.currentSlideIndex + 1;
    const total = this.engine.totalSlides;
    const slide = this.engine.currentSlide;

    if (this.dom.slideIndicator) {
      this.dom.slideIndicator.textContent = `${current} / ${total}`;
    }
    if (this.dom.currentSlideTitle && slide) {
      this.dom.currentSlideTitle.textContent = slide.title || `Slide ${current}`;
    }

    if (this.dom.btnPrev) this.dom.btnPrev.disabled = (this.engine.currentSlideIndex === 0);
    if (this.dom.btnNext) this.dom.btnNext.disabled = (this.engine.currentSlideIndex === total - 1);
  }

  renderModerationList() {
    const allQuestions = this.moderation.getQuestions(this.sessionId);
    const pendingQuestions = allQuestions.filter(q => q.status === 'pending');

    if (this.dom.pendingCount) {
      this.dom.pendingCount.textContent = `${pendingQuestions.length} pendente(s)`;
    }

    const filtered = allQuestions.filter(q => {
      if (this.activeTab === 'pending') return q.status === 'pending';
      if (this.activeTab === 'approved') return q.status === 'approved' || q.status === 'featured';
      if (this.activeTab === 'rejected') return q.status === 'rejected';
      return true;
    });

    if (!this.dom.moderationList) return;

    if (filtered.length === 0) {
      this.dom.moderationList.innerHTML = `
        <div style="text-align: center; color: var(--text-muted); padding: 40px; font-size: 13px;">
          Nenhuma pergunta ${this.activeTab === 'pending' ? 'pendente' : 'nesta categoria'}.
        </div>
      `;
      return;
    }

    this.dom.moderationList.innerHTML = filtered.map(q => {
      const isFeatured = (q.status === 'featured');
      let actionsHtml = '';

      if (q.status === 'pending') {
        actionsHtml = `
          <button class="btn btn-sm btn-primary btn-admin-mod" data-action="feature" data-qid="${q.id}" style="padding: 4px 8px; font-size: 11px;">
            ⭐ Destacar no Telão
          </button>
          <button class="btn btn-sm btn-admin-mod" data-action="approve" data-qid="${q.id}" style="padding: 4px 8px; font-size: 11px; color: #6ee7b7; border-color: rgba(16,185,129,0.4);">
            ✓ Aprovar
          </button>
          <button class="btn btn-sm btn-admin-mod" data-action="reject" data-qid="${q.id}" style="padding: 4px 8px; font-size: 11px; color: #fca5a5; border-color: rgba(239,68,68,0.4);">
            ✕ Rejeitar
          </button>
          <button class="btn btn-sm btn-admin-mod" data-action="block" data-uid="${q.uid}" style="padding: 4px 6px; font-size: 11px; color: #fca5a5;" title="Bloquear Participante">
            🚫
          </button>
        `;
      } else if (q.status === 'approved' || q.status === 'featured') {
        actionsHtml = `
          <button class="btn btn-sm ${isFeatured ? 'btn-primary' : ''} btn-admin-mod" data-action="${isFeatured ? 'unfeature' : 'feature'}" data-qid="${q.id}" style="padding: 4px 8px; font-size: 11px;">
            ${isFeatured ? '⭐ Destacada no Telão' : '⭐ Destacar'}
          </button>
          <button class="btn btn-sm btn-admin-mod" data-action="reject" data-qid="${q.id}" style="padding: 4px 8px; font-size: 11px; color: #fca5a5;">
            Remover
          </button>
        `;
      } else if (q.status === 'rejected') {
        actionsHtml = `
          <button class="btn btn-sm btn-admin-mod" data-action="approve" data-qid="${q.id}" style="padding: 4px 8px; font-size: 11px;">
            Restaurar para Aprovadas
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
          <div class="question-text" style="font-size: 14px;">${q.text}</div>
          <div class="question-actions">
            ${actionsHtml}
          </div>
        </div>
      `;
    }).join('');
  }

  renderPollsList() {
    if (!this.dom.pollsContainer || !this.engine.slidesData) return;

    const polls = [];
    this.engine.slidesData.slides.forEach(s => {
      if (s.interaction && s.interaction.poll) {
        polls.push({
          slideId: s.id,
          slideTitle: s.title,
          poll: s.interaction.poll
        });
      }
    });

    if (polls.length === 0) {
      this.dom.pollsContainer.innerHTML = `<div style="color: var(--text-muted); font-size: 12px;">Nenhuma enquete cadastrada nesta apresentação.</div>`;
      return;
    }

    this.dom.pollsContainer.innerHTML = polls.map(item => {
      const res = this.interaction.computePollResults(this.sessionId, item.poll);
      
      const barsHtml = res.options.map(opt => `
        <div style="margin-bottom: 8px;">
          <div style="display: flex; justify-content: space-between; font-size: 11.5px; margin-bottom: 3px;">
            <span style="color: #cbd5e1;">${opt.id}. ${opt.text}</span>
            <span style="font-family: var(--font-mono); font-weight: 700; color: var(--accent-primary);">${opt.percentage}% (${opt.votes})</span>
          </div>
          <div class="poll-progress-track" style="height: 6px;">
            <div class="poll-progress-fill" style="width: ${opt.percentage}%;"></div>
          </div>
        </div>
      `).join('');

      return `
        <div class="card" style="padding: 16px; background: rgba(15,23,42,0.6);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span class="badge badge-accent" style="font-size: 10px;">Slide ${item.slideId}</span>
            <span style="font-size: 11px; color: var(--text-muted); font-family: var(--font-mono);">${res.totalVotes} voto(s)</span>
          </div>
          <div style="font-size: 13px; font-weight: 700; color: #ffffff; margin-bottom: 12px;">${item.poll.question}</div>
          <div>${barsHtml}</div>
          <div style="display: flex; gap: 6px; margin-top: 12px;">
            <button class="btn btn-sm btn-admin-poll" data-action="open" data-pid="${item.poll.id}" style="flex: 1; font-size: 11px; padding: 4px;">
              🟢 Abrir
            </button>
            <button class="btn btn-sm btn-admin-poll" data-action="close" data-pid="${item.poll.id}" style="flex: 1; font-size: 11px; padding: 4px; color: #fca5a5;">
              🔴 Fechar
            </button>
            <button class="btn btn-sm btn-admin-poll" data-action="results" data-pid="${item.poll.id}" style="flex: 1; font-size: 11px; padding: 4px;">
              📊 Resultados
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  bindEvents() {
    // Navegação Remota
    if (this.dom.btnPrev) {
      this.dom.btnPrev.addEventListener('click', async () => {
        this.engine.prevSlide();
        await this.realtime.setSlide(this.sessionId, this.engine.currentSlideIndex, this.engine.currentSlide);
        this.updateView();
      });
    }

    if (this.dom.btnNext) {
      this.dom.btnNext.addEventListener('click', async () => {
        this.engine.nextSlide();
        await this.realtime.setSlide(this.sessionId, this.engine.currentSlideIndex, this.engine.currentSlide);
        this.updateView();
      });
    }

    // Encerramento de Sessão
    if (this.dom.btnEndSession) {
      this.dom.btnEndSession.addEventListener('click', async () => {
        const ok = confirm('Deseja realmente encerrar esta sessão de apresentação?');
        if (ok) {
          await this.realtime.updateSessionState(this.sessionId, {
            status: 'closed',
            pollStatus: 'closed'
          });
          alert('Sessão encerrada com sucesso!');
        }
      });
    }

    // Abas de moderação
    document.querySelectorAll('.moderation-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.moderation-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeTab = btn.dataset.tab;
        this.renderModerationList();
      });
    });

    // Ações de moderação
    if (this.dom.moderationList) {
      this.dom.moderationList.addEventListener('click', async (e) => {
        const btn = e.target.closest('.btn-admin-mod');
        if (btn) {
          const action = btn.dataset.action;
          const qid = btn.dataset.qid;
          const uid = btn.dataset.uid;

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
          this.renderModerationList();
        }
      });
    }

    // Ações de enquetes
    if (this.dom.pollsContainer) {
      this.dom.pollsContainer.addEventListener('click', async (e) => {
        const btn = e.target.closest('.btn-admin-poll');
        if (btn) {
          const action = btn.dataset.action;
          const pid = btn.dataset.pid;

          if (action === 'open') {
            await this.interaction.openPoll(this.sessionId, pid);
          } else if (action === 'close') {
            await this.interaction.closePoll(this.sessionId, pid);
          } else if (action === 'results') {
            const currentRaw = localStorage.getItem(`session_state_${this.sessionId}`);
            let show = true;
            if (currentRaw) {
              const state = JSON.parse(currentRaw);
              show = !state.showResults;
            }
            await this.interaction.toggleShowResults(this.sessionId, show);
          }
          this.renderPollsList();
        }
      });
    }

    // Exportação
    if (this.dom.btnExport) {
      this.dom.btnExport.addEventListener('click', () => {
        const questions = this.moderation.getQuestions(this.sessionId);
        const pollsSummary = [];
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

        const report = {
          presentationId: this.presentationId,
          presentationTitle: this.engine.manifest ? this.engine.manifest.title : '',
          sessionId: this.sessionId,
          exportedAt: new Date().toISOString(),
          summary: {
            totalSlides: this.engine.totalSlides,
            totalQuestions: questions.length,
            totalPolls: pollsSummary.length
          },
          polls: pollsSummary,
          questions: questions
        };

        const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `relatorio_admin_${this.sessionId}_${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      });
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.adminApp = new AdminApp();
});
