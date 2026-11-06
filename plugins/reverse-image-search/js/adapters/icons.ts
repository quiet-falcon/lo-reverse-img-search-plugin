import { lookupGeneratedIconComponent } from '@valenced/utils/discord'
import type { SignalLevel } from '../core/signals'

const SearchIconNames = ['MagnifyingGlassIcon', 'SearchIcon']
const ProfileIconNames = ['ShieldUserIcon', 'UserIcon']
const SignalIconNames: Record<SignalLevel, string[]> = {
	note: ['CircleInformationIcon', ...ProfileIconNames],
	watch: ['WarningIcon', ...ProfileIconNames],
}

// Extra arguments name one icon's assets, so each fallback needs its own lookup
function firstIcon(names: string[]) {
	for (const name of names) {
		try {
			const Icon = lookupGeneratedIconComponent(name)
			if (Icon) return Icon
		} catch {
			// Try the next name
		}
	}
}

export const searchIcon = () => firstIcon(SearchIconNames)
export const profileIcon = () => firstIcon(ProfileIconNames)
export const linkIcon = () => firstIcon(['LinkIcon', ...ProfileIconNames])
export const signalIcon = (level: SignalLevel) =>
	firstIcon(SignalIconNames[level])
