/**
 * SlideMeshLive — Motor de Extração e Conversão Semântica
 * Suporta Apresentações (.pptx), Documentos (.docx), Markdown (.md) e HTML (.html).
 * 
 * Extrai semanticamente:
 * - Títulos e Bullets para o Telão (com modo Split-Screen)
 * - Textos aprofundados e Tabelas para os Smartphones da plateia
 * - Notas do Orador para o Modo Púlpito
 * - Imagens e ativos embutidos para a pasta assets/
 */

// Helper universal de parsing XML compatível com Browser (DOMParser) e Node.js
function parseXmlSafe(xmlStr, type = 'application/xml') {
  if (typeof DOMParser !== 'undefined') {
    const parser = new DOMParser();
    return parser.parseFromString(xmlStr, type);
  }

  // Fallback leve para Node.js / CLI
  function createNode(tag, attrs = {}, text = '') {
    return {
      nodeName: tag,
      tagName: tag.toUpperCase(),
      textContent: text,
      attributes: attrs,
      children: [],
      getAttribute(name) { return attrs[name] || null; },
      querySelector(selector) {
        return this.querySelectorAll(selector)[0] || null;
      },
      querySelectorAll(selector) {
        const results = [];
        const selectors = selector.split(',').map(s => s.trim().replace(/\\/g, '').toLowerCase());

        function search(node) {
          if (!node) return;
          const nName = (node.nodeName || '').toLowerCase();
          const pStyleMatch = selectors.some(s => s.includes('pstyle')) && nName.includes('pstyle');
          const isMatch = selectors.some(s => 
            nName === s || 
            nName.endsWith(':' + s) || 
            nName.split(':').pop() === s
          ) || pStyleMatch;

          if (isMatch && node.nodeName !== 'root') {
            results.push(node);
          }
          if (node.children) {
            node.children.forEach(c => search(c));
          }
        }

        search(this);
        return results;
      }
    };
  }

  const root = createNode('root');
  const stack = [root];
  const tagRegex = /<([a-zA-Z0-9_:]+)([^>]*?)(\/?)>|([^<]+)|<\/([a-zA-Z0-9_:]+)>/g;
  let match;

  while ((match = tagRegex.exec(xmlStr)) !== null) {
    const [full, openTag, attrStr, selfClose, textContent, closeTag] = match;

    if (openTag) {
      const attrs = {};
      const attrRegex = /([a-zA-Z0-9_:]+)=["']([^"']*)["']/g;
      let aMatch;
      while ((aMatch = attrRegex.exec(attrStr || '')) !== null) {
        attrs[aMatch[1]] = aMatch[2];
      }

      const node = createNode(openTag, attrs);
      const parent = stack[stack.length - 1];
      parent.children.push(node);

      if (!selfClose && !full.endsWith('/>')) {
        stack.push(node);
      }
    } else if (closeTag) {
      if (stack.length > 1) stack.pop();
    } else if (textContent && textContent.trim()) {
      const parent = stack[stack.length - 1];
      parent.textContent = (parent.textContent || '') + textContent;
    }
  }

  return root;
}

export class ConversionEngine {
  constructor() {
    this.supportedExtensions = ['.pptx', '.docx', '.md', '.markdown', '.html', '.htm', '.pdf'];
  }

  detectFormat(filename) {
    const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();
    if (ext === '.pptx') return 'pptx';
    if (ext === '.docx') return 'docx';
    if (ext === '.md' || ext === '.markdown') return 'markdown';
    if (ext === '.html' || ext === '.htm') return 'html';
    if (ext === '.pdf') return 'pdf';
    return 'unknown';
  }

  async convert(fileOrData, filename = 'apresentacao.pptx') {
    const format = this.detectFormat(filename);
    const baseSlug = filename
      .replace(/\.[^/.]+$/, '')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'nova-apresentacao';

    let result = {
      manifest: {
        id: baseSlug,
        code: baseSlug.toUpperCase().slice(0, 14) + '-2026',
        title: this.formatTitleFromSlug(baseSlug),
        subtitle: 'Apresentação importada via conversor dinâmico',
        description: `Conteúdo convertido automaticamente a partir de ${filename}`,
        defaultSession: 'SES' + Math.floor(1000 + Math.random() * 9000),
        totalSlides: 0,
        securityMode: 'public',
        securityLabel: 'Pública',
        badgeClass: 'badge-accent',
        theme: {
          accentColor: '#38bdf8',
          background: '#0b0f19',
          transition: 'fade',
          transitionDuration: 380
        },
        security: {
          mode: 'public'
        },
        pacing: {
          mode: 'lock_future',
          allowReviewPast: true
        }
      },
      slides: [],
      assets: []
    };

    if (format === 'pptx') {
      result = await this.parsePptx(fileOrData, result);
    } else if (format === 'docx') {
      result = await this.parseDocx(fileOrData, result);
    } else if (format === 'markdown') {
      result = await this.parseMarkdown(fileOrData, result);
    } else if (format === 'html') {
      result = await this.parseHtml(fileOrData, result);
    } else if (format === 'pdf') {
      result = await this.parsePdf(fileOrData, result);
    } else {
      throw new Error(`Formato "${format}" não suportado pelo motor.`);
    }

    result.manifest.totalSlides = result.slides.length;
    return result;
  }

  formatTitleFromSlug(slug) {
    return slug
      .split('-')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  async getZipInstance() {
    if (typeof window !== 'undefined' && window.JSZip) {
      return window.JSZip;
    }
    if (typeof JSZip !== 'undefined') {
      return JSZip;
    }
    // Node.js import dinamico ou browser
    try {
      if (typeof require !== 'undefined') {
        return require('../lib/jszip.min.js');
      }
    } catch (e) {}

    if (typeof document !== 'undefined') {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = '/lib/jszip.min.js';
        script.onload = resolve;
        script.onerror = () => reject(new Error('Não foi possível carregar lib/jszip.min.js'));
        document.head.appendChild(script);
      });
      return window.JSZip;
    }
    throw new Error('Biblioteca JSZip não encontrada no escopo de execução.');
  }

  /* ==========================================================================
     PARSER APRESENTAÇÃO (.PPTX)
     ========================================================================== */
  async parsePptx(fileData, baseResult) {
    const JSZip = await this.getZipInstance();
    const zip = await JSZip.loadAsync(fileData);

    const slideFiles = Object.keys(zip.files)
      .filter(f => f.match(/^ppt\/slides\/slide\d+\.xml$/i))
      .sort((a, b) => {
        const numA = parseInt(a.match(/slide(\d+)\.xml/i)[1], 10);
        const numB = parseInt(b.match(/slide(\d+)\.xml/i)[1], 10);
        return numA - numB;
      });

    if (slideFiles.length === 0) {
      throw new Error('Nenhum slide válido encontrado dentro do arquivo PPTX.');
    }

    for (let index = 0; index < slideFiles.length; index++) {
      const slidePath = slideFiles[index];
      const slideNum = index + 1;
      const slideXmlStr = await zip.files[slidePath].async('string');
      const slideDoc = parseXmlSafe(slideXmlStr, 'application/xml');

      const paragraphs = [];
      const shapes = slideDoc.querySelectorAll('p:sp, sp');

      let slideTitle = '';
      const bullets = [];
      const allTextRuns = [];

      shapes.forEach(sp => {
        const isTitleShape = sp.querySelector('ph[type="title"], ph[type="ctrTitle"]') !== null;
        const pElements = sp.querySelectorAll('a:p, p');

        pElements.forEach(p => {
          const tElements = p.querySelectorAll('a:t, t');
          let paragraphText = '';
          tElements.forEach(t => paragraphText += t.textContent);
          paragraphText = paragraphText.trim();

          if (paragraphText) {
            allTextRuns.push(paragraphText);
            if (isTitleShape && !slideTitle) {
              slideTitle = paragraphText;
            } else if (!isTitleShape) {
              paragraphs.push(paragraphText);
            }
          }
        });
      });

      if (!slideTitle && allTextRuns.length > 0) {
        slideTitle = allTextRuns[0];
        paragraphs.shift();
      }

      slideTitle = slideTitle || `Slide ${slideNum}`;

      paragraphs.forEach(p => {
        if (p !== slideTitle && bullets.length < 5) {
          bullets.push(p);
        }
      });

      if (bullets.length === 0 && allTextRuns.length > 1) {
        bullets.push(...allTextRuns.slice(1, 4));
      }

      // Notas do Orador
      let notes = '';
      const notesRelPath = `ppt/slides/_rels/slide${slideNum}.xml.rels`;
      let notesSlidePath = `ppt/notesSlides/notesSlide${slideNum}.xml`;

      if (zip.files[notesRelPath]) {
        try {
          const relsStr = await zip.files[notesRelPath].async('string');
          const relsDoc = parseXmlSafe(relsStr, 'application/xml');
          const noteRel = relsDoc.querySelector('Relationship[Type*="notesSlide"]');
          if (noteRel) {
            const target = noteRel.getAttribute('Target');
            notesSlidePath = 'ppt/' + target.replace(/^\.\.\//, '');
          }
        } catch (e) {}
      }

      if (zip.files[notesSlidePath]) {
        try {
          const notesStr = await zip.files[notesSlidePath].async('string');
          const notesDoc = parseXmlSafe(notesStr, 'application/xml');
          const noteTexts = [];
          notesDoc.querySelectorAll('a:t, t').forEach(t => {
            const txt = t.textContent.trim();
            if (txt && !txt.match(/^\d+$/) && txt !== slideTitle) {
              noteTexts.push(txt);
            }
          });
          notes = noteTexts.join(' ');
        } catch (e) {}
      }

      // Imagens do Slide
      let mediaObj = null;
      if (zip.files[notesRelPath]) {
        try {
          const relsStr = await zip.files[notesRelPath].async('string');
          const relsDoc = parseXmlSafe(relsStr, 'application/xml');
          const imgRel = relsDoc.querySelector('Relationship[Type*="image"]');
          if (imgRel) {
            const imgTarget = imgRel.getAttribute('Target');
            const mediaZipPath = 'ppt/' + imgTarget.replace(/^\.\.\//, '');
            if (zip.files[mediaZipPath]) {
              const ext = mediaZipPath.slice(mediaZipPath.lastIndexOf('.')).toLowerCase();
              const mimeType = ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.svg' ? 'image/svg+xml' : 'image/png';
              const imgBase64 = await zip.files[mediaZipPath].async('base64');
              const dataUrl = `data:${mimeType};base64,${imgBase64}`;
              const assetFilename = `slide-${slideNum}-img${ext}`;

              mediaObj = {
                type: 'image',
                src: `assets/${assetFilename}`,
                alt: `Ilustração do Slide ${slideNum}`,
                dataBase64: dataUrl,
                filename: assetFilename
              };

              baseResult.assets.push({
                filename: assetFilename,
                dataBase64: dataUrl
              });
            }
          }
        } catch (e) {}
      }

      const slideEntry = {
        id: slideNum,
        slug: `slide-${slideNum}`,
        tag: `SEÇÃO ${slideNum}`,
        title: slideTitle,
        presenter: {
          headline: slideTitle,
          bullets: bullets.length > 0 ? bullets : ['Visualização de conteúdo extraído da apresentação'],
          notes: notes || 'Sem notas adicionais para este slide.'
        },
        audience: {
          summary: `Resumo do ${slideTitle}.`,
          sections: [
            {
              title: 'Conteúdo Detalhado',
              type: 'text',
              content: paragraphs.join('\n\n') || allTextRuns.join('\n\n') || 'Acompanhe a explicação do orador no telão.'
            }
          ]
        }
      };

      if (mediaObj) {
        slideEntry.presenter.media = {
          type: mediaObj.type,
          src: mediaObj.src,
          alt: mediaObj.alt
        };
        slideEntry.audience.sections.unshift({
          title: 'Ilustração do Slide',
          type: 'image',
          src: mediaObj.src,
          alt: mediaObj.alt
        });
      }

      baseResult.slides.push(slideEntry);
    }

    if (baseResult.slides.length > 0 && baseResult.slides[0].title) {
      baseResult.manifest.title = baseResult.slides[0].title;
    }

    return baseResult;
  }

  /* ==========================================================================
     PARSER DOCUMENTO (.DOCX)
     ========================================================================== */
  async parseDocx(fileData, baseResult) {
    const JSZip = await this.getZipInstance();
    const zip = await JSZip.loadAsync(fileData);

    const docXmlPath = 'word/document.xml';
    if (!zip.files[docXmlPath]) {
      throw new Error('Arquivo word/document.xml não encontrado no pacote DOCX.');
    }

    const docXmlStr = await zip.files[docXmlPath].async('string');
    const docXml = parseXmlSafe(docXmlStr, 'application/xml');

    const bodyChildren = docXml.querySelectorAll('w:p, w:tbl, p, tbl');
    const sections = [];
    let currentSection = {
      title: '',
      bullets: [],
      paragraphs: [],
      tables: [],
      images: []
    };

    bodyChildren.forEach(node => {
      const nodeName = (node.nodeName || '').replace(/^w:/i, '').toLowerCase();

      if (nodeName === 'p') {
        const pStyle = node.querySelector('w:pStyle, pStyle');
        const styleVal = pStyle ? pStyle.getAttribute('w:val') || pStyle.getAttribute('val') || '' : '';
        const isHeading = styleVal.match(/Heading1|Heading2|Titulo1|Titulo2|Title/i) !== null;
        const hasPageBreak = node.querySelector('w:br[w:type="page"], br[type="page"]') !== null;

        let pText = '';
        node.querySelectorAll('w:t, t').forEach(t => pText += t.textContent);
        pText = pText.trim();

        const isBullet = node.querySelector('w:numPr, numPr') !== null;

        if ((isHeading && pText) || (hasPageBreak && pText)) {
          if (currentSection.title || currentSection.paragraphs.length > 0) {
            sections.push(currentSection);
          }
          currentSection = {
            title: pText,
            bullets: [],
            paragraphs: [],
            tables: [],
            images: []
          };
        } else if (pText) {
          if (!currentSection.title) {
            currentSection.title = pText;
          } else if (isBullet) {
            currentSection.bullets.push(pText);
          } else {
            currentSection.paragraphs.push(pText);
          }
        }
      } else if (nodeName === 'tbl') {
        const rows = [];
        node.querySelectorAll('w:tr, tr').forEach(tr => {
          const cells = [];
          tr.querySelectorAll('w:tc, tc').forEach(tc => {
            let cellText = '';
            tc.querySelectorAll('w:t, t').forEach(t => cellText += t.textContent);
            cells.push(cellText.trim());
          });
          if (cells.length > 0) rows.push(cells);
        });

        if (rows.length > 0) {
          currentSection.tables.push({
            headers: rows[0],
            rows: rows.slice(1)
          });
        }
      }
    });

    if (currentSection.title || currentSection.paragraphs.length > 0) {
      sections.push(currentSection);
    }

    if (sections.length === 0) {
      throw new Error('Nenhum texto ou seção estruturada encontrada no arquivo Word.');
    }

    sections.forEach((sec, idx) => {
      const slideNum = idx + 1;
      const title = sec.title || `Seção ${slideNum}`;
      
      const bullets = sec.bullets.length > 0 
        ? sec.bullets.slice(0, 4)
        : sec.paragraphs.slice(0, 3);

      const audienceSections = [];

      if (sec.paragraphs.length > 0) {
        audienceSections.push({
          title: 'Texto da Seção',
          type: 'text',
          content: sec.paragraphs.join('\n\n')
        });
      }

      sec.tables.forEach((tbl, tIdx) => {
        audienceSections.push({
          title: `Tabela ${tIdx + 1}`,
          type: 'table',
          headers: tbl.headers,
          rows: tbl.rows
        });
      });

      baseResult.slides.push({
        id: slideNum,
        slug: `slide-${slideNum}`,
        tag: `SEÇÃO ${slideNum}`,
        title: title,
        presenter: {
          headline: title,
          bullets: bullets.length > 0 ? bullets : ['Acompanhe a leitura e os tópicos explicados no telão.'],
          notes: `Notas geradas a partir do documento Word: ${sec.paragraphs[0] || 'Sem notas.'}`
        },
        audience: {
          summary: `Resumo de ${title}.`,
          sections: audienceSections.length > 0 ? audienceSections : [
            {
              title: 'Conteúdo',
              type: 'text',
              content: 'Consulte as anotações completas nesta aba.'
            }
          ]
        }
      });
    });

    if (baseResult.slides.length > 0 && baseResult.slides[0].title) {
      baseResult.manifest.title = baseResult.slides[0].title;
    }

    return baseResult;
  }

  /* ==========================================================================
     PARSER MARKDOWN (.MD)
     ========================================================================== */
  async parseMarkdown(mdText, baseResult) {
    if (typeof mdText !== 'string') {
      const decoder = new TextDecoder('utf-8');
      mdText = decoder.decode(mdText);
    }

    let rawSlides = mdText.split(/\n---\n|\n\*\*\*\n|<section>/g);
    if (rawSlides.length <= 1) {
      rawSlides = mdText.split(/\n(?=# )/g);
    }

    rawSlides.forEach((slideRaw, idx) => {
      const slideNum = idx + 1;
      const lines = slideRaw.trim().split('\n');
      let title = '';
      const bullets = [];
      const paragraphs = [];
      let notes = '';

      lines.forEach(line => {
        const trimmed = line.trim();
        if (trimmed.startsWith('# ') && !title) {
          title = trimmed.replace(/^#\s+/, '').trim();
        } else if (trimmed.startsWith('## ') && !title) {
          title = trimmed.replace(/^##\s+/, '').trim();
        } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          bullets.push(trimmed.replace(/^[-*]\s+/, '').trim());
        } else if (trimmed.startsWith('<!-- note:') && trimmed.endsWith('-->')) {
          notes = trimmed.replace(/^<!--\s*note:\s*/, '').replace(/\s*-->$/, '').trim();
        } else if (trimmed && !trimmed.startsWith('#')) {
          paragraphs.push(trimmed);
        }
      });

      title = title || (paragraphs.length > 0 ? paragraphs[0] : `Slide ${slideNum}`);

      baseResult.slides.push({
        id: slideNum,
        slug: `slide-${slideNum}`,
        tag: `SEÇÃO ${slideNum}`,
        title: title,
        presenter: {
          headline: title,
          bullets: bullets.length > 0 ? bullets.slice(0, 4) : paragraphs.slice(0, 3),
          notes: notes || 'Sem notas adicionais.'
        },
        audience: {
          summary: `Resumo de ${title}.`,
          sections: [
            {
              title: 'Conteúdo Integral',
              type: 'text',
              content: paragraphs.join('\n\n') || bullets.join('\n') || 'Consulte o material projetado.'
            }
          ]
        }
      });
    });

    if (baseResult.slides.length > 0 && baseResult.slides[0].title) {
      baseResult.manifest.title = baseResult.slides[0].title;
    }

    return baseResult;
  }

  /* ==========================================================================
     PARSER HTML (.HTML)
     ========================================================================== */
  async parseHtml(htmlText, baseResult) {
    if (typeof htmlText !== 'string') {
      const decoder = new TextDecoder('utf-8');
      htmlText = decoder.decode(htmlText);
    }

    const doc = parseXmlSafe(htmlText, 'text/html');

    let sectionElements = doc.querySelectorAll('section, article');
    if (sectionElements.length === 0) {
      sectionElements = doc.querySelectorAll('h1, h2');
    }

    if (sectionElements.length === 0) {
      throw new Error('Nenhuma tag estruturada (<section>, <article>, <h1>) encontrada no HTML.');
    }

    sectionElements.forEach((sec, idx) => {
      const slideNum = idx + 1;
      const h1 = sec.querySelector('h1, h2, h3') || (sec.tagName && sec.tagName.match(/^H[1-6]$/i) ? sec : null);
      const title = h1 ? h1.textContent.trim() : `Slide ${slideNum}`;

      const bullets = [];
      sec.querySelectorAll('li').forEach(li => {
        if (bullets.length < 4) bullets.push(li.textContent.trim());
      });

      const paragraphs = [];
      sec.querySelectorAll('p').forEach(p => {
        paragraphs.push(p.textContent.trim());
      });

      baseResult.slides.push({
        id: slideNum,
        slug: `slide-${slideNum}`,
        tag: `SEÇÃO ${slideNum}`,
        title: title,
        presenter: {
          headline: title,
          bullets: bullets.length > 0 ? bullets : (paragraphs.length > 0 ? paragraphs.slice(0, 3) : ['Slide extraído de documento HTML']),
          notes: 'Acompanhe as notas no smartphone.'
        },
        audience: {
          summary: `Resumo de ${title}.`,
          sections: [
            {
              title: 'Conteúdo Detalhado',
              type: 'text',
              content: paragraphs.join('\n\n') || 'Visualização web.'
            }
          ]
        }
      });
    });

    if (baseResult.slides.length > 0 && baseResult.slides[0].title) {
      baseResult.manifest.title = baseResult.slides[0].title;
    }

    return baseResult;
  }

  /* ==========================================================================
     PARSER ADOBE PDF (.PDF)
     ========================================================================== */
  async parsePdf(fileData, baseResult) {
    let rawStr = '';
    if (typeof fileData === 'string') {
      rawStr = fileData;
    } else {
      const bytes = new Uint8Array(fileData);
      let binary = '';
      const len = bytes.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      rawStr = binary;
    }

    const pageStreams = [];
    const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
    let sMatch;
    while ((sMatch = streamRegex.exec(rawStr)) !== null) {
      pageStreams.push(sMatch[1]);
    }

    const pagesText = [];
    if (pageStreams.length === 0) {
      pageStreams.push(rawStr);
    }

    for (let stream of pageStreams) {
      const textTokens = [];
      const textOpRegex = /\(([^)]+)\)\s*(?:Tj|'|")|\[((?:\([^)]*\)|[^\]])+)\]\s*TJ/g;
      let tMatch;
      while ((tMatch = textOpRegex.exec(stream)) !== null) {
        if (tMatch[1]) {
          textTokens.push(tMatch[1]);
        } else if (tMatch[2]) {
          const innerMatches = tMatch[2].match(/\(([^)]+)\)/g);
          if (innerMatches) {
            innerMatches.forEach(m => textTokens.push(m.slice(1, -1)));
          }
        }
      }

      const fullText = textTokens
        .join(' ')
        .replace(/\\([0-9]{3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)))
        .replace(/\\([()\\])/g, '$1')
        .replace(/\s+/g, ' ')
        .trim();

      if (fullText.length > 5) {
        pagesText.push(fullText);
      }
    }

    if (pagesText.length === 0) {
      const literalStrings = [];
      const litRegex = /\(([^)]+)\)/g;
      let lMatch;
      while ((lMatch = litRegex.exec(rawStr)) !== null) {
        const cleaned = lMatch[1].trim();
        if (cleaned.length > 3 && !cleaned.includes('CreationDate') && !cleaned.includes('Producer')) {
          literalStrings.push(cleaned);
        }
      }
      if (literalStrings.length > 0) {
        pagesText.push(literalStrings.join(' '));
      }
    }

    if (pagesText.length === 0) {
      throw new Error('Não foi possível extrair textos legíveis do arquivo PDF.');
    }

    pagesText.forEach((pText, idx) => {
      const slideNum = idx + 1;
      const sentences = pText.split(/(?<=[.!?])\s+|\n+/).map(s => s.trim()).filter(s => s.length > 0);
      const title = sentences[0] || `Página ${slideNum}`;
      const bullets = sentences.slice(1, 5);

      baseResult.slides.push({
        id: slideNum,
        slug: `slide-${slideNum}`,
        tag: `PÁGINA ${slideNum}`,
        title: title,
        presenter: {
          headline: title,
          bullets: bullets.length > 0 ? bullets : ['Acompanhe a leitura e os tópicos explicados no telão.'],
          notes: `Conteúdo extraído da página ${slideNum} do documento PDF.`
        },
        audience: {
          summary: `Resumo da página ${slideNum}.`,
          sections: [
            {
              title: 'Texto da Página',
              type: 'text',
              content: pText
            }
          ]
        }
      });
    });

    if (baseResult.slides.length > 0 && baseResult.slides[0].title) {
      baseResult.manifest.title = baseResult.slides[0].title;
    }

    return baseResult;
  }

  /* ==========================================================================
     GERADOR DE TEMPLATES PRÉ-FABRICADOS (CRIAÇÃO DO ZERO)
     ========================================================================== */
  getTemplate(type = 'executive') {
    const defaultManifest = {
      id: `apresentacao-${type}-${Date.now().toString().slice(-4)}`,
      code: `${type.toUpperCase()}-2026`,
      title: 'Nova Apresentação Interativa',
      subtitle: 'Criada no SlideMesh Studio',
      description: 'Apresentação com sincronização em tempo real para telão e smartphones.',
      defaultSession: `SES${Math.floor(1000 + Math.random() * 9000)}`,
      totalSlides: 0,
      securityMode: 'public',
      securityLabel: 'Pública',
      badgeClass: 'badge-accent',
      theme: { accentColor: '#38bdf8', background: '#0b0f19', transition: 'fade', transitionDuration: 380 },
      security: { mode: 'public' },
      pacing: { mode: 'lock_future', allowReviewPast: true }
    };

    let slides = [];

    if (type === 'executive') {
      defaultManifest.title = 'Apresentação Executiva & Estratégica';
      defaultManifest.subtitle = 'Proposta de Valor, Diferenciais e Próximos Passos';
      slides = [
        {
          id: 1,
          slug: 'slide-1',
          tag: 'VISÃO GERAL',
          title: 'Apresentação Executiva & Estratégica',
          included: true,
          presenter: {
            headline: 'Apresentação Executiva & Estratégica',
            bullets: [
              'Contexto de mercado e posicionamento competitivo',
              'Oportunidade de expansão e ganhos de eficiência',
              'Acompanhe o material detalhado pelo celular'
            ],
            notes: 'Abertura: agradecer a presença de todos e convidar a apontar a câmera para o QR Code.'
          },
          audience: {
            summary: 'Síntese executiva dos objetivos e escopo estratégico da apresentação.',
            sections: [
              {
                title: 'Contexto Estratégico',
                type: 'text',
                content: 'Neste encontro apresentaremos as diretrizes prioritárias de crescimento e inovação para o próximo ciclo operacional.'
              }
            ]
          }
        },
        {
          id: 2,
          slug: 'slide-2',
          tag: 'DESAFIO',
          title: 'O Cenário Atual e os Principais Desafios',
          included: true,
          presenter: {
            headline: 'O Cenário Atual e os Principais Desafios',
            bullets: [
              'Processos manuais e lentidão operacional',
              'Falta de visibilidade centralizada em tempo real',
              'Custos crescentes com ferramentas legadas'
            ],
            notes: 'Enfatizar as dores mais sentidas pela equipe e o impacto direto nos resultados.'
          },
          audience: {
            summary: 'Diagnóstico das restrições e gargalos identificados na operação.',
            sections: [
              {
                title: 'Detalhamento dos Gargalos',
                type: 'text',
                content: 'A fragmentação de ferramentas causa retrabalho e dificulta o alinhamento entre as áreas de negócio e tecnologia.'
              }
            ]
          }
        },
        {
          id: 3,
          slug: 'slide-3',
          tag: 'SOLUÇÃO',
          title: 'Nossa Proposta de Valor e Diferenciais',
          included: true,
          presenter: {
            headline: 'Nossa Proposta de Valor e Diferenciais',
            bullets: [
              'Arquitetura unificada e sincronização instantânea',
              'Operação 100% resiliente em rede local sem dependência externa',
              'Redução de até 40% no tempo de ciclo operacional'
            ],
            notes: 'Apresentar os diferenciais competitivos e a simplicidade de adoção.'
          },
          audience: {
            summary: 'Pilares arquiteturais e ganhos tangíveis com a nova abordagem.',
            sections: [
              {
                title: 'Pilares de Transformação',
                type: 'text',
                content: 'A integração fluida entre dispositivos garante engajamento da equipe e decisões baseadas em dados em tempo real.'
              }
            ]
          }
        },
        {
          id: 4,
          slug: 'slide-4',
          tag: 'INTERAÇÃO AO VIVO',
          title: 'Qual área deve ser priorizada no projeto piloto?',
          included: true,
          presenter: {
            headline: 'Qual área deve ser priorizada no projeto piloto?',
            bullets: [
              'Vote agora pelo seu smartphone',
              'Os resultados serão projetados instantaneamente no telão',
              'Participe para definir o cronograma da primeira fase'
            ],
            notes: 'Pressionar a tecla [V] para abrir a votação e [R] para revelar o gráfico animado de resultados.'
          },
          interaction: {
            poll: {
              id: 'poll-prioridade-piloto',
              question: 'Qual área deve ser priorizada no projeto piloto?',
              options: [
                { id: 'A', text: 'Operações e Logística' },
                { id: 'B', text: 'Engenharia e Infraestrutura' },
                { id: 'C', text: 'Atendimento ao Cliente' },
                { id: 'D', text: 'Gestão e Controladoria' }
              ]
            }
          },
          audience: {
            summary: 'Selecione a opção desejada para votar ao vivo.',
            sections: [
              {
                title: 'Critérios de Escolha',
                type: 'text',
                content: 'Considere o retorno sobre o investimento e o tempo de implementação ao votar.'
              }
            ]
          }
        },
        {
          id: 5,
          slug: 'slide-5',
          tag: 'PRÓXIMOS PASSOS',
          title: 'Plano de Ação e Próximos Passos',
          included: true,
          presenter: {
            headline: 'Plano de Ação e Próximos Passos',
            bullets: [
              'Semana 1-2: Alinhamento e homologação do ambiente piloto',
              'Semana 3-4: Treinamento prático e go-live inicial',
              'Envie suas dúvidas no botão Perguntar do celular'
            ],
            notes: 'Conclusão: abrir o mural de perguntas com a tecla [M] para responder aos participantes.'
          },
          audience: {
            summary: 'Cronograma de entregas e canais de comunicação.',
            sections: [
              {
                title: 'Contato e Suporte',
                type: 'text',
                content: 'Dúvidas podem ser enviadas diretamente pelo botão Perguntar no rodapé da tela.'
              }
            ]
          }
        }
      ];
    } else if (type === 'training') {
      defaultManifest.title = 'Treinamento Técnico & Capacitação';
      defaultManifest.subtitle = 'Conceitos Fundamentais, Laboratório e Quiz de Fixação';
      slides = [
        {
          id: 1,
          slug: 'slide-1',
          tag: 'AULA 1',
          title: 'Treinamento Técnico & Capacitação',
          included: true,
          presenter: {
            headline: 'Treinamento Técnico & Capacitação',
            bullets: [
              'Objetivos pedagógicos e competências da sessão',
              'Acesso ao material didático interativo pelo celular',
              'Quiz prático ao final para fixação'
            ],
            notes: 'Apresentação do instrutor e orientações iniciais.'
          },
          audience: {
            summary: 'Guia do aluno com anotações e exercícios.',
            sections: [
              {
                title: 'Ementa do Treinamento',
                type: 'text',
                content: 'Capacitação prática com foco em metodologias ágeis e arquiteturas modernas.'
              }
            ]
          }
        },
        {
          id: 2,
          slug: 'slide-2',
          tag: 'CONCEITOS',
          title: 'Fundamentos de Arquitetura e Protocolos',
          included: true,
          presenter: {
            headline: 'Fundamentos de Arquitetura e Protocolos',
            bullets: [
              'Comunicação bidirecional e isolamento de canais',
              'Sincronização de relógio e sequenciamento de eventos',
              'Mecanismos de fallback e tolerância a falhas'
            ],
            notes: 'Explicar a importância da baixa latência em eventos de missão crítica.'
          },
          audience: {
            summary: 'Resumo teórico dos padrões e fluxos de dados.',
            sections: [
              {
                title: 'Notas de Estudo',
                type: 'text',
                content: 'A integridade dos pacotes é assegurada por validação de integridade nos hubs de sincronização.'
              }
            ]
          }
        },
        {
          id: 3,
          slug: 'slide-3',
          tag: 'QUIZ INTERATIVO',
          title: 'Quiz: Qual é a principal vantagem de operar em rede local?',
          included: true,
          presenter: {
            headline: 'Quiz: Qual é a principal vantagem de operar em rede local?',
            bullets: [
              'Responda no seu smartphone em 30 segundos',
              'Teste seus conhecimentos sem sair do lugar',
              'Acompanhe o ranking da turma no telão'
            ],
            notes: 'Iniciar o quiz e comentar as respostas com o grupo.'
          },
          interaction: {
            poll: {
              id: 'poll-quiz-tecnico',
              question: 'Qual é a principal vantagem de operar em rede local?',
              options: [
                { id: 'A', text: 'Independência total de internet e nuvem externa' },
                { id: 'B', text: 'Maior custo de licenciamento' },
                { id: 'C', text: 'Necessidade de servidores pesados' },
                { id: 'D', text: 'Apenas para computadores antigos' }
              ]
            }
          },
          audience: {
            summary: 'Responda ao quiz selecionando a alternativa correta.',
            sections: [
              {
                title: 'Dica do Instrutor',
                type: 'text',
                content: 'Lembre-se do que discutimos sobre resiliência em auditórios sem sinal Wi-Fi externo.'
              }
            ]
          }
        },
        {
          id: 4,
          slug: 'slide-4',
          tag: 'CONCLUSÃO',
          title: 'Encerramento e Próximos Módulos',
          included: true,
          presenter: {
            headline: 'Encerramento e Próximos Módulos',
            bullets: [
              'Parabéns pela conclusão do módulo!',
              'Consulte o resumo das anotações no celular',
              'Espaço aberto para dúvidas e feedback'
            ],
            notes: 'Agradecer a participação e responder às perguntas enviadas na mesa técnica.'
          },
          audience: {
            summary: 'Certificado de participação e material complementar.',
            sections: [
              {
                title: 'Recursos Adicionais',
                type: 'text',
                content: 'Consulte a documentação completa no portal SlideMeshLive para continuar aprendendo.'
              }
            ]
          }
        }
      ];
    } else if (type === 'product') {
      defaultManifest.title = 'Demonstração de Produto & Lançamento';
      defaultManifest.subtitle = 'Recursos Inovadores, Experiência ao Vivo e Feedback';
      slides = [
        {
          id: 1,
          slug: 'slide-1',
          tag: 'LANÇAMENTO',
          title: 'Apresentamos a Nova Geração do Produto',
          included: true,
          presenter: {
            headline: 'Apresentamos a Nova Geração do Produto',
            bullets: [
              'Interface redesenhada com foco em produtividade',
              'Performance até 3x mais veloz',
              'Experiência sincronizada para palestrantes e audiência'
            ],
            notes: 'Abertura empolgante com foco em inovação e facilidade de uso.'
          },
          audience: {
            summary: 'Visão geral do novo lançamento e principais novidades.',
            sections: [
              {
                title: 'Visão Geral do Produto',
                type: 'text',
                content: 'Construído do zero para oferecer simplicidade, rapidez e elegância em todas as etapas.'
              }
            ]
          }
        },
        {
          id: 2,
          slug: 'slide-2',
          tag: 'RECURSOS',
          title: 'Principais Recursos & Inovações',
          included: true,
          presenter: {
            headline: 'Principais Recursos & Inovações',
            bullets: [
              'Design System com 4 temas modernos (Dark, Light, Slate, High Contrast)',
              'Modo Púlpito com notas privadas para o palestrante',
              'Importação em 1 clique de PPTX, Word e Markdown'
            ],
            notes: 'Demonstrar na prática a alternância de temas e o modo tela cheia.'
          },
          audience: {
            summary: 'Especificações técnicas e compatibilidade de plataformas.',
            sections: [
              {
                title: 'Destaques de Engenharia',
                type: 'text',
                content: 'Compatível com qualquer navegador moderno sem necessidade de instalar extensões.'
              }
            ]
          }
        },
        {
          id: 3,
          slug: 'slide-3',
          tag: 'OPINIÃO AO VIVO',
          title: 'Qual recurso você achou mais impactante?',
          included: true,
          presenter: {
            headline: 'Qual recurso você achou mais impactante?',
            bullets: [
              'Sua opinião direciona nosso roadmap de evolução',
              'Vote agora pelo celular',
              'Veja os votos subindo em tempo real no telão'
            ],
            notes: 'Estimular a plateia a votar e comentar as preferências mais populares.'
          },
          interaction: {
            poll: {
              id: 'poll-recurso-favorito',
              question: 'Qual recurso você achou mais impactante?',
              options: [
                { id: 'A', text: 'Sincronização offline instantânea' },
                { id: 'B', text: 'Modo Split-Screen e Púlpito' },
                { id: 'C', text: 'Enquetes interativas ao vivo' },
                { id: 'D', text: 'Importador dinâmico de PPTX e Word' }
              ]
            }
          },
          audience: {
            summary: 'Vote no recurso que você mais gostou.',
            sections: [
              {
                title: 'Sua Opinião Importa',
                type: 'text',
                content: 'O recurso mais votado receberá prioridade de expansão nas próximas atualizações.'
              }
            ]
          }
        },
        {
          id: 4,
          slug: 'slide-4',
          tag: 'FECHAMENTO',
          title: 'Experimente Hoje Mesmo e Crie Sua Apresentação',
          included: true,
          presenter: {
            headline: 'Experimente Hoje Mesmo e Crie Sua Apresentação',
            bullets: [
              '100% gratuito e de código aberto no GitHub',
              'Inicie em menos de 1 minuto em qualquer computador',
              'Obrigado pela presença!'
            ],
            notes: 'Finalizar com agradecimentos e convite para testar a ferramenta.'
          },
          audience: {
            summary: 'Links para download, documentação e comunidade.',
            sections: [
              {
                title: 'Comece Agora',
                type: 'text',
                content: 'Acesse o repositório oficial no GitHub para clonar o projeto e criar suas apresentações.'
              }
            ]
          }
        }
      ];
    } else if (type === 'blank') {
      // Template em Branco
      defaultManifest.title = 'Minha Nova Apresentação';
      defaultManifest.subtitle = 'Criada no SlideMeshLive';
      slides = [
        {
          id: 1,
          slug: 'slide-1',
          tag: 'SEÇÃO 1',
          title: 'Título do Primeiro Slide',
          included: true,
          presenter: {
            headline: 'Título do Primeiro Slide',
            bullets: [
              'Adicione aqui os tópicos que serão projetados no telão',
              'Clique em "+ Novo Marcador" para incluir mais pontos'
            ],
            notes: 'Notas e anotações privadas do orador para este slide.'
          },
          audience: {
            summary: 'Resumo deste slide para o smartphone do público.',
            sections: [
              {
                title: 'Conteúdo Detalhado',
                type: 'text',
                content: 'Texto explicativo completo que os participantes poderão ler em seus celulares.'
              }
            ]
          }
        }
      ];
    }

    defaultManifest.totalSlides = slides.length;
    return {
      manifest: defaultManifest,
      slides: slides,
      assets: []
    };
  }
}

export const conversionEngine = new ConversionEngine();

