import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripTypeScriptTypes } from 'node:module';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const output = join(root, 'dist');

await rm(output, { recursive: true, force: true });
await mkdir(join(output, 'src'), { recursive: true });
await Promise.all([
  cp(join(root, 'index.html'), join(output, 'index.html')),
  cp(join(root, 'styles.css'), join(output, 'styles.css')),
]);

for (const file of ['game.ts', 'persistence.ts', 'main.ts']) {
  const source = await readFile(join(root, 'src', file), 'utf8');
  const compiled = stripTypeScriptTypes(source, { mode: 'strip' })
    .replaceAll(".ts'", ".js'")
    .replaceAll('.ts"', '.js"');
  await writeFile(join(output, 'src', file.replace(/\.ts$/, '.js')), compiled);
}

console.log(`Built ${output}`);
