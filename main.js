const { app, BrowserWindow, Menu, dialog, session } = require('electron');
const path = require('path');

const NUPHY_VID = 0x19f5;
const VIA_USAGE_PAGE = 0xff60;

function createWindow() {
  const win = new BrowserWindow({
    width: 1240,
    height: 920,
    minWidth: 980,
    minHeight: 680,
    backgroundColor: '#ebebeb',
    autoHideMenuBar: true,
    title: 'Air75 Config',
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });

  // WebHID: Electron has no device chooser. The renderer already filters to VIA interfaces;
  // one match is taken as is, several are offered in a small dialog (NuPhy first).
  win.webContents.session.on('select-hid-device', async (event, details, callback) => {
    event.preventDefault();
    const list = details.deviceList
      .filter(d => !d.collections || d.collections.some(c => c.usagePage === VIA_USAGE_PAGE))
      .sort((a, b) => (b.vendorId === NUPHY_VID) - (a.vendorId === NUPHY_VID));
    if (list.length <= 1) return callback(list[0]?.deviceId || '');
    const ru = app.getLocale().startsWith('ru');
    const { response } = await dialog.showMessageBox(win, {
      type: 'question',
      title: ru ? 'Выбор клавиатуры' : 'Choose keyboard',
      message: ru ? 'Какую клавиатуру настроить?' : 'Which keyboard do you want to configure?',
      buttons: [...list.map(d => d.name || `0x${d.vendorId.toString(16)}:0x${d.productId.toString(16)}`), ru ? 'Отмена' : 'Cancel'],
      cancelId: list.length,
      noLink: true,
    });
    callback(list[response]?.deviceId || '');
  });

  const demo = process.argv.find(a => a === '--demo' || a.startsWith('--demo='));
  win.loadFile(path.join(__dirname, 'src', 'index.html'), demo ? { search: 'demo=' + (demo.split('=')[1] || '') } : undefined);

  // --shot=<file.png> [--click=<selector,...>]: render, optionally click through, save a screenshot, quit (for testing).
  const shot = process.argv.find(a => a.startsWith('--shot='));
  if (shot) {
    const clicks = (process.argv.find(a => a.startsWith('--click=')) || '--click=').slice(8).split(',').filter(Boolean);
    win.webContents.once('did-finish-load', async () => {
      const wait = ms => new Promise(r => setTimeout(r, ms));
      await wait(500);
      for (const sel of clicks) {
        await win.webContents.executeJavaScript(`document.querySelector(${JSON.stringify(sel)})?.click()`);
        await wait(400);
      }
      const js = process.argv.find(a => a.startsWith('--js='));
      if (js) { await win.webContents.executeJavaScript(js.slice(5)); await wait(400); }
      const img = await win.webContents.capturePage();
      require('fs').writeFileSync(shot.slice(7), img.toPNG());
      app.quit();
    });
  }
}

// No menu: otherwise pressing Alt while testing keys pops up the menu bar.
Menu.setApplicationMenu(null);

app.whenReady().then(() => {
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => permission === 'hid');
  // the renderer only ever asks for VIA raw-HID interfaces, so any HID device it requested may be reopened
  session.defaultSession.setDevicePermissionHandler(details => details.deviceType === 'hid');
  createWindow();
});

app.on('window-all-closed', () => app.quit());
