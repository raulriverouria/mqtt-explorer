import { useState, useMemo } from 'react'
import { useMqttStore } from '../store/mqttStore'

function syntaxHighlightJson(json: string): string {
  const escaped = json
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  return escaped.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
    (match) => {
      let cls = 'json-number'
      if (/^"/.test(match)) {
        if (/:$/.test(match)) {
          cls = 'json-key'
        } else {
          cls = 'json-string'
        }
      } else if (/true|false/.test(match)) {
        cls = 'json-bool'
      } else if (/null/.test(match)) {
        cls = 'json-null'
      }
      return `<span class="${cls}">${match}</span>`
    }
  )
}

export default function MessageDetail() {
  const { selectedTopic, topicTree } = useMqttStore()
  const [copied, setCopied] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [showRaw, setShowRaw] = useState(false)

  // Find the node in the tree to get the latest message details
  const node = useMemo(() => {
    if (!selectedTopic) return null
    const parts = selectedTopic.split('/')
    let current = topicTree
    let foundNode = null
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      const n = current.get(part)
      if (!n) break
      if (i === parts.length - 1) {
        foundNode = n
      }
      current = n.children
    }
    return foundNode
  }, [selectedTopic, topicTree])

  const msg = node?.latestMessage

  const formattedPayload = useMemo(() => {
    if (!msg) return { html: '', isJson: false, raw: '' }
    const trimmed = msg.payload.trim()
    if (!showRaw && (trimmed.startsWith('{') || trimmed.startsWith('['))) {
      try {
        const parsed = JSON.parse(trimmed)
        const pretty = JSON.stringify(parsed, null, 2)
        return {
          html: syntaxHighlightJson(pretty),
          isJson: true,
          raw: pretty
        }
      } catch {
        // Fallback to raw if JSON parsing fails
      }
    }
    return { html: msg.payload, isJson: false, raw: msg.payload }
  }, [msg, showRaw])

  const copyToClipboard = () => {
    if (!msg) return
    navigator.clipboard.writeText(formattedPayload.raw).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const clearRetained = async () => {
    if (!selectedTopic || !window.mqttAPI) return
    setClearing(true)
    try {
      await window.mqttAPI.publish({
        topic: selectedTopic,
        payload: '',
        qos: 0,
        retain: true
      })
    } catch (err) {
      console.error('Failed to clear retained message:', err)
    } finally {
      setClearing(false)
    }
  }

  if (!selectedTopic) return null

  return (
    <div className="message-detail-container flex-col">
      {/* Panel Header */}
      <div className="panel-header">
        <span className="panel-title">{selectedTopic}</span>
        {msg && (
          <div className="panel-meta">
            <span className="badge badge-qos">QoS {msg.qos}</span>
            {msg.retain && <span className="badge badge-retain">Retained</span>}
          </div>
        )}
      </div>

      {/* Message Detail Card */}
      <div className="message-detail">
        {msg ? (
          <>
            <div className="message-detail-meta">
              <div className="meta-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <span className="meta-label">Time:</span>
                <span>{new Date(msg.timestamp).toLocaleString()}</span>
              </div>

              <div className="toggle-row" style={{ marginLeft: 'auto', gap: 6 }}>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Raw</span>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={showRaw}
                    onChange={e => setShowRaw(e.target.checked)}
                  />
                  <span className="toggle-track" />
                  <span className="toggle-thumb" />
                </label>
              </div>

              {msg.retain && (
                <button
                  className="btn btn-outline btn-sm btn-danger"
                  style={{ marginLeft: 8 }}
                  onClick={clearRetained}
                  disabled={clearing}
                >
                  {clearing ? 'Clearing...' : 'Clear Retained'}
                </button>
              )}
            </div>

            <div className="payload-box-wrapper" style={{ position: 'relative' }}>
              {formattedPayload.isJson ? (
                <pre
                  className="payload-box"
                  dangerouslySetInnerHTML={{ __html: formattedPayload.html }}
                />
              ) : (
                <pre className="payload-box">{formattedPayload.html}</pre>
              )}

              <button
                className="btn btn-outline btn-sm payload-copy-btn"
                onClick={copyToClipboard}
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </>
        ) : (
          <div style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>
            No messages received yet for this topic.
          </div>
        )}
      </div>
    </div>
  )
}
