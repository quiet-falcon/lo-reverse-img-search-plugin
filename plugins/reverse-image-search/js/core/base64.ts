const Alphabet =
	'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

// Built by hand because Discord's JS engine may not have btoa
export function toBase64(bytes: Uint8Array) {
	const parts: string[] = []
	let chunk = ''

	for (let index = 0; index < bytes.length; index += 3) {
		const first = bytes[index]!
		const second = bytes[index + 1]
		const third = bytes[index + 2]
		const triple = (first << 16) | ((second ?? 0) << 8) | (third ?? 0)

		chunk += Alphabet[(triple >> 18) & 63]!
		chunk += Alphabet[(triple >> 12) & 63]!
		chunk += second === undefined ? '=' : Alphabet[(triple >> 6) & 63]!
		chunk += third === undefined ? '=' : Alphabet[triple & 63]!

		if (chunk.length >= 8192) {
			parts.push(chunk)
			chunk = ''
		}
	}
	parts.push(chunk)

	return parts.join('')
}
