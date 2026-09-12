#!/usr/bin/env node
// asc-cli.mjs — minimal CLI wrapper around asc-client.mjs.
// Usage:
//   ASC_KEY_PATH=/path/AuthKey_XXXXXXXXXX.p8 ASC_ISSUER_ID=<uuid> \
//     node asc-cli.mjs request --method GET --path /v1/apps
import { signJwt, ascRequest, resolveAscCredentials } from "./asc-client.mjs";

function parseArgs(argv) {
  const args = { command: null };
  for (let i = 2; i < argv.length; i += 1) {
    const flag = argv[i];
    const value = argv[i + 1];
    switch (flag) {
      case "--method": args.method = value; i += 1; break;
      case "--path": args.path = value; i += 1; break;
      case "--body": args.body = value; i += 1; break;
      case "-h": case "--help":
        process.stdout.write("Usage: node asc-cli.mjs request --method <M> --path <P> [--body <json>]\n");
        process.exit(0);
      default:
        if (!args.command && !flag.startsWith("--")) args.command = flag;
        else throw new Error(`unknown flag ${flag}`);
    }
  }
  return args;
}

const args = parseArgs(process.argv);
if (args.command !== "request") throw new Error("only 'request' is supported");
if (!args.method || !args.path) throw new Error("--method and --path are required");

const creds = resolveAscCredentials();
const jwt = await signJwt(creds);
const result = await ascRequest({ method: args.method, path: args.path, body: args.body, jwt });
process.stdout.write(`${JSON.stringify({ status: result.status, ok: result.ok, body: result.body }, null, 2)}\n`);
if (!result.ok) process.exit(1);
