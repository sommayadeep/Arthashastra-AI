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

    // ★ Cache version — increment to bust old stale caches
    const CACHE_VERSION = 'v3';
    const cacheVersionKey = 'banking_news_version';
    if (localStorage.getItem(cacheVersionKey) !== CACHE_VERSION) {
        localStorage.removeItem('banking_news_cache');
        localStorage.removeItem('banking_news_cache_time');
        localStorage.setItem(cacheVersionKey, CACHE_VERSION);
    }

    // --- HELPER: Relative time label ---
    function getRelativeLabel(dateObj) {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const articleDay = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
        const diffMs = today - articleDay;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays <= 0) return 'TODAY';
        if (diffDays === 1) return 'YESTERDAY';
        if (diffDays <= 7) return `${diffDays} DAYS AGO`;
        return dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    }

    function isToday(dateObj) {
        const now = new Date();
        return dateObj.getDate() === now.getDate() &&
            dateObj.getMonth() === now.getMonth() &&
            dateObj.getFullYear() === now.getFullYear();
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

    // --- 2. DYNAMIC NEWS FETCH (RSS Proxy) ---
    async function fetchBankingNews(query = '') {
        const cacheKey = 'banking_news_cache';
        const cacheTime = localStorage.getItem(cacheKey + '_time');

        // Use cache if not expired (30 minutes for fresh news)
        if (!query && cacheTime && (Date.now() - parseInt(cacheTime) < 30 * 60 * 1000)) {
            const cached = JSON.parse(localStorage.getItem(cacheKey));
            if (cached && cached.length > 0) {
                // Restore Date objects from cached ISO strings
                cached.forEach(item => {
                    item.rawDate = new Date(item.rawDateISO);
                    item.relativeLabel = getRelativeLabel(item.rawDate);
                    item.isLive = isToday(item.rawDate);
                });
                return cached;
            }
        }

        if (loader) loader.style.display = 'block';
        if (newsGrid) newsGrid.innerHTML = '';

        const searchQuery = query ? `${query} banking india` : 'India banking finance RBI latest news 2026';
        const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(searchQuery)}&hl=en-IN&gl=IN&ceid=IN:en&when=1d`;
        const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`;

        try {
            const res = await fetch(apiUrl);
            const data = await res.json();

            if (data.status === 'ok') {
                const items = data.items.map(item => {
                    const analysis = analyzeRisk({ title: item.title, content: item.description });
                    const pubDate = new Date(item.pubDate);
                    return {
                        id: Math.random().toString(36).substr(2, 9),
                        title: item.title.split(' - ')[0],
                        source: item.title.split(' - ')[1] || 'Mainstream Media',
                        description: item.description.replace(/<[^>]*>?/gm, '').substring(0, 150) + '...',
                        date: pubDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
                        rawDate: pubDate,
                        rawDateISO: pubDate.toISOString(),
                        relativeLabel: getRelativeLabel(pubDate),
                        isLive: isToday(pubDate),
                        link: item.link,
                        riskLevel: analysis.level,
                        impactType: analysis.impact
                    };
                });

                // ★ Sort by date: NEWEST FIRST (most recent news always on top)
                items.sort((a, b) => b.rawDate - a.rawDate);

                if (!query) {
                    localStorage.setItem(cacheKey, JSON.stringify(items));
                    localStorage.setItem(cacheKey + '_time', Date.now().toString());
                }

                return items;
            }
        } catch (e) {
            console.error("Fetch failed", e);
        } finally {
            if (loader) loader.style.display = 'none';
        }
        return [];
    }

    // --- 3. RENDERING ENGINE (BROADCAST STYLE) ---
    function renderNews(items) {
        if (!newsGrid) return;
        newsGrid.innerHTML = items.length === 0 ? '<div style="text-align: center; padding: 60px;">No broadcast signals found for this sector.</div>' : '';

        // Update Statistics
        let high = 0, comp = 0, liq = 0;

        items.forEach((item, index) => {
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
        const highRiskItems = items.filter(i => i.riskLevel === 'high').concat(items.filter(i => i.title.toLowerCase().includes('rbi')));
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