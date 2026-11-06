# Privacy

## In-app search

**trace.moe** gets the image bytes and your IP address when you tap **Search with trace.moe**. Its [terms](https://github.com/soruly/trace.moe-api/blob/1b64f4b8ceca8b9e3b4cbe7f6479603e61bff2b6/docs/terms.md) say it does not keep search images, and that IP addresses are logged. The upload carries no filename or Discord link.

Before upload, the plugin may ask Discord to renew an expired image link. That goes through Discord's own client, as normal traffic.

## Browser hand-offs

The engine you pick gets the image link, which can include the channel ID, attachment ID, filename, and a temporary signature.

## Device probe

Dev builds keep version numbers, sheet keys, and field names in memory. They never read field values, and the report clears on reload.
