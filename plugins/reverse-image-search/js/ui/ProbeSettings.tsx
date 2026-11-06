import Page from '@valenced/components/Page'
import { ToastActionCreators } from '@valenced/discord/actions'
import { Design } from '@valenced/discord/design'
import { Clipboard } from '@valenced/externals/react-native-clipboard'
import { formatVersion } from '@valenced/plugins/utils'
import { readProbeInfo } from '../adapters/probe'
import { probeState } from '../adapters/session'
import { formatReport } from '../core/probe'
import type { PluginSettingsComponent } from '@valenced/plugins/types'
import type { ComponentProps } from 'react'

const { Stack, TableRow, TableRowGroup, Text } = Design

type SettingsProps = ComponentProps<PluginSettingsComponent>

export default function ProbeSettings({ api: { plugin } }: SettingsProps) {
	return (
		<Page>
			<ProbeSection version={formatVersion(plugin.manifest.version)} />
		</Page>
	)
}

export function ProbeSection({ version }: { version: string }) {
	const report = formatReport(probeState, readProbeInfo(version))

	return (
		<Stack spacing={24}>
			<TableRowGroup title="Device probe">
				<TableRow
					label="Copy report"
					subLabel="Contains versions and field names only."
					onPress={() => {
						Clipboard.setString(report)
						ToastActionCreators.open('RIS_PROBE_COPIED', {
							text: 'Report copied',
						})
					}}
				/>
			</TableRowGroup>
			<Text variant="text-sm/normal" color="text-muted">
				{report}
			</Text>
		</Stack>
	)
}
