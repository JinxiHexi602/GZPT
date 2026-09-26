(function () {
"use strict";

var FAKE_L = "00000000-0000-4000-8000-000000000001";
var FAKE_P = "00000000-0000-4000-8000-000000000002";
var NOSHELL = "00000000-0000-4000-9000-0000000000ff";
var FB_L = NOSHELL;
var FB_P = "00000000-0000-4000-9000-0000000000fe";
var STORE = "ydxy_ref_record";
var MARK = "loonFakeLeave";

try {
  var c = (function () {
    try {
      var o = JSON.parse($persistentStore.read(STORE) || "{}");
      return { l: String(o.l || ""), p: String(o.p || "") };
    } catch (e) { return { l: "", p: "" }; }
  })();
  if (!c.l && FB_L !== NOSHELL) c = { l: FB_L, p: FB_P };

  var u = ($request && $request.url) || "";
  if (u.indexOf(FAKE_L) === -1 && u.indexOf(FAKE_P) === -1) return $done({});
  if (!c.l) return $done({});

  var o2 = u.split(FAKE_L).join(c.l);
  if (c.p) o2 = o2.split(FAKE_P).join(c.p);
  if (o2.indexOf(MARK + "=1") === -1) o2 += (o2.indexOf("?") !== -1 ? "&" : "?") + MARK + "=1";
  $done({ url: o2 });
} catch (e) { $done({}); }

})();
