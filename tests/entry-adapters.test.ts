import { beforeEach, describe, expect, mock, test } from 'bun:test'

type Hook = (
	args: unknown[],
	original: (...args: unknown[]) => unknown,
) => unknown

const Sheet = () => null
const Row = Object.assign(() => null, { Group: () => null, Icon: () => null })
const hooks: { hook: Hook; removed: boolean }[] = []
const subscriptions: { active: boolean }[] = []
const opened: unknown[] = []
let storedUser: unknown
let onMessageSheet: (mod: unknown) => void
let onViewerHeader: (exports: Record<string, unknown>) => void

const subscribe = () => {
	const subscription = { active: true }
	subscriptions.push(subscription)
	return () => {
		subscription.active = false
	}
}

mock.module('@valenced/patcher', () => ({
	before: () => () => {},
	instead: (_: unknown, __: string, hook: Hook) => {
		const entry = { hook, removed: false }
		hooks.push(entry)
		return () => {
			entry.removed = true
		}
	},
}))
mock.module('@valenced/discord/actions', () => ({
	ActionSheetActionCreators: { hideActionSheet() {} },
}))
mock.module('@valenced/discord/flux', () => ({
	Stores: {
		UserStore: {
			getUser: () => {
				if (storedUser === 'throw') throw new Error('boom')
				return storedUser
			},
		},
	},
}))
mock.module('@valenced/discord/design', () => ({
	Design: { ActionSheet: Sheet, ActionSheetRow: Row },
}))
mock.module('@valenced/modules/finders/filters', () => ({
	withName: () => 'x',
}))
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
const lookups: string[][] = []
mock.module('@valenced/utils/discord', () => ({
	// Like the host, a call with several names wants all of them as one icon
	lookupGeneratedIconComponent: (...names: string[]) => {
		lookups.push(names)
		return names.length === 1 && names[0] === 'SearchIcon'
			? () => null
			: undefined
	},
}))
mock.module('../plugins/reverse-image-search/js/ui/SearchSheet', () => ({
	openSearchSheet: (targets: unknown) => opened.push(targets),
}))

const { patchMessageSheet } = await import(
	'../plugins/reverse-image-search/js/adapters/message-sheet'
)
const { patchMediaViewer } = await import(
	'../plugins/reverse-image-search/js/adapters/media-viewer'
)

const Url = 'https://media.discordapp.net/attachments/1/2/a.png?ex=ff'
const message = {
	attachments: [{ url: Url, filename: 'a.png', content_type: 'image/png' }],
}
const sheetTree = () => ({
	type: Sheet,
	props: { children: ['group'] as unknown[] },
})

function runMessageSheet(props: unknown, tree: unknown) {
	const errors: unknown[] = []
	const stop = patchMessageSheet(error => errors.push(error))

	onMessageSheet({ default: () => tree })

	const result = hooks.at(-1)!.hook([props], () => tree)

	return { errors, result, stop }
}

beforeEach(() => {
	hooks.length = 0
	subscriptions.length = 0
	opened.length = 0
	lookups.length = 0
	storedUser = undefined
})

describe('patchMessageSheet', () => {
	test('adds a group for a message with an image', () => {
		const tree = sheetTree()

		runMessageSheet({ message }, tree)

		expect(tree.props.children).toHaveLength(2)
	})

	test('adds a group for any message with an author', () => {
		const tree = sheetTree()

		runMessageSheet(
			{ message: { attachments: [], authorId: '175928847299117063' } },
			tree,
		)

		expect(tree.props.children).toHaveLength(2)
	})

	test('still adds the row when the user store throws', () => {
		const tree = sheetTree()
		storedUser = 'throw'

		const { errors } = runMessageSheet(
			{ message: { author: { id: '175928847299117063', avatar: 'bad' } } },
			tree,
		)

		expect(errors).toEqual([])
		expect(tree.props.children).toHaveLength(2)
	})

	test('adds nothing for a message without an image or author', () => {
		const tree = sheetTree()

		runMessageSheet({ message: { attachments: [] } }, tree)

		expect(tree.props.children).toEqual(['group'])
	})

	test("keeps Discord's sheet when the props are malformed", () => {
		const tree = sheetTree()
		const { errors, result } = runMessageSheet(undefined, tree)

		expect(result).toBe(tree)
		expect(errors).toEqual([])
	})

	test('reports a failure and still returns the tree', () => {
		const tree = {
			get type() {
				throw new Error('boom')
			},
		}
		const { errors, result } = runMessageSheet({ message }, tree)

		expect(result).toBe(tree)
		expect(errors).toHaveLength(1)
	})

	test('removes its patch and subscription on stop', () => {
		const { stop } = runMessageSheet({ message }, sheetTree())

		stop()

		expect(hooks[0]?.removed).toBe(true)
		expect(subscriptions[0]?.active).toBe(false)
	})
})

describe('patchMediaViewer', () => {
	const close = {
		type: () => null,
		props: { accessibilityLabel: 'Close', icon: {}, onPress() {} },
	}

	const run = (props: unknown) => {
		const tree = {
			props: { children: [close] as { props: { onPress(): void } }[] },
		}
		const stop = patchMediaViewer(() => {})

		onViewerHeader({ MediaModalOverlayHeader: () => tree })
		hooks.at(-1)!.hook([props], () => tree)

		return { stop, tree }
	}

	test('adds one button that opens the sheet with the viewed image', () => {
		const { tree } = run({ source: { uri: Url } })

		expect(tree.props.children).toHaveLength(2)
		tree.props.children[0]!.props.onPress()
		expect(opened).toHaveLength(1)
	})

	test('reports why the button is missing', () => {
		const statuses: string[] = []
		const tree = { type: 'View', props: { children: [] } }
		patchMediaViewer(
			() => {},
			status => statuses.push(status),
		)

		onViewerHeader({ MediaModalOverlayHeader: () => tree })
		hooks.at(-1)!.hook([{ source: { uri: Url } }], () => tree)

		expect(statuses).toEqual(['no button slot'])
	})

	test('looks up each icon name on its own', () => {
		run({ source: { uri: Url } })

		expect(lookups.every(names => names.length === 1)).toBe(true)
		expect(lookups.flat()).toContain('SearchIcon')
	})

	test('adds nothing for a video', () => {
		const { tree } = run({ source: { uri: Url, contentType: 'video/mp4' } })

		expect(tree.props.children).toHaveLength(1)
	})

	test('ignores a header that is not a function', () => {
		patchMediaViewer(() => {})
		onViewerHeader({ MediaModalOverlayHeader: {} })

		expect(hooks).toHaveLength(0)
	})

	test('removes its patch and subscription on stop', () => {
		const { stop } = run({ source: { uri: Url } })

		stop()

		expect(hooks[0]?.removed).toBe(true)
		expect(subscriptions[0]?.active).toBe(false)
	})
})
