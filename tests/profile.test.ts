import { describe, expect, test } from 'bun:test'
import {
	ageInDays,
	ageText,
	createdAt,
	dateText,
} from '../plugins/reverse-image-search/js/core/account-age'
import { downloadCandidates } from '../plugins/reverse-image-search/js/core/acquire'
import { readImageTags } from '../plugins/reverse-image-search/js/core/image-tags'
import { handoffNotice } from '../plugins/reverse-image-search/js/core/messages'
import {
	authorIdOf,
	profileSignals,
	profileTargets,
	readProfile,
} from '../plugins/reverse-image-search/js/core/profile'
import {
	accountSignal,
	tagSignals,
} from '../plugins/reverse-image-search/js/core/signals'
import { toOriginal } from '../plugins/reverse-image-search/js/core/signed-url'
import {
	handoffImageUrl,
	hasOriginalFile,
} from '../plugins/reverse-image-search/js/core/target'

// Discord's own example: 2016-04-30 11:18:25.796 UTC
const Id = '175928847299117063'
const Created = Date.UTC(2016, 3, 30, 11, 18, 25, 796)
const Day = 86_400_000
const Hash = 'a'.repeat(32)

describe('account age', () => {
	test("matches Discord's documented example", () => {
		expect(createdAt(Id)).toBe(Created)
	})

	test('rejects anything that is not an ID', () => {
		for (const value of [undefined, 123, '', 'abc', '12', `${Id}x`])
			expect(createdAt(value)).toBeUndefined()
	})

	test('words the age for its size', () => {
		const cases: [number, string][] = [
			[0, 'less than a day'],
			[1, '1 day'],
			[59, '59 days'],
			[60, '1 month'],
			[300, '9 months'],
			[730, '1 year'],
			[1000, '2 years'],
		]

		for (const [days, label] of cases) expect(ageText(days)).toBe(label)
	})

	test('never goes negative and formats dates in UTC', () => {
		expect(ageInDays(1000, 0)).toBe(0)
		expect(dateText(Created)).toBe('30 Apr 2016')
	})
})

describe('accountSignal', () => {
	test('flags a new account in words', () => {
		expect(accountSignal(Id, Created + 3 * Day)).toMatchObject({
			title: 'New account: 3 days old',
			level: 'watch',
		})
	})

	test('treats 30 days as no longer new', () => {
		expect(accountSignal(Id, Created + 30 * Day)).toMatchObject({
			title: 'Account is 30 days old',
			level: 'note',
		})
	})

	test('gives the date to compare with TinEye', () => {
		expect(accountSignal(Id, Created + Day)?.detail).toContain(
			"Created 30 Apr 2016. Compare this with TinEye's oldest copy",
		)
		expect(accountSignal('x', 0)).toBeUndefined()
	})
})

describe('readProfile', () => {
	test('finds the author from either field', () => {
		expect(authorIdOf({ author: { id: Id } })).toBe(Id)
		expect(authorIdOf({ authorId: Id })).toBe(Id)
		expect(authorIdOf({ author: { id: 'x' } })).toBeUndefined()
		expect(authorIdOf(undefined)).toBeUndefined()
	})

	test('prefers the store, then the message, then profile details', () => {
		const profile = readProfile(
			{ author: { id: Id, username: 'old', avatar: 'b'.repeat(32) } },
			{ globalName: 'Shown', avatar: Hash },
			{ banner: `a_${Hash}` },
		)

		expect(profile).toEqual({
			id: Id,
			name: 'Shown',
			avatar: Hash,
			banner: `a_${Hash}`,
			bot: false,
		})
	})

	test('drops values that are not image hashes', () => {
		const profile = readProfile({ authorId: Id }, { avatar: '../x', banner: 7 })

		expect(profile).toEqual({ id: Id, name: 'This user', bot: false })
	})

	test('skips webhooks', () => {
		expect(readProfile({ authorId: Id, webhookId: '1' })).toBeUndefined()
		expect(
			readProfile({ authorId: Id }, { bot: true, discriminator: '0000' }),
		).toBeUndefined()
	})

	test('keeps real bots', () => {
		expect(
			readProfile({ authorId: Id }, { bot: true, discriminator: '1234' })?.bot,
		).toBe(true)
	})
})

describe('profile targets', () => {
	const profile = { id: Id, name: 'x', avatar: Hash, banner: Hash, bot: false }
	const [avatar, banner] = profileTargets(profile)

	test("uses Discord's public image paths as PNG", () => {
		expect(avatar?.url).toBe(
			`https://cdn.discordapp.com/avatars/${Id}/${Hash}.png?size=1024`,
		)
		expect(banner?.url).toBe(
			`https://cdn.discordapp.com/banners/${Id}/${Hash}.png?size=1024`,
		)
	})

	test('leaves out what the account does not have', () => {
		expect(profileTargets({ id: Id, name: 'x', bot: false })).toEqual([])
	})

	test('flows through the normal search and hand-off paths', () => {
		expect(handoffImageUrl(avatar!)).toBe(avatar!.url)
		expect(downloadCandidates(avatar!)[0]).toStartWith(avatar!.url)
		expect(hasOriginalFile(avatar!)).toBe(false)
	})

	test('describes the right details for each hand-off', () => {
		expect(handoffNotice(avatar!)).toContain("this user's ID")
		expect(
			handoffNotice({
				kind: 'attachment',
				label: 'a',
				url: 'x',
				spoiler: false,
			}),
		).toContain('channel ID')
	})
})

describe('profileSignals', () => {
	test('notes bots and missing pictures', () => {
		const ids = profileSignals(
			{ id: Id, name: 'x', bot: true },
			Created + Day,
		).map(signal => signal.id)

		expect(ids).toEqual(['account-age', 'bot', 'no-avatar'])
	})

	test('stays quiet about what looks normal', () => {
		const signals = profileSignals(
			{ id: Id, name: 'x', avatar: Hash, bot: false },
			Created + 500 * Day,
		)

		expect(signals.map(signal => signal.id)).toEqual(['account-age'])
	})
})

const ascii = (value: string) =>
	Uint8Array.from(value, char => char.charCodeAt(0))

function join(...parts: (Uint8Array | number[])[]) {
	return Uint8Array.from(parts.flatMap(part => [...part]))
}

const be32 = (value: number) => [
	value >>> 24,
	(value >> 16) & 255,
	(value >> 8) & 255,
	value & 255,
]
const le32 = (value: number) => be32(value).reverse()

const PngStart = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

const pngChunk = (type: string, data: Uint8Array) =>
	join(be32(data.length), ascii(type), data, [0, 0, 0, 0])

const png = (...chunks: Uint8Array[]) =>
	join(PngStart, ...chunks, pngChunk('IEND', new Uint8Array()))

const jpegSegment = (marker: number, data: Uint8Array) =>
	join([0xff, marker, (data.length + 2) >> 8, (data.length + 2) & 255], data)

const jpeg = (...segments: Uint8Array[]) =>
	join([0xff, 0xd8], ...segments, [0xff, 0xda, 0, 2, 1, 2, 3])

const riffChunk = (type: string, data: Uint8Array) =>
	join(ascii(type), le32(data.length), data, data.length % 2 ? [0] : [])

const webp = (...chunks: Uint8Array[]) =>
	join(ascii('RIFF'), [0, 0, 0, 0], ascii('WEBP'), ...chunks)

const Xmp = 'http://ns.adobe.com/xap/1.0/\0'
const AiXmp = '<x>digitalsourcetype/trainedAlgorithmicMedia</x>'
const PartXmp = '<x>digitalsourcetype/compositeWithTrainedAlgorithmicMedia</x>'

const labels = (bytes: Uint8Array) => readImageTags(bytes).map(tag => tag.label)

describe('readImageTags', () => {
	test('reads PNG text settings', () => {
		expect(
			labels(png(pngChunk('tEXt', ascii('parameters\0a cat\nSteps: 20')))),
		).toEqual(['Has Stable Diffusion settings'])
		expect(labels(png(pngChunk('tEXt', ascii('prompt\0{}'))))).toEqual([
			'Has ComfyUI settings',
		])
		expect(labels(png(pngChunk('tEXt', ascii('Software\0NovelAI'))))).toEqual([
			'Made with NovelAI',
		])
	})

	test('reads PNG credentials and XMP', () => {
		expect(labels(png(pngChunk('caBX', ascii('jumb'))))).toEqual([
			'Has Content Credentials',
		])
		expect(
			labels(
				png(pngChunk('iTXt', ascii(`XML:com.adobe.xmp\0\0\0\0\0${AiXmp}`))),
			),
		).toEqual(['Labelled as AI-generated'])
	})

	test('never searches PNG pixel data', () => {
		expect(
			labels(png(pngChunk('IDAT', ascii('parameters\0stable diffusion')))),
		).toEqual([])
	})

	test('reads JPEG XMP, credentials, and comments', () => {
		expect(labels(jpeg(jpegSegment(0xe1, ascii(Xmp + AiXmp))))).toEqual([
			'Labelled as AI-generated',
		])
		expect(labels(jpeg(jpegSegment(0xe1, ascii(Xmp + PartXmp))))).toEqual([
			'Labelled as partly AI-generated',
		])
		expect(labels(jpeg(jpegSegment(0xeb, ascii('JP..jumb..c2pa'))))).toEqual([
			'Has Content Credentials',
		])
		expect(
			labels(jpeg(jpegSegment(0xfe, ascii('Created with Midjourney')))),
		).toEqual(['Made with Midjourney'])
	})

	test('never reads EXIF', () => {
		const exif = 'Exif\0\0GPSLatitude stable diffusion trainedAlgorithmicMedia'

		expect(labels(jpeg(jpegSegment(0xe1, ascii(exif))))).toEqual([])
	})

	test('stops at JPEG image data', () => {
		const bytes = join(jpeg(), jpegSegment(0xfe, ascii('stable diffusion')))

		expect(labels(bytes)).toEqual([])
	})

	test('reads WebP chunks, skipping padded ones', () => {
		expect(
			labels(
				webp(
					riffChunk('VP8 ', ascii('abc')),
					riffChunk('XMP ', ascii(AiXmp)),
					riffChunk('C2PA', ascii('x')),
				),
			),
		).toEqual(['Labelled as AI-generated', 'Has Content Credentials'])
	})

	test('never repeats a tag', () => {
		expect(
			labels(
				png(
					pngChunk('tEXt', ascii('parameters\0a')),
					pngChunk('tEXt', ascii('parameters\0b')),
				),
			),
		).toEqual(['Has Stable Diffusion settings'])
	})

	test('survives broken and unknown files', () => {
		const huge = join(PngStart, be32(0xffffffff), ascii('tEXt'))
		const noLength = join([0xff, 0xd8, 0xff, 0xe1, 0, 0])

		expect(labels(new Uint8Array())).toEqual([])
		expect(labels(ascii('<html></html>'))).toEqual([])
		expect(labels(huge)).toEqual([])
		expect(labels(noLength)).toEqual([])
		expect(labels(png(pngChunk('tEXt', ascii('no separator'))))).toEqual([])
	})
})

describe('tagSignals', () => {
	test('says a clean result proves nothing', () => {
		expect(tagSignals([])).toEqual([
			expect.objectContaining({
				title: 'No AI tags found',
				level: 'note',
				detail: expect.stringContaining("doesn't prove"),
			}),
		])
	})

	test('says tags can be edited', () => {
		const [signal] = tagSignals([
			{ kind: 'ai-label', label: 'Labelled as AI-generated' },
		])

		expect(signal).toMatchObject({ level: 'watch' })
		expect(signal?.detail).toContain('can be added or edited')
	})
})

describe('toOriginal', () => {
	test('swaps the host and keeps the signature', () => {
		const path = 'attachments/1/2/a.png?ex=ff&is=00&hm=de&'

		expect(toOriginal(`https://media.discordapp.net/${path}`)).toBe(
			`https://cdn.discordapp.com/${path}`,
		)
	})

	test('leaves other links alone', () => {
		const other = 'https://media.discordapp.net/external/a.png'

		expect(toOriginal(other)).toBe(other)
	})
})
