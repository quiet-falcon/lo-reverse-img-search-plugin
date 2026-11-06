import { downloadCandidates } from '../core/acquire'
import {
	DownloadTimeoutMs,
	MaxImageBytes,
	MaxResponseBytes,
	ProviderTimeoutMs,
} from '../core/limits'
import { isAttachmentUrl, isStale, toMediaProxy } from '../core/signed-url'
import { sniffImage } from '../core/sniff'
import {
	buildTraceMoeRequest,
	parseTraceMoe,
	TraceMoeHost,
} from '../providers/tracemoe'
import { refreshAttachmentUrl } from './discord-modules'
import { sendRequest } from './http'
import type { SearchSession, SearchState } from '../core/session'
import type { ErrorCategory, ImageTarget, ProviderOutcome } from '../core/types'

const DownloadHosts = [
	'cdn.discordapp.com',
	'media.discordapp.net',
	'images-ext-1.discordapp.net',
	'images-ext-2.discordapp.net',
]

export interface SearchCallbacks {
	onState(state: SearchState): void
	onOutcome(outcome: ProviderOutcome): void
}

export async function searchTraceMoe(
	session: SearchSession,
	target: ImageTarget,
	{ onState, onOutcome }: SearchCallbacks,
) {
	const token = session.begin()
	if (token === undefined) return

	const update = (state: SearchState) => {
		if (session.isCurrent(token)) onState(state)
	}
	const done = (outcome: ProviderOutcome) => {
		if (!session.isCurrent(token)) return
		session.finish(token)
		onState(outcome.kind === 'results' ? 'done' : 'failed')
		onOutcome(outcome)
	}

	try {
		const fresh = await freshTarget(target, update)
		if (!session.isCurrent(token)) return
		if (!fresh) return done({ kind: 'error', category: 'refresh-failed' })

		update('downloading')
		const image = await download(session, token, fresh)
		if (!session.isCurrent(token)) return
		if (image.kind === 'error') return done(image)

		update('searching')
		const request = buildTraceMoeRequest(image.bytes, image.mime)
		const pending = sendRequest({
			...request,
			allowedHosts: [TraceMoeHost],
			maxBytes: MaxResponseBytes,
			timeoutMs: ProviderTimeoutMs,
		})
		session.onCancel(pending.abort)

		const response = await pending.promise
		if (response.kind === 'error')
			return done({ kind: 'error', category: errorFor(response.category) })

		done(parseTraceMoe(response.status, response.text ?? ''))
	} catch {
		done({ kind: 'error', category: 'unexpected' })
	}
}

async function freshTarget(
	target: ImageTarget,
	update: (state: SearchState) => void,
): Promise<ImageTarget | undefined> {
	if (!isAttachmentUrl(target.url) || !isStale(target.url)) return target

	update('refreshing')
	const refreshed = await refreshAttachmentUrl(target.url).catch(
		() => undefined,
	)
	if (!refreshed) return

	return { ...target, url: refreshed, proxyUrl: toMediaProxy(refreshed) }
}

async function download(
	session: SearchSession,
	token: number,
	target: ImageTarget,
) {
	let category: { kind: 'error'; category: ErrorCategory } = {
		kind: 'error',
		category: 'bad-image',
	}

	for (const url of downloadCandidates(target)) {
		if (!session.isCurrent(token)) return category

		const pending = sendRequest({
			method: 'GET',
			url,
			allowedHosts: DownloadHosts,
			maxBytes: MaxImageBytes,
			timeoutMs: DownloadTimeoutMs,
			binary: true,
		})
		session.onCancel(pending.abort)

		const response = await pending.promise
		if (response.kind === 'error') {
			if (response.category === 'aborted') return category
			category = { kind: 'error', category: errorFor(response.category) }
			continue
		}
		if (response.status !== 200 || !response.bytes) continue

		const sniffed = sniffImage(response.bytes)
		if (sniffed)
			return {
				kind: 'image' as const,
				bytes: response.bytes,
				mime: sniffed.mime,
			}

		category = { kind: 'error', category: 'bad-image' }
	}

	return category
}

function errorFor(category: string): ErrorCategory {
	if (category === 'timeout') return 'timeout'
	if (category === 'too-large') return 'too-large'
	if (category === 'network') return 'network'
	return 'unexpected'
}
