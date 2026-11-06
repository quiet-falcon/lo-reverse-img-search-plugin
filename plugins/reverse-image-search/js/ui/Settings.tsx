import Page from '@valenced/components/Page'
import { ToastActionCreators } from '@valenced/discord/actions'
import { Design } from '@valenced/discord/design'
import { formatVersion } from '@valenced/plugins/utils'
import { useState } from 'react'
import { ScrollView } from 'react-native'
import { openKeyPage, openPrivacyPage } from '../adapters/external'
import { updateSettings, useSettings } from '../adapters/settings-store'
import { cleanKey, looksLikeKey } from '../core/settings'
import { ProbeSection } from './ProbeSettings'
import type { PluginSettingsComponent } from '@valenced/plugins/types'
import type { ComponentProps } from 'react'
import type { Settings as SettingsData } from '../core/settings'

const { Stack, TableRow, TableRowGroup, TableSwitchRow, Text, TextInput } =
	Design

type SettingsProps = ComponentProps<
	PluginSettingsComponent<{ jsonStorage: SettingsData }>
>

export default function Settings({ api: { plugin } }: SettingsProps) {
	const settings = useSettings()
	const [keyError, setKeyError] = useState('')
	const [keyField, setKeyField] = useState(0)
	const hasKey = looksLikeKey(settings.saucenaoKey)

	const saveKey = (value: string) => {
		const key = cleanKey(value)
		if (key && !looksLikeKey(key)) {
			setKeyError("That doesn't look like a SauceNAO key. Copy it again.")
			return
		}
		setKeyError('')
		updateSettings({ saucenaoKey: key })
	}

	const clearKey = () => {
		setKeyError('')
		updateSettings({ saucenaoKey: '' })
		setKeyField(value => value + 1)
		ToastActionCreators.open('RIS_KEY_CLEARED', { text: 'Key removed' })
	}

	return (
		<ScrollView keyboardShouldPersistTaps="handled">
			<Page>
				<Stack spacing={24}>
					<TableRowGroup title="Search in app">
						<TableSwitchRow
							label="trace.moe"
							subLabel="Anime screenshots. No key needed."
							value={settings.tracemoe}
							onValueChange={(tracemoe: boolean) =>
								updateSettings({ tracemoe })
							}
						/>
						<TableSwitchRow
							label="SauceNAO"
							subLabel={
								hasKey
									? 'Art and manga. Key added.'
									: 'Art and manga. Add a free key below to use it.'
							}
							value={settings.saucenao}
							onValueChange={(saucenao: boolean) =>
								updateSettings({ saucenao })
							}
						/>
					</TableRowGroup>

					<Stack spacing={8}>
						<TextInput
							key={keyField}
							label="SauceNAO API key"
							placeholder="Paste your key"
							defaultValue={settings.saucenaoKey}
							secureTextEntry
							status={keyError ? 'error' : 'default'}
							errorMessage={keyError || undefined}
							onChange={saveKey}
						/>
						<Text variant="text-xs/normal" color="text-muted">
							Saved as plain text in this plugin's settings file. Other plugins
							may be able to read it.
						</Text>
						<TableRowGroup>
							<TableRow
								label="Get a free key"
								subLabel="Opens SauceNAO's API page in your browser."
								onPress={() => openKeyPage().catch(() => {})}
							/>
							{settings.saucenaoKey !== '' && (
								<TableRow label="Remove key" onPress={clearKey} />
							)}
						</TableRowGroup>
					</Stack>

					<TableRowGroup title="Privacy">
						<TableRow
							label="What each service receives"
							subLabel="Opens the privacy details in your browser."
							onPress={() => openPrivacyPage().catch(() => {})}
						/>
						{settings.consented.length > 0 && (
							<TableRow
								label="Show first-search notices again"
								onPress={() => updateSettings({ consented: [] })}
							/>
						)}
					</TableRowGroup>

					{__DEV__ && (
						<ProbeSection version={formatVersion(plugin.manifest.version)} />
					)}
				</Stack>
			</Page>
		</ScrollView>
	)
}
