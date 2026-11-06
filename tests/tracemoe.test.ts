import { describe, expect, test } from 'bun:test'
import {
	buildTraceMoeRequest,
	parseTraceMoe,
	TraceMoeSearchUrl,
	timestamp,
} from '../plugins/reverse-image-search/js/providers/tracemoe'

const body = (result: unknown[], extra = {}) =>
	JSON.stringify({
		frameCount: 1,
		error: '',
		quota: 100,
		quotaUsed: 3,
		result,
		...extra,
	})

const match = {
	anilist: {
		id: 99939,
		title: { native: 'ネコぱら', romaji: 'Nekopara OVA', english: null },
		isAdult: false,
	},
	episode: 2,
	at: 98.2231,
	similarity: 0.981,
}

describe('buildTraceMoeRequest', () => {
	test('posts the raw bytes with their sniffed type', () => {
		const bytes = new Uint8Array([1, 2])
		const request = buildTraceMoeRequest(bytes, 'image/png')

		expect(request).toEqual({
			method: 'POST',
			url: TraceMoeSearchUrl,
			headers: { 'Content-Type': 'image/png' },
			body: bytes,
		})
	})
})

describe('parseTraceMoe', () => {
	test('reads titles, episodes, tiers, links, and quota', () => {
		const outcome = parseTraceMoe(200, body([match]))

		expect(outcome).toEqual({
			kind: 'results',
			quotaLeft: 97,
			results: [
				{
					title: 'Nekopara OVA',
					detail: 'Episode 2 at 1:38',
					similarity: 0.981,
					tier: 'exact',
					url: 'https://anilist.co/anime/99939',
					adult: false,
				},
			],
		})
	})

	test('handles a bare AniList ID and missing fields', () => {
		const outcome = parseTraceMoe(200, body([{ anilist: 5, similarity: 0.92 }]))

		expect(outcome).toMatchObject({
			kind: 'results',
			results: [
				{
					title: 'Unknown anime',
					detail: '',
					tier: 'strong',
					url: 'https://anilist.co/anime/5',
				},
			],
		})
	})

	test('marks low similarity as possible and keeps the adult flag', () => {
		const outcome = parseTraceMoe(
			200,
			body([
				{
					...match,
					similarity: 0.5,
					anilist: { ...match.anilist, isAdult: true },
				},
			]),
		)

		expect(outcome).toMatchObject({
			results: [{ tier: 'possible', adult: true }],
		})
	})

	test('returns an empty list for no matches', () => {
		expect(parseTraceMoe(200, body([]))).toMatchObject({
			kind: 'results',
			results: [],
		})
	})

	test('maps provider errors', () => {
		const cases: [number, string][] = [
			[400, 'bad-image'],
			[402, 'quota'],
			[413, 'too-large'],
			[429, 'rate-limited'],
			[503, 'busy'],
			[500, 'unexpected'],
			[401, 'unexpected'],
			[403, 'unexpected'],
			[404, 'unexpected'],
		]

		for (const [status, category] of cases)
			expect(parseTraceMoe(status, '')).toEqual({
				kind: 'error',
				category,
			} as never)
	})

	test('rejects malformed JSON and odd shapes', () => {
		for (const text of ['not json', '{}', '{"result":"x"}', 'null'])
			expect(parseTraceMoe(200, text)).toEqual({
				kind: 'error',
				category: 'unexpected',
			})
	})

	test('skips broken result entries', () => {
		const outcome = parseTraceMoe(200, body([null, { similarity: 'x' }, match]))

		expect(outcome).toMatchObject({ results: [{ title: 'Nekopara OVA' }] })
	})
})

describe('timestamp', () => {
	test('formats minutes and hours', () => {
		expect(timestamp(5)).toBe('0:05')
		expect(timestamp(98.9)).toBe('1:38')
		expect(timestamp(3725)).toBe('1:02:05')
	})
})
