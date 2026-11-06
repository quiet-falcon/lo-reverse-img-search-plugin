import { ActionSheetActionCreators } from '@valenced/discord/actions'
import { ClientInfoModule, DeviceModule } from '@valenced/discord/native'
import { getModuleWithImportedPath } from '@valenced/discord/utils/modules/finders'
import { getModules } from '@valenced/modules/finders'
import { withName } from '@valenced/modules/finders/filters'
import { getBridgeInfo } from '@valenced/modules/native'
import { before } from '@valenced/patcher'
import { recordError, recordFields, recordSheetKey } from '../core/probe'
import type { ProbeInfo, ProbeState } from '../core/probe'

type Render = (props: Record<string, unknown>) => unknown

const Unavailable = 'unavailable'
const MessageSheetName = 'LongPressMessageActionSheet'
const ViewerHeaderName = 'MediaModalOverlayHeader'
const ViewerHeaderPath =
	'modules/media_viewer/native/components/overlay/MediaModalOverlayHeader.tsx'

export function readProbeInfo(pluginVersion: string): ProbeInfo {
	const client = attempt(() => ClientInfoModule.getConstants())
	const device = attempt(() => DeviceModule.getConstants())
	const bridge = attempt(() => getBridgeInfo())

	return {
		pluginVersion,
		discordVersion: client?.Version ?? Unavailable,
		discordBuild: client?.Build ?? Unavailable,
		releaseChannel: client?.ReleaseChannel ?? Unavailable,
		androidSdk: device?.systemVersion ?? Unavailable,
		bridge: bridge ? `${bridge.name} ${bridge.version}` : Unavailable,
	}
}

export function startProbe(state: ProbeState) {
	const unpatches: (() => void)[] = []

	state.entryPoints[MessageSheetName] = 'not seen yet'
	state.entryPoints[ViewerHeaderName] = 'not seen yet'

	const observe = (name: string, patch: () => () => void) => {
		try {
			unpatches.push(patch())
		} catch {
			recordError(state, `patch ${name}`)
		}
	}

	observe('openLazy', () =>
		before(ActionSheetActionCreators, 'openLazy', args => {
			recordSheetKey(state, args[1])
			return args
		}),
	)

	const stopMessageSheet = getModules(
		withName<Render>(MessageSheetName),
		mod => {
			state.entryPoints[MessageSheetName] = 'found'

			observe(MessageSheetName, () =>
				before(mod as unknown as { default: Render }, 'default', args => {
					readMessage(state, args[0])
					return args
				}),
			)
		},
		{ returnNamespace: true },
	)

	const stopViewerHeader = getModuleWithImportedPath<Record<string, unknown>>(
		ViewerHeaderPath,
		exports => {
			const target = findRenderTarget(exports)

			state.entryPoints[ViewerHeaderName] = target
				? `found via ${target.label}`
				: 'found, but no render function'
			if (!target) return

			observe(ViewerHeaderName, () =>
				before(target.parent, target.key, args => {
					readViewer(state, args[0])
					return args
				}),
			)
		},
	)

	return () => {
		stopMessageSheet()
		stopViewerHeader()
		for (const unpatch of unpatches) unpatch()
	}
}

function readMessage(state: ProbeState, props: Record<string, unknown>) {
	guard(state, 'read message', () => {
		const message = props?.message as Record<string, unknown> | undefined

		recordFields(state, 'message', message)
		recordFields(state, 'attachment', first(message?.attachments))

		const embed = first(message?.embeds) as Record<string, unknown> | undefined

		recordFields(state, 'embed', embed)
		recordFields(state, 'embedImage', embed?.image ?? embed?.thumbnail)
	})
}

function readViewer(state: ProbeState, props: Record<string, unknown>) {
	guard(state, 'read viewer', () => {
		recordFields(state, 'viewerProps', props)
		recordFields(state, 'viewerSource', props?.source)
	})
}

function guard(state: ProbeState, stage: string, read: () => void) {
	try {
		read()
	} catch {
		recordError(state, stage)
	}
}

// A report with gaps is still useful on an unknown Discord build
function attempt<T>(read: () => T) {
	try {
		return read()
	} catch {
		return undefined
	}
}

function first(value: unknown) {
	return Array.isArray(value) ? value[0] : undefined
}

// A plain function export swaps live, and a memo keeps its render on `type`
function findRenderTarget(exports: Record<string, unknown>) {
	for (const key of [ViewerHeaderName, 'default']) {
		const value = exports[key]

		if (typeof value === 'function')
			return {
				parent: exports as Record<string, Render>,
				key,
				label: `${key} function`,
			}

		const inner = (value as { type?: unknown } | undefined)?.type

		if (typeof inner === 'function')
			return {
				parent: value as Record<string, Render>,
				key: 'type',
				label: `${key} memo`,
			}
	}
}
