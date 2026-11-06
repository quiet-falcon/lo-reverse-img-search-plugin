import {
	ActionSheetActionCreators,
	ToastActionCreators,
} from '@valenced/discord/actions'
import { Design } from '@valenced/discord/design'
import { useState } from 'react'
import { Image, View } from 'react-native'
import { handoffChoices, openHandoff } from '../adapters/external'
import { previewUrl } from '../core/target'
import type { ImageTarget } from '../core/types'

const { ActionSheet, ActionSheetRow, ActionSheetSwitchRow, Stack, Text } =
	Design

const SheetKey = 'RIS_SEARCH_SHEET'
const PreviewHeight = 160

interface SearchSheetProps {
	targets: ImageTarget[]
}

export function openSearchSheet(targets: ImageTarget[]) {
	ActionSheetActionCreators.openLazy(
		Promise.resolve({ default: SearchSheet }),
		SheetKey,
		{ targets },
	)
}

export function closeSearchSheet() {
	try {
		ActionSheetActionCreators.hideActionSheet(SheetKey)
	} catch {
		// Already closed
	}
}

function SearchSheet({ targets }: SearchSheetProps) {
	const [target, setTarget] = useState(
		targets.length === 1 ? targets[0] : undefined,
	)

	return (
		<ActionSheet>
			{target ? (
				<Handoffs target={target} />
			) : (
				<ActionSheetRow.Group title="Choose an image">
					{targets.map(item => (
						<ActionSheetRow
							key={item.url}
							label={item.label}
							subLabel={item.spoiler ? 'Spoiler' : undefined}
							onPress={() => setTarget(item)}
						/>
					))}
				</ActionSheetRow.Group>
			)}
		</ActionSheet>
	)
}

function Handoffs({ target }: { target: ImageTarget }) {
	const [swap, setSwap] = useState(false)
	const [revealed, setRevealed] = useState(!target.spoiler)

	const open = (id: string) => {
		openHandoff(id, target, swap).catch(() => {
			ToastActionCreators.open('RIS_OPEN_FAILED', {
				text: "Couldn't open that engine. Try another one.",
			})
		})
	}

	return (
		<Stack spacing={16}>
			{revealed ? (
				<View style={{ height: PreviewHeight }}>
					<Image
						accessibilityLabel={target.label}
						resizeMode="contain"
						source={{ uri: previewUrl(target) }}
						style={{ height: PreviewHeight, width: '100%' }}
					/>
				</View>
			) : (
				<ActionSheetRow.Group>
					<ActionSheetRow
						label="Show spoiler image"
						onPress={() => setRevealed(true)}
					/>
				</ActionSheetRow.Group>
			)}
			<Text variant="text-sm/normal" color="text-muted">
				Opens in your browser. The engine you pick gets this image's link, which
				can include its channel ID, attachment ID, filename, and a temporary
				signature.
			</Text>
			<ActionSheetRow.Group title="Open in browser">
				{handoffChoices.map(({ id, name }) => (
					<ActionSheetRow key={id} label={name} onPress={() => open(id)} />
				))}
			</ActionSheetRow.Group>
			<ActionSheetRow.Group>
				<ActionSheetSwitchRow
					label="Switch image link"
					subLabel="Try this if an engine can't load the image."
					value={swap}
					onValueChange={setSwap}
				/>
			</ActionSheetRow.Group>
		</Stack>
	)
}
