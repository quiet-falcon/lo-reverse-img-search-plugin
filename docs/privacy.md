# Privacy

## In-app search

**trace.moe** gets the image bytes and your IP address when you tap **Search with trace.moe**. Its [terms](https://github.com/soruly/trace.moe-api/blob/1b64f4b8ceca8b9e3b4cbe7f6479603e61bff2b6/docs/terms.md) say it does not keep search images, and that IP addresses are logged. The upload carries no filename or Discord link.

**SauceNAO** gets the image bytes, your IP address, and your API key when you tap a search button that names it. The plugin doesn't claim SauceNAO deletes images, because its terms haven't been checked for that. The upload is named `image.jpg` (or the matching type) and carries no Discord link.

Both services see your IP address, as any website does. In the app, the first-search notice calls this "connection details" so it reads calmly. It means the same thing.

Each search sends the image only to the services named on the button. The first search with each service shows a one-time notice, and **Show first-search notices again** in settings brings them back.

Before upload, the plugin may ask Discord to renew an expired image link. That goes through Discord's own client, as normal traffic.

## Browser hand-offs

The engine you pick gets the image link, which can include the channel ID, attachment ID, filename, and a temporary signature.

## Device probe

Dev builds keep version numbers, sheet keys, and field names in memory. They never read field values, and the report clears on reload.

## API keys

Your SauceNAO key is stored as plain text in this plugin's settings file on your phone. Other plugins may be able to read it, because plugins share Discord's process. The key is only ever sent to `saucenao.com`, and is never logged.

## Planned network hosts

These hosts are for later phases and aren't contacted yet. This list is updated before any phase ships.

| Phase | Host | What it receives |
| --- | --- | --- |
| P5 | `web.archive.org` | Addresses of pages Vision found, plus your IP address |
| P5 | `cdn.discordapp.com` | Avatar and banner requests, plus your IP address |
| P7 | `quiet-falcon.github.io` | A request for the community list, plus your IP address |
| P8 | RDAP services | Domains found in a message, plus your IP address |

The plugin never reads or shows GPS or location fields.
