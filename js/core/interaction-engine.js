/**
 * Interaction Engine
 * Plataforma de Apresentação HTML Interativa
 * 
 * Gerencia o ciclo de vida de enquetes (polls), quizzes, submissão de votos com
 * garantia de VOTO ÚNICO por participante e computação de resultados em tempo real.
 */

export class InteractionEngine {
  constructor(realtimeEngine, authEngine) {
    this.realtime = realtimeEngine;
    this.auth = authEngine;
    this.pollListeners = new Map();
  }

  /**
   * Apresentador: Abre uma votação para a audiência
   */
  async openPoll(sessionId, pollId) {
    await this.realtime.updateSessionState(sessionId, {
      activePoll: pollId,
      pollStatus: 'open',
      showResults: false
    });
  }

  /**
   * Apresentador: Encerra uma votação (não aceita novos votos)
   */
  async closePoll(sessionId, pollId) {
    await this.realtime.updateSessionState(sessionId, {
      pollStatus: 'closed'
    });
  }

  /**
   * Apresentador: Alterna a exibição dos resultados (no telão e nos smartphones)
   */
  async toggleShowResults(sessionId, showResults = true) {
    await this.realtime.updateSessionState(sessionId, {
      showResults: showResults
    });
  }

  /**
   * Participante: Submete um voto em uma opção de enquete
   */
  async submitVote(sessionId, pollId, optionId) {
    const user = this.auth ? this.auth.getCurrentUser() : null;
    const uid = user ? user.uid : ('anon_' + Math.random().toString(36).substring(2, 8));

    // 0. Verifica se a sessão está encerrada
    const sessionRaw = localStorage.getItem(`session_state_${sessionId}`);
    if (sessionRaw) {
      try {
        const session = JSON.parse(sessionRaw);
        if (session.status === 'closed') {
          throw new Error('Esta apresentação foi encerrada. Novas votações não são mais aceitas.');
        }
        if (session.pollStatus === 'closed') {
          throw new Error('Esta votação foi encerrada pelo apresentador.');
        }
      } catch (e) {
        if (e.message && e.message.includes('encerrada')) throw e;
      }
    }

    const voteKey = `vote_${sessionId}_${pollId}_${uid}`;

    // 1. Verificação local no cliente
    const existingLocalVote = localStorage.getItem(voteKey);
    if (existingLocalVote) {
      throw new Error('Você já registrou seu voto nesta enquete.');
    }

    const votePayload = {
      pollId: pollId,
      optionId: optionId,
      uid: uid,
      timestamp: Date.now()
    };

    // 2. Grava voto no cache local do usuário
    localStorage.setItem(voteKey, JSON.stringify(votePayload));

    // 3. Registra no pool de votos da sessão
    const sessionVotesKey = `session_votes_${sessionId}_${pollId}`;
    let currentVotes = [];
    try {
      const stored = localStorage.getItem(sessionVotesKey);
      if (stored) currentVotes = JSON.parse(stored);
    } catch (e) {}

    const alreadyVoted = currentVotes.some(v => v.uid === uid);
    if (alreadyVoted) {
      throw new Error('Voto duplicado detectado.');
    }

    currentVotes.push(votePayload);
    localStorage.setItem(sessionVotesKey, JSON.stringify(currentVotes));

    // 4. Se Firebase estiver ativo, grava no Realtime DB
    if (this.realtime && this.realtime.isFirebaseReady && this.realtime.db) {
      try {
        const voteRef = this.realtime.firebaseFns.ref(
          this.realtime.db, 
          `sessions/${sessionId}/polls/${pollId}/votes/${uid}`
        );
        await this.realtime.firebaseFns.set(voteRef, {
          optionId: optionId,
          timestamp: this.realtime.firebaseFns.serverTimestamp()
        });
      } catch (err) {
        console.warn('[InteractionEngine] Erro Firebase vote:', err);
      }
    }

    // 5. Notifica via RealtimeEngine (Relay HTTP local e BroadcastChannel)
    if (this.realtime) {
      this.realtime.sendVote(sessionId, pollId, optionId, uid);
    }

    return votePayload;
  }

  /**
   * Alias de compatibilidade
   */
  async castVote(sessionId, pollId, optionId) {
    return this.submitVote(sessionId, pollId, optionId);
  }

  /**
   * Apresentador: Zera os votos de uma enquete
   */
  async resetPoll(sessionId, pollId) {
    localStorage.removeItem(`session_votes_${sessionId}_${pollId}`);
    
    // Limpa votos locais do usuário para esta enquete
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(`vote_${sessionId}_${pollId}_`)) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));

    if (this.realtime && this.realtime.isFirebaseReady && this.realtime.db) {
      try {
        const pollVotesRef = this.realtime.firebaseFns.ref(
          this.realtime.db, 
          `sessions/${sessionId}/polls/${pollId}/votes`
        );
        await this.realtime.firebaseFns.set(pollVotesRef, null);
      } catch (e) {}
    }

    if (this.realtime) {
      this.realtime.sendPollReset(sessionId, pollId);
    }
  }

  /**
   * Apresentador: Zera todas as enquetes da apresentação
   */
  async resetAllPolls(sessionId, pollIds = []) {
    for (const pid of pollIds) {
      await this.resetPoll(sessionId, pid);
    }
    if (this.realtime) {
      this.realtime.sendAllPollsReset(sessionId);
    }
  }

  /**
   * Obtém a opção em que o usuário logado/anônimo votou nesta enquete
   */
  getUserVote(sessionId, pollId) {
    const user = this.auth ? this.auth.getCurrentUser() : null;
    if (!user) return null;
    const uid = user.uid;

    const voteKey = `vote_${sessionId}_${pollId}_${uid}`;
    const local = localStorage.getItem(voteKey);
    if (local) {
      try {
        const parsed = JSON.parse(local);
        return parsed.optionId;
      } catch (e) {}
    }
    return null;
  }

  /**
   * Computa os resultados consolidados de uma enquete
   */
  computePollResults(sessionId, poll) {
    if (!poll) return { totalVotes: 0, options: [] };

    const sessionVotesKey = `session_votes_${sessionId}_${poll.id}`;
    let votesList = [];

    try {
      const stored = localStorage.getItem(sessionVotesKey);
      if (stored) votesList = JSON.parse(stored);
    } catch (e) {}

    const totalVotes = votesList.length;

    const optionsStats = (poll.options || []).map(opt => {
      const count = votesList.filter(v => (v.optionId === opt.id || v === opt.id)).length;
      const percentage = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
      return {
        id: opt.id,
        text: opt.text,
        votes: count,
        percentage: percentage
      };
    });

    return {
      pollId: poll.id,
      question: poll.question,
      totalVotes: totalVotes,
      options: optionsStats
    };
  }

  computeSessionSummary(sessionId, slidesData) {
    let totalPollVotes = 0;
    let totalQuestions = 0;

    if (slidesData && slidesData.slides) {
      slidesData.slides.forEach(s => {
        if (s.interaction && s.interaction.poll) {
          const res = this.computePollResults(sessionId, s.interaction.poll);
          totalPollVotes += res.totalVotes;
        }
      });
    }

    const qKey = `session_questions_${sessionId}`;
    try {
      const qStored = localStorage.getItem(qKey);
      if (qStored) {
        const qList = JSON.parse(qStored);
        totalQuestions = qList.length;
      }
    } catch (e) {}

    return {
      sessionId: sessionId,
      totalPollVotes: totalPollVotes,
      totalQuestions: totalQuestions
    };
  }
}
