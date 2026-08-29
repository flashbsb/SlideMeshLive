#!/usr/bin/env python3
"""
Servidor HTTP Local com Detecção Automática de IP para Apresentações Online
Plataforma de Apresentação HTML Interativa Sincronizada
"""

import os
import sys
import socket
import argparse
from http.server import HTTPServer, SimpleHTTPRequestHandler

class NoCacheHTTPRequestHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        # Desativa cache agressivo para arquivos estáticos em desenvolvimento
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

    def log_message(self, format, *args):
        # Log simplificado e limpo
        sys.stderr.write(f"[{self.log_date_time_string()}] {args[0]} {args[1]}\n")

def get_local_ip():
    """Descobre o endereço IP da máquina na rede local."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # Não precisa enviar dados, apenas conecta para determinar a rota
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
    except Exception:
        ip = '127.0.0.1'
    finally:
        s.close()
    return ip

def main():
    parser = argparse.ArgumentParser(description='Servidor Local para Apresentação Online')
    parser.add_argument('--port', '-p', type=int, default=8080, help='Porta HTTP (padrão: 8080)')
    parser.add_argument('--dir', '-d', type=str, default='.', help='Diretório raiz (padrão: .)')
    args = parser.parse_args()

    os.chdir(args.dir)
    port = args.port
    local_ip = get_local_ip()

    server_address = ('0.0.0.0', port)
    httpd = HTTPServer(server_address, NoCacheHTTPRequestHandler)

    print("=" * 68)
    print(" 📡 PLATAFORMA DE APRESENTAÇÃO ONLINE - SERVIDOR LOCAL ATIVO")
    print("=" * 68)
    print(f" 💻 Acesso Local (Navegador):")
    print(f"    Portal Inicial:     http://localhost:{port}/")
    print(f"    Telão Apresentador: http://localhost:{port}/presenter/?presentation=sdwan-cpe-unificado")
    print(f"    Mesa Técnica/Admin: http://localhost:{port}/admin/?presentation=sdwan-cpe-unificado")
    print("")
    print(f" 📱 Acesso de Smartphones (Mesmo Wi-Fi / Rede Local):")
    print(f"    http://{local_ip}:{port}/")
    print("=" * 68)
    print(" Pressione Ctrl+C para interromper o servidor.\n")

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[+] Servidor encerrado.")
        httpd.server_close()

if __name__ == '__main__':
    main()
