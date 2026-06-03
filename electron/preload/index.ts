import { contextBridge, ipcRenderer } from 'electron'

export interface ConnectionOptions {
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
  mqttVersion: 3 | 5
  keepalive: number
  subscriptions: string[]
}

export interface MqttAPI {
  connect: (opts: ConnectionOptions) => Promise<{ success: boolean; error?: string }>
  disconnect: () => Promise<{ success: boolean }>
  publish: (args: { topic: string; payload: string; qos: 0|1|2; retain: boolean }) => Promise<{ success: boolean; error?: string }>
  subscribe: (args: { topic: string; qos: 0|1|2 }) => Promise<{ success: boolean; error?: string }>
  unsubscribe: (args: { topic: string }) => Promise<{ success: boolean; error?: string }>
  isConnected: () => Promise<{ connected: boolean }>
  onMessage: (cb: (msg: { topic: string; payload: string; qos: number; retain: boolean; timestamp: number }) => void) => () => void
  onStatus: (cb: (status: { connected?: boolean; reconnecting?: boolean; error?: string; url?: string }) => void) => () => void
  selectFile: (opts: { title: string; filters: { name: string; extensions: string[] }[] }) => Promise<string | null>
}

const mqttAPI: MqttAPI = {
  connect: (opts) => ipcRenderer.invoke('mqtt:connect', opts),
  disconnect: () => ipcRenderer.invoke('mqtt:disconnect'),
  publish: (args) => ipcRenderer.invoke('mqtt:publish', args),
  subscribe: (args) => ipcRenderer.invoke('mqtt:subscribe', args),
  unsubscribe: (args) => ipcRenderer.invoke('mqtt:unsubscribe', args),
  isConnected: () => ipcRenderer.invoke('mqtt:isConnected'),

  selectFile: (opts) => ipcRenderer.invoke('dialog:selectFile', opts),

  onMessage: (cb) => {
    const handler = (_: Electron.IpcRendererEvent, msg: Parameters<typeof cb>[0]) => cb(msg)
    ipcRenderer.on('mqtt:message', handler)
    return () => ipcRenderer.removeListener('mqtt:message', handler)
  },

  onStatus: (cb) => {
    const handler = (_: Electron.IpcRendererEvent, status: Parameters<typeof cb>[0]) => cb(status)
    ipcRenderer.on('mqtt:status', handler)
    return () => ipcRenderer.removeListener('mqtt:status', handler)
  }
}

contextBridge.exposeInMainWorld('mqttAPI', mqttAPI)
