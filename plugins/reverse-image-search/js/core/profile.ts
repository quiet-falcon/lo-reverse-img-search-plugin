import { accountSignal } from './signals'
import type { Signal } from './signals'
import type { ImageTarget } from './types'

type Unknowns = Record<string, unknown>

export interface Profile {
	id: string
	name: string
	avatar?: string
	banner?: string
	bot: boolean
}

const CdnBase = 'https://cdn.discordapp.com'
const ImageSize = 1024
const IdRe = /^\d{15,21}$/
const HashRe = /^(?:a_)?[0-9a-f]{32}$/

const isRecord = (value: unknown): value is Unknowns =>
	typeof value === 'object' && value !== null

const text = (value: unknown) => (typeof value === 'string' ? value : '')

export function authorIdOf(message: unknown) {
	if (!isRecord(message)) return

	const author = isRecord(message.author) ? message.author : undefined
	const id = text(author?.id) || text(message.authorId)

	return IdRe.test(id) ? id : undefined
}

// Stores can be missing or stale, so every field has more than one source
export function readProfile(
	message: unknown,
	user?: unknown,
	details?: unknown,
): Profile | undefined {
	const id = authorIdOf(message)
	if (!id || !isRecord(message) || text(message.webhookId)) return

	const sources = [user, message.author, details].filter(isRecord)
	const first = (...fields: string[]) =>
		fields
			.flatMap(field => sources.map(source => text(source[field])))
			.find(Boolean) ?? ''
	const bot = sources.some(source => source.bot === true)

	// Webhooks have no real user behind them
	if (bot && first('discriminator') === '0000') return

	const profile: Profile = {
		id,
		name: first('globalName', 'global_name', 'username') || 'This user',
		bot,
	}
	const avatar = first('avatar')
	const banner = first('banner')
	if (HashRe.test(avatar)) profile.avatar = avatar
	if (HashRe.test(banner)) profile.banner = banner

	return profile
}

export function profileTargets({ id, avatar, banner }: Profile) {
	const targets: ImageTarget[] = []
	if (avatar)
		targets.push({
			kind: 'avatar',
			label: 'Profile picture',
			url: `${CdnBase}/avatars/${id}/${avatar}.png?size=${ImageSize}`,
			spoiler: false,
		})
	if (banner)
		targets.push({
			kind: 'banner',
			label: 'Banner',
			url: `${CdnBase}/banners/${id}/${banner}.png?size=${ImageSize}`,
			spoiler: false,
		})

	return targets
}

export function profileSignals(profile: Profile, now: number) {
	const account = accountSignal(profile.id, now)
	const signals: Signal[] = account ? [account] : []
	if (profile.bot)
		signals.push({
			id: 'bot',
			title: 'Bot account',
			detail: 'Discord marks this account as a bot.',
			level: 'note',
		})
	if (!profile.avatar)
		signals.push({
			id: 'no-avatar',
			title: 'No profile picture',
			detail: 'This account uses a default avatar, so there is none to search.',
			level: 'note',
		})

	return signals
}
