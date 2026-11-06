import { getModules } from '@valenced/modules/finders'
import { withProps } from '@valenced/modules/finders/filters'

interface RefreshResponse {
	body?: {
		refreshed_urls?: { original?: string; refreshed?: string | null }[]
	}
}

interface HTTP {
	post(options: { url: string; body?: unknown }): Promise<RefreshResponse>
}

const FallbackRefreshEndpoint = '/attachments/refresh-urls'

let http: HTTP | undefined
let refreshEndpoint = FallbackRefreshEndpoint

export function watchDiscordModules() {
	const stops = [
		getModules(withProps<{ HTTP: HTTP }>('HTTP'), exports => {
			http = exports.HTTP
		}),
		getModules(
			withProps<{ Endpoints: { ATTACHMENTS_REFRESH_URLS?: string } }>(
				'Endpoints',
			),
			exports => {
				refreshEndpoint =
					exports.Endpoints.ATTACHMENTS_REFRESH_URLS ?? FallbackRefreshEndpoint
			},
		),
	]

	return () => {
		for (const stop of stops) stop()
		http = undefined
	}
}

// Goes through Discord's own client, so the plugin never touches the token
export async function refreshAttachmentUrl(url: string) {
	if (!http) return

	const response = await http.post({
		url: refreshEndpoint,
		body: { attachment_urls: [url] },
	})
	const refreshed = response?.body?.refreshed_urls?.find(
		item => item.original === url,
	)?.refreshed

	return typeof refreshed === 'string' ? refreshed : undefined
}
