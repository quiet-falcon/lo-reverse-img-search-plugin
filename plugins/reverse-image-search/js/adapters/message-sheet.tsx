import { ActionSheetActionCreators } from '@valenced/discord/actions'
import { Design } from '@valenced/discord/design'
import { getModules } from '@valenced/modules/finders'
import { withName } from '@valenced/modules/finders/filters'
import { instead } from '@valenced/patcher'
import { profileSignals, profileTargets } from '../core/profile'
import { targetsFromMessage } from '../core/target'
import { appendChild, findByType } from '../core/tree'
import { openSearchSheet } from '../ui/SearchSheet'
import { profileIcon, searchIcon } from './icons'
import { profileForMessage } from './profile'
import type { FC } from 'react'
import type { Profile } from '../core/profile'
import type { ImageTarget } from '../core/types'
import type { RecordWatcher } from './profile'

type LongPressMessageActionSheet = FC<{ message: unknown }>

export function patchMessageSheet(
	onError: (error: unknown) => void,
	onRecords?: RecordWatcher,
) {
	let unpatch: (() => void) | undefined

	const unsubscribe = getModules(
		withName<LongPressMessageActionSheet>('LongPressMessageActionSheet'),
		mod => {
			const module = mod as unknown as { default: LongPressMessageActionSheet }

			unpatch = instead(module, 'default', (args, Sheet) => {
				const tree = Reflect.apply(Sheet, undefined, args)

				// Discord's own sheet must survive any failure here
				try {
					const message = args[0]?.message
					addRows(
						tree,
						targetsFromMessage(message),
						profileForMessage(message, onRecords),
					)
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

function addRows(
	tree: unknown,
	targets: ImageTarget[],
	profile: Profile | undefined,
) {
	if (!targets.length && !profile) return

	const sheet = findByType(tree, Design.ActionSheet)
	if (!sheet) return

	appendChild(sheet, <PluginRows targets={targets} profile={profile} />)
}

function PluginRows({
	targets,
	profile,
}: {
	targets: ImageTarget[]
	profile: Profile | undefined
}) {
	const { ActionSheetRow } = Design
	const SearchIcon = searchIcon()
	const ProfileIcon = profileIcon()

	return (
		<ActionSheetRow.Group>
			{targets.length > 0 && (
				<ActionSheetRow
					label="Search Image"
					icon={
						SearchIcon ? (
							<ActionSheetRow.Icon IconComponent={SearchIcon} />
						) : undefined
					}
					onPress={() => {
						ActionSheetActionCreators.hideActionSheet()
						openSearchSheet(targets)
					}}
				/>
			)}
			{profile && (
				<ActionSheetRow
					label="Check Profile"
					icon={
						ProfileIcon ? (
							<ActionSheetRow.Icon IconComponent={ProfileIcon} />
						) : undefined
					}
					onPress={() => {
						ActionSheetActionCreators.hideActionSheet()
						openSearchSheet(profileTargets(profile), {
							title: profile.name,
							signals: profileSignals(profile, Date.now()),
						})
					}}
				/>
			)}
		</ActionSheetRow.Group>
	)
}
