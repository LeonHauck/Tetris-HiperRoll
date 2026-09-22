// ============================================================
// Configuração de ambiente do HiperTris
// ============================================================
// Deixe apiBaseUrl vazio para rodar 100% local (ranking salvo só no
// navegador, via localStorage). É o modo padrão ao abrir o index.html
// direto no PC ou testar antes de publicar.
//
// Ao hospedar no HostGator (ou outro servidor com PHP), suba a pasta
// "api/" junto com o site e aponte o caminho abaixo para ela.
// Exemplos:
//   apiBaseUrl: '/api'                                (mesmo domínio, na raiz)
//   apiBaseUrl: 'https://seusite.com.br/api'           (domínio completo)
//   apiBaseUrl: '/hipertris/api'                       (se o site ficar numa subpasta)
//
// No aplicativo desktop (.exe/Electron) esta configuração é ignorada:
// o jogo detecta automaticamente que está rodando no Electron e usa o
// arquivo de dados local, funcionando sem internet.
window.HIPERTRIS_CONFIG = {
  apiBaseUrl: '/api'
};
