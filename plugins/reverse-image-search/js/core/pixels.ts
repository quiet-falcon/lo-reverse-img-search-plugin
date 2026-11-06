import { toBase64 } from './base64'
import { inflate } from './inflate'

export interface Pixels {
	width: number
	height: number
	// Three bytes per pixel, with any transparency ignored
	rgb: Uint8Array
}

const Signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const MaxPixels = 4_000_000
const ChannelCounts: Record<number, number> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }
const ThumbSize = 40

const u32 = (bytes: Uint8Array, at: number) =>
	(bytes[at]! * 0x1000000 +
		(bytes[at + 1]! << 16) +
		(bytes[at + 2]! << 8) +
		bytes[at + 3]!) >>>
	0

const type = (bytes: Uint8Array, at: number) =>
	String.fromCharCode(
		bytes[at]!,
		bytes[at + 1]!,
		bytes[at + 2]!,
		bytes[at + 3]!,
	)

export const isPng = (bytes: Uint8Array) =>
	Signature.every((value, index) => bytes[index] === value)

// Returns undefined for anything it can't read, rather than guessing
export function decodePng(bytes: Uint8Array): Pixels | undefined {
	if (!isPng(bytes)) return

	try {
		return readPng(bytes)
	} catch {
		return undefined
	}
}

function readPng(bytes: Uint8Array) {
	let width = 0
	let height = 0
	let colorType = -1
	let palette: Uint8Array | undefined
	const parts: Uint8Array[] = []
	let total = 0

	for (let offset = 8; offset + 12 <= bytes.length; ) {
		const length = u32(bytes, offset)
		const name = type(bytes, offset + 4)
		const start = offset + 8
		if (start + length > bytes.length) return

		if (name === 'IHDR') {
			width = u32(bytes, start)
			height = u32(bytes, start + 4)
			colorType = bytes[start + 9]!
			// Discord serves 8-bit, non-interlaced PNGs
			if (bytes[start + 8] !== 8 || bytes[start + 12] !== 0) return
		}
		if (name === 'PLTE') palette = bytes.subarray(start, start + length)
		if (name === 'IDAT') {
			parts.push(bytes.subarray(start, start + length))
			total += length
		}
		if (name === 'IEND') break

		offset = start + length + 4
	}

	const channels = ChannelCounts[colorType]
	if (!channels || !width || !height || width * height > MaxPixels) return
	if (colorType === 3 && !palette) return

	const joined = new Uint8Array(total)
	let at = 0
	for (const part of parts) {
		joined.set(part, at)
		at += part.length
	}

	const stride = width * channels
	const raw = inflate(joined, 2, (stride + 1) * height)
	unfilter(raw, stride, channels, height)

	return { width, height, rgb: toRgb(raw, width, height, colorType, palette) }
}

function unfilter(
	raw: Uint8Array,
	stride: number,
	channels: number,
	height: number,
) {
	for (let row = 0; row < height; row++) {
		const line = row * (stride + 1)
		const filter = raw[line]
		const start = line + 1
		const above = start - stride - 1

		for (let index = 0; index < stride; index++) {
			const left = index >= channels ? raw[start + index - channels]! : 0
			const up = row ? raw[above + index]! : 0
			const corner =
				row && index >= channels ? raw[above + index - channels]! : 0
			let add = 0
			if (filter === 1) add = left
			else if (filter === 2) add = up
			else if (filter === 3) add = (left + up) >> 1
			else if (filter === 4) add = paeth(left, up, corner)
			else if (filter !== 0) throw new Error('Bad PNG filter')

			raw[start + index] = (raw[start + index]! + add) & 255
		}
	}
}

function paeth(left: number, up: number, corner: number) {
	const estimate = left + up - corner
	const toLeft = Math.abs(estimate - left)
	const toUp = Math.abs(estimate - up)
	const toCorner = Math.abs(estimate - corner)
	if (toLeft <= toUp && toLeft <= toCorner) return left

	return toUp <= toCorner ? up : corner
}

function toRgb(
	raw: Uint8Array,
	width: number,
	height: number,
	colorType: number,
	palette: Uint8Array | undefined,
) {
	const channels = ChannelCounts[colorType]!
	const stride = width * channels + 1
	const rgb = new Uint8Array(width * height * 3)
	let out = 0

	for (let row = 0; row < height; row++) {
		let from = row * stride + 1
		for (let column = 0; column < width; column++) {
			if (colorType === 3) {
				const entry = raw[from]! * 3
				rgb[out++] = palette![entry] ?? 0
				rgb[out++] = palette![entry + 1] ?? 0
				rgb[out++] = palette![entry + 2] ?? 0
			} else if (colorType === 0 || colorType === 4) {
				rgb[out++] = raw[from]!
				rgb[out++] = raw[from]!
				rgb[out++] = raw[from]!
			} else {
				rgb[out++] = raw[from]!
				rgb[out++] = raw[from + 1]!
				rgb[out++] = raw[from + 2]!
			}
			from += channels
		}
	}

	return rgb
}

const CrcTable = Int32Array.from({ length: 256 }, (_, index) => {
	let value = index
	for (let bit = 0; bit < 8; bit++)
		value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
	return value
})

function crc32(bytes: Uint8Array) {
	let crc = -1
	for (const byte of bytes) crc = CrcTable[(crc ^ byte) & 255]! ^ (crc >>> 8)

	return (crc ^ -1) >>> 0
}

function adler32(bytes: Uint8Array) {
	let low = 1
	let high = 0
	for (const byte of bytes) {
		low = (low + byte) % 65521
		high = (high + low) % 65521
	}

	return ((high << 16) | low) >>> 0
}

const be32 = (value: number) => [
	value >>> 24,
	(value >>> 16) & 255,
	(value >>> 8) & 255,
	value & 255,
]

function chunk(name: string, data: Uint8Array) {
	const body = new Uint8Array(4 + data.length)
	for (let index = 0; index < 4; index++) body[index] = name.charCodeAt(index)
	body.set(data, 4)

	return [...be32(data.length), ...body, ...be32(crc32(body))]
}

// Small and uncompressed, so a saved image only needs a few kilobytes
export function thumbnailUri({ width, height, rgb }: Pixels) {
	const size = Math.min(width, height)
	const left = (width - size) >> 1
	const top = (height - size) >> 1
	const stride = ThumbSize * 3 + 1
	const raw = new Uint8Array(stride * ThumbSize)

	for (let row = 0; row < ThumbSize; row++) {
		const y = top + Math.floor(((row + 0.5) * size) / ThumbSize)
		for (let column = 0; column < ThumbSize; column++) {
			const x = left + Math.floor(((column + 0.5) * size) / ThumbSize)
			const from = (y * width + x) * 3
			const to = row * stride + 1 + column * 3
			raw[to] = rgb[from]!
			raw[to + 1] = rgb[from + 1]!
			raw[to + 2] = rgb[from + 2]!
		}
	}

	const zlib = new Uint8Array([
		0x78,
		0x01,
		1,
		raw.length & 255,
		raw.length >> 8,
		~raw.length & 255,
		(~raw.length >> 8) & 255,
		...raw,
		...be32(adler32(raw)),
	])
	const header = new Uint8Array([
		...be32(ThumbSize),
		...be32(ThumbSize),
		8,
		2,
		0,
		0,
		0,
	])
	const png = new Uint8Array([
		...Signature,
		...chunk('IHDR', header),
		...chunk('IDAT', zlib),
		...chunk('IEND', new Uint8Array()),
	])

	return `data:image/png;base64,${toBase64(png)}`
}
