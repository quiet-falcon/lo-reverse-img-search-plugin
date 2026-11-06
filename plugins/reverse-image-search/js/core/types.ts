export type ImageTargetKind = 'attachment' | 'embed' | 'viewer'

export interface ImageTarget {
	kind: ImageTargetKind
	label: string
	url: string
	proxyUrl?: string
	spoiler: boolean
}
