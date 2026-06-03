import { create } from 'zustand'
import type { ConnectionProfile } from '../types'

const STORAGE_KEY = 'mqtt-explorer-profiles'

function loadProfiles(): ConnectionProfile[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : defaultProfiles()
  } catch {
    return defaultProfiles()
  }
}

function defaultProfiles(): ConnectionProfile[] {
  return [
    {
      id: 'mosquitto-test',
      name: 'Mosquitto Test Broker',
      host: 'test.mosquitto.org',
      port: 1883,
      protocol: 'mqtt',
      clientId: '',
      username: '',
      password: '',
      useTls: false,
      rejectUnauthorized: true,
      mqttVersion: 4,
      keepalive: 60,
      subscriptions: ['#']
    }
  ]
}

interface ProfileStore {
  profiles: ConnectionProfile[]
  activeProfileId: string | null
  saveProfile: (profile: ConnectionProfile) => void
  deleteProfile: (id: string) => void
  setActive: (id: string | null) => void
}

export const useProfileStore = create<ProfileStore>((set, get) => ({
  profiles: loadProfiles(),
  activeProfileId: null,

  saveProfile: (profile) => {
    const profiles = get().profiles
    const idx = profiles.findIndex(p => p.id === profile.id)
    let updated: ConnectionProfile[]
    if (idx >= 0) {
      updated = [...profiles]
      updated[idx] = profile
    } else {
      updated = [...profiles, profile]
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    set({ profiles: updated })
  },

  deleteProfile: (id) => {
    const updated = get().profiles.filter(p => p.id !== id)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    set({ profiles: updated })
  },

  setActive: (id) => set({ activeProfileId: id })
}))
