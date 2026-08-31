/**
 * SlideMeshLive — Motor de Extração e Conversão Semântica
 * Suporta PowerPoint (.pptx), Microsoft Word (.docx), Markdown (.md) e HTML (.html).
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
          background: '#0b0f19'
        },
        security: {
          mode: 'public'
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
     PARSER POWERPOINT (.PPTX)
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
          bullets: bullets.length > 0 ? bullets : ['Visualização de conteúdo extraído do PowerPoint'],
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
     PARSER MICROSOFT WORD (.DOCX)
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
}

export const conversionEngine = new ConversionEngine();
