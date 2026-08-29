/**
 * Realtime Synchronization Engine
 * Plataforma de Apresentação HTML Interativa Sincronizada
 * 
 * Despachante unificado em 4 camadas de transporte:
 * 1. Despachante direto de eventos onEvent()
 * 2. Hub HTTP Local Sequencial (/api/sync) para Wi-Fi/LAN entre múltiplos aparelhos
 * 3. BroadcastChannel nativo do navegador
 * 4. Firebase Realtime Database para nuvem/internet
 */

import { APP_CONFIG } from '../config.js';

export class RealtimeEngine {
  constructor(options = {}) {
    this.config = options.config || APP_CONFIG;
    this.isFirebaseReady = false;
    this.db = null;
    this.channel = null;
    this.sessionListeners = new Map();
    this.eventListeners = [];
    this.participantId = this._generateParticipantId();
    this.presenceTimer = null;
    this.lastProcessedEventId = 0;
    this._locallyDispatchedIds = new Set();

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
            this._handleIncomingRawMessage(event.data);
          }
        };
      } catch (e) {}
    }

    // 2. Storage event nativo
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

    // 4. Inicia sincronização sequencial com o servidor local
    this._startLocalHttpPolling();
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

  _startLocalHttpPolling() {
    this.syncWithLocalServer(); // Sincronização inicial instantânea (M01)
    setInterval(() => {
      this.syncWithLocalServer();
    }, 750);
  }

  async syncWithLocalServer() {
    const sessionId = (sessionStorage.getItem('apres_active_session') || localStorage.getItem('active_presentation_session') || 'SDWAN2026').trim().toUpperCase();
    const origin = (typeof window !== 'undefined' && window.location && window.location.origin) ? window.location.origin : 'http://127.0.0.1:8000';
    const baseUrl = origin.startsWith('http') ? origin : 'http://127.0.0.1:8000';

    try {
      const res = await fetch(`${baseUrl}/api/sync?session=${encodeURIComponent(sessionId)}&since_id=${this.lastProcessedEventId}`);
      if (!res.ok) return;
      const data = await res.json();
      
      if (data.lastEventId) {
        this.lastProcessedEventId = Math.max(this.lastProcessedEventId, data.lastEventId);
      }
      if (Array.isArray(data.events) && data.events.length > 0) {
        const maxId = Math.max(...data.events.map(e => e.id || 0));
        this.lastProcessedEventId = Math.max(this.lastProcessedEventId, maxId);
      }

      // 1. Atualiza estado da sessão
      if (data.state && Object.keys(data.state).length > 0) {
        const localRaw = localStorage.getItem(`session_state_${sessionId}`);
        let localState = {};
        try { if (localRaw) localState = JSON.parse(localRaw); } catch(e){}
        const merged = { ...localState, ...data.state };
        localStorage.setItem(`session_state_${sessionId}`, JSON.stringify(merged));
        this._triggerSessionListeners(sessionId, merged);
      }

      // 2. Atualiza perguntas consolidadas
      if (Array.isArray(data.questions)) {
        localStorage.setItem(`session_questions_${sessionId}`, JSON.stringify(data.questions));
      }

      // 3. Atualiza votos consolidados
      if (data.votes && typeof data.votes === 'object') {
        Object.keys(data.votes).forEach(pid => {
          localStorage.setItem(`session_votes_${sessionId}_${pid}`, JSON.stringify(data.votes[pid]));
        });
      }

      // 4. Despacha eventos recebidos da rede para todos os listeners locais (filtrando os já despachados localmente)
      if (Array.isArray(data.events) && data.events.length > 0) {
        const newEvents = data.events.filter(e => !e.id || !this._locallyDispatchedIds.has(e.id));
        newEvents.forEach(evt => {
          this._dispatchLocalEvent({
            id: evt.id,
            type: evt.type,
            sessionId: sessionId,
            payload: evt.payload || {},
            timestamp: evt.timestamp
          });
        });
      }
    } catch (e) {
      // Offline ou servidor estático
    }
  }

  async sendLocalServerEvent(type, sessionId, payload = {}) {
    const normSessionId = (sessionId || 'SDWAN2026').trim().toUpperCase();
    const eventObj = {
      type: type,
      sessionId: normSessionId,
      payload: payload,
      timestamp: Date.now()
    };

    // Dispara localmente de imediato para feedback instantâneo
    this._dispatchLocalEvent(eventObj);

    if (this.channel) {
      try {
        this.channel.postMessage(eventObj);
      } catch(e) {}
    }

    const origin = (typeof window !== 'undefined' && window.location && window.location.origin) ? window.location.origin : 'http://127.0.0.1:8000';
    const baseUrl = origin.startsWith('http') ? origin : 'http://127.0.0.1:8000';

    try {
      const res = await fetch(`${baseUrl}/api/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: type,
          sessionId: normSessionId,
          payload: payload
        })
      });
      if (res.ok) {
        const result = await res.json();
        if (result && result.eventId) {
          this._locallyDispatchedIds.add(result.eventId);
          if (this._locallyDispatchedIds.size > 200) {
            this._locallyDispatchedIds = new Set([...this._locallyDispatchedIds].slice(-100));
          }
        }
      }
    } catch (e) {}
  }

  onEvent(callback) {
    this.eventListeners.push(callback);
    return () => {
      this.eventListeners = this.eventListeners.filter(cb => cb !== callback);
    };
  }

  _dispatchLocalEvent(eventObj) {
    this.eventListeners.forEach(cb => {
      try { cb(eventObj); } catch(err) { console.error('Erro no listener de evento:', err); }
    });
  }

  _handleIncomingRawMessage(msg) {
    if (!msg || !msg.sessionId) return;
    const normSessionId = msg.sessionId.trim().toUpperCase();

    if (msg.type === 'SESSION_UPDATE' || msg.type === 'SESSION_STATE_UPDATE') {
      this._triggerSessionListeners(normSessionId, msg.data || msg.payload);
    }
    this._dispatchLocalEvent(msg);
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
    this.sendLocalServerEvent('REACTION_SENT', normSessionId, { emoji: emoji });
  }

  sendVote(sessionId, pollId, optionId, uid) {
    const normSessionId = (sessionId || 'SDWAN2026').trim().toUpperCase();
    const payload = { pollId, optionId, uid, timestamp: Date.now() };
    this.sendLocalServerEvent('VOTE_CAST', normSessionId, payload);
  }

  sendQuestion(sessionId, question) {
    const normSessionId = (sessionId || 'SDWAN2026').trim().toUpperCase();
    this.sendLocalServerEvent('NEW_QUESTION', normSessionId, { question: question });
  }

  sendQuestionStatus(sessionId, questionId, status, answered = null) {
    const normSessionId = (sessionId || 'SDWAN2026').trim().toUpperCase();
    const payload = { questionId, status };
    if (answered !== null) payload.answered = answered;
    this.sendLocalServerEvent('QUESTION_STATUS_CHANGE', normSessionId, payload);
  }

  sendClearQuestions(sessionId) {
    const normSessionId = (sessionId || 'SDWAN2026').trim().toUpperCase();
    this.sendLocalServerEvent('CLEAR_ALL_QUESTIONS', normSessionId, {});
  }

  sendPollReset(sessionId, pollId) {
    const normSessionId = (sessionId || 'SDWAN2026').trim().toUpperCase();
    this.sendLocalServerEvent('RESET_POLL', normSessionId, { pollId: pollId });
  }

  async deleteFirebaseNode(path) {
    if (!this.isFirebaseReady || !this.db) return;
    try {
      await this.firebaseFns.remove(this.firebaseFns.ref(this.db, path));
    } catch (e) {
      console.warn('[RealtimeEngine] deleteFirebaseNode erro:', e);
    }
  }

  async setFirebaseNode(path, value) {
    if (!this.isFirebaseReady || !this.db) return;
    try {
      await this.firebaseFns.set(this.firebaseFns.ref(this.db, path), value);
    } catch (e) {
      console.warn('[RealtimeEngine] setFirebaseNode erro:', e);
    }
  }

  sendUserBlocked(sessionId, uid, isBlocked) {
    const normSessionId = (sessionId || 'SDWAN2026').trim().toUpperCase();
    this.sendLocalServerEvent('USER_BLOCKED_STATUS', normSessionId, { uid, isBlocked });
  }

  sendAllPollsReset(sessionId) {
    const normSessionId = (sessionId || 'SDWAN2026').trim().toUpperCase();
    this.sendLocalServerEvent('RESET_ALL_POLLS', normSessionId, {});
  }

  sendQRHostChange(sessionId, customHost) {
    const normSessionId = (sessionId || 'SDWAN2026').trim().toUpperCase();
    this.sendLocalServerEvent('QR_HOST_CONFIG_CHANGED', normSessionId, { customHost: customHost });
  }

  sendPresentationSwitch(sessionId, newPresentationId) {
    const normSessionId = (sessionId || 'SDWAN2026').trim().toUpperCase();
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

      this.sendLocalServerEvent('PRESENCE_PING', normSessionId, presencePayload);

      const key = `session_presence_${normSessionId}`;
      let map = {};
      try {
        const raw = localStorage.getItem(key);
        if (raw) map = JSON.parse(raw);
      } catch (e) {}

      map[pid] = presencePayload;

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

  _triggerSessionListeners(sessionId, data) {
    if (!data) return;
    const normSessionId = (sessionId || '').trim().toUpperCase();
    const listeners = this.sessionListeners.get(normSessionId) || [];
    listeners.forEach(cb => {
      try { cb(data); } catch (e) {}
    });
  }
}
