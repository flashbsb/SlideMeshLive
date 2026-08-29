import json
import os
import sys

def test_catalog_integrity():
    catalog_path = "presentations/catalog.json"
    assert os.path.exists(catalog_path), "catalog.json não encontrado"
    with open(catalog_path, "r", encoding="utf-8") as f:
        catalog = json.load(f)
    
    presentations = catalog.get("presentations", [])
    assert len(presentations) >= 2, f"Esperado ao menos 2 apresentações, encontrado {len(presentations)}"
    
    for p in presentations:
        pid = p["id"]
        manifest_path = f"presentations/{pid}/manifest.json"
        slides_path = f"presentations/{pid}/slides.json"
        assert os.path.exists(manifest_path), f"Manifest {manifest_path} ausente"
        assert os.path.exists(slides_path), f"Slides {slides_path} ausente"
        
        with open(manifest_path, "r", encoding="utf-8") as mf:
            manifest = json.load(mf)
            assert manifest["id"] == pid, f"ID do manifest ({manifest['id']}) difere do catálogo ({pid})"
            
        with open(slides_path, "r", encoding="utf-8") as sf:
            slides_data = json.load(sf)
            assert len(slides_data.get("slides", [])) == p["totalSlides"], f"Contagem de slides divergente para {pid}"
            
    print("✓ Catálogo e arquivos de apresentações validados com 100% de integridade.")

def test_html_files_presence():
    files = [
        "index.html",
        "presenter/index.html",
        "admin/index.html",
        "audience/index.html",
        "css/base.css",
        "css/admin.css",
        "css/presenter.css",
        "css/audience.css",
        "js/core/i18n-engine.js",
        "js/core/theme-engine.js",
        "js/core/qr-engine.js",
        "js/core/realtime-engine.js",
        "js/core/session-manager.js"
    ]
    for f in files:
        assert os.path.exists(f), f"Arquivo essencial {f} não encontrado!"
    print(f"✓ Todos os {len(files)} arquivos essenciais do sistema estão presentes.")

if __name__ == "__main__":
    try:
        test_catalog_integrity()
        test_html_files_presence()
        print("\n🎉 TODOS OS TESTES DE VALIDAÇÃO PASSARAM COM SUCESSO!")
    except AssertionError as e:
        print(f"❌ Falha no teste: {e}", file=sys.stderr)
        sys.exit(1)
