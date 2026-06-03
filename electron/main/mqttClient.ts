import mqtt, { MqttClient, IClientOptions } from 'mqtt'
import type { IpcMain, WebContents } from 'electron'
import { readFileSync } from 'fs'
import { extname } from 'path'

interface ConnectionOptions {
  host: string
  port: number
  protocol: 'mqtt' | 'mqtts' | 'ws' | 'wss'
  clientId: string
  username?: string
  password?: string
  useTls: boolean
  rejectUnauthorized: boolean
  tlsCaPath?: string
  tlsCertPath?: string
  tlsKeyPath?: string
  mqttVersion: 3 | 4 | 5
  keepalive: number
  subscriptions: string[]
}

/**
 * Lee un fichero de certificado/clave y lo devuelve como Buffer.
 * Detecta el formato por extensión y por cabecera PEM.
 * Tipos soportados: .pem, .crt, .cer, .key
 */
function loadCertFile(filePath: string): Buffer {
  const buf = readFileSync(filePath)
  const ext = extname(filePath).toLowerCase()
  const content = buf.toString('utf8')

  // Buscamos de forma genérica bloques PEM 
  // por si el fichero contiene otros tipos de bloques PEM con texto descriptivo previo.
  const genericPemRegex = /-----BEGIN ([A-Z0-9 ]+)-----[\s\S]*?-----END \1-----/g
  const genericMatches = [...content.matchAll(genericPemRegex)]

  if (genericMatches.length > 0) {
    const cleanPem = genericMatches.map(m => m[0]).join('\n')
    return Buffer.from(cleanPem, 'utf8')
  }

  // Si no se encuentra ningún bloque PEM, comprobamos si por extensión debería ser PEM
  if (ext === '.pem' || ext === '.crt' || ext === '.cer' || ext === '.key') {
    console.warn(`[TLS] El fichero ${filePath} no parece estar en formato PEM. Se cargará como binario (DER).`)
  }

  return buf
}

let client: MqttClient | null = null

export function setupMqttHandlers(
  ipcMain: IpcMain,
  getWebContents: () => WebContents | undefined
): void {
  ipcMain.handle('mqtt:connect', async (_event, opts: ConnectionOptions) => {
    if (client) {
      client.end(true)
      client = null
    }

    const protocol = opts.useTls
      ? opts.protocol === 'ws' ? 'wss' : 'mqtts'
      : opts.protocol

    const url = `${protocol}://${opts.host}:${opts.port}`

    const clientOptions: IClientOptions = {
      clientId: opts.clientId || `mqtt-explorer-${Math.random().toString(16).slice(2, 10)}`,
      clean: true,
      keepalive: opts.keepalive || 60,
      reconnectPeriod: 3000,
      connectTimeout: 10000,
      protocolVersion: opts.mqttVersion === 5 ? 5 : (opts.mqttVersion === 3 ? 3 : 4),
    }

    if (opts.username) clientOptions.username = opts.username
    if (opts.password) clientOptions.password = opts.password

    if (opts.useTls) {
      clientOptions.rejectUnauthorized = opts.rejectUnauthorized

      // Cargar certificados de cliente si se han proporcionado
      try {
        if (opts.tlsCaPath) {
          clientOptions.ca = loadCertFile(opts.tlsCaPath)
        }
        if (opts.tlsCertPath) {
          clientOptions.cert = loadCertFile(opts.tlsCertPath)
        }
        if (opts.tlsKeyPath) {
          clientOptions.key = loadCertFile(opts.tlsKeyPath)
        }
      } catch (err: unknown) {
        return { success: false, error: `Error al cargar certificados TLS: ${String(err)}` }
      }
    }

    return new Promise((resolve) => {
      try {
        client = mqtt.connect(url, clientOptions)

        const timeout = setTimeout(() => {
          resolve({ success: false, error: 'Connection timeout' })
        }, 12000)

        client.on('connect', () => {
          clearTimeout(timeout)
          // Subscribe to default topics
          const subs = opts.subscriptions?.length ? opts.subscriptions : ['#']
          subs.forEach(sub => client?.subscribe(sub, { qos: 1 }))
          getWebContents()?.send('mqtt:status', { connected: true, url })
          resolve({ success: true })
        })

        client.on('error', (err) => {
          clearTimeout(timeout)
          getWebContents()?.send('mqtt:status', { connected: false, error: err.message })
          resolve({ success: false, error: err.message })
        })

        client.on('close', () => {
          getWebContents()?.send('mqtt:status', { connected: false })
        })

        client.on('reconnect', () => {
          getWebContents()?.send('mqtt:status', { reconnecting: true })
        })

        client.on('message', (topic, payload, packet) => {
          const payloadStr = payload.toString()
          getWebContents()?.send('mqtt:message', {
            topic,
            payload: payloadStr,
            qos: packet.qos,
            retain: packet.retain,
            timestamp: Date.now()
          })
        })
      } catch (err: unknown) {
        resolve({ success: false, error: String(err) })
      }
    })
  })

  ipcMain.handle('mqtt:disconnect', async () => {
    if (client) {
      client.end(true)
      client = null
    }
    return { success: true }
  })

  ipcMain.handle('mqtt:publish', async (_event, { topic, payload, qos, retain }: {
    topic: string
    payload: string
    qos: 0 | 1 | 2
    retain: boolean
  }) => {
    if (!client || !client.connected) {
      return { success: false, error: 'Not connected' }
    }
    return new Promise((resolve) => {
      client!.publish(topic, payload, { qos, retain }, (err) => {
        if (err) resolve({ success: false, error: err.message })
        else resolve({ success: true })
      })
    })
  })

  ipcMain.handle('mqtt:subscribe', async (_event, { topic, qos }: { topic: string; qos: 0 | 1 | 2 }) => {
    if (!client || !client.connected) return { success: false, error: 'Not connected' }
    return new Promise((resolve) => {
      client!.subscribe(topic, { qos }, (err) => {
        if (err) resolve({ success: false, error: err.message })
        else resolve({ success: true })
      })
    })
  })

  ipcMain.handle('mqtt:unsubscribe', async (_event, { topic }: { topic: string }) => {
    if (!client || !client.connected) return { success: false, error: 'Not connected' }
    return new Promise((resolve) => {
      client!.unsubscribe(topic, (err?: Error) => {
        if (err) resolve({ success: false, error: err.message })
        else resolve({ success: true })
      })
    })
  })

  ipcMain.handle('mqtt:isConnected', () => {
    return { connected: client?.connected ?? false }
  })
}
