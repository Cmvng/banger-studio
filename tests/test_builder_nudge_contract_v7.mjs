import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const enhancements=await readFile(new URL('../studio-enhancements.js',import.meta.url),'utf8');
const legacy=await readFile(new URL('../preview-v2.html',import.meta.url),'utf8');

const contracts=[];
function contract(area,name,condition,evidence){
  contracts.push({area,name,pass:Boolean(condition),evidence});
}

function functionSource(name,nextName){
  const pattern=new RegExp('function\\s+'+name.replace(/[.*+?^${}()|[\\]\\]/g,'\\$&')+'\\s*\\(([^)]*)\\)\\s*\\{([\\s\\S]*?)\\n  \\}\\n\\n  function\\s+'+nextName.replace(/[.*+?^${}()|[\\]\\]/g,'\\$&'));
  const match=enhancements.match(pattern);
  assert.ok(match,'could not extract '+name+' from studio-enhancements.js');
  return 'function '+name+'('+match[1]+'){'+match[2]+'\n}';
}

// The bounds helper is evaluated with small DOM stubs. This directly exercises
// the production clamp math without requiring a browser or duplicating it here.
const boundsFunction=vm.runInNewContext(
  '('+functionSource('nudgePadBoundsV7','captureNudgePadPositionV7')+')',
  {},
  {filename:'nudgePadBoundsV7.js'}
);

function runBoundsFixture(fixture){
  const stage={getBoundingClientRect:()=>({...fixture.stage})};
  const screenRect={left:0,top:0,right:fixture.viewportWidth,bottom:fixture.viewportHeight,width:fixture.viewportWidth,height:fixture.viewportHeight};
  const workspaceRect={...fixture.workspace||screenRect};
  const workspace={getBoundingClientRect:()=>({...workspaceRect})};
  const selectionTool=fixture.selectionTool?{getBoundingClientRect:()=>({...fixture.selectionTool})}:null;
  const screen={
    getBoundingClientRect:()=>({...screenRect}),
    classList:{contains:name=>name==='on'},
    querySelector:selector=>selector==='.stagewrap'?workspace:(selector==='#bd_ov .tool'?selectionTool:null),
  };
  const pad={
    getBoundingClientRect:()=>({width:fixture.padWidth,height:fixture.padHeight}),
    offsetWidth:fixture.padWidth,
    offsetHeight:fixture.padHeight,
    classList:{contains:name=>name==='bw-nudge-collapsed'&&fixture.collapsed},
  };
  const context={
    document:{
      getElementById:id=>id==='bd_stage'?stage:(id==='bscr'?screen:null),
      querySelector:selector=>selector==='#bscr .stagewrap'?workspace:null,
    },
    window:{
      innerWidth:fixture.viewportWidth,
      innerHeight:fixture.viewportHeight,
      visualViewport:{offsetLeft:0,offsetTop:0,width:fixture.viewportWidth,height:fixture.viewportHeight},
      matchMedia:query=>({matches:query==='(max-width: 520px)'&&fixture.viewportWidth<=520}),
    },
  };
  const fn=vm.runInNewContext('('+functionSource('nudgePadBoundsV7','captureNudgePadPositionV7')+')',context);
  const bounds=fn(pad);
  assert.ok(bounds,fixture.name+' should produce bounds');
  assert.ok(bounds.minX<=bounds.maxX,fixture.name+' x interval is inverted');
  assert.ok(bounds.minY<=bounds.maxY,fixture.name+' y interval is inverted');
  for(const fraction of [0,.02,.5,.92,1]){
    const x=bounds.minX+(bounds.maxX-bounds.minX)*fraction;
    const y=bounds.minY+(bounds.maxY-bounds.minY)*fraction;
    const absoluteLeft=x;
    const absoluteTop=y;
    assert.ok(absoluteLeft>=Math.max(workspaceRect.left,0)+5.99,fixture.name+' overlaps left workspace boundary at '+fraction);
    assert.ok(absoluteTop>=Math.max(workspaceRect.top,0)+5.99,fixture.name+' overlaps top/format controls at '+fraction);
    assert.ok(absoluteLeft+fixture.padWidth<=Math.min(workspaceRect.right,fixture.viewportWidth)-5.99,fixture.name+' overlaps right workspace boundary at '+fraction);
    assert.ok(absoluteTop+fixture.padHeight<=Math.min(workspaceRect.bottom,fixture.viewportHeight)-5.99,fixture.name+' overlaps add rail at '+fraction);
    if(fixture.selectionTool) assert.ok(absoluteTop+fixture.padHeight<=fixture.selectionTool.top-11.99,fixture.name+' overlaps essential selection toolbar at '+fraction);
  }
  return bounds;
}

const viewportFixtures=[
  {name:'320px',viewportWidth:320,viewportHeight:568,workspace:{left:0,top:96,right:320,bottom:492,width:320,height:396},selectionTool:{left:42,top:416,right:278,bottom:474,width:236,height:58},stage:{left:10,top:104,right:310,bottom:482,width:300,height:378},padWidth:154,padHeight:201,collapsed:false},
  {name:'360px',viewportWidth:360,viewportHeight:640,workspace:{left:0,top:96,right:360,bottom:564,width:360,height:468},selectionTool:{left:62,top:488,right:298,bottom:546,width:236,height:58},stage:{left:10,top:106,right:350,bottom:550,width:340,height:444},padWidth:54,padHeight:54,collapsed:true},
  {name:'390px',viewportWidth:390,viewportHeight:720,workspace:{left:0,top:98,right:390,bottom:644,width:390,height:546},selectionTool:{left:77,top:568,right:313,bottom:626,width:236,height:58},stage:{left:10,top:108,right:380,bottom:628,width:370,height:520},padWidth:154,padHeight:201,collapsed:false},
  {name:'1280px',viewportWidth:1280,viewportHeight:900,workspace:{left:0,top:104,right:1280,bottom:818,width:1280,height:714},stage:{left:380,top:132,right:900,bottom:782,width:520,height:650},padWidth:154,padHeight:201,collapsed:false},
];
// Wide format is the tightest real Builder case. Expanded controls cannot fit
// vertically at these phone widths, so production must recognize that state and
// use its compact recovery rather than silently clipping the panel.
const wideViewportFixtures=[
  {name:'320px wide expanded',viewportWidth:320,viewportHeight:568,workspace:{left:0,top:96,right:320,bottom:492,width:320,height:396},selectionTool:{left:42,top:416,right:278,bottom:474,width:236,height:58},stage:{left:12,top:154,right:308,bottom:320.5,width:296,height:166.5},padWidth:154,padHeight:201,collapsed:false},
  {name:'360px wide expanded',viewportWidth:360,viewportHeight:640,workspace:{left:0,top:96,right:360,bottom:564,width:360,height:468},selectionTool:{left:62,top:488,right:298,bottom:546,width:236,height:58},stage:{left:12,top:160,right:348,bottom:349,width:336,height:189},padWidth:154,padHeight:201,collapsed:false},
  {name:'390px wide expanded',viewportWidth:390,viewportHeight:720,workspace:{left:0,top:98,right:390,bottom:644,width:390,height:546},selectionTool:{left:77,top:568,right:313,bottom:626,width:236,height:58},stage:{left:12,top:166,right:378,bottom:371.9,width:366,height:205.9},padWidth:154,padHeight:201,collapsed:false},
];
const viewportResults=[];

function runTransientFixture(){
  const classes=new Set(['bw-nudge-pad','on']);
  const attributes=new Map();
  const collapseAttributes=new Map();
  const workspaceRect={left:0,top:100,right:1280,bottom:280,width:1280,height:180};
  const state={x:0,y:1,collapsed:false,mode:'desktop'};
  const counters={saved:0,layers:0,expanded:0,focusTransfers:0,toasts:[]};
  const expandedSize=(enhancements.match(/NUDGE_PAD_EXPANDED_SIZE = \{width:(\d+),height:(\d+)\}/)||[]).slice(1).map(Number);
  const collapsedSize=+(enhancements.match(/\.bw-nudge-collapsed\{width:(\d+)px/)||[])[1];
  assert.ok(expandedSize.length===2&&expandedSize.every(Number.isFinite)&&Number.isFinite(collapsedSize),'Nudge production sizes should be explicit');
  const activeControl={kind:'reset'};
  let activeElement=activeControl;
  const dragHandle={
    setAttribute:(name,value)=>attributes.set(name,String(value)),
    set title(value){attributes.set('title',value);},
    focus:()=>{counters.focusTransfers+=1;activeElement=dragHandle;},
  };
  const collapseControl={setAttribute:(name,value)=>collapseAttributes.set(name,String(value))};
  const pad={
    classList:{
      contains:name=>classes.has(name),
      toggle:(name,force)=>{if(force)classes.add(name);else classes.delete(name);},
      add:name=>classes.add(name),
      remove:name=>classes.delete(name),
    },
    querySelector:selector=>selector==='[data-nudge-drag]'?dragHandle:(selector==='[data-nudge-collapse]'?collapseControl:null),
    contains:node=>node===activeControl||node===dragHandle||node===collapseControl,
    getBoundingClientRect:()=>({
      width:pad.__bwNudgeMeasuredSize?.width||(classes.has('bw-nudge-collapsed')?collapsedSize:expandedSize[0]),
      height:pad.__bwNudgeMeasuredSize?.height||(classes.has('bw-nudge-collapsed')?54:expandedSize[1]),
    }),
    offsetWidth:expandedSize[0],
    offsetHeight:expandedSize[1],
    style:{left:'',top:'',right:'',bottom:''},
  };
  const workspace={getBoundingClientRect:()=>({...workspaceRect})};
  const screen={
    classList:{contains:name=>name==='on'},
    querySelector:selector=>selector==='.stagewrap'?workspace:null,
  };
  const context={
    document:{get activeElement(){return activeElement;},getElementById:id=>id==='bd_pad'?pad:(id==='bscr'?screen:null)},
    window:{
      innerWidth:1280,innerHeight:900,
      visualViewport:{offsetLeft:0,offsetTop:0,width:1280,height:900},
      matchMedia:()=>({matches:false}),
    },
    loadNudgePadPreferenceV7:()=>state,
    saveNudgePadPreferenceV7:()=>{counters.saved+=1;},
    openBuilderSheet:()=>{counters.layers+=1;},
    toast:(message,kind)=>counters.toasts.push({message,kind}),
    setNudgePadCollapsedV7:(_pad,collapsed)=>{if(!collapsed)counters.expanded+=1;},
  };
  const production=[
    'const NUDGE_PAD_EXPANDED_SIZE = {width:'+expandedSize[0]+',height:'+expandedSize[1]+'};',
    'let nudgePadDrag = null;',
    functionSource('nudgePadBoundsV7','captureNudgePadPositionV7'),
    functionSource('updateNudgePadA11yV7','expandedNudgeFitsV7'),
    functionSource('expandedNudgeFitsV7','constrainNudgePadV7'),
    functionSource('constrainNudgePadV7','setNudgePadCollapsedV7'),
    functionSource('openNudgePadV7','moveNudgePadByKeyboardV7'),
    'globalThis.__nudgeApi={constrainNudgePadV7,openNudgePadV7};',
  ].join('\n');
  vm.runInNewContext(production,context,{filename:'nudge-transient-v7.js'});
  context.__nudgeApi.constrainNudgePadV7();
  const cramped={
    userCollapsed:state.collapsed,
    autoCollapsed:classes.has('bw-nudge-auto-collapsed'),
    effectiveCollapsed:classes.has('bw-nudge-collapsed'),
    ariaExpanded:attributes.get('aria-expanded'),
    collapseHidden:collapseAttributes.get('aria-hidden'),
    focusTransfers:counters.focusTransfers,
    saved:counters.saved,
  };
  workspaceRect.bottom=800;workspaceRect.height=700;
  context.__nudgeApi.constrainNudgePadV7();
  const recovered={
    userCollapsed:state.collapsed,
    autoCollapsed:classes.has('bw-nudge-auto-collapsed'),
    effectiveCollapsed:classes.has('bw-nudge-collapsed'),
    ariaExpanded:attributes.get('aria-expanded'),
    collapseHidden:collapseAttributes.get('aria-hidden'),
    focusTransfers:counters.focusTransfers,
    saved:counters.saved,
  };
  workspaceRect.bottom=280;workspaceRect.height=180;
  context.__nudgeApi.openNudgePadV7(pad);
  return {cramped,recovered,counters};
}

const transientFixture=runTransientFixture();

// Existing arrows remain real Builder operations after they are reparented.
contract('legacy','selection controls visibility',/function select\(id\)\{sel=id;drawOverlay\(\);pad\.classList\.add\(['"]on['"]\);\}/.test(legacy)&&/function deselect\(\)[\s\S]*?pad\.classList\.remove\(['"]on['"]\);/.test(legacy),'pad follows the selected-layer lifecycle');
contract('legacy','arrow nudge preserves undo',/b\.onclick=\(\)=>\{const el=byId\(sel\);if\(!el\)return;snapshot\(\);[\s\S]*?el\.y-=6[\s\S]*?el\.x\+=6[\s\S]*?place\(el\);drawOverlay\(\)/.test(legacy),'legacy arrows retain snapshot, 6px motion, placement, and overlay refresh');
contract('install','enhancement installs exactly once',/function installMovableNudgePadV7\(\)/.test(enhancements)&&/pad\.dataset\.nudgeMovable === ['"]1['"]/.test(enhancements)&&/installMovableNudgePadV7\(\);/.test(enhancements),'Builder install is idempotent and invokes the Nudge upgrade');
contract('install','legacy arrow nodes are preserved',/const legacyButtons = Array\.from\(pad\.children\)[\s\S]*?grid\.appendChild\(button\)/.test(enhancements),'the proven directional button nodes survive the layout upgrade');
contract('install','accessible movable controls',/data-nudge-drag aria-label=['"]Drag Nudge controls['"]/.test(enhancements)&&/data-nudge-reset aria-label=['"]Dock Nudge controls at the lower left['"]/.test(enhancements)&&/data-nudge-collapse aria-label=['"]Collapse Nudge controls['"]/.test(enhancements),'drag, recovery, and collapse controls have explicit names');
contract('install','decorative grid spacers are not focusable',/button\.classList\.add\(['"]bw-nudge-spacer['"]\)[\s\S]{0,220}?aria-hidden[\s\S]{0,220}?button\.tabIndex = -1;[\s\S]{0,120}?button\.disabled = true/.test(enhancements),'four blank legacy spacer buttons cannot become unnamed keyboard stops');
contract('install','fixed panel is portaled out of clipped stage',/\.bw-nudge-pad\{[^}]*position:fixed/.test(enhancements)&&/pad\.parentElement !== screen\) screen\.appendChild\(pad\)/.test(enhancements),'wide canvases cannot clip the expanded Nudge controls');

contract('pointer','touch-safe drag handle',/\.bw-nudge-drag\{[^}]*touch-action:none/.test(enhancements),'the handle owns pointer/touch gestures without page panning');
contract('pointer','complete pointer lifecycle',/dragHandle\.addEventListener\(['"]pointerdown['"]/.test(enhancements)&&/dragHandle\.addEventListener\(['"]pointermove['"]/.test(enhancements)&&/dragHandle\.addEventListener\(['"]pointerup['"],endDrag\)/.test(enhancements)&&/dragHandle\.addEventListener\(['"]pointercancel['"],endDrag\)/.test(enhancements),'mouse, pen, touch release, and cancellation share one lifecycle');
contract('pointer','pointer capture is acquired and released',/dragHandle\.setPointerCapture\(event\.pointerId\)/.test(enhancements)&&/dragHandle\.hasPointerCapture\(event\.pointerId\)/.test(enhancements)&&/dragHandle\.releasePointerCapture\(event\.pointerId\)/.test(enhancements),'drag remains attached outside the handle and releases safely');
contract('pointer','lost capture also cleans up',/dragHandle\.addEventListener\(['"]lostpointercapture['"],endDrag\)/.test(enhancements),'OS/browser capture loss cannot leave the panel in a dragging state');
contract('pointer','only the active pointer can move it',/event\.pointerId !== nudgePadDrag\.pointerId/.test(enhancements),'secondary pointers cannot hijack a drag');
contract('pointer','secondary touch cannot start a drag',/(?:event\.isPrimary === false|!event\.isPrimary)[\s\S]{0,100}?return/.test(enhancements),'a second simultaneous touch cannot replace the primary drag state');
contract('pointer','drag is isolated from canvas editing',/pad\.classList\.add\(['"]bw-nudge-dragging['"]\)[\s\S]*?event\.preventDefault\(\);[\s\S]*?event\.stopPropagation\(\)/.test(enhancements),'handle gestures do not select or move canvas layers');
contract('pointer','keyboard movement and compact controls',/event\.key === ['"]ArrowLeft['"][\s\S]*?moveNudgePadByKeyboardV7/.test(enhancements)&&/event\.key === ['"]Escape['"][\s\S]*?setNudgePadCollapsedV7\(pad,true\)/.test(enhancements),'arrows move the panel and Escape compacts it');
const dragSlop=+((enhancements.match(/Math\.hypot\(dx,dy\) (?:<=|>) (\d+)/)||[])[1]);
contract('pointer','tap-to-open tolerates touch jitter',Number.isFinite(dragSlop)&&dragSlop>=6,'collapsed-handle tap slop is '+dragSlop+'px; expected at least 6px');
contract('pointer','drag origin matches fixed coordinate space',/left:rect\.left,top:rect\.top,moved:false/.test(enhancements)&&!/bounds\.stage\.getBoundingClientRect/.test(enhancements),'pointer deltas and clamp bounds use the same absolute viewport coordinates');

contract('bounds','workspace and visual viewport intersect',/screen\.querySelector\(['"]\.stagewrap['"]\)/.test(enhancements)&&/const workspaceRect = workspace\.getBoundingClientRect\(\)/.test(enhancements)&&/const viewport = window\.visualViewport/.test(enhancements)&&/visibleLeft = Math\.max\(workspaceRect\.left, viewportLeft\)/.test(enhancements)&&/visibleBottom = Math\.min\(workspaceRect\.bottom, viewportBottom\)/.test(enhancements),'fixed portal remains inside the visible canvas workspace, clear of top controls and rail');
contract('bounds','both axes clamp during drag',/Math\.max\(bounds\.minX,Math\.min\(bounds\.maxX,nudgePadDrag\.left\+dx\)\)/.test(enhancements)&&/Math\.max\(bounds\.minY,Math\.min\(bounds\.maxY,nudgePadDrag\.top\+dy\)\)/.test(enhancements),'pointer coordinates cannot move past computed bounds');
contract('bounds','resize and orientation recover position',/new ResizeObserver\(\(\) => requestAnimationFrame\(constrainNudgePadV7\)\)/.test(enhancements)&&/resizeObserver\.observe\(screen\.querySelector\(['"]\.stagewrap['"]\)\)/.test(enhancements)&&/addEventListener\(['"]resize['"],constrainNudgePadV7/.test(enhancements)&&/addEventListener\(['"]orientationchange['"],constrainNudgePadV7/.test(enhancements)&&/visualViewport\.addEventListener\(['"]resize['"],constrainNudgePadV7/.test(enhancements),'workspace, viewport, and device changes re-run containment');
for(const fixture of viewportFixtures){
  let passed=true,evidence='production bounds helper contains expanded/collapsed panel inside stage and '+fixture.viewportWidth+'px visual viewport';
  try{
    const bounds=runBoundsFixture(fixture);
    viewportResults.push({width:fixture.viewportWidth,collapsed:fixture.collapsed,minX:bounds.minX,minY:bounds.minY,maxX:bounds.maxX,maxY:bounds.maxY});
  }catch(error){passed=false;evidence=error.message;}
  contract('viewport',fixture.name+' containment',passed,evidence);
}
for(const fixture of wideViewportFixtures){
  let passed=true,evidence='production bounds helper contains the compact recovery handle inside the real '+fixture.name+' stage';
  try{
    const bounds=runBoundsFixture(fixture);
    viewportResults.push({width:fixture.viewportWidth,format:'wide',collapsed:false,minX:bounds.minX,minY:bounds.minY,maxX:bounds.maxX,maxY:bounds.maxY});
  }catch(error){passed=false;evidence=error.message;}
  contract('viewport',fixture.name+' containment',passed,evidence);
}
const crampedRecognition=/(?:fitsExpanded|canExpand|fits\s*:|fits\s*=)[\s\S]{0,900}?(?:bw-nudge-auto-collapsed|setNudgePadCollapsedV7\(pad,true\)|classList\.toggle\(['"]bw-nudge-collapsed['"])/.test(enhancements);
const fixedPortal=/\.bw-nudge-pad\{[^}]*position:fixed/.test(enhancements)&&/screen\.appendChild\(pad\)/.test(enhancements);
contract('viewport','wide phone stages have a non-clipping strategy',fixedPortal||crampedRecognition,'expanded 154×201px panel is portaled to the workspace or safely auto-compacted above 166.5/189px stages');

const collapsedShell=enhancements.match(/\.bw-nudge-collapsed\{width:(\d+)px/);
const collapsedHandle=enhancements.match(/\.bw-nudge-collapsed \.bw-nudge-drag\{width:(\d+)px;height:(\d+)px/);
contract('compact','collapsed shell leaves a single handle',Boolean(collapsedShell&&+collapsedShell[1]>=54&&collapsedHandle&&+collapsedHandle[1]>=44&&+collapsedHandle[2]>=44)&&/\.bw-nudge-collapsed \.bw-nudge-grid[^}]*,?[^}]*\.bw-nudge-reset,[\s\S]*?\.bw-nudge-collapse\{display:none\}/.test(enhancements),'compact mode removes the arrow grid and recovery controls but retains one contained, accessible 44px move/open handle');
contract('compact','collapsed tap and keyboard reopen',/!moved && event\.type === ['"]pointerup['"][\s\S]*?openNudgePadV7\(pad\)/.test(enhancements)&&/event\.key === ['"]Enter['"] \|\| event\.key === ['"] ['"]\)[\s\S]*?openNudgePadV7\(pad\)/.test(enhancements),'compact state always has pointer and keyboard recovery');
contract('compact','state is announced',/function updateNudgePadA11yV7\(pad, collapsed, autoCollapsed\)[\s\S]*?setAttribute\(['"]aria-expanded['"], String\(!collapsed\)\)[\s\S]*?setAttribute\(['"]aria-hidden['"], collapsed \? ['"]true['"] : ['"]false['"]\)/.test(enhancements),'assistive technology receives the effective expanded/collapsed state');
contract('compact','collapsing transfers focus to visible handle',/function setNudgePadCollapsedV7\(pad, collapsed\)[\s\S]*?collapsed[\s\S]*?querySelector\(['"]\[data-nudge-drag\]['"]\)[\s\S]*?focus\(/.test(enhancements),'focus cannot remain on the collapse button after CSS hides it');
const gridTarget=enhancements.match(/\.bw-nudge-grid>button\{width:(\d+)px;height:(\d+)px/);
const headColumns=enhancements.match(/\.bw-nudge-head\{[^}]*grid-template-columns:minmax\(0,1fr\) (\d+)px (\d+)px/);
const handleTarget=enhancements.match(/\.bw-nudge-collapsed \.bw-nudge-drag\{width:(\d+)px;height:(\d+)px/);
const phoneTargetSizes=[gridTarget&&+gridTarget[1],gridTarget&&+gridTarget[2],headColumns&&+headColumns[1],headColumns&&+headColumns[2],handleTarget&&+handleTarget[1],handleTarget&&+handleTarget[2]];
contract('compact','phone controls meet 44px touch target',phoneTargetSizes.every(value=>Number.isFinite(value)&&value>=44),'direction/head/compact target sizes: '+phoneTargetSizes.join(','));
const expandedShell=enhancements.match(/\.bw-nudge-pad\{[^}]*width:(\d+)px/);
contract('compact','shell boxes contain their 44px controls',Boolean(expandedShell&&+expandedShell[1]>=154&&collapsedShell&&+collapsedShell[1]>=54),'expanded shell '+(expandedShell&&expandedShell[1])+'px contains 3×44px grid plus gaps/padding; compact shell '+(collapsedShell&&collapsedShell[1])+'px contains its 44px handle plus border/padding');

contract('recovery','versioned preference persists normalized coordinates',/NUDGE_PAD_PREF_KEY = ['"]banger\.builder\.nudge\.v7['"]/.test(enhancements)&&/localStorage\.setItem\(NUDGE_PAD_PREF_KEY, JSON\.stringify/.test(enhancements)&&/current\.x = bounds\.maxX === bounds\.minX \? 0 : Math\.max\(0,Math\.min\(1/.test(enhancements),'position survives sessions without storing stale pixels');
contract('recovery','malformed and offscreen preferences recover',/try \{[\s\S]*?JSON\.parse\(localStorage\.getItem\(NUDGE_PAD_PREF_KEY\)[\s\S]*?Number\.isFinite\(stored\.x\)[\s\S]*?Math\.max\(0,Math\.min\(1,stored\.x\)[\s\S]*?\} catch \(_\) \{\}/.test(enhancements),'bad JSON, non-finite values, and coordinates outside 0..1 cannot strand the panel');
contract('recovery','mobile defaults compact and docked lower-left',/fallback = \{x:(?:0|\.02),y:(?:1|\.92),collapsed:mobile,mode\}/.test(enhancements),'first mobile selection exposes a small recoverable handle near the lower-left');
contract('recovery','reset restores known dock and reclamps',/data-nudge-reset[\s\S]*?state\.x = (?:0|\.02); state\.y = (?:1|\.92);[\s\S]*?saveNudgePadPreferenceV7\(\);[\s\S]*?constrainNudgePadV7\(\)/.test(enhancements),'reset restores a valid lower-left position without changing design content');
const exactLowerLeft=/fallback = \{x:0,y:1,collapsed:mobile,mode\}/.test(enhancements)&&/state\.x = 0; state\.y = 1;/.test(enhancements);
const truthfulNearLabel=/data-nudge-reset aria-label=['"][^'"]*near[^'"]*lower left/i.test(enhancements);
contract('recovery','reset label matches dock semantics',exactLowerLeft||truthfulNearLabel,'“Dock lower left” requires normalized x=0/y=1; approximate placement must be labelled near lower-left');

const constrainSource=(enhancements.match(/function constrainNudgePadV7\(\) \{([\s\S]*?)\n  \}\n\n  function setNudgePadCollapsedV7/)||[])[1]||'';
const autoCollapseBranch=(constrainSource.match(/const autoCollapsed =([\s\S]*)/)||[])[1]||'';
contract('transient','automatic compacting is not persisted',transientFixture.cramped.userCollapsed===false&&transientFixture.cramped.autoCollapsed&&transientFixture.cramped.effectiveCollapsed&&transientFixture.cramped.saved===0&&/const autoCollapsed = !state\.collapsed && !expandedNudgeFitsV7\(pad\)/.test(constrainSource)&&!/state\.collapsed\s*=/.test(autoCollapseBranch)&&!/saveNudgePadPreferenceV7\(\)/.test(autoCollapseBranch),'production runtime compacted the short fixture without changing or saving the user’s expanded preference');
contract('transient','room recovery automatically reopens',transientFixture.recovered.userCollapsed===false&&!transientFixture.recovered.autoCollapsed&&!transientFixture.recovered.effectiveCollapsed&&transientFixture.recovered.saved===0&&/const effectiveCollapsed = !!state\.collapsed \|\| autoCollapsed;[\s\S]*?classList\.toggle\(['"]bw-nudge-auto-collapsed['"], autoCollapsed\)[\s\S]*?classList\.toggle\(['"]bw-nudge-collapsed['"], effectiveCollapsed\)/.test(constrainSource),'growing the same production fixture removed transient compact mode without another user action');
contract('transient','class and ARIA commit synchronously',transientFixture.cramped.ariaExpanded==='false'&&transientFixture.cramped.collapseHidden==='true'&&transientFixture.recovered.ariaExpanded==='true'&&transientFixture.recovered.collapseHidden==='false'&&/classList\.toggle\(['"]bw-nudge-auto-collapsed['"], autoCollapsed\);\s*pad\.classList\.toggle\(['"]bw-nudge-collapsed['"], effectiveCollapsed\);\s*updateNudgePadA11yV7\(pad,effectiveCollapsed,autoCollapsed\);/.test(constrainSource),'production runtime kept aria-expanded and hidden collapse controls aligned with both compact and recovered visual states');
contract('transient','automatic compacting recovers hidden focus',transientFixture.cramped.focusTransfers===1&&transientFixture.recovered.focusTransfers===1&&/!wasEffectiveCollapsed && effectiveCollapsed[\s\S]*?pad\.contains\(active\)[\s\S]*?active !== dragHandle[\s\S]*?dragHandle\.focus\(\{preventScroll:true\}\)/.test(constrainSource),'a newly hidden arrow/reset/collapse focus target moves exactly once to the visible drag/open handle');
contract('transient','stored collapse is applied on installation frame',/pad\.appendChild\(head\);\s*pad\.appendChild\(grid\);\s*const initialState = loadNudgePadPreferenceV7\(\);\s*pad\.classList\.toggle\(['"]bw-nudge-collapsed['"], !!initialState\.collapsed\);\s*updateNudgePadA11yV7\(pad,!!initialState\.collapsed,false\);/.test(enhancements),'the saved compact class and ARIA land synchronously before observers or the first paint can expose expanded controls');
contract('transient','unopenable compact control falls back to Layers',transientFixture.counters.layers===1&&transientFixture.counters.expanded===0&&transientFixture.counters.toasts.some(item=>item.kind==='warn'&&/Layers/.test(item.message))&&/function openNudgePadV7\(pad\) \{[\s\S]*?if \(expandedNudgeFitsV7\(pad\)\) \{[\s\S]*?setNudgePadCollapsedV7\(pad,false\);[\s\S]*?return;[\s\S]*?\}\s*openBuilderSheet\(\);\s*toast\(['"][^'"]*Layers[^'"]*['"], ['"]warn['"]\)/.test(enhancements),'the production open handler routed the short fixture to Layers with a warning instead of attempting an offscreen expansion');

const nudgeZ=+(enhancements.match(/#bscr #bd_pad\.bw-nudge-pad\{[^}]*z-index:(\d+)/)||[])[1];
const railZ=+(enhancements.match(/#bscr \.rail\{[^}]*z-index:(\d+)/)||[])[1];
const topZ=Math.max(...[...enhancements.matchAll(/#bscr \.top\{[^}]*z-index:(\d+)/g)].map(match=>+match[1]));
const toolZ=Math.max(...[...enhancements.matchAll(/#bscr (?:#bd_ov )?\.tool\{[^}]*z-index:(\d+)/g)].map(match=>+match[1]));
contract('clearance','Nudge stays below navigation and add rail',Number.isFinite(nudgeZ)&&nudgeZ<railZ&&nudgeZ<topZ,'z-order '+nudgeZ+' < rail '+railZ+' and mobile top '+topZ);
const toolbarCollisionAware=/nudge[\s\S]{0,1000}?(?:toolRect|selectionTool|#bd_ov \.tool)[\s\S]{0,1000}?(?:intersect|overlap|collision)/i.test(enhancements);
contract('clearance','essential selection toolbar remains tappable',Number.isFinite(toolZ)&&toolZ>nudgeZ||toolbarCollisionAware,'selection toolbar z-order '+toolZ+' must exceed Nudge '+nudgeZ+' unless collision avoidance is implemented');
contract('clearance','mobile selected pad is not hidden',/@media\(max-width:520px\)\{[\s\S]*?#bscr #bd_pad\.bw-nudge-pad\.on\{display:block!important\}/.test(enhancements),'phone widths expose the compact movable control instead of the old forced hide');
contract('clearance','overlay and format layout also reconstrain',/function constrainBuilderControls\(\)[\s\S]*?constrainNudgePadV7\(\);/.test(enhancements)&&/requestAnimationFrame\(\(\)=>\{applyFoundationLock\(\);window\.__bapi\.layout\(\);constrainBuilderControls\(\);\}\)/.test(enhancements),'canvas overlay/layout updates cannot leave the panel stale or offscreen');

const failures=contracts.filter(item=>!item.pass);
assert.equal(failures.length,0,JSON.stringify(failures,null,2));

const byArea=Object.fromEntries([...new Set(contracts.map(item=>item.area))].map(area=>[
  area,contracts.filter(item=>item.area===area).length
]));
process.stdout.write(JSON.stringify({
  contracts:contracts.length,
  passed:contracts.length,
  failed:0,
  byArea,
  viewportWidths:[320,360,390,1280],
  viewportBounds:viewportResults,
})+'\n');
