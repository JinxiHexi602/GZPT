/************************************************************
 * 华辰杰 run-front · 自定义 doneTargetTimes
 * 目标接口：POST https://api.huachenjie.com/run-front/run/querySunRunAbstractInfoV2
 *
 * 抓包里的 body 被隐藏了，所以这里用「深搜同名 key」的方式改，
 * 不管 doneTargetTimes 在 data 里、在数组元素里还是嵌套几层，都能命中。
 *
 * Loon [Script] 的 argument= 可用参数：
 *   doneTargetTimes=99   要改成多少，默认 99
 *   key=doneTargetTimes  要改的字段名（想改别的同构字段时用）
 *   mode=response        改响应（默认）；mode=request 改请求体
 *   debug=1              把改动前后的完整 JSON 打到 Loon 日志，用来确认真实字段
 *
 * 例：argument=doneTargetTimes=12&debug=1
 ************************************************************/

var CFG = (function () {
  var raw = (typeof $argument !== 'undefined' && $argument) ? String($argument) : '';
  var map = {};
  raw.split('&').forEach(function (kv) {
    if (!kv) return;
    var i = kv.indexOf('=');
    if (i < 0) { map[kv.trim()] = ''; return; }
    map[kv.slice(0, i).trim()] = kv.slice(i + 1).trim();
  });

  var value = Number(map.doneTargetTimes || map.value);
  if (isNaN(value)) value = 99;

  return {
    key: map.key || 'doneTargetTimes',
    value: value,
    mode: (map.mode || 'response').toLowerCase(),
    debug: map.debug === '1' || map.debug === 'true'
  };
})();

function log(msg) {
  console.log('[doneTargetTimes] ' + msg);
}

/* 保持原值类型：原来是数字就给数字，原来是 "3" 就给 "99"，是 "3次" 就保留单位 */
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

  var obj;
  try {
    obj = JSON.parse(body);
  } catch (e) {
    log('body 不是 JSON，原样放行：' + e);
    $done({});
    return;
  }

  if (CFG.debug) log('before: ' + body);

  var hits = rewrite(obj, CFG.key, CFG.value);
  if (hits === 0) {
    log('没有找到 ' + CFG.key + '，原样放行；加 debug=1 看完整 body');
    $done({});
    return;
  }

  var out = JSON.stringify(obj);
  if (CFG.debug) log('hits=' + hits + ' after: ' + out);
  else log('hits=' + hits + ' -> ' + CFG.value);

  $done({ body: out });
}

if (CFG.mode === 'request') {
  if (typeof $request !== 'undefined' && $request) handle($request.body);
  else $done({});
} else {
  if (typeof $response !== 'undefined' && $response) handle($response.body);
  else $done({});
}
