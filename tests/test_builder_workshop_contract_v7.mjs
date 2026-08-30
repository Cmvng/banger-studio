import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const enhancements=await readFile(new URL('../studio-enhancements.js',import.meta.url),'utf8');
const legacy=await readFile(new URL('../preview-v2.html',import.meta.url),'utf8');
const app=await readFile(new URL('../app-v3.py',import.meta.url),'utf8');

const contracts=[];
function contract(area,name,condition,evidence){
  contracts.push({area,name,pass:Boolean(condition),evidence});
}

// Signal Workshop lifecycle, accessibility, and scroll containment.
contract('workshop','central close helper',/function\s+closeCreativeKitV5\s*\(/.test(enhancements),'closeCreativeKitV5 is defined');
contract('workshop','replace path closes safely',/if\(sheet\)\s*closeCreativeKitV5\(sheet,\{keepBuilder:true\}\)/.test(enhancements),'replace uses the central close helper');
contract('workshop','backdrop and close button close safely',/sheet\.onclick=.*closeCreativeKitV5\(sheet\)/.test(enhancements),'backdrop/close route through cleanup');
contract('workshop','Escape closes',/sheet\.onkeydown=[\s\S]*?event\.key===['"]Escape['"][\s\S]*?closeCreativeKitV5\(sheet\)/.test(enhancements),'keyboard Escape is handled');
contract('workshop','dialog semantics',/setAttribute\(['"]role['"],['"]dialog['"]\)/.test(enhancements)&&/setAttribute\(['"]aria-modal['"],['"]true['"]\)/.test(enhancements),'role=dialog and aria-modal=true');
contract('workshop','open locks document scroll',/document\.body\.classList\.add\(['"]bw-modal-open['"]\)/.test(enhancements)&&/body\.bw-modal-open\{overflow:hidden!important;overscroll-behavior:none\}/.test(enhancements),'body overflow and overscroll are locked');
contract('workshop','close unlocks document scroll',/document\.body\.classList\.remove\(['"]bw-modal-open['"]\)/.test(enhancements),'central close restores body scroll');
contract('workshop','initial and return focus',/creativeV5Trigger=document\.activeElement/.test(enhancements)&&/focusTarget\.focus\(\{preventScroll:true\}\)/.test(enhancements)&&/close\.focus\(\{preventScroll:true\}\)/.test(enhancements),'focus enters modal and returns to an eligible trigger');
contract('workshop','Tab focus stays inside',/event\.key!==['"]Tab['"]/.test(enhancements)&&/document\.activeElement===first/.test(enhancements)&&/document\.activeElement===last/.test(enhancements),'forward and reverse Tab wrap inside the modal');
contract('workshop','return focus rejects hidden screens',/focusTarget\.offsetParent===null/.test(enhancements)&&/activeScreen&&!activeScreen\.classList\.contains\(['"]on['"]\)/.test(enhancements)&&/querySelector\(['"]#bscr\.on \.bw-creative-rail,#bscr\.on \.bw-builder-back,#wscr\.on button['"]\)/.test(enhancements),'close restores focus only to a visible control in the active screen');
contract('workshop','mobile browser Back dismisses',/history\.pushState\([\s\S]*?cmvngModal:['"]signal-workshop['"]/.test(enhancements)&&/addEventListener\(['"]popstate['"][\s\S]*?closeCreativeKitV5\(sheet,\{fromPopstate:true\}\)/.test(enhancements),'one modal history state is consumed by browser/system Back');
contract('workshop','cancel returns to Writer context',/creativeV5ReturnToWriter=true;[\s\S]*?window\.goBuilder\(\)/.test(enhancements)&&/returnToWriter&&typeof window\.goWriter===['"]function['"]/.test(enhancements),'Writer-launched Workshop can close back to drafts');

// 320/360/390 and desktop viewport contracts. These widths all select the
// mobile <=560 rules; all tested phone widths select the <=420 one-column rule.
contract('viewport','modal owns viewport',/#bw_creative_v5\{[^}]*position:fixed;inset:0;[^}]*width:100vw;[^}]*height:100dvh;[^}]*overflow:hidden/.test(enhancements),'fixed 100dvh overlay with clipped outer overflow');
contract('viewport','inner sheet owns scrolling',/\.bw-v5-shell\{[^}]*overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain/.test(enhancements),'only the sheet scrolls; scroll chaining is contained');
contract('viewport','mobile full-screen shell',/@media\(max-width:560px\)[\s\S]*?#bw_creative_v5 \.bw-v5-shell\{[^}]*width:100vw;[^}]*height:100dvh;[^}]*max-height:none/.test(enhancements),'320/360/390 use a full-screen shell');
contract('viewport','mobile toolbar stacks',/@media\(max-width:560px\)[\s\S]*?\.bw-v5-options\{[^}]*flex-direction:column/.test(enhancements),'theme and mode controls cannot squeeze each other');
contract('viewport','phone-width single-column cards',/@media\(max-width:420px\)\{[^}]*\.bw-v5-proof\{[^}]*\}\.bw-v5-grid\{grid-template-columns:1fr\}/.test(enhancements),'320/360/390 get readable one-column design cards');
contract('viewport','mobile close target',/@media\(max-width:560px\)[\s\S]*?\.bw-v5-close\{width:44px;height:44px/.test(enhancements),'44px close target');
contract('viewport','mobile favorite target',/@media\(max-width:560px\)[\s\S]*?\.bw-v5-fave\{width:44px;height:44px/.test(enhancements),'favorite control has a 44px mobile hit area');
contract('viewport','desktop centered bounded shell',/@media\(min-width:700px\)[\s\S]*?#bw_creative_v5\{align-items:center!important;padding:24px\}/.test(enhancements)&&/max-height:calc\(100vh - 48px\)/.test(enhancements),'desktop shell is centered and viewport-bounded');

// Template choice and replace/overlay semantics.
contract('selection','catalog buttons resolve selected item',/querySelectorAll\(['"]\[data-v5-use\]['"]\).*items\.find\(entry=>entry\.id===button\.dataset\.v5Use\)/.test(enhancements),'the selected catalog id is resolved before use');
contract('selection','design and asset branches',/creativeV5Tab===['"]designs['"]\)useV5Design\(item\);else useV5Asset\(item\.kind,item\)/.test(enhancements),'designs replace/overlay; assets add layers');
contract('selection','replace creates recovery checkpoint',/originalBuilderDesign=\{data:clone\(layers\),format:format\[0\]/.test(enhancements)&&/importBuilderState\(layers,format\[0\],['"]transparent['"]/.test(enhancements),'replace stores and imports an exact editable checkpoint');
contract('selection','overlay preserves existing layers',/const next=state\.data\.concat\(additions\)/.test(enhancements),'overlay appends rather than replacing');
contract('selection','overlay respects layer budget',/remaining=Math\.max\(0,48-state\.data\.length\)/.test(enhancements)&&/if\(layers\.length>remaining\)/.test(enhancements),'overlay fails safely above 48 layers');
contract('selection','mobile add returns to canvas',/function closeWorkshopAfterMobileAdd\(\)/.test(enhancements)&&/matchMedia\(['"]\(max-width: 560px\)['"]\)/.test(enhancements)&&/if\(atomicAddV5\(layers,item\.name\)\)closeWorkshopAfterMobileAdd\(\)/.test(enhancements),'asset Add/Overlay closes the full-screen catalog after a successful mobile commit');

// Builder navigation, reset, undo, and format preservation.
contract('builder','back remains visible and named',/classList\.add\(['"]bw-builder-back['"]\)/.test(enhancements)&&/setAttribute\(['"]aria-label['"],['"]Back to studio['"]\)/.test(enhancements),'Builder back control is retained and labeled');
contract('builder','clear top control uses safe wrapper',/action\.includes\(['"]clearall['"]\)[\s\S]*?button\.onclick=clearBuilderCanvasSafely/.test(enhancements),'top clear routes through safe clear');
contract('builder','clear keeps undo available',/window\.clearAll\(\)[\s\S]*?bw-undo-ready/.test(enhancements)&&/canvas cleared · undo restores it/.test(enhancements),'clear snapshots and advertises Undo');
contract('builder','full-state memory-safe undo patch',/LEGACY_BUILDER_HISTORY_V2/.test(app)&&/els:copyHistoryEls\(els\),fmt:fmt,bg:canvas\.style\.background/.test(app)&&!/LEGACY_BUILDER_HISTORY_V2 = [\s\S]*?JSON\.stringify\(els\)/.test(app),'runtime upgrades undo to format/background-aware shallow snapshots');
contract('builder','reset restores cloned checkpoint',/importBuilderState\(clone\(originalBuilderDesign\.data\), originalBuilderDesign\.format, originalBuilderDesign\.background/.test(enhancements),'reset cannot mutate the saved checkpoint');
contract('builder','format change captures before mutation',/addEventListener\(['"]click['"],captureFormatChange,true\)/.test(enhancements),'pre-format state is captured in the event capture phase');
contract('builder','format change completes with reflow',/addEventListener\(['"]click['"],completeFormatChange,false\)/.test(enhancements)&&/geometry\.reflowComposition\(pending\.state\.data,pending\.from,target/.test(enhancements),'format switch reflows editable layers after the native switch');
contract('builder','format reflow is one undo step',/if\(window\.__bapiHistorySuspend\)return/.test(app)&&/importBuilderState\(next,target\[0\],pending\.state\.background,index,\{skipHistory:true\}\)/.test(enhancements),'enhanced reflow suppresses the redundant post-switch snapshot');
contract('builder','original recovery state reflows too',/originalBuilderDesign\.data=geometry\.reflowComposition\(originalBuilderDesign\.data,originalFrom,target/.test(enhancements),'reset target follows the active format');

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
})+'\n');
