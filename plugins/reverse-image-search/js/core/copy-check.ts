import type { WebFindings } from './types'

export type CopyBand = 'none' | 'few' | 'several' | 'wide'

export const CopyLimits =
	"Copies don't prove who owns a photo, and no copies doesn't prove it's real. New, private, and AI-generated photos can have no copies."

const BandLabels: Record<CopyBand, string> = {
	none: 'No copies found',
	few: 'Found on a few sites',
	several: 'Found on several sites',
	wide: 'Widely used online',
}

const HostRe = /^https:\/\/([^/?#:]+)/i

export function siteOf(url: string) {
	const host = HostRe.exec(url)?.[1]?.toLowerCase() ?? ''
	return host.replace(/^www\./, '')
}

export function copyBand(sites: number): CopyBand {
	if (sites === 0) return 'none'
	if (sites < 5) return 'few'
	if (sites < 20) return 'several'
	return 'wide'
}

export const distinctSites = (web: WebFindings) =>
	new Set(web.pages.map(page => page.site).filter(Boolean)).size

export function copyHeadline(web: WebFindings) {
	const sites = distinctSites(web)
	const label = BandLabels[copyBand(sites)]
	if (sites === 0) return label

	return `${label}: at least ${sites} ${sites === 1 ? 'site' : 'sites'}`
}

export function copyDetail(web: WebFindings) {
	const counts = [
		web.exactCopies
			? plural(web.exactCopies, 'exact copy', 'exact copies')
			: '',
		web.editedCopies
			? plural(web.editedCopies, 'edited copy', 'edited copies')
			: '',
	].filter(Boolean)
	const found = counts.length ? `At least ${counts.join(' and ')}.` : ''
	const more = web.capped ? 'More may exist.' : ''

	return [found, more].filter(Boolean).join(' ')
}

const plural = (count: number, one: string, many: string) =>
	`${count} ${count === 1 ? one : many}`
