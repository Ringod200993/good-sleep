(() => {
  const install = document.getElementById('installApp');
  const status = document.getElementById('pwaStatus');
  let prompt;
  const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  function connection() {
    status.textContent = navigator.onLine ? (standalone() ? 'ホーム画面アプリで利用中' : 'ホーム画面に追加できます') : 'オフライン · 記録はこの端末に保存';
  }
  connection();
  addEventListener('online', connection);
  addEventListener('offline', connection);
  addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    prompt = event;
    install.textContent = 'アプリをインストール';
  });
  addEventListener('appinstalled', () => {prompt = null; install.hidden = true; connection();});
  install.hidden = !!standalone();
  install.addEventListener('click', async () => {
    if (prompt) {
      await prompt.prompt();
      await prompt.userChoice;
      prompt = null;
      install.textContent = 'ホーム画面への追加方法';
    } else document.getElementById('installHelp').showModal();
  });
  document.getElementById('closeInstallHelp').onclick = () => document.getElementById('installHelp').close();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('./sw.js', {scope: './'}).then(async registration => {
      await navigator.serviceWorker.ready;
      if (navigator.onLine) status.textContent = 'オフラインで開く準備ができました';
    }).catch(() => {status.textContent = 'オンラインで利用中 · オフライン準備は再接続後にお試しください';});
  }
})();
