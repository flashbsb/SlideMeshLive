/**
 * Theme Engine
 * Plataforma de Apresentação HTML Interativa Sincronizada
 * 
 * Gerencia os 4 temas de interface:
 * 1. Dark (Padrão: Slate / Escuro / Neon)
 * 2. Light (Claro: Branco / Cinza / Azul Royal)
 * 3. Slate (Carvão / Índigo suave)
 * 4. High Contrast (Acessibilidade WCAG AAA: Preto puro / Amarelo / Branco puro)
 */

export const THEMES = [
  { id: 'dark', labelKey: 'theme.dark', icon: '🌙', className: 'theme-dark' },
  { id: 'light', labelKey: 'theme.light', icon: '☀️', className: 'theme-light' },
  { id: 'slate', labelKey: 'theme.slate', icon: '🪐', className: 'theme-slate' },
  { id: 'high-contrast', labelKey: 'theme.high_contrast', icon: '👁️', className: 'theme-high-contrast' }
];

export class ThemeEngine {
  constructor() {
    this.currentTheme = this._detectTheme();
    this.listeners = [];
    this.init();
  }

  _detectTheme() {
    const saved = localStorage.getItem('apres_user_theme');
    if (saved && THEMES.some(t => t.id === saved)) return saved;
    return 'dark';
  }

  get theme() {
    return this.currentTheme;
  }

  init() {
    this.applyTheme(this.currentTheme);
  }

  setTheme(themeId) {
    if (!THEMES.some(t => t.id === themeId)) return;
    this.currentTheme = themeId;
    localStorage.setItem('apres_user_theme', themeId);
    this.applyTheme(this.currentTheme);
    this.listeners.forEach(cb => cb(this.currentTheme));
  }

  cycleTheme() {
    const idx = THEMES.findIndex(t => t.id === this.currentTheme);
    const nextIdx = (idx + 1) % THEMES.length;
    this.setTheme(THEMES[nextIdx].id);
    return THEMES[nextIdx].id;
  }

  applyTheme(themeId) {
    THEMES.forEach(t => {
      document.documentElement.classList.remove(t.className);
      document.body && document.body.classList.remove(t.className);
    });
    const target = THEMES.find(t => t.id === themeId) || THEMES[0];
    document.documentElement.classList.add(target.className);
    if (document.body) {
      document.body.classList.add(target.className);
    }
  }

  onThemeChange(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }
}

export const theme = new ThemeEngine();
