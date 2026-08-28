/**
 * Moderation Engine
 * Plataforma de Apresentação HTML Interativa
 * 
 * Gerencia a submissão de perguntas pelo público autenticado e a fila de moderação
 * em tempo real para o apresentador (Aprovar, Destacar no Telão, Rejeitar).
 */

import { SecurityGuard } from './security-guard.js';

export class ModerationEngine {
  constructor(realtimeEngine, authEngine) {
    this.realtime = realtimeEngine;
    this.auth = authEngine;
    this.guard = new SecurityGuard();
    this.questionsListeners = new Map();
  }

  /**
   * Participante: Envia uma nova pergunta para a fila de moderação
   */
  async submitQuestion(sessionId, text) {
    if (!this.auth.isAuthenticated || !this.auth.user) {
      throw new Error('É necessário estar identificado para enviar perguntas.');
    }

    const uid = this.auth.user.uid;

    // Proteção contra abuso e Rate Limiting
    const check = this.guard.canUserSubmitQuestion(sessionId, uid);
    if (!check.allowed) {
      throw new Error(check.reason);
    }

    const cleanText = (text || '').trim();
    if (cleanText.length < 5) {
      throw new Error('A pergunta deve ter pelo menos 5 caracteres.');
    }
    if (cleanText.length > 300) {
      throw new Error('A pergunta não pode exceder 300 caracteres.');
    }

    const questionId = 'q_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);

    const questionPayload = {
      id: questionId,
      text: cleanText,
      uid: uid,
      authorAlias: this.auth.user.anonymousAlias || 'Participante',
      status: 'pending', // 'pending', 'approved', 'featured', 'rejected'
      timestamp: Date.now()
    };

    // 1. Registra timestamp para rate limit
    this.guard.recordQuestionSubmission(sessionId, uid);

    // 1. Salva no pool de perguntas local da sessão
    const storageKey = `session_questions_${sessionId}`;
    let questions = [];
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) questions = JSON.parse(stored);
    } catch (e) {}

    questions.push(questionPayload);
    localStorage.setItem(storageKey, JSON.stringify(questions));

    // 2. Se Firebase estiver ativo, grava no Realtime Database
    if (this.realtime.isFirebaseReady && this.realtime.db) {
      try {
        const qRef = this.realtime.firebaseFns.ref(
          this.realtime.db, 
          `sessions/${sessionId}/questions/${questionId}`
        );
        await this.realtime.firebaseFns.set(qRef, {
          ...questionPayload,
          timestamp: this.realtime.firebaseFns.serverTimestamp()
        });
      } catch (err) {
        console.error('[ModerationEngine] Erro Firebase question:', err);
      }
    }

    // 3. Notifica via canal em tempo real
    if (this.realtime.channel) {
      try {
        this.realtime.channel.postMessage({
          type: 'NEW_QUESTION',
          sessionId: sessionId,
          question: questionPayload
        });
      } catch (e) {}
    }

    return questionPayload;
  }

  /**
   * Apresentador: Atualiza o status de uma pergunta (approve, feature, reject)
   */
  async setQuestionStatus(sessionId, questionId, status) {
    const storageKey = `session_questions_${sessionId}`;
    let questions = [];
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) questions = JSON.parse(stored);
    } catch (e) {}

    questions = questions.map(q => {
      if (q.id === questionId) {
        return { ...q, status: status };
      }
      // Se estiver destacando uma nova pergunta, remove o destaque das outras
      if (status === 'featured' && q.status === 'featured') {
        return { ...q, status: 'approved' };
      }
      return q;
    });

    localStorage.setItem(storageKey, JSON.stringify(questions));

    // Atualiza estado de pergunta destacada na sessão
    const featuredQ = questions.find(q => q.status === 'featured');
    await this.realtime.updateSessionState(sessionId, {
      featuredQuestion: featuredQ || null
    });

    if (this.realtime.isFirebaseReady && this.realtime.db) {
      try {
        const qRef = this.realtime.firebaseFns.ref(
          this.realtime.db, 
          `sessions/${sessionId}/questions/${questionId}/status`
        );
        await this.realtime.firebaseFns.set(qRef, status);
      } catch (err) {}
    }

    if (this.realtime.channel) {
      try {
        this.realtime.channel.postMessage({
          type: 'QUESTION_STATUS_CHANGE',
          sessionId: sessionId,
          questionId: questionId,
          status: status,
          questions: questions
        });
      } catch (e) {}
    }
  }

  /**
   * Apresentador: Remove o destaque do telão
   */
  async clearFeatured(sessionId) {
    const storageKey = `session_questions_${sessionId}`;
    let questions = [];
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) questions = JSON.parse(stored);
    } catch (e) {}

    questions = questions.map(q => q.status === 'featured' ? { ...q, status: 'approved' } : q);
    localStorage.setItem(storageKey, JSON.stringify(questions));

    await this.realtime.updateSessionState(sessionId, {
      featuredQuestion: null
    });

    if (this.realtime.channel) {
      try {
        this.realtime.channel.postMessage({
          type: 'QUESTION_STATUS_CHANGE',
          sessionId: sessionId,
          questions: questions
        });
      } catch (e) {}
    }
  }

  /**
   * Obtém todas as perguntas da sessão
   */
  getQuestions(sessionId) {
    const storageKey = `session_questions_${sessionId}`;
    try {
      const stored = localStorage.getItem(storageKey);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  }

  /**
   * Obtém perguntas aprovadas / visíveis ao público
   */
  getApprovedQuestions(sessionId) {
    return this.getQuestions(sessionId).filter(q => q.status === 'approved' || q.status === 'featured');
  }

  /**
   * Obtém perguntas enviadas pelo usuário logado
   */
  getMyQuestions(sessionId) {
    if (!this.auth.isAuthenticated || !this.auth.user) return [];
    const uid = this.auth.user.uid;
    return this.getQuestions(sessionId).filter(q => q.uid === uid);
  }

  /**
   * Apresentador: Bloqueia ou desbloqueia um participante
   */
  toggleBlockUser(sessionId, uid) {
    return this.guard.toggleBlockUser(sessionId, uid);
  }

  isUserBlocked(sessionId, uid) {
    return this.guard.isUserBlocked(sessionId, uid);
  }
}
