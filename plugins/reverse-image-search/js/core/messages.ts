import type { SearchState } from './session'
import type {
	ErrorCategory,
	ProviderId,
	ProviderOutcome,
	ProviderResult,
	Tier,
} from './types'

export const ProviderNames: Record<ProviderId, string> = {
	tracemoe: 'trace.moe',
	saucenao: 'SauceNAO',
	vision: 'Google Vision',
}

export const ProviderUses: Record<ProviderId, string> = {
	tracemoe: 'anime screenshots',
	saucenao: 'art and manga',
	vision: 'photos, memes, and screenshots',
}

// Calm wording on purpose. docs/privacy.md has the full detail
export const ConsentNotices: Record<ProviderId, string> = {
	tracemoe:
		"trace.moe receives the image to find which anime it's from. Like any website, it also sees your connection details. trace.moe says it doesn't keep searched images.",
	saucenao:
		"SauceNAO receives the image to find the artwork's source. Like any website, it also sees your connection details.",
	vision:
		'Google Vision receives the image to find where it appears online and read any text in it. Like any website, it also sees your connection details. Searches use your own Google Cloud key.',
}

export function errorMessage(category: ErrorCategory, provider: string) {
	switch (category) {
		case 'quota':
			return `You've used today's free ${provider} searches. Try again tomorrow, or use a browser button.`
		case 'rate-limited':
			return `${provider} is limiting requests. Wait a minute, then try again.`
		case 'too-large':
			return 'This image is too big to search. Try a browser button instead.'
		case 'busy':
			return `${provider} is busy right now. Try again in a few minutes.`
		case 'bad-image':
			return "This file isn't an image the plugin can read. Try a browser button instead."
		case 'network':
			return "Couldn't reach the internet. Check your connection, then try again."
		case 'timeout':
			return 'The search took too long. Try again.'
		case 'refresh-failed':
			return "Discord couldn't renew this image's link. Reopen the message, then try again."
		case 'bad-key':
			return `${provider} didn't accept your API key. Check it in plugin settings.`
		case 'needs-setup':
			return `${provider} isn't set up for this key. In Google Cloud, turn on the Cloud Vision API and billing, then try again.`
		default:
			return 'Something went wrong. Try again, or use a browser button.'
	}
}

export const StateMessages: Partial<Record<SearchState, string>> = {
	refreshing: 'Renewing the image link…',
	downloading: 'Getting the image…',
	searching: 'Searching…',
}

export const TierLabels: Record<Tier, string> = {
	exact: 'Exact match',
	strong: 'Strong match',
	possible: 'Possible match',
}

export function joinNames(ids: ProviderId[]) {
	const names = ids.map(id => ProviderNames[id])
	if (names.length < 2) return names.join('')
	return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`
}

export function visibleResults(results: ProviderResult[], showWeak = false) {
	const safe = results.filter(result => !result.adult)
	const strong = safe.filter(result => result.tier !== 'possible')
	const shown = showWeak ? safe : strong

	return {
		shown,
		hidden: results.length - shown.length,
		weak: safe.length - strong.length,
		adult: results.length - safe.length,
	}
}

export function hiddenSummary(weak: number, adult: number, showWeak: boolean) {
	const parts = [
		!showWeak && weak ? `${weak} weaker` : '',
		adult ? `${adult} adult` : '',
	].filter(Boolean)

	return parts.length ? `${parts.join(' and ')} hidden.` : ''
}

// One line per provider, so a failure never hides behind another's results
export function providerStatus(id: ProviderId, outcome: ProviderOutcome) {
	const name = ProviderNames[id]
	if (outcome.kind === 'error')
		return `${name}: ${errorMessage(outcome.category, name)}`

	const confident = outcome.results.filter(
		result => result.tier !== 'possible' && !result.adult,
	).length
	const found =
		confident === 0
			? 'no confident match'
			: `${confident} ${confident === 1 ? 'match' : 'matches'}`
	const quota =
		outcome.quotaLeft === undefined
			? ''
			: `, ${outcome.quotaLeft} free searches left today`

	return `${name}: ${found}${quota}.`
}

export const percent = (similarity: number) =>
	`${(similarity * 100).toFixed(1)}%`

// Vision gives no score, so showing 0% would mislead
export const matchLabel = (result: ProviderResult) =>
	result.noScore
		? TierLabels[result.tier]
		: `${TierLabels[result.tier]}, ${percent(result.similarity)}`

export const noMatchHint = (ids: ProviderId[]) =>
	ids.includes('vision')
		? 'No confident match. Try a browser button for a second opinion.'
		: 'No confident match. trace.moe only knows anime episodes, and SauceNAO mostly knows art and manga. Try a browser button for photos and memes.'
