import { patchMediaViewer } from './adapters/media-viewer'
import { patchMessageSheet } from './adapters/message-sheet'
import { startProbe } from './adapters/probe'
import { probeState } from './adapters/session'
import ProbeSettings from './ui/ProbeSettings'
import { closeSearchSheet } from './ui/SearchSheet'

export default plugin({
	start({ cleanup, plugin }) {
		const onError = (error: unknown) => plugin.reportError(error)

		cleanup(
			patchMessageSheet(onError),
			patchMediaViewer(onError),
			closeSearchSheet,
		)

		if (__DEV__) cleanup(startProbe(probeState))
	},
	SettingsComponent: __DEV__ ? ProbeSettings : undefined,
})
