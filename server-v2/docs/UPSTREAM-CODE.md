# al007ex reference modules — Apache License 2.0

Upstream repository: https://github.com/al007ex/moomoo-clone
Pinned revision: `06f7c1ca965a7628671676c8d9a7efd3997bb5e7`

Copied verbatim from the original Apache-2.0 repository:
- `src/vendor/al007ex/effects.js` from `server/src/moomoo/modules/effects.js`
- `src/vendor/al007ex/utils.js` from `server/src/moomoo/libs/utils.js`
- `src/vendor/al007ex/LICENSE` is the upstream license.

Moo-Quest modifications are **not** made inside the copied modules.
`src/reference-bridge.js` adapts equipment representation and
`src/world.js` connects their calculations to the independent V2 engine.
Upstream copyright/attribution and license rights remain intact.

**Not included:** official FRVR client, art, authentication bypass,
anti-tamper code, original browser bundles, or non-licensed assets.

This change integrates equipment/harvest/physics behavior only. It is
NOT a drop-in replacement for the upstream Game class, APIs, database,
anti-cheat, network layer, or social services.
