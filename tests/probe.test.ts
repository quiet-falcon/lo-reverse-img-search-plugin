import { describe, expect, test } from 'bun:test'
import {
	createProbeState,
	fieldNames,
	formatReport,
	recordError,
	recordFields,
	recordNames,
	recordSheetKey,
	sanitiseName,
} from '../plugins/reverse-image-search/js/core/probe'

const FakeSignedUrl =
	'https://cdn.discordapp.com/attachments/1/2/test.png?ex=ffffffff&is=00000000&hm=deadbeef&'

const info = {
	pluginVersion: '0.1.0-alpha1',
	discordVersion: '352.2',
	discordBuild: '352002',
	releaseChannel: 'stable',
	androidSdk: '33',
	bridge: 'valenced 1',
}

describe('fieldNames', () => {
	test('returns sorted names and never values', () => {
		const names = fieldNames({ url: FakeSignedUrl, proxy_url: FakeSignedUrl })

		expect(names).toEqual(['proxy_url', 'url'])
		expect(names.join()).not.toContain('discordapp')
	})

	test('ignores anything that is not a plain record', () => {
		for (const value of [null, undefined, 'text', 4, [], [{ url: 'x' }]])
			expect(fieldNames(value)).toEqual([])
	})

	test('never runs getters', () => {
		const record = {
			get url(): string {
				throw new Error('read')
			},
		}

		expect(fieldNames(record)).toEqual(['url'])
	})

	test('bounds the number of names', () => {
		const record = Object.fromEntries(
			Array.from({ length: 200 }, (_, index) => [`k${index}`, index]),
		)

		expect(fieldNames(record)).toHaveLength(80)
	})
})

describe('sanitiseName', () => {
	test('removes long digit runs', () => {
		expect(sanitiseName('UserProfile-1234567890123')).toBe('UserProfile-#')
	})

	test('keeps short numbers and limits length', () => {
		expect(sanitiseName('Sheet2')).toBe('Sheet2')
		expect(sanitiseName('x'.repeat(100))).toHaveLength(60)
	})
})

describe('recording', () => {
	test('merges fields from several records', () => {
		const state = createProbeState()

		recordFields(state, 'attachment', { url: 'a' })
		recordFields(state, 'attachment', { size: 1, url: 'b' })

		expect(state.fields.attachment).toEqual(['size', 'url'])
	})

	test('skips empty records', () => {
		const state = createProbeState()

		recordFields(state, 'embed', undefined)

		expect(state.fields.embed).toBeUndefined()
	})

	test('dedupes sheet keys, ignores non-strings, and stays bounded', () => {
		const state = createProbeState()

		recordSheetKey(state, 'MessageLongPress')
		recordSheetKey(state, 'MessageLongPress')
		recordSheetKey(state, 7)
		for (let index = 0; index < 100; index++)
			recordSheetKey(state, `Sheet${index}`)

		expect(state.sheetKeys[0]).toBe('MessageLongPress')
		expect(state.sheetKeys).toHaveLength(40)
	})

	test('bounds errors', () => {
		const state = createProbeState()

		for (let index = 0; index < 20; index++) recordError(state, 'stage')

		expect(state.errors).toHaveLength(10)
	})
})

describe('formatReport', () => {
	test('marks empty sections and includes versions', () => {
		const report = formatReport(createProbeState(), info)

		expect(report).toContain('Discord: 352.2 (352002, stable)')
		expect(report).toContain('Android SDK: 33')
		expect(report).toContain('none seen')
	})

	test('contains no URL after a signed record passes through', () => {
		const state = createProbeState()

		recordFields(state, 'attachment', { url: FakeSignedUrl, filename: 'a.png' })
		recordSheetKey(state, 'MediaShareActionSheet')
		state.entryPoints.LongPressMessageActionSheet = 'found'

		const report = formatReport(state, info)

		expect(report).toContain('attachment: filename, url')
		expect(report).toContain('MediaShareActionSheet')
		expect(report).not.toContain('https://')
		expect(report).not.toContain('a.png')
	})
})

describe('recordNames', () => {
	test('keeps order, cleans IDs, and records only once', () => {
		const state = createProbeState()

		recordNames(state, 'viewerTree', ['0:Header()', '1:Row-1234567890()'])
		recordNames(state, 'viewerTree', ['other'])

		expect(state.fields.viewerTree).toEqual(['0:Header()', '1:Row-#()'])
	})
})
