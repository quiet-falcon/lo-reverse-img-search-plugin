import { startProbe } from './adapters/probe'
import { probeState } from './adapters/session'
import ProbeSettings from './ui/ProbeSettings'

export default plugin({
	start({ cleanup }) {
		// Production builds do nothing until P1 adds the first feature
		if (__DEV__) cleanup(startProbe(probeState))
	},
	SettingsComponent: __DEV__ ? ProbeSettings : undefined,
})
