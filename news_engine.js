// Arthashastra AI – Banking News & Regulatory Intelligence Engine
// Architected for real-time monitoring of the Indian Banking Ecosystem

document.addEventListener('DOMContentLoaded', () => {
    // Selectors
    const newsGrid = document.querySelector('#newsGrid');
    const circularsList = document.querySelector('#circularsList');
    const archiveBody = document.querySelector('#archiveBody');
    const loader = document.querySelector('#loader');
    const refreshBtn = document.querySelector('#refreshBtn');
    const tickerContent = document.querySelector('#tickerContent');

    // Filters
    const bankSearch = document.querySelector('#bankSearch');
    const categoryFilter = document.querySelector('#categoryFilter');

    // Heatmap Counters
    const highRiskCount = document.querySelector('#highRiskCount');
    const complianceCount = document.querySelector('#complianceCount');
    const liquidityCount = document.querySelector('#liquidityCount');

    let GLOBAL_NEWS = [];
    let LAST_NEWS_NOTE = null;
    let LAST_NEWS_DEBUG = null;

    // Feed configuration
    // - LIVE: what gets the "LIVE BROADCAST" tag
    // - FEED: how far back we pull to ensure we always have enough items
    // - FETCH: how many items we fetch from backend
    // - DISPLAY: how many latest items we show (fills with older items if needed)
    const LIVE_WINDOW_HOURS = 24;
    const FEED_WINDOW_HOURS = 24 * 7; // 7 days
    const FEED_FETCH_LIMIT = 30;
    const FEED_DISPLAY_LIMIT = 9;

    function escapeHtml(s) {
        return String(s ?? '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#039;');
    }

    function normalizeBaseUrl(url) {
        return (url || '').trim().replace(/\/+$/, '');
    }

    function getBackendBase() {
        const stored = localStorage.getItem('arthashastra_backend_base');
        if (stored) return normalizeBaseUrl(stored);
        // Default (Render)
        return 'https://ashstrashastra-backend.onrender.com';
    }

    function getBackendCandidates() {
        const candidates = [];
        const stored = normalizeBaseUrl(localStorage.getItem('arthashastra_backend_base'));
        if (stored) candidates.push(stored);

        // Known Render service URLs (try a few common project names)
        candidates.push('https://ashstrashastra-backend.onrender.com');
        candidates.push('https://ashstrashastra-ai-backend.onrender.com');
        candidates.push('https://arthashastra-ai-backend.onrender.com');

        // Same-origin (for setups with a proxy/rewrite)
        candidates.push('');

        // Local dev backend
        candidates.push('http://localhost:5050');
        candidates.push('http://127.0.0.1:5050');

        return [...new Set(candidates.map(normalizeBaseUrl))];
    }

    // ★ Cache version — increment to bust old stale caches
    const CACHE_VERSION = 'v5';
    const cacheVersionKey = 'banking_news_version';
    if (localStorage.getItem(cacheVersionKey) !== CACHE_VERSION) {
        localStorage.removeItem('banking_news_cache');
        localStorage.removeItem('banking_news_cache_time');
        localStorage.setItem(cacheVersionKey, CACHE_VERSION);
    }

    // --- HELPER: Relative time label ---
    function getRelativeLabel(dateObj) {
        const now = new Date();
        const diffMs = now - dateObj;
        const diffMin = Math.floor(diffMs / (1000 * 60));
        const diffHr = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDay = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffMs < 0) return 'SCHEDULED';
        if (diffMin <= 2) return 'JUST NOW';
        if (diffMin < 60) return `${diffMin} MIN AGO`;
        if (diffHr < 24) return `${diffHr} HOURS AGO`;
        if (diffDay === 1) return 'YESTERDAY';
        if (diffDay <= 7) return `${diffDay} DAYS AGO`;
        return dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    }

    function isLiveWindow(dateObj, hours = 24) {
        const now = Date.now();
        return (now - dateObj.getTime()) <= hours * 60 * 60 * 1000;
    }

    // --- 1. AI RISK IMPACT ENGINE ---
    function analyzeRisk(item) {
        const text = (item.title + ' ' + item.content).toLowerCase();

        let riskLevel = 'low';
        let impactType = 'Informational';
        let keywordsFound = [];

        const riskMatrix = {
            high: ['penalty', 'fraud', 'scam', 'npa', 'default', 'violation', 'fine', 'regulatory action', 'liquidation', 'bad loans', 'pmla'],
            moderate: ['merger', 'acquisition', 'rate hike', 'downgrade', 'liquidity', 'compliance failure', 'capital adequacy', 'bad debt', 'investigation'],
            informational: ['guidelines', 'circular', 'new service', 'growth', 'digital', 'lending', 'appointment', 'results']
        };

        // Detect keywords
        [...riskMatrix.high, ...riskMatrix.moderate].forEach(kw => {
            if (text.includes(kw)) keywordsFound.push(kw);
        });

        if (riskMatrix.high.some(kw => text.includes(kw))) {
            riskLevel = 'high';
            impactType = 'Reputation/Compliance';
        } else if (riskMatrix.moderate.some(kw => text.includes(kw))) {
            riskLevel = 'moderate';
            impactType = 'Operational/Credit';
        }

        // Refine impact based on keywords
        if (text.includes('liquidity')) impactType = 'Liquidity Impact';
        if (text.includes('capital') || text.includes('adequacy')) impactType = 'Capital Adequacy';
        if (text.includes('kyc') || text.includes('rbi')) impactType = 'Compliance Impact';
        if (text.includes('loan') || text.includes('npa')) impactType = 'Credit Risk';

        return { level: riskLevel, impact: impactType, kw: keywordsFound };
    }

    // --- 2. DYNAMIC NEWS FETCH (Backend RSS) ---
    async function fetchBankingNews(query = '') {
        const cacheKey = 'banking_news_cache';
        const cacheTime = localStorage.getItem(cacheKey + '_time');
        const cachedAny = (() => {
            try {
                const raw = localStorage.getItem(cacheKey);
                const parsed = raw ? JSON.parse(raw) : null;
                return Array.isArray(parsed) ? parsed : null;
            } catch {
                return null;
            }
        })();

        // Use cache if not expired (60 seconds; keep it truly live)
        if (!query && cacheTime && (Date.now() - parseInt(cacheTime) < 60 * 1000)) {
            const cached = JSON.parse(localStorage.getItem(cacheKey));
            if (cached && cached.length > 0) {
                // Restore Date objects from cached ISO strings
                cached.forEach(item => {
                    item.rawDate = new Date(item.rawDateISO);
                    item.relativeLabel = getRelativeLabel(item.rawDate);
                    item.isLive = isLiveWindow(item.rawDate, LIVE_WINDOW_HOURS);
                });
                return cached;
            }
        }

        if (loader) loader.style.display = 'block';
        if (newsGrid) newsGrid.innerHTML = '';

        const searchQuery = query ? query : 'Indian Banking Sector';
        const qs = `q=${encodeURIComponent(searchQuery)}&hours=${FEED_WINDOW_HOURS}&limit=${FEED_FETCH_LIMIT}`;
        const apiUrls = getBackendCandidates().map(base => (base ? `${base}/api/news?${qs}` : `/api/news?${qs}`));

        try {
            const attempts = [];
            for (const apiUrl of apiUrls) {
                try {
                    const res = await fetch(apiUrl, { cache: 'no-store' });
                    if (!res.ok) {
                        attempts.push({ url: apiUrl, error: `HTTP ${res.status}` });
                        continue;
                    }
                    const data = await res.json();

                    if (data.status === 'success' && Array.isArray(data.items)) {
                        const items = data.items.map(item => {
                            const pubDate = item.published_at ? new Date(item.published_at) : new Date(item.pubDate || Date.now());
                            const analysis = {
                                level: (item.risk_impact_level || 'Low').toLowerCase() === 'moderate' ? 'moderate' : ((item.risk_impact_level || 'Low').toLowerCase() === 'high' ? 'high' : 'low'),
                                impact: item.impact_type || 'Informational'
                            };
                            return {
                                id: Math.random().toString(36).substr(2, 9),
                                title: item.title || '—',
                                source: item.source || 'Google News',
                                description: (item.summary || '').substring(0, 150) + ((item.summary || '').length > 150 ? '...' : ''),
                                date: pubDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
                                rawDate: pubDate,
                                rawDateISO: pubDate.toISOString(),
                                relativeLabel: getRelativeLabel(pubDate),
                                isLive: isLiveWindow(pubDate, LIVE_WINDOW_HOURS),
                                link: item.link,
                                riskLevel: analysis.level,
                                impactType: analysis.impact
                            };
                        });

                        // ★ Sort by date: NEWEST FIRST (most recent news always on top)
                        items.sort((a, b) => b.rawDate - a.rawDate);
                        LAST_NEWS_NOTE = data.note || null;
                        LAST_NEWS_DEBUG = attempts.length ? attempts : null;

                        if (!query) {
                            localStorage.setItem(cacheKey, JSON.stringify(items));
                            localStorage.setItem(cacheKey + '_time', Date.now().toString());
                        }

                        return items;
                    }

                    attempts.push({ url: apiUrl, error: (data?.note || data?.message || 'Unexpected response') });
                } catch (e) {
                    attempts.push({ url: apiUrl, error: String(e?.message || e) });
                }
            }

            LAST_NEWS_DEBUG = attempts.length ? attempts : null;
            const best = attempts.find(a => a.error && a.error !== 'Failed to fetch') || attempts[0] || null;
            LAST_NEWS_NOTE = best ? best.error : null;

            // Fallback: if backend is unreachable, show last cached headlines (even if stale)
            if (!query && cachedAny && cachedAny.length > 0) {
                cachedAny.forEach(item => {
                    item.rawDate = new Date(item.rawDateISO);
                    item.relativeLabel = getRelativeLabel(item.rawDate);
                    item.isLive = isLiveWindow(item.rawDate, LIVE_WINDOW_HOURS);
                });
                LAST_NEWS_NOTE = `Backend unreachable. Showing cached headlines. (${LAST_NEWS_NOTE || 'No details'})`;
                return cachedAny;
            }
        } catch (e) {
            console.error("Fetch failed", e);
            LAST_NEWS_NOTE = String(e?.message || e);
        } finally {
            if (loader) loader.style.display = 'none';
        }
        return [];
    }

    // --- 3. RENDERING ENGINE (BROADCAST STYLE) ---
    function renderNews(items) {
        if (!newsGrid) return;
        const displayItems = items.slice(0, FEED_DISPLAY_LIMIT);
        if (displayItems.length === 0) {
            const note = LAST_NEWS_NOTE ? `<div style="margin-top: 14px; font-size: 0.85rem; color: var(--text-secondary); line-height: 1.5;">${escapeHtml(LAST_NEWS_NOTE)}</div>` : '';
            const debug = (LAST_NEWS_DEBUG && LAST_NEWS_DEBUG.length)
                ? `<details style="margin-top: 14px; text-align: left; display: inline-block; max-width: 820px;"><summary style="cursor: pointer; color: var(--text-secondary); font-weight: 800; letter-spacing: 1px;">DEBUG</summary><div style="margin-top: 10px; font-size: 0.75rem; color: var(--text-secondary); line-height: 1.6;">${LAST_NEWS_DEBUG.map(a => `${escapeHtml(a.url)}<br><span style="opacity:0.9;">→ ${escapeHtml(a.error)}</span>`).join('<br><br>')}</div></details>`
                : '';
            const hint = LAST_NEWS_NOTE ? `<div style="margin-top: 10px; font-size: 0.75rem; color: var(--text-secondary); opacity: 0.9;">Tip: set <code style="background: rgba(0,0,0,0.04); padding: 2px 6px; border-radius: 6px;">localStorage.arthashastra_backend_base</code> to your backend URL and click RESCAN.</div>` : '';
            const localHint = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
                ? `<div style="margin-top: 10px; font-size: 0.75rem; color: var(--text-secondary); opacity: 0.9;">Local fix: start the backend in another terminal with <code style="background: rgba(0,0,0,0.04); padding: 2px 6px; border-radius: 6px;">python3 app.py</code> (port 5050) and refresh.</div>`
                : '';
            newsGrid.innerHTML = `<div style="text-align: center; padding: 60px;">No broadcast signals found for this sector.${note}${hint}${localHint}${debug}</div>`;
            if (highRiskCount) highRiskCount.textContent = '0';
            if (complianceCount) complianceCount.textContent = '0';
            if (liquidityCount) liquidityCount.textContent = '0';
            return;
        }
        newsGrid.innerHTML = '';

        // Update Statistics
        let high = 0, comp = 0, liq = 0;

        displayItems.forEach((item, index) => {
            if (item.riskLevel === 'high') high++;
            if (item.impactType.includes('Compliance')) comp++;
            if (item.impactType.includes('Liquidity')) liq++;

            const article = document.createElement('div');
            article.className = 'news-item';
            article.style.animationDelay = `${index * 0.15}s`;

            const riskClass = `risk-${item.riskLevel}`;

            article.innerHTML = `
                <div class="news-meta">
                    <div class="source-badge">${item.source}</div>
                    <div style="font-weight: 900; font-size: 0.9rem; color: var(--text-secondary); margin-top: 10px;">${item.date}</div>
                    <div style="font-size: 0.65rem; font-weight: 800; color: ${item.isLive ? 'var(--broadcast-red)' : 'var(--antique-gold)'}; margin-top: 4px; letter-spacing: 1px;">${item.relativeLabel}</div>
                </div>
                <div class="news-content">
                    ${item.isLive ? '<div class="live-tag"><div class="live-dot"></div> LIVE BROADCAST</div>' : ''}
                    <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 5px;">
                        <span class="risk-pill ${riskClass}">${item.riskLevel.toUpperCase()} RISK</span>
                        <span class="impact-tag">${item.impactType.toUpperCase()}</span>
                    </div>
                    <a href="${item.link}" target="_blank" class="news-headline">${item.title}</a>
                    <p class="summary-news">${item.description}</p>
                </div>
            `;
            newsGrid.appendChild(article);
        });

        // Update Overlays
        if (highRiskCount) highRiskCount.textContent = high;
        if (complianceCount) complianceCount.textContent = comp;
        if (liquidityCount) liquidityCount.textContent = liq;

        // Update Ticker — show most recent high-risk or RBI items
        const highRiskItems = displayItems.filter(i => i.riskLevel === 'high').concat(displayItems.filter(i => i.title.toLowerCase().includes('rbi')));
        if (tickerContent && highRiskItems.length > 0) {
            tickerContent.innerHTML = highRiskItems.map(i => ` <span style="color: var(--antique-gold);">●</span> ${i.title.toUpperCase()}`).join(' &nbsp;&nbsp;&nbsp;&nbsp; ');
        }
    }

    // --- 4. RBI CIRCULARS (NEWS LIST STYLE) ---
    function renderCirculars() {
        if (!circularsList) return;
        const circulars = [
            { id: 'RBI/2026/142', title: 'Master Direction on Foreign Investment', date: 'FEB 26', cat: 'PRUDENTIAL' },
            { id: 'RBI/2026/138', title: 'Microfinance Loans Review', date: 'FEB 24', cat: 'LENDING' },
            { id: 'RBI/2026/135', title: 'Basel III Capital Standards', date: 'FEB 20', cat: 'CAPITAL' },
            { id: 'RBI/2026/131', title: 'Cyber Framework for Cooperative Banks', date: 'FEB 15', cat: 'SECURITY' }
        ];

        circularsList.innerHTML = circulars.map(c => `
            <div class="circular-item">
                <div style="font-size: 0.65rem; font-weight: 800; color: var(--antique-gold);">${c.id}</div>
                <a href="#" style="text-decoration: none; color: var(--imperial-indigo); font-weight: 700; font-size: 1rem; display: block; margin: 5px 0;">${c.title}</a>
                <div style="display: flex; justify-content: space-between; font-size: 0.7rem; font-weight: 800; text-transform: uppercase;">
                    <span style="color: var(--text-secondary);">${c.date}</span>
                    <span style="color: var(--high-risk);">${c.cat}</span>
                </div>
            </div>
        `).join('');
    }

    // --- 5. HERALD ARCHIVE (CLEAN TABLE) ---
    function renderArchive() {
        if (!archiveBody) return;
        const archive = [
            { date: 'DEC 12', title: 'KYC Enforcement Action', cat: 'RISK' },
            { date: 'OCT 05', title: 'Agri-Loan Digitization', cat: 'AGRI' },
            { date: 'SEP 15', title: 'Fair Lending Norms', cat: 'GOV' }
        ];

        archiveBody.innerHTML = archive.map(a => `
            <tr>
                <td style="font-weight: 900; color: var(--imperial-indigo);">${a.date}</td>
                <td style="color: var(--text-secondary);">${a.title}</td>
                <td style="text-align: right;"><span class="impact-tag" style="padding: 2px 6px; font-size: 0.6rem;">${a.cat}</span></td>
            </tr>
        `).join('');
    }

    // --- 6. EVENT LISTENERS ---
    if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
            // Clear cache to force fresh fetch on manual refresh
            localStorage.removeItem('banking_news_cache');
            localStorage.removeItem('banking_news_cache_time');
            const query = bankSearch.value;
            GLOBAL_NEWS = await fetchBankingNews(query);
            renderNews(GLOBAL_NEWS);
        });
    }

    if (categoryFilter) {
        categoryFilter.addEventListener('change', () => {
            const val = categoryFilter.value;
            if (val === 'all') renderNews(GLOBAL_NEWS);
            else if (val === 'rbi') renderNews(GLOBAL_NEWS.filter(n => n.title.toLowerCase().includes('rbi') || n.impactType.includes('Compliance')));
            else if (val === 'risk') renderNews(GLOBAL_NEWS.filter(n => n.riskLevel === 'high' || n.impactType.includes('Credit')));
            else if (val === 'compliance') renderNews(GLOBAL_NEWS.filter(n => n.impactType.includes('Compliance')));
        });
    }

    // Initial Load
    (async function init() {
        GLOBAL_NEWS = await fetchBankingNews();
        renderNews(GLOBAL_NEWS);
        renderCirculars();
        renderArchive();
    })();
});
