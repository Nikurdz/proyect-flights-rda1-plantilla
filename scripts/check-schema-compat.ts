/**
 * Compares the event schemas in contracts/eventos with the ones at a git reference (default HEAD; CI passes the base
 * branch) and fails when a published schema changed in a way that breaks consumers. A breaking change must go in a
 * new `<type>.v<N+1>.schema.json` file instead of editing the one consumers already rely on.
 *
 *   npm run contract:events:check            # working tree vs HEAD
 *   npm run contract:events:check -- origin/main
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { bumpFor, compareSchemas, JsonSchemaLike } from '../src/modules/vuelos/common/schema-compat';

const DIR = 'contracts/eventos';
const ref = process.argv[2] ?? 'HEAD';

function git(...args: string[]): string | null {
  try {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return null;
  }
}

const published = (git('ls-tree', '--name-only', `${ref}:${DIR}/`) ?? '').split('\n').filter((f) => f.endsWith('.schema.json'));
if (git('rev-parse', '--verify', ref) === null) {
  console.error(`Unknown git reference: ${ref}`);
  process.exit(2);
}

let failures = 0;
const current = existsSync(DIR) ? readdirSync(DIR).filter((f) => f.endsWith('.schema.json')) : [];

for (const file of published) {
  if (!current.includes(file)) {
    console.error(`BREAKING  ${file}: a published schema was deleted (consumers may still use it)`);
    failures++;
  }
}

for (const file of current) {
  const before = git('show', `${ref}:${DIR}/${file}`);
  if (before === null) {
    console.log(`new       ${file}`);
    continue;
  }
  const report = compareSchemas(JSON.parse(before) as JsonSchemaLike, JSON.parse(readFileSync(join(DIR, file), 'utf8')) as JsonSchemaLike);
  const bump = bumpFor(report);
  if (!report.compatible) {
    failures++;
    console.error(`BREAKING  ${file} (${bump}): publish it as a new major version file`);
    for (const change of report.breaking) console.error(`            - ${change}`);
  } else if (report.additions.length) {
    console.log(`compatible ${file} (${bump})`);
    for (const change of report.additions) console.log(`            + ${change}`);
  }
}

console.log(failures ? `\n${failures} incompatible change(s) against ${ref}.` : `\nEvent schemas are compatible with ${ref}.`);
process.exit(failures ? 1 : 0);
