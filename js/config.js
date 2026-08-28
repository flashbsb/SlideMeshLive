/**
 * Configuração da Aplicação & Firebase
 * Plataforma de Apresentação HTML Interativa
 * 
 * NOTA: Substitua os valores abaixo com as credenciais do seu projeto Firebase.
 * Se mantido com valores padrão ou sem credenciais, a plataforma utilizará
 * automaticamente o canal em tempo real local (BroadcastChannel / WebRTC fallback)
 * para testes imediatos entre abas e navegadores.
 */

export const APP_CONFIG = {
  // Nome e versão
  appName: "Plataforma de Apresentação Online",
  version: "1.0.0",

  // Configurações do Firebase (Preencher com suas credenciais do Firebase Console)
  firebase: {
    apiKey: "SUA_API_KEY_AQUI",
    authDomain: "seu-projeto.firebaseapp.com",
    databaseURL: "https://seu-projeto-default-rtdb.firebaseio.com",
    projectId: "seu-projeto",
    storageBucket: "seu-projeto.appspot.com",
    messagingSenderId: "000000000000",
    appId: "1:000000000000:web:000000000000"
  },

  // Configuração de sincronização
  sync: {
    heartbeatIntervalMs: 10000,
    connectionTimeoutMs: 5000,
    enableLocalChannelFallback: true // Permite teste em tempo real local entre abas
  }
};
