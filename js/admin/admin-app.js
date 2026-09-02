/**
 * Admin & Moderator Application Controller
 * Coordena o console de moderação de perguntas, controle mestre de enquetes,
 * audiência ao vivo, customização de host do QR Code, projeção sincronizada,
 * internacionalização (i18n), temas visuais e exportação multiformato (JSON, CSV, MD).
 */

import { PresentationEngine } from '../core/presentation-engine.js';
import { QREngine } from '../core/qr-engine.js';
import { RealtimeEngine } from '../core/realtime-engine.js';
import { AuthEngine } from '../core/auth-engine.js';
import { InteractionEngine } from '../core/interaction-engine.js';
import { ModerationEngine } from '../core/moderation-engine.js';
import { SessionManager } from '../core/session-manager.js';
import { i18n } from '../core/i18n-engine.js';
import { theme, THEMES } from '../core/theme-engine.js';

class AdminApp {
  constructor() {
    this.engine = new PresentationEngine({ basePath: '../presentations' });
    this.realtime = new RealtimeEngine();
    this.auth = new AuthEngine();
    this.interaction = new InteractionEngine(this.realtime, this.auth);
    this.moderation = new ModerationEngine(this.realtime, this.auth);
    this.sessionManager = new SessionManager();

    this.presentationId = PresentationEngine.getPresentationIdFromURL();
    this.sessionId = PresentationEngine.getSessionIdFromURL() || this.sessionManager.getSessionId() || QREngine.generateSessionCode();
    this.activeTab = 'pending';
    this.moderationSort = 'recent';
    this.currentHostUrl = '';
    this.fxCooldownActive = false;
    this.fxCooldownTimer = null;

    this.dom = {
      presSelector: document.getElementById('admin-pres-selector'),
      btnSwitchProject: document.getElementById('admin-btn-switch-project'),
      btnConfigureHost: document.getElementById('admin-btn-configure-host'),
      btnToggleLang: document.getElementById('btn-toggle-lang'),
      btnToggleTheme: document.getElementById('btn-toggle-theme'),

      sessionCode: document.getElementById('admin-session-code'),
      slideIndicator: document.getElementById('admin-slide-indicator'),
      currentSlideTitle: document.getElementById('admin-current-slide-title'),
      btnPrev: document.getElementById('admin-btn-prev'),
      btnNext: document.getElementById('admin-btn-next'),
      selectPacing: document.getElementById('admin-select-pacing'),
      pacingBadge: document.getElementById('admin-pacing-badge'),
      
      // Diagnostics & Capacity HUD (Demanda 03 - Fase 2)
      diagCard: document.getElementById('admin-diagnostics-card'),
      secHealthBadge: document.getElementById('admin-sec-health-badge'),
      diagHealthBadge: document.getElementById('admin-diag-health-badge'),
      diagContent: document.getElementById('admin-diag-content'),
      diagCapacity: document.getElementById('admin-diag-capacity'),
      diagLatency: document.getElementById('admin-diag-latency'),
      diagDeckWeight: document.getElementById('admin-diag-deck-weight'),
      diagServerStats: document.getElementById('admin-diag-server-stats'),
      diagSecurityLevel: document.getElementById('admin-diag-security-level'),
      diagHeavyAlerts: document.getElementById('admin-diag-heavy-alerts'),

      // Stage FX Deck (Demanda 02 - Fase 2)
      stageFxCard: document.getElementById('admin-stage-fx-card'),
      fxCooldownBadge: document.getElementById('admin-fx-cooldown-badge'),

      // Media Remote Control (Plano 11 - Fase 3)
      mediaControlCard: document.getElementById('admin-media-control-card'),
      mediaStatusBadge: document.getElementById('admin-media-status-badge'),

      btnEndSession: document.getElementById('admin-btn-end-session'),
      btnPublishAnalytics: document.getElementById('admin-btn-publish-analytics'),
      qrBox: document.getElementById('admin-qr-box'),
      audienceLink: document.getElementById('admin-audience-link'),
      qrHostIndicator: document.getElementById('admin-qr-host-indicator'),
      linkPresenter: document.getElementById('admin-link-presenter'),
      linkPresenterQuestions: document.getElementById('admin-link-presenter-questions'),
      linkPresenterPolls: document.getElementById('admin-link-presenter-polls'),
      linkAudienceHeader: document.getElementById('admin-link-audience'),
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
      btnExportCsv: document.getElementById('admin-btn-export-csv'),
      btnExportMd: document.getElementById('admin-btn-export-md'),
      btnExportDeckHtml: document.getElementById('admin-btn-export-deck-html'),
      btnExportDeckZip: document.getElementById('admin-btn-export-zip'),

      // Host Config Modal
      hostModal: document.getElementById('host-config-modal'),
      btnCloseHostModal: document.getElementById('btn-close-host-modal'),
      inputCustomHost: document.getElementById('input-custom-host'),
      hostPreviewLink: document.getElementById('host-preview-link'),
      btnSaveHostConfig: document.getElementById('btn-save-host-config'),
      btnResetHostDefault: document.getElementById('btn-reset-host-default'),

      // Session History & New Session Modals
      btnHistory: document.getElementById('admin-btn-history'),
      cardBtnHistory: document.getElementById('admin-card-btn-history'),
      btnNewSession: document.getElementById('admin-btn-new-session'),
      historyModal: document.getElementById('history-modal'),
      btnCloseHistoryModal: document.getElementById('btn-close-history-modal'),
      btnDoneHistory: document.getElementById('btn-done-history'),
      historySessionsList: document.getElementById('history-sessions-list'),
      btnExportAllHistory: document.getElementById('btn-export-all-history'),
      
      newSessionModal: document.getElementById('new-session-modal'),
      btnCloseNewSessionModal: document.getElementById('btn-close-new-session-modal'),
      inputNewSessionCode: document.getElementById('input-new-session-code'),
      btnConfirmNewSession: document.getElementById('btn-confirm-new-session'),

      btnLock: document.getElementById('admin-btn-lock'),
      userLabel: document.getElementById('admin-user-label'),

      // Admin Lock Modal (Multi-Auth Gatekeeper)
      adminLockModal: document.getElementById('admin-lock-modal'),
      tabAuthPin: document.getElementById('tab-auth-pin'),
      tabAuthLocal: document.getElementById('tab-auth-local'),
      tabAuthGoogle: document.getElementById('tab-auth-google'),
      panelAuthPin: document.getElementById('panel-auth-pin'),
      panelAuthLocal: document.getElementById('panel-auth-local'),
      panelAuthGoogle: document.getElementById('panel-auth-google'),
      inputAdminPin: document.getElementById('input-admin-pin'),
      adminPinError: document.getElementById('admin-pin-error'),
      btnUnlockAdmin: document.getElementById('btn-unlock-admin'),
      inputAdminUser: document.getElementById('input-admin-user'),
      inputAdminPass: document.getElementById('input-admin-pass'),
      adminUserError: document.getElementById('admin-user-error'),
      btnUnlockUser: document.getElementById('btn-unlock-user'),
      btnUnlockGoogle: document.getElementById('btn-unlock-google'),

      // Analytics Dashboard (Plano 09 - Fase 2)
      btnAnalytics: document.getElementById('admin-btn-analytics'),
      cardBtnAnalytics: document.getElementById('admin-card-btn-analytics'),
      analyticsModal: document.getElementById('admin-analytics-modal'),
      btnCloseAnalyticsModal: document.getElementById('btn-close-analytics-modal'),
      btnDoneAnalytics: document.getElementById('btn-done-analytics'),
      analyticsSelectSession: document.getElementById('analytics-select-session'),
      analyticsBtnArchiveNow: document.getElementById('analytics-btn-archive-now'),
      analyticsBtnRefresh: document.getElementById('analytics-btn-refresh'),
      analyticsBtnExportHTML: document.getElementById('analytics-btn-export-html'),
      analyticsBtnExportCSV: document.getElementById('analytics-btn-export-csv'),
      analyticsBtnExportJSON: document.getElementById('analytics-btn-export-json'),
      canvasDwellTime: document.getElementById('canvas-dwell-time'),
      analyticsKpiParticipants: document.getElementById('analytics-kpi-participants'),
      analyticsKpiDuration: document.getElementById('analytics-kpi-duration'),
      analyticsKpiVotes: document.getElementById('analytics-kpi-votes'),
      analyticsKpiQuestions: document.getElementById('analytics-kpi-questions'),
      analyticsPollsContainer: document.getElementById('analytics-polls-container'),
      analyticsQuestionsContainer: document.getElementById('analytics-questions-container'),

      // Gestão de Segurança & RBAC (Plano 14 - Fase 2)
      btnSecurity: document.getElementById('admin-btn-security'),
      securityModal: document.getElementById('admin-security-settings-modal'),
      btnCloseSecurityModal: document.getElementById('btn-close-security-modal'),
      btnCloseSecurityModalFooter: document.getElementById('btn-close-security-modal-footer'),
      btnSaveSecuritySettings: document.getElementById('btn-save-security-settings'),
      secTabPinBtn: document.getElementById('sec-tab-pin-btn'),
      secTabUsersBtn: document.getElementById('sec-tab-users-btn'),
      secTabAudienceBtn: document.getElementById('sec-tab-audience-btn'),
      secTabGoogleBtn: document.getElementById('sec-tab-google-btn'),
      secPanelPin: document.getElementById('sec-panel-pin'),
      secPanelUsers: document.getElementById('sec-panel-users'),
      secPanelAudience: document.getElementById('sec-panel-audience'),
      secPanelGoogle: document.getElementById('sec-panel-google'),
      secInputPin: document.getElementById('sec-input-pin'),
      secBtnGeneratePin: document.getElementById('sec-btn-generate-pin'),
      secCheckRequirePin: document.getElementById('sec-check-require-pin'),
      secAdminUsersTbody: document.getElementById('sec-admin-users-tbody'),
      secBtnShowAddUser: document.getElementById('sec-btn-show-add-user'),
      secUserFormCard: document.getElementById('sec-user-form-card'),
      secUserFormTitle: document.getElementById('sec-user-form-title'),
      secFormUserName: document.getElementById('sec-form-user-name'),
      secFormUserUsername: document.getElementById('sec-form-user-username'),
      secFormUserRole: document.getElementById('sec-form-user-role'),
      secFormUserPassword: document.getElementById('sec-form-user-password'),
      secBtnCancelUserForm: document.getElementById('sec-btn-cancel-user-form'),
      secBtnSaveUserForm: document.getElementById('sec-btn-save-user-form'),
      secCheckAudienceEnabled: document.getElementById('sec-check-audience-enabled'),
      secBtnAddAudienceUser: document.getElementById('sec-btn-add-audience-user'),
      secAudienceUsersTbody: document.getElementById('sec-audience-users-tbody'),
      secInputAllowedEmails: document.getElementById('sec-input-allowed-emails'),
      secFeedbackMsg: document.getElementById('sec-feedback-msg'),
      secMethodTogglePin: document.getElementById('sec-method-toggle-pin'),
      secMethodToggleLocal: document.getElementById('sec-method-toggle-local'),
      secMethodToggleGoogle: document.getElementById('sec-method-toggle-google'),
      secCheckScopePresenter: document.getElementById('sec-check-scope-presenter'),
      secCheckScopeStudio: document.getElementById('sec-check-scope-studio'),
      secCheckScopePortal: document.getElementById('sec-check-scope-portal'),
      secAdminUsersCount: document.getElementById('sec-admin-users-count'),
      secGoogleEmailsCount: document.getElementById('sec-google-emails-count'),
      secActiveMethodsCount: document.getElementById('sec-active-methods-count')
    };

    this.cachedSecurityConfig = null;
    this.editingAdminUserIndex = null;

    this.init();
  }

  async loadCatalogOptions() {
    if (!this.dom.presSelector) return;
    try {
      let list = [];
      let res = await fetch('/api/presentations/catalog?t=' + Date.now());
      if (!res.ok) {
        res = await fetch('../presentations/catalog.json?t=' + Date.now());
      }
      if (res.ok) {
        const data = await res.json();
        list = data.presentations || [];
      }
      
      if (!list || list.length === 0) {
        list = [
          { id: 'comece-por-aqui', title: 'Comece por Aqui: Mapa do Ecossistema & Guia das Interfaces', totalSlides: 5 },
          { id: 'slidemesh-showcase', title: 'SlideMeshLive: A Mágica das Apresentações Interativas', totalSlides: 10 },
          { id: 'guia-animacoes-e-palco', title: 'Manual Prático: Transições de Telão, Efeitos & Controle de Mídia', totalSlides: 5 },
          { id: 'guia-criacao-studio-zip', title: 'Manual Prático: SlideMesh Studio — Criação, Importação & Pacotes ZIP', totalSlides: 5 },
          { id: 'guia-moderacao-e-analytics', title: 'Manual Prático: Mesa Técnica — Moderação de Q&A & Gestão de Enquetes', totalSlides: 5 },
          { id: 'treinamento-interno-pin', title: 'Manual Prático: Segurança, PINs de Acesso & Gestão RBAC', totalSlides: 5 },
          { id: 'guia-diagnostico-troubleshooting', title: 'Manual Prático: Diagnóstico de Rede, Monitoramento & Resolução de Falhas', totalSlides: 5 }
        ];
      }

      if (list.length > 0) {
        const exists = list.some(p => p.id === this.presentationId);
        if (!exists) {
          this.presentationId = list[0].id;
        }
        this.dom.presSelector.innerHTML = list.map(p => `
          <option value="${p.id}" ${p.id === this.presentationId ? 'selected' : ''}>
            ${p.title}
          </option>
        `).join('');
        this.dom.presSelector.value = this.presentationId;
      }
    } catch (e) {
      console.warn('Erro ao carregar catálogo de apresentações:', e);
      const fallbackList = [
        { id: 'comece-por-aqui', title: 'Comece por Aqui: Mapa do Ecossistema & Guia das Interfaces' },
        { id: 'slidemesh-showcase', title: 'SlideMeshLive: A Mágica das Apresentações Interativas' },
        { id: 'guia-animacoes-e-palco', title: 'Manual Prático: Transições de Telão, Efeitos & Controle de Mídia' },
        { id: 'guia-criacao-studio-zip', title: 'Manual Prático: SlideMesh Studio — Criação, Importação & Pacotes ZIP' },
        { id: 'guia-moderacao-e-analytics', title: 'Manual Prático: Mesa Técnica — Moderação de Q&A & Gestão de Enquetes' },
        { id: 'treinamento-interno-pin', title: 'Manual Prático: Segurança, PINs de Acesso & Gestão RBAC' },
        { id: 'guia-diagnostico-troubleshooting', title: 'Manual Prático: Diagnóstico de Rede, Monitoramento & Resolução de Falhas' }
      ];
      this.dom.presSelector.innerHTML = fallbackList.map(p => `
        <option value="${p.id}" ${p.id === this.presentationId ? 'selected' : ''}>
          ${p.title}
        </option>
      `).join('');
      this.dom.presSelector.value = this.presentationId;
    }
  }

  async init() {
    this.bindEvents();
    this.updateLanguageButton();
    this.updateThemeButton();

    try {
      await this.auth.loadSecurityConfig();
    } catch (e) {
      console.warn('Erro ao carregar configurações de segurança:', e);
    }

    if (!this.auth.isAdminAuthenticated()) {
      this.showLockScreen();
      this.loadCatalogOptions().catch(err => console.warn('Erro ao carregar catálogo em background:', err));
    } else {
      await this.startAdminSession();
    }
  }

  showLockScreen() {
    document.body.classList.add('admin-locked');
    if (this.dom.adminLockModal) {
      this.dom.adminLockModal.classList.add('active');
      this.switchAuthTab('pin');

      const setupBanner = document.getElementById('admin-lock-setup-banner');
      if (setupBanner) {
        setupBanner.style.display = (this.auth && this.auth.isSetupRequired()) ? 'flex' : 'none';
      }

      if (this.dom.inputAdminPin) {
        setTimeout(() => this.dom.inputAdminPin.focus(), 150);
      }
    }
  }

  switchAuthTab(tab) {
    const tabs = [
      { id: 'pin', tabBtn: this.dom.tabAuthPin, panel: this.dom.panelAuthPin, focus: this.dom.inputAdminPin },
      { id: 'local', tabBtn: this.dom.tabAuthLocal, panel: this.dom.panelAuthLocal, focus: this.dom.inputAdminUser },
      { id: 'google', tabBtn: this.dom.tabAuthGoogle, panel: this.dom.panelAuthGoogle, focus: null }
    ];

    tabs.forEach(t => {
      const active = (t.id === tab);
      if (t.tabBtn) {
        if (active) {
          t.tabBtn.classList.add('btn-primary');
          t.tabBtn.style.background = '';
          t.tabBtn.style.borderColor = '';
          t.tabBtn.style.color = '#ffffff';
        } else {
          t.tabBtn.classList.remove('btn-primary');
          t.tabBtn.style.background = 'transparent';
          t.tabBtn.style.borderColor = 'transparent';
          t.tabBtn.style.color = 'var(--text-muted)';
        }
      }
      if (t.panel) {
        t.panel.style.display = active ? 'block' : 'none';
      }
      if (active && t.focus) {
        setTimeout(() => t.focus.focus(), 100);
      }
    });

    if (this.dom.adminPinError) this.dom.adminPinError.style.display = 'none';
    if (this.dom.adminUserError) this.dom.adminUserError.style.display = 'none';
  }

  async startAdminSession() {
    this.sessionStarted = true;
    document.body.classList.remove('admin-locked');
    if (this.dom.adminLockModal) {
      this.dom.adminLockModal.classList.remove('active');
    }

    // Atualiza label do usuário no header
    if (this.dom.userLabel) {
      const user = this.auth.getCurrentUser();
      if (user && user.displayName && !user.isAnonymous) {
        this.dom.userLabel.textContent = `${user.displayName} (Sair)`;
      } else {
        this.dom.userLabel.textContent = 'Bloquear';
      }
    }

    if (this.dom.sessionCode) {
      this.dom.sessionCode.textContent = `SESSÃO: ${this.sessionId}`;
    }

    try {
      await this.loadCatalogOptions();
      await this.engine.loadPresentation(this.presentationId);
      if (this.dom.presSelector) {
        this.dom.presSelector.value = this.presentationId;
      }

      if (this.engine.manifest?.pacing?.mode) {
        this.updatePacingUI(this.engine.manifest.pacing.mode);
      }

      this.setupQRCode();

      // Registra a sessão atual no histórico
      this.sessionManager.saveSessionToHistory({
        sessionId: this.sessionId,
        presentationId: this.presentationId,
        presentationTitle: this.engine.manifest.title,
        status: 'active'
      });

      // Inicializa temporizador de tempo de permanência de slide
      this.sessionManager.startSlideTimer(this.engine.currentSlideIndex);

      if (!this.subscribedToRealtime) {
        this.subscribedToRealtime = true;

        // Inscreve-se nas atualizações da sessão
        this.realtime.subscribeToSession(this.sessionId, (state) => {
          this.handleSessionUpdate(state);
        });

        // Polling de presença
        this.updatePresenceMetrics();
        setInterval(() => this.updatePresenceMetrics(), 4000);

        // Diagnóstico de Ambiente & Capacidade Wi-Fi (Demanda 03 - Fase 2)
        this.fetchEnvironmentDiagnostics();
        setInterval(() => this.fetchEnvironmentDiagnostics(), 10000);

        // Escuta unificada de eventos em tempo real
        this.realtime.onEvent((event) => {
          if (!event || event.sessionId !== this.sessionId) return;
          const type = event.type;

          if (type === 'NEW_QUESTION') {
            this.playNotificationChime();
            const pendingTab = document.getElementById('admin-tab-pending');
            if (pendingTab) {
              pendingTab.classList.add('animate-pulse');
              setTimeout(() => pendingTab.classList.remove('animate-pulse'), 3000);
            }
            this.renderModerationList();
          } else if (type === 'QUESTION_STATUS_CHANGE' || type === 'CLEAR_ALL_QUESTIONS') {
            this.renderModerationList();
          } else if (type === 'VOTE_CAST' || type === 'VOTE_RESET' || type === 'RESET_POLL' || type === 'RESET_ALL_POLLS') {
            this.renderPollsList();
          } else if (type === 'PRESENCE_LEAVE') {
            this.updatePresenceMetrics();
          } else if (type === 'QR_HOST_CONFIG_CHANGED') {
            this.setupQRCode();
          }
        });
      }

      this.updateView();
      this.renderModerationList();
      this.renderPollsList();
    } catch (err) {
      console.error('Erro ao carregar painel de moderação:', err);
    }
  }

  async unlockAdminWithPin() {
    const entered = (this.dom.inputAdminPin && this.dom.inputAdminPin.value) ? this.dom.inputAdminPin.value.trim() : '';
    if (!entered) {
      if (this.dom.adminPinError) {
        this.dom.adminPinError.textContent = '✕ Digite o PIN de acesso.';
        this.dom.adminPinError.style.display = 'block';
      }
      return;
    }

    if (this.dom.btnUnlockAdmin) this.dom.btnUnlockAdmin.disabled = true;

    try {
      const valid = await this.auth.verifyAdminPIN(entered, this.presentationId);
      if (valid) {
        if (this.dom.adminPinError) this.dom.adminPinError.style.display = 'none';
        if (this.dom.inputAdminPin) this.dom.inputAdminPin.value = '';
        await this.startAdminSession();
      } else {
        if (this.dom.adminPinError) {
          this.dom.adminPinError.textContent = '✕ PIN incorreto.';
          this.dom.adminPinError.style.display = 'block';
        }
        if (this.dom.inputAdminPin) {
          this.dom.inputAdminPin.focus();
          this.dom.inputAdminPin.select();
        }
      }
    } finally {
      if (this.dom.btnUnlockAdmin) this.dom.btnUnlockAdmin.disabled = false;
    }
  }

  async unlockAdminWithLocalUser() {
    const u = (this.dom.inputAdminUser && this.dom.inputAdminUser.value) ? this.dom.inputAdminUser.value.trim() : '';
    const p = (this.dom.inputAdminPass && this.dom.inputAdminPass.value) ? this.dom.inputAdminPass.value.trim() : '';

    if (!u || !p) {
      if (this.dom.adminUserError) {
        this.dom.adminUserError.textContent = '✕ Informe o usuário e a senha.';
        this.dom.adminUserError.style.display = 'block';
      }
      return;
    }

    if (this.dom.btnUnlockUser) this.dom.btnUnlockUser.disabled = true;

    try {
      await this.auth.signInWithLocalCredentials(u, p);
      if (this.dom.adminUserError) this.dom.adminUserError.style.display = 'none';
      if (this.dom.inputAdminPass) this.dom.inputAdminPass.value = '';
      await this.startAdminSession();
    } catch (err) {
      if (this.dom.adminUserError) {
        this.dom.adminUserError.textContent = `✕ ${err.message || 'Usuário ou senha inválidos.'}`;
        this.dom.adminUserError.style.display = 'block';
      }
    } finally {
      if (this.dom.btnUnlockUser) this.dom.btnUnlockUser.disabled = false;
    }
  }

  async unlockAdminWithGoogle() {
    if (this.dom.btnUnlockGoogle) this.dom.btnUnlockGoogle.disabled = true;
    try {
      const user = await this.auth.signInWithGoogle();
      if (user && this.auth.isAdminAuthenticated()) {
        await this.startAdminSession();
      } else {
        alert('Este e-mail Google não possui permissão de moderador/administrador configurada em config/security.json.');
      }
    } catch (err) {
      alert('Erro na autenticação Google: ' + err.message);
    } finally {
      if (this.dom.btnUnlockGoogle) this.dom.btnUnlockGoogle.disabled = false;
    }
  }

  lockAdminSession() {
    this.auth.signOut();
    sessionStorage.removeItem('admin_pin_authenticated');
    this.sessionStarted = false;
    this.showLockScreen();
  }

  setupQRCode() {
    const audienceUrl = QREngine.getAudienceUrl(this.presentationId, this.sessionId);
    const customHost = localStorage.getItem(`session_qr_host_${this.sessionId}`);

    if (this.dom.audienceLink) {
      this.dom.audienceLink.href = audienceUrl;
      this.dom.audienceLink.textContent = audienceUrl;
    }
    if (this.dom.linkAudienceHeader) {
      this.dom.linkAudienceHeader.href = audienceUrl;
    }
    if (this.dom.linkPresenter) {
      this.dom.linkPresenter.href = `../presenter/?presentation=${encodeURIComponent(this.presentationId)}&session=${encodeURIComponent(this.sessionId)}`;
    }
    if (this.dom.linkPresenterQuestions) {
      this.dom.linkPresenterQuestions.href = `../presenter/?presentation=${encodeURIComponent(this.presentationId)}&session=${encodeURIComponent(this.sessionId)}&view=questions_wall`;
    }
    if (this.dom.linkPresenterPolls) {
      this.dom.linkPresenterPolls.href = `../presenter/?presentation=${encodeURIComponent(this.presentationId)}&session=${encodeURIComponent(this.sessionId)}&view=polls_live`;
    }
    if (this.dom.qrHostIndicator) {
      this.dom.qrHostIndicator.textContent = customHost ? `Host: ${customHost}` : 'Host: Padrão (Local)';
    }

    QREngine.renderQR(this.dom.qrBox, audienceUrl, 100);
  }

  updatePresenceMetrics() {
    const stats = this.realtime.getOnlineStats(this.sessionId);
    if (this.dom.statTotalOnline) this.dom.statTotalOnline.textContent = stats.total;
    if (this.dom.statLoggedOnline) this.dom.statLoggedOnline.textContent = stats.authenticated;
    if (this.dom.statAnonOnline) this.dom.statAnonOnline.textContent = stats.anonymous;
    if (this.dom.liveBadge) this.dom.liveBadge.textContent = i18n.t('admin.live_count', { count: stats.total });

    this.renderParticipantsList(stats.list);
  }

  renderParticipantsList(participants = []) {
    if (!this.dom.participantsList) return;

    if (participants.length === 0) {
      this.dom.participantsList.innerHTML = `
        <div style="color: var(--text-muted); font-size: 11.5px; text-align: center; padding: 10px;">
          ${i18n.t('admin.no_participants')}
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
              ${p.provider === 'google' ? 'Google' : p.provider === 'local' ? 'Local' : p.isAuthenticated ? 'Identificado' : 'Anônimo'} • ID: ${p.uid.substring(0, 8)}...
            </div>
          </div>
          <button class="btn btn-sm btn-admin-ban" data-uid="${p.uid}" style="padding: 2px 6px; font-size: 10px; border-color: ${isBlocked ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)'}; color: ${isBlocked ? '#6ee7b7' : '#fca5a5'};">
            ${isBlocked ? i18n.t('admin.btn_unban') : i18n.t('admin.btn_ban')}
          </button>
        </div>
      `;
    }).join('');
  }

  handleSessionUpdate(state) {
    if (!state) return;
    // NB02: renderizar condicionalmente — só quando o estado relevante mudou
    let needsPollRender = false;
    let needsModerationRender = false;

    if (typeof state.currentSlide === 'number' && this.engine.currentSlideIndex !== state.currentSlide) {
      this.engine.goToSlide(state.currentSlide);
      this.updateView();
      needsPollRender = true; // nova enquete pode estar no novo slide
    }
    if ('pacingMode' in state) {
      this.updatePacingUI(state.pacingMode);
    }
    if ('pollStatus' in state || 'showResults' in state) needsPollRender = true;
    if ('featuredQuestion' in state) needsModerationRender = true;

    if (needsPollRender) this.renderPollsList();
    if (needsModerationRender) this.renderModerationList();
  }

  updatePacingUI(mode) {
    if (this.dom.selectPacing && this.dom.selectPacing.value !== mode) {
      this.dom.selectPacing.value = mode;
    }
    if (this.dom.pacingBadge) {
      if (mode === 'free') {
        this.dom.pacingBadge.textContent = 'Livre';
        this.dom.pacingBadge.style.color = '#34d399';
        this.dom.pacingBadge.style.background = 'rgba(52, 211, 153, 0.15)';
      } else if (mode === 'strict_sync') {
        this.dom.pacingBadge.textContent = 'Estrito';
        this.dom.pacingBadge.style.color = '#f87171';
        this.dom.pacingBadge.style.background = 'rgba(248, 113, 113, 0.15)';
      } else {
        this.dom.pacingBadge.textContent = 'Trava Ativa';
        this.dom.pacingBadge.style.color = '#38bdf8';
        this.dom.pacingBadge.style.background = 'rgba(56, 189, 248, 0.15)';
      }
    }
  }

  async fetchEnvironmentDiagnostics() {
    const t0 = performance.now();
    try {
      const res = await fetch(`/api/diagnostics?session=${encodeURIComponent(this.sessionId)}&presentation=${encodeURIComponent(this.presentationId)}`);
      const latencyMs = Math.round(performance.now() - t0);
      if (!res.ok) return;
      const data = await res.json();
      this.updateDiagnosticsUI(data, latencyMs);
    } catch (e) {
      // Ignora silenciosamente em caso de oscilação momentânea de rede
    }
  }

  updateDiagnosticsUI(data, latencyMs) {
    if (!data) return;
    const sys = data.system || {};
    const deck = data.deck || {};

    if (this.dom.diagLatency) {
      this.dom.diagLatency.textContent = `${latencyMs}ms`;
      this.dom.diagLatency.style.color = latencyMs < 50 ? '#34d399' : latencyMs < 200 ? '#fcd34d' : '#f87171';
    }

    if (this.dom.diagCapacity) {
      const cap = deck.recommendedMaxAudienceLocalWifi || 100;
      this.dom.diagCapacity.textContent = `~${cap} celulares`;
      this.dom.diagCapacity.style.color = cap >= 80 ? '#34d399' : cap >= 40 ? '#fcd34d' : '#f87171';
    }

    if (this.dom.diagHealthBadge) {
      const score = deck.healthScore || 100;
      if (score >= 85) {
        this.dom.diagHealthBadge.textContent = `🟢 ${score}% Saudável`;
        this.dom.diagHealthBadge.style.color = '#34d399';
        this.dom.diagHealthBadge.style.background = 'rgba(52, 211, 153, 0.15)';
      } else if (score >= 60) {
        this.dom.diagHealthBadge.textContent = `🟡 ${score}% Atenção`;
        this.dom.diagHealthBadge.style.color = '#fcd34d';
        this.dom.diagHealthBadge.style.background = 'rgba(245, 158, 11, 0.15)';
      } else {
        this.dom.diagHealthBadge.textContent = `🔴 ${score}% Risco Alto`;
        this.dom.diagHealthBadge.style.color = '#f87171';
        this.dom.diagHealthBadge.style.background = 'rgba(248, 113, 113, 0.15)';
      }
    }

    if (this.dom.diagDeckWeight) {
      const totalKB = deck.totalDeckWeightKB || 0;
      const avgKB = deck.avgSlideWeightKB || 0;
      this.dom.diagDeckWeight.textContent = `${totalKB} KB (${avgKB} KB/slide)`;
    }

    if (this.dom.diagServerStats) {
      const mem = sys.residentMemoryMB ? `${sys.residentMemoryMB} MB` : '---';
      const up = sys.uptimeFormatted || '---';
      this.dom.diagServerStats.textContent = `${mem} • ${up}`;
    }

    if (this.dom.diagHeavyAlerts) {
      if (deck.hasHeavySlides && deck.heavySlides && deck.heavySlides.length > 0) {
        this.dom.diagHeavyAlerts.style.display = 'block';
        this.dom.diagHeavyAlerts.innerHTML = `
          <div style="font-weight: 700; margin-bottom: 3px; display: flex; align-items: center; gap: 4px;">
            ⚠️ Alerta de Pico Wi-Fi:
          </div>
          ${deck.heavySlides.map(hs => `
            <div style="margin-top: 2px;">
              • Slide #${hs.slideIndex} (${hs.sizeKB}KB): Rajada para 30 celulares gerará pico de <strong>${hs.burst30AttendeesMB}MB</strong>.
            </div>
          `).join('')}
        `;
      } else {
        this.dom.diagHeavyAlerts.style.display = 'none';
      }
    }

    this.updateSecurityHealthBadge();
  }

  updateSecurityHealthBadge() {
    const cfg = this.cachedSecurityConfig || (this.auth && this.auth.securityConfig) || {};
    const adminPin = (cfg.admin && cfg.admin.pin) ? String(cfg.admin.pin) : '2026';
    const users = (cfg.admin && Array.isArray(cfg.admin.users)) ? cfg.admin.users : ((cfg.users && Array.isArray(cfg.users)) ? cfg.users : []);
    const isCustomPin = (adminPin !== '2026' && adminPin.length >= 4);
    const hasUsers = users.length > 0;

    if (this.dom.secHealthBadge) {
      if (isCustomPin && hasUsers) {
        this.dom.secHealthBadge.textContent = '🟢 Seg. Alta';
        this.dom.secHealthBadge.style.background = 'rgba(52, 211, 153, 0.15)';
        this.dom.secHealthBadge.style.color = '#34d399';
      } else if (isCustomPin || hasUsers) {
        this.dom.secHealthBadge.textContent = '🟡 Seg. Média';
        this.dom.secHealthBadge.style.background = 'rgba(245, 158, 11, 0.15)';
        this.dom.secHealthBadge.style.color = '#fcd34d';
      } else {
        this.dom.secHealthBadge.textContent = '⚠️ PIN Padrão';
        this.dom.secHealthBadge.style.background = 'rgba(239, 68, 68, 0.15)';
        this.dom.secHealthBadge.style.color = '#fca5a5';
      }
    }

    if (this.dom.diagSecurityLevel) {
      if (isCustomPin && hasUsers) {
        this.dom.diagSecurityLevel.textContent = '🛡️ Alta (RBAC Ativo)';
        this.dom.diagSecurityLevel.style.color = '#34d399';
      } else if (isCustomPin || hasUsers) {
        this.dom.diagSecurityLevel.textContent = '🛡️ Média (Parcial)';
        this.dom.diagSecurityLevel.style.color = '#fcd34d';
      } else {
        this.dom.diagSecurityLevel.textContent = '⚠️ Padrão (Requer Setup)';
        this.dom.diagSecurityLevel.style.color = '#fca5a5';
      }
    }
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
    this.updateModerationTabBadges();
    const allQuestions = this.moderation.getQuestions(this.sessionId);

    const filtered = allQuestions.filter(q => {
      if (this.activeTab === 'pending') return q.status === 'pending';
      if (this.activeTab === 'approved') return (q.status === 'approved' || q.status === 'featured') && !q.answered;
      if (this.activeTab === 'answered') return q.answered === true;
      if (this.activeTab === 'rejected') return q.status === 'rejected';
      return true;
    });

    if (this.moderationSort === 'upvotes') {
      filtered.sort((a, b) => (b.upvotes || 0) - (a.upvotes || 0) || (b.timestamp - a.timestamp));
    } else {
      filtered.sort((a, b) => b.timestamp - a.timestamp);
    }

    if (!this.dom.moderationList) return;

    if (filtered.length === 0) {
      this.dom.moderationList.innerHTML = `
        <div style="text-align: center; color: var(--text-muted); padding: 40px; font-size: 13px;">
          ${i18n.t('admin.no_questions')}
        </div>
      `;
      return;
    }

    this.dom.moderationList.innerHTML = filtered.map(q => {
      const isFeatured = (q.status === 'featured');
      const isBlocked = this.moderation.isUserBlocked(this.sessionId, q.uid);
      const isAnswered = !!q.answered;
      const upvotesCount = q.upvotes || 0;
      let actionsHtml = '';

      if (q.status === 'pending') {
        actionsHtml = `
          <button class="btn btn-sm btn-primary btn-admin-mod" data-action="feature" data-qid="${q.id}" style="padding: 4px 8px; font-size: 11px;">
            ${i18n.t('admin.btn_feature')}
          </button>
          <button class="btn btn-sm btn-admin-mod" data-action="approve" data-qid="${q.id}" style="padding: 4px 8px; font-size: 11px; color: #6ee7b7; border-color: rgba(16,185,129,0.4);">
            ${i18n.t('admin.btn_approve')}
          </button>
          <button class="btn btn-sm btn-admin-mod" data-action="reject" data-qid="${q.id}" style="padding: 4px 8px; font-size: 11px; color: #fca5a5; border-color: rgba(239,68,68,0.4);">
            ${i18n.t('admin.btn_reject')}
          </button>
          <button class="btn btn-sm btn-admin-mod" data-action="delete" data-qid="${q.id}" style="padding: 4px 6px; font-size: 11px; color: #fca5a5;" title="Excluir">
            🗑️
          </button>
          <button class="btn btn-sm btn-admin-mod" data-action="block" data-uid="${q.uid}" style="padding: 4px 6px; font-size: 11px; color: ${isBlocked ? '#6ee7b7' : '#fca5a5'};" title="${isBlocked ? 'Desbloquear' : 'Banir'}">
            ${isBlocked ? '✓' : '🚫'}
          </button>
        `;
      } else if (q.status === 'approved' || q.status === 'featured') {
        if (!isAnswered) {
          actionsHtml = `
            <button class="btn btn-sm ${isFeatured ? 'btn-primary' : ''} btn-admin-mod" data-action="${isFeatured ? 'unfeature' : 'feature'}" data-qid="${q.id}" style="padding: 4px 8px; font-size: 11px;">
              ${isFeatured ? i18n.t('admin.btn_unfeature') : i18n.t('admin.btn_feature')}
            </button>
            <button class="btn btn-sm btn-admin-mod" data-action="toggle_answered" data-qid="${q.id}" style="padding: 4px 8px; font-size: 11px; background: rgba(16,185,129,0.2); border-color: rgba(16,185,129,0.4); color: #6ee7b7;">
              ${i18n.t('admin.btn_answered')}
            </button>
            <button class="btn btn-sm btn-admin-mod" data-action="reject" data-qid="${q.id}" style="padding: 4px 8px; font-size: 11px; color: #fca5a5;">
              ${i18n.t('admin.btn_reject')}
            </button>
            <button class="btn btn-sm btn-admin-mod" data-action="delete" data-qid="${q.id}" style="padding: 4px 6px; font-size: 11px; color: #fca5a5;" title="Excluir">
              🗑️
            </button>
          `;
        } else {
          actionsHtml = `
            <span class="badge" style="background: rgba(16,185,129,0.2); color: #6ee7b7; font-size: 10px; padding: 2px 8px;">✓ ${i18n.t('admin.tab_answered')}</span>
            <button class="btn btn-sm btn-admin-mod" data-action="toggle_answered" data-qid="${q.id}" style="padding: 4px 8px; font-size: 11px; color: #94a3b8;">
              ${i18n.t('admin.btn_reopen')}
            </button>
            <button class="btn btn-sm btn-admin-mod" data-action="delete" data-qid="${q.id}" style="padding: 4px 6px; font-size: 11px; color: #fca5a5;" title="Excluir">
              🗑️
            </button>
          `;
        }
      } else if (q.status === 'rejected') {
        actionsHtml = `
          <button class="btn btn-sm btn-admin-mod" data-action="approve" data-qid="${q.id}" style="padding: 4px 8px; font-size: 11px;">
            ${i18n.t('admin.btn_approve')}
          </button>
          <button class="btn btn-sm btn-admin-mod" data-action="delete" data-qid="${q.id}" style="padding: 4px 6px; font-size: 11px; color: #fca5a5;" title="Excluir">
            🗑️
          </button>
        `;
      }

      return `
        <div class="question-card ${isFeatured ? 'featured' : ''} ${isAnswered ? 'answered' : ''}">
          <div class="question-author">
            <span style="display: flex; align-items: center; gap: 6px;">
              <span>${q.authorAlias || 'Participante'}</span>
              <span class="badge" style="background: rgba(56,189,248,0.15); color: var(--accent-primary); font-size: 9.5px; padding: 1px 6px;">👍 ${upvotesCount}</span>
              ${isAnswered ? '<span class="badge" style="background: rgba(16,185,129,0.2); color: #6ee7b7; font-size: 9px; padding: 1px 5px;">Respondida</span>' : ''}
            </span>
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

  updateModerationTabBadges() {
    const allQuestions = this.moderation.getQuestions(this.sessionId);
    const pendingCount = allQuestions.filter(q => q.status === 'pending').length;
    const approvedCount = allQuestions.filter(q => (q.status === 'approved' || q.status === 'featured') && !q.answered).length;
    const answeredCount = allQuestions.filter(q => q.answered === true).length;
    const rejectedCount = allQuestions.filter(q => q.status === 'rejected').length;

    const tabPending = document.getElementById('admin-tab-pending');
    const tabApproved = document.getElementById('admin-tab-approved');
    const tabAnswered = document.getElementById('admin-tab-answered');
    const tabRejected = document.getElementById('admin-tab-rejected');

    if (tabPending) tabPending.textContent = `${i18n.t('admin.tab_pending')}${pendingCount > 0 ? ` (${pendingCount})` : ''}`;
    if (tabApproved) tabApproved.textContent = `${i18n.t('admin.tab_approved')}${approvedCount > 0 ? ` (${approvedCount})` : ''}`;
    if (tabAnswered) tabAnswered.textContent = `${i18n.t('admin.tab_answered')}${answeredCount > 0 ? ` (${answeredCount})` : ''}`;
    if (tabRejected) tabRejected.textContent = `${i18n.t('admin.tab_rejected')}${rejectedCount > 0 ? ` (${rejectedCount})` : ''}`;
  }

  playNotificationChime() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12); // A5
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.36);
    } catch (e) {}
  }

  renderPollsList() {
    if (!this.dom.pollsContainer || !this.engine.slidesData) return;

    const polls = [];
    this.engine.slidesData.slides.forEach((s, idx) => {
      if (s.interaction && s.interaction.poll) {
        polls.push({
          slideId: s.id,
          slideTitle: s.title,
          poll: s.interaction.poll,
          isCurrentSlide: (idx === this.engine.currentSlideIndex)
        });
      }
    });

    if (polls.length === 0) {
      this.dom.pollsContainer.innerHTML = `<div style="color: var(--text-muted); font-size: 12px;">${i18n.t('admin.no_polls')}</div>`;
      return;
    }

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
            <span style="color: var(--text-secondary);">${opt.id}. ${opt.text}</span>
            <span style="font-family: var(--font-mono); font-weight: 700; color: var(--accent-primary);">${opt.percentage}% (${opt.votes})</span>
          </div>
          <div class="poll-progress-track" style="height: 6px;">
            <div class="poll-progress-fill" style="width: ${opt.percentage}%;"></div>
          </div>
        </div>
      `).join('');

      return `
        <div class="card" style="padding: 14px; background: ${isCurrent ? 'var(--bg-tertiary)' : 'var(--bg-secondary)'}; border: ${isCurrent ? '1.5px solid var(--accent-primary)' : '1px solid var(--border-subtle)'};">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <span class="badge ${isCurrent ? 'badge-accent' : ''}" style="font-size: 10px;">
              ${isCurrent ? i18n.t('admin.slide_actual_badge') : `Slide ${item.slideId}`}
            </span>
            <span style="font-size: 11px; color: var(--text-muted); font-family: var(--font-mono);">${i18n.t('admin.votes_count', { count: res.totalVotes })}</span>
          </div>
          <div style="font-size: 13px; font-weight: 700; color: var(--text-primary); margin-bottom: 10px;">${item.poll.question}</div>
          <div>${barsHtml}</div>
          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 4px; margin-top: 10px;">
            <button class="btn btn-sm btn-admin-poll" data-action="open" data-pid="${item.poll.id}" style="font-size: 10px; padding: 4px 2px;">
              ${i18n.t('admin.open_poll')}
            </button>
            <button class="btn btn-sm btn-admin-poll" data-action="close" data-pid="${item.poll.id}" style="font-size: 10px; padding: 4px 2px; color: #fca5a5;">
              ${i18n.t('admin.close_poll')}
            </button>
            <button class="btn btn-sm btn-primary btn-admin-poll" data-action="results" data-pid="${item.poll.id}" style="font-size: 10px; padding: 4px 2px;">
              ${(isCurrent && sessionState.showResults) ? i18n.t('admin.hide_poll') : i18n.t('admin.project_poll')}
            </button>
            <button class="btn btn-sm btn-admin-poll" data-action="reset" data-pid="${item.poll.id}" style="font-size: 10px; padding: 4px 2px; border-color: rgba(239,68,68,0.3); color: #fca5a5;" title="Zerar votos">
              ${i18n.t('admin.reset_poll')}
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  // Modal de Host do QR Code
  openHostModal() {
    if (!this.dom.hostModal) return;
    const current = localStorage.getItem(`session_qr_host_${this.sessionId}`) || '';
    if (this.dom.inputCustomHost) this.dom.inputCustomHost.value = current;
    this.updateHostPreview();
    this.dom.hostModal.classList.add('active');
  }

  closeHostModal() {
    if (this.dom.hostModal) this.dom.hostModal.classList.remove('active');
  }

  updateHostPreview() {
    if (!this.dom.hostPreviewLink) return;
    const inputVal = this.dom.inputCustomHost ? this.dom.inputCustomHost.value.trim() : '';
    let previewHost = inputVal || window.location.origin;
    if (inputVal && !previewHost.startsWith('http://') && !previewHost.startsWith('https://')) {
      previewHost = 'http://' + previewHost;
    }
    const clean = previewHost.replace(/\/+$/, '');
    this.dom.hostPreviewLink.textContent = `${clean}/audience/?presentation=${this.presentationId}&session=${this.sessionId}`;
  }

  saveHostConfig() {
    const customHost = this.dom.inputCustomHost ? this.dom.inputCustomHost.value.trim() : '';
    const applied = QREngine.setCustomHost(this.sessionId, customHost);
    this.realtime.sendQRHostChange(this.sessionId, applied);
    this.setupQRCode();
    this.closeHostModal();
    alert('Endereço do QR Code atualizado com sucesso e propagado ao Telão!');
  }

  resetHostDefault() {
    QREngine.resetCustomHost(this.sessionId);
    this.realtime.sendQRHostChange(this.sessionId, window.location.origin);
    this.setupQRCode();
    this.closeHostModal();
    alert('Endereço restaurado para o padrão do navegador.');
  }

  openHistoryModal() {
    if (!this.dom.historyModal) return;
    this.renderHistorySessionsList();
    this.dom.historyModal.classList.add('active');
  }

  closeHistoryModal() {
    if (this.dom.historyModal) {
      this.dom.historyModal.classList.remove('active');
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
              📥 JSON
            </button>
            ${!isCurrent ? `
              <button class="btn btn-sm btn-delete-single-session" data-sid="${s.sessionId}" style="font-size: 11px; padding: 4px 8px; border-color: rgba(239,68,68,0.4); color: #fca5a5;">
                🗑️
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
      this.dom.newSessionModal.classList.add('active');
    }
  }

  closeNewSessionModal() {
    if (this.dom.newSessionModal) {
      this.dom.newSessionModal.classList.remove('active');
    }
  }

  bindEvents() {
    // Alternância de Idioma e Tema
    if (this.dom.btnToggleLang) {
      this.dom.btnToggleLang.addEventListener('click', () => {
        i18n.toggleLanguage();
        this.updateLanguageButton();
        this.updateThemeButton();
        this.renderModerationList();
        this.renderPollsList();
      });
    }

    if (this.dom.btnToggleTheme) {
      this.dom.btnToggleTheme.addEventListener('click', () => {
        theme.cycleTheme();
        this.updateThemeButton();
      });
    }

    // Modal de Host do QR Code
    if (this.dom.btnConfigureHost) {
      this.dom.btnConfigureHost.addEventListener('click', () => this.openHostModal());
    }
    if (this.dom.btnCloseHostModal) {
      this.dom.btnCloseHostModal.addEventListener('click', () => this.closeHostModal());
    }
    if (this.dom.inputCustomHost) {
      this.dom.inputCustomHost.addEventListener('input', () => this.updateHostPreview());
    }
    if (this.dom.btnSaveHostConfig) {
      this.dom.btnSaveHostConfig.addEventListener('click', () => this.saveHostConfig());
    }
    if (this.dom.btnResetHostDefault) {
      this.dom.btnResetHostDefault.addEventListener('click', () => this.resetHostDefault());
    }

    // Projetar Apresentação no Telão para Todos (Broadcast Switch)
    if (this.dom.btnSwitchProject) {
      this.dom.btnSwitchProject.addEventListener('click', () => {
        const sel = this.dom.presSelector ? this.dom.presSelector.value : this.presentationId;
        const ok = confirm(`Deseja projetar a apresentação "${sel}" para o telão e celulares de todos os participantes ao vivo?`);
        if (ok) {
          this.realtime.sendPresentationSwitch(this.sessionId, sel);
          if (sel !== this.presentationId) {
            window.location.href = `?presentation=${encodeURIComponent(sel)}&session=${encodeURIComponent(this.sessionId)}`;
          }
        }
      });
    }

    // Alternância de Apresentação no Seletor Local
    if (this.dom.presSelector) {
      this.dom.presSelector.addEventListener('change', (e) => {
        const newPresId = e.target.value;
        if (newPresId && newPresId !== this.presentationId) {
          window.location.href = `?presentation=${encodeURIComponent(newPresId)}&session=${encodeURIComponent(this.sessionId)}`;
        }
      });
    }

    // Navegação Remota
    if (this.dom.btnPrev) {
      this.dom.btnPrev.addEventListener('click', async () => {
        this.engine.prevSlide();
        this.sessionManager.trackSlideDwellTime(this.engine.currentSlideIndex);
        await this.realtime.setSlide(this.sessionId, this.engine.currentSlideIndex, this.engine.currentSlide);
        this.updateView();
      });
    }

    if (this.dom.btnNext) {
      this.dom.btnNext.addEventListener('click', async () => {
        this.engine.nextSlide();
        this.sessionManager.trackSlideDwellTime(this.engine.currentSlideIndex);
        await this.realtime.setSlide(this.sessionId, this.engine.currentSlideIndex, this.engine.currentSlide);
        this.updateView();
      });
    }

    // Botão de Bloqueio/Logout no Header
    if (this.dom.btnLock) {
      this.dom.btnLock.addEventListener('click', () => this.lockAdminSession());
    }

    // Abas de Autenticação da Mesa Técnica
    if (this.dom.tabAuthPin) {
      this.dom.tabAuthPin.addEventListener('click', () => this.switchAuthTab('pin'));
    }
    if (this.dom.tabAuthLocal) {
      this.dom.tabAuthLocal.addEventListener('click', () => this.switchAuthTab('local'));
    }
    if (this.dom.tabAuthGoogle) {
      this.dom.tabAuthGoogle.addEventListener('click', () => this.switchAuthTab('google'));
    }

    // Desbloqueio da Mesa Técnica por PIN
    if (this.dom.btnUnlockAdmin) {
      this.dom.btnUnlockAdmin.addEventListener('click', () => this.unlockAdminWithPin());
    }
    if (this.dom.inputAdminPin) {
      this.dom.inputAdminPin.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this.unlockAdminWithPin();
      });
    }

    // Desbloqueio por Usuário & Senha Local
    if (this.dom.btnUnlockUser) {
      this.dom.btnUnlockUser.addEventListener('click', () => this.unlockAdminWithLocalUser());
    }
    if (this.dom.inputAdminUser) {
      this.dom.inputAdminUser.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          if (this.dom.inputAdminPass) this.dom.inputAdminPass.focus();
        }
      });
    }
    if (this.dom.inputAdminPass) {
      this.dom.inputAdminPass.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this.unlockAdminWithLocalUser();
      });
    }

    // Desbloqueio por Google Workspace
    if (this.dom.btnUnlockGoogle) {
      this.dom.btnUnlockGoogle.addEventListener('click', () => this.unlockAdminWithGoogle());
    }

    // Modal de Gestão de Segurança & RBAC (Plano 14 - Fase 2)
    if (this.dom.btnSecurity) {
      this.dom.btnSecurity.addEventListener('click', () => this.openSecuritySettingsModal());
    }
    if (this.dom.btnCloseSecurityModal) {
      this.dom.btnCloseSecurityModal.addEventListener('click', () => this.closeSecuritySettingsModal());
    }
    if (this.dom.btnCloseSecurityModalFooter) {
      this.dom.btnCloseSecurityModalFooter.addEventListener('click', () => this.closeSecuritySettingsModal());
    }
    if (this.dom.securityModal) {
      this.dom.securityModal.addEventListener('click', (e) => {
        if (e.target === this.dom.securityModal) this.closeSecuritySettingsModal();
      });
    }
    if (this.dom.secTabPinBtn) {
      this.dom.secTabPinBtn.addEventListener('click', () => this.switchSecurityTab('pin'));
    }
    if (this.dom.secTabUsersBtn) {
      this.dom.secTabUsersBtn.addEventListener('click', () => this.switchSecurityTab('users'));
    }
    if (this.dom.secTabAudienceBtn) {
      this.dom.secTabAudienceBtn.addEventListener('click', () => this.switchSecurityTab('audience'));
    }
    if (this.dom.secTabGoogleBtn) {
      this.dom.secTabGoogleBtn.addEventListener('click', () => this.switchSecurityTab('google'));
    }
    if (this.dom.secBtnGeneratePin) {
      this.dom.secBtnGeneratePin.addEventListener('click', () => {
        const pin = Math.floor(1000 + Math.random() * 9000).toString();
        if (this.dom.secInputPin) this.dom.secInputPin.value = pin;
      });
    }

    const handleMethodToggle = (toggledElem) => {
      let activeCount = 0;
      if (this.dom.secMethodTogglePin && this.dom.secMethodTogglePin.checked) activeCount++;
      if (this.dom.secMethodToggleLocal && this.dom.secMethodToggleLocal.checked) activeCount++;
      if (this.dom.secMethodToggleGoogle && this.dom.secMethodToggleGoogle.checked) activeCount++;

      if (activeCount === 0) {
        alert('Pelo menos um método de autenticação (PIN, Usuário Local ou Google) deve permanecer ativo.');
        if (toggledElem) toggledElem.checked = true;
      }
      this.updateMultiAuthCounters();
    };

    if (this.dom.secMethodTogglePin) {
      this.dom.secMethodTogglePin.addEventListener('change', () => handleMethodToggle(this.dom.secMethodTogglePin));
    }
    if (this.dom.secMethodToggleLocal) {
      this.dom.secMethodToggleLocal.addEventListener('change', () => handleMethodToggle(this.dom.secMethodToggleLocal));
    }
    if (this.dom.secMethodToggleGoogle) {
      this.dom.secMethodToggleGoogle.addEventListener('change', () => handleMethodToggle(this.dom.secMethodToggleGoogle));
    }

    if (this.dom.secBtnShowAddUser) {
      this.dom.secBtnShowAddUser.addEventListener('click', () => this.showAddAdminUserForm());
    }
    if (this.dom.secBtnCancelUserForm) {
      this.dom.secBtnCancelUserForm.addEventListener('click', () => {
        if (this.dom.secUserFormCard) this.dom.secUserFormCard.style.display = 'none';
        this.editingAdminUserIndex = null;
      });
    }
    if (this.dom.secBtnSaveUserForm) {
      this.dom.secBtnSaveUserForm.addEventListener('click', () => this.saveAdminUserFromForm());
    }
    if (this.dom.secBtnAddAudienceUser) {
      this.dom.secBtnAddAudienceUser.addEventListener('click', () => this.promptAddAudienceUser());
    }
    if (this.dom.btnSaveSecuritySettings) {
      this.dom.btnSaveSecuritySettings.addEventListener('click', () => this.saveSecuritySettings());
    }

    // Modal de Histórico
    if (this.dom.btnHistory) {
      this.dom.btnHistory.addEventListener('click', () => this.openHistoryModal());
    }
    if (this.dom.cardBtnHistory) {
      this.dom.cardBtnHistory.addEventListener('click', () => this.openHistoryModal());
    }
    if (this.dom.btnCloseHistoryModal) {
      this.dom.btnCloseHistoryModal.addEventListener('click', () => this.closeHistoryModal());
    }
    if (this.dom.btnDoneHistory) {
      this.dom.btnDoneHistory.addEventListener('click', () => this.closeHistoryModal());
    }
    if (this.dom.historyModal) {
      this.dom.historyModal.addEventListener('click', (e) => {
        if (e.target === this.dom.historyModal) this.closeHistoryModal();
      });
    }

    // Modal de Nova Sessão
    if (this.dom.btnNewSession) {
      this.dom.btnNewSession.addEventListener('click', () => this.openNewSessionModal());
    }
    if (this.dom.btnCloseNewSessionModal) {
      this.dom.btnCloseNewSessionModal.addEventListener('click', () => this.closeNewSessionModal());
    }
    if (this.dom.newSessionModal) {
      this.dom.newSessionModal.addEventListener('click', (e) => {
        if (e.target === this.dom.newSessionModal) this.closeNewSessionModal();
      });
    }

    // Modal de Analytics (Plano 09 - Fase 2)
    if (this.dom.btnAnalytics) {
      this.dom.btnAnalytics.addEventListener('click', () => this.openAnalyticsModal());
    }
    if (this.dom.cardBtnAnalytics) {
      this.dom.cardBtnAnalytics.addEventListener('click', () => this.openAnalyticsModal());
    }
    if (this.dom.btnCloseAnalyticsModal) {
      this.dom.btnCloseAnalyticsModal.addEventListener('click', () => this.closeAnalyticsModal());
    }
    if (this.dom.btnDoneAnalytics) {
      this.dom.btnDoneAnalytics.addEventListener('click', () => this.closeAnalyticsModal());
    }
    if (this.dom.analyticsModal) {
      this.dom.analyticsModal.addEventListener('click', (e) => {
        if (e.target === this.dom.analyticsModal) this.closeAnalyticsModal();
      });
    }
    if (this.dom.analyticsSelectSession) {
      this.dom.analyticsSelectSession.addEventListener('change', (e) => {
        this.renderAnalyticsDashboard(e.target.value);
      });
    }
    if (this.dom.analyticsBtnRefresh) {
      this.dom.analyticsBtnRefresh.addEventListener('click', () => {
        const val = this.dom.analyticsSelectSession ? this.dom.analyticsSelectSession.value : 'LIVE';
        this.renderAnalyticsDashboard(val);
      });
    }
    if (this.dom.analyticsBtnArchiveNow) {
      this.dom.analyticsBtnArchiveNow.addEventListener('click', () => {
        this.archiveCurrentSessionNow();
      });
    }
    if (this.dom.analyticsBtnExportHTML) {
      this.dom.analyticsBtnExportHTML.addEventListener('click', () => {
        this.exportCurrentAnalyticsHTML();
      });
    }
    if (this.dom.analyticsBtnExportCSV) {
      this.dom.analyticsBtnExportCSV.addEventListener('click', () => {
        this.exportCurrentAnalyticsCSV();
      });
    }
    if (this.dom.analyticsBtnExportJSON) {
      this.dom.analyticsBtnExportJSON.addEventListener('click', () => {
        this.exportCurrentAnalyticsJSON();
      });
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

    // Ordenação de moderação (Recentes vs Upvotes)
    const btnSortRecent = document.getElementById('admin-sort-recent');
    const btnSortUpvotes = document.getElementById('admin-sort-upvotes');
    if (btnSortRecent && btnSortUpvotes) {
      btnSortRecent.addEventListener('click', () => {
        this.moderationSort = 'recent';
        btnSortRecent.style.fontWeight = '700';
        btnSortRecent.style.background = 'var(--bg-card)';
        btnSortUpvotes.style.fontWeight = 'normal';
        btnSortUpvotes.style.background = 'transparent';
        this.renderModerationList();
      });
      btnSortUpvotes.addEventListener('click', () => {
        this.moderationSort = 'upvotes';
        btnSortUpvotes.style.fontWeight = '700';
        btnSortUpvotes.style.background = 'var(--bg-card)';
        btnSortRecent.style.fontWeight = 'normal';
        btnSortRecent.style.background = 'transparent';
        this.renderModerationList();
      });
    }

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
          } else if (action === 'toggle_answered') {
            await this.moderation.toggleQuestionAnswered(this.sessionId, qid);
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

    // Exportação JSON
    if (this.dom.btnExport) {
      this.dom.btnExport.addEventListener('click', () => {
        const report = this.sessionManager.compileSessionReport(this.sessionId, this.engine.slidesData);
        const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
        this._downloadFile(blob, `relatorio_sessao_${this.sessionId}.json`);
      });
    }

    // Exportação CSV (Excel)
    if (this.dom.btnExportCsv) {
      this.dom.btnExportCsv.addEventListener('click', () => {
        const csv = this.sessionManager.exportSessionCSV(this.sessionId, this.engine.slidesData);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        this._downloadFile(blob, `votos_sessao_${this.sessionId}.csv`);
      });
    }

    // Exportação Markdown
    if (this.dom.btnExportMd) {
      this.dom.btnExportMd.addEventListener('click', () => {
        const md = this.sessionManager.exportSessionMarkdown(this.sessionId, this.engine.slidesData);
        const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
        this._downloadFile(blob, `resumo_sessao_${this.sessionId}.md`);
      });
    }

    // Exportação Deck Completo (HTML / PDF-ready) - Fase 4
    if (this.dom.btnExportDeckHtml) {
      this.dom.btnExportDeckHtml.addEventListener('click', () => {
        this.sessionManager.downloadFullDeckHTML(this.sessionId, this.engine.manifest, this.engine.slidesData);
      });
    }

    // Exportação do Pacote ZIP Completo (.slidemesh.zip) - Plano 12
    if (this.dom.btnExportDeckZip) {
      this.dom.btnExportDeckZip.addEventListener('click', () => {
        window.location.href = `/api/presentations/export?id=${encodeURIComponent(this.presentationId)}`;
      });
    }

    // Controle de Ritmo da Plateia (Audience Pacing Lock) - Fase 2
    if (this.dom.selectPacing) {
      this.dom.selectPacing.addEventListener('change', async (e) => {
        const mode = e.target.value;
        await this.interaction.setPacingMode(this.sessionId, mode);
        this.updatePacingUI(mode);
      });
    }

    // Painel de Efeitos Visuais no Telão (Demanda 02 - Fase 2)
    const fxButtons = document.querySelectorAll('.btn-stage-fx');
    fxButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const fxType = btn.dataset.fx || 'confetti';
        this.triggerStageFX(fxType);
      });
    });

    // Controle Remoto de Mídia no Telão (Plano 11 - Fase 3)
    const mediaButtons = document.querySelectorAll('.btn-media-action');
    mediaButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action || 'play';
        this.triggerMediaAction(action);
      });
    });
  }

  triggerMediaAction(action, options = {}) {
    this.realtime.triggerMediaAction(this.sessionId, action, options);
    if (this.dom.mediaStatusBadge) {
      const labels = {
        play: '▶️ Reproduzindo',
        pause: '⏸️ Pausado',
        restart: '🔄 Reiniciado',
        toggle_mute: '🔇 Mudo/Áudio',
        seek: '⏩ Ajustado'
      };
      this.dom.mediaStatusBadge.textContent = labels[action] || 'Pronto';
      this.dom.mediaStatusBadge.style.color = '#34d399';
      this.dom.mediaStatusBadge.style.background = 'rgba(52, 211, 153, 0.15)';
      setTimeout(() => {
        if (this.dom.mediaStatusBadge) {
          this.dom.mediaStatusBadge.textContent = i18n.t('admin.media_standby');
          this.dom.mediaStatusBadge.style.color = '#c4b5fd';
          this.dom.mediaStatusBadge.style.background = 'rgba(167, 139, 250, 0.15)';
        }
      }, 2500);
    }
  }

  triggerStageFX(fxType) {
    if (this.fxCooldownActive) return;
    this.fxCooldownActive = true;

    // Dispara via RealtimeEngine para todos os nós conectados
    this.realtime.triggerStageFX(this.sessionId, fxType);

    // Cooldown de 3 segundos com feedback visual anti-spam
    let remaining = 3;
    const buttons = document.querySelectorAll('.btn-stage-fx');
    buttons.forEach(b => {
      b.disabled = true;
      b.style.opacity = '0.4';
      b.style.cursor = 'not-allowed';
    });

    const updateBadge = () => {
      if (this.dom.fxCooldownBadge) {
        this.dom.fxCooldownBadge.textContent = i18n.t('admin.fx_cooldown', { seconds: remaining });
        this.dom.fxCooldownBadge.style.color = '#fbbf24';
        this.dom.fxCooldownBadge.style.background = 'rgba(245, 158, 11, 0.15)';
      }
    };

    updateBadge();

    this.fxCooldownTimer = setInterval(() => {
      remaining--;
      if (remaining > 0) {
        updateBadge();
      } else {
        clearInterval(this.fxCooldownTimer);
        this.fxCooldownTimer = null;
        this.fxCooldownActive = false;

        buttons.forEach(b => {
          b.disabled = false;
          b.style.opacity = '1';
          b.style.cursor = 'pointer';
        });

        if (this.dom.fxCooldownBadge) {
          this.dom.fxCooldownBadge.textContent = i18n.t('admin.fx_ready');
          this.dom.fxCooldownBadge.style.color = '#f472b6';
          this.dom.fxCooldownBadge.style.background = 'rgba(236, 72, 153, 0.15)';
        }
      }
    }, 1000);
  }

  _downloadFile(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ==========================================
  // Métodos de Analytics Avançado (Plano 09)
  // ==========================================
  async openAnalyticsModal() {
    if (!this.dom.analyticsModal) return;
    this.dom.analyticsModal.classList.add('active');
    await this.loadAnalyticsSessionOptions();
    await this.renderAnalyticsDashboard('LIVE');
  }

  closeAnalyticsModal() {
    if (this.dom.analyticsModal) {
      this.dom.analyticsModal.classList.remove('active');
    }
  }

  async loadAnalyticsSessionOptions() {
    if (!this.dom.analyticsSelectSession) return;
    const history = await this.sessionManager.fetchRemoteAnalyticsHistory();
    let html = `<option value="LIVE">⚡ ${i18n.t('admin.analytics_live_option') || 'Sessão Ao Vivo Atual'}</option>`;

    history.forEach(s => {
      const dt = new Date(s.savedAt).toLocaleDateString() + ' ' + new Date(s.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      html += `<option value="${s.sessionId}">📁 #${s.sessionId} (${s.presentationSlug} • ${dt})</option>`;
    });

    this.dom.analyticsSelectSession.innerHTML = html;
  }

  async renderAnalyticsDashboard(selectedSessionId = 'LIVE') {
    let analyticsData = null;

    if (selectedSessionId === 'LIVE' || !selectedSessionId) {
      const liveSessionData = {
        state: { currentSlide: this.engine.currentSlideIndex, presentationId: this.presentationId },
        questions: this.moderation.getQuestions(this.sessionId),
        votes: this.interaction.getAllVotes(this.sessionId) || {},
        presence: this.presenceState || {},
        presenceCount: Object.keys(this.presenceState || {}).length
      };
      analyticsData = this.sessionManager.buildSessionAnalyticsPayload(
        this.sessionId,
        liveSessionData,
        this.engine.manifest,
        this.engine.slidesData ? this.engine.slidesData.slides : []
      );
    } else {
      const record = await this.sessionManager.fetchRemoteSessionAnalytics(selectedSessionId);
      if (record && record.data) {
        analyticsData = record.data;
      }
    }

    if (!analyticsData) return;
    this.currentViewedAnalytics = analyticsData;

    // Atualiza KPIs
    const summary = analyticsData.summary || {};
    if (this.dom.analyticsKpiParticipants) {
      this.dom.analyticsKpiParticipants.textContent = summary.totalParticipants || 0;
    }
    if (this.dom.analyticsKpiDuration) {
      const sec = analyticsData.durationSeconds || 0;
      const m = Math.floor(sec / 60);
      const s = sec % 60;
      this.dom.analyticsKpiDuration.textContent = `${m}m ${s}s`;
    }
    if (this.dom.analyticsKpiVotes) {
      this.dom.analyticsKpiVotes.textContent = summary.totalVotesCast || 0;
    }
    if (this.dom.analyticsKpiQuestions) {
      this.dom.analyticsKpiQuestions.textContent = `${summary.totalQuestionsApproved || 0} (${summary.totalUpvotes || 0} 👍)`;
    }

    // Renderiza gráfico de barras Dwell Time no Canvas
    this.renderDwellTimeChart(this.dom.canvasDwellTime, analyticsData.slideMetrics || []);

    // Renderiza Enquetes
    this.renderAnalyticsPolls(this.dom.analyticsPollsContainer, analyticsData.pollBreakdown || []);

    // Renderiza Top Perguntas
    this.renderAnalyticsTopQuestions(this.dom.analyticsQuestionsContainer, analyticsData.topQuestions || []);
  }

  renderDwellTimeChart(canvas, slideMetrics) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    if (!slideMetrics || slideMetrics.length === 0) {
      ctx.fillStyle = '#64748b';
      ctx.font = '12px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Nenhum dado de permanência coletado ainda.', width / 2, height / 2);
      return;
    }

    const maxSeconds = Math.max(10, ...slideMetrics.map(s => s.dwellTimeSeconds || 0));
    const padding = { top: 20, right: 20, bottom: 35, left: 40 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Linhas de grade horizontais
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (chartHeight * i / 4);
      const val = Math.round(maxSeconds * (4 - i) / 4);
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();

      ctx.fillStyle = '#64748b';
      ctx.font = '10px JetBrains Mono, monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${val}s`, padding.left - 6, y + 3);
    }

    // Barras
    const barCount = slideMetrics.length;
    const barWidth = Math.max(12, Math.min(48, (chartWidth / barCount) - 10));
    const step = chartWidth / barCount;

    slideMetrics.forEach((m, idx) => {
      const x = padding.left + (idx * step) + (step - barWidth) / 2;
      const barH = (m.dwellTimeSeconds / maxSeconds) * chartHeight;
      const y = padding.top + chartHeight - barH;

      // Gradiente da barra
      const grad = ctx.createLinearGradient(0, y, 0, y + barH);
      grad.addColorStop(0, '#38bdf8');
      grad.addColorStop(1, '#818cf8');

      ctx.fillStyle = grad;
      ctx.beginPath();
      const r = Math.min(4, barWidth / 2);
      ctx.moveTo(x, y + barH);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.lineTo(x + barWidth - r, y);
      ctx.quadraticCurveTo(x + barWidth, y, x + barWidth, y + r);
      ctx.lineTo(x + barWidth, y + barH);
      ctx.closePath();
      ctx.fill();

      // Valor no topo da barra
      ctx.fillStyle = '#ffffff';
      ctx.font = '10px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      if (barH > 14) {
        ctx.fillText(`${m.dwellTimeSeconds}s`, x + barWidth / 2, y - 4);
      }

      // Rótulo no eixo X
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`S${idx + 1}`, x + barWidth / 2, height - 12);
    });
  }

  renderAnalyticsPolls(container, pollBreakdown) {
    if (!container) return;
    if (!pollBreakdown || pollBreakdown.length === 0) {
      container.innerHTML = `<div style="font-size: 11.5px; color: var(--text-muted); padding: 8px;">Nenhuma enquete registrada nesta sessão.</div>`;
      return;
    }

    container.innerHTML = pollBreakdown.map(p => {
      return `
        <div style="background: rgba(15,23,42,0.8); border: 1px solid var(--border-subtle); border-radius: 6px; padding: 10px;">
          <div style="font-size: 11.5px; font-weight: 700; color: var(--accent-primary); margin-bottom: 4px;">
            📊 Enquete: #${p.pollId} (${p.totalVotes || 0} votos)
          </div>
          <div style="font-size: 11px; color: #cbd5e1;">
            ${Array.isArray(p.options) ? p.options.map(o => `<div>• ${o.id}: <strong>${o.percentage || 0}%</strong> (${o.votes || 0})</div>`).join('') : `Total de Votos: ${p.totalVotes}`}
          </div>
        </div>
      `;
    }).join('');
  }

  renderAnalyticsTopQuestions(container, topQuestions) {
    if (!container) return;
    if (!topQuestions || topQuestions.length === 0) {
      container.innerHTML = `<div style="font-size: 11.5px; color: var(--text-muted); padding: 8px;">Nenhuma pergunta aprovada nesta sessão.</div>`;
      return;
    }

    container.innerHTML = topQuestions.slice(0, 5).map((q, idx) => `
      <div style="background: rgba(15,23,42,0.8); border: 1px solid var(--border-subtle); border-radius: 6px; padding: 8px 10px; display: flex; justify-content: space-between; align-items: center; gap: 8px;">
        <div style="font-size: 12px; color: #ffffff; flex: 1;">
          <span style="font-weight: 700; color: #f472b6;">#${idx + 1}</span> ${q.text}
        </div>
        <span class="badge" style="background: rgba(56,189,248,0.15); color: #38bdf8; font-size: 10px; padding: 2px 6px;">
          👍 ${q.upvotes || 0}
        </span>
      </div>
    `).join('');
  }

  async archiveCurrentSessionNow() {
    if (!this.dom.analyticsBtnArchiveNow) return;
    this.dom.analyticsBtnArchiveNow.disabled = true;
    this.dom.analyticsBtnArchiveNow.textContent = '⏳ Salvando...';

    const liveSessionData = {
      state: { currentSlide: this.engine.currentSlideIndex, presentationId: this.presentationId },
      questions: this.moderation.getQuestions(this.sessionId),
      votes: this.interaction.getAllVotes(this.sessionId) || {},
      presence: this.presenceState || {},
      presenceCount: Object.keys(this.presenceState || {}).length
    };

    const payload = this.sessionManager.buildSessionAnalyticsPayload(
      this.sessionId,
      liveSessionData,
      this.engine.manifest,
      this.engine.slidesData ? this.engine.slidesData.slides : []
    );

    const res = await this.sessionManager.archiveSessionRemotely({
      sessionId: this.sessionId,
      payload
    });

    if (res && res.success) {
      alert(`Sessão #${this.sessionId} arquivada com sucesso no servidor!`);
      await this.loadAnalyticsSessionOptions();
      if (this.dom.analyticsSelectSession) {
        this.dom.analyticsSelectSession.value = this.sessionId;
      }
      await this.renderAnalyticsDashboard(this.sessionId);
    } else {
      alert('Erro ao arquivar sessão: ' + (res.error || 'Falha de comunicação'));
    }

    this.dom.analyticsBtnArchiveNow.disabled = false;
    this.dom.analyticsBtnArchiveNow.textContent = i18n.t('admin.analytics_archive_btn') || '💾 Arquivar Agora';
  }

  exportCurrentAnalyticsHTML() {
    const data = this.currentViewedAnalytics;
    if (!data) return;
    this.sessionManager.downloadExecutiveHTMLReport(data);
  }

  exportCurrentAnalyticsCSV() {
    const data = this.currentViewedAnalytics;
    if (!data) return;
    this.sessionManager.downloadAnalyticsCSV(data);
  }

  exportCurrentAnalyticsJSON() {
    const data = this.currentViewedAnalytics;
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8;' });
    this._downloadFile(blob, `analytics_${data.sessionId || 'session'}.json`);
  }

  // ==========================================
  // Gestão de Segurança & RBAC (Plano 14 - Fase 2)
  // ==========================================
  async openSecuritySettingsModal() {
    if (!this.dom.securityModal) return;
    this.dom.securityModal.classList.add('active');
    this.switchSecurityTab('pin');
    if (this.dom.secFeedbackMsg) {
      this.dom.secFeedbackMsg.style.display = 'none';
    }
    if (this.dom.secUserFormCard) {
      this.dom.secUserFormCard.style.display = 'none';
    }

    try {
      const res = await fetch('/api/security/config?t=' + Date.now());
      if (res.ok) {
        const data = await res.json();
        this.cachedSecurityConfig = data.config || {};
        this.populateSecurityModalUI(this.cachedSecurityConfig);
      } else {
        this.showSecurityFeedback('Não foi possível carregar as configurações do servidor.', false);
      }
    } catch (err) {
      console.error('Erro ao abrir configurações de segurança:', err);
      this.showSecurityFeedback('Erro ao processar configurações de segurança: ' + (err.message || 'Falha de conexão.'), false);
    }
  }

  closeSecuritySettingsModal() {
    if (this.dom.securityModal) {
      this.dom.securityModal.classList.remove('active');
    }
  }

  switchSecurityTab(tab) {
    const tabs = ['pin', 'users', 'audience', 'google'];
    tabs.forEach(t => {
      const btn = this.dom[`secTab${t.charAt(0).toUpperCase() + t.slice(1)}Btn`];
      const panel = this.dom[`secPanel${t.charAt(0).toUpperCase() + t.slice(1)}`];
      if (btn && panel) {
        if (t === tab) {
          btn.className = 'btn btn-sm btn-primary';
          btn.style.background = '';
          btn.style.borderColor = '';
          btn.style.color = '';
          panel.style.display = 'block';
        } else {
          btn.className = 'btn btn-sm';
          btn.style.background = 'transparent';
          btn.style.borderColor = 'transparent';
          btn.style.color = 'var(--text-muted)';
          panel.style.display = 'none';
        }
      }
    });
  }

  populateSecurityModalUI(cfg) {
    if (!cfg) return;
    const admin = cfg.admin || {};
    const audience = cfg.offlineAudience || {};
    const multiAuth = cfg.multiAuth || {};
    const methods = multiAuth.methods || {};
    const scopes = multiAuth.scopes || {};

    if (this.dom.secInputPin) {
      this.dom.secInputPin.value = admin.pin || '2026';
    }
    if (this.dom.secCheckRequirePin) {
      this.dom.secCheckRequirePin.checked = scopes.admin !== undefined ? scopes.admin : (admin.requirePinForAdmin !== false);
    }
    if (this.dom.secCheckScopePresenter) {
      this.dom.secCheckScopePresenter.checked = scopes.presenter !== false;
    }
    if (this.dom.secCheckScopeStudio) {
      this.dom.secCheckScopeStudio.checked = scopes.studio !== false;
    }
    if (this.dom.secCheckScopePortal) {
      this.dom.secCheckScopePortal.checked = scopes.portal === true || cfg.catalog?.requireAuth === true;
    }

    // Toggles dos métodos
    if (this.dom.secMethodTogglePin) {
      this.dom.secMethodTogglePin.checked = methods.pin !== false;
    }
    if (this.dom.secMethodToggleLocal) {
      this.dom.secMethodToggleLocal.checked = methods.localUsers !== false;
    }
    if (this.dom.secMethodToggleGoogle) {
      this.dom.secMethodToggleGoogle.checked = methods.google !== false && (admin.allowedEmails?.length > 0);
    }

    if (this.dom.secCheckAudienceEnabled) {
      this.dom.secCheckAudienceEnabled.checked = audience.enabled !== false;
    }
    if (this.dom.secInputAllowedEmails) {
      this.dom.secInputAllowedEmails.value = (admin.allowedEmails || []).join(', ');
    }

    this.updateMultiAuthCounters();
    this.renderSecurityAdminUsers();
    this.renderSecurityAudienceUsers();
  }

  updateMultiAuthCounters() {
    const adminUsers = (this.cachedSecurityConfig && this.cachedSecurityConfig.admin && this.cachedSecurityConfig.admin.users) || [];
    const emails = (this.cachedSecurityConfig && this.cachedSecurityConfig.admin && this.cachedSecurityConfig.admin.allowedEmails) || [];

    if (this.dom.secAdminUsersCount) {
      this.dom.secAdminUsersCount.textContent = `${adminUsers.length} conta${adminUsers.length === 1 ? '' : 's'} ativa${adminUsers.length === 1 ? '' : 's'}`;
    }
    if (this.dom.secGoogleEmailsCount) {
      this.dom.secGoogleEmailsCount.textContent = emails.length > 0 ? `${emails.length} e-mail${emails.length === 1 ? '' : 's'} na whitelist` : 'Nenhum e-mail configurado';
    }

    let activeCount = 0;
    if (this.dom.secMethodTogglePin && this.dom.secMethodTogglePin.checked) activeCount++;
    if (this.dom.secMethodToggleLocal && this.dom.secMethodToggleLocal.checked) activeCount++;
    if (this.dom.secMethodToggleGoogle && this.dom.secMethodToggleGoogle.checked) activeCount++;

    if (this.dom.secActiveMethodsCount) {
      this.dom.secActiveMethodsCount.textContent = `${activeCount} método${activeCount === 1 ? '' : 's'} ativo${activeCount === 1 ? '' : 's'}`;
    }
  }

  renderSecurityAdminUsers() {
    if (!this.dom.secAdminUsersTbody) return;
    const users = (this.cachedSecurityConfig && this.cachedSecurityConfig.admin && this.cachedSecurityConfig.admin.users) || [];
    
    if (users.length === 0) {
      this.dom.secAdminUsersTbody.innerHTML = `
        <tr>
          <td colspan="4" style="padding: 16px; text-align: center; color: var(--text-muted); font-size: 12px;">
            Nenhum usuário administrativo cadastrado.
          </td>
        </tr>
      `;
      return;
    }

    this.dom.secAdminUsersTbody.innerHTML = users.map((u, idx) => {
      const isPresenter = u.role === 'presenter';
      const roleBadge = isPresenter
        ? `<span class="badge" style="background: rgba(168, 85, 247, 0.2); color: #c084fc; font-size: 10.5px; padding: 2px 8px;">🎤 Palestrante</span>`
        : `<span class="badge" style="background: rgba(56, 189, 248, 0.2); color: #38bdf8; font-size: 10.5px; padding: 2px 8px;">🛡️ Administrador</span>`;

      return `
        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
          <td style="padding: 10px 14px; font-weight: 700; color: #ffffff; font-family: var(--font-mono);">${this.escapeHtml(u.username)}</td>
          <td style="padding: 10px 14px; color: #cbd5e1;">${this.escapeHtml(u.name || u.username)}</td>
          <td style="padding: 10px 14px;">${roleBadge}</td>
          <td style="padding: 10px 14px; text-align: right;">
            <button type="button" class="btn btn-sm" onclick="window.adminApp.showAddAdminUserForm(${idx})" style="padding: 3px 8px; font-size: 11px; margin-right: 4px; border-color: var(--border-subtle);" title="Editar Conta">
              ✏️
            </button>
            <button type="button" class="btn btn-sm" onclick="window.adminApp.deleteAdminUser(${idx})" style="padding: 3px 8px; font-size: 11px; color: #fca5a5; border-color: rgba(239,68,68,0.3);" title="Excluir Usuário">
              🗑️
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  showAddAdminUserForm(editIndex = null) {
    this.editingAdminUserIndex = editIndex;
    if (!this.dom.secUserFormCard) return;

    if (editIndex !== null && this.cachedSecurityConfig && this.cachedSecurityConfig.admin && this.cachedSecurityConfig.admin.users[editIndex]) {
      const u = this.cachedSecurityConfig.admin.users[editIndex];
      if (this.dom.secUserFormTitle) this.dom.secUserFormTitle.textContent = `✏️ Editar Usuário: ${u.username}`;
      if (this.dom.secFormUserName) this.dom.secFormUserName.value = u.name || '';
      if (this.dom.secFormUserUsername) {
        this.dom.secFormUserUsername.value = u.username || '';
        this.dom.secFormUserUsername.disabled = true;
      }
      if (this.dom.secFormUserRole) this.dom.secFormUserRole.value = u.role || 'admin';
      if (this.dom.secFormUserPassword) {
        this.dom.secFormUserPassword.value = '';
        this.dom.secFormUserPassword.placeholder = 'Deixe em branco para manter a senha atual';
      }
    } else {
      if (this.dom.secUserFormTitle) this.dom.secUserFormTitle.textContent = '👤 Adicionar Novo Usuário Local';
      if (this.dom.secFormUserName) this.dom.secFormUserName.value = '';
      if (this.dom.secFormUserUsername) {
        this.dom.secFormUserUsername.value = '';
        this.dom.secFormUserUsername.disabled = false;
      }
      if (this.dom.secFormUserRole) this.dom.secFormUserRole.value = 'admin';
      if (this.dom.secFormUserPassword) {
        this.dom.secFormUserPassword.value = '';
        this.dom.secFormUserPassword.placeholder = 'Senha de acesso';
      }
    }

    this.dom.secUserFormCard.style.display = 'block';
  }

  saveAdminUserFromForm() {
    if (!this.cachedSecurityConfig) {
      this.cachedSecurityConfig = { admin: { users: [] }, offlineAudience: { users: [] } };
    }
    if (!this.cachedSecurityConfig.admin) this.cachedSecurityConfig.admin = {};
    if (!this.cachedSecurityConfig.admin.users) this.cachedSecurityConfig.admin.users = [];

    const username = (this.dom.secFormUserUsername && this.dom.secFormUserUsername.value) ? this.dom.secFormUserUsername.value.trim().toLowerCase() : '';
    const name = (this.dom.secFormUserName && this.dom.secFormUserName.value) ? this.dom.secFormUserName.value.trim() : '';
    const role = (this.dom.secFormUserRole && this.dom.secFormUserRole.value) ? this.dom.secFormUserRole.value : 'admin';
    const pass = (this.dom.secFormUserPassword && this.dom.secFormUserPassword.value) ? this.dom.secFormUserPassword.value.trim() : '';

    if (!username) {
      alert('Por favor, informe o username de login.');
      return;
    }

    if (this.editingAdminUserIndex !== null) {
      const target = this.cachedSecurityConfig.admin.users[this.editingAdminUserIndex];
      if (target) {
        target.name = name || username;
        target.role = role;
        if (pass) target.password = pass;
      }
    } else {
      if (!pass) {
        alert('Por favor, informe uma senha para o novo usuário.');
        return;
      }
      const exists = this.cachedSecurityConfig.admin.users.some(u => u.username.toLowerCase() === username);
      if (exists) {
        alert(`O usuário "${username}" já está cadastrado.`);
        return;
      }
      this.cachedSecurityConfig.admin.users.push({
        username,
        name: name || username,
        role,
        password: pass
      });
    }

    if (this.dom.secUserFormCard) this.dom.secUserFormCard.style.display = 'none';
    this.editingAdminUserIndex = null;
    this.renderSecurityAdminUsers();
  }

  deleteAdminUser(index) {
    if (!this.cachedSecurityConfig || !this.cachedSecurityConfig.admin || !this.cachedSecurityConfig.admin.users) return;
    const u = this.cachedSecurityConfig.admin.users[index];
    if (!u) return;

    if (this.cachedSecurityConfig.admin.users.length <= 1) {
      alert('Você não pode excluir o único usuário administrativo do sistema.');
      return;
    }

    if (confirm(`Tem certeza que deseja excluir a conta "${u.username}" (${u.name || ''})?`)) {
      this.cachedSecurityConfig.admin.users.splice(index, 1);
      this.renderSecurityAdminUsers();
    }
  }

  renderSecurityAudienceUsers() {
    if (!this.dom.secAudienceUsersTbody) return;
    const users = (this.cachedSecurityConfig && this.cachedSecurityConfig.offlineAudience && this.cachedSecurityConfig.offlineAudience.users) || [];

    if (users.length === 0) {
      this.dom.secAudienceUsersTbody.innerHTML = `
        <tr>
          <td colspan="4" style="padding: 14px; text-align: center; color: var(--text-muted); font-size: 11.5px;">
            Nenhum participante com senha individual cadastrado.
          </td>
        </tr>
      `;
      return;
    }

    this.dom.secAudienceUsersTbody.innerHTML = users.map((u, idx) => `
      <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
        <td style="padding: 8px 12px; font-weight: 700; color: #ffffff; font-family: var(--font-mono);">${this.escapeHtml(u.username)}</td>
        <td style="padding: 8px 12px; color: #cbd5e1;">${this.escapeHtml(u.name || u.username)}</td>
        <td style="padding: 8px 12px; font-family: var(--font-mono); color: #94a3b8;">${this.escapeHtml(u.password || '123')}</td>
        <td style="padding: 8px 12px; text-align: right;">
          <button type="button" class="btn btn-sm" onclick="window.adminApp.deleteAudienceUser(${idx})" style="padding: 2px 6px; font-size: 10px; color: #fca5a5; border-color: rgba(239,68,68,0.3);" title="Excluir">
            🗑️
          </button>
        </td>
      </tr>
    `).join('');
  }

  promptAddAudienceUser() {
    const username = prompt('Login / Crachá do Participante (ex: cracha01 ou usuario@empresa):');
    if (!username || !username.trim()) return;
    const cleanUser = username.trim();

    const name = prompt('Nome de Exibição do Participante (opcional):', cleanUser) || cleanUser;
    const password = prompt('Senha de Acesso (padrão: 123):', '123') || '123';

    if (!this.cachedSecurityConfig) {
      this.cachedSecurityConfig = { admin: { users: [] }, offlineAudience: { users: [] } };
    }
    if (!this.cachedSecurityConfig.offlineAudience) this.cachedSecurityConfig.offlineAudience = {};
    if (!this.cachedSecurityConfig.offlineAudience.users) this.cachedSecurityConfig.offlineAudience.users = [];

    const exists = this.cachedSecurityConfig.offlineAudience.users.some(u => u.username.toLowerCase() === cleanUser.toLowerCase());
    if (exists) {
      alert(`O participante "${cleanUser}" já está na lista.`);
      return;
    }

    this.cachedSecurityConfig.offlineAudience.users.push({
      username: cleanUser,
      name: name.trim(),
      password: password.trim()
    });

    this.renderSecurityAudienceUsers();
  }

  deleteAudienceUser(index) {
    if (!this.cachedSecurityConfig || !this.cachedSecurityConfig.offlineAudience || !this.cachedSecurityConfig.offlineAudience.users) return;
    const u = this.cachedSecurityConfig.offlineAudience.users[index];
    if (!u) return;
    if (confirm(`Remover participante "${u.username}" da audiência offline?`)) {
      this.cachedSecurityConfig.offlineAudience.users.splice(index, 1);
      this.renderSecurityAudienceUsers();
    }
  }

  async saveSecuritySettings() {
    if (!this.cachedSecurityConfig) {
      this.cachedSecurityConfig = { admin: { users: [] }, offlineAudience: { users: [] } };
    }

    const pin = (this.dom.secInputPin && this.dom.secInputPin.value) ? this.dom.secInputPin.value.trim() : '';
    if (!pin || pin.length < 4) {
      this.showSecurityFeedback('O PIN mestre deve conter pelo menos 4 dígitos numéricos.', false);
      return;
    }

    // Leitura dos métodos Multi-Auth
    const methodPin = this.dom.secMethodTogglePin ? this.dom.secMethodTogglePin.checked : true;
    const methodLocal = this.dom.secMethodToggleLocal ? this.dom.secMethodToggleLocal.checked : true;
    const methodGoogle = this.dom.secMethodToggleGoogle ? this.dom.secMethodToggleGoogle.checked : false;

    // Regra Anti-Lockout: ao menos 1 método deve permanecer ativo
    if (!methodPin && !methodLocal && !methodGoogle) {
      this.showSecurityFeedback('Erro: Pelo menos um método de autenticação (PIN, Usuário Local ou Google) deve permanecer ativo.', false);
      return;
    }

    const requirePin = this.dom.secCheckRequirePin ? this.dom.secCheckRequirePin.checked : true;
    const scopePresenter = this.dom.secCheckScopePresenter ? this.dom.secCheckScopePresenter.checked : true;
    const scopeStudio = this.dom.secCheckScopeStudio ? this.dom.secCheckScopeStudio.checked : true;
    const scopePortal = this.dom.secCheckScopePortal ? this.dom.secCheckScopePortal.checked : false;

    const audienceEnabled = this.dom.secCheckAudienceEnabled ? this.dom.secCheckAudienceEnabled.checked : true;
    const rawEmails = (this.dom.secInputAllowedEmails && this.dom.secInputAllowedEmails.value) ? this.dom.secInputAllowedEmails.value : '';
    const allowedEmails = rawEmails.split(/[\n,]+/).map(e => e.trim().toLowerCase()).filter(Boolean);

    const payload = {
      admin: {
        pin,
        requirePinForAdmin: requirePin,
        allowedEmails,
        users: (this.cachedSecurityConfig.admin && this.cachedSecurityConfig.admin.users) || []
      },
      catalog: {
        requireAuth: scopePortal
      },
      multiAuth: {
        methods: {
          pin: methodPin,
          localUsers: methodLocal,
          google: methodGoogle
        },
        scopes: {
          admin: requirePin,
          presenter: scopePresenter,
          studio: scopeStudio,
          portal: scopePortal
        }
      },
      offlineAudience: {
        enabled: audienceEnabled,
        users: (this.cachedSecurityConfig.offlineAudience && this.cachedSecurityConfig.offlineAudience.users) || []
      }
    };

    if (this.dom.btnSaveSecuritySettings) {
      this.dom.btnSaveSecuritySettings.disabled = true;
      this.dom.btnSaveSecuritySettings.textContent = '⏳ Salvando...';
    }

    try {
      const res = await fetch('/api/security/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (res.ok && data.success) {
        this.showSecurityFeedback('✓ Matriz de segurança atualizada com sucesso!', true);
        if (this.auth && typeof this.auth.loadSecurityConfig === 'function') {
          await this.auth.loadSecurityConfig();
        }
        this.updateSecurityHealthBadge();
        setTimeout(() => {
          this.closeSecuritySettingsModal();
        }, 1500);
      } else {
        this.showSecurityFeedback(`Erro ao salvar: ${data.error || 'Falha no servidor.'}`, false);
      }
    } catch (err) {
      console.error('Erro ao salvar /api/security/config:', err);
      this.showSecurityFeedback('Erro de conexão ao salvar configurações.', false);
    } finally {
      if (this.dom.btnSaveSecuritySettings) {
        this.dom.btnSaveSecuritySettings.disabled = false;
        this.dom.btnSaveSecuritySettings.textContent = '💾 Salvar Configurações de Segurança';
      }
    }
  }

  escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  showSecurityFeedback(msg, isSuccess) {
    if (!this.dom.secFeedbackMsg) return;
    this.dom.secFeedbackMsg.style.display = 'block';
    this.dom.secFeedbackMsg.textContent = msg;
    if (isSuccess) {
      this.dom.secFeedbackMsg.style.background = 'rgba(16, 185, 129, 0.15)';
      this.dom.secFeedbackMsg.style.border = '1px solid rgba(16, 185, 129, 0.4)';
      this.dom.secFeedbackMsg.style.color = '#6ee7b7';
    } else {
      this.dom.secFeedbackMsg.style.background = 'rgba(239, 68, 68, 0.15)';
      this.dom.secFeedbackMsg.style.border = '1px solid rgba(239, 68, 68, 0.4)';
      this.dom.secFeedbackMsg.style.color = '#fca5a5';
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.adminApp = new AdminApp();
});
