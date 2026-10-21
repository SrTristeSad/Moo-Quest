# Reconstructed Node server source bundled with Moo-Quest

Source: https://github.com/al007ex/moomoo-clone
Frozen upstream commit: 06f7c1ca965a7628671676c8d9a7efd3997bb5e7
License: root LICENSE (Apache-2.0) copied to
licenses/upstream-server-APACHE-2.0.txt. Original server/package.json
and attribution information are also preserved.

Imported only server/src, server/package.json, and shared.
No official client code, its downloaded proprietary assets, local
accounts, generated protocol-build.json, or binary data were copied.

Moo-Quest changes: server/src/anticheat/config.js is our LOCAL-ONLY
substitute for the unpublished upstream file; shared/config.js changes
inSandbox true -> false and unlimitedResources true -> false. These
restore normal resource gathering from zero, rather than giving each
player 1,000,000 on spawn. All other reconstructed server gameplay code
is unchanged at import time.

Install: npm install --omit=dev
Run: npm run start:server
Account and build state are saved under server/data/ (gitignored).
Authentication API is an insecure LOCAL TEST emulator; never publish
this server on the public Internet without replacing that subsystem.
