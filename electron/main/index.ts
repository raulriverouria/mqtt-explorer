import { app, BrowserWindow, ipcMain, shell, dialog, nativeImage, Menu } from 'electron'
import { join } from 'path'
import { setupMqttHandlers } from './mqttClient'

const APP_NAME = 'MQTT Explorer'

let mainWindow: BrowserWindow | null = null

// ─── macOS Application Menu ──────────────────────────────────────────────────
// Building an explicit menu is the only reliable way to show a custom app name
// in the macOS menu bar during development (app.setName() alone is not enough
// because Electron uses the executable name for the first menu entry).

function buildAppMenu(): void {
  const isMac = process.platform === 'darwin'
  if (!isMac) return

  const template: Electron.MenuItemConstructorOptions[] = [
    // ── Application menu (first entry = app name in menu bar) ──
    {
      label: APP_NAME,
      submenu: [
        { label: `About ${APP_NAME}`, role: 'about' },
        { type: 'separator' },
        { label: 'Services', role: 'services' },
        { type: 'separator' },
        { label: `Hide ${APP_NAME}`, role: 'hide' },
        { label: 'Hide Others',      role: 'hideOthers' },
        { label: 'Show All',         role: 'unhide' },
        { type: 'separator' },
        { label: `Quit ${APP_NAME}`, role: 'quit' }
      ]
    },
    // ── Edit ──
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    // ── View ──
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    // ── Window ──
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' }
      ]
    }
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

// ─── Main window ─────────────────────────────────────────────────────────────

function createWindow(): void {
  const iconPath = join(__dirname, '../../build/icon_source_real.png')
  const appIcon = nativeImage.createFromPath(iconPath)

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    vibrancy: 'under-window',
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: '#0d1117',
    icon: appIcon,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow!.show()
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // Handler para seleccionar ficheros de certificado TLS
  ipcMain.handle('dialog:selectFile', async (_event, opts: {
    title: string
    filters: { name: string; extensions: string[] }[]
  }) => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: opts.title,
      filters: opts.filters,
      properties: ['openFile']
    })
    return result.canceled ? null : result.filePaths[0]
  })

  // Setup MQTT IPC handlers, pass reference to webContents for push events
  setupMqttHandlers(ipcMain, () => mainWindow?.webContents)
}

// ─── App lifecycle ───────────────────────────────────────────────────────────

// Must be called before app is ready so the name propagates correctly
app.setName(APP_NAME)

app.whenReady().then(() => {
  app.setAppUserModelId('com.mqttexplorer.mac')

  buildAppMenu()   // ← sets the native menu with APP_NAME as first entry
  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
