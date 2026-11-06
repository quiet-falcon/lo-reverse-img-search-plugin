import { describe, expect, test } from 'bun:test'
import {
	encodeForHandoff,
	expiryOf,
	isDiscordMedia,
	isHttps,
	isStale,
	toMediaProxy,
} from '../plugins/reverse-image-search/js/core/signed-url'

const Signed =
	'https://cdn.discordapp.com/attachments/1/2/test.png?ex=ffffffff&is=00000000&hm=deadbeef&'

describe('toMediaProxy', () => {
	test('swaps only the host and keeps the signature exactly', () => {
		expect(toMediaProxy(Signed)).toBe(
			'https://media.discordapp.net/attachments/1/2/test.png?ex=ffffffff&is=00000000&hm=deadbeef&',
		)
	})

	test('leaves other URLs alone', () => {
		for (const url of [
			'https://example.com/a.png',
			'https://cdn.discordapp.com/avatars/1/a.png',
			'https://media.discordapp.net/attachments/1/2/a.png?ex=1',
		])
			expect(toMediaProxy(url)).toBe(url)
	})
})

describe('expiry', () => {
	test('parses ex as hexadecimal seconds', () => {
		expect(expiryOf('https://x.test/a?ex=10&is=1')).toBe(16_000)
	})

	test('has no expiry without ex', () => {
		expect(expiryOf('https://x.test/a')).toBeUndefined()
		expect(isStale('https://x.test/a', 0)).toBe(false)
	})

	test('treats links within five minutes of expiry as stale', () => {
		const url = 'https://x.test/a?ex=3e8'

		expect(isStale(url, 1_000_000 - 300_001)).toBe(false)
		expect(isStale(url, 1_000_000 - 299_999)).toBe(true)
	})
})

describe('encoding', () => {
	test('encodes the whole URL once', () => {
		const encoded = encodeForHandoff(Signed)

		expect(encoded).not.toContain('&')
		expect(encoded).not.toContain('%25')
		expect(decodeURIComponent(encoded)).toBe(Signed)
	})
})

describe('hosts', () => {
	test('accepts only https', () => {
		expect(isHttps(Signed)).toBe(true)
		for (const url of ['http://a.test', 'file:///a', 'javascript:x', 7, null])
			expect(isHttps(url)).toBe(false)
	})

	test('recognises Discord media hosts', () => {
		expect(isDiscordMedia(Signed)).toBe(true)
		expect(isDiscordMedia('https://images-ext-1.discordapp.net/x')).toBe(true)
		expect(isDiscordMedia('https://cdn.discordapp.com.evil.test/x')).toBe(false)
	})
})
