# asc-client

Headless, dependency-free App Store Connect (ASC) API client in pure Node.js.

## Why this exists

`fastlane match` and many ASC automations require an Apple-ID session cookie that
is interactive (a Safari sign-in) and expires — a poor fit for headless CI, build
bots, or agent-driven pipelines. The App Store Connect REST API accepts ES256 JWTs
signed with an `.p8` API key with no session cookie. This library is the minimal
surface to use that: ES256 JWT signing + a thin `fetch` wrapper. ~100 LoC, zero
npm dependencies.

## Security

- Credentials are read **only from environment variables** and your `.p8` file path.
- The `.p8` private key is never logged, never written to any repo artifact, never
  embedded in source. It is read at call time from `ASC_KEY_PATH` (mode 0400
  recommended).
- Nothing is hardcoded: key id, issuer id, and key path are all env-supplied.

## Usage

Environment:

```
ASC_KEY_PATH=/abs/path/AuthKey_XXXXXXXXXX.p8   # your .p8 key (required)
ASC_ISSUER_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx  # your issuer UUID (required)
ASC_KEY_ID=XXXXXXXXXX                          # optional; derived from filename
```

Programmatic:

```js
import { signJwt, ascRequest, resolveAscCredentials } from "./asc-client.mjs";

const creds = resolveAscCredentials();
const jwt = await signJwt(creds);
const { status, ok, body } = await ascRequest({ method: "GET", path: "/v1/apps", jwt });
```

CLI:

```bash
ASC_KEY_PATH=./AuthKey_XXXXXXXXXX.p8 ASC_ISSUER_ID=<uuid> \
  node asc-cli.mjs request --method GET --path "/v1/apps?limit=5"
```

## Scope

Intentionally minimal: ES256 signing + request. If you need more than a handful
of endpoints or a rich object model, prefer a maintained SDK. This is for the
headless, no-session-cookie cases.

## License

MIT — see `LICENSE`.
