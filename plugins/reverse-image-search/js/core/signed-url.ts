const HttpsRe = /^https:\/\/[^\s]+$/i
const DiscordMediaRe =
	/^https:\/\/(?:cdn\.discordapp\.com|media\.discordapp\.net|images-ext-[12]\.discordapp\.net)\//i
const CdnAttachmentRe =
	/^https:\/\/cdn\.discordapp\.com\/(?=(?:ephemeral-)?attachments\/)/i
const ExpiryRe = /[?&]ex=([0-9a-f]+)/i

const StaleMarginMs = 300_000

export const isHttps = (url: unknown): url is string =>
	typeof url === 'string' && HttpsRe.test(url)

export const isDiscordMedia = (url: string) => DiscordMediaRe.test(url)

export function expiryOf(url: string) {
	const match = ExpiryRe.exec(url)
	return match ? Number.parseInt(match[1]!, 16) * 1000 : undefined
}

export function isStale(url: string, now = Date.now()) {
	const expiry = expiryOf(url)
	return expiry !== undefined && expiry - StaleMarginMs < now
}

// String swap only, because rebuilding the URL can reorder its signature
export const toMediaProxy = (url: string) =>
	url.replace(CdnAttachmentRe, 'https://media.discordapp.net/')

export const encodeForHandoff = (url: string) => encodeURIComponent(url)

const ParamKeyRe = /[?&]([^=&#]+)=/g

// Appends only missing parameters, so the signature stays in place
export function withParams(url: string, params: Record<string, string>) {
	const hashIndex = url.indexOf('#')
	const base = hashIndex < 0 ? url : url.slice(0, hashIndex)
	const hash = hashIndex < 0 ? '' : url.slice(hashIndex)
	const existing = new Set(
		Array.from(base.matchAll(ParamKeyRe), match => match[1]),
	)
	const added = Object.entries(params)
		.filter(([key]) => !existing.has(key))
		.map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
	if (!added.length) return url

	const joiner = !base.includes('?') ? '?' : /[?&]$/.test(base) ? '' : '&'

	return base + joiner + added.join('&') + hash
}

export function scaledSize(width: unknown, height: unknown, maxEdge: number) {
	const w = Number(width)
	const h = Number(height)
	if (!(w > 0 && h > 0)) return

	const scale = Math.min(1, maxEdge / Math.max(w, h))

	return {
		width: Math.max(1, Math.round(w * scale)),
		height: Math.max(1, Math.round(h * scale)),
	}
}

const AttachmentPathRe =
	/^https:\/\/(?:cdn\.discordapp\.com|media\.discordapp\.net)\/(?:ephemeral-)?attachments\//i

export const isAttachmentUrl = (url: string) => AttachmentPathRe.test(url)
