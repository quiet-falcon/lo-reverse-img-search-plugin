import { Linking } from 'react-native'
import { isHttps } from '../core/signed-url'
import { handoffImageUrl } from '../core/target'
import { HandoffProviders } from '../providers/handoffs'
import { SauceNaoKeyPage } from '../providers/saucenao'
import type { ImageTarget } from '../core/types'

export const handoffChoices = HandoffProviders.map(({ id, name }) => ({
	id,
	name,
}))

export async function openHandoff(
	id: string,
	target: ImageTarget,
	swap: boolean,
) {
	const provider = HandoffProviders.find(item => item.id === id)
	if (!provider) return false

	const url = provider.buildUrl(
		handoffImageUrl(target, {
			prefersOriginal: provider.prefersOriginal,
			swap,
		}),
	)
	if (!isHttps(url)) return false

	await Linking.openURL(url)
	return true
}

// Result links come from providers, so only https is ever opened
export async function openResult(url: string) {
	if (!isHttps(url)) return false

	await Linking.openURL(url)
	return true
}

const PrivacyPage =
	'https://github.com/quiet-falcon/lo-reverse-img-search-plugin/blob/main/docs/privacy.md'

export const openKeyPage = () => Linking.openURL(SauceNaoKeyPage)
export const openPrivacyPage = () => Linking.openURL(PrivacyPage)
