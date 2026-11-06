import { watchDiscordModules } from './adapters/discord-modules'
import { patchMediaViewer } from './adapters/media-viewer'
import { patchMessageSheet } from './adapters/message-sheet'
import { startProbe } from './adapters/probe'
import { probeState } from './adapters/session'
import { recordNames } from './core/probe'
import ProbeSettings from './ui/ProbeSettings'
import { closeSearchSheet } from './ui/SearchSheet'

export default plugin({
	start({ cleanup, plugin }) {
		const onError = (error: unknown) => plugin.reportError(error)

		// Dev builds report why the viewer button did or didn't appear
		const onViewerStatus = __DEV__
			? (status: string, tree?: string[]) => {
					probeState.entryPoints.ViewerButton = status
					if (tree) recordNames(probeState, 'viewerTree', tree)
				}
			: undefined

		cleanup(
			watchDiscordModules(),
			patchMessageSheet(onError),
			patchMediaViewer(onError, onViewerStatus),
			closeSearchSheet,
		)

		if (__DEV__) cleanup(startProbe(probeState))
	},
	SettingsComponent: __DEV__ ? ProbeSettings : undefined,
})
