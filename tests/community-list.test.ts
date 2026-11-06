import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { createHash, generateKeyPairSync, sign } from 'node:crypto'
import { addReport, buildList, parseReport } from '../scripts/community-list'

const keys = generateKeyPairSync('ed25519')
const pem = keys.privateKey.export({ type: 'pkcs8', format: 'pem' }) as string
const raw = (keys.publicKey.export({ format: 'der', type: 'spki' }) as Buffer)
	.subarray(-32)
	.toString('hex')

mock.module(
	'../plugins/reverse-image-search/js/core/community-list',
	async () => {
		const real = await import(
			`../plugins/reverse-image-search/js/core/community-list.ts?real`
		)
		return { ...real, ListPublicKey: raw }
	},
)

const { verifyEd25519, sha512 } = await import(
	'../plugins/reverse-image-search/js/core/ed25519'
)
const { sha256 } = await import(
	'../plugins/reverse-image-search/js/core/sha256'
)
const list = await import(
	'../plugins/reverse-image-search/js/core/community-list'
)
const { syncCommunityList } = await import(
	'../plugins/reverse-image-search/js/adapters/community-sync'
)

const Hash = 'a'.repeat(64)
const text = (value: string) => new TextEncoder().encode(value)

describe('hashes', () => {
	test('match node for many lengths', () => {
		for (const length of [
			0, 1, 55, 56, 63, 64, 111, 112, 119, 120, 128, 1000,
		]) {
			const bytes = Uint8Array.from({ length }, (_, index) => index % 251)

			expect(sha256(bytes)).toBe(
				createHash('sha256').update(bytes).digest('hex'),
			)
			expect(Buffer.from(sha512(bytes)).toString('hex')).toBe(
				createHash('sha512').update(bytes).digest('hex'),
			)
		}
	})
})

describe('verifyEd25519', () => {
	const message = text('ris test message')
	const signature = new Uint8Array(sign(null, message, keys.privateKey))
	const key = list.fromHex(raw)

	test('accepts a real signature', () => {
		expect(verifyEd25519(signature, message, key)).toBe(true)
	})

	test('rejects a changed message, signature, or key', () => {
		const bad = signature.slice()
		bad[10]! ^= 1
		const other = generateKeyPairSync('ed25519')
		const otherKey = new Uint8Array(
			(
				other.publicKey.export({ format: 'der', type: 'spki' }) as Buffer
			).subarray(-32),
		)

		expect(verifyEd25519(signature, text('other'), key)).toBe(false)
		expect(verifyEd25519(bad, message, key)).toBe(false)
		expect(verifyEd25519(signature, message, otherKey)).toBe(false)
	})

	test('rejects wrong lengths and an oversized S', () => {
		const huge = signature.slice()
		huge.fill(255, 32)

		expect(verifyEd25519(new Uint8Array(3), message, key)).toBe(false)
		expect(verifyEd25519(signature, message, new Uint8Array(3))).toBe(false)
		expect(verifyEd25519(huge, message, key)).toBe(false)
	})
})

describe('reports', () => {
	test('accepts exact lines only', () => {
		expect(parseReport(`hash: ${Hash}\ncategory: scam-image\n`)).toEqual({
			hash: Hash,
			category: 'scam-image',
		})
		for (const body of [
			'',
			`hash: ${Hash}`,
			`hash: ${Hash}x\ncategory: scam-image`,
			`hash: ${Hash}\ncategory: bad; rm -rf /`,
			`hash: $(whoami)\ncategory: scam-image`,
		])
			expect(parseReport(body)).toBeUndefined()
	})

	test('adds new hashes and counts repeats', () => {
		const report = { hash: Hash, category: 'scam-image' }
		const once = addReport([], report)

		expect(once).toEqual([[Hash, 'scam-image', 1]])
		expect(addReport(once, report)).toEqual([[Hash, 'scam-image', 2]])
	})

	test('builds a link holding only the fingerprint', () => {
		const url = list.reportUrl(Hash)

		expect(url).toStartWith(
			'https://github.com/quiet-falcon/lo-reverse-img-search-plugin/issues/new?template=report-hash.md',
		)
		expect(decodeURIComponent(url)).toContain(
			`hash: ${Hash}\ncategory: scam-image`,
		)
	})
})

describe('matching', () => {
	const image = {
		hash: Hash,
		quality: 100,
		variants: ['b'.repeat(64), Hash],
	}
	const entry = { hash: Hash, category: 'scam-image', reports: 2 }

	test('checks every flip and leaves others alone', () => {
		expect(list.findCommunityMatch(image, [entry])?.distance).toBe(0)
		expect(
			list.findCommunityMatch(image, [{ ...entry, hash: '1'.repeat(64) }]),
		).toBeUndefined()
	})

	test('says what the match is based on', () => {
		expect(list.communitySignal({ entry, distance: 3 })).toMatchObject({
			title: 'Matches a reported scam image',
			level: 'watch',
		})
		expect(list.communitySignal({ entry, distance: 3 }).detail).toContain(
			'Reported 2 times',
		)
	})

	test('stored lists survive bad data', () => {
		expect(list.readStoredList('x')).toEqual(list.EmptyList)
		expect(
			list.readStoredList({ version: 3, entries: [entry, { hash: 'x' }] }),
		).toEqual({ version: 3, entries: [entry] })
	})
})

class FakeXhr {
	static files: Record<string, string> = {}
	static urls: string[] = []
	method = ''
	url = ''
	status = 0
	response: unknown = null
	responseURL = ''
	responseType = ''
	readyState = 0
	withCredentials = true
	timeout = 0
	onload: (() => void) | null = null
	onerror: (() => void) | null = null
	ontimeout = null
	onabort = null
	onprogress = null
	onreadystatechange = null
	open(method: string, url: string) {
		this.method = method
		this.url = url
		FakeXhr.urls.push(url)
	}
	setRequestHeader() {}
	getResponseHeader() {
		return null
	}
	abort() {}
	send() {
		const name = this.url.split('/').at(-1)!
		const file = FakeXhr.files[name]
		queueMicrotask(() => {
			if (file === undefined) return this.onerror?.()
			this.status = 200
			this.responseURL = this.url
			this.response =
				this.responseType === 'arraybuffer' ? text(file).buffer : file
			this.onload?.()
		})
	}
}

describe('syncCommunityList', () => {
	const entries = [[Hash, 'scam-image', 1]] as [string, string, number][]
	const built = (version = 5) => buildList(entries, version, pem)

	beforeEach(() => {
		FakeXhr.urls = []
		FakeXhr.files = {
			'list.json': built().list,
			'manifest.json': built().manifest,
		}
		;(globalThis as unknown as { XMLHttpRequest: unknown }).XMLHttpRequest =
			FakeXhr
	})

	afterEach(() => {
		FakeXhr.files = {}
	})

	test('stores a genuine list', async () => {
		expect(await syncCommunityList(0)).toEqual({
			kind: 'updated',
			list: {
				version: 5,
				entries: [{ hash: Hash, category: 'scam-image', reports: 1 }],
			},
		})
		expect(
			FakeXhr.urls.every(url =>
				url.startsWith('https://raw.githubusercontent.com/quiet-falcon/'),
			),
		).toBe(true)
	})

	test('rejects a tampered list', async () => {
		FakeXhr.files['list.json'] = JSON.stringify([
			['b'.repeat(64), 'scam-image', 1],
		])

		expect(await syncCommunityList(0)).toEqual({ kind: 'tampered' })
	})

	test('rejects a forged manifest', async () => {
		const other = generateKeyPairSync('ed25519')
		FakeXhr.files['manifest.json'] = buildList(
			entries,
			9,
			other.privateKey.export({ type: 'pkcs8', format: 'pem' }) as string,
		).manifest

		expect(await syncCommunityList(0)).toEqual({ kind: 'tampered' })
	})

	test('refuses to roll back to an older list', async () => {
		expect(await syncCommunityList(5)).toEqual({ kind: 'current' })
		expect(FakeXhr.urls).toHaveLength(1)
	})

	test('reports a network failure', async () => {
		FakeXhr.files = {}

		expect(await syncCommunityList(0)).toEqual({ kind: 'failed' })
	})
})
