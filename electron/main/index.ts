import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron'
import { join } from 'path'
import { setupMqttHandlers } from './mqttClient'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    vibrancy: 'under-window',
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: '#0d1117',
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

app.whenReady().then(() => {
  app.setAppUserModelId('com.mqttexplorer')

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
