import { isHttps } from '../core/signed-url'
import type {
	ErrorCategory,
	ProviderOutcome,
	ProviderResult,
	Tier,
} from '../core/types'

export const TraceMoeSearchUrl =
	'https://api.trace.moe/search?anilistInfo&cutBorders'
export const TraceMoeHost = 'api.trace.moe'

const ExactSimilarity = 0.97
const StrongSimilarity = 0.9
const MaxResults = 8

type Unknowns = Record<string, unknown>

const isRecord = (value: unknown): value is Unknowns =>
	typeof value === 'object' && value !== null

const StatusErrors: Record<number, ErrorCategory> = {
	400: 'bad-image',
	402: 'quota',
	413: 'too-large',
	429: 'rate-limited',
	503: 'busy',
}

export function buildTraceMoeRequest(bytes: Uint8Array, mime: string) {
	return {
		method: 'POST' as const,
		url: TraceMoeSearchUrl,
		headers: { 'Content-Type': mime },
		body: bytes,
	}
}

export function traceMoeTier(similarity: number): Tier {
	if (similarity >= ExactSimilarity) return 'exact'
	if (similarity >= StrongSimilarity) return 'strong'
	return 'possible'
}

export function parseTraceMoe(status: number, body: string): ProviderOutcome {
	if (status !== 200)
		return { kind: 'error', category: StatusErrors[status] ?? 'unexpected' }

	let data: unknown
	try {
		data = JSON.parse(body)
	} catch {
		return { kind: 'error', category: 'unexpected' }
	}
	if (!isRecord(data) || !Array.isArray(data.result))
		return { kind: 'error', category: 'unexpected' }

	const results = data.result
		.map(toResult)
		.filter((result): result is ProviderResult => result !== undefined)
		.slice(0, MaxResults)
	const quota = Number(data.quota)
	const used = Number(data.quotaUsed)
	const outcome: ProviderOutcome = { kind: 'results', results }
	if (Number.isFinite(quota) && Number.isFinite(used))
		outcome.quotaLeft = Math.max(0, quota - used)

	return outcome
}

function toResult(value: unknown): ProviderResult | undefined {
	if (!isRecord(value)) return

	const similarity = Number(value.similarity)
	if (!Number.isFinite(similarity)) return

	const anilist = isRecord(value.anilist) ? value.anilist : undefined
	const title = isRecord(anilist?.title) ? anilist.title : undefined
	const name =
		text(title?.english) ||
		text(title?.romaji) ||
		text(title?.native) ||
		'Unknown anime'
	const id = Number(anilist?.id ?? value.anilist)
	const url =
		Number.isInteger(id) && id > 0
			? `https://anilist.co/anime/${id}`
			: undefined

	const result: ProviderResult = {
		provider: 'tracemoe',
		title: name,
		detail: detailFor(value),
		similarity,
		tier: traceMoeTier(similarity),
		adult: anilist?.isAdult === true,
	}
	if (url && isHttps(url)) result.url = url

	return result
}

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '')

function detailFor(value: Unknowns) {
	const episode = Number(value.episode)
	const at = Number(value.at ?? value.from)
	const parts = []
	if (Number.isFinite(episode) && episode > 0) parts.push(`Episode ${episode}`)
	if (Number.isFinite(at) && at >= 0) parts.push(`at ${timestamp(at)}`)

	return parts.join(' ')
}

export function timestamp(seconds: number) {
	const whole = Math.floor(seconds)
	const hours = Math.floor(whole / 3600)
	const minutes = Math.floor((whole % 3600) / 60)
	const secs = String(whole % 60).padStart(2, '0')

	return hours
		? `${hours}:${String(minutes).padStart(2, '0')}:${secs}`
		: `${minutes}:${secs}`
}
