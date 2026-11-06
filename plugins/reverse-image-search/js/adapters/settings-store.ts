import { readSettings } from '../core/settings'
import type { JsonStorage } from '@valenced/json-storage'
import type { Settings } from '../core/settings'
import type { ProviderId } from '../core/types'

let storage: JsonStorage<Settings> | undefined

export function bindSettings(value: JsonStorage<Settings>) {
	storage = value
	return () => {
		storage = undefined
	}
}

export const currentSettings = () => readSettings(storage?.cache)

// Re-renders the caller whenever settings change
export function useSettings() {
	return readSettings(storage?.use())
}

export function updateSettings(value: Partial<Settings>) {
	return storage?.set(value) ?? Promise.resolve()
}

export function recordConsent(ids: ProviderId[]) {
	const consented = currentSettings().consented
	const next = [...new Set([...consented, ...ids])]
	return updateSettings({ consented: next })
}
