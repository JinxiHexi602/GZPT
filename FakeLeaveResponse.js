(function () {
"use strict";

var LCID = "61c48fff-73b8-47d7-b3ca-01ace5fd9a5b";
var FAKE_L = "00000000-0000-4000-8000-000000000001";
var FAKE_P = "00000000-0000-4000-8000-000000000002";
var NOSHELL = "00000000-0000-4000-9000-0000000000ff";
var FB_L = NOSHELL;
var FB_P = "00000000-0000-4000-9000-0000000000fe";
var STORE = "ydxy_ref_record";
var TITLE = "学生请假申请";
var NODE = "审核通过";
var MARK = "loonFakeLeave";
var SEC = "21";
var DICT_T = { "病假": "1", "事假": "2", "探亲假": "3", "丧假": "4", "婚假": "5", "其它": "9" };
var DICT_F = { "不离校": "0", "离校不离市": "1", "离市": "2" };
var HOST = "https://ydxy.gzpt.edu.cn:6870/ydxg/";
var U_LIST = HOST + "api/sm-mobile/processCenter/queryBpmApplyedProcess";
var U_PARA = HOST + "api/sm-bpm-expansion/processdefine/getProcessFormParams";
var U_FORM = HOST + "bpm/rest/processes/tasks/form/json";
var U_REV = /\/api\/sm-bpm-expansion\/processdefine\/[^/?]+\/getReviewInfo/;
var U_HOL = /\/api\/sm-holiday\/openapi\/getXsqjsqByPkid\//;

var DEF = { leaveType: "事假", leaveFrom: "离校不离市", reason: "回家" };
var A = (typeof $argument === "undefined" || !$argument) ? {} : $argument;
var RL = "", RP = "";

function d(n, dv) {
  var v = A[n];
  v = (v === undefined || v === null) ? "" : String(v).trim();
  return v.length ? v : (dv === undefined ? DEF[n] : dv);
}
function p2(v) { v = String(v); return v.length < 2 ? "0" + v : v; }
function today() {
  var n = new Date();
  return n.getFullYear() + "-" + p2(n.getMonth() + 1) + "-" + p2(n.getDate());
}

function hm(s) {
  s = String(s).trim();
  var m = /^(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{2})/.exec(s);
  if (m) return m[1] + "-" + p2(m[2]) + "-" + p2(m[3]) + " " + p2(m[4]) + ":" + m[5];
  m = /^(\d{1,2}):(\d{2})$/.exec(s);
  return m ? today() + " " + p2(m[1]) + ":" + m[2] : s;
}
function ep(s) {
  var t = hm(s).split(/[- :]/);
  return t.length === 5 ? Date.UTC(+t[0], +t[1] - 1, +t[2], +t[3], +t[4]) : null;
}
function fmt(ms) {
  var x = new Date(ms);
  return x.getUTCFullYear() + "-" + p2(x.getUTCMonth() + 1) + "-" + p2(x.getUTCDate()) +
         " " + p2(x.getUTCHours()) + ":" + p2(x.getUTCMinutes());
}
function dur(a, b) {
  var x = ep(a), y = ep(b);
  if (x === null || y === null || y < x) return { d: 0, h: 0, m: 0 };
  var n = Math.floor((y - x) / 60000);
  return { d: Math.floor(n / 1440), h: Math.floor(n % 1440 / 60), m: n % 60 };
}
function cfg() {
  var y = today();
  var s = hm(d("leaveStart", y + " 17:30")), e = hm(d("leaveEnd", y + " 19:30")), t = ep(s);
  return {
    s: s, e: e, u: dur(s, e),
    sn: t === null ? "" : fmt(t).replace(/\D/g, ""),
    ap: t === null ? s : fmt(t - 48 * 60000),
    at: t === null ? e : fmt(t - 24 * 60000),
    tn: d("leaveType"), fn: d("leaveFrom")
  };
}

function cache() {
  try {
    var o = JSON.parse($persistentStore.read(STORE) || "{}");
    return { l: String(o.l || ""), p: String(o.p || "") };
  } catch (e) { return { l: "", p: "" }; }
}
function put(c) {
  try { $persistentStore.write(JSON.stringify({ l: c.l || "", p: c.p || "" }), STORE); } catch (e) {}
}
function ref() {
  var c = cache();
  if (c.l) return c;
  if (FB_L !== NOSHELL) return { l: FB_L, p: FB_P };
  return { l: "", p: "" };
}

function learnList(list) {
  var c = cache(), cand = "", seen = false;
  for (var i = 0; i < list.length; i++) {
    var x = list[i];
    if (!x || x.lcid !== LCID || !x.lcsqid || x.lcsqid === FAKE_L) continue;
    if (x.lcsqid === c.l) seen = true;
    if (!cand) cand = x.lcsqid;
  }
  if (cand && !(c.l && seen)) put({ l: cand, p: "" });
}
function learnPkid(p) {
  if (!p || !p.lcsqid || !p.stsqzjid) return;
  if (p.lcsqid === FAKE_L || p.stsqzjid === FAKE_P) return;
  var c = cache();
  if (c.l !== p.lcsqid || c.p !== p.stsqzjid) put({ l: p.lcsqid, p: p.stsqzjid });
}

function fake(u) { return u.indexOf(MARK + "=1") !== -1 || u.indexOf(FAKE_L) !== -1 || u.indexOf(FAKE_P) !== -1; }
function isDetail(u) {
  return u.indexOf(U_PARA) === 0 || u.indexOf(U_FORM) === 0 || U_REV.test(u) || U_HOL.test(u);
}
function names(s) {
  var out = ["", ""], k = 0;
  try {
    var a = JSON.parse(s || "[]");
    for (var i = 0; i < a.length && k < 2; i++) {
      var u = a[i] && a[i].users && a[i].users[0];
      if (u && u.userName) out[k++] = u.userName;
    }
  } catch (e) {}
  return out;
}

function patchParams(j, c) {
  var p = j && j.data && j.data.processApplyInfo;
  if (p) {
    p.sqsj = c.ap; p.jbsj = c.at;
    p.lcsqid = FAKE_L; p.stsqzjid = FAKE_P; p.spzt = "2";
  }
  return j;
}
function patchForm(j, c) {
  var x = j && j.data;
  if (!x) return j;
  var nm = names(x.nodesFlowConfig);
  x.docCreated = c.ap; x.lastModified = c.at; x.endTime = c.at;
  x.serialNum = c.sn; x.subject = TITLE;
  x.nodesFlowConfig = JSON.stringify([
    { nodeName: "开始", nodeStatus: "noStart", nodeId: "E10001" },
    { nodeName: "申请", nodeStatus: "End", nodeId: "T10001", users: [{ endTime: c.ap, userName: nm[0], userId: "0" }] },
    { nodeName: "班主任审核", nodeStatus: "End", nodeId: "T10002", users: [{ endTime: c.at, userName: nm[1], userId: "0" }] },
    { nodeName: "结束", nodeStatus: "noStart", nodeId: "E10002" }
  ]);
  x.leaveDays = String(c.u.d); x.leaveHours = String(c.u.h);
  x.leaveMinute = String(c.u.m); x.totalTime = String(c.u.d);
  x.qjlxm = DICT_T[c.tn] || "9"; x.qjqx = DICT_F[c.fn] || "0";
  x.orunid = FAKE_L;
  return j;
}
function patchReview(j, c) {
  if (!Array.isArray(j && j.data)) return j;
  var first = 1;
  for (var i = 0; i < j.data.length; i++) {
    var x = j.data[i];
    if (!x) continue;
    if (x.DOCUNID) x.DOCUNID = FAKE_L;
    if (x.ENDTIME) x.ENDTIME = (x.NODEID === "T10001" || first) ? c.ap : c.at;
    if (x.REMARK) x.REMARK = "同意";
    if (x.NODEID) first = 0;
  }
  return j;
}
function patchLeave(j, c) {
  var x = j && j.data;
  if (!x) return j;
  x.QJLXM = DICT_T[c.tn] || "9"; x.QJLXMC = c.tn;
  x.SFXYLX = DICT_F[c.fn] || "0"; x.SFXYLXMC = c.fn;
  x.QJKSSJ = x.QJKSSJSTR = c.s; x.QJJSSJ = x.QJJSSJSTR = c.e;
  x.QJSCT = c.u.d; x.QJSCXS = c.u.h; x.QJSCFZ = c.u.m;
  x.QJLY = d("reason"); x.QJSQSJ = x.QJSQSJSTR = c.ap;
  return j;
}

function detail(u, raw) {
  if (!fake(u)) return null;
  var r = ref();
  RL = r.l; RP = r.p;
  if (!RL) return null;
  if (u.indexOf(U_PARA) === 0) { try { learnPkid(JSON.parse(raw).data.processApplyInfo); } catch (e) {} }
  var sw = raw, j;
  if (RL) sw = sw.split(RL).join(FAKE_L);
  if (RP) sw = sw.split(RP).join(FAKE_P);
  try { j = JSON.parse(sw); } catch (e) { return null; }
  if (!j) return null;
  var before = JSON.stringify(j), c = cfg();
  if (u.indexOf(U_PARA) === 0) j = patchParams(j, c);
  else if (u.indexOf(U_FORM) === 0) j = patchForm(j, c);
  else if (U_REV.test(u)) j = patchReview(j, c);
  else if (U_HOL.test(u)) j = patchLeave(j, c);
  else return null;
  var after = JSON.stringify(j);
  return (after === before && sw === raw) ? null : after;
}

function inject(raw, c) {
  function q(n) {
    var m = ($request.url || "").match(new RegExp("[?&]" + n + "=([^&#]*)"));
    return m ? decodeURIComponent(m[1]) : null;
  }
  var pn = q("pageNum");
  if ((pn !== null && pn !== "" && pn !== "1") || q("keyword")) return null;
  var j;
  try { j = JSON.parse(raw); } catch (e) { return null; }
  if (!j || j.code !== 200 || !j.data || !Array.isArray(j.data.list)) return null;
  learnList(j.data.list);
  for (var i = 0; i < j.data.list.length; i++) {
    if (j.data.list[i] && j.data.list[i].lcsqid === FAKE_L) return null;
  }
  j.data.list.unshift({
    lcmc: TITLE, sqsj: c.ap + ":" + SEC, dqjd: NODE, lcid: LCID,
    lcsqid: FAKE_L, bdsjfsdm: "01", sqrbh: "", sfksc: "0"
  });
  if (typeof j.data.total === "number") j.data.total += 1;
  return JSON.stringify(j);
}

try {
  var u = ($request && $request.url) || "", raw = $response.body;
  if ($response.status !== 200 || !raw) return $done({});
  if (u.indexOf(U_LIST) === 0) {
    var o = inject(raw, cfg());
    return o ? $done({ body: o }) : $done({});
  }
  if (!isDetail(u)) return $done({});
  var p = detail(u, raw);
  $done(p ? { body: p } : {});
} catch (e) { $done({}); }

})();
