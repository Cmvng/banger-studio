import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const target = process.argv[2] || '../preview-v5.html';
const html = await readFile(new URL(target, import.meta.url), 'utf8');
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(match => match[1]);
const failures = [];
scripts.forEach((source, index) => {
  try { new vm.Script(source, {filename:'inline-script-' + (index + 1) + '.js'}); }
  catch (error) { failures.push({index:index + 1,message:error.message,stack:error.stack}); }
});
if (failures.length) {
  process.stderr.write(JSON.stringify({scripts:scripts.length,failures}, null, 2) + '\n');
  process.exitCode = 1;
} else {
  process.stdout.write(JSON.stringify({scripts:scripts.length,failures:0}) + '\n');
}
