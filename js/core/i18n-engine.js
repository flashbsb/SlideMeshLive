/**
 * Internationalization (i18n) Engine
 * Plataforma de Apresentação HTML Interativa Sincronizada
 * 
 * Fornece tradução reativa para Português (Brasil) e Inglês (Estados Unidos).
 * Traduz 100% da interface do usuário (botões, badges, modais, formulários e alertas),
 * preservando o conteúdo editorial e autoral dos slides da apresentação.
 */

export const TRANSLATIONS = {
  'pt-BR': {
    // Topo & Geral
    'app.title': 'SlideMeshLive',
    'app.tagline': 'Multi-Apresentações',
    'app.realtime_active': '⚡ Sincronização em Tempo Real',
    'app.loading': 'Carregando...',
    'app.close': 'Fechar',
    'app.cancel': 'Cancelar',
    'app.confirm': 'Confirmar',
    'app.save': 'Salvar',
    'app.back': 'Voltar',
    'app.next': 'Próximo',
    'app.previous': 'Anterior',
    'app.all_rights': 'SlideMeshLive — Plataforma Open Source de Apresentações Sincronizadas',

    // Portal Inicial
    'portal.hero_title': 'Plataforma de Apresentação HTML Sincronizada',
    'portal.hero_subtitle': 'Projeções web de alto impacto com controle remoto da mesa técnica e sincronização instantânea com os smartphones do público via QR Code.',
    'portal.search_placeholder': 'Buscar apresentação...',
    'portal.slides_count': '{count} Slide(s)',
    'portal.btn_presenter': '🖥️ Telão',
    'portal.btn_admin': '🛡️ Painel',
    'portal.btn_audience': '📱 Celular',
    'portal.btn_docs': '📖 Guia & Docs',
    'portal.btn_import': '📤 Importar',
    'portal.add_new_title': 'Adicionar Nova Apresentação',
    'portal.add_new_desc': 'Crie uma pasta em presentations/<nome>/ contendo manifest.json e slides.json e registre no presentations/catalog.json.',
    'portal.view_guide': '📖 Ver Guia de Apresentações',

    // Mesa Técnica / Admin
    'admin.badge': '🛡️ MESA TÉCNICA',
    'admin.online_stat': '👥 Online:',
    'admin.logged_stat': '👤 Logados:',
    'admin.anon_stat': '👁️ Anônimos:',
    'admin.btn_history': '📚 Histórico',
    'admin.btn_new_session': '🚀 Nova Sessão',
    'admin.btn_configure_host': '🌐 Configurar Endereço QR',
    'admin.btn_switch_project': '🚀 Projetar para Todos',
    'admin.card_session_title': '⚙️ Sessão & Audiência Ao Vivo',
    'admin.active_slide': 'Slide Ativo no Telão',
    'admin.slide_title_label': 'Título do Slide Atual:',
    'admin.remote_nav_label': 'Navegação Remota do Telão:',
    'admin.connected_participants': 'Participantes Conectados',
    'admin.live_count': '{count} ao vivo',
    'admin.btn_publish_analytics': '📢 Projetar Resumo no Telão',
    'admin.btn_end_session': '🛑 Encerrar Sessão',
    'admin.card_moderation_title': '💬 Moderação de Perguntas',
    'admin.btn_clear_all_q': '🗑️ Limpar Todas',
    'admin.tab_pending': 'Pendentes',
    'admin.tab_approved': 'Aprovadas',
    'admin.tab_answered': '✓ Respondidas',
    'admin.tab_rejected': 'Rejeitadas',
    'admin.no_questions': 'Nenhuma pergunta nesta categoria.',
    'admin.no_polls': 'Nenhuma enquete cadastrada nesta apresentação.',
    'admin.no_participants': 'Nenhum participante conectado.',
    'admin.slide_actual_badge': '⭐ SLIDE ATUAL',
    'admin.votes_count': '{count} voto(s)',
    'admin.card_polls_title': '📊 Controle Mestre de Votações',
    'admin.btn_reset_all_polls': '⚠️ Zerar Todas',
    'admin.export_session_json': '📥 Exportar Relatório (JSON)',
    'admin.export_session_csv': '📊 Exportar Votos (CSV)',
    'admin.export_session_md': '📝 Exportar Resumo (Markdown)',
    'admin.btn_feature': '⭐ Destacar no Telão',
    'admin.btn_unfeature': '⭐ No Telão',
    'admin.btn_approve': '✓ Aprovar',
    'admin.btn_reject': '✕ Rejeitar',
    'admin.btn_answered': '✓ Respondida',
    'admin.btn_reopen': '↩️ Reabrir',
    'admin.btn_ban': '🚫 Banir',
    'admin.btn_unban': '✓ Desbloquear',
    'admin.open_poll': '🟢 Abrir',
    'admin.close_poll': '🔴 Fechar',
    'admin.project_poll': '📊 Projetar',
    'admin.hide_poll': '🙈 Ocultar',
    'admin.reset_poll': '🔄 Zerar',

    // Modal Host QR Code
    'host_modal.title': '🌐 Configurar Endereço do QR Code',
    'host_modal.desc': 'Ajuste o IP, FQDN ou porta se a apresentação estiver sendo remapeada na rede ou através de um domínio/túnel externo.',
    'host_modal.mode_auto': 'Automático (Detectar URL do Navegador)',
    'host_modal.mode_custom': 'Domínio / IP / Porta Customizado',
    'host_modal.label_custom_url': 'URL Base de Acesso (com protocolo):',
    'host_modal.custom_placeholder': 'Ex: https://live.empresa.com.br ou http://192.168.1.50:8080',
    'host_modal.preview_label': 'Pré-visualização do Link gerado no QR Code:',
    'host_modal.btn_save': '💾 Aplicar Novo Endereço ao Telão e QR',
    'host_modal.btn_reset': 'Restaurar Padrão',

    // Telão do Apresentador
    'presenter.live_badge': 'AO VIVO',
    'presenter.btn_large_qr': '📱 QR Gigante (Q)',
    'presenter.btn_mini_qr': '🔲 QR Rodapé (W)',
    'presenter.btn_questions': '💬 Perguntas (M)',
    'presenter.btn_pulpit': '🎛️ Púlpito (P)',
    'presenter.btn_fullscreen': '⛶ Tela Cheia (F)',
    'presenter.speaker_notes': '📝 Notas do Orador',
    'presenter.private_badge': 'Privado',
    'presenter.no_notes': 'Nenhuma nota para este slide.',
    'presenter.shortcuts_hint': '💡 Atalhos: ← / → (Navegar), Q (QR Gigante), W (QR Rodapé), M (Mural Perguntas), P (Púlpito), V (Votação), R (Resultados), B (Blackout), F (Tela Cheia).',
    'presenter.mini_qr_title': 'Acompanhe pelo Celular',
    'presenter.mini_qr_hint': 'Atalho [Q] amplia • [W] oculta',
    'presenter.large_qr_title': '📲 PARTICIPE DA APRESENTAÇÃO AO VIVO',
    'presenter.large_qr_desc': 'Aponte a câmera do seu celular para votar e enviar perguntas',
    'presenter.featured_title': 'PERGUNTA EM DESTAQUE NO TELÃO',
    'presenter.dismiss_featured': '✕ Fechar Destaque',
    'presenter.slide_sorter_title': 'Visão Rápida dos Slides (Salto Direto):',

    // Smartphone do Público
    'audience.live_badge': 'AO VIVO',
    'audience.btn_login': '🔐 Entrar',
    'audience.btn_profile': '👤 Perfil',
    'audience.nav_prev': 'Anterior',
    'audience.nav_live': 'Ao Vivo',
    'audience.nav_ask': 'Perguntar',
    'audience.nav_next': 'Próximo',
    'audience.ask_modal_title': 'Enviar Pergunta ao Apresentador',
    'audience.ask_modal_desc': 'Sua pergunta passará pela moderação antes de ser apresentada ou destacada no telão.',
    'audience.ask_placeholder': 'Digite sua pergunta técnica...',
    'audience.btn_send_question': 'Enviar Pergunta',
    'audience.my_questions_title': 'Suas Perguntas Enviadas',
    'audience.poll_open': '🟢 Votação Aberta',
    'audience.poll_closed': '🔴 Encerrada',
    'audience.poll_voted_feedback': '✓ Seu voto (Opção {opt}) está registrado!',
    'audience.poll_closed_feedback': 'Votação encerrada pelo apresentador.',
    'audience.poll_open_feedback': 'Selecione uma opção para votar (1 voto por participante).',
    'audience.session_closed_title': 'Apresentação Encerrada',
    'audience.session_closed_desc': 'A sessão foi concluída pelo apresentador. Obrigado por participar!',
    'audience.offline_banner': '⚠️ Conexão oscilando. Tentando reconectar...',

    // Temas
    'theme.label': 'Tema:',
    'theme.dark': 'Escuro (Padrão)',
    'theme.light': 'Claro (Light)',
    'theme.slate': 'Slate Suave',
    'theme.high_contrast': 'Alto Contraste (WCAG)',

    // Idiomas
    'lang.label': 'Idioma:',
    'lang.pt': 'Português 🇧🇷',
    'lang.en': 'English 🇺🇸'
  },

  'en-US': {
    // Top & General
    'app.title': 'SlideMeshLive',
    'app.tagline': 'Multi-Presentation',
    'app.realtime_active': '⚡ Real-time Sync Active',
    'app.loading': 'Loading...',
    'app.close': 'Close',
    'app.cancel': 'Cancel',
    'app.confirm': 'Confirm',
    'app.save': 'Save',
    'app.back': 'Back',
    'app.next': 'Next',
    'app.previous': 'Previous',
    'app.all_rights': 'SlideMeshLive — Synchronized Real-time Presentation Platform',

    // Portal
    'portal.hero_title': 'Synchronized HTML Presentation Platform',
    'portal.hero_subtitle': 'High-impact web slide presentations with master control room moderation and real-time smartphone audience sync via QR Code.',
    'portal.search_placeholder': 'Search presentation...',
    'portal.slides_count': '{count} Slide(s)',
    'portal.btn_presenter': '🖥️ Stage Screen',
    'portal.btn_admin': '🛡️ Control Panel',
    'portal.btn_audience': '📱 Smartphone',
    'portal.btn_docs': '📖 Guide & Docs',
    'portal.btn_import': '📤 Import',
    'portal.add_new_title': 'Add New Presentation',
    'portal.add_new_desc': 'Create a folder in presentations/<name>/ with manifest.json and slides.json and register in presentations/catalog.json.',
    'portal.view_guide': '📖 View Presentation Guide',

    // Admin / Moderator
    'admin.badge': '🛡️ CONTROL ROOM',
    'admin.online_stat': '👥 Online:',
    'admin.logged_stat': '👤 Logged:',
    'admin.anon_stat': '👁️ Anonymous:',
    'admin.btn_history': '📚 History',
    'admin.btn_new_session': '🚀 New Session',
    'admin.btn_configure_host': '🌐 Config QR Host',
    'admin.btn_switch_project': '🚀 Project for All',
    'admin.card_session_title': '⚙️ Session & Live Audience',
    'admin.active_slide': 'Active Stage Slide',
    'admin.slide_title_label': 'Current Slide Title:',
    'admin.remote_nav_label': 'Remote Stage Navigation:',
    'admin.connected_participants': 'Connected Participants',
    'admin.live_count': '{count} live',
    'admin.btn_publish_analytics': '📢 Project Summary on Stage',
    'admin.btn_end_session': '🛑 End Session',
    'admin.card_moderation_title': '💬 Question Moderation',
    'admin.btn_clear_all_q': '🗑️ Clear All',
    'admin.tab_pending': 'Pending',
    'admin.tab_approved': 'Approved',
    'admin.tab_answered': '✓ Answered',
    'admin.tab_rejected': 'Rejected',
    'admin.no_questions': 'No questions in this category.',
    'admin.no_polls': 'No polls registered for this presentation.',
    'admin.no_participants': 'No participants connected.',
    'admin.slide_actual_badge': '⭐ CURRENT SLIDE',
    'admin.votes_count': '{count} vote(s)',
    'admin.card_polls_title': '📊 Master Polls Control',
    'admin.btn_reset_all_polls': '⚠️ Reset All',
    'admin.export_session_json': '📥 Export Report (JSON)',
    'admin.export_session_csv': '📊 Export Votes (CSV)',
    'admin.export_session_md': '📝 Export Summary (Markdown)',
    'admin.btn_feature': '⭐ Feature on Stage',
    'admin.btn_unfeature': '⭐ On Stage',
    'admin.btn_approve': '✓ Approve',
    'admin.btn_reject': '✕ Reject',
    'admin.btn_answered': '✓ Answered',
    'admin.btn_reopen': '↩️ Reopen',
    'admin.btn_ban': '🚫 Ban',
    'admin.btn_unban': '✓ Unban',
    'admin.open_poll': '🟢 Open',
    'admin.close_poll': '🔴 Close',
    'admin.project_poll': '📊 Project',
    'admin.hide_poll': '🙈 Hide',
    'admin.reset_poll': '🔄 Reset',

    // QR Host Modal
    'host_modal.title': '🌐 Configure QR Code Host / IP',
    'host_modal.desc': 'Adjust the IP, FQDN, or port if the presentation is being remapped or served behind an external domain/tunnel.',
    'host_modal.mode_auto': 'Automatic (Detect Browser URL)',
    'host_modal.mode_custom': 'Custom Domain / IP / Port',
    'host_modal.label_custom_url': 'Base Access URL (with protocol):',
    'host_modal.custom_placeholder': 'e.g. https://live.mycompany.com or http://192.168.1.50:8080',
    'host_modal.preview_label': 'QR Code Target Link Preview:',
    'host_modal.btn_save': '💾 Apply New Address to Stage & QR',
    'host_modal.btn_reset': 'Reset to Default',

    // Presenter
    'presenter.live_badge': 'LIVE',
    'presenter.btn_large_qr': '📱 Giant QR (Q)',
    'presenter.btn_mini_qr': '🔲 Footer QR (W)',
    'presenter.btn_questions': '💬 Questions (M)',
    'presenter.btn_pulpit': '🎛️ Pulpit (P)',
    'presenter.btn_fullscreen': '⛶ Fullscreen (F)',
    'presenter.speaker_notes': '📝 Speaker Notes',
    'presenter.private_badge': 'Private',
    'presenter.no_notes': 'No speaker notes for this slide.',
    'presenter.shortcuts_hint': '💡 Shortcuts: ← / → (Navigate), Q (Giant QR), W (Footer QR), M (Questions Wall), P (Pulpit), V (Poll), R (Results), B (Blackout), F (Fullscreen).',
    'presenter.mini_qr_title': 'Join on Smartphone',
    'presenter.mini_qr_hint': 'Shortcut [Q] enlarge • [W] hide',
    'presenter.large_qr_title': '📲 JOIN THE LIVE PRESENTATION',
    'presenter.large_qr_desc': 'Scan with your smartphone camera to vote and ask questions',
    'presenter.featured_title': 'FEATURED AUDIENCE QUESTION',
    'presenter.dismiss_featured': '✕ Dismiss Feature',
    'presenter.slide_sorter_title': 'Quick Slide Sorter (Jump Directly):',

    // Audience Mobile
    'audience.live_badge': 'LIVE',
    'audience.btn_login': '🔐 Sign In',
    'audience.btn_profile': '👤 Profile',
    'audience.nav_prev': 'Previous',
    'audience.nav_live': 'Live Sync',
    'audience.nav_ask': 'Ask',
    'audience.nav_next': 'Next',
    'audience.ask_modal_title': 'Send Question to Presenter',
    'audience.ask_modal_desc': 'Your question will pass moderation before being projected on the stage screen.',
    'audience.ask_placeholder': 'Type your question...',
    'audience.btn_send_question': 'Send Question',
    'audience.my_questions_title': 'Your Submitted Questions',
    'audience.poll_open': '🟢 Voting Open',
    'audience.poll_closed': '🔴 Closed',
    'audience.poll_voted_feedback': '✓ Your vote (Option {opt}) is registered!',
    'audience.poll_closed_feedback': 'Voting closed by presenter.',
    'audience.poll_open_feedback': 'Select an option to vote (1 vote per participant).',
    'audience.session_closed_title': 'Presentation Ended',
    'audience.session_closed_desc': 'The session has been concluded by the presenter. Thank you for participating!',
    'audience.offline_banner': '⚠️ Connection unstable. Reconnecting...',

    // Themes
    'theme.label': 'Theme:',
    'theme.dark': 'Dark (Default)',
    'theme.light': 'Light',
    'theme.slate': 'Slate',
    'theme.high_contrast': 'High Contrast (WCAG)',

    // Languages
    'lang.label': 'Language:',
    'lang.pt': 'Português 🇧🇷',
    'lang.en': 'English 🇺🇸'
  }
};

export class I18nEngine {
  constructor() {
    this.currentLanguage = this._detectLanguage();
    this.listeners = [];
  }

  _detectLanguage() {
    const saved = localStorage.getItem('apres_user_lang');
    if (saved && (saved === 'pt-BR' || saved === 'en-US')) return saved;
    const browserLang = (navigator.language || navigator.userLanguage || '').toLowerCase();
    if (browserLang.startsWith('en')) return 'en-US';
    return 'pt-BR';
  }

  get language() {
    return this.currentLanguage;
  }

  setLanguage(lang) {
    if (lang !== 'pt-BR' && lang !== 'en-US') return;
    this.currentLanguage = lang;
    localStorage.setItem('apres_user_lang', lang);
    this.applyTranslations();
    this.listeners.forEach(cb => cb(this.currentLanguage));
  }

  toggleLanguage() {
    const next = this.currentLanguage === 'pt-BR' ? 'en-US' : 'pt-BR';
    this.setLanguage(next);
    return next;
  }

  /**
   * Traduz uma chave com suporte a interpolação simples ({count}, {opt})
   */
  t(key, params = {}) {
    const dict = TRANSLATIONS[this.currentLanguage] || TRANSLATIONS['pt-BR'];
    let text = dict[key] || TRANSLATIONS['pt-BR'][key] || key;
    Object.keys(params).forEach(p => {
      text = text.replace(new RegExp(`\\{${p}\\}`, 'g'), params[p]);
    });
    return text;
  }

  /**
   * Atualiza automaticamente todos os nós do DOM com data-i18n="chave"
   */
  applyTranslations(root = document) {
    const elements = root.querySelectorAll('[data-i18n]');
    elements.forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (key) {
        const translated = this.t(key);
        if (el.tagName === 'INPUT' && el.type === 'text') {
          el.placeholder = translated;
        } else if (el.tagName === 'TEXTAREA') {
          el.placeholder = translated;
        } else {
          el.textContent = translated;
        }
      }
    });

    const titleElements = root.querySelectorAll('[data-i18n-title]');
    titleElements.forEach(el => {
      const key = el.getAttribute('data-i18n-title');
      if (key) el.title = this.t(key);
    });

    const placeholderElements = root.querySelectorAll('[data-i18n-placeholder]');
    placeholderElements.forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (key) el.placeholder = this.t(key);
    });
  }

  onLanguageChange(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }
}

export const i18n = new I18nEngine();
