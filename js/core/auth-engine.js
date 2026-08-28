/**
 * Authentication Engine
 * Plataforma de Apresentação HTML Interativa
 * 
 * Gerencia a autenticação de participantes e apresentadores via Firebase Authentication
 * (Google Sign-In) com suporte a perfil anônimo técnico para privacidade do público.
 */

import { APP_CONFIG } from '../config.js';

export class AuthEngine {
  constructor(options = {}) {
    this.config = options.config || APP_CONFIG;
    this.auth = null;
    this.currentUser = null;
    this.isFirebaseReady = false;
    this.authListeners = [];

    this.init();
  }

  async init() {
    // Recupera usuário autenticado em cache local/session
    this._loadCachedUser();

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

        // Monitora mudanças de autenticação reais no Firebase
        this.firebaseAuthFns.onAuthStateChanged(this.auth, (user) => {
          if (user) {
            const participantUser = {
              uid: user.uid,
              email: user.email,
              displayName: user.displayName || 'Participante',
              anonymousAlias: this._generateAnonymousAlias(user.uid),
              provider: 'google',
              photoURL: user.photoURL
            };
            this._setCurrentUser(participantUser);
          } else {
            this._setCurrentUser(null);
          }
        });
        console.log('[AuthEngine] Firebase Authentication inicializado com sucesso.');
      } catch (err) {
        console.warn('[AuthEngine] Firebase Auth não conectado, utilizando modo de autenticação simulado:', err);
        this.isFirebaseReady = false;
      }
    } else {
      console.log('[AuthEngine] Modo Local / Simulação de Google Auth ativo.');
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
    // Gera um código simples como "Participante #83" com base nos últimos dígitos do UID
    let hash = 0;
    for (let i = 0; i < uid.length; i++) {
      hash = ((hash << 5) - hash) + uid.charCodeAt(i);
      hash |= 0;
    }
    const num = Math.abs(hash % 900) + 100;
    return `Participante #${num}`;
  }

  get isAuthenticated() {
    return this.currentUser !== null;
  }

  get user() {
    return this.currentUser;
  }

  /**
   * Realiza login com Google (Firebase real ou Fallback Local imediato)
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
          photoURL: user.photoURL
        };
        this._setCurrentUser(participantUser);
        return participantUser;
      } catch (err) {
        console.error('[AuthEngine] Erro ao autenticar no Google Firebase:', err);
        throw err;
      }
    } else {
      // Modo Local / Simulação amigável de Google Sign-In
      const mockUid = 'goog_' + Math.random().toString(36).substring(2, 12);
      const mockUser = {
        uid: mockUid,
        email: 'usuario.demo@gmail.com',
        displayName: 'Participante Conectado',
        anonymousAlias: this._generateAnonymousAlias(mockUid),
        provider: 'google_mock',
        photoURL: null
      };
      this._setCurrentUser(mockUser);
      return mockUser;
    }
  }

  /**
   * Realiza logout
   */
  async signOut() {
    if (this.isFirebaseReady && this.auth) {
      try {
        await this.firebaseAuthFns.signOut(this.auth);
      } catch (e) {}
    }
    this._setCurrentUser(null);
  }

  onAuthStateChanged(callback) {
    this.authListeners.push(callback);
    // Executa imediatamente com o estado atual
    callback(this.currentUser);

    return () => {
      this.authListeners = this.authListeners.filter(cb => cb !== callback);
    };
  }
}
