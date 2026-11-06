import type { SearchState } from './session'
import type { ErrorCategory, ProviderResult, Tier } from './types'

export const ErrorMessages: Record<ErrorCategory, string> = {
	quota:
		"You've used today's free trace.moe searches. Try again tomorrow, or use the browser buttons.",
	'rate-limited':
		'trace.moe is limiting requests. Wait a minute, then try again.',
	'too-large': 'This image is too big to search. Try a browser button instead.',
	busy: 'trace.moe is busy right now. Try again in a few minutes.',
	'bad-image':
		"This file isn't an image the plugin can read. Try a browser button instead.",
	network:
		"Couldn't reach the internet. Check your connection, then try again.",
	timeout: 'The search took too long. Try again.',
	'refresh-failed':
		"Discord couldn't renew this image's link. Reopen the message, then try again.",
	unexpected: 'Something went wrong. Try again, or use a browser button.',
}

export const StateMessages: Partial<Record<SearchState, string>> = {
	refreshing: 'Renewing the image link…',
	downloading: 'Getting the image…',
	searching: 'Searching trace.moe…',
}

export const TierLabels: Record<Tier, string> = {
	exact: 'Exact match',
	strong: 'Strong match',
	possible: 'Possible match',
}

export function visibleResults(results: ProviderResult[]) {
	const shown = results.filter(
		result => result.tier !== 'possible' && !result.adult,
	)

	return { shown, hidden: results.length - shown.length }
}

export const percent = (similarity: number) =>
	`${(similarity * 100).toFixed(1)}%`
