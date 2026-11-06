// Built by hand because React Native's FormData can't take raw bytes
export function multipartFile(
	field: string,
	filename: string,
	mime: string,
	bytes: Uint8Array,
	boundary: string,
) {
	const head = ascii(
		`--${boundary}\r\nContent-Disposition: form-data; name="${field}"; filename="${filename}"\r\nContent-Type: ${mime}\r\n\r\n`,
	)
	const tail = ascii(`\r\n--${boundary}--\r\n`)
	const body = new Uint8Array(head.length + bytes.length + tail.length)
	body.set(head)
	body.set(bytes, head.length)
	body.set(tail, head.length + bytes.length)

	return { body, contentType: `multipart/form-data; boundary=${boundary}` }
}

export const randomBoundary = () =>
	`----ris${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`

export function ascii(text: string) {
	const out = new Uint8Array(text.length)
	for (let index = 0; index < text.length; index++) {
		const code = text.charCodeAt(index)
		if (code > 0x7e) throw new Error('Multipart headers must be ASCII')
		out[index] = code
	}
	return out
}
