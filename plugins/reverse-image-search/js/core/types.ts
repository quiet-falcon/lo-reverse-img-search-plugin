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

export interface ProviderResult {
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
	| 'unexpected'

export type ProviderOutcome =
	| { kind: 'results'; results: ProviderResult[]; quotaLeft?: number }
	| { kind: 'error'; category: ErrorCategory }
