import type { Signal } from './signals'

export const PhishingListHost = 'raw.githubusercontent.com'
export const PhishingListUrl =
	'https://raw.githubusercontent.com/fisventurous/fisphish/main/data/discord-scams.txt'
export const MaxPhishingBytes = 2 * 1024 * 1024

const MaxLinks = 20
const UrlRe = /https?:\/\/[^\s<>()[\]"']+/gi
const HostRe = /^https?:\/\/(?:[^/?#@]*@)?([^/?#:]+)/i
const DomainRe = /^[a-z0-9.-]{1,253}$/
const Brands = ['discord', 'steamcommunity', 'steampowered', 'roblox']
const LookalikeNames: Record<string, string> = {
	discord: 'discord.com',
	steamcommunity: 'steamcommunity.com',
	steampowered: 'steampowered.com',
	roblox: 'roblox.com',
}
const SafeDomains = [
	'discord.com',
	'discord.gg',
	'discord.gift',
	'discord.media',
	'discord.new',
	'discordapp.com',
	'discordapp.net',
	'discordstatus.com',
	'dis.gd',
	'steamcommunity.com',
	'steampowered.com',
	'steamstatic.com',
	'steamgames.com',
	'roblox.com',
	'rbxcdn.com',
]
const Homoglyphs: Record<string, string> = {
	'0': 'o',
	'1': 'l',
	'3': 'e',
	'4': 'a',
	'5': 's',
	'7': 't',
	'8': 'b',
}

type Unknowns = Record<string, unknown>

const isRecord = (value: unknown): value is Unknowns =>
	typeof value === 'object' && value !== null

function hostOf(url: string) {
	const host = HostRe.exec(url)?.[1]?.toLowerCase().replace(/\.+$/, '')
	const domain = host?.replace(/^www\./, '')

	return domain && DomainRe.test(domain) && domain.includes('.')
		? domain
		: undefined
}

export function domainsFromMessage(message: unknown) {
	if (!isRecord(message)) return []

	const content = typeof message.content === 'string' ? message.content : ''
	const embeds = Array.isArray(message.embeds) ? message.embeds : []
	const urls = [
		...(content.match(UrlRe) ?? []),
		...embeds.flatMap(embed =>
			isRecord(embed) && typeof embed.url === 'string' ? [embed.url] : [],
		),
	]
	const domains = urls.map(hostOf).filter((host): host is string => !!host)

	return [...new Set(domains)].slice(0, MaxLinks)
}

export function parseDomainList(text: string) {
	const domains = new Set<string>()
	for (const line of text.split('\n')) {
		const domain = line.trim().toLowerCase()
		if (domain && !domain.startsWith('#')) domains.add(domain)
	}

	return domains
}

// A listed domain also covers everything beneath it
function isListed(domain: string, list: Set<string>) {
	const parts = domain.split('.')
	for (let index = 0; index < parts.length - 1; index++)
		if (list.has(parts.slice(index).join('.'))) return true

	return false
}

const isSafe = (domain: string) =>
	SafeDomains.some(safe => domain === safe || domain.endsWith(`.${safe}`))

function editDistance(first: string, second: string) {
	let previous = Array.from({ length: second.length + 1 }, (_, index) => index)
	for (let row = 1; row <= first.length; row++) {
		const current = [row]
		for (let column = 1; column <= second.length; column++)
			current[column] = Math.min(
				previous[column]! + 1,
				current[column - 1]! + 1,
				previous[column - 1]! + (first[row - 1] === second[column - 1] ? 0 : 1),
			)
		previous = current
	}

	return previous[second.length]!
}

const flatten = (label: string) =>
	label
		.replace(/[-_]/g, '')
		.replace(/[0134578]/g, digit => Homoglyphs[digit] ?? digit)
		.replace(/rn/g, 'm')
		.replace(/cl/g, 'd')
		.replace(/vv/g, 'w')

// Finds the real site a domain seems to be pretending to be
export function lookalikeOf(domain: string) {
	if (isSafe(domain)) return

	const labels = domain.split('.').slice(0, -1)
	for (const label of labels) {
		const flat = flatten(label)
		for (const brand of Brands) {
			const name = LookalikeNames[brand]
			if (!name) continue

			const allowed = brand.length > 8 ? 2 : 1
			if (flat.includes(brand) || editDistance(flat, brand) <= allowed)
				return name
		}
	}
}

export const isDisguised = (domain: string) =>
	domain.split('.').some(label => label.startsWith('xn--'))

export function linkSignals(domains: string[], list?: Set<string>): Signal[] {
	const signals: Signal[] = []

	for (const domain of domains) {
		if (isSafe(domain)) continue

		const lookalike = lookalikeOf(domain)
		if (list && isListed(domain, list))
			signals.push({
				id: `listed-${domain}`,
				title: `Known scam link: ${domain}`,
				detail:
					'This domain is on a public Discord scam list. Avoid opening it.',
				level: 'watch',
			})
		else if (lookalike)
			signals.push({
				id: `lookalike-${domain}`,
				title: `Looks like ${lookalike}: ${domain}`,
				detail: `The name resembles ${lookalike}, but it's a different site. Lookalikes can be false alarms.`,
				level: 'watch',
			})
		else if (isDisguised(domain))
			signals.push({
				id: `disguised-${domain}`,
				title: `Uses special characters: ${domain}`,
				detail: 'Scam sites can use these to imitate real addresses.',
				level: 'watch',
			})
	}

	return signals.length ? signals : [clearSignal(domains.length, Boolean(list))]
}

const clearSignal = (count: number, checkedList: boolean): Signal => ({
	id: 'links-clear',
	title: `No known risks in ${count} ${count === 1 ? 'link' : 'links'}`,
	detail: checkedList
		? "New scam sites may not be listed yet, so this doesn't prove a link is safe."
		: "The scam list couldn't be loaded, so only the address was checked.",
	level: 'note',
})
