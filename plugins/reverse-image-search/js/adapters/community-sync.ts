import {
	asciiText,
	fromHex,
	ListBaseUrl,
	ListHost,
	ListPublicKey,
	MaxListBytes,
	manifestMessage,
	readEntries,
	readManifest,
} from '../core/community-list'
import { verifyEd25519 } from '../core/ed25519'
import { DownloadTimeoutMs, MaxResponseBytes } from '../core/limits'
import { ascii } from '../core/multipart'
import { sha256 } from '../core/sha256'
import { sendRequest } from './http'
import type { CommunityList } from '../core/community-list'

export type SyncOutcome =
	| { kind: 'updated'; list: CommunityList }
	| { kind: 'current' }
	| { kind: 'tampered' }
	| { kind: 'failed' }

const request = (name: string, maxBytes: number, binary: boolean) =>
	sendRequest({
		method: 'GET',
		url: `${ListBaseUrl}${name}`,
		allowedHosts: [ListHost],
		maxBytes,
		timeoutMs: DownloadTimeoutMs,
		binary,
	}).promise

// Nothing is stored unless the signature and the file hash both check out
export async function syncCommunityList(
	current: number,
	publicKey = ListPublicKey,
): Promise<SyncOutcome> {
	const manifestResponse = await request(
		'manifest.json',
		MaxResponseBytes,
		false,
	)
	if (manifestResponse.kind === 'error' || manifestResponse.status !== 200)
		return { kind: 'failed' }

	const manifest = readManifest(manifestResponse.text ?? '')
	if (!manifest) return { kind: 'tampered' }
	if (
		!verifyEd25519(
			fromHex(manifest.signature),
			ascii(manifestMessage(manifest)),
			fromHex(publicKey),
		)
	)
		return { kind: 'tampered' }

	// An older list could be an attacker replaying a stale copy
	if (manifest.version <= current) return { kind: 'current' }

	const listResponse = await request('list.json', MaxListBytes, true)
	if (
		listResponse.kind === 'error' ||
		listResponse.status !== 200 ||
		!listResponse.bytes
	)
		return { kind: 'failed' }
	if (sha256(listResponse.bytes) !== manifest.sha256)
		return { kind: 'tampered' }

	const entries = readEntries(asciiText(listResponse.bytes))
	if (!entries || entries.length !== manifest.count) return { kind: 'tampered' }

	return { kind: 'updated', list: { version: manifest.version, entries } }
}
