import { readImageTags } from '../core/image-tags'
import { DownloadTimeoutMs, MaxImageBytes } from '../core/limits'
import { toOriginal } from '../core/signed-url'
import { sendRequest } from './http'
import { DownloadHosts, errorFor, freshTarget } from './search'
import type { ImageTag } from '../core/image-tags'
import type { SearchSession } from '../core/session'
import type { ErrorCategory, ImageTarget } from '../core/types'

export type TagOutcome =
	| { kind: 'tags'; tags: ImageTag[] }
	| { kind: 'error'; category: ErrorCategory }

// Reads the original file, because Discord's proxy drops the tags.
// The file only comes from Discord and goes nowhere else.
export async function checkImageTags(
	session: SearchSession,
	target: ImageTarget,
): Promise<TagOutcome | undefined> {
	const token = session.begin()
	if (token === undefined) return

	try {
		const fresh = await freshTarget(target, () => {})
		if (!session.isCurrent(token)) return
		if (!fresh) return finish({ kind: 'error', category: 'refresh-failed' })

		const pending = sendRequest({
			method: 'GET',
			url: toOriginal(fresh.url),
			allowedHosts: DownloadHosts,
			maxBytes: MaxImageBytes,
			timeoutMs: DownloadTimeoutMs,
			binary: true,
		})
		session.onCancel(pending.abort)

		const response = await pending.promise
		if (!session.isCurrent(token)) return
		if (response.kind === 'error')
			return finish({ kind: 'error', category: errorFor(response.category) })
		if (response.status !== 200 || !response.bytes)
			return finish({ kind: 'error', category: 'unexpected' })

		return finish({ kind: 'tags', tags: readImageTags(response.bytes) })
	} catch {
		if (session.isCurrent(token))
			return finish({ kind: 'error', category: 'unexpected' })
	}

	function finish(outcome: TagOutcome) {
		session.finish(token!)
		return outcome
	}
}
