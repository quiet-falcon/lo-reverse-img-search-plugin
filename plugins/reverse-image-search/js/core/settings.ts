import type { ProviderId } from './types'

export type Settings = {
	tracemoe: boolean
	saucenao: boolean
	saucenaoKey: string
	consented: ProviderId[]
}

export const DefaultSettings: Settings = {
	tracemoe: true,
	saucenao: true,
	saucenaoKey: '',
	consented: [],
}

const ProviderIds: ProviderId[] = ['tracemoe', 'saucenao']
const KeyRe = /^[A-Za-z0-9]{20,64}$/

export const cleanKey = (key: string) => key.trim()
export const looksLikeKey = (key: string) => KeyRe.test(cleanKey(key))

export function readSettings(value: unknown): Settings {
	if (typeof value !== 'object' || value === null) return { ...DefaultSettings }

	const raw = value as Record<string, unknown>
	const flag = (name: 'tracemoe' | 'saucenao') =>
		typeof raw[name] === 'boolean' ? raw[name] : DefaultSettings[name]

	return {
		tracemoe: flag('tracemoe'),
		saucenao: flag('saucenao'),
		saucenaoKey:
			typeof raw.saucenaoKey === 'string' ? cleanKey(raw.saucenaoKey) : '',
		consented: Array.isArray(raw.consented)
			? ProviderIds.filter(id => (raw.consented as unknown[]).includes(id))
			: [],
	}
}

export type ProviderSpec = { id: 'tracemoe' } | { id: 'saucenao'; key: string }

export function activeProviders(settings: Settings): ProviderSpec[] {
	const specs: ProviderSpec[] = []
	if (settings.tracemoe) specs.push({ id: 'tracemoe' })
	if (settings.saucenao && looksLikeKey(settings.saucenaoKey))
		specs.push({ id: 'saucenao', key: cleanKey(settings.saucenaoKey) })

	return specs
}

export const needsConsent = (settings: Settings, specs: ProviderSpec[]) =>
	specs.map(spec => spec.id).filter(id => !settings.consented.includes(id))
