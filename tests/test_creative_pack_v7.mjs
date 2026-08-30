import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const sandbox={window:{},console};
const v5Source=await readFile(new URL('../creative-pack-v5.js',import.meta.url),'utf8');
const v7Source=await readFile(new URL('../creative-pack-v7.js',import.meta.url),'utf8');
vm.runInNewContext(v5Source,sandbox,{filename:'creative-pack-v5.js'});
vm.runInNewContext(v7Source,sandbox,{filename:'creative-pack-v7.js'});

const v5=sandbox.window.CMVNG_CREATIVE_PACK_V5;
const pack=sandbox.window.CMVNG_CREATIVE_PACK_V7;
assert.ok(v5,'v5 comparison pack should load');
assert.ok(pack,'v7 pack should be exported');
assert.equal(pack.version,'7.0.0');
assert.equal(pack.additiveAgainst,'5.0.0');
assert.equal(pack.validation.ok,true,JSON.stringify(pack.validation.errors));
assert.deepEqual({...pack.counts},{characters:36,doodles:56,textStructures:30,specialLayouts:35,total:157});
assert.ok(pack.counts.total>=150,'v7 must contain at least 150 genuinely new authored assets');

const formats=[['post',1080,1350],['square',1080,1080],['wide',1920,1080],['story',1080,1920]];
const groups=[['character',pack.characters],['doodle',pack.doodles],['text',pack.textStructures],['layout',pack.specialLayouts]];
const v5Groups=[v5.characters,v5.doodles,v5.textStructures,v5.specialLayouts];
const supportedTypes=new Set(['svgraw','text','img']);
const requiredDirections=new Set(['minimal','editorial','swiss','quiet-luxury','neo-brutalist','data','storytelling']);

const allV7Items=groups.flatMap(([,items])=>items);
const ids=allV7Items.map(item=>item.id);
assert.equal(new Set(ids).size,ids.length,'v7 ids must be globally unique');
const v5Ids=new Set(v5Groups.flatMap(items=>items.map(item=>item.id)));
assert.equal(ids.filter(id=>v5Ids.has(id)).length,0,'v7 ids must be additive and not reuse v5 ids');

for(const item of allV7Items){
  assert.match(item.id,/^[a-z0-9]+(?:-[a-z0-9]+)*$/,'stable kebab-case id required');
  assert.ok(item.name&&item.category&&item.direction&&item.note,'complete catalog metadata required for '+item.id);
  assert.ok(Array.isArray(item.tags)&&item.tags.length>=3,'useful tags required for '+item.id);
}

assert.deepEqual(new Set(pack.specialLayouts.map(item=>item.direction)),requiredDirections,'complete layouts must cover every required art direction');
assert.ok(pack.textStructures.some(item=>item.direction==='minimal'));
assert.ok(pack.textStructures.some(item=>item.direction==='editorial'));
assert.ok(pack.textStructures.some(item=>item.direction==='swiss'));
assert.ok(pack.textStructures.some(item=>item.direction==='quiet-luxury'));
assert.ok(pack.textStructures.some(item=>item.direction==='neo-brutalist'));
assert.ok(pack.textStructures.some(item=>item.direction==='data'));
assert.ok(pack.textStructures.some(item=>item.direction==='storytelling'));

function stripPaint(source){
  return String(source)
    .replace(/#[0-9a-f]{3,8}/gi,'#COLOR')
    .replace(/url\(#[^)]+\)/g,'url(#PATTERN)')
    .replace(/id="[^"]+"/g,'id="ID"')
    .replace(/\s+/g,' ')
    .trim();
}
function layerStructure(layer,W,H){
  const base={
    type:layer.type,
    x:Number((layer.x/W).toFixed(3)),
    y:Number((layer.y/H).toFixed(3)),
    w:Number((layer.w/W).toFixed(3))
  };
  if(layer.type==='svgraw')return {...base,ar:Number(layer.ar.toFixed(3)),vb:layer.vb,art:stripPaint(layer.inner)};
  if(layer.type==='text')return {...base,size:Number((layer.size/W).toFixed(4)),ff:layer.ff,fw:String(layer.fw),lh:String(layer.lh),lines:String(layer.text).split('\n').length,rot:Number(layer.rot||0),fst:layer.fst||''};
  return {...base,ar:Number(layer.ar||1)};
}
function compositionSignature(layers,format){
  return JSON.stringify(layers.map(layer=>layerStructure(layer,format[1],format[2])));
}

assert.equal(new Set(pack.characters.map(item=>item.inner)).size,pack.characters.length,'character art must not repeat');
assert.equal(new Set(pack.doodles.map(item=>item.inner)).size,pack.doodles.length,'doodle art must not repeat');
assert.equal(new Set(pack.characters.map(item=>stripPaint(item.inner))).size,pack.characters.length,'character structure must differ beyond paint');
assert.equal(new Set(pack.doodles.map(item=>stripPaint(item.inner))).size,pack.doodles.length,'doodle structure must differ beyond paint');

const v5CharacterArt=new Set(v5.characters.map(item=>stripPaint(item.inner)));
const v5DoodleArt=new Set(v5.doodles.map(item=>stripPaint(item.inner)));
assert.equal(pack.characters.filter(item=>v5CharacterArt.has(stripPaint(item.inner))).length,0,'v7 character art must not duplicate v5');
assert.equal(pack.doodles.filter(item=>v5DoodleArt.has(stripPaint(item.inner))).length,0,'v7 doodle art must not duplicate v5');

const square=['square',1080,1080];
const textSignatures=pack.textStructures.map(item=>compositionSignature(pack.instantiate('text',item.id,square),square));
const layoutSignatures=pack.specialLayouts.map(item=>compositionSignature(pack.instantiate('layout',item.id,square),square));
assert.equal(new Set(textSignatures).size,textSignatures.length,'text systems must be structurally unique, not palette swaps');
assert.equal(new Set(layoutSignatures).size,layoutSignatures.length,'complete layouts must be structurally unique, not palette swaps');

const v5TextSignatures=new Set(v5.textStructures.map(item=>compositionSignature(v5.instantiate('text',item.id,square),square)));
const v5LayoutSignatures=new Set(v5.specialLayouts.map(item=>compositionSignature(v5.instantiate('layout',item.id,square),square)));
assert.equal(textSignatures.filter(sig=>v5TextSignatures.has(sig)).length,0,'v7 text systems must not structurally duplicate v5');
assert.equal(layoutSignatures.filter(sig=>v5LayoutSignatures.has(sig)).length,0,'v7 layouts must not structurally duplicate v5');

let instantiations=0;
let auditedLayers=0;
let maxLayers={id:'',kind:'',format:'',count:0};
for(const [kind,items] of groups){
  for(const item of items){
    for(const fmt of formats){
      const [formatId,W,H]=fmt;
      const layers=pack.instantiate(kind,item.id,fmt,{});
      assert.ok(layers.length>0,`${kind}:${item.id}:${formatId} should instantiate`);
      assert.ok(layers.length<=48,`${kind}:${item.id}:${formatId} exceeds the Builder layer limit`);
      if(layers.length>maxLayers.count)maxLayers={id:item.id,kind,format:formatId,count:layers.length};
      for(const layer of layers){
        assert.ok(supportedTypes.has(layer.type),`${kind}:${item.id} emitted unsupported type ${layer.type}`);
        assert.ok(Number.isFinite(layer.x)&&Number.isFinite(layer.y)&&Number.isFinite(layer.w),`${kind}:${item.id} has invalid geometry`);
        assert.ok(layer.x>=0&&layer.y>=0&&layer.w>0,`${kind}:${item.id} has negative or zero geometry`);
        assert.ok(layer.x+layer.w<=W+1,`${kind}:${item.id}:${formatId} exceeds the right canvas edge`);
        if(layer.type==='svgraw'){
          assert.ok(layer.vb&&layer.inner&&Number.isFinite(layer.ar)&&layer.ar>0,`${kind}:${item.id} emitted an invalid svgraw layer`);
          assert.ok(layer.y+layer.w*layer.ar<=H+1,`${kind}:${item.id}:${formatId} exceeds the bottom canvas edge`);
          assert.doesNotMatch(layer.inner,/<script|on\w+=|https?:\/\//i,`${kind}:${item.id} contains unsafe or external SVG content`);
          assert.doesNotMatch(layer.inner,/undefined|NaN/,`${kind}:${item.id} contains an unresolved SVG value`);
        }
        if(layer.type==='text'){
          assert.ok(layer.text&&layer.color&&layer.ff&&layer.fw&&layer.lh,`${kind}:${item.id} emitted an incomplete text layer`);
          assert.ok(Number.isFinite(layer.size)&&layer.size>=8,`${kind}:${item.id} has invalid text size`);
          const lineCount=Math.max(1,String(layer.text).split('\n').length);
          const estimatedHeight=layer.size*Math.max(.65,Number(layer.lh)||1)*lineCount;
          assert.ok(layer.y+estimatedHeight<=H+2,`${kind}:${item.id}:${formatId} has estimated text overflow`);
        }
        auditedLayers+=1;
      }
      instantiations+=1;
    }
  }
}

const custom=pack.instantiate('layout','single-signal-v7',square,{theme:{blue:'#6544EE',ink:'#18112B'}});
assert.ok(custom.some(layer=>layer.type==='text'&&layer.color==='#6544EE'),'layout theme overrides should remain usable');
const placed=pack.instantiate('doodle','sankey-flow',square,{x:100,y:200,w:320});
assert.equal(placed[0].x,100);
assert.equal(placed[0].y,200);
assert.equal(placed[0].w,320);

const broken={type:'svgraw',vb:'0 0 100 100',inner:'<rect width="100" height="100"/>',x:-200,y:980,w:1500,ar:1.5};
const repaired=pack.fitLayer(broken,square);
assert.ok(repaired.x>=0&&repaired.y>=0&&repaired.x+repaired.w<=1081&&repaired.y+repaired.w*repaired.ar<=1081,'fitLayer must repair unsafe geometry');

const catalog=pack.getCatalog();
assert.equal(catalog.characters.length,pack.counts.characters);
assert.equal(catalog.doodles.length,pack.counts.doodles);
assert.equal(catalog.textStructures.length,pack.counts.textStructures);
assert.equal(catalog.specialLayouts.length,pack.counts.specialLayouts);
assert.equal(typeof catalog.textStructures[0].build,'undefined','catalog should expose metadata, not executable builders');

process.stdout.write(JSON.stringify({
  version:pack.version,
  counts:pack.counts,
  formats:formats.map(item=>item[0]),
  instantiations,
  auditedLayers,
  maxLayers,
  crossVersionDuplicateIds:0,
  crossVersionDuplicateArt:0,
  structuralPaletteOnlyDuplicates:0,
  boundsFailures:0
})+'\n');
