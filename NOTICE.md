# Notices

- Build tooling, workflows, and Gradle files come from [Valenced/valenced-plugin-template](https://github.com/Valenced/valenced-plugin-template) at `9a4f9187137a75d86fe552d0e594889a6e6fd7e5`, under GPL-3.0.
- `findRenderTarget` in `plugins/reverse-image-search/js/adapters/probe.ts` follows the export handling described in [Pop Out Player](https://github.com/bleelblep/bleel-bazinga-repo/blob/b3dc168208e6de58027af420f5fbb4d730681ce5/plugins/pocket-browser/js/popout/viewerButton.tsx). No code was copied.
- The action sheet tree search in `plugins/reverse-image-search/js/core/tree.ts` is adapted from [Message Logger](https://github.com/Valenced/valenced-community-plugins/blob/ef8f4ff782033ade38aa555b751dfb8e2350ad31/plugins/message-logger/js/actionsheet.tsx), under GPL-3.0.
- `core/pdq.ts` is a TypeScript version of the PDQ hash from [facebook/ThreatExchange](https://github.com/facebook/ThreatExchange/tree/a9a36d4552875c385c4b40f2be847db2b613ed44/pdq/cpp), used under the BSD licence below. Its median step follows Torben Mogensen's public-domain algorithm.

## ThreatExchange licence

```text
BSD License

For ThreatExchange software

Copyright (c) Meta Platforms, Inc. and affiliates.

Redistribution and use in source and binary forms, with or without modification,
are permitted provided that the following conditions are met:

 * Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.

 * Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

 * Neither the name Facebook nor the names of its contributors may be used to
   endorse or promote products derived from this software without specific
   prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR
ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```
