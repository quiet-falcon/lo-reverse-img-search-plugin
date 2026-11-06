import { describe, expect, test } from 'bun:test'
import { toBase64 } from '../plugins/reverse-image-search/js/core/base64'
import {
	copyBand,
	copyDetail,
	copyHeadline,
	distinctSites,
	siteOf,
} from '../plugins/reverse-image-search/js/core/copy-check'
import { VisionAvailable } from '../plugins/reverse-image-search/js/core/features'
import { fuseResults } from '../plugins/reverse-image-search/js/core/fusion'
import {
	errorMessage,
	joinNames,
	matchLabel,
	noMatchHint,
} from '../plugins/reverse-image-search/js/core/messages'
import {
	activeProviders,
	availableProviders,
	copyCheckSpec,
	DefaultSettings,
	looksLikeVisionKey,
	needsConsent,
	readSettings,
	visionSpec,
} from '../plugins/reverse-image-search/js/core/settings'
import { HandoffProviders } from '../plugins/reverse-image-search/js/providers/handoffs'
import {
	buildVisionRequest,
	cleanTitle,
	parseVision,
} from '../plugins/reverse-image-search/js/providers/vision'
import type {
	ProviderOutcome,
	ProviderResult,
	WebFindings,
} from '../plugins/reverse-image-search/js/core/types'

const Key = `AIza${'x'.repeat(35)}`

const findings = (over: Partial<WebFindings> = {}): WebFindings => ({
	pages: [],
	exactCopies: 0,
	editedCopies: 0,
	capped: false,
	bestGuess: '',
	entities: [],
	text: '',
	...over,
})

const page = (site: string) => ({
	url: `https://${site}/a`,
	site,
	title: site,
	exact: true,
})

function results(outcome: ProviderOutcome) {
	if (outcome.kind !== 'results') throw new Error('Expected results')
	return outcome
}

const parse = (response: unknown) =>
	parseVision(200, JSON.stringify({ responses: [response] }))

describe('toBase64', () => {
	test('matches the standard encoding at every padding length', () => {
		for (const length of [0, 1, 2, 3, 4, 5, 255, 9000]) {
			const bytes = Uint8Array.from({ length }, (_, index) => index % 256)

			expect(toBase64(bytes)).toBe(Buffer.from(bytes).toString('base64'))
		}
	})
})

describe('buildVisionRequest', () => {
	const body = (withText: boolean) =>
		JSON.parse(
			new TextDecoder().decode(
				buildVisionRequest(new Uint8Array([1, 2, 3]), Key, withText).body,
			),
		)

	test('sends the key in a header, never the URL', () => {
		const request = buildVisionRequest(new Uint8Array([1]), Key, true)

		expect(request.url).toBe('https://vision.googleapis.com/v1/images:annotate')
		expect(request.url).not.toContain(Key)
		expect(request.headers['x-goog-api-key']).toBe(Key)
		expect(request.headers['Content-Type']).toBe('application/json')
	})

	test('sends the image as base64 and asks for 50 web results', () => {
		const { image, features } = body(false).requests[0]

		expect(image.content).toBe('AQID')
		expect(features).toEqual([{ type: 'WEB_DETECTION', maxResults: 50 }])
	})

	test('adds text reading only when asked', () => {
		expect(
			body(true).requests[0].features.map((f: { type: string }) => f.type),
		).toEqual(['WEB_DETECTION', 'TEXT_DETECTION'])
	})
})

describe('parseVision', () => {
	const Detection = {
		webEntities: [
			{ description: 'Rio Carnival', score: 1.4 },
			{ score: 0.2 },
			{ description: 'Brazil' },
		],
		fullMatchingImages: [
			{ url: 'https://a.example/1.jpg' },
			{ url: 'http://a.example/insecure.jpg' },
		],
		partialMatchingImages: [{ url: 'https://b.example/2.jpg' }],
		pagesWithMatchingImages: [
			{
				url: 'https://www.b.example/page',
				pageTitle: '<b>Rio</b> &amp; friends',
				partialMatchingImages: [{ url: 'https://b.example/2.jpg' }],
			},
			{
				url: 'https://a.example/page',
				pageTitle: 'Exact page',
				fullMatchingImages: [{ url: 'https://a.example/1.jpg' }],
			},
			{ url: 'javascript:alert(1)', pageTitle: 'Bad' },
		],
		visuallySimilarImages: [{ url: 'https://c.example/3.jpg' }],
		bestGuessLabels: [{ label: 'rio carnival', languageCode: 'en' }],
	}

	test('reads pages, counts, and labels', () => {
		const { web } = results(parse({ webDetection: Detection }))

		expect(web).toMatchObject({
			exactCopies: 1,
			editedCopies: 1,
			capped: false,
			bestGuess: 'rio carnival',
			entities: ['Rio Carnival', 'Brazil'],
		})
		expect(web?.pages.map(item => item.url)).toEqual([
			'https://a.example/page',
			'https://www.b.example/page',
		])
		expect(web?.pages[1]).toMatchObject({
			site: 'b.example',
			title: 'Rio & friends',
			exact: false,
		})
	})

	test('ranks exact pages above edited pages and similar images', () => {
		const outcome = results(parse({ webDetection: Detection }))
		const tiers = fuseResults({ vision: outcome }, ['vision']).map(
			item => item.tier,
		)

		expect(tiers).toEqual(['exact', 'strong', 'possible'])
		expect(outcome.results.every(item => item.noScore)).toBe(true)
	})

	test('uses image links only when no page was found', () => {
		const { results: found } = results(
			parse({
				webDetection: {
					fullMatchingImages: [{ url: 'https://a.example/1.jpg' }],
				},
			}),
		)

		expect(found).toHaveLength(1)
		expect(found[0]).toMatchObject({ tier: 'exact', detail: 'Image file' })
	})

	test('takes the full text from the first annotation only', () => {
		const { web } = results(
			parse({
				webDetection: {},
				textAnnotations: [
					{ description: '@some_model\n  Instagram' },
					{ description: '@some_model' },
				],
			}),
		)

		expect(web?.text).toBe('@some_model Instagram')
	})

	test('shortens long text', () => {
		const { web } = results(
			parse({ textAnnotations: [{ description: 'x'.repeat(500) }] }),
		)

		expect(web?.text).toHaveLength(201)
	})

	test('flags a list that reached the requested limit', () => {
		const pages = Array.from({ length: 50 }, (_, index) => ({
			url: `https://s${index}.example/`,
		}))
		const { web, results: found } = results(
			parse({ webDetection: { pagesWithMatchingImages: pages } }),
		)

		expect(web?.capped).toBe(true)
		expect(found.length).toBeLessThanOrEqual(20)
	})

	test('treats an empty response as no copies', () => {
		const { web, results: found } = results(parse({}))

		expect(found).toEqual([])
		expect(web?.pages).toEqual([])
	})

	test('maps HTTP failures', () => {
		const cases: [number, string, string][] = [
			[400, 'API key not valid. Please pass a valid API key.', 'bad-key'],
			[400, 'Bad image data.', 'bad-image'],
			[401, 'Unauthorised', 'bad-key'],
			[403, 'Billing must be enabled.', 'needs-setup'],
			[413, 'Too big', 'too-large'],
			[429, 'Quota exceeded', 'rate-limited'],
			[503, 'Unavailable', 'busy'],
			[418, 'Teapot', 'unexpected'],
		]

		for (const [status, message, category] of cases)
			expect(
				parseVision(status, JSON.stringify({ error: { message } })),
			).toEqual({ kind: 'error', category } as ProviderOutcome)
	})

	test('maps a failure inside a successful response', () => {
		const cases: [number, string][] = [
			[3, 'bad-image'],
			[7, 'needs-setup'],
			[8, 'rate-limited'],
			[14, 'busy'],
			[99, 'unexpected'],
		]

		for (const [code, category] of cases)
			expect(parse({ error: { code, message: 'x' } })).toEqual({
				kind: 'error',
				category,
			} as ProviderOutcome)
	})

	test('survives malformed bodies', () => {
		expect(parseVision(200, 'not json')).toMatchObject({
			category: 'unexpected',
		})
		expect(parseVision(503, '<html>')).toMatchObject({ category: 'busy' })
		expect(parseVision(200, '{}')).toMatchObject({ category: 'unexpected' })
		expect(parse({ webDetection: 'x', textAnnotations: 'y' }).kind).toBe(
			'results',
		)
	})
})

describe('cleanTitle', () => {
	test('removes tags and decodes common entities', () => {
		expect(cleanTitle('<b>A</b> &lt;B&gt; &quot;C&quot; &#39;D&#39;')).toBe(
			`A <B> "C" 'D'`,
		)
	})
})

describe('copy check', () => {
	test('sets bands at their edges', () => {
		const cases: [number, ReturnType<typeof copyBand>][] = [
			[0, 'none'],
			[1, 'few'],
			[4, 'few'],
			[5, 'several'],
			[19, 'several'],
			[20, 'wide'],
		]

		for (const [sites, band] of cases) expect(copyBand(sites)).toBe(band)
	})

	test('counts each site once, ignoring www and case', () => {
		expect(siteOf('https://WWW.Example.com/a')).toBe('example.com')
		expect(
			distinctSites(
				findings({ pages: [page('a.com'), page('a.com'), page('b.com')] }),
			),
		).toBe(2)
	})

	test('writes counts as at least', () => {
		expect(copyHeadline(findings({ pages: [page('a.com')] }))).toBe(
			'Found on a few sites: at least 1 site',
		)
		expect(copyHeadline(findings())).toBe('No copies found')
		expect(copyDetail(findings({ exactCopies: 1, editedCopies: 2 }))).toBe(
			'At least 1 exact copy and 2 edited copies.',
		)
	})

	test('says more may exist when a list is capped', () => {
		expect(copyDetail(findings({ exactCopies: 50, capped: true }))).toBe(
			'At least 50 exact copies. More may exist.',
		)
		expect(copyDetail(findings())).toBe('')
	})
})

describe('Vision settings', () => {
	test('stays off by default, with text reading ready', () => {
		expect(DefaultSettings).toMatchObject({
			vision: false,
			visionKey: '',
			visionText: true,
		})
		expect(activeProviders({ ...DefaultSettings, visionKey: Key })).toEqual([
			{ id: 'tracemoe' },
		])
	})

	test('joins a normal search only when switched on with a key', () => {
		expect(
			activeProviders({ ...DefaultSettings, vision: true, visionKey: Key }),
		).toContainEqual({ id: 'vision', key: Key, text: true })
		expect(activeProviders({ ...DefaultSettings, vision: true })).toEqual([
			{ id: 'tracemoe' },
		])
	})

	test('allows the copy check from the key alone', () => {
		expect(visionSpec({ ...DefaultSettings, visionKey: Key })).toEqual({
			id: 'vision',
			key: Key,
			text: true,
		})
		expect(visionSpec(DefaultSettings)).toBeUndefined()
		expect(
			visionSpec({ ...DefaultSettings, visionKey: Key, visionText: false }),
		).toMatchObject({ text: false })
	})

	test('checks key shape and cleans stored values', () => {
		expect(looksLikeVisionKey(Key)).toBe(true)
		expect(looksLikeVisionKey('short')).toBe(false)
		expect(readSettings({ visionKey: ` ${Key}\n` }).visionKey).toBe(Key)
		expect(readSettings({ vision: 'yes', visionText: 0 })).toMatchObject({
			vision: false,
			visionText: true,
		})
	})

	test('keeps Vision consent across a reload', () => {
		const stored = readSettings({ consented: ['vision', 'unknown'] })

		expect(stored.consented).toEqual(['vision'])
		expect(
			needsConsent(stored, [{ id: 'vision', key: Key, text: true }]),
		).toEqual([])
	})
})

describe('parked Vision', () => {
	const ready = { ...DefaultSettings, vision: true, visionKey: Key }

	test('stays out of every search and the copy check', () => {
		expect(VisionAvailable).toBe(false)
		expect(availableProviders(ready)).toEqual([{ id: 'tracemoe' }])
		expect(copyCheckSpec(ready)).toBeUndefined()
	})
})

describe('Vision messages', () => {
	const result: ProviderResult = {
		provider: 'vision',
		title: 'x',
		detail: '',
		similarity: 0,
		tier: 'exact',
		adult: false,
		noScore: true,
	}

	test('never shows a made-up score', () => {
		expect(matchLabel(result)).toBe('Exact match')
		expect(
			matchLabel({ ...result, similarity: 0.97, noScore: undefined }),
		).toBe('Exact match, 97.0%')
	})

	test('names Google Vision and explains setup', () => {
		expect(joinNames(['tracemoe', 'vision'])).toBe(
			'trace.moe and Google Vision',
		)
		expect(errorMessage('needs-setup', 'Google Vision')).toContain(
			'Cloud Vision API and billing',
		)
	})

	test('drops the photo tip once Vision is included', () => {
		expect(noMatchHint(['tracemoe'])).toContain('photos and memes')
		expect(noMatchHint(['tracemoe', 'vision'])).not.toContain('only knows')
	})
})

describe('TinEye hand-off', () => {
	const Signed =
		'https://media.discordapp.net/attachments/1/2/a.png?ex=ff&is=00&hm=de&'

	test('opens sorted by oldest, with the image encoded once', () => {
		const tineye = HandoffProviders.find(item => item.id === 'tineye')

		expect(tineye?.buildUrl(Signed)).toBe(
			`https://www.tineye.com/search?url=${encodeURIComponent(Signed)}&sort=crawl_date&order=asc`,
		)
	})

	test('gives every engine a short use label', () => {
		expect(HandoffProviders.every(item => item.note.length > 0)).toBe(true)
	})
})
