import { multipartFile } from '../core/multipart'
import { isHttps } from '../core/signed-url'
import type {
	ErrorCategory,
	ProviderOutcome,
	ProviderResult,
	Tier,
} from '../core/types'

export const SauceNaoHost = 'saucenao.com'
export const SauceNaoKeyPage = 'https://saucenao.com/user.php?page=search-api'

const SearchUrl = 'https://saucenao.com/search.php'
const ExactSimilarity = 90
const StrongSimilarity = 70
const MaxResults = 8

type Unknowns = Record<string, unknown>

const isRecord = (value: unknown): value is Unknowns =>
	typeof value === 'object' && value !== null

const text = (value: unknown) =>
	typeof value === 'string'
		? value.trim()
		: Array.isArray(value)
			? value.filter(item => typeof item === 'string').join(', ')
			: ''

const TitleFields = ['title', 'eng_name', 'jp_name', 'material', 'source']
const AuthorFields = [
	'author',
	'member_name',
	'creator',
	'author_name',
	'artist',
	'user_name',
	'twitter_user_handle',
	'company',
]

export function buildSauceNaoRequest(
	bytes: Uint8Array,
	mime: string,
	ext: string,
	key: string,
	boundary: string,
) {
	const { body, contentType } = multipartFile(
		'file',
		`image.${ext}`,
		mime,
		bytes,
		boundary,
	)

	return {
		method: 'POST' as const,
		url: `${SearchUrl}?output_type=2&numres=${MaxResults}&db=999&hide=0&api_key=${encodeURIComponent(key)}`,
		headers: { 'Content-Type': contentType },
		body,
	}
}

export function sauceNaoTier(similarity: number): Tier {
	if (similarity >= ExactSimilarity) return 'exact'
	if (similarity >= StrongSimilarity) return 'strong'
	return 'possible'
}

function categoryFor(status: number, message: string): ErrorCategory {
	if (/daily/i.test(message)) return 'quota'
	if (
		status === 403 ||
		/api key|invalid key|key.*(invalid|incorrect)/i.test(message)
	)
		return 'bad-key'
	if (status === 429 || /rate|too many|too high/i.test(message))
		return 'rate-limited'
	if (status === 413 || /too large|file size/i.test(message)) return 'too-large'
	if (/image|file/i.test(message)) return 'bad-image'
	if (status >= 500) return 'busy'
	return 'unexpected'
}

export function parseSauceNao(status: number, body: string): ProviderOutcome {
	let data: unknown
	try {
		data = JSON.parse(body)
	} catch {
		return {
			kind: 'error',
			category: status === 200 ? 'unexpected' : categoryFor(status, ''),
		}
	}

	const header = isRecord(data) && isRecord(data.header) ? data.header : {}
	const message = text(header.message)
	const code = Number(header.status ?? 0)
	if (status !== 200 || code !== 0)
		return { kind: 'error', category: categoryFor(status, message) }

	const minimum = Number(header.minimum_similarity)
	const raw = isRecord(data) && Array.isArray(data.results) ? data.results : []
	const results = raw
		.map(toResult)
		.filter((result): result is ProviderResult => result !== undefined)
		.filter(
			result => !Number.isFinite(minimum) || result.similarity * 100 >= minimum,
		)
		.slice(0, MaxResults)

	const outcome: ProviderOutcome = { kind: 'results', results }
	const left = Number(header.long_remaining)
	if (header.long_remaining !== undefined && Number.isFinite(left))
		outcome.quotaLeft = Math.max(0, left)

	return outcome
}

function toResult(value: unknown): ProviderResult | undefined {
	if (!isRecord(value) || !isRecord(value.header)) return

	const similarity = Number(value.header.similarity)
	if (!Number.isFinite(similarity)) return

	const data = isRecord(value.data) ? value.data : {}
	const site = siteName(text(value.header.index_name))
	const named = firstText(data, TitleFields)
	const author = firstText(data, AuthorFields)
	// Posts often have no title, so name them by who posted where
	const title =
		named || (author && site ? `${author} on ${site}` : site || author)
	const result: ProviderResult = {
		provider: 'saucenao',
		title: title || 'Untitled',
		detail: named ? [author, site].filter(Boolean).join(' · ') : '',
		similarity: similarity / 100,
		tier: sauceNaoTier(similarity),
		adult: Number(value.header.hidden) > 0,
	}

	const url = linkFor(data)
	if (url) result.url = url

	return result
}

const firstText = (data: Unknowns, fields: string[]) => {
	for (const field of fields) {
		const value = text(data[field])
		if (value) return value
	}
	return ''
}

// "Index #5: Pixiv Images - 1234_p0.jpg" becomes "Pixiv Images"
export const siteName = (indexName: string) =>
	indexName
		.replace(/^Index #\d+:\s*/i, '')
		.replace(/\s+-\s+.*$/, '')
		.replace(/\*+$/, '')
		.trim()

function linkFor(data: Unknowns) {
	const pixiv = Number(data.pixiv_id)
	if (Number.isInteger(pixiv) && pixiv > 0)
		return `https://www.pixiv.net/artworks/${pixiv}`

	const urls = Array.isArray(data.ext_urls) ? data.ext_urls : []
	const candidates = [...urls, data.source]
	return candidates.find(
		(url): url is string => typeof url === 'string' && isHttps(url),
	)
}
