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
    // Identifica o path base do projeto
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
  static renderQR(containerElement, url) {
    if (!containerElement) return;
    containerElement.innerHTML = '';

    if (window.QRCode) {
      new window.QRCode(containerElement, {
        text: url,
        width: 144,
        height: 144,
        colorDark: "#0f172a",
        colorLight: "#ffffff"
      });
    } else {
      // Fallback simples caso lib não esteja carregada
      const img = document.createElement('img');
      img.src = `https://api.qrserver.com/v1/create-qr-code/?size=144x144&data=${encodeURIComponent(url)}&margin=1`;
      img.alt = "QR Code";
      img.style.width = "100%";
      img.style.borderRadius = "4px";
      containerElement.appendChild(img);
    }
  }
}
