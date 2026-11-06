export interface SniffedImage {
	mime: string
	ext: string
}

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0) =>
	signature.every((byte, index) => bytes[offset + index] === byte)

const ascii = (bytes: Uint8Array, from: number, to: number) =>
	String.fromCharCode(...bytes.subarray(from, to))

const IsoBrands: Record<string, SniffedImage> = {
	avif: { mime: 'image/avif', ext: 'avif' },
	avis: { mime: 'image/avif', ext: 'avif' },
	heic: { mime: 'image/heic', ext: 'heic' },
	heix: { mime: 'image/heic', ext: 'heic' },
	mif1: { mime: 'image/heif', ext: 'heif' },
}

// Bytes decide the type, because Discord's declared types can't be trusted
export function sniffImage(bytes: Uint8Array): SniffedImage | undefined {
	if (bytes.length < 12) return

	if (startsWith(bytes, [0xff, 0xd8, 0xff]))
		return { mime: 'image/jpeg', ext: 'jpg' }
	if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
		return { mime: 'image/png', ext: 'png' }
	if (ascii(bytes, 0, 6) === 'GIF87a' || ascii(bytes, 0, 6) === 'GIF89a')
		return { mime: 'image/gif', ext: 'gif' }
	if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP')
		return { mime: 'image/webp', ext: 'webp' }
	if (ascii(bytes, 4, 8) === 'ftyp') return IsoBrands[ascii(bytes, 8, 12)]
}
