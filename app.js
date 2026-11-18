'use strict';
/* Café Shift Board — 1日分の作業表（USD）。データはブラウザ（localStorage）に自動保存されます */
const KEY = 'cafemgr.v1', $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const usd = v => '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const uid = () => Math.random().toString(36).slice(2, 9);

const initial = () => ({
  open: 8, close: 20,
  roles: [{ id: 'r1', name: 'バリスタ', color: '#8a5a3c', tasks: [{ id: 't1', name: 'ドリンク作成' }] }, { id: 'r2', name: 'ウェイター', color: '#3f7fb5', tasks: [{ id: 't2', name: 'レジ' }, { id: 't3', name: '注文を取る' }, { id: 't4', name: '配膳' }] }, { id: 'r3', name: 'キッチン', color: '#b4474f', tasks: [{ id: 't5', name: '調理' }, { id: 't6', name: '洗い場' }] }],
  emps: [
    { id: 'e1', name: 'Emma', role: 'r1', wage: 12, slots: [{ from: 8, to: 12 }, { from: 13, to: 16 }] },
    { id: 'e2', name: 'Liam', role: 'r2', wage: 10, slots: [{ from: 10, to: 18 }] },
    { id: 'e3', name: 'Mia', role: 'r3', wage: 9.5, slots: [{ from: 12, to: 14 }, { from: 15, to: 20 }] }
  ],
  sched: {}, tasks: {}, sales: {}
});
let S; try { S = JSON.parse(localStorage.getItem(KEY)); } catch (e) { /* 初回・破損時は初期化 */ }
if (!S || !Array.isArray(S.emps)) S = initial();
S.tasks = S.tasks || {}; S.sort = S.sort || { key: 'manual', desc: false }; S.roles.forEach(r => { r.tasks = r.tasks || []; }); S.emps.forEach(e => { e.off = e.off || []; });   // off＝そのスタッフが「できない」仕事のID   // 役割の中の仕事（上ほど優先）
const PAL = ['#8a6bb5', '#d08a1f', '#2f9aa8', '#c4552b'];
S.emps.forEach(e => { if (!Array.isArray(e.slots)) { e.slots = [{ from: e.from ?? S.open, to: e.to ?? S.close }]; delete e.from; delete e.to; } });   // 旧データ（時間帯1つ）を移行
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* 保存できない環境 */ } };

const hrs = () => Array.from({ length: S.close - S.open }, (_, i) => S.open + i);
const role = id => S.roles.find(r => r.id === id) || S.roles[0] || { name: '—', color: '#8a7463' };
const onH = e => (S.sched[e.id] || []).filter(h => h >= S.open && h < S.close);
const taskRole = id => S.roles.find(r => r.tasks.some(t => t.id === id));
const taskName = id => { for (const r of S.roles) { const t = r.tasks.find(x => x.id === id); if (t) return t.name; } return ''; };
const can = (e, id) => { const tr = taskRole(id); return !!tr && tr.id === e.role && !e.off.includes(id); };   // その人が、その仕事をできるか
/* ---- 従業員の並び替え（作業表とスタッフ一覧の両方に使う） ---- */
const SORTS = { manual: '登録順（手動）', role: '役割順', name: '名前（あいうえお）', wage: '時給', start: '出勤できる時間の早さ' };
const SORT_VAL = { role: e => Math.max(0, S.roles.findIndex(r => r.id === e.role)), name: e => e.name, wage: e => e.wage, start: e => Math.min(...e.slots.map(s => s.from)) };
function sortedEmps() {
  const { key, desc } = S.sort, f = SORT_VAL[key], a = S.emps.map((e, i) => ({ e, i, v: f ? f(e) : i }));
  a.sort((x, y) => { let c = typeof x.v === 'string' ? x.v.localeCompare(y.v, 'ja') : x.v - y.v; if (desc) c = -c; return c || x.i - y.i; });
  return a.map(x => x.e);
}
function renderSort() {
  if (!SORTS[S.sort.key]) S.sort = { key: 'manual', desc: false };
  document.querySelectorAll('.sortsel').forEach(s => { s.innerHTML = Object.entries(SORTS).map(([k, v]) => `<option value="${k}"${k === S.sort.key ? ' selected' : ''}>${v}</option>`).join(''); });
  document.querySelectorAll('.sortdir').forEach(b => { b.textContent = S.sort.desc ? '▼ 降順' : '▲ 昇順'; b.disabled = S.sort.key === 'manual'; });
}
document.addEventListener('change', ev => {
  if (!ev.target.classList.contains('sortsel')) return;
  S.sort = { key: ev.target.value, desc: false }; save(); renderSort(); renderGrid(); renderEmps();
});
document.addEventListener('click', ev => {
  if (!ev.target.classList.contains('sortdir')) return;
  S.sort.desc = !S.sort.desc; save(); renderSort(); renderGrid(); renderEmps();
});
const inSlots = (e, h) => e.slots.some(s => h >= s.from && h < s.to);
const lab = h => (h % 24) + ':00';
const opts = (a, b, v) => { let o = ''; for (let h = a; h <= b; h++) o += `<option value="${h}"${h === v ? ' selected' : ''}>${lab(h)}</option>`; return o; };

/* ---- 描画 ---- */
function renderStats() {
  let hours = 0, cost = 0;
  S.emps.forEach(e => { const n = onH(e).length; hours += n; cost += n * e.wage; });
  const sales = hrs().reduce((a, h) => a + (+S.sales[h] || 0), 0), profit = sales - cost, pct = sales > 0 ? (cost / sales * 100).toFixed(1) + '%' : '—';
  $('#stats').innerHTML = [
    ['総労働時間', hours + ' 時間', ''], ['人件費', usd(cost), ''], ['売上', usd(sales), ''], ['人件費率', pct, ''],
    ['利益（売上 − 人件費）', usd(profit), sales > 0 ? (profit >= 0 ? 'good' : 'bad') : '']
  ].map(([a, b, c]) => `<div class="stat ${c}"><span>${a}</span><b>${b}</b></div>`).join('');
}
const cellLabel = (e, r, h) => { const id = (S.tasks[e.id] || {})[h], tn = id && can(e, id) ? taskName(id) : ''; return (tn || r.name).slice(0, 4); };
function renderGrid() {
  const H = hrs();
  if (!S.emps.length) { $('#grid').innerHTML = '<div class="empty">スタッフがまだいません。下の「＋ スタッフを追加」から登録してください。</div>'; renderStats(); return; }
  let t = '<table><thead><tr><th class="n"></th>' + H.map(h => `<th>${lab(h)}</th>`).join('') + '</tr></thead><tbody>';
  sortedEmps().forEach(e => {
    const r = role(e.role), on = new Set(onH(e)), n = on.size;
    t += `<tr><th class="n"><b>${esc(e.name)}</b><i>${esc(r.name)}・${n}h・${usd(n * e.wage)}</i></th>`;
    H.forEach(h => {
      const av = inSlots(e, h);
      t += `<td class="c ${on.has(h) ? 'on' : av ? 'av' : 'no'}" style="--rc:${r.color}" data-e="${e.id}" data-h="${h}">${on.has(h) ? esc(cellLabel(e, r, h)) : ''}</td>`;
    });
    t += '</tr>';
  });
  t += '</tbody><tfoot><tr><th class="n">配置人数</th>' + H.map(h => { const c = S.emps.filter(e => onH(e).includes(h)).length; return `<td class="${c === 0 ? 'low' : ''}">${c}</td>`; }).join('') + '</tr>' +
    '<tr><th class="n">売上（USD）</th>' + H.map(h => `<td><input type="number" min="0" step="any" data-s="${h}" value="${S.sales[h] ?? ''}" aria-label="${lab(h)}の売上"></td>`).join('') + '</tr></tfoot></table>';
  $('#grid').innerHTML = t; renderStats();
}
let brush = '';   // 塗る内容：''＝役割だけ ／ 仕事のID
function renderLegend() {
  if (brush && !taskRole(brush)) brush = '';
  $('#legend').innerHTML = S.roles.map(r => `<span><i style="background:${r.color}"></i>${esc(r.name)}</span>`).join('') +
    '<span><i style="background:var(--hatch)"></i>希望時間の外</span><span>薄い色＝希望時間の中（クリック・ドラッグで塗る）</span>';
  $('#palette').innerHTML = '<span class="sl-title">塗る内容</span>' + `<button class="chip${brush === '' ? ' act' : ''}" data-b="">役割だけ</button>` +
    S.roles.filter(r => r.tasks.length).map(r => `<span class="pgrp"><i style="background:${r.color}"></i>${esc(r.name)}` +
      r.tasks.map((t, i) => `<button class="chip${brush === t.id ? ' act' : ''}" data-b="${t.id}" style="--rc:${r.color}"><b>${i + 1}</b>${esc(t.name)}</button>`).join('') + '</span>').join('');
}
$('#palette').addEventListener('click', ev => { const b = ev.target.closest('[data-b]'); if (!b) return; brush = b.dataset.b; renderLegend(); });
function renderEmps() {
  const ro = S.roles.map(r => `<option value="${r.id}">${esc(r.name)}</option>`).join('');
  $('#emps').innerHTML = S.emps.length ? sortedEmps().map(e => `<div class="emp" data-id="${e.id}">
    <div class="emp-top">
      <label>名前<input data-k="name" value="${esc(e.name)}"></label>
      <label>役割<select data-k="role">${ro.replace(`value="${e.role}"`, `value="${e.role}" selected`)}</select></label>
      <label>時給 (USD)<input data-k="wage" type="number" min="0" step="any" value="${e.wage}"></label>
      <span class="ops">${S.sort.key === 'manual' ? '<button class="x" data-mv="-1" aria-label="上へ">▲</button><button class="x" data-mv="1" aria-label="下へ">▼</button>' : ''}<button class="x" data-del="${e.id}">削除</button></span>
    </div>
    <div class="slots"><span class="sl-title">勤務できる時間</span>
      ${e.slots.map((s, i) => `<div class="slot" data-i="${i}">
        <label>開始<select data-k="from">${opts(S.open, S.close - 1, s.from)}</select></label><span class="to">〜</span>
        <label>終了<select data-k="to">${opts(S.open + 1, S.close, s.to)}</select></label>
        <button class="x" data-sdel="${i}" aria-label="この時間を削除">削除</button></div>`).join('')}
      <button class="x add-slot" data-sadd="${e.id}">＋ 追加</button>
    </div>
    <div class="slots"><span class="sl-title">できる仕事（${esc(role(e.role).name)}の中から選ぶ）</span>
      <div class="chips">${role(e.role).tasks.length ? role(e.role).tasks.map((t, i) => `<button class="chip${e.off.includes(t.id) ? '' : ' act'}" style="--rc:${role(e.role).color}" data-tk="${t.id}" aria-pressed="${!e.off.includes(t.id)}"><b>${i + 1}</b>${esc(t.name)}</button>`).join('') : '<span class="meta">この役割には、まだ仕事がありません。下の「役割と、その中の仕事」で追加できます。</span>'}</div>
    </div></div>`).join('') : '<div class="empty">まだ登録がありません。</div>';
}
function renderRoles() {
  $('#roles').innerHTML = S.roles.map(r => `<div class="rblock" data-id="${r.id}">
    <div class="rrow"><input type="color" data-k="color" value="${r.color}" aria-label="色"><input data-k="name" value="${esc(r.name)}" aria-label="役割名"><button class="x" data-rdel="1">削除</button></div>
    <div class="tasks"><span class="sl-title">この役割の中の仕事（上ほど優先）</span>
      ${r.tasks.map((t, i) => `<div class="trow" data-t="${t.id}"><b class="pri">${i + 1}</b><input value="${esc(t.name)}" aria-label="仕事名">
        <button class="x" data-tup="${t.id}"${i === 0 ? ' disabled' : ''} aria-label="優先度を上げる">▲</button><button class="x" data-tdn="${t.id}"${i === r.tasks.length - 1 ? ' disabled' : ''} aria-label="優先度を下げる">▼</button><button class="x" data-tdel="${t.id}">削除</button></div>`).join('')}
      <button class="x add-slot" data-tadd="1">＋ 仕事を追加</button></div></div>`).join('');
}
function renderRange() { $('#open').innerHTML = opts(0, S.close - 1, S.open); $('#close').innerHTML = opts(S.open + 1, 28, S.close); }
function renderAll() { renderSort(); renderRange(); renderGrid(); renderLegend(); renderEmps(); renderRoles(); }

/* ---- 作業表を塗る（クリック・ドラッグ） ---- */
let paint = null;
const brushFor = e => (brush && can(e, brush)) ? brush : '';   // 選んだ仕事は、それができる人にだけ付く
const apply = td => {
  const e = S.emps.find(x => x.id === td.dataset.e), h = +td.dataset.h, a = S.sched[e.id] = S.sched[e.id] || [], T = S.tasks[e.id] = S.tasks[e.id] || {}, i = a.indexOf(h), tk = brushFor(e);
  if (paint === 'add') { if (i < 0) { a.push(h); delete T[h]; } if (tk) T[h] = tk; }
  if (paint === 'del' && i >= 0) { a.splice(i, 1); delete T[h]; }
};
$('#grid').addEventListener('mousedown', ev => {
  const td = ev.target.closest('td.c'); if (!td) return; ev.preventDefault();
  const e = S.emps.find(x => x.id === td.dataset.e), h = +td.dataset.h, on = (S.sched[e.id] || []).includes(h), cur = (S.tasks[e.id] || {})[h] || '';
  paint = (on && cur === brushFor(e)) ? 'del' : 'add'; apply(td);
});
$('#grid').addEventListener('mouseover', ev => { if (!paint) return; const td = ev.target.closest('td.c'); if (td && td.dataset.e) apply(td); });
document.addEventListener('mouseup', () => { if (paint) { paint = null; save(); renderGrid(); } });
$('#grid').addEventListener('change', ev => {
  const h = ev.target.dataset.s; if (h == null) return;
  const v = ev.target.value; if (v === '') delete S.sales[h]; else S.sales[h] = Math.max(0, +v || 0);
  save(); renderStats();
});

/* ---- スタッフ ---- */
$('#emps').addEventListener('change', ev => {
  const card = ev.target.closest('.emp'), k = ev.target.dataset.k; if (!card || !k) return;
  const e = S.emps.find(x => x.id === card.dataset.id), v = ev.target.value, slot = ev.target.closest('.slot');
  if (slot) {
    const s = e.slots[+slot.dataset.i]; s[k] = +v;
    if (s.to <= s.from) { if (k === 'from') s.to = Math.min(S.close, s.from + 1); else s.from = Math.max(S.open, s.to - 1); }
    save(); renderGrid(); renderEmps(); return;
  }
  if (k === 'wage') e.wage = Math.max(0, +v || 0); else e[k] = v;
  save(); renderGrid(); if (k === 'role') renderEmps();
});
$('#emps').addEventListener('click', ev => {
  const t = ev.target, card = t.closest('.emp'); if (!card) return;
  const e = S.emps.find(x => x.id === card.dataset.id);
  if (t.dataset.del) { S.emps = S.emps.filter(x => x !== e); delete S.sched[e.id]; }
  else if (t.dataset.sadd) {
    const last = e.slots.length ? Math.max(...e.slots.map(s => s.to)) : S.open, from = last < S.close ? last : S.open;
    e.slots.push({ from, to: Math.min(S.close, from + 4) });
  } else if (t.dataset.sdel != null) { if (e.slots.length <= 1) return; e.slots.splice(+t.dataset.sdel, 1); }
  else if (t.dataset.mv) { const i = S.emps.indexOf(e), j = i + +t.dataset.mv; if (j < 0 || j >= S.emps.length) return; [S.emps[i], S.emps[j]] = [S.emps[j], S.emps[i]]; }   // 手動の並べ替え
  else if (t.closest('[data-tk]')) {   // できる仕事の切り替え
    const id = t.closest('[data-tk]').dataset.tk, i = e.off.indexOf(id);
    if (i < 0) { e.off.push(id); const T = S.tasks[e.id] || {}; Object.keys(T).forEach(h => { if (T[h] === id) delete T[h]; }); } else e.off.splice(i, 1);
  } else return;
  save(); renderGrid(); renderEmps();
});
$('#addEmp').addEventListener('click', () => {
  S.emps.push({ id: uid(), name: 'New ' + (S.emps.length + 1), role: (S.roles[0] || {}).id, wage: 10, off: [], slots: [{ from: S.open, to: Math.min(S.close, S.open + 8) }] });
  save(); renderGrid(); renderEmps();
});

/* ---- 役割と、その中の仕事 ---- */
$('#roles').addEventListener('change', ev => {
  const blk = ev.target.closest('.rblock'); if (!blk) return;
  const r = S.roles.find(x => x.id === blk.dataset.id), tr = ev.target.closest('.trow');
  if (tr) { const t = r.tasks.find(x => x.id === tr.dataset.t); t.name = ev.target.value.trim() || t.name; }
  else { const k = ev.target.dataset.k; if (!k) return; r[k] = k === 'name' ? (ev.target.value.trim() || r.name) : ev.target.value; }
  save(); renderGrid(); renderLegend(); renderEmps(); renderRoles();
});
$('#roles').addEventListener('click', ev => {
  const d = ev.target.dataset, blk = ev.target.closest('.rblock'); if (!blk) return;
  const r = S.roles.find(x => x.id === blk.dataset.id);
  if (d.rdel) { if (S.roles.length <= 1) return; S.roles = S.roles.filter(x => x !== r); S.emps.forEach(e => { if (e.role === r.id) e.role = S.roles[0].id; }); }
  else if (d.tadd) r.tasks.push({ id: uid(), name: '新しい仕事' });
  else if (d.tdel) r.tasks = r.tasks.filter(t => t.id !== d.tdel);
  else if (d.tup || d.tdn) {   // 優先順位を入れ替える
    const id = d.tup || d.tdn, i = r.tasks.findIndex(t => t.id === id), j = d.tup ? i - 1 : i + 1;
    if (j < 0 || j >= r.tasks.length) return; [r.tasks[i], r.tasks[j]] = [r.tasks[j], r.tasks[i]];
  } else return;
  save(); renderAll();
});
$('#addRole').addEventListener('click', () => {
  S.roles.push({ id: uid(), name: '新しい役割', color: PAL[S.roles.length % PAL.length], tasks: [] }); save(); renderAll();
});

/* ---- 営業時間・一括操作 ---- */
function clampAll() {
  S.emps.forEach(e => {
    e.slots = e.slots.map(s => { const f = Math.max(S.open, Math.min(s.from, S.close - 1)); return { from: f, to: Math.max(f + 1, Math.min(s.to, S.close)) }; });
  });
  save(); renderAll();
}
$('#open').addEventListener('change', () => { S.open = +$('#open').value; clampAll(); });
$('#close').addEventListener('change', () => { S.close = +$('#close').value; clampAll(); });
$('#fill').addEventListener('click', () => { S.emps.forEach(e => { S.sched[e.id] = hrs().filter(h => inSlots(e, h)); }); save(); renderGrid(); });
$('#clear').addEventListener('click', () => { S.sched = {}; S.tasks = {}; save(); renderGrid(); });
$('#reset').addEventListener('click', () => { if (confirm('すべて初期状態に戻します。よろしいですか？')) { S = initial(); save(); renderAll(); } });

/* ---- 優先順位で仕事を自動割り当て ---- */
function toast(m) { const t = $('#toast'); t.textContent = m; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => { t.hidden = true; }, 3200); }
$('#auto').addEventListener('click', () => {
  S.roles.forEach(r => {
    if (!r.tasks.length) return;
    hrs().forEach(h => {
      const free = S.emps.filter(e => e.role === r.id && onH(e).includes(h));
      free.forEach(e => { delete (S.tasks[e.id] = S.tasks[e.id] || {})[h]; });
      r.tasks.forEach(t => {   // 優先度の高い仕事から、それができる人（できる仕事が少ない人を先に）へ1人ずつ
        const c = free.filter(e => can(e, t.id)).sort((x, y) => r.tasks.filter(q => can(x, q.id)).length - r.tasks.filter(q => can(y, q.id)).length)[0];
        if (c) { S.tasks[c.id][h] = t.id; free.splice(free.indexOf(c), 1); }
      });
    });
  });
  save(); renderGrid(); toast('優先順位の高い仕事から、できる人へ順に割り当てました');
});

/* ---- スタッフの一括登録 ---- */
const bulk = $('#bulk'), BULK_RX = /^(\d{1,2})(?::(\d{2}))?\s*[-〜~–ー－]\s*(\d{1,2})(?::(\d{2}))?$/;
$('#openBulk').addEventListener('click', () => { $('#bulkMsg').textContent = ''; bulk.showModal(); $('#bulkText').focus(); });
$('#bulkClose').addEventListener('click', () => bulk.close());
$('#bulkSample').addEventListener('click', () => { $('#bulkText').value = 'Emma,バリスタ,12,8:00-12:00; 13:00-16:00\nLiam,ウェイター,10,10:00-12:00; 15:00-19:00\nMia,キッチン,9.5,12:00-20:00'; $('#bulkMsg').textContent = ''; });
$('#bulkGo').addEventListener('click', () => {
  const addR = $('#bulkRoles').checked, rows = [], errs = [];
  $('#bulkText').value.split(/\r?\n/).forEach((line, i) => {
    if (!line.trim()) return;
    const c = (line.includes('\t') ? line.split('\t') : line.split(/[,，、]/)).map(x => x.trim());
    if (['名前', 'name'].includes(c[0].toLowerCase())) return;   // 見出し行は読み飛ばす
    const [name, rn = '', wg = ''] = c, tm = c.slice(3).join(';'), bad = [], slots = [];
    if (!name) bad.push('名前がありません');
    const wage = parseFloat(wg.replace(/[^\d.]/g, '')); if (!(wage >= 0)) bad.push('時給（USD）を数字で入れてください');
    if (rn && !addR && !S.roles.some(r => r.name === rn)) bad.push(`役割「${rn}」は未登録です`);
    tm.split(/[;；\/／|]/).map(x => x.trim()).filter(Boolean).forEach(seg => {
      const m = BULK_RX.exec(seg); if (!m) { bad.push(`「${seg}」を読み取れません`); return; }
      const f = Math.max(S.open, +m[1]), t = Math.min(S.close, +m[3] + (+m[4] > 0 ? 1 : 0));
      if (t <= f) bad.push(`「${seg}」は営業時間（${lab(S.open)}〜${lab(S.close)}）の外です`); else slots.push({ from: f, to: t });
    });
    if (!slots.length && !bad.length) bad.push('時間帯がありません');
    if (bad.length) errs.push(`${i + 1}行目：${bad.join('、')}`); else rows.push({ name, rn, wage, slots });
  });
  const msg = $('#bulkMsg');
  if (errs.length) { msg.textContent = errs.slice(0, 6).join('\n') + (errs.length > 6 ? `\n…ほか${errs.length - 6}件` : '') + '\n直してから、もう一度「取り込む」を押してください。'; return; }
  if (!rows.length) { msg.textContent = '取り込む行がありません。'; return; }
  let add = 0, upd = 0;
  rows.forEach(d => {
    let r = S.roles.find(x => x.name === d.rn);
    if (!r && d.rn) { r = { id: uid(), name: d.rn, color: PAL[S.roles.length % PAL.length], tasks: [] }; S.roles.push(r); }
    r = r || S.roles[0];
    const ex = S.emps.find(e => e.name === d.name);
    if (ex) { Object.assign(ex, { role: r.id, wage: d.wage, slots: d.slots }); upd++; } else { S.emps.push({ id: uid(), name: d.name, role: r.id, wage: d.wage, off: [], slots: d.slots }); add++; }
  });
  save(); renderAll(); bulk.close(); $('#bulkText').value = '';
  toast(`一括登録しました（追加${add}人${upd ? `・上書き${upd}人` : ''}）`);
});

/* ---- タブ（ホーム／従業員） ---- */
function showTab(n) {
  S.tab = n;
  ['home', 'staff'].forEach(k => { const b = $(`[data-tab="${k}"]`); $('#tab-' + k).hidden = k !== n; b.classList.toggle('act', k === n); b.setAttribute('aria-selected', String(k === n)); });
  save();
}
document.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));
showTab(S.tab === 'staff' ? 'staff' : 'home');

renderAll();