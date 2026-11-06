import { encodeForHandoff } from '../core/signed-url'

export interface HandoffProvider {
	id: string
	name: string
	buildUrl(imageUrl: string): string
}

const prefixed = (
	id: string,
	name: string,
	prefix: string,
): HandoffProvider => ({
	id,
	name,
	buildUrl: imageUrl => prefix + encodeForHandoff(imageUrl),
})

export const HandoffProviders = [
	prefixed('lens', 'Google Lens', 'https://lens.google.com/uploadbyurl?url='),
	prefixed(
		'yandex',
		'Yandex',
		'https://yandex.com/images/search?rpt=imageview&url=',
	),
	prefixed(
		'bing',
		'Bing',
		'https://www.bing.com/images/search?view=detailv2&iss=sbi&q=imgurl:',
	),
	prefixed('tineye', 'TinEye', 'https://www.tineye.com/search?url='),
	prefixed('saucenao', 'SauceNAO', 'https://saucenao.com/search.php?url='),
	prefixed('iqdb', 'IQDB', 'https://iqdb.org/?url='),
	prefixed('tracemoe', 'trace.moe', 'https://trace.moe/?url='),
	prefixed('imgops', 'ImgOps', 'https://imgops.com/start?url='),
]
