export type ImageTagKind = 'credentials' | 'ai-label' | 'generator'

export interface ImageTag {
	kind: ImageTagKind
	label: string
}

const MaxSegmentBytes = 512 * 1024
const MaxSegments = 4096
const PngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const XmpPrefix = 'http://ns.adobe.com/xap/1.0/\0'
const XmpKeyword = 'XML:com.adobe.xmp'
const GeneratorRe =
	/stable[ -]?diffusion|midjourney|dall[·.-]?e|novelai|adobe firefly|comfyui|automatic1111|invokeai/i

const Credentials: ImageTag = {
	kind: 'credentials',
	label: 'Has Content Credentials',
}
const FullAi: ImageTag = { kind: 'ai-label', label: 'Labelled as AI-generated' }
const PartAi: ImageTag = {
	kind: 'ai-label',
	label: 'Labelled as partly AI-generated',
}
const SdSettings: ImageTag = {
	kind: 'generator',
	label: 'Has Stable Diffusion settings',
}
const ComfySettings: ImageTag = {
	kind: 'generator',
	label: 'Has ComfyUI settings',
}

// Fixed labels only, so no text from the file ever reaches the screen.
// EXIF is never parsed, which keeps GPS and location fields out of reach.
export function readImageTags(bytes: Uint8Array): ImageTag[] {
	const tags = startsWith(bytes, PngSignature)
		? readPng(bytes)
		: bytes[0] === 0xff && bytes[1] === 0xd8
			? readJpeg(bytes)
			: isWebp(bytes)
				? readWebp(bytes)
				: []

	return [...new Map(tags.map(tag => [tag.label, tag])).values()]
}

function startsWith(bytes: Uint8Array, prefix: number[]) {
	return prefix.every((value, index) => bytes[index] === value)
}

function isWebp(bytes: Uint8Array) {
	return latin1(bytes, 0, 4) === 'RIFF' && latin1(bytes, 8, 12) === 'WEBP'
}

function latin1(bytes: Uint8Array, start: number, end: number) {
	const stop = Math.min(end, bytes.length, start + MaxSegmentBytes)
	let out = ''
	for (let index = start; index < stop; index++)
		out += String.fromCharCode(bytes[index]!)

	return out
}

const u32be = (bytes: Uint8Array, at: number) =>
	(bytes[at]! * 0x1000000 +
		(bytes[at + 1]! << 16) +
		(bytes[at + 2]! << 8) +
		bytes[at + 3]!) >>>
	0

const u32le = (bytes: Uint8Array, at: number) =>
	(bytes[at]! +
		(bytes[at + 1]! << 8) +
		(bytes[at + 2]! << 16) +
		bytes[at + 3]! * 0x1000000) >>>
	0

function readPng(bytes: Uint8Array) {
	const tags: ImageTag[] = []
	let offset = 8

	for (let count = 0; count < MaxSegments; count++) {
		if (offset + 12 > bytes.length) break

		const length = u32be(bytes, offset)
		const type = latin1(bytes, offset + 4, offset + 8)
		const start = offset + 8
		if (type === 'IEND') break
		if (type === 'caBX') tags.push(Credentials)
		if (type === 'tEXt' || type === 'iTXt')
			tags.push(...pngText(latin1(bytes, start, start + length)))

		offset = start + length + 4
	}

	return tags
}

function pngText(chunk: string) {
	const end = chunk.indexOf('\0')
	if (end < 0) return []

	const keyword = chunk.slice(0, end)
	const value = chunk.slice(end + 1)
	if (keyword === 'parameters') return [SdSettings]
	if (keyword === 'prompt' || keyword === 'workflow') return [ComfySettings]
	if (keyword === XmpKeyword) return xmpTags(value)

	return generatorTag(value)
}

function xmpTags(xmp: string) {
	const tags: ImageTag[] = []
	if (xmp.includes('compositeWithTrainedAlgorithmicMedia')) tags.push(PartAi)
	else if (xmp.includes('trainedAlgorithmicMedia')) tags.push(FullAi)

	return [...tags, ...generatorTag(xmp)]
}

function generatorTag(value: string): ImageTag[] {
	const match = GeneratorRe.exec(value)?.[0]
	return match ? [{ kind: 'generator', label: `Made with ${match}` }] : []
}

function readJpeg(bytes: Uint8Array) {
	const tags: ImageTag[] = []
	let offset = 2

	for (let count = 0; count < MaxSegments; count++) {
		if (offset + 4 > bytes.length || bytes[offset] !== 0xff) break

		const marker = bytes[offset + 1]!
		// Padding before a marker
		if (marker === 0xff) {
			offset++
			continue
		}
		// Image data starts here, and tags never follow it
		if (marker === 0xda || marker === 0xd9) break

		const length = (bytes[offset + 2]! << 8) + bytes[offset + 3]!
		if (length < 2) break

		const start = offset + 4
		const end = offset + 2 + length
		if (marker === 0xe1) tags.push(...jpegApp1(bytes, start, end))
		if (marker === 0xeb && latin1(bytes, start, end).includes('c2pa'))
			tags.push(Credentials)
		if (marker === 0xfe) tags.push(...generatorTag(latin1(bytes, start, end)))

		offset = end
	}

	return tags
}

function jpegApp1(bytes: Uint8Array, start: number, end: number) {
	// EXIF also lives in APP1, so only segments marked as XMP are read
	if (latin1(bytes, start, start + XmpPrefix.length) !== XmpPrefix) return []

	return xmpTags(latin1(bytes, start + XmpPrefix.length, end))
}

function readWebp(bytes: Uint8Array) {
	const tags: ImageTag[] = []
	let offset = 12

	for (let count = 0; count < MaxSegments; count++) {
		if (offset + 8 > bytes.length) break

		const type = latin1(bytes, offset, offset + 4)
		const length = u32le(bytes, offset + 4)
		const start = offset + 8
		if (type === 'C2PA') tags.push(Credentials)
		if (type === 'XMP ')
			tags.push(...xmpTags(latin1(bytes, start, start + length)))

		// Chunks are padded to an even length
		offset = start + length + (length % 2)
	}

	return tags
}
