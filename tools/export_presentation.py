#!/usr/bin/env python3
"""
SlideMeshLive — Utilitário CLI de Exportação de Pacote ZIP de Apresentação (.slidemesh.zip)

Uso:
  python3 tools/export_presentation.py <slug_ou_id> [caminho_saida.zip]

Exemplos:
  python3 tools/export_presentation.py slidemesh-showcase
  python3 tools/export_presentation.py slidemesh-showcase /tmp/meu-backup.zip
"""

import os
import sys
import argparse

# Garante que o diretório raiz esteja no path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

import server

def main():
    parser = argparse.ArgumentParser(description="SlideMeshLive CLI — Exportador de Pacote ZIP de Apresentação")
    parser.add_argument("presentation_id", help="Slug/ID da apresentação a exportar (ex: slidemesh-showcase)")
    parser.add_argument("output_path", nargs="?", default=None, help="Caminho do arquivo ZIP de saída (opcional)")

    args = parser.parse_args()
    slug = args.presentation_id.strip()

    try:
        print(f"📦 Empacotando apresentação '{slug}'...")
        zip_bytes = server.export_presentation_zip(slug, base_dir=BASE_DIR)

        output_path = args.output_path
        if not output_path:
            output_path = os.path.join(os.getcwd(), f"{slug}.slidemesh.zip")

        # Garante diretório de destino
        out_dir = os.path.dirname(os.path.abspath(output_path))
        if out_dir:
            os.makedirs(out_dir, exist_ok=True)

        with open(output_path, "wb") as f:
            f.write(zip_bytes)

        file_size_kb = len(zip_bytes) / 1024
        print(f"\n{'='*65}")
        print(f"  🎉 PACOTE EXPORTADO COM SUCESSO!")
        print(f"{'='*65}")
        print(f"  📌 Apresentação: {slug}")
        print(f"  📁 Arquivo:      {output_path}")
        print(f"  📊 Tamanho:      {file_size_kb:.1f} KB")
        print(f"{'='*65}\n")

    except Exception as e:
        print(f"\n❌ ERRO NA EXPORTAÇÃO: {e}\n", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
