/**
 * QR Code & Session Code Engine
 * Plataforma de Apresentação HTML Interativa Sincronizada
 * 
 * Gera links de conexão e renderiza QR Code dinâmico para o público.
 * Suporta customização dinâmica de Host, IP, FQDN e Porta pela Mesa Técnica
 * com sanitização para isolar estritamente o origin (protocol://host:port).
 */

export class QREngine {
  /**
   * Sanitiza qualquer URL ou IP para extrair apenas a origem (protocol + host + port)
   */
  static sanitizeHost(rawInput) {
    if (!rawInput || typeof rawInput !== 'string') return window.location.origin;
    let input = rawInput.trim();
    if (!input) return window.location.origin;

    if (!input.startsWith('http://') && !input.startsWith('https://')) {
      input = 'http://' + input;
    }

    try {
      const parsed = new URL(input);
      return parsed.origin;
    } catch (e) {
      return input.replace(/\/+$/, '');
    }
  }

  /**
   * Obtém o host base configurado para a sessão
   */
  static getBaseHost(sessionId) {
    if (sessionId) {
      const custom = localStorage.getItem(`session_qr_host_${sessionId}`);
      if (custom && custom.trim().length > 0) {
        return this.sanitizeHost(custom);
      }
    }
    return window.location.origin;
  }

  /**
   * Define e persiste um Host/IP/FQDN customizado para a sessão
   */
  static setCustomHost(sessionId, customBaseUrl) {
    if (!sessionId) return window.location.origin;
    if (customBaseUrl && customBaseUrl.trim().length > 0) {
      const sanitized = this.sanitizeHost(customBaseUrl);
      localStorage.setItem(`session_qr_host_${sessionId}`, sanitized);
      return sanitized;
    } else {
      localStorage.removeItem(`session_qr_host_${sessionId}`);
      return window.location.origin;
    }
  }

  /**
   * Reseta o host para o padrão do navegador
   */
  static resetCustomHost(sessionId) {
    if (sessionId) {
      localStorage.removeItem(`session_qr_host_${sessionId}`);
    }
    return window.location.origin;
  }

  /**
   * Gera a URL completa para a audiência sem duplicação de caminhos
   */
  static getAudienceUrl(presentationId, sessionId) {
    const baseHost = this.getBaseHost(sessionId);
    const pid = encodeURIComponent(presentationId || 'sdwan-cpe-unificado');
    const sid = encodeURIComponent(sessionId || 'SDWAN2026');
    return `${baseHost}/audience/?presentation=${pid}&session=${sid}`;
  }

  /**
   * Gera um código de sessão aleatório curto de 6 caracteres legíveis
   */
  static generateSessionCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Renderiza o QR Code em um elemento HTML alvo
   */
  static renderQR(containerElement, url, size = 144) {
    if (!containerElement) return;
    containerElement.innerHTML = '';

    try {
      if (window.QRCode) {
        new window.QRCode(containerElement, {
          text: url,
          width: size,
          height: size,
          colorDark: "#000000",
          colorLight: "#ffffff",
          correctLevel: window.QRCode.CorrectLevel ? window.QRCode.CorrectLevel.M : 0
        });
      } else {
        containerElement.innerHTML = `
          <div style="font-size: 11px; color: var(--text-muted); padding: 10px; text-align: center;">
            QR Code indisponível offline sem biblioteca.
          </div>
        `;
      }
    } catch (e) {
      console.warn('Erro ao renderizar QR Code:', e);
    }
  }
}
