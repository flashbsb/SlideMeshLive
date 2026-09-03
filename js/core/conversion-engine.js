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
  getTemplate(type = 'pitch') {
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
      theme: { accentColor: '#38bdf8', background: '#0b0f19', font: 'outfit', gradient: 'cyber', transition: 'fade', transitionDuration: 380 },
      security: { mode: 'public' },
      pacing: { mode: 'lock_future', allowReviewPast: true }
    };

    let slides = [];

    if (type === 'pitch' || type === 'startup') {
      defaultManifest.title = 'Pitch Deck & Produto Inovador';
      defaultManifest.subtitle = 'Visão, Tração, Arquitetura e Rodada de Captação';
      defaultManifest.theme = { accentColor: '#38bdf8', background: '#0b0f19', font: 'outfit', gradient: 'cyber', transition: 'fade', transitionDuration: 380 };
      slides = [
        {
          id: 1,
          slug: 'slide-1',
          tag: 'PITCH DECK 2026',
          title: 'A Nova Fronteira das Apresentações em Tempo Real',
          layout: 'hero',
          font: 'outfit',
          background: 'cyber',
          hero: {
            title: 'SlideMesh: O Futuro do Palco',
            subtitle: 'Engajamento instantâneo, zero latência e sincronização nativa com os celulares da plateia.',
            badges: [
              { text: '⚡ Ultra Baixa Latência', class: 'badge-live' },
              { text: '🔒 100% Offline / Rede Local', class: 'badge-accent' },
              { text: '📱 Zero Apps Instalados', class: 'badge-success' }
            ]
          },
          included: true,
          presenter: {
            headline: 'SlideMesh: O Futuro do Palco',
            bullets: [
              'Revolução da experiência de apresentações ao vivo',
              'Sincronização bidirecional entre telão e plateia',
              'Operação 100% autônoma em rede local sem dependência de internet'
            ],
            notes: 'Abertura de impacto: convidar a audiência a escanear o QR Code para acompanhar em tempo real.'
          },
          audience: {
            summary: 'Pitch oficial da plataforma SlideMeshLive para investidores e clientes.',
            sections: [
              {
                title: 'Nossa Tese de Investimento',
                type: 'text',
                content: 'Transformamos apresentações estáticas e monótonas em palcos interativos sincronizados em tempo real com smartphones.'
              }
            ]
          }
        },
        {
          id: 2,
          slug: 'slide-2',
          tag: 'ECOSSISTEMA',
          title: 'Grid de Capacidades e Diferenciais do Produto',
          layout: 'bento',
          font: 'outfit',
          background: 'cyber',
          bento: {
            cards: [
              {
                icon: '⚡',
                title: 'Motor de Sincronização em Tempo Real',
                desc: 'Latência sub-50ms via WebSockets e fallback determinístico para HTTP Long-Polling.',
                cols: 8,
                highlight: true,
                stat: '< 50ms'
              },
              {
                icon: '🔒',
                title: 'Soberania Local',
                desc: 'Funciona perfeitamente em auditórios sem sinal de internet externa.',
                cols: 4,
                stat: '100% Offline'
              },
              {
                icon: '📊',
                title: 'Enquetes & Votação Instantânea',
                desc: 'Gráficos projetados no telão com atualização ao vivo a cada voto.',
                cols: 4,
                stat: '1 Voto/Pessoa'
              },
              {
                icon: '🎨',
                title: 'SlideMesh Studio Integrado',
                desc: 'Importação com 1 clique de arquivos PowerPoint (.pptx), Word (.docx) e Markdown (.md).',
                cols: 8
              }
            ]
          },
          included: true,
          presenter: {
            headline: 'Grid de Capacidades e Diferenciais do Produto',
            bullets: [
              'Arquitetura modular de alta disponibilidade',
              'Controle total pelo palestrante e moderação ao vivo',
              'Design responsivo sem dependência de apps'
            ],
            notes: 'Destacar o Bento Grid na tela com foco na velocidade de sincronização.'
          },
          audience: {
            summary: 'Matriz de recursos e diferenciais tecnológicos da plataforma.',
            sections: [
              {
                title: 'Arquitetura de Alta Performance',
                type: 'text',
                content: 'Desenvolvido sobre uma pilha web moderna e leve que dispensa instalação de aplicativos no celular.'
              }
            ]
          }
        },
        {
          id: 3,
          slug: 'slide-3',
          tag: 'TRAÇÃO & MÉTRICAS',
          title: 'Crescimento e Validação de Mercado',
          layout: 'metric',
          font: 'outfit',
          background: 'cyber',
          metric: {
            value: '+380%',
            label: 'Aumento de Engajamento e Participação da Plateia',
            subtitle: 'Resultados médios obtidos em conferências e grandes eventos corporativos.',
            delta: '+14.2k Votos em 2026',
            pillars: [
              { label: 'Eventos Realizados', value: '450+' },
              { label: 'Satisfação do Público', value: '99.4%' },
              { label: 'Tempo Médio Resposta', value: '1.2s' }
            ]
          },
          included: true,
          presenter: {
            headline: 'Crescimento e Validação de Mercado',
            bullets: [
              'Adoção comprovada em grandes palcos e auditórios',
              'Retenção de atenção 4x superior a slides tradicionais',
              'Geração de dados em tempo real para organizadores'
            ],
            notes: 'Enfatizar a métrica monumental de +380% e os números de validação.'
          },
          audience: {
            summary: 'Indicadores-chave de desempenho e validação em eventos.',
            sections: [
              {
                title: 'Indicadores de Engajamento',
                type: 'text',
                content: 'Participantes interagem em média 6 vezes mais através de perguntas e enquetes do que em palestras comuns.'
              }
            ]
          }
        },
        {
          id: 4,
          slug: 'slide-4',
          tag: 'ROADMAP',
          title: 'Plano de Expansão & Próximas Entregas',
          layout: 'timeline',
          font: 'outfit',
          background: 'cyber',
          timeline: {
            steps: [
              { step: 'Q1', title: 'Motor de Mídia & Estúdio Visual', desc: 'Importador dinâmico de PPTX e layouts ricos bento.' },
              { step: 'Q2', title: 'Moderação de IA', desc: 'Clusterização automática de dúvidas da plateia por tema.' },
              { step: 'Q3', title: 'Expansão Enterprise', desc: 'Multi-Auth RBAC e federação com credenciais corporativas.' },
              { step: 'Q4', title: 'Ecossistema Global', desc: 'Marketplace de templates e integrações com Zoom/Teams.' }
            ]
          },
          included: true,
          presenter: {
            headline: 'Plano de Expansão & Próximas Entregas',
            bullets: [
              'Roadmap executivo com metas claras e tangíveis',
              'Evolução contínua orientada a feedback da comunidade',
              'Acompanhe o cronograma detalhado no smartphone'
            ],
            notes: 'Apresentar a linha do tempo e abrir para perguntas dos investidores.'
          },
          audience: {
            summary: 'Cronograma detalhado de desenvolvimento e marcos estratégicos.',
            sections: [
              {
                title: 'Marcos de Engenharia',
                type: 'text',
                content: 'Todas as entregas seguem ciclos ágeis com testes automatizados e 100% de cobertura funcional.'
              }
            ]
          }
        },
        {
          id: 5,
          slug: 'slide-5',
          tag: 'DECISÃO AO VIVO',
          title: 'Em qual módulo devemos acelerar novos investimentos?',
          included: true,
          presenter: {
            headline: 'Em qual módulo devemos acelerar novos investimentos?',
            bullets: [
              'Participe da votação em tempo real pelo seu celular',
              'Resultados computados e projetados instantaneamente',
              'Sua decisão direciona as prioridades do próximo ciclo'
            ],
            notes: 'Pressionar [V] para abrir votação e [R] para exibir o ranking animado de votos.'
          },
          interaction: {
            poll: {
              id: 'poll-investimento-pitch',
              question: 'Em qual módulo devemos acelerar novos investimentos?',
              options: [
                { id: 'A', text: 'Inteligência Artificial para Perguntas' },
                { id: 'B', text: 'Mais Layouts & Templates Visuais' },
                { id: 'C', text: 'Segurança & Governança Enterprise' },
                { id: 'D', text: 'Integrações com Streaming e Vídeo' }
              ]
            }
          },
          audience: {
            summary: 'Selecione sua prioridade estratégica para votar ao vivo.',
            sections: [
              {
                title: 'Votação Interativa',
                type: 'text',
                content: 'Escolha uma das alternativas acima para registrar o seu voto no hub central.'
              }
            ]
          }
        }
      ];
    } else if (type === 'masterclass' || type === 'code' || type === 'tech') {
      defaultManifest.title = 'Masterclass Técnica: Arquitetura & Engenharia';
      defaultManifest.subtitle = 'Padrões Modernos, Código de Alta Performance e Resiliência';
      defaultManifest.theme = { accentColor: '#10b981', background: '#0b0f19', font: 'code', gradient: 'aurora', transition: 'fade', transitionDuration: 380 };
      slides = [
        {
          id: 1,
          slug: 'slide-1',
          tag: 'TECH MASTERCLASS',
          title: 'Engenharia de Software para Palcos de Missão Crítica',
          layout: 'hero',
          font: 'code',
          background: 'aurora',
          hero: {
            title: 'Masterclass: Engenharia Sem Falhas',
            subtitle: 'Como construir sistemas síncronos de ultra baixa latência que operam 100% offline em redes locais.',
            badges: [
              { text: '🐍 Python Hub + HTTP/WS', class: 'badge-live' },
              { text: '⚡ Zero Dependency Frontend', class: 'badge-accent' },
              { text: '🛡️ Multi-Auth Gatekeeper', class: 'badge-success' }
            ]
          },
          included: true,
          presenter: {
            headline: 'Masterclass: Engenharia Sem Falhas',
            bullets: [
              'Visão aprofundada dos desafios de rede em auditórios reais',
              'Padrões arquiteturais para tolerância a falhas e desconexões',
              'Acesse o código-fonte e diagramas diretamente no celular'
            ],
            notes: 'Abertura técnica: explicar a motivação de rodar localmente sem nuvem.'
          },
          audience: {
            summary: 'Material de apoio para desenvolvedores e arquitetos de software.',
            sections: [
              {
                title: 'Ementa da Masterclass',
                type: 'text',
                content: 'Exploraremos o motor de eventos assíncrono, estratégias de anti-flooding, sanitização XSS e transições sem flicker.'
              }
            ]
          }
        },
        {
          id: 2,
          slug: 'slide-2',
          tag: 'CÓDIGO DE SERVIDOR',
          title: 'Servidor HTTP/WS Sequencial em Python',
          layout: 'code',
          font: 'code',
          background: 'aurora',
          code: {
            filename: 'server.py — Hub de Sincronização',
            snippet: `class SlideMeshHub(ThreadingHTTPServer):\n    def handle_slide_event(self, session_id, slide_idx):\n        # Emissão thread-safe com carimbo temporal\n        event_payload = {\n            "type": "SLIDE_CHANGED",\n            "slideIndex": slide_idx,\n            "timestamp": time.time()\n        }\n        self.broadcast_to_session(session_id, event_payload)\n        return {"status": "ok", "latency_ms": 1.4}`
          },
          included: true,
          presenter: {
            headline: 'Servidor HTTP/WS Sequencial em Python',
            bullets: [
              'Manipulação thread-safe de sessões simultâneas',
              'Sequenciador de eventos com broadcast determinístico',
              'Desempenho sub-milissegundo para centenas de celulares'
            ],
            notes: 'Explicar a lógica de broadcast na classe SlideMeshHub.'
          },
          audience: {
            summary: 'Código-fonte e explicação técnica do endpoint central.',
            sections: [
              {
                title: 'Threading & Concorrência',
                type: 'text',
                content: 'O servidor utiliza buffers atômicos e locks de baixo atrito para garantir que mensagens cheguem em ordem estrita.'
              }
            ]
          }
        },
        {
          id: 3,
          slug: 'slide-3',
          tag: 'PADRÕES ARQUITETURAIS',
          title: '3 Pilares da Resiliência em Rede Local',
          layout: 'columns',
          font: 'code',
          background: 'aurora',
          columns: {
            items: [
              {
                icon: '🛰️',
                title: 'Broadcast Local',
                bullets: [
                  'WebSockets nativos com fallback HTTP',
                  'Descoberta mDNS em redes corporativas',
                  'Reconexão com backoff exponencial'
                ]
              },
              {
                icon: '🛡️',
                title: 'Blindagem de Segurança',
                bullets: [
                  'Sanitização estrita contra XSS',
                  'Rate-limiting anti-flooding em RAM',
                  'Proteção Multi-Auth (PIN, Senha, Token)'
                ]
              },
              {
                icon: '⚡',
                title: 'Performance Zero-JS-Fat',
                bullets: [
                  'Vanilla JS e CSS sem frameworks pesados',
                  'Janela deslizante de pré-cache de mídias',
                  'Renderização 60fps com GPU Acceleration'
                ]
              }
            ]
          },
          included: true,
          presenter: {
            headline: '3 Pilares da Resiliência em Rede Local',
            bullets: [
              'Conexão robusta imune a quedas de link externo',
              'Segurança em camadas contra ataques no auditório',
              'Carregamento instantâneo em qualquer smartphone antigo'
            ],
            notes: 'Comentar cada pilar com a turma.'
          },
          audience: {
            summary: 'Pilares arquiteturais recomendados para aplicações de palco.',
            sections: [
              {
                title: 'Checklist de Implementação',
                type: 'text',
                content: 'Sempre combine rate limiting com validação de payload no servidor para evitar negação de serviço.'
              }
            ]
          }
        },
        {
          id: 4,
          slug: 'slide-4',
          tag: 'SLA DE PERFORMANCE',
          title: 'Confiabilidade e Métricas de Disponibilidade',
          layout: 'metric',
          font: 'code',
          background: 'aurora',
          metric: {
            value: '99.999%',
            label: 'Taxa de Entrega de Eventos em Auditórios',
            subtitle: 'Testado sob estresse com 500 conexões concorrentes gerando mais de 5.000 requisições/min.',
            delta: 'SLA < 2ms',
            pillars: [
              { label: 'Uso de CPU', value: '< 4%' },
              { label: 'Consumo RAM', value: '42 MB' },
              { label: 'Queda de Pacotes', value: '0.00%' }
            ]
          },
          included: true,
          presenter: {
            headline: 'Confiabilidade e Métricas de Disponibilidade',
            bullets: [
              'Consumo insignificante de recursos na máquina do palestrante',
              'Zero dependência de serviços externos em nuvem',
              'Garantia de estabilidade do primeiro ao último slide'
            ],
            notes: 'Apresentar as métricas de performance.'
          },
          audience: {
            summary: 'Resultados dos testes de estresse e benchmarking.',
            sections: [
              {
                title: 'Dados de Benchmark',
                type: 'text',
                content: 'Testes realizados com Apache Benchmark e ferramentas de injeção de carga confirmam estabilidade extrema.'
              }
            ]
          }
        },
        {
          id: 5,
          slug: 'slide-5',
          tag: 'QUIZ TÉCNICO',
          title: 'Qual mecanismo garante menor consumo de bateria no celular do público?',
          included: true,
          presenter: {
            headline: 'Qual mecanismo garante menor consumo de bateria no celular do público?',
            bullets: [
              'Responda no seu smartphone em 30 segundos',
              'Teste seus conhecimentos de engenharia web',
              'Acompanhe o ranking da turma ao vivo'
            ],
            notes: 'Iniciar o quiz técnico e debater as alternativas com os alunos.'
          },
          interaction: {
            poll: {
              id: 'poll-quiz-tech',
              question: 'Qual mecanismo garante menor consumo de bateria no celular do público?',
              options: [
                { id: 'A', text: 'WebSockets com Heartbeat passivo e CSS nativo sem loops JS' },
                { id: 'B', text: 'Polling HTTP contínuo a cada 10ms' },
                { id: 'C', text: 'Download repetido de todo o HTML a cada frame' },
                { id: 'D', text: 'Renderização em WebGL 3D em background' }
              ]
            }
          },
          audience: {
            summary: 'Quiz de fixação da aula técnica.',
            sections: [
              {
                title: 'Dica do Instrutor',
                type: 'text',
                content: 'Lembre-se do impacto de polling constante em conexões móveis.'
              }
            ]
          }
        }
      ];
    } else if (type === 'vision' || type === 'executive' || type === 'executive-vision') {
      defaultManifest.title = 'Visão Executiva & Estratégia Corporativa';
      defaultManifest.subtitle = 'Liderança, Transformação Digital e Retorno sobre Investimento';
      defaultManifest.theme = { accentColor: '#f59e0b', background: '#0b0f19', font: 'montserrat', gradient: 'editorial', transition: 'fade', transitionDuration: 380 };
      slides = [
        {
          id: 1,
          slug: 'slide-1',
          tag: 'RELATÓRIO EXECUTIVO',
          title: 'Transformação Digital & Eficiência Estratégica',
          layout: 'hero',
          font: 'montserrat',
          background: 'editorial',
          hero: {
            title: 'Liderança & Visão 2026',
            subtitle: 'Alinhamento estratégico para maximização de valor e modernização da infraestrutura corporativa.',
            badges: [
              { text: '📈 Foco em ROI', class: 'badge-accent' },
              { text: '🏛️ Governança C-Level', class: 'badge-success' },
              { text: '💼 Eficiência Operacional', class: 'badge-live' }
            ]
          },
          included: true,
          presenter: {
            headline: 'Liderança & Visão 2026',
            bullets: [
              'Diretrizes prioritárias de expansão e governança',
              'Otimização de custos e eliminação de desperdícios legados',
              'Acesse o sumário executivo no seu smartphone'
            ],
            notes: 'Abertura solene: agradecer a presença da diretoria e do conselho.'
          },
          audience: {
            summary: 'Sumário executivo do relatório estratégico para lideranças.',
            sections: [
              {
                title: 'Objetivos da Sessão',
                type: 'text',
                content: 'Apresentar as metas de rentabilidade e governança tecnológica para os próximos trimestres.'
              }
            ]
          }
        },
        {
          id: 2,
          slug: 'slide-2',
          tag: 'DIRETRIZ DE LIDERANÇA',
          title: 'Princípio Norteador da Nova Gestão',
          layout: 'quote',
          font: 'playfair',
          background: 'editorial',
          quote: {
            text: 'A verdadeira transformação digital não reside apenas na tecnologia que adotamos, mas na agilidade com que nossa equipe se comunica e toma decisões com base em dados reais.',
            author: 'Dra. Helena Valente',
            role: 'Chief Technology & Innovation Officer'
          },
          included: true,
          presenter: {
            headline: 'Princípio Norteador da Nova Gestão',
            bullets: [
              'Cultura centrada em colaboração ágil e transparência',
              'Decisões fundamentadas em métricas imediatas',
              'Empoderamento das lideranças na ponta da operação'
            ],
            notes: 'Citação inspiradora da Dra. Helena para reforçar o compromisso com agilidade.'
          },
          audience: {
            summary: 'Declaração oficial de liderança e diretrizes de inovação.',
            sections: [
              {
                title: 'Comentário da Diretoria',
                type: 'text',
                content: 'A comunicação fluida entre todas as camadas organizacionais é o alicerce para atingir nossas metas.'
              }
            ]
          }
        },
        {
          id: 3,
          slug: 'slide-3',
          tag: 'PILARES ESTRATÉGICOS',
          title: '3 Pilares de Expansão e Crescimento Sustentável',
          layout: 'columns',
          font: 'montserrat',
          background: 'editorial',
          columns: {
            items: [
              {
                icon: '💼',
                title: 'Eficiência de Capital',
                bullets: [
                  'Redução de 30% em custos com software legado',
                  'Realocação de recursos em inovação direta',
                  'Ciclos de entrega 2x mais rápidos'
                ]
              },
              {
                icon: '👥',
                title: 'Experiência & Engajamento',
                bullets: [
                  'Alinhamento instantâneo de toda a organização',
                  'Participação ativa em reuniões de liderança',
                  'Feedback e dados computados em tempo real'
                ]
              },
              {
                icon: '🛡️',
                title: 'Governança & Segurança',
                bullets: [
                  'Proteção estrita de dados confidenciais',
                  'Autenticação Multi-Auth e trilhas de auditoria',
                  'Soberania e controle operacional total'
                ]
              }
            ]
          },
          included: true,
          presenter: {
            headline: '3 Pilares de Expansão e Crescimento Sustentável',
            bullets: [
              'Rentabilidade aliada à disciplina de custos',
              'Aceleração de projetos de alta prioridade',
              'Consistência e previsibilidade financeira'
            ],
            notes: 'Explicar os 3 pilares estratégicos para o conselho.'
          },
          audience: {
            summary: 'Matriz estratégica detalhada dos 3 pilares corporativos.',
            sections: [
              {
                title: 'Detalhamento de Custos',
                type: 'text',
                content: 'A consolidação de ferramentas gera economias de escala significativas já no primeiro exercício fiscal.'
              }
            ]
          }
        },
        {
          id: 4,
          slug: 'slide-4',
          tag: 'RETORNO SOBRE INVESTIMENTO',
          title: 'Resultados Financeiros e Projeção de ROI',
          layout: 'metric',
          font: 'montserrat',
          background: 'editorial',
          metric: {
            value: '+340%',
            label: 'Retorno sobre o Investimento em 12 Meses',
            subtitle: 'Ganhos diretos de produtividade, redução de despesas operacionais e aceleração de decisões.',
            delta: 'Payback em 4.5 Meses',
            pillars: [
              { label: 'Economia Anual', value: 'R$ 2.8M' },
              { label: 'Tempo Poupado/Semana', value: '18 hrs' },
              { label: 'Acurácia de Decisão', value: '98.7%' }
            ]
          },
          included: true,
          presenter: {
            headline: 'Resultados Financeiros e Projeção de ROI',
            bullets: [
              'Retorno expressivo comprovado no projeto piloto',
              'Recuperação rápida do capital investido (Payback)',
              'Fundamento sólido para aprovação orçamentária'
            ],
            notes: 'Destacar o indicador de ROI de +340% e a economia consolidada de R$ 2.8M.'
          },
          audience: {
            summary: 'Projeção financeira e modelo de retorno para o comitê.',
            sections: [
              {
                title: 'Metodologia de Cálculo',
                type: 'text',
                content: 'O cálculo considera horas de trabalho poupadas, eliminação de licenças redundantes e redução de retrabalho.'
              }
            ]
          }
        },
        {
          id: 5,
          slug: 'slide-5',
          tag: 'DECISÃO DO CONSELHO',
          title: 'Qual diretriz deve liderar o orçamento do próximo ano fiscal?',
          included: true,
          presenter: {
            headline: 'Qual diretriz deve liderar o orçamento do próximo ano fiscal?',
            bullets: [
              'Vote agora pelo seu smartphone institucional',
              'Resultado preliminar exibido instantaneamente no telão',
              'Deliberação democrática com registro seguro'
            ],
            notes: 'Pressionar [V] para abrir a votação dos conselheiros.'
          },
          interaction: {
            poll: {
              id: 'poll-decisao-conselho',
              question: 'Qual diretriz deve liderar o orçamento do próximo ano fiscal?',
              options: [
                { id: 'A', text: 'Automação & Modernização Tecnológica' },
                { id: 'B', text: 'Expansão Comercial & Novos Mercados' },
                { id: 'C', text: 'Capacitação de Lideranças & Talentos' },
                { id: 'D', text: 'Segurança da Informação & Compliance' }
              ]
            }
          },
          audience: {
            summary: 'Votação deliberativa para membros do conselho e diretoria.',
            sections: [
              {
                title: 'Instruções de Voto',
                type: 'text',
                content: 'Selecione uma das prioridades para registrar a sua posição no comitê executivo.'
              }
            ]
          }
        }
      ];
    } else if (type === 'training') {
      defaultManifest.title = 'Treinamento Técnico & Capacitação';
      defaultManifest.subtitle = 'Conceitos Fundamentais, Laboratório e Quiz de Fixação';
      defaultManifest.theme = { accentColor: '#10b981', background: '#0b0f19', font: 'inter', gradient: 'aurora', transition: 'fade', transitionDuration: 380 };
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
      defaultManifest.theme = { accentColor: '#a855f7', background: '#0b0f19', font: 'outfit', gradient: 'sunset', transition: 'fade', transitionDuration: 380 };
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
    } else if (type === 'blank' || type === 'empty') {
      // Template em Branco (Blank)
      defaultManifest.title = 'Minha Nova Apresentação';
      defaultManifest.subtitle = 'Criada no SlideMeshLive';
      defaultManifest.theme = { accentColor: '#38bdf8', background: '#0b0f19', font: 'inter', gradient: 'dark', transition: 'fade', transitionDuration: 380 };
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

