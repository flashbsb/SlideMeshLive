#!/usr/bin/env python3
"""
SlideMeshLive — Utilitário CLI de Importação e Conversão de Apresentações
Suporta PowerPoint (.pptx), Word (.docx), Markdown (.md), HTML (.html) e Adobe PDF (.pdf).

Uso:
  python3 tools/import_presentation.py caminho/do/arquivo.pptx
  python3 tools/import_presentation.py caminho/do/arquivo.docx --title "Minha Apostila"
  python3 tools/import_presentation.py caminho/do/arquivo.md --session SES9999 --security pin
"""

import os
import sys
import re
import json
import time
import base64
import zipfile
import argparse
import xml.etree.ElementTree as ET

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PRESENTATIONS_DIR = os.path.join(BASE_DIR, "presentations")
CATALOG_PATH = os.path.join(PRESENTATIONS_DIR, "catalog.json")

# Namespaces do OpenXML
NS_PPT = {
    'p': 'http://schemas.openxmlformats.org/presentationml/2006/main',
    'a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
    'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
}
NS_DOCX = {
    'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
    'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
}

def sanitize_slug(text):
    text = re.sub(r'[^\w\s-]', '', text.lower())
    text = re.sub(r'[-\s]+', '-', text).strip('-')
    return text or f"apresentacao-{int(time.time())}"

def parse_pptx(filepath):
    slides = []
    assets = []
    
    with zipfile.ZipFile(filepath, 'r') as z:
        slide_files = [f for f in z.namelist() if re.match(r'^ppt/slides/slide\d+\.xml$', f)]
        slide_files.sort(key=lambda x: int(re.search(r'slide(\d+)\.xml', x).group(1)))

        if not slide_files:
            raise ValueError("Nenhum slide encontrado no arquivo PPTX.")

        for idx, s_file in enumerate(slide_files):
            slide_num = idx + 1
            xml_bytes = z.read(s_file)
            root = ET.fromstring(xml_bytes)

            slide_title = ""
            bullets = []
            paragraphs = []

            # Itera sobre caixas de texto (sp)
            for sp in root.findall('.//p:sp', NS_PPT):
                is_title = sp.find('.//p:ph[@type="title"]', NS_PPT) is not None or sp.find('.//p:ph[@type="ctrTitle"]', NS_PPT) is not None
                
                for p in sp.findall('.//a:p', NS_PPT):
                    texts = [t.text for t in p.findall('.//a:t', NS_PPT) if t.text]
                    p_text = "".join(texts).strip()
                    if not p_text:
                        continue

                    if is_title and not slide_title:
                        slide_title = p_text
                    elif is_title:
                        paragraphs.append(p_text)
                    else:
                        bullets.append(p_text)

            if not slide_title:
                slide_title = bullets.pop(0) if bullets else f"Slide {slide_num}"

            # Extração de notas do orador
            notes = ""
            notes_file = f"ppt/notesSlides/notesSlide{slide_num}.xml"
            if notes_file in z.namelist():
                try:
                    n_root = ET.fromstring(z.read(notes_file))
                    n_texts = [t.text.strip() for t in n_root.findall('.//a:t', NS_PPT) if t.text and t.text.strip()]
                    notes = " ".join([t for t in n_texts if t != slide_title and not t.isdigit()])
                except Exception:
                    pass

            slide_entry = {
                "id": slide_num,
                "slug": f"slide-{slide_num}",
                "tag": f"SEÇÃO {slide_num}",
                "title": slide_title,
                "presenter": {
                    "headline": slide_title,
                    "bullets": bullets[:4] if bullets else ["Acompanhe os detalhes desta apresentação."],
                    "notes": notes or "Sem notas adicionais."
                },
                "audience": {
                    "summary": f"Resumo do {slide_title}.",
                    "sections": [
                        {
                            "title": "Conteúdo Detalhado",
                            "type": "text",
                            "content": "\n\n".join(bullets + paragraphs) or "Consulte a explicação no telão principal."
                        }
                    ]
                }
            }
            slides.append(slide_entry)

    return slides, assets

def parse_docx(filepath):
    slides = []
    assets = []

    with zipfile.ZipFile(filepath, 'r') as z:
        if 'word/document.xml' not in z.namelist():
            raise ValueError("Arquivo word/document.xml não encontrado no pacote DOCX.")

        root = ET.fromstring(z.read('word/document.xml'))
        sections = []
        current_sec = {"title": "", "bullets": [], "paragraphs": [], "tables": []}

        # Analisa o corpo do documento
        for child in root.find('.//w:body', NS_DOCX):
            tag = child.tag.split('}')[-1]
            if tag == 'p':
                p_style = child.find('.//w:pStyle', NS_DOCX)
                val = p_style.attrib.get(f"{{{NS_DOCX['w']}}}val", "") if p_style is not None else ""
                is_heading = bool(re.search(r'Heading1|Heading2|Titulo1|Titulo2|Title', val, re.I))
                has_page_break = child.find('.//w:br[@w:type="page"]', NS_DOCX) is not None

                texts = [t.text for t in child.findall('.//w:t', NS_DOCX) if t.text]
                p_text = "".join(texts).strip()

                is_bullet = child.find('.//w:numPr', NS_DOCX) is not None

                if (is_heading and p_text) or (has_page_break and p_text):
                    if current_sec["title"] or current_sec["paragraphs"]:
                        sections.append(current_sec)
                    current_sec = {"title": p_text, "bullets": [], "paragraphs": [], "tables": []}
                elif p_text:
                    if not current_sec["title"]:
                        current_sec["title"] = p_text
                    elif is_bullet:
                        current_sec["bullets"].append(p_text)
                    else:
                        current_sec["paragraphs"].append(p_text)

            elif tag == 'tbl':
                rows = []
                for tr in child.findall('.//w:tr', NS_DOCX):
                    cells = []
                    for tc in tr.findall('.//w:tc', NS_DOCX):
                        cell_texts = [t.text for t in tc.findall('.//w:t', NS_DOCX) if t.text]
                        cells.append("".join(cell_texts).strip())
                    if cells:
                        rows.append(cells)
                if rows:
                    current_sec["tables"].append({"headers": rows[0], "rows": rows[1:]})

        if current_sec["title"] or current_sec["paragraphs"]:
            sections.append(current_sec)

        if not sections:
            raise ValueError("Nenhuma seção estruturada encontrada no arquivo DOCX.")

        for idx, sec in enumerate(sections):
            slide_num = idx + 1
            title = sec["title"] or f"Seção {slide_num}"
            bullets = sec["bullets"][:4] if sec["bullets"] else sec["paragraphs"][:3]

            aud_sections = []
            if sec["paragraphs"]:
                aud_sections.append({"title": "Texto da Seção", "type": "text", "content": "\n\n".join(sec["paragraphs"])})
            for t_idx, tbl in enumerate(sec["tables"]):
                aud_sections.append({"title": f"Tabela {t_idx+1}", "type": "table", "headers": tbl["headers"], "rows": tbl["rows"]})

            slides.append({
                "id": slide_num,
                "slug": f"slide-{slide_num}",
                "tag": f"SEÇÃO {slide_num}",
                "title": title,
                "presenter": {
                    "headline": title,
                    "bullets": bullets or ["Acompanhe os tópicos explicados no telão."],
                    "notes": f"Notas geradas do documento Word: {sec['paragraphs'][0] if sec['paragraphs'] else 'Sem notas.'}"
                },
                "audience": {
                    "summary": f"Resumo de {title}.",
                    "sections": aud_sections or [{"title": "Conteúdo", "type": "text", "content": "Consulte as anotações."}]
                }
            })

    return slides, assets

def parse_markdown(filepath):
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    raw_slides = re.split(r'\n---\n|\n\*\*\*\n|<section>', content)
    if len(raw_slides) <= 1:
        raw_slides = re.split(r'\n(?=# )', content)

    slides = []
    for idx, raw in enumerate(raw_slides):
        slide_num = idx + 1
        lines = raw.strip().split('\n')
        title = ""
        bullets = []
        paragraphs = []
        notes = ""

        for line in lines:
            trimmed = line.strip()
            if trimmed.startswith('# ') and not title:
                title = trimmed[2:].strip()
            elif trimmed.startswith('## ') and not title:
                title = trimmed[3:].strip()
            elif trimmed.startswith(('- ', '* ')):
                bullets.append(trimmed[2:].strip())
            elif trimmed.startswith('<!-- note:') and trimmed.endswith('-->'):
                notes = trimmed[10:-3].strip()
            elif trimmed and not trimmed.startswith('#'):
                paragraphs.append(trimmed)

        title = title or (paragraphs[0] if paragraphs else f"Slide {slide_num}")
        slides.append({
            "id": slide_num,
            "slug": f"slide-{slide_num}",
            "tag": f"SEÇÃO {slide_num}",
            "title": title,
            "presenter": {
                "headline": title,
                "bullets": bullets[:4] if bullets else paragraphs[:3],
                "notes": notes or "Sem notas adicionais."
            },
            "audience": {
                "summary": f"Resumo de {title}.",
                "sections": [{"title": "Conteúdo Integral", "type": "text", "content": "\n\n".join(paragraphs) or "Material projetado."}]
            }
        })

    return slides, []

def parse_pdf(filepath):
    with open(filepath, "rb") as f:
        data = f.read()
    raw_str = data.decode("latin1", errors="ignore")

    page_streams = re.findall(r'stream\r?\n([\s\S]*?)\r?\nendstream', raw_str)
    if not page_streams:
        page_streams = [raw_str]

    pages_text = []
    for st in page_streams:
        tokens = re.findall(r'\(([^)]+)\)\s*(?:Tj|\'|")|\[((?:\([^)]*\)|[^\]])+)\]\s*TJ', st)
        texts = []
        for t1, t2 in tokens:
            if t1:
                texts.append(t1)
            elif t2:
                in_matches = re.findall(r'\(([^)]+)\)', t2)
                texts.extend(in_matches)
        full_text = " ".join(texts).strip()
        if len(full_text) > 5:
            pages_text.append(full_text)

    if not pages_text:
        pages_text = ["Apresentação importada a partir de arquivo PDF."]

    slides = []
    for idx, p_text in enumerate(pages_text):
        slide_num = idx + 1
        sentences = [s.strip() for s in re.split(r'(?<=[.!?])\s+', p_text) if s.strip()]
        title = sentences[0] if sentences else f"Página {slide_num}"
        bullets = sentences[1:5] if len(sentences) > 1 else ["Acompanhe os tópicos extraídos do PDF."]

        slides.append({
            "id": slide_num,
            "slug": f"slide-{slide_num}",
            "tag": f"PÁGINA {slide_num}",
            "title": title,
            "presenter": {
                "headline": title,
                "bullets": bullets,
                "notes": f"Página {slide_num} extraída do documento PDF."
            },
            "audience": {
                "summary": f"Resumo da página {slide_num}.",
                "sections": [{"title": "Texto da Página", "type": "text", "content": p_text}]
            }
        })

    return slides, []

MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024  # 50 MB

def import_presentation(filepath, presentation_id=None, title=None, session=None, security="public"):
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"Arquivo não encontrado: {filepath}")

    file_size = os.path.getsize(filepath)
    if file_size > MAX_FILE_SIZE_BYTES:
        raise ValueError(f"Arquivo excede o limite máximo de 50MB (tamanho atual: {file_size / (1024*1024):.2f}MB).")

    ext = os.path.splitext(filepath)[1].lower()
    filename = os.path.basename(filepath)
    base_name = os.path.splitext(filename)[0]

    slug = sanitize_slug(presentation_id or base_name)
    pres_title = title or base_name.replace('-', ' ').replace('_', ' ').title()
    session_code = session or f"SES{int(time.time()) % 9000 + 1000}"

    print(f"🚀 Processando e convertendo: {filename} ({ext.upper()})...")

    if ext == '.pptx':
        slides, assets = parse_pptx(filepath)
    elif ext == '.docx':
        slides, assets = parse_docx(filepath)
    elif ext in ('.md', '.markdown'):
        slides, assets = parse_markdown(filepath)
    elif ext == '.pdf':
        slides, assets = parse_pdf(filepath)
    else:
        raise ValueError(f"Extensão não suportada: {ext}. Formatos suportados: .pptx, .docx, .md, .pdf")

    manifest = {
        "id": slug,
        "code": slug.upper()[:14] + "-2026",
        "title": pres_title,
        "subtitle": "Importado via SlideMeshLive CLI",
        "description": f"Apresentação gerada a partir de {filename}.",
        "defaultSession": session_code,
        "totalSlides": len(slides),
        "securityMode": security,
        "securityLabel": "Pública" if security == "public" else "🔒 Protegida por PIN",
        "badgeClass": "badge-accent" if security == "public" else "badge",
        "theme": {
            "accentColor": "#38bdf8",
            "background": "#0b0f19"
        },
        "security": {
            "mode": security
        }
    }

    # Gravação no sistema de arquivos
    target_dir = os.path.join(PRESENTATIONS_DIR, slug)
    assets_dir = os.path.join(target_dir, "assets")
    os.makedirs(assets_dir, exist_ok=True)

    # manifest.json
    manifest_path = os.path.join(target_dir, "manifest.json")
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)

    # slides.json
    slides_path = os.path.join(target_dir, "slides.json")
    with open(slides_path, "w", encoding="utf-8") as f:
        json.dump({"slides": slides}, f, ensure_ascii=False, indent=2)

    # catalog.json
    catalog_data = {"version": "1.0.0", "presentations": []}
    if os.path.exists(CATALOG_PATH):
        try:
            with open(CATALOG_PATH, "r", encoding="utf-8") as f:
                catalog_data = json.load(f)
        except Exception:
            pass

    presentations = catalog_data.setdefault("presentations", [])
    entry = {
        "id": slug,
        "code": manifest["code"],
        "title": manifest["title"],
        "subtitle": manifest["subtitle"],
        "description": manifest["description"],
        "defaultSession": session_code,
        "totalSlides": len(slides),
        "securityMode": security,
        "securityLabel": manifest["securityLabel"],
        "badgeClass": manifest["badgeClass"]
    }

    idx = next((i for i, p in enumerate(presentations) if p.get("id") == slug), None)
    if idx is not None:
        presentations[idx] = entry
    else:
        presentations.insert(0, entry)

    cat_tmp = CATALOG_PATH + ".tmp"
    with open(cat_tmp, "w", encoding="utf-8") as f:
        json.dump(catalog_data, f, ensure_ascii=False, indent=2)
    os.replace(cat_tmp, CATALOG_PATH)

    print(f"\n{'='*65}")
    print(f"  🎉 APRESENTAÇÃO IMPORTADA COM SUCESSO NO SLIDEMESHLIVE!")
    print(f"{'='*65}")
    print(f"  📌 ID: {slug}")
    print(f"  📝 Título: {pres_title}")
    print(f"  📊 Total de Slides: {len(slides)}")
    print(f"  🔑 Sessão: {session_code}")
    print(f"\n  🌐 LINKS DE ACESSO:")
    print(f"  🖥️  Telão:      http://localhost:8000/presenter/?presentation={slug}&session={session_code}")
    print(f"  🛡️  Mesa Técnica: http://localhost:8000/admin/?presentation={slug}&session={session_code}")
    print(f"  📱  Smartphone:  http://localhost:8000/audience/?presentation={slug}&session={session_code}")
    print(f"{'='*65}\n")

def main():
    parser = argparse.ArgumentParser(description="SlideMeshLive CLI — Importador Universal de Conteúdos")
    parser.add_argument("file", help="Caminho do arquivo (.pptx, .docx, .md, .pdf)")
    parser.add_argument("--id", dest="presentation_id", help="Slug/ID da apresentação no catálogo")
    parser.add_argument("--title", help="Título exibido da apresentação")
    parser.add_argument("--session", help="Código da sessão (ex: SES2026)")
    parser.add_argument("--security", choices=["public", "pin"], default="public", help="Modo de segurança")

    args = parser.parse_args()
    try:
        import_presentation(
            filepath=args.file,
            presentation_id=args.presentation_id,
            title=args.title,
            session=args.session,
            security=args.security
        )
    except Exception as e:
        print(f"\n❌ ERRO: {e}\n", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
