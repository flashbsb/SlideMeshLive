/**
 * Realtime Synchronization Engine
 * Plataforma de Apresentação HTML Interativa
 * 
 * Sincronização ultra-robusta em tempo real em 4 camadas:
 * 1. BroadcastChannel (baixa latência na mesma máquina)
 * 2. Window Storage Event (garantia nativa entre abas/janelas)
 * 3. Hub HTTP Local /api/sync (sincronização Wi-Fi/LAN entre Celulares e Computadores 100% offline)
 * 4. Firebase Realtime Database (internet / múltiplos locais remotos)
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
    this.lastSyncTimestamp = 0;
    this.isHttpSyncActive = false;

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
      } catch (e) {}
    }

    // 2. Registra listener nativo de Storage
    window.addEventListener('storage', (e) => {
      if (e.key && e.key.startsWith('session_state_') && e.newValue) {
        try {
          const sessionId = e.key.replace('session_state_', '');
          const data = JSON.parse(e.newValue);
          this._triggerSessionListeners(sessionId, data);
        } catch (err) {}
      }
    });

    // 3. Inicializa Firebase de forma assíncrona se configurado
    this._initFirebase();

    // 4. Inicializa Hub de Sincronização Local HTTP (/api/sync)
    this._initLocalHttpSync();
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
      } catch (err) {
        this.isFirebaseReady = false;
      }
    }
  }

  _initLocalHttpSync() {
    // Inicia polling leve a cada 1200ms para manter todos os celulares e computadores sincronizados via Wi-Fi
    setInterval(() => {
      this.syncWithLocalServer();
    }, 1200);
  }

  async syncWithLocalServer() {
    const sessionId = (sessionStorage.getItem('apres_active_session') || localStorage.getItem('active_presentation_session') || 'SDWAN2026').trim().toUpperCase();
    try {
      const res = await fetch(`/api/sync?session=${encodeURIComponent(sessionId)}&since=${this.lastSyncTimestamp}`);
      if (!res.ok) return;
      const data = await res.json();
      this.lastSyncTimestamp = data.serverTime || Date.now();

      // Aplica estado da sessão se for mais recente
      if (data.state && Object.keys(data.state).length > 0) {
        const localRaw = localStorage.getItem(`session_state_${sessionId}`);
        let localState = {};
        try { if (localRaw) localState = JSON.parse(localRaw); } catch(e){}
        
        const merged = { ...localState, ...data.state };
        localStorage.setItem(`session_state_${sessionId}`, JSON.stringify(merged));
        this._triggerSessionListeners(sessionId, merged);
      }

      // Aplica perguntas consolidadas
      if (Array.isArray(data.questions) && data.questions.length > 0) {
        localStorage.setItem(`session_questions_${sessionId}`, JSON.stringify(data.questions));
      }

      // Aplica votos consolidados
      if (data.votes && typeof data.votes === 'object') {
        Object.keys(data.votes).forEach(pid => {
          localStorage.setItem(`session_votes_${sessionId}_${pid}`, JSON.stringify(data.votes[pid]));
        });
      }

      // Dispara eventos novos recebidos da rede
      if (Array.isArray(data.events)) {
        data.events.forEach(evt => {
          if (this.channel) {
            this.channel.postMessage({
              type: evt.type,
              sessionId: sessionId,
              ...evt.payload,
              timestamp: evt.timestamp
            });
          }
        });
      }
    } catch (e) {
      // Servidor sem suporte a /api/sync ou offline
    }
  }

  async sendLocalServerEvent(type, sessionId, payload = {}) {
    const normSessionId = (sessionId || 'SDWAN2026').trim().toUpperCase();
    try {
      await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: type,
          sessionId: normSessionId,
          payload: payload
        })
      });
    } catch (e) {}
  }

  async setSlide(sessionId, slideIndex, slideData = null) {
    const normSessionId = (sessionId || 'SDWAN2026').trim().toUpperCase();
    const payload = {
      currentSlide: slideIndex,
      slideId: (slideData && slideData.id) || (slideIndex + 1),
      slideTitle: (slideData && slideData.title) || `Slide ${slideIndex + 1}`,
      updatedAt: Date.now(),
      updatedBy: 'presenter'
    };

    this._saveSessionStateLocally(normSessionId, payload);
    this._broadcastSessionUpdate(normSessionId, payload);
    this.sendLocalServerEvent('SESSION_STATE_UPDATE', normSessionId, payload);

    if (this.isFirebaseReady && this.db) {
      try {
        const sessionRef = this.firebaseFns.ref(this.db, `sessions/${normSessionId}`);
        await this.firebaseFns.update(sessionRef, {
          ...payload,
          updatedAt: this.firebaseFns.serverTimestamp()
        });
      } catch (err) {}
    }
  }

  async updateSessionState(sessionId, stateUpdates = {}) {
    const normSessionId = (sessionId || 'SDWAN2026').trim().toUpperCase();
    const currentLocal = this._loadSessionStateLocally(normSessionId) || {};
    const merged = {
      ...currentLocal,
      ...stateUpdates,
      updatedAt: Date.now()
    };

    this._saveSessionStateLocally(normSessionId, merged);
    this._broadcastSessionUpdate(normSessionId, merged);
    this.sendLocalServerEvent('SESSION_STATE_UPDATE', normSessionId, merged);

    if (this.isFirebaseReady && this.db) {
      try {
        const sessionRef = this.firebaseFns.ref(this.db, `sessions/${normSessionId}`);
        await this.firebaseFns.update(sessionRef, {
          ...stateUpdates,
          updatedAt: this.firebaseFns.serverTimestamp()
        });
      } catch (err) {}
    }
  }

  subscribeToSession(sessionId, callback) {
    const normSessionId = (sessionId || 'SDWAN2026').trim().toUpperCase();
    sessionStorage.setItem('apres_active_session', normSessionId);

    if (!this.sessionListeners.has(normSessionId)) {
      this.sessionListeners.set(normSessionId, []);
    }
    this.sessionListeners.get(normSessionId).push(callback);

    const initial = this._loadSessionStateLocally(normSessionId);
    if (initial) {
      callback(initial);
    }

    if (this.isFirebaseReady && this.db) {
      try {
        const sessionRef = this.firebaseFns.ref(this.db, `sessions/${normSessionId}`);
        this.firebaseFns.onValue(sessionRef, (snapshot) => {
          const val = snapshot.val();
          if (val) {
            this._saveSessionStateLocally(normSessionId, val);
            this._triggerSessionListeners(normSessionId, val);
          }
        });
      } catch (err) {}
    }

    return () => {
      const list = this.sessionListeners.get(normSessionId) || [];
      this.sessionListeners.set(normSessionId, list.filter(cb => cb !== callback));
    };
  }

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
    this.sendLocalServerEvent('REACTION_SENT', normSessionId, { emoji: emoji });
  }

  sendVote(sessionId, pollId, optionId, uid) {
    const normSessionId = (sessionId || 'SDWAN2026').trim().toUpperCase();
    const payload = { pollId, optionId, uid, timestamp: Date.now() };
    if (this.channel) {
      this.channel.postMessage({
        type: 'VOTE_CAST',
        sessionId: normSessionId,
        ...payload
      });
    }
    this.sendLocalServerEvent('VOTE_CAST', normSessionId, payload);
  }

  sendQuestion(sessionId, question) {
    const normSessionId = (sessionId || 'SDWAN2026').trim().toUpperCase();
    if (this.channel) {
      this.channel.postMessage({
        type: 'NEW_QUESTION',
        sessionId: normSessionId,
        question: question
      });
    }
    this.sendLocalServerEvent('NEW_QUESTION', normSessionId, { question: question });
  }

  sendPollReset(sessionId, pollId) {
    const normSessionId = (sessionId || 'SDWAN2026').trim().toUpperCase();
    if (this.channel) {
      this.channel.postMessage({
        type: 'VOTE_RESET',
        sessionId: normSessionId,
        pollId: pollId
      });
    }
    this.sendLocalServerEvent('RESET_POLL', normSessionId, { pollId: pollId });
  }

  sendAllPollsReset(sessionId) {
    const normSessionId = (sessionId || 'SDWAN2026').trim().toUpperCase();
    if (this.channel) {
      this.channel.postMessage({
        type: 'VOTE_RESET',
        sessionId: normSessionId
      });
    }
    this.sendLocalServerEvent('RESET_ALL_POLLS', normSessionId, {});
  }

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
    this.sendLocalServerEvent('QR_HOST_CONFIG_CHANGED', normSessionId, { customHost: customHost });
  }

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
    this.sendLocalServerEvent('SWITCH_ACTIVE_PRESENTATION', normSessionId, { presentationId: newPresentationId });

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

  startPresence(sessionId, isPresenter = false, uid = null, alias = null, isAuthenticated = false) {
    const normSessionId = (sessionId || 'SDWAN2026').trim().toUpperCase();
    const pid = uid || this.participantId;
    const userAlias = alias || `Participante #${pid.substring(pid.length - 4)}`;

    this.stopPresence();

    const sendPing = () => {
      const presencePayload = {
        uid: pid,
        alias: userAlias,
        isPresenter: isPresenter,
        isAuthenticated: isAuthenticated,
        lastPing: Date.now()
      };

      if (this.channel) {
        this.channel.postMessage({
          type: 'PRESENCE_PING',
          sessionId: normSessionId,
          ...presencePayload
        });
      }

      this.sendLocalServerEvent('PRESENCE_PING', normSessionId, presencePayload);

      // Salva no registro de presença local
      const key = `session_presence_${normSessionId}`;
      let map = {};
      try {
        const raw = localStorage.getItem(key);
        if (raw) map = JSON.parse(raw);
      } catch (e) {}

      map[pid] = presencePayload;

      // Limpa presenças antigas (> 15s)
      const now = Date.now();
      Object.keys(map).forEach(k => {
        if (now - map[k].lastPing > 15000) delete map[k];
      });

      try {
        localStorage.setItem(key, JSON.stringify(map));
      } catch (e) {}
    };

    sendPing();
    this.presenceTimer = setInterval(sendPing, 4000);
  }

  stopPresence() {
    if (this.presenceTimer) {
      clearInterval(this.presenceTimer);
      this.presenceTimer = null;
    }
  }

  getOnlineStats(sessionId) {
    const normSessionId = (sessionId || 'SDWAN2026').trim().toUpperCase();
    const key = `session_presence_${normSessionId}`;
    let map = {};
    try {
      const raw = localStorage.getItem(key);
      if (raw) map = JSON.parse(raw);
    } catch (e) {}

    const now = Date.now();
    const active = Object.values(map).filter(p => (now - p.lastPing) <= 15000 && !p.isPresenter);

    return {
      total: active.length,
      authenticated: active.filter(p => p.isAuthenticated).length,
      anonymous: active.filter(p => !p.isAuthenticated).length,
      list: active
    };
  }

  _saveSessionStateLocally(sessionId, state) {
    try {
      localStorage.setItem(`session_state_${sessionId}`, JSON.stringify(state));
    } catch (e) {}
  }

  _loadSessionStateLocally(sessionId) {
    try {
      const raw = localStorage.getItem(`session_state_${sessionId}`);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  _broadcastSessionUpdate(sessionId, state) {
    if (this.channel) {
      try {
        this.channel.postMessage({
          type: 'SESSION_UPDATE',
          sessionId: sessionId,
          data: state
        });
      } catch (e) {}
    }
    this._triggerSessionListeners(sessionId, state);
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
    const listeners = this.sessionListeners.get(normSessionId) || [];
    listeners.forEach(cb => {
      try { cb(data); } catch (e) {}
    });
  }
}
