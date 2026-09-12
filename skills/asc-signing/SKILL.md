---
name: asc-signing
description: Headless App Store Connect ES256 JWT signing and REST requests using only a .p8 API key. Use when you need programmatic ASC calls (create certs/profiles/devices, read state) without an interactive Apple-ID session cookie. Requires ASC_KEY_PATH + ASC_ISSUER_ID env vars.
---

# asc-signing

Install:

```bash
npx skills add edoworks/asc-client --skill asc-signing
```

Use only when the task needs App Store Connect API access and fastlane match's
interactive Apple-ID session is not available (CI, build bots, agent pipelines).

Environment (never committed; read at call time from env):

```
ASC_KEY_PATH=/abs/path/AuthKey_XXXXXXXXXX.p8
ASC_ISSUER_ID=<your issuer UUID>
ASC_KEY_ID=<key id, optional if filename is AuthKey_<id>.p8>
```

Sign a JWT and make a request:

```js
import { signJwt, ascRequest, resolveAscCredentials } from "asc-client/asc-client.mjs";
const creds = resolveAscCredentials();
const jwt = await signJwt(creds);
const { status, ok, body } = await ascRequest({ method: "GET", path: "/v1/apps", jwt });
```

Security rules:
- Never log the .p8 contents or the JWT.
- Never derive the key id from a revoked ambient env var; resolve from the filename.
- The key file must be readable only by the owner (mode 0400).
- This skill performs no network egress beyond api.appstoreconnect.apple.com.
