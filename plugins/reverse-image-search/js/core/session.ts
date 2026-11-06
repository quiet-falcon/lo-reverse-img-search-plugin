export type SearchState =
	| 'idle'
	| 'refreshing'
	| 'downloading'
	| 'searching'
	| 'done'
	| 'failed'
	| 'cancelled'

export interface SearchSession {
	begin(): number | undefined
	isCurrent(token: number): boolean
	finish(token: number): void
	cancel(): void
	isActive(): boolean
	onCancel(abort: () => void): void
}

// One search at a time, and late callbacks from an old search do nothing
export function createSearchSession(): SearchSession {
	let generation = 0
	let active = false
	let aborts: (() => void)[] = []

	const runAborts = () => {
		const pending = aborts
		aborts = []
		for (const abort of pending) {
			try {
				abort()
			} catch {
				// Already finished
			}
		}
	}

	return {
		begin() {
			if (active) return
			active = true
			return ++generation
		},
		isCurrent: token => active && token === generation,
		finish(token) {
			if (token !== generation) return
			active = false
			aborts = []
		},
		cancel() {
			if (!active) return
			active = false
			generation++
			runAborts()
		},
		isActive: () => active,
		onCancel(abort) {
			if (active) aborts.push(abort)
		},
	}
}
