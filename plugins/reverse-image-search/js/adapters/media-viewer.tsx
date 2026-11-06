import { getModuleWithImportedPath } from '@valenced/discord/utils/modules/finders'
import { instead } from '@valenced/patcher'
import { createElement } from 'react'
import { targetFromViewer } from '../core/target'
import { findOverlayButton, insertBefore } from '../core/tree'
import { openSearchSheet } from '../ui/SearchSheet'
import { searchIcon } from './icons'
import type { ComponentType } from 'react'

type Header = (props: { source?: unknown }) => unknown

const HeaderName = 'MediaModalOverlayHeader'
const HeaderPath =
	'modules/media_viewer/native/components/overlay/MediaModalOverlayHeader.tsx'
const ButtonKey = 'ris-search-button'

export function patchMediaViewer(onError: (error: unknown) => void) {
	let unpatch: (() => void) | undefined

	const unsubscribe = getModuleWithImportedPath<Record<string, Header>>(
		HeaderPath,
		exports => {
			if (typeof exports[HeaderName] !== 'function') return

			unpatch = instead(exports, HeaderName, (args, Original) => {
				const tree = Reflect.apply(Original, undefined, args)

				try {
					addSearchButton(tree, args[0]?.source)
				} catch (error) {
					onError(error)
				}

				return tree
			})
		},
	)

	return () => {
		unsubscribe()
		unpatch?.()
	}
}

function addSearchButton(tree: unknown, source: unknown) {
	const target = targetFromViewer(source)
	const slot = target && findOverlayButton(tree)
	const Icon = searchIcon()
	if (!target || !slot || !Icon) return

	insertBefore(
		slot,
		createElement(slot.element.type as ComponentType<Record<string, unknown>>, {
			key: ButtonKey,
			accessibilityLabel: 'Search image',
			icon: createElement(Icon, {
				size: 'md',
				color: 'interactive-text-active',
			}),
			onPress: () => openSearchSheet([target]),
		}),
	)
}
