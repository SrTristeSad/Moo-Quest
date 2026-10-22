# al007ex reference modules — Apache License 2.0

Upstream repository: https://github.com/al007ex/moomoo-clone
Pinned revision: `06f7c1ca965a7628671676c8d9a7efd3997bb5e7`

Copied verbatim from the original Apache-2.0 repository:
- `src/vendor/al007ex/effects.js` from `server/src/moomoo/modules/effects.js`
- `src/vendor/al007ex/utils.js` from `server/src/moomoo/libs/utils.js`
- `src/vendor/al007ex/filterchat.js` from `server/src/moomoo/libs/filterchat.js` (unmodified, depends on `bad-words`, same major version as upstream)
- `src/vendor/al007ex/nameFilter.js` from `server/src/moomoo/libs/nameFilter.js` (unmodified, depends on `bad-words`)
- `src/vendor/al007ex/LICENSE` is the upstream license.

Moo-Quest modifications are **not** made inside the copied modules.
`src/reference-bridge.js` adapts equipment representation and
`src/world.js` connects their calculations to the independent V2 engine.
Upstream copyright/attribution and license rights remain intact.

**Not included:** official FRVR client, art, authentication bypass,
anti-tamper code, original browser bundles, or non-licensed assets.

The signed release publisher and privileged ZIP installer include the license
file along with the vendor modules. The standalone runtime audit allows this
single non-executable license path only, and rejects other imported assets.

The game server now also executes the original `filter_chat` while relaying
game chat. The original team's map ping privacy rule is restored with
an independent rate-limit. Social/friendship services are adapted separately
to the V2 account database.

The initial change integrated equipment/harvest/physics behavior only. It is
NOT a drop-in replacement for the upstream Game class, APIs, database,
anti-cheat, network layer, or social services.
