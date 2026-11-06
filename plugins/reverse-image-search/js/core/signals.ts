import { ageInDays, ageText, createdAt, dateText } from './account-age'
import type { ImageTag } from './image-tags'

export type SignalLevel = 'note' | 'watch'

export interface Signal {
	id: string
	title: string
	detail: string
	level: SignalLevel
}

const NewAccountDays = 30

export function accountSignal(id: string, now: number): Signal | undefined {
	const created = createdAt(id)
	if (created === undefined) return

	const days = ageInDays(created, now)
	const age = ageText(days)
	const isNew = days < NewAccountDays

	return {
		id: 'account-age',
		title: isNew ? `New account: ${age} old` : `Account is ${age} old`,
		detail: `Created ${dateText(created)}. Compare this with TinEye's oldest copy of the photo.`,
		level: isNew ? 'watch' : 'note',
	}
}

export function tagSignals(tags: ImageTag[]): Signal[] {
	if (!tags.length)
		return [
			{
				id: 'no-tags',
				title: 'No AI tags found',
				detail:
					"Discord and other apps can remove tags, so this doesn't prove the image is real.",
				level: 'note',
			},
		]

	return tags.map(tag => ({
		id: tag.label,
		title: tag.label,
		detail: tagDetails[tag.kind],
		level: 'watch',
	}))
}

const tagDetails: Record<ImageTag['kind'], string> = {
	credentials:
		"Found in the file's tags. These record how an image was made, which may include AI tools.",
	'ai-label': "Found in the file's tags. Tags can be added or edited.",
	generator: "Found in the file's tags. Tags can be added or edited.",
}
