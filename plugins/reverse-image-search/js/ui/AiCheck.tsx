import { ToastActionCreators } from '@valenced/discord/actions'
import { Design } from '@valenced/discord/design'
import { useEffect, useRef, useState } from 'react'
import { openSynthId } from '../adapters/external'
import { checkImageTags } from '../adapters/image-check'
import { errorMessage } from '../core/messages'
import { createSearchSession } from '../core/session'
import { tagSignals } from '../core/signals'
import { hasOriginalFile } from '../core/target'
import { SignalStrip } from './SignalStrip'
import type { TagOutcome } from '../adapters/image-check'
import type { ImageTarget } from '../core/types'

const { ActionSheetRow, Stack, Text } = Design

export function AiCheck({ target }: { target: ImageTarget }) {
	const session = useRef(createSearchSession()).current
	const [checking, setChecking] = useState(false)
	const [outcome, setOutcome] = useState<TagOutcome>()

	useEffect(() => () => session.cancel(), [session])

	const check = async () => {
		setOutcome(undefined)
		setChecking(true)
		const result = await checkImageTags(session, target)
		setChecking(false)
		if (result) setOutcome(result)
	}

	const openChecker = () => {
		openSynthId().catch(() => {
			ToastActionCreators.open('RIS_OPEN_FAILED', {
				text: "Couldn't open the SynthID checker.",
			})
		})
	}

	return (
		<Stack spacing={8}>
			<ActionSheetRow.Group title="AI check">
				{hasOriginalFile(target) && (
					<ActionSheetRow
						label={checking ? 'Reading tags…' : 'Check AI tags'}
						subLabel="Reads this file's tags. Nothing goes to outside services."
						onPress={checking ? undefined : check}
					/>
				)}
				<ActionSheetRow
					label="Open SynthID checker"
					subLabel="Save the image first, then upload it there. A miss proves nothing."
					onPress={openChecker}
				/>
			</ActionSheetRow.Group>
			{outcome?.kind === 'tags' && (
				<SignalStrip signals={tagSignals(outcome.tags)} />
			)}
			{outcome?.kind === 'error' && (
				<Text variant="text-sm/normal" color="text-muted">
					{errorMessage(outcome.category, 'Discord')}
				</Text>
			)}
		</Stack>
	)
}
