/**
 * Realtime Synchronization Engine
 * Plataforma de Apresentação HTML Interativa
 * 
 * Sincronização ultra-robusta em tempo real:
 * 1. BroadcastChannel (baixa latência)
 * 2. Window Storage Event (garantia nativa entre abas/janelas)
 * 3. Polling de verificação de timestamp (redundância local)
 * 4. Firebase Realtime Database (internet / múltiplos dispositivos remotos)
 */

import { APP_CONFIG } from '../config.js';

export class RealtimeEngine {
  constructor(options = {}) {
    this.config = options.config || APP_CONFIG;
    this.isFirebaseReady = false;
    this.db = null;
    this.channel = null;
    this.sessionListeners = new Map();
    this.participantId = this._generateParticipantId();
    this.presenceTimer = null;
    this.lastProcessedTimestamp = new Map();

    this.init();
  }

  _generateParticipantId() {
    let pid = sessionStorage.getItem('apres_participant_id');
    if (!pid) {
      pid = 'user_' + Math.random().toString(36).substring(2, 10);
      sessionStorage.setItem('apres_participant_id', pid);
    }
    return pid;
  }

  init() {
    // 1. Inicializa BroadcastChannel
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        this.channel = new BroadcastChannel('apresentacao_realtime_sync');
        this.channel.onmessage = (event) => {
          if (event && event.data) {
            this._handleIncomingMessage(event.data);
          }
        };
      } catch (e) {
        console.warn('[RealtimeEngine] BroadcastChannel indisponível:', e);
      }
    }

    // 2. Registra listener nativo de Storage (disparado entre abas/janelas)
    window.addEventListener('storage', (e) => {
      if (e.key && e.key.startsWith('session_state_') && e.newValue) {
        try {
          const sessionId = e.key.replace('session_state_', '');
          const data = JSON.parse(e.newValue);
          this._triggerSessionListeners(sessionId, data);
        } catch (err) {
          console.error('[RealtimeEngine] Erro ao processar storage event:', err);
        }
      }
    });

    // 3. Inicializa Firebase de forma assíncrona se configurado
    this._initFirebase();
  }

  async _initFirebase() {
    const isFirebaseConfigured = this.config.firebase && 
      this.config.firebase.apiKey && 
      !this.config.firebase.apiKey.includes('SUA_API_KEY');

    if (isFirebaseConfigured) {
      try {
        const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js');
        const { getDatabase, ref, set, update, onValue, push, remove, onDisconnect, serverTimestamp } = 
          await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js');

        const app = initializeApp(this.config.firebase);
        this.db = getDatabase(app);
        this.firebaseFns = { ref, set, update, onValue, push, remove, onDisconnect, serverTimestamp };
        this.isFirebaseReady = true;
        console.log('[RealtimeEngine] Conectado ao Firebase Realtime Database');
      } catch (err) {
        console.warn('[RealtimeEngine] Firebase não inicializado, usando canal local:', err);
        this.isFirebaseReady = false;
      }
    }
  }

  /**
   * Helper para remover nó no Firebase
   */
  async deleteFirebaseNode(path) {
    if (this.isFirebaseReady && this.db && this.firebaseFns) {
      try {
        const nodeRef = this.firebaseFns.ref(this.db, path);
        await this.firebaseFns.remove(nodeRef);
      } catch (e) {
        console.warn(`[RealtimeEngine] Erro ao deletar nó ${path}:`, e);
      }
    }
  }

  /**
   * Helper para atualizar nó no Firebase
   */
  async updateFirebaseNode(path, data) {
    if (this.isFirebaseReady && this.db && this.firebaseFns) {
      try {
        const nodeRef = this.firebaseFns.ref(this.db, path);
        await this.firebaseFns.update(nodeRef, data);
      } catch (e) {
        console.warn(`[RealtimeEngine] Erro ao atualizar nó ${path}:`, e);
      }
    }
  }

  /**
   * Helper para setar nó no Firebase
   */
  async setFirebaseNode(path, data) {
    if (this.isFirebaseReady && this.db && this.firebaseFns) {
      try {
        const nodeRef = this.firebaseFns.ref(this.db, path);
        await this.firebaseFns.set(nodeRef, data);
      } catch (e) {
        console.warn(`[RealtimeEngine] Erro ao setar nó ${path}:`, e);
      }
    }
  }

  /**
   * Apresentador: Atualiza e propaga o estado da sessão
   */
  async updateSessionState(sessionId, sessionState) {
    const normSessionId = (sessionId || 'SDWAN2026').trim().toUpperCase();
    const payload = {
      ...sessionState,
      sessionId: normSessionId,
      updatedAt: Date.now()
    };

    // 1. Grava no LocalStorage (dispara evento storage nas outras abas)
    try {
      localStorage.setItem(`session_state_${normSessionId}`, JSON.stringify(payload));
      localStorage.setItem('active_presentation_session', normSessionId);
    } catch (e) {}

    // 2. Emite via BroadcastChannel
    if (this.channel) {
      try {
        this.channel.postMessage({
          type: 'SESSION_UPDATE',
          sessionId: normSessionId,
          data: payload
        });
      } catch (e) {}
    }

    // 3. Se Firebase estiver ativo, envia para a nuvem
    if (this.isFirebaseReady && this.db) {
      try {
        const sessionRef = this.firebaseFns.ref(this.db, `sessions/${normSessionId}`);
        await this.firebaseFns.update(sessionRef, payload);
      } catch (err) {
        console.error('[RealtimeEngine] Erro Firebase update:', err);
      }
    }

    // 4. Executa callbacks locais
    this._triggerSessionListeners(normSessionId, payload);
  }

  /**
   * Apresentador: Atualiza o slide ativo
   */
  async setSlide(sessionId, slideIndex, slideData = {}) {
    await this.updateSessionState(sessionId, {
      currentSlide: slideIndex,
      slideId: slideData.id || (slideIndex + 1),
      slideTitle: slideData.title || '',
      status: 'running'
    });
  }

  /**
   * Participante e Apresentador: Escuta alterações de estado de uma sessão
   */
  subscribeToSession(sessionId, callback) {
    const normSessionId = (sessionId || 'SDWAN2026').trim().toUpperCase();

    if (!this.sessionListeners.has(normSessionId)) {
      this.sessionListeners.set(normSessionId, []);
    }
    this.sessionListeners.get(normSessionId).push(callback);

    // Se houver estado já salvo no localStorage, executa imediatamente
    const cached = localStorage.getItem(`session_state_${normSessionId}`);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        callback(parsed);
      } catch (e) {}
    }

    // Listener redundante por polling curto (garantia absoluta contra throttle de abas em background)
    const pollInterval = setInterval(() => {
      const currentRaw = localStorage.getItem(`session_state_${normSessionId}`);
      if (currentRaw) {
        try {
          const current = JSON.parse(currentRaw);
          const lastTime = this.lastProcessedTimestamp.get(normSessionId) || 0;
          if (current.updatedAt && current.updatedAt > lastTime) {
            this._triggerSessionListeners(normSessionId, current);
          }
        } catch (e) {}
      }
    }, 400);

    // Se Firebase estiver ativo, registra listener no banco em nuvem
    if (this.isFirebaseReady && this.db) {
      try {
        const sessionRef = this.firebaseFns.ref(this.db, `sessions/${normSessionId}`);
        this.firebaseFns.onValue(sessionRef, (snapshot) => {
          const val = snapshot.val();
          if (val) {
            this._triggerSessionListeners(normSessionId, val);
          }
        });
      } catch (e) {}
    }

    // Retorna função para cancelar inscrição
    return () => {
      clearInterval(pollInterval);
      const list = this.sessionListeners.get(normSessionId) || [];
      this.sessionListeners.set(normSessionId, list.filter(cb => cb !== callback));
    };
  }

  /**
   * Participante: Registra presença com metadados de autenticação
   */
  startPresence(sessionId, isPresenter = false, userMeta = null) {
    const normSessionId = (sessionId || 'SDWAN2026').trim().toUpperCase();
    
    const notifyPresence = () => {
      const payload = {
        participantId: this.participantId,
        sessionId: normSessionId,
        isPresenter: isPresenter,
        isAuthenticated: !!(userMeta && userMeta.uid),
        uid: (userMeta && userMeta.uid) || this.participantId,
        alias: (userMeta && userMeta.anonymousAlias) || 'Participante Anônimo',
        lastSeen: Date.now()
      };

      // Grava no registry de presença local
      try {
        const presenceKey = `session_presence_${normSessionId}`;
        let map = {};
        const raw = localStorage.getItem(presenceKey);
        if (raw) map = JSON.parse(raw);
        map[this.participantId] = payload;
        
        // Limpa usuários inativos há mais de 45 segundos
        const now = Date.now();
        Object.keys(map).forEach(k => {
          if (now - map[k].lastSeen > 45000) delete map[k];
        });
        localStorage.setItem(presenceKey, JSON.stringify(map));
      } catch (e) {}

      if (this.channel) {
        try {
          this.channel.postMessage({
            type: 'PRESENCE_PING',
            sessionId: normSessionId,
            data: payload
          });
        } catch (e) {}
      }

      if (this.isFirebaseReady && this.db) {
        try {
          const participantRef = this.firebaseFns.ref(this.db, `sessions/${normSessionId}/participants/${this.participantId}`);
          this.firebaseFns.set(participantRef, {
            ...payload,
            lastSeen: this.firebaseFns.serverTimestamp(),
            active: true
          });
          this.firebaseFns.onDisconnect(participantRef).remove();
        } catch (e) {}
      }
    };

    notifyPresence();
    this.presenceTimer = setInterval(notifyPresence, this.config.sync.heartbeatIntervalMs || 10000);
  }

  /**
   * Obtém estatísticas consolidadas de participantes online
   */
  getOnlineStats(sessionId) {
    const normSessionId = (sessionId || 'SDWAN2026').trim().toUpperCase();
    try {
      const raw = localStorage.getItem(`session_presence_${normSessionId}`);
      if (!raw) return { total: 0, authenticated: 0, anonymous: 0, list: [] };
      const map = JSON.parse(raw);
      const now = Date.now();
      
      const list = Object.values(map).filter(p => !p.isPresenter && (now - p.lastSeen < 45000));
      const authenticated = list.filter(p => p.isAuthenticated).length;
      const anonymous = list.length - authenticated;

      return {
        total: list.length,
        authenticated: authenticated,
        anonymous: anonymous,
        list: list
      };
    } catch (e) {
      return { total: 0, authenticated: 0, anonymous: 0, list: [] };
    }
  }

  /**
   * Emite uma reação instantânea (emoji)
   */
  sendReaction(sessionId, emoji) {
    const normSessionId = (sessionId || 'SDWAN2026').trim().toUpperCase();
    if (this.channel) {
      this.channel.postMessage({
        type: 'REACTION_SENT',
        sessionId: normSessionId,
        emoji: emoji,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Propaga notificação de bloqueio/desbloqueio de usuário
   */
  sendUserBlocked(sessionId, uid, isBlocked) {
    const normSessionId = (sessionId || 'SDWAN2026').trim().toUpperCase();
    if (this.channel) {
      this.channel.postMessage({
        type: 'USER_BLOCKED_STATUS',
        sessionId: normSessionId,
        uid: uid,
        isBlocked: isBlocked,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Propaga alteração de Host/IP do QR Code para o Telão e Mesa Técnica
   */
  sendQRHostChange(sessionId, customHost) {
    const normSessionId = (sessionId || 'SDWAN2026').trim().toUpperCase();
    if (this.channel) {
      this.channel.postMessage({
        type: 'QR_HOST_CONFIG_CHANGED',
        sessionId: normSessionId,
        customHost: customHost,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Mesa Técnica: Propaga comando de transição sincronizada de apresentação para todos
   */
  sendPresentationSwitch(sessionId, newPresentationId) {
    const normSessionId = (sessionId || 'SDWAN2026').trim().toUpperCase();
    if (this.channel) {
      this.channel.postMessage({
        type: 'SWITCH_ACTIVE_PRESENTATION',
        sessionId: normSessionId,
        presentationId: newPresentationId,
        timestamp: Date.now()
      });
    }
    this.updateSessionState(sessionId, {
      presentationId: newPresentationId,
      currentSlide: 0,
      slideId: 1,
      pollStatus: 'open',
      showResults: false,
      featuredQuestion: null,
      showFinalAnalytics: false
    });
  }

  stopPresence() {
    if (this.presenceTimer) {
      clearInterval(this.presenceTimer);
      this.presenceTimer = null;
    }
  }

  _handleIncomingMessage(msg) {
    if (!msg || !msg.sessionId) return;
    const normSessionId = msg.sessionId.trim().toUpperCase();

    if (msg.type === 'SESSION_UPDATE') {
      this._triggerSessionListeners(normSessionId, msg.data);
    }
  }

  _triggerSessionListeners(sessionId, data) {
    if (!data) return;
    const normSessionId = (sessionId || '').trim().toUpperCase();
    
    // Evita loop apenas se o timestamp recebido for estritamente mais antigo
    if (data.updatedAt) {
      const lastTime = this.lastProcessedTimestamp.get(normSessionId) || 0;
      if (data.updatedAt < lastTime) return;
      this.lastProcessedTimestamp.set(normSessionId, data.updatedAt);
    }

    const callbacks = this.sessionListeners.get(normSessionId) || [];
    callbacks.forEach(cb => {
      try {
        cb(data);
      } catch (err) {
        console.error('[RealtimeEngine] Erro callback de sessão:', err);
      }
    });
  }
}
