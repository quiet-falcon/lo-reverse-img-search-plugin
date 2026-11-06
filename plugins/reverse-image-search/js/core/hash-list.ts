import { dateText } from './account-age'
import { hashDistance } from './pdq'
import type { ImageHash } from './pdq'
import type { Signal } from './signals'

export interface SavedImage {
	hash: string
	label: string
	addedAt: number
	thumb: string
}

export interface ListMatch {
	entry: SavedImage
	distance: number
}

export const MaxSaved = 100
export const MinQuality = 50
export const MaxDistance = 30

const HashRe = /^[0-9a-f]{64}$/
const ThumbPrefix = 'data:image/png;base64,'
const MaxLabelLength = 80

export const isReliable = (image: ImageHash) => image.quality >= MinQuality

export function readSavedImages(value: unknown): SavedImage[] {
	if (!Array.isArray(value)) return []

	return value.filter(isSavedImage).slice(0, MaxSaved)
}

function isSavedImage(value: unknown): value is SavedImage {
	if (typeof value !== 'object' || value === null) return false

	const entry = value as Record<string, unknown>
	return (
		typeof entry.hash === 'string' &&
		HashRe.test(entry.hash) &&
		typeof entry.label === 'string' &&
		typeof entry.addedAt === 'number' &&
		typeof entry.thumb === 'string' &&
		entry.thumb.startsWith(ThumbPrefix)
	)
}

// Checks every flip and rotation, so a mirrored copy still matches
export function findMatch(
	image: ImageHash,
	list: SavedImage[],
): ListMatch | undefined {
	let best: ListMatch | undefined
	for (const entry of list)
		for (const variant of image.variants) {
			const distance = hashDistance(variant, entry.hash)
			if (distance <= MaxDistance && (!best || distance < best.distance))
				best = { entry, distance }
		}

	return best
}

export function addSaved(
	list: SavedImage[],
	image: ImageHash,
	label: string,
	thumb: string,
	now: number,
): SavedImage[] {
	const entry: SavedImage = {
		hash: image.hash,
		label: label.slice(0, MaxLabelLength),
		addedAt: now,
		thumb,
	}

	return [entry, ...list].slice(0, MaxSaved)
}

export const removeSaved = (list: SavedImage[], hash: string) =>
	list.filter(entry => entry.hash !== hash)

export function matchSignal({ entry, distance }: ListMatch): Signal {
	return {
		id: 'list-match',
		title: `Matches your saved image: ${entry.label}`,
		detail: `Saved ${dateText(entry.addedAt)}. ${distance} of 256 hash bits differ. Compare the two pictures below.`,
		level: 'watch',
	}
}

export const NoMatchSignal: Signal = {
	id: 'list-clear',
	title: 'Not on your list',
	detail:
		"This list catches reused images. It can miss cropped copies, so this doesn't prove the image is new.",
	level: 'note',
}

export const TooPlainSignal: Signal = {
	id: 'list-plain',
	title: 'Too plain to compare',
	detail: 'This image has too little detail for a reliable match.',
	level: 'note',
}
