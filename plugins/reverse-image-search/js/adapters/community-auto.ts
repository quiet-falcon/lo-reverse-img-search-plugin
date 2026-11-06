import { syncCommunityList } from './community-sync'
import { currentSettings, updateSettings } from './settings-store'

const StartDelayMs = 20_000
const DayMs = 86_400_000

// Waits a moment so Discord can finish starting first
export function startCommunityUpdates() {
	let stopped = false

	const update = async () => {
		const settings = currentSettings()
		const now = Date.now()
		if (now - settings.communityCheckedAt < DayMs) return

		const outcome = await syncCommunityList(settings.communityList.version)
		if (stopped) return
		if (outcome.kind === 'updated')
			await updateSettings({
				communityList: outcome.list,
				communityCheckedAt: now,
			})
		else if (outcome.kind === 'current')
			await updateSettings({ communityCheckedAt: now })
	}

	const timer = setTimeout(() => {
		update().catch(() => {})
	}, StartDelayMs)

	return () => {
		stopped = true
		clearTimeout(timer)
	}
}
