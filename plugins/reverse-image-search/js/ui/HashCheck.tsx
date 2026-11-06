import { Design } from '@valenced/discord/design'
import { useEffect, useRef, useState } from 'react'
import { Image, View } from 'react-native'
import { openReport } from '../adapters/external'
import { hashTarget } from '../adapters/hash-check'
import { updateSettings, useSettings } from '../adapters/settings-store'
import { communitySignal, findCommunityMatch } from '../core/community-list'
import { ReportAvailable } from '../core/features'
import {
	addSaved,
	findMatch,
	isReliable,
	matchSignal,
	NoMatchSignal,
	TooPlainSignal,
} from '../core/hash-list'
import { errorMessage } from '../core/messages'
import { thumbnailUri } from '../core/pixels'
import { createSearchSession } from '../core/session'
import { previewUrl } from '../core/target'
import { SignalStrip } from './SignalStrip'
import type { ListMatch } from '../core/hash-list'
import type { Signal } from '../core/signals'
import type { ErrorCategory, ImageTarget } from '../core/types'

const { ActionSheetRow, Stack, Text } = Design

const ThumbSize = 96

interface HashCheckProps {
	target: ImageTarget
	owner?: string
}

interface CheckResult {
	signal?: Signal
	match?: ListMatch
	note?: string
	error?: ErrorCategory
}

export function HashCheck({ target, owner }: HashCheckProps) {
	const settings = useSettings()
	const session = useRef(createSearchSession()).current
	const [busy, setBusy] = useState(false)
	const [result, setResult] = useState<CheckResult>()
	const isProfile = target.kind === 'avatar' || target.kind === 'banner'
	const label = owner ? `${owner}, ${target.label}` : target.label

	const run = async (action: 'check' | 'save' | 'report') => {
		setResult(undefined)
		setBusy(true)
		const outcome = await hashTarget(session, target)
		setBusy(false)
		if (!outcome) return
		if (outcome.kind === 'error') return setResult({ error: outcome.category })
		if (!isReliable(outcome.image)) return setResult({ signal: TooPlainSignal })

		if (action === 'report') {
			await openReport(outcome.image.hash).catch(() => {})
			return setResult({
				note: 'Check the GitHub page, then submit it. Only the fingerprint is included.',
			})
		}

		const match = findMatch(outcome.image, settings.hashList)
		if (match) return setResult({ signal: matchSignal(match), match })
		if (action === 'check') {
			const reported = findCommunityMatch(
				outcome.image,
				settings.communityList.entries,
			)
			return setResult({
				signal: reported ? communitySignal(reported) : NoMatchSignal,
			})
		}

		await updateSettings({
			hashList: addSaved(
				settings.hashList,
				outcome.image,
				label,
				thumbnailUri(outcome.pixels),
				Date.now(),
			),
		})
		setResult({ note: 'Saved to your list.' })
	}

	// Only Discord is contacted, so profile images can check themselves
	const shouldAutoRun =
		isProfile &&
		settings.hashList.length + settings.communityList.entries.length > 0
	useEffect(() => {
		if (shouldAutoRun) run('check')
		return () => session.cancel()
		// Runs once for each sheet
	}, [session])

	return (
		<Stack spacing={8}>
			<ActionSheetRow.Group title="My list">
				<ActionSheetRow
					label={busy ? 'Checking…' : 'Check my list'}
					subLabel="Compares this image on your phone. Nothing goes to outside services."
					onPress={busy ? undefined : () => run('check')}
				/>
				<ActionSheetRow
					label="Save to my list"
					subLabel="Keeps a small picture and a fingerprint on your phone."
					onPress={busy ? undefined : () => run('save')}
				/>
				{ReportAvailable && (
					<ActionSheetRow
						label="Report to community list"
						subLabel="Opens a public GitHub issue with only this image's fingerprint."
						onPress={busy ? undefined : () => run('report')}
					/>
				)}
			</ActionSheetRow.Group>
			{result?.signal && <SignalStrip signals={[result.signal]} />}
			{result?.match && (
				<View style={{ flexDirection: 'row', gap: 12 }}>
					<Image
						accessibilityLabel="This image"
						source={{ uri: previewUrl(target) }}
						style={{ height: ThumbSize, width: ThumbSize }}
					/>
					<Image
						accessibilityLabel="Your saved image"
						source={{ uri: result.match.entry.thumb }}
						style={{ height: ThumbSize, width: ThumbSize }}
					/>
				</View>
			)}
			{result?.note && (
				<Text variant="text-sm/normal" color="text-muted">
					{result.note}
				</Text>
			)}
			{result?.error && (
				<Text variant="text-sm/normal" color="text-muted">
					{errorMessage(result.error, 'Discord')}
				</Text>
			)}
		</Stack>
	)
}
