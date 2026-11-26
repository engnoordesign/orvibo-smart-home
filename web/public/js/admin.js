// Admin panel: sign in, then edit every part of the website — texts in Arabic and English, sections,
// products, projects with photos, contact details and the admin account.
import { sprite, icon, ICON_NAMES } from './icons.js';
import { loadContent, saveContent, authState, login, logout, createLocalAccount, changeAccount, uploadImage, resetLocal, detect, merge } from './store.js';
import { DEFAULT_CONTENT, UI } from './content.js';
import { deviceArt, artKey } from './devices.js';
import { quadOf } from './photo.js';

let LANG = 'ar', THEME = null;
try { LANG = localStorage.getItem('dh-admin-lang') || 'ar'; THEME = localStorage.getItem('dh-admin-theme'); } catch (e) { /* ignore */ }
const L = (ar, en) => (LANG === 'ar' ? ar : en);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = s => document.querySelector(s);
const tx = o => (o && typeof o === 'object') ? (o[LANG] || o.ar || o.en || '') : (o || '');
const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const safeUrl = u => /^(https?:|data:image\/|\/api\/img\/|img\/)/i.test(u || '') && !/["'<>\\]/.test(u) ? u : '';
const clone = o => JSON.parse(JSON.stringify(o));
let C = null, dirty = false, tab = 'home', auth = null, mode = 'local', openItems = new Set(), pCat = 'all', pendingDel = null, busy = false;

const getP = path => path.split('.').reduce((o, k) => o == null ? o : o[k], C);
function setP(path, v) { const ks = path.split('.'), last = ks.pop(), o = ks.reduce((x, k) => x[k], C); o[last] = v; }
function markDirty() { dirty = true; const s = $('#savestate'); if (s) { s.textContent = L('تعديلات غير محفوظة', 'Unsaved changes'); s.classList.add('dirty'); } }
function toast(msg) { const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 2600); }
function applyChrome() { document.documentElement.lang = LANG; document.documentElement.dir = LANG === 'ar' ? 'rtl' : 'ltr'; if (THEME) document.documentElement.dataset.theme = THEME; else delete document.documentElement.dataset.theme; }
const isDark = () => THEME ? THEME === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;

// ---------- field builders ----------
const fText = (path, label, o = {}) => `<label class="fld"><span>${esc(label)}</span><input data-p="${path}" type="${o.type || 'text'}" value="${esc(getP(path))}" ${o.dir ? `dir="${o.dir}"` : ''} ${o.ph ? `placeholder="${esc(o.ph)}"` : ''}></label>`;
const fArea = (path, label, rows = 3, dir) => `<label class="fld"><span>${esc(label)}</span><textarea data-p="${path}" rows="${rows}" ${dir ? `dir="${dir}"` : ''}>${esc(getP(path))}</textarea></label>`;
const fBi = (path, label, area = 0) => `<div class="bi">${[['ar', 'عربي', 'rtl'], ['en', 'English', 'ltr']].map(([l, n, d]) => area
  ? `<label class="fld"><span data-l="${n}">${esc(label)}</span><textarea data-p="${path}.${l}" rows="${area}" dir="${d}">${esc(getP(path + '.' + l))}</textarea></label>`
  : `<label class="fld"><span data-l="${n}">${esc(label)}</span><input data-p="${path}.${l}" dir="${d}" value="${esc(getP(path + '.' + l))}"></label>`).join('')}</div>`;
const fSel = (path, label, opts, re = true) => `<label class="fld"><span>${esc(label)}</span><select data-p="${path}" ${re ? 'data-re="1"' : ''}>${opts.map(([v, n]) => `<option value="${esc(v)}" ${String(getP(path)) === String(v) ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>`;
const fSw = (path, label) => `<div class="row"><button class="sw ${getP(path) !== false && getP(path) ? 'on' : ''}" data-a="tog" data-p="${path}" aria-pressed="${!!getP(path)}" aria-label="${esc(label)}"></button><span>${esc(label)}</span></div>`;
const listOps = (path, i, n) => `<button class="ib" data-a="mv" data-p="${path}" data-i="${i}" data-d="-1" ${i === 0 ? 'disabled' : ''} aria-label="${L('أعلى', 'Up')}">${icon('up')}</button><button class="ib" data-a="mv" data-p="${path}" data-i="${i}" data-d="1" ${i === n - 1 ? 'disabled' : ''} aria-label="${L('أسفل', 'Down')}">${icon('down')}</button>${delBtn(path, i)}`;
const delBtn = (path, i) => { const k = path + ':' + i; return pendingDel === k ? `<span class="confirm"><b>${L('حذف؟', 'Delete?')}</b><button class="ib bad" data-a="del" data-p="${path}" data-i="${i}" aria-label="${L('تأكيد الحذف', 'Confirm delete')}">${icon('trash')}</button></span>` : `<button class="ib bad" data-a="askdel" data-p="${path}" data-i="${i}" aria-label="${L('حذف', 'Delete')}">${icon('trash')}</button>`; };
const iconSel = (path, label) => fSel(path, label, ICON_NAMES.map(n => [n, n]), true);
const CATS = { lighting: ['الإضاءة', 'Lighting'], mixpad: ['لوحات MixPad', 'MixPad'], lock: ['الأقفال', 'Locks'], curtain: ['الستائر', 'Curtains'], climate: ['التكييف', 'Climate'], remote: ['التحكم من الهاتف', 'Phone control'], other: ['منتجات أخرى', 'More products'] };
const FIXTURES = { down: ['سبوت مدمج', 'Downlight'], spot: ['سبوت موجّه', 'Accent spot'], strip: ['إضاءة مخفية', 'Light strip'], track: ['تراك مغناطيسي', 'Magnetic track'], pendant: ['معلّقة', 'Pendant'], washer: ['غاسلة للجدار', 'Wall washer'] };

// ---------- areas ----------
const TABS = [
  ['home', 'home', ['الواجهة والعلامة', 'Brand & hero']], ['about', 'user', ['من نحن', 'About us']], ['orvibo', 'grid', ['أورفيبو والمقارنة', 'ORVIBO & comparison']],
  ['sections', 'plan', ['الأقسام وترتيبها', 'Sections & order']], ['scenes', 'image', ['صور المشاهد', 'Scene photos']], ['products', 'box', ['المنتجات', 'Products']], ['projects', 'image', ['أعمالنا', 'Our work']],
  ['contact', 'chat', ['التواصل', 'Contact']], ['account', 'key', ['الحساب', 'Account']], ['data', 'save', ['النسخ والاستعادة', 'Backup & restore']],
];
const AREAS = {
  home: () => `<div class="box"><h2>${L('العلامة', 'Brand')}</h2><div class="grid2">${fText('brand.name', L('اسم الشركة', 'Company name'), { dir: 'ltr' })}<label class="fld"><span>${L('اللون المميّز', 'Accent colour')}</span><input type="color" data-p="brand.accent" value="${esc(C.brand.accent || '#c9a25a')}"></label></div>${fBi('brand.tagline', L('السطر التعريفي', 'Tagline'))}
      ${fText('brand.simulatorUrl', L('رابط الجولة ثلاثية الأبعاد (اختياري)', '3D walkthrough link (optional)'), { dir: 'ltr', ph: 'https://…' })}</div>
    <div class="box"><h2>${L('الواجهة الرئيسية', 'Hero')}</h2>${fBi('hero.kicker', L('العنوان الصغير', 'Small heading'))}${fBi('hero.title', L('العنوان الرئيسي', 'Main headline'))}${fBi('hero.text', L('النص التعريفي', 'Introduction'), 4)}${fBi('hero.cta', L('الزر الأول', 'First button'))}${fBi('hero.cta2', L('الزر الثاني', 'Second button'))}</div>`,
  about: () => `<div class="box"><h2>${L('من نحن', 'About us')}</h2>${fBi('about.title', L('العنوان', 'Title'))}${fBi('about.body', L('النص', 'Text'), 6)}</div>
    <div class="box"><h2>${L('ما نقدّمه', 'What we offer')}</h2>${C.about.points.map((p, i) => `<div class="item"><div class="ihead"><span class="thumb">${icon(p.icon)}</span><span class="t">${esc(tx(p.title))}</span>${listOps('about.points', i, C.about.points.length)}</div>${iconSel(`about.points.${i}.icon`, L('الأيقونة', 'Icon'))}${fBi(`about.points.${i}.title`, L('العنوان', 'Title'))}${fBi(`about.points.${i}.text`, L('النص', 'Text'), 2)}</div>`).join('')}
      <button class="add" data-a="add" data-v="point">${icon('plus')} ${L('أضف نقطة', 'Add an item')}</button></div>
    <div class="box"><h2>${L('أرقام (اختياري)', 'Figures (optional)')}</h2><p class="hint">${L('مثل: عدد المشاريع أو سنوات الخبرة. تظهر تحت قسم «من نحن».', 'e.g. number of projects or years of experience. Shown under “About”.')}</p>${(C.about.stats || []).map((s, i) => `<div class="item"><div class="ihead"><span class="t">${esc(s.n)} ${esc(tx(s.label))}</span>${listOps('about.stats', i, C.about.stats.length)}</div>${fText(`about.stats.${i}.n`, L('الرقم', 'Figure'), { dir: 'ltr' })}${fBi(`about.stats.${i}.label`, L('الوصف', 'Label'))}</div>`).join('')}
      <button class="add" data-a="add" data-v="stat">${icon('plus')} ${L('أضف رقماً', 'Add a figure')}</button></div>`,
  orvibo: () => { const o = C.orvibo; return `<div class="box"><h2>${L('عن أورفيبو', 'About ORVIBO')}</h2>${fBi('orvibo.title', L('العنوان', 'Title'))}${fBi('orvibo.body', L('النص', 'Text'), 6)}</div>
    <div class="box"><h2>${L('المزايا', 'Advantages')}</h2>${o.advantages.map((a, i) => `<div class="item"><div class="ihead"><span class="thumb">${icon(a.icon)}</span><span class="t">${esc(tx(a.title))}</span>${listOps('orvibo.advantages', i, o.advantages.length)}</div>${iconSel(`orvibo.advantages.${i}.icon`, L('الأيقونة', 'Icon'))}${fBi(`orvibo.advantages.${i}.title`, L('العنوان', 'Title'))}${fBi(`orvibo.advantages.${i}.text`, L('النص', 'Text'), 2)}</div>`).join('')}
      <button class="add" data-a="add" data-v="adv">${icon('plus')} ${L('أضف ميزة', 'Add an advantage')}</button></div>
    <div class="box"><h2>${L('جدول المقارنة', 'Comparison table')}</h2>${fBi('orvibo.compareTitle', L('عنوان الجدول', 'Table title'))}${o.columns.map((c, i) => fBi(`orvibo.columns.${i}`, L(`العمود ${i + 1}`, `Column ${i + 1}`))).join('')}
      ${o.rows.map((r, i) => `<div class="item"><div class="ihead"><span class="t">${esc(tx(r.label))}</span>${listOps('orvibo.rows', i, o.rows.length)}</div>${fBi(`orvibo.rows.${i}.label`, L('البند', 'Row'))}
        ${r.cells.map((c, j) => `<div class="grid2">${fSel(`orvibo.rows.${i}.cells.${j}.0`, `${tx(o.columns[j])} — ${L('التقييم', 'score')}`, [[1, '●○○'], [2, '●●○'], [3, '●●●']], false)}</div>${fBi(`orvibo.rows.${i}.cells.${j}.1`, tx(o.columns[j]))}`).join('')}</div>`).join('')}
      <button class="add" data-a="add" data-v="row">${icon('plus')} ${L('أضف بنداً', 'Add a row')}</button>${fBi('orvibo.compareNote', L('ملاحظة أسفل الجدول', 'Note under the table'), 2)}</div>
    <div class="box"><h2>${L('مقارنة جودة اللون (Ra)', 'Colour quality comparison (Ra)')}</h2><p class="hint">${L('تظهر في قسم «جودة اللون» كصورة يُسحب فيها الخط بين إضاءة أورفيبو والإضاءة العادية.', 'Shown in the “Colour quality” section as a picture with a draggable line between ORVIBO and ordinary lighting.')}</p>
      <div class="grid2">${fText('cri.ours', L('قيمة Ra لأورفيبو', 'ORVIBO Ra value'), { dir: 'ltr' })}${fText('cri.other', L('قيمة Ra للإضاءة العادية', 'Ordinary light Ra value'), { dir: 'ltr' })}</div>${fBi('cri.oursLabel', L('اسم جانب أورفيبو', 'ORVIBO side label'))}${fBi('cri.otherLabel', L('اسم الجانب الآخر', 'Other side label'))}
      ${C.cri.points.map((pt, i) => `<div class="item"><div class="ihead"><span class="t">${esc(tx(pt.title))}</span>${listOps('cri.points', i, C.cri.points.length)}</div>${fBi(`cri.points.${i}.title`, L('العنوان', 'Title'))}${fBi(`cri.points.${i}.text`, L('النص', 'Text'), 2)}</div>`).join('')}
      <button class="add" data-a="add" data-v="cript">${icon('plus')} ${L('أضف نقطة', 'Add a point')}</button>${fBi('cri.note', L('ملاحظة', 'Note'), 2)}</div>`; },
  sections: () => `<div class="box"><h2>${L('أقسام الصفحة', 'Page sections')}</h2><p class="hint">${L('أظهر أو أخفِ أي قسم وغيّر ترتيبه.', 'Show or hide any section and change the order.')}</p>
      ${C.sections.map((s, i) => `<div class="secrow"><button class="sw ${s.on ? 'on' : ''}" data-a="tog" data-p="sections.${i}.on" aria-label="${L('إظهار', 'Show')}"></button><b>${esc(tx(UI.nav[s.id]))}</b>${listOps('sections', i, C.sections.length).replace(/<button class="ib bad"[^]*?<\/button>|<span class="confirm">[^]*?<\/span>/, '')}</div>`).join('')}</div>
    <div class="box"><h2>${L('عناوين الأقسام', 'Section titles')}</h2>${Object.keys(C.blocks).map(k => `<div class="item"><div class="ihead"><span class="t">${esc(tx(UI.nav[k]))}</span></div>${fBi(`blocks.${k}.title`, L('العنوان', 'Title'))}${fBi(`blocks.${k}.sub`, L('الوصف', 'Subtitle'), 2)}</div>`).join('')}</div>`,
  products: () => {
    const list = C.products.map((p, i) => [p, i]).filter(([p]) => pCat === 'all' || p.cat === pCat);
    return `<div class="box"><div class="chips">${[['all', L('الكل', 'All')], ...Object.entries(CATS).map(([k, v]) => [k, v[LANG === 'ar' ? 0 : 1]])].map(([k, n]) => `<button class="chip ${pCat === k ? 'on' : ''}" data-a="pcat" data-v="${k}">${esc(n)} <span class="num">${k === 'all' ? C.products.length : C.products.filter(p => p.cat === k).length}</span></button>`).join('')}</div>
      <p class="hint">${L('المنتجات تظهر في قسمها: الإضاءة في مشهد الإضاءة، لوحات MixPad في قسم اللوحات، وهكذا. «منتجات أخرى» تظهر في شبكة البطاقات.', 'Products appear in their own section: lighting in the lighting scene, MixPad models in the panel section, and so on. “More products” appear as cards.')}</p></div>
      ${list.map(([p, i]) => { const open = openItems.has(p.id), base = `products.${i}`; return `<div class="item ${open ? '' : 'closed'}"><div class="ihead"><span class="thumb">${safeUrl(p.img) ? `<img src="${esc(safeUrl(p.img))}" alt="">` : artKey(p) ? deviceArt(artKey(p)) : icon(p.cat === 'other' ? (p.icon || 'box') : 'box')}</span><span class="t" data-a="open" data-v="${esc(p.id)}" role="button" tabindex="0">${esc(tx(p.name)) || L('منتج بلا اسم', 'Unnamed product')}</span><span class="tag">${esc(CATS[p.cat]?.[LANG === 'ar' ? 0 : 1] || p.cat)}</span>${p.on === false ? `<span class="tag off">${L('مخفي', 'Hidden')}</span>` : ''}${listOps('products', i, C.products.length)}</div>
        ${open ? `<div class="grid2">${fSel(`${base}.cat`, L('القسم', 'Section'), Object.entries(CATS).map(([k, v]) => [k, v[LANG === 'ar' ? 0 : 1]]))}
          ${p.cat === 'lighting' ? fSel(`${base}.fixture`, L('نوع الإضاءة في المشهد', 'Light type in the scene'), Object.entries(FIXTURES).map(([k, v]) => [k, v[LANG === 'ar' ? 0 : 1]]), false) : ''}
          ${p.cat === 'mixpad' ? fSel(`${base}.model`, L('شكل اللوحة', 'Panel shape'), [['x', L('كبيرة أفقية', 'Large landscape')], ['7', L('متوسطة', 'Medium')], ['mini', L('مربعة صغيرة', 'Small square')]], false) : ''}
          ${p.cat === 'lock' ? fSel(`${base}.model`, L('طرق الفتح', 'Unlock methods'), [['face', L('مع التعرّف على الوجه', 'With face recognition')], ['finger', L('بصمة ورمز وبطاقة', 'Fingerprint, code, card')]], false) : ''}
          ${p.cat === 'climate' ? fSel(`${base}.model`, L('نوع الجهاز', 'Device type'), [['ac', L('وحدة تحكم بالمكيّف', 'AC controller')], ['ir', L('ريموت ذكي', 'Smart IR remote')]], true) : ''}
          ${p.cat === 'other' ? iconSel(`${base}.icon`, L('الأيقونة', 'Icon')) : ''}</div>
          ${fBi(`${base}.name`, L('الاسم', 'Name'))}${fBi(`${base}.desc`, L('الوصف', 'Description'), 3)}${fBi(`${base}.specs`, L('المواصفات — سطر لكل ميزة', 'Specifications — one per line'), 4)}
          <div class="fld"><span>${L('صورة المنتج (اختيارية — بدونها يظهر رسم واقعي للجهاز)', 'Product photo (optional — without one, a realistic drawing of the device is shown)')}</span><div class="imgs">${safeUrl(p.img) ? `<figure><img src="${esc(safeUrl(p.img))}" alt=""><div class="ops"><button data-a="rmimg" data-p="${base}.img" aria-label="${L('حذف الصورة', 'Remove photo')}">${icon('trash')}</button></div></figure>` : ''}<label class="upl">${icon('image')}<span>${L('ارفع صورة', 'Upload photo')}</span><input type="file" accept="image/*" hidden data-up="${base}.img"></label></div></div>
          ${fSw(`${base}.on`, L('ظاهر في الموقع', 'Visible on the site'))}` : ''}</div>`; }).join('')}
      <button class="add" data-a="add" data-v="product">${icon('plus')} ${L('أضف منتجاً', 'Add a product')}</button>`;
  },
  projects: () => `<div class="box"><p class="hint">${L('أضف الأماكن التي نفّذت فيها ديجيتال هوم منظومة أورفيبو مع الصور. المشاريع المعلّمة «مثال» هي أمثلة توضيحية: احذفها أو ألغِ علامة المثال بعد تعديلها.', 'Add the places where Digital Home installed ORVIBO, with photos. Projects marked “example” are placeholders: delete them, or switch the example mark off after editing.')}</p></div>
    ${C.projects.map((p, i) => { const open = openItems.has(p.id), base = `projects.${i}`; return `<div class="item ${open ? '' : 'closed'}"><div class="ihead"><span class="thumb">${safeUrl(p.images?.[0]) ? `<img src="${esc(safeUrl(p.images[0]))}" alt="">` : icon('home')}</span><span class="t" data-a="open" data-v="${esc(p.id)}" role="button" tabindex="0">${esc(tx(p.title)) || L('مشروع بلا اسم', 'Untitled project')}</span>${p.sample ? `<span class="tag">${L('مثال', 'Example')}</span>` : ''}${p.on === false ? `<span class="tag off">${L('مخفي', 'Hidden')}</span>` : ''}${listOps('projects', i, C.projects.length)}</div>
      ${open ? `${fBi(`${base}.title`, L('اسم المشروع', 'Project name'))}<div class="grid2">${fText(`${base}.year`, L('السنة', 'Year'), { dir: 'ltr' })}</div>${fBi(`${base}.type`, L('النوع (فيلا، شقة، مكتب…)', 'Type (villa, apartment, office…)'))}${fBi(`${base}.place`, L('المكان', 'Location'))}${fBi(`${base}.desc`, L('الوصف', 'Description'), 4)}${fBi(`${base}.devices`, L('الأجهزة المستخدمة', 'Devices used'), 2)}
        <div class="fld"><span>${L('الصور — الأولى هي صورة الغلاف', 'Photos — the first one is the cover')}</span><div class="imgs">${(p.images || []).map((im, j) => `<figure><img src="${esc(safeUrl(im))}" alt=""><div class="ops">${j > 0 ? `<button data-a="imgmv" data-p="${base}.images" data-i="${j}" data-d="-1" aria-label="${L('قبل', 'Earlier')}">${icon('up')}</button>` : ''}<button data-a="imgdel" data-p="${base}.images" data-i="${j}" aria-label="${L('حذف', 'Delete')}">${icon('trash')}</button></div></figure>`).join('')}<label class="upl">${icon('image')}<span>${L('ارفع صوراً', 'Upload photos')}</span><input type="file" accept="image/*" multiple hidden data-up="${base}.images"></label></div></div>
        ${fSw(`${base}.on`, L('ظاهر في الموقع', 'Visible on the site'))}${fSw(`${base}.sample`, L('مشروع توضيحي (مثال)', 'Placeholder (example)'))}` : ''}</div>`; }).join('')}
    <button class="add" data-a="add" data-v="project">${icon('plus')} ${L('أضف مشروعاً', 'Add a project')}</button>`,
  contact: () => `<div class="box"><h2>${L('بيانات التواصل', 'Contact details')}</h2><p class="hint">${L('ما تتركه فارغاً لا يظهر في الموقع.', 'Anything left empty is not shown on the site.')}</p><div class="grid2">${fText('brand.phone', L('الهاتف', 'Phone'), { dir: 'ltr' })}${fText('brand.whatsapp', 'WhatsApp', { dir: 'ltr' })}${fText('brand.email', L('البريد الإلكتروني', 'Email'), { dir: 'ltr', type: 'email' })}${fText('brand.instagram', 'Instagram', { dir: 'ltr' })}${fText('brand.facebook', 'Facebook', { dir: 'ltr' })}</div>${fBi('brand.address', L('العنوان', 'Address'))}${fBi('brand.hours', L('ساعات العمل', 'Opening hours'))}</div>`,
  account: () => `<div class="box"><h2>${L('اسم المستخدم وكلمة المرور', 'Username and password')}</h2><p class="hint">${L('أنت مسجّل باسم', 'Signed in as')} <b>${esc(auth?.user || '')}</b>.</p>
    <form id="accform" class="grid2"><label class="fld"><span>${L('كلمة المرور الحالية', 'Current password')}</span><input type="password" id="a-old" autocomplete="current-password" required></label><label class="fld"><span>${L('اسم المستخدم الجديد', 'New username')}</span><input id="a-user" value="${esc(auth?.user || '')}" autocomplete="username" required dir="ltr"></label>
    <label class="fld"><span>${L('كلمة المرور الجديدة (8 أحرف على الأقل)', 'New password (at least 8 characters)')}</span><input type="password" id="a-pass" autocomplete="new-password" minlength="8" required></label><label class="fld"><span>${L('أعد كتابتها', 'Repeat it')}</span><input type="password" id="a-pass2" autocomplete="new-password" minlength="8" required></label>
    <div><button class="btn pri" type="submit">${L('حفظ الحساب', 'Save account')}</button></div><div class="err" id="a-err"></div></form></div>`,
  data: () => `<div class="box"><h2>${L('نسخة احتياطية', 'Backup')}</h2><p class="hint">${L('نزّل كل محتوى الموقع كملف واحد، أو استعد نسخة سابقة.', 'Download all the site content as one file, or restore an earlier copy.')}</p><div class="row"><button class="btn" data-a="export">${icon('save')} ${L('تنزيل نسخة', 'Download a copy')}</button><label class="btn">${icon('up')} ${L('استعادة من ملف', 'Restore from a file')}<input type="file" accept=".json,application/json" hidden id="importf"></label></div></div>
    <div class="box"><h2>${L('إعادة المحتوى الافتراضي', 'Back to the default content')}</h2><p class="hint">${L('يمسح كل التعديلات ويعيد النصوص والمنتجات الأصلية. لا يُطبّق إلا بعد الضغط على «حفظ».', 'Replaces all edits with the original texts and products. Takes effect only after you press “Save”.')}</p>
      ${pendingDel === 'reset' ? `<div class="confirm"><b>${L('متأكد؟', 'Are you sure?')}</b><button class="btn" data-a="reset" style="border-color:var(--bad);color:var(--bad)">${L('نعم، أعد الافتراضي', 'Yes, restore defaults')}</button><button class="btn" data-a="cancel">${L('إلغاء', 'Cancel')}</button></div>` : `<div><button class="btn" data-a="askreset">${L('إعادة الافتراضي', 'Restore defaults')}</button></div>`}</div>`,
};

// ---------- scene photos: upload a photo and place the lights and devices on it ----------
const SCN = { hero: ['الواجهة الرئيسية', 'Hero'], lighting: ['الإضاءة', 'Lighting'], mixpad: ['MixPad (غرفة النوم)', 'MixPad (bedroom)'], lock: ['القفل وباب المدخل', 'Lock & front door'], curtain: ['الستائر', 'Curtains'], climate: ['التكييف', 'Climate'], remote: ['الهاتف (الصالة)', 'Phone (living room)'], cri: ['جودة اللون', 'Colour quality'] };
const ZT = { light: ['مصباح', 'Light', '#ffcf5a'], line: ['خط إضاءة', 'LED line', '#ffa94d'], area: ['خطوط ظاهرة في الصورة', 'Lines visible in the photo', '#ff7ad9'], window: ['نافذة بستارة', 'Window with curtain', '#5ac8ff'], tv: ['تلفزيون', 'TV', '#9b8cff'], ac: ['مكيّف', 'AC unit', '#5affc8'], door: ['باب', 'Door', '#ff8a5a'], lock: ['القفل على الباب', 'Lock on the door', '#ff5a5a'], panel: ['شاشة على الحائط', 'Wall screen', '#c8ff5a'] };
const ZHINT = { light: ['اضغط على مكان المصباح، ثم اضغط حيث يقع ضوؤه.', 'Click where the lamp is, then click where its light lands.'], line: ['اضغط على بداية الخط ثم نهايته.', 'Click the start of the line, then its end.'], rect: ['اسحب مستطيلاً فوق المكان، ثم اسحب زواياه الأربع لتطابق زاوية الجدار في الصورة.', 'Drag a rectangle over it, then drag its four corners to match the angle of the wall in the photo.'] };
let scKey = 'lighting', zTool = null, zFix = 'down', zSel = -1, zTmp = null;
const scene = () => { C.scenes = C.scenes || {}; if (!C.scenes[scKey]) C.scenes[scKey] = clone(DEFAULT_CONTENT.scenes[scKey]); const s = C.scenes[scKey]; s.zones = s.zones || []; return s; };
const zName = z => `${L(...ZT[z.t].slice(0, 2))}${z.f ? ' · ' + L(...FIXTURES[z.f]) : ''}`;
function zSvg(sc) {
  const z = sc.zones || [], col = t => ZT[t]?.[2] || '#fff';
  return z.map((q, i) => { const on = i === zSel ? ' sel' : '', c = col(q.t);
    if (q.t === 'light') return `<g class="zz${on}"><line x1="${q.p[0]}" y1="${q.p[1]}" x2="${(q.a || q.p)[0]}" y2="${(q.a || q.p)[1]}" stroke="${c}" stroke-dasharray="1 1" vector-effect="non-scaling-stroke"/>${q.a ? `<ellipse cx="${q.a[0]}" cy="${q.a[1]}" rx="${(q.r || 10) * 0.6}" ry="${(q.r || 10) * 0.4}" fill="${c}" fill-opacity=".18" stroke="${c}" vector-effect="non-scaling-stroke"/>` : ''}</g>`;
    if (q.t === 'line') return `<line class="zz${on}" x1="${q.p[0]}" y1="${q.p[1]}" x2="${q.p[2]}" y2="${q.p[3]}" stroke="${c}" stroke-width="3" vector-effect="non-scaling-stroke"/>`;
    const pts = quadOf(q), cuts = (q.cut || []).map(poly => `<polygon points="${poly.join(' ')}" fill="#000" fill-opacity=".35" stroke="#fff" stroke-opacity=".4" stroke-dasharray="1 1" vector-effect="non-scaling-stroke"/>`).join('');
    return `${cuts}<polygon class="zz${on}" points="${pts.join(' ')}" fill="${c}" fill-opacity=".14" stroke="${c}" stroke-dasharray="${q.t === 'area' ? '2 1' : '0'}" vector-effect="non-scaling-stroke"/>`; }).join('')
    + (zTmp ? (zTmp.rect ? `<rect x="${zTmp.rect[0]}" y="${zTmp.rect[1]}" width="${zTmp.rect[2]}" height="${zTmp.rect[3]}" fill="#fff" fill-opacity=".15" stroke="#fff" vector-effect="non-scaling-stroke"/>` : `<circle cx="${zTmp.p[0]}" cy="${zTmp.p[1]}" r=".8" fill="#fff"/>`) : '');
}
function zHandles(sc) {
  return (sc.zones || []).map((q, i) => { const h = (k, x, y, cls = '') => `<i class="zh ${cls} ${i === zSel ? 'sel' : ''}" data-zi="${i}" data-h="${k}" style="left:${x}%;top:${y}%;--c:${ZT[q.t]?.[2]}" title="${esc(zName(q))}"></i>`;
    if (q.t === 'light') return h('p', ...q.p, 'pt') + (q.a ? h('a', ...q.a, 'aim') : '');
    if (q.t === 'line') return h('p1', q.p[0], q.p[1], 'pt') + h('p2', q.p[2], q.p[3], 'pt');
    if (q.t === 'area') return h('mv', q.p[0] + q.p[2] / 2, q.p[1] + q.p[3] / 2, 'mv') + h('sz', q.p[0] + q.p[2], q.p[1] + q.p[3], 'sz');
    const k = quadOf(q); return h('mv', q.p[0] + q.p[2] / 2, q.p[1] + q.p[3] / 2, 'mv') + [0, 1, 2, 3].map(n => h('c' + n, k[n * 2], k[n * 2 + 1], 'sz')).join(''); }).join('');
}
function zRefresh() { const sc = scene(), s = $('#zed svg'), h = $('#zed .zhs'); if (s) s.innerHTML = zSvg(sc); if (h) h.innerHTML = zHandles(sc); }
function zRow(q, i) {
  const base = `scenes.${scKey}.zones.${i}`, fx = Object.entries(FIXTURES).map(([k, v]) => [k, v[LANG === 'ar' ? 0 : 1]]);
  return `<div class="zrow ${i === zSel ? 'sel' : ''}"><i class="zdot" style="background:${ZT[q.t]?.[2]}"></i><button class="t" data-a="zsel" data-v="${i}">${esc(zName(q))}</button>
    ${['light', 'line', 'area'].includes(q.t) ? fSel(`${base}.f`, L('يتحكم به', 'Controlled as'), fx, true) : ''}
    ${q.t === 'light' || q.t === 'line' ? `<label class="fld sm"><span>${L('حجم الضوء', 'Light size')}</span><input type="range" min="2" max="40" step="0.5" data-p="${base}.r" data-num="1" value="${q.r || 10}"></label>` : ''}
    ${q.t === 'light' ? `<button class="chip ${q.h ? 'on' : ''}" data-a="zhid" data-v="${i}">${L('مخفي في السقف', 'Hidden in ceiling')}</button>` : ''}
    ${q.t === 'window' ? `<label class="fld sm"><span>${L('لون القماش', 'Fabric colour')}</span><input type="color" data-p="${base}.c" value="${esc(q.c || '#78706a')}"></label>${fSel(`${base}.m`, L('طريقة الإغلاق', 'Closes'), [['split', L('من الجانبين', 'From both sides')], ['left', L('من اليسار', 'From the left')], ['right', L('من اليمين', 'From the right')], ['blind', L('ستارة رول من الأعلى', 'Roller blind from the top')]], false)}` : ''}
    ${q.t === 'door' ? fSel(`${base}.hinge`, L('المفصّلات', 'Hinges'), [['r', L('يمين', 'Right')], ['l', L('يسار', 'Left')]], false) : ''}
    ${delBtn(`scenes.${scKey}.zones`, i)}</div>`;
}
AREAS.scenes = () => {
  const sc = scene(), img = safeUrl(sc.img) || DEFAULT_CONTENT.scenes[scKey]?.img, isCri = scKey === 'cri';
  const hint = zTool ? (zTool === 'light' ? ZHINT.light : zTool === 'line' ? ZHINT.line : ZHINT.rect) : null;
  return `<div class="box"><p class="hint">${L('كل مشهد في الموقع صورة حقيقية تُضاء مباشرة. ارفع صورة من مشاريعك، ثم حدّد عليها أماكن الإضاءة والنوافذ والأجهزة. اسحب النقاط لتعديلها، واسحب زوايا النافذة أو التلفزيون أو المكيّف لتتبع زاوية الجدار.', 'Every scene on the site is a real photo lit live. Upload a photo from your own projects, then mark where the lights, windows and devices are. Drag the dots to adjust them; drag the corners of a window, TV or AC so it follows the angle of the wall.')}</p>
      <div class="chips">${Object.entries(SCN).map(([k, n]) => `<button class="chip ${scKey === k ? 'on' : ''}" data-a="zscene" data-v="${k}">${esc(n[LANG === 'ar' ? 0 : 1])}</button>`).join('')}</div></div>
    <div class="box"><h2>${esc(L(...SCN[scKey]))}</h2>
      <div class="row" style="margin-top:10px"><label class="btn">${icon('image')} ${L('استبدل الصورة', 'Replace the photo')}<input type="file" accept="image/*" hidden data-up="scenes.${scKey}.img"></label>
        ${scKey === 'lock' ? `<label class="btn">${icon('door')} ${L('صورة الخارج خلف الباب', 'Photo seen through the open door')}<input type="file" accept="image/*" hidden data-up="scenes.lock.outside"></label>` : ''}
        ${!isCri ? `<button class="btn" data-a="zclear">${L('امسح كل العلامات', 'Clear all marks')}</button>` : ''}<button class="btn" data-a="zreset">${L('الصورة والعلامات الأصلية', 'Original photo and marks')}</button></div>
      ${isCri ? `<p class="hint">${L('اختر صورة بألوان غنية (فواكه، ورود، أقمشة). نصفها يظهر بإضاءة عادية ونصفها بإضاءة أورفيبو.', 'Choose a photo with rich colours (fruit, flowers, fabrics). Half of it is shown under ordinary light, half under ORVIBO light.')}</p><div class="zed"><img src="${esc(img)}" alt="" draggable="false"></div>` : `
      <h3 style="margin:16px 0 8px">${L('أضف إلى الصورة', 'Add to the photo')}</h3>
      <div class="row">${fSel('__zfix', L('نوع الإضاءة', 'Light type'), Object.entries(FIXTURES).map(([k, v]) => [k, v[LANG === 'ar' ? 0 : 1]]), false).replace('data-p="__zfix"', 'id="zfix"').replace(/<option value="([^"]+)" (selected)?/g, (m, v) => `<option value="${v}" ${v === zFix ? 'selected' : ''}`)}</div>
      <div class="chips">${Object.keys(ZT).map(t => `<button class="chip ${zTool === t ? 'on' : ''}" data-a="ztool" data-v="${t}"><i class="zdot" style="background:${ZT[t][2]}"></i> ${esc(L(...ZT[t].slice(0, 2)))}</button>`).join('')}</div>
      ${hint ? `<div class="banner">${esc(L(...hint))} <button class="chip" data-a="ztool" data-v="">${L('إلغاء', 'Cancel')}</button></div>` : ''}
      <p class="hint">${L('«خطوط ظاهرة في الصورة»: ارسم مستطيلاً حول خطوط الإضاءة الظاهرة في السقف، فتتوهج الخطوط نفسها باللون الذي يختاره الزائر.', '“Lines visible in the photo”: draw a box around LED lines that are already in the photo, and those very lines glow in the colour the visitor picks.')}</p>
      <div class="zed ${zTool ? 'placing' : ''}" id="zed"><img src="${esc(img)}" alt="" draggable="false"><svg viewBox="0 0 100 100" preserveAspectRatio="none">${zSvg(sc)}</svg><div class="zhs">${zHandles(sc)}</div></div>
      <div class="zlist">${sc.zones.map(zRow).join('') || `<p class="hint">${L('لا توجد علامات بعد.', 'No marks yet.')}</p>`}</div>`}</div>`;
};
// placing and dragging on the photo
const zPt = e => { const r = $('#zed').getBoundingClientRect(); const c = (v, a, b) => Math.max(a, Math.min(b, v)); return [Math.round(c((e.clientX - r.left) / r.width * 100, 0, 100) * 10) / 10, Math.round(c((e.clientY - r.top) / r.height * 100, 0, 100) * 10) / 10]; };
let zDrag = null;
document.addEventListener('pointerdown', e => {
  const zed = e.target.closest?.('#zed'); if (!zed || !$('#zed .zhs')) return; e.preventDefault();
  const sc = scene(), pt = zPt(e), hd = e.target.closest('.zh');
  if (hd && !zTool) { zSel = +hd.dataset.zi; const q = sc.zones[zSel]; zDrag = { q, h: hd.dataset.h, from: pt, orig: clone(q) }; zed.setPointerCapture?.(e.pointerId); zRefresh(); return; }
  if (!zTool) return;
  if (['light', 'line'].includes(zTool)) {
    if (!zTmp) { zTmp = { p: pt }; zRefresh(); return; }
    const q = zTool === 'light' ? { t: 'light', f: zFix, p: zTmp.p, a: pt, r: 10 } : { t: 'line', f: zFix, p: [...zTmp.p, ...pt], r: 4 };
    sc.zones.push(q); zSel = sc.zones.length - 1; zTmp = null; zTool = null; markDirty(); render(); return;
  }
  zTmp = { start: pt, rect: [pt[0], pt[1], 0, 0] }; zDrag = { make: true }; zed.setPointerCapture?.(e.pointerId);
});
document.addEventListener('pointermove', e => {
  if (!zDrag || !$('#zed')) return; const pt = zPt(e), r1 = v => Math.round(v * 10) / 10;
  if (zDrag.make) { const [x0, y0] = zTmp.start; zTmp.rect = [Math.min(x0, pt[0]), Math.min(y0, pt[1]), r1(Math.abs(pt[0] - x0)), r1(Math.abs(pt[1] - y0))]; zRefresh(); return; }
  const { q, h, from, orig } = zDrag, dx = pt[0] - from[0], dy = pt[1] - from[1];
  if (h === 'p' || h === 'a') { q[h] = pt; } else if (h === 'p1') { q.p[0] = pt[0]; q.p[1] = pt[1]; } else if (h === 'p2') { q.p[2] = pt[0]; q.p[3] = pt[1]; }
  else if (h === 'mv') { q.p[0] = r1(orig.p[0] + dx); q.p[1] = r1(orig.p[1] + dy); if (orig.q) q.q = orig.q.map((v, n) => r1(v + (n % 2 ? dy : dx))); }
  else if (/^c\d$/.test(h)) { // a corner: the shape follows the angle of the wall in the photo
    const n = +h[1], k = quadOf(orig).slice(); k[n * 2] = pt[0]; k[n * 2 + 1] = pt[1]; q.q = k;
    const xs = [k[0], k[2], k[4], k[6]], ys = [k[1], k[3], k[5], k[7]]; q.p = [Math.min(...xs), Math.min(...ys), r1(Math.max(...xs) - Math.min(...xs)), r1(Math.max(...ys) - Math.min(...ys))]; } else if (h === 'sz') { q.p[2] = r1(Math.max(0.5, orig.p[2] + dx)); q.p[3] = r1(Math.max(0.5, orig.p[3] + dy)); }
  zRefresh();
});
document.addEventListener('pointerup', () => {
  if (!zDrag) return; const d = zDrag; zDrag = null;
  if (d.make) { const r = zTmp.rect; zTmp = null; if (r[2] > 0.5 && r[3] > 0.5) { const q = { t: zTool, p: r }; if (zTool === 'area') { q.f = 'strip'; q.th = 235; } if (zTool === 'window') { q.c = '#78706a'; q.m = 'split'; } if (zTool === 'door') q.hinge = 'r'; scene().zones.push(q); zSel = scene().zones.length - 1; zTool = null; markDirty(); render(); } else zRefresh(); return; }
  markDirty(); render();
});

// ---------- screens ----------
function renderLogin(msg = '') {
  const a = auth, server = mode === 'server', create = !server && !a.configured;
  $('#adm').innerHTML = `<div class="login"><form id="loginform" autocomplete="on"><div class="logo"><b>${esc(C?.brand?.name || 'DIGITAL HOME')}</b><small>${L('لوحة الإدارة', 'Admin panel')}</small></div>
    <h1>${create ? L('أنشئ حساب المدير', 'Create the admin account') : L('تسجيل الدخول', 'Sign in')}</h1>
    ${server && !a.configured ? `<div class="banner bad">${L('لم يُضبط حساب المدير على الخادم بعد. في Cloudflare افتح هذا الـ Worker ← الإعدادات ← المتغيرات والأسرار، وأضف سرّين: ADMIN_USER و ADMIN_PASSWORD، ثم أعد تحميل هذه الصفحة.', 'The admin account is not set on the server yet. In Cloudflare open this Worker → Settings → Variables and Secrets, add two secrets, ADMIN_USER and ADMIN_PASSWORD, then reload this page.')}</div>` : ''}
    ${create ? `<p>${L('هذا الموقع يعمل الآن بدون خادم، فيُحفظ الحساب والمحتوى في هذا المتصفح فقط.', 'The site is running without its server, so the account and the content are kept in this browser only.')}</p>` : ''}
    ${server && !a.configured ? '' : `<label class="fld"><span>${L('اسم المستخدم', 'Username')}</span><input id="l-user" autocomplete="username" required dir="ltr"></label><label class="fld"><span>${L('كلمة المرور', 'Password')}</span><input id="l-pass" type="password" autocomplete="${create ? 'new-password' : 'current-password'}" ${create ? 'minlength="8"' : ''} required></label>
    ${create ? `<label class="fld"><span>${L('أعد كتابة كلمة المرور', 'Repeat the password')}</span><input id="l-pass2" type="password" autocomplete="new-password" minlength="8" required></label>` : ''}<button class="btn pri" type="submit">${create ? L('إنشاء الحساب', 'Create account') : L('دخول', 'Sign in')}</button>`}
    <div class="err" id="l-err" aria-live="polite">${esc(msg)}</div><div class="row"><button type="button" class="tbtn" data-a="lang">${icon('globe')}${LANG === 'ar' ? 'English' : 'العربية'}</button><button type="button" class="tbtn" data-a="theme" aria-label="theme">${icon(isDark() ? 'sun' : 'moon')}</button><a class="tbtn" href="index.html">${L('الموقع', 'Website')}</a></div></form></div>`;
  $('#l-user')?.focus();
}
function render() {
  const cur = TABS.find(t => t[0] === tab), y = $('.content') ? scrollY : 0;
  $('#adm').innerHTML = `<div class="shell"><aside class="side" id="side"><div class="logo"><b>${esc(C.brand.name)}</b><small>${L('لوحة الإدارة', 'Admin panel')}</small></div>
      ${TABS.map(([k, ic, n]) => `<button class="${tab === k ? 'on' : ''}" data-a="tab" data-v="${k}">${icon(ic)}${n[LANG === 'ar' ? 0 : 1]}</button>`).join('')}<div class="grow"></div>
      <button data-a="lang">${icon('globe')}${LANG === 'ar' ? 'English' : 'العربية'}</button><button data-a="theme">${icon(isDark() ? 'sun' : 'moon')}${isDark() ? L('الوضع النهاري', 'Light mode') : L('الوضع الليلي', 'Dark mode')}</button><button data-a="logout">${icon('logout')}${L('تسجيل الخروج', 'Sign out')}</button></aside>
    <div class="main"><div class="bar"><button class="ib menu-btn" data-a="menu" aria-label="${L('القائمة', 'Menu')}">${icon('grid')}</button><h1>${cur[2][LANG === 'ar' ? 0 : 1]}</h1><span class="state ${dirty ? 'dirty' : ''}" id="savestate">${dirty ? L('تعديلات غير محفوظة', 'Unsaved changes') : L('كل شيء محفوظ', 'All saved')}</span>
      <a class="btn" href="index.html" target="_blank" rel="noopener">${icon('eye')} ${L('معاينة', 'Preview')}</a><button class="btn pri" data-a="save" ${busy ? 'disabled' : ''}>${icon('save')} ${L('حفظ', 'Save')}</button></div>
      <div class="content">${mode === 'local' ? `<div class="banner">${L('وضع المعاينة: التعديلات تُحفظ في هذا المتصفح فقط. بعد النشر على Cloudflare تُحفظ على الخادم وتظهر لكل الزوار.', 'Preview mode: edits are saved in this browser only. Once deployed on Cloudflare they are saved on the server and every visitor sees them.')}</div>` : ''}${AREAS[tab]()}</div></div></div>`;
  if (y) scrollTo(0, y);
}

// ---------- actions ----------
const NEW = {
  point: () => C.about.points.push({ icon: 'spark', title: { ar: '', en: '' }, text: { ar: '', en: '' } }),
  stat: () => (C.about.stats = C.about.stats || []).push({ n: '', label: { ar: '', en: '' } }),
  adv: () => C.orvibo.advantages.push({ icon: 'spark', title: { ar: '', en: '' }, text: { ar: '', en: '' } }),
  cript: () => C.cri.points.push({ title: { ar: '', en: '' }, text: { ar: '', en: '' } }),
  row: () => C.orvibo.rows.push({ label: { ar: '', en: '' }, cells: [0, 1, 2].map(() => [2, { ar: '', en: '' }]) }),
  product: () => { const id = uid('p_'); C.products.push({ id, cat: pCat === 'all' ? 'other' : pCat, fixture: 'down', model: pCat === 'lock' ? 'face' : 'x', icon: 'box', on: true, name: { ar: '', en: '' }, desc: { ar: '', en: '' }, specs: { ar: '', en: '' }, img: '' }); openItems.add(id); },
  project: () => { const id = uid('pr_'); C.projects.unshift({ id, on: true, sample: false, title: { ar: '', en: '' }, place: { ar: '', en: '' }, type: { ar: '', en: '' }, year: String(new Date().getFullYear()), desc: { ar: '', en: '' }, devices: { ar: '', en: '' }, images: [] }); openItems.add(id); },
};
const ACT = {
  zscene: v => { scKey = v; zTool = null; zTmp = null; zSel = -1; render(); },
  ztool: v => { zTool = v || null; zTmp = null; const f = $('#zfix'); if (f) zFix = f.value; render(); },
  zsel: v => { zSel = +v; render(); },
  zhid: v => { const q = scene().zones[+v]; q.h = q.h ? 0 : 1; markDirty(); render(); },
  zclear: () => { scene().zones = []; zSel = -1; markDirty(); render(); },
  zreset: () => { C.scenes[scKey] = clone(DEFAULT_CONTENT.scenes[scKey]); zSel = -1; markDirty(); render(); toast(L('أُعيدت الصورة الأصلية — اضغط «حفظ»', 'Original restored — press “Save”')); },
  tab: v => { tab = v; pendingDel = null; $('#side')?.classList.remove('open'); render(); scrollTo(0, 0); },
  menu: () => $('#side')?.classList.toggle('open'),
  lang: () => { LANG = LANG === 'ar' ? 'en' : 'ar'; try { localStorage.setItem('dh-admin-lang', LANG); } catch (e) { /* ignore */ } applyChrome(); auth?.user ? render() : renderLogin(); },
  theme: () => { THEME = isDark() ? 'light' : 'dark'; try { localStorage.setItem('dh-admin-theme', THEME); } catch (e) { /* ignore */ } applyChrome(); auth?.user ? render() : renderLogin(); },
  logout: async () => { if (dirty && !confirmLeave()) return; await logout(); auth = await authState(); renderLogin(); },
  save: async () => { busy = true; render(); try { await saveContent(C); dirty = false; toast(L('تم الحفظ', 'Saved')); } catch (e) { toast(e.message === 'quota' ? L('مساحة المتصفح ممتلئة: قلّل الصور أو انشر الموقع على Cloudflare.', 'Browser storage is full: use fewer photos or deploy on Cloudflare.') : e.message === 'unauthorized' ? L('انتهت الجلسة، سجّل الدخول من جديد.', 'Session expired — sign in again.') : L('تعذّر الحفظ: ', 'Could not save: ') + e.message); } busy = false; render(); },
  tog: (v, el) => { const p = el.dataset.p, cur = getP(p); setP(p, !(cur !== false && cur)); markDirty(); render(); },
  add: v => { NEW[v](); markDirty(); render(); },
  open: v => { openItems.has(v) ? openItems.delete(v) : openItems.add(v); render(); },
  pcat: v => { pCat = v; render(); },
  mv: (v, el) => { const arr = getP(el.dataset.p), i = +el.dataset.i, j = i + +el.dataset.d; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; markDirty(); render(); },
  askdel: (v, el) => { pendingDel = el.dataset.p + ':' + el.dataset.i; render(); setTimeout(() => { if (pendingDel === el.dataset.p + ':' + el.dataset.i) { pendingDel = null; render(); } }, 4000); },
  del: (v, el) => { getP(el.dataset.p).splice(+el.dataset.i, 1); pendingDel = null; markDirty(); render(); },
  rmimg: (v, el) => { setP(el.dataset.p, ''); if (el.dataset.p.endsWith('.img')) setP(el.dataset.p.replace(/\.img$/, '.imgOff'), true); markDirty(); render(); },
  imgdel: (v, el) => { getP(el.dataset.p).splice(+el.dataset.i, 1); markDirty(); render(); },
  imgmv: (v, el) => { const a = getP(el.dataset.p), i = +el.dataset.i; [a[i - 1], a[i]] = [a[i], a[i - 1]]; markDirty(); render(); },
  export: () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(C, null, 1)], { type: 'application/json' })); a.download = 'digital-home-content.json'; document.body.appendChild(a); a.click(); a.remove(); },
  askreset: () => { pendingDel = 'reset'; render(); }, cancel: () => { pendingDel = null; render(); },
  reset: () => { C = merge(null); pendingDel = null; markDirty(); render(); toast(L('أُعيد المحتوى الافتراضي — اضغط «حفظ» لتطبيقه', 'Defaults restored — press “Save” to apply')); },
};
const confirmLeave = () => true;
document.addEventListener('click', e => {
  const el = e.target.closest('[data-a]'); if (!el || el.disabled) return;
  const a = el.dataset.a; if (ACT[a]) { if (el.tagName === 'A') return; e.preventDefault(); ACT[a](el.dataset.v, el); }
});
document.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches?.('[role=button][data-a]')) { e.preventDefault(); e.target.click(); } if ((e.ctrlKey || e.metaKey) && e.key === 's' && auth?.user) { e.preventDefault(); ACT.save(); } });
document.addEventListener('input', e => {
  const p = e.target.dataset?.p; if (!p || e.target.tagName === 'SELECT') return;
  setP(p, e.target.dataset.num ? +e.target.value : e.target.value); markDirty(); if (p.startsWith('scenes.')) zRefresh();
  if (p === 'brand.accent') document.documentElement.style.setProperty('--accent', e.target.value);
});
document.addEventListener('change', async e => {
  const t = e.target, p = t.dataset?.p;
  if (t.id === 'zfix') { zFix = t.value; return; }
  if (p && t.tagName === 'SELECT') { const v = t.value; setP(p, /^\d+$/.test(v) && /cells\.\d+\.0$/.test(p) ? +v : v); markDirty(); if (t.dataset.re) render(); return; }
  if (t.dataset?.up) {
    const path = t.dataset.up, files = [...t.files]; if (!files.length) return;
    toast(L('جارٍ رفع الصور…', 'Uploading…'));
    try { for (const f of files) { const url = await uploadImage(f); if (path.endsWith('.images')) getP(path).push(url); else { setP(path, url); if (/^products\.\d+\.img$/.test(path)) setP(path.replace(/\.img$/, '.imgOff'), false); } } markDirty(); render(); toast(L('تم الرفع — لا تنسَ «حفظ»', 'Uploaded — remember to Save')); }
    catch (err) { toast(L('تعذّر رفع الصورة: ', 'Upload failed: ') + err.message); }
    return;
  }
  if (t.id === 'importf' && t.files[0]) { try { const o = JSON.parse(await t.files[0].text()); if (o.v !== 1) throw new Error('format'); C = merge(o); markDirty(); render(); toast(L('استُعيدت النسخة — اضغط «حفظ» لتطبيقها', 'Copy restored — press “Save” to apply')); } catch (err) { toast(L('هذا الملف ليس نسخة من محتوى الموقع.', 'That file is not a copy of the site content.')); } }
});
document.addEventListener('submit', async e => {
  e.preventDefault();
  if (e.target.id === 'loginform') {
    const u = $('#l-user').value.trim(), p = $('#l-pass').value, err = $('#l-err');
    try {
      if (mode === 'local' && !auth.configured) { if (p.length < 8) throw new Error(L('كلمة المرور قصيرة (8 أحرف على الأقل).', 'Password too short (at least 8 characters).')); if (p !== $('#l-pass2').value) throw new Error(L('كلمتا المرور غير متطابقتين.', 'The passwords do not match.')); await createLocalAccount(u, p); }
      else await login(u, p);
      auth = await authState(); render();
    } catch (x) { err.textContent = x.message === 'wrong' || x.message === 'invalid' ? L('اسم المستخدم أو كلمة المرور غير صحيحة.', 'Wrong username or password.') : x.message === 'locked' ? L('محاولات كثيرة. انتظر 15 دقيقة ثم حاول مجدداً.', 'Too many attempts. Wait 15 minutes and try again.') : x.message; }
  }
  if (e.target.id === 'accform') {
    const err = $('#a-err'), np = $('#a-pass').value;
    if (np !== $('#a-pass2').value) { err.textContent = L('كلمتا المرور غير متطابقتين.', 'The passwords do not match.'); return; }
    try { await changeAccount($('#a-old').value, $('#a-user').value.trim(), np); auth = await authState(); toast(L('تم تحديث الحساب', 'Account updated')); render(); }
    catch (x) { err.textContent = x.message === 'wrong' || x.message === 'invalid' ? L('كلمة المرور الحالية غير صحيحة.', 'The current password is wrong.') : x.message; }
  }
});
addEventListener('beforeunload', e => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

(async () => {
  applyChrome(); sprite();
  mode = await detect(); [C, auth] = await Promise.all([loadContent(), authState()]);
  auth.user ? render() : renderLogin();
  window.DHADMIN = { get C() { return C; } };
})();
