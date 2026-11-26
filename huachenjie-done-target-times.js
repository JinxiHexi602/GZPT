/************************************************************
 * 华辰杰 run-front · 自定义 doneTargetTimes / donePercent
 * 接口：POST https://api.huachenjie.com/run-front/run/querySunRunAbstractInfoV2
 *
 * 参数来自插件 [Argument]（图形化）：$argument 是对象，如
 *   { doneTargetTimes: 99, donePercent: 100, debug: false }
 * 也兼容手动字符串写法：argument=doneTargetTimes=99&donePercent=100
 *
 * 规则：
 *   - 只改传入的字段；某个字段填 -1（或 keep/off）表示这项不改
 *   - 参数整体为空时用内置默认值 99 / 100
 *   - 保留原值类型：3 -> 99，"87%" -> "100%"，0.85 -> 0.99
 *   - debug 打开后把改前/改后的完整 JSON 打进 Loon 日志
 ************************************************************/

var DEFAULTS = { doneTargetTimes: 99, donePercent: 100 };
var RESERVED = { debug: 1, mode: 1, enabled: 1 };

function readArgs() {
  var map = {};
  if (typeof $argument === 'undefined' || $argument === null) return map;

  if (typeof $argument === 'object') {
    Object.keys($argument).forEach(function (k) { map[k] = $argument[k]; });
    return map;
  }

  String($argument).split('&').forEach(function (kv) {
    if (!kv) return;
    var i = kv.indexOf('=');
    if (i < 0) { map[kv.trim()] = ''; return; }
    map[kv.slice(0, i).trim()] = kv.slice(i + 1).trim();
  });
  return map;
}

var MAP = readArgs();

var RULES = (function () {
  var list = [];
  var given = false;

  Object.keys(MAP).forEach(function (k) {
    if (RESERVED[k]) return;
    given = true;

    var v = MAP[k];
    if (v === null || typeof v === 'undefined') return;

    if (typeof v === 'string') {
      v = v.trim();
      if (v === '' || v === 'keep' || v === 'off') return;
      var n = Number(v);
      if (!isNaN(n)) v = n;
    }

    if (typeof v === 'number' && v === -1) return;

    list.push({ key: k, value: v });
  });

  if (!given) {
    Object.keys(DEFAULTS).forEach(function (k) {
      list.push({ key: k, value: DEFAULTS[k] });
    });
  }
  return list;
})();

var DEBUG = MAP.debug === true || MAP.debug === 1 || MAP.debug === '1' || MAP.debug === 'true';
var MODE = String(MAP.mode || 'response').toLowerCase();
var DISABLED = MAP.enabled === false || MAP.enabled === 'false';

function log(msg) {
  console.log('[doneTargetTimes] ' + msg);
}

/* 保持原值类型：数字给数字，"3" 给 "99"，"87%" 给 "100%" */
function coerce(original, value) {
  if (typeof original === 'number') return value;
  if (typeof original === 'string') {
    if (/^\s*-?\d+(\.\d+)?\s*$/.test(original)) return String(value);
    return original.replace(/-?\d+(\.\d+)?/, String(value));
  }
  return value;
}

/* 深搜整个 JSON，把所有同名 key 都改掉，返回命中次数 */
function rewrite(node, key, value) {
  var hits = 0;
  (function walk(o) {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o)) {
      for (var i = 0; i < o.length; i++) walk(o[i]);
      return;
    }
    Object.keys(o).forEach(function (k) {
      if (k === key) {
        o[k] = coerce(o[k], value);
        hits++;
      } else {
        walk(o[k]);
      }
    });
  })(node);
  return hits;
}

function handle(body) {
  if (typeof body !== 'string' || body === '') {
    log('body 为空，检查 [Script] 里的 requires-body=1');
    $done({});
    return;
  }

  if (!RULES.length) {
    log('没有任何要改的字段（都填了 -1 / keep），原样放行');
    $done({});
    return;
  }

  var obj;
  try {
    obj = JSON.parse(body);
  } catch (e) {
    log('body 不是 JSON，原样放行：' + e);
    $done({});
    return;
  }

  if (DEBUG) log('before: ' + body);

  var total = 0;
  var report = RULES.map(function (r) {
    var hits = rewrite(obj, r.key, r.value);
    total += hits;
    return r.key + '=' + r.value + ' (' + hits + ')';
  });

  if (!total) {
    log('没有命中任何字段：' + report.join(', ') + '；打开「调试日志」看完整 body');
    $done({});
    return;
  }

  var out = JSON.stringify(obj);
  if (DEBUG) log('after: ' + out);
  log(report.join('; '));
  $done({ body: out });
}

if (DISABLED) {
  $done({});
} else if (MODE === 'request') {
  if (typeof $request !== 'undefined' && $request) handle($request.body);
  else $done({});
} else {
  if (typeof $response !== 'undefined' && $response) handle($response.body);
  else $done({});
}
