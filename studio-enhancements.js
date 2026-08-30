(function () {
  'use strict';

  if (typeof T === 'undefined' || !window.__bapi) return;

  const ENH_VERSION = '7.0.0';
  const TEMPLATE_DRAFT_PREFIX = 'banger.template.';
  const BUILDER_DRAFT_KEY = 'banger.builder.autosave.v2';
  const BRAND_LOGO = '/assets/cmvng-logo.png';
  let templateSaveTimer = 0;
  let builderSaveTimer = 0;
  let selectedBuilderId = null;
  let suppressTemplateSave = false;
  let suppressBuilderSave = false;
  let foundationSrc = '';
  let foundationBuilderId = null;
  let foundationLocked = true;
  let originalBuilderDesign = null;
  let activeCreativeDesignId = '';
  let pendingFormatChange = null;

  const escEnh = value => String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function toast(message, tone) {
    let node = document.getElementById('bw_toast');
    if (!node) {
      node = document.createElement('div');
      node.id = 'bw_toast';
      node.setAttribute('role', 'status');
      node.setAttribute('aria-live', 'polite');
      document.body.appendChild(node);
    }
    node.className = 'on ' + (tone || '');
    node.textContent = message;
    clearTimeout(node.__timer);
    node.__timer = setTimeout(() => node.className = '', 2600);
  }

  function injectEnhancementStyles() {
    if (document.getElementById('bw_enhancement_style')) return;
    const style = document.createElement('style');
    style.id = 'bw_enhancement_style';
    style.textContent = `
      #bw_toast{position:fixed;left:50%;bottom:22px;transform:translate(-50%,18px);z-index:5000;
        max-width:min(520px,calc(100vw - 28px));padding:11px 16px;border-radius:999px;background:#101C33;
        color:#fff;font:700 12px 'Space Mono',monospace;letter-spacing:.02em;box-shadow:0 16px 38px -12px rgba(12,27,51,.55);
        opacity:0;pointer-events:none;transition:.2s ease}
      #bw_toast.on{opacity:1;transform:translate(-50%,0)}
      #bw_toast.ok{background:#17623B}#bw_toast.warn{background:#8A5B11}#bw_toast.bad{background:#A22F49}
      .bw-panel-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:-2px 0 14px}
      .bw-panel-actions button{border:1px solid #cddaf0;background:#F4F8FF;color:#20386A;border-radius:11px;
        padding:10px 8px;font:800 11px 'Space Mono',monospace;cursor:pointer}
      .bw-panel-actions button:first-child{background:#E3ECFF;border-color:#9DBDF9;color:#123A9E}
      .bw-autosave-note{grid-column:1/-1;color:#6C82AB;font:600 10px 'Space Mono',monospace;text-align:center}
      #panel textarea.bw-field{width:100%;box-sizing:border-box;border:2px solid var(--b100);border-radius:11px;
        padding:11px 12px;background:#FAFCFF;color:#0C1B33;font:600 14px 'Sora',sans-serif;line-height:1.45;
        min-height:84px;resize:vertical;outline:none}
      #panel textarea.bw-field:focus,#panel .bw-list-input:focus{border-color:#2E6BFF;box-shadow:0 0 0 3px rgba(46,107,255,.12)}
      .bw-field-meta{display:flex;justify-content:space-between;gap:8px;margin-top:5px;color:#7E93C4;
        font:600 9.5px 'Space Mono',monospace}
      .bw-list-help{margin:-2px 0 8px;color:#6C82AB;font:600 10px 'Space Mono',monospace;line-height:1.4}
      .bw-list-head{display:grid;gap:6px;margin-bottom:5px;padding-right:32px}
      .bw-list-head span{font:700 9px 'Space Mono',monospace;color:#6C82AB;text-transform:uppercase;letter-spacing:.06em}
      .bw-list-row{display:grid;gap:6px;align-items:center;margin-bottom:7px}
      .bw-list-input{min-width:0;width:100%;box-sizing:border-box;border:2px solid var(--b100);border-radius:9px;
        padding:9px 9px;background:#FAFCFF;color:#0C1B33;font:600 12.5px 'Sora',sans-serif;outline:none}
      .bw-list-remove{width:28px;height:34px;border:0;border-radius:9px;background:#FDECEF;color:#B23A54;
        font:800 17px 'Sora';cursor:pointer}
      .bw-list-add{width:100%;border:1px dashed #9DBDF9;border-radius:10px;padding:9px;background:#F4F8FF;
        color:#123A9E;font:800 11px 'Space Mono',monospace;cursor:pointer}
      .bw-img-actions{position:absolute;left:3px;right:3px;bottom:3px;display:flex;justify-content:center;gap:3px;z-index:4}
      .bw-img-actions button{width:24px;height:22px;border:0;border-radius:7px;background:rgba(12,27,51,.88);
        color:#fff;font:800 11px 'Sora';padding:0;cursor:pointer}
      .bw-drop-note{width:100%;margin-top:7px;color:#7E93C4;font:600 9.5px 'Space Mono',monospace}
      .bw-design-fit{margin-top:12px;padding:11px;border:1px solid #d6e2f5;border-radius:12px;background:#F8FAFF}
      .bw-design-fit-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:9px;
        color:#42588A;font:700 10px 'Space Mono',monospace;text-transform:uppercase;letter-spacing:.08em}
      .bw-design-fit-head b{color:#123A9E;font-size:11px}
      .bw-design-choices{display:flex;gap:6px;overflow-x:auto;padding-bottom:2px}
      .bw-design-choice{flex:none;border:1px solid #cddaf0;border-radius:999px;background:#fff;color:#42588A;
        padding:7px 10px;font:700 10px 'Space Mono',monospace;cursor:pointer;white-space:nowrap}
      .bw-design-choice.on{background:#E3ECFF;border-color:#2E6BFF;color:#123A9E}
      .bw-build-actions{display:grid;grid-template-columns:1.35fr 1fr;gap:8px;margin-top:9px}
      .bw-build-now,.bw-edit-first{border:0;border-radius:11px;padding:11px 10px;font:800 11px 'Space Mono',monospace;cursor:pointer}
      .bw-build-now{background:linear-gradient(180deg,#2E6BFF,#123A9E);color:#fff}
      .bw-edit-first{background:#EEF3FD;color:#20386A;border:1px solid #cddaf0}
      #bscr .tool{max-width:calc(100vw - 20px);overflow-x:auto;scrollbar-width:none}
      #bscr .tool::-webkit-scrollbar{display:none}
      #bw_builder_sheet{display:none;position:fixed;inset:0;background:rgba(12,27,51,.45);z-index:1800}
      #bw_builder_sheet.on{display:block}
      #bw_builder_sheet .bw-sheet{position:absolute;left:0;right:0;bottom:0;max-height:72vh;overflow:auto;
        background:#fff;border-radius:22px 22px 0 0;padding:14px 14px calc(16px + env(safe-area-inset-bottom));
        box-shadow:0 -18px 46px rgba(12,27,51,.3)}
      .bw-sheet-head{display:flex;align-items:center;gap:10px;margin-bottom:12px}
      .bw-sheet-head b{font:800 16px 'Sora';color:#101C33}.bw-sheet-head small{font:600 10px 'Space Mono';color:#6C82AB}
      .bw-sheet-head button{margin-left:auto;width:38px;height:38px;border:0;border-radius:11px;background:#EEF3FD;color:#20386A;font-size:20px}
      .bw-inspector-section{border:1px solid #dce6f5;border-radius:14px;padding:11px;margin-bottom:10px;background:#F8FAFF}
      .bw-inspector-section>label{display:block;margin-bottom:8px;font:700 9.5px 'Space Mono';color:#6C82AB;
        text-transform:uppercase;letter-spacing:.08em}
      .bw-control-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}
      .bw-control-grid.three{grid-template-columns:repeat(3,minmax(0,1fr))}
      .bw-ctrl{border:1px solid #cddaf0;background:#fff;color:#20386A;border-radius:10px;padding:10px 8px;
        font:800 10.5px 'Space Mono';cursor:pointer}
      .bw-ctrl.primary{background:#E3ECFF;border-color:#9DBDF9;color:#123A9E}
      .bw-ctrl.danger{background:#FDECEF;border-color:#F3B6C2;color:#B23A54}
      .bw-range{display:grid;grid-template-columns:80px 1fr 44px;gap:8px;align-items:center;margin:8px 0}
      .bw-range span{font:700 10px 'Space Mono';color:#42588A}.bw-range output{font:700 10px 'Space Mono';color:#123A9E;text-align:right}
      .bw-layer{display:grid;grid-template-columns:28px minmax(0,1fr) 66px;gap:8px;align-items:center;
        padding:8px 7px;border-bottom:1px solid #e8eef8;cursor:pointer}
      .bw-layer:last-child{border-bottom:0}.bw-layer.on{background:#EAF1FF;border-radius:9px}
      .bw-layer i{width:24px;height:24px;border-radius:7px;background:#E3ECFF;color:#123A9E;
        display:flex;align-items:center;justify-content:center;font:800 9px 'Space Mono';font-style:normal}
      .bw-layer span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:700 11px 'Sora';color:#20386A}
      .bw-layer small{font:600 9px 'Space Mono';color:#7E93C4;text-align:right}
      .bw-color-row{display:flex;align-items:center;gap:9px}.bw-color-row input[type=color]{width:52px;height:38px;
        border:1px solid #cddaf0;border-radius:10px;padding:3px;background:#fff}
      .bw-color-row input[type=text]{flex:1;min-width:0;border:1px solid #cddaf0;border-radius:10px;padding:10px;
        font:700 11px 'Space Mono';color:#20386A}
      #bscr .top .bw-top-tool{padding:9px 10px}
      #bscr .rail .bw-rail-new .ic{background:linear-gradient(155deg,#E8E1FF,#CFC2FF);color:#4F2DB6}
      button:focus-visible,input:focus-visible,textarea:focus-visible{outline:3px solid rgba(46,107,255,.3);outline-offset:2px}
      @media(max-width:560px){
        .bw-build-actions{grid-template-columns:1fr}
        .bw-panel-actions{grid-template-columns:1fr}
        #bscr .top{gap:5px}
        #bscr .top .ghost,#bscr .top .exp{font-size:10px;padding:8px 9px}
        #bscr .top .bw-hide-small{display:none}
        .bw-control-grid.three{grid-template-columns:1fr}
      }
    `;
    document.head.appendChild(style);
  }

  function injectExperienceStyles() {
    if (document.getElementById('bw_experience_style')) return;
    const style = document.createElement('style');
    style.id = 'bw_experience_style';
    style.textContent = `
      .bw-home-lab{position:relative;overflow:hidden;margin-top:14px;border-radius:22px;padding:20px;
        color:#fff;background:linear-gradient(135deg,#09172E 0%,#123A9E 56%,#2E6BFF 100%);
        box-shadow:0 24px 54px -22px rgba(12,27,51,.72);isolation:isolate}
      .bw-home-lab:before{content:'';position:absolute;width:240px;height:240px;border-radius:50%;right:-110px;top:-130px;
        background:rgba(255,255,255,.14);box-shadow:-120px 210px 0 rgba(132,255,207,.09);z-index:-1}
      .bw-home-kicker,.bw-writer-kicker{display:flex;align-items:center;gap:7px;font:800 9.5px 'Space Mono',monospace;
        letter-spacing:.12em;text-transform:uppercase}
      .bw-home-kicker{color:#A9C3FF}.bw-home-kicker i,.bw-writer-kicker i{width:7px;height:7px;border-radius:50%;
        background:#68F0B2;box-shadow:0 0 0 5px rgba(104,240,178,.12)}
      .bw-home-lab h2{max-width:330px;margin:10px 0 7px;font:800 25px/1.06 'Sora',sans-serif;letter-spacing:-.035em}
      .bw-home-lab h2 em{font:italic 400 28px 'Instrument Serif',serif;color:#B8D2FF}
      .bw-home-lab p{max-width:315px;margin:0;color:rgba(255,255,255,.72);font:550 11.5px/1.55 'Sora',sans-serif}
      .bw-home-proof{display:flex;gap:6px;flex-wrap:wrap;margin:13px 0 15px}
      .bw-home-proof span{padding:6px 8px;border:1px solid rgba(255,255,255,.16);border-radius:999px;
        background:rgba(255,255,255,.08);font:700 8.5px 'Space Mono',monospace;color:#D8E5FF;backdrop-filter:blur(5px)}
      .bw-home-actions{display:flex;gap:8px}.bw-home-start,.bw-home-browse{border:0;border-radius:12px;padding:11px 13px;
        font:800 11px 'Sora',sans-serif;cursor:pointer}
      .bw-home-start{background:#fff;color:#123A9E;box-shadow:0 11px 22px -12px rgba(0,0,0,.55)}
      .bw-home-browse{color:#fff;background:rgba(255,255,255,.11);border:1px solid rgba(255,255,255,.16)}
      .bw-home-stack{position:absolute;right:12px;bottom:14px;width:118px;height:142px;pointer-events:none}
      .bw-home-card{position:absolute;width:80px;aspect-ratio:4/5;border-radius:9px;overflow:hidden;border:2px solid rgba(255,255,255,.7);
        background:#EDF3FC;box-shadow:0 14px 25px -10px rgba(0,0,0,.5);transform-origin:center}
      .bw-home-card:nth-child(1){right:33px;top:19px;transform:rotate(-10deg)}
      .bw-home-card:nth-child(2){right:8px;top:9px;transform:rotate(7deg)}
      .bw-home-card:nth-child(3){right:21px;top:1px;transform:rotate(0)}
      .bw-template-mini{position:absolute;left:0;top:0;width:1080px;height:1350px;transform-origin:0 0;pointer-events:none}
      .bw-build-badge{position:absolute;right:14px;top:14px;border:1px solid rgba(255,255,255,.24);border-radius:999px;
        padding:6px 9px;background:rgba(7,19,40,.36);font:800 8px 'Space Mono';color:#fff;backdrop-filter:blur(8px)}

      .bw-writer-hero{position:relative;margin:-2px -2px 14px;padding:18px;border-radius:18px;overflow:hidden;
        background:linear-gradient(140deg,#101C33,#123A9E 72%,#2E6BFF);color:#fff;box-shadow:0 20px 40px -24px rgba(12,27,51,.8)}
      .bw-writer-hero:after{content:'';position:absolute;right:-45px;top:-55px;width:150px;height:150px;border-radius:50%;
        border:28px solid rgba(255,255,255,.07)}
      .bw-writer-kicker{color:#A9C3FF}.bw-writer-hero h2{margin:8px 0 6px;max-width:300px;font:800 22px/1.08 'Sora';letter-spacing:-.035em}
      .bw-writer-hero h2 em{font:italic 400 25px 'Instrument Serif';color:#B8D2FF}
      .bw-writer-hero p{margin:0;max-width:330px;color:rgba(255,255,255,.7);font:550 11px/1.5 'Sora'}
      .bw-flow{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:14px}
      .bw-flow-step{position:relative;padding:8px 7px;border-radius:10px;background:rgba(255,255,255,.08);
        color:rgba(255,255,255,.58);font:700 8px 'Space Mono';text-transform:uppercase;letter-spacing:.06em}
      .bw-flow-step b{display:flex;align-items:center;justify-content:center;width:18px;height:18px;margin-bottom:5px;border-radius:6px;
        background:rgba(255,255,255,.12);font-size:9px;color:#fff}
      .bw-flow-step.on{background:#fff;color:#123A9E}.bw-flow-step.on b{background:#E3ECFF;color:#123A9E}
      .bw-flow-step.done{background:rgba(104,240,178,.13);color:#8FF6C6}.bw-flow-step.done b{background:#68F0B2;color:#0B4930}
      #wscr .bw-card.bw-input-card{border-radius:20px;padding:12px;background:rgba(255,255,255,.72);backdrop-filter:blur(12px)}
      #wscr .bw-input-card>.bw-lab{margin-top:10px}.bw-research-ready{margin:8px 0 12px;padding:12px;border-radius:14px;
        border:1px solid #B9E6CB;background:linear-gradient(135deg,#F0FFF7,#E4F7EC);color:#17623B}
      .bw-research-ready b{display:block;font:800 12px 'Sora';margin-bottom:3px}.bw-research-ready span{font:600 9.5px/1.45 'Space Mono'}
      .bw-results-banner{display:flex;align-items:center;gap:10px;margin:13px 0 11px;padding:12px;border-radius:15px;
        background:#101C33;color:#fff;box-shadow:0 14px 28px -20px rgba(12,27,51,.75)}
      .bw-results-banner i{width:34px;height:34px;border-radius:11px;background:linear-gradient(145deg,#68F0B2,#18B27B);
        color:#073C28;display:flex;align-items:center;justify-content:center;font:900 16px 'Sora';font-style:normal}
      .bw-results-banner b{display:block;font:800 12px 'Sora'}.bw-results-banner small{display:block;margin-top:2px;color:#A9B9D6;font:600 9px 'Space Mono'}

      .bw-design-fit{padding:0;border:0;background:transparent;margin-top:15px}
      .bw-design-fit-head{margin-bottom:9px;padding-top:12px;border-top:1px solid #DFE8F6}
      .bw-design-fit-head span{display:flex;align-items:center;gap:6px}.bw-design-fit-head span:before{content:'';width:7px;height:7px;border-radius:50%;background:#18B27B}
      .bw-design-gallery{display:flex;gap:10px;overflow-x:auto;padding:2px 2px 12px;scroll-snap-type:x mandatory;scrollbar-width:none}
      .bw-design-gallery::-webkit-scrollbar{display:none}
      .bw-design-card{position:relative;flex:0 0 min(64vw,235px);scroll-snap-align:start;border:2px solid transparent;border-radius:17px;
        padding:7px;background:#F4F8FF;text-align:left;cursor:pointer;box-shadow:0 12px 26px -20px rgba(18,58,158,.65);transition:.18s ease}
      .bw-design-card.on{border-color:#2E6BFF;background:#fff;box-shadow:0 17px 32px -18px rgba(18,58,158,.5);transform:translateY(-2px)}
      .bw-design-visual{position:relative;width:100%;aspect-ratio:4/5;border-radius:12px;overflow:hidden;background:#EDF3FC}
      .bw-design-score{position:absolute;right:7px;top:7px;z-index:3;padding:5px 7px;border-radius:999px;background:rgba(12,27,51,.84);
        color:#fff;font:800 8px 'Space Mono';backdrop-filter:blur(5px)}
      .bw-design-card.on .bw-design-score{background:#18B27B;color:#073C28}
      .bw-design-meta{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:5px;padding:9px 5px 5px;align-items:start}
      .bw-design-meta b{font:800 12px/1.2 'Sora';color:#101C33;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .bw-design-meta span{grid-column:1/-1;font:600 8.5px/1.4 'Space Mono';color:#6C82AB}
      .bw-design-kind{text-decoration:none;color:#123A9E;font-weight:850;text-transform:uppercase;letter-spacing:.05em}
      .bw-design-check{width:19px;height:19px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:#E3ECFF;
        color:#123A9E;font:900 10px 'Sora'}.bw-design-card.on .bw-design-check{background:#2E6BFF;color:#fff}
      .bw-selected-fit{display:flex;align-items:flex-start;gap:9px;margin:0 1px 10px;padding:10px;border-radius:12px;background:#EEF3FD}
      .bw-selected-fit i{width:26px;height:26px;flex:0 0 auto;border-radius:9px;background:#E3ECFF;color:#123A9E;
        display:flex;align-items:center;justify-content:center;font:900 12px 'Sora';font-style:normal}
      .bw-selected-fit b{display:block;color:#20386A;font:800 10px 'Sora'}.bw-selected-fit span{display:block;margin-top:2px;color:#6C82AB;font:600 8.5px/1.4 'Space Mono'}
      .bw-build-now{padding:13px 11px;box-shadow:0 13px 24px -13px rgba(18,58,158,.8)}
      .bw-editor-intro{margin:0 0 12px;padding:12px 13px;border-radius:14px;color:#fff;
        background:linear-gradient(135deg,#101C33,#123A9E);box-shadow:0 13px 28px -20px rgba(12,27,51,.75)}
      .bw-editor-intro span{font:800 8.5px 'Space Mono';letter-spacing:.1em;text-transform:uppercase;color:#A9C3FF}
      .bw-editor-intro b{display:block;margin:5px 0 2px;font:800 13px 'Sora'}.bw-editor-intro small{font:600 9px/1.4 'Space Mono';color:#C5D5F1}
      .bw-builder-coach{position:absolute;left:50%;top:58px;z-index:75;width:min(310px,calc(100vw - 30px));transform:translateX(-50%);
        padding:13px;border:1px solid rgba(255,255,255,.75);border-radius:16px;background:rgba(16,28,51,.94);color:#fff;
        box-shadow:0 20px 44px -15px rgba(12,27,51,.75);backdrop-filter:blur(12px)}
      .bw-builder-coach b{display:block;font:800 12px 'Sora'}.bw-builder-coach p{margin:4px 0 10px;color:#B8C8E3;font:600 9px/1.5 'Space Mono'}
      .bw-builder-coach button{width:100%;border:0;border-radius:10px;padding:9px;background:#fff;color:#123A9E;font:800 10px 'Sora'}
      #bscr .top{background:rgba(237,243,252,.88);backdrop-filter:blur(10px);position:relative;z-index:20}
      #bscr .rail{background:linear-gradient(180deg,rgba(237,243,252,.45),#EDF3FC 45%)}
      #bscr .add:hover{transform:translateY(-2px);box-shadow:0 14px 25px -14px rgba(18,58,158,.5)}
      .bw-official-logo{display:block;width:142px;height:38px;object-fit:cover;object-position:center;border-radius:9px;background:#191919}
      #home .hdr.bw-branded .mark,#home .hdr.bw-branded .word{display:none}
      #home .hdr.bw-branded .bw-official-logo{margin-right:auto}
      .wtop.bw-branded .mk,.wtop.bw-branded .t{display:none}.wtop.bw-branded .bw-official-logo{width:126px;height:34px}
      #bscr .top.bw-branded .mk,#bscr .top.bw-branded .bdword{display:none}#bscr .top.bw-branded .bw-official-logo{width:100px;height:30px}
      .bw-source-help{display:none;margin:-4px 0 10px;padding:9px 10px;border-radius:10px;background:#FFF3DC;color:#8A5B12;
        font:650 9px/1.45 'Space Mono',monospace}.bw-source-help.on{display:block}
      .bw-research-progress{margin:7px 0 11px;padding:11px;border-radius:12px;background:linear-gradient(135deg,#EEF3FD,#E4EEFF);
        color:#20386A;font:700 9.5px/1.45 'Space Mono',monospace}
      #bw_creative_sheet{position:fixed;inset:0;z-index:10080;display:none;align-items:flex-end;justify-content:center;background:rgba(7,17,36,.52);backdrop-filter:blur(5px)}
      #bw_creative_sheet.on{display:flex}#bw_creative_sheet .bw-kit{width:min(680px,100%);max-height:88vh;overflow:auto;padding:15px 14px 24px;
        border-radius:22px 22px 0 0;background:#F7FAFF;box-shadow:0 -25px 60px -28px rgba(12,27,51,.8)}
      .bw-kit-head{position:sticky;top:-15px;z-index:4;display:flex;align-items:center;gap:10px;margin:-15px -14px 13px;padding:14px;
        background:rgba(247,250,255,.94);border-bottom:1px solid #DFE8F6;backdrop-filter:blur(12px)}
      .bw-kit-head img{width:92px;height:28px;object-fit:cover;border-radius:7px}.bw-kit-head div{flex:1}.bw-kit-head b{display:block;font:800 13px 'Sora';color:#101C33}
      .bw-kit-head small{display:block;margin-top:2px;font:650 8px 'Space Mono';color:#6C82AB}.bw-kit-head button{border:0;background:#E8EFFB;color:#20386A;
        width:31px;height:31px;border-radius:10px;font:800 17px 'Sora'}
      .bw-kit-tabs{display:flex;gap:6px;overflow-x:auto;padding-bottom:10px;scrollbar-width:none}.bw-kit-tabs::-webkit-scrollbar{display:none}
      .bw-kit-tab{flex:0 0 auto;border:1px solid #D6E2F5;border-radius:999px;padding:8px 11px;background:#fff;color:#5D719A;font:750 9px 'Space Mono'}
      .bw-kit-tab.on{border-color:#2E6BFF;background:#123A9E;color:#fff}.bw-kit-section{display:none}.bw-kit-section.on{display:block}
      .bw-kit-note{margin:1px 1px 10px;color:#6C82AB;font:600 9px/1.5 'Space Mono'}.bw-kit-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
      .bw-kit-card{position:relative;min-height:116px;border:1px solid #D6E2F5;border-radius:15px;padding:11px;background:#fff;text-align:left;overflow:hidden;
        box-shadow:0 12px 26px -22px rgba(18,58,158,.65)}.bw-kit-card:active{transform:scale(.985)}
      .bw-kit-card b{position:relative;z-index:2;display:block;font:800 11px 'Sora';color:#101C33}.bw-kit-card span{position:relative;z-index:2;display:block;margin-top:4px;
        max-width:125px;font:600 8px/1.4 'Space Mono';color:#7185AA}.bw-kit-card i{position:absolute;right:8px;bottom:7px;color:#2E6BFF;font:900 10px 'Sora';font-style:normal}
      .bw-type-demo{height:65px;margin-bottom:8px;border-radius:10px;padding:8px;background:#101C33;color:#fff;overflow:hidden}.bw-type-demo small{display:block;color:#78A1FF;
        font:800 6px 'Space Mono';letter-spacing:.12em;text-transform:uppercase}.bw-type-demo strong{display:block;margin-top:4px;font:850 17px/1 'Sora';letter-spacing:-.05em}.bw-type-demo em{font:italic 400 17px 'Instrument Serif';color:#9DBDF9}
      .bw-char-demo{height:72px;margin:-3px 0 7px;display:flex;align-items:center;justify-content:center}.bw-char-demo svg{height:72px;max-width:100%}
      .bw-doodle-demo{height:58px;margin-bottom:7px;display:flex;align-items:center;justify-content:center}.bw-doodle-demo svg{height:54px;max-width:100%}
      .bw-layout-demo{height:64px;margin-bottom:8px;border-radius:9px;background:#EAF1FF;border:1px solid #CFDDF4;padding:7px;display:grid;gap:4px}
      .bw-layout-demo u{display:block;text-decoration:none;border-radius:4px;background:#123A9E}.bw-layout-demo u:nth-child(2){width:72%;background:#8FB2F6}.bw-layout-demo u:nth-child(3){width:45%;background:#C6D7F5}
      .bw-kit-search{position:sticky;top:56px;z-index:3;display:flex;gap:7px;margin:0 0 9px;padding:8px 0;background:#F7FAFF}
      .bw-kit-search input{min-width:0;flex:1;border:1px solid #CCD9EF;border-radius:11px;background:#fff;padding:10px 11px;color:#101C33;font:700 10px 'Sora';outline:none}
      .bw-kit-search input:focus{border-color:#2E6BFF;box-shadow:0 0 0 3px rgba(46,107,255,.1)}.bw-kit-count{display:flex;align-items:center;justify-content:center;min-width:67px;
        border-radius:11px;background:#101C33;color:#fff;font:800 8px 'Space Mono'}
      .bw-kit-filters{display:flex;gap:6px;overflow-x:auto;margin-bottom:10px;padding-bottom:3px;scrollbar-width:none}.bw-kit-filters::-webkit-scrollbar{display:none}
      .bw-kit-filter{flex:0 0 auto;border:1px solid #D6E2F5;border-radius:999px;padding:7px 10px;background:#fff;color:#5D719A;font:750 8px 'Space Mono'}
      .bw-kit-filter.on{background:#2E6BFF;border-color:#2E6BFF;color:#fff}.bw-mega-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
      .bw-mega-card{position:relative;min-height:144px;border:1px solid #D6E2F5;border-radius:16px;padding:9px;background:#fff;text-align:left;overflow:hidden;box-shadow:0 13px 28px -23px #123A9E}
      .bw-mega-card:active{transform:scale(.985)}.bw-mega-preview{position:relative;height:82px;margin-bottom:8px;border-radius:10px;overflow:hidden;background:var(--bg);color:var(--ink)}
      .bw-mega-preview:before{content:'';position:absolute;left:9px;top:10px;width:56%;height:7px;border-radius:5px;background:var(--accent);box-shadow:0 13px 0 var(--ink),0 26px 0 color-mix(in srgb,var(--ink) 55%,transparent)}
      .bw-mega-preview:after{content:'';position:absolute;right:8px;bottom:8px;width:28px;height:28px;border-radius:var(--shape);background:var(--accent);border:3px solid var(--ink);transform:rotate(var(--tilt))}
      .bw-mega-card b{display:block;color:#101C33;font:800 10px/1.25 'Sora'}.bw-mega-card span{display:block;margin-top:3px;color:#7185AA;font:650 7.5px/1.35 'Space Mono'}
      .bw-mega-card i{position:absolute;right:8px;bottom:7px;color:#2E6BFF;font:900 9px 'Sora';font-style:normal}.bw-kit-empty{grid-column:1/-1;padding:26px 12px;text-align:center;color:#7185AA;font:700 10px 'Space Mono'}
      .bw-foundation-layer{pointer-events:none!important}.bw-foundation-locked{display:inline-flex;align-items:center;gap:5px;padding:4px 7px;border-radius:999px;
        background:#E4F7EC;color:#17623B;font:800 7.5px 'Space Mono'}.bw-reset-original{width:100%;margin-top:8px;border:1px solid #B7CAEB;border-radius:11px;
        padding:10px;background:#fff;color:#123A9E;font:800 10px 'Sora'}
      @media(min-width:700px){
        .bw-home-lab{padding:26px 28px}.bw-home-lab h2{font-size:31px;max-width:430px}.bw-home-lab h2 em{font-size:34px}
        .bw-home-lab p{font-size:12.5px;max-width:430px}.bw-home-stack{right:30px;bottom:19px;transform:scale(1.2)}
        .bw-design-card{flex-basis:220px}.bw-writer-hero{padding:22px}.bw-writer-hero h2{font-size:27px;max-width:420px}
      }
      @media(max-width:430px){
        .bw-home-lab{padding:18px 15px 16px}.bw-home-lab h2{font-size:22px;max-width:245px}.bw-home-lab h2 em{font-size:25px}
        .bw-home-lab p{max-width:245px;font-size:10.5px}.bw-home-stack{right:-9px;bottom:12px;transform:scale(.8)}
        .bw-home-proof{max-width:260px}.bw-home-actions{max-width:260px}.bw-home-start,.bw-home-browse{padding:10px 11px;font-size:10px}
        .bw-flow-step{font-size:7.5px}.bw-design-card{flex-basis:66vw}.bw-build-actions{grid-template-columns:1fr 1fr}
        #bscr .top .bdword{display:none}#bscr .top{gap:5px;padding-left:8px;padding-right:8px}
        #bscr .top .ghost,#bscr .top .exp{padding:8px 9px;font-size:10px}
        .bw-official-logo{width:118px;height:34px}.bw-kit-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
      }
    `;
    document.head.appendChild(style);
  }

  function injectBuilderStabilityStyles() {
    if (document.getElementById('bw_builder_stability_style')) return;
    const style = document.createElement('style');
    style.id = 'bw_builder_stability_style';
    style.textContent = `
      #bscr.on{height:100dvh;max-height:100dvh;width:100vw;overflow:hidden;padding-top:env(safe-area-inset-top)}
      #bscr .top{width:100%;min-width:0;flex:0 0 auto;isolation:isolate}
      #bscr .fmts{width:100%;min-width:0;flex-wrap:nowrap;overflow-x:auto;overscroll-behavior-x:contain;
        touch-action:pan-x;padding-bottom:9px;scrollbar-width:none;-webkit-overflow-scrolling:touch}
      #bscr .fmts::-webkit-scrollbar,#bscr .rail::-webkit-scrollbar{display:none}
      #bscr .fmt,#bscr .tonewrap{flex:0 0 auto}
      #bscr .stagewrap{width:100%;min-height:120px;overflow:hidden;isolation:isolate;padding:8px 12px}
      #bscr #bd_stage{flex:0 0 auto;margin:auto}
      #bscr #bd_ov{overflow:visible}
      #bscr .tool{overscroll-behavior-x:contain;touch-action:pan-x;z-index:18}
      #bscr .rail{position:relative;z-index:35;width:100%;min-width:0;min-height:82px;overflow-x:auto;
        overscroll-behavior-x:contain;touch-action:pan-x;scroll-snap-type:x proximity;scroll-padding-left:12px;
        padding-bottom:calc(11px + env(safe-area-inset-bottom));box-shadow:0 -14px 28px -24px rgba(12,27,51,.55);
        scrollbar-width:none;-webkit-overflow-scrolling:touch}
      #bscr .add{min-width:74px;scroll-snap-align:start}
      #bscr .bw-builder-back{font-size:19px!important;line-height:1!important}
      #bscr .bw-format-status{display:none}
      .bw-inspector-text{width:100%;min-height:74px;resize:vertical;border:1px solid #CDD9EE;border-radius:10px;
        padding:10px;background:#fff;color:#101C33;font:650 12px/1.45 Sora;outline:none}
      .bw-position-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin-top:8px}
      .bw-position-grid label{display:grid;grid-template-columns:18px 1fr;align-items:center;gap:5px;color:#60749B;
        font:750 9px 'Space Mono'}.bw-position-grid input{min-width:0;width:100%;border:1px solid #CDD9EE;border-radius:9px;
        padding:9px;background:#fff;color:#101C33;font:750 10px 'Space Mono'}
      @media(max-width:560px){
        #bscr .top{position:relative;z-index:45;display:grid;grid-template-columns:42px minmax(54px,1fr) 48px 52px 58px;
          gap:5px;padding:8px max(8px,env(safe-area-inset-right)) 7px max(8px,env(safe-area-inset-left));background:rgba(237,243,252,.97)}
        #bscr .top .sp{display:none}
        #bscr .top .bw-builder-back{grid-column:1}
        #bscr .top .bw-official-logo{grid-column:2;width:min(88px,100%)!important;height:28px!important;justify-self:start}
        #bscr .top #bd_undoBtn{grid-column:3}
        #bscr .top .bw-top-tool{grid-column:4}
        #bscr .top #bd_expBtn{grid-column:5}
        #bscr .top .bw-mobile-secondary{display:none!important}
        #bscr .top .ghost,#bscr .top .exp{min-width:0;width:100%;padding:8px 5px!important;font-size:9px!important}
        #bscr .fmts{padding:0 8px 7px;gap:5px;background:rgba(237,243,252,.97)}
        #bscr .fmt{padding:7px 9px}
        #bscr .tonewrap{margin-left:2px;gap:5px}.tonewrap .tsep{margin:0 1px}
        #bscr .stagewrap{padding:7px 10px 6px}
        #bscr .rail{gap:6px;padding-left:8px;padding-right:8px;min-height:76px}
        #bscr .add{min-width:68px;padding:7px 6px}.bw-builder-coach{display:none!important}
        #bscr #bd_pad{left:8px;bottom:8px;transform:scale(.82);transform-origin:left bottom}
      }
      @media(max-width:345px){
        #bscr .top{grid-template-columns:40px minmax(0,1fr) 45px 49px 54px}
        #bscr .top .bw-official-logo{width:64px!important}
      }
      @media(max-height:640px){
        #bscr .rail{min-height:66px;padding-top:6px}.bw-builder-coach{display:none!important}
        #bscr .add{padding-top:5px;padding-bottom:5px}.bw-builder-coach{display:none!important}
      }
    `;
    document.head.appendChild(style);
  }

  function hydrateTemplatePreview(host, templateId, customValues) {
    if (!host || !T[templateId]) return;
    const values = customValues || Object.assign({}, clone(T[templateId].sample || {}), {branding:true});
    host.innerHTML = T[templateId].render(values);
    host.style.width = '1080px';
    host.style.height = '1350px';
    host.style.transformOrigin = '0 0';
    host.style.pointerEvents = 'none';
    const resize = () => {
      const shell = host.parentElement;
      const width = shell && shell.clientWidth;
      if (width) host.style.transform = 'scale(' + (width / 1080) + ')';
    };
    resize();
    requestAnimationFrame(() => {
      try { fitPass(host); } catch (_) {}
      resize();
    });
    if (window.ResizeObserver && !host.__bwResize) {
      host.__bwResize = new ResizeObserver(resize);
      host.__bwResize.observe(host.parentElement);
    }
  }

  function installHomeLaunchpad() {
    const home = document.getElementById('home');
    if (!home || document.getElementById('bw_home_lab')) return;
    const counter = home.querySelector('.counter');
    if (!counter) return;
    const lab = document.createElement('section');
    lab.id = 'bw_home_lab';
    lab.className = 'bw-home-lab';
    const pack=creativePackV5(),nativeCount=pack&&pack.counts?pack.counts.total:0,templateCount=Object.keys(T).length;
    lab.innerHTML = '<div class="bw-build-badge">smart studio · v7</div>' +
      '<div class="bw-home-kicker"><i></i> research-powered creator</div>' +
      '<h2>turn any project into a <em>finished visual story.</em></h2>' +
      '<p>Pull the facts, write in your voice, preview the best-fit directions, then edit every important layer.</p>' +
      '<div class="bw-home-proof"><span>live research</span><span>'+templateCount+' classic templates</span><span>'+nativeCount+' native starts</span><span>editable builder</span></div>' +
      '<div class="bw-home-actions"><button type="button" class="bw-home-start">start smart project →</button>' +
      '<button type="button" class="bw-home-browse">browse templates</button></div>' +
      '<div class="bw-home-stack"><div class="bw-home-card"><div class="bw-template-mini" data-home-template="bignum"></div></div>' +
      '<div class="bw-home-card"><div class="bw-template-mini" data-home-template="top5"></div></div>' +
      '<div class="bw-home-card"><div class="bw-template-mini" data-home-template="threadcover"></div></div></div>';
    counter.insertAdjacentElement('afterend', lab);
    lab.querySelector('.bw-home-start').onclick = () => {
      goWriter();
      setTimeout(() => {
        decorateWriterWorkspace();
        const input = document.getElementById('bw_proj');
        if (input) input.focus();
      }, 80);
    };
    lab.querySelector('.bw-home-browse').onclick = () => {
      const search = home.querySelector('.search');
      if (search) search.scrollIntoView({behavior:'smooth', block:'start'});
      const input = document.getElementById('q');
      if (input) setTimeout(() => input.focus(), 350);
    };
    lab.querySelectorAll('[data-home-template]').forEach(host => {
      const id = host.dataset.homeTemplate;
      const fallback = Object.keys(T)[0];
      hydrateTemplatePreview(host, T[id] ? id : fallback);
    });
  }

  function setWriterFlow(stage) {
    document.querySelectorAll('.bw-flow-step').forEach((node, index) => {
      node.classList.toggle('done', index < stage);
      node.classList.toggle('on', index === stage);
    });
  }

  function decorateWriterWorkspace() {
    const wrap = document.querySelector('#wscr .bw-wrap');
    if (!wrap || wrap.dataset.experience === ENH_VERSION) return false;
    wrap.dataset.experience = ENH_VERSION;
    const firstCard = wrap.querySelector(':scope > .bw-card');
    if (firstCard) firstCard.classList.add('bw-input-card');
    const hero = document.createElement('section');
    hero.className = 'bw-writer-hero';
    hero.innerHTML = '<div class="bw-writer-kicker"><i></i> project intelligence lab</div>' +
      '<h2>research it. write it. <em>see the design.</em></h2>' +
      '<p>One guided flow from a project link or screenshot to a complete visual you can keep editing.</p>' +
      '<div class="bw-flow"><div class="bw-flow-step on"><b>1</b>research</div>' +
      '<div class="bw-flow-step"><b>2</b>write</div><div class="bw-flow-step"><b>3</b>design</div></div>';
    if (firstCard) firstCard.prepend(hero); else wrap.prepend(hero);
    const projectLabel = Array.from(wrap.querySelectorAll('.bw-lab')).find(node => /pull real facts/i.test(node.textContent));
    if (projectLabel) projectLabel.textContent = '01 · project and source';
    const topicLabel = Array.from(wrap.querySelectorAll('.bw-lab')).find(node => /what.s it about/i.test(node.textContent));
    if (topicLabel) topicLabel.textContent = '02 · story angle or raw material';
    const gather = document.getElementById('bw_gather');
    if (gather) gather.textContent = 'research project →';
    const compose = document.getElementById('bw_go');
    if (compose) compose.textContent = 'write + show visual directions →';
    installSmartWriteHandoff();
    return true;
  }

  function decorateResearchResult() {
    const facts = document.getElementById('bw_facts');
    if (!facts || !window.__bwHasBrief || facts.querySelector('.bw-research-ready')) return;
    const note = document.createElement('div');
    note.className = 'bw-research-ready';
    const count = Object.keys((window.__bwBrief || {}).live_numbers || {}).length;
    note.innerHTML = '<b>research brief ready ✓</b><span>' + (count || 'source') +
      ' usable source signal' + (count === 1 ? '' : 's') + ' will guide the writing and design match.</span>';
    facts.prepend(note);
    setWriterFlow(1);
  }

  function installExperienceObserver() {
    const observer = new MutationObserver(() => {
      installHomeLaunchpad();
      decorateWriterWorkspace();
      decorateResearchResult();
      installOfficialBrand();
      installProductV7Experience();
    });
    observer.observe(document.body, {childList:true, subtree:true});
    document.addEventListener('click', event => {
      if (event.target.closest && event.target.closest('#bw_gather')) setWriterFlow(0);
      if (event.target.closest && event.target.closest('#bw_go')) setWriterFlow(1);
    });
  }

  function installOfficialBrand() {
    [
      {node:document.querySelector('#home .hdr'), before:document.querySelector('#home .hdr .hav')},
      {node:document.querySelector('#wscr .wtop'), before:document.querySelector('#wscr .wtop .mk')},
      {node:document.querySelector('#bscr .top'), before:document.querySelector('#bscr .top .mk')}
    ].forEach(item => {
      if (!item.node || item.node.querySelector('.bw-official-logo')) return;
      const logo = document.createElement('img');
      logo.className = 'bw-official-logo';
      logo.src = BRAND_LOGO;
      logo.alt = 'cmvng';
      logo.onload = () => item.node.classList.add('bw-branded');
      logo.onerror = () => logo.remove();
      if (item.before) item.node.insertBefore(logo, item.before); else item.node.appendChild(logo);
    });
  }

  const SOURCE_URL_RE_V7 = /(?:https?:\/\/[^\s<>"']+|(?:www\.)?[a-z0-9][a-z0-9.-]+\.[a-z]{2,}(?:\/[^\s<>"']*)?)/ig;

  function extractPastedURLsV7(raw, limit) {
    const text = String(raw || '').trim();
    const cap = Math.max(1, Number(limit || 4));
    if (!text) return [];
    const separated = text.replace(/[,;]\s*(?=(?:https?:\/\/|www\.))/ig, ' ');
    const matches = separated.match(SOURCE_URL_RE_V7) || [];
    if (!matches.length && !/\s/.test(text) && (text.includes('.') || /^https?:\/\//i.test(text))) matches.push(text);
    const found = [];
    const seen = new Set();
    matches.some(candidate => {
      const value = String(candidate || '').replace(/[),.;!?]+$/, '');
      try {
        const url = new URL(/^https?:\/\//i.test(value) ? value : 'https://' + value);
        if (!/^https?:$/.test(url.protocol) || !url.hostname) return false;
        const key = url.href.toLowerCase().replace(/\/$/, '');
        if (!seen.has(key)) {
          seen.add(key);
          found.push(url.href);
        }
      } catch (_) {}
      return found.length >= cap;
    });
    return found;
  }

  function normaliseProjectSource(raw) {
    const value = String(raw || '').trim();
    if (!value) return {url:'', urls:[], warning:''};
    const candidates = extractPastedURLsV7(value, 4);
    if (!candidates.length) {
      return {url:'', urls:[], warning:'That source does not look complete. Use up to four official websites, docs, articles, or exact X links.'};
    }
    const urls = [];
    let skippedXHomepage = false;
    candidates.forEach(candidate => {
      try {
        const url = new URL(candidate);
        const host = url.hostname.toLowerCase().replace(/^www\./, '');
        if (/(^|\.)(x\.com|twitter\.com)$/.test(host)) {
          const handle = url.pathname.split('/').filter(Boolean)[0] || '';
          if (!handle || /^(home|explore|search|i|settings)$/i.test(handle)) {
            skippedXHomepage = true;
            return;
          }
        }
        urls.push(url.href);
      } catch (_) {}
    });
    if (!urls.length && skippedXHomepage) {
      return {url:'', urls:[], warning:'That is only the X homepage. Paste the project’s exact profile, website, docs, or a specific post.'};
    }
    const warning = skippedXHomepage
      ? 'The X homepage was skipped; the other exact source' + (urls.length === 1 ? '' : 's') + ' will be researched.'
      : (urls.length > 1 ? urls.length + ' sources ready · each one will be checked before writing' : '');
    return {url:urls.join('\n'), urls, warning};
  }

  function briefEvidence(brief) {
    brief = brief || {};
    const numbers = Object.keys(brief.live_numbers || {}).filter(key => !/no token|not found|unknown/i.test(String(brief.live_numbers[key])));
    const news = (brief.news_feed || []).filter(Boolean);
    const pulse = (brief.x_pulse || []).filter(item => item && String(item.src || '').toLowerCase() !== 'mirror');
    const pages = (brief.pages_read || []).filter(Boolean);
    const verified = (brief.verified_facts || []).filter(item => item && item.value);
    const excerpts = (brief.source_excerpt || []).filter(Boolean);
    const sources = (brief.sources || []).filter(item => item && item.url);
    const one = String(brief.one_liner || '').trim();
    return {numbers,news,pulse,pages,verified,excerpts,sources,one,
      count:numbers.length + news.length + pulse.length + pages.length + verified.length + excerpts.length + (one ? 1 : 0)};
  }

  function researchFailureMessageV7(brief, suppliedMessage) {
    if (String(suppliedMessage || '').trim()) return String(suppliedMessage).trim();
    const status = String((brief || {}).research_status || '').toLowerCase();
    if (status === 'blocked') return 'That source blocked automated reading. Paste the exact article or X post, try the official docs, or attach screenshots of the facts you want used.';
    if (status === 'timed_out') return 'Research reached its safety time limit before it found enough usable evidence. Try fewer links, a direct article/docs page, or attach screenshots.';
    if (status === 'unreadable' || status === 'failed') return 'I could not read enough evidence from those links. Check that they are public and exact, or paste the important facts and screenshots directly.';
    return 'I found the project name, but not enough verifiable material yet. Paste the official website, docs, exact X profile/post, or attach screenshots.';
  }

  function renderResearchBrief(project, brief, suppliedMessage) {
    const facts = document.getElementById('bw_facts');
    if (!facts) return;
    const evidence = briefEvidence(brief);
    const numberHTML = evidence.numbers.slice(0, 5).map(key => '<div class="bw-f"><b>' + escEnh(key) + '</b>' + escEnh(brief.live_numbers[key]) + '</div>').join('');
    const verifiedHTML = evidence.verified.slice(0, 4).map(item => '<div class="bw-f"><b>' + escEnh(item.label || 'verified') + '</b>' + escEnh(String(item.value).slice(0, 150)) + '</div>').join('');
    const sourcePills = [
      evidence.one ? '<div class="bw-f"><b>official description</b>found</div>' : '',
      evidence.excerpts.length ? '<div class="bw-f"><b>source content</b>' + evidence.excerpts.length + ' excerpt' + (evidence.excerpts.length === 1 ? '' : 's') + ' read</div>' : '',
      evidence.pages.length ? '<div class="bw-f"><b>official pages</b>' + evidence.pages.length + ' read</div>' : '',
      evidence.pulse.length ? '<div class="bw-f"><b>X signals</b>' + evidence.pulse.length + ' found</div>' : '',
      evidence.news.length ? '<div class="bw-f"><b>updates</b>' + evidence.news.length + ' found</div>' : ''
    ].join('');
    if (evidence.count && brief.writing_ready !== false) {
      facts.innerHTML = '<div class="bw-research-ready"><b>' + escEnh(project) + ' research brief ready ✓</b><span>' + evidence.count +
        ' usable source signal' + (evidence.count === 1 ? '' : 's') + ' will guide the writing and design match.</span></div><div class="bw-facts">' + numberHTML + verifiedHTML + sourcePills + '</div>' +
        (evidence.sources.length ? '<div class="bw-mut" style="margin-top:7px"><b>sources:</b> ' + evidence.sources.slice(0,3).map(item => escEnh(item.kind || 'source')).join(' · ') + '</div>' : '');
      setWriterFlow(1);
    } else {
      const failures = (brief.source_errors || []).slice(0, 4).map(item => {
        let host = 'source';
        try { host = new URL(item.url).hostname.replace(/^www\./, ''); } catch (_) {}
        return '<span class="bw-source-status">' + escEnh(host) + ' · ' + escEnh(item.status || 'unreadable') + '</span>';
      }).join('');
      facts.innerHTML = '<div class="bw-warn"><b>' + escEnh(researchFailureMessageV7(brief, suppliedMessage)) + '</b><br><br>' +
        'The app did not spend a writing call or invent missing facts.' + (failures ? '<div class="bw-source-statuses">' + failures + '</div>' : '') + '</div>';
    }
  }

  function firstPastedURL() {
    const ids = ['bw_root','bw_proj','bw_topic'];
    for (const id of ids) {
      const node = document.getElementById(id);
      const match = extractPastedURLsV7(node && node.value, 1);
      if (match.length) return match[0];
    }
    return '';
  }

  function projectFromURL(raw) {
    try {
      const url = new URL(raw);
      const host = url.hostname.toLowerCase().replace(/^www\./, '');
      const parts = url.pathname.split('/').filter(Boolean);
      if (/(^|\.)(x\.com|twitter\.com)$/.test(host) && parts[0]) return '@' + parts[0];
      return host.split('.')[0].replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    } catch (_) { return 'linked project'; }
  }

  async function smartResearchProject(force) {
    const projectInput = document.getElementById('bw_proj');
    const rootInput = document.getElementById('bw_root');
    const facts = document.getElementById('bw_facts');
    const pastedURL = firstPastedURL();
    let project = String(projectInput && projectInput.value || '').trim();
    if (/^https?:\/\//i.test(project)) {
      if (rootInput && !rootInput.value.trim()) rootInput.value = project;
      project = projectFromURL(project);
      if (projectInput) projectInput.value = project;
    }
    if (!project && pastedURL) {
      project = projectFromURL(pastedURL);
      if (projectInput) projectInput.value = project;
    }
    if (!project) {
      if (facts) facts.innerHTML = '<div class="bw-warn">Enter a project name or paste an exact website, article, docs, or X-post link.</div>';
      return false;
    }
    if (rootInput && !rootInput.value.trim() && pastedURL) rootInput.value = pastedURL;
    const source = normaliseProjectSource(rootInput && rootInput.value);
    const helper = document.querySelector('.bw-source-help');
    if (helper) {
      helper.textContent = source.warning;
      helper.classList.toggle('on', !!source.warning);
    }
    const key = project.toLowerCase() + '|' + source.url.toLowerCase();
    if (!force && window.__bwHasBrief && window.__bwBriefKey === key && briefEvidence(window.__bwBrief).count) return true;
    if (facts) facts.innerHTML = '<div class="bw-research-progress">researching ' + escEnh(project) +
      '… checking the official source, product details, live numbers and current signals before writing.</div>';
    setWriterFlow(0);
    try {
      // The native writer captures this session at page load. Prefer that same
      // sessionStorage value, then mirror it to localStorage for refresh recovery.
      let session = '';
      try {
        session = sessionStorage.getItem('banger_session') || localStorage.getItem('banger_session') || '';
        if (session) {
          sessionStorage.setItem('banger_session', session);
          localStorage.setItem('banger_session', session);
        }
      } catch (_) {}
      const response = await fetch('/gather', {method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({proj:project,root:source.url,session})});
      const result = await response.json().catch(() => ({}));
      const brief = result.brief || {};
      window.__bwBrief = brief;
      window.__bwBriefKey = key;
      window.__bwBriefProject = project;
      window.__bwHasBrief = response.ok && brief.writing_ready !== false && briefEvidence(brief).count > 0;
      renderResearchBrief(project, brief, result.message || result.error || (!response.ok ? 'Research could not finish for that source.' : ''));
      return window.__bwHasBrief;
    } catch (_) {
      window.__bwHasBrief = false;
      if (facts) facts.innerHTML = '<div class="bw-warn">Research could not finish. Check the project link or attach screenshots, then try again.</div>';
      return false;
    }
  }

  function installSmartWriteHandoff() {
    const project = document.getElementById('bw_proj');
    const root = document.getElementById('bw_root');
    const gather = document.getElementById('bw_gather');
    const write = document.getElementById('bw_go');
    if (!project || !root || !gather || !write || write.dataset.smartHandoff) return;
    write.dataset.smartHandoff = '1';
    root.placeholder = 'up to 4 websites, docs, articles or exact X links';
    let helper = document.querySelector('.bw-source-help');
    if (!helper) {
      helper = document.createElement('div');
      helper.className = 'bw-source-help';
      root.closest('.bw-row').insertAdjacentElement('afterend', helper);
    }
    const invalidate = () => { window.__bwHasBrief = false; window.__bwBriefKey = ''; };
    project.addEventListener('input', invalidate);
    root.addEventListener('input', () => {
      invalidate();
      const source = normaliseProjectSource(root.value);
      helper.textContent = source.warning;
      helper.classList.toggle('on', !!source.warning);
    });
    const topicField = document.getElementById('bw_topic');
    if (topicField) topicField.addEventListener('paste', () => setTimeout(() => {
      const link = firstPastedURL();
      if (!link) return;
      if (!root.value.trim()) root.value = link;
      if (!project.value.trim()) project.value = projectFromURL(link);
      helper.textContent = 'link detected · the exact page/post will be researched before writing';
      helper.classList.add('on');
      invalidate();
    }, 0));
    gather.onclick = async () => {
      gather.disabled = true;
      const old = gather.textContent;
      gather.textContent = 'researching project…';
      await smartResearchProject(true);
      gather.disabled = false;
      gather.textContent = old;
    };
    const nativeWrite = write.onclick;
    write.onclick = async event => {
      if (write.dataset.busy === '1') return;
      let projectName = project.value.trim();
      const topic = document.getElementById('bw_topic');
      const originalTopic = topic ? topic.value.trim() : '';
      const hasScreens = !!((window.__bwShots || []).length);
      const pastedURL = firstPastedURL();
      if (!projectName && pastedURL) {
        projectName = projectFromURL(pastedURL);
        project.value = projectName;
        if (!root.value.trim()) root.value = pastedURL;
      }
      write.dataset.busy = '1';
      write.disabled = true;
      const old = write.textContent;
      try {
        if (projectName) {
          write.textContent = 'researching before writing…';
          const researched = await smartResearchProject(false);
          // A URL is not factual material. In particular, an X status ID must
          // never unlock the paid writer after research fails.
          const factText = originalTopic
            .replace(/(?:https?:\/\/[^\s<>"']+|(?:www\.)?[a-z0-9][a-z0-9.-]+\.[a-z]{2,}(?:\/[^\s<>"']*)?)/ig, ' ')
            .replace(/\s+/g, ' ').trim();
          const labeledMetric = /\b(?:tvl|revenue|users?|customers?|volume|funding|raised|price|market\s*cap|transactions?|downloads?|launched?|founded|release(?:d)?|date)\b[^.\n]{0,70}\$?\d[\d,.]*(?:\s?[kmbt%])?/i.test(factText);
          const factLines = originalTopic.split(/\n+/).map(line => line.replace(/https?:\/\/\S+/ig, '').trim())
            .filter(line => line.length > 18 && /[A-Za-z]/.test(line) && /\d/.test(line));
          const detailedInput = factText.length > 180 || labeledMetric || factLines.length >= 2;
          if (!researched && !hasScreens && !detailedInput) return;
          if (topic) {
            const source = normaliseProjectSource(root.value).url;
            topic.value = 'Project: ' + projectName + '\n' + (source ? 'Official source: ' + source + '\n' : '') +
              'Requested angle: ' + (originalTopic || 'general project overview');
          }
        }
        write.textContent = 'writing in your voice…';
        const running = nativeWrite && nativeWrite.call(write, event);
        if (topic) topic.value = originalTopic;
        await running;
      } finally {
        if (topic) topic.value = originalTopic;
        write.dataset.busy = '0';
        write.disabled = false;
        write.textContent = old;
      }
    };
  }

  /* ---------- Reliable template controls ---------- */
  const nativeOpenT = openT;
  const nativeDrawPanel = drawPanel;
  const nativeDrawPreview = drawPreview;
  const nativeDrawImgRow = drawImgRow;

  function templateKey(id) {
    return TEMPLATE_DRAFT_PREFIX + id;
  }

  function saveTemplateDraft() {
    if (suppressTemplateSave || !cur || !vals) return;
    clearTimeout(templateSaveTimer);
    templateSaveTimer = setTimeout(() => {
      try {
        localStorage.setItem(templateKey(cur), JSON.stringify(vals));
        const note = document.querySelector('.bw-autosave-note');
        if (note) note.textContent = 'autosaved · ' + new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
      } catch (_) {}
    }, 500);
  }

  function resetTemplate() {
    if (!cur || !T[cur]) return;
    suppressTemplateSave = true;
    vals = clone(T[cur].sample || {});
    vals.branding = true;
    vals.skin = vals.skin || 'detailed';
    vals.format = vals.format || 'post';
    vals.tone = vals.tone || 'classic';
    if (vals.decor === undefined) vals.decor = true;
    try { localStorage.removeItem(templateKey(cur)); } catch (_) {}
    drawPanel();
    drawPreview();
    suppressTemplateSave = false;
    toast('template reset to its original design', 'ok');
  }

  openT = function enhancedOpenTemplate(id) {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(templateKey(id)) || 'null'); } catch (_) {}
    suppressTemplateSave = true;
    nativeOpenT(id);
    if (saved && typeof saved === 'object') {
      vals = Object.assign({}, vals, saved);
      nativeDrawPanel();
      nativeDrawPreview();
      toast('restored your last edit for this template', 'ok');
    }
    suppressTemplateSave = false;
    enhanceTemplatePanel();
  };

  drawPreview = function enhancedDrawPreview() {
    nativeDrawPreview();
    saveTemplateDraft();
  };

  drawPanel = function enhancedDrawPanel() {
    nativeDrawPanel();
    enhanceTemplatePanel();
  };

  function listSpec(label) {
    const max = parseInt(((label || '').match(/×\s*(\d+)/) || [])[1] || (/\b(\d+)\s+(?:items|steps|rows|nodes|cells|branches|flags|beats|rules)/i.exec(label || '') || [])[1] || '6', 10);
    const before = String(label || '').replace(/×\s*\d+.*/i, '').replace(/comma.*/i, '').trim();
    const colonPart = before.match(/(?:rows?|items?|steps?|tiles?|milestones?|rungs?|nodes?|bubbles?|dots?|months?|weeks?|fields?|findings?|posts?|holdings?|offers?|parts?|skills?)\s+(.+)$/i);
    const heads = colonPart && colonPart[1].includes(':') ? colonPart[1].split(':').map(x => x.trim()) : [];
    return {max: Math.max(1, Math.min(max, 12)), heads};
  }

  function cleanCell(value) {
    return String(value || '')
      .replace(/:/g, '：')
      .replace(/,/g, (m, index, all) => /\d/.test(all[index - 1] || '') && /\d/.test(all[index + 1] || '') ? ',' : '，')
      .trim();
  }

  function splitColumns(row, count, heads) {
    if (count <= 1) return [row];
    const parts = String(row || '').split(':');
    if (parts.length <= count) return parts.concat(Array(count - parts.length).fill(''));
    if (count === 2 && /time/i.test(heads[0] || '')) {
      return [parts.slice(0, -1).join(':'), parts[parts.length - 1]];
    }
    return parts.slice(0, count - 1).concat(parts.slice(count - 1).join(':'));
  }

  function enhanceSimpleField(field, slot) {
    const input = field.querySelector('input[type="text"]');
    if (!input || field.querySelector('.bw-field-meta')) return;
    const current = String(vals[slot.id] || '');
    const long = current.length > 58 || /body|copy|caption|description|note|subline|headline|quote|thread|hook|explain|take/i.test(slot.label || '');
    let control = input;
    if (long) {
      const textarea = document.createElement('textarea');
      textarea.className = 'bw-field';
      textarea.value = current;
      textarea.setAttribute('aria-label', slot.label || slot.id);
      input.replaceWith(textarea);
      control = textarea;
    }
    const meta = document.createElement('div');
    meta.className = 'bw-field-meta';
    meta.innerHTML = '<span>live preview</span><span class="bw-count">' + current.length + ' chars</span>';
    field.appendChild(meta);
    control.oninput = event => {
      setV(slot.id, event.target.value);
      const counter = meta.querySelector('.bw-count');
      if (counter) counter.textContent = event.target.value.length + ' chars';
    };
  }

  function enhanceListField(field, slot) {
    const spec = listSpec(slot.label || '');
    const sourceRows = parseList(vals[slot.id], spec.max);
    const rows = sourceRows.length ? sourceRows.slice() : [''];
    const cols = Math.max(1, spec.heads.length);
    const label = field.querySelector('label');
    field.innerHTML = '';
    if (label) field.appendChild(label);
    const help = document.createElement('div');
    help.className = 'bw-list-help';
    help.textContent = cols > 1 ? 'each row is editable · the columns match the design' : 'one item per row · drag-free, comma-safe editing';
    field.appendChild(help);
    const body = document.createElement('div');
    field.appendChild(body);

    function pack() {
      const value = rows.filter(row => row.some ? row.some(x => String(x).trim()) : String(row).trim())
        .map(row => Array.isArray(row) ? row.map(cleanCell).join(':') : cleanCell(row))
        .join(', ');
      setV(slot.id, value);
    }

    let dataRows = rows.map(row => splitColumns(row, cols, spec.heads));
    function renderRows() {
      body.innerHTML = '';
      if (cols > 1) {
        const head = document.createElement('div');
        head.className = 'bw-list-head';
        head.style.gridTemplateColumns = 'repeat(' + cols + ',minmax(0,1fr))';
        head.innerHTML = spec.heads.map(x => '<span>' + escEnh(x) + '</span>').join('');
        body.appendChild(head);
      }
      dataRows.forEach((row, ri) => {
        const line = document.createElement('div');
        line.className = 'bw-list-row';
        line.style.gridTemplateColumns = 'repeat(' + cols + ',minmax(0,1fr)) 28px';
        for (let ci = 0; ci < cols; ci++) {
          const input = document.createElement('input');
          input.className = 'bw-list-input';
          input.value = row[ci] || '';
          input.placeholder = spec.heads[ci] || ('item ' + (ri + 1));
          input.oninput = event => {
            dataRows[ri][ci] = event.target.value;
            rows.splice(0, rows.length, ...dataRows);
            pack();
          };
          line.appendChild(input);
        }
        const remove = document.createElement('button');
        remove.className = 'bw-list-remove';
        remove.type = 'button';
        remove.textContent = '×';
        remove.setAttribute('aria-label', 'Remove row ' + (ri + 1));
        remove.onclick = () => {
          dataRows.splice(ri, 1);
          if (!dataRows.length) dataRows.push(Array(cols).fill(''));
          rows.splice(0, rows.length, ...dataRows);
          pack();
          renderRows();
        };
        line.appendChild(remove);
        body.appendChild(line);
      });
      if (dataRows.length < spec.max) {
        const add = document.createElement('button');
        add.type = 'button';
        add.className = 'bw-list-add';
        add.textContent = '+ add row';
        add.onclick = () => {
          dataRows.push(Array(cols).fill(''));
          rows.splice(0, rows.length, ...dataRows);
          renderRows();
          const fields = body.querySelectorAll('.bw-list-input');
          if (fields.length) fields[fields.length - cols].focus();
        };
        body.appendChild(add);
      }
    }
    renderRows();
  }

  function enhanceTemplatePanel() {
    const panel = document.getElementById('panel');
    if (!panel || !cur || !T[cur]) return;
    if (!panel.querySelector('.bw-editor-intro')) {
      const intro = document.createElement('div');
      intro.className = 'bw-editor-intro';
      intro.innerHTML = '<span>live template editor</span><b>original design · smarter controls</b>' +
        '<small>Change the content here, or send the finished design to Builder for layer-by-layer editing.</small>';
      panel.prepend(intro);
    }
    if (!panel.querySelector('.bw-panel-actions')) {
      const actions = document.createElement('div');
      actions.className = 'bw-panel-actions';
      actions.innerHTML = '<button type="button" data-a="reset">reset original</button>' +
        '<button type="button" data-a="preset">save as preset</button>' +
        '<div class="bw-autosave-note">autosave is on</div>';
      const first = panel.querySelector('.f');
      if (first) first.insertAdjacentElement('afterend', actions); else panel.prepend(actions);
      actions.querySelector('[data-a="reset"]').onclick = resetTemplate;
      actions.querySelector('[data-a="preset"]').onclick = () => {
        savePreset();
        toast('saved to your library', 'ok');
      };
    }
    const fields = Array.from(panel.children).filter(node => node.classList && node.classList.contains('f'));
    const slots = T[cur].slots || [];
    slots.forEach((slot, index) => {
      if (!slot || slot.t !== 'text') return;
      const field = fields[index + 1];
      if (!field) return;
      const listy = /×\s*\d|comma/i.test(slot.label || '');
      if (listy) enhanceListField(field, slot);
      else enhanceSimpleField(field, slot);
    });
  }

  function replaceTemplateImage(slotId, index) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = event => {
      const file = event.target.files && event.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const arr = vals[slotId] || [];
        arr[index] = reader.result;
        vals[slotId] = arr;
        drawPanel();
        drawPreview();
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }

  drawImgRow = function enhancedDrawImageRow(slot) {
    nativeDrawImgRow(slot);
    const box = document.getElementById('ir_' + slot.id);
    if (!box) return;
    const arr = vals[slot.id] || [];
    Array.from(box.querySelectorAll('.islot.filled')).forEach((item, index) => {
      item.style.position = 'relative';
      const actions = document.createElement('div');
      actions.className = 'bw-img-actions';
      actions.innerHTML = '<button type="button" data-a="prev" aria-label="Move image left">←</button>' +
        '<button type="button" data-a="replace" aria-label="Replace image">↻</button>' +
        '<button type="button" data-a="next" aria-label="Move image right">→</button>';
      actions.onclick = event => event.stopPropagation();
      actions.querySelector('[data-a="prev"]').disabled = index === 0;
      actions.querySelector('[data-a="next"]').disabled = index === arr.length - 1;
      actions.querySelector('[data-a="prev"]').onclick = () => {
        if (index < 1) return;
        [arr[index - 1], arr[index]] = [arr[index], arr[index - 1]];
        drawPanel(); drawPreview();
      };
      actions.querySelector('[data-a="next"]').onclick = () => {
        if (index >= arr.length - 1) return;
        [arr[index + 1], arr[index]] = [arr[index], arr[index + 1]];
        drawPanel(); drawPreview();
      };
      actions.querySelector('[data-a="replace"]').onclick = () => replaceTemplateImage(slot.id, index);
      item.appendChild(actions);
    });
    if (!box.querySelector('.bw-drop-note')) {
      const note = document.createElement('div');
      note.className = 'bw-drop-note';
      note.textContent = 'images can be replaced and reordered before export';
      box.appendChild(note);
    }
  };

  /* ---------- Research -> best-fit design intelligence ---------- */
  const DESIGN_RULES = [
    {re:/\b(top\s*\d+|rank|leaderboard|best\s+\d|podium)\b/i, ids:['orbit10','leadboard','top5','podium']},
    {re:/\b(vs\.?|versus|compare|against|better than|difference)\b/i, ids:['versus','compare3','feecompare','thisorthat']},
    {re:/\b(how to|steps?|guide|checklist|do this|tutorial|airdrop|farm)\b/i, ids:['steps','stack','preflight','dyor']},
    {re:/\b(timeline|history|roadmap|unlock|vesting|deadline|countdown|launch date)\b/i, ids:['timeline','vesting','countdown','betimeline']},
    {re:/[$#]?\d[\d,.]*\s*(?:%|x|m|b|k|million|billion)?|\b(volume|tvl|users|revenue|stat|data)\b/i, ids:['bignum','tiles','bars','recap','area']},
    {re:/\b(news|breaking|announce|announcing|launch|live now|update|shipped|release)\b/i, ids:['news','announce','changelog','milestone']},
    {re:/\b(price|market|trade|trading|whale|bull|bear|funding|flow|apy|yield)\b/i, ids:['pnl','whale','gasline','feargreed','flow2']},
    {re:/\b(ecosystem|network|map|architecture|agents?|nodes?|projects?)\b/i, ids:['ecosystem','network','mindmap','stack']},
    {re:/\b(quote|said|take|opinion|believe|think|truth)\b/i, ids:['quote','minimal','sticker','hotcold']},
    {re:/\b(thread|deep dive|research|explainer|breakdown)\b/i, ids:['threadcover','threadmap','setcover','eli5']},
    {re:/\b(myth|wrong|misconception|fact check)\b/i, ids:['mythfact','redflags','greenflag']},
    {re:/\b(poll|vote|community|sentiment)\b/i, ids:['pollcard','votes','vibecheck','feargreed']}
  ];

  function draftContext(version) {
    const project = (document.getElementById('bw_proj') || {}).value || '';
    const source = version && (version.source || '') || '';
    const brief = window.__bwBrief || {};
    return [project, version && version.lens, version && version.draft, source,
      JSON.stringify(brief.live_numbers || {}), JSON.stringify(brief.news_feed || [])].join(' ');
  }

  function hasImagesAvailable() {
    const brief = window.__bwBrief || {};
    return !!((window.__bwShots || []).length || (brief.assets_for_design || []).length);
  }

  function designChoices(version) {
    const context = draftContext(version);
    const low = context.toLowerCase();
    const tokens = Array.from(new Set(low.match(/[a-z0-9$%]{4,}/g) || [])).slice(0, 90);
    const scores = {};
    Object.keys(T).forEach(id => {
      const template = T[id];
      const hay = (id + ' ' + template.name + ' ' + template.cat + ' ' + (template.tags || '')).toLowerCase();
      let score = 0;
      tokens.forEach(token => { if (hay.includes(token)) score += 0.7; });
      if (id === (version && version.template)) score += 3;
      if (hasImagesAvailable() && (template.slots || []).some(slot => slot.t === 'images')) score += 2.5;
      if (template.cat === 'my world' && !/limitless|wallchain|elsa|naira|lagos|nigeria|quacks|cmvng/.test(low)) score -= 12;
      scores[id] = score;
    });
    DESIGN_RULES.forEach(rule => {
      if (!rule.re.test(context)) return;
      rule.ids.forEach((id, index) => { if (T[id]) scores[id] = (scores[id] || 0) + 12 - index * 1.4; });
    });
    if (!Object.keys(scores).some(id => scores[id] > 4)) {
      ['quote','minimal','threadcover'].forEach((id, index) => { if (T[id]) scores[id] = 8 - index; });
    }
    return Object.keys(scores).sort((a, b) => scores[b] - scores[a]).slice(0, 4);
  }

  function templateMatchReason(version, id, index) {
    const context = draftContext(version);
    const template = T[id] || {};
    const label = (id + ' ' + (template.name || '') + ' ' + (template.tags || '')).toLowerCase();
    if (/top\s*\d+|rank|leaderboard|podium/i.test(context) || /top|rank|leader|podium/.test(label)) {
      return 'turns the ranking into a clear visual hierarchy';
    }
    if (/\b(vs\.?|versus|compare|against|difference)\b/i.test(context) || /versus|compare|this or that/.test(label)) {
      return 'makes the comparison instantly scannable';
    }
    if (/\b(how to|steps?|guide|checklist|tutorial)\b/i.test(context) || /steps|checklist|guide/.test(label)) {
      return 'maps the story into a simple sequence';
    }
    if (/\b(timeline|history|roadmap|unlock|vesting|deadline|launch date)\b/i.test(context) || /timeline|countdown|vesting/.test(label)) {
      return 'shows the timing and sequence at a glance';
    }
    if (/[$#]?\d[\d,.]*\s*(?:%|x|m|b|k|million|billion)?|\b(volume|tvl|users|revenue|stat|data)\b/i.test(context) || /number|stat|data|tile|bar/.test(label)) {
      return 'makes the strongest verified number the hero';
    }
    if (/\b(news|breaking|announce|launch|update|release|shipped)\b/i.test(context) || /news|announce|launch|update/.test(label)) {
      return 'gives the update a sharp editorial feel';
    }
    if (hasImagesAvailable() && (template.slots || []).some(slot => slot.t === 'images')) {
      return 'uses your screenshots as visible proof';
    }
    if (/\b(thread|deep dive|research|explainer|breakdown)\b/i.test(context) || /thread|cover|explainer/.test(label)) {
      return 'frames the research as a strong visual story';
    }
    return index === 0 ? 'strongest editorial fit for this angle' : 'a distinct alternative direction for the same story';
  }

  const NATIVE_DESIGN_RULES_V7 = [
    {re:/\b(top\s*\d+|rank|leaderboard|podium|scoreboard)\b/i,terms:['rank','scoreboard','comparison','data','podium']},
    {re:/\b(vs\.?|versus|compare|against|difference|before|after)\b/i,terms:['comparison','versus','split','range','duel']},
    {re:/\b(how to|steps?|guide|checklist|tutorial|workflow|process)\b/i,terms:['education','workflow','storytelling','sequence','process']},
    {re:/\b(timeline|history|roadmap|unlock|vesting|deadline|countdown)\b/i,terms:['roadmap','timeline','storytelling','sequence']},
    {re:/[$#]?\d[\d,.]*\s*(?:%|x|m|b|k|million|billion)?|\b(volume|tvl|users|revenue|metric|data|growth)\b/i,terms:['data','metric','dashboard','report','chart']},
    {re:/\b(news|breaking|announce|launch|update|shipped|release|bulletin)\b/i,terms:['launch','editorial','announcement','bulletin','broadcast']},
    {re:/\b(research|evidence|source|fact|proof|investigation|deep dive)\b/i,terms:['research','evidence','editorial','proof','report']},
    {re:/\b(quote|take|opinion|believe|think|thesis|manifesto)\b/i,terms:['opinion','quote','type','editorial','manifesto']},
    {re:/\b(product|feature|app|protocol|architecture|ecosystem|network)\b/i,terms:['product','architecture','system','map','minimal']},
    {re:/\b(risk|warning|security|audit|compliance|red flag)\b/i,terms:['quality','warning','research','neo-brutalist','proof']}
  ];

  function nativeDesignReasonV7(item,context,index) {
    const hay=[item.name,item.note,item.category,item.direction].concat(item.tags||[]).join(' ').toLowerCase();
    if(/metric|data|chart|report|dashboard/.test(hay)) return 'turns the verified numbers into a readable data story';
    if(/research|evidence|proof|source|editorial/.test(hay)) return 'keeps the claim and its evidence visible in the same composition';
    if(/comparison|duel|range|versus/.test(hay)) return 'makes the contrast scannable without flattening the nuance';
    if(/story|sequence|timeline|case.study/.test(hay)) return 'gives the project a clear beginning, turn, proof, and takeaway';
    if(/minimal|quiet-luxury|swiss/.test(hay)) return 'uses a restrained system so the idea—not decoration—does the work';
    if(/neo-brutalist|internet|culture/.test(hay)) return 'adds an authored internet-native edge while keeping every layer editable';
    return index===0?'best native structural fit for this research angle':'a genuinely different native direction for the same story';
  }

  function nativeDesignRecommendationsV7(version) {
    const context=draftContext(version),low=context.toLowerCase(),tokens=Array.from(new Set(low.match(/[a-z0-9$%]{4,}/g)||[])).slice(0,100);
    const candidates=v5DesignCatalog().map(item=>{
      const hay=[item.name,item.note,item.category,item.direction].concat(item.tags||[]).join(' ').toLowerCase();
      let score=item.kind==='layout'?7:2;
      tokens.forEach(token=>{if(hay.includes(token))score+=.65;});
      NATIVE_DESIGN_RULES_V7.forEach(rule=>{if(rule.re.test(context))rule.terms.forEach((term,index)=>{if(hay.includes(term))score+=10-index*.8;});});
      if(hasImagesAvailable()&&/editorial|dossier|story|product|evidence/.test(hay))score+=3;
      return {kind:'native',id:item.id,key:'native:'+item.id,name:item.name,item,rawScore:score,reason:''};
    }).sort((a,b)=>b.rawScore-a.rawScore);
    const picked=[],directions=new Set(),kinds=new Set();
    candidates.forEach(candidate=>{
      if(picked.length>=3)return;
      const direction=candidate.item.direction||candidate.item.category||'';
      if(picked.length&&directions.has(direction)&&kinds.has(candidate.item.kind))return;
      picked.push(candidate);directions.add(direction);kinds.add(candidate.item.kind);
    });
    candidates.forEach(candidate=>{if(picked.length<3&&!picked.some(item=>item.id===candidate.id))picked.push(candidate);});
    return picked.map((entry,index)=>Object.assign(entry,{score:Math.max(80,97-index*6),reason:nativeDesignReasonV7(entry.item,context,index)}));
  }

  function designRecommendations(version) {
    const native=nativeDesignRecommendationsV7(version);
    const legacyId=designChoices(version)[0];
    const legacy=legacyId?{kind:'template',id:legacyId,key:'template:'+legacyId,name:(T[legacyId]||{}).name||legacyId,
      score:Math.max(78,91-native.length*2),reason:templateMatchReason(version,legacyId,native.length)}:null;
    return native.concat(legacy?[legacy]:[]).slice(0,4);
  }

  function projectLogoKey() {
    const input = ((document.getElementById('bw_proj') || {}).value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!input) return '';
    const keys = Object.keys(LOGOS || {});
    return keys.find(key => key.toLowerCase().replace(/[^a-z0-9]/g, '') === input) ||
      keys.find(key => input.includes(key.toLowerCase().replace(/[^a-z0-9]/g, '')) ||
        key.toLowerCase().replace(/[^a-z0-9]/g, '').includes(input)) || '';
  }

  function contextParts(version) {
    const brief = window.__bwBrief || {};
    const draft = String(version.draft || '');
    const lines = draft.split(/\n+/).map(x => x.replace(/^[-•\d.)\s]+/, '').trim()).filter(Boolean);
    const live = Object.keys(brief.live_numbers || {}).map(key => key + ': ' + brief.live_numbers[key]);
    const news = (brief.news_feed || []).map(x => typeof x === 'string' ? x : (x.title || x.text || ''));
    const facts = live.concat(news, lines.slice(1)).filter(Boolean);
    const numbers = (draftContext(version).match(/[$#₦]?\d[\d,.]*\s*(?:[%xXMBK]|million|billion)?\+?/g) || [])
      .map(x => x.trim()).filter(x => x.length > 1);
    return {
      headline: (lines[0] || ((document.getElementById('bw_proj') || {}).value + ' update') || 'the story').slice(0, 92),
      secondary: (lines[1] || facts[0] || version.lens || 'the part worth watching').slice(0, 150),
      lines,
      facts: facts.length ? facts : lines,
      numbers
    };
  }

  function wrapNativeCopyV7(value,layer,maxLines) {
    const clean=String(value||'').replace(/\s+/g,' ').trim();
    if(!clean)return '';
    const chars=Math.max(9,Math.floor((+layer.w||360)/Math.max(10,(+layer.size||28)*.54)));
    const words=clean.split(' '),lines=[];let line='';
    words.forEach(word=>{
      const next=(line+' '+word).trim();
      if(next.length<=chars||!line){line=next;return;}
      lines.push(line);line=word;
    });
    if(line)lines.push(line);
    const limit=Math.max(1,maxLines||3),kept=lines.slice(0,limit);
    if(lines.length>limit) kept[limit-1]=kept[limit-1].replace(/[.…]*$/,'')+'…';
    return kept.join('\n');
  }

  function fillNativeDesignV7(item,version,format) {
    const layers=buildV5Design(item,format),parts=contextParts(version),project=((document.getElementById('bw_proj')||{}).value||'').trim();
    const textLayers=layers.filter(layer=>layer.type==='text'&&!/CMVNG\s*\/\s*SIGNAL WORKSHOP/i.test(layer.text||''));
    const editableText=textLayers.filter(layer=>!/^(@cmvng|cmvng)$/i.test(String(layer.text||'').trim()));
    const primaryText=editableText.filter(layer=>(+layer.size||0)>=20);
    const candidates=(primaryText.length?primaryText:editableText.filter(layer=>(+layer.size||0)>=14)).sort((a,b)=>(+b.size||0)-(+a.size||0));
    let factIndex=0,numberIndex=0;
    const used=new Set();
    if(candidates.length){
      const numericHero=candidates.find(layer=>/\d/.test(String(layer.text||''))&&(+layer.size||0)>=55);
      if(numericHero&&parts.numbers.length){numericHero.text=wrapNativeCopyV7(parts.numbers[numberIndex++],numericHero,2);used.add(numericHero);}
      const headlineLayer=candidates.find(layer=>!used.has(layer));
      if(headlineLayer){headlineLayer.text=wrapNativeCopyV7(parts.headline,headlineLayer,3);used.add(headlineLayer);}
      candidates.filter(layer=>!used.has(layer)).slice(0,4).forEach((layer,index)=>{
        const value=index===0?parts.secondary:(parts.facts[factIndex++]||parts.lines[factIndex]||parts.secondary);
        layer.text=wrapNativeCopyV7(value,layer,index===0?4:3);used.add(layer);
      });
    }
    textLayers.forEach(layer=>{
      const raw=String(layer.text||''),low=raw.toLowerCase();
      if(project&&/\b(project|brand|protocol)\b/.test(low)&&(+layer.size||0)<30)layer.text=project.toUpperCase().slice(0,34);
      if(/verified fact|source fact|finding|observation/.test(low))layer.text=wrapNativeCopyV7(parts.facts[factIndex++]||parts.secondary,layer,3);
      if(/\b(source|reference)\b/.test(low)&&(+layer.size||0)<24)layer.text=(project||'PROJECT')+' · VERIFIED';
    });
    return normalizeCreativeLayers(layers,format);
  }

  window.__bwBuildNativeDesign = function(versionId,designId) {
    const version=(window.__bwStore||{})[versionId],item=v5DesignCatalog().find(entry=>entry.id===designId);
    if(!version||!item){toast('that native direction is no longer available · choose another','warn');return;}
    window.goBuilder();
    installBuilderEnhancements(); installBuilderProductV7();
    const format=window.__bapi.fmt(),layers=fillNativeDesignV7(item,version,format);
    foundationSrc='';foundationBuilderId=null;foundationLocked=false;activeCreativeDesignId=item.id;
    originalBuilderDesign={data:clone(layers),format:format[0],background:'transparent',foundationSrc:'',creativeId:item.id,themeId:creativeV5Theme,personalized:true};
    importBuilderState(layers,format[0],'transparent',layers.length-1);
    rememberV5(item.id);renderBuilderSheet();updateBuilderMetaV7();
    toast(item.name+' built from the research · every layer is editable','ok');
  };

  window.__bwBrowseNativeDesigns = function() {
    window.goBuilder(); installBuilderEnhancements(); installBuilderProductV7(); openCreativeKitV5();
  };

  function imageSources() {
    const brief = window.__bwBrief || {};
    const uploaded = (window.__bwShots || []).slice();
    const gathered = (brief.assets_for_design || []).map(asset => asset && asset.file ? '/assets/' + encodeURIComponent(asset.file) : '').filter(Boolean);
    return uploaded.concat(gathered).slice(0, 10);
  }

  function buildListValue(slot, parts) {
    const spec = listSpec(slot.label || '');
    const cols = Math.max(1, spec.heads.length);
    const material = (parts.facts.length ? parts.facts : parts.lines).slice(0, spec.max);
    while (material.length < Math.min(spec.max, 3)) material.push(parts.secondary);
    return material.slice(0, spec.max).map((fact, index) => {
      const phrase = String(fact || parts.secondary).replace(/[,]/g, '，').replace(/:/g, '：').slice(0, 72);
      if (cols === 1) return phrase;
      return spec.heads.map((head, ci) => {
        const key = head.toLowerCase();
        if (/rank|no\.?|#/.test(key)) return String(index + 1);
        if (/done|pass|good|check/.test(key)) return '1';
        if (/pct|percent/.test(key)) return (parts.numbers[index] || (72 - index * 9) + '%').replace(/:/g, '：');
        if (/value|number|stat|price|pts|score|pool|rate|size|n$|Δ/i.test(head)) return (parts.numbers[index] || parts.numbers[0] || String((index + 1) * 10)).replace(/:/g, '：');
        if (/sub|note|body|what|task|label/.test(key) && ci > 0) return (parts.facts[index + 1] || parts.secondary).replace(/[,]/g, '，').replace(/:/g, '：').slice(0, 62);
        if (/time|date|day|month|q$/.test(key)) return index === 0 ? 'now' : 'next';
        return phrase;
      }).join(':');
    }).join(', ');
  }

  function smartTemplateValues(templateId, version) {
    const template = T[templateId];
    const next = clone(template.sample || {});
    const parts = contextParts(version);
    const project = ((document.getElementById('bw_proj') || {}).value || '').trim();
    const logoKey = projectLogoKey();
    const images = imageSources();
    let textCursor = 0;
    (template.slots || []).forEach(slot => {
      if (!slot) return;
      const key = (slot.id + ' ' + (slot.label || '')).toLowerCase();
      if (slot.t === 'logo') {
        next[slot.id] = logoKey;
      } else if (slot.t === 'images') {
        next[slot.id] = images.slice(0, slot.max || 4);
      } else if (slot.t === 'pfpform') {
        next.pfp = next.pfp || 'cut';
      } else if (slot.t === 'text') {
        if (/×\s*\d|comma/i.test(slot.label || '')) {
          next[slot.id] = buildListValue(slot, parts);
        } else if (/accent/.test(key)) {
          next[slot.id] = (project || parts.headline.split(/\s+/).slice(-2).join(' ')).slice(0, 28);
        } else if (/big number|big stat|\bnumber\b|\bstat\b|\bpct\b|\bscore\b|\bprice\b|\bvalue\b|\bn\b/.test(key)) {
          next[slot.id] = parts.numbers[textCursor++ % Math.max(parts.numbers.length, 1)] || '01';
        } else if (/title|headline|\bhead\b|\bhook\b|\bmarket\b|\bquestion\b|\bq\b|line 1|main/.test(key)) {
          next[slot.id] = parts.headline;
        } else if (/brand name|project/.test(key) && project) {
          next[slot.id] = project;
        } else if (/who|author|handle|source/.test(key)) {
          next[slot.id] = key.includes('source') ? (project || 'project research') : 'cmvng';
        } else if (/sub|note|caption|body|what|foot|line 2|line 3|thesis/.test(key)) {
          next[slot.id] = (parts.lines[textCursor++ % Math.max(parts.lines.length, 1)] || parts.secondary).slice(0, 150);
        } else {
          next[slot.id] = (parts.lines[textCursor++ % Math.max(parts.lines.length, 1)] || parts.secondary).slice(0, 110);
        }
      }
    });
    if (templateId === version.template && version.slots && typeof version.slots === 'object') {
      Object.keys(version.slots).forEach(key => {
        if ((template.slots || []).some(slot => slot.id === key)) next[key] = version.slots[key];
      });
    }
    next.branding = true;
    next.brandmode = next.brandmode || 'chip';
    next.skin = next.skin || 'detailed';
    next.format = next.format || 'post';
    next.tone = next.tone || 'classic';
    if (next.decor === undefined) next.decor = true;
    return next;
  }

  function prepareDesign(versionId, templateId) {
    const version = (window.__bwStore || {})[versionId];
    if (!version || !T[templateId]) return false;
    suppressTemplateSave = true;
    openT(templateId);
    vals = smartTemplateValues(templateId, version);
    drawPanel();
    drawPreview();
    suppressTemplateSave = false;
    saveTemplateDraft();
    return true;
  }

  window.__bwEditDesign = function (versionId, templateId) {
    const version = (window.__bwStore || {})[versionId];
    const choice = templateId || (version && version.__chosenTemplate) || designChoices(version || {})[0];
    if (!prepareDesign(versionId, choice)) return;
    window.scrollTo(0, 0);
    toast('best-fit template filled · every field is editable', 'ok');
  };

  window.__bwBuildDesign = async function (versionId, templateId) {
    const version = (window.__bwStore || {})[versionId];
    const choice = templateId || (version && version.__chosenTemplate) || designChoices(version || {})[0];
    if (!prepareDesign(versionId, choice)) return;
    toast('building editable layers from ' + T[choice].name + '…');
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await window.openInBuilder();
  };

  function enhanceDraftCards() {
    const out = document.getElementById('bw_out');
    if (!out) return;
    const resultButtons = out.querySelectorAll('.bw-copy[data-id]');
    if (resultButtons.length && !out.querySelector('.bw-results-banner')) {
      const firstResult = resultButtons[0].closest('.bw-card');
      const banner = document.createElement('div');
      banner.className = 'bw-results-banner';
      banner.innerHTML = '<i>✓</i><div><b>writing complete · choose the visual direction</b>' +
        '<small>real previews filled with your content — not generic template names</small></div>';
      if (firstResult) firstResult.insertAdjacentElement('beforebegin', banner); else out.prepend(banner);
    }
    if (resultButtons.length) setWriterFlow(2);
    resultButtons.forEach(copyButton => {
      const id = copyButton.getAttribute('data-id');
      const version = (window.__bwStore || {})[id];
      const card = copyButton.closest('.bw-card');
      if (!version || !card || card.dataset.designEnhanced) return;
      card.dataset.designEnhanced = '1';
      const recommendations = designRecommendations(version);
      if(!recommendations.length) return;
      version.__chosenDesign = recommendations[0].key;
      const fit = document.createElement('div');
      fit.className = 'bw-design-fit';
      fit.innerHTML = '<div class="bw-design-fit-head"><span>visual directions · matched to this story</span><b>best fit · ' +
        escEnh(recommendations[0].name) + '</b></div>' +
        '<div class="bw-design-gallery">' + recommendations.map((item, index) =>
          '<button type="button" class="bw-design-card ' + (index === 0 ? 'on' : '') + '" data-design-key="' + escEnh(item.key) + '">' +
            '<div class="bw-design-visual">' + (item.kind==='native' ? v5Preview(fillNativeDesignV7(item.item,version,['preview',1080,1350]),['preview',1080,1350]) : '<div class="bw-template-mini" data-preview-template="'+escEnh(item.id)+'"></div>') +
              '<span class="bw-design-score">' + item.score + '% fit</span></div>' +
            '<div class="bw-design-meta"><b>' + escEnh(item.name) + '</b><i class="bw-design-check">' + (index === 0 ? '✓' : '→') + '</i>' +
              '<span><u class="bw-design-kind">'+(item.kind==='native'?'native layers':'classic template')+'</u> · ' + escEnh(item.reason) + '</span></div></button>').join('') + '</div>' +
        '<div class="bw-selected-fit"><i>✦</i><div><b>why this one</b><span>' + escEnh(recommendations[0].reason) +
          '. The preview is already populated from the research and draft above.</span></div></div>' +
        '<div class="bw-build-actions"><button type="button" class="bw-build-now">build native editable design →</button>' +
        '<button type="button" class="bw-edit-first">browse all systems</button></div>';
      const tags = card.querySelector('.bw-tags');
      if (tags) tags.insertAdjacentElement('beforebegin', fit); else card.appendChild(fit);
      fit.querySelectorAll('[data-preview-template]').forEach(host => {
        hydrateTemplatePreview(host, host.dataset.previewTemplate, smartTemplateValues(host.dataset.previewTemplate, version));
      });
      fit.querySelectorAll('.bw-design-card').forEach(button => {
        button.onclick = () => {
          version.__chosenDesign = button.dataset.designKey;
          fit.querySelectorAll('.bw-design-card').forEach(x => {
            const selected = x === button;
            x.classList.toggle('on', selected);
            const check = x.querySelector('.bw-design-check');
            if (check) check.textContent = selected ? '✓' : '→';
          });
          const match = recommendations.find(item => item.key === button.dataset.designKey);
          if(!match) return;
          const best = fit.querySelector('.bw-design-fit-head b');
          if (best) best.textContent = 'selected · ' + match.name;
          const selectedReason = fit.querySelector('.bw-selected-fit span');
          if (selectedReason) selectedReason.textContent = match.reason + '. The preview is already populated from the research and draft above.';
          const build = fit.querySelector('.bw-build-now');
          if (build) build.textContent = (match.kind==='native'?'build native ':'build classic ')+match.name.toLowerCase()+' →';
          const secondary=fit.querySelector('.bw-edit-first');
          if(secondary) secondary.textContent=match.kind==='native'?'browse all systems':'edit template first';
        };
      });
      fit.querySelector('.bw-build-now').onclick = () => {
        const match=recommendations.find(item=>item.key===version.__chosenDesign)||recommendations[0];
        if(match.kind==='native')window.__bwBuildNativeDesign(id,match.id);else window.__bwBuildDesign(id,match.id);
      };
      fit.querySelector('.bw-edit-first').onclick = () => {
        const match=recommendations.find(item=>item.key===version.__chosenDesign)||recommendations[0];
        if(match.kind==='native')window.__bwBrowseNativeDesigns();else window.__bwEditDesign(id,match.id);
      };
      const oldFill = card.querySelector('.bw-fill');
      if (oldFill) oldFill.style.display = 'none';
    });
  }

  window.__bwEnhanceDrafts = enhanceDraftCards;
  const draftObserver = new MutationObserver(enhanceDraftCards);
  function watchDrafts() {
    const out = document.getElementById('bw_out');
    if (out) {
      draftObserver.observe(out, {childList:true, subtree:true});
      enhanceDraftCards();
      return true;
    }
    return false;
  }
  if (!watchDrafts()) {
    const bodyObserver = new MutationObserver(() => {
      if (watchDrafts()) bodyObserver.disconnect();
    });
    bodyObserver.observe(document.body, {childList:true, subtree:true});
  }

  /* ---------- Complete template handoff to Builder ---------- */
  const nativeOpenInBuilder = window.openInBuilder;

  function stripContentForBackground(root) {
    root.querySelectorAll('img,svg,canvas,video,picture').forEach(node => node.remove());
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);
    textNodes.forEach(node => node.textContent = '');
    root.querySelectorAll('.chip,.mk,.meta,.num,.bd').forEach(node => {
      const cs = getComputedStyle(node);
      if (cs.backgroundColor === 'rgba(0, 0, 0, 0)' && (!cs.backgroundImage || cs.backgroundImage === 'none')) node.remove();
    });
  }

  async function captureDesignBackground() {
    const stageNode = document.getElementById('stage');
    const root = stageNode && stageNode.firstElementChild;
    if (!root || !window.htmlToImage) return '';
    const frame = frameHTML(vals);
    const cloneRoot = root.cloneNode(true);
    stripContentForBackground(cloneRoot);
    cloneRoot.style.filter = '';
    const holder = document.createElement('div');
    holder.style.cssText = 'position:fixed;left:-12000px;top:0;width:' + frame.W + 'px;height:' + frame.H +
      'px;overflow:hidden;pointer-events:none;z-index:-1';
    holder.appendChild(cloneRoot);
    document.body.appendChild(holder);
    try {
      await document.fonts.ready;
      return await htmlToImage.toPng(cloneRoot, {pixelRatio:1,width:frame.W,height:frame.H});
    } finally {
      holder.remove();
    }
  }

  function normalizeHandoff(items, frame) {
    const W = Math.max(320, +(frame && frame.W) || 1080);
    const H = Math.max(320, +(frame && frame.H) || 1350);
    const seenText = [];
    return (Array.isArray(items) ? items : []).reduce((clean, source) => {
      if (!source || !source.type) return clean;
      const item = Object.assign({}, source);
      const rawWidth = Number(item.w);
      const rawX = Number(item.x);
      const rawY = Number(item.y);
      if (![rawWidth, rawX, rawY].every(Number.isFinite)) return clean;
      item.w = Math.round(Math.max(24, Math.min(W * 1.15, rawWidth)));
      const estimatedHeight = item.type === 'text'
        ? Math.max(24, (+item.size || 42) * (+item.lh || 1.15) * Math.max(1, String(item.text || '').split('\n').length))
        : Math.max(24, item.w * (+item.ar || .72));
      item.x = Math.round(Math.max(-item.w * .08, Math.min(W - item.w * .12, rawX)));
      item.y = Math.round(Math.max(-estimatedHeight * .08, Math.min(H - estimatedHeight * .12, rawY)));
      if (item.type === 'text') {
        item.text = String(item.text || '').replace(/\u00a0/g, ' ').trim();
        if (!item.text) return clean;
        const signature = item.text.toLowerCase().replace(/\s+/g, ' ');
        const duplicate = seenText.some(prior => prior.signature === signature && Math.abs(prior.x - item.x) < 24 && Math.abs(prior.y - item.y) < 24);
        if (duplicate) return clean;
        seenText.push({signature, x:item.x, y:item.y});
      }
      clean.push(item);
      return clean;
    }, []).slice(0, 47);
  }

  function isFoundationItem(item) {
    return !!item && ((foundationBuilderId && item.__id === foundationBuilderId) || (foundationSrc && item.src === foundationSrc));
  }

  function applyFoundationLock() {
    if (!foundationSrc || !window.__bapi) return;
    const state = builderState();
    const index = state.data.findIndex(isFoundationItem);
    if (index >= 0 && state.list[index]) foundationBuilderId = state.list[index].id;
    const node = foundationBuilderId && document.getElementById('bdel' + foundationBuilderId);
    if (node) {
      node.classList.toggle('bw-foundation-layer', foundationLocked);
      node.setAttribute('aria-label', foundationLocked ? 'locked design foundation' : 'unlocked design foundation');
    }
    if (foundationLocked && selectedBuilderId === foundationBuilderId) {
      selectedBuilderId = null;
      if (window.__bapi.deselect) window.__bapi.deselect();
    }
  }

  function resetOriginalBuilderDesign() {
    if (!originalBuilderDesign || !Array.isArray(originalBuilderDesign.data)) {
      toast('open a template in Builder first', 'warn');
      return;
    }
    foundationSrc = originalBuilderDesign.foundationSrc || '';
    foundationLocked = true;
    importBuilderState(clone(originalBuilderDesign.data), originalBuilderDesign.format, originalBuilderDesign.background, null);
    requestAnimationFrame(applyFoundationLock);
    renderBuilderSheet();
    toast('original template composition restored', 'ok');
  }

  window.openInBuilder = async function completeOpenInBuilder() {
    if (!cur) return 0;
    const stageNode = document.getElementById('stage');
    const frame = frameHTML(vals);
    stageNode.parentElement.style.width = frame.W + 'px';
    stageNode.parentElement.style.height = frame.H + 'px';
    stageNode.innerHTML = frame.html;
    stageNode.firstElementChild.style.filter = '';
    fitPass(stageNode);
    await document.fonts.ready;
    await new Promise(resolve => setTimeout(resolve, 120));
    let background = '';
    try { background = await captureDesignBackground(); } catch (_) {}
    const count = await nativeOpenInBuilder();
    const data = normalizeHandoff(window.__bapi.serialize(), frame);
    const format = window.__bapi.fmt()[0];
    foundationSrc = background || '';
    foundationLocked = true;
    const foundation = background ? [{type:'img',src:background,x:0,y:0,w:frame.W,ar:frame.H / frame.W}] : [];
    const completeDesign = foundation.concat(data);
    suppressBuilderSave = true;
    window.__bapi.importEls(completeDesign, format, 'transparent');
    suppressBuilderSave = false;
    const imported = window.__bapi.list();
    foundationBuilderId = background && imported[0] ? imported[0].id : null;
    originalBuilderDesign = {data:clone(completeDesign),format,background:'transparent',foundationSrc};
    requestAnimationFrame(applyFoundationLock);
    installBuilderEnhancements();
    scheduleBuilderSave();
    const total = completeDesign.length;
    const cleaned = Math.max(0, count - data.length);
    toast('remix ready · ' + total + ' stable layers' + (cleaned ? ' · ' + cleaned + ' duplicate/off-canvas layer' + (cleaned === 1 ? '' : 's') + ' cleaned' : ''), 'ok');
    return total;
  };

  /* ---------- Builder inspector, layers, shapes, and autosave ---------- */
  function builderState() {
    const list = window.__bapi.list();
    const data = window.__bapi.serialize();
    data.forEach((item, index) => {
      item.__id = list[index] && list[index].id;
      if ((item.type === 'shot' || item.type === 'img') && !item.ar && list[index]) {
        item.ar = list[index].h / Math.max(1, list[index].w);
      }
    });
    return {list, data, format:window.__bapi.fmt()[0], background:document.getElementById('bd_canvas').style.background || ''};
  }

  function normaliseBuilderSvgrawRenderingV7() {
    if(!window.__bapi)return;
    const list=window.__bapi.list(),data=window.__bapi.serialize();
    data.forEach((item,index)=>{
      if(item.type!=='svgraw'||!list[index])return;
      const svg=document.querySelector('#bdel'+list[index].id+' .el-doodle svg');
      if(svg&&svg.getAttribute('preserveAspectRatio')!=='none')svg.setAttribute('preserveAspectRatio','none');
    });
  }

  function importBuilderState(data, format, background, selectedIndex) {
    const geometry=builderGeometryV6();
    const bounded=geometry?geometry.normalizeComposition(data,format||window.__bapi.fmt()[0],{padding:0}):data;
    const clean = bounded.map(item => {
      const next = Object.assign({}, item);
      delete next.__id;
      return next;
    });
    suppressBuilderSave = true;
    window.__bapi.importEls(clean, format || window.__bapi.fmt()[0], background || '');
    suppressBuilderSave = false;
    normaliseBuilderSvgrawRenderingV7();
    const nextList = window.__bapi.list();
    const foundationIndex = clean.findIndex(item => foundationSrc && item.src === foundationSrc);
    foundationBuilderId = foundationIndex >= 0 && nextList[foundationIndex] ? nextList[foundationIndex].id : null;
    if (typeof selectedIndex === 'number' && nextList[selectedIndex]) {
      selectedBuilderId = nextList[selectedIndex].id;
      window.__bapi.select(selectedBuilderId);
    } else {
      selectedBuilderId = null;
    }
    requestAnimationFrame(applyFoundationLock);
    scheduleBuilderSave();
  }

  function selectedIndex(state) {
    return state.list.findIndex(item => item.id === selectedBuilderId);
  }

  function mutateSelected(mutator, keepIndex) {
    const state = builderState();
    const index = selectedIndex(state);
    if (index < 0) {
      toast('select a layer on the canvas first', 'warn');
      return;
    }
    if (foundationLocked && isFoundationItem(state.data[index])) {
      toast('the design foundation is locked · unlock it in Layers if you really need to move it', 'warn');
      return;
    }
    mutator(state.data, index, state);
    const target = keepIndex == null ? Math.min(index, state.data.length - 1) : keepIndex;
    importBuilderState(state.data, state.format, state.background, target);
    renderBuilderSheet();
  }

  function describeLayer(item, index) {
    if (isFoundationItem(item)) return 'design foundation' + (foundationLocked ? ' · locked' : ' · unlocked');
    if (item.type === 'text') return (item.text || 'text').replace(/\s+/g, ' ').slice(0, 34);
    if (item.type === 'logo') return (item.key || 'coin') + ' logo';
    if (item.type === 'char' || item.type === 'cast' || item.type === 'peep' || item.type === 'mascot') return 'character';
    if (item.type === 'svgraw' || item.type === 'doodle') return 'shape / decoration';
    if (item.type === 'img' || item.type === 'shot') return 'image';
    return item.type + ' ' + (index + 1);
  }

  function selectedControlHTML(state, index) {
    if (index < 0) return '<div class="bw-inspector-section"><label>selection</label><div style="font:600 12px Sora;color:#6C82AB;line-height:1.5">Tap any layer on the canvas, then reopen Layers to edit it.</div></div>';
    const item = state.data[index];
    let html = '<div class="bw-inspector-section"><label>selected · ' + escEnh(describeLayer(item, index)) + '</label>';
    if (isFoundationItem(item)) {
      return html + '<div style="font:600 12px Sora;color:#6C82AB;line-height:1.55">This preserves the original template styling behind your editable layers. Keep it locked for a scatter-proof remix.</div>' +
        '<div class="bw-control-grid" style="margin-top:9px"><button class="bw-ctrl primary" data-a="toggle-foundation">' + (foundationLocked ? 'unlock foundation' : 'lock foundation') + '</button>' +
        '<button class="bw-ctrl" data-a="reset-original">reset original</button></div></div>';
    }
    if (item.type === 'text') {
      html += '<textarea class="bw-inspector-text" id="bw_text_value" aria-label="Edit selected text">' + escEnh(item.text || '') + '</textarea>' +
        '<button class="bw-ctrl primary" data-a="apply-text" style="width:100%;margin-top:7px">apply text</button>' +
        '<div class="bw-range"><span>type size</span><input id="bw_font_size" type="range" min="12" max="180" value="' +
        Math.round(item.size || 60) + '"><output>' + Math.round(item.size || 60) + '</output></div>' +
        '<div class="bw-range"><span>line height</span><input id="bw_line_height" type="range" min="80" max="180" value="' +
        Math.round(parseFloat(item.lh || 1.2) * 100) + '"><output>' + Math.round(parseFloat(item.lh || 1.2) * 100) + '%</output></div>' +
        '<div class="bw-color-row"><input id="bw_text_color" type="color" value="' + rgbToHex(item.color || '#0C1B33') +
        '"><input id="bw_text_color_value" type="text" value="' + escEnh(item.color || '#0C1B33') + '"></div>' +
        '<div class="bw-control-grid" style="margin-top:8px"><button class="bw-ctrl" data-a="bold">bold</button>' +
        '<button class="bw-ctrl" data-a="italic">italic</button></div>';
    } else if (item.type === 'img' || item.type === 'shot') {
      html += '<div class="bw-control-grid three"><button class="bw-ctrl" data-ar="1">square</button>' +
        '<button class="bw-ctrl" data-ar="1.25">portrait</button><button class="bw-ctrl" data-ar="0.5625">wide</button></div>' +
        '<button class="bw-ctrl primary" data-a="replace-image" style="width:100%;margin-top:8px">replace image</button>';
    }
    const format=window.__bapi.fmt();
    html += '<div class="bw-range"><span>layer width</span><input id="bw_layer_width" type="range" min="24" max="' + Math.round(format[1]) + '" value="' + Math.round(item.w || 200) + '"><output>' + Math.round(item.w || 200) + '</output></div>' +
      '<div class="bw-position-grid"><label>X<input id="bw_layer_x" type="number" min="0" max="' + Math.round(format[1]) + '" value="' + Math.round(item.x || 0) + '"></label><label>Y<input id="bw_layer_y" type="number" min="0" max="' + Math.round(format[2]) + '" value="' + Math.round(item.y || 0) + '"></label></div>' +
      '<div class="bw-control-grid three" style="margin-top:8px"><button class="bw-ctrl" data-a="align-left">align left</button><button class="bw-ctrl primary" data-a="align-center">center x</button><button class="bw-ctrl" data-a="align-right">align right</button>' +
      '<button class="bw-ctrl" data-a="align-top">align top</button><button class="bw-ctrl primary" data-a="align-middle">center y</button><button class="bw-ctrl" data-a="align-bottom">align bottom</button></div>' +
      '<div class="bw-control-grid" style="margin-top:8px"><button class="bw-ctrl" data-a="nudge-left">← nudge</button><button class="bw-ctrl" data-a="nudge-up">↑ nudge</button><button class="bw-ctrl" data-a="nudge-down">↓ nudge</button><button class="bw-ctrl" data-a="nudge-right">nudge →</button></div>' +
      '<div class="bw-control-grid" style="margin-top:8px"><button class="bw-ctrl" data-a="back">send backward</button>' +
      '<button class="bw-ctrl" data-a="front">bring forward</button><button class="bw-ctrl" data-a="duplicate">duplicate</button>' +
      '<button class="bw-ctrl danger" data-a="delete">delete</button></div></div>';
    return html;
  }

  function rgbToHex(value) {
    if (/^#[0-9a-f]{6}$/i.test(value)) return value;
    const nums = String(value).match(/\d+/g);
    if (!nums || nums.length < 3) return '#0C1B33';
    return '#' + nums.slice(0, 3).map(n => Math.max(0, Math.min(255, +n)).toString(16).padStart(2, '0')).join('');
  }

  function renderBuilderSheet() {
    const sheet = document.getElementById('bw_builder_sheet');
    if (!sheet || !sheet.classList.contains('on')) return;
    const state = builderState();
    const index = selectedIndex(state);
    const host = sheet.querySelector('.bw-sheet');
    host.innerHTML = '<div class="bw-sheet-head"><div><b>builder controls</b><br><small>' + state.data.length +
      ' editable layers · autosave on</small></div><button type="button" data-close>×</button></div>' +
      (originalBuilderDesign ? '<div class="bw-inspector-section"><label>safe remix</label><div style="display:flex;align-items:center;justify-content:space-between;gap:10px"><span class="bw-foundation-locked">' + (foundationLocked ? '◆ foundation locked' : '◇ foundation unlocked') + '</span><div class="bw-control-grid" style="flex:1"><button class="bw-ctrl" data-a="toggle-foundation">' + (foundationLocked ? 'unlock' : 'lock') + '</button><button class="bw-ctrl" data-a="reset-original">reset original</button></div></div><div style="font:600 11px Sora;color:#6C82AB;line-height:1.5;margin-top:8px">Reset restores the exact template handoff if experimenting moves anything out of place.</div></div>' : '') +
      selectedControlHTML(state, index) +
      '<div class="bw-inspector-section"><label>canvas background</label><div class="bw-color-row">' +
      '<input id="bw_canvas_color" type="color" value="#EDF3FC"><button class="bw-ctrl" data-a="apply-bg" style="flex:1">apply color</button>' +
      '<button class="bw-ctrl" data-a="clear-bg" style="flex:1">transparent</button></div></div>' +
      '<div class="bw-inspector-section"><label>add shape</label><div class="bw-control-grid three">' +
      '<button class="bw-ctrl" data-shape="rect">rectangle</button><button class="bw-ctrl" data-shape="circle">circle</button>' +
      '<button class="bw-ctrl" data-shape="line">line</button></div></div>' +
      '<div class="bw-inspector-section"><label>layers · back to front</label><div id="bw_layer_list">' +
      state.data.map((item, i) => '<div class="bw-layer ' + (i === index ? 'on' : '') + '" data-index="' + i +
        '"><i>' + (i + 1) + '</i><span>' + escEnh(describeLayer(item, i)) + '</span><small>' + escEnh(item.type) + '</small></div>').join('') +
      '</div></div>' +
      '<div class="bw-control-grid"><button class="bw-ctrl primary" data-a="save-now">save draft now</button>' +
      '<button class="bw-ctrl" data-a="restore">restore autosave</button><button class="bw-ctrl" data-a="save-library">save to library</button>' +
      '<button class="bw-ctrl danger" data-a="clear-canvas">clear canvas</button></div>';
    host.querySelector('[data-close]').onclick = () => sheet.classList.remove('on');
    host.querySelectorAll('.bw-layer').forEach(row => row.onclick = () => {
      const i = +row.dataset.index;
      const list = window.__bapi.list();
      if (!list[i]) return;
      selectedBuilderId = list[i].id;
      window.__bapi.select(selectedBuilderId);
      renderBuilderSheet();
    });
    const bind = (selector, fn) => {
      const node = host.querySelector(selector);
      if (node) node.onclick = fn;
    };
    host.querySelectorAll('[data-a="toggle-foundation"]').forEach(node => node.onclick = () => {
      foundationLocked = !foundationLocked;
      applyFoundationLock();
      renderBuilderSheet();
      toast(foundationLocked ? 'design foundation locked' : 'foundation unlocked · move carefully', foundationLocked ? 'ok' : 'warn');
    });
    host.querySelectorAll('[data-a="reset-original"]').forEach(node => node.onclick = resetOriginalBuilderDesign);
    bind('[data-a="back"]', () => mutateSelected((data, i) => {
      if (i > 0) [data[i - 1], data[i]] = [data[i], data[i - 1]];
    }, Math.max(0, index - 1)));
    bind('[data-a="front"]', () => mutateSelected((data, i) => {
      if (i < data.length - 1) [data[i + 1], data[i]] = [data[i], data[i + 1]];
    }, Math.min(state.data.length - 1, index + 1)));
    bind('[data-a="duplicate"]', () => mutateSelected((data, i) => {
      const copy = clone(data[i]); copy.x = (copy.x || 0) + 36; copy.y = (copy.y || 0) + 36;
      data.splice(i + 1, 0, copy);
    }, index + 1));
    bind('[data-a="delete"]', () => mutateSelected((data, i) => data.splice(i, 1), Math.max(0, index - 1)));
    bind('[data-a="bold"]', () => mutateSelected((data, i) => data[i].fw = String(data[i].fw) === '800' ? '400' : '800'));
    bind('[data-a="italic"]', () => mutateSelected((data, i) => data[i].fst = data[i].fst === 'italic' ? '' : 'italic'));
    const textValue=host.querySelector('#bw_text_value');
    if(textValue) textValue.onchange=event=>mutateSelected((data,i)=>data[i].text=event.target.value);
    bind('[data-a="apply-text"]',()=>{const value=host.querySelector('#bw_text_value');if(value)mutateSelected((data,i)=>data[i].text=value.value);});
    bind('[data-a="replace-image"]', replaceSelectedBuilderImage);
    host.querySelectorAll('[data-ar]').forEach(button => button.onclick = () => mutateSelected((data, i, st) => {
      data[i].type = 'img';
      data[i].ar = +button.dataset.ar;
      if (!data[i].src) data[i].src = '';
    }));
    const fontSize = host.querySelector('#bw_font_size');
    if (fontSize) {
      fontSize.oninput = event => {
        const output = event.target.nextElementSibling; if (output) output.value = event.target.value;
      };
      fontSize.onchange = event => mutateSelected((data, i) => data[i].size = +event.target.value);
    }
    const lineHeight = host.querySelector('#bw_line_height');
    if (lineHeight) {
      lineHeight.oninput = event => {
        const output = event.target.nextElementSibling; if (output) output.value = event.target.value + '%';
      };
      lineHeight.onchange = event => mutateSelected((data, i) => data[i].lh = (+event.target.value / 100).toFixed(2));
    }
    const layerWidth=host.querySelector('#bw_layer_width');
    if(layerWidth) {
      layerWidth.oninput=event=>{const output=event.target.nextElementSibling;if(output)output.value=event.target.value;};
      layerWidth.onchange=event=>mutateSelected((data,i)=>{
        const previous=Math.max(1,+data[i].w||1),next=Math.max(24,+event.target.value||24);
        if(data[i].type==='text') data[i].size=Math.max(12,(+data[i].size||60)*next/previous);
        data[i].w=next;
      });
    }
    const applyPosition=()=>mutateSelected((data,i)=>{
      const x=host.querySelector('#bw_layer_x'),y=host.querySelector('#bw_layer_y');
      if(x)data[i].x=+x.value||0;if(y)data[i].y=+y.value||0;
    });
    const layerX=host.querySelector('#bw_layer_x'),layerY=host.querySelector('#bw_layer_y');
    if(layerX)layerX.onchange=applyPosition;if(layerY)layerY.onchange=applyPosition;
    const alignSelected=mode=>mutateSelected((data,i)=>{
      const item=data[i],format=window.__bapi.fmt(),geometry=builderGeometryV6();
      const h=geometry?geometry.layerHeight(item):(+item.w||200)*(+item.ar||1),w=+item.w||200;
      if(mode==='left')item.x=0;if(mode==='center')item.x=(format[1]-w)/2;if(mode==='right')item.x=format[1]-w;
      if(mode==='top')item.y=0;if(mode==='middle')item.y=(format[2]-h)/2;if(mode==='bottom')item.y=format[2]-h;
    });
    ['left','center','right','top','middle','bottom'].forEach(mode=>bind('[data-a="align-'+mode+'"]',()=>alignSelected(mode)));
    const nudge=(dx,dy)=>mutateSelected((data,i)=>{data[i].x=(+data[i].x||0)+dx;data[i].y=(+data[i].y||0)+dy;});
    bind('[data-a="nudge-left"]',()=>nudge(-12,0));bind('[data-a="nudge-right"]',()=>nudge(12,0));
    bind('[data-a="nudge-up"]',()=>nudge(0,-12));bind('[data-a="nudge-down"]',()=>nudge(0,12));
    const textColor = host.querySelector('#bw_text_color');
    if (textColor) textColor.onchange = event => mutateSelected((data, i) => data[i].color = event.target.value);
    bind('[data-a="apply-bg"]', () => {
      const color = host.querySelector('#bw_canvas_color').value;
      const current = builderState();
      importBuilderState(current.data, current.format, color, index);
      renderBuilderSheet();
    });
    bind('[data-a="clear-bg"]', () => {
      const current = builderState();
      importBuilderState(current.data, current.format, 'transparent', index);
      renderBuilderSheet();
    });
    host.querySelectorAll('[data-shape]').forEach(button => button.onclick = () => addBuilderShape(button.dataset.shape));
    bind('[data-a="save-now"]', () => { saveBuilderDraft(true); });
    bind('[data-a="restore"]', restoreBuilderDraft);
    bind('[data-a="save-library"]',()=>{if(typeof window.saveComp==='function')window.saveComp();sheet.classList.remove('on');});
    bind('[data-a="clear-canvas"]',()=>{if(typeof window.clearAll==='function')window.clearAll();originalBuilderDesign=null;activeCreativeDesignId='';sheet.classList.remove('on');toast('canvas cleared','ok');});
  }

  function openBuilderSheet() {
    let sheet = document.getElementById('bw_builder_sheet');
    if (!sheet) {
      sheet = document.createElement('div');
      sheet.id = 'bw_builder_sheet';
      sheet.innerHTML = '<div class="bw-sheet"></div>';
      sheet.onclick = event => { if (event.target === sheet) sheet.classList.remove('on'); };
      document.body.appendChild(sheet);
    }
    sheet.classList.add('on');
    renderBuilderSheet();
  }

  const KIT_THEMES = [
    {id:'electric',name:'electric blue',bg:'#EAF1FF',ink:'#101C33',accent:'#2E6BFF',soft:'#BFD1F5',font:'Sora'},
    {id:'midnight',name:'midnight signal',bg:'#071124',ink:'#FFFFFF',accent:'#68F0B2',soft:'#17335B',font:'Sora'},
    {id:'paper',name:'research paper',bg:'#F7F2E8',ink:'#221D18',accent:'#E5532D',soft:'#DCD2C1',font:'Instrument Serif'},
    {id:'acid',name:'acid terminal',bg:'#D8FF47',ink:'#101C18',accent:'#101C18',soft:'#B6D836',font:'Archivo Black'},
    {id:'sunset',name:'sunset memo',bg:'#FFF0E8',ink:'#3E1820',accent:'#FF6C43',soft:'#FFC7B5',font:'Sora'},
    {id:'infra',name:'infra red',bg:'#170B0D',ink:'#FFF5F1',accent:'#FF4D45',soft:'#522124',font:'Archivo Black'},
    {id:'lavender',name:'lavender editorial',bg:'#F1ECFF',ink:'#241642',accent:'#8C5CFF',soft:'#D6C9FA',font:'Instrument Serif'},
    {id:'aqua',name:'aqua protocol',bg:'#E7FBF8',ink:'#092E34',accent:'#00A99A',soft:'#AEE4DE',font:'Sora'},
    {id:'mono',name:'monochrome',bg:'#F4F4F2',ink:'#111111',accent:'#707070',soft:'#D2D2CF',font:'Archivo Black'},
    {id:'gold',name:'conviction gold',bg:'#11100D',ink:'#FFF8E5',accent:'#FFC53D',soft:'#514526',font:'Sora'}
  ];

  const KIT_COMPOSITIONS = [
    {id:'spotlight',name:'signal spotlight',category:'research',note:'one sharp thesis with supporting context',kicker:'RESEARCH NOTE',title:'THE SIGNAL\nEVERYONE MISSED.'},
    {id:'receipts',name:'receipts stack',category:'research',note:'claim plus three verified proof cards',kicker:'SHOW THE RECEIPTS',title:'ONE CLAIM.\nTHREE FACTS.'},
    {id:'thesis',name:'editorial thesis',category:'opinion',note:'high-conviction quote and human observation',kicker:'CMVNG THESIS',title:'the product is live.\nthe narrative is late.'},
    {id:'breaking',name:'breaking wire',category:'updates',note:'urgent launch, funding or product update',kicker:'BREAKING · LIVE',title:'SOMETHING\nJUST CHANGED.'},
    {id:'metric',name:'metric hero',category:'data',note:'one number dominates the composition',kicker:'THE NUMBER',title:'18.4M'},
    {id:'duel',name:'data duel',category:'comparison',note:'before/after or project-versus-project',kicker:'REALITY CHECK',title:'NARRATIVE\nVS REALITY'},
    {id:'product',name:'product teardown',category:'product',note:'feature map with current-status labels',kicker:'PRODUCT BREAKDOWN',title:'WHAT ACTUALLY\nWORKS TODAY'},
    {id:'quote',name:'quote impact',category:'social',note:'reaction, quote or creator takeaway',kicker:'ONE LINE',title:'“say less.\nmean more.”'},
    {id:'timeline',name:'timeline pulse',category:'roadmap',note:'three dated milestones with status clarity',kicker:'PROJECT TIMELINE',title:'FROM IDEA\nTO LIVE PRODUCT'},
    {id:'launch',name:'launch sequence',category:'updates',note:'countdown, announcement or TGE moment',kicker:'LAUNCH SEQUENCE',title:'READY FOR\nLIFTOFF.'},
    {id:'culture',name:'culture poster',category:'culture',note:'bold CT-native meme or observation',kicker:'TIMELINE ENERGY',title:'NO FLUFF.\nJUST SIGNAL.'},
    {id:'map',name:'ecosystem map',category:'product',note:'central project with connected components',kicker:'ECOSYSTEM MAP',title:'HOW THE PIECES\nCONNECT'}
  ];

  const MEGA_KITS = KIT_COMPOSITIONS.flatMap((composition, ci) => KIT_THEMES.map((theme, ti) => ({
    id:composition.id + '-' + theme.id,name:composition.name + ' · ' + theme.name,
    category:composition.category,note:composition.note,composition,theme,index:ci * KIT_THEMES.length + ti + 1
  })));

  function kitPanel(x,y,w,h,fill,stroke,round) {
    return {type:'svgraw',vb:'0 0 100 100',inner:'<rect x="2" y="2" width="96" height="96" rx="' + (round || 8) + '" fill="' + fill + '"' +
      (stroke ? ' stroke="' + stroke + '" stroke-width="3"' : '') + '/>',x,y,w,ar:h / Math.max(1,w)};
  }

  function kitText(text,x,y,w,size,color,font,weight,lh) {
    return {type:'text',text,x,y,w,size,color,ff:font || 'Sora',fw:String(weight || 800),lh:String(lh || 1),pre:1};
  }

  function buildMegaKit(kit) {
    const fmt=window.__bapi.fmt(), W=fmt[1], H=fmt[2], t=kit.theme, c=kit.composition;
    const pad=Math.round(W*.075), inner=W-pad*2, top=Math.round(H*.11);
    const base=[kitPanel(0,0,W,H,t.bg,'',0),kitText(c.kicker,pad,top,inner,22,t.accent,'Space Mono',800,1)];
    if(c.id==='spotlight') return base.concat([kitText(c.title,pad,top+65,inner,88,t.ink,t.font,800,.92),kitPanel(pad,Math.round(H*.59),inner,Math.round(H*.16),t.soft,t.ink,10),kitText('the observation goes here. keep it specific, sourced and worth repeating.',pad+34,Math.round(H*.625),inner-68,30,t.ink,'Sora',650,1.24),{type:'svgraw',vb:'0 0 100 100',inner:'<circle cx="50" cy="50" r="42" fill="none" stroke="'+t.accent+'" stroke-width="6"/><circle cx="50" cy="50" r="8" fill="'+t.accent+'"/>',x:Math.round(W*.7),y:Math.round(H*.38),w:190,ar:1}]);
    if(c.id==='receipts') return base.concat([kitText(c.title,pad,top+58,inner,78,t.ink,t.font,800,.95),...['01 · VERIFIED FACT','02 · VERIFIED FACT','03 · VERIFIED FACT'].map((label,i)=>kitPanel(pad,Math.round(H*(.42+i*.13)),inner,Math.round(H*.1),i===1?t.accent:t.soft,t.ink,7)),...['01 · VERIFIED FACT','02 · VERIFIED FACT','03 · VERIFIED FACT'].map((label,i)=>kitText(label,pad+28,Math.round(H*(.455+i*.13)),inner-56,25,i===1?t.bg:t.ink,'Space Mono',800,1))]);
    if(c.id==='thesis') return base.concat([{type:'svgraw',vb:'0 0 120 80',inner:'<path d="M8 67C8 35 21 14 48 8V25C35 29 29 39 29 49H48V72H8ZM66 67C66 35 79 14 106 8V25C93 29 87 39 87 49H106V72H66Z" fill="'+t.accent+'"/>',x:pad,y:top+65,w:190,ar:.667},kitText(c.title,pad,Math.round(H*.31),inner,72,t.ink,'Instrument Serif',500,1.02),kitText('— @cmvng · thinking in public',pad,Math.round(H*.73),inner,22,t.accent,'Space Mono',800,1)]);
    if(c.id==='breaking') return base.concat([kitPanel(0,Math.round(H*.25),W,Math.round(H*.48),t.accent,'',0),kitText(c.title,pad,Math.round(H*.34),inner,105,t.bg,'Archivo Black',800,.88),kitText('CONFIRMED · PRODUCT STATUS · SOURCE',pad,Math.round(H*.66),inner,22,t.bg,'Space Mono',800,1)]);
    if(c.id==='metric') return base.concat([kitText(c.title,pad,Math.round(H*.24),inner,190,t.accent,'Archivo Black',800,.82),kitText('verified users · volume · TVL · revenue',pad,Math.round(H*.52),inner,29,t.ink,'Space Mono',800,1.2),kitPanel(pad,Math.round(H*.64),inner,Math.round(H*.12),t.soft,t.ink,9),{type:'svgraw',vb:'0 0 180 80',inner:'<path d="M6 69L42 55L70 61L105 31L134 39L174 8" fill="none" stroke="'+t.accent+'" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>',x:pad+38,y:Math.round(H*.66),w:inner-76,ar:.444}]);
    if(c.id==='duel') return base.concat([kitText(c.title,pad,top+58,inner,72,t.ink,t.font,800,.92),kitPanel(pad,Math.round(H*.42),Math.round(inner*.47),Math.round(H*.34),t.ink,'',8),kitPanel(Math.round(W*.53),Math.round(H*.42),Math.round(inner*.47),Math.round(H*.34),t.soft,t.ink,8),kitText('BEFORE\n01\n02\n03',pad+28,Math.round(H*.47),Math.round(inner*.36),31,t.bg,'Space Mono',800,1.45),kitText('AFTER\n01\n02\n03',Math.round(W*.56),Math.round(H*.47),Math.round(inner*.36),31,t.ink,'Space Mono',800,1.45)]);
    if(c.id==='product') return base.concat([kitText(c.title,pad,top+58,inner,73,t.ink,t.font,800,.94),kitPanel(pad,Math.round(H*.39),inner,Math.round(H*.39),t.soft,t.ink,8),...['LIVE · core product','PLANNED · next release','VERIFY · source / status'].map((label,i)=>kitText(label,pad+38,Math.round(H*(.46+i*.095)),inner-76,28,i===0?t.accent:t.ink,'Space Mono',800,1))]);
    if(c.id==='quote') return base.concat([kitPanel(pad,Math.round(H*.2),inner,Math.round(H*.57),t.ink,t.accent,11),kitText(c.title,pad+45,Math.round(H*.32),inner-90,76,t.bg,'Instrument Serif',500,1.02),kitText('@creator · reaction / context',pad+45,Math.round(H*.68),inner-90,22,t.accent,'Space Mono',800,1)]);
    if(c.id==='timeline') return base.concat([kitText(c.title,pad,top+55,inner,69,t.ink,t.font,800,.94),{type:'svgraw',vb:'0 0 100 400',inner:'<path d="M50 15V385" stroke="'+t.accent+'" stroke-width="7"/><circle cx="50" cy="55" r="18" fill="'+t.bg+'" stroke="'+t.ink+'" stroke-width="7"/><circle cx="50" cy="200" r="18" fill="'+t.bg+'" stroke="'+t.ink+'" stroke-width="7"/><circle cx="50" cy="345" r="18" fill="'+t.bg+'" stroke="'+t.ink+'" stroke-width="7"/>',x:pad,y:Math.round(H*.39),w:90,ar:4},...['LIVE · milestone one','CONFIRMED · milestone two','ROADMAP · milestone three'].map((label,i)=>kitText(label,pad+120,Math.round(H*(.43+i*.14)),inner-120,27,t.ink,'Space Mono',800,1))]);
    if(c.id==='launch') return base.concat([kitText(c.title,pad,top+58,Math.round(inner*.7),86,t.ink,t.font,800,.92),{type:'svgraw',vb:'0 0 100 100',inner:'<path d="M58 12C75 19 83 35 82 53L61 74L28 41L49 20Z" fill="'+t.accent+'" stroke="'+t.ink+'" stroke-width="4"/><circle cx="62" cy="34" r="8" fill="'+t.bg+'"/><path d="M24 69L12 86M36 76L27 92" stroke="'+t.accent+'" stroke-width="7" stroke-linecap="round"/>',x:Math.round(W*.66),y:Math.round(H*.2),w:280,ar:1},kitPanel(pad,Math.round(H*.64),inner,Math.round(H*.11),t.ink,'',6),kitText('DATE · TIME · VERIFIED DESTINATION',pad+30,Math.round(H*.675),inner-60,24,t.bg,'Space Mono',800,1)]);
    if(c.id==='culture') return base.concat([kitPanel(pad,Math.round(H*.19),inner,Math.round(H*.58),t.accent,t.ink,0),kitText(c.title,pad+40,Math.round(H*.31),inner-80,100,t.ink,'Archivo Black',800,.87),{type:'svgraw',vb:'0 0 100 100',inner:'<path d="M50 4L61 18L78 12L80 31L96 40L85 55L92 72L73 77L66 94L50 84L34 94L27 77L8 72L15 55L4 40L20 31L22 12L39 18Z" fill="'+t.bg+'" stroke="'+t.ink+'" stroke-width="4"/>',x:Math.round(W*.69),y:Math.round(H*.62),w:160,ar:1}]);
    return base.concat([kitText(c.title,pad,top+58,inner,69,t.ink,t.font,800,.94),{type:'svgraw',vb:'0 0 100 100',inner:'<circle cx="50" cy="50" r="25" fill="'+t.accent+'" stroke="'+t.ink+'" stroke-width="5"/><circle cx="14" cy="25" r="10" fill="'+t.soft+'" stroke="'+t.ink+'" stroke-width="4"/><circle cx="86" cy="25" r="10" fill="'+t.soft+'" stroke="'+t.ink+'" stroke-width="4"/><circle cx="14" cy="78" r="10" fill="'+t.soft+'" stroke="'+t.ink+'" stroke-width="4"/><circle cx="86" cy="78" r="10" fill="'+t.soft+'" stroke="'+t.ink+'" stroke-width="4"/><path d="M26 31L40 42M74 31L60 42M26 72L40 58M74 72L60 58" stroke="'+t.ink+'" stroke-width="4"/>',x:Math.round(W*.2),y:Math.round(H*.39),w:Math.round(W*.6),ar:1},kitText('PROJECT',Math.round(W*.38),Math.round(H*.54),Math.round(W*.24),27,t.bg,'Space Mono',800,1)]);
  }

  function renderMegaKitCatalog(sheet) {
    const grid=sheet.querySelector('#bw_mega_grid'), search=sheet.querySelector('#bw_kit_search'), count=sheet.querySelector('#bw_kit_count');
    if(!grid || !search || !count) return;
    const active=(sheet.querySelector('.bw-kit-filter.on') || {}).dataset?.category || 'all';
    const query=search.value.trim().toLowerCase();
    const matches=MEGA_KITS.filter(kit => (active==='all' || kit.category===active) && (!query || (kit.name+' '+kit.note+' '+kit.category).toLowerCase().includes(query)));
    count.textContent=matches.length+' kits';
    grid.innerHTML=matches.length ? matches.map(kit => '<button class="bw-mega-card" data-mega="'+kit.id+'" style="--bg:'+kit.theme.bg+';--ink:'+kit.theme.ink+';--accent:'+kit.theme.accent+';--shape:'+(kit.index%2?'50%':'7px')+';--tilt:'+(kit.index%3===0?'-12deg':'8deg')+'"><div class="bw-mega-preview"></div><b>'+escEnh(kit.name)+'</b><span>'+escEnh(kit.note)+'</span><i>use kit '+String(kit.index).padStart(3,'0')+' →</i></button>').join('') : '<div class="bw-kit-empty">no kits match that search.</div>';
    grid.querySelectorAll('[data-mega]').forEach(button => button.onclick=()=>{
      const kit=MEGA_KITS.find(item=>item.id===button.dataset.mega);
      if(!kit) return;
      appendCreativeElements(buildMegaKit(kit));
      sheet.classList.remove('on');
      toast(kit.name+' loaded · every layer stays editable','ok');
    });
  }

  const CREATOR_CHARACTERS = {
    researcher:{label:'researcher',note:'magnifier + evidence',inner:'<path d="M18 120V98Q22 84 50 84Q78 84 82 98V120Z" fill="#123A9E"/><circle cx="50" cy="48" r="29" fill="#F1B98A"/><path d="M23 43Q25 13 50 13Q77 13 79 43Q62 31 23 43Z" fill="#0C1B33"/><circle cx="42" cy="48" r="3" fill="#0C1B33"/><circle cx="58" cy="48" r="3" fill="#0C1B33"/><path d="M42 61Q50 67 58 61" stroke="#0C1B33" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="72" cy="76" r="14" stroke="#2E6BFF" stroke-width="6" fill="#EAF1FF" fill-opacity=".65"/><path d="M82 86L94 99" stroke="#2E6BFF" stroke-width="7" stroke-linecap="round"/>',tags:'research magnifier facts'},
    writer:{label:'writer',note:'pen + notebook',inner:'<path d="M15 120L20 93Q28 82 50 82Q72 82 80 93L85 120Z" fill="#2E6BFF"/><circle cx="50" cy="47" r="29" fill="#8B5B3F"/><path d="M22 48Q18 16 50 13Q80 16 79 48L67 33Q48 42 22 48Z" fill="#101C33"/><circle cx="40" cy="49" r="3" fill="#101C33"/><circle cx="58" cy="49" r="3" fill="#101C33"/><path d="M42 62Q50 66 58 62" stroke="#101C33" stroke-width="3" fill="none"/><rect x="20" y="88" width="38" height="27" rx="4" fill="#fff" stroke="#101C33" stroke-width="3"/><path d="M55 105L84 79" stroke="#FFC53D" stroke-width="6" stroke-linecap="round"/><path d="M82 78L89 74L86 82Z" fill="#101C33"/>',tags:'writer pen notebook creator'},
    builder:{label:'builder',note:'tools + making',inner:'<path d="M17 120V96Q23 84 50 84Q77 84 83 96V120Z" fill="#FFC53D"/><circle cx="50" cy="48" r="28" fill="#C68157"/><path d="M23 36Q28 13 50 13Q72 13 77 36Z" fill="#2E6BFF"/><rect x="20" y="32" width="60" height="10" rx="5" fill="#123A9E"/><circle cx="40" cy="49" r="3" fill="#101C33"/><circle cx="59" cy="49" r="3" fill="#101C33"/><path d="M42 62Q50 67 58 62" stroke="#101C33" stroke-width="3" fill="none"/><path d="M72 86L91 105M85 82L94 91L79 106L70 97Z" stroke="#101C33" stroke-width="5" fill="#EAF1FF" stroke-linejoin="round"/>',tags:'builder wrench construction maker'},
    analyst:{label:'analyst',note:'charts + sharp take',inner:'<path d="M16 120L21 94Q29 83 50 83Q71 83 79 94L84 120Z" fill="#101C33"/><circle cx="50" cy="46" r="29" fill="#E5AA7A"/><path d="M23 39Q29 12 51 13Q73 14 78 40Q54 26 23 39Z" fill="#4B2D24"/><rect x="29" y="43" width="17" height="12" rx="5" fill="none" stroke="#2E6BFF" stroke-width="4"/><rect x="54" y="43" width="17" height="12" rx="5" fill="none" stroke="#2E6BFF" stroke-width="4"/><path d="M46 48H54M42 64Q50 68 58 64" stroke="#101C33" stroke-width="3" fill="none"/><rect x="62" y="86" width="30" height="25" rx="4" fill="#EAF1FF"/><path d="M67 104L74 96L80 100L87 90" stroke="#18B27B" stroke-width="4" fill="none" stroke-linecap="round"/>',tags:'analyst chart glasses data'},
    astronaut:{label:'astronaut',note:'future + launch',inner:'<path d="M17 120V93Q24 80 50 80Q76 80 83 93V120Z" fill="#EAF1FF" stroke="#123A9E" stroke-width="4"/><circle cx="50" cy="46" r="34" fill="#EAF1FF" stroke="#123A9E" stroke-width="5"/><ellipse cx="50" cy="47" rx="24" ry="20" fill="#101C33"/><path d="M30 48Q50 31 70 48" stroke="#78A1FF" stroke-width="4" fill="none"/><circle cx="42" cy="51" r="3" fill="#68F0B2"/><circle cx="58" cy="51" r="3" fill="#68F0B2"/><rect x="37" y="92" width="26" height="18" rx="6" fill="#2E6BFF"/><circle cx="44" cy="101" r="3" fill="#68F0B2"/><circle cx="55" cy="101" r="3" fill="#FFC53D"/>',tags:'astronaut space future launch'},
    hype:{label:'hype mode',note:'energy + announcement',inner:'<path d="M22 120V93Q29 82 50 82Q71 82 78 93V120Z" fill="#2E6BFF"/><circle cx="50" cy="48" r="27" fill="#6F432E"/><path d="M25 40Q28 13 50 13Q72 13 75 40L65 30L55 38L45 29L35 38Z" fill="#101C33"/><path d="M38 48L45 44M55 44L62 48M40 62Q50 71 60 62" stroke="#101C33" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M24 91L7 70M76 91L93 70" stroke="#2E6BFF" stroke-width="12" stroke-linecap="round"/><path d="M5 56L12 43M88 43L95 56" stroke="#FFC53D" stroke-width="5" stroke-linecap="round"/>',tags:'hype excited announcement celebration'},
    calm:{label:'calm conviction',note:'hold + thoughtful',inner:'<path d="M18 120V96Q24 84 50 84Q76 84 82 96V120Z" fill="#18B27B"/><circle cx="50" cy="48" r="29" fill="#B8734F"/><path d="M21 44Q23 14 49 12Q76 14 79 44Q61 28 21 44Z" fill="#101C33"/><path d="M36 50Q41 46 46 50M54 50Q59 46 64 50M43 64Q50 68 57 64" stroke="#101C33" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M29 96Q50 109 71 96" stroke="#EAF1FF" stroke-width="7" fill="none" stroke-linecap="round"/><path d="M14 73C8 66 8 58 14 52M86 52C92 58 92 66 86 73" stroke="#78A1FF" stroke-width="4" fill="none" stroke-linecap="round"/>',tags:'calm thinking conviction hold'},
    anon:{label:'onchain anon',note:'hood + signal',inner:'<path d="M15 120L20 92Q26 80 50 80Q74 80 80 92L85 120Z" fill="#101C33"/><path d="M50 10Q22 13 17 48Q17 72 34 84H66Q83 72 83 48Q78 13 50 10Z" fill="#123A9E"/><ellipse cx="50" cy="51" rx="24" ry="22" fill="#071124"/><circle cx="41" cy="50" r="4" fill="#68F0B2"/><circle cx="59" cy="50" r="4" fill="#68F0B2"/><path d="M38 66H62" stroke="#78A1FF" stroke-width="3" stroke-linecap="round"/><path d="M26 99H40L45 91L52 106L59 96H74" stroke="#68F0B2" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',tags:'anon hood onchain signal crypto'}
  };

  const CREATIVE_DOODLES = {
    rocket:{label:'launch rocket',vb:'0 0 100 100',ar:1,inner:'<path d="M58 12C75 19 83 35 82 53L61 74L28 41L49 20Z" fill="#2E6BFF" stroke="#101C33" stroke-width="4"/><circle cx="62" cy="34" r="8" fill="#EAF1FF"/><path d="M29 44L16 53L31 60M58 73L49 87L41 70" fill="#78A1FF" stroke="#101C33" stroke-width="4"/><path d="M24 69L12 86M36 76L27 92" stroke="#FFC53D" stroke-width="6" stroke-linecap="round"/>'},
    cursor:{label:'cursor click',vb:'0 0 100 100',ar:1,inner:'<path d="M24 12L78 59L55 62L68 87L55 94L42 68L26 84Z" fill="#fff" stroke="#123A9E" stroke-width="6" stroke-linejoin="round"/><path d="M68 12V28M86 26L74 38M43 5L48 20" stroke="#2E6BFF" stroke-width="6" stroke-linecap="round"/>'},
    sticker:{label:'sticker burst',vb:'0 0 100 100',ar:1,inner:'<path d="M50 4L61 18L78 12L80 31L96 40L85 55L92 72L73 77L66 94L50 84L34 94L27 77L8 72L15 55L4 40L20 31L22 12L39 18Z" fill="#FFC53D" stroke="#101C33" stroke-width="4"/><path d="M29 50H71" stroke="#101C33" stroke-width="7" stroke-linecap="round"/>'},
    tape:{label:'tape strip',vb:'0 0 180 60',ar:.333,inner:'<path d="M8 17L171 6L176 44L13 55Z" fill="#9DBDF9" fill-opacity=".72"/><path d="M18 21L164 12M23 47L168 36" stroke="#fff" stroke-width="3" stroke-dasharray="8 7" opacity=".75"/>'},
    quote:{label:'quote marks',vb:'0 0 120 80',ar:.667,inner:'<path d="M8 67C8 35 21 14 48 8V25C35 29 29 39 29 49H48V72H8ZM66 67C66 35 79 14 106 8V25C93 29 87 39 87 49H106V72H66Z" fill="#2E6BFF"/>'},
    orbit2:{label:'double orbit',vb:'0 0 180 100',ar:.556,inner:'<ellipse cx="90" cy="50" rx="78" ry="28" transform="rotate(-8 90 50)" stroke="#123A9E" stroke-width="5"/><ellipse cx="90" cy="50" rx="62" ry="42" transform="rotate(13 90 50)" stroke="#78A1FF" stroke-width="4"/><circle cx="151" cy="28" r="8" fill="#68F0B2"/>'},
    brackets:{label:'focus brackets',vb:'0 0 120 100',ar:.833,inner:'<path d="M42 10H12V39M78 10H108V39M42 90H12V61M78 90H108V61" stroke="#2E6BFF" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>'},
    speed:{label:'speed lines',vb:'0 0 180 90',ar:.5,inner:'<path d="M8 18H115M28 45H170M8 72H132" stroke="#123A9E" stroke-width="8" stroke-linecap="round"/><path d="M129 18H164M8 45H17M146 72H173" stroke="#78A1FF" stroke-width="8" stroke-linecap="round"/>'}
  };

  function appendCreativeElements(items) {
    const state = builderState();
    const remaining = Math.max(0, 48 - state.data.length);
    if (!remaining) { toast('the Builder is at its 48-layer limit', 'warn'); return; }
    const added = items.slice(0, remaining);
    const next = state.data.concat(added);
    importBuilderState(next, state.format, state.background, next.length - 1);
    applyFoundationLock();
    renderBuilderSheet();
    toast(added.length + ' creative layer' + (added.length === 1 ? '' : 's') + ' added', 'ok');
  }

  function textStructure(kind) {
    const format = window.__bapi.fmt();
    const W = format[1], H = format[2];
    const left = Math.round(W * .09), width = Math.round(W * .82), mid = Math.round(H * .28);
    if (kind === 'hero') return [
      {type:'text',text:'PROJECT INTELLIGENCE · 01',x:left,y:mid,w:width,size:24,color:'#2E6BFF',ff:'Space Mono',fw:'800'},
      {type:'text',text:'the part nobody\nis watching yet',x:left,y:mid+55,w:width,size:92,color:'#101C33',ff:'Sora',fw:'800',lh:'0.96',pre:1},
      {type:'text',text:'one clear observation supported by the strongest verified fact.',x:left,y:mid+280,w:Math.round(width*.76),size:31,color:'#61769D',ff:'Sora',fw:'600',lh:'1.35'}
    ];
    if (kind === 'editorial') return [
      {type:'text',text:'THE OBSERVATION',x:left,y:mid,w:width,size:22,color:'#2E6BFF',ff:'Space Mono',fw:'800'},
      {type:'text',text:'something changed…',x:left,y:mid+58,w:width,size:102,color:'#101C33',ff:'Instrument Serif',fw:'400',fst:'italic'},
      {type:'text',text:'and the numbers explain why.',x:left,y:mid+190,w:width,size:54,color:'#123A9E',ff:'Sora',fw:'800'}
    ];
    if (kind === 'number') return [
      {type:'text',text:'THE NUMBER THAT MATTERS',x:left,y:mid,w:width,size:23,color:'#5D7BB8',ff:'Space Mono',fw:'800'},
      {type:'text',text:'2.4M',x:left,y:mid+45,w:width,size:180,color:'#123A9E',ff:'Sora',fw:'800',lh:'.9'},
      {type:'text',text:'verified users · current snapshot',x:left,y:mid+240,w:width,size:32,color:'#101C33',ff:'Sora',fw:'700'}
    ];
    if (kind === 'quote') return [
      {type:'text',text:'“',x:left,y:mid-55,w:150,size:150,color:'#9DBDF9',ff:'Instrument Serif',fw:'400'},
      {type:'text',text:'the best take is usually\nthe simplest true one.',x:left+25,y:mid+55,w:width-25,size:74,color:'#101C33',ff:'Instrument Serif',fw:'400',fst:'italic',lh:'1.04',pre:1},
      {type:'text',text:'@cmvng · research note',x:left+25,y:mid+260,w:width,size:24,color:'#2E6BFF',ff:'Space Mono',fw:'800'}
    ];
    if (kind === 'contrast') return [
      {type:'text',text:'WHAT THEY SAY',x:left,y:mid,w:Math.round(width*.44),size:22,color:'#6C82AB',ff:'Space Mono',fw:'800'},
      {type:'text',text:'the narrative',x:left,y:mid+55,w:Math.round(width*.44),size:58,color:'#101C33',ff:'Sora',fw:'800'},
      {type:'text',text:'WHAT THE DATA SAYS',x:left+Math.round(width*.53),y:mid,w:Math.round(width*.47),size:22,color:'#2E6BFF',ff:'Space Mono',fw:'800'},
      {type:'text',text:'the reality',x:left+Math.round(width*.53),y:mid+55,w:Math.round(width*.47),size:58,color:'#123A9E',ff:'Sora',fw:'800'}
    ];
    return [
      {type:'text',text:'01 · THE HOOK',x:left,y:mid,w:width,size:23,color:'#2E6BFF',ff:'Space Mono',fw:'800'},
      {type:'text',text:'one strong idea',x:left,y:mid+55,w:width,size:92,color:'#101C33',ff:'Sora',fw:'800'},
      {type:'text',text:'>>> evidence that earns its place\n>>> another concrete supporting fact',x:left,y:mid+185,w:width,size:35,color:'#123A9E',ff:'Space Mono',fw:'700',lh:'1.6',pre:1}
    ];
  }

  function specialLayout(kind) {
    const format = window.__bapi.fmt();
    const W = format[1], H = format[2], pad = Math.round(W*.07);
    const panel = (x,y,w,h,fill,rx) => ({type:'svgraw',vb:'0 0 100 100',inner:'<rect width="100" height="100" rx="' + (rx||8) + '" fill="' + fill + '"/>',x,y,w,ar:h/w});
    if (kind === 'spotlight') return [panel(pad,Math.round(H*.16),W-pad*2,Math.round(H*.66),'#101C33',7),
      {type:'text',text:'PROJECT SPOTLIGHT',x:pad+45,y:Math.round(H*.22),w:W-pad*2-90,size:24,color:'#78A1FF',ff:'Space Mono',fw:'800'},
      {type:'text',text:'the signal\nworth watching',x:pad+45,y:Math.round(H*.30),w:W-pad*2-90,size:86,color:'#FFFFFF',ff:'Sora',fw:'800',lh:'.98',pre:1}];
    if (kind === 'split') return [panel(pad,Math.round(H*.18),Math.round((W-pad*2)*.48),Math.round(H*.6),'#123A9E',8),panel(Math.round(W*.52),Math.round(H*.18),Math.round((W-pad*2)*.48),Math.round(H*.6),'#E5EDFA',8),
      {type:'text',text:'BEFORE',x:pad+32,y:Math.round(H*.25),w:Math.round(W*.33),size:24,color:'#78A1FF',ff:'Space Mono',fw:'800'},
      {type:'text',text:'AFTER',x:Math.round(W*.55),y:Math.round(H*.25),w:Math.round(W*.33),size:24,color:'#123A9E',ff:'Space Mono',fw:'800'}];
    if (kind === 'data') return [panel(pad,Math.round(H*.16),W-pad*2,Math.round(H*.68),'#EEF3FD',8),
      panel(pad+30,Math.round(H*.30),Math.round((W-pad*2-75)*.5),Math.round(H*.20),'#FFFFFF',6),panel(Math.round(W*.52),Math.round(H*.30),Math.round((W-pad*2-75)*.5),Math.round(H*.20),'#123A9E',6),
      {type:'text',text:'THE DATA',x:pad+35,y:Math.round(H*.21),w:W-pad*2-70,size:55,color:'#101C33',ff:'Sora',fw:'800'}];
    if (kind === 'breaking') return [panel(0,Math.round(H*.18),W,Math.round(H*.55),'#123A9E',0),
      {type:'text',text:'BREAKING · PROJECT UPDATE',x:pad,y:Math.round(H*.25),w:W-pad*2,size:25,color:'#9DBDF9',ff:'Space Mono',fw:'800'},
      {type:'text',text:'something\njust changed.',x:pad,y:Math.round(H*.34),w:W-pad*2,size:105,color:'#FFFFFF',ff:'Sora',fw:'800',lh:'.92',pre:1}];
    if (kind === 'frame') return [{type:'svgraw',vb:'0 0 100 125',inner:'<rect x="3" y="3" width="94" height="119" rx="7" fill="none" stroke="#123A9E" stroke-width="3"/><path d="M3 24H97M18 3V24" stroke="#123A9E" stroke-width="3"/><circle cx="9" cy="13" r="3" fill="#FF5E57"/><circle cx="18" cy="13" r="3" fill="#FFC53D"/><circle cx="27" cy="13" r="3" fill="#18B27B"/>',x:pad,y:Math.round(H*.09),w:W-pad*2,ar:1.25},
      {type:'text',text:'research window',x:pad+55,y:Math.round(H*.16),w:W-pad*2-110,size:25,color:'#2E6BFF',ff:'Space Mono',fw:'800'}];
    return [panel(pad,Math.round(H*.14),W-pad*2,Math.round(H*.7),'#FFC53D',0),
      {type:'svgraw',vb:'0 0 100 100',inner:'<rect x="3" y="3" width="94" height="94" fill="none" stroke="#101C33" stroke-width="6"/>',x:pad+28,y:Math.round(H*.17),w:W-pad*2-56,ar:1},
      {type:'text',text:'NO FLUFF.\nJUST THE SIGNAL.',x:pad+60,y:Math.round(H*.30),w:W-pad*2-120,size:82,color:'#101C33',ff:'Archivo Black',fw:'800',lh:'.95',pre:1}];
  }

  function openNativeBuilderTool(label) {
    const button = Array.from(document.querySelectorAll('#bd_rail .add')).find(node => (node.querySelector('small') || {}).textContent === label);
    if (button) button.click();
  }

  function openCreativeKit() {
    let sheet = document.getElementById('bw_creative_sheet');
    if (!sheet) {
      sheet = document.createElement('div');
      sheet.id = 'bw_creative_sheet';
      const types = [
        ['hero','headline hierarchy','kicker + bold hook + deck'],['editorial','editorial serif','observation with a human feel'],['number','number hero','one verified number dominates'],
        ['quote','quote composition','opinion with attribution'],['contrast','comparison type','narrative versus reality'],['evidence','evidence stack','hook plus earned >>> facts']
      ];
      const layouts = [['spotlight','project spotlight'],['split','before / after'],['data','data dashboard'],['breaking','breaking update'],['frame','browser frame'],['brutal','brutalist poster']];
      sheet.innerHTML = '<div class="bw-kit"><div class="bw-kit-head"><img src="' + BRAND_LOGO + '" alt="cmvng"><div><b>creative kit · 120 systems</b><small>complete design systems · characters · doodles · type · brand</small></div><button type="button" data-close>×</button></div>' +
        '<div class="bw-kit-tabs"><button class="bw-kit-tab on" data-tab="systems">120 design kits</button><button class="bw-kit-tab" data-tab="characters">characters</button><button class="bw-kit-tab" data-tab="type">text structures</button>' +
        '<button class="bw-kit-tab" data-tab="doodles">doodles</button><button class="bw-kit-tab" data-tab="layouts">special designs</button><button class="bw-kit-tab" data-tab="brand">brand</button></div>' +
        '<section class="bw-kit-section on" data-section="systems"><div class="bw-kit-note"><b>120 coordinated systems:</b> 12 composition families across 10 genuinely different art directions. Search by use case, then tap a kit to add its fully editable layers.</div>' +
        '<div class="bw-kit-search"><input id="bw_kit_search" placeholder="search launch, data, quote, product…"><div class="bw-kit-count" id="bw_kit_count">120 kits</div></div>' +
        '<div class="bw-kit-filters">' + ['all','research','opinion','updates','data','comparison','product','social','roadmap','culture'].map(cat=>'<button class="bw-kit-filter '+(cat==='all'?'on':'')+'" data-category="'+cat+'">'+cat+'</button>').join('') + '</div><div class="bw-mega-grid" id="bw_mega_grid"></div></section>' +
        '<section class="bw-kit-section" data-section="characters"><div class="bw-kit-note">New native CMVNG characters. Each one stays movable, resizable and reusable as a Builder layer.</div>' +
        '<div class="bw-kit-grid">' + Object.keys(CREATOR_CHARACTERS).map(key => { const item=CREATOR_CHARACTERS[key]; return '<button class="bw-kit-card" data-character="'+key+'"><div class="bw-char-demo"><svg viewBox="0 0 100 120">'+item.inner+'</svg></div><b>'+item.label+'</b><span>'+item.note+'</span><i>add +</i></button>'; }).join('') +
        '<button class="bw-kit-card" data-native="character"><div class="bw-char-demo"><div style="font:900 30px Sora;color:#2E6BFF">＋</div></div><b>full character library</b><span>original people, mascots, casts and AI character generator</span><i>open →</i></button></div></section>' +
        '<section class="bw-kit-section" data-section="type"><div class="bw-kit-note">Add complete type hierarchies, not isolated text boxes. Every line remains editable.</div><div class="bw-kit-grid">' +
        types.map(item => '<button class="bw-kit-card" data-type="'+item[0]+'"><div class="bw-type-demo"><small>'+item[1]+'</small><strong>make the <em>idea</em> clear.</strong></div><b>'+item[1]+'</b><span>'+item[2]+'</span><i>add +</i></button>').join('') + '</div></section>' +
        '<section class="bw-kit-section" data-section="doodles"><div class="bw-kit-note">More visual punctuation for emphasis, motion, annotation and CT-native energy.</div><div class="bw-kit-grid">' +
        Object.keys(CREATIVE_DOODLES).map(key => {const item=CREATIVE_DOODLES[key];return '<button class="bw-kit-card" data-doodle="'+key+'"><div class="bw-doodle-demo"><svg viewBox="'+item.vb+'">'+item.inner+'</svg></div><b>'+item.label+'</b><span>native vector · scales cleanly</span><i>add +</i></button>';}).join('') +
        '<button class="bw-kit-card" data-native="doodle"><div class="bw-doodle-demo"><div style="font:900 30px Sora;color:#2E6BFF">＋</div></div><b>original doodle library</b><span>arrows, scribbles, highlights, bursts and marks</span><i>open →</i></button></div></section>' +
        '<section class="bw-kit-section" data-section="layouts"><div class="bw-kit-note">Add a special composition on top of the current canvas without deleting your existing work.</div><div class="bw-kit-grid">' +
        layouts.map(item => '<button class="bw-kit-card" data-layout="'+item[0]+'"><div class="bw-layout-demo"><u></u><u></u><u></u></div><b>'+item[1]+'</b><span>structured visual treatment</span><i>add +</i></button>').join('') + '</div></section>' +
        '<section class="bw-kit-section" data-section="brand"><div class="bw-kit-note">Use your official identity consistently in custom designs and exports.</div><div class="bw-kit-grid">' +
        '<button class="bw-kit-card" data-brand-logo><div style="height:72px;border-radius:10px;background:#191919;display:flex;align-items:center;justify-content:center;overflow:hidden"><img src="'+BRAND_LOGO+'" style="width:100%;height:100%;object-fit:cover"></div><b>official cmvng logo</b><span>adds the supplied brand mark</span><i>add +</i></button>' +
        '<button class="bw-kit-card" data-native="chip"><div class="bw-type-demo"><small>IDENTITY</small><strong>@cmvng</strong></div><b>identity chip</b><span>compact creator signature</span><i>add +</i></button></div></section></div>';
      sheet.onclick = event => { if (event.target === sheet || event.target.closest('[data-close]')) sheet.classList.remove('on'); };
      sheet.querySelectorAll('.bw-kit-tab').forEach(button => button.onclick = () => {
        sheet.querySelectorAll('.bw-kit-tab').forEach(x => x.classList.toggle('on', x === button));
        sheet.querySelectorAll('.bw-kit-section').forEach(x => x.classList.toggle('on', x.dataset.section === button.dataset.tab));
      });
      const kitSearch=sheet.querySelector('#bw_kit_search');
      if(kitSearch) kitSearch.oninput=()=>renderMegaKitCatalog(sheet);
      sheet.querySelectorAll('.bw-kit-filter').forEach(button=>button.onclick=()=>{
        sheet.querySelectorAll('.bw-kit-filter').forEach(x=>x.classList.toggle('on',x===button));
        renderMegaKitCatalog(sheet);
      });
      renderMegaKitCatalog(sheet);
      sheet.querySelectorAll('[data-character]').forEach(button => button.onclick = () => {
        const item=CREATOR_CHARACTERS[button.dataset.character]; const fmt=window.__bapi.fmt();
        appendCreativeElements([{type:'svgraw',vb:'0 0 100 120',inner:item.inner,ar:1.2,x:Math.round(fmt[1]*.62),y:Math.round(fmt[2]*.42),w:Math.round(fmt[1]*.28)}]); sheet.classList.remove('on');
      });
      sheet.querySelectorAll('[data-doodle]').forEach(button => button.onclick = () => {
        const item=CREATIVE_DOODLES[button.dataset.doodle]; const fmt=window.__bapi.fmt();
        appendCreativeElements([{type:'svgraw',vb:item.vb,inner:item.inner,ar:item.ar,x:Math.round(fmt[1]*.62),y:Math.round(fmt[2]*.18),w:Math.round(fmt[1]*.25)}]); sheet.classList.remove('on');
      });
      sheet.querySelectorAll('[data-type]').forEach(button => button.onclick = () => { appendCreativeElements(textStructure(button.dataset.type)); sheet.classList.remove('on'); });
      sheet.querySelectorAll('[data-layout]').forEach(button => button.onclick = () => { appendCreativeElements(specialLayout(button.dataset.layout)); sheet.classList.remove('on'); });
      sheet.querySelector('[data-brand-logo]').onclick = () => { const fmt=window.__bapi.fmt(); appendCreativeElements([{type:'img',src:BRAND_LOGO,ar:1,x:Math.round(fmt[1]*.07),y:Math.round(fmt[2]*.77),w:220}]); sheet.classList.remove('on'); };
      sheet.querySelectorAll('[data-native]').forEach(button => button.onclick = () => {
        const kind=button.dataset.native; sheet.classList.remove('on');
        if (kind === 'chip') window.__bapi.add('chip'); else openNativeBuilderTool(kind);
      });
      document.body.appendChild(sheet);
    }
    sheet.classList.add('on');
  }

  /* ---------- CMVNG Signal Workshop v5 ---------- */
  const CREATIVE_V5_THEMES = [
    {id:'signal',name:'signal',theme:{bg:'#EDF3FF',paper:'#FFFFFF',ink:'#101C33',blue:'#2E6BFF',navy:'#123A9E',soft:'#BFD1F5',mint:'#68F0B2',gold:'#FFC53D',coral:'#FF6C43',red:'#FF4D45',muted:'#61769D'}},
    {id:'night',name:'night',theme:{bg:'#071124',paper:'#101C33',ink:'#F8FAFF',blue:'#4C7EFF',navy:'#BFD1F5',soft:'#20365F',mint:'#68F0B2',gold:'#E6B84A',coral:'#FF7B55',red:'#FF665E',muted:'#9CAFD1'}},
    {id:'paper',name:'paper',theme:{bg:'#E7DED0',paper:'#FFFDF7',ink:'#201A16',blue:'#2E6BFF',navy:'#342821',soft:'#D8CCBB',mint:'#18B27B',gold:'#D7A936',coral:'#E5532D',red:'#D94444',muted:'#74685E'}},
    {id:'acid',name:'acid',theme:{bg:'#D8FF47',paper:'#F7FFD7',ink:'#101C18',blue:'#2E6BFF',navy:'#101C18',soft:'#B6D836',mint:'#18B27B',gold:'#FFC53D',coral:'#FF6C43',red:'#F14D4D',muted:'#4E6135'}},
    {id:'quiet',name:'quiet luxury',theme:{bg:'#EEE9DF',paper:'#FBF8F0',ink:'#171717',blue:'#8A6A27',navy:'#2A2926',soft:'#D7CEBD',mint:'#6D8B73',gold:'#B69243',coral:'#A9664B',red:'#974A42',muted:'#736D63'}},
    {id:'mono',name:'mono',theme:{bg:'#F4F4F2',paper:'#FFFFFF',ink:'#101010',blue:'#303030',navy:'#000000',soft:'#D6D6D2',mint:'#A9A9A2',gold:'#B7B7AE',coral:'#686868',red:'#202020',muted:'#70706B'}},
    {id:'tide',name:'tide',theme:{bg:'#E7F7F7',paper:'#F8FFFF',ink:'#092C35',blue:'#087E8B',navy:'#064B57',soft:'#B9E3E2',mint:'#52D9B3',gold:'#E5B94F',coral:'#FF735F',red:'#DB3D50',muted:'#4E777D'}},
    {id:'clay',name:'clay',theme:{bg:'#E9DDD2',paper:'#FFF9F3',ink:'#2D211C',blue:'#3458A4',navy:'#402D26',soft:'#D5C1B2',mint:'#7BB68C',gold:'#D9A84E',coral:'#D96745',red:'#B33A3A',muted:'#77665D'}}
  ];
  let creativeV5Theme = 'signal';
  let creativeV5Mode = 'replace';
  let creativeV5Tab = 'designs';
  let creativeV5Filter = 'all';
  let creativeV5Limit = 24;

  let creativeCombinedPackV7 = null;
  let creativeCombinedSourcesV7 = null;

  function creativePackV5() {
    const base=window.CMVNG_CREATIVE_PACK_V5 || null;
    const fresh=window.CMVNG_CREATIVE_PACK_V7 || null;
    if(!fresh) return base;
    if(!base) return fresh;
    if(creativeCombinedPackV7 && creativeCombinedSourcesV7 && creativeCombinedSourcesV7[0]===base && creativeCombinedSourcesV7[1]===fresh) return creativeCombinedPackV7;
    const groups=['characters','doodles','textStructures','specialLayouts'];
    const counts={}; groups.forEach(key=>counts[key]=(+base.counts[key]||0)+(+fresh.counts[key]||0));
    counts.total=groups.reduce((sum,key)=>sum+counts[key],0);
    const getCatalog=()=>{
      const older=base.getCatalog(),newer=fresh.getCatalog(),result={};
      groups.forEach(key=>result[key]=(older[key]||[]).concat(newer[key]||[]));
      return result;
    };
    const find=(kind,id)=>fresh.find(kind,id)||base.find(kind,id);
    creativeCombinedPackV7={version:'7.0.0',counts,validation:{ok:!!(base.validation&&base.validation.ok&&fresh.validation&&fresh.validation.ok),errors:[]},
      getCatalog,find,instantiate:(kind,id,format,options)=>(fresh.find(kind,id)?fresh:base).instantiate(kind,id,format,options)};
    creativeCombinedSourcesV7=[base,fresh];
    return creativeCombinedPackV7;
  }

  function activeCreativeTheme() {
    const t=(CREATIVE_V5_THEMES.find(item => item.id === creativeV5Theme) || CREATIVE_V5_THEMES[0]).theme;
    return Object.assign({canvas:t.bg,line:t.soft,cyan:t.blue,acid:t.gold,cream:t.paper,black:t.ink,lilac:t.soft},t);
  }

  function builderGeometryV6() {
    return window.CMVNG_BUILDER_GEOMETRY_V6 || null;
  }

  function normalizeCreativeLayers(layers, format) {
    const geometry = builderGeometryV6();
    return geometry ? geometry.normalizeComposition(layers, format, {padding:0}) : layers;
  }

  function comparableComposition(layers) {
    const keys = ['type','x','y','w','rot','text','size','color','ff','fw','fst','lh','pre','src','ar','vb','inner','key','kind','form'];
    return JSON.stringify((layers || []).map(layer => {
      const next = {};
      keys.forEach(key => {
        if (key === 'rot') {
          next.rot = Math.round((Number(layer.rot) || 0) * 1000) / 1000;
          return;
        }
        if (layer[key] == null || layer[key] === '') return;
        next[key] = typeof layer[key] === 'number' ? Math.round(layer[key] * 1000) / 1000 : String(layer[key]);
      });
      return next;
    }));
  }

  function compositionIsPristine(current) {
    return !!(originalBuilderDesign && activeCreativeDesignId &&
      comparableComposition(current) === comparableComposition(originalBuilderDesign.data));
  }

  function v5Text(text,x,y,w,size,color,font,weight,lh,extra) {
    return Object.assign({type:'text',text,x:Math.round(x),y:Math.round(y),w:Math.round(w),size:Math.round(size),color,
      ff:font || 'Sora',fw:String(weight || 800),lh:String(lh || 1),pre:1}, extra || {});
  }

  function v5Panel(x,y,w,h,fill,radius,stroke,sw,extra) {
    return Object.assign({type:'svgraw',vb:'0 0 100 100',inner:'<rect x="2" y="2" width="96" height="96" rx="'+(radius || 0)+'" fill="'+fill+'"'+
      (stroke ? ' stroke="'+stroke+'" stroke-width="'+(sw || 3)+'"' : '')+'/>',x:Math.round(x),y:Math.round(y),w:Math.round(w),ar:h/Math.max(1,w)},extra || {});
  }

  function v5Signature(W,H,t) {
    return [
      v5Text('CMVNG / SIGNAL WORKSHOP',W*.075,H*.925,W*.62,W*.016,t.muted,'Space Mono',800,1),
      {type:'img',src:BRAND_LOGO,ar:1,x:Math.round(W*.82),y:Math.round(H*.895),w:Math.round(W*.105),cmvngAssetKind:'brand'}
    ];
  }

  function v5DesignCatalog() {
    const pack=creativePackV5(); if(!pack) return [];
    const catalog=pack.getCatalog();
    const layouts=catalog.specialLayouts.map((item,index)=>Object.assign({},item,{id:'design-layout-'+item.id,assetId:item.id,kind:'layout',index,
      name:item.name,category:item.category || 'design',note:item.note,tags:(item.tags||[]).concat(['complete','layout'])}));
    const types=catalog.textStructures.map((item,index)=>Object.assign({},item,{id:'design-type-'+item.id,assetId:item.id,kind:'type',index:index+layouts.length,
      name:item.name+' Story',category:item.category || 'writing',note:item.note,tags:(item.tags||[]).concat(['typography','story'])}));
    const characters=catalog.characters.map((item,index)=>Object.assign({},item,{id:'design-character-'+item.id,assetId:item.id,kind:'character',index:index+layouts.length+types.length,
      name:item.name+' Feature',category:item.category || 'character',note:item.note,tags:(item.tags||[]).concat(['character','feature'])}));
    const doodles=catalog.doodles.map((item,index)=>Object.assign({},item,{id:'design-doodle-'+item.id,assetId:item.id,kind:'doodle',index:index+layouts.length+types.length+characters.length,
      name:item.name+' Poster',category:item.category || 'culture',note:item.note,tags:(item.tags||[]).concat(['doodle','poster'])}));
    return layouts.concat(types,characters,doodles);
  }

  function buildV5TypeDesign(item,format,t) {
    const pack=creativePackV5(),W=format[1],H=format[2],i=item.index%6,pad=W*.07;
    const dark=/terminal|alert|manifesto/i.test(item.assetId) || i===4;
    const bg=dark?t.ink:t.bg, ink=dark?t.paper:t.ink;
    const theme=Object.assign({},t,{bg,paper:dark?t.ink:t.paper,ink,navy:dark?t.paper:t.navy,muted:dark?t.soft:t.muted});
    let decor=[];
    if(i===0) decor=[v5Panel(pad,H*.10,W-pad*2,H*.78,theme.paper,12,theme.ink,2)];
    if(i===1) decor=[v5Panel(0,H*.58,W,H*.24,theme.blue,0),v5Panel(pad,H*.11,W*.12,H*.05,theme.coral,0)];
    if(i===2) decor=[v5Panel(W*.64,H*.08,W*.28,H*.78,theme.soft,0),v5Panel(pad,H*.76,W*.37,H*.06,theme.gold,0)];
    if(i===3) decor=[v5Panel(pad,H*.10,W-pad*2,H*.72,theme.paper,0,theme.ink,4),v5Panel(pad+24,H*.10,12,H*.72,theme.blue,0)];
    if(i===4) decor=[v5Panel(pad,H*.11,W-pad*2,H*.69,theme.ink,7,theme.blue,2),v5Panel(W*.73,H*.14,W*.17,H*.10,theme.mint,50)];
    if(i===5) decor=[v5Panel(pad,H*.12,W*.27,H*.66,theme.navy,0),v5Panel(W*.39,H*.12,W*.54,H*.66,theme.paper,0,theme.ink,2)];
    return [v5Panel(0,0,W,H,bg,0)].concat(decor,pack.instantiate('text',item.assetId,format,{theme}),v5Signature(W,H,theme));
  }

  function buildV5CharacterDesign(item,format,t) {
    const pack=creativePackV5(),W=format[1],H=format[2],i=item.index%5,pad=W*.07;
    let layers=[v5Panel(0,0,W,H,i===4?t.ink:t.bg,0)];
    const title=item.name.replace(/ Feature$/,'').toUpperCase();
    if(i===0) layers=layers.concat([v5Panel(W*.53,0,W*.47,H,t.navy,0),v5Text('CREATOR ROLE · 01',pad,H*.12,W*.40,W*.019,t.blue,'Space Mono',800,1),v5Text(title,pad,H*.22,W*.43,W*.063,t.ink,'Archivo Black',800,.91),v5Text(item.note,pad,H*.57,W*.39,W*.025,t.muted,'Sora',650,1.3)]);
    if(i===1) layers=layers.concat([v5Panel(pad,H*.12,W-pad*2,H*.28,t.paper,14,t.ink,2),v5Text('“'+item.note+'”',pad+36,H*.18,W-pad*2-72,W*.034,t.ink,'Instrument Serif',500,1.08,{fst:'italic'}),v5Text(title,pad,H*.71,W*.53,W*.045,t.navy,'Sora',800,.95)]);
    if(i===2) layers=layers.concat([v5Panel(W*.23,H*.21,W*.54,W*.54,t.soft,50,t.ink,3),v5Text('MEET THE',pad,H*.10,W*.35,W*.019,t.coral,'Space Mono',800,1),v5Text(title,pad,H*.72,W-pad*2,W*.052,t.ink,'Archivo Black',800,.9)]);
    if(i===3) layers=layers.concat([v5Panel(0,H*.16,W,H*.52,t.blue,0),v5Text('ROLE / ACTION / POINT OF VIEW',pad,H*.09,W-pad*2,W*.018,t.muted,'Space Mono',800,1),v5Text(title,pad,H*.72,W-pad*2,W*.055,t.ink,'Sora',800,.95)]);
    if(i===4) layers=layers.concat([v5Panel(pad,H*.10,W-pad*2,H*.71,t.ink,0,t.soft,2),v5Text('CMVNG CHARACTER STUDY',pad+34,H*.15,W*.45,W*.018,t.mint,'Space Mono',800,1),v5Text(title,pad+34,H*.24,W*.48,W*.057,t.paper,'Archivo Black',800,.9),v5Text(item.note,pad+34,H*.61,W*.45,W*.023,t.soft,'Sora',650,1.3)]);
    const placements=[{x:W*.58,y:H*.25,w:W*.34},{x:W*.56,y:H*.39,w:W*.34},{x:W*.36,y:H*.27,w:W*.29},{x:W*.59,y:H*.26,w:W*.32},{x:W*.61,y:H*.30,w:W*.28}];
    return layers.concat(pack.instantiate('character',item.assetId,format,{theme:t,...placements[i]}),v5Signature(W,H,i===4?Object.assign({},t,{muted:t.soft}):t));
  }

  function buildV5DoodleDesign(item,format,t) {
    const pack=creativePackV5(),W=format[1],H=format[2],i=item.index%7,pad=W*.07;
    const label=item.name.replace(/ Poster$/,'').toUpperCase();
    let layers=[v5Panel(0,0,W,H,i===5?t.ink:t.paper,0)];
    if(i===0) layers.push(v5Panel(pad,H*.14,W-pad*2,H*.61,t.bg,8,t.ink,3),v5Text('MARK THE SIGNAL',pad+30,H*.20,W*.47,W*.048,t.ink,'Archivo Black',800,.92));
    if(i===1) layers.push(v5Panel(0,H*.22,W,H*.45,t.blue,0),v5Text(label,pad,H*.10,W-pad*2,W*.047,t.ink,'Archivo Black',800,.9));
    if(i===2) layers.push(v5Panel(pad,H*.11,W*.34,H*.67,t.navy,0),v5Text('ANNOTATION / 0'+((item.index%9)+1),W*.46,H*.18,W*.42,W*.019,t.blue,'Space Mono',800,1),v5Text(label,W*.46,H*.25,W*.43,W*.055,t.ink,'Sora',800,.94));
    if(i===3) layers.push(v5Panel(pad,H*.14,W-pad*2,H*.60,t.gold,0,t.ink,4),v5Text(label,pad+35,H*.61,W-pad*2-70,W*.052,t.ink,'Archivo Black',800,.9));
    if(i===4) layers.push(v5Panel(pad,H*.12,W-pad*2,H*.67,t.bg,18),v5Text('MAKE THE IDEA STICK.',pad+32,H*.17,W*.51,W*.049,t.navy,'Sora',800,.94));
    if(i===5) layers.push(v5Panel(pad,H*.12,W-pad*2,H*.68,t.ink,5,t.soft,2),v5Text(label,pad+32,H*.18,W*.49,W*.052,t.paper,'Archivo Black',800,.9));
    if(i===6) layers.push(v5Panel(pad,H*.11,W-pad*2,H*.70,t.paper,0,t.ink,3),v5Panel(pad,H*.11,W-pad*2,H*.08,t.blue,0),v5Text(label,pad+30,H*.24,W*.52,W*.047,t.ink,'Sora',800,.94));
    const placements=[{x:W*.55,y:H*.30,w:W*.30},{x:W*.35,y:H*.33,w:W*.31},{x:W*.12,y:H*.32,w:W*.24},{x:W*.36,y:H*.25,w:W*.29},{x:W*.57,y:H*.39,w:W*.25},{x:W*.58,y:H*.39,w:W*.24},{x:W*.56,y:H*.46,w:W*.25}];
    return layers.concat(pack.instantiate('doodle',item.assetId,format,{theme:t,...placements[i]}),v5Text('native mark · movable · scalable',pad,H*.84,W*.60,W*.017,i===5?t.soft:t.muted,'Space Mono',700,1),v5Signature(W,H,i===5?Object.assign({},t,{muted:t.soft}):t));
  }

  function buildV5Design(item,format) {
    const pack=creativePackV5(),t=activeCreativeTheme();
    if(!pack || !item) return [];
    let layers=[];
    if(item.kind==='layout') layers=pack.instantiate('layout',item.assetId,format,{theme:t}).concat(v5Signature(format[1],format[2],t));
    else if(item.kind==='type') layers=buildV5TypeDesign(item,format,t);
    else if(item.kind==='character') layers=buildV5CharacterDesign(item,format,t);
    else layers=buildV5DoodleDesign(item,format,t);
    return normalizeCreativeLayers(layers,format);
  }

  function v5Preview(layers,format) {
    const W=format[1],H=format[2];
    const nodes=layers.slice(0,48).map(item=>{
      const x=+item.x||0,y=+item.y||0,w=+item.w||W;
      if(item.type==='svgraw') return '<svg x="'+x+'" y="'+y+'" width="'+w+'" height="'+(w*(+item.ar||1))+'" viewBox="'+escEnh(item.vb||'0 0 100 100')+'" preserveAspectRatio="none">'+(item.inner||'')+'</svg>';
      if(item.type==='img') return '<image href="'+escEnh(item.src||'')+'" x="'+x+'" y="'+y+'" width="'+w+'" height="'+(w*(+item.ar||1))+'" preserveAspectRatio="xMidYMid slice"/>';
      if(item.type==='text') {
        const lines=String(item.text||'').split('\n'),size=+item.size||28,lh=size*(+item.lh||1.1),rot=+item.rot||0;
        return '<text x="'+x+'" y="'+(y+size)+'" fill="'+escEnh(item.color||'#101C33')+'" font-family="'+escEnh(item.ff||'Sora')+'" font-size="'+size+'" font-weight="'+escEnh(item.fw||'700')+'"'+(rot?' transform="rotate('+rot+' '+x+' '+y+')"':'')+'>'+lines.map((line,index)=>'<tspan x="'+x+'" dy="'+(index?lh:0)+'">'+escEnh(line)+'</tspan>').join('')+'</text>';
      }
      return '';
    }).join('');
    return '<svg class="bw-v5-art" viewBox="0 0 '+W+' '+H+'" aria-hidden="true">'+nodes+'</svg>';
  }

  function v5FavoriteIds() {
    try { return JSON.parse(localStorage.getItem('cmvng.creative.favorites.v5') || '[]'); } catch (_) { return []; }
  }

  function v5RecentIds() {
    try { return JSON.parse(localStorage.getItem('cmvng.creative.recent.v5') || '[]'); } catch (_) { return []; }
  }

  function rememberV5(id) {
    const next=[id].concat(v5RecentIds().filter(item=>item!==id)).slice(0,18);
    try { localStorage.setItem('cmvng.creative.recent.v5',JSON.stringify(next)); } catch (_) {}
  }

  function toggleV5Favorite(id) {
    const current=v5FavoriteIds(),next=current.includes(id)?current.filter(item=>item!==id):current.concat(id);
    try { localStorage.setItem('cmvng.creative.favorites.v5',JSON.stringify(next)); } catch (_) {}
  }

  function atomicAddV5(layers,description) {
    const state=builderState(),remaining=Math.max(0,48-state.data.length);
    if(!layers.length) return;
    if(layers.length>remaining) {
      toast(description+' needs '+layers.length+' layers; '+remaining+' are free. Delete layers or use Replace.','warn');
      return;
    }
    const drift=(state.data.length%4)*12, format=window.__bapi.fmt();
    const additions=normalizeCreativeLayers(layers.map(item=>Object.assign({},item,{x:(+item.x||0)+drift,y:(+item.y||0)+drift})),format);
    const next=state.data.concat(additions);
    importBuilderState(next,state.format,state.background,next.length-1);
    applyFoundationLock(); renderBuilderSheet();
    toast(description+' added · '+layers.length+' editable layers','ok');
  }

  function useV5Design(item) {
    const state=builderState(),format=window.__bapi.fmt(),layers=buildV5Design(item,format);
    if(!layers.length) return;
    rememberV5(item.id);
    if(creativeV5Mode==='overlay') {
      const W=format[1],overlay=layers.filter(layer=>!(layer.type==='svgraw' && (+layer.x||0)===0 && (+layer.y||0)===0 && (+layer.w||0)>=W*.9));
      atomicAddV5(overlay,item.name); return;
    }
    foundationSrc=''; foundationBuilderId=null; foundationLocked=false;
    activeCreativeDesignId=item.id;
    originalBuilderDesign={data:clone(layers),format:format[0],background:'transparent',foundationSrc:'',creativeId:item.id,themeId:creativeV5Theme};
    importBuilderState(layers,format[0],'transparent',layers.length-1);
    renderBuilderSheet();
    const sheet=document.getElementById('bw_creative_v5'); if(sheet) sheet.classList.remove('on');
    toast(item.name+' loaded · one-step replace, every layer editable','ok');
  }

  function useV5Asset(kind,item) {
    const pack=creativePackV5(),format=window.__bapi.fmt(); if(!pack) return;
    rememberV5(kind+'-'+item.id);
    const layers=normalizeCreativeLayers(pack.instantiate(kind,item.id,format,{theme:activeCreativeTheme()}),format);
    atomicAddV5(layers,item.name);
  }

  function installCreativeV5Styles() {
    if(document.getElementById('bw_creative_v5_style')) return;
    const style=document.createElement('style'); style.id='bw_creative_v5_style'; style.textContent=`
      #bw_creative_v5{display:none;position:fixed;inset:0;z-index:2500;background:rgba(7,17,36,.63);align-items:flex-end;justify-content:center;backdrop-filter:blur(5px)}
      #bw_creative_v5.on{display:flex}#bw_creative_v5 .bw-v5-shell{width:min(860px,100%);max-height:94vh;overflow:auto;background:#F7FAFF;border-radius:26px 26px 0 0;box-shadow:0 -28px 70px rgba(7,17,36,.38);padding:0 14px calc(18px + env(safe-area-inset-bottom))}
      .bw-v5-head{position:sticky;top:0;z-index:8;margin:0 -14px;padding:14px;background:linear-gradient(120deg,#071124,#123A9E 68%,#2E6BFF);color:#fff;display:flex;gap:11px;align-items:center}
      .bw-v5-head img{width:88px;height:28px;object-fit:cover;border-radius:7px}.bw-v5-head div{min-width:0;flex:1}.bw-v5-head b{display:block;font:800 14px Sora}.bw-v5-head small{display:block;color:#BFD1F5;font:650 8px/1.45 'Space Mono'}
      .bw-v5-close{border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.1);color:#fff;width:38px;height:38px;border-radius:12px;font-size:20px}.bw-v5-proof{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin:12px 0}
      .bw-v5-proof span{padding:8px 5px;border:1px solid #D9E4F5;border-radius:10px;background:#fff;text-align:center;color:#5C719B;font:700 7px 'Space Mono'}.bw-v5-proof b{display:block;color:#123A9E;font:900 13px Sora}
      .bw-v5-tabs,.bw-v5-filters,.bw-v5-themes{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none}.bw-v5-tabs{padding:1px 0 9px}.bw-v5-tabs::-webkit-scrollbar,.bw-v5-filters::-webkit-scrollbar,.bw-v5-themes::-webkit-scrollbar{display:none}
      .bw-v5-tab,.bw-v5-filter,.bw-v5-theme,.bw-v5-mode{flex:0 0 auto;border:1px solid #D4E0F2;border-radius:999px;background:#fff;color:#5C719B;padding:8px 10px;font:750 8px 'Space Mono'}
      .bw-v5-tab.on,.bw-v5-filter.on,.bw-v5-theme.on,.bw-v5-mode.on{background:#123A9E;border-color:#123A9E;color:#fff}.bw-v5-toolbar{position:sticky;top:66px;z-index:7;margin:0 -3px 9px;padding:8px 3px;background:rgba(247,250,255,.96);backdrop-filter:blur(8px)}
      .bw-v5-search{display:flex;gap:7px}.bw-v5-search input{min-width:0;flex:1;border:1px solid #C9D7ED;border-radius:12px;padding:11px;color:#101C33;font:700 10px Sora;outline:none}.bw-v5-count{display:flex;align-items:center;padding:0 10px;border-radius:11px;background:#E9F0FC;color:#123A9E;font:800 8px 'Space Mono'}
      .bw-v5-options{display:flex;align-items:center;justify-content:space-between;gap:9px;margin:8px 0}.bw-v5-modes{display:flex;gap:5px}.bw-v5-help{color:#7084A9;font:650 8px/1.4 'Space Mono'}
      .bw-v5-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.bw-v5-card{position:relative;border:1px solid #D6E1F2;border-radius:17px;background:#fff;overflow:hidden;box-shadow:0 17px 32px -28px #071124}
      .bw-v5-use{display:block;width:100%;border:0;background:#fff;padding:8px;text-align:left}.bw-v5-preview{position:relative;width:100%;aspect-ratio:1/1.05;border-radius:11px;overflow:hidden;background:#EAF1FF}.bw-v5-art{display:block;width:100%;height:100%}
      .bw-v5-meta{padding:8px 2px 2px}.bw-v5-meta b{display:block;padding-right:28px;color:#101C33;font:800 10px/1.25 Sora}.bw-v5-meta span{display:block;margin-top:4px;min-height:24px;color:#7185AA;font:650 7.5px/1.45 'Space Mono'}.bw-v5-meta i{display:block;margin-top:6px;color:#2E6BFF;font:900 8px Sora;font-style:normal}
      .bw-v5-meta span u{text-decoration:none;color:#123A9E;font-weight:850;text-transform:uppercase;letter-spacing:.05em}
      .bw-v5-fave{position:absolute;right:10px;top:10px;z-index:3;width:29px;height:29px;border:1px solid rgba(255,255,255,.65);border-radius:9px;background:rgba(7,17,36,.76);color:#fff;font-size:15px}.bw-v5-fave.on{background:#FFC53D;color:#101C33}
      .bw-v5-more{grid-column:1/-1;border:1px dashed #9DBDF9;border-radius:13px;padding:12px;background:#EEF4FF;color:#123A9E;font:800 10px 'Space Mono'}.bw-v5-empty{grid-column:1/-1;padding:34px 14px;text-align:center;color:#7185AA;font:700 10px 'Space Mono'}
      @media(min-width:700px){.bw-v5-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:420px){.bw-v5-proof{grid-template-columns:repeat(3,1fr)}.bw-v5-proof span:nth-child(n+4){display:none}.bw-v5-toolbar{top:66px}}
    `; document.head.appendChild(style);
  }

  function v5TabItems(tab) {
    const pack=creativePackV5(); if(!pack) return [];
    const catalog=pack.getCatalog();
    if(tab==='designs') return v5DesignCatalog();
    if(tab==='characters') return catalog.characters.map((item,index)=>Object.assign({},item,{kind:'character',index}));
    if(tab==='doodles') return catalog.doodles.map((item,index)=>Object.assign({},item,{kind:'doodle',index}));
    if(tab==='type') return catalog.textStructures.map((item,index)=>Object.assign({},item,{kind:'text',index}));
    return catalog.specialLayouts.map((item,index)=>Object.assign({},item,{kind:'layout',index}));
  }

  function renderV5Filters(sheet,items) {
    const filters=sheet.querySelector('.bw-v5-filters');
    const categories=Array.from(new Set(items.reduce((all,item)=>all.concat(item.direction||[],item.category||[]),[]).filter(Boolean))).slice(0,22);
    const values=['all','favorites','recent'].concat(categories);
    if(!values.includes(creativeV5Filter)) creativeV5Filter='all';
    filters.innerHTML=values.map(value=>'<button class="bw-v5-filter '+(value===creativeV5Filter?'on':'')+'" data-v5-filter="'+escEnh(value)+'">'+escEnh(value)+'</button>').join('');
    filters.querySelectorAll('[data-v5-filter]').forEach(button=>button.onclick=()=>{creativeV5Filter=button.dataset.v5Filter;creativeV5Limit=24;renderV5Catalog(sheet);});
  }

  function normaliseCreativeSearch(value) {
    return String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9@]+/g,' ').trim();
  }

  function renderV5Catalog(sheet) {
    const pack=creativePackV5(); if(!pack) return;
    const items=v5TabItems(creativeV5Tab),query=normaliseCreativeSearch(sheet.querySelector('#bw_v5_search').value);
    renderV5Filters(sheet,items);
    const favorites=v5FavoriteIds(),recent=v5RecentIds();
    let matches=items.filter(item=>{
      const identifier=creativeV5Tab==='designs'?item.id:(item.kind+'-'+item.id);
      if(creativeV5Filter==='favorites'&&!favorites.includes(identifier)) return false;
      if(creativeV5Filter==='recent'&&!recent.includes(identifier)) return false;
      if(!/^(all|favorites|recent)$/.test(creativeV5Filter)&&item.category!==creativeV5Filter&&item.direction!==creativeV5Filter) return false;
      const hay=normaliseCreativeSearch([item.id,item.name,item.note,item.category,item.direction].concat(item.tags||[]).join(' '));
      return !query||query.split(/\s+/).every(token=>hay.includes(token));
    });
    if(creativeV5Filter==='recent') matches.sort((a,b)=>recent.indexOf(creativeV5Tab==='designs'?a.id:(a.kind+'-'+a.id))-recent.indexOf(creativeV5Tab==='designs'?b.id:(b.kind+'-'+b.id)));
    sheet.querySelector('#bw_v5_count').textContent=matches.length+' found';
    const format=['preview',1080,1080],visible=matches.slice(0,creativeV5Limit);
    const cards=visible.map(item=>{
      const identifier=creativeV5Tab==='designs'?item.id:(item.kind+'-'+item.id);
      let layers=[];
      if(creativeV5Tab==='designs') layers=buildV5Design(item,format); else layers=pack.instantiate(item.kind,item.id,format,{theme:activeCreativeTheme()});
      return '<article class="bw-v5-card"><button class="bw-v5-fave '+(favorites.includes(identifier)?'on':'')+'" data-v5-fave="'+escEnh(identifier)+'" aria-label="favorite">★</button><button class="bw-v5-use" data-v5-use="'+escEnh(item.id)+'"><div class="bw-v5-preview">'+v5Preview(layers,format)+'</div><div class="bw-v5-meta"><b>'+escEnh(item.name)+'</b><span>'+(item.direction?'<u>'+escEnh(item.direction)+'</u> · ':'')+escEnh(item.note||'Editable native CMVNG system.')+'</span><i>'+(creativeV5Tab==='designs'?'use editable design':'add editable layers')+' · '+layers.length+' layers →</i></div></button></article>';
    }).join('');
    sheet.querySelector('#bw_v5_grid').innerHTML=cards+(matches.length>visible.length?'<button class="bw-v5-more" data-v5-more>show '+Math.min(24,matches.length-visible.length)+' more →</button>':'')+(!matches.length?'<div class="bw-v5-empty">No systems match that search yet.</div>':'');
    sheet.querySelectorAll('[data-v5-use]').forEach(button=>button.onclick=()=>{const item=items.find(entry=>entry.id===button.dataset.v5Use);if(!item)return;if(creativeV5Tab==='designs')useV5Design(item);else useV5Asset(item.kind,item);renderV5Catalog(sheet);});
    sheet.querySelectorAll('[data-v5-fave]').forEach(button=>button.onclick=event=>{event.stopPropagation();toggleV5Favorite(button.dataset.v5Fave);renderV5Catalog(sheet);});
    const more=sheet.querySelector('[data-v5-more]'); if(more) more.onclick=()=>{creativeV5Limit+=24;renderV5Catalog(sheet);};
  }

  function openCreativeKitV5() {
    const pack=creativePackV5();
    if(!pack || !pack.validation || !pack.validation.ok) { toast('the creative pack did not load · refresh the app','bad'); return; }
    installCreativeV5Styles();
    let sheet=document.getElementById('bw_creative_v5');
    if(!sheet) {
      sheet=document.createElement('div'); sheet.id='bw_creative_v5';
      const designCount=v5DesignCatalog().length;
      sheet.innerHTML='<div class="bw-v5-shell"><div class="bw-v5-head"><img src="'+BRAND_LOGO+'" alt="cmvng"><div><b>Signal Workshop</b><small>'+designCount+' editable starting designs · '+pack.counts.total+' authored systems · no palette-swap counting</small></div><button class="bw-v5-close" data-v5-close aria-label="Close Signal Workshop">×</button></div>'+
        '<div class="bw-v5-proof"><span><b>'+designCount+'</b>designs</span><span><b>'+pack.counts.characters+'</b>characters</span><span><b>'+pack.counts.doodles+'</b>doodles</span><span><b>'+pack.counts.textStructures+'</b>type systems</span><span><b>'+pack.counts.specialLayouts+'</b>layouts</span></div>'+
        '<div class="bw-v5-tabs">'+[['designs',designCount+' designs'],['characters',pack.counts.characters+' characters'],['doodles',pack.counts.doodles+' doodles'],['type',pack.counts.textStructures+' type'],['layouts',pack.counts.specialLayouts+' layouts']].map(item=>'<button class="bw-v5-tab '+(item[0]==='designs'?'on':'')+'" data-v5-tab="'+item[0]+'">'+item[1]+'</button>').join('')+'</div>'+
        '<div class="bw-v5-toolbar"><div class="bw-v5-search"><input id="bw_v5_search" aria-label="Search Signal Workshop" placeholder="search minimal, editorial, evidence, data, culture…"><span class="bw-v5-count" id="bw_v5_count">'+designCount+' found</span></div><div class="bw-v5-options"><div class="bw-v5-themes">'+CREATIVE_V5_THEMES.map(item=>'<button class="bw-v5-theme '+(item.id==='signal'?'on':'')+'" data-v5-theme="'+item.id+'">'+item.name+'</button>').join('')+'</div><div class="bw-v5-modes"><button class="bw-v5-mode on" data-v5-mode="replace">replace</button><button class="bw-v5-mode" data-v5-mode="overlay">overlay</button></div></div><div class="bw-v5-help">Replace creates a clean, recoverable checkpoint. Overlay preserves the canvas and adds only the selected system when the 48-layer budget allows it.</div><div class="bw-v5-filters"></div></div><div class="bw-v5-grid" id="bw_v5_grid"></div></div>';
      sheet.onclick=event=>{if(event.target===sheet||event.target.closest('[data-v5-close]'))sheet.classList.remove('on');};
      sheet.querySelector('#bw_v5_search').oninput=()=>{creativeV5Limit=24;renderV5Catalog(sheet);};
      sheet.querySelectorAll('[data-v5-tab]').forEach(button=>button.onclick=()=>{creativeV5Tab=button.dataset.v5Tab;creativeV5Filter='all';creativeV5Limit=24;sheet.querySelectorAll('[data-v5-tab]').forEach(node=>node.classList.toggle('on',node===button));renderV5Catalog(sheet);});
      sheet.querySelectorAll('[data-v5-theme]').forEach(button=>button.onclick=()=>{creativeV5Theme=button.dataset.v5Theme;sheet.querySelectorAll('[data-v5-theme]').forEach(node=>node.classList.toggle('on',node===button));renderV5Catalog(sheet);});
      sheet.querySelectorAll('[data-v5-mode]').forEach(button=>button.onclick=()=>{creativeV5Mode=button.dataset.v5Mode;sheet.querySelectorAll('[data-v5-mode]').forEach(node=>node.classList.toggle('on',node===button));});
      document.body.appendChild(sheet);
    }
    renderV5Catalog(sheet); sheet.classList.add('on');
  }

  function addBuilderShape(kind) {
    const state = builderState();
    const color = '#2E6BFF';
    let inner = '<rect x="4" y="4" width="92" height="92" rx="14" fill="' + color + '"/>';
    let ar = 1;
    if (kind === 'circle') inner = '<circle cx="50" cy="50" r="45" fill="' + color + '"/>';
    if (kind === 'line') {
      inner = '<path d="M5 50 H95" stroke="' + color + '" stroke-width="8" stroke-linecap="round"/>';
      ar = .18;
    }
    state.data.push({type:'svgraw',vb:'0 0 100 100',inner,x:120,y:160,w:260,ar});
    importBuilderState(state.data, state.format, state.background, state.data.length - 1);
    renderBuilderSheet();
    toast(kind + ' added', 'ok');
  }

  function replaceSelectedBuilderImage() {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*';
    input.onchange = event => {
      const file = event.target.files && event.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const image = new Image();
        image.onload = () => mutateSelected((data, index) => {
          data[index].type = 'img';
          data[index].src = reader.result;
          data[index].ar = image.naturalHeight / Math.max(1, image.naturalWidth);
        });
        image.src = reader.result;
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }

  function saveBuilderDraft(manual) {
    if (suppressBuilderSave || !document.getElementById('bd_canvas')) return;
    try {
      const state = builderState();
      const payload = JSON.stringify({v:2,format:state.format,background:state.background,data:state.data.map(item => {
        const copy = Object.assign({}, item); delete copy.__id; return copy;
      })});
      if (payload.length > 3800000) {
        if (manual) toast('this layout is too image-heavy for browser autosave · use the library save button', 'warn');
        return;
      }
      localStorage.setItem(BUILDER_DRAFT_KEY, payload);
      if (manual) toast('builder draft saved on this device', 'ok');
    } catch (_) {
      if (manual) toast('browser storage is full · export or save to library', 'warn');
    }
  }

  function scheduleBuilderSave() {
    if (suppressBuilderSave) return;
    clearTimeout(builderSaveTimer);
    builderSaveTimer = setTimeout(() => saveBuilderDraft(false), 700);
  }

  function restoreBuilderDraft() {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(BUILDER_DRAFT_KEY) || 'null'); } catch (_) {}
    if (!saved || !Array.isArray(saved.data)) {
      toast('no builder autosave found yet', 'warn');
      return;
    }
    const fullCanvas = saved.data.find(item => (item.type === 'img' || item.type === 'shot') &&
      /^data:image\//.test(item.src || '') && +(item.x || 0) === 0 && +(item.y || 0) === 0 && +(item.w || 0) >= 800);
    foundationSrc = fullCanvas ? fullCanvas.src : '';
    foundationLocked = !!foundationSrc;
    originalBuilderDesign = {data:clone(saved.data),format:saved.format || 'post',background:saved.background || '',foundationSrc};
    activeCreativeDesignId = '';
    importBuilderState(saved.data, saved.format || 'post', saved.background || '', null);
    requestAnimationFrame(applyFoundationLock);
    renderBuilderSheet();
    toast('builder autosave restored', 'ok');
  }

  function constrainBuilderControls() {
    const stage=document.getElementById('bd_stage'),overlay=document.getElementById('bd_ov');
    if(!stage||!overlay) return;
    const tool=overlay.querySelector('.tool');
    if(tool) {
      const stageW=stage.clientWidth,stageH=stage.clientHeight,toolW=tool.offsetWidth,toolH=tool.offsetHeight;
      let left=parseFloat(tool.style.left)||stageW/2,top=parseFloat(tool.style.top)||2;
      left=Math.max(toolW/2+6,Math.min(stageW-toolW/2-6,left));
      top=Math.max(4,Math.min(Math.max(4,stageH-toolH-5),top));
      tool.style.left=left+'px';tool.style.top=top+'px';
    }
  }

  function builderFormatTuple(id) {
    const geometry=builderGeometryV6(),dims=geometry&&geometry.FORMATS[id];
    return dims?[id,dims[0],dims[1]]:window.__bapi.fmt();
  }

  function captureFormatChange(event) {
    const button=event.target.closest&&event.target.closest('#bd_fmts .fmt');
    if(!button) return;
    const current=window.__bapi.fmt();
    pendingFormatChange={from:[current[0],current[1],current[2]],to:button.dataset.f||button.textContent.trim(),state:builderState()};
  }

  function completeFormatChange(event) {
    const button=event.target.closest&&event.target.closest('#bd_fmts .fmt'),pending=pendingFormatChange;
    if(!button||!pending) return;
    pendingFormatChange=null;
    if(pending.from[0]===pending.to) { requestAnimationFrame(window.__bapi.layout); return; }
    const geometry=builderGeometryV6(),target=builderFormatTuple(pending.to);
    if(!geometry) { requestAnimationFrame(window.__bapi.layout); return; }
    const index=selectedIndex(pending.state),item=activeCreativeDesignId&&v5DesignCatalog().find(entry=>entry.id===activeCreativeDesignId);
    const personalized=!!(item&&originalBuilderDesign&&originalBuilderDesign.personalized&&originalBuilderDesign.creativeId===item.id);
    const pristine=!!item&&compositionIsPristine(pending.state.data);
    let next;
    if(pristine&&!personalized) {
      next=buildV5Design(item,target);
    } else {
      next=geometry.reflowComposition(pending.state.data,pending.from,target,{padding:0});
    }
    if(item) {
      const originalFrom=builderFormatTuple((originalBuilderDesign&&originalBuilderDesign.format)||pending.from[0]);
      const exact=personalized
        ? geometry.reflowComposition(originalBuilderDesign.data,originalFrom,target,{padding:0})
        : buildV5Design(item,target);
      originalBuilderDesign={data:clone(exact),format:target[0],background:'transparent',foundationSrc:'',creativeId:item.id,themeId:creativeV5Theme,personalized};
    } else if(originalBuilderDesign&&Array.isArray(originalBuilderDesign.data)) {
      const originalFrom=builderFormatTuple(originalBuilderDesign.format||pending.from[0]);
      originalBuilderDesign.data=geometry.reflowComposition(originalBuilderDesign.data,originalFrom,target,{padding:0});
      originalBuilderDesign.format=target[0];
    }
    importBuilderState(next,target[0],pending.state.background,index);
    renderBuilderSheet();
    requestAnimationFrame(()=>{window.__bapi.layout();constrainBuilderControls();});
    toast(target[0]+' composition fitted + centered'+(pristine&&!personalized?' · responsive kit rebuilt':' · edits preserved'),'ok');
  }

  function auditCreativeDesigns() {
    const geometry=builderGeometryV6(),designs=v5DesignCatalog();
    if(!geometry) return {ok:false,reason:'geometry module missing'};
    const formats=Object.keys(geometry.FORMATS).map(id=>builderFormatTuple(id));
    const failures=[];let compositions=0,layers=0;
    designs.forEach(design=>formats.forEach(format=>{
      const built=buildV5Design(design,format),result=geometry.auditComposition(built,format,{tolerance:2});
      compositions+=1;layers+=built.length;
      if(!result.ok) failures.push({design:design.id,format:format[0],errors:result.errors});
    }));
    return {ok:failures.length===0,designs:designs.length,formats:formats.length,compositions,layers,failures};
  }

  function installBuilderEnhancements() {
    const screen = document.getElementById('bscr');
    if (!screen || screen.dataset.enhanced === ENH_VERSION) return;
    screen.dataset.enhanced = ENH_VERSION;
    const top = screen.querySelector('.top');
    const exportButton = document.getElementById('bd_expBtn');
    if (top && exportButton) {
      const topButtons=Array.from(top.querySelectorAll(':scope > button'));
      if(topButtons[0]) { topButtons[0].classList.add('bw-builder-back');topButtons[0].setAttribute('aria-label','Back to studio');topButtons[0].title='Back to studio'; }
      topButtons.forEach(button=>{
        const action=(button.getAttribute('onclick')||'').toLowerCase();
        if(action.includes('clearall')||action.includes('savecomp')) button.classList.add('bw-mobile-secondary');
      });
      const layers = document.createElement('button');
      layers.type = 'button';
      layers.className = 'ghost bw-top-tool';
      layers.textContent = 'layers';
      layers.setAttribute('aria-label','Open layers and builder controls');
      layers.onclick = openBuilderSheet;
      top.insertBefore(layers, exportButton);
      const originalExport = window.__bapi.exportPNG;
      exportButton.onclick = async () => {
        if (!window.__bapi.count()) {
          toast('add a layer before exporting', 'warn');
          return;
        }
        const url = await originalExport();
        toast(url ? 'PNG exported at full resolution' : 'export failed · try removing a very large image', url ? 'ok' : 'bad');
      };
    }
    const rail = document.getElementById('bd_rail');
    if (rail) {
      const kit = document.createElement('button');
      kit.className = 'add bw-rail-new bw-creative-rail';
      kit.innerHTML = '<div class="ic"><svg viewBox="0 0 24 24"><path d="M12 2l2.2 5.2L20 8l-4.2 3.8L17 18l-5-3-5 3 1.2-6.2L4 8l5.8-.8Z"/><path d="M19 16v6M16 19h6"/></svg></div><small>Signal Workshop</small>';
      kit.onclick = openCreativeKitV5;
      rail.insertBefore(kit, rail.firstChild);
      const shape = document.createElement('button');
      shape.className = 'add bw-rail-new';
      shape.innerHTML = '<div class="ic"><svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="16" cy="8" r="3"/></svg></div><small>shapes</small>';
      shape.onclick = openBuilderSheet;
      rail.appendChild(shape);
      const restore = document.createElement('button');
      restore.className = 'add bw-rail-new';
      restore.innerHTML = '<div class="ic"><svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 3-6"/><path d="M4 4v6h6"/></svg></div><small>restore</small>';
      restore.onclick = restoreBuilderDraft;
      rail.appendChild(restore);
    }
    document.addEventListener('pointerdown', event => {
      const element = event.target.closest && event.target.closest('#bd_canvas .el');
      if (element) {
        const id = +(element.id || '').replace('bdel', '');
        if (foundationLocked && id === foundationBuilderId) {
          event.preventDefault();
          event.stopImmediatePropagation();
          toast('foundation locked · edit the layers above it', 'warn');
          return;
        }
        selectedBuilderId = id;
      }
    }, true);
    const canvas = document.getElementById('bd_canvas');
    if (canvas) {
      normaliseBuilderSvgrawRenderingV7();
      const observer = new MutationObserver(()=>{normaliseBuilderSvgrawRenderingV7();scheduleBuilderSave();});
      observer.observe(canvas, {childList:true,subtree:true,attributes:true,attributeFilter:['style']});
    }
    const formatBar=document.getElementById('bd_fmts');
    if(formatBar) {
      formatBar.addEventListener('click',captureFormatChange,true);
      formatBar.addEventListener('click',completeFormatChange,false);
    }
    const overlay=document.getElementById('bd_ov');
    if(overlay) {
      const overlayObserver=new MutationObserver(()=>requestAnimationFrame(constrainBuilderControls));
      overlayObserver.observe(overlay,{childList:true,subtree:true});
    }
    document.addEventListener('keydown', event => {
      if (!document.getElementById('bscr').classList.contains('on')) return;
      if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement && document.activeElement.tagName)) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault(); saveBuilderDraft(true); return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd') {
        event.preventDefault(); mutateSelected((data, i) => {
          const copy = clone(data[i]); copy.x = (copy.x || 0) + 36; copy.y = (copy.y || 0) + 36;
          data.splice(i + 1, 0, copy);
        }, selectedIndex(builderState()) + 1);
      }
    });
    if (!sessionStorage.getItem('banger.builder.coach.v3')) {
      sessionStorage.setItem('banger.builder.coach.v3','1');
      setTimeout(()=>toast('Tip · Layers contains align, resize, reset, and safe-remix controls','ok'),350);
    }
    requestAnimationFrame(()=>{applyFoundationLock();window.__bapi.layout();constrainBuilderControls();});
  }

  /* ---------- Product-wide calm UI + accessibility v7 ---------- */
  let homeTemplateLimitV7 = 24;
  let homeTemplateRefreshV7 = 0;

  function injectProductV7Styles() {
    if (document.getElementById('bw_product_v7_style')) return;
    const style = document.createElement('style');
    style.id = 'bw_product_v7_style';
    style.textContent = `
      .bw-library-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1px;overflow:hidden;
        border:1px solid rgba(255,255,255,.18);border-radius:19px;background:rgba(255,255,255,.16);
        box-shadow:0 18px 42px -28px rgba(8,24,58,.78)}
      .bw-library-metric{min-width:0;padding:13px 12px;background:linear-gradient(145deg,#173FAD,#12358D);color:#fff}
      .bw-library-metric small{display:block;margin-bottom:4px;color:#BFD1F5;font:750 7.5px 'Space Mono';letter-spacing:.11em;text-transform:uppercase}
      .bw-library-metric b{display:block;font:850 22px/1 Sora;letter-spacing:-.05em}.bw-library-metric span{display:block;margin-top:3px;color:#DCE7FF;font:650 8px 'Space Mono'}
      .bw-library-proof{grid-column:1/-1;padding:9px 12px;background:#0D1D3A;color:#AFC2E7;font:650 8px/1.45 'Space Mono';letter-spacing:.02em}
      #grid .tcard{content-visibility:auto;contain-intrinsic-size:420px;outline:none}
      #home .tgrid{grid-template-columns:repeat(2,minmax(0,1fr))}
      #home .tcard,#home .tthumb{min-width:0}
      #grid .tcard.bw-page-hidden{display:none!important}
      #grid .tcard:focus-visible{outline:3px solid rgba(46,107,255,.42);outline-offset:4px;border-radius:18px}
      #bw_home_more{width:100%;margin:13px 0 4px;border:1px dashed #9DBDF9;border-radius:15px;padding:13px 16px;
        background:linear-gradient(180deg,#F7FAFF,#EAF1FF);color:#123A9E;font:800 10px 'Space Mono';cursor:pointer}
      #bw_home_more[hidden]{display:none}
      .bw-source-examples{margin:-3px 1px 11px;color:#7185AA;font:650 9.5px/1.5 'Space Mono'}
      .bw-source-examples b{color:#425B8C}
      .bw-source-statuses{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}
      .bw-source-status{display:inline-flex;padding:5px 7px;border:1px solid rgba(138,91,17,.18);border-radius:999px;
        background:rgba(255,255,255,.52);color:#785117;font:750 8px 'Space Mono'}
      #bscr .bw-canvas-meta{position:absolute;left:50%;top:8px;z-index:12;transform:translateX(-50%);pointer-events:none;
        padding:6px 9px;border:1px solid rgba(255,255,255,.78);border-radius:999px;background:rgba(255,255,255,.84);
        color:#49618F;font:750 8px 'Space Mono';box-shadow:0 9px 20px -15px rgba(10,26,55,.7);backdrop-filter:blur(8px)}
      @media(prefers-reduced-motion:reduce){*,*:before,*:after{scroll-behavior:auto!important;animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}}
      @media(max-width:520px){
        #wscr .bw-row{display:grid!important;grid-template-columns:1fr;gap:0!important}
        #wscr .bw-row>div{min-width:0;width:100%;max-width:none!important}
        #wscr .bw-in{font-size:14px}
        #bscr #bd_pad{display:none!important}
        #bscr #bd_ov .tool{position:fixed!important;left:50%!important;right:auto!important;top:auto!important;
          bottom:calc(94px + env(safe-area-inset-bottom))!important;transform:translateX(-50%)!important;
          max-width:calc(100vw - 28px)!important;padding:7px!important;border:1px solid rgba(255,255,255,.82)!important;
          border-radius:15px!important;background:rgba(255,255,255,.94)!important;box-shadow:0 16px 38px -18px rgba(7,17,36,.72)!important;
          backdrop-filter:blur(14px)!important;overflow-x:auto!important}
        #bscr .bw-canvas-meta{top:6px}
      }
      @media(min-width:700px){
        #bw_creative_v5{align-items:center!important;padding:24px}
        #bw_creative_v5 .bw-v5-shell{width:min(1160px,100%)!important;max-height:calc(100vh - 48px)!important;border-radius:24px!important}
        #bw_creative_v5 .bw-v5-grid{grid-template-columns:repeat(4,minmax(0,1fr))!important}
        #bw_creative_v5 .bw-v5-preview{aspect-ratio:1.08/1}
      }
      @media(min-width:900px){
        body>.wrap{width:calc(100% - 48px)!important;max-width:1240px!important}
        #home.on{display:grid!important;grid-template-columns:minmax(0,1.03fr) minmax(420px,.97fr);column-gap:24px;align-items:start}
        #home>.hdr,#home>.greet,#home>.search,#home>.cats,#home>.tgrid,#home>#bw_home_more{grid-column:1/-1}
        #home>.hdr{grid-row:1}#home>.greet{grid-row:2}
        #home>.counter{grid-column:1;grid-row:3;margin:0!important;align-self:stretch}
        #home>.bw-home-lab{grid-column:2;grid-row:3 / span 2;margin:0;min-height:276px;padding:28px}
        #home>.bw-home-lab h2{max-width:420px;font-size:32px}#home>.bw-home-lab h2 em{font-size:35px}
        #home>.bw-home-lab p{max-width:390px;font-size:12px}#home>.bw-home-lab .bw-home-stack{right:26px;bottom:23px;transform:scale(1.16)}
        #home>.ctarow{grid-column:1;grid-row:4;margin-top:14px;align-self:end}
        #home>.search{grid-row:5;margin-top:24px}#home>.cats{grid-row:6}#home>.tgrid{grid-row:7}
        #home .tgrid{grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
        #wscr .bw-wrap{width:min(840px,calc(100% - 40px));margin:0 auto}
      }
      @media(min-width:1180px){#home .tgrid{grid-template-columns:repeat(4,minmax(0,1fr))}}
      @media(max-width:430px){
        .bw-library-metric{padding:11px 9px}.bw-library-metric b{font-size:18px}.bw-library-metric span{font-size:7px}
        .bw-library-proof{font-size:7.5px}
      }
    `;
    document.head.appendChild(style);
  }

  function creativeInventoryV7() {
    const pack = creativePackV5();
    const designs = v5DesignCatalog().length;
    const templates = typeof T === 'object' ? Object.keys(T).length : document.querySelectorAll('#grid .tcard').length;
    const counts = pack && pack.counts || {};
    return {templates, designs, layouts:+counts.specialLayouts||0, counts};
  }

  function rewriteLibraryMetricsV7() {
    const counter = document.querySelector('#home .counter');
    if (!counter || counter.dataset.metricsV7 === ENH_VERSION) return;
    counter.dataset.metricsV7 = ENH_VERSION;
    const inventory = creativeInventoryV7();
    counter.classList.add('bw-library-metrics');
    counter.innerHTML = '<div class="bw-library-metric"><small>classic templates</small><b>'+inventory.templates+'</b><span>editable originals</span></div>'+
      '<div class="bw-library-metric"><small>native design starts</small><b>'+inventory.designs+'</b><span>real editable layers</span></div>'+
      '<div class="bw-library-metric"><small>complete layouts</small><b>'+inventory.layouts+'</b><span>fully composed systems</span></div>'+
      '<div class="bw-library-proof">'+(+inventory.counts.characters||0)+' characters · '+(+inventory.counts.doodles||0)+' doodles · '+(+inventory.counts.textStructures||0)+' text structures · '+inventory.layouts+' complete layouts. Every native system is authored and verified in all four formats; palette swaps are not counted as new designs.</div>';
  }

  function accessibleTemplateCardV7(card) {
    if (!card || card.dataset.accessibleV7) return;
    card.dataset.accessibleV7 = '1';
    card.setAttribute('role','button');
    card.setAttribute('tabindex','0');
    const label = String(card.textContent || '').replace(/\s+/g,' ').trim().slice(0,150);
    card.setAttribute('aria-label','Open template: '+(label || 'CMVNG design'));
    card.addEventListener('keydown', event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault(); card.click();
    });
  }

  function refreshHomeTemplatePageV7() {
    const grid = document.getElementById('grid');
    const more = document.getElementById('bw_home_more');
    if (!grid || !more) return;
    const cards = Array.from(grid.querySelectorAll('.tcard'));
    cards.forEach(card => { card.classList.remove('bw-page-hidden'); accessibleTemplateCardV7(card); });
    const matching = cards.filter(card => !card.hidden && card.style.display !== 'none');
    matching.forEach((card,index) => card.classList.toggle('bw-page-hidden', index >= homeTemplateLimitV7));
    requestAnimationFrame(() => matching.slice(0,homeTemplateLimitV7).forEach(card => {
      const mini=card.querySelector('.mini');
      if(!mini) return;
      const id=String(mini.id||'').replace(/^th_/,'');
      if(!mini.innerHTML&&T[id]) {
        mini.innerHTML=T[id].render(Object.assign({branding:true},T[id].sample));
        try { fitPass(mini); } catch (_) {}
      }
      if(mini.innerHTML&&typeof fit==='function') fit(mini);
    }));
    const remaining = Math.max(0, matching.length - homeTemplateLimitV7);
    more.hidden = remaining === 0;
    more.textContent = remaining ? 'show '+Math.min(24,remaining)+' more · '+Math.min(homeTemplateLimitV7,matching.length)+' of '+matching.length+' visible →' : '';
    more.setAttribute('aria-label',remaining ? 'Show more templates' : 'All matching templates shown');
  }

  function scheduleHomeTemplatePageV7(reset) {
    if (reset) homeTemplateLimitV7 = 24;
    clearTimeout(homeTemplateRefreshV7);
    homeTemplateRefreshV7 = setTimeout(refreshHomeTemplatePageV7, 20);
  }

  function installHomeLibraryV7() {
    const grid = document.getElementById('grid');
    if (!grid || grid.dataset.libraryV7) return;
    grid.dataset.libraryV7 = '1';
    const more = document.createElement('button');
    more.type = 'button'; more.id = 'bw_home_more'; more.textContent = 'show more templates →';
    more.onclick = () => { homeTemplateLimitV7 += 24; refreshHomeTemplatePageV7(); };
    grid.insertAdjacentElement('afterend',more);
    const observer = new MutationObserver(() => scheduleHomeTemplatePageV7(false));
    observer.observe(grid,{childList:true});
    const search = document.getElementById('q');
    if (search) {
      search.setAttribute('aria-label','Search the template library');
      search.addEventListener('input',() => scheduleHomeTemplatePageV7(true));
    }
    const categories = document.getElementById('cats');
    if (categories) categories.addEventListener('click',() => scheduleHomeTemplatePageV7(true));
    refreshHomeTemplatePageV7();
  }

  function improveWriterUXV7() {
    const writer = document.getElementById('wscr');
    const root = document.getElementById('bw_root');
    if (!writer || !root || root.dataset.productV7) return;
    root.dataset.productV7 = '1'; writer.dataset.productV7 = '1';
    const back = writer.querySelector('.wtop button,button');
    if (back) { back.setAttribute('aria-label','Back to studio'); back.title='Back to studio'; }
    if (root) { root.setAttribute('inputmode','url'); root.setAttribute('autocomplete','url'); }
    const project = document.getElementById('bw_proj');
    if (project) project.setAttribute('autocomplete','off');
    const row = root && root.closest('.bw-row');
    if (row && !document.querySelector('.bw-source-examples')) {
      const hint = document.createElement('div');
      hint.className = 'bw-source-examples';
      hint.innerHTML = '<b>Best source:</b> exact article, docs page, project website, or X post/profile. A bare homepage may not contain enough evidence.';
      row.insertAdjacentElement('afterend',hint);
    }
    Array.from(writer.querySelectorAll('button')).forEach(button => {
      if (button.getAttribute('aria-label')) return;
      const text=button.textContent.replace(/\s+/g,' ').trim();
      if (text) button.setAttribute('aria-label',text);
    });
  }

  function labelBuilderControlsV7() {
    const screen = document.getElementById('bscr');
    if (!screen) return;
    screen.querySelectorAll('#bd_fmts .fmt').forEach(button => {
      const label=button.textContent.trim(); button.setAttribute('aria-label','Canvas format: '+label); button.title='Canvas format: '+label;
    });
    screen.querySelectorAll('.tonewrap button').forEach((button,index) => {
      const label=['classic','soft','bold','deep'][index] || ('style '+(index+1));
      button.setAttribute('aria-label','Canvas color style: '+label); button.title='Canvas color style: '+label;
    });
    screen.querySelectorAll('#bd_rail .add').forEach(button => {
      const label=(button.querySelector('small')?.textContent || button.textContent || 'insert').trim();
      button.setAttribute('aria-label','Insert '+label); button.title='Insert '+label;
    });
    const actions={dup:'Duplicate layer',front:'Bring layer to front',swap:'Swap logo',edit:'Edit text',pic:'Replace image',cyc:'Change artwork',del:'Delete layer'};
    screen.querySelectorAll('#bd_ov .tool button[data-a]').forEach(button => {
      const label=actions[button.dataset.a]||'Edit selected layer';
      button.setAttribute('aria-label',label);button.title=label;
    });
    screen.querySelectorAll('#bd_ov .h.resize,#bd_ov .h.rot').forEach(handle => {
      const rotating=handle.classList.contains('rot');
      handle.setAttribute('role','img');handle.setAttribute('aria-label',rotating?'Rotate selected layer':'Resize selected layer');
      handle.title=rotating?'Drag to rotate':'Drag to resize';
    });
    const canvas=document.getElementById('bd_canvas');
    if(canvas){canvas.setAttribute('role','region');canvas.setAttribute('aria-label','Editable design canvas');}
  }

  function updateBuilderMetaV7() {
    const stage=document.querySelector('#bscr .stagewrap'),canvas=document.getElementById('bd_canvas');
    if(!stage||!canvas) return;
    let meta=stage.querySelector('.bw-canvas-meta');
    if(!meta){meta=document.createElement('div');meta.className='bw-canvas-meta';stage.appendChild(meta);}
    const selected=document.querySelector('#bd_fmts .fmt.on,#bd_fmts .fmt.active');
    const format=(selected?.textContent||'post').trim();
    const count=canvas.children.length;
    const next=format+' · '+count+' layer'+(count===1?'':'s');
    if(meta.textContent!==next) meta.textContent=next;
  }

  function installBuilderProductV7() {
    const canvas=document.getElementById('bd_canvas');
    if(!canvas || canvas.dataset.productV7) return;
    canvas.dataset.productV7='1';
    labelBuilderControlsV7(); updateBuilderMetaV7();
    const observer=new MutationObserver(()=>{labelBuilderControlsV7();updateBuilderMetaV7();});
    observer.observe(document.getElementById('bscr'),{childList:true,subtree:true});
    const formats=document.getElementById('bd_fmts');
    if(formats) formats.addEventListener('click',()=>setTimeout(updateBuilderMetaV7,30));
  }

  function installProductV7Experience() {
    rewriteLibraryMetricsV7();
    installHomeLibraryV7();
    improveWriterUXV7();
    installBuilderProductV7();
  }

  function installPwaV7() {
    if (!document.querySelector('link[rel="manifest"]')) {
      const manifest=document.createElement('link');manifest.rel='manifest';manifest.href='/manifest.webmanifest';document.head.appendChild(manifest);
    }
    if (!document.querySelector('meta[name="theme-color"]')) {
      const theme=document.createElement('meta');theme.name='theme-color';theme.content='#F4F7FB';document.head.appendChild(theme);
    }
    if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;
    navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'})
      .then(registration => registration.update()).catch(() => {});
  }

  const nativeGoBuilder = window.goBuilder;
  window.goBuilder = function enhancedGoBuilder() {
    nativeGoBuilder();
    installBuilderEnhancements();
  };

  injectEnhancementStyles();
  injectExperienceStyles();
  injectBuilderStabilityStyles();
  injectProductV7Styles();
  installHomeLaunchpad();
  decorateWriterWorkspace();
  installOfficialBrand();
  installExperienceObserver();
  installBuilderEnhancements();
  installProductV7Experience();
  installPwaV7();
  window.__cmvngAuditBuilder=auditCreativeDesigns;
  const builderScreen=document.getElementById('bscr');
  if(builderScreen) builderScreen.dataset.designAudit='pending';
  const publishStartupAudit=()=>{
    const audit=auditCreativeDesigns();
    if(builderScreen) {
      builderScreen.dataset.designAudit=audit.ok?'pass':'fail';
      builderScreen.dataset.auditDesigns=String(audit.designs||0);
      builderScreen.dataset.auditFormats=String(audit.formats||0);
      builderScreen.dataset.auditCompositions=String(audit.compositions||0);
      builderScreen.dataset.auditLayers=String(audit.layers||0);
    }
    if(!audit.ok&&typeof console!=='undefined'&&console.error) console.error('CMVNG Builder design audit failed',audit.failures);
  };
  if('requestIdleCallback' in window) requestIdleCallback(publishStartupAudit,{timeout:3200}); else setTimeout(publishStartupAudit,700);
})();

