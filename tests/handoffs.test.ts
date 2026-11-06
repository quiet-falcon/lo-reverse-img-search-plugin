import { describe, expect, test } from 'bun:test'
import { HandoffProviders } from '../plugins/reverse-image-search/js/providers/handoffs'

const Signed =
	'https://media.discordapp.net/attachments/1/2/a.png?ex=ffffffff&is=00000000&hm=deadbeef&'

describe('HandoffProviders', () => {
	test('lists the eight engines with unique IDs', () => {
		expect(new Set(HandoffProviders.map(item => item.id)).size).toBe(8)
	})

	test('builds https links with the image encoded once', () => {
		for (const provider of HandoffProviders) {
			const url = provider.buildUrl(Signed)

			expect(url.startsWith('https://')).toBe(true)
			expect(url).toContain(encodeURIComponent(Signed))
			expect(url).not.toContain('%2526')
		}
	})
})
