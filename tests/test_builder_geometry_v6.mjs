import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const sandbox={window:{}};
vm.runInNewContext(await readFile(new URL('../creative-pack-v5.js',import.meta.url),'utf8'),sandbox,{filename:'creative-pack-v5.js'});
vm.runInNewContext(await readFile(new URL('../builder-geometry-v6.js',import.meta.url),'utf8'),sandbox,{filename:'builder-geometry-v6.js'});
const pack=sandbox.window.CMVNG_CREATIVE_PACK_V5;
const geometry=sandbox.window.CMVNG_BUILDER_GEOMETRY_V6;
assert.ok(pack&&geometry,'creative pack and geometry module should load');

const formats=Object.entries(geometry.FORMATS).map(([id,dims])=>[id,dims[0],dims[1]]);
const groups=[['character',pack.characters],['doodle',pack.doodles],['text',pack.textStructures],['layout',pack.specialLayouts]];
let normalizedCompositions=0,reflowedCompositions=0,auditedLayers=0;

for(const [kind,items] of groups){
  for(const item of items){
    for(const sourceFormat of formats){
      const raw=pack.instantiate(kind,item.id,sourceFormat,{});
      const normalized=geometry.normalizeComposition(raw,sourceFormat,{padding:0});
      const nativeAudit=geometry.auditComposition(normalized,sourceFormat,{tolerance:2});
      assert.equal(nativeAudit.ok,true,`${kind}:${item.id}:${sourceFormat[0]} should fit its canvas`);
      normalizedCompositions+=1;auditedLayers+=normalized.length;
      for(const targetFormat of formats){
        const reflowed=geometry.reflowComposition(normalized,sourceFormat,targetFormat,{padding:0});
        const audit=geometry.auditComposition(reflowed,targetFormat,{tolerance:2});
        assert.equal(audit.ok,true,`${kind}:${item.id}:${sourceFormat[0]}→${targetFormat[0]} should remain in bounds: ${JSON.stringify(audit.errors)}`);
        assert.equal(reflowed.length,normalized.length,'reflow must preserve the editable layer count');
        reflowedCompositions+=1;
      }
    }
  }
}

const broken=[
  {type:'svgraw',x:0,y:0,w:1080,ar:1.25,vb:'0 0 100 100',inner:'<rect width="100" height="100"/>'},
  {type:'text',x:-180,y:1240,w:1400,size:170,lh:1.2,text:'A VERY LONG TITLE THAT USED TO LEAVE THE CANVAS'}
];
const repaired=geometry.normalizeComposition(broken,['post',1080,1350],{padding:0});
assert.equal(geometry.auditComposition(repaired,['post',1080,1350],{tolerance:2}).ok,true,'normalizer should repair a deliberately broken composition');
assert.deepEqual(
  {x:repaired[0].x,y:repaired[0].y,w:repaired[0].w,ar:repaired[0].ar},
  {x:0,y:0,w:1080,ar:1.25},
  'full-canvas foundations should stay exact'
);

process.stdout.write(JSON.stringify({
  formats:formats.map(item=>item[0]),
  assets:pack.counts.total,
  normalizedCompositions,
  reflowedCompositions,
  auditedLayers,
  repairedBrokenFixture:true
})+'\n');
