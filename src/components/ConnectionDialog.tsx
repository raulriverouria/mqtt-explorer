import React, { useState, useEffect } from 'react'
import { useProfileStore } from '../store/profileStore'
import { useMqttStore } from '../store/mqttStore'
import type { ConnectionProfile } from '../types'

interface ConnectionDialogProps {
  onClose: () => void
}

const emptyProfile = (): ConnectionProfile => ({
  id: '',
  name: 'New Connection',
  host: 'localhost',
  port: 1883,
  protocol: 'mqtt',
  clientId: '',
  username: '',
  password: '',
  useTls: false,
  rejectUnauthorized: true,
  tlsCaPath: undefined,
  tlsCertPath: undefined,
  tlsKeyPath: undefined,
  mqttVersion: 4, // default to 4 (v3.1.1)
  keepalive: 60,
  subscriptions: ['#']
})

/** Devuelve el badge de formato según la extensión del fichero */
function certFormatBadge(filePath: string | undefined): string | null {
  if (!filePath) return null
  const ext = filePath.split('.').pop()?.toLowerCase()
  if (ext === 'pem') return 'PEM'
  if (ext === 'crt' || ext === 'cer') return 'CRT'
  if (ext === 'key') return 'KEY'
  return ext?.toUpperCase() ?? '?'
}

/** Devuelve solo el nombre del fichero (sin ruta) */
function basename(filePath: string | undefined): string {
  if (!filePath) return ''
  return filePath.split(/[\\/]/).pop() ?? filePath
}

export default function ConnectionDialog({ onClose }: ConnectionDialogProps) {
  const { profiles, saveProfile, deleteProfile, activeProfileId, setActive } = useProfileStore()
  const { setStatus, clearAll } = useMqttStore()

  const [selectedProfile, setSelectedProfile] = useState<ConnectionProfile>(emptyProfile())
  const [error, setError] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)

  // Load active or first profile on mount
  useEffect(() => {
    if (activeProfileId) {
      const active = profiles.find(p => p.id === activeProfileId)
      if (active) {
        setSelectedProfile({ ...active })
        return
      }
    }
    if (profiles.length > 0) {
      setSelectedProfile({ ...profiles[0] })
      setActive(profiles[0].id)
    } else {
      const newP = emptyProfile()
      newP.id = `profile-${Date.now()}`
      setSelectedProfile(newP)
    }
  }, [activeProfileId, profiles, setActive])

  const handleProtocolChange = (proto: 'mqtt' | 'mqtts' | 'ws' | 'wss') => {
    const isTls = proto === 'mqtts' || proto === 'wss'
    let port = selectedProfile.port
    if (proto === 'mqtt') port = 1883
    else if (proto === 'mqtts') port = 8883
    else if (proto === 'ws') port = 8080
    else if (proto === 'wss') port = 443

    setSelectedProfile(prev => ({
      ...prev,
      protocol: proto,
      useTls: isTls,
      port
    }))
  }

  const handleAddSubscription = () => {
    setSelectedProfile(prev => ({
      ...prev,
      subscriptions: [...prev.subscriptions, '#']
    }))
  }

  const handleSubChange = (idx: number, val: string) => {
    setSelectedProfile(prev => {
      const subs = [...prev.subscriptions]
      subs[idx] = val
      return { ...prev, subscriptions: subs }
    })
  }

  const handleRemoveSub = (idx: number) => {
    setSelectedProfile(prev => {
      const subs = prev.subscriptions.filter((_, i) => i !== idx)
      return { ...prev, subscriptions: subs.length ? subs : ['#'] }
    })
  }

  /** Abre el diálogo nativo del SO para seleccionar un fichero de certificado */
  const handleSelectCertFile = async (field: 'tlsCaPath' | 'tlsCertPath' | 'tlsKeyPath', title: string) => {
    if (!window.mqttAPI?.selectFile) return
    const path = await window.mqttAPI.selectFile({
      title,
      filters: [
        { name: 'Certificados TLS', extensions: ['pem', 'crt', 'cer', 'key'] },
        { name: 'PEM', extensions: ['pem'] },
        { name: 'Certificado', extensions: ['crt', 'cer'] },
        { name: 'Clave privada', extensions: ['key'] },
        { name: 'Todos los ficheros', extensions: ['*'] }
      ]
    })
    if (path) {
      setSelectedProfile(prev => ({ ...prev, [field]: path }))
    }
  }

  const handleSave = () => {
    saveProfile(selectedProfile)
    setActive(selectedProfile.id)
  }

  const handleCreateNew = () => {
    const newP = emptyProfile()
    newP.id = `profile-${Date.now()}`
    setSelectedProfile(newP)
    setActive(null)
  }

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    deleteProfile(id)
    if (activeProfileId === id) {
      setActive(null)
    }
  }

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault()
    setConnecting(true)
    setError(null)

    // Save the profile before connecting
    saveProfile(selectedProfile)
    setActive(selectedProfile.id)

    // Clear state in preparation for new messages
    clearAll()
    setStatus({ status: 'connecting' })

    try {
      if (window.mqttAPI) {
        // Convert profile details for MQTT client
        const connOpts = {
          host: selectedProfile.host,
          port: Number(selectedProfile.port),
          protocol: selectedProfile.protocol,
          clientId: selectedProfile.clientId,
          username: selectedProfile.username || undefined,
          password: selectedProfile.password || undefined,
          useTls: selectedProfile.useTls,
          rejectUnauthorized: selectedProfile.rejectUnauthorized,
          tlsCaPath: selectedProfile.tlsCaPath,
          tlsCertPath: selectedProfile.tlsCertPath,
          tlsKeyPath: selectedProfile.tlsKeyPath,
          mqttVersion: Number(selectedProfile.mqttVersion) as 3 | 5,
          keepalive: Number(selectedProfile.keepalive) || 60,
          subscriptions: selectedProfile.subscriptions
        }

        const res = await window.mqttAPI.connect(connOpts)
        if (res.success) {
          onClose()
        } else {
          setError(res.error ?? 'Failed to connect')
          setStatus({ status: 'error', error: res.error })
        }
      } else {
        setError('MQTT API not available in window context')
        setStatus({ status: 'error', error: 'IPC client unavailable' })
      }
    } catch (err: unknown) {
      setError(String(err))
      setStatus({ status: 'error', error: String(err) })
    } finally {
      setConnecting(false)
    }
  }

  return (
    <div className="dialog-overlay">
      <div className="dialog">
        <div className="dialog-header">
          <span className="dialog-title">Connect to Broker</span>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>
            <svg style={{ width: 16, height: 16 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="dialog-body">
          {/* Profiles list */}
          <div className="dialog-profiles">
            <div className="dialog-profiles-title">Saved Connections</div>
            {profiles.map(p => (
              <div
                key={p.id}
                className={`profile-item ${selectedProfile.id === p.id ? 'active' : ''}`}
                onClick={() => {
                  setSelectedProfile({ ...p })
                  setActive(p.id)
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="profile-name">{p.name}</div>
                  <div className="profile-host">{p.host}</div>
                </div>
                <span className="profile-delete" onClick={(e) => handleDelete(p.id, e)}>
                  <svg style={{ width: 12, height: 12 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                  </svg>
                </span>
              </div>
            ))}
            <button
              className="btn btn-outline btn-sm"
              style={{ width: '100%', marginTop: 8 }}
              onClick={handleCreateNew}
            >
              + New Profile
            </button>
          </div>

          {/* Form */}
          <form className="dialog-form" onSubmit={handleConnect}>
            <div className="form-row">
              <div className="form-field">
                <span className="form-label">Profile Name</span>
                <input
                  type="text"
                  className="form-input"
                  value={selectedProfile.name}
                  onChange={e => setSelectedProfile({ ...selectedProfile, name: e.target.value })}
                  placeholder="e.g. Local Mosquitto"
                  required
                />
              </div>
            </div>

            <div className="form-row form-row-3">
              <div className="form-field">
                <span className="form-label">Host</span>
                <input
                  type="text"
                  className="form-input mono"
                  value={selectedProfile.host}
                  onChange={e => setSelectedProfile({ ...selectedProfile, host: e.target.value })}
                  placeholder="localhost"
                  required
                />
              </div>
              <div className="form-field">
                <span className="form-label">Protocol</span>
                <select
                  className="form-select"
                  value={selectedProfile.protocol}
                  onChange={e => handleProtocolChange(e.target.value as 'mqtt' | 'mqtts' | 'ws' | 'wss')}
                >
                  <option value="mqtt">mqtt://</option>
                  <option value="mqtts">mqtts://</option>
                  <option value="ws">ws://</option>
                  <option value="wss">wss://</option>
                </select>
              </div>
              <div className="form-field">
                <span className="form-label">Port</span>
                <input
                  type="number"
                  className="form-input mono"
                  value={selectedProfile.port}
                  onChange={e => setSelectedProfile({ ...selectedProfile, port: Number(e.target.value) })}
                  required
                />
              </div>
            </div>

            <div className="form-row form-row-2">
              <div className="form-field">
                <span className="form-label">Username</span>
                <input
                  type="text"
                  className="form-input"
                  value={selectedProfile.username}
                  onChange={e => setSelectedProfile({ ...selectedProfile, username: e.target.value })}
                  placeholder="Optional"
                />
              </div>
              <div className="form-field">
                <span className="form-label">Password</span>
                <input
                  type="password"
                  className="form-input"
                  value={selectedProfile.password}
                  onChange={e => setSelectedProfile({ ...selectedProfile, password: e.target.value })}
                  placeholder="Optional"
                />
              </div>
            </div>

            <div className="form-row form-row-2">
              <div className="form-field">
                <span className="form-label">Client ID</span>
                <input
                  type="text"
                  className="form-input mono"
                  value={selectedProfile.clientId}
                  onChange={e => setSelectedProfile({ ...selectedProfile, clientId: e.target.value })}
                  placeholder="auto-generated"
                />
              </div>
              <div className="form-field">
                <span className="form-label">MQTT Version</span>
                <select
                  className="form-select"
                  value={selectedProfile.mqttVersion}
                  onChange={e => setSelectedProfile({ ...selectedProfile, mqttVersion: Number(e.target.value) as 3 | 4 | 5 })}
                >
                  <option value={4}>v3.1.1</option>
                  <option value={5}>v5.0</option>
                </select>
              </div>
            </div>

            <div className="form-row form-row-2">
              <div className="form-field">
                <span className="form-label">Keep Alive (s)</span>
                <input
                  type="number"
                  className="form-input mono"
                  value={selectedProfile.keepalive}
                  onChange={e => setSelectedProfile({ ...selectedProfile, keepalive: Number(e.target.value) })}
                />
              </div>
              <div className="form-field" style={{ justifyContent: 'center' }}>
                <span className="form-label" style={{ marginBottom: 4 }}>TLS: Reject Unauthorized</span>
                <div className="toggle-row">
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={selectedProfile.rejectUnauthorized}
                      disabled={!selectedProfile.useTls}
                      onChange={e => setSelectedProfile({ ...selectedProfile, rejectUnauthorized: e.target.checked })}
                    />
                    <span className="toggle-track" />
                    <span className="toggle-thumb" />
                  </label>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    {selectedProfile.useTls ? 'Enable CA validation' : 'Not TLS'}
                  </span>
                </div>
              </div>
            </div>

            {/* ── Sección TLS / Certificados ── solo visible cuando useTls está activo */}
            {selectedProfile.useTls && (
              <>
                <div className="tls-section-header">
                  <svg style={{ width: 13, height: 13 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  <span>Client Certificates (TLS)</span>
                </div>

                {/* CA Certificate */}
                <div className="form-field">
                  <span className="form-label">CA Certificate</span>
                  <div className="cert-picker">
                    <div className="cert-picker-info">
                      {selectedProfile.tlsCaPath ? (
                        <>
                          <span className="cert-badge">{certFormatBadge(selectedProfile.tlsCaPath)}</span>
                          <span className="cert-filename mono">{basename(selectedProfile.tlsCaPath)}</span>
                        </>
                      ) : (
                        <span className="cert-placeholder">No file selected (.pem / .crt)</span>
                      )}
                    </div>
                    <div className="cert-picker-actions">
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => handleSelectCertFile('tlsCaPath', 'Select CA Certificate')}
                      >
                        Browse…
                      </button>
                      {selectedProfile.tlsCaPath && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-icon"
                          onClick={() => setSelectedProfile(p => ({ ...p, tlsCaPath: undefined }))}
                          title="Clear"
                        >
                          <svg style={{ width: 11, height: 11 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Client Certificate */}
                <div className="form-field">
                  <span className="form-label">Client Certificate</span>
                  <div className="cert-picker">
                    <div className="cert-picker-info">
                      {selectedProfile.tlsCertPath ? (
                        <>
                          <span className="cert-badge">{certFormatBadge(selectedProfile.tlsCertPath)}</span>
                          <span className="cert-filename mono">{basename(selectedProfile.tlsCertPath)}</span>
                        </>
                      ) : (
                        <span className="cert-placeholder">No file selected (.pem / .crt)</span>
                      )}
                    </div>
                    <div className="cert-picker-actions">
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => handleSelectCertFile('tlsCertPath', 'Select Client Certificate')}
                      >
                        Browse…
                      </button>
                      {selectedProfile.tlsCertPath && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-icon"
                          onClick={() => setSelectedProfile(p => ({ ...p, tlsCertPath: undefined }))}
                          title="Clear"
                        >
                          <svg style={{ width: 11, height: 11 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Client Key */}
                <div className="form-field">
                  <span className="form-label">Client Key</span>
                  <div className="cert-picker">
                    <div className="cert-picker-info">
                      {selectedProfile.tlsKeyPath ? (
                        <>
                          <span className="cert-badge">{certFormatBadge(selectedProfile.tlsKeyPath)}</span>
                          <span className="cert-filename mono">{basename(selectedProfile.tlsKeyPath)}</span>
                        </>
                      ) : (
                        <span className="cert-placeholder">No file selected (.key / .pem)</span>
                      )}
                    </div>
                    <div className="cert-picker-actions">
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => handleSelectCertFile('tlsKeyPath', 'Select Client Key')}
                      >
                        Browse…
                      </button>
                      {selectedProfile.tlsKeyPath && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-icon"
                          onClick={() => setSelectedProfile(p => ({ ...p, tlsKeyPath: undefined }))}
                          title="Clear"
                        >
                          <svg style={{ width: 11, height: 11 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}

            <div className="divider" />

            <div className="form-field">
              <span className="form-label">Subscriptions</span>
              <div className="subs-list">
                {selectedProfile.subscriptions.map((sub, idx) => (
                  <div key={idx} className="subs-item">
                    <input
                      type="text"
                      className="form-input mono"
                      value={sub}
                      onChange={e => handleSubChange(idx, e.target.value)}
                      placeholder="#"
                      required
                    />
                    {selectedProfile.subscriptions.length > 1 && (
                      <button
                        type="button"
                        className="btn btn-outline btn-icon"
                        onClick={() => handleRemoveSub(idx)}
                      >
                        <svg style={{ width: 12, height: 12 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  className="subs-add-btn"
                  onClick={handleAddSubscription}
                >
                  + Add Topic Subscription
                </button>
              </div>
            </div>

            {error && (
              <div className="banner banner-error">
                <svg style={{ width: 14, height: 14 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
                <span>{error}</span>
              </div>
            )}
          </form>
        </div>

        <div className="dialog-footer">
          <div className="dialog-footer-left">
            <button className="btn btn-outline" onClick={handleSave}>
              Save
            </button>
          </div>
          <div className="dialog-footer-right">
            <button className="btn btn-outline" onClick={onClose} disabled={connecting}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleConnect} disabled={connecting}>
              {connecting ? 'Connecting...' : 'Connect'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

