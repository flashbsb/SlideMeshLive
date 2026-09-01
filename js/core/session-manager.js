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
    this.currentSlideIndex = 0;
    this.slideStartTime = Date.now();
    this.slideDwellTimes = {};
  }

  /**
   * Inicia o temporizador do slide ativo
   */
  startSlideTimer(slideIndex = 0) {
    this.currentSlideIndex = slideIndex;
    this.slideStartTime = Date.now();
    if (!this.slideDwellTimes[slideIndex]) {
      this.slideDwellTimes[slideIndex] = 0;
    }
  }

  /**
   * Registra a transição de slide acumulando o tempo gasto no slide anterior
   */
  trackSlideDwellTime(nextSlideIndex) {
    const now = Date.now();
    const elapsedSec = (now - this.slideStartTime) / 1000;
    if (!this.slideDwellTimes[this.currentSlideIndex]) {
      this.slideDwellTimes[this.currentSlideIndex] = 0;
    }
    this.slideDwellTimes[this.currentSlideIndex] += elapsedSec;
    this.currentSlideIndex = nextSlideIndex;
    this.slideStartTime = now;
  }

  /**
   * Retorna os tempos acumulados por slide em segundos
   */
  getSlideDwellTimes() {
    const now = Date.now();
    const elapsedSec = (now - this.slideStartTime) / 1000;
    const copy = { ...this.slideDwellTimes };
    copy[this.currentSlideIndex] = (copy[this.currentSlideIndex] || 0) + elapsedSec;
    return copy;
  }

  /**
   * Reinicia os temporizadores de slide
   */
  resetSlideTimers(initialSlideIndex = 0) {
    this.currentSlideIndex = initialSlideIndex;
    this.slideStartTime = Date.now();
    this.slideDwellTimes = { [initialSlideIndex]: 0 };
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

    const sanitizeCell = (text) => (text !== null && text !== undefined ? String(text).replace(/\r?\n/g, ' ').replace(/"/g, '""') : '');

    // Seção 1: Presença / Participantes
    csv += '--- AUDIÊNCIA E PARTICIPANTES ---\n';
    csv += 'UID;Nome / Apelido;Autenticado;Tipo\n';
    report.presence.list.forEach(p => {
      const alias = sanitizeCell(p.alias || 'Participante');
      csv += `"${sanitizeCell(p.uid || '---')}";"${alias}";"${p.isAuthenticated ? 'SIM' : 'NÃO'}";"${p.isAuthenticated ? 'Conta' : 'Anônimo'}"\n`;
    });

    // Seção 2: Enquetes
    csv += '\n--- ENQUETES E VOTAÇÕES ---\n';
    csv += 'Slide;Enquete;Opção ID;Opção Texto;Votos Computados;Percentual (%)\n';
    report.polls.forEach(p => {
      p.options.forEach(opt => {
        csv += `"${p.slideId} - ${sanitizeCell(p.slideTitle)}";"${sanitizeCell(p.question)}";"${sanitizeCell(opt.id)}";"${sanitizeCell(opt.text)}";${opt.votes};${opt.percentage}%\n`;
      });
    });

    // Seção 3: Perguntas
    csv += '\n--- PERGUNTAS RECEBIDAS DA AUDIÊNCIA ---\n';
    csv += 'ID;Horário;Autor;Status;Respondida;Pergunta\n';
    report.questions.forEach(q => {
      const time = new Date(q.timestamp).toLocaleString();
      const author = sanitizeCell(q.authorAlias || q.authorName || q.displayName || 'Participante');
      const text = sanitizeCell(q.text);
      csv += `"${sanitizeCell(q.id)}";"${time}";"${author}";"${sanitizeCell(q.status)}";"${q.answered ? 'SIM' : 'NÃO'}";"${text}"\n`;
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
        const author = q.authorAlias || q.authorName || q.displayName || 'Participante';
        md += `* **[${time}] ${author}** (${badge}):\n  > "${q.text}"\n\n`;
      });
    }

    return md;
  }

  /**
   * Gera um documento HTML autônomo, offline e imprimível (PDF-ready) com todo o slide deck,
   * notas do orador, enquetes consolidadas e perguntas moderadas/respondidas da audiência (Fase 4).
   */
  exportFullDeckHTML(sessionId, manifest = null, slidesData = null) {
    const report = this.compileSessionReport(sessionId, slidesData);
    const presTitle = (manifest && manifest.title) || (slidesData && slidesData.manifest && slidesData.manifest.title) || 'Apresentação SlideMeshLive';
    const presSubtitle = (manifest && manifest.subtitle) || 'Deck Consolidado Pós-Evento';
    const sessionCode = (sessionId || 'SDWAN2026').trim().toUpperCase();
    const exportDate = new Date().toLocaleString();
    const slides = (slidesData && slidesData.slides) || [];

    const escapeHTML = (str) => {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    };

    // Renderiza cada slide
    let slidesHTML = '';
    slides.forEach((s, idx) => {
      const slideNum = idx + 1;
      const tag = s.tag || `SLIDE ${slideNum}`;
      const title = s.title || `Slide ${slideNum}`;
      const presenter = s.presenter || {};
      const audience = s.audience || {};
      const headline = presenter.headline || title;
      const bullets = Array.isArray(presenter.bullets) ? presenter.bullets : [];
      const notes = presenter.notes || '';
      const summary = audience.summary || '';
      const sections = Array.isArray(audience.sections) ? audience.sections : [];

      // Enquete associada a este slide se houver
      const poll = (s.interaction && s.interaction.poll) ? s.interaction.poll : null;
      let pollHTML = '';
      if (poll) {
        const pollSummary = report.polls.find(p => p.slideId === s.id || p.pollId === poll.id);
        const totalVotes = pollSummary ? pollSummary.totalVotes : 0;
        const optionsStats = pollSummary ? pollSummary.options : (poll.options || []).map(opt => ({ id: opt.id, text: opt.text, votes: 0, percentage: 0 }));

        let optionsHTML = '';
        optionsStats.forEach(opt => {
          optionsHTML += `
            <div class="poll-option-row">
              <div class="poll-option-label">
                <span class="poll-opt-badge">${escapeHTML(opt.id)}</span>
                <span class="poll-opt-text">${escapeHTML(opt.text)}</span>
              </div>
              <div class="poll-bar-wrapper">
                <div class="poll-bar-fill" style="width: ${opt.percentage}%;"></div>
                <span class="poll-bar-text">${opt.votes} votos (${opt.percentage}%)</span>
              </div>
            </div>
          `;
        });

        pollHTML = `
          <div class="deck-poll-card">
            <div class="poll-badge-title">📊 Enquete Interativa</div>
            <h4 class="poll-question-text">${escapeHTML(poll.question)}</h4>
            <div class="poll-total-votes">Total de Votos Computados: <strong>${totalVotes}</strong></div>
            <div class="poll-options-grid">${optionsHTML}</div>
          </div>
        `;
      }

      let bulletsHTML = '';
      if (bullets.length > 0) {
        bulletsHTML = `
          <ul class="deck-bullet-list">
            ${bullets.map(b => `<li>${escapeHTML(b)}</li>`).join('')}
          </ul>
        `;
      }

      let notesHTML = '';
      if (notes) {
        notesHTML = `
          <div class="deck-notes-box">
            <div class="deck-box-label">📝 Notas do Apresentador:</div>
            <div class="deck-box-content">${escapeHTML(notes)}</div>
          </div>
        `;
      }

      let audienceHTML = '';
      if (summary || sections.length > 0) {
        let secHTML = '';
        sections.forEach(sec => {
          secHTML += `
            <div class="audience-sec-item">
              <strong>${escapeHTML(sec.title || '')}:</strong>
              <span>${escapeHTML(sec.content || '')}</span>
            </div>
          `;
        });
        audienceHTML = `
          <div class="deck-audience-box">
            <div class="deck-box-label">📱 Material de Apoio da Audiência:</div>
            ${summary ? `<p class="audience-summary-text">${escapeHTML(summary)}</p>` : ''}
            ${secHTML}
          </div>
        `;
      }

      slidesHTML += `
        <article class="deck-slide" id="slide-${slideNum}">
          <div class="deck-slide-header">
            <span class="deck-slide-tag">${escapeHTML(tag)}</span>
            <span class="deck-slide-num">#${slideNum} / ${slides.length}</span>
          </div>
          <h2 class="deck-slide-title">${escapeHTML(title)}</h2>
          ${headline && headline !== title ? `<h3 class="deck-slide-headline">${escapeHTML(headline)}</h3>` : ''}
          ${bulletsHTML}
          ${pollHTML}
          ${notesHTML}
          ${audienceHTML}
        </article>
      `;
    });

    // Seção de Perguntas da Plateia
    let qaHTML = '';
    const publicQuestions = (report.questions || []).filter(q => q.status === 'approved' || q.status === 'featured' || q.answered);
    if (publicQuestions.length > 0) {
      let qRows = '';
      publicQuestions.forEach(q => {
        const time = new Date(q.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const author = escapeHTML(q.authorAlias || q.authorName || 'Participante');
        const badge = q.answered ? '<span class="badge-answered">✓ Respondida</span>' : (q.status === 'featured' ? '<span class="badge-featured">⭐ Destaque</span>' : '<span class="badge-approved">💬 Aprovada</span>');
        const upvotes = q.upvotes || (Array.isArray(q.upvotedBy) ? q.upvotedBy.length : 0);
        qRows += `
          <div class="qa-item-card">
            <div class="qa-item-header">
              <span class="qa-author">${author}</span>
              <span class="qa-time">${time}</span>
              ${badge}
              ${upvotes > 0 ? `<span class="qa-upvotes">👍 ${upvotes} votos</span>` : ''}
            </div>
            <div class="qa-text">"${escapeHTML(q.text)}"</div>
          </div>
        `;
      });
      qaHTML = `
        <section class="deck-qa-section">
          <div class="deck-section-title">💬 Perguntas Respondidas e Aprovadas da Audiência</div>
          <div class="qa-grid">${qRows}</div>
        </section>
      `;
    }

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHTML(presTitle)} — Deck Consolidado SlideMeshLive</title>
  <style>
    :root {
      --bg-page: #0b0f19;
      --bg-card: #151e2e;
      --bg-accent: rgba(56, 189, 248, 0.1);
      --text-primary: #f8fafc;
      --text-secondary: #94a3b8;
      --text-muted: #64748b;
      --accent: #38bdf8;
      --border: rgba(255, 255, 255, 0.1);
      --border-subtle: rgba(255, 255, 255, 0.06);
      --font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--font);
      background-color: var(--bg-page);
      color: var(--text-primary);
      line-height: 1.6;
      padding: 30px 20px;
    }

    .container {
      max-width: 960px;
      margin: 0 auto;
    }

    /* Barra Superior de Ações */
    .action-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 14px 20px;
      margin-bottom: 24px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    }
    .action-brand {
      font-size: 14px;
      font-weight: 700;
      color: var(--accent);
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .btn-print {
      background: var(--accent);
      color: #0b0f19;
      border: none;
      padding: 8px 18px;
      font-size: 13px;
      font-weight: 700;
      border-radius: 6px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: opacity 0.2s;
    }
    .btn-print:hover { opacity: 0.9; }

    /* Cabeçalho do Deck */
    .deck-header {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 28px;
      margin-bottom: 24px;
      border-left: 6px solid var(--accent);
    }
    .deck-title { font-size: 26px; font-weight: 800; color: #ffffff; margin-bottom: 6px; }
    .deck-subtitle { font-size: 15px; color: var(--text-secondary); margin-bottom: 16px; }
    .deck-meta-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 12px;
      padding-top: 14px;
      border-top: 1px solid var(--border-subtle);
      font-size: 12.5px;
    }
    .deck-meta-item strong { color: var(--text-primary); }
    .deck-meta-item span { color: var(--text-muted); display: block; }

    /* Slide Card */
    .deck-slide {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 26px;
      margin-bottom: 24px;
      page-break-after: always;
      break-after: page;
    }
    .deck-slide-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }
    .deck-slide-tag {
      background: var(--bg-accent);
      color: var(--accent);
      font-size: 11px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .deck-slide-num { font-size: 12px; font-weight: 600; color: var(--text-muted); }
    .deck-slide-title { font-size: 20px; font-weight: 700; color: #ffffff; margin-bottom: 8px; }
    .deck-slide-headline { font-size: 15px; font-weight: 600; color: var(--accent); margin-bottom: 14px; }
    
    .deck-bullet-list {
      list-style-type: none;
      margin-bottom: 16px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .deck-bullet-list li {
      position: relative;
      padding-left: 20px;
      font-size: 14px;
      color: #e2e8f0;
    }
    .deck-bullet-list li::before {
      content: "•";
      position: absolute;
      left: 6px;
      color: var(--accent);
      font-size: 18px;
      line-height: 1;
    }

    /* Enquete Card */
    .deck-poll-card {
      background: rgba(15, 23, 42, 0.6);
      border: 1px solid var(--border-subtle);
      border-radius: 8px;
      padding: 16px;
      margin: 16px 0;
    }
    .poll-badge-title { font-size: 11px; font-weight: 700; color: var(--accent); text-transform: uppercase; margin-bottom: 4px; }
    .poll-question-text { font-size: 15px; font-weight: 700; color: #ffffff; margin-bottom: 8px; }
    .poll-total-votes { font-size: 12px; color: var(--text-muted); margin-bottom: 12px; }
    .poll-options-grid { display: flex; flex-direction: column; gap: 8px; }
    .poll-option-row { display: flex; flex-direction: column; gap: 4px; }
    .poll-option-label { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #e2e8f0; }
    .poll-opt-badge { background: var(--border); padding: 1px 6px; border-radius: 4px; font-weight: 700; font-size: 11px; }
    .poll-bar-wrapper {
      position: relative;
      height: 24px;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 4px;
      overflow: hidden;
      display: flex;
      align-items: center;
      padding: 0 8px;
    }
    .poll-bar-fill {
      position: absolute;
      top: 0; left: 0; bottom: 0;
      background: linear-gradient(90deg, #0284c7, #38bdf8);
      opacity: 0.35;
      border-radius: 4px;
    }
    .poll-bar-text { position: relative; font-size: 11.5px; font-weight: 600; color: #ffffff; z-index: 1; }

    /* Caixas de Apoio */
    .deck-notes-box, .deck-audience-box {
      background: rgba(15, 23, 42, 0.4);
      border: 1px dashed var(--border-subtle);
      border-radius: 6px;
      padding: 12px;
      margin-top: 14px;
      font-size: 12.5px;
    }
    .deck-box-label { font-size: 11px; font-weight: 700; color: var(--text-secondary); margin-bottom: 4px; }
    .deck-box-content { color: var(--text-muted); font-style: italic; }
    .audience-summary-text { color: #cbd5e1; margin-bottom: 6px; }
    .audience-sec-item { color: var(--text-secondary); font-size: 12px; margin-top: 4px; }

    /* Q&A Section */
    .deck-qa-section {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 26px;
      margin-top: 24px;
      page-break-before: always;
      break-before: page;
    }
    .deck-section-title { font-size: 18px; font-weight: 700; color: #ffffff; margin-bottom: 16px; border-bottom: 1px solid var(--border-subtle); padding-bottom: 8px; }
    .qa-grid { display: flex; flex-direction: column; gap: 12px; }
    .qa-item-card { background: rgba(15, 23, 42, 0.5); border: 1px solid var(--border-subtle); border-radius: 8px; padding: 12px 14px; }
    .qa-item-header { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; font-size: 12px; }
    .qa-author { font-weight: 700; color: #ffffff; }
    .qa-time { color: var(--text-muted); }
    .badge-answered { background: rgba(16, 185, 129, 0.15); color: #34d399; font-size: 10.5px; padding: 2px 6px; border-radius: 4px; font-weight: 600; }
    .badge-featured { background: rgba(234, 179, 8, 0.15); color: #facc15; font-size: 10.5px; padding: 2px 6px; border-radius: 4px; font-weight: 600; }
    .badge-approved { background: rgba(56, 189, 248, 0.15); color: #38bdf8; font-size: 10.5px; padding: 2px 6px; border-radius: 4px; font-weight: 600; }
    .qa-upvotes { margin-left: auto; color: #facc15; font-size: 11px; font-weight: 700; }
    .qa-text { font-size: 13.5px; color: #e2e8f0; font-style: italic; }

    /* @media print — Regras de Impressão e PDF */
    @media print {
      body {
        background-color: #ffffff !important;
        color: #0f172a !important;
        padding: 0 !important;
      }
      .action-bar { display: none !important; }
      .deck-header, .deck-slide, .deck-qa-section {
        background-color: #ffffff !important;
        color: #0f172a !important;
        border: 1px solid #cbd5e1 !important;
        box-shadow: none !important;
        page-break-inside: avoid;
        margin-bottom: 20px !important;
      }
      .deck-slide { page-break-after: always !important; break-after: page !important; }
      .deck-title, .deck-slide-title, .poll-question-text, .deck-section-title, .qa-author { color: #0f172a !important; }
      .deck-slide-headline { color: #0284c7 !important; }
      .deck-bullet-list li, .qa-text, .audience-summary-text { color: #1e293b !important; }
      .deck-bullet-list li::before { color: #0284c7 !important; }
      .deck-slide-tag { background: #e0f2fe !important; color: #0369a1 !important; border: 1px solid #bae6fd !important; }
      .deck-poll-card, .qa-item-card { background: #f8fafc !important; border: 1px solid #e2e8f0 !important; }
      .poll-bar-wrapper { background: #e2e8f0 !important; }
      .poll-bar-fill { background: #38bdf8 !important; opacity: 0.7 !important; }
      .poll-bar-text { color: #0f172a !important; font-weight: 700 !important; }
      .deck-notes-box, .deck-audience-box { background: #f8fafc !important; border: 1px dashed #cbd5e1 !important; }
      .deck-box-content, .audience-sec-item, .deck-meta-item span { color: #475569 !important; }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Barra de Ações (Oculta na Impressão) -->
    <header class="action-bar">
      <div class="action-brand">
        <span>🌐</span> SlideMeshLive • Deck Consolidado
      </div>
      <button class="btn-print" onclick="window.print()">
        🖨️ Imprimir / Salvar em PDF
      </button>
    </header>

    <!-- Cabeçalho Executivo -->
    <section class="deck-header">
      <h1 class="deck-title">${escapeHTML(presTitle)}</h1>
      <p class="deck-subtitle">${escapeHTML(presSubtitle)}</p>
      <div class="deck-meta-grid">
        <div class="deck-meta-item">
          <span>Código da Sessão:</span>
          <strong>#${sessionCode}</strong>
        </div>
        <div class="deck-meta-item">
          <span>Total de Slides:</span>
          <strong>${slides.length} slides</strong>
        </div>
        <div class="deck-meta-item">
          <span>Participantes Registrados:</span>
          <strong>${report.summary.totalParticipants} pessoas</strong>
        </div>
        <div class="deck-meta-item">
          <span>Data de Emissão:</span>
          <strong>${escapeHTML(exportDate)}</strong>
        </div>
      </div>
    </section>

    <!-- Slides do Deck -->
    <main class="deck-slides-container">
      ${slidesHTML}
    </main>

    <!-- Perguntas da Audiência -->
    ${qaHTML}
  </div>
</body>
</html>`;
  }

  downloadFullDeckHTML(sessionId, manifest = null, slidesData = null) {
    const html = this.exportFullDeckHTML(sessionId, manifest, slidesData);
    const normSessionId = (sessionId || 'SDWAN2026').trim().toUpperCase();
    const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `deck_completo_${normSessionId}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Constrói o payload analítico consolidado da sessão
   */
  buildSessionAnalyticsPayload(sessionId, sessionData = {}, manifest = null, slidesData = null) {
    const normSessionId = (sessionId || 'SDWAN2026').trim().toUpperCase();
    const state = sessionData.state || {};
    const questions = sessionData.questions || [];
    const votes = sessionData.votes || {};
    const presence = sessionData.presence || {};
    const dwellTimes = this.getSlideDwellTimes();

    const presSlug = (manifest && manifest.id) || state.presentationId || 'slidemesh-showcase';
    const presTitle = (manifest && manifest.title) || 'Apresentação';

    // Total de participantes
    const totalParticipants = Object.keys(presence).length || sessionData.presenceCount || 0;
    
    // Contagem de votos
    let totalVotesCast = 0;
    const pollBreakdown = [];
    for (const [pollId, vList] of Object.entries(votes)) {
      const vCount = Array.isArray(vList) ? vList.length : 0;
      totalVotesCast += vCount;
      pollBreakdown.push({
        pollId,
        totalVotes: vCount,
        votes: vList
      });
    }

    // Contagem de perguntas e upvotes
    const totalQuestions = questions.length;
    const approvedQuestions = questions.filter(q => q.status === 'approved' || q.status === 'featured' || q.status === 'answered');
    const totalUpvotes = questions.reduce((acc, q) => acc + (q.upvotes || 0), 0);

    // Mapeamento de slides
    const slideMetrics = [];
    const slides = Array.isArray(slidesData) ? slidesData : [];
    slides.forEach((s, idx) => {
      slideMetrics.push({
        slideIndex: idx,
        slideId: s.id || (idx + 1),
        title: s.title || `Slide ${idx + 1}`,
        type: s.type || 'standard',
        dwellTimeSeconds: Math.round(dwellTimes[idx] || 0)
      });
    });

    const startTime = sessionData.startTime || (Date.now() - 3600000);
    const endTime = Date.now();
    const durationSeconds = Math.max(1, Math.round((endTime - startTime) / 1000));

    return {
      sessionId: normSessionId,
      presentationSlug: presSlug,
      presentationTitle: presTitle,
      startTime,
      endTime,
      durationSeconds,
      summary: {
        totalParticipants,
        totalVotesCast,
        totalQuestionsSent: totalQuestions,
        totalQuestionsApproved: approvedQuestions.length,
        totalUpvotes
      },
      slideMetrics,
      pollBreakdown,
      topQuestions: approvedQuestions.sort((a, b) => (b.upvotes || 0) - (a.upvotes || 0)).slice(0, 20)
    };
  }

  /**
   * Envia o payload de analytics para o endpoint /api/analytics/archive no servidor
   */
  async archiveSessionRemotely(analyticsPayload) {
    try {
      const res = await fetch('/api/analytics/archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(analyticsPayload)
      });
      if (res.ok) {
        return await res.json();
      }
      return { success: false, status: res.status };
    } catch (e) {
      console.warn('Erro ao arquivar sessão remotamente:', e);
      return { success: false, error: e.message };
    }
  }

  /**
   * Busca a lista de sessões arquivadas no servidor
   */
  async fetchRemoteAnalyticsHistory() {
    try {
      const res = await fetch('/api/analytics/history');
      if (res.ok) {
        const data = await res.json();
        return data.sessions || [];
      }
      return [];
    } catch (e) {
      console.warn('Erro ao buscar histórico remoto de analytics:', e);
      return [];
    }
  }

  /**
   * Busca os detalhes de uma sessão analítica específica no servidor
   */
  async fetchRemoteSessionAnalytics(sessionId) {
    try {
      const normId = encodeURIComponent((sessionId || '').trim().toUpperCase());
      const res = await fetch(`/api/analytics/session?id=${normId}`);
      if (res.ok) {
        const data = await res.json();
        return data.session || null;
      }
      return null;
    } catch (e) {
      console.warn('Erro ao buscar detalhes da sessão analítica:', e);
      return null;
    }
  }

  /**
   * Exporta Relatório Executivo Autônomo em HTML com Gráficos Inline (SVG) e Print-Ready
   */
  exportExecutiveHTMLReport(analyticsData = {}) {
    const sid = analyticsData.sessionId || 'SESSION';
    const presTitle = analyticsData.presentationTitle || 'Apresentação SlideMeshLive';
    const summary = analyticsData.summary || {};
    const slideMetrics = analyticsData.slideMetrics || [];
    const pollBreakdown = analyticsData.pollBreakdown || [];
    const topQuestions = analyticsData.topQuestions || [];

    const durationSec = analyticsData.durationSeconds || 0;
    const durationFormatted = `${Math.floor(durationSec / 60)}m ${durationSec % 60}s`;
    const dateFormatted = analyticsData.startTime ? new Date(analyticsData.startTime).toLocaleString() : new Date().toLocaleString();

    // Gera SVG do gráfico de Dwell Time
    const maxSec = Math.max(10, ...slideMetrics.map(s => s.dwellTimeSeconds || 0));
    const svgWidth = 760;
    const svgHeight = 220;
    const padding = { top: 25, right: 20, bottom: 40, left: 50 };
    const chartW = svgWidth - padding.left - padding.right;
    const chartH = svgHeight - padding.top - padding.bottom;
    const barCount = slideMetrics.length || 1;
    const barW = Math.max(12, Math.min(48, (chartW / barCount) - 12));
    const step = chartW / barCount;

    let svgGrid = '';
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (chartH * i / 4);
      const val = Math.round(maxSec * (4 - i) / 4);
      svgGrid += `
        <line x1="${padding.left}" y1="${y}" x2="${svgWidth - padding.right}" y2="${y}" stroke="rgba(255,255,255,0.08)" stroke-width="1" />
        <text x="${padding.left - 8}" y="${y + 4}" fill="#94a3b8" font-size="10" font-family="monospace" text-anchor="end">${val}s</text>
      `;
    }

    let svgBars = '';
    slideMetrics.forEach((m, idx) => {
      const x = padding.left + (idx * step) + (step - barW) / 2;
      const barH = (m.dwellTimeSeconds / maxSec) * chartH;
      const y = padding.top + chartH - barH;
      svgBars += `
        <rect x="${x}" y="${y}" width="${barW}" height="${barH}" rx="4" fill="url(#barGradient)" />
        ${barH > 14 ? `<text x="${x + barW / 2}" y="${y - 5}" fill="#ffffff" font-size="10" font-family="monospace" text-anchor="middle">${m.dwellTimeSeconds}s</text>` : ''}
        <text x="${x + barW / 2}" y="${svgHeight - 12}" fill="#94a3b8" font-size="10" font-family="sans-serif" text-anchor="middle">S${idx + 1}</text>
      `;
    });

    const svgChartHTML = `
      <svg viewBox="0 0 ${svgWidth} ${svgHeight}" style="width: 100%; height: auto; display: block;">
        <defs>
          <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#38bdf8" />
            <stop offset="100%" stop-color="#818cf8" />
          </linearGradient>
        </defs>
        ${svgGrid}
        ${svgBars}
      </svg>
    `;

    // Tabela de Slides
    const slidesTableRows = slideMetrics.map((s, idx) => `
      <tr>
        <td style="font-weight: 700; font-family: monospace;">#${idx + 1}</td>
        <td>${s.title || `Slide ${idx + 1}`}</td>
        <td style="font-family: monospace; text-align: right; font-weight: 700; color: #38bdf8;">${s.dwellTimeSeconds || 0}s</td>
      </tr>
    `).join('');

    // Tabela de Enquetes
    let pollsHTML = '';
    if (pollBreakdown.length > 0) {
      pollsHTML = pollBreakdown.map(p => {
        const totalV = p.totalVotes || 0;
        const optionsHTML = Array.isArray(p.options) ? p.options.map(o => `
          <div style="margin-bottom: 8px;">
            <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 3px;">
              <span>${o.id}. ${o.text || ''}</span>
              <strong style="color: #38bdf8;">${o.percentage || 0}% (${o.votes || 0})</strong>
            </div>
            <div style="background: rgba(255,255,255,0.08); height: 8px; border-radius: 4px; overflow: hidden;">
              <div style="background: #38bdf8; height: 100%; width: ${o.percentage || 0}%;"></div>
            </div>
          </div>
        `).join('') : `<div>Total de votos: ${totalV}</div>`;

        return `
          <div style="background: rgba(15,23,42,0.7); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 14px; margin-bottom: 12px;">
            <div style="font-size: 13px; font-weight: 700; color: #ffffff; margin-bottom: 8px;">
              📊 Enquete: #${p.pollId} (${totalV} votos computados)
            </div>
            ${optionsHTML}
          </div>
        `;
      }).join('');
    } else {
      pollsHTML = `<p style="color: #94a3b8; font-size: 12px;">Nenhuma enquete registrada nesta sessão.</p>`;
    }

    // Tabela de Perguntas
    let questionsHTML = '';
    if (topQuestions.length > 0) {
      questionsHTML = topQuestions.map((q, idx) => `
        <div style="background: rgba(15,23,42,0.7); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 10px 14px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; gap: 12px;">
          <div style="flex: 1;">
            <span style="font-weight: 700; color: #f472b6; margin-right: 6px;">#${idx + 1}</span>
            <span style="font-size: 13px; color: #ffffff;">${q.text}</span>
            ${q.authorAlias ? `<span style="font-size: 11px; color: #94a3b8; margin-left: 8px;">(${q.authorAlias})</span>` : ''}
          </div>
          <span style="background: rgba(56,189,248,0.15); color: #38bdf8; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 700;">
            👍 ${q.upvotes || 0}
          </span>
        </div>
      `).join('');
    } else {
      questionsHTML = `<p style="color: #94a3b8; font-size: 12px;">Nenhuma pergunta aprovada nesta sessão.</p>`;
    }

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Relatório Executivo de Analytics | ${presTitle} (#${sid})</title>
  <style>
    :root {
      --bg-main: #0b0f19;
      --bg-card: rgba(15, 23, 42, 0.85);
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
      --accent: #38bdf8;
      --border: rgba(255, 255, 255, 0.1);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--bg-main);
      color: var(--text-main);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      padding: 32px 20px;
      line-height: 1.5;
    }
    .report-container {
      max-width: 900px;
      margin: 0 auto;
    }
    .header-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 14px;
      margin-bottom: 24px;
    }
    .kpi-box {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 16px;
    }
    .kpi-label { font-size: 11.5px; color: var(--text-muted); font-weight: 600; text-transform: uppercase; margin-bottom: 4px; }
    .kpi-value { font-size: 24px; font-weight: 800; font-family: monospace; color: var(--accent); }
    .section-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 24px;
    }
    .section-title { font-size: 15px; font-weight: 700; margin-bottom: 14px; color: #ffffff; display: flex; align-items: center; gap: 8px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 10px; }
    th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid var(--border); }
    th { color: var(--text-muted); font-weight: 600; font-size: 11px; text-transform: uppercase; }
    .btn-print {
      background: #38bdf8;
      color: #0b0f19;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      font-weight: 700;
      font-size: 13px;
      cursor: pointer;
    }
    @media print {
      body { background: #ffffff !important; color: #0f172a !important; padding: 0 !important; }
      .btn-print { display: none !important; }
      .header-card, .kpi-box, .section-card { background: #ffffff !important; border: 1px solid #e2e8f0 !important; color: #0f172a !important; box-shadow: none !important; }
      .section-title, h1, h2, h3, .kpi-value { color: #0f172a !important; }
      text { fill: #0f172a !important; }
      line { stroke: #e2e8f0 !important; }
      th, td { border-bottom: 1px solid #e2e8f0 !important; color: #0f172a !important; }
    }
  </style>
</head>
<body>
  <div class="report-container">
    <div class="header-card">
      <div>
        <div style="font-size: 11px; font-weight: 700; color: #38bdf8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;">
          📊 Relatório Executivo de Sessão
        </div>
        <h1 style="font-size: 22px; font-weight: 800; color: #ffffff; margin-bottom: 6px;">${presTitle}</h1>
        <div style="font-size: 12px; color: var(--text-muted);">
          Sessão: <strong style="color: #ffffff;">#${sid}</strong> • Data: ${dateFormatted}
        </div>
      </div>
      <button class="btn-print" onclick="window.print()">🖨️ Imprimir / Salvar PDF</button>
    </div>

    <!-- KPIs -->
    <div class="kpi-grid">
      <div class="kpi-box">
        <div class="kpi-label">👥 Participantes Únicos</div>
        <div class="kpi-value">${summary.totalParticipants || 0}</div>
      </div>
      <div class="kpi-box">
        <div class="kpi-label">⏱️ Duração da Apresentação</div>
        <div class="kpi-value" style="color: #a78bfa;">${durationFormatted}</div>
      </div>
      <div class="kpi-box">
        <div class="kpi-label">🗳️ Total de Votos</div>
        <div class="kpi-value" style="color: #34d399;">${summary.totalVotesCast || 0}</div>
      </div>
      <div class="kpi-box">
        <div class="kpi-label">💬 Dúvidas Aprovadas</div>
        <div class="kpi-value" style="color: #f472b6;">${summary.totalQuestionsApproved || 0}</div>
      </div>
    </div>

    <!-- Tempo por Slide (Gráfico SVG) -->
    <div class="section-card">
      <div class="section-title">⏱️ Retenção e Tempo de Permanência por Slide (Dwell Time)</div>
      <div style="background: rgba(10, 15, 29, 0.9); border-radius: 8px; padding: 12px; margin-bottom: 16px; border: 1px solid var(--border);">
        ${svgChartHTML}
      </div>
      <table>
        <thead>
          <tr>
            <th style="width: 70px;">Slide</th>
            <th>Título do Slide</th>
            <th style="text-align: right; width: 120px;">Tempo Gasto</th>
          </tr>
        </thead>
        <tbody>
          ${slidesTableRows}
        </tbody>
      </table>
    </div>

    <!-- Votações & Enquetes -->
    <div class="section-card">
      <div class="section-title">📊 Resultados Consolidados de Enquetes</div>
      ${pollsHTML}
    </div>

    <!-- Top Perguntas da Plateia -->
    <div class="section-card">
      <div class="section-title">👍 Top Dúvidas da Audiência (Ranking por Upvotes)</div>
      ${questionsHTML}
    </div>

    <!-- Rodapé -->
    <div style="text-align: center; font-size: 11px; color: var(--text-muted); margin-top: 30px; border-top: 1px solid var(--border); padding-top: 16px;">
      Gerado automaticamente pelo <strong>SlideMeshLive v1.3.0</strong> • Autônomo, Offline-First e Zero-PII.
    </div>
  </div>
</body>
</html>`;
  }

  downloadExecutiveHTMLReport(analyticsData = {}) {
    const html = this.exportExecutiveHTMLReport(analyticsData);
    const sid = (analyticsData.sessionId || 'SESSION').trim().toUpperCase();
    const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio_executivo_${sid}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  exportAnalyticsCSV(analyticsData = {}) {
    const sid = analyticsData.sessionId || 'SESSION';
    const summary = analyticsData.summary || {};
    const slideMetrics = analyticsData.slideMetrics || [];
    const pollBreakdown = analyticsData.pollBreakdown || [];
    const topQuestions = analyticsData.topQuestions || [];

    let csv = `RELATORIO ANALITICO - SLIDEMESHLIVE\n`;
    csv += `Sessao,${sid}\n`;
    csv += `Apresentacao,"${(analyticsData.presentationTitle || '').replace(/"/g, '""')}"\n`;
    csv += `Duracao (segundos),${analyticsData.durationSeconds || 0}\n`;
    csv += `Total Participantes,${summary.totalParticipants || 0}\n`;
    csv += `Total Votos,${summary.totalVotesCast || 0}\n`;
    csv += `Duvidas Aprovadas,${summary.totalQuestionsApproved || 0}\n`;
    csv += `Total Upvotes,${summary.totalUpvotes || 0}\n\n`;

    csv += `SLIDES - TEMPO DE PERMANENCIA (DWELL TIME)\n`;
    csv += `Indice,Slide ID,Titulo,Tempo (segundos)\n`;
    slideMetrics.forEach((s, idx) => {
      csv += `${idx + 1},"${s.slideId || ''}","${(s.title || '').replace(/"/g, '""')}",${s.dwellTimeSeconds || 0}\n`;
    });
    csv += `\n`;

    csv += `ENQUETES - CONSOLIDADO DE VOTOS\n`;
    csv += `Enquete ID,Total Votos,Opcao ID,Opcao Texto,Votos Opcao,Percentual\n`;
    pollBreakdown.forEach(p => {
      if (Array.isArray(p.options) && p.options.length > 0) {
        p.options.forEach(o => {
          csv += `"${p.pollId}",${p.totalVotes || 0},"${o.id}","${(o.text || '').replace(/"/g, '""')}",${o.votes || 0},${o.percentage || 0}%\n`;
        });
      } else {
        csv += `"${p.pollId}",${p.totalVotes || 0},"","","",""\n`;
      }
    });
    csv += `\n`;

    csv += `PERGUNTAS DA AUDIENCIA (RANKING UPVOTES)\n`;
    csv += `Posicao,Autor,Pergunta,Upvotes\n`;
    topQuestions.forEach((q, idx) => {
      csv += `${idx + 1},"${(q.authorAlias || 'Participante').replace(/"/g, '""')}","${(q.text || '').replace(/"/g, '""')}",${q.upvotes || 0}\n`;
    });

    return csv;
  }

  downloadAnalyticsCSV(analyticsData = {}) {
    const csv = this.exportAnalyticsCSV(analyticsData);
    const sid = (analyticsData.sessionId || 'SESSION').trim().toUpperCase();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics_${sid}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
