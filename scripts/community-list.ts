// Builds the signed community list, and turns report issues into entries.
import { createHash, createPrivateKey, sign } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

export type Entry = [hash: string, category: string, reports: number]

const HashRe = /^hash:\s*([0-9a-f]{64})\s*$/m
const CategoryRe = /^category:\s*(scam-image|stolen-photo|impersonation)\s*$/m
const EntriesPath = 'blocklist/entries.json'

// Issue text is untrusted, so only exact lines are ever accepted
export function parseReport(body: string) {
	const hash = HashRe.exec(body)?.[1]
	const category = CategoryRe.exec(body)?.[1]

	return hash && category ? { hash, category } : undefined
}

export function addReport(
	entries: Entry[],
	{ hash, category }: { hash: string; category: string },
): Entry[] {
	const existing = entries.find(entry => entry[0] === hash)
	if (existing) {
		existing[2]++
		return entries
	}

	return [...entries, [hash, category, 1]]
}

export function buildList(entries: Entry[], version: number, keyPem: string) {
	const list = JSON.stringify(entries)
	const sha256 = createHash('sha256').update(list).digest('hex')
	const count = entries.length
	const message = `ris-community-list:${version}:${count}:${sha256}`
	const signature = sign(
		null,
		Buffer.from(message),
		createPrivateKey(keyPem),
	).toString('hex')

	return {
		list,
		manifest: JSON.stringify({ version, count, sha256, signature }),
	}
}

const readEntriesFile = () =>
	JSON.parse(readFileSync(EntriesPath, 'utf8')) as Entry[]

if (import.meta.main) {
	const [command, output] = process.argv.slice(2)

	if (command === 'build' && output) {
		const key = process.env.BLOCKLIST_SIGNING_KEY
		if (!key) throw new Error('BLOCKLIST_SIGNING_KEY is not set')

		const { list, manifest } = buildList(
			readEntriesFile(),
			Math.floor(Date.now() / 1000),
			key,
		)
		mkdirSync(output, { recursive: true })
		writeFileSync(`${output}/list.json`, list)
		writeFileSync(`${output}/manifest.json`, manifest)
	} else if (command === 'intake') {
		const report = parseReport(process.env.ISSUE_BODY ?? '')
		if (!report) {
			console.log('No valid report')
			process.exit(78)
		}

		const entries = addReport(readEntriesFile(), report)
		writeFileSync(EntriesPath, `${JSON.stringify(entries, null, '\t')}\n`)
	} else {
		throw new Error('Use: build <folder> or intake')
	}
}
