import {
	isAttachmentUrl,
	isDiscordMedia,
	isHttps,
	toMediaProxy,
} from './signed-url'
import type { ImageTarget } from './types'

type Unknowns = Record<string, unknown>

const ImageNameRe = /\.(?:avif|bmp|gif|heic|heif|jpe?g|png|webp)$/i
const VideoNameRe = /\.(?:avi|flv|gifv|m4v|mkv|mov|mp4|webm|wmv)$/i
const SpoilerPrefix = 'SPOILER_'
const MaxTargets = 20

const isRecord = (value: unknown): value is Unknowns =>
	typeof value === 'object' && value !== null

const text = (value: unknown) => (typeof value === 'string' ? value : '')

const pathOf = (url: string) => url.split(/[?#]/, 1)[0]!

const isVideo = (contentType: string, name: string) =>
	contentType.startsWith('video/') || VideoNameRe.test(name)

function fromAttachment(value: unknown, index: number) {
	if (!isRecord(value) || !isHttps(value.url)) return

	const filename = text(value.filename)
	const contentType = text(value.content_type)
	const originalType = text(value.original_content_type)
	if (isVideo(contentType, filename) || isVideo(originalType, filename)) return

	// Images uploaded as octet-stream still report their dimensions
	const hasSize = Number(value.width) > 0 && Number(value.height) > 0
	const isImage =
		contentType.startsWith('image/') ||
		originalType.startsWith('image/') ||
		ImageNameRe.test(filename) ||
		hasSize
	if (!isImage) return

	const target: ImageTarget = {
		kind: 'attachment',
		label: labelFor(filename, `Attachment ${index + 1}`),
		url: value.url,
		spoiler: filename.startsWith(SpoilerPrefix) || value.spoiler === true,
	}
	if (isHttps(value.proxy_url)) target.proxyUrl = value.proxy_url
	addSize(target, value.width, value.height)

	return target
}

function fromEmbed(value: unknown, index: number) {
	if (!isRecord(value)) return

	const media = value.image ?? value.thumbnail
	if (!isRecord(media) || !isHttps(media.url)) return
	if (isVideo(text(media.contentType), pathOf(media.url))) return

	const target: ImageTarget = {
		kind: 'embed',
		label: `Embed image ${index + 1}`,
		url: media.url,
		spoiler: false,
	}
	if (isHttps(media.proxyURL)) target.proxyUrl = media.proxyURL
	addSize(target, media.width, media.height)

	return target
}

function addSize(target: ImageTarget, width: unknown, height: unknown) {
	const w = Number(width)
	const h = Number(height)
	if (w > 0 && h > 0) {
		target.width = w
		target.height = h
	}
}

function labelFor(filename: string, fallback: string) {
	const name = filename.startsWith(SpoilerPrefix)
		? filename.slice(SpoilerPrefix.length)
		: filename

	return name || fallback
}

export function targetsFromMessage(message: unknown) {
	if (!isRecord(message)) return []

	const attachments = Array.isArray(message.attachments)
		? message.attachments.map(fromAttachment)
		: []
	const embeds = Array.isArray(message.embeds)
		? message.embeds.map(fromEmbed)
		: []
	const seen = new Set<string>()

	return [...attachments, ...embeds]
		.filter((target): target is ImageTarget => {
			if (!target || seen.has(target.url)) return false

			seen.add(target.url)
			return true
		})
		.slice(0, MaxTargets)
}

export function targetFromViewer(source: unknown) {
	if (!isRecord(source)) return

	const urls = [source.sourceURI, source.shareURI, source.uri].filter(isHttps)
	const url = urls[0]
	if (!url || isVideo(text(source.contentType), pathOf(url))) return

	const target: ImageTarget = {
		kind: 'viewer',
		label: labelFor(text(source.filename), 'This image'),
		url,
		spoiler: source.spoiler === true || source.obscure === true,
	}
	const proxyUrl = urls.find(isProxy)
	if (proxyUrl) target.proxyUrl = proxyUrl
	addSize(target, source.width, source.height)

	return target
}

const isProxy = (url: string) => isDiscordMedia(url) && !url.includes('://cdn.')

export interface HandoffLinkOptions {
	prefersOriginal?: boolean
	swap?: boolean
}

// Each image has a preferred link and one fallback, which the switch picks
export function handoffImageUrl(
	target: ImageTarget,
	{ prefersOriginal = false, swap = false }: HandoffLinkOptions = {},
) {
	const [preferred, other] = linkPair(target, prefersOriginal)

	return swap ? other : preferred
}

function linkPair(target: ImageTarget, prefersOriginal: boolean) {
	// External embed links carry no Discord signature, so they come first
	if (!isDiscordMedia(target.url))
		return [target.url, target.proxyUrl ?? target.url] as const

	const proxy = target.proxyUrl ?? toMediaProxy(target.url)

	return prefersOriginal
		? ([target.url, proxy] as const)
		: ([proxy, target.url] as const)
}

export const hasOriginalFile = (target: ImageTarget) =>
	isAttachmentUrl(target.url)

export function previewUrl(target: ImageTarget) {
	return target.proxyUrl ?? target.url
}
