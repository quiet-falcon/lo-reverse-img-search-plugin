import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import type { ProviderSpec } from '../plugins/reverse-image-search/js/core/settings'

type Handler = (() => void) | null

class FakeXhr {
	static instances: FakeXhr[] = []
	static respond: (xhr: FakeXhr) => void = () => {}
	method = ''
	url = ''
	headers: Record<string, string> = {}
	body: unknown
	withCredentials = true
	timeout = 0
	responseType = ''
	readyState = 0
	status = 0
	response: unknown = null
	responseURL = ''
	responseHeaders: Record<string, string> = {}
	aborted = false
	onreadystatechange: Handler = null
	onprogress: ((event: { loaded: number }) => void) | null = null
	onload: Handler = null
	onerror: Handler = null
	ontimeout: Handler = null
	onabort: Handler = null

	constructor() {
		FakeXhr.instances.push(this)
	}
	open(method: string, url: string) {
		this.method = method
		this.url = url
	}
	setRequestHeader(name: string, value: string) {
		this.headers[name] = value
	}
	getResponseHeader(name: string) {
		return this.responseHeaders[name] ?? null
	}
	send(body: unknown) {
		this.body = body
		queueMicrotask(() => FakeXhr.respond(this))
	}
	abort() {
		this.aborted = true
		this.onabort?.()
	}
	succeed(status: number, response: unknown, url = this.url) {
		this.status = status
		this.response = response
		this.responseURL = url
		this.onload?.()
	}
}

const refreshed: string[] = []
let refreshResult: string | undefined

mock.module(
	'../plugins/reverse-image-search/js/adapters/discord-modules',
	() => ({
		refreshAttachmentUrl: async (url: string) => {
			refreshed.push(url)
			return refreshResult
		},
	}),
)

const { sendRequest } = await import(
	'../plugins/reverse-image-search/js/adapters/http'
)
const { searchImage } = await import(
	'../plugins/reverse-image-search/js/adapters/search'
)
const { createSearchSession } = await import(
	'../plugins/reverse-image-search/js/core/session'
)
const { checkImageTags } = await import(
	'../plugins/reverse-image-search/js/adapters/image-check'
)

const Fresh =
	'https://cdn.discordapp.com/attachments/1/2/a.png?ex=ffffffff&is=00000000&hm=deadbeef&'
const Stale =
	'https://cdn.discordapp.com/attachments/1/2/a.png?ex=1&is=0&hm=beef&'
const Jpeg = new Uint8Array([
	0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
])
const Html = new TextEncoder().encode('<!DOCTYPE html><html></html>')
const Results = JSON.stringify({
	quota: 100,
	quotaUsed: 1,
	result: [{ anilist: 1, similarity: 0.99 }],
})

const SauceResults = JSON.stringify({
	header: { status: 0, long_remaining: 120, minimum_similarity: 50 },
	results: [
		{
			header: {
				similarity: '95.1',
				index_name: 'Index #5: Pixiv Images - 1_p0.jpg',
				hidden: 0,
			},
			data: { title: 'Art', member_name: 'Someone', pixiv_id: 1 },
		},
	],
})

const target = (url = Fresh) => ({
	kind: 'attachment' as const,
	label: 'a',
	url,
	spoiler: false,
})

beforeEach(() => {
	FakeXhr.instances = []
	refreshed.length = 0
	refreshResult = undefined
	;(globalThis as unknown as { XMLHttpRequest: unknown }).XMLHttpRequest =
		FakeXhr
})

afterEach(() => {
	FakeXhr.respond = () => {}
})

function run(
	start = target(),
	providers: ProviderSpec[] = [{ id: 'tracemoe' }],
) {
	const states: string[] = []
	const outcomes: unknown[] = []
	const session = createSearchSession()
	const promise = searchImage(session, start, providers, {
		onState: (state: string) => states.push(state),
		onOutcome: (outcome: unknown) => outcomes.push(outcome),
	})

	return { promise, session, states, outcomes }
}

describe('sendRequest', () => {
	const base = { method: 'GET' as const, maxBytes: 10, timeoutMs: 1000 }

	test('blocks hosts that are not allowed, without sending', async () => {
		const result = await sendRequest({
			...base,
			url: 'https://evil.test/a',
			allowedHosts: ['a.test'],
		}).promise

		expect(result).toEqual({ kind: 'error', category: 'blocked' })
		expect(FakeXhr.instances[0]?.body).toBeUndefined()
	})

	test('rejects lookalike hosts', async () => {
		const result = await sendRequest({
			...base,
			url: 'https://cdn.discordapp.com.evil.test/a',
			allowedHosts: ['cdn.discordapp.com'],
		}).promise

		expect(result).toMatchObject({ kind: 'error', category: 'blocked' })
	})

	test('sends without credentials and with the set limits', async () => {
		FakeXhr.respond = xhr => xhr.succeed(200, 'ok')
		const result = await sendRequest({
			...base,
			url: 'https://a.test/x',
			allowedHosts: ['a.test'],
		}).promise
		const xhr = FakeXhr.instances[0]!

		expect(result).toEqual({ kind: 'ok', status: 200, text: 'ok' })
		expect(xhr.withCredentials).toBe(false)
		expect(xhr.timeout).toBe(1000)
	})

	test('aborts when the declared or received size is too big', async () => {
		FakeXhr.respond = xhr => {
			xhr.readyState = 2
			xhr.responseHeaders['Content-Length'] = '11'
			xhr.onreadystatechange?.()
		}
		const declared = await sendRequest({
			...base,
			url: 'https://a.test/x',
			allowedHosts: ['a.test'],
		}).promise

		FakeXhr.respond = xhr => xhr.onprogress?.({ loaded: 11 })
		const progress = await sendRequest({
			...base,
			url: 'https://a.test/y',
			allowedHosts: ['a.test'],
		}).promise

		FakeXhr.respond = xhr => xhr.succeed(200, new Uint8Array(11).buffer)
		const final = await sendRequest({
			...base,
			url: 'https://a.test/z',
			allowedHosts: ['a.test'],
			binary: true,
		}).promise

		for (const result of [declared, progress, final])
			expect(result).toEqual({ kind: 'error', category: 'too-large' })
		expect(FakeXhr.instances[0]?.aborted).toBe(true)
	})

	test('blocks a redirect to another host', async () => {
		FakeXhr.respond = xhr => xhr.succeed(200, 'x', 'https://evil.test/')
		const result = await sendRequest({
			...base,
			url: 'https://a.test/x',
			allowedHosts: ['a.test'],
		}).promise

		expect(result).toEqual({ kind: 'error', category: 'blocked' })
	})

	test('maps network failures and timeouts', async () => {
		FakeXhr.respond = xhr => xhr.onerror?.()
		const network = await sendRequest({
			...base,
			url: 'https://a.test/x',
			allowedHosts: ['a.test'],
		}).promise
		FakeXhr.respond = xhr => xhr.ontimeout?.()
		const timeout = await sendRequest({
			...base,
			url: 'https://a.test/x',
			allowedHosts: ['a.test'],
		}).promise

		expect(network).toEqual({ kind: 'error', category: 'network' })
		expect(timeout).toEqual({ kind: 'error', category: 'timeout' })
	})
})

describe('searchImage', () => {
	test('downloads, checks the bytes, uploads them raw, and shows results', async () => {
		FakeXhr.respond = xhr =>
			xhr.url.includes('trace.moe')
				? xhr.succeed(200, Results)
				: xhr.succeed(200, Jpeg.buffer)
		const { promise, states, outcomes } = run()
		await promise

		const upload = FakeXhr.instances.at(-1)!
		expect(states).toEqual(['downloading', 'searching', 'done'])
		expect(upload.headers['Content-Type']).toBe('image/jpeg')
		expect(upload.body).toBeInstanceOf(Uint8Array)
		expect(outcomes[0]).toMatchObject({
			kind: 'providers',
			outcomes: { tracemoe: { kind: 'results', quotaLeft: 99 } },
		})
		expect(refreshed).toEqual([])
	})

	test('falls back to the next copy when one is not an image', async () => {
		FakeXhr.respond = xhr => {
			if (xhr.url.includes('trace.moe')) return xhr.succeed(200, Results)
			xhr.succeed(
				200,
				xhr.url.includes('format=jpeg') ? Html.buffer : Jpeg.buffer,
			)
		}
		const { promise, outcomes } = run()
		await promise

		expect(
			FakeXhr.instances.map(xhr => xhr.url.includes('format=png')),
		).toContain(true)
		expect(outcomes[0]).toMatchObject({
			kind: 'providers',
			outcomes: { tracemoe: { kind: 'results' } },
		})
	})

	test('rejects a non-image without uploading it', async () => {
		FakeXhr.respond = xhr => xhr.succeed(200, Html.buffer)
		const { promise, outcomes } = run()
		await promise

		expect(outcomes).toEqual([{ kind: 'error', category: 'bad-image' }])
		expect(FakeXhr.instances.some(xhr => xhr.url.includes('trace.moe'))).toBe(
			false,
		)
	})

	test('stops an oversized image before upload', async () => {
		FakeXhr.respond = xhr => xhr.onprogress?.({ loaded: 9 * 1024 * 1024 })
		const { promise, outcomes } = run()
		await promise

		expect(outcomes).toEqual([{ kind: 'error', category: 'too-large' }])
		expect(FakeXhr.instances.some(xhr => xhr.url.includes('trace.moe'))).toBe(
			false,
		)
	})

	test('refreshes a stale link first', async () => {
		refreshResult = Fresh
		FakeXhr.respond = xhr =>
			xhr.url.includes('trace.moe')
				? xhr.succeed(200, Results)
				: xhr.succeed(200, Jpeg.buffer)
		const { promise, states } = run(target(Stale))
		await promise

		expect(refreshed).toEqual([Stale])
		expect(states[0]).toBe('refreshing')
		expect(FakeXhr.instances[0]?.url).toContain('ex=ffffffff')
	})

	test('reports a failed refresh without downloading', async () => {
		const { promise, outcomes } = run(target(Stale))
		await promise

		expect(outcomes).toEqual([{ kind: 'error', category: 'refresh-failed' }])
		expect(FakeXhr.instances).toHaveLength(0)
	})

	test('cancel aborts the request and drops the late result', async () => {
		const { promise, session, outcomes } = run()
		await Promise.resolve()
		session.cancel()
		await promise

		expect(FakeXhr.instances[0]?.aborted).toBe(true)
		expect(outcomes).toEqual([])
		expect(FakeXhr.instances).toHaveLength(1)
	})

	test('ignores a second tap while a search runs', async () => {
		const session = createSearchSession()
		const callbacks = { onState() {}, onOutcome() {} }
		const providers: ProviderSpec[] = [{ id: 'tracemoe' }]
		searchImage(session, target(), providers, callbacks)
		await searchImage(session, target(), providers, callbacks)

		expect(FakeXhr.instances).toHaveLength(1)
		session.cancel()
	})

	test('sends one download to both providers, with the key only to SauceNAO', async () => {
		const Key = 'a'.repeat(40)
		FakeXhr.respond = xhr => {
			if (xhr.url.includes('trace.moe')) return xhr.succeed(200, Results)
			if (xhr.url.includes('saucenao.com'))
				return xhr.succeed(200, SauceResults)
			xhr.succeed(200, Jpeg.buffer)
		}
		const { promise, outcomes } = run(target(), [
			{ id: 'tracemoe' },
			{ id: 'saucenao', key: Key },
		])
		await promise

		const sauce = FakeXhr.instances.find(xhr =>
			xhr.url.includes('saucenao.com'),
		)!
		const others = FakeXhr.instances.filter(xhr => xhr !== sauce)
		expect(sauce.url).toContain(`api_key=${Key}`)
		expect(sauce.headers['Content-Type']).toStartWith(
			'multipart/form-data; boundary=',
		)
		expect(others.every(xhr => !xhr.url.includes(Key))).toBe(true)
		expect(
			FakeXhr.instances.filter(xhr => xhr.url.includes('discord')),
		).toHaveLength(1)
		expect(outcomes[0]).toMatchObject({
			kind: 'providers',
			outcomes: {
				tracemoe: { kind: 'results' },
				saucenao: { kind: 'results', quotaLeft: 120 },
			},
		})
	})

	test('sends the Vision key only to Vision, in a header', async () => {
		const Key = `AIza${'x'.repeat(35)}`
		FakeXhr.respond = xhr => {
			if (xhr.url.includes('vision.googleapis.com'))
				return xhr.succeed(
					200,
					JSON.stringify({
						responses: [
							{
								webDetection: {
									pagesWithMatchingImages: [{ url: 'https://a.example/' }],
								},
							},
						],
					}),
				)
			xhr.succeed(200, Jpeg.buffer)
		}
		const { promise, outcomes } = run(target(), [
			{ id: 'vision', key: Key, text: true },
		])
		await promise

		const vision = FakeXhr.instances.find(xhr =>
			xhr.url.includes('vision.googleapis.com'),
		)!
		expect(vision.headers['x-goog-api-key']).toBe(Key)
		expect(vision.url).not.toContain(Key)
		expect(
			FakeXhr.instances.filter(xhr => xhr !== vision).map(xhr => xhr.headers),
		).toEqual([{}])
		expect(outcomes[0]).toMatchObject({
			outcomes: { vision: { kind: 'results' } },
		})
	})

	test('stops an image too big for Vision before upload', async () => {
		const huge = new Uint8Array(7 * 1024 * 1024 + 1)
		huge.set(Jpeg)
		FakeXhr.respond = xhr => xhr.succeed(200, huge.buffer)
		const { promise, outcomes } = run(target(), [
			{ id: 'vision', key: 'k'.repeat(39), text: false },
		])
		await promise

		expect(FakeXhr.instances.some(xhr => xhr.url.includes('googleapis'))).toBe(
			false,
		)
		expect(outcomes[0]).toMatchObject({
			outcomes: { vision: { kind: 'error', category: 'too-large' } },
		})
	})

	test("keeps one provider's results when the other fails", async () => {
		FakeXhr.respond = xhr => {
			if (xhr.url.includes('trace.moe')) return xhr.succeed(429, '')
			if (xhr.url.includes('saucenao.com'))
				return xhr.succeed(200, SauceResults)
			xhr.succeed(200, Jpeg.buffer)
		}
		const { promise, states, outcomes } = run(target(), [
			{ id: 'tracemoe' },
			{ id: 'saucenao', key: 'b'.repeat(40) },
		])
		await promise

		expect(states.at(-1)).toBe('done')
		expect(outcomes[0]).toMatchObject({
			outcomes: {
				tracemoe: { kind: 'error', category: 'rate-limited' },
				saucenao: { kind: 'results' },
			},
		})
	})

	test('does nothing with no providers', async () => {
		const { promise, outcomes } = run(target(), [])
		await promise

		expect(FakeXhr.instances).toHaveLength(0)
		expect(outcomes).toEqual([])
	})
})

describe('checkImageTags', () => {
	const ProxyLink =
		'https://media.discordapp.net/attachments/1/2/a.png?ex=ffffffff&is=00000000&hm=deadbeef&'
	const text = (value: string) =>
		Uint8Array.from(value, char => char.charCodeAt(0))
	const Xmp = new Uint8Array([
		0xff,
		0xd8,
		0xff,
		0xfe,
		0,
		18,
		...text('made in ComfyUI!'),
		0xff,
		0xda,
	])

	test('reads the original file from Discord and sends it nowhere', async () => {
		FakeXhr.respond = xhr => xhr.succeed(200, Xmp.buffer)
		const outcome = await checkImageTags(createSearchSession(), target(ProxyLink))

		expect(FakeXhr.instances).toHaveLength(1)
		expect(FakeXhr.instances[0]!.method).toBe('GET')
		expect(FakeXhr.instances[0]!.url).toBe(
			'https://cdn.discordapp.com/attachments/1/2/a.png?ex=ffffffff&is=00000000&hm=deadbeef&',
		)
		expect(outcome).toEqual({
			kind: 'tags',
			tags: [{ kind: 'generator', label: 'Made with ComfyUI' }],
		})
	})

	test('refreshes a stale link first', async () => {
		refreshResult = Fresh
		FakeXhr.respond = xhr => xhr.succeed(200, Xmp.buffer)
		await checkImageTags(createSearchSession(), target(Stale))

		expect(refreshed).toEqual([Stale])
		expect(FakeXhr.instances[0]!.url).toBe(Fresh)
	})

	test('reports a failed refresh and download', async () => {
		expect(await checkImageTags(createSearchSession(), target(Stale))).toEqual({
			kind: 'error',
			category: 'refresh-failed',
		})

		FakeXhr.respond = xhr => xhr.succeed(404, new ArrayBuffer(0))
		expect(await checkImageTags(createSearchSession(), target())).toEqual({
			kind: 'error',
			category: 'unexpected',
		})
	})

	test('cancel drops a late result', async () => {
		const session = createSearchSession()
		const pending = checkImageTags(session, target())
		await Promise.resolve()
		session.cancel()

		expect(await pending).toBeUndefined()
	})
})
