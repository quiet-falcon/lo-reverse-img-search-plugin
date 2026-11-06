import { hashCandidates } from '../core/acquire'
import { DownloadTimeoutMs, MaxImageBytes } from '../core/limits'
import { hashImage } from '../core/pdq'
import { decodePng } from '../core/pixels'
import { sendRequest } from './http'
import { DownloadHosts, errorFor, freshTarget } from './search'
import type { ImageHash } from '../core/pdq'
import type { Pixels } from '../core/pixels'
import type { SearchSession } from '../core/session'
import type { ErrorCategory, ImageTarget } from '../core/types'

export type HashOutcome =
	| { kind: 'hash'; image: ImageHash; pixels: Pixels }
	| { kind: 'error'; category: ErrorCategory }

// Lets the screen update before the phone starts number crunching
const nextTick = () => new Promise(resolve => setTimeout(resolve, 0))

// The image only comes from Discord, and hashing happens on the phone
export async function hashTarget(
	session: SearchSession,
	target: ImageTarget,
): Promise<HashOutcome | undefined> {
	const token = session.begin()
	if (token === undefined) return

	const finish = (outcome: HashOutcome) => {
		session.finish(token)
		return outcome
	}

	try {
		const fresh = await freshTarget(target, () => {})
		if (!session.isCurrent(token)) return
		if (!fresh) return finish({ kind: 'error', category: 'refresh-failed' })

		let category: ErrorCategory = 'bad-image'
		for (const url of hashCandidates(fresh)) {
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
			if (!session.isCurrent(token)) return
			if (response.kind === 'error') {
				category = errorFor(response.category)
				continue
			}
			if (response.status !== 200 || !response.bytes) continue

			await nextTick()
			if (!session.isCurrent(token)) return

			const pixels = decodePng(response.bytes)
			const image = pixels && hashImage(pixels)
			if (pixels && image) return finish({ kind: 'hash', image, pixels })
		}

		return finish({ kind: 'error', category })
	} catch {
		if (session.isCurrent(token))
			return finish({ kind: 'error', category: 'unexpected' })
	}
}
