import { lookupGeneratedIconComponent } from '@valenced/utils/discord'

const SearchIconNames = ['MagnifyingGlassIcon', 'SearchIcon']

// Extra arguments name one icon's assets, so each fallback needs its own lookup
export function searchIcon() {
	for (const name of SearchIconNames) {
		try {
			const Icon = lookupGeneratedIconComponent(name)
			if (Icon) return Icon
		} catch {
			// Try the next name
		}
	}
}
