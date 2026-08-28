/**
 * Admin & Moderator Application Controller
 * Coordena o console de moderação de perguntas (com exclusão), controle mestre de enquetes com prévia,
 * audiência ao vivo com banimento e gestão de histórico de múltiplas sessões.
 */

import { PresentationEngine } from '../core/presentation-engine.js';
import { QREngine } from '../core/qr-engine.js';
import { RealtimeEngine } from '../core/realtime-engine.js';
import { AuthEngine } from '../core/auth-engine.js';
import { InteractionEngine } from '../core/interaction-engine.js';
import { ModerationEngine } from '../core/moderation-engine.js';
import { SessionManager } from '../core/session-manager.js';

class AdminApp {
  constructor() {
    this.engine = new PresentationEngine({ basePath: '../presentations' });
    this.realtime = new RealtimeEngine();
    this.auth = new AuthEngine();
    this.interaction = new InteractionEngine(this.realtime, this.auth);
    this.moderation = new ModerationEngine(this.realtime, this.auth);
    this.sessionManager = new SessionManager();

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
      btnPublishAnalytics: document.getElementById('admin-btn-publish-analytics'),
      qrBox: document.getElementById('admin-qr-box'),
      audienceLink: document.getElementById('admin-audience-link'),
      connectionStatus: document.getElementById('admin-connection-status'),
      statusDot: document.getElementById('admin-status-dot'),
      
      // Online Stats & Live List
      statTotalOnline: document.getElementById('stat-total-online'),
      statLoggedOnline: document.getElementById('stat-logged-online'),
      statAnonOnline: document.getElementById('stat-anon-online'),
      liveBadge: document.getElementById('admin-live-badge'),
      participantsList: document.getElementById('admin-participants-list'),

      // Moderation
      pendingCount: document.getElementById('admin-pending-count'),
      moderationList: document.getElementById('admin-moderation-list'),
      btnClearAllQuestions: document.getElementById('admin-btn-clear-all-questions'),
      
      // Polls & Export
      pollsContainer: document.getElementById('admin-polls-container'),
      btnResetAllPolls: document.getElementById('admin-btn-reset-all-polls'),
      btnExport: document.getElementById('admin-btn-export'),

      // Session History & New Session Modals
      btnHistory: document.getElementById('admin-btn-history'),
      btnNewSession: document.getElementById('admin-btn-new-session'),
      historyModal: document.getElementById('history-modal'),
      btnCloseHistoryModal: document.getElementById('btn-close-history-modal'),
      btnDoneHistory: document.getElementById('btn-done-history'),
      historySessionsList: document.getElementById('history-sessions-list'),
      btnExportAllHistory: document.getElementById('btn-export-all-history'),
      
      newSessionModal: document.getElementById('new-session-modal'),
      btnCloseNewSessionModal: document.getElementById('btn-close-new-session-modal'),
      inputNewSessionCode: document.getElementById('input-new-session-code'),
      btnConfirmNewSession: document.getElementById('btn-confirm-new-session')
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

      // Registra a sessão atual no histórico
      this.sessionManager.saveSessionToHistory({
        sessionId: this.sessionId,
        presentationId: this.presentationId,
        presentationTitle: this.engine.manifest.title,
        status: 'active'
      });

      // Inscreve-se nas atualizações da sessão
      this.realtime.subscribeToSession(this.sessionId, (state) => {
        this.handleSessionUpdate(state);
      });

      // Polling de presença
      this.updatePresenceMetrics();
      setInterval(() => this.updatePresenceMetrics(), 4000);

      // Escuta eventos em tempo real
      if (this.realtime.channel) {
        this.realtime.channel.addEventListener('message', (e) => {
          if (!e.data || e.data.sessionId !== this.sessionId) return;
          if (e.data.type === 'NEW_QUESTION' || e.data.type === 'QUESTION_STATUS_CHANGE') {
            this.renderModerationList();
          } else if (e.data.type === 'VOTE_CAST' || e.data.type === 'VOTE_RESET') {
            this.renderPollsList();
          } else if (e.data.type === 'PRESENCE_PING') {
            this.updatePresenceMetrics();
          }
        });
      }

      window.addEventListener('storage', (e) => {
        if (e.key && e.key.startsWith(`session_questions_${this.sessionId}`)) {
          this.renderModerationList();
        } else if (e.key && (e.key.startsWith(`session_votes_${this.sessionId}`) || e.key.startsWith(`vote_`))) {
          this.renderPollsList();
        } else if (e.key && e.key.startsWith(`session_presence_${this.sessionId}`)) {
          this.updatePresenceMetrics();
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

  updatePresenceMetrics() {
    const stats = this.realtime.getOnlineStats(this.sessionId);
    if (this.dom.statTotalOnline) this.dom.statTotalOnline.textContent = stats.total;
    if (this.dom.statLoggedOnline) this.dom.statLoggedOnline.textContent = stats.authenticated;
    if (this.dom.statAnonOnline) this.dom.statAnonOnline.textContent = stats.anonymous;
    if (this.dom.liveBadge) this.dom.liveBadge.textContent = `${stats.total} ao vivo`;

    this.renderParticipantsList(stats.list);
  }

  renderParticipantsList(participants = []) {
    if (!this.dom.participantsList) return;

    if (participants.length === 0) {
      this.dom.participantsList.innerHTML = `
        <div style="color: var(--text-muted); font-size: 11px; text-align: center; padding: 10px;">
          Nenhum participante conectado no momento.
        </div>
      `;
      return;
    }

    this.dom.participantsList.innerHTML = participants.map(p => {
      const isBlocked = this.moderation.isUserBlocked(this.sessionId, p.uid);
      return `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 8px; background: rgba(15,23,42,0.6); border-radius: 4px; border: 1px solid var(--border-subtle);">
          <div>
            <div style="font-size: 11.5px; font-weight: 600; color: ${p.isAuthenticated ? '#6ee7b7' : '#e2e8f0'}; display: flex; align-items: center; gap: 4px;">
              <span>${p.isAuthenticated ? '👤' : '👁️'}</span>
              <span>${p.alias || 'Participante'}</span>
            </div>
            <div style="font-size: 9.5px; color: var(--text-muted);">
              ${p.isAuthenticated ? 'Google Auth' : 'Anônimo (Leitura)'} • ID: ${p.uid.substring(0, 8)}...
            </div>
          </div>
          <button class="btn btn-sm btn-admin-ban" data-uid="${p.uid}" style="padding: 2px 6px; font-size: 10px; border-color: ${isBlocked ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)'}; color: ${isBlocked ? '#6ee7b7' : '#fca5a5'};">
            ${isBlocked ? '✓ Desbloquear' : '🚫 Banir'}
          </button>
        </div>
      `;
    }).join('');
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
      const isBlocked = this.moderation.isUserBlocked(this.sessionId, q.uid);
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
          <button class="btn btn-sm btn-admin-mod" data-action="delete" data-qid="${q.id}" style="padding: 4px 6px; font-size: 11px; color: #fca5a5;" title="Excluir Definitivamente">
            🗑️
          </button>
          <button class="btn btn-sm btn-admin-mod" data-action="block" data-uid="${q.uid}" style="padding: 4px 6px; font-size: 11px; color: ${isBlocked ? '#6ee7b7' : '#fca5a5'};" title="${isBlocked ? 'Desbloquear' : 'Banir Participante'}">
            ${isBlocked ? '✓' : '🚫'}
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
          <button class="btn btn-sm btn-admin-mod" data-action="delete" data-qid="${q.id}" style="padding: 4px 6px; font-size: 11px; color: #fca5a5;" title="Excluir Definitivamente">
            🗑️
          </button>
        `;
      } else if (q.status === 'rejected') {
        actionsHtml = `
          <button class="btn btn-sm btn-admin-mod" data-action="approve" data-qid="${q.id}" style="padding: 4px 8px; font-size: 11px;">
            Restaurar
          </button>
          <button class="btn btn-sm btn-admin-mod" data-action="delete" data-qid="${q.id}" style="padding: 4px 6px; font-size: 11px; color: #fca5a5;" title="Excluir Definitivamente">
            🗑️
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
          poll: s.interaction.poll,
          isCurrentSlide: (this.engine.currentSlideIndex === s.id - 1)
        });
      }
    });

    if (polls.length === 0) {
      this.dom.pollsContainer.innerHTML = `<div style="color: var(--text-muted); font-size: 12px;">Nenhuma enquete cadastrada nesta apresentação.</div>`;
      return;
    }

    // Pega o estado geral da sessão
    const sessionRaw = localStorage.getItem(`session_state_${this.sessionId}`);
    let sessionState = { pollStatus: 'open', showResults: false };
    if (sessionRaw) {
      try { sessionState = JSON.parse(sessionRaw); } catch(e) {}
    }

    this.dom.pollsContainer.innerHTML = polls.map(item => {
      const res = this.interaction.computePollResults(this.sessionId, item.poll);
      const isCurrent = item.isCurrentSlide;
      
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
        <div class="card" style="padding: 14px; background: ${isCurrent ? 'rgba(30,41,59,0.85)' : 'rgba(15,23,42,0.6)'}; border: ${isCurrent ? '1.5px solid var(--accent-primary)' : '1px solid var(--border-subtle)'};">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <span class="badge ${isCurrent ? 'badge-accent' : ''}" style="font-size: 10px;">
              ${isCurrent ? '⭐ SLIDE ATUAL' : `Slide ${item.slideId}`}
            </span>
            <span style="font-size: 11px; color: var(--text-muted); font-family: var(--font-mono);">${res.totalVotes} voto(s) computados</span>
          </div>
          <div style="font-size: 13px; font-weight: 700; color: #ffffff; margin-bottom: 10px;">${item.poll.question}</div>
          <div>${barsHtml}</div>
          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 4px; margin-top: 10px;">
            <button class="btn btn-sm btn-admin-poll" data-action="open" data-pid="${item.poll.id}" style="font-size: 10px; padding: 4px 2px;">
              🟢 Abrir
            </button>
            <button class="btn btn-sm btn-admin-poll" data-action="close" data-pid="${item.poll.id}" style="font-size: 10px; padding: 4px 2px; color: #fca5a5;">
              🔴 Fechar
            </button>
            <button class="btn btn-sm btn-primary btn-admin-poll" data-action="results" data-pid="${item.poll.id}" style="font-size: 10px; padding: 4px 2px;">
              ${(isCurrent && sessionState.showResults) ? '🙈 Ocultar' : '📊 Projetar'}
            </button>
            <button class="btn btn-sm btn-admin-poll" data-action="reset" data-pid="${item.poll.id}" style="font-size: 10px; padding: 4px 2px; border-color: rgba(239,68,68,0.3); color: #fca5a5;" title="Zerar votos desta enquete">
              🔄 Zerar
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  openHistoryModal() {
    if (!this.dom.historyModal) return;
    this.renderHistorySessionsList();
    this.dom.historyModal.style.display = 'flex';
  }

  closeHistoryModal() {
    if (this.dom.historyModal) {
      this.dom.historyModal.style.display = 'none';
    }
  }

  renderHistorySessionsList() {
    if (!this.dom.historySessionsList) return;
    const history = this.sessionManager.getSessionsHistory();

    if (history.length === 0) {
      this.dom.historySessionsList.innerHTML = `
        <div style="color: var(--text-muted); font-size: 12px; text-align: center; padding: 20px;">
          Nenhuma sessão arquivada no histórico.
        </div>
      `;
      return;
    }

    this.dom.historySessionsList.innerHTML = history.map(s => {
      const isCurrent = (s.sessionId === this.sessionId);
      return `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 14px; background: rgba(15,23,42,0.7); border: ${isCurrent ? '1.5px solid var(--accent-primary)' : '1px solid var(--border-subtle)'}; border-radius: 8px;">
          <div>
            <div style="font-size: 13.5px; font-weight: 700; color: #ffffff; display: flex; align-items: center; gap: 8px;">
              <span>#${s.sessionId}</span>
              ${isCurrent ? '<span class="badge badge-live" style="font-size: 9.5px; padding: 1px 6px;">Sessão Ativa</span>' : ''}
            </div>
            <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">
              ${new Date(s.createdAt).toLocaleDateString()} às ${new Date(s.createdAt).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}
            </div>
          </div>
          <div style="display: flex; gap: 8px;">
            <button class="btn btn-sm btn-export-single-session" data-sid="${s.sessionId}" style="font-size: 11px; padding: 4px 8px;">
              📥 Exportar JSON
            </button>
            ${!isCurrent ? `
              <button class="btn btn-sm btn-delete-single-session" data-sid="${s.sessionId}" style="font-size: 11px; padding: 4px 8px; border-color: rgba(239,68,68,0.4); color: #fca5a5;">
                🗑️ Apagar
              </button>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  openNewSessionModal() {
    if (this.dom.newSessionModal) {
      if (this.dom.inputNewSessionCode) this.dom.inputNewSessionCode.value = '';
      this.dom.newSessionModal.style.display = 'flex';
    }
  }

  closeNewSessionModal() {
    if (this.dom.newSessionModal) {
      this.dom.newSessionModal.style.display = 'none';
    }
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

    // Modal de Histórico
    if (this.dom.btnHistory) {
      this.dom.btnHistory.addEventListener('click', () => this.openHistoryModal());
    }
    if (this.dom.btnCloseHistoryModal) {
      this.dom.btnCloseHistoryModal.addEventListener('click', () => this.closeHistoryModal());
    }
    if (this.dom.btnDoneHistory) {
      this.dom.btnDoneHistory.addEventListener('click', () => this.closeHistoryModal());
    }

    // Modal de Nova Sessão
    if (this.dom.btnNewSession) {
      this.dom.btnNewSession.addEventListener('click', () => this.openNewSessionModal());
    }
    if (this.dom.btnCloseNewSessionModal) {
      this.dom.btnCloseNewSessionModal.addEventListener('click', () => this.closeNewSessionModal());
    }

    // Confirmar criação de nova sessão
    if (this.dom.btnConfirmNewSession) {
      this.dom.btnConfirmNewSession.addEventListener('click', () => {
        const customCode = this.dom.inputNewSessionCode.value;
        const newSid = this.sessionManager.createNewSession(this.presentationId, customCode);
        alert(`Nova sessão #${newSid} iniciada com sucesso! A página será recarregada.`);
        window.location.href = `?presentation=${this.presentationId}&session=${newSid}`;
      });
    }

    // Ações na lista de histórico (Exportar e Deletar sessão individual)
    if (this.dom.historySessionsList) {
      this.dom.historySessionsList.addEventListener('click', (e) => {
        const exportBtn = e.target.closest('.btn-export-single-session');
        const deleteBtn = e.target.closest('.btn-delete-single-session');

        if (exportBtn) {
          const sid = exportBtn.dataset.sid;
          const report = this.sessionManager.compileSessionReport(sid, this.engine.slidesData);
          const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `relatorio_sessao_${sid}.json`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        } else if (deleteBtn) {
          const sid = deleteBtn.dataset.sid;
          const ok = confirm(`Deseja realmente apagar todos os dados da sessão #${sid}?`);
          if (ok) {
            this.sessionManager.deleteSession(sid);
            this.renderHistorySessionsList();
          }
        }
      });
    }

    // Exportar todo o histórico consolidado
    if (this.dom.btnExportAllHistory) {
      this.dom.btnExportAllHistory.addEventListener('click', () => {
        const history = this.sessionManager.getSessionsHistory();
        const allReports = history.map(s => this.sessionManager.compileSessionReport(s.sessionId, this.engine.slidesData));
        const blob = new Blob([JSON.stringify(allReports, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `historico_consolidado_${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      });
    }

    // Projetar Resumo Analítico no Telão
    if (this.dom.btnPublishAnalytics) {
      this.dom.btnPublishAnalytics.addEventListener('click', async () => {
        const ok = confirm('Deseja projetar o painel de encerramento com o resumo analítico completo no telão e nos smartphones?');
        if (ok) {
          await this.realtime.updateSessionState(this.sessionId, {
            showFinalAnalytics: true,
            status: 'closed'
          });
          alert('Resumo analítico projetado com sucesso no telão!');
        }
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

    // Limpar todas as perguntas
    if (this.dom.btnClearAllQuestions) {
      this.dom.btnClearAllQuestions.addEventListener('click', async () => {
        const ok = confirm('ATENÇÃO: Deseja realmente APAGAR TODAS as perguntas enviadas nesta sessão?');
        if (ok) {
          await this.moderation.clearAllQuestions(this.sessionId);
          this.renderModerationList();
          alert('Todas as perguntas foram excluídas.');
        }
      });
    }

    // Zerar todas as enquetes
    if (this.dom.btnResetAllPolls) {
      this.dom.btnResetAllPolls.addEventListener('click', async () => {
        const ok = confirm('ATENÇÃO: Deseja realmente ZERAR TODOS os votos de todas as enquetes desta apresentação?');
        if (ok) {
          const pollIds = [];
          if (this.engine.slidesData && this.engine.slidesData.slides) {
            this.engine.slidesData.slides.forEach(s => {
              if (s.interaction && s.interaction.poll) pollIds.push(s.interaction.poll.id);
            });
          }
          await this.interaction.resetAllPolls(this.sessionId, pollIds);
          this.renderPollsList();
          alert('Todas as votações foram zeradas com sucesso!');
        }
      });
    }

    // Banimento de participantes na lista
    if (this.dom.participantsList) {
      this.dom.participantsList.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-admin-ban');
        if (btn) {
          const uid = btn.dataset.uid;
          const isBlocked = this.moderation.toggleBlockUser(this.sessionId, uid);
          this.updatePresenceMetrics();
          this.renderModerationList();
          alert(`Participante ${isBlocked ? 'bloqueado' : 'desbloqueado'} com sucesso.`);
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

    // Ações de moderação (com suporte a exclusão individual)
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
          } else if (action === 'delete') {
            const ok = confirm('Deseja excluir definitivamente esta pergunta?');
            if (ok) {
              await this.moderation.deleteQuestion(this.sessionId, qid);
            }
          } else if (action === 'block' && uid) {
            const isBlocked = this.moderation.toggleBlockUser(this.sessionId, uid);
            this.updatePresenceMetrics();
            alert(`Participante ${isBlocked ? 'bloqueado' : 'desbloqueado'} com sucesso.`);
          }
          this.renderModerationList();
        }
      });
    }

    // Ações de enquetes (Controle Mestre com prévia e projeção no telão)
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
          } else if (action === 'reset') {
            const ok = confirm('Deseja zerar os votos desta enquete?');
            if (ok) {
              await this.interaction.resetPoll(this.sessionId, pid);
              this.renderPollsList();
              alert('Votação zerada!');
            }
          }
          this.renderPollsList();
        }
      });
    }

    // Exportação da sessão atual
    if (this.dom.btnExport) {
      this.dom.btnExport.addEventListener('click', () => {
        const report = this.sessionManager.compileSessionReport(this.sessionId, this.engine.slidesData);
        const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `relatorio_sessao_${this.sessionId}_${Date.now()}.json`;
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
