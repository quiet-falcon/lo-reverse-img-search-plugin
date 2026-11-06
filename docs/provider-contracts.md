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

No live call has been recorded from the phone yet.
