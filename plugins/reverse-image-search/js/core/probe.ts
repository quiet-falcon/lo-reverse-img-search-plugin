export interface ProbeInfo {
	pluginVersion: string
	discordVersion: string
	discordBuild: string
	releaseChannel: string
	androidSdk: string
	bridge: string
}

export type ProbeGroup =
	| 'message'
	| 'attachment'
	| 'embed'
	| 'embedImage'
	| 'viewerProps'
	| 'viewerSource'

export interface ProbeState {
	entryPoints: Record<string, string>
	fields: Partial<Record<ProbeGroup, string[]>>
	sheetKeys: string[]
	errors: string[]
}

const MaxNames = 80
const MaxNameLength = 60
const MaxSheetKeys = 40
const MaxErrors = 10

export function createProbeState(): ProbeState {
	return { entryPoints: {}, fields: {}, sheetKeys: [], errors: [] }
}

// Sheet keys and map-like records can embed IDs, so digit runs never leave here
export function sanitiseName(name: string) {
	return name.replace(/\d{5,}/g, '#').slice(0, MaxNameLength)
}

// Names only. Values must never be read, because they hold signed URLs
export function fieldNames(value: unknown) {
	if (typeof value !== 'object' || value === null || Array.isArray(value))
		return []

	return [...new Set(Object.keys(value).map(sanitiseName))]
		.sort()
		.slice(0, MaxNames)
}

export function recordFields(
	state: ProbeState,
	group: ProbeGroup,
	value: unknown,
) {
	const names = fieldNames(value)
	if (!names.length) return

	state.fields[group] = [...new Set([...(state.fields[group] ?? []), ...names])]
		.sort()
		.slice(0, MaxNames)
}

export function recordSheetKey(state: ProbeState, key: unknown) {
	if (typeof key !== 'string' || state.sheetKeys.length >= MaxSheetKeys) return

	const name = sanitiseName(key)
	if (!state.sheetKeys.includes(name)) state.sheetKeys.push(name)
}

export function recordError(state: ProbeState, stage: string) {
	if (state.errors.length < MaxErrors) state.errors.push(sanitiseName(stage))
}

export function formatReport(state: ProbeState, info: ProbeInfo) {
	const entryPoints = Object.entries(state.entryPoints)
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([name, status]) => `${name}: ${status}`)
	const fields = Object.entries(state.fields)
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([group, names]) => `${group}: ${names?.join(', ')}`)

	return [
		'RIS P0 probe report',
		`Plugin: ${info.pluginVersion}`,
		`Discord: ${info.discordVersion} (${info.discordBuild}, ${info.releaseChannel})`,
		`Android SDK: ${info.androidSdk}`,
		`Bridge: ${info.bridge}`,
		'',
		'Entry points',
		...(entryPoints.length ? entryPoints : ['none seen']),
		'',
		'Sheet keys',
		...(state.sheetKeys.length ? state.sheetKeys : ['none seen']),
		'',
		'Field names',
		...(fields.length ? fields : ['none seen']),
		'',
		'Errors',
		...(state.errors.length ? state.errors : ['none']),
	].join('\n')
}
