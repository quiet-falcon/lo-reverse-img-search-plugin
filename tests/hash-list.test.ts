import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'
import { hashCandidates } from '../plugins/reverse-image-search/js/core/acquire'
import {
	addSaved,
	findMatch,
	isReliable,
	MaxSaved,
	matchSignal,
	readSavedImages,
	removeSaved,
} from '../plugins/reverse-image-search/js/core/hash-list'
import { inflate } from '../plugins/reverse-image-search/js/core/inflate'
import {
	hashDistance,
	hashImage,
} from '../plugins/reverse-image-search/js/core/pdq'
import {
	decodePng,
	thumbnailUri,
} from '../plugins/reverse-image-search/js/core/pixels'
import { readSettings } from '../plugins/reverse-image-search/js/core/settings'
import type { ImageHash } from '../plugins/reverse-image-search/js/core/pdq'

const Dir = new URL('./fixtures/pdq/', import.meta.url).pathname
const Reference = JSON.parse(
	readFileSync(`${Dir}reference.json`, 'utf8'),
) as Record<string, { bits: number[]; quality: number; dihedral: number[][] }>

function toHex(bits: number[]) {
	let hex = ''
	for (let index = 0; index < 256; index += 4) {
		const [a, b, c, d] = bits.slice(index, index + 4) as [
			number,
			number,
			number,
			number,
		]
		hex += (a * 8 + b * 4 + c * 2 + d).toString(16)
	}
	return hex
}

function load(name: string) {
	const pixels = decodePng(new Uint8Array(readFileSync(`${Dir}${name}.png`)))
	if (!pixels) throw new Error(`Couldn't decode ${name}`)

	const image = hashImage(pixels)
	if (!image) throw new Error(`Couldn't hash ${name}`)

	return { pixels, image }
}

const saved = (image: ImageHash, label = 'x') =>
	addSaved([], image, label, 'data:image/png;base64,AA==', 0)

describe('PDQ', () => {
	const detailed = Object.keys(Reference).filter(name =>
		name.startsWith('scene'),
	)

	test('matches the reference hash and quality exactly', () => {
		expect(detailed.length).toBeGreaterThan(5)
		for (const name of detailed) {
			const { image } = load(name)

			expect(image.hash).toBe(toHex(Reference[name]!.bits))
			expect(image.quality).toBe(Reference[name]!.quality)
		}
	})

	test('matches all eight reference flips and rotations', () => {
		for (const name of detailed)
			expect(load(name).image.variants).toEqual(
				Reference[name]!.dihedral.map(toHex),
			)
	})

	test('reads every PNG colour type the same way as the reference', () => {
		expect(readdirSync(Dir).filter(file => file.endsWith('.png'))).toHaveLength(
			9,
		)
		expect(load('scene-a-rgba').image.hash).toBe(load('scene-a').image.hash)
	})

	test('rejects images too small to hash', () => {
		const rgb = new Uint8Array(4 * 4 * 3)

		expect(hashImage({ width: 4, height: 4, rgb })).toBeUndefined()
	})

	test('counts differing bits', () => {
		expect(hashDistance('0f', '00')).toBe(4)
		expect(hashDistance('ff', 'ff')).toBe(0)
	})
})

describe('quality gate', () => {
	test('rejects flat and low-detail images', () => {
		expect(isReliable(load('flat').image)).toBe(false)
		expect(isReliable(load('gradient').image)).toBe(false)
	})

	test('accepts detailed images', () => {
		expect(isReliable(load('scene-a').image)).toBe(true)
	})
})

describe('findMatch', () => {
	const list = saved(load('scene-a').image, 'Saved')

	test('catches resized and mirrored copies', () => {
		expect(findMatch(load('scene-a-small').image, list)?.entry.label).toBe(
			'Saved',
		)
		expect(findMatch(load('scene-a-mirror').image, list)?.distance).toBe(0)
	})

	test('leaves different images alone', () => {
		for (const name of ['scene-b', 'scene-c', 'scene-d'])
			expect(findMatch(load(name).image, list)).toBeUndefined()
	})

	test('picks the closest entry', () => {
		const both = [...saved(load('scene-b').image, 'Other'), ...list]

		expect(findMatch(load('scene-a').image, both)?.entry.label).toBe('Saved')
		expect(findMatch(load('scene-a').image, [])).toBeUndefined()
	})

	test('says what the match is based on', () => {
		const match = findMatch(load('scene-a').image, list)!

		expect(matchSignal(match)).toMatchObject({
			title: 'Matches your saved image: Saved',
			level: 'watch',
		})
		expect(matchSignal(match).detail).toContain('0 of 256 hash bits differ')
	})
})

describe('saved list', () => {
	const { image } = load('scene-a')

	test('adds newest first, up to the limit, then removes by hash', () => {
		let list = saved(image)
		for (let index = 0; index < MaxSaved + 3; index++)
			list = addSaved(list, image, `${index}`, list[0]!.thumb, index)

		expect(list).toHaveLength(MaxSaved)
		expect(list[0]!.label).toBe(`${MaxSaved + 2}`)
		expect(removeSaved(list, image.hash)).toEqual([])
	})

	test('shortens long labels', () => {
		expect(addSaved([], image, 'x'.repeat(500), '', 0)[0]!.label).toHaveLength(
			80,
		)
	})

	test('survives a settings reload and drops broken entries', () => {
		const good = saved(image)[0]!

		expect(
			readSettings({ hashList: [good, { hash: 'x' }, 'y', null] }).hashList,
		).toEqual([good])
		expect(readSavedImages('x')).toEqual([])
		expect(readSettings({}).hashList).toEqual([])
	})
})

describe('thumbnailUri', () => {
	test('makes a small PNG that decodes again', () => {
		const { pixels } = load('scene-a')
		const uri = thumbnailUri(pixels)
		const bytes = Buffer.from(uri.split(',')[1]!, 'base64')
		const thumb = decodePng(new Uint8Array(bytes))

		expect(uri).toStartWith('data:image/png;base64,')
		expect(thumb).toMatchObject({ width: 40, height: 40 })
		expect(uri.length).toBeLessThan(7000)
	})
})

describe('decodePng', () => {
	test('refuses anything it can not read', () => {
		expect(decodePng(new Uint8Array([1, 2, 3]))).toBeUndefined()

		const file = new Uint8Array(readFileSync(`${Dir}scene-a.png`))
		expect(decodePng(file.subarray(0, 200))).toBeUndefined()

		// Corrupt the first image data byte after the zlib header
		const broken = file.slice()
		const at = Buffer.from(broken).indexOf('IDAT') + 6
		broken.fill(255, at, at + 40)
		expect(decodePng(broken)).toBeUndefined()
	})
})

describe('inflate', () => {
	test('matches zlib at every compression level', () => {
		const input = Uint8Array.from({ length: 5000 }, (_, index) =>
			index % 7 ? (index * index) % 251 : 0,
		)

		for (const level of [0, 1, 6, 9]) {
			const packed = deflateSync(input, { level })

			expect(inflate(packed, 2, input.length)).toEqual(input)
		}
	})

	test('refuses data larger than promised', () => {
		const packed = deflateSync(new Uint8Array(1000))

		expect(() => inflate(packed, 2, 10)).toThrow()
	})
})

describe('hashCandidates', () => {
	const Signed =
		'https://cdn.discordapp.com/attachments/1/2/a.png?ex=ff&is=00&hm=de&'

	test('asks for a small PNG and keeps the signature', () => {
		const [proxy, original] = hashCandidates({
			kind: 'attachment',
			label: 'a',
			url: Signed,
			spoiler: false,
			width: 2000,
			height: 1000,
		})

		expect(proxy).toBe(
			'https://media.discordapp.net/attachments/1/2/a.png?ex=ff&is=00&hm=de&format=png&width=256&height=128',
		)
		expect(original).toBe(Signed)
	})

	test('shrinks avatars with the size parameter', () => {
		expect(
			hashCandidates({
				kind: 'avatar',
				label: 'a',
				url: 'https://cdn.discordapp.com/avatars/1/a.png?size=1024',
				spoiler: false,
			}),
		).toEqual(['https://cdn.discordapp.com/avatars/1/a.png?size=256'])
	})
})
