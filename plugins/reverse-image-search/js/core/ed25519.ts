// Ed25519 signature checks, written out because the phone may lack WebCrypto.
// BigInt calls stay inside functions, so a missing BigInt can only fail a check.
type Point = [bigint, bigint, bigint, bigint]

interface Curve {
	p: bigint
	l: bigint
	d: bigint
	root: bigint
	base: Point
}

let cached: Curve | undefined

const big = (value: string | number) => BigInt(value)

function modulo(value: bigint, modulus: bigint) {
	const rest = value % modulus
	return rest < big(0) ? rest + modulus : rest
}

function power(base: bigint, exponent: bigint, modulus: bigint) {
	let result = big(1)
	let square = modulo(base, modulus)
	for (let rest = exponent; rest > big(0); rest >>= big(1)) {
		if (rest & big(1)) result = (result * square) % modulus
		square = (square * square) % modulus
	}

	return result
}

const inverse = (value: bigint, p: bigint) => power(value, p - big(2), p)

function curve() {
	if (cached) return cached

	const p = (big(1) << big(255)) - big(19)
	const l = (big(1) << big(252)) + big('27742317777372353535851937790883648493')
	const d = modulo(big(-121665) * inverse(big(121666), p), p)
	const root = power(big(2), (p - big(1)) >> big(2), p)
	const y = modulo(big(4) * inverse(big(5), p), p)
	const x = recoverX(y, false, p, d, root)
	if (x === undefined) throw new Error('Bad curve constants')

	cached = { p, l, d, root, base: [x, y, big(1), (x * y) % p] }
	return cached
}

function recoverX(
	y: bigint,
	negative: boolean,
	p: bigint,
	d: bigint,
	root: bigint,
) {
	const square = (y * y) % p
	const u = modulo(square - big(1), p)
	const v = modulo(d * square + big(1), p)
	const v3 = (((v * v) % p) * v) % p
	const v7 = (((v3 * v3) % p) * v) % p
	let x = (((u * v3) % p) * power((u * v7) % p, (p - big(5)) >> big(3), p)) % p
	const check = (((x * x) % p) * v) % p

	if (check !== u) {
		if (check !== modulo(-u, p)) return
		x = (x * root) % p
	}
	if (x === big(0) && negative) return
	if (Boolean(x & big(1)) !== negative) x = p - x

	return x
}

function add(a: Point, b: Point, { p, d }: Curve): Point {
	const first = (modulo(a[1] - a[0], p) * modulo(b[1] - b[0], p)) % p
	const second = ((a[1] + a[0]) * (b[1] + b[0])) % p
	const third = (((a[3] * big(2) * d) % p) * b[3]) % p
	const fourth = (((a[2] * big(2)) % p) * b[2]) % p
	const e = modulo(second - first, p)
	const f = modulo(fourth - third, p)
	const g = (fourth + third) % p
	const h = (second + first) % p

	return [(e * f) % p, (g * h) % p, (f * g) % p, (e * h) % p]
}

function multiply(point: Point, scalar: bigint, c: Curve) {
	let result: Point = [big(0), big(1), big(1), big(0)]
	let adding = point
	for (let rest = scalar; rest > big(0); rest >>= big(1)) {
		if (rest & big(1)) result = add(result, adding, c)
		adding = add(adding, adding, c)
	}

	return result
}

function fromLittleEndian(bytes: Uint8Array) {
	let value = big(0)
	for (let index = bytes.length - 1; index >= 0; index--)
		value = (value << big(8)) | big(bytes[index]!)

	return value
}

function decodePoint(bytes: Uint8Array, c: Curve): Point | undefined {
	const negative = (bytes[31]! & 0x80) !== 0
	const copy = bytes.slice()
	copy[31]! &= 0x7f

	const y = fromLittleEndian(copy)
	if (y >= c.p) return

	const x = recoverX(y, negative, c.p, c.d, c.root)
	if (x === undefined) return

	return [x, y, big(1), (x * y) % c.p]
}

const same = (a: Point, b: Point, { p }: Curve) =>
	(a[0] * b[2]) % p === (b[0] * a[2]) % p &&
	(a[1] * b[2]) % p === (b[1] * a[2]) % p

const mask64 = () => (big(1) << big(64)) - big(1)

function integerRoot(value: bigint, degree: number) {
	const bits = value.toString(2).length
	const n = big(degree)
	let guess = big(1) << big(Math.ceil(bits / degree))
	for (;;) {
		let raised = big(1)
		for (let index = 1; index < degree; index++) raised *= guess
		const next = ((n - big(1)) * guess + value / raised) / n
		if (next >= guess) return guess
		guess = next
	}
}

function primes(count: number) {
	const found: number[] = []
	for (let value = 2; found.length < count; value++)
		if (found.every(prime => value % prime)) found.push(value)

	return found
}

let sha512Constants: { k: bigint[]; start: bigint[] } | undefined

// The standard defines these from cube and square roots of primes
function constants() {
	if (sha512Constants) return sha512Constants

	const mask = mask64()
	sha512Constants = {
		k: primes(80).map(prime => integerRoot(big(prime) << big(192), 3) & mask),
		start: primes(8).map(
			prime => integerRoot(big(prime) << big(128), 2) & mask,
		),
	}
	return sha512Constants
}

function rotate(value: bigint, bits: number, mask: bigint) {
	return ((value >> big(bits)) | (value << big(64 - bits))) & mask
}

export function sha512(bytes: Uint8Array) {
	const { k, start } = constants()
	const mask = mask64()
	const padded = new Uint8Array(((bytes.length + 17 + 127) >> 7) << 7)
	padded.set(bytes)
	padded[bytes.length] = 0x80
	new DataView(padded.buffer).setUint32(padded.length - 4, bytes.length * 8)

	const state = [...start]
	for (let offset = 0; offset < padded.length; offset += 128) {
		const w: bigint[] = []
		for (let t = 0; t < 16; t++) {
			let word = big(0)
			for (let index = 0; index < 8; index++)
				word = (word << big(8)) | big(padded[offset + t * 8 + index]!)
			w.push(word)
		}
		for (let t = 16; t < 80; t++) {
			const a = w[t - 15]!
			const b = w[t - 2]!
			const s0 = rotate(a, 1, mask) ^ rotate(a, 8, mask) ^ (a >> big(7))
			const s1 = rotate(b, 19, mask) ^ rotate(b, 61, mask) ^ (b >> big(6))
			w.push((w[t - 16]! + s0 + w[t - 7]! + s1) & mask)
		}

		let [a, b, c, d, e, f, g, h] = state as [
			bigint,
			bigint,
			bigint,
			bigint,
			bigint,
			bigint,
			bigint,
			bigint,
		]
		for (let t = 0; t < 80; t++) {
			const s1 = rotate(e, 14, mask) ^ rotate(e, 18, mask) ^ rotate(e, 41, mask)
			const ch = (e & f) ^ (~e & mask & g)
			const t1 = (h + s1 + ch + k[t]! + w[t]!) & mask
			const s0 = rotate(a, 28, mask) ^ rotate(a, 34, mask) ^ rotate(a, 39, mask)
			const maj = (a & b) ^ (a & c) ^ (b & c)
			h = g
			g = f
			f = e
			e = (d + t1) & mask
			d = c
			c = b
			b = a
			a = (t1 + s0 + maj) & mask
		}

		;[a, b, c, d, e, f, g, h].forEach((value, index) => {
			state[index] = (state[index]! + value) & mask
		})
	}

	const out = new Uint8Array(64)
	state.forEach((word, index) => {
		for (let byte = 0; byte < 8; byte++)
			out[index * 8 + byte] = Number((word >> big(56 - byte * 8)) & big(255))
	})

	return out
}

export function verifyEd25519(
	signature: Uint8Array,
	message: Uint8Array,
	publicKey: Uint8Array,
) {
	if (signature.length !== 64 || publicKey.length !== 32) return false

	try {
		const c = curve()
		const r = signature.subarray(0, 32)
		const s = fromLittleEndian(signature.subarray(32))
		if (s >= c.l) return false

		const A = decodePoint(publicKey, c)
		const R = decodePoint(r, c)
		if (!A || !R) return false

		const input = new Uint8Array(64 + message.length)
		input.set(r)
		input.set(publicKey, 32)
		input.set(message, 64)
		const h = fromLittleEndian(sha512(input)) % c.l

		return same(multiply(c.base, s, c), add(R, multiply(A, h, c), c), c)
	} catch {
		return false
	}
}
