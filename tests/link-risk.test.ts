import { describe, expect, test } from 'bun:test'
import {
	domainsFromMessage,
	isDisguised,
	linkSignals,
	lookalikeOf,
	parseDomainList,
} from '../plugins/reverse-image-search/js/core/link-risk'

const List = parseDomainList(
	'bad-nitro.com\n# note\n\nsub.listed.ru\nEVIL.example\n',
)

describe('domainsFromMessage', () => {
	test('reads text and embeds, and tidies each host', () => {
		expect(
			domainsFromMessage({
				content:
					'see https://WWW.Example.com/a?b=1 and http://user@login.test.org:8080/x, also (https://a.io)',
				embeds: [{ url: 'https://embed.net/p' }, { url: 3 }],
			}),
		).toEqual(['example.com', 'login.test.org', 'a.io', 'embed.net'])
	})

	test('dedupes, ignores junk, and survives bad messages', () => {
		expect(
			domainsFromMessage({ content: 'https://a.io https://a.io/2 https://x' }),
		).toEqual(['a.io'])
		expect(domainsFromMessage(undefined)).toEqual([])
		expect(domainsFromMessage({ content: 5 })).toEqual([])
	})
})

describe('lookalikeOf', () => {
	test('flags real scam patterns', () => {
		const cases: [string, string][] = [
			['discord-nitro.xyz', 'discord.com'],
			['dlscord.gift', 'discord.com'],
			['d1scord.com', 'discord.com'],
			['disc0rd-app.ru', 'discord.com'],
			['discorcl.com', 'discord.com'],
			['steamcommunlty.com', 'steamcommunity.com'],
			['steamcornmunity.ru', 'steamcommunity.com'],
			['free.steampowered.gift', 'steampowered.com'],
			['rob1ox.com', 'roblox.com'],
		]

		for (const [domain, brand] of cases) expect(lookalikeOf(domain)).toBe(brand)
	})

	test('leaves real and unrelated sites alone', () => {
		for (const domain of [
			'discord.com',
			'cdn.discordapp.com',
			'discord.gg',
			'steamcommunity.com',
			'store.steampowered.com',
			'roblox.com',
			'github.com',
			'google.com',
			'record.com',
			'accord.org',
			'tenor.com',
			'example.com',
		])
			expect(lookalikeOf(domain)).toBeUndefined()
	})
})

describe('linkSignals', () => {
	test('names a listed domain and its subdomains', () => {
		const [signal] = linkSignals(['bad-nitro.com'], List)

		expect(signal).toMatchObject({
			title: 'Known scam link: bad-nitro.com',
			level: 'watch',
		})
		expect(linkSignals(['a.sub.listed.ru'], List)[0]?.level).toBe('watch')
		expect(linkSignals(['evil.example'], List)[0]?.level).toBe('watch')
	})

	test('does not treat a parent of a listed domain as listed', () => {
		expect(linkSignals(['listed.ru'], List)[0]?.level).toBe('note')
	})

	test('flags lookalikes and special characters without the list', () => {
		expect(linkSignals(['dlscord.gift'])[0]?.title).toBe(
			'Looks like discord.com: dlscord.gift',
		)
		expect(isDisguised('xn--dscord-6ve.com')).toBe(true)
		expect(linkSignals(['xn--abc.com'])[0]?.title).toStartWith(
			'Uses special characters',
		)
	})

	test('never flags real Discord links, even if a list wrongly did', () => {
		expect(
			linkSignals(['discord.com'], new Set(['discord.com']))[0]?.level,
		).toBe('note')
	})

	test('says a clean result proves nothing', () => {
		const [signal] = linkSignals(['github.com'], List)

		expect(signal).toMatchObject({
			title: 'No known risks in 1 link',
			level: 'note',
		})
		expect(signal?.detail).toContain("doesn't prove")
		expect(linkSignals(['github.com'])[0]?.detail).toContain(
			"couldn't be loaded",
		)
	})
})
