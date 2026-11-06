import { MaxDistance } from './hash-list'
import { hashDistance } from './pdq'
import type { ImageHash } from './pdq'
import type { Signal } from './signals'

export interface CommunityEntry {
	hash: string
	category: string
	reports: number
}

export interface CommunityList {
	version: number
	entries: CommunityEntry[]
}

export interface ListManifest {
	version: number
	count: number
	sha256: string
	signature: string
}

export interface CommunityMatch {
	entry: CommunityEntry
	distance: number
}

// Empty until Sensei's signing key exists, which keeps updates switched off
export const ListPublicKey = ''
export const ListHost = 'raw.githubusercontent.com'
export const ListBaseUrl = `https://${ListHost}/quiet-falcon/lo-reverse-img-search-plugin/community-list/`
export const MaxEntries = 2000
export const MaxListBytes = 512 * 1024

const IssueUrl =
	'https://github.com/quiet-falcon/lo-reverse-img-search-plugin/issues/new'
const HashRe = /^[0-9a-f]{64}$/
const Sha256Re = /^[0-9a-f]{64}$/
const SignatureRe = /^[0-9a-f]{128}$/
const CategoryRe = /^[a-z-]{1,30}$/

const CategoryLabels: Record<string, string> = {
	'scam-image': 'scam image',
	'stolen-photo': 'stolen photo',
	impersonation: 'impersonation image',
}

export const EmptyList: CommunityList = { version: 0, entries: [] }

export const manifestMessage = ({ version, count, sha256 }: ListManifest) =>
	`ris-community-list:${version}:${count}:${sha256}`

export function readManifest(text: string): ListManifest | undefined {
	try {
		const data = JSON.parse(text) as Partial<ListManifest>
		if (
			!Number.isSafeInteger(data.version) ||
			!Number.isSafeInteger(data.count) ||
			typeof data.sha256 !== 'string' ||
			!Sha256Re.test(data.sha256) ||
			typeof data.signature !== 'string' ||
			!SignatureRe.test(data.signature)
		)
			return

		return data as ListManifest
	} catch {
		return undefined
	}
}

function readEntry(value: unknown): CommunityEntry | undefined {
	if (!Array.isArray(value)) return

	const [hash, category, reports] = value as unknown[]
	if (
		typeof hash !== 'string' ||
		!HashRe.test(hash) ||
		typeof category !== 'string' ||
		!CategoryRe.test(category) ||
		!Number.isSafeInteger(reports) ||
		(reports as number) < 1
	)
		return

	return { hash, category, reports: reports as number }
}

export function readEntries(text: string) {
	try {
		const data = JSON.parse(text) as unknown
		if (!Array.isArray(data)) return

		return data
			.map(readEntry)
			.filter((entry): entry is CommunityEntry => entry !== undefined)
			.slice(0, MaxEntries)
	} catch {
		return undefined
	}
}

export function readStoredList(value: unknown): CommunityList {
	if (typeof value !== 'object' || value === null) return EmptyList

	const { version, entries } = value as Partial<CommunityList>
	if (!Number.isSafeInteger(version) || !Array.isArray(entries))
		return EmptyList

	return {
		version: version as number,
		entries: entries
			.filter(
				(entry): entry is CommunityEntry =>
					typeof entry?.hash === 'string' && HashRe.test(entry.hash),
			)
			.slice(0, MaxEntries),
	}
}

export function findCommunityMatch(
	image: ImageHash,
	entries: CommunityEntry[],
): CommunityMatch | undefined {
	let best: CommunityMatch | undefined
	for (const entry of entries)
		for (const variant of image.variants) {
			const distance = hashDistance(variant, entry.hash)
			if (distance <= MaxDistance && (!best || distance < best.distance))
				best = { entry, distance }
		}

	return best
}

export function communitySignal({ entry, distance }: CommunityMatch): Signal {
	const label = CategoryLabels[entry.category] ?? 'image'

	return {
		id: 'community-match',
		title: `Matches a reported ${label}`,
		detail: `Reported ${entry.reports} ${entry.reports === 1 ? 'time' : 'times'}. ${distance} of 256 hash bits differ. The list holds no pictures, and a match doesn't prove who posted it.`,
		level: 'watch',
	}
}

export function reportUrl(hash: string) {
	const body = `hash: ${hash}\ncategory: scam-image\n`

	return `${IssueUrl}?template=report-hash.md&title=${encodeURIComponent('Report image hash')}&body=${encodeURIComponent(body)}`
}

export const fromHex = (hex: string) =>
	Uint8Array.from(hex.match(/../g) ?? [], pair => Number.parseInt(pair, 16))

export const asciiText = (bytes: Uint8Array) => {
	let out = ''
	for (const byte of bytes) out += String.fromCharCode(byte)
	return out
}
