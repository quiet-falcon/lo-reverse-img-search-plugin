import { HashEdge, MaxEdge } from './limits'
import {
	isAttachmentUrl,
	isDiscordMedia,
	scaledSize,
	toMediaProxy,
	toOriginal,
	withParams,
} from './signed-url'
import type { ImageTarget } from './types'

// Discord's proxy first, because it hands back a real image type
export function downloadCandidates(target: ImageTarget) {
	const proxy =
		target.proxyUrl ??
		(isDiscordMedia(target.url) ? toMediaProxy(target.url) : undefined)
	const size = scaledSize(target.width, target.height, MaxEdge)
	const sizeParams: Record<string, string> = size
		? { width: String(size.width), height: String(size.height) }
		: {}
	const urls: string[] = []

	if (proxy && isDiscordMedia(proxy)) {
		urls.push(withParams(proxy, { format: 'jpeg', ...sizeParams }))
		urls.push(withParams(proxy, { format: 'png', ...sizeParams }))
	}
	if (isAttachmentUrl(target.url)) urls.push(target.url)

	return [...new Set(urls)]
}

// A small PNG keeps hashing quick, and one decoder covers every format
export function hashCandidates(target: ImageTarget) {
	if (target.kind === 'avatar' || target.kind === 'banner')
		return [target.url.replace(/([?&]size=)\d+/, `$1${HashEdge}`)]

	const proxy =
		target.proxyUrl ??
		(isDiscordMedia(target.url) ? toMediaProxy(target.url) : undefined)
	const size = scaledSize(target.width, target.height, HashEdge)
	const sizeParams: Record<string, string> = size
		? { width: String(size.width), height: String(size.height) }
		: { width: String(HashEdge) }
	const urls: string[] = []

	if (proxy && isDiscordMedia(proxy))
		urls.push(withParams(proxy, { format: 'png', ...sizeParams }))
	if (isAttachmentUrl(target.url)) urls.push(toOriginal(target.url))

	return [...new Set(urls)]
}
