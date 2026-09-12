// asc-client.mjs — headless, dependency-free App Store Connect API client.
//
// Single shared ES256 JWT signer + REST wrapper for the App Store Connect API.
// Uses only node:crypto + fetch (no npm dependencies).
//
// Why this exists: fastlane match requires an Apple-ID session cookie
// (non-headless, once-per-quarter). This path is fully headless using only the
// .p8 App Store Connect API key. Use it when you need programmatic ASC calls
// (create certs/profiles/devices, upload builds) without an interactive session.
//
// Credentials are supplied ONLY via environment variables — never hardcoded:
//   ASC_KEY_PATH   absolute path to AuthKey_<KEY_ID>.p8 (required)
//   ASC_ISSUER_ID  your App Store Connect issuer UUID (required)
//   ASC_KEY_ID     your key id (defaults to the AuthKey_<...> basename)

import { createSign, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { basename } from "node:path";

export const ASC_BASE = "https://api.appstoreconnect.apple.com";

export function base64Url(input) {
  return Buffer.from(input).toString("base64")
    .replace(/=+$/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

// ES256 produces a DER-encoded ECDSA signature (ASN.1 SEQUENCE of two INTEGERs).
// The JWT spec requires the raw r||s form (64 bytes for P-256). Convert.
function derSigToRaw(der) {
  if (der[0] !== 0x30) throw new Error("DER signature does not start with SEQUENCE");
  let offset = 2;
  if (der[1] & 0x80) offset += (der[1] & 0x7f);
  if (der[offset] !== 0x02) throw new Error("DER signature missing r INTEGER");
  offset += 1;
  const rLen = der[offset];
  offset += 1;
  let r = der.subarray(offset, offset + rLen);
  offset += rLen;
  if (der[offset] !== 0x02) throw new Error("DER signature missing s INTEGER");
  offset += 1;
  const sLen = der[offset];
  offset += 1;
  let s = der.subarray(offset, offset + sLen);
  while (r.length > 32 && r[0] === 0) r = r.subarray(1);
  while (s.length > 32 && s[0] === 0) s = s.subarray(1);
  if (r.length > 32 || s.length > 32) throw new Error("r/s length exceeds 32 bytes");
  const rPadded = Buffer.concat([Buffer.alloc(32 - r.length), r]);
  const sPadded = Buffer.concat([Buffer.alloc(32 - s.length), s]);
  return Buffer.concat([rPadded, sPadded]);
}

export async function signJwt({ keyPath, issuerId, keyId }) {
  const keyPem = await readFile(keyPath, "utf8");
  const header = { alg: "ES256", kid: keyId, typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: issuerId,
    iat: now,
    exp: now + 20 * 60,
    aud: "appstoreconnect-v1",
    nonce: randomUUID(),
  };
  const headerEnc = base64Url(JSON.stringify(header));
  const payloadEnc = base64Url(JSON.stringify(payload));
  const data = `${headerEnc}.${payloadEnc}`;
  const signer = createSign("SHA256");
  signer.update(data);
  signer.end();
  const rawSig = derSigToRaw(signer.sign(keyPem));
  return `${data}.${base64Url(rawSig)}`;
}

export async function ascRequest({ method, path, body, jwt, fetchImpl = fetch }) {
  const headers = {
    Authorization: `Bearer ${jwt}`,
    "Content-Type": "application/json",
    Accept: "application/json",
    "User-Agent": "asc-client/1.0",
  };
  const init = { method, headers };
  if (body !== undefined) init.body = body;
  const response = await fetchImpl(`${ASC_BASE}${path}`, init);
  const text = await response.text();
  let parsed = null;
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = { raw: text }; }
  return { status: response.status, ok: response.ok, body: parsed };
}

// Resolve the .p8 key path and the key id (from the AuthKey_<id> basename) purely
// from environment variables. No hardcoded credentials are read from the repo.
export function resolveAscCredentials(env = process.env) {
  const keyPath = env.ASC_KEY_PATH;
  if (!keyPath || !existsSync(keyPath)) {
    throw new Error("ASC_KEY_PATH must point to a readable AuthKey_<id>.p8 file");
  }
  const m = basename(keyPath).match(/^AuthKey_([A-Z0-9]+)\.p8$/);
  const keyId = env.ASC_KEY_ID || (m ? m[1] : null);
  if (!keyId) throw new Error("ASC_KEY_ID is required (or use an AuthKey_<id>.p8 filename)");
  const issuerId = env.ASC_ISSUER_ID;
  if (!issuerId) throw new Error("ASC_ISSUER_ID is required");
  return { keyPath, issuerId, keyId };
}
