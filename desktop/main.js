/**
 * Invólucro desktop do Dr. Moo.
 *
 * O app web exportado (`npm run build:web` → `dist-web/`) é um site estático
 * completo, que roda offline: o SQLite vive no navegador, em WebAssembly. Para
 * virar aplicativo de computador, basta uma janela que carregue esse arquivo —
 * é o que este script faz, e nada além disso.
 *
 * Não há dependência do Electron no repositório: ele é baixado na hora de
 * empacotar (veja o README). Assim o projeto continua leve e o `npm install`
 * do app não puxa 200 MB de runtime que a demonstração não usa.
 */
const { app, BrowserWindow, shell } = require('electron');
const path = require('node:path');

// Empacotado, o site vai para dentro da pasta do app; em desenvolvimento, ele
// fica na raiz do repositório, onde o `npm run build:web` o deixou.
const PASTA_WEB = require('node:fs').existsSync(path.join(__dirname, 'dist-web'))
  ? path.join(__dirname, 'dist-web')
  : path.join(__dirname, '..', 'dist-web');

function criarJanela() {
  const janela = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#FFFFFF',
    title: 'Dr. Moo',
    icon: path.join(__dirname, '..', 'apps', 'mobile', 'assets', 'icon.png'),
    webPreferences: {
      // A página é nossa e local, mas não há motivo para afrouxar o isolamento.
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  janela.setMenuBarVisibility(false);
  void janela.loadFile(path.join(PASTA_WEB, 'index.html'));

  // Link externo (uma fonte da Embrapa, por exemplo) abre no navegador do
  // sistema, e não dentro da janela do app.
  janela.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  criarJanela();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) criarJanela();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
