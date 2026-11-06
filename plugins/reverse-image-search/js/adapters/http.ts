export interface HttpRequest {
	method: 'GET' | 'POST'
	url: string
	allowedHosts: string[]
	maxBytes: number
	timeoutMs: number
	headers?: Record<string, string>
	body?: Uint8Array
	binary?: boolean
}

export type HttpResult =
	| { kind: 'ok'; status: number; bytes?: Uint8Array; text?: string }
	| {
			kind: 'error'
			category: 'network' | 'timeout' | 'too-large' | 'blocked' | 'aborted'
	  }

export interface PendingRequest {
	promise: Promise<HttpResult>
	abort(): void
}

const HostRe = /^https:\/\/([^/?#:]+)(?::443)?(?:[/?#]|$)/i

export function hostOf(url: string) {
	return HostRe.exec(url)?.[1]?.toLowerCase()
}

const isAllowed = (url: string, hosts: string[]) => {
	const host = hostOf(url)
	return host !== undefined && hosts.includes(host)
}

// The only network path for downloads and provider calls
export function sendRequest(request: HttpRequest): PendingRequest {
	const xhr = new XMLHttpRequest()
	let settled = false
	let finish: (result: HttpResult) => void = () => {}

	const promise = new Promise<HttpResult>(resolve => {
		finish = result => {
			if (settled) return
			settled = true
			resolve(result)
		}
	})

	if (!isAllowed(request.url, request.allowedHosts)) {
		finish({ kind: 'error', category: 'blocked' })
		return { promise, abort() {} }
	}

	const fail = (
		category: 'network' | 'timeout' | 'too-large' | 'blocked' | 'aborted',
	) => {
		// Settle first, so the abort event can't relabel the failure
		finish({ kind: 'error', category })
		if (category === 'too-large' || category === 'blocked') xhr.abort()
	}

	xhr.open(request.method, request.url)
	xhr.withCredentials = false
	xhr.timeout = request.timeoutMs
	xhr.responseType = request.binary ? 'arraybuffer' : 'text'
	for (const [name, value] of Object.entries(request.headers ?? {}))
		xhr.setRequestHeader(name, value)

	xhr.onreadystatechange = () => {
		if (xhr.readyState !== 2) return

		const length = Number(xhr.getResponseHeader('Content-Length'))
		if (length > request.maxBytes) fail('too-large')
	}
	xhr.onprogress = event => {
		if (event.loaded > request.maxBytes) fail('too-large')
	}
	xhr.onload = () => {
		if (xhr.responseURL && !isAllowed(xhr.responseURL, request.allowedHosts))
			return fail('blocked')

		if (request.binary) {
			const buffer = xhr.response as ArrayBuffer | null
			const bytes = buffer ? new Uint8Array(buffer) : new Uint8Array()
			if (bytes.byteLength > request.maxBytes) return fail('too-large')
			return finish({ kind: 'ok', status: xhr.status, bytes })
		}

		const text = typeof xhr.response === 'string' ? xhr.response : ''
		if (text.length > request.maxBytes) return fail('too-large')
		finish({ kind: 'ok', status: xhr.status, text })
	}
	xhr.onerror = () => fail('network')
	xhr.ontimeout = () => fail('timeout')
	xhr.onabort = () => fail('aborted')

	xhr.send(request.body ?? null)

	return {
		promise,
		abort() {
			if (!settled) xhr.abort()
		},
	}
}
