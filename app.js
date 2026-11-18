'use strict';
/* Café Shift Board — 1日分の作業表（USD）。データはブラウザ（localStorage）に自動保存されます */
const KEY = 'cafemgr.v1', $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const usd = v => '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const uid = () => Math.random().toString(36).slice(2, 9);

const initial = () => ({
  open: 8, close: 20,
  roles: [{ id: 'r1', name: 'バリスタ', color: '#8a5a3c' }, { id: 'r2', name: 'レジ', color: '#3f7fb5' }, { id: 'r3', name: 'ホール', color: '#6c8b55' }, { id: 'r4', name: 'キッチン', color: '#b4474f' }],
  emps: [
    { id: 'e1', name: 'Emma', role: 'r1', wage: 12, slots: [{ from: 8, to: 12 }, { from: 13, to: 16 }] },
    { id: 'e2', name: 'Liam', role: 'r2', wage: 10, slots: [{ from: 10, to: 18 }] },
    { id: 'e3', name: 'Mia', role: 'r3', wage: 9.5, slots: [{ from: 12, to: 14 }, { from: 15, to: 20 }] }
  ],
  sched: {}, sales: {}
});
let S; try { S = JSON.parse(localStorage.getItem(KEY)); } catch (e) { /* 初回・破損時は初期化 */ }
if (!S || !Array.isArray(S.emps)) S = initial();
S.emps.forEach(e => { if (!Array.isArray(e.slots)) { e.slots = [{ from: e.from ?? S.open, to: e.to ?? S.close }]; delete e.from; delete e.to; } });   // 旧データ（時間帯1つ）を移行
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* 保存できない環境 */ } };

const hrs = () => Array.from({ length: S.close - S.open }, (_, i) => S.open + i);
const role = id => S.roles.find(r => r.id === id) || S.roles[0] || { name: '—', color: '#8a7463' };
const onH = e => (S.sched[e.id] || []).filter(h => h >= S.open && h < S.close);
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
function renderGrid() {
  const H = hrs();
  if (!S.emps.length) { $('#grid').innerHTML = '<div class="empty">スタッフがまだいません。下の「＋ スタッフを追加」から登録してください。</div>'; renderStats(); return; }
  let t = '<table><thead><tr><th class="n"></th>' + H.map(h => `<th>${lab(h)}</th>`).join('') + '</tr></thead><tbody>';
  S.emps.forEach(e => {
    const r = role(e.role), on = new Set(onH(e)), n = on.size;
    t += `<tr><th class="n"><b>${esc(e.name)}</b><i>${esc(r.name)}・${n}h・${usd(n * e.wage)}</i></th>`;
    H.forEach(h => {
      const av = inSlots(e, h);
      t += `<td class="c ${on.has(h) ? 'on' : av ? 'av' : 'no'}" style="--rc:${r.color}" data-e="${e.id}" data-h="${h}">${on.has(h) ? esc(r.name.slice(0, 3)) : ''}</td>`;
    });
    t += '</tr>';
  });
  t += '</tbody><tfoot><tr><th class="n">配置人数</th>' + H.map(h => { const c = S.emps.filter(e => onH(e).includes(h)).length; return `<td class="${c === 0 ? 'low' : ''}">${c}</td>`; }).join('') + '</tr>' +
    '<tr><th class="n">売上（USD）</th>' + H.map(h => `<td><input type="number" min="0" step="any" data-s="${h}" value="${S.sales[h] ?? ''}" aria-label="${lab(h)}の売上"></td>`).join('') + '</tr></tfoot></table>';
  $('#grid').innerHTML = t; renderStats();
}
function renderLegend() {
  $('#legend').innerHTML = S.roles.map(r => `<span><i style="background:${r.color}"></i>${esc(r.name)}</span>`).join('') +
    '<span><i style="background:var(--hatch)"></i>希望時間の外</span><span>薄い色＝希望時間の中（クリック・ドラッグで塗る）</span>';
}
function renderEmps() {
  const ro = S.roles.map(r => `<option value="${r.id}">${esc(r.name)}</option>`).join('');
  $('#emps').innerHTML = S.emps.length ? S.emps.map(e => `<div class="emp" data-id="${e.id}">
    <div class="emp-top">
      <label>名前<input data-k="name" value="${esc(e.name)}"></label>
      <label>役割<select data-k="role">${ro.replace(`value="${e.role}"`, `value="${e.role}" selected`)}</select></label>
      <label>時給 (USD)<input data-k="wage" type="number" min="0" step="any" value="${e.wage}"></label>
      <button class="x" data-del="${e.id}">削除</button>
    </div>
    <div class="slots"><span class="sl-title">勤務できる時間</span>
      ${e.slots.map((s, i) => `<div class="slot" data-i="${i}">
        <label>開始<select data-k="from">${opts(S.open, S.close - 1, s.from)}</select></label><span class="to">〜</span>
        <label>終了<select data-k="to">${opts(S.open + 1, S.close, s.to)}</select></label>
        <button class="x" data-sdel="${i}" aria-label="この時間を削除">削除</button></div>`).join('')}
      <button class="x add-slot" data-sadd="${e.id}">＋ 追加</button>
    </div></div>`).join('') : '<div class="empty">まだ登録がありません。</div>';
}
function renderRoles() {
  $('#roles').innerHTML = S.roles.map(r => `<div class="rrow" data-id="${r.id}"><input type="color" data-k="color" value="${r.color}" aria-label="色"><input data-k="name" value="${esc(r.name)}" aria-label="役割名"><button class="x" data-rdel="${r.id}">削除</button></div>`).join('');
}
function renderRange() { $('#open').innerHTML = opts(0, S.close - 1, S.open); $('#close').innerHTML = opts(S.open + 1, 28, S.close); }
function renderAll() { renderRange(); renderGrid(); renderLegend(); renderEmps(); renderRoles(); }

/* ---- 作業表を塗る（クリック・ドラッグ） ---- */
let paint = null;
const apply = td => {
  const e = S.emps.find(x => x.id === td.dataset.e), h = +td.dataset.h, a = S.sched[e.id] = S.sched[e.id] || [], i = a.indexOf(h);
  if (paint === 'add' && i < 0) a.push(h);
  if (paint === 'del' && i >= 0) a.splice(i, 1);
};
$('#grid').addEventListener('mousedown', ev => {
  const td = ev.target.closest('td.c'); if (!td) return; ev.preventDefault();
  const e = S.emps.find(x => x.id === td.dataset.e); paint = (S.sched[e.id] || []).includes(+td.dataset.h) ? 'del' : 'add'; apply(td);
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
  save(); renderGrid();
});
$('#emps').addEventListener('click', ev => {
  const t = ev.target, card = t.closest('.emp'); if (!card) return;
  const e = S.emps.find(x => x.id === card.dataset.id);
  if (t.dataset.del) { S.emps = S.emps.filter(x => x !== e); delete S.sched[e.id]; }
  else if (t.dataset.sadd) {
    const last = e.slots.length ? Math.max(...e.slots.map(s => s.to)) : S.open, from = last < S.close ? last : S.open;
    e.slots.push({ from, to: Math.min(S.close, from + 4) });
  } else if (t.dataset.sdel != null) { if (e.slots.length <= 1) return; e.slots.splice(+t.dataset.sdel, 1); }
  else return;
  save(); renderGrid(); renderEmps();
});
$('#addEmp').addEventListener('click', () => {
  S.emps.push({ id: uid(), name: 'New ' + (S.emps.length + 1), role: (S.roles[0] || {}).id, wage: 10, slots: [{ from: S.open, to: Math.min(S.close, S.open + 8) }] });
  save(); renderGrid(); renderEmps();
});

/* ---- 役割 ---- */
$('#roles').addEventListener('change', ev => {
  const row = ev.target.closest('.rrow'), k = ev.target.dataset.k; if (!row || !k) return;
  const r = S.roles.find(x => x.id === row.dataset.id); r[k] = k === 'name' ? (ev.target.value.trim() || r.name) : ev.target.value;
  save(); renderGrid(); renderLegend(); renderEmps();
});
$('#roles').addEventListener('click', ev => {
  const id = ev.target.dataset.rdel; if (!id || S.roles.length <= 1) return;
  S.roles = S.roles.filter(r => r.id !== id); S.emps.forEach(e => { if (e.role === id) e.role = S.roles[0].id; });
  save(); renderAll();
});
$('#addRole').addEventListener('click', () => {
  const pal = ['#8a6bb5', '#d08a1f', '#2f9aa8', '#c4552b'];
  S.roles.push({ id: uid(), name: '新しい役割', color: pal[S.roles.length % pal.length] }); save(); renderRoles(); renderLegend(); renderEmps();
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
$('#clear').addEventListener('click', () => { S.sched = {}; save(); renderGrid(); });
$('#reset').addEventListener('click', () => { if (confirm('すべて初期状態に戻します。よろしいですか？')) { S = initial(); save(); renderAll(); } });

renderAll();