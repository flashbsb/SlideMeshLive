/**
 * Media Cache Engine
 * Plataforma de Apresentação HTML Interativa Sincronizada
 * 
 * Gerencia o rastreamento, pré-carregamento em segundo plano (pre-fetch com Range Requests)
 * e ciclo de vida de mídias pesadas (vídeos MP4/WebM e áudios MP3/WAV) com janela deslizante
 * de ±2 slides e descarte determinístico de memória (URL.revokeObjectURL).
 */

export class MediaCacheEngine {
  constructor(options = {}) {
    this.slidingWindowSize = options.slidingWindowSize || 2;
    this.basePath = options.basePath || '';
    
    // Mapeamento: slideIndex (number) -> Set de URLs de mídia (string)
    this.trackedMedia = new Map();
    
    // Cache de mídias ativas: mediaUrl (string) -> { blob, blobUrl, size, status, abortController }
    this.cache = new Map();
    
    // Janela ativa de slides: [minSlideIndex, maxSlideIndex]
    this.activeWindow = [0, 0];
    
    // Extensões de mídia reconhecidas
    this.mediaExtensions = /\.(mp4|webm|ogg|mp3|wav|m4a|aac|flac)(\?.*)?$/i;

    // Callbacks de eventos de cache
    this.onCacheUpdate = options.onCacheUpdate || null;
  }

  /**
   * Inicializa o rastreador de mídias a partir do array de slides da apresentação
   * @param {Array} slides - Array de objetos de slide do slides.json
   * @param {string} basePath - Caminho base da apresentação (ex: '../presentations/slug')
   */
  init(slides = [], basePath = '') {
    this.basePath = basePath || this.basePath || '';
    this.clearAll();

    if (!Array.isArray(slides)) return;

    slides.forEach((slide, idx) => {
      const urls = this.extractMediaUrlsFromSlide(slide);
      if (urls.length > 0) {
        this.trackedMedia.set(idx, new Set(urls));
      }
    });

    // Inicia na posição 0
    this.onSlideChange(0, slides.length);
  }

  /**
   * Extrai todas as URLs de vídeo e áudio de um slide (analisando corpo, notas, bullets e HTML)
   * @param {Object} slide - Objeto de slide
   * @returns {Array<string>} Lista de URLs absolutas/relativas resolvidas
   */
  extractMediaUrlsFromSlide(slide) {
    const urls = new Set();
    if (!slide) return [];

    // 1. Extração direta de propriedades declarativas de mídia
    if (slide.media && typeof slide.media === 'string' && this.isMediaUrl(slide.media)) {
      urls.add(this.resolveMediaUrl(slide.media));
    }
    if (slide.presenter && slide.presenter.media && typeof slide.presenter.media.src === 'string' && this.isMediaUrl(slide.presenter.media.src)) {
      urls.add(this.resolveMediaUrl(slide.presenter.media.src));
    }
    if (slide.video && typeof slide.video === 'string' && this.isMediaUrl(slide.video)) {
      urls.add(this.resolveMediaUrl(slide.video));
    }
    if (slide.videoBackground && typeof slide.videoBackground === 'string' && this.isMediaUrl(slide.videoBackground)) {
      urls.add(this.resolveMediaUrl(slide.videoBackground));
    }
    if (slide.videoLoop && typeof slide.videoLoop === 'string' && this.isMediaUrl(slide.videoLoop)) {
      urls.add(this.resolveMediaUrl(slide.videoLoop));
    }
    if (slide.audio && typeof slide.audio === 'string' && this.isMediaUrl(slide.audio)) {
      urls.add(this.resolveMediaUrl(slide.audio));
    }
    if (slide.audience && Array.isArray(slide.audience.sections)) {
      slide.audience.sections.forEach(sec => {
        if (sec && sec.src && typeof sec.src === 'string' && this.isMediaUrl(sec.src)) {
          urls.add(this.resolveMediaUrl(sec.src));
        }
      });
    }

    // 2. Extração de tags <video>, <audio>, <source> no HTML do slide
    const htmlSources = [
      slide.body,
      slide.presenter && slide.presenter.body,
      slide.audience && slide.audience.body,
      Array.isArray(slide.bullets) ? slide.bullets.join(' ') : null
    ].filter(Boolean);

    htmlSources.forEach(html => {
      if (typeof html !== 'string') return;

      // Regex para encontrar src em tags <video>, <audio>, <source>
      const tagRegex = /<(?:video|audio|source)[^>]+src=["']([^"']+)["']/gi;
      let match;
      while ((match = tagRegex.exec(html)) !== null) {
        const src = match[1];
        if (src && this.isMediaUrl(src)) {
          urls.add(this.resolveMediaUrl(src));
        }
      }

      // Regex genérica para links diretos de arquivos de mídia
      const directUrlRegex = /https?:\/\/[^\s"'<>]+?\.(?:mp4|webm|ogg|mp3|wav|m4a|aac|flac)(?:\?[^\s"'<>]*)?|[a-zA-Z0-9_\-\./]+\.(?:mp4|webm|ogg|mp3|wav|m4a|aac|flac)(?:\?[^\s"'<>]*)?/gi;
      while ((match = directUrlRegex.exec(html)) !== null) {
        const src = match[0];
        if (src && this.isMediaUrl(src)) {
          urls.add(this.resolveMediaUrl(src));
        }
      }
    });

    return Array.from(urls);
  }

  /**
   * Verifica se uma string corresponde a uma extensão de mídia reconhecida
   */
  isMediaUrl(url) {
    if (!url || typeof url !== 'string') return false;
    return this.mediaExtensions.test(url.trim());
  }

  /**
   * Resolve a URL relativa combinando com o basePath se necessário
   */
  resolveMediaUrl(url) {
    if (!url) return '';
    const cleanUrl = url.trim();
    if (cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://') || cleanUrl.startsWith('/') || cleanUrl.startsWith('data:') || cleanUrl.startsWith('blob:')) {
      return cleanUrl;
    }
    if (this.basePath) {
      return `${this.basePath.replace(/\/+$/, '')}/${cleanUrl.replace(/^\/+/, '')}`;
    }
    return cleanUrl;
  }

  /**
   * Ciclo de vida disparado a cada transição de slide
   * Atualiza a janela deslizante, pré-carrega os próximos slides e descarta mídias antigas
   * @param {number} currentIndex - Índice do slide atual (0-based)
   * @param {number} totalSlides - Total de slides na apresentação
   */
  async onSlideChange(currentIndex, totalSlides = 100) {
    const minIdx = Math.max(0, currentIndex - this.slidingWindowSize);
    const maxIdx = Math.min(totalSlides - 1, currentIndex + this.slidingWindowSize);
    this.activeWindow = [minIdx, maxIdx];

    // 1. Limpa mídias que saíram da janela ativa de ±2 slides
    this.cleanupOutOfWindow(currentIndex);

    // 2. Pré-carrega mídias do slide atual e dos próximos slides (prioridade crescente)
    const prioritySlides = [];
    prioritySlides.push(currentIndex); // Slide atual (prioridade imediata)
    for (let i = 1; i <= this.slidingWindowSize; i++) {
      const nextIdx = currentIndex + i;
      if (nextIdx < totalSlides) {
        prioritySlides.push(nextIdx);
      }
    }

    for (const slideIdx of prioritySlides) {
      await this.prefetchSlideMedia(slideIdx);
    }

    if (typeof this.onCacheUpdate === 'function') {
      this.onCacheUpdate(this.getStats());
    }
  }

  /**
   * Pré-carrega em segundo plano todas as mídias de um slide específico
   */
  async prefetchSlideMedia(slideIndex) {
    const urls = this.trackedMedia.get(slideIndex);
    if (!urls || urls.size === 0) return;

    for (const url of urls) {
      if (this.cache.has(url)) continue; // Já em cache ou em download

      const abortController = new AbortController();
      this.cache.set(url, {
        blob: null,
        blobUrl: null,
        size: 0,
        status: 'fetching',
        abortController
      });

      try {
        // Fetch progressivo com prioridade baixa e suporte a Range
        const response = await fetch(url, {
          signal: abortController.signal,
          headers: {
            'Range': 'bytes=0-1048575' // Pré-carrega o primeiro 1MB para início instantâneo
          }
        });

        if (!response.ok && response.status !== 206) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);

        // Se o download não foi abortado entretanto
        if (this.cache.has(url)) {
          this.cache.set(url, {
            blob,
            blobUrl,
            size: blob.size,
            status: 'cached',
            abortController: null,
            cachedAt: Date.now()
          });
        } else {
          URL.revokeObjectURL(blobUrl);
        }
      } catch (err) {
        if (err.name === 'AbortError') {
          // Download cancelado por sair da janela deslizante
        } else {
          console.warn(`[MediaCacheEngine] Aviso ao pré-carregar mídia '${url}':`, err.message);
          if (this.cache.has(url)) {
            this.cache.delete(url);
          }
        }
      }
    }
  }

  /**
   * Remove e descarta com URL.revokeObjectURL todas as mídias fora da janela ativa
   */
  cleanupOutOfWindow(currentIndex) {
    const [minIdx, maxIdx] = this.activeWindow;

    // Coleta o conjunto de URLs necessárias pelos slides DENTRO da janela ativa
    const neededUrls = new Set();
    for (let i = minIdx; i <= maxIdx; i++) {
      const urls = this.trackedMedia.get(i);
      if (urls) {
        urls.forEach(u => neededUrls.add(u));
      }
    }

    // Identifica itens em cache que não são mais necessários
    for (const [url, entry] of this.cache.entries()) {
      if (!neededUrls.has(url)) {
        if (entry.abortController) {
          entry.abortController.abort();
        }
        if (entry.blobUrl) {
          try {
            URL.revokeObjectURL(entry.blobUrl);
          } catch (e) {}
        }
        this.cache.delete(url);
      }
    }
  }

  /**
   * Retorna a URL otimizada em cache (Blob URL) ou a URL original caso não esteja em cache
   */
  getMediaUrl(originalUrl) {
    if (!originalUrl) return '';
    const resolved = this.resolveMediaUrl(originalUrl);
    const entry = this.cache.get(resolved);
    if (entry && entry.blobUrl && entry.status === 'cached') {
      return entry.blobUrl;
    }
    return resolved;
  }

  /**
   * Limpa todo o cache e revoga todas as Blob URLs
   */
  clearAll() {
    for (const entry of this.cache.values()) {
      if (entry.abortController) {
        entry.abortController.abort();
      }
      if (entry.blobUrl) {
        try {
          URL.revokeObjectURL(entry.blobUrl);
        } catch (e) {}
      }
    }
    this.cache.clear();
    this.trackedMedia.clear();
    this.activeWindow = [0, 0];
  }

  /**
   * Retorna estatísticas de telemetria e uso de memória do cache
   */
  getStats() {
    let totalBytes = 0;
    let cachedCount = 0;
    let fetchingCount = 0;

    for (const entry of this.cache.values()) {
      if (entry.status === 'cached') {
        cachedCount++;
        totalBytes += entry.size || 0;
      } else if (entry.status === 'fetching') {
        fetchingCount++;
      }
    }

    return {
      trackedSlides: this.trackedMedia.size,
      cachedItems: cachedCount,
      fetchingItems: fetchingCount,
      totalBytes,
      totalMB: (totalBytes / (1024 * 1024)).toFixed(2),
      activeWindow: this.activeWindow
    };
  }
}
