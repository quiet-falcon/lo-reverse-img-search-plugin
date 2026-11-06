import { Linking } from 'react-native'
import { isHttps } from '../core/signed-url'
import { handoffImageUrl } from '../core/target'
import { HandoffProviders } from '../providers/handoffs'
import type { ImageTarget } from '../core/types'

export const handoffChoices = HandoffProviders.map(({ id, name }) => ({
	id,
	name,
}))

export async function openHandoff(
	id: string,
	target: ImageTarget,
	useOriginal: boolean,
) {
	const provider = HandoffProviders.find(item => item.id === id)
	if (!provider) return false

	const url = provider.buildUrl(handoffImageUrl(target, useOriginal))
	if (!isHttps(url)) return false

	await Linking.openURL(url)
	return true
}
