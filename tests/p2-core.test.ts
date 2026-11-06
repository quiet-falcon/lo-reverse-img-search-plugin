import { describe, expect, test } from 'bun:test'
import { downloadCandidates } from '../plugins/reverse-image-search/js/core/acquire'
import {
	hiddenSummary,
	visibleResults,
} from '../plugins/reverse-image-search/js/core/messages'
import { createSearchSession } from '../plugins/reverse-image-search/js/core/session'
import {
	scaledSize,
	withParams,
} from '../plugins/reverse-image-search/js/core/signed-url'
import { sniffImage } from '../plugins/reverse-image-search/js/core/sniff'
import type { ProviderResult } from '../plugins/reverse-image-search/js/core/types'

const Cdn =
	'https://cdn.discordapp.com/attachments/1/2/a.png?ex=ffffffff&is=00000000&hm=deadbeef&'
const Media =
	'https://media.discordapp.net/attachments/1/2/a.png?ex=ffffffff&is=00000000&hm=deadbeef&'

const bytes = (...values: number[]) => {
	const out = new Uint8Array(16)
	out.set(values)
	return out
}
const ascii = (text: string, offset = 0) => {
	const out = new Uint8Array(16)
	out.set(
		[...text].map(char => char.charCodeAt(0)),
		offset,
	)
	return out
}

describe('sniffImage', () => {
	test('detects common image formats from bytes', () => {
		expect(sniffImage(bytes(0xff, 0xd8, 0xff, 0xe0))?.mime).toBe('image/jpeg')
		expect(
			sniffImage(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))?.mime,
		).toBe('image/png')
		expect(sniffImage(ascii('GIF89a'))?.mime).toBe('image/gif')
		const webp = ascii('RIFF')
		webp.set(
			[...'WEBP'].map(char => char.charCodeAt(0)),
			8,
		)
		expect(sniffImage(webp)?.mime).toBe('image/webp')
	})

	test('detects AVIF and HEIC brands', () => {
		const avif = ascii('ftypavif', 4)
		const heic = ascii('ftypheic', 4)

		expect(sniffImage(avif)?.mime).toBe('image/avif')
		expect(sniffImage(heic)?.mime).toBe('image/heic')
	})

	test('rejects HTML, video, short files, and unknown bytes', () => {
		expect(sniffImage(ascii('<!DOCTYPE html>'))).toBeUndefined()
		expect(sniffImage(ascii('ftypisom', 4))).toBeUndefined()
		expect(sniffImage(new Uint8Array([0xff, 0xd8]))).toBeUndefined()
		expect(sniffImage(new Uint8Array(16))).toBeUndefined()
	})
})

describe('withParams', () => {
	test('keeps the signature and its trailing ampersand', () => {
		expect(withParams(Media, { format: 'jpeg' })).toBe(`${Media}format=jpeg`)
	})

	test('does not duplicate existing parameters', () => {
		const url = `${Media}format=png`

		expect(withParams(url, { format: 'jpeg', width: '10' })).toBe(
			`${url}&width=10`,
		)
	})

	test('handles URLs without a query and keeps a hash', () => {
		expect(withParams('https://x.test/a#h', { a: '1' })).toBe(
			'https://x.test/a?a=1#h',
		)
	})
})

describe('scaledSize', () => {
	test('fits the longest edge and keeps the ratio', () => {
		expect(scaledSize(3200, 1600, 1600)).toEqual({ width: 1600, height: 800 })
	})

	test('never enlarges, and ignores missing sizes', () => {
		expect(scaledSize(100, 50, 1600)).toEqual({ width: 100, height: 50 })
		expect(scaledSize(undefined, 50, 1600)).toBeUndefined()
	})
})

describe('downloadCandidates', () => {
	const target = {
		kind: 'attachment' as const,
		label: 'a.png',
		url: Cdn,
		proxyUrl: Media,
		spoiler: false,
		width: 3200,
		height: 1600,
	}

	test('tries the proxy as JPEG, then PNG, then the original', () => {
		expect(downloadCandidates(target)).toEqual([
			`${Media}format=jpeg&width=1600&height=800`,
			`${Media}format=png&width=1600&height=800`,
			Cdn,
		])
	})

	test('only uses Discord copies of external embeds', () => {
		const external = {
			kind: 'embed' as const,
			label: 'x',
			url: 'https://example.com/a.png',
			proxyUrl: 'https://images-ext-1.discordapp.net/external/x/a.png',
			spoiler: false,
		}

		expect(downloadCandidates(external)).toEqual([
			'https://images-ext-1.discordapp.net/external/x/a.png?format=jpeg',
			'https://images-ext-1.discordapp.net/external/x/a.png?format=png',
		])
	})

	test('has nothing to try for an external link with no copy', () => {
		expect(
			downloadCandidates({
				kind: 'embed',
				label: 'x',
				url: 'https://example.com/a.png',
				spoiler: false,
			}),
		).toEqual([])
	})
})

describe('createSearchSession', () => {
	test('allows one search at a time', () => {
		const session = createSearchSession()
		const token = session.begin()

		expect(token).toBeDefined()
		expect(session.begin()).toBeUndefined()
		session.finish(token!)
		expect(session.begin()).toBeDefined()
	})

	test('cancel aborts pending work and retires the token', () => {
		const session = createSearchSession()
		const token = session.begin()!
		let aborted = 0
		session.onCancel(() => aborted++)

		session.cancel()

		expect(aborted).toBe(1)
		expect(session.isCurrent(token)).toBe(false)
		expect(session.isActive()).toBe(false)
	})

	test('an old token cannot finish a new search', () => {
		const session = createSearchSession()
		const old = session.begin()!
		session.cancel()
		const next = session.begin()!

		session.finish(old)

		expect(session.isCurrent(next)).toBe(true)
	})
})

describe('visibleResults', () => {
	const result = (
		tier: ProviderResult['tier'],
		adult = false,
	): ProviderResult => ({
		provider: 'tracemoe',
		title: 't',
		detail: '',
		similarity: 0.95,
		tier,
		adult,
	})

	test('hides possible and adult results by default', () => {
		const { shown, hidden } = visibleResults([
			result('exact'),
			result('strong'),
			result('possible'),
			result('exact', true),
		])

		expect(shown).toHaveLength(2)
		expect(hidden).toBe(2)
	})

	test('shows weaker results on request but keeps adult ones hidden', () => {
		const all = [result('exact'), result('possible'), result('possible', true)]
		const { shown, weak, adult } = visibleResults(all, true)

		expect(shown).toHaveLength(2)
		expect(weak).toBe(1)
		expect(adult).toBe(1)
	})

	test('summarises what is hidden', () => {
		expect(hiddenSummary(3, 1, false)).toBe('3 weaker and 1 adult hidden.')
		expect(hiddenSummary(3, 0, true)).toBe('')
		expect(hiddenSummary(0, 0, false)).toBe('')
	})
})
