import { lookupGeneratedIconComponent } from '@valenced/utils/discord'

// Icon names vary between Discord builds, so a miss only drops the icon
export function searchIcon() {
	try {
		return lookupGeneratedIconComponent('MagnifyingGlassIcon', 'ImageIcon')
	} catch {
		return undefined
	}
}
