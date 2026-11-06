const DiscordEpochMs = 1420070400000
const TimestampDivisor = 4194304
const DayMs = 86_400_000
const IdRe = /^\d{15,21}$/
const Months = [
	'Jan',
	'Feb',
	'Mar',
	'Apr',
	'May',
	'Jun',
	'Jul',
	'Aug',
	'Sep',
	'Oct',
	'Nov',
	'Dec',
]

// Dividing avoids BigInt, and the rounding is far smaller than a second
export function createdAt(id: unknown) {
	if (typeof id !== 'string' || !IdRe.test(id)) return

	return Math.floor(Number(id) / TimestampDivisor) + DiscordEpochMs
}

export const ageInDays = (createdMs: number, now: number) =>
	Math.max(0, Math.floor((now - createdMs) / DayMs))

export function ageText(days: number) {
	if (days < 1) return 'less than a day'
	if (days < 60) return unit(days, 'day')
	if (days < 730) return unit(Math.floor(days / 30.44), 'month')
	return unit(Math.floor(days / 365.25), 'year')
}

export function dateText(ms: number) {
	const date = new Date(ms)
	const month = Months[date.getUTCMonth()]

	return `${date.getUTCDate()} ${month} ${date.getUTCFullYear()}`
}

const unit = (count: number, name: string) =>
	`${count} ${name}${count === 1 ? '' : 's'}`
