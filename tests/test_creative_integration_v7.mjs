import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const sandbox={window:{}};
for(const file of ['creative-pack-v5.js','creative-pack-v7.js','builder-geometry-v6.js']){
  vm.runInNewContext(
    await readFile(new URL('../'+file,import.meta.url),'utf8'),
    sandbox,
    {filename:file}
  );
}

const v5=sandbox.window.CMVNG_CREATIVE_PACK_V5;
const v7=sandbox.window.CMVNG_CREATIVE_PACK_V7;
const geometry=sandbox.window.CMVNG_BUILDER_GEOMETRY_V6;
assert.ok(v5&&v7&&geometry,'both creative packs and the geometry engine must load');
assert.equal(v5.validation.ok,true,JSON.stringify(v5.validation.errors));
assert.equal(v7.validation.ok,true,JSON.stringify(v7.validation.errors));

const formats=Object.entries(geometry.FORMATS).map(([id,dims])=>[id,dims[0],dims[1]]);
assert.deepEqual(formats.map(([id])=>id),['post','square','wide','story']);

const groupDefs=[
  ['character','characters'],
  ['doodle','doodles'],
  ['text','textStructures'],
  ['layout','specialLayouts'],
];
const expectedCounts={characters:62,doodles:114,textStructures:54,specialLayouts:65,total:295};
const combined={};
for(const [,property] of groupDefs)combined[property]=[...v5[property],...v7[property]];
const actualCounts={
  characters:combined.characters.length,
  doodles:combined.doodles.length,
  textStructures:combined.textStructures.length,
  specialLayouts:combined.specialLayouts.length,
};
actualCounts.total=Object.values(actualCounts).reduce((sum,count)=>sum+count,0);
assert.deepEqual(actualCounts,expectedCounts,'the Builder-facing combined inventory must stay exact');

const allIds=groupDefs.flatMap(([,property])=>combined[property].map(item=>item.id));
assert.equal(new Set(allIds).size,allIds.length,'v5 and v7 must remain globally id-unique');

let nativeCompositions=0;
let reflowedCompositions=0;
let auditedLayers=0;
let maxLayerCount=0;
let maxLayerDesign='';

function editablePayload(layer){
  if(layer.type==='text')return {type:layer.type,text:layer.text};
  if(layer.type==='svgraw')return {type:layer.type,vb:layer.vb,inner:layer.inner};
  if(layer.type==='img')return {type:layer.type,src:layer.src||''};
  return {type:layer.type};
}

for(const [kind,property] of groupDefs){
  for(const item of combined[property]){
    const pack=item.id.endsWith('-v7')||v7.find(kind,item.id)?v7:v5;
    for(const sourceFormat of formats){
      const layers=pack.instantiate(kind,item.id,sourceFormat,{});
      assert.ok(layers.length>0,`${kind}:${item.id}:${sourceFormat[0]} must instantiate`);
      assert.ok(layers.length<=48,`${kind}:${item.id}:${sourceFormat[0]} exceeds the 48-layer Builder limit`);
      if(layers.length>maxLayerCount){maxLayerCount=layers.length;maxLayerDesign=`${kind}:${item.id}:${sourceFormat[0]}`;}

      const normalized=geometry.normalizeComposition(layers,sourceFormat,{padding:0});
      assert.equal(normalized.length,layers.length,`${kind}:${item.id}:${sourceFormat[0]} normalization lost editable layers`);
      assert.equal(
        geometry.auditComposition(normalized,sourceFormat,{tolerance:2}).ok,
        true,
        `${kind}:${item.id}:${sourceFormat[0]} must fit its native canvas`
      );
      const nativePayload=normalized.map(editablePayload);
      nativeCompositions+=1;
      auditedLayers+=normalized.length;

      for(const targetFormat of formats){
        const reflowed=geometry.reflowComposition(normalized,sourceFormat,targetFormat,{padding:0});
        const audit=geometry.auditComposition(reflowed,targetFormat,{tolerance:2});
        assert.equal(
          audit.ok,
          true,
          `${kind}:${item.id}:${sourceFormat[0]} -> ${targetFormat[0]} escaped the canvas: ${JSON.stringify(audit.errors)}`
        );
        assert.equal(reflowed.length,normalized.length,`${kind}:${item.id} reflow lost editable layers`);
        assert.deepEqual(
          reflowed.map(editablePayload),
          nativePayload,
          `${kind}:${item.id}:${sourceFormat[0]} -> ${targetFormat[0]} changed editable content`
        );
        reflowedCompositions+=1;
      }
    }
  }
}

assert.equal(nativeCompositions,expectedCounts.total*formats.length);
assert.equal(reflowedCompositions,expectedCounts.total*formats.length*formats.length);

process.stdout.write(JSON.stringify({
  packs:[v5.version,v7.version],
  counts:actualCounts,
  formats:formats.map(([id])=>id),
  nativeCompositions,
  reflowedCompositions,
  auditedLayers,
  maxLayerCount,
  maxLayerDesign,
  boundsFailures:0,
  editableContentMutations:0,
})+'\n');
