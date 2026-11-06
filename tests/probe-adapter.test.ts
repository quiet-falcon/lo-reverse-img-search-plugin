import { beforeEach, describe, expect, mock, test } from 'bun:test'
import { createProbeState } from '../plugins/reverse-image-search/js/core/probe'

type Hook = (args: unknown[]) => unknown[]

const FakeSignedUrl =
	'https://cdn.discordapp.com/attachments/1/2/test.png?ex=ffffffff&is=00000000&hm=deadbeef&'

const patches: { key: string; hook: Hook; removed: boolean }[] = []
const subscriptions: { active: boolean }[] = []
let onMessageSheet: (mod: unknown) => void
let onViewerHeader: (exports: Record<string, unknown>) => void

mock.module('@valenced/patcher', () => ({
	instead: () => () => {},
	before: (_: unknown, key: string, hook: Hook) => {
		const patch = { key, hook, removed: false }
		patches.push(patch)
		return () => {
			patch.removed = true
		}
	},
}))
mock.module('@valenced/discord/actions', () => ({
	ActionSheetActionCreators: { openLazy: () => {} },
}))
mock.module('@valenced/discord/native', () => ({
	ClientInfoModule: {
		getConstants: () => ({
			Version: '352.2',
			Build: '352002',
			ReleaseChannel: 'stable',
		}),
	},
	DeviceModule: {
		getConstants: () => {
			throw new Error('unsupported')
		},
	},
}))
mock.module('@valenced/modules/native', () => ({
	getBridgeInfo: () => null,
}))
mock.module('@valenced/modules/finders/filters', () => ({
	withName: (name: string) => name,
}))

const subscribe = () => {
	const subscription = { active: true }
	subscriptions.push(subscription)
	return () => {
		subscription.active = false
	}
}

mock.module('@valenced/modules/finders', () => ({
	getModules: (_: unknown, callback: typeof onMessageSheet) => {
		onMessageSheet = callback
		return subscribe()
	},
}))
mock.module('@valenced/discord/utils/modules/finders', () => ({
	getModuleWithImportedPath: (_: string, callback: typeof onViewerHeader) => {
		onViewerHeader = callback
		return subscribe()
	},
}))

const { readProbeInfo, startProbe } = await import(
	'../plugins/reverse-image-search/js/adapters/probe'
)

const hookFor = (key: string) => patches.find(patch => patch.key === key)!.hook

describe('startProbe', () => {
	beforeEach(() => {
		patches.length = 0
		subscriptions.length = 0
	})

	test('reports entry points as unseen until Discord loads them', () => {
		const state = createProbeState()
		startProbe(state)

		expect(Object.values(state.entryPoints)).toEqual([
			'not seen yet',
			'not seen yet',
		])
	})

	test('records sheet keys and returns args untouched', () => {
		const state = createProbeState()
		startProbe(state)

		const args = [Promise.resolve(), 'MediaShareActionSheet', {}]

		expect(hookFor('openLazy')(args)).toBe(args)
		expect(state.sheetKeys).toEqual(['MediaShareActionSheet'])
	})

	test('reads message field names without keeping values', () => {
		const state = createProbeState()
		startProbe(state)
		onMessageSheet({ default: () => null })

		const args = [
			{
				message: {
					attachments: [{ url: FakeSignedUrl, size: 10 }],
					embeds: [{ image: { proxyURL: FakeSignedUrl } }],
				},
			},
		]

		expect(hookFor('default')(args)).toBe(args)
		expect(state.fields.attachment).toEqual(['size', 'url'])
		expect(state.fields.embedImage).toEqual(['proxyURL'])
		expect(JSON.stringify(state)).not.toContain('discordapp')
	})

	test('handles a function or memo viewer header', () => {
		for (const [exports, label] of [
			[{ MediaModalOverlayHeader: () => null }, 'function'],
			[{ default: { type: () => null } }, 'memo'],
		] as const) {
			const state = createProbeState()
			startProbe(state)
			onViewerHeader(exports)

			expect(state.entryPoints.MediaModalOverlayHeader).toContain(label)
		}
	})

	test('survives malformed Discord props', () => {
		const state = createProbeState()
		startProbe(state)
		onMessageSheet({ default: () => null })

		const args = [undefined]

		expect(hookFor('default')(args)).toBe(args)
	})

	test('stop removes every patch and subscription, repeatedly', () => {
		for (let run = 0; run < 3; run++) {
			patches.length = 0
			subscriptions.length = 0

			const stop = startProbe(createProbeState())
			onMessageSheet({ default: () => null })
			onViewerHeader({ MediaModalOverlayHeader: () => null })
			stop()

			expect(patches).toHaveLength(3)
			expect(patches.every(patch => patch.removed)).toBe(true)
			expect(subscriptions.some(item => item.active)).toBe(false)
		}
	})
})

describe('readProbeInfo', () => {
	test('leaves gaps when a host call fails', () => {
		const info = readProbeInfo('0.1.0-alpha1')

		expect(info.discordVersion).toBe('352.2')
		expect(info.androidSdk).toBe('unavailable')
		expect(info.bridge).toBe('unavailable')
	})
})
