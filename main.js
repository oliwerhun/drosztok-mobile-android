const { app, BrowserWindow } = require('electron');
const serve = require('electron-serve');
const path = require('path');

// A 'dist' mappát szolgáljuk ki, amit az 'npx expo export -p web' hoz létre
const loadURL = serve({ directory: 'dist' });

async function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
        },
        title: "Elitdroszt",
        backgroundColor: '#ffffff',
        show: false // Csak akkor mutatjuk, ha betöltött
    });

    // Várakozunk a betöltésre
    await loadURL(win);

    win.show();

    // Opcionális: DevTools (fejlesztéshez)
    // win.webContents.openDevTools();
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
