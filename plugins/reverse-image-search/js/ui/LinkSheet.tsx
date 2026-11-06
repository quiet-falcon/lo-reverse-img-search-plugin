import { ActionSheetActionCreators } from '@valenced/discord/actions'
import { Design } from '@valenced/discord/design'
import { useEffect, useState } from 'react'
import { loadPhishingList } from '../adapters/link-check'
import { linkSignals } from '../core/link-risk'
import { SignalStrip } from './SignalStrip'

const { ActionSheet, Stack, Text } = Design

const SheetKey = 'RIS_LINK_SHEET'

interface LinkSheetProps {
	domains: string[]
}

export function openLinkSheet(domains: string[]) {
	ActionSheetActionCreators.openLazy(
		Promise.resolve({ default: LinkSheet }),
		SheetKey,
		{ domains },
	)
}

export function closeLinkSheet() {
	try {
		ActionSheetActionCreators.hideActionSheet(SheetKey)
	} catch {
		// Already closed
	}
}

function LinkSheet({ domains }: LinkSheetProps) {
	const [list, setList] = useState<Set<string>>()
	const [loading, setLoading] = useState(true)

	useEffect(() => {
		let active = true
		loadPhishingList()
			.catch(() => undefined)
			.then(loaded => {
				if (!active) return
				setList(loaded)
				setLoading(false)
			})

		return () => {
			active = false
		}
	}, [])

	return (
		<ActionSheet>
			<Stack spacing={12}>
				{loading ? (
					<Text variant="text-sm/normal" color="text-muted">
						Checking the scam list…
					</Text>
				) : (
					<SignalStrip title="Links" signals={linkSignals(domains, list)} />
				)}
				<Text variant="text-xs/normal" color="text-muted">
					The check runs on your phone. Your links aren't sent anywhere.
				</Text>
			</Stack>
		</ActionSheet>
	)
}
