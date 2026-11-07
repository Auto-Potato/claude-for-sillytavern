// User persona panel. Mobile: contact page with a swipe switcher. Desktop:
// identity card with a face wall. All persona changes go through the host's
// own persona code (exported functions, slash-command callbacks and the native
// description / avatar inputs), so locks, events and saving stay native.
import * as st from '../../../../../script.js';
import { power_user } from '../../../../power-user.js';
import { setUserAvatar, getUserAvatar, user_avatar } from '../../../../personas.js';
import { SlashCommandParser } from '../../../../slash-commands/SlashCommandParser.js';
import { Popup, POPUP_TYPE, POPUP_RESULT } from '../../../../popup.js';
import { personaList, initialOf } from './persona-data.js';

const paths = {
    close: 'M6 6l12 12M18 6 6 18',
    pen: 'm4 16 12-12 4 4-12 12H4zM14 6l4 4',
    camera: 'M4 8h3l2-3h6l2 3h3v11H4zM12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
    swap: 'M7 7h12l-3-3M17 17H5l3 3',
    plus: 'M12 5v14M5 12h14',
    check: 'm5 12 4 4L19 6',
    x: 'M6 6l12 12M18 6 6 18',
};
const icon = (name, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name]}"/></svg>`;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function mountPersonaPanel(doc, win) {
    const drawer = doc.getElementById('PersonaManagement');
    if (!drawer) return () => {};
    const abort = new win.AbortController(), signal = abort.signal;
    const mobile = () => win.innerWidth <= 700;
    const reduced = () => win.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let revision = Date.now(), switching = false, busy = false, disposed = false;

    const root = doc.createElement('div');
    root.id = 'cwn-persona-panel';
    root.innerHTML = `<header class="pp-head"><h1 class="cwn-type-title pp-title">用户设定</h1><button type="button" class="pp-icon" data-pp="close" aria-label="关闭">${icon('close')}</button></header>
        <div class="pp-scroll">
            <section class="pp-hero">
                <button type="button" class="pp-portrait" data-pp="avatar" aria-label="更换头像"><span class="pp-pic"></span><span class="pp-cam">${icon('camera')}</span></button>
                <div class="pp-hero-text"><div class="pp-name-slot"></div><span class="pp-status"><i></i>当前使用中</span></div>
            </section>
            <div class="pp-strip" aria-label="身份"></div>
            <div class="pp-info"><div class="pp-dots" aria-hidden="true"></div><div class="pp-name-slot pp-name-mobile"></div><span class="pp-status pp-status-mobile"><i></i><span></span></span></div>
            <div class="pp-cta"></div>
            <section class="pp-wall-section"><div class="pp-wall-head"><h2 class="cwn-type-section">切换身份</h2><small>点击头像即可切换</small></div><div class="pp-wall" role="list"></div></section>
            <section class="pp-bio"><span class="pp-rule" aria-hidden="true"></span><textarea class="pp-bio-text" rows="1" aria-label="描述" placeholder="添加一段描述，让角色认识你"></textarea></section>
        </div>`;
    drawer.append(root);
    drawer.classList.add('cwn-persona-mounted');
    const $ = sel => root.querySelector(sel);
    const strip = $('.pp-strip'), wall = $('.pp-wall'), dots = $('.pp-dots'), cta = $('.pp-cta'), bio = $('.pp-bio-text');

    const thumb = avatar => `${st.getThumbnailUrl('persona', avatar)}&cwn=${revision}`;
    const full = avatar => `${getUserAvatar(avatar)}?cwn=${revision}`;
    const picture = (person, size = 'thumb') => `<img class="pp-av" src="${esc(size === 'full' ? full(person.avatar) : thumb(person.avatar))}" alt="" data-initial="${esc(initialOf(person.name))}">`;
    const nameButton = person => `<button type="button" class="pp-name" data-pp="rename" aria-label="重命名"><span>${esc(person.name)}</span>${icon('pen', 'pp-pen')}</button>`;
    let people = [], active = null, slides = [];

    const command = name => SlashCommandParser.commands?.[name]?.callback;
    async function run(fn) {
        if (busy || disposed) return;
        busy = true; root.classList.add('pp-busy');
        try { await fn(); } catch (error) { console.error('[Claude persona]', error); win.toastr.error(error.message || '操作失败，请重试'); }
        finally { busy = false; root.classList.remove('pp-busy'); }
    }
    function dialog(title, body, type = POPUP_TYPE.CONFIRM, value = '', okButton = '确定') {
        const content = doc.createElement('div');
        const heading = doc.createElement('h3'); heading.textContent = title; content.append(heading);
        if (body) { const p = doc.createElement('p'); p.textContent = body; content.append(p); }
        const popup = new Popup(content, type, value, { okButton, cancelButton: '取消' });
        popup.dlg.classList.add('cwn-character-dialog');
        return popup.show();
    }

    // ---- Actions (all native) ----
    const switchTo = person => run(async () => {
        if (!person || person.avatar === user_avatar) return;
        await setUserAvatar(person.avatar, { toastPersonaNameChange: false });
        win.toastr.success(`已切换为 ${person.name}`);
    });
    const createPersona = () => run(async () => {
        const name = await dialog('新建身份', '为新的身份取个名字。', POPUP_TYPE.INPUT, '', '创建');
        if (typeof name !== 'string' || !name.trim()) return;
        const create = command('persona-create');
        if (!create) throw new Error('当前酒馆版本不支持新建身份');
        await create({ name: name.trim(), select: 'true' }, '');
    });
    const deletePersona = person => run(async () => {
        if (!person) return;
        const ok = await dialog('删除身份', `删除「${person.name}」后无法恢复。已有聊天记录会保留。`, POPUP_TYPE.CONFIRM, '', '删除');
        if (ok !== POPUP_RESULT.AFFIRMATIVE) return;
        const remove = command('persona-delete');
        if (!remove) throw new Error('当前酒馆版本不支持删除身份');
        if (await remove({ persona: person.avatar, silent: 'true' }, '') !== 'true') throw new Error('删除未完成，请重试');
        // Leave the switcher so the refreshed list (and any new active identity) is shown.
        if (switching) { switching = false; root.classList.remove('pp-switching'); }
        render();
        win.toastr.success('身份已删除');
    });
    function renameInline(button) {
        const person = active; if (!person || busy) return;
        const input = doc.createElement('input');
        input.className = 'pp-name-input'; input.value = person.name; input.setAttribute('aria-label', '身份名称');
        button.replaceWith(input); input.focus(); input.select();
        let finished = false;
        const done = save => {
            if (finished) return; finished = true;
            const next = input.value.trim();
            input.replaceWith(button);
            if (!save || !next || next === person.name) return;
            void run(async () => {
                const update = command('persona-update');
                if (!update) throw new Error('当前酒馆版本不支持重命名');
                await update({ persona: person.avatar, name: next }, '');
            });
        };
        input.addEventListener('keydown', event => {
            if (event.key === 'Enter') { event.preventDefault(); done(true); }
            if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); done(false); }
        });
        input.addEventListener('blur', () => done(true));
    }
    function changeAvatar() {
        if (!active || busy) return;
        const overwrite = doc.getElementById('avatar_upload_overwrite'), file = doc.getElementById('avatar_upload_file');
        if (!overwrite || !file) return;
        overwrite.value = active.avatar;
        file.click();
    }
    function saveBio() {
        const native = doc.getElementById('persona_description');
        if (!native || !active || bio.value === (power_user.persona_descriptions?.[active.avatar]?.description || '')) return;
        native.value = bio.value;
        win.jQuery ? win.jQuery(native).trigger('input') : native.dispatchEvent(new win.Event('input', { bubbles: true }));
    }

    // ---- Rendering ----
    function render() {
        if (disposed) return;
        people = personaList(power_user.personas, power_user.persona_descriptions, user_avatar);
        active = people.find(p => p.current) || null;
        root.classList.toggle('pp-empty', !active);
        // Keep at least one identity: the host needs a persona to write as.
        root.classList.toggle('pp-single', people.length <= 1);
        const shown = active || { avatar: '', name: st.name1 || '你', description: '' };
        // Desktop hero.
        $('.pp-portrait .pp-pic').innerHTML = active ? picture(active, 'full') : `<i class="pp-initial">${esc(initialOf(shown.name))}</i>`;
        for (const slot of root.querySelectorAll('.pp-name-slot')) slot.innerHTML = nameButton(shown);
        // Face wall (desktop).
        wall.innerHTML = people.map(p => `<div class="pp-face${p.current ? ' current' : ''}" role="listitem"><button type="button" class="pp-face-main" data-pp="pick" data-avatar="${esc(p.avatar)}" aria-label="切换为 ${esc(p.name)}"><span class="pp-ring">${picture(p)}${p.current ? `<i class="pp-tick">${icon('check')}</i>` : ''}</span><span class="pp-face-name">${esc(p.name)}</span></button><button type="button" class="pp-face-del" data-pp="delete" data-avatar="${esc(p.avatar)}" aria-label="删除 ${esc(p.name)}">${icon('x')}</button></div>`).join('')
            + `<div class="pp-face add" role="listitem"><button type="button" class="pp-face-main" data-pp="create" aria-label="新建身份"><span class="pp-ring">${icon('plus')}</span><span class="pp-face-name">新建</span></button></div>`;
        // Mobile strip: every persona plus a trailing "new" face.
        strip.innerHTML = people.map(p => `<div class="pp-slide${p.current ? ' active' : ''}" data-avatar="${esc(p.avatar)}"><div class="pp-face-big"><span class="pp-big-pic">${picture(p, p.current ? 'full' : 'thumb')}</span>${p.current ? `<span class="pp-cam">${icon('camera')}</span>` : ''}<button type="button" class="pp-del" data-pp="delete" data-avatar="${esc(p.avatar)}" aria-label="删除 ${esc(p.name)}">${icon('x')}</button></div></div>`).join('')
            + `<div class="pp-slide add" data-add><div class="pp-face-big"><span class="pp-big-pic">${icon('plus')}</span></div></div>`;
        slides = [...strip.children];
        dots.innerHTML = slides.map(() => '<i></i>').join('');
        if (doc.activeElement !== bio) bio.value = active?.description || '';
        paint();
        if (!switching) win.requestAnimationFrame(() => centre(slides.find(s => s.classList.contains('active')) || slides[0], false));
    }
    const centred = () => {
        const mid = strip.scrollLeft + strip.clientWidth / 2;
        let best = slides[0], distance = Infinity;
        for (const slide of slides) { const d = Math.abs(slide.offsetLeft + slide.offsetWidth / 2 - mid); if (d < distance) { distance = d; best = slide; } }
        return best;
    };
    function centre(slide, smooth) { if (slide) strip.scrollTo({ left: slide.offsetLeft + slide.offsetWidth / 2 - strip.clientWidth / 2, behavior: smooth && !reduced() ? 'smooth' : 'auto' }); }
    function animate() { root.classList.add('pp-animating'); clearTimeout(animate.timer); animate.timer = setTimeout(() => root.classList.remove('pp-animating'), 420); }
    function paint() {
        const mid = strip.scrollLeft + strip.clientWidth / 2;
        for (const slide of slides) {
            const face = slide.querySelector('.pp-face-big');
            if (!switching) { face.style.removeProperty('--s'); face.style.removeProperty('--o'); continue; }
            const t = Math.min(1, Math.abs(slide.offsetLeft + slide.offsetWidth / 2 - mid) / (slide.offsetWidth || 1));
            face.style.setProperty('--s', (0.8 - 0.32 * t).toFixed(3));
            face.style.setProperty('--o', (1 - 0.6 * t).toFixed(3));
        }
        const slide = switching ? centred() : slides.find(s => s.classList.contains('active'));
        slides.forEach((s, i) => { s.classList.toggle('centre', s === slide); dots.children[i]?.classList.toggle('on', s === slide); });
        const person = people.find(p => p.avatar === slide?.dataset.avatar);
        const isAdd = !!slide?.hasAttribute('data-add'), isActive = !!person?.current;
        const nameSlot = root.querySelector('.pp-name-mobile');
        if (switching) nameSlot.innerHTML = `<span class="pp-name pp-name-static">${esc(isAdd ? '新建身份' : person?.name || '')}</span>`;
        else nameSlot.innerHTML = nameButton(active || { name: st.name1 || '你' });
        const status = root.querySelector('.pp-status-mobile');
        status.classList.toggle('other', switching && !isActive);
        status.lastElementChild.textContent = isAdd ? '创建一个新的身份' : (!switching || isActive) ? (active ? '当前使用中' : '尚未创建身份') : (person?.description || '没有描述');
        if (!switching) cta.innerHTML = `<button type="button" class="pp-pill" data-pp="open">${icon('swap')}切换身份</button>`;
        else if (isActive) cta.innerHTML = '<button type="button" class="pp-pill quiet" data-pp="cancel">取消</button>';
        else cta.innerHTML = `<button type="button" class="pp-pill quiet" data-pp="cancel">取消</button><button type="button" class="pp-pill solid" data-pp="use">${icon('check')}${isAdd ? '创建' : '使用此身份'}</button>`;
    }
    function openSwitcher() {
        if (busy) return;
        switching = true; animate(); root.classList.add('pp-switching');
        centre(slides.find(s => s.classList.contains('active')) || slides[0], false);
        win.requestAnimationFrame(paint);
    }
    function closeSwitcher(chosen) {
        switching = false; animate(); root.classList.remove('pp-switching');
        centre(slides.find(s => s.classList.contains('active')) || slides[0], true);
        paint();
        if (!chosen) return;
        if (chosen.hasAttribute('data-add')) { createPersona(); return; }
        const person = people.find(p => p.avatar === chosen.dataset.avatar);
        if (person && !person.current) {
            // Grow the chosen face into place before the host re-renders.
            slides.forEach(s => s.classList.toggle('active', s === chosen));
            centre(chosen, true); paint();
            switchTo(person);
        }
    }

    // ---- Events ----
    root.addEventListener('click', event => {
        const target = event.target.closest('[data-pp]');
        const action = target?.dataset.pp;
        if (action === 'close') { drawer.querySelector('.cwn-panel-back')?.click(); return; }
        if (action === 'rename') { renameInline(target); return; }
        if (action === 'avatar') { changeAvatar(); return; }
        if (action === 'pick') { switchTo(people.find(p => p.avatar === target.dataset.avatar)); return; }
        if (action === 'create') { createPersona(); return; }
        if (action === 'delete') { event.stopPropagation(); deletePersona(people.find(p => p.avatar === target.dataset.avatar)); return; }
        if (action === 'open') { openSwitcher(); return; }
        if (action === 'cancel') { closeSwitcher(null); return; }
        if (action === 'use') { closeSwitcher(centred()); return; }
        const slide = event.target.closest('.pp-slide');
        if (!slide) return;
        if (!switching) { if (slide.classList.contains('active')) changeAvatar(); return; }
        if (slide === centred()) closeSwitcher(slide); else centre(slide, true);
    }, { signal });
    dots.addEventListener('click', event => { const i = [...dots.children].indexOf(event.target); if (switching && i >= 0) centre(slides[i], true); }, { signal });
    strip.addEventListener('scroll', () => { if (switching) win.requestAnimationFrame(paint); }, { signal, passive: true });
    bio.addEventListener('blur', saveBio, { signal });
    bio.addEventListener('keydown', event => { if (event.key === 'Escape') { event.stopPropagation(); bio.value = active?.description || ''; bio.blur(); } }, { signal });
    root.addEventListener('error', event => {
        const img = event.target;
        if (img.tagName !== 'IMG' || !img.dataset.initial) return;
        const fallback = doc.createElement('i'); fallback.className = 'pp-initial'; fallback.textContent = img.dataset.initial; img.replaceWith(fallback);
    }, { capture: true, signal });
    doc.addEventListener('keydown', event => {
        if (event.key === 'Escape' && switching && drawer.classList.contains('openDrawer') && !doc.querySelector('dialog[open]')) { event.preventDefault(); event.stopImmediatePropagation(); closeSwitcher(null); }
    }, { capture: true, signal });
    win.addEventListener('resize', () => { if (switching && !mobile()) closeSwitcher(null); }, { signal });

    // Re-render after any native persona change; avatar uploads rebuild the native list.
    let queued = 0;
    const queue = (bump = false) => { if (bump) revision = Date.now(); if (!queued) queued = win.requestAnimationFrame(() => { queued = 0; if (!switching) render(); }); };
    const events = ['PERSONA_CHANGED', 'PERSONA_RENAMED', 'PERSONA_CREATED', 'PERSONA_DELETED', 'PERSONA_UPDATED', 'SETTINGS_UPDATED', 'CHAT_CHANGED'];
    const onEvent = () => queue();
    for (const key of events) if (st.event_types[key]) st.eventSource.on(st.event_types[key], onEvent);
    const nativeList = doc.getElementById('user_avatar_block');
    const listObserver = new win.MutationObserver(() => queue(true));
    if (nativeList) listObserver.observe(nativeList, { childList: true });
    // Leaving the panel always folds the switcher back.
    const drawerObserver = new win.MutationObserver(() => { if (!drawer.classList.contains('openDrawer') && switching) closeSwitcher(null); else if (drawer.classList.contains('openDrawer')) queue(); });
    drawerObserver.observe(drawer, { attributes: true, attributeFilter: ['class'] });
    render();

    return () => {
        disposed = true; abort.abort(); listObserver.disconnect(); drawerObserver.disconnect();
        if (queued) win.cancelAnimationFrame(queued);
        for (const key of events) if (st.event_types[key]) st.eventSource.removeListener(st.event_types[key], onEvent);
        root.remove(); drawer.classList.remove('cwn-persona-mounted');
    };
}
