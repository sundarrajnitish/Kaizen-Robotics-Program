/* Single active document isolates firmware controls and disposes old animation loops. */
(() => {
    const $ = id => document.getElementById(id);
    const items = window.EXPERIMENTS;
    let selected, level = 0;
    let theme = 'dark';
    try { theme = localStorage.getItem('kaizen-theme') || theme; } catch (_) {}
    const embeddedCSS = `
        :root{--bg:#161e1c;--panel:#161e1c;--ink:#e2e9e5;--muted:#9aa9a3;--line:#2b3733;--accent:#b6ed79;--accent-ink:#14200d;--code:#222d28;--on:#b6ed79;--hl:#2d3922;--hl-ink:#d5f4af;color-scheme:dark}
        :root[data-theme=light]{--bg:#fff;--panel:#fff;--ink:#172024;--muted:#56636a;--line:#d3d9d0;--accent:#346b24;--accent-ink:#fff;--code:#edf1e9;--on:#346b24;--hl:#edf5dc;--hl-ink:#34501a;color-scheme:light}
        body{background:var(--bg);overflow:hidden}header.top,.lede{display:none}main.demo{padding:0;gap:16px;grid-template-columns:minmax(0,1fr) 300px}.panel{padding:12px;border-radius:10px}.explain{padding:10px 5px 25px;color:var(--muted)}.explain h2{color:var(--ink)}:root[data-guide=hide] .explain{display:none}.btn,select{font-size:12px}.toolbar{gap:7px}a{overflow-wrap:anywhere}:focus-visible{outline:2px solid var(--accent);outline-offset:3px}@media(max-width:1150px){main.demo{grid-template-columns:1fr}aside{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:12px}.panel+.panel{margin-top:0}}@media(max-width:500px){aside{display:block}.panel+.panel{margin-top:12px}.slider{grid-template-columns:1fr}.logic-table{font-size:11px}.lcd{font-size:16px}}
    `;
    function configure() {
        $('simulation').contentWindow?.postMessage({type:'kaizen-settings', theme, guide:$('explain').checked}, '*');
    }
    function applyTheme() {
        document.documentElement.dataset.theme = theme;
        $('theme').setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`);
        configure();
    }
    $('theme').onclick = () => {
        theme = theme === 'dark' ? 'light' : 'dark';
        try { localStorage.setItem('kaizen-theme', theme); } catch (_) {}
        applyTheme();
    };
    function renderList() {
        const query = $('search').value.trim().toLowerCase();
        const visible = items.filter(x => (!level || x.level === level) && `${x.title} ${x.description}`.toLowerCase().includes(query));
        $('experiments').replaceChildren();
        visible.forEach(item => {
            const button = document.createElement('button');
            button.className = 'experiment';
            button.setAttribute('aria-current', String(item === selected));
            button.innerHTML = `<span class="mini" aria-hidden="true">${item.icon}</span><span><small>LEVEL ${item.level} / ${String(items.indexOf(item)+1).padStart(2,'0')}</small><strong></strong></span>`;
            button.querySelector('strong').textContent = item.title;
            button.onclick = () => select(item);
            $('experiments').append(button);
        });
        $('count').textContent = visible.length + ' / ' + items.length;
        $('empty').hidden = visible.length > 0;
    }
    function select(item) {
        selected = item;
        history.replaceState(null, '', '#' + item.id);
        $('title').textContent = item.title;
        $('description').textContent = item.description;
        $('meta').textContent = `EXPERIMENT ${String(items.indexOf(item)+1).padStart(2,'0')} / LEVEL ${item.level} / ${item.level === 1 ? 'ATMEGA16 · EMBEDDED C' : 'ARDUINO'}`;
        $('loading').hidden = false;
        const [file, query = ''] = item.url.split('?');
        let doc = window.EXPERIMENT_DOCUMENTS[file];
        doc = doc.replaceAll('new URLSearchParams(location.search)', `new URLSearchParams(${JSON.stringify(query)})`);
        doc = doc.replace('<head>', `<head><base href="${new URL('.', location.href).href}">`);
        doc = doc.replace('</head>', `<style>${embeddedCSS}</style></head>`);
        const bridge = `
            const sendSize = () => parent.postMessage({type:'kaizen-size',height:document.body.scrollHeight},'*');
            new ResizeObserver(sendSize).observe(document.body);
            addEventListener('message',e=>{if(e.source!==parent||e.data.type!=='kaizen-settings')return;document.documentElement.dataset.theme=e.data.theme;document.documentElement.dataset.guide=e.data.guide?'show':'hide';requestAnimationFrame(sendSize)});
            parent.postMessage({type:'kaizen-ready'},'*');
        `;
        doc = doc.replace('</body>', '<script>' + bridge + '</script></body>');
        $('simulation').title = item.title + ' interactive simulation';
        $('simulation').srcdoc = doc;
        renderList();
    }
    addEventListener('message', e => {
        if(e.source !== $('simulation').contentWindow) return;
        if(e.data.type === 'kaizen-ready') { $('loading').hidden = true; configure(); }
        if(e.data.type === 'kaizen-size' && Number.isFinite(e.data.height)) $('simulation').style.height = Math.max(300,e.data.height+4) + 'px';
    });
    $('search').oninput = renderList;
    document.querySelectorAll('[data-level]').forEach(button => button.onclick = () => {
        level = +button.dataset.level;
        document.querySelectorAll('[data-level]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
        renderList();
    });
    $('next').onclick = () => select(items[(items.indexOf(selected)+1)%items.length]);
    $('restart').onclick = () => select(selected);
    $('explain').onchange = configure;
    addEventListener('hashchange', () => { const item = items.find(x => '#'+x.id === location.hash); if(item && item !== selected) select(item); });
    applyTheme();
    select(items.find(x => '#'+x.id === location.hash) || items[1]);
})();
