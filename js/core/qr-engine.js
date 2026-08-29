/**
 * QR Code & Session Code Engine
 * Plataforma de Apresentação HTML Interativa Sincronizada
 * 
 * Gera links de conexão e renderiza QR Code dinâmico para o público.
 * Suporta customização dinâmica de Host, IP, FQDN e Porta pela Mesa Técnica.
 */

export class QREngine {
  /**
   * Obtém o host base configurado para a sessão (ou fallback para window.location.origin)
   */
  static getBaseHost(sessionId) {
    if (sessionId) {
      const custom = localStorage.getItem(`session_qr_host_${sessionId}`);
      if (custom && custom.trim().length > 0) {
        return custom.trim().replace(/\/+$/, '');
      }
    }
    return window.location.origin;
  }

  /**
   * Define e persiste um Host/IP/FQDN customizado para a sessão
   */
  static setCustomHost(sessionId, customBaseUrl) {
    if (!sessionId) return;
    if (customBaseUrl && customBaseUrl.trim().length > 0) {
      let clean = customBaseUrl.trim().replace(/\/+$/, '');
      if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
        clean = 'http://' + clean;
      }
      localStorage.setItem(`session_qr_host_${sessionId}`, clean);
      return clean;
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
   * Gera a URL completa para a audiência
   */
  static getAudienceUrl(presentationId, sessionId) {
    const baseHost = this.getBaseHost(sessionId);
    const pathname = window.location.pathname;
    let basePath = '';
    
    if (pathname.includes('/presenter')) {
      basePath = pathname.substring(0, pathname.lastIndexOf('/presenter'));
    } else if (pathname.includes('/admin')) {
      basePath = pathname.substring(0, pathname.lastIndexOf('/admin'));
    } else if (pathname.includes('/audience')) {
      basePath = pathname.substring(0, pathname.lastIndexOf('/audience'));
    }

    const cleanBasePath = basePath ? basePath.replace(/\/+$/, '') : '';
    return `${baseHost}${cleanBasePath}/audience/?presentation=${encodeURIComponent(presentationId || 'sdwan-cpe-unificado')}&session=${encodeURIComponent(sessionId || 'SDWAN2026')}`;
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
          <div style="font-size: 11px; color: #64748b; padding: 10px; text-align: center;">
            QR Code indisponível
          </div>
        `;
      }
    } catch (e) {
      console.warn('Erro ao renderizar QR Code:', e);
    }
  }
}
