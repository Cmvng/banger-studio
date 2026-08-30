import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../creative-pack-v5.js', import.meta.url), 'utf8');
const sandbox = {window:{}};
vm.runInNewContext(source, sandbox, {filename:'creative-pack-v5.js'});
const pack = sandbox.window.CMVNG_CREATIVE_PACK_V5;
assert.ok(pack, 'pack should be exported');
assert.equal(pack.validation.ok, true);
assert.deepEqual({...pack.counts}, {characters:26,doodles:58,textStructures:24,specialLayouts:30,total:138});
assert.equal(pack.counts.specialLayouts + pack.counts.textStructures + pack.counts.characters + 28, 108);

const formats = [['post',1080,1350],['square',1080,1080],['wide',1920,1080],['story',1080,1920]];
const groups = [
  ['character',pack.characters],['doodle',pack.doodles],
  ['text',pack.textStructures],['layout',pack.specialLayouts]
];
let instantiated = 0;
for (const [kind, items] of groups) {
  for (const item of items) {
    for (const format of formats) {
      const layers = pack.instantiate(kind,item.id,format,{});
      assert.ok(layers.length > 0, kind + ':' + item.id + ' should instantiate');
      assert.ok(layers.length <= 48, kind + ':' + item.id + ' exceeds Builder limit');
      assert.ok(layers.every(layer => layer.type === 'text' || layer.type === 'svgraw' || layer.type === 'img'), kind + ':' + item.id + ' emitted an unsupported layer');
      instantiated += 1;
    }
  }
}

assert.equal(new Set(pack.characters.map(item => item.inner)).size, pack.characters.length);
assert.equal(new Set(pack.doodles.map(item => item.inner)).size, pack.doodles.length);
process.stdout.write(JSON.stringify({counts:pack.counts,designKits:108,instantiations:instantiated,duplicates:0}) + '\n');
