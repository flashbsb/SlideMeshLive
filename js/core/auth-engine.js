/**
 * Authentication & Security Engine
 * Plataforma de Apresentação HTML Interativa
 * 
 * Gerencia autenticação híbrida:
 * 1. Anônimo Automático: Todo participante no celular recebe uma identidade única e pode votar/perguntar imediatamente.
 * 2. Nome/Identificação Rápida: Participante pode personalizar seu nome/avatar.
 * 3. Online: Google Sign-In via Firebase Auth.
 * 4. Offline / Local: Contas e senhas locais configuradas em config/security.json.
 * 5. Mesa Técnica: PIN de segurança e Whitelist de administradores.
 */

import { APP_CONFIG } from '../config.js';

export class AuthEngine {
  constructor(options = {}) {
    this.config = options.config || APP_CONFIG;
    this.auth = null;
    this.currentUser = null;
    this.isFirebaseReady = false;
    this.authListeners = [];
    this.securityConfig = null;

    this.init();
  }

  async init() {
    this._loadOrCreateUser();
    await this.loadSecurityConfig();

    const isFirebaseConfigured = this.config.firebase && 
      this.config.firebase.apiKey && 
      !this.config.firebase.apiKey.includes('SUA_API_KEY');

    if (isFirebaseConfigured) {
      try {
        const { initializeApp, getApps, getApp } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js');
        const { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } = 
          await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js');

        const app = getApps().length === 0 ? initializeApp(this.config.firebase) : getApp();
        this.auth = getAuth(app);
        this.googleProvider = new GoogleAuthProvider();
        this.firebaseAuthFns = { signInWithPopup, signOut, onAuthStateChanged };
        this.isFirebaseReady = true;

        this.firebaseAuthFns.onAuthStateChanged(this.auth, (user) => {
          if (user) {
            const participantUser = {
              uid: user.uid,
              email: user.email,
              displayName: user.displayName || 'Participante',
              anonymousAlias: user.displayName || this._generateAnonymousAlias(user.uid),
              provider: 'google',
              photoURL: user.photoURL,
              role: this.isEmailAdmin(user.email) ? 'admin' : 'participant',
              isAuthenticated: true,
              isAnonymous: false
            };
            this._setCurrentUser(participantUser);
          }
        });
      } catch (err) {
        console.warn('[AuthEngine] Firebase Auth indisponível, modo local ativo:', err);
        this.isFirebaseReady = false;
      }
    }
  }

  /**
   * Carrega o usuário salvo ou cria uma identidade anônima automática
   */
  _loadOrCreateUser() {
    try {
      const saved = localStorage.getItem('apres_auth_user');
      if (saved) {
        this.currentUser = JSON.parse(saved);
        if (this.currentUser && this.currentUser.uid) {
          localStorage.setItem('apres_participant_id', this.currentUser.uid);
          sessionStorage.setItem('apres_participant_id', this.currentUser.uid);
        }
        return;
      }
    } catch (e) {}

    // Gera usuário anônimo padrão para permitir interação imediata, aproveitando ID prévio se houver
    let anonUid = localStorage.getItem('apres_participant_id') || sessionStorage.getItem('apres_participant_id');
    if (!anonUid) {
      anonUid = 'anon_' + Math.random().toString(36).substring(2, 10);
    }
    const alias = this._generateAnonymousAlias(anonUid);
    this.currentUser = {
      uid: anonUid,
      email: null,
      displayName: alias,
      anonymousAlias: alias,
      provider: 'anonymous',
      photoURL: null,
      role: 'participant',
      isAuthenticated: false,
      isAnonymous: true
    };
    try {
      localStorage.setItem('apres_auth_user', JSON.stringify(this.currentUser));
      localStorage.setItem('apres_participant_id', anonUid);
      sessionStorage.setItem('apres_participant_id', anonUid);
    } catch (e) {}
  }

  /**
   * Carrega a configuração declarativa pública de segurança via endpoint seguro
   */
  async loadSecurityConfig() {
    try {
      const res = await fetch('/api/auth/public-config');
      if (res.ok) {
        this.securityConfig = await res.json();
      }
    } catch (e) {
      this.securityConfig = {
        requirePinForAdmin: true,
        allowedEmails: [],
        offlineAudienceEnabled: true,
        offlineAudienceUsers: [],
        hasAdminUsers: true
      };
    }
  }

  _setCurrentUser(user) {
    this.currentUser = user;
    try {
      if (user) {
        localStorage.setItem('apres_auth_user', JSON.stringify(user));
        if (user.uid) {
          localStorage.setItem('apres_participant_id', user.uid);
          sessionStorage.setItem('apres_participant_id', user.uid);
        }
      } else {
        localStorage.removeItem('apres_auth_user');
        this._loadOrCreateUser();
      }
    } catch (e) {}

    this.authListeners.forEach(cb => {
      try {
        cb(this.currentUser);
      } catch (err) {
        console.error('[AuthEngine] Erro no listener de auth:', err);
      }
    });
  }

  _generateAnonymousAlias(uid) {
    let hash = 0;
    for (let i = 0; i < uid.length; i++) {
      hash = ((hash << 5) - hash) + uid.charCodeAt(i);
      hash |= 0;
    }
    const num = Math.abs(hash % 900) + 100;
    return `Participante #${num}`;
  }

  getCurrentUser() {
    return this.currentUser;
  }

  isAuthenticated() {
    return this.currentUser !== null && !this.currentUser.isAnonymous;
  }

  get user() {
    return this.currentUser;
  }

  isEmailAdmin(email) {
    if (!email || !this.securityConfig) return false;
    const allowed = this.securityConfig.allowedEmails || (this.securityConfig.admin && this.securityConfig.admin.allowedEmails) || [];
    return allowed.some(a => a.toLowerCase() === email.toLowerCase());
  }

  /**
   * Validação de PIN no Backend Gatekeeper (/api/auth/verify-pin)
   */
  async verifyAdminPIN(pin, presentationId = null) {
    const cleanPin = String(pin || '').trim();
    if (!cleanPin) return false;

    try {
      const res = await fetch('/api/auth/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: cleanPin, presentationId: presentationId })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          if (data.role === 'admin') {
            sessionStorage.setItem('admin_pin_authenticated', 'true');
          }
          return true;
        }
      }
      return false;
    } catch (e) {
      // Fallback offline estático se o servidor não puder ser contatado
      const correctPin = String((this.securityConfig && this.securityConfig.admin && this.securityConfig.admin.pin) || '2026');
      const valid = (cleanPin === correctPin.trim());
      if (valid) {
        sessionStorage.setItem('admin_pin_authenticated', 'true');
      }
      return valid;
    }
  }

  isAdminAuthenticated() {
    if (this.securityConfig && this.securityConfig.requirePinForAdmin === false) {
      return true;
    }
    if (this.securityConfig && this.securityConfig.admin && this.securityConfig.admin.requirePinForAdmin === false) {
      return true;
    }
    const isPinAuth = sessionStorage.getItem('admin_pin_authenticated') === 'true';
    const isRoleAdmin = this.currentUser && (
      this.currentUser.role === 'admin' || 
      this.currentUser.role === 'presenter' || 
      this.isEmailAdmin(this.currentUser.email)
    );
    return isPinAuth || isRoleAdmin;
  }

  /**
   * Identificação rápida por Nome
   */
  signInWithCustomName(name) {
    const clean = String(name || '').trim();
    if (!clean) throw new Error('Por favor, informe seu nome.');
    const uid = this.currentUser && this.currentUser.uid ? this.currentUser.uid : ('user_' + Date.now());
    const user = {
      uid: uid,
      email: null,
      displayName: clean,
      anonymousAlias: clean,
      provider: 'custom_name',
      role: 'participant',
      photoURL: null,
      isAuthenticated: true,
      isAnonymous: false
    };
    this._setCurrentUser(user);
    return user;
  }

  /**
   * Realiza login com Usuário e Senha Local via Backend Gatekeeper (/api/auth/login)
   */
  async signInWithLocalCredentials(username, password) {
    const u = String(username || '').trim();
    const p = String(password || '').trim();

    if (!u || !p) throw new Error('Por favor, preencha o usuário e a senha.');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: u, password: p })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Usuário ou senha incorretos.');
      }

      const userRecord = data.user || {};
      const localUser = {
        uid: `local_${userRecord.role || 'user'}_${userRecord.username || u}`,
        email: `${userRecord.username || u}@local`,
        displayName: userRecord.name || userRecord.username || u,
        anonymousAlias: userRecord.name || userRecord.username || u,
        provider: 'local',
        role: userRecord.role || 'participant',
        photoURL: null,
        isAuthenticated: true,
        isAnonymous: false
      };

      this._setCurrentUser(localUser);

      if (localUser.role === 'admin' || localUser.role === 'presenter') {
        sessionStorage.setItem('admin_pin_authenticated', 'true');
      }

      return localUser;
    } catch (err) {
      throw err;
    }
  }

  async signInWithLocalPassword(username, password) {
    return this.signInWithLocalCredentials(username, password);
  }

  /**
   * Realiza login com Google com fallback automático para ambiente local
   */
  async signInWithGoogle() {
    if (this.isFirebaseReady && this.auth) {
      try {
        const result = await this.firebaseAuthFns.signInWithPopup(this.auth, this.googleProvider);
        const user = result.user;
        const participantUser = {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || 'Participante',
          anonymousAlias: user.displayName || this._generateAnonymousAlias(user.uid),
          provider: 'google',
          photoURL: user.photoURL,
          role: this.isEmailAdmin(user.email) ? 'admin' : 'participant',
          isAuthenticated: true,
          isAnonymous: false
        };
        this._setCurrentUser(participantUser);
        return participantUser;
      } catch (err) {
        console.warn('[AuthEngine] Google Popup falhou (ambiente local/não-HTTPS), usando identificação direta:', err);
      }
    }
    
    // Fallback: Identificação direta amigável sem window.prompt() bloqueante
    const mockUid = 'goog_' + Math.random().toString(36).substring(2, 10);
    const mockUser = {
      uid: mockUid,
      email: 'participante@evento.local',
      displayName: null,         // NB09: será preenchido após o usuário digitar o nome
      anonymousAlias: null,
      provider: 'google_local',
      role: 'participant',
      photoURL: null,
      isAuthenticated: true,
      isAnonymous: false
    };
    this._setCurrentUser(mockUser);
    // NB09: emitir evento para que a UI abra o modal de coleta de nome
    window.dispatchEvent(new CustomEvent('auth:request-name', { detail: { user: mockUser } }));
    return mockUser;
  }

  isAuthorizedForPresentation(manifest, sessionPin = null) {
    if (!manifest || !manifest.security) return { authorized: true };

    const sec = manifest.security;
    const mode = sec.mode || 'public';

    if (mode === 'public') {
      return { authorized: true };
    }

    if (mode === 'pin') {
      const savedPin = sessionStorage.getItem(`pres_pin_${manifest.id}`);
      const entered = sessionPin || savedPin;
      if (entered && String(entered).trim() === String(sec.pin).trim()) {
        sessionStorage.setItem(`pres_pin_${manifest.id}`, entered);
        return { authorized: true };
      }
      return { authorized: false, reason: 'PIN_REQUIRED', hint: sec.pinHint || 'Digite o PIN da apresentação' };
    }

    return { authorized: true };
  }

  async signOut() {
    if (this.isFirebaseReady && this.auth) {
      try {
        await this.firebaseAuthFns.signOut(this.auth);
      } catch (e) {}
    }
    sessionStorage.removeItem('admin_pin_authenticated');
    this._setCurrentUser(null);
  }

  onAuthStateChanged(callback) {
    this.authListeners.push(callback);
    callback(this.currentUser);
    return () => {
      this.authListeners = this.authListeners.filter(cb => cb !== callback);
    };
  }
}
