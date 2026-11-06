import { MaxEdge } from './limits'
import {
	isAttachmentUrl,
	isDiscordMedia,
	scaledSize,
	toMediaProxy,
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
