export type ImageTargetKind = 'attachment' | 'embed' | 'viewer'

export interface ImageTarget {
	kind: ImageTargetKind
	label: string
	url: string
	proxyUrl?: string
	spoiler: boolean
	width?: number
	height?: number
}

export type Tier = 'exact' | 'strong' | 'possible'

export type ProviderId = 'tracemoe' | 'saucenao'

export interface ProviderResult {
	provider: ProviderId
	title: string
	detail: string
	similarity: number
	tier: Tier
	url?: string
	adult: boolean
}

export type ErrorCategory =
	| 'quota'
	| 'rate-limited'
	| 'too-large'
	| 'busy'
	| 'bad-image'
	| 'network'
	| 'timeout'
	| 'refresh-failed'
	| 'bad-key'
	| 'unexpected'

export type ProviderOutcome =
	| { kind: 'results'; results: ProviderResult[]; quotaLeft?: number }
	| { kind: 'error'; category: ErrorCategory }

export type ProviderOutcomes = Partial<Record<ProviderId, ProviderOutcome>>

// A search either fails before upload, or each provider reports on its own
export type SearchOutcome =
	| { kind: 'error'; category: ErrorCategory }
	| { kind: 'providers'; outcomes: ProviderOutcomes }
