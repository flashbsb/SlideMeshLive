/**
 * Security & Anti-Abuse Guard
 * Plataforma de Apresentação HTML Interativa
 * 
 * Implementa rate limiting, controle de participantes bloqueados e regras de encerramento de sessão.
 */

export class SecurityGuard {
  constructor(sessionId) {
    this.sessionId = sessionId;
    this.questionCooldownMs = 25000; // 25 segundos de intervalo entre perguntas
    this.maxPendingQuestionsPerUser = 3;
  }

  /**
   * Verifica se o participante pode enviar uma nova pergunta
   */
  canUserSubmitQuestion(sessionId, uid) {
    // 1. Verifica se a sessão está encerrada
    const sessionRaw = localStorage.getItem(`session_state_${sessionId}`);
    if (sessionRaw) {
      try {
        const session = JSON.parse(sessionRaw);
        if (session.status === 'closed') {
          return { allowed: false, reason: 'Esta sessão de apresentação já foi encerrada.' };
        }
      } catch (e) {}
    }

    // 2. Verifica se o UID está na lista de bloqueados
    if (this.isUserBlocked(sessionId, uid)) {
      return { allowed: false, reason: 'Sua participação foi suspensa pelo moderador da sessão.' };
    }

    // 3. Verifica Rate Limiting por tempo (cooldown)
    const lastQuestionTime = localStorage.getItem(`last_question_time_${sessionId}_${uid}`);
    if (lastQuestionTime) {
      const elapsed = Date.now() - parseInt(lastQuestionTime, 10);
      if (elapsed < this.questionCooldownMs) {
        const remainingSec = Math.ceil((this.questionCooldownMs - elapsed) / 1000);
        return { 
          allowed: false, 
          reason: `Aguarde ${remainingSec} segundos antes de enviar outra pergunta.` 
        };
      }
    }

    // 4. Verifica limite de perguntas pendentes acumuladas
    const questionsRaw = localStorage.getItem(`session_questions_${sessionId}`);
    if (questionsRaw) {
      try {
        const questions = JSON.parse(questionsRaw);
        const userPending = questions.filter(q => q.uid === uid && q.status === 'pending');
        if (userPending.length >= this.maxPendingQuestionsPerUser) {
          return { 
            allowed: false, 
            reason: 'Você já possui 3 perguntas aguardando moderação. Aguarde aprovação antes de enviar mais.' 
          };
        }
      } catch (e) {}
    }

    return { allowed: true };
  }

  /**
   * Registra a marcação de tempo da última pergunta enviada
   */
  recordQuestionSubmission(sessionId, uid) {
    try {
      localStorage.setItem(`last_question_time_${sessionId}_${uid}`, Date.now().toString());
    } catch (e) {}
  }

  /**
   * Verifica se um participante está bloqueado na sessão
   */
  isUserBlocked(sessionId, uid) {
    try {
      const blockedRaw = localStorage.getItem(`session_blocked_users_${sessionId}`);
      if (!blockedRaw) return false;
      const blockedList = JSON.parse(blockedRaw);
      return blockedList.includes(uid);
    } catch (e) {
      return false;
    }
  }

  /**
   * Apresentador: Bloqueia ou desbloqueia um participante
   */
  toggleBlockUser(sessionId, uid) {
    try {
      const blockedKey = `session_blocked_users_${sessionId}`;
      let blockedList = [];
      const blockedRaw = localStorage.getItem(blockedKey);
      if (blockedRaw) blockedList = JSON.parse(blockedRaw);

      if (blockedList.includes(uid)) {
        blockedList = blockedList.filter(id => id !== uid);
      } else {
        blockedList.push(uid);
      }

      localStorage.setItem(blockedKey, JSON.stringify(blockedList));
      return blockedList.includes(uid);
    } catch (e) {
      return false;
    }
  }

  /**
   * Obtém lista de UIDs bloqueados
   */
  getBlockedUsers(sessionId) {
    try {
      const blockedRaw = localStorage.getItem(`session_blocked_users_${sessionId}`);
      return blockedRaw ? JSON.parse(blockedRaw) : [];
    } catch (e) {
      return [];
    }
  }
}
