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
    const user = this.auth ? this.auth.getCurrentUser() : null;
    const uid = user ? user.uid : ('anon_' + Math.random().toString(36).substring(2, 8));
    const authorAlias = (user && user.displayName) || (user && user.anonymousAlias) || 'Participante';

    // Proteção contra abuso e Rate Limiting
    const check = this.guard.canUserSubmitQuestion(sessionId, uid);
    if (!check.allowed) {
      throw new Error(check.reason);
    }

    const cleanText = (text || '').trim();
    if (cleanText.length < 3) {
      throw new Error('A pergunta deve ter pelo menos 3 caracteres.');
    }
    if (cleanText.length > 300) {
      throw new Error('A pergunta não pode exceder 300 caracteres.');
    }

    const questionId = 'q_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);

    const questionPayload = {
      id: questionId,
      text: cleanText,
      uid: uid,
      authorAlias: authorAlias,
      status: 'pending', // 'pending', 'approved', 'featured', 'rejected'
      timestamp: Date.now()
    };

    // 1. Registra timestamp para rate limit
    this.guard.recordQuestionSubmission(sessionId, uid);

    // 2. Salva no pool de perguntas local da sessão
    const storageKey = `session_questions_${sessionId}`;
    let questions = [];
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) questions = JSON.parse(stored);
    } catch (e) {}

    questions.push(questionPayload);
    localStorage.setItem(storageKey, JSON.stringify(questions));

    // 3. Se Firebase estiver ativo, grava no Realtime Database
    if (this.realtime && this.realtime.isFirebaseReady && this.realtime.db) {
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
        console.warn('[ModerationEngine] Erro Firebase question:', err);
      }
    }

    // 4. Notifica via RealtimeEngine (Hub local /api/sync e BroadcastChannel)
    if (this.realtime) {
      this.realtime.sendQuestion(sessionId, questionPayload);
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
    // NB06 / NC03: propagar para rede local via hub HTTP com status e answered (celulares recebem em < 2s)
    if (this.realtime) {
      const targetQ = questions.find(q => q.id === questionId);
      const answeredVal = targetQ ? (targetQ.answered || false) : false;
      this.realtime.sendQuestionStatus(sessionId, questionId, status, answeredVal);
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
    // Extra-A: propagar remoção de destaque para rede local via hub HTTP
    if (this.realtime) {
      this.realtime.sendQuestionStatus(sessionId, null, 'clear_featured');
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
   * Obtém perguntas pendentes de moderação
   */
  getPendingQuestions(sessionId) {
    return this.getQuestions(sessionId).filter(q => q.status === 'pending');
  }

  /**
   * Obtém a pergunta atualmente destacada
   */
  getFeaturedQuestion(sessionId) {
    return this.getQuestions(sessionId).find(q => q.status === 'featured') || null;
  }

  /**
   * Obtém perguntas aprovadas / visíveis ao público
   */
  getApprovedQuestions(sessionId) {
    return this.getQuestions(sessionId).filter(q => q.status === 'approved' || q.status === 'featured');
  }

  /**
   * Obtém perguntas públicas liberadas pelo moderador (Garantia de Moderação ADR-04)
   */
  getPublicQuestions(sessionId) {
    return this.getApprovedQuestions(sessionId);
  }

  /**
   * Obtém perguntas enviadas pelo usuário logado
   */
  getMyQuestions(sessionId) {
    const user = this.auth ? this.auth.getCurrentUser() : null;
    if (!user) return [];
    const uid = user.uid;
    return this.getQuestions(sessionId).filter(q => q.uid === uid);
  }

  /**
   * Verifica se o usuário atual curtiu/votou na pergunta
   */
  hasUserUpvoted(sessionId, questionId, uid = null) {
    if (!uid) {
      const user = this.auth ? this.auth.getCurrentUser() : null;
      uid = user ? user.uid : null;
    }
    if (!uid) return false;
    const questions = this.getQuestions(sessionId);
    const q = questions.find(item => item.id === questionId);
    if (!q || !Array.isArray(q.upvotedBy)) {
      return localStorage.getItem(`upvote_${sessionId}_${questionId}_${uid}`) === 'true';
    }
    return q.upvotedBy.includes(uid);
  }

  /**
   * Alterna upvote (curtida) do participante em uma pergunta aprovada
   */
  async toggleQuestionUpvote(sessionId, questionId, uid = null) {
    if (!uid) {
      const user = this.auth ? this.auth.getCurrentUser() : null;
      uid = user ? user.uid : 'anon_' + Math.random().toString(36).substr(2, 6);
    }

    const storageKey = `session_questions_${sessionId}`;
    let questions = this.getQuestions(sessionId);
    let updatedQuestion = null;

    questions = questions.map(q => {
      if (q.id === questionId) {
        const upvotedBy = Array.isArray(q.upvotedBy) ? [...q.upvotedBy] : [];
        let upvotes = typeof q.upvotes === 'number' ? q.upvotes : upvotedBy.length;
        const hasUpvoted = upvotedBy.includes(uid);

        if (hasUpvoted) {
          const nextUpvotedBy = upvotedBy.filter(u => u !== uid);
          updatedQuestion = {
            ...q,
            upvotes: Math.max(0, upvotes - 1),
            upvotedBy: nextUpvotedBy
          };
          return updatedQuestion;
        } else {
          const nextUpvotedBy = [...upvotedBy, uid];
          updatedQuestion = {
            ...q,
            upvotes: upvotes + 1,
            upvotedBy: nextUpvotedBy
          };
          return updatedQuestion;
        }
      }
      return q;
    });

    localStorage.setItem(storageKey, JSON.stringify(questions));

    const userVoteKey = `upvote_${sessionId}_${questionId}_${uid}`;
    if (updatedQuestion && updatedQuestion.upvotedBy.includes(uid)) {
      localStorage.setItem(userVoteKey, 'true');
    } else {
      localStorage.removeItem(userVoteKey);
    }

    if (this.realtime && this.realtime.channel) {
      try {
        this.realtime.channel.postMessage({
          type: 'QUESTION_UPVOTE_CHANGE',
          sessionId: sessionId,
          questionId: questionId,
          upvotes: updatedQuestion ? updatedQuestion.upvotes : 0,
          upvotedBy: updatedQuestion ? updatedQuestion.upvotedBy : []
        });
      } catch (e) {}
    }

    if (this.realtime && typeof this.realtime.sendQuestionUpvote === 'function') {
      await this.realtime.sendQuestionUpvote(sessionId, questionId, uid);
    }

    return updatedQuestion;
  }


  /**
   * Apresentador/Admin: Exclui permanentemente uma pergunta individual
   */
  async deleteQuestion(sessionId, questionId) {
    const storageKey = `session_questions_${sessionId}`;
    let questions = this.getQuestions(sessionId);
    questions = questions.filter(q => q.id !== questionId);
    localStorage.setItem(storageKey, JSON.stringify(questions));

    // Notifica canais locais
    if (this.realtime.channel) {
      this.realtime.channel.postMessage({
        type: 'QUESTION_STATUS_CHANGE',
        sessionId: sessionId,
        action: 'deleted',
        questionId: questionId
      });
    }
    // NB07: propagar exclusão para rede local via hub HTTP
    if (this.realtime) {
      this.realtime.sendLocalServerEvent('QUESTION_STATUS_CHANGE', sessionId, {
        questionId: questionId,
        status: 'deleted'
      });
    }

    // Atualiza Firebase se ativo
    if (this.realtime.isFirebaseReady) {
      await this.realtime.deleteFirebaseNode(`sessions/${sessionId}/questions/${questionId}`);
    }
  }

  /**
   * Apresentador/Admin: Limpa todas as perguntas da sessão
   */
  async clearAllQuestions(sessionId) {
    const storageKey = `session_questions_${sessionId}`;
    localStorage.removeItem(storageKey);

    if (this.realtime.channel) {
      this.realtime.channel.postMessage({
        type: 'QUESTION_STATUS_CHANGE',
        sessionId: sessionId,
        action: 'cleared_all'
      });
    }
    // NB07: propagar limpeza total para rede local via hub HTTP
    if (this.realtime) {
      this.realtime.sendClearQuestions(sessionId);
    }

    if (this.realtime.isFirebaseReady) {
      await this.realtime.deleteFirebaseNode(`sessions/${sessionId}/questions`);
    }
  }

  /**
   * Apresentador/Admin: Marca ou desmarca uma pergunta como respondida
   */
  async toggleQuestionAnswered(sessionId, questionId) {
    const storageKey = `session_questions_${sessionId}`;
    let questions = this.getQuestions(sessionId);
    let target = questions.find(q => q.id === questionId);
    if (!target) return false;

    target.answered = !target.answered;
    target.answeredAt = target.answered ? Date.now() : null;

    localStorage.setItem(storageKey, JSON.stringify(questions));

    if (this.realtime.channel) {
      this.realtime.channel.postMessage({
        type: 'QUESTION_STATUS_CHANGE',
        sessionId: sessionId,
        action: 'answered_toggle',
        questionId: questionId,
        answered: target.answered
      });
    }
    // Extra-B: propagar toggle de respondida para rede local via hub HTTP
    if (this.realtime) {
      this.realtime.sendQuestionStatus(sessionId, questionId, 'answered_toggle', target.answered);
    }

    if (this.realtime.isFirebaseReady) {
      await this.realtime.setFirebaseNode(`sessions/${sessionId}/questions/${questionId}/answered`, target.answered);
    }

    return target.answered;
  }

  /**
   * Obtém até N perguntas aprovadas e ainda não respondidas
   */
  getUnansweredApprovedQuestions(sessionId, limit = 10) {
    return this.getQuestions(sessionId)
      .filter(q => (q.status === 'approved' || q.status === 'featured') && !q.answered)
      .slice(0, limit);
  }

  /**
   * Apresentador: Bloqueia ou desbloqueia um participante
   */
  toggleBlockUser(sessionId, uid) {
    const isBlocked = this.guard.toggleBlockUser(sessionId, uid);
    this.realtime.sendUserBlocked(sessionId, uid, isBlocked);
    return isBlocked;
  }

  isUserBlocked(sessionId, uid) {
    return this.guard.isUserBlocked(sessionId, uid);
  }
}
