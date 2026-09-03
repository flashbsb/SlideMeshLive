/**
 * Presentation Engine
 * Plataforma de Apresentação HTML Interativa
 * Gerencia o ciclo de vida, carregamento e renderização de apresentações modulares.
 */

export class PresentationEngine {
  constructor(options = {}) {
    this.basePath = options.basePath || '../presentations';
    this.presentationId = options.presentationId || 'slidemesh-showcase';
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
    return params.get('presentation') || params.get('pres') || 'slidemesh-showcase';
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
    return (stored || 'SHOWCASE2026').trim().toUpperCase();
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
      if (!manifestRes.ok) {
        if (this.presentationId !== 'slidemesh-showcase') {
          console.warn(`[PresentationEngine] Apresentação '${this.presentationId}' não encontrada (${manifestRes.status}). Recorrendo ao fallback 'slidemesh-showcase'...`);
          return this.loadPresentation('slidemesh-showcase');
        }
        throw new Error(`Não foi possível carregar o manifesto: ${manifestRes.statusText}`);
      }
      this.manifest = await manifestRes.json();

      // Carrega slides
      const slidesRes = await fetch(`${presentationUrl}/slides.json`);
      if (!slidesRes.ok) {
        if (this.presentationId !== 'slidemesh-showcase') {
          console.warn(`[PresentationEngine] Slides de '${this.presentationId}' não encontrados (${slidesRes.status}). Recorrendo ao fallback 'slidemesh-showcase'...`);
          return this.loadPresentation('slidemesh-showcase');
        }
        throw new Error(`Não foi possível carregar os slides: ${slidesRes.statusText}`);
      }
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

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Detecta dinamicamente o layout semântico do slide
   */
  detectSlideLayout(slide) {
    if (!slide) return 'standard';
    const s = slide;
    const p = s.presenter || {};
    if (s.layout) return s.layout;
    if (p.layout) return p.layout;
    if (s.bento || p.bento) return 'bento';
    if (s.metric || p.metric) return 'metric';
    if (s.quote || p.quote) return 'quote';
    if (s.code || p.code) return 'code';
    if (s.columns || p.columns) return 'columns';
    if (s.timeline || p.timeline) return 'timeline';
    if (s.hero || p.hero) return 'hero';
    if (p.media || s.media) return 'split';
    return 'standard';
  }

  getFontClass(slide = null) {
    const s = slide || this.currentSlide || {};
    const font = s.fontFamily || s.font || this.manifest?.theme?.fontFamily || 'Inter';
    const clean = String(font).toLowerCase();
    if (clean.includes('outfit') || clean.includes('display')) return 'font-outfit';
    if (clean.includes('playfair') || clean.includes('serif')) return 'font-playfair';
    if (clean.includes('fira') || clean.includes('code') || clean.includes('mono')) return 'font-code';
    if (clean.includes('montserrat')) return 'font-montserrat';
    return 'font-inter';
  }

  getBackgroundClass(slide = null) {
    const s = slide || this.currentSlide || {};
    const bg = s.background || this.manifest?.theme?.background || '';
    if (typeof bg === 'string') {
      if (bg.includes('aurora')) return 'slide-bg-aurora';
      if (bg.includes('sunset')) return 'slide-bg-sunset';
      if (bg.includes('cyber')) return 'slide-bg-cyber';
      if (bg.includes('editorial')) return 'slide-bg-editorial';
      if (bg.includes('mesh')) return 'slide-bg-mesh';
    }
    return '';
  }

  /**
   * Renderiza o slide atual para a visão do Apresentador
   */
  renderPresenterSlide(containerElement, notesElement = null, pollRenderData = null, options = {}) {
    const slide = this.currentSlide;
    if (!slide || !containerElement) return;

    // Aplica classe de fundo no container se houver
    const bgClass = this.getBackgroundClass(slide);
    containerElement.className = `slide-canvas ${bgClass}`.trim();

    containerElement.innerHTML = this.renderSlideHtml(slide, options, pollRenderData);

    if (notesElement) {
      notesElement.innerHTML = `
        <div class="speaker-notes-title">Notas do Orador:</div>
        <p>${(slide.presenter && slide.presenter.notes) || slide.speakerNotes || 'Nenhuma nota específica para este slide.'}</p>
      `;
    }
  }

  /**
   * Helper unificado para retornar a string HTML do slide do apresentador
   */
  renderSlideHtml(slide = null, options = {}, pollRenderData = null) {
    const s = slide || this.currentSlide;
    if (!s) return '';

    const presenter = s.presenter || {};
    const transition = (options && options.transition) || presenter.transition || s.transition || (this.manifest?.theme?.transition) || 'fade';
    const direction = (options && options.direction) || 'next';

    let transClass = 'stage-trans-fade';
    if (transition === 'slide') {
      transClass = (direction === 'prev') ? 'stage-trans-slide-prev' : 'stage-trans-slide-next';
    } else if (transition === 'zoom') {
      transClass = 'stage-trans-zoom';
    } else if (transition === 'dissolve') {
      transClass = 'stage-trans-dissolve';
    } else if (transition === 'stagger') {
      transClass = 'stage-trans-stagger';
    }

    const fontClass = this.getFontClass(s);
    const layout = this.detectSlideLayout(s);

    // Renderização de Enquete (se houver)
    let pollHtml = '';
    if (s.interaction && s.interaction.poll) {
      const poll = s.interaction.poll;
      const pollStatus = (pollRenderData && pollRenderData.pollStatus) || 'open';
      const showResults = !!(pollRenderData && pollRenderData.showResults);
      const results = (pollRenderData && pollRenderData.results) || null;
      const totalVotes = results ? results.totalVotes : 0;

      let pollBodyHtml = '';
      if (showResults && results) {
        pollBodyHtml = results.options.map(opt => `
          <div style="margin-bottom: 12px;" class="animate-fade-in">
            <div style="display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 4px;">
              <span style="color: #ffffff; font-weight: 600;">${opt.id}. ${opt.text}</span>
              <strong style="color: var(--accent-primary); font-family: var(--font-mono); font-size: 15px;">${opt.percentage}% (${opt.votes})</strong>
            </div>
            <div class="progress-bar-bg" style="height: 12px;">
              <div class="progress-bar-fill" style="width: ${opt.percentage}%;"></div>
            </div>
          </div>
        `).join('');
      } else {
        pollBodyHtml = (poll.options || []).map(opt => `
          <div style="background: rgba(15,23,42,0.7); border: 1.5px solid var(--border-medium); padding: 12px 18px; border-radius: var(--radius-md); display: flex; align-items: center; gap: 12px;">
            <span class="badge badge-accent" style="font-size: 13px; font-weight: 800; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; padding: 0;">${opt.id}</span>
            <span style="font-size: 15px; font-weight: 600; color: #ffffff;">${opt.text}</span>
          </div>
        `).join('');
      }

      pollHtml = `
        <div class="presenter-poll-box animate-fade-in" style="margin-top: 24px; background: rgba(15,23,42,0.85); border: 2px solid var(--accent-primary); border-radius: var(--radius-lg); padding: 22px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <span class="badge ${pollStatus === 'open' ? 'badge-live' : 'badge-accent'}" style="font-size: 11px;">
              ${pollStatus === 'open' ? '📊 VOTAÇÃO AO VIVO NO CELULAR' : '🔒 VOTAÇÃO ENCERRADA'}
            </span>
            <span style="font-size: 12px; color: var(--accent-primary); font-family: var(--font-mono);">
              ${showResults ? `Total: ${totalVotes} votos` : 'Aponte a câmera para votar'}
            </span>
          </div>
          <h3 style="font-size: 18px; font-weight: 800; color: #ffffff; margin-bottom: 16px;">${poll.question}</h3>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px;">
            ${pollBodyHtml}
          </div>
        </div>
      `;
    }

    // Vídeo de Fundo em Loop (Fase 2)
    const videoBgSrc = s.videoBackground || s.videoLoop || (s.media && s.media.type === 'video-bg' ? s.media.src : null) || (presenter && presenter.videoBackground);
    let videoBgHtml = '';
    if (videoBgSrc) {
      videoBgHtml = `
        <div class="slide-video-bg-layer animate-fade-in">
          <video src="${videoBgSrc}" autoplay muted loop playsinline></video>
          <div class="slide-video-bg-overlay"></div>
        </div>
      `;
    }

    let innerHtml = '';
    // Roteamento por Layout Semântico
    if (layout === 'bento') {
      innerHtml = this.renderBentoSlideHtml(s, transClass, pollHtml, fontClass);
    } else if (layout === 'metric') {
      innerHtml = this.renderMetricSlideHtml(s, transClass, pollHtml, fontClass);
    } else if (layout === 'quote') {
      innerHtml = this.renderQuoteSlideHtml(s, transClass, pollHtml, fontClass);
    } else if (layout === 'code') {
      innerHtml = this.renderCodeSlideHtml(s, transClass, pollHtml, fontClass);
    } else if (layout === 'columns') {
      innerHtml = this.renderColumnsSlideHtml(s, transClass, pollHtml, fontClass);
    } else if (layout === 'timeline') {
      innerHtml = this.renderTimelineSlideHtml(s, transClass, pollHtml, fontClass);
    } else if (layout === 'hero') {
      innerHtml = this.renderHeroSlideHtml(s, transClass, pollHtml, fontClass);
    } else {
      innerHtml = this.renderStandardSlideHtml(s, transClass, pollHtml, fontClass, transition);
    }

    return `${videoBgHtml}${innerHtml}`;
  }

  renderBentoSlideHtml(s, transClass, pollHtml, fontClass) {
    const p = s.presenter || {};
    const bentoData = s.bento || p.bento || {};
    const cards = bentoData.cards || [];
    const headline = p.headline || s.headline || s.title || '';
    const tag = s.tag || `SLIDE ${this.currentSlideIndex + 1}`;

    const cardsHtml = cards.map((c, idx) => {
      const colSpan = c.cols || c.span || (idx === 0 ? 8 : 4);
      const isHighlight = c.highlight ? 'bento-card-highlight' : '';
      const iconHtml = c.icon ? `<div class="bento-icon-wrapper">${c.icon}</div>` : '';
      const statHtml = c.stat ? `<div class="bento-stat-num font-outfit">${c.stat}</div>` : '';
      const titleHtml = c.title ? `<div class="bento-card-title">${c.title}</div>` : '';
      const descHtml = c.desc || c.description ? `<div class="bento-card-desc">${c.desc || c.description}</div>` : '';

      return `
        <div class="bento-card bento-col-${colSpan} ${isHighlight} animate-fade-in" style="animation-delay: ${(idx + 1) * 80}ms;">
          <div>
            ${iconHtml}
            ${statHtml}
            ${titleHtml}
            ${descHtml}
          </div>
          ${c.badge ? `<div style="margin-top: 12px;"><span class="badge ${c.badgeClass || 'badge-accent'}" style="font-size: 11px;">${c.badge}</span></div>` : ''}
        </div>
      `;
    }).join('');

    return `
      <div class="slide-content-wrapper slide-layout-bento ${transClass} ${fontClass}">
        <div class="slide-tag">${tag}</div>
        <h1 class="slide-headline">${headline}</h1>
        <div class="bento-grid">
          ${cardsHtml}
        </div>
        ${pollHtml}
      </div>
    `;
  }

  renderMetricSlideHtml(s, transClass, pollHtml, fontClass) {
    const p = s.presenter || {};
    const metricData = s.metric || p.metric || {};
    const headline = p.headline || s.headline || s.title || '';
    const tag = s.tag || `SLIDE ${this.currentSlideIndex + 1}`;
    const value = metricData.value || '100%';
    const delta = metricData.delta || metricData.growth || null;
    const label = metricData.label || metricData.subtitle || headline;
    const pillars = metricData.pillars || metricData.details || [];

    const pillarsHtml = pillars.map(pl => `
      <div class="metric-pillar-card">
        <div style="font-size: 17px; font-weight: 800; color: var(--accent-primary); margin-bottom: 4px;">${pl.stat || pl.icon || '✦'} ${pl.title || ''}</div>
        <div style="font-size: 13.5px; color: #94a3b8; line-height: 1.4;">${pl.desc || pl.description || ''}</div>
      </div>
    `).join('');

    return `
      <div class="slide-content-wrapper slide-layout-metric ${transClass} ${fontClass}">
        <div class="slide-tag">${tag}</div>
        <div class="metric-hero-box animate-fade-in">
          <div class="metric-display font-outfit">${value}</div>
          ${delta ? `<div class="metric-delta-badge">🚀 ${delta}</div>` : ''}
          <div class="metric-subtitle">${label}</div>
          ${pillars.length > 0 ? `<div class="metric-pillars-grid">${pillarsHtml}</div>` : ''}
        </div>
        ${pollHtml}
      </div>
    `;
  }

  renderQuoteSlideHtml(s, transClass, pollHtml, fontClass) {
    const p = s.presenter || {};
    const quoteData = s.quote || p.quote || {};
    const tag = s.tag || `SLIDE ${this.currentSlideIndex + 1}`;
    const text = quoteData.text || p.headline || s.headline || s.title || '';
    const author = quoteData.author || quoteData.speaker || 'Liderança';
    const role = quoteData.role || quoteData.title || '';
    const avatar = quoteData.avatar || quoteData.photo || null;

    return `
      <div class="slide-content-wrapper slide-layout-quote ${transClass} ${fontClass}">
        <div class="slide-tag">${tag}</div>
        <div class="quote-box animate-fade-in">
          <div class="quote-giant-mark font-playfair">“</div>
          <div class="quote-statement font-playfair">${text}</div>
          <div class="quote-author-card">
            ${avatar ? `<img src="${avatar}" alt="${author}" class="quote-avatar" />` : `<div class="quote-avatar" style="background: rgba(56,189,248,0.2); display: flex; align-items: center; justify-content: center; font-weight: 800; color: #38bdf8;">👤</div>`}
            <div class="quote-author-info">
              <div class="quote-author-name">${author}</div>
              ${role ? `<div class="quote-author-role">${role}</div>` : ''}
            </div>
          </div>
        </div>
        ${pollHtml}
      </div>
    `;
  }

  renderCodeSlideHtml(s, transClass, pollHtml, fontClass) {
    const p = s.presenter || {};
    const codeData = s.code || p.code || {};
    const headline = p.headline || s.headline || s.title || '';
    const tag = s.tag || `SLIDE ${this.currentSlideIndex + 1}`;
    const bullets = p.bullets || s.bullets || [];
    const filename = codeData.filename || codeData.title || 'server.py';
    const rawCode = codeData.snippet || codeData.content || '// SlideMeshLive Engine';

    const bulletsHtml = bullets.map((b, idx) => `
      <li class="slide-bullet-item animate-fade-in" style="animation-delay: ${(idx + 1) * 80}ms;">
        <span class="bullet-icon"></span>
        <span>${b}</span>
      </li>
    `).join('');

    return `
      <div class="slide-content-wrapper slide-layout-code ${transClass} ${fontClass}">
        <div class="slide-tag">${tag}</div>
        <div class="terminal-grid">
          <div class="slide-text-col">
            <h1 class="slide-headline">${headline}</h1>
            <ul class="slide-bullets">${bulletsHtml}</ul>
            ${pollHtml}
          </div>
          <div class="terminal-window animate-fade-in">
            <div class="terminal-titlebar">
              <div class="terminal-dots">
                <span class="terminal-dot dot-red"></span>
                <span class="terminal-dot dot-yellow"></span>
                <span class="terminal-dot dot-green"></span>
              </div>
              <div class="terminal-title">${filename}</div>
              <div></div>
            </div>
            <pre class="terminal-code-body font-code"><code>${this.escapeHtml(rawCode)}</code></pre>
          </div>
        </div>
      </div>
    `;
  }

  renderColumnsSlideHtml(s, transClass, pollHtml, fontClass) {
    const p = s.presenter || {};
    const colData = s.columns || p.columns || {};
    const items = colData.items || colData.columns || [];
    const headline = p.headline || s.headline || s.title || '';
    const tag = s.tag || `SLIDE ${this.currentSlideIndex + 1}`;

    const colsHtml = items.map((col, idx) => {
      const bullets = (col.bullets || col.items || []).map(b => `
        <li><span>🔹</span><span>${b}</span></li>
      `).join('');

      return `
        <div class="column-card animate-fade-in" style="animation-delay: ${(idx + 1) * 90}ms;">
          <div class="column-header-icon">${col.icon || '🚀'}</div>
          <div class="column-card-title">${col.title}</div>
          <ul class="column-card-bullets">${bullets}</ul>
          ${col.desc ? `<p style="font-size: 13px; color: #94a3b8; margin-top: 12px;">${col.desc}</p>` : ''}
        </div>
      `;
    }).join('');

    return `
      <div class="slide-content-wrapper slide-layout-columns ${transClass} ${fontClass}">
        <div class="slide-tag">${tag}</div>
        <h1 class="slide-headline">${headline}</h1>
        <div class="columns-3-grid">
          ${colsHtml}
        </div>
        ${pollHtml}
      </div>
    `;
  }

  renderTimelineSlideHtml(s, transClass, pollHtml, fontClass) {
    const p = s.presenter || {};
    const timelineData = s.timeline || p.timeline || {};
    const steps = timelineData.steps || timelineData.milestones || [];
    const headline = p.headline || s.headline || s.title || '';
    const tag = s.tag || `SLIDE ${this.currentSlideIndex + 1}`;

    const stepsHtml = steps.map((step, idx) => `
      <div class="timeline-step-card animate-fade-in" style="animation-delay: ${(idx + 1) * 90}ms;">
        <div class="timeline-step-badge">${step.step || (idx + 1)}</div>
        <div class="timeline-step-title">${step.title}</div>
        <div class="timeline-step-desc">${step.desc || step.description || ''}</div>
      </div>
    `).join('');

    return `
      <div class="slide-content-wrapper slide-layout-timeline ${transClass} ${fontClass}">
        <div class="slide-tag">${tag}</div>
        <h1 class="slide-headline">${headline}</h1>
        <div class="timeline-horizontal-track">
          ${stepsHtml}
        </div>
        ${pollHtml}
      </div>
    `;
  }

  renderHeroSlideHtml(s, transClass, pollHtml, fontClass) {
    const p = s.presenter || {};
    const heroData = s.hero || p.hero || {};
    const grandTitle = heroData.title || p.headline || s.headline || s.title || '';
    const subtitle = heroData.subtitle || heroData.desc || (p.bullets && p.bullets[0]) || '';
    const tag = s.tag || `SLIDE ${this.currentSlideIndex + 1}`;
    const badges = heroData.badges || [];

    const badgesHtml = badges.map(b => `
      <span class="badge ${b.class || 'badge-accent'}" style="font-size: 13px; padding: 6px 14px;">${b.text || b}</span>
    `).join('');

    return `
      <div class="slide-content-wrapper slide-layout-hero ${transClass} ${fontClass}">
        <div class="slide-tag">${tag}</div>
        <div class="hero-grand-title font-outfit">${grandTitle}</div>
        <div class="hero-subtitle">${subtitle}</div>
        ${badges.length > 0 ? `<div class="hero-badges-row">${badgesHtml}</div>` : ''}
        ${pollHtml}
      </div>
    `;
  }

  renderStandardSlideHtml(s, transClass, pollHtml, fontClass, transition) {
    const presenter = s.presenter || {};
    const bullets = presenter.bullets || s.bullets || [];
    const isStagger = (transition === 'stagger');

    const bulletsHtml = bullets
      .map((b, idx) => `
        <li class="slide-bullet-item ${isStagger ? 'stage-stagger-bullet' : 'animate-fade-in'}" ${isStagger ? `style="animation-delay: ${(idx + 1) * 80 + 40}ms;"` : ''}>
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
      } else if (media.type === 'audio' || media.type === 'sound') {
        mediaHtml = `
          <div class="slide-audio-player-box animate-fade-in">
            <div class="slide-audio-wave-anim">
              <span></span><span></span><span></span><span></span><span></span>
            </div>
            <div style="flex: 1;">
              <div style="font-size: 14.5px; font-weight: 700; color: #ffffff; margin-bottom: 6px;">🎧 ${media.title || media.caption || 'Demonstração de Áudio'}</div>
              <audio src="${media.src || s.audio}" controls style="width: 100%; height: 36px;"></audio>
            </div>
          </div>
        `;
      } else if (media.type === 'html' || media.type === 'interactive' || media.type === 'media') {
        mediaHtml = `<div class="slide-media-box animate-fade-in">${media.content || media.html || ''}</div>`;
      }
    }

    if (media) {
      return `
        <div class="slide-content-wrapper slide-layout-split ${transClass} ${fontClass}">
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
        <div class="slide-content-wrapper ${transClass} ${fontClass}">
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

    // Seções de aprofundamento (tabelas, textos, listas, imagens, vídeos, layouts ricos)
    let sectionsHtml = '';
    const audienceSections = (slide.audience && slide.audience.sections) || [];

    if (audienceSections.length > 0) {
      sectionsHtml = audienceSections.map(sec => {
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
        } else if (sec.type === 'audio') {
          contentHtml = `
            <div style="margin: 10px 0;">
              <div style="font-size: 13.5px; font-weight: 600; color: #ffffff; margin-bottom: 6px;">🎧 ${sec.title || 'Áudio do Slide'}</div>
              <audio src="${sec.src}" controls style="width: 100%; height: 38px;"></audio>
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
    } else {
      // Fallback semântico para layouts ricos quando seções personalizadas não foram declaradas
      if (slide.bento && slide.bento.cards) {
        sectionsHtml = slide.bento.cards.map(c => `
          <div class="detail-card animate-fade-in">
            <h3 class="detail-card-title">${c.icon ? c.icon + ' ' : ''}${c.title || 'Destaque'}</h3>
            ${c.stat ? `<div style="font-size: 24px; font-weight: 800; color: #38bdf8; margin: 4px 0 8px;">${c.stat}</div>` : ''}
            <p class="detail-card-content">${c.desc || c.description || ''}</p>
          </div>
        `).join('');
      } else if (slide.columns && slide.columns.items) {
        sectionsHtml = slide.columns.items.map(col => `
          <div class="detail-card animate-fade-in">
            <h3 class="detail-card-title">${col.icon ? col.icon + ' ' : ''}${col.title}</h3>
            <ul style="list-style: none; display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: #cbd5e1; margin-top: 6px;">
              ${(col.bullets || col.items || []).map(b => `<li>🔹 ${b}</li>`).join('')}
            </ul>
          </div>
        `).join('');
      } else if (slide.code) {
        sectionsHtml = `
          <div class="detail-card animate-fade-in">
            <h3 class="detail-card-title">💻 ${slide.code.filename || 'Código do Slide'}</h3>
            <pre style="background: #090d16; padding: 12px; border-radius: 8px; font-size: 12px; overflow-x: auto; color: #38bdf8; margin: 8px 0;"><code>${this.escapeHtml(slide.code.snippet || slide.code.content || '')}</code></pre>
          </div>
        `;
      } else if (slide.metric) {
        sectionsHtml = `
          <div class="detail-card animate-fade-in" style="text-align: center;">
            <div style="font-size: 40px; font-weight: 900; color: #38bdf8; margin-bottom: 6px;">${slide.metric.value || ''}</div>
            ${slide.metric.delta ? `<span class="badge badge-success" style="margin-bottom: 8px;">🚀 ${slide.metric.delta}</span>` : ''}
            <p class="detail-card-content">${slide.metric.label || slide.metric.subtitle || ''}</p>
          </div>
        `;
      } else if (slide.quote) {
        sectionsHtml = `
          <div class="detail-card animate-fade-in">
            <p style="font-style: italic; font-size: 15px; color: #ffffff; margin-bottom: 8px;">“${slide.quote.text || ''}”</p>
            <strong style="color: var(--accent-primary); font-size: 13px;">— ${slide.quote.author || ''}</strong>
            ${slide.quote.role ? `<span style="color: #94a3b8; font-size: 12px;"> (${slide.quote.role})</span>` : ''}
          </div>
        `;
      } else if (slide.timeline && slide.timeline.steps) {
        sectionsHtml = slide.timeline.steps.map(st => `
          <div class="detail-card animate-fade-in">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
              <span class="badge badge-accent" style="width: 22px; height: 22px; display: inline-flex; align-items: center; justify-content: center; padding: 0;">${st.step || '✦'}</span>
              <strong style="color: #ffffff; font-size: 14px;">${st.title}</strong>
            </div>
            <p class="detail-card-content">${st.desc || st.description || ''}</p>
          </div>
        `).join('');
      }
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
