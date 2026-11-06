const K = Uint32Array.from(
	(
		'428a2f98 71374491 b5c0fbcf e9b5dba5 3956c25b 59f111f1 923f82a4 ab1c5ed5 ' +
		'd807aa98 12835b01 243185be 550c7dc3 72be5d74 80deb1fe 9bdc06a7 c19bf174 ' +
		'e49b69c1 efbe4786 0fc19dc6 240ca1cc 2de92c6f 4a7484aa 5cb0a9dc 76f988da ' +
		'983e5152 a831c66d b00327c8 bf597fc7 c6e00bf3 d5a79147 06ca6351 14292967 ' +
		'27b70a85 2e1b2138 4d2c6dfc 53380d13 650a7354 766a0abb 81c2c92e 92722c85 ' +
		'a2bfe8a1 a81a664b c24b8b70 c76c51a3 d192e819 d6990624 f40e3585 106aa070 ' +
		'19a4c116 1e376c08 2748774c 34b0bcb5 391c0cb3 4ed8aa4a 5b9cca4f 682e6ff3 ' +
		'748f82ee 78a5636f 84c87814 8cc70208 90befffa a4506ceb bef9a3f7 c67178f2'
	)
		.split(' ')
		.map(word => Number.parseInt(word, 16)),
)

const rotate = (value: number, bits: number) =>
	(value >>> bits) | (value << (32 - bits))

// Written out because the phone may not have crypto.subtle
export function sha256(bytes: Uint8Array) {
	const padded = new Uint8Array(((bytes.length + 9 + 63) >> 6) << 6)
	padded.set(bytes)
	padded[bytes.length] = 0x80
	const view = new DataView(padded.buffer)
	view.setUint32(padded.length - 8, Math.floor(bytes.length / 0x20000000))
	view.setUint32(padded.length - 4, (bytes.length << 3) >>> 0)

	const state = Uint32Array.from([
		0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c,
		0x1f83d9ab, 0x5be0cd19,
	])
	const w = new Uint32Array(64)

	for (let offset = 0; offset < padded.length; offset += 64) {
		for (let t = 0; t < 16; t++) w[t] = view.getUint32(offset + t * 4)
		for (let t = 16; t < 64; t++) {
			const a = w[t - 15]!
			const b = w[t - 2]!
			const s0 = rotate(a, 7) ^ rotate(a, 18) ^ (a >>> 3)
			const s1 = rotate(b, 17) ^ rotate(b, 19) ^ (b >>> 10)
			w[t] = (w[t - 16]! + s0 + w[t - 7]! + s1) | 0
		}

		let [a, b, c, d, e, f, g, h] = state as unknown as number[]
		for (let t = 0; t < 64; t++) {
			const s1 = rotate(e!, 6) ^ rotate(e!, 11) ^ rotate(e!, 25)
			const ch = (e! & f!) ^ (~e! & g!)
			const t1 = (h! + s1 + ch + K[t]! + w[t]!) | 0
			const s0 = rotate(a!, 2) ^ rotate(a!, 13) ^ rotate(a!, 22)
			const maj = (a! & b!) ^ (a! & c!) ^ (b! & c!)
			h = g
			g = f
			f = e
			e = (d! + t1) | 0
			d = c
			c = b
			b = a
			a = (t1 + s0 + maj) | 0
		}

		;[a, b, c, d, e, f, g, h].forEach((value, index) => {
			state[index] = (state[index]! + value!) | 0
		})
	}

	return [...state].map(word => word.toString(16).padStart(8, '0')).join('')
}
