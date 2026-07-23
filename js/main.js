// ============================================================
// RSS 取得・パース
// ============================================================
const OGP_PLACEHOLDER = 'common/ogp';
const isValidThumb = (url) => !!url && !url.includes(OGP_PLACEHOLDER);

function getTagText(el, tagName) {
    const node = el.getElementsByTagName(tagName)[0];
    return node ? (node.textContent || '').trim() : '';
}

function getItemLink(itemEl) {
    for (const child of itemEl.childNodes) {
        if (child.nodeName === 'link') return (child.textContent || '').trim();
    }
    return getTagText(itemEl, 'link');
}

function getThumb(itemEl) {
    const rawXml = new XMLSerializer().serializeToString(itemEl);
    const patterns = [
        /<(?:[^:]+:)?thumbnail[^>]*>([^<]+)<\/(?:[^:]+:)?thumbnail>/i,
        /<(?:[^:]+:)?(?:thumbnail|content)[^>]+url=["\']([^"\']+)["\']/i,
        /<enclosure[^>]+url=["\']([^"\']+)["\']/i,
        /https?:\/\/assets\.st-note\.com\/[^\s"'<>&]+\.(?:jpe?g|png|webp)/i,
    ];
    for (const re of patterns) {
        const m = rawXml.match(re);
        const url = m && (m[1] || m[0]).trim();
        if (isValidThumb(url)) return url;
    }
    return null;
}

function fetchWithTimeout(url, ms = 10000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer));
}

async function fetchRSS(rssUrl, onProgress) {
    const MAX_RETRY = 10;
    for (let i = 0; i < MAX_RETRY; i++) {
        if (onProgress) onProgress(i + 1, MAX_RETRY);
        try {
            const res = await fetchWithTimeout(`${CONFIG.corsProxy}${rssUrl}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const result = parseXML(await res.text());
            if (result) return result;
            throw new Error('parse failed');
        } catch (e) {
            if (i < MAX_RETRY - 1) await new Promise(r => setTimeout(r, 300));
        }
    }
    return null;
}

function parseXML(xmlStr) {
    if (!xmlStr) return null;
    try {
        const xml = new DOMParser().parseFromString(xmlStr, 'text/xml');
        if (xml.querySelector('parsererror')) return null;
        const itemEls = Array.from(xml.getElementsByTagName('item'));
        if (itemEls.length === 0) return null;
        const items = itemEls.map(el => ({
            title: getTagText(el, 'title'),
            link: getItemLink(el),
            pubDate: getTagText(el, 'pubDate'),
            extractedThumb: getThumb(el),
        }));
        items.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
        return { status: 'ok', items };
    } catch (e) { return null; }
}

function onThumbError(img, initial) {
    img.style.display = 'none';
    const p = img.parentElement;
    if (p && !p.querySelector('.thumb-fallback')) {
        const fb = document.createElement('div');
        fb.className = 'thumb-fallback w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200';
        fb.innerHTML = `<span class="text-2xl font-bold text-slate-400">${initial || '?'}</span>`;
        p.appendChild(fb);
    }
}

// ============================================================
// フィード描画（共通ヘルパー）
// ============================================================
const THEMES = {
    hero: { text: 'text-white/60', idle: 'bg-white/20', active: 'bg-orange-500' },
    grid: { text: 'text-slate-400', idle: 'bg-slate-200', active: 'bg-slate-700' },
};

// containerId → 再読み込み用のローダー（リトライボタンから呼ぶ）
const FEEDS = {};
function retryFeed(containerId) { if (FEEDS[containerId]) FEEDS[containerId](); }

function loadingMarkup(containerId, theme, full) {
    const dots = [...Array(10)].map((_, i) =>
        `<div class="w-1.5 h-1.5 rounded-full ${theme.idle}" id="${containerId}-dot-${i}"></div>`).join('');
    return `
        <div class="${full ? 'w-full ' : ''}flex flex-col items-center justify-center gap-2 ${full ? 'py-10' : 'py-4'} text-center">
            <p class="${theme.text} text-xs font-bold">読み込み中 <span id="${containerId}-count">1</span> / 10</p>
            <div class="flex gap-1">${dots}</div>
        </div>`;
}

function progressHandler(containerId, theme) {
    return (n) => {
        const c = document.getElementById(`${containerId}-count`);
        if (c) c.textContent = n;
        for (let i = 0; i < 10; i++) {
            const d = document.getElementById(`${containerId}-dot-${i}`);
            if (d) d.className = `w-1.5 h-1.5 rounded-full ${n > i ? theme.active : theme.idle}`;
        }
    };
}

function retryMarkup(containerId, theme, full) {
    const btn = theme === THEMES.hero
        ? 'bg-white/10 hover:bg-white/20 border border-white/30 hover:border-white/50 text-white'
        : 'bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600';
    return `
        <div class="${full ? 'w-full ' : ''}flex flex-col items-center justify-center gap-3 ${full ? 'py-10' : 'py-6'} text-center">
            <p class="${theme.text} text-xs font-bold">一時的に読み込めません</p>
            <button onclick="retryFeed('${containerId}')"
                class="px-5 py-2 ${btn} rounded-lg text-[11px] font-bold tracking-widest uppercase transition-all">
                リトライ
            </button>
        </div>`;
}

function renderThumb(item, { imgClass, fallbackWrap, fallbackText }) {
    const initial = (item.title || '?').charAt(0);
    if (item.extractedThumb) {
        return `<img src="${item.extractedThumb}" alt="" class="${imgClass}" loading="lazy" onerror="onThumbError(this,'${initial}')">`;
    }
    return `<div class="${fallbackWrap}"><span class="${fallbackText}">${initial}</span></div>`;
}

// 世話人セクション（カードグリッド）
function gridCard(item) {
    const thumb = renderThumb(item, {
        imgClass: 'w-full h-full object-cover',
        fallbackWrap: 'w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200',
        fallbackText: 'text-2xl font-bold text-slate-400',
    });
    const title = item.title.replace(/^TAGEN世話人[:：]\s*/, '');
    return `<a href="${item.link}" target="_blank" class="cursor-pointer transition-all duration-400 ease-in-out hover:-translate-y-2.5 hover:scale-[1.02] hover:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.15)] group bg-white rounded-xl overflow-hidden shadow-sm border border-slate-100 flex flex-col h-full w-40 md:w-48 text-center text-slate-800">
        <div class="aspect-4/3 overflow-hidden bg-slate-100 relative">${thumb}<div class="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity"></div></div>
        <div class="p-5 grow flex items-center justify-center text-slate-800">
            <h5 class="text-slate-800 line-clamp-3 group-hover:text-slate-700 transition-colors leading-snug">${title}</h5>
        </div></a>`;
}

// 最新情報（Hero パネルの横並びリスト）
function heroItem(item) {
    const date = new Date(item.pubDate).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' });
    const thumb = renderThumb(item, {
        imgClass: 'w-full h-full object-cover group-hover:scale-105 transition-transform duration-500',
        fallbackWrap: 'w-full h-full flex items-center justify-center',
        fallbackText: 'text-2xl font-bold text-white/60',
    });
    return `<a href="${item.link}" target="_blank" class="group flex gap-3 items-start p-1.5 rounded-lg hover:bg-white/20 transition-all border border-transparent hover:border-white/30 text-white">
        <div class="w-32 h-20 bg-white/20 rounded-md overflow-hidden shrink-0 border border-white/20 shadow-md">${thumb}</div>
        <div class="grow min-w-0 text-left text-white pt-0.5">
            <div class="text-xs font-bold text-white/50 mb-1 tracking-widest uppercase">${date}</div>
            <h5 class="text-sm font-bold text-white line-clamp-3 leading-snug group-hover:text-orange-500 transition-colors">${item.title}</h5>
        </div></a>`;
}

async function loadFeed({ containerId, rssUrl, theme, full, limit, renderItem }) {
    const container = document.getElementById(containerId);
    if (!container) return;
    FEEDS[containerId] = () => loadFeed({ containerId, rssUrl, theme, full, limit, renderItem });
    container.innerHTML = loadingMarkup(containerId, theme, full);
    const data = await fetchRSS(rssUrl, progressHandler(containerId, theme));
    container.innerHTML = data
        ? data.items.slice(0, limit).map(renderItem).join('')
        : retryMarkup(containerId, theme, full);
}

// ============================================================
// CONFIG 適用・スライドショー・スクロール
// ============================================================
function applyConfig() {
    const slidesEl = document.getElementById('hero-slides');
    if (slidesEl) {
        slidesEl.innerHTML = CONFIG.heroImages.map((url, i) =>
            `<div class="hero-slide${i === 0 ? ' active' : ''}" style="background-image:url('${url}')"></div>`
        ).join('');
    }
    const projGrid = document.getElementById('cfg-projects-grid');
    if (projGrid) {
        projGrid.innerHTML = CONFIG.projects.map(p => {
            return `<a href="${p.url}" target="_blank" class="cursor-pointer transition-all duration-400 ease-in-out hover:-translate-y-2.5 hover:scale-[1.02] hover:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.15)] group bg-white rounded-xl overflow-hidden shadow-sm border border-slate-100 flex flex-col text-slate-800 w-full md:w-[47%] lg:w-[22%]">
                <div class="aspect-video bg-slate-200 overflow-hidden relative">
                    <img src="${p.img}" alt="${p.name}" class="w-full h-full object-cover opacity-60 group-hover:opacity-100" onerror="onThumbError(this,'${(p.name || '?').charAt(0)}')">
                    <div class="absolute inset-0 bg-linear-to-t 'from-slate-500/20' to-transparent"></div>
                </div>
                <div class="p-6 text-left grow">
                    <h3 class="font-bold mb-2 text-xl group-hover:text-slate-700 transition-colors">${p.name}</h3>
                    <p class="text-sm text-slate-500 leading-relaxed text-justify">${p.desc}</p>
                </div></a>`;
        }).join('');
    }
}

function startSlideshow() {
    const slides = Array.from(document.querySelectorAll('#hero-slides .hero-slide'));
    if (slides.length < 2) return;
    let current = 0;
    setInterval(() => {
        slides[current].classList.remove('active');
        current = (current + 1) % slides.length;
        slides[current].classList.add('active');
    }, CONFIG.heroSlideshowInterval);
}

window.addEventListener('load', () => {
    applyConfig();
    startSlideshow();
    loadFeed({ containerId: 'rss-feed-2', rssUrl: CONFIG.newsRssUrl, theme: THEMES.hero, full: false, limit: 4, renderItem: heroItem });
    loadFeed({ containerId: 'rss-feed-1', rssUrl: CONFIG.membersRssUrl, theme: THEMES.grid, full: true, limit: 15, renderItem: gridCard });
});

window.addEventListener('scroll', () => {
    const sections = document.querySelectorAll('section');
    const navLinks = document.querySelectorAll('nav a');
    let current = '';
    sections.forEach(section => { if (pageYOffset >= section.offsetTop - 120) current = section.getAttribute('id'); });
    navLinks.forEach(link => {
        link.classList.remove('text-slate-700', 'text-slate-400');
        if (link.getAttribute('href').includes(current) && current !== '') link.classList.add('text-slate-700');
    });
});
