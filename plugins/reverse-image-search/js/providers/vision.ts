import { toBase64 } from '../core/base64'
import { siteOf } from '../core/copy-check'
import { ascii } from '../core/multipart'
import { isHttps } from '../core/signed-url'
import type {
	ErrorCategory,
	PageMatch,
	ProviderOutcome,
	ProviderResult,
	WebFindings,
} from '../core/types'

export const VisionHost = 'vision.googleapis.com'
export const VisionKeyPage =
	'https://console.cloud.google.com/apis/library/vision.googleapis.com'

const AnnotateUrl = 'https://vision.googleapis.com/v1/images:annotate'
const MaxWebResults = 50
const MaxPageResults = 16
const MaxImageResults = 8
const MaxSimilarResults = 4
const MaxEntities = 5
const MaxTextLength = 200

type Unknowns = Record<string, unknown>

const isRecord = (value: unknown): value is Unknowns =>
	typeof value === 'object' && value !== null

const list = (value: unknown) => (Array.isArray(value) ? value : [])
const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '')

// The key goes in a header, because a URL can leak through scans and logs
export function buildVisionRequest(
	bytes: Uint8Array,
	key: string,
	withText: boolean,
) {
	const features: Unknowns[] = [
		{ type: 'WEB_DETECTION', maxResults: MaxWebResults },
	]
	if (withText) features.push({ type: 'TEXT_DETECTION', maxResults: 1 })

	return {
		method: 'POST' as const,
		url: AnnotateUrl,
		headers: {
			'Content-Type': 'application/json',
			'x-goog-api-key': key,
		},
		body: ascii(
			JSON.stringify({
				requests: [{ image: { content: toBase64(bytes) }, features }],
			}),
		),
	}
}

const GrpcErrors: Record<number, ErrorCategory> = {
	3: 'bad-image',
	7: 'needs-setup',
	8: 'rate-limited',
	13: 'busy',
	14: 'busy',
}

function categoryFor(status: number, message: string): ErrorCategory {
	if (status === 401 || /api key/i.test(message)) return 'bad-key'
	if (status === 403) return 'needs-setup'
	if (status === 400) return 'bad-image'
	if (status === 413) return 'too-large'
	if (status === 429) return 'rate-limited'
	if (status >= 500) return 'busy'
	return 'unexpected'
}

export function parseVision(status: number, body: string): ProviderOutcome {
	let data: unknown
	try {
		data = JSON.parse(body)
	} catch {
		return {
			kind: 'error',
			category: status === 200 ? 'unexpected' : categoryFor(status, ''),
		}
	}

	if (status !== 200) {
		const error = isRecord(data) && isRecord(data.error) ? data.error : {}
		return { kind: 'error', category: categoryFor(status, text(error.message)) }
	}

	const responses = isRecord(data) ? list(data.responses) : []
	const first = responses[0]
	if (!isRecord(first)) return { kind: 'error', category: 'unexpected' }

	// A request can succeed while the image inside it fails
	if (isRecord(first.error))
		return {
			kind: 'error',
			category: GrpcErrors[Number(first.error.code)] ?? 'unexpected',
		}

	const detection = isRecord(first.webDetection) ? first.webDetection : {}
	const web = toFindings(detection, first.textAnnotations)

	return { kind: 'results', results: toResults(detection, web), web }
}

const urlsOf = (value: unknown) =>
	list(value)
		.map(item => (isRecord(item) ? text(item.url) : ''))
		.filter(isHttps)

function toFindings(detection: Unknowns, annotations: unknown): WebFindings {
	const rawPages = list(detection.pagesWithMatchingImages).filter(isRecord)
	const pages = rawPages.flatMap(toPage).sort(exactFirst)

	const exact = new Set([
		...urlsOf(detection.fullMatchingImages),
		...rawPages.flatMap(page => urlsOf(page.fullMatchingImages)),
	])
	const edited = new Set(
		[
			...urlsOf(detection.partialMatchingImages),
			...rawPages.flatMap(page => urlsOf(page.partialMatchingImages)),
		].filter(url => !exact.has(url)),
	)

	return {
		pages,
		exactCopies: exact.size,
		editedCopies: edited.size,
		capped: [
			detection.pagesWithMatchingImages,
			detection.fullMatchingImages,
			detection.partialMatchingImages,
		].some(items => list(items).length >= MaxWebResults),
		bestGuess: firstLabel(detection.bestGuessLabels),
		entities: toEntities(detection.webEntities),
		text: toText(annotations),
	}
}

const exactFirst = (a: PageMatch, b: PageMatch) =>
	Number(b.exact) - Number(a.exact)

function toPage(page: Unknowns): PageMatch[] {
	const url = text(page.url)
	if (!isHttps(url)) return []

	const site = siteOf(url)
	return [
		{
			url,
			site,
			title: cleanTitle(text(page.pageTitle)) || site,
			exact: urlsOf(page.fullMatchingImages).length > 0,
		},
	]
}

const Entities: Record<string, string> = {
	'&amp;': '&',
	'&lt;': '<',
	'&gt;': '>',
	'&quot;': '"',
	'&#39;': "'",
}

// Google marks matched words with bold tags in page titles
export const cleanTitle = (title: string) =>
	title
		.replace(/<[^>]*>/g, '')
		.replace(/&(?:amp|lt|gt|quot|#39);/g, entity => Entities[entity] ?? entity)
		.trim()

function firstLabel(value: unknown) {
	const label = list(value).find(isRecord)
	return label ? text(label.label) : ''
}

const toEntities = (value: unknown) =>
	list(value)
		.map(item => (isRecord(item) ? text(item.description) : ''))
		.filter(Boolean)
		.slice(0, MaxEntities)

// The first annotation holds all the text found in the image
function toText(value: unknown) {
	const first = list(value)[0]
	if (!isRecord(first)) return ''

	const found = text(first.description).replace(/\s+/g, ' ')
	return found.length > MaxTextLength
		? `${found.slice(0, MaxTextLength)}…`
		: found
}

function toResults(detection: Unknowns, web: WebFindings) {
	const pages = web.pages
		.slice(0, MaxPageResults)
		.map(page =>
			toResult(
				page.title,
				page.site,
				page.url,
				page.exact ? 'exact' : 'strong',
			),
		)

	// Images only stand in when Google found no page holding them
	const images = pages.length
		? []
		: [
				...imageResults(detection.fullMatchingImages, 'exact'),
				...imageResults(detection.partialMatchingImages, 'strong'),
			].slice(0, MaxImageResults)
	const similar = urlsOf(detection.visuallySimilarImages)
		.slice(0, MaxSimilarResults)
		.map(url => toResult(siteOf(url), 'Visually similar', url, 'possible'))

	return [...pages, ...images, ...similar]
}

const imageResults = (value: unknown, tier: ProviderResult['tier']) =>
	urlsOf(value).map(url => toResult(siteOf(url), 'Image file', url, tier))

// Vision gives no score, so ranking relies on tier alone
const toResult = (
	title: string,
	detail: string,
	url: string,
	tier: ProviderResult['tier'],
): ProviderResult => ({
	provider: 'vision',
	title,
	detail,
	similarity: 0,
	tier,
	url,
	adult: false,
	noScore: true,
})
