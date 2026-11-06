import { startCommunityUpdates } from './adapters/community-auto'
import { watchDiscordModules } from './adapters/discord-modules'
import { clearPhishingList } from './adapters/link-check'
import { patchMediaViewer } from './adapters/media-viewer'
import { patchMessageSheet } from './adapters/message-sheet'
import { startProbe } from './adapters/probe'
import { probeState } from './adapters/session'
import { bindSettings } from './adapters/settings-store'
import { recordFields, recordNames } from './core/probe'
import { DefaultSettings } from './core/settings'
import { closeLinkSheet } from './ui/LinkSheet'
import { closeSearchSheet } from './ui/SearchSheet'
import Settings from './ui/Settings'
import type { Settings as SettingsData } from './core/settings'

export default plugin<{ jsonStorage: SettingsData }>({
	jsonStorage: { load: true, default: DefaultSettings },
	start({ cleanup, plugin, jsonStorage }) {
		const onError = (error: unknown) => plugin.reportError(error)

		// Dev builds report why the viewer button did or didn't appear
		const onViewerStatus = __DEV__
			? (status: string, tree?: string[]) => {
					probeState.entryPoints.ViewerButton = status
					if (tree) recordNames(probeState, 'viewerTree', tree)
				}
			: undefined

		// Dev builds report which fields hold avatars and banners
		const onRecords = __DEV__
			? (author: unknown, user: unknown) => {
					recordFields(probeState, 'messageAuthor', author)
					recordFields(probeState, 'userRecord', user)
				}
			: undefined

		cleanup(
			bindSettings(jsonStorage),
			watchDiscordModules(),
			patchMessageSheet(onError, onRecords),
			patchMediaViewer(onError, onViewerStatus),
			closeSearchSheet,
			closeLinkSheet,
			clearPhishingList,
			startCommunityUpdates(),
		)

		if (__DEV__) cleanup(startProbe(probeState))
	},
	SettingsComponent: Settings,
})
