(function (root) {
  'use strict';

  const FORMATS = {
    post: [1080, 1350],
    square: [1080, 1080],
    wide: [1920, 1080],
    story: [1080, 1920]
  };

  const number = (value, fallback) => Number.isFinite(+value) ? +value : fallback;
  const round = value => Math.round(value * 1000) / 1000;

  function format(raw) {
    if (Array.isArray(raw)) {
      return {id:String(raw[0] || 'custom'), w:number(raw[1], 1080), h:number(raw[2], 1350)};
    }
    if (typeof raw === 'string' && FORMATS[raw]) {
      return {id:raw, w:FORMATS[raw][0], h:FORMATS[raw][1]};
    }
    if (raw && typeof raw === 'object') {
      return {id:String(raw.id || 'custom'), w:number(raw.w || raw.width, 1080), h:number(raw.h || raw.height, 1350)};
    }
    return {id:'post', w:1080, h:1350};
  }

  function textHeight(layer) {
    const size = Math.max(1, number(layer.size, 60));
    const width = Math.max(24, number(layer.w, 200));
    const lineHeight = Math.max(.65, number(layer.lh, 1.08));
    const charactersPerLine = Math.max(1, Math.floor(width / Math.max(1, size * .56)));
    const sourceLines = String(layer.text || '').split('\n');
    const visualLines = sourceLines.reduce((total, line) => total + Math.max(1, Math.ceil(line.length / charactersPerLine)), 0);
    return Math.max(size * 1.08, visualLines * size * lineHeight) + 6;
  }

  function layerHeight(layer) {
    if (layer.type === 'text') return textHeight(layer);
    if (Number.isFinite(+layer.h) && +layer.h > 0) return +layer.h;
    return Math.max(1, number(layer.w, 200) * Math.max(.01, number(layer.ar, 1)));
  }

  function bounds(layer) {
    const x = number(layer.x, 0), y = number(layer.y, 0);
    const w = Math.max(1, number(layer.w, 200)), h = layerHeight(layer);
    const radians = Math.abs(number(layer.rot, 0)) * Math.PI / 180;
    if (!radians) return {x, y, w, h, right:x + w, bottom:y + h};
    const rotatedW = Math.abs(w * Math.cos(radians)) + Math.abs(h * Math.sin(radians));
    const rotatedH = Math.abs(w * Math.sin(radians)) + Math.abs(h * Math.cos(radians));
    const rotatedX = x - (rotatedW - w) / 2;
    const rotatedY = y - (rotatedH - h) / 2;
    return {x:rotatedX, y:rotatedY, w:rotatedW, h:rotatedH, right:rotatedX + rotatedW, bottom:rotatedY + rotatedH};
  }

  function isFullCanvas(layer, rawFormat) {
    const f = format(rawFormat), box = bounds(layer);
    return /^(svgraw|img|shot)$/.test(layer.type || '') && Math.abs(number(layer.x, 0)) <= 3 && Math.abs(number(layer.y, 0)) <= 3 &&
      number(layer.w, 0) >= f.w * .94 && box.h >= f.h * .90;
  }

  function scaleLayer(layer, scale, offsetX, offsetY) {
    const next = Object.assign({}, layer);
    const originalWidth = Math.max(1, number(layer.w, 200));
    const originalHeight = layerHeight(layer);
    next.x = round(offsetX + number(layer.x, 0) * scale);
    next.y = round(offsetY + number(layer.y, 0) * scale);
    next.w = round(Math.max(24, originalWidth * scale));
    if (layer.type === 'text') next.size = round(Math.max(12, number(layer.size, 60) * scale));
    else if (next.w > originalWidth * scale + .01) next.ar = round((originalHeight * scale) / next.w);
    return next;
  }

  function fitLayerInside(layer, rawFormat, padding) {
    const f = format(rawFormat), inset = Math.max(0, number(padding, 0));
    const next = Object.assign({}, layer);
    if (isFullCanvas(next, f)) {
      next.x = 0; next.y = 0; next.w = f.w; next.ar = f.h / f.w;
      return next;
    }

    next.x = number(next.x, 0); next.y = number(next.y, 0);
    next.w = Math.max(24, number(next.w, 200));
    if (next.type === 'text') next.size = Math.max(12, number(next.size, 60));

    let box = bounds(next);
    const availableW = Math.max(24, f.w - inset * 2), availableH = Math.max(24, f.h - inset * 2);
    const fitScale = Math.min(1, availableW / Math.max(1, box.w), availableH / Math.max(1, box.h));
    if (fitScale < 1) {
      const previousHeight=layerHeight(next),desiredWidth=next.w*fitScale;
      next.w = Math.max(24, desiredWidth);
      if (next.type === 'text') next.size = Math.max(12, next.size * fitScale);
      else if(next.w>desiredWidth+.01) next.ar=(previousHeight*fitScale)/next.w;
      box = bounds(next);
    }

    if (box.x < inset) next.x += inset - box.x;
    if (box.right > f.w - inset) next.x -= box.right - (f.w - inset);
    if (box.y < inset) next.y += inset - box.y;
    if (box.bottom > f.h - inset) next.y -= box.bottom - (f.h - inset);
    next.x = round(next.x); next.y = round(next.y); next.w = round(next.w);
    if (next.type === 'text') next.size = round(next.size);
    return next;
  }

  function normalizeComposition(layers, rawFormat, options) {
    const opts = options || {}, f = format(rawFormat);
    return (Array.isArray(layers) ? layers : []).map(layer => fitLayerInside(layer, f, opts.padding || 0));
  }

  function reflowComposition(layers, rawFrom, rawTo, options) {
    const from = format(rawFrom), to = format(rawTo), opts = options || {};
    const scale = Math.min(to.w / Math.max(1, from.w), to.h / Math.max(1, from.h));
    const offsetX = (to.w - from.w * scale) / 2;
    const offsetY = (to.h - from.h * scale) / 2;
    const transformed = (Array.isArray(layers) ? layers : []).map(layer => {
      if (isFullCanvas(layer, from)) {
        const background = Object.assign({}, layer, {x:0, y:0, w:to.w, ar:to.h / to.w});
        return background;
      }
      return scaleLayer(layer, scale, offsetX, offsetY);
    });
    return normalizeComposition(transformed, to, opts);
  }

  function auditComposition(layers, rawFormat, options) {
    const f = format(rawFormat), tolerance = number(options && options.tolerance, 1.5);
    const errors = [];
    (Array.isArray(layers) ? layers : []).forEach((layer, index) => {
      const numeric = ['x','y','w'].concat(layer.type === 'text' ? ['size'] : []);
      numeric.forEach(key => {
        if (!Number.isFinite(+layer[key])) errors.push({index, code:'non-finite-'+key});
      });
      const box = bounds(layer);
      if (box.x < -tolerance || box.y < -tolerance || box.right > f.w + tolerance || box.bottom > f.h + tolerance) {
        errors.push({index, code:'out-of-bounds', box:{x:round(box.x),y:round(box.y),right:round(box.right),bottom:round(box.bottom)}, format:f.id});
      }
    });
    return {ok:errors.length === 0, errors, format:f, layers:Array.isArray(layers) ? layers.length : 0};
  }

  root.CMVNG_BUILDER_GEOMETRY_V6 = {
    version:'6.0.0', FORMATS, format, bounds, layerHeight, isFullCanvas,
    normalizeComposition, reflowComposition, auditComposition
  };
})(typeof window !== 'undefined' ? window : globalThis);
