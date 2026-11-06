import {
	ActionSheetActionCreators,
	ToastActionCreators,
} from '@valenced/discord/actions'
import { Design } from '@valenced/discord/design'
import { useEffect, useRef, useState } from 'react'
import { Image, View } from 'react-native'
import { handoffChoices, openHandoff, openResult } from '../adapters/external'
import { searchImage } from '../adapters/search'
import { recordConsent, useSettings } from '../adapters/settings-store'
import { CopyLimits, copyDetail, copyHeadline } from '../core/copy-check'
import { fuseResults } from '../core/fusion'
import {
	ConsentNotices,
	errorMessage,
	hiddenSummary,
	joinNames,
	matchLabel,
	noMatchHint,
	ProviderNames,
	providerStatus,
	StateMessages,
	visibleResults,
} from '../core/messages'
import { createSearchSession } from '../core/session'
import { activeProviders, needsConsent, visionSpec } from '../core/settings'
import { previewUrl } from '../core/target'
import type { SearchState } from '../core/session'
import type { ProviderSpec } from '../core/settings'
import type {
	ImageTarget,
	ProviderId,
	ProviderOutcomes,
	ProviderResult,
	SearchOutcome,
	WebFindings,
} from '../core/types'

const { ActionSheet, ActionSheetRow, ActionSheetSwitchRow, Stack, Text } =
	Design

const SheetKey = 'RIS_SEARCH_SHEET'
const PreviewHeight = 160

type SearchMode = 'search' | 'copies'

interface SearchRun {
	specs: ProviderSpec[]
	mode: SearchMode
}

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
			<InAppSearch target={target} />
			<Text variant="text-sm/normal" color="text-muted">
				Opens in your browser. The engine you pick gets this image's link, which
				can include its channel ID, attachment ID, filename, and a temporary
				signature.
			</Text>
			<ActionSheetRow.Group title="Open in browser">
				{handoffChoices.map(({ id, name, note }) => (
					<ActionSheetRow
						key={id}
						label={name}
						subLabel={note}
						onPress={() => open(id)}
					/>
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

function InAppSearch({ target }: { target: ImageTarget }) {
	const settings = useSettings()
	const providers = activeProviders(settings)
	const ids = providers.map(spec => spec.id)
	const copySpec = visionSpec(settings)
	const session = useRef(createSearchSession()).current
	const [state, setState] = useState<SearchState>('idle')
	const [outcome, setOutcome] = useState<SearchOutcome>()
	const [asking, setAsking] = useState<SearchRun>()
	const [lastRun, setLastRun] = useState<SearchRun>({
		specs: providers,
		mode: 'search',
	})
	const lastIds = lastRun.specs.map(spec => spec.id)

	// Closing the sheet or stopping the plugin cancels the search
	useEffect(() => () => session.cancel(), [session])

	const busy = session.isActive() && state !== 'done' && state !== 'failed'

	const run = (next: SearchRun) => {
		setOutcome(undefined)
		setLastRun(next)
		searchImage(session, target, next.specs, {
			onState: setState,
			onOutcome: setOutcome,
		})
	}

	const start = (next: SearchRun) => {
		if (needsConsent(settings, next.specs).length) return setAsking(next)
		run(next)
	}

	const accept = () => {
		if (!asking) return

		recordConsent(needsConsent(settings, asking.specs)).catch(() => {})
		setAsking(undefined)
		run(asking)
	}

	const cancel = () => {
		session.cancel()
		setState('cancelled')
	}

	if (!ids.length && !copySpec)
		return (
			<ActionSheetRow.Group title="Search in app">
				<ActionSheetRow
					label="No in-app search turned on"
					subLabel="Turn on trace.moe, or add a key in plugin settings."
				/>
			</ActionSheetRow.Group>
		)

	return (
		<Stack spacing={8}>
			{asking ? (
				<Consent
					ids={needsConsent(settings, asking.specs)}
					onAccept={accept}
					onCancel={() => setAsking(undefined)}
				/>
			) : (
				<ActionSheetRow.Group title="Search in app">
					{busy && (
						<ActionSheetRow
							label="Cancel search"
							subLabel={StateMessages[state]}
							onPress={cancel}
						/>
					)}
					{!busy && ids.length > 0 && (
						<ActionSheetRow
							label={`Search with ${joinNames(ids)}`}
							subLabel={`Sends this image to ${joinNames(ids)}.`}
							onPress={() => start({ specs: providers, mode: 'search' })}
						/>
					)}
					{!busy && copySpec && (
						<ActionSheetRow
							label="Check copies with Google Vision"
							subLabel="Sends this image to Google Vision only."
							onPress={() => start({ specs: [copySpec], mode: 'copies' })}
						/>
					)}
					{!busy && !copySpec && (
						<ActionSheetRow
							label="Check copies"
							subLabel="Add a Google Vision key in plugin settings, or use TinEye or Google Lens below."
						/>
					)}
				</ActionSheetRow.Group>
			)}
			{state === 'cancelled' && (
				<Text variant="text-sm/normal" color="text-muted">
					Search cancelled.
				</Text>
			)}
			{outcome?.kind === 'error' && (
				<Text variant="text-sm/normal" color="text-muted">
					{errorMessage(outcome.category, joinNames(lastIds))}
				</Text>
			)}
			{outcome?.kind === 'providers' && (
				<Results
					outcomes={outcome.outcomes}
					order={lastIds}
					mode={lastRun.mode}
				/>
			)}
		</Stack>
	)
}

function Consent({
	ids,
	onAccept,
	onCancel,
}: {
	ids: ProviderId[]
	onAccept(): void
	onCancel(): void
}) {
	return (
		<Stack spacing={8}>
			<Text variant="text-md/semibold">Before your first search</Text>
			{ids.map(id => (
				<Text key={id} variant="text-sm/normal" color="text-muted">
					{ConsentNotices[id]}
				</Text>
			))}
			<ActionSheetRow.Group>
				<ActionSheetRow
					label="Continue and search"
					subLabel="You won't see this again for these services."
					onPress={onAccept}
				/>
				<ActionSheetRow label="Not now" onPress={onCancel} />
			</ActionSheetRow.Group>
		</Stack>
	)
}

function Results({
	outcomes,
	order,
	mode,
}: {
	outcomes: ProviderOutcomes
	order: ProviderId[]
	mode: SearchMode
}) {
	const vision = outcomes.vision
	const web = vision?.kind === 'results' ? vision.web : undefined

	if (mode === 'copies')
		return (
			<Stack spacing={8}>
				{web && <CopyFindings web={web} />}
				<ProviderLines outcomes={outcomes} order={order} />
			</Stack>
		)

	return <RankedResults outcomes={outcomes} order={order} web={web} />
}

function RankedResults({
	outcomes,
	order,
	web,
}: {
	outcomes: ProviderOutcomes
	order: ProviderId[]
	web: WebFindings | undefined
}) {
	const [showWeak, setShowWeak] = useState(false)
	const fused = fuseResults(outcomes, order)
	const { shown, weak, adult } = visibleResults(fused, showWeak)
	const [best, ...rest] = shown
	const hasBest = best !== undefined && best.tier !== 'possible'
	const others = hasBest ? rest : shown
	const hidden = hiddenSummary(weak, adult, showWeak)

	return (
		<Stack spacing={8}>
			{!hasBest && (
				<Text variant="text-sm/normal" color="text-muted">
					{noMatchHint(order)}
				</Text>
			)}
			{hasBest && (
				<ActionSheetRow.Group title="Best match">
					<ResultRow result={best} />
				</ActionSheetRow.Group>
			)}
			{others.length > 0 && (
				<ActionSheetRow.Group title={hasBest ? 'More results' : 'Results'}>
					{others.map((result, index) => (
						<ResultRow
							key={`${result.url ?? result.title}-${index}`}
							result={result}
						/>
					))}
				</ActionSheetRow.Group>
			)}
			{weak > 0 && (
				<ActionSheetRow.Group>
					<ActionSheetSwitchRow
						label="Show weaker matches"
						subLabel="Low similarity. These are usually wrong."
						value={showWeak}
						onValueChange={setShowWeak}
					/>
				</ActionSheetRow.Group>
			)}
			{web && <ImageNotes web={web} />}
			<ProviderLines outcomes={outcomes} order={order} />
			{hidden !== '' && (
				<Text variant="text-xs/normal" color="text-muted">
					{hidden}
				</Text>
			)}
		</Stack>
	)
}

function ProviderLines({
	outcomes,
	order,
}: {
	outcomes: ProviderOutcomes
	order: ProviderId[]
}) {
	return order.map(id => {
		const outcome = outcomes[id]
		return outcome ? (
			<Text key={id} variant="text-xs/normal" color="text-muted">
				{providerStatus(id, outcome)}
			</Text>
		) : null
	})
}

function ImageNotes({ web }: { web: WebFindings }) {
	const notes = [
		web.bestGuess ? `Google thinks this is: ${web.bestGuess}` : '',
		web.entities.length ? `Related: ${web.entities.join(', ')}` : '',
		web.text ? `Text in image: ${web.text}` : '',
	].filter(Boolean)

	return notes.map(note => (
		<Text key={note} variant="text-sm/normal" color="text-muted">
			{note}
		</Text>
	))
}

function CopyFindings({ web }: { web: WebFindings }) {
	const [showPages, setShowPages] = useState(false)
	const [showLimits, setShowLimits] = useState(false)
	const detail = copyDetail(web)

	return (
		<Stack spacing={8}>
			<Text variant="text-md/semibold">{copyHeadline(web)}</Text>
			{detail !== '' && (
				<Text variant="text-sm/normal" color="text-muted">
					{detail}
				</Text>
			)}
			<ImageNotes web={web} />
			<ActionSheetRow.Group>
				{web.pages.length > 0 && (
					<ActionSheetSwitchRow
						label="Show pages"
						value={showPages}
						onValueChange={setShowPages}
					/>
				)}
				<ActionSheetSwitchRow
					label="What this means"
					value={showLimits}
					onValueChange={setShowLimits}
				/>
			</ActionSheetRow.Group>
			{showLimits && (
				<Text variant="text-sm/normal" color="text-muted">
					{CopyLimits}
				</Text>
			)}
			{showPages && (
				<ActionSheetRow.Group title="Pages using this image">
					{web.pages.map(page => (
						<ActionSheetRow
							key={page.url}
							label={page.title}
							subLabel={`${page.exact ? 'Exact copy' : 'Edited copy'} · ${page.site}`}
							onPress={() => openResult(page.url)}
						/>
					))}
				</ActionSheetRow.Group>
			)}
		</Stack>
	)
}

function ResultRow({ result }: { result: ProviderResult }) {
	return (
		<ActionSheetRow
			label={result.title}
			subLabel={[
				matchLabel(result),
				result.tier === 'possible' ? 'likely wrong' : '',
				ProviderNames[result.provider],
				result.detail,
			]
				.filter(Boolean)
				.join(' · ')}
			onPress={result.url ? () => openResult(result.url!) : undefined}
		/>
	)
}
