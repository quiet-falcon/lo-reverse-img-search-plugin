import { DownloadTimeoutMs } from '../core/limits'
import {
	MaxPhishingBytes,
	PhishingListHost,
	PhishingListUrl,
	parseDomainList,
} from '../core/link-risk'
import { sendRequest } from './http'

const CacheMs = 3 * 60 * 60 * 1000

let cached: { list: Set<string>; at: number } | undefined

// Only asks GitHub for the list, so your message's links stay on the phone
export async function loadPhishingList(now = Date.now()) {
	if (cached && now - cached.at < CacheMs) return cached.list

	const response = await sendRequest({
		method: 'GET',
		url: PhishingListUrl,
		allowedHosts: [PhishingListHost],
		maxBytes: MaxPhishingBytes,
		timeoutMs: DownloadTimeoutMs,
	}).promise
	if (response.kind === 'error' || response.status !== 200 || !response.text)
		return cached?.list

	cached = { list: parseDomainList(response.text), at: now }
	return cached.list
}

export function clearPhishingList() {
	cached = undefined
}
