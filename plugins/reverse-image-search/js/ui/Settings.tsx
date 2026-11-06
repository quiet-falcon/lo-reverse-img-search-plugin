import Page from '@valenced/components/Page'
import { ToastActionCreators } from '@valenced/discord/actions'
import { Design } from '@valenced/discord/design'
import { formatVersion } from '@valenced/plugins/utils'
import { useState } from 'react'
import { ScrollView } from 'react-native'
import {
	openKeyPage,
	openPrivacyPage,
	openVisionKeyPage,
} from '../adapters/external'
import { updateSettings, useSettings } from '../adapters/settings-store'
import { dateText } from '../core/account-age'
import { VisionAvailable } from '../core/features'
import { removeSaved } from '../core/hash-list'
import { cleanKey, looksLikeKey, looksLikeVisionKey } from '../core/settings'
import { ProbeSection } from './ProbeSettings'
import type { PluginSettingsComponent } from '@valenced/plugins/types'
import type { ComponentProps } from 'react'
import type { Settings as SettingsData } from '../core/settings'

const { Stack, TableRow, TableRowGroup, TableSwitchRow, Text, TextInput } =
	Design

type SettingsProps = ComponentProps<
	PluginSettingsComponent<{ jsonStorage: SettingsData }>
>

interface KeyFieldProps {
	name: string
	value: string
	isValid(key: string): boolean
	onSave(key: string): void
	linkLabel: string
	linkNote: string
	onOpenLink(): void
}

function KeyField({
	name,
	value,
	isValid,
	onSave,
	linkLabel,
	linkNote,
	onOpenLink,
}: KeyFieldProps) {
	const [error, setError] = useState('')
	const [field, setField] = useState(0)

	const save = (input: string) => {
		const key = cleanKey(input)
		if (key && !isValid(key)) {
			setError(`That doesn't look like a ${name} key. Copy it again.`)
			return
		}
		setError('')
		onSave(key)
	}

	const clear = () => {
		setError('')
		onSave('')
		setField(current => current + 1)
		ToastActionCreators.open('RIS_KEY_CLEARED', { text: 'Key removed' })
	}

	return (
		<Stack spacing={8}>
			<TextInput
				key={field}
				label={`${name} API key`}
				placeholder="Paste your key"
				defaultValue={value}
				secureTextEntry
				status={error ? 'error' : 'default'}
				errorMessage={error || undefined}
				onChange={save}
			/>
			<Text variant="text-xs/normal" color="text-muted">
				Saved as plain text in this plugin's settings file. Other plugins may be
				able to read it.
			</Text>
			<TableRowGroup>
				<TableRow label={linkLabel} subLabel={linkNote} onPress={onOpenLink} />
				{value !== '' && <TableRow label="Remove key" onPress={clear} />}
			</TableRowGroup>
		</Stack>
	)
}

export default function Settings({ api: { plugin } }: SettingsProps) {
	const settings = useSettings()
	const hasKey = looksLikeKey(settings.saucenaoKey)
	const hasVisionKey = looksLikeVisionKey(settings.visionKey)

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
						{VisionAvailable && (
							<TableSwitchRow
								label="Google Vision"
								subLabel={
									hasVisionKey
										? 'Photos, memes, and screenshots. Key added.'
										: 'Photos, memes, and screenshots. Add your own key below to use it.'
								}
								value={settings.vision}
								onValueChange={(vision: boolean) => updateSettings({ vision })}
							/>
						)}
					</TableRowGroup>

					<KeyField
						name="SauceNAO"
						value={settings.saucenaoKey}
						isValid={looksLikeKey}
						onSave={saucenaoKey => updateSettings({ saucenaoKey })}
						linkLabel="Get a free key"
						linkNote="Opens SauceNAO's API page in your browser."
						onOpenLink={() => openKeyPage().catch(() => {})}
					/>

					{VisionAvailable && (
						<Stack spacing={8}>
							<KeyField
								name="Google Vision"
								value={settings.visionKey}
								isValid={looksLikeVisionKey}
								onSave={visionKey => updateSettings({ visionKey })}
								linkLabel="Set up Google Vision"
								linkNote="Opens Google Cloud in your browser."
								onOpenLink={() => openVisionKeyPage().catch(() => {})}
							/>
							<Text variant="text-xs/normal" color="text-muted">
								Needs a Google Cloud project with the Cloud Vision API and
								billing turned on. Each month, the first 1,000 web searches and
								1,000 text reads are free. After that, Google charges US$3.50
								and US$1.50 per 1,000.
							</Text>
							<TableRowGroup>
								<TableSwitchRow
									label="Read text in images"
									subLabel="Finds watermarks and handles. Uses one extra Vision unit per image."
									value={settings.visionText}
									onValueChange={(visionText: boolean) =>
										updateSettings({ visionText })
									}
								/>
							</TableRowGroup>
						</Stack>
					)}

					<TableRowGroup title="My list">
						{settings.hashList.length === 0 && (
							<TableRow
								label="No saved images"
								subLabel="Use Save to my list on any image."
							/>
						)}
						{settings.hashList.map(entry => (
							<TableRow
								key={entry.hash}
								label={entry.label}
								subLabel={`Saved ${dateText(entry.addedAt)}. Tap to remove.`}
								onPress={() =>
									updateSettings({
										hashList: removeSaved(settings.hashList, entry.hash),
									})
								}
							/>
						))}
					</TableRowGroup>

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
