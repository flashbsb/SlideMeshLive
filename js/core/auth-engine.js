/**
 * Authentication & Security Engine
 * Plataforma de Apresentação HTML Interativa
 * 
 * Gerencia autenticação híbrida:
 * 1. Online: Google Sign-In via Firebase Auth.
 * 2. Offline / Local: Contas e senhas locais configuradas em config/security.json.
 * 3. Mesa Técnica: PIN de segurança e Whitelist de administradores.
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
    this._loadCachedUser();
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
              anonymousAlias: this._generateAnonymousAlias(user.uid),
              provider: 'google',
              photoURL: user.photoURL,
              role: this.isEmailAdmin(user.email) ? 'admin' : 'participant'
            };
            this._setCurrentUser(participantUser);
          } else {
            // Se não houver user Firebase mas houver local auth, não sobrescreve
            if (this.currentUser && this.currentUser.provider !== 'local') {
              this._setCurrentUser(null);
            }
          }
        });
      } catch (err) {
        console.warn('[AuthEngine] Firebase Auth indisponível, modo local ativo:', err);
        this.isFirebaseReady = false;
      }
    }
  }

  /**
   * Carrega a configuração declarativa de segurança (config/security.json)
   */
  async loadSecurityConfig() {
    try {
      const basePath = window.location.pathname.includes('/presenter') || 
                       window.location.pathname.includes('/admin') || 
                       window.location.pathname.includes('/audience') ? '../' : './';
      const res = await fetch(`${basePath}config/security.json?t=${Date.now()}`);
      if (res.ok) {
        this.securityConfig = await res.json();
      }
    } catch (e) {
      console.warn('[AuthEngine] config/security.json não encontrado, usando padrões.');
      this.securityConfig = {
        admin: { pin: "2026", allowedEmails: [], users: [] },
        offlineAudience: { enabled: true, users: [] }
      };
    }
  }

  _loadCachedUser() {
    try {
      const saved = localStorage.getItem('apres_auth_user');
      if (saved) {
        this.currentUser = JSON.parse(saved);
      }
    } catch (e) {
      this.currentUser = null;
    }
  }

  _setCurrentUser(user) {
    this.currentUser = user;
    try {
      if (user) {
        localStorage.setItem('apres_auth_user', JSON.stringify(user));
      } else {
        localStorage.removeItem('apres_auth_user');
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
    return this.currentUser !== null;
  }

  get user() {
    return this.currentUser;
  }

  /**
   * Verifica se um e-mail está na lista de administradores
   */
  isEmailAdmin(email) {
    if (!email || !this.securityConfig || !this.securityConfig.admin) return false;
    const allowed = this.securityConfig.admin.allowedEmails || [];
    return allowed.some(a => a.toLowerCase() === email.toLowerCase());
  }

  /**
   * Valida PIN de Mesa Técnica / Admin
   */
  verifyAdminPIN(pin) {
    if (!this.securityConfig || !this.securityConfig.admin) return pin === '2026';
    const correctPin = String(this.securityConfig.admin.pin || '2026');
    const valid = (String(pin).trim() === correctPin.trim());
    if (valid) {
      sessionStorage.setItem('admin_pin_authenticated', 'true');
    }
    return valid;
  }

  isAdminAuthenticated() {
    const isPinAuth = sessionStorage.getItem('admin_pin_authenticated') === 'true';
    const isRoleAdmin = this.currentUser && (this.currentUser.role === 'admin' || this.isEmailAdmin(this.currentUser.email));
    return isPinAuth || isRoleAdmin;
  }

  /**
   * Realiza login com Usuário e Senha Local (100% Offline)
   */
  async signInWithLocalCredentials(username, password) {
    if (!this.securityConfig) await this.loadSecurityConfig();

    const u = String(username).trim();
    const p = String(password).trim();

    // 1. Verifica usuários administradores locais
    const adminUsers = (this.securityConfig && this.securityConfig.admin && this.securityConfig.admin.users) || [];
    const adminMatch = adminUsers.find(acc => acc.username.toLowerCase() === u.toLowerCase() && acc.password === p);

    if (adminMatch) {
      const localUser = {
        uid: 'local_adm_' + adminMatch.username,
        email: `${adminMatch.username}@local`,
        displayName: adminMatch.name || adminMatch.username,
        anonymousAlias: adminMatch.name || adminMatch.username,
        provider: 'local',
        role: adminMatch.role || 'admin',
        photoURL: null
      };
      this._setCurrentUser(localUser);
      sessionStorage.setItem('admin_pin_authenticated', 'true');
      return localUser;
    }

    // 2. Verifica usuários da audiência offline
    const audienceUsers = (this.securityConfig && this.securityConfig.offlineAudience && this.securityConfig.offlineAudience.users) || [];
    const audienceMatch = audienceUsers.find(acc => acc.username.toLowerCase() === u.toLowerCase() && acc.password === p);

    if (audienceMatch) {
      const localUser = {
        uid: 'local_aud_' + audienceMatch.username,
        email: `${audienceMatch.username}@local`,
        displayName: audienceMatch.name || audienceMatch.username,
        anonymousAlias: audienceMatch.name || this._generateAnonymousAlias(audienceMatch.username),
        provider: 'local',
        role: 'participant',
        photoURL: null
      };
      this._setCurrentUser(localUser);
      return localUser;
    }

    throw new Error('Usuário ou senha incorretos.');
  }

  /**
   * Alias de conveniência para signInWithLocalCredentials
   */
  async signInWithLocalPassword(username, password) {
    return this.signInWithLocalCredentials(username, password);
  }

  /**
   * Realiza login com Google
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
          anonymousAlias: this._generateAnonymousAlias(user.uid),
          provider: 'google',
          photoURL: user.photoURL,
          role: this.isEmailAdmin(user.email) ? 'admin' : 'participant'
        };
        this._setCurrentUser(participantUser);
        return participantUser;
      } catch (err) {
        console.error('[AuthEngine] Erro ao autenticar no Google:', err);
        throw err;
      }
    } else {
      const mockUid = 'goog_' + Math.random().toString(36).substring(2, 12);
      const mockUser = {
        uid: mockUid,
        email: 'usuario.demo@empresa.com.br',
        displayName: 'Participante Google',
        anonymousAlias: this._generateAnonymousAlias(mockUid),
        provider: 'google_mock',
        role: 'participant',
        photoURL: null
      };
      this._setCurrentUser(mockUser);
      return mockUser;
    }
  }

  /**
   * Valida se o usuário tem permissão para acessar a apresentação
   */
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

    if (mode === 'restricted') {
      if (!this.isAuthenticated || !this.currentUser) {
        return { authorized: false, reason: 'AUTH_REQUIRED' };
      }

      // Permite administradores e usuários locais
      if (this.currentUser.role === 'admin' || this.currentUser.provider === 'local') {
        return { authorized: true };
      }

      // Valida domínios de e-mail permitidos
      const email = this.currentUser.email || '';
      const domain = email.split('@')[1] || '';
      const allowedDomains = sec.allowedDomains || [];

      if (allowedDomains.some(d => d.toLowerCase() === domain.toLowerCase())) {
        return { authorized: true };
      }

      return { authorized: false, reason: 'DOMAIN_FORBIDDEN', message: `Acesso restrito aos domínios: ${allowedDomains.join(', ')}` };
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
