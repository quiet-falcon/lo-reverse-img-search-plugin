import { EmptyList, readStoredList } from './community-list'
import { VisionAvailable } from './features'
import { readSavedImages } from './hash-list'
import type { CommunityList } from './community-list'
import type { SavedImage } from './hash-list'
import type { ProviderId } from './types'

export type Settings = {
	tracemoe: boolean
	saucenao: boolean
	saucenaoKey: string
	vision: boolean
	visionKey: string
	visionText: boolean
	consented: ProviderId[]
	hashList: SavedImage[]
	communityList: CommunityList
	communityCheckedAt: number
}

export const DefaultSettings: Settings = {
	tracemoe: true,
	saucenao: true,
	saucenaoKey: '',
	vision: false,
	visionKey: '',
	visionText: true,
	consented: [],
	hashList: [],
	communityList: EmptyList,
	communityCheckedAt: 0,
}

const ProviderIds: ProviderId[] = ['tracemoe', 'saucenao', 'vision']
const KeyRe = /^[A-Za-z0-9]{20,64}$/
const VisionKeyRe = /^[A-Za-z0-9_-]{30,64}$/

export const cleanKey = (key: string) => key.trim()
export const looksLikeKey = (key: string) => KeyRe.test(cleanKey(key))
export const looksLikeVisionKey = (key: string) =>
	VisionKeyRe.test(cleanKey(key))

export function readSettings(value: unknown): Settings {
	if (typeof value !== 'object' || value === null) return { ...DefaultSettings }

	const raw = value as Record<string, unknown>
	const flag = (name: 'tracemoe' | 'saucenao' | 'vision' | 'visionText') =>
		typeof raw[name] === 'boolean' ? raw[name] : DefaultSettings[name]

	return {
		tracemoe: flag('tracemoe'),
		saucenao: flag('saucenao'),
		saucenaoKey:
			typeof raw.saucenaoKey === 'string' ? cleanKey(raw.saucenaoKey) : '',
		vision: flag('vision'),
		visionKey: typeof raw.visionKey === 'string' ? cleanKey(raw.visionKey) : '',
		visionText: flag('visionText'),
		consented: Array.isArray(raw.consented)
			? ProviderIds.filter(id => (raw.consented as unknown[]).includes(id))
			: [],
		hashList: readSavedImages(raw.hashList),
		communityList: readStoredList(raw.communityList),
		communityCheckedAt:
			typeof raw.communityCheckedAt === 'number' ? raw.communityCheckedAt : 0,
	}
}

export type ProviderSpec =
	| { id: 'tracemoe' }
	| { id: 'saucenao'; key: string }
	| { id: 'vision'; key: string; text: boolean }

// The copy check works from the key alone, so it ignores the search switch
export function visionSpec(settings: Settings): ProviderSpec | undefined {
	if (!looksLikeVisionKey(settings.visionKey)) return

	return {
		id: 'vision',
		key: cleanKey(settings.visionKey),
		text: settings.visionText,
	}
}

export function activeProviders(settings: Settings): ProviderSpec[] {
	const specs: ProviderSpec[] = []
	if (settings.tracemoe) specs.push({ id: 'tracemoe' })
	if (settings.saucenao && looksLikeKey(settings.saucenaoKey))
		specs.push({ id: 'saucenao', key: cleanKey(settings.saucenaoKey) })

	const vision = settings.vision ? visionSpec(settings) : undefined
	if (vision) specs.push(vision)

	return specs
}

// A saved Vision switch does nothing while Vision is parked
export const availableProviders = (settings: Settings) =>
	activeProviders(settings).filter(
		spec => VisionAvailable || spec.id !== 'vision',
	)

export const copyCheckSpec = (settings: Settings) =>
	VisionAvailable ? visionSpec(settings) : undefined

export const needsConsent = (settings: Settings, specs: ProviderSpec[]) =>
	specs.map(spec => spec.id).filter(id => !settings.consented.includes(id))
