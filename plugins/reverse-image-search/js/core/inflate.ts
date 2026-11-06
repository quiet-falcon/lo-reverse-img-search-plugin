// A small DEFLATE reader, so PNG decoding needs no outside package
const LengthBase = [
	3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67,
	83, 99, 115, 131, 163, 195, 227, 258,
]
const LengthExtra = [
	0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5,
	5, 5, 0,
]
const DistanceBase = [
	1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769,
	1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577,
]
const DistanceExtra = [
	0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11,
	11, 12, 12, 13, 13,
]
const CodeOrder = [
	16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15,
]
const MaxBits = 15

interface Huffman {
	counts: Uint16Array
	symbols: Uint16Array
}

function buildHuffman(lengths: Uint8Array): Huffman {
	const counts = new Uint16Array(MaxBits + 1)
	for (const length of lengths) counts[length]!++
	counts[0] = 0

	const offsets = new Uint16Array(MaxBits + 2)
	for (let bits = 1; bits <= MaxBits; bits++)
		offsets[bits + 1] = offsets[bits]! + counts[bits]!

	const symbols = new Uint16Array(lengths.length)
	lengths.forEach((length, symbol) => {
		if (length) symbols[offsets[length]!++] = symbol
	})

	return { counts, symbols }
}

let fixedTables: { literals: Huffman; distances: Huffman } | undefined

function fixedHuffman() {
	if (fixedTables) return fixedTables

	const lengths = new Uint8Array(288)
	lengths.fill(8, 0, 144)
	lengths.fill(9, 144, 256)
	lengths.fill(7, 256, 280)
	lengths.fill(8, 280, 288)
	fixedTables = {
		literals: buildHuffman(lengths),
		distances: buildHuffman(new Uint8Array(30).fill(5)),
	}

	return fixedTables
}

// The output size is known up front, which stops a tiny file expanding forever
export function inflate(input: Uint8Array, start: number, outputSize: number) {
	const output = new Uint8Array(outputSize)
	let position = start
	let bitBuffer = 0
	let bitCount = 0
	let written = 0

	const bits = (count: number) => {
		while (bitCount < count) {
			if (position >= input.length) throw new Error('Deflate data ended early')
			bitBuffer |= input[position++]! << bitCount
			bitCount += 8
		}
		const value = bitBuffer & ((1 << count) - 1)
		bitBuffer >>>= count
		bitCount -= count

		return value
	}

	const decode = ({ counts, symbols }: Huffman) => {
		let code = 0
		let first = 0
		let index = 0
		for (let length = 1; length <= MaxBits; length++) {
			code |= bits(1)
			const count = counts[length]!
			if (code - count < first) return symbols[index + (code - first)]!
			index += count
			first = (first + count) << 1
			code <<= 1
		}
		throw new Error('Bad deflate code')
	}

	const stored = () => {
		bitBuffer = 0
		bitCount = 0
		if (position + 4 > input.length) throw new Error('Deflate data ended early')

		const length = input[position]! | (input[position + 1]! << 8)
		position += 4
		if (position + length > input.length || written + length > outputSize)
			throw new Error('Bad stored block')

		output.set(input.subarray(position, position + length), written)
		position += length
		written += length
	}

	const compressed = (literals: Huffman, distances: Huffman) => {
		for (;;) {
			const symbol = decode(literals)
			if (symbol === 256) return
			if (symbol < 256) {
				if (written >= outputSize) throw new Error('Too much deflate data')
				output[written++] = symbol
				continue
			}

			const lengthCode = symbol - 257
			if (lengthCode >= 29) throw new Error('Bad deflate length')
			const length = LengthBase[lengthCode]! + bits(LengthExtra[lengthCode]!)
			const distanceCode = decode(distances)
			if (distanceCode >= 30) throw new Error('Bad deflate distance')
			const distance =
				DistanceBase[distanceCode]! + bits(DistanceExtra[distanceCode]!)
			if (distance > written || written + length > outputSize)
				throw new Error('Bad deflate copy')

			for (let index = 0; index < length; index++) {
				output[written] = output[written - distance]!
				written++
			}
		}
	}

	const dynamic = () => {
		const literalCount = bits(5) + 257
		const distanceCount = bits(5) + 1
		const codeCount = bits(4) + 4
		const codeLengths = new Uint8Array(19)
		for (let index = 0; index < codeCount; index++)
			codeLengths[CodeOrder[index]!] = bits(3)

		const codes = buildHuffman(codeLengths)
		const lengths = new Uint8Array(literalCount + distanceCount)
		let index = 0
		while (index < lengths.length) {
			const symbol = decode(codes)
			if (symbol < 16) {
				lengths[index++] = symbol
				continue
			}

			const previous = symbol === 16 ? lengths[index - 1] : 0
			if (symbol === 16 && index === 0) throw new Error('Bad deflate repeat')
			const repeat =
				symbol === 16 ? 3 + bits(2) : symbol === 17 ? 3 + bits(3) : 11 + bits(7)
			if (index + repeat > lengths.length) throw new Error('Bad deflate repeat')
			lengths.fill(previous!, index, index + repeat)
			index += repeat
		}

		compressed(
			buildHuffman(lengths.subarray(0, literalCount)),
			buildHuffman(lengths.subarray(literalCount)),
		)
	}

	for (let last = 0; !last; ) {
		last = bits(1)
		const type = bits(2)
		if (type === 0) stored()
		else if (type === 1) {
			const { literals, distances } = fixedHuffman()
			compressed(literals, distances)
		} else if (type === 2) dynamic()
		else throw new Error('Bad deflate block')
	}

	if (written !== outputSize) throw new Error('Deflate data too short')

	return output
}
