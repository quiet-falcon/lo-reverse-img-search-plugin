import { describe, expect, test } from 'bun:test'
import {
	handoffImageUrl,
	previewUrl,
	targetFromViewer,
	targetsFromMessage,
} from '../plugins/reverse-image-search/js/core/target'

const Cdn =
	'https://cdn.discordapp.com/attachments/1/2/a.png?ex=ffffffff&is=00000000&hm=deadbeef&'
const Media =
	'https://media.discordapp.net/attachments/1/2/a.png?ex=ffffffff&is=00000000&hm=deadbeef&'

const attachment = (fields = {}) => ({
	url: Cdn,
	proxy_url: Media,
	filename: 'a.png',
	content_type: 'image/png',
	width: 10,
	height: 10,
	...fields,
})

describe('targetsFromMessage', () => {
	test('finds an image attachment', () => {
		expect(targetsFromMessage({ attachments: [attachment()] })).toEqual([
			{
				kind: 'attachment',
				label: 'a.png',
				url: Cdn,
				proxyUrl: Media,
				spoiler: false,
				width: 10,
				height: 10,
			},
		])
	})

	test('keeps an octet-stream image that reports a size', () => {
		const [target] = targetsFromMessage({
			attachments: [
				attachment({
					filename: 'upload',
					content_type: 'application/octet-stream',
				}),
			],
		})

		expect(target?.url).toBe(Cdn)
	})

	test('skips videos and plain files', () => {
		expect(
			targetsFromMessage({
				attachments: [
					attachment({ content_type: 'video/mp4', filename: 'a.mp4' }),
					attachment({
						content_type: 'application/octet-stream',
						filename: 'b.mov',
					}),
					attachment({
						content_type: 'text/plain',
						filename: 'c.txt',
						width: 0,
						height: 0,
					}),
				],
			}),
		).toEqual([])
	})

	test('marks spoilers and tidies their label', () => {
		const [target] = targetsFromMessage({
			attachments: [attachment({ filename: 'SPOILER_a.png' })],
		})

		expect(target).toMatchObject({ spoiler: true, label: 'a.png' })
	})

	test('reads embed images in camelCase', () => {
		const url = 'https://example.com/a.png'
		const proxyURL = 'https://images-ext-1.discordapp.net/external/x/a.png'

		expect(
			targetsFromMessage({ embeds: [{ image: { url, proxyURL } }] }),
		).toEqual([
			{
				kind: 'embed',
				label: 'Embed image 1',
				url,
				proxyUrl: proxyURL,
				spoiler: false,
			},
		])
	})

	test('falls back to the embed thumbnail', () => {
		const url = 'https://example.com/thumb.jpg'

		expect(
			targetsFromMessage({ embeds: [{ thumbnail: { url } }] })[0]?.url,
		).toBe(url)
	})

	test('skips video embeds', () => {
		expect(
			targetsFromMessage({
				embeds: [
					{
						thumbnail: {
							url: 'https://example.com/a.mp4',
							contentType: 'video/mp4',
						},
					},
				],
			}),
		).toEqual([])
	})

	test('dedupes repeated images and keeps several', () => {
		const other = attachment({ url: `${Cdn}x=1` })

		expect(
			targetsFromMessage({ attachments: [attachment(), attachment(), other] }),
		).toHaveLength(2)
	})

	test('survives malformed records', () => {
		for (const message of [
			null,
			undefined,
			'text',
			{},
			{ attachments: 'x', embeds: 7 },
			{ attachments: [null, 4, {}], embeds: [null, {}, { image: 'x' }] },
			{
				attachments: [{ url: 'http://insecure.test/a.png', filename: 'a.png' }],
			},
		])
			expect(targetsFromMessage(message)).toEqual([])
	})
})

describe('targetFromViewer', () => {
	test('prefers the source link and keeps the proxy link', () => {
		expect(
			targetFromViewer({
				sourceURI: Cdn,
				uri: Media,
				contentType: 'image/png',
				filename: 'a.png',
			}),
		).toEqual({
			kind: 'viewer',
			label: 'a.png',
			url: Cdn,
			proxyUrl: Media,
			spoiler: false,
		})
	})

	test('works without attachment fields', () => {
		expect(targetFromViewer({ shareURI: Media })).toMatchObject({
			label: 'This image',
			url: Media,
		})
	})

	test('treats obscured media as a spoiler', () => {
		expect(targetFromViewer({ uri: Media, obscure: true })?.spoiler).toBe(true)
	})

	test('skips videos, local files, and bad shapes', () => {
		expect(
			targetFromViewer({ uri: Media, contentType: 'video/mp4' }),
		).toBeUndefined()
		expect(targetFromViewer({ uri: 'file:///a.png' })).toBeUndefined()
		expect(targetFromViewer(null)).toBeUndefined()
	})
})

describe('handoffImageUrl', () => {
	const [target] = targetsFromMessage({ attachments: [attachment()] })
	const external = {
		kind: 'embed' as const,
		label: 'x',
		url: 'https://example.com/a.png',
		proxyUrl: 'https://images-ext-1.discordapp.net/x',
		spoiler: false,
	}

	test('prefers the proxy link', () => {
		expect(handoffImageUrl(target!)).toBe(Media)
	})

	test('switches to the original link', () => {
		expect(handoffImageUrl(target!, { swap: true })).toBe(Cdn)
	})

	test('starts with the original for engines that prefer it', () => {
		expect(handoffImageUrl(target!, { prefersOriginal: true })).toBe(Cdn)
		expect(
			handoffImageUrl(target!, { prefersOriginal: true, swap: true }),
		).toBe(Media)
	})

	test('builds a proxy link when Discord gave none', () => {
		const { proxyUrl: _, ...rest } = target!

		expect(handoffImageUrl(rest)).toBe(Media)
	})

	test("starts external embeds on the site's own link", () => {
		expect(handoffImageUrl(external)).toBe(external.url)
	})

	test("switches external embeds to Discord's copy", () => {
		expect(handoffImageUrl(external, { swap: true })).toBe(external.proxyUrl)
	})

	test('keeps an external link when there is no copy', () => {
		const { proxyUrl: _, ...rest } = external

		expect(handoffImageUrl(rest, { swap: true })).toBe(external.url)
	})

	test('previews through the proxy', () => {
		expect(previewUrl(target!)).toBe(Media)
	})
})
