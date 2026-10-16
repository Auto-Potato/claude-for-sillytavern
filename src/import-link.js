const labels = {character:'角色卡', worldbook:'世界书', preset:'预设'};

export function normalizeImportUrl(value) {
    let url;
    try { url = new URL(value.trim()); } catch { throw new Error('请粘贴完整的 HTTP 或 HTTPS 链接'); }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('请使用 HTTP 或 HTTPS 文件链接');
    if (url.hostname === 'github.com' && /^\/[^/]+\/[^/]+\/blob\//.test(url.pathname)) {
        url.hostname = 'raw.githubusercontent.com'; url.pathname = url.pathname.replace('/blob/', '/');
    }
    return url.href;
}

// The host's downloader keeps its existing domain allowlist. Direct downloads
// use browser CORS and never receive Tavern credentials or request headers.
export async function downloadImportFile(value, kind, {fetch:request, headers, signal}) {
    const url = normalizeImportUrl(value);
    const platform = /(^|\.)(chub\.ai|characterhub\.org|janitorai\.com|pygmalion\.chat|aicharactercards\.com|realm\.risuai\.net|perchance\.org)$/.test(new URL(url).hostname);
    const native = () => request('/api/content/importURL', {method:'POST',headers:headers(),body:JSON.stringify({url}),signal});
    let response;
    if (platform) response = await native();
    else {
        try { response = await request(url, {credentials:'omit',referrerPolicy:'no-referrer',signal}); }
        catch { if (signal?.aborted) throw new Error('下载已取消或超时'); }
        if (!response?.ok) response = await native();
    }
    if (!response?.ok) throw new Error('无法下载此链接，请使用文件直链，或先下载后从文件导入');
    const blob = await response.blob();
    if (blob.size > 25 * 1024 * 1024) throw new Error('文件较大，请先下载后从文件导入');
    const bytes = new Uint8Array(await blob.slice(0,8).arrayBuffer());
    const png = [137,80,78,71,13,10,26,10].every((b,i)=>bytes[i]===b);
    let data;
    if (!png) {
        try { data = JSON.parse(await blob.text()); } catch { throw new Error('链接返回的不是可导入文件，请使用文件下载链接'); }
    }
    const object = data && typeof data === 'object' && !Array.isArray(data);
    const cardValue = object && (data.data || data);
    const card = cardValue && typeof cardValue === 'object' && !Array.isArray(cardValue) ? cardValue : null;
    const matches = kind === 'character' ? png || (card && typeof card.name === 'string' && ('description' in card || 'first_mes' in card))
        : kind === 'worldbook' ? object && data.entries && typeof data.entries === 'object'
        : object && !data.entries && !data.spec && ['prompts','prompt_order','temperature','openai_max_tokens','openai_max_context','chat_completion_source'].some(key=>key in data);
    if (!matches) throw new Error(`这个链接中的文件不是${labels[kind]}`);
    const disposition = response.headers.get('content-disposition') || '';
    let name = /filename\*=UTF-8''([^;]+)/i.exec(disposition)?.[1] || /filename="?([^";]+)/i.exec(disposition)?.[1] || new URL(url).pathname.split('/').pop();
    try { name = decodeURIComponent(name || ''); } catch { name = ''; }
    name = name.replace(/[\\/<>:"|?*\x00-\x1f]/g,'_').replace(/\.(json|png)$/i,'').trim() || labels[kind];
    return new File([blob], `${name}.${png?'png':'json'}`, {type:png?'image/png':'application/json'});
}
