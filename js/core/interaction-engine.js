/**
 * Interaction Engine
 * Plataforma de Apresentação HTML Interativa
 * 
 * Gerencia o ciclo de vida de enquetes (polls), quizzes, submissão de votos com
 * garantia de VOTO ÚNICO por UID autenticado e computação de resultados em tempo real.
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
    if (!this.auth.isAuthenticated || !this.auth.user) {
      throw new Error('É necessário estar identificado para votar.');
    }

    const uid = this.auth.user.uid;
    const voteKey = `vote_${sessionId}_${pollId}_${uid}`;

    // 1. Verificação local no cliente (primeira barreira)
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

    // 3. Registra no pool de votos da sessão (armazenamento de votos)
    const sessionVotesKey = `session_votes_${sessionId}_${pollId}`;
    let currentVotes = [];
    try {
      const stored = localStorage.getItem(sessionVotesKey);
      if (stored) currentVotes = JSON.parse(stored);
    } catch (e) {}

    // Verifica duplicidade no pool
    const alreadyVoted = currentVotes.some(v => v.uid === uid);
    if (alreadyVoted) {
      throw new Error('Voto duplicado detectado. Cada participante pode votar apenas uma vez.');
    }

    currentVotes.push(votePayload);
    localStorage.setItem(sessionVotesKey, JSON.stringify(currentVotes));

    // 4. Se Firebase estiver ativo, envia para o Realtime DB com proteção de regra
    if (this.realtime.isFirebaseReady && this.realtime.db) {
      try {
        const voteRef = this.realtime.firebaseFns.ref(
          this.realtime.db, 
          `sessions/${sessionId}/votes/${pollId}/${uid}`
        );
        await this.realtime.firebaseFns.set(voteRef, {
          optionId: optionId,
          timestamp: this.realtime.firebaseFns.serverTimestamp()
        });
      } catch (err) {
        console.error('[InteractionEngine] Erro ao gravar voto no Firebase:', err);
      }
    }

    // 5. Notifica via canal em tempo real
    if (this.realtime.channel) {
      try {
        this.realtime.channel.postMessage({
          type: 'VOTE_CAST',
          sessionId: sessionId,
          pollId: pollId,
          vote: votePayload,
          totalVotes: currentVotes.length
        });
      } catch (e) {}
    }

    return votePayload;
  }

  /**
   * Verifica se o usuário atual já votou em determinada enquete
   */
  hasUserVoted(sessionId, pollId) {
    if (!this.auth.isAuthenticated || !this.auth.user) return false;
    const uid = this.auth.user.uid;
    return localStorage.getItem(`vote_${sessionId}_${pollId}_${uid}`) !== null;
  }

  /**
   * Obtém a opção em que o usuário votou
   */
  getUserVoteOption(sessionId, pollId) {
    if (!this.auth.isAuthenticated || !this.auth.user) return null;
    const uid = this.auth.user.uid;
    const raw = localStorage.getItem(`vote_${sessionId}_${pollId}_${uid}`);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        return parsed.optionId;
      } catch (e) {}
    }
    return null;
  }

  /**
   * Calcula as estatísticas e percentuais de uma enquete
   */
  computePollResults(sessionId, poll, rawVotes = null) {
    let votes = rawVotes;
    if (!votes) {
      try {
        const sessionVotesKey = `session_votes_${sessionId}_${poll.id}`;
        const stored = localStorage.getItem(sessionVotesKey);
        votes = stored ? JSON.parse(stored) : [];
      } catch (e) {
        votes = [];
      }
    }

    const totalVotes = votes.length;
    const counts = {};
    (poll.options || []).forEach(opt => {
      counts[opt.id] = 0;
    });

    votes.forEach(v => {
      if (counts[v.optionId] !== undefined) {
        counts[v.optionId]++;
      }
    });

    const results = (poll.options || []).map(opt => {
      const count = counts[opt.id] || 0;
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
      totalVotes: totalVotes,
      options: results
    };
  }
}
