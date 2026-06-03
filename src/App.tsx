import { useEffect, useState, useRef } from 'react'
import { useMqttStore } from './store/mqttStore'
import Toolbar from './components/Toolbar'
import TopicTree from './components/TopicTree'
import TopicFilter from './components/TopicFilter'
import MessageDetail from './components/MessageDetail'
import MessageHistory from './components/MessageHistory'
import PublishPanel from './components/PublishPanel'
import StatusBar from './components/StatusBar'
import ConnectionDialog from './components/ConnectionDialog'
import type { MqttMessage } from './types'

declare global {
  interface Window {
    mqttAPI: {
      connect: (opts: object) => Promise<{ success: boolean; error?: string }>
      disconnect: () => Promise<{ success: boolean }>
      publish: (args: object) => Promise<{ success: boolean; error?: string }>
      subscribe: (args: object) => Promise<{ success: boolean; error?: string }>
      unsubscribe: (args: object) => Promise<{ success: boolean; error?: string }>
      isConnected: () => Promise<{ connected: boolean }>
      onMessage: (cb: (msg: MqttMessage) => void) => () => void
      onStatus: (cb: (status: { connected?: boolean; reconnecting?: boolean; error?: string; url?: string }) => void) => () => void
      selectFile: (opts: { title: string; filters: { name: string; extensions: string[] }[] }) => Promise<string | null>
    }
  }
}

export default function App() {
  const [showConnect, setShowConnect] = useState(true)
  const { setStatus, addMessage, selectedTopic, statusInfo } = useMqttStore()

  const sidebarRef = useRef<HTMLDivElement>(null)
  const [sidebarWidth, setSidebarWidth] = useState(320)
  const isResizing = useRef(false)

  // Register IPC listeners once
  useEffect(() => {
    const mqttAPI = window.mqttAPI
    if (!mqttAPI) return

    const offMsg = mqttAPI.onMessage((msg) => {
      addMessage(msg)
    })

    const offStatus = mqttAPI.onStatus((s) => {
      if (s.connected) {
        setStatus({ status: 'connected', brokerUrl: s.url ?? '' })
        setShowConnect(false)
      } else if (s.reconnecting) {
        setStatus({ status: 'reconnecting' })
      } else if (s.error) {
        setStatus({ status: 'error', error: s.error })
        setShowConnect(true)
      } else {
        setStatus({ status: 'disconnected' })
        setShowConnect(true)
      }
    })

    return () => {
      offMsg()
      offStatus()
    }
  }, [addMessage, setStatus])

  // Sidebar resize
  const startResize = (e: React.MouseEvent) => {
    e.preventDefault()
    isResizing.current = true
    const startX = e.clientX
    const startW = sidebarWidth
    const onMove = (ev: MouseEvent) => {
      if (!isResizing.current) return
      const delta = ev.clientX - startX
      setSidebarWidth(Math.min(600, Math.max(180, startW + delta)))
    }
    const onUp = () => {
      isResizing.current = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  return (
    <div className="app-root">
      <Toolbar
        onConnect={() => setShowConnect(true)}
        isConnected={statusInfo.status === 'connected'}
      />

      <div className="app-body">
        {/* Sidebar */}
        <div
          className="sidebar"
          ref={sidebarRef}
          style={{ width: sidebarWidth }}
        >
          <div className="sidebar-header">
            <TopicFilter />
          </div>
          <div className="topic-tree-scroll">
            <TopicTree />
          </div>
        </div>

        {/* Resize handle */}
        <div
          className={`resize-handle${isResizing.current ? ' active' : ''}`}
          onMouseDown={startResize}
        />

        {/* Main panel */}
        <div className="main-panel">
          {selectedTopic ? (
            <div className="panel-sections">
              <MessageDetail />
              <MessageHistory />
              <PublishPanel />
            </div>
          ) : (
            <div className="main-panel-empty">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                <path d="M2 17l10 5 10-5"/>
                <path d="M2 12l10 5 10-5"/>
              </svg>
              <p>Select a topic from the tree to inspect</p>
            </div>
          )}
        </div>
      </div>

      <StatusBar />

      {showConnect && (
        <ConnectionDialog onClose={() => setShowConnect(false)} />
      )}
    </div>
  )
}
