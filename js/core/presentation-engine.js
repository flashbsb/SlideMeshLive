/**
 * Presentation Engine
 * Plataforma de Apresentação HTML Interativa
 * Gerencia o ciclo de vida, carregamento e renderização de apresentações modulares.
 */

export class PresentationEngine {
  constructor(options = {}) {
    this.basePath = options.basePath || '../presentations';
    this.presentationId = options.presentationId || 'sdwan-cpe-unificado';
    this.manifest = null;
    this.slidesData = null;
    this.currentSlideIndex = 0;
    this.callbacks = {
      onSlideChange: [],
      onPresentationLoaded: []
    };
  }

  /**
   * Obtém o ID da apresentação a partir dos parâmetros de URL ou fallback
   */
  static getPresentationIdFromURL() {
    const params = new URLSearchParams(window.location.search);
    return params.get('presentation') || params.get('pres') || 'sdwan-cpe-unificado';
  }

  /**
   * Obtém a sessão a partir da URL ou sessão ativa no navegador
   */
  static getSessionIdFromURL() {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get('session') || params.get('s');
    if (fromUrl) {
      const clean = fromUrl.trim().toUpperCase();
      try { localStorage.setItem('active_presentation_session', clean); } catch(e){}
      return clean;
    }
    const stored = localStorage.getItem('active_presentation_session');
    return (stored || 'SDWAN2026').trim().toUpperCase();
  }

  /**
   * Carrega os dados da apresentação (manifest.json e slides.json)
   */
  async loadPresentation(presentationId = this.presentationId) {
    this.presentationId = presentationId;
    const presentationUrl = `${this.basePath}/${this.presentationId}`;

    try {
      // Carrega manifesto
      const manifestRes = await fetch(`${presentationUrl}/manifest.json`);
      if (!manifestRes.ok) throw new Error(`Não foi possível carregar o manifesto: ${manifestRes.statusText}`);
      this.manifest = await manifestRes.json();

      // Carrega slides
      const slidesRes = await fetch(`${presentationUrl}/slides.json`);
      if (!slidesRes.ok) throw new Error(`Não foi possível carregar os slides: ${slidesRes.statusText}`);
      this.slidesData = await slidesRes.json();

      this.currentSlideIndex = 0;
      this._emit('onPresentationLoaded', {
        manifest: this.manifest,
        slides: this.slidesData.slides,
        total: this.slidesData.slides.length
      });

      return {
        manifest: this.manifest,
        slidesData: this.slidesData
      };
    } catch (error) {
      console.error('[PresentationEngine] Erro ao carregar apresentação:', error);
      throw error;
    }
  }

  get totalSlides() {
    return this.slidesData ? this.slidesData.slides.length : 0;
  }

  get currentSlide() {
    if (!this.slidesData || !this.slidesData.slides[this.currentSlideIndex]) {
      return null;
    }
    return this.slidesData.slides[this.currentSlideIndex];
  }

  /**
   * Navega para um slide específico
   */
  goToSlide(index) {
    if (!this.slidesData) return;
    const targetIndex = Math.max(0, Math.min(index, this.totalSlides - 1));
    if (targetIndex !== this.currentSlideIndex) {
      const prevIndex = this.currentSlideIndex;
      this.currentSlideIndex = targetIndex;
      this._emit('onSlideChange', {
        currentIndex: this.currentSlideIndex,
        currentSlide: this.currentSlide,
        prevIndex: prevIndex,
        total: this.totalSlides
      });
    }
  }

  nextSlide() {
    if (this.currentSlideIndex < this.totalSlides - 1) {
      this.goToSlide(this.currentSlideIndex + 1);
    }
  }

  prevSlide() {
    if (this.currentSlideIndex > 0) {
      this.goToSlide(this.currentSlideIndex - 1);
    }
  }

  /**
   * Renderiza o slide atual para a visão do Apresentador
   */
  renderPresenterSlide(containerElement, notesElement = null, pollRenderData = null) {
    const slide = this.currentSlide;
    if (!slide || !containerElement) return;

    const bulletsHtml = (slide.presenter.bullets || [])
      .map(b => `
        <li class="slide-bullet-item animate-fade-in">
          <span class="bullet-icon"></span>
          <span>${b}</span>
        </li>
      `).join('');

    let presenterPollHtml = '';
    if (slide.interaction && slide.interaction.poll) {
      const poll = slide.interaction.poll;
      const pollStatus = (pollRenderData && pollRenderData.pollStatus) || 'open';
      const showResults = !!(pollRenderData && pollRenderData.showResults);
      const results = (pollRenderData && pollRenderData.results) || null;
      const totalVotes = results ? results.totalVotes : 0;

      let pollBodyHtml = '';
      if (showResults && results) {
        // Exibe gráficos de barras no telão
        pollBodyHtml = results.options.map(opt => `
          <div style="margin-bottom: 12px;" class="animate-fade-in">
            <div style="display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 4px;">
              <span style="color: #ffffff; font-weight: 600;">${opt.id}. ${opt.text}</span>
              <strong style="color: var(--accent-primary); font-family: var(--font-mono); font-size: 15px;">${opt.percentage}% (${opt.votes})</strong>
            </div>
            <div class="poll-progress-track" style="height: 10px; background: rgba(255,255,255,0.08); border-radius: 5px;">
              <div class="poll-progress-fill" style="width: ${opt.percentage}%; background: linear-gradient(90deg, var(--accent-primary) 0%, #38bdf8 100%); border-radius: 5px;"></div>
            </div>
          </div>
        `).join('');
      } else {
        // Exibe lista de opções legíveis no telão
        pollBodyHtml = `
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px;">
            ${poll.options.map(opt => `
              <div style="background: rgba(15,23,42,0.7); border: 1px solid var(--border-subtle); padding: 12px 16px; border-radius: var(--radius-md); display: flex; align-items: center; gap: 10px;">
                <span class="badge badge-accent" style="font-size: 12px; font-weight: 700; width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; padding: 0;">${opt.id}</span>
                <span style="font-size: 14px; font-weight: 600; color: #e2e8f0;">${opt.text}</span>
              </div>
            `).join('')}
          </div>
        `;
      }

      presenterPollHtml = `
        <div class="presenter-poll-box animate-fade-in" id="presenter-poll-box-${poll.id}" style="margin-top: 24px; background: rgba(15,23,42,0.85); border: 1.5px solid ${showResults ? 'var(--accent-primary)' : 'var(--border-subtle)'}; border-radius: var(--radius-lg); padding: 24px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span class="badge ${pollStatus === 'open' ? 'badge-accent' : ''}">
                ${pollStatus === 'open' ? '🟢 VOTAÇÃO ABERTA' : '🔴 VOTAÇÃO ENCERRADA'}
              </span>
              ${showResults ? '<span class="badge badge-live">📊 RESULTADOS REVELADOS</span>' : '<span style="font-size: 11.5px; color: var(--text-muted);">Votação em andamento pelo celular</span>'}
            </div>
            <div style="font-size: 13.5px; color: var(--accent-primary); font-weight: 700; font-family: var(--font-mono);">
              ${totalVotes} voto(s) computados
            </div>
          </div>
          <h3 style="font-size: 19px; font-weight: 700; color: #ffffff; margin-bottom: 16px;">${poll.question}</h3>
          <div>
            ${pollBodyHtml}
          </div>
        </div>
      `;
    }

    let mediaHtml = '';
    const media = slide.presenter?.media || slide.media;
    if (media) {
      if (media.type === 'image' || media.type === 'svg') {
        mediaHtml = `
          <div class="slide-media-box animate-fade-in">
            <img src="${media.src}" alt="${media.alt || ''}" />
            ${media.caption ? `<div class="slide-media-caption">${media.caption}</div>` : ''}
          </div>
        `;
      } else if (media.type === 'video') {
        mediaHtml = `
          <div class="slide-media-box animate-fade-in">
            <video src="${media.src}" ${media.autoplay ? 'autoplay muted loop playsinline' : 'controls'}></video>
            ${media.caption ? `<div class="slide-media-caption">${media.caption}</div>` : ''}
          </div>
        `;
      } else if (media.type === 'html' || media.type === 'interactive' || media.type === 'media') {
        mediaHtml = `<div class="slide-media-box animate-fade-in">${media.content || media.html || ''}</div>`;
      }
    }

    if (media) {
      containerElement.innerHTML = `
        <div class="slide-content-wrapper slide-layout-split animate-slide-next">
          <div class="slide-tag">${slide.tag || 'SLIDE ' + (this.currentSlideIndex + 1)}</div>
          <div class="slide-split-grid">
            <div class="slide-text-col">
              <h1 class="slide-headline">${slide.presenter.headline || slide.title}</h1>
              <ul class="slide-bullets">
                ${bulletsHtml}
              </ul>
              ${presenterPollHtml}
            </div>
            <div class="slide-media-col">
              ${mediaHtml}
            </div>
          </div>
        </div>
      `;
    } else {
      containerElement.innerHTML = `
        <div class="slide-content-wrapper animate-slide-next">
          <div class="slide-tag">${slide.tag || 'SLIDE ' + (this.currentSlideIndex + 1)}</div>
          <h1 class="slide-headline">${slide.presenter.headline || slide.title}</h1>
          <ul class="slide-bullets">
            ${bulletsHtml}
          </ul>
          ${presenterPollHtml}
        </div>
      `;
    }

    if (notesElement) {
      notesElement.innerHTML = `
        <div class="speaker-notes-title">Notas do Orador:</div>
        <p>${(slide.presenter && slide.presenter.notes) || slide.speakerNotes || 'Nenhuma nota específica para este slide.'}</p>
      `;
    }
  }

  /**
   * Helper para retornar a string HTML do slide do apresentador (com suporte a enquetes e mídia)
   */
  renderSlideHtml(slide = null) {
    const s = slide || this.currentSlide;
    if (!s) return '';
    const presenter = s.presenter || {};
    const bullets = presenter.bullets || s.bullets || [];

    const bulletsHtml = bullets
      .map(b => `
        <li class="slide-bullet-item animate-fade-in">
          <span class="bullet-icon"></span>
          <span>${b}</span>
        </li>
      `).join('');

    let mediaHtml = '';
    const media = presenter.media || s.media;
    if (media) {
      if (media.type === 'image' || media.type === 'svg') {
        mediaHtml = `
          <div class="slide-media-box animate-fade-in">
            <img src="${media.src}" alt="${media.alt || ''}" />
            ${media.caption ? `<div class="slide-media-caption">${media.caption}</div>` : ''}
          </div>
        `;
      } else if (media.type === 'video') {
        mediaHtml = `
          <div class="slide-media-box animate-fade-in">
            <video src="${media.src}" ${media.autoplay ? 'autoplay muted loop playsinline' : 'controls'}></video>
            ${media.caption ? `<div class="slide-media-caption">${media.caption}</div>` : ''}
          </div>
        `;
      } else if (media.type === 'html' || media.type === 'interactive' || media.type === 'media') {
        mediaHtml = `<div class="slide-media-box animate-fade-in">${media.content || media.html || ''}</div>`;
      }
    }

    let pollHtml = '';
    if (s.interaction && s.interaction.poll) {
      const poll = s.interaction.poll;
      const optionsHtml = (poll.options || []).map(opt => `
        <div style="background: rgba(15,23,42,0.7); border: 1.5px solid var(--border-medium); padding: 12px 18px; border-radius: var(--radius-md); display: flex; align-items: center; gap: 12px;">
          <span class="badge badge-accent" style="font-size: 13px; font-weight: 800; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; padding: 0;">${opt.id}</span>
          <span style="font-size: 15px; font-weight: 600; color: #ffffff;">${opt.text}</span>
        </div>
      `).join('');

      pollHtml = `
        <div class="presenter-poll-box animate-fade-in" style="margin-top: 24px; background: rgba(15,23,42,0.85); border: 2px solid var(--accent-primary); border-radius: var(--radius-lg); padding: 22px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <span class="badge badge-live" style="font-size: 11px;">📊 VOTAÇÃO AO VIVO NO CELULAR</span>
            <span style="font-size: 12px; color: var(--accent-primary); font-family: var(--font-mono);">Aponte a câmera para votar</span>
          </div>
          <h3 style="font-size: 18px; font-weight: 800; color: #ffffff; margin-bottom: 16px;">${poll.question}</h3>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px;">
            ${optionsHtml}
          </div>
        </div>
      `;
    }

    if (media) {
      return `
        <div class="slide-content-wrapper slide-layout-split animate-slide-next">
          <div class="slide-tag">${s.tag || 'SLIDE ' + (this.currentSlideIndex + 1)}</div>
          <div class="slide-split-grid">
            <div class="slide-text-col">
              <h1 class="slide-headline">${presenter.headline || s.headline || s.title}</h1>
              <ul class="slide-bullets">
                ${bulletsHtml}
              </ul>
              ${pollHtml}
            </div>
            <div class="slide-media-col">
              ${mediaHtml}
            </div>
          </div>
        </div>
      `;
    } else {
      return `
        <div class="slide-content-wrapper animate-slide-next">
          <div class="slide-tag">${s.tag || 'SLIDE ' + (this.currentSlideIndex + 1)}</div>
          <h1 class="slide-headline">${presenter.headline || s.headline || s.title}</h1>
          <ul class="slide-bullets">
            ${bulletsHtml}
          </ul>
          ${pollHtml}
        </div>
      `;
    }
  }

  /**
   * Renderiza o slide atual para a visão do Smartphone do Público
   */
  renderAudienceSlide(containerElement, pollState = {}) {
    const slide = this.currentSlide;
    if (!slide || !containerElement) return;

    // Seções de aprofundamento (tabelas, textos, listas, imagens, vídeos)
    let sectionsHtml = '';
    if (slide.audience.sections && slide.audience.sections.length > 0) {
      sectionsHtml = slide.audience.sections.map(sec => {
        let contentHtml = '';
        if (sec.type === 'text') {
          contentHtml = `<p class="detail-card-content">${sec.content}</p>`;
        } else if (sec.type === 'image' || sec.type === 'svg') {
          contentHtml = `
            <div style="text-align: center; margin: 10px 0;">
              <img src="${sec.src}" alt="${sec.alt || ''}" style="max-width: 100%; max-height: ${sec.maxHeight || '260px'}; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);" />
              ${sec.caption ? `<p style="font-size: 11px; color: var(--text-secondary); margin-top: 6px;">${sec.caption}</p>` : ''}
            </div>
          `;
        } else if (sec.type === 'video') {
          contentHtml = `
            <div style="text-align: center; margin: 10px 0;">
              <video src="${sec.src}" ${sec.autoplay ? 'autoplay muted loop playsinline' : 'controls'} style="max-width: 100%; max-height: ${sec.maxHeight || '260px'}; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);"></video>
              ${sec.caption ? `<p style="font-size: 11px; color: var(--text-secondary); margin-top: 6px;">${sec.caption}</p>` : ''}
            </div>
          `;
        } else if (sec.type === 'html' || sec.type === 'interactive' || sec.type === 'media') {
          contentHtml = `<div style="margin: 8px 0;">${sec.content || sec.html || ''}</div>`;
        } else if (sec.type === 'list') {
          contentHtml = `
            <ul style="list-style: none; display: flex; flex-direction: column; gap: 8px; font-size: 13.5px; color: #cbd5e1;">
              ${sec.items.map(item => `<li style="display: flex; gap: 8px;"><span>🔹</span><span>${item}</span></li>`).join('')}
            </ul>
          `;
        } else if (sec.type === 'table') {
          const headers = sec.headers.map(h => `<th>${h}</th>`).join('');
          const rows = sec.rows.map(r => `<tr>${r.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('');
          contentHtml = `
            <div class="table-wrapper">
              <table class="audience-table">
                <thead><tr>${headers}</tr></thead>
                <tbody>${rows}</tbody>
              </table>
            </div>
          `;
        }
        return `
          <div class="detail-card animate-fade-in">
            <h3 class="detail-card-title">${sec.title}</h3>
            ${contentHtml}
          </div>
        `;
      }).join('');
    }

    // Interação / Enquete (se houver no slide)
    let interactionHtml = '';
    if (slide.interaction && slide.interaction.poll) {
      const poll = slide.interaction.poll;
      const isClosed = (pollState.pollStatus === 'closed');
      const showResults = (pollState.showResults === true);
      const userVotedOption = pollState.userVoteOption || null;

      let optionsOrResultsHtml = '';

      if (showResults && pollState.results) {
        // Exibe gráfico de barras
        optionsOrResultsHtml = pollState.results.options.map(opt => `
          <div class="poll-result-item">
            <div class="poll-result-header">
              <span class="poll-result-text">
                <span class="poll-letter-badge" style="width: 22px; height: 22px; font-size: 11px; margin-right: 4px;">${opt.id}</span>
                <span>${opt.text}</span>
              </span>
              <span class="poll-result-percentage">${opt.percentage}% (${opt.votes})</span>
            </div>
            <div class="poll-progress-track">
              <div class="poll-progress-fill" style="width: ${opt.percentage}%;"></div>
            </div>
          </div>
        `).join('');
      } else {
        // Exibe botões de votação
        optionsOrResultsHtml = poll.options.map(opt => {
          const isSelected = (userVotedOption === opt.id);
          const disabledAttr = (isClosed || userVotedOption) ? 'disabled' : '';
          return `
            <button class="poll-option-btn ${isSelected ? 'selected' : ''}" data-poll-id="${poll.id}" data-option-id="${opt.id}" ${disabledAttr}>
              <div style="display: flex; align-items: center;">
                <span class="poll-letter-badge">${opt.id}</span>
                <span>${opt.text}</span>
              </div>
              ${isSelected ? '<span style="color: #10b981; font-weight: 700;">✓ Votado</span>' : ''}
            </button>
          `;
        }).join('');
      }

      const statusBadge = isClosed 
        ? '<span class="badge" style="background: rgba(239, 68, 68, 0.2); color: #fca5a5;">Encerrada</span>'
        : '<span class="badge badge-success">🟢 Votação Aberta</span>';

      const feedbackText = userVotedOption 
        ? `✓ Seu voto (Opção ${userVotedOption}) está registrado!` 
        : (isClosed ? 'Votação encerrada pelo apresentador.' : 'Selecione uma opção para votar (1 voto por participante).');

      interactionHtml = `
        <div class="card animate-fade-in" style="border-color: rgba(56, 189, 248, 0.4); background: rgba(15, 23, 42, 0.85);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <span class="badge badge-accent">📊 Enquete Técnica</span>
            ${statusBadge}
          </div>
          <h4 style="font-size: 15px; font-weight: 700; margin-bottom: 16px; color: #ffffff;">${poll.question}</h4>
          <div class="poll-options-container" id="poll-options-${poll.id}">
            ${optionsOrResultsHtml}
          </div>
          <div id="poll-feedback-${poll.id}" style="margin-top: 10px; font-size: 12px; color: var(--text-secondary); text-align: center;">
            ${feedbackText}
          </div>
        </div>
      `;
    }

    containerElement.innerHTML = `
      <div class="audience-hero animate-fade-in">
        <div class="audience-hero-tag">${slide.tag || 'Slide ' + (this.currentSlideIndex + 1)}</div>
        <h2 class="audience-hero-title">${slide.title}</h2>
        <p class="audience-hero-summary">${slide.audience.summary || ''}</p>
      </div>
      ${interactionHtml}
      ${sectionsHtml}
    `;
  }

  on(eventName, callback) {
    if (this.callbacks[eventName]) {
      this.callbacks[eventName].push(callback);
    }
  }

  _emit(eventName, data) {
    if (this.callbacks[eventName]) {
      this.callbacks[eventName].forEach(cb => cb(data));
    }
  }
}

export const presentationEngine = new PresentationEngine();
