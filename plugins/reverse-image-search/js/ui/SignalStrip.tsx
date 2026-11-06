import { Design } from '@valenced/discord/design'
import { signalIcon } from '../adapters/icons'
import type { Signal } from '../core/signals'

const { ActionSheetRow } = Design

interface SignalStripProps {
	title?: string
	signals: Signal[]
}

export function SignalStrip({ title, signals }: SignalStripProps) {
	if (!signals.length) return null

	return (
		<ActionSheetRow.Group title={title}>
			{signals.map(signal => {
				const Icon = signalIcon(signal.level)

				return (
					<ActionSheetRow
						key={signal.id}
						label={signal.title}
						subLabel={signal.detail}
						icon={
							Icon ? <ActionSheetRow.Icon IconComponent={Icon} /> : undefined
						}
					/>
				)
			})}
		</ActionSheetRow.Group>
	)
}
