# Privacy

## In-app search

**trace.moe** gets the image bytes and your IP address when you tap **Search with trace.moe**. Its [terms](https://github.com/soruly/trace.moe-api/blob/1b64f4b8ceca8b9e3b4cbe7f6479603e61bff2b6/docs/terms.md) say it does not keep search images, and that IP addresses are logged. The upload carries no filename or Discord link.

**SauceNAO** gets the image bytes, your IP address, and your API key when you tap a search button that names it. The plugin doesn't claim SauceNAO deletes images, because its terms haven't been checked for that. The upload is named `image.jpg` (or the matching type) and carries no Discord link.

Both services see your IP address, as any website does. In the app, the first-search notice calls this "connection details" so it reads calmly. It means the same thing.

Each search sends the image only to the services named on the button. The first search with each service shows a one-time notice, and **Show first-search notices again** in settings brings them back.

Before upload, the plugin may ask Discord to renew an expired image link. That goes through Discord's own client, as normal traffic.

## Browser hand-offs

The engine you pick gets the image link, which can include the channel ID, attachment ID, filename, and a temporary signature.

An avatar or banner link includes that user's ID.

## Profile and AI checks

**Check Profile** reads the message author from Discord's own data on your phone. Account age comes from the user ID, so it needs no network call.

**Check AI tags** downloads the original file from Discord and reads its tags on your phone. Nothing goes to an outside service. It shows fixed labels only, and it skips EXIF, so GPS and location fields are never read.

**Open SynthID checker** opens Google's site in your browser. The plugin sends it nothing, and you choose whether to upload the image.

## My list

**Check my list** and **Save to my list** download a small copy of the image from Discord and work it out on your phone. Nothing goes to an outside service. A saved image is a fingerprint, a label, a date, and a small picture, stored as plain text in this plugin's settings file. Other plugins may be able to read it. Settings lets you remove any entry.

Profile pictures and banners check your list by themselves once it has entries, which only contacts Discord.

## Community list

The community list updates by itself at most once a day, and **Update community list** does it on demand. It's a signed list from `raw.githubusercontent.com`, so GitHub sees your IP address. The list holds fingerprints, categories, and report counts, never pictures or names.

**Report to community list** opens GitHub in your browser with the image's fingerprint filled in. Nothing is sent until you submit it. The issue is public and shows your GitHub account. Every report needs Sensei's approval before it joins the list.

## Check Links

**Check Links** reads the links in a message and checks them on your phone. Your links aren't sent anywhere. To do that, the plugin downloads a public scam domain list from `raw.githubusercontent.com`, so GitHub sees your IP address.

## Device probe

Dev builds keep version numbers, sheet keys, and field names in memory, including the field names of user records. They never read field values, and the report clears on reload.

## API keys

Your SauceNAO key is stored as plain text in this plugin's settings file on your phone. Other plugins may be able to read it, because plugins share Discord's process. The key is only ever sent to `saucenao.com`, and is never logged.

## Parked: Google Vision

Google Vision is built but hidden, and the plugin doesn't contact it. If it comes back, Google would get the image bytes, your IP address, and your API key when you tap a button that names it, and Vision would charge your Google Cloud account past the free tier.

## Planned network hosts

These hosts are for later phases and aren't contacted yet. This list is updated before any phase ships.

| Phase | Host | What it receives |
| --- | --- | --- |

The plugin never reads or shows GPS or location fields.
