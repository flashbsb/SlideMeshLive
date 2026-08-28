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
  renderPresenterSlide(containerElement, notesElement = null) {
    const slide = this.currentSlide;
    if (!slide || !containerElement) return;

    const bulletsHtml = (slide.presenter.bullets || [])
      .map(b => `
        <li class="slide-bullet-item animate-fade-in">
          <span class="bullet-icon"></span>
          <span>${b}</span>
        </li>
      `).join('');

    containerElement.innerHTML = `
      <div class="slide-content-wrapper animate-slide-next">
        <div class="slide-tag">${slide.tag || 'SLIDE ' + (this.currentSlideIndex + 1)}</div>
        <h1 class="slide-headline">${slide.presenter.headline || slide.title}</h1>
        <ul class="slide-bullets">
          ${bulletsHtml}
        </ul>
      </div>
    `;

    if (notesElement) {
      notesElement.innerHTML = `
        <div class="speaker-notes-title">Notas do Orador:</div>
        <p>${slide.presenter.notes || 'Nenhuma nota específica para este slide.'}</p>
      `;
    }
  }

  /**
   * Renderiza o slide atual para a visão do Smartphone do Público
   */
  renderAudienceSlide(containerElement) {
    const slide = this.currentSlide;
    if (!slide || !containerElement) return;

    // Seções de aprofundamento (tabelas, textos, listas)
    let sectionsHtml = '';
    if (slide.audience.sections && slide.audience.sections.length > 0) {
      sectionsHtml = slide.audience.sections.map(sec => {
        let contentHtml = '';
        if (sec.type === 'text') {
          contentHtml = `<p class="detail-card-content">${sec.content}</p>`;
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
      const optionsHtml = poll.options.map(opt => `
        <button class="poll-option-btn" data-poll-id="${poll.id}" data-option-id="${opt.id}">
          <div style="display: flex; align-items: center;">
            <span class="poll-letter-badge">${opt.id}</span>
            <span>${opt.text}</span>
          </div>
        </button>
      `).join('');

      interactionHtml = `
        <div class="card animate-fade-in" style="border-color: rgba(56, 189, 248, 0.4); background: rgba(15, 23, 42, 0.85);">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
            <span class="badge badge-accent">📊 Enquete Técnica</span>
            <span class="badge badge-live">Ao Vivo</span>
          </div>
          <h4 style="font-size: 15px; font-weight: 700; margin-bottom: 16px; color: #ffffff;">${poll.question}</h4>
          <div class="poll-options-container" id="poll-options-${poll.id}">
            ${optionsHtml}
          </div>
          <div id="poll-feedback-${poll.id}" style="margin-top: 10px; font-size: 12px; color: var(--text-secondary); text-align: center;">
            Clique para registrar seu voto (exige login nas fases de interação).
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
