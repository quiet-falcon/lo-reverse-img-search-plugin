import { Stores } from '@valenced/discord/flux'
import { authorIdOf, readProfile } from '../core/profile'

interface UserStore {
	getUser?(id: string): unknown
}

interface UserProfileStore {
	getUserProfile?(id: string): unknown
}

export type RecordWatcher = (author: unknown, user: unknown) => void

const attempt = <T>(read: () => T) => {
	try {
		return read()
	} catch {
		return undefined
	}
}

// Stores come from Discord, so a missing one must never break the sheet
export function profileForMessage(message: unknown, onRecords?: RecordWatcher) {
	const id = authorIdOf(message)
	if (!id) return

	const stores = Stores as unknown as Record<string, unknown>
	const user = attempt(() =>
		(stores.UserStore as UserStore | undefined)?.getUser?.(id),
	)
	const details = attempt(() =>
		(stores.UserProfileStore as UserProfileStore | undefined)?.getUserProfile?.(
			id,
		),
	)
	onRecords?.((message as { author?: unknown }).author, user)

	return readProfile(message, user, details)
}
