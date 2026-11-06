# Provider contracts

## trace.moe

Source: [trace.moe API docs](https://github.com/soruly/trace.moe-api/blob/1b64f4b8ceca8b9e3b4cbe7f6479603e61bff2b6/docs/docs.md).

Request:

```text
POST https://api.trace.moe/search?anilistInfo&cutBorders
Content-Type: image/jpeg
<raw image bytes>
```

Sanitised response shape:

```json
{
	"frameCount": 1,
	"error": "",
	"quota": 100,
	"quotaUsed": 1,
	"result": [
		{
			"anilist": {
				"id": 1,
				"title": { "native": "x", "romaji": "x", "english": null },
				"isAdult": false
			},
			"episode": 1,
			"at": 98.2,
			"similarity": 0.97
		}
	]
}
```

Status codes: 400 bad image, 402 quota or concurrency, 413 too large, 429 rate limited, 503 queue full.

A live call from the phone passed on 2026-11-06.

## SauceNAO

[C] Taken from [PicImageSearch](https://github.com/kitUIN/PicImageSearch/blob/784713e546273a09aae4b247a8b6f798825efafa/PicImageSearch/engines/saucenao.py) and its [response model](https://github.com/kitUIN/PicImageSearch/blob/784713e546273a09aae4b247a8b6f798825efafa/PicImageSearch/model/saucenao.py). Not yet confirmed by a live call.

Request:

```text
POST https://saucenao.com/search.php?output_type=2&numres=8&db=999&hide=0&api_key=<key>
Content-Type: multipart/form-data; boundary=<random>
field "file", filename "image.<ext>", the sniffed image type
```

The multipart body is built by hand, because React Native's `FormData` can't take raw bytes. [A, gate P3] SauceNAO accepts it from the phone.

Sanitised response shape:

```json
{
	"header": {
		"status": 0,
		"short_remaining": 3,
		"long_remaining": 149,
		"minimum_similarity": 50
	},
	"results": [
		{
			"header": {
				"similarity": "92.50",
				"index_name": "Index #5: Pixiv Images - 1_p0.jpg",
				"hidden": 0
			},
			"data": { "title": "x", "member_name": "x", "pixiv_id": 1, "ext_urls": ["https://x"] }
		}
	]
}
```

How the plugin reads it:

- Title from `title`, `eng_name`, `jp_name`, `material`, or `source`, then the site name.
- Author from `author`, `member_name`, `creator`, `author_name`, `artist`, `user_name`, `twitter_user_handle`, or `company`.
- Link from `pixiv_id`, then the first `https:` entry in `ext_urls` or `source`.
- `hidden` above 0 counts as adult and stays hidden. `hide=0` is sent, so filtering is local.
- Results below `minimum_similarity` are dropped.
- `long_remaining` is shown as searches left today.

Errors: a non-zero `header.status` or a non-200 response. Messages mentioning a daily limit map to quota, a key to bad key, a rate to rate limited, and an image or file to bad image. HTTP 403 is a bad key, 429 rate limited, 413 too large, and 5xx busy.
