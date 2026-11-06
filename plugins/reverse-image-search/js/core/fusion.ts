import type {
	ProviderId,
	ProviderOutcomes,
	ProviderResult,
	Tier,
} from './types'

const TierRank: Record<Tier, number> = { exact: 0, strong: 1, possible: 2 }
const UrlRe = /^https:\/\/([^/?#]+)([^?#]*)/i

// Same page, ignoring query strings, counts as one result
export function dedupeKey(result: ProviderResult) {
	const match = result.url ? UrlRe.exec(result.url) : null
	if (match) return `${match[1]!.toLowerCase()}${match[2]!.replace(/\/+$/, '')}`

	return `${result.provider}|${result.title}|${result.detail}`
}

// Scores from different providers aren't comparable, so rank by tier first
export function fuseResults(
	outcomes: ProviderOutcomes,
	order: ProviderId[],
): ProviderResult[] {
	const ranked = order
		.flatMap(id => {
			const outcome = outcomes[id]
			return outcome?.kind === 'results' ? outcome.results : []
		})
		.map((result, index) => ({ result, index }))
		.sort(
			(a, b) =>
				TierRank[a.result.tier] - TierRank[b.result.tier] ||
				b.result.similarity - a.result.similarity ||
				a.index - b.index,
		)

	const seen = new Set<string>()
	const fused: ProviderResult[] = []
	for (const { result } of ranked) {
		// Mirrors of one post carry different links but read identically
		const keys = [dedupeKey(result), lookKey(result)]
		if (keys.some(key => seen.has(key))) continue
		for (const key of keys) seen.add(key)
		fused.push(result)
	}

	return fused
}

const lookKey = (result: ProviderResult) =>
	`look|${result.provider}|${result.title}|${result.detail}|${result.similarity}`
