import type { Pixels } from './pixels'

// A TypeScript version of Meta's PDQ hash. See NOTICE.md
export interface ImageHash {
	hash: string
	quality: number
	// The hash of each flipped and rotated copy, including the original
	variants: string[]
}

const Size = 64
const DctSize = 16
const MinDimension = 5
const FilterPasses = 2

const DctMatrix = (() => {
	const matrix = new Float32Array(DctSize * Size)
	const scale = Math.sqrt(2 / Size)
	for (let row = 0; row < DctSize; row++)
		for (let column = 0; column < Size; column++)
			matrix[row * Size + column] =
				scale * Math.cos((Math.PI / 2 / Size) * (row + 1) * (2 * column + 1))

	return matrix
})()

function toLuma({ width, height, rgb }: Pixels) {
	const luma = new Float32Array(width * height)
	for (let index = 0; index < luma.length; index++)
		luma[index] =
			0.299 * rgb[index * 3]! +
			0.587 * rgb[index * 3 + 1]! +
			0.114 * rgb[index * 3 + 2]!

	return luma
}

function boxFilter(
	input: Float32Array,
	output: Float32Array,
	base: number,
	length: number,
	stride: number,
	window: number,
) {
	const half = Math.trunc((window + 2) / 2)
	let left = base
	let right = base
	let out = base
	let sum = 0
	let count = 0

	for (let index = 0; index < half - 1; index++) {
		sum = Math.fround(sum + input[right]!)
		count++
		right += stride
	}
	for (let index = 0; index < window - half + 1; index++) {
		sum = Math.fround(sum + input[right]!)
		count++
		output[out] = sum / count
		right += stride
		out += stride
	}
	for (let index = 0; index < length - window; index++) {
		sum = Math.fround(sum + input[right]!)
		sum = Math.fround(sum - input[left]!)
		output[out] = sum / count
		left += stride
		right += stride
		out += stride
	}
	for (let index = 0; index < half - 1; index++) {
		sum = Math.fround(sum - input[left]!)
		count--
		output[out] = sum / count
		left += stride
		out += stride
	}
}

const windowFor = (size: number) =>
	Math.trunc((size + 2 * Size - 1) / (2 * Size))

function downsample(luma: Float32Array, width: number, height: number) {
	const spare = new Float32Array(luma.length)
	const rowWindow = windowFor(width)
	const columnWindow = windowFor(height)

	for (let pass = 0; pass < FilterPasses; pass++) {
		for (let row = 0; row < height; row++)
			boxFilter(luma, spare, row * width, width, 1, rowWindow)
		for (let column = 0; column < width; column++)
			boxFilter(spare, luma, column, height, width, columnWindow)
	}

	const small = new Float32Array(Size * Size)
	for (let row = 0; row < Size; row++) {
		const y = Math.trunc(((row + 0.5) * height) / Size)
		for (let column = 0; column < Size; column++) {
			const x = Math.trunc(((column + 0.5) * width) / Size)
			small[row * Size + column] = luma[y * width + x]!
		}
	}

	return small
}

function qualityOf(small: Float32Array) {
	let sum = 0
	const add = (first: number, second: number) => {
		sum += Math.abs(Math.trunc(((first - second) * 100) / 255))
	}

	for (let row = 0; row < Size - 1; row++)
		for (let column = 0; column < Size; column++)
			add(small[row * Size + column]!, small[(row + 1) * Size + column]!)
	for (let row = 0; row < Size; row++)
		for (let column = 0; column < Size - 1; column++)
			add(small[row * Size + column]!, small[row * Size + column + 1]!)

	return Math.min(100, Math.trunc(sum / 90))
}

function dct(small: Float32Array) {
	const partial = new Float32Array(DctSize * Size)
	for (let row = 0; row < DctSize; row++)
		for (let column = 0; column < Size; column++) {
			let sum = 0
			for (let index = 0; index < Size; index++)
				sum = Math.fround(
					sum + DctMatrix[row * Size + index]! * small[index * Size + column]!,
				)
			partial[row * Size + column] = sum
		}

	const output = new Float32Array(DctSize * DctSize)
	for (let row = 0; row < DctSize; row++)
		for (let column = 0; column < DctSize; column++) {
			let sum = 0
			for (let index = 0; index < Size; index++)
				sum = Math.fround(
					sum +
						partial[row * Size + index]! * DctMatrix[column * Size + index]!,
				)
			output[row * DctSize + column] = sum
		}

	return output
}

function toHex(values: Float32Array) {
	const median = [...values].sort((a, b) => a - b)[
		Math.ceil(values.length / 2) - 1
	]!
	const words = new Uint16Array(DctSize)

	values.forEach((value, index) => {
		if (value > median) words[index >> 4]! |= 1 << (index & 15)
	})

	return [...words]
		.reverse()
		.map(word => word.toString(16).padStart(4, '0'))
		.join('')
}

// Each flip only changes signs or swaps rows and columns, so no rehashing
const Transforms: ((row: number, column: number) => [number, boolean])[] = [
	(i, j) => [i * DctSize + j, false],
	(i, j) => [j * DctSize + i, !(j & 1)],
	(i, j) => [i * DctSize + j, Boolean((i + j) & 1)],
	(i, j) => [j * DctSize + i, !(i & 1)],
	(i, j) => [i * DctSize + j, !(i & 1)],
	(i, j) => [i * DctSize + j, !(j & 1)],
	(i, j) => [j * DctSize + i, false],
	(i, j) => [j * DctSize + i, Boolean((i + j) & 1)],
]

function variantsOf(values: Float32Array) {
	return Transforms.map(transform => {
		const output = new Float32Array(values.length)
		for (let row = 0; row < DctSize; row++)
			for (let column = 0; column < DctSize; column++) {
				const [to, negate] = transform(row, column)
				const value = values[row * DctSize + column]!
				output[to] = negate ? -value : value
			}

		return toHex(output)
	})
}

export function hashImage(pixels: Pixels): ImageHash | undefined {
	const { width, height } = pixels
	if (width < MinDimension || height < MinDimension) return

	const small = downsample(toLuma(pixels), width, height)
	const quality = qualityOf(small)
	const variants = variantsOf(dct(small))

	return { hash: variants[0]!, quality, variants }
}

const BitCounts = Array.from({ length: 16 }, (_, value) => {
	let count = 0
	for (let bit = value; bit; bit >>= 1) count += bit & 1
	return count
})

export function hashDistance(first: string, second: string) {
	let distance = 0
	for (let index = 0; index < first.length; index++)
		distance +=
			BitCounts[
				Number.parseInt(first[index]!, 16) ^ Number.parseInt(second[index]!, 16)
			]!

	return distance
}
