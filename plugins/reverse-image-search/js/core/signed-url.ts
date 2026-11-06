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
