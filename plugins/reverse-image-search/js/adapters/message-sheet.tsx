import { ActionSheetActionCreators } from '@valenced/discord/actions'
import { Design } from '@valenced/discord/design'
import { getModules } from '@valenced/modules/finders'
import { withName } from '@valenced/modules/finders/filters'
import { instead } from '@valenced/patcher'
import { targetsFromMessage } from '../core/target'
import { appendChild, findByType } from '../core/tree'
import { openSearchSheet } from '../ui/SearchSheet'
import { searchIcon } from './icons'
import type { FC } from 'react'
import type { ImageTarget } from '../core/types'

type LongPressMessageActionSheet = FC<{ message: unknown }>

export function patchMessageSheet(onError: (error: unknown) => void) {
	let unpatch: (() => void) | undefined

	const unsubscribe = getModules(
		withName<LongPressMessageActionSheet>('LongPressMessageActionSheet'),
		mod => {
			const module = mod as unknown as { default: LongPressMessageActionSheet }

			unpatch = instead(module, 'default', (args, Sheet) => {
				const tree = Reflect.apply(Sheet, undefined, args)

				// Discord's own sheet must survive any failure here
				try {
					addSearchRow(tree, targetsFromMessage(args[0]?.message))
				} catch (error) {
					onError(error)
				}

				return tree
			})
		},
		{ returnNamespace: true },
	)

	return () => {
		unsubscribe()
		unpatch?.()
	}
}

function addSearchRow(tree: unknown, targets: ImageTarget[]) {
	if (!targets.length) return

	const sheet = findByType(tree, Design.ActionSheet)
	if (!sheet) return

	appendChild(sheet, <SearchRow targets={targets} />)
}

function SearchRow({ targets }: { targets: ImageTarget[] }) {
	const { ActionSheetRow } = Design
	const Icon = searchIcon()

	return (
		<ActionSheetRow.Group>
			<ActionSheetRow
				label="Search Image"
				icon={Icon ? <ActionSheetRow.Icon IconComponent={Icon} /> : undefined}
				onPress={() => {
					ActionSheetActionCreators.hideActionSheet()
					openSearchSheet(targets)
				}}
			/>
		</ActionSheetRow.Group>
	)
}
