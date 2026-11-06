import { downloadCandidates } from '../core/acquire'
import {
	DownloadTimeoutMs,
	MaxImageBytes,
	MaxResponseBytes,
	ProviderTimeoutMs,
} from '../core/limits'
import { randomBoundary } from '../core/multipart'
import { isAttachmentUrl, isStale, toMediaProxy } from '../core/signed-url'
import { sniffImage } from '../core/sniff'
import {
	buildSauceNaoRequest,
	parseSauceNao,
	SauceNaoHost,
} from '../providers/saucenao'
import {
	buildTraceMoeRequest,
	parseTraceMoe,
	TraceMoeHost,
} from '../providers/tracemoe'
import { refreshAttachmentUrl } from './discord-modules'
import { sendRequest } from './http'
import type { SearchSession, SearchState } from '../core/session'
import type { ProviderSpec } from '../core/settings'
import type {
	ErrorCategory,
	ImageTarget,
	ProviderOutcome,
	ProviderOutcomes,
	SearchOutcome,
} from '../core/types'

const DownloadHosts = [
	'cdn.discordapp.com',
	'media.discordapp.net',
	'images-ext-1.discordapp.net',
	'images-ext-2.discordapp.net',
]

export interface SearchCallbacks {
	onState(state: SearchState): void
	onOutcome(outcome: SearchOutcome): void
}

interface Image {
	bytes: Uint8Array
	mime: string
	ext: string
}

// One download, then every chosen provider in parallel
export async function searchImage(
	session: SearchSession,
	target: ImageTarget,
	providers: ProviderSpec[],
	{ onState, onOutcome }: SearchCallbacks,
) {
	if (!providers.length) return

	const token = session.begin()
	if (token === undefined) return

	const update = (state: SearchState) => {
		if (session.isCurrent(token)) onState(state)
	}
	const done = (outcome: SearchOutcome) => {
		if (!session.isCurrent(token)) return
		session.finish(token)
		const anyResults =
			outcome.kind === 'providers' &&
			Object.values(outcome.outcomes).some(item => item?.kind === 'results')
		onState(anyResults ? 'done' : 'failed')
		onOutcome(outcome)
	}

	try {
		const fresh = await freshTarget(target, update)
		if (!session.isCurrent(token)) return
		if (!fresh) return done({ kind: 'error', category: 'refresh-failed' })

		update('downloading')
		const image = await download(session, token, fresh)
		if (!session.isCurrent(token)) return
		if ('kind' in image) return done(image)

		update('searching')
		const settled = await Promise.all(
			providers.map(async spec => {
				const outcome = await runProvider(session, spec, image).catch(
					(): ProviderOutcome => ({ kind: 'error', category: 'unexpected' }),
				)
				return [spec.id, outcome] as const
			}),
		)
		if (!session.isCurrent(token)) return

		const outcomes: ProviderOutcomes = {}
		for (const [id, outcome] of settled) outcomes[id] = outcome
		done({ kind: 'providers', outcomes })
	} catch {
		done({ kind: 'error', category: 'unexpected' })
	}
}

async function runProvider(
	session: SearchSession,
	spec: ProviderSpec,
	image: Image,
): Promise<ProviderOutcome> {
	const request =
		spec.id === 'tracemoe'
			? buildTraceMoeRequest(image.bytes, image.mime)
			: buildSauceNaoRequest(
					image.bytes,
					image.mime,
					image.ext,
					spec.key,
					randomBoundary(),
				)
	const pending = sendRequest({
		...request,
		allowedHosts: [spec.id === 'tracemoe' ? TraceMoeHost : SauceNaoHost],
		maxBytes: MaxResponseBytes,
		timeoutMs: ProviderTimeoutMs,
	})
	session.onCancel(pending.abort)

	const response = await pending.promise
	if (response.kind === 'error')
		return { kind: 'error', category: errorFor(response.category) }

	const parse = spec.id === 'tracemoe' ? parseTraceMoe : parseSauceNao
	return parse(response.status, response.text ?? '')
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
): Promise<Image | { kind: 'error'; category: ErrorCategory }> {
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
				bytes: response.bytes,
				mime: sniffed.mime,
				ext: sniffed.ext,
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
