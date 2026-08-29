/**
 * Session Manager
 * Plataforma de Apresentação HTML Interativa Sincronizada
 * 
 * Gerencia o ciclo de vida de múltiplas apresentações/sessões:
 * - Histórico de sessões passadas
 * - Arquivamento automático ao finalizar
 * - Exportação individual ou global em JSON
 * - Exclusão de sessões antigas
 * - Criação e inicialização de nova sessão limpa
 */

export class SessionManager {
  constructor() {
    this.historyKey = 'presentation_sessions_history';
  }

  /**
   * Obtém a lista de todas as sessões registradas no histórico
   */
  getSessionsHistory() {
    try {
      const raw = localStorage.getItem(this.historyKey);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  /**
   * Registra ou atualiza uma sessão no histórico
   */
  saveSessionToHistory(sessionData) {
    try {
      const history = this.getSessionsHistory();
      const existingIdx = history.findIndex(s => s.sessionId === sessionData.sessionId);
      
      const payload = {
        sessionId: sessionData.sessionId,
        presentationId: sessionData.presentationId || 'sdwan-cpe-unificado',
        presentationTitle: sessionData.presentationTitle || 'Apresentação',
        status: sessionData.status || 'active',
        createdAt: sessionData.createdAt || Date.now(),
        updatedAt: Date.now(),
        totalParticipants: sessionData.totalParticipants || 0,
        totalVotes: sessionData.totalVotes || 0,
        totalQuestions: sessionData.totalQuestions || 0
      };

      if (existingIdx >= 0) {
        history[existingIdx] = { ...history[existingIdx], ...payload };
      } else {
        history.unshift(payload);
      }

      localStorage.setItem(this.historyKey, JSON.stringify(history));
      return payload;
    } catch (e) {
      console.warn('Erro ao salvar histórico de sessão:', e);
      return null;
    }
  }

  /**
   * Inicia uma nova sessão limpa
   */
  createNewSession(presentationId, customCode = '') {
    const cleanCode = (customCode || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    const newSessionId = cleanCode || ('SES_' + Date.now().toString(36).toUpperCase());

    const initialSessionState = {
      sessionId: newSessionId,
      presentationId: presentationId || 'sdwan-cpe-unificado',
      currentSlide: 0,
      slideId: 1,
      status: 'running',
      pollStatus: 'open',
      showResults: false,
      showFinalAnalytics: false,
      featuredQuestion: null,
      updatedAt: Date.now()
    };

    // 1. Grava novo estado da sessão ativa
    localStorage.setItem(`session_state_${newSessionId}`, JSON.stringify(initialSessionState));
    localStorage.setItem('active_presentation_session', newSessionId);

    // 2. Limpa dados de perguntas, votos e presenças para a nova sessão
    localStorage.removeItem(`session_questions_${newSessionId}`);
    localStorage.removeItem(`session_presence_${newSessionId}`);
    localStorage.removeItem(`session_blocked_users_${newSessionId}`);

    // 3. Registra no histórico
    this.saveSessionToHistory({
      sessionId: newSessionId,
      presentationId: presentationId,
      status: 'active',
      createdAt: Date.now()
    });

    return newSessionId;
  }

  /**
   * Remove permanentemente todos os dados de uma sessão específica
   */
  deleteSession(sessionId) {
    try {
      const normId = (sessionId || '').trim().toUpperCase();
      
      // 1. Remove do histórico
      let history = this.getSessionsHistory();
      history = history.filter(s => s.sessionId !== normId);
      localStorage.setItem(this.historyKey, JSON.stringify(history));

      // 2. Remove todas as chaves associadas no localStorage
      localStorage.removeItem(`session_state_${normId}`);
      localStorage.removeItem(`session_questions_${normId}`);
      localStorage.removeItem(`session_presence_${normId}`);
      localStorage.removeItem(`session_blocked_users_${normId}`);

      // Remove votos de enquetes
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && (key.startsWith(`session_votes_${normId}`) || key.startsWith(`vote_${normId}`))) {
          localStorage.removeItem(key);
        }
      }

      return true;
    } catch (e) {
      console.warn('Erro ao deletar sessão:', e);
      return false;
    }
  }

  /**
   * Compila o relatório completo de uma sessão para exportação
   */
  compileSessionReport(sessionId, slidesData = null) {
    const normId = (sessionId || '').trim().toUpperCase();
    
    // Perguntas
    let questions = [];
    try {
      const qRaw = localStorage.getItem(`session_questions_${normId}`);
      if (qRaw) questions = JSON.parse(qRaw);
    } catch (e) {}

    // Presença e Audiência (M06)
    let presenceMap = {};
    try {
      const pRaw = localStorage.getItem(`session_presence_${normId}`);
      if (pRaw) presenceMap = JSON.parse(pRaw);
    } catch (e) {}

    const participantsList = Object.values(presenceMap);
    const presenceStats = {
      total: participantsList.length,
      authenticated: participantsList.filter(p => p.isAuthenticated).length,
      anonymous: participantsList.filter(p => !p.isAuthenticated).length,
      list: participantsList
    };

    // Votos de enquetes
    const pollsSummary = [];
    if (slidesData && slidesData.slides) {
      slidesData.slides.forEach(s => {
        if (s.interaction && s.interaction.poll) {
          const poll = s.interaction.poll;
          const votesRaw = localStorage.getItem(`session_votes_${normId}_${poll.id}`);
          let votesList = [];
          if (votesRaw) {
            try {
              const parsed = JSON.parse(votesRaw);
              if (Array.isArray(parsed)) {
                votesList = parsed;
              } else if (typeof parsed === 'object') {
                votesList = Object.entries(parsed).map(([uid, val]) => {
                  return typeof val === 'object' ? { uid, optionId: val.optionId } : { uid, optionId: val };
                });
              }
            } catch (e) {}
          }

          const totalVotes = votesList.length;
          const optionsStats = (poll.options || []).map(opt => {
            const count = votesList.filter(v => (v.optionId === opt.id || v === opt.id)).length;
            const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
            return { id: opt.id, text: opt.text, votes: count, percentage: pct };
          });

          pollsSummary.push({
            slideId: s.id,
            slideTitle: s.title,
            pollId: poll.id,
            question: poll.question,
            totalVotes: totalVotes,
            options: optionsStats
          });
        }
      });
    }

    return {
      sessionId: normId,
      exportedAt: new Date().toISOString(),
      summary: {
        totalParticipants: presenceStats.total,
        totalQuestionsReceived: questions.length,
        totalPolls: pollsSummary.length
      },
      presence: presenceStats,
      polls: pollsSummary,
      questions: questions
    };
  }

  /**
   * Exporta os resultados da sessão em formato CSV tabular para Excel
   */
  exportSessionCSV(sessionId, slidesData = null) {
    const report = this.compileSessionReport(sessionId, slidesData);
    let csv = '\uFEFF'; // BOM para compatibilidade com acentos no Excel

    // Seção 1: Presença / Participantes
    csv += '--- AUDIÊNCIA E PARTICIPANTES ---\n';
    csv += 'UID;Nome / Apelido;Autenticado;Tipo\n';
    report.presence.list.forEach(p => {
      csv += `"${p.uid || '---'}";"${(p.alias || 'Participante').replace(/"/g, '""')}";"${p.isAuthenticated ? 'SIM' : 'NÃO'}";"${p.isAuthenticated ? 'Conta' : 'Anônimo'}"\n`;
    });

    // Seção 2: Enquetes
    csv += '\n--- ENQUETES E VOTAÇÕES ---\n';
    csv += 'Slide;Enquete;Opção ID;Opção Texto;Votos Computados;Percentual (%)\n';
    report.polls.forEach(p => {
      p.options.forEach(opt => {
        csv += `"${p.slideId} - ${p.slideTitle.replace(/"/g, '""')}";"${p.question.replace(/"/g, '""')}";"${opt.id}";"${opt.text.replace(/"/g, '""')}";${opt.votes};${opt.percentage}%\n`;
      });
    });

    // Seção 3: Perguntas
    csv += '\n--- PERGUNTAS RECEBIDAS DA AUDIÊNCIA ---\n';
    csv += 'ID;Horário;Autor;Status;Respondida;Pergunta\n';
    report.questions.forEach(q => {
      const time = new Date(q.timestamp).toLocaleString();
      csv += `"${q.id}";"${time}";"${q.authorAlias || 'Participante'}";"${q.status}";"${q.answered ? 'SIM' : 'NÃO'}";"${q.text.replace(/"/g, '""')}"\n`;
    });

    return csv;
  }

  /**
   * Exporta um relatório executivo em formato Markdown
   */
  exportSessionMarkdown(sessionId, slidesData = null) {
    const report = this.compileSessionReport(sessionId, slidesData);
    let md = `# Relatório Executivo da Apresentação - Sessão #${report.sessionId}\n\n`;
    md += `* **Data de Exportação:** ${new Date(report.exportedAt).toLocaleString()}\n`;
    md += `* **Participantes Registrados:** ${report.summary.totalParticipants} (${report.presence.authenticated} identificados, ${report.presence.anonymous} anônimos)\n`;
    md += `* **Total de Enquetes:** ${report.summary.totalPolls}\n`;
    md += `* **Total de Perguntas Recebidas:** ${report.summary.totalQuestionsReceived}\n\n`;
    md += `---\n\n## 📊 Resultados das Enquetes\n\n`;

    if (report.polls.length === 0) {
      md += `*Nenhuma enquete realizada nesta sessão.*\n\n`;
    } else {
      report.polls.forEach(p => {
        md += `### Slide ${p.slideId}: ${p.question}\n\n`;
        md += `* **Total de Votos:** ${p.totalVotes}\n\n`;
        md += `| Opção | Descrição | Votos | Percentual |\n`;
        md += `| :---: | :--- | :---: | :---: |\n`;
        p.options.forEach(opt => {
          md += `| **${opt.id}** | ${opt.text} | ${opt.votes} | **${opt.percentage}%** |\n`;
        });
        md += `\n`;
      });
    }

    md += `---\n\n## 💬 Perguntas da Audiência\n\n`;
    if (report.questions.length === 0) {
      md += `*Nenhuma pergunta submetida durante a apresentação.*\n\n`;
    } else {
      report.questions.forEach(q => {
        const time = new Date(q.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const badge = q.answered ? '✅ Respondida' : (q.status === 'featured' ? '⭐ Destacada' : (q.status === 'approved' ? '💬 Aprovada' : '⏳ Pendente'));
        md += `* **[${time}] ${q.authorAlias || 'Participante'}** (${badge}):\n  > "${q.text}"\n\n`;
      });
    }

    return md;
  }
}
