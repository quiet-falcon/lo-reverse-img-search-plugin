import {
	ActionSheetActionCreators,
	ToastActionCreators,
} from '@valenced/discord/actions'
import { Design } from '@valenced/discord/design'
import { useEffect, useRef, useState } from 'react'
import { Image, View } from 'react-native'
import { handoffChoices, openHandoff, openResult } from '../adapters/external'
import { searchTraceMoe } from '../adapters/search'
import {
	ErrorMessages,
	percent,
	StateMessages,
	TierLabels,
	visibleResults,
} from '../core/messages'
import { createSearchSession } from '../core/session'
import { previewUrl } from '../core/target'
import type { SearchState } from '../core/session'
import type { ImageTarget, ProviderOutcome } from '../core/types'

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
			<TraceMoeSearch target={target} />
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

function TraceMoeSearch({ target }: { target: ImageTarget }) {
	const session = useRef(createSearchSession()).current
	const [state, setState] = useState<SearchState>('idle')
	const [outcome, setOutcome] = useState<ProviderOutcome>()

	// Closing the sheet or stopping the plugin cancels the search
	useEffect(() => () => session.cancel(), [session])

	const busy = session.isActive() && state !== 'done' && state !== 'failed'

	const start = () => {
		setOutcome(undefined)
		searchTraceMoe(session, target, {
			onState: setState,
			onOutcome: setOutcome,
		})
	}

	const cancel = () => {
		session.cancel()
		setState('cancelled')
	}

	return (
		<Stack spacing={8}>
			<ActionSheetRow.Group title="Search in app">
				{busy ? (
					<ActionSheetRow
						label="Cancel search"
						subLabel={StateMessages[state]}
						onPress={cancel}
					/>
				) : (
					<ActionSheetRow
						label="Search with trace.moe"
						subLabel="For anime screenshots. Sends the image to trace.moe, which logs your IP address."
						onPress={start}
					/>
				)}
			</ActionSheetRow.Group>
			{state === 'cancelled' && (
				<Text variant="text-sm/normal" color="text-muted">
					Search cancelled.
				</Text>
			)}
			{outcome && <Outcome outcome={outcome} />}
		</Stack>
	)
}

function Outcome({ outcome }: { outcome: ProviderOutcome }) {
	if (outcome.kind === 'error')
		return (
			<Text variant="text-sm/normal" color="text-muted">
				{ErrorMessages[outcome.category]}
			</Text>
		)

	const { shown, hidden } = visibleResults(outcome.results)
	const quota =
		outcome.quotaLeft === undefined
			? ''
			: ` ${outcome.quotaLeft} free searches left today.`

	return (
		<Stack spacing={8}>
			{shown.length ? (
				<ActionSheetRow.Group title="trace.moe results">
					{shown.map((result, index) => (
						<ActionSheetRow
							key={`${result.url ?? result.title}-${index}`}
							label={result.title}
							subLabel={[
								`${TierLabels[result.tier]}, ${percent(result.similarity)}`,
								result.detail,
							]
								.filter(Boolean)
								.join(' · ')}
							onPress={result.url ? () => openResult(result.url!) : undefined}
						/>
					))}
				</ActionSheetRow.Group>
			) : (
				<Text variant="text-sm/normal" color="text-muted">
					No confident match. trace.moe only knows anime, so try a browser
					button for other images.
				</Text>
			)}
			<Text variant="text-xs/normal" color="text-muted">
				{hidden
					? `${hidden} weaker or adult results hidden.${quota}`
					: quota.trim()}
			</Text>
		</Stack>
	)
}
