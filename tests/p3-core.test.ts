import { describe, expect, test } from 'bun:test'
import {
	dedupeKey,
	fuseResults,
} from '../plugins/reverse-image-search/js/core/fusion'
import {
	ConsentNotices,
	errorMessage,
	joinNames,
	providerStatus,
} from '../plugins/reverse-image-search/js/core/messages'
import { multipartFile } from '../plugins/reverse-image-search/js/core/multipart'
import {
	activeProviders,
	DefaultSettings,
	looksLikeKey,
	needsConsent,
	readSettings,
} from '../plugins/reverse-image-search/js/core/settings'
import {
	buildSauceNaoRequest,
	parseSauceNao,
	sauceNaoTier,
	siteName,
} from '../plugins/reverse-image-search/js/providers/saucenao'
import type {
	ProviderResult,
	Tier,
} from '../plugins/reverse-image-search/js/core/types'

const Key = 'abc123'.repeat(7)
const decode = (bytes: Uint8Array) => new TextDecoder().decode(bytes)

const sauce = (results: unknown[], header: Record<string, unknown> = {}) =>
	JSON.stringify({
		header: {
			status: 0,
			long_remaining: 149,
			short_remaining: 3,
			minimum_similarity: 50,
			...header,
		},
		results,
	})

const item = (
	similarity: string,
	data: Record<string, unknown>,
	hidden = 0,
) => ({
	header: {
		similarity,
		index_name: 'Index #5: Pixiv Images - 123_p0.jpg',
		hidden,
	},
	data,
})

describe('multipartFile', () => {
	test('wraps the bytes in one file field', () => {
		const bytes = new Uint8Array([0xff, 0xd8, 0x00, 0x0d, 0x0a])
		const { body, contentType } = multipartFile(
			'file',
			'image.jpg',
			'image/jpeg',
			bytes,
			'BOUND',
		)
		const head =
			'--BOUND\r\nContent-Disposition: form-data; name="file"; filename="image.jpg"\r\nContent-Type: image/jpeg\r\n\r\n'

		expect(contentType).toBe('multipart/form-data; boundary=BOUND')
		expect(decode(body.slice(0, head.length))).toBe(head)
		expect([...body.slice(head.length, head.length + bytes.length)]).toEqual([
			...bytes,
		])
		expect(decode(body.slice(head.length + bytes.length))).toBe(
			'\r\n--BOUND--\r\n',
		)
	})
})

describe('buildSauceNaoRequest', () => {
	test('asks for JSON from every database with an encoded key', () => {
		const request = buildSauceNaoRequest(
			new Uint8Array([1]),
			'image/png',
			'png',
			'a b',
			'X',
		)

		expect(request.url).toBe(
			'https://saucenao.com/search.php?output_type=2&numres=8&db=999&hide=0&api_key=a%20b',
		)
		expect(decode(request.body)).toContain('filename="image.png"')
		expect(decode(request.body)).not.toContain('discord')
	})
})

describe('parseSauceNao', () => {
	test('reads titles, authors, links, tiers, and quota', () => {
		const outcome = parseSauceNao(
			200,
			sauce([
				item('92.5', { title: 'Sunset', member_name: 'Artist', pixiv_id: 42 }),
			]),
		)

		expect(outcome).toEqual({
			kind: 'results',
			quotaLeft: 149,
			results: [
				{
					provider: 'saucenao',
					title: 'Sunset',
					detail: 'Artist · Pixiv Images',
					similarity: 0.925,
					tier: 'exact',
					url: 'https://www.pixiv.net/artworks/42',
					adult: false,
				},
			],
		})
	})

	test('uses the first https link, joins creator lists, and flags hidden results', () => {
		const outcome = parseSauceNao(
			200,
			sauce([
				item(
					'75',
					{
						ext_urls: [
							'http://insecure.test/a',
							'https://danbooru.donmai.us/post/show/1',
						],
						creator: ['A', 'B'],
					},
					1,
				),
			]),
		)

		expect(outcome).toMatchObject({
			results: [
				{
					title: 'Pixiv Images',
					detail: 'A, B · Pixiv Images',
					url: 'https://danbooru.donmai.us/post/show/1',
					tier: 'strong',
					adult: true,
				},
			],
		})
	})

	test('drops results below the minimum and skips bad entries', () => {
		const outcome = parseSauceNao(
			200,
			sauce([
				item('40', { title: 'Low' }),
				null,
				{ header: {} },
				item('60', { title: 'Ok' }),
			]),
		)

		expect(
			outcome.kind === 'results' && outcome.results.map(r => r.title),
		).toEqual(['Ok'])
	})

	test('treats no results as an empty list', () => {
		expect(parseSauceNao(200, sauce([]))).toMatchObject({
			kind: 'results',
			results: [],
		})
		expect(
			parseSauceNao(200, JSON.stringify({ header: { status: 0 } })),
		).toEqual({ kind: 'results', results: [] })
	})

	test('never shows a non-https link', () => {
		const outcome = parseSauceNao(
			200,
			sauce([item('95', { title: 'x', ext_urls: ['javascript:alert(1)'] })]),
		)

		expect(
			outcome.kind === 'results' && outcome.results[0]?.url,
		).toBeUndefined()
	})

	test('maps errors to clear categories', () => {
		const error = (status: number, message = '', code = -1) =>
			parseSauceNao(
				status,
				JSON.stringify({ header: { status: code, message } }),
			)

		expect(error(403, 'Invalid API key')).toEqual({
			kind: 'error',
			category: 'bad-key',
		})
		expect(error(429, 'Daily Search Limit Exceeded.')).toEqual({
			kind: 'error',
			category: 'quota',
		})
		expect(error(429, 'Search Rate Too High.')).toEqual({
			kind: 'error',
			category: 'rate-limited',
		})
		expect(error(200, 'Specified file does not seem to be an image.')).toEqual({
			kind: 'error',
			category: 'bad-image',
		})
		expect(error(200, 'Server problem', 1)).toEqual({
			kind: 'error',
			category: 'unexpected',
		})
		expect(parseSauceNao(503, 'down')).toEqual({
			kind: 'error',
			category: 'busy',
		})
		expect(parseSauceNao(413, '')).toEqual({
			kind: 'error',
			category: 'too-large',
		})
		expect(parseSauceNao(200, '<html>')).toEqual({
			kind: 'error',
			category: 'unexpected',
		})
		expect(parseSauceNao(404, '')).toEqual({
			kind: 'error',
			category: 'unexpected',
		})
	})

	test('tiers by percentage', () => {
		expect(sauceNaoTier(90)).toBe('exact')
		expect(sauceNaoTier(89.9)).toBe('strong')
		expect(sauceNaoTier(70)).toBe('strong')
		expect(sauceNaoTier(69.9)).toBe('possible')
	})

	test('shortens index names to the site', () => {
		expect(siteName('Index #9: Danbooru - abc.jpg')).toBe('Danbooru')
		expect(siteName('Index #21: Anime')).toBe('Anime')
	})
})

const result = (
	tier: Tier,
	similarity: number,
	url?: string,
	provider: 'tracemoe' | 'saucenao' = 'tracemoe',
): ProviderResult => ({
	provider,
	title: url ?? 't',
	detail: '',
	similarity,
	tier,
	adult: false,
	...(url ? { url } : {}),
})

describe('fuseResults', () => {
	test('ranks by tier, then score, then source order', () => {
		const fused = fuseResults(
			{
				tracemoe: {
					kind: 'results',
					results: [
						result('strong', 0.95, 'https://a.test/1'),
						result('possible', 0.99, 'https://a.test/2'),
					],
				},
				saucenao: {
					kind: 'results',
					results: [
						result('exact', 0.91, 'https://b.test/1', 'saucenao'),
						result('strong', 0.95, 'https://b.test/2', 'saucenao'),
					],
				},
			},
			['tracemoe', 'saucenao'],
		)

		expect(fused.map(r => r.url)).toEqual([
			'https://b.test/1',
			'https://a.test/1',
			'https://b.test/2',
			'https://a.test/2',
		])
	})

	test('dedupes the same page and keeps the best copy', () => {
		const fused = fuseResults(
			{
				tracemoe: {
					kind: 'results',
					results: [
						result('exact', 0.98, 'https://anilist.co/anime/1'),
						result('exact', 0.99, 'https://anilist.co/anime/1?x=2'),
						result('strong', 0.92, 'https://ANILIST.co/anime/1/'),
					],
				},
			},
			['tracemoe'],
		)

		expect(fused).toHaveLength(1)
		expect(fused[0]?.similarity).toBe(0.99)
	})

	test('ignores failed providers', () => {
		expect(
			fuseResults(
				{
					tracemoe: { kind: 'error', category: 'busy' },
					saucenao: { kind: 'results', results: [result('exact', 1)] },
				},
				['tracemoe', 'saucenao'],
			),
		).toHaveLength(1)
	})

	test('builds keys without query strings', () => {
		expect(dedupeKey(result('exact', 1, 'https://X.test/a/?q=1#h'))).toBe(
			'x.test/a',
		)
		expect(dedupeKey(result('exact', 1))).toBe('tracemoe|t|')
	})
})

describe('settings', () => {
	test('falls back to defaults for missing or malformed values', () => {
		expect(readSettings(undefined)).toEqual(DefaultSettings)
		expect(readSettings('x')).toEqual(DefaultSettings)
		expect(
			readSettings({
				tracemoe: 'yes',
				saucenaoKey: 5,
				consented: ['saucenao', 'evil', 3],
			}),
		).toEqual({ ...DefaultSettings, consented: ['saucenao'] })
	})

	test('trims keys and checks their shape', () => {
		expect(readSettings({ saucenaoKey: `  ${Key}\n` }).saucenaoKey).toBe(Key)
		expect(looksLikeKey(Key)).toBe(true)
		expect(looksLikeKey('short')).toBe(false)
		expect(looksLikeKey('has spaces in it and is long enough')).toBe(false)
	})

	test('only uses SauceNAO with a key', () => {
		expect(activeProviders(DefaultSettings)).toEqual([{ id: 'tracemoe' }])
		expect(activeProviders({ ...DefaultSettings, saucenaoKey: Key })).toEqual([
			{ id: 'tracemoe' },
			{ id: 'saucenao', key: Key },
		])
		expect(
			activeProviders({
				...DefaultSettings,
				tracemoe: false,
				saucenao: false,
				saucenaoKey: Key,
			}),
		).toEqual([])
	})

	test('asks for consent once per provider', () => {
		const specs = activeProviders({ ...DefaultSettings, saucenaoKey: Key })
		expect(needsConsent(DefaultSettings, specs)).toEqual([
			'tracemoe',
			'saucenao',
		])
		expect(
			needsConsent({ ...DefaultSettings, consented: ['tracemoe'] }, specs),
		).toEqual(['saucenao'])
	})
})

describe('messages', () => {
	test('names providers in plain English', () => {
		expect(joinNames(['tracemoe'])).toBe('trace.moe')
		expect(joinNames(['tracemoe', 'saucenao'])).toBe('trace.moe and SauceNAO')
	})

	test('reports each provider on its own line', () => {
		expect(
			providerStatus('saucenao', {
				kind: 'results',
				results: [result('exact', 1), result('possible', 0.5)],
				quotaLeft: 140,
			}),
		).toBe('SauceNAO: 1 match, 140 free searches left today.')
		expect(providerStatus('tracemoe', { kind: 'results', results: [] })).toBe(
			'trace.moe: no confident match.',
		)
		expect(
			providerStatus('saucenao', { kind: 'error', category: 'bad-key' }),
		).toBe(
			"SauceNAO: SauceNAO didn't accept your API key. Check it in plugin settings.",
		)
	})

	test('names the provider in errors', () => {
		expect(errorMessage('rate-limited', 'SauceNAO')).toContain('SauceNAO')
	})

	test('keeps the first-search notices calm but honest', () => {
		for (const notice of Object.values(ConsentNotices)) {
			expect(notice).toContain('receives the image')
			expect(notice).toContain('connection details')
		}
		expect(ConsentNotices.saucenao).not.toContain("doesn't keep")
	})
})
