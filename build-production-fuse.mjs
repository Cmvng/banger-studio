import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('./', import.meta.url);
const base = await readFile(new URL('./fuse-base-current.html', root), 'utf8');
const pack = await readFile(new URL('./creative-pack-v5.js', root), 'utf8');
const packV7 = await readFile(new URL('./creative-pack-v7.js', root), 'utf8');
const geometry = await readFile(new URL('./builder-geometry-v6.js', root), 'utf8');
const enhancement = await readFile(new URL('./studio-enhancements.js', root), 'utf8');
if (!base.includes("fetch('/compose'")) throw new Error('Native writer shell is missing.');
if (base.includes('ENH_VERSION')) throw new Error('The base unexpectedly contains an older enhancement.');
const output = base.trimEnd() + '\n<script>\n' + pack + '\n</script>\n<script>\n' + packV7 + '\n</script>\n<script>\n' + geometry + '\n</script>\n<script>\n' + enhancement + '\n</script>\n';
await writeFile(new URL('./fuse-v5.html', root), output, 'utf8');
process.stdout.write('fuse-v5.html ' + output.length + ' bytes\n');
