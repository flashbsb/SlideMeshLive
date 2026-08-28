/**
 * QR Code & Session Code Engine
 * Gera links de conexão e renderiza QR Code dinâmico para o público.
 */

export class QREngine {
  /**
   * Gera a URL completa para a audiência
   */
  static getAudienceUrl(presentationId, sessionId) {
    const origin = window.location.origin;
    const pathname = window.location.pathname;
    const basePath = pathname.substring(0, pathname.lastIndexOf('/presenter'));
    const cleanBasePath = basePath ? basePath : '';
    return `${origin}${cleanBasePath}/audience/?presentation=${encodeURIComponent(presentationId)}&session=${encodeURIComponent(sessionId)}`;
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
          colorDark: "#0f172a",
          colorLight: "#ffffff"
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
