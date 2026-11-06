import { encodeForHandoff } from '../core/signed-url'

export interface HandoffProvider {
	id: string
	name: string
	note: string
	// Set from device results, for engines that reject Discord's preview link
	prefersOriginal?: boolean
	buildUrl(imageUrl: string): string
}

const prefixed = (
	id: string,
	name: string,
	note: string,
	prefix: string,
	{ prefersOriginal = false, suffix = '' } = {},
): HandoffProvider => ({
	id,
	name,
	note,
	prefersOriginal,
	buildUrl: imageUrl => prefix + encodeForHandoff(imageUrl) + suffix,
})

export const HandoffProviders = [
	prefixed(
		'lens',
		'Google Lens',
		'Objects, places, and products',
		'https://lens.google.com/uploadbyurl?url=',
	),
	prefixed(
		'yandex',
		'Yandex',
		'Photos and people',
		'https://yandex.com/images/search?rpt=imageview&url=',
	),
	prefixed(
		'bing',
		'Bing',
		'A second opinion',
		'https://www.bing.com/images/search?view=detailv2&iss=sbi&q=imgurl:',
	),
	prefixed(
		'tineye',
		'TinEye',
		'See total and oldest copy',
		'https://www.tineye.com/search?url=',
		{ suffix: '&sort=crawl_date&order=asc' },
	),
	prefixed(
		'saucenao',
		'SauceNAO',
		'Art and manga',
		'https://saucenao.com/search.php?url=',
	),
	prefixed('iqdb', 'IQDB', 'Anime art', 'https://iqdb.org/?url='),
	prefixed(
		'tracemoe',
		'trace.moe',
		'Anime episodes',
		'https://trace.moe/?url=',
		{ prefersOriginal: true },
	),
	prefixed(
		'imgops',
		'ImgOps',
		'More image tools',
		'https://imgops.com/start?url=',
	),
]
