// Arthashastra AI - Banking News & Regulatory Intelligence Engine
// Styled as a live newsroom while staying fast on first paint.

document.addEventListener('DOMContentLoaded', () => {
    const q = (selector) => document.querySelector(selector);

    const newsGrid = q('#newsGrid');
    const circularsList = q('#circularsList');
    const archiveBody = q('#archiveBody');
    const loader = q('#loader');
    const refreshBtn = q('#refreshBtn');
    const tickerContent = q('#tickerContent');
    const searchStatus = q('#newsSearchStatus');
    const bankSearch = q('#bankSearch');
    const categoryFilter = q('#categoryFilter');
    const highRiskCount = q('#highRiskCount');
    const complianceCount = q('#complianceCount');
    const liquidityCount = q('#liquidityCount');
    const leadStoryCard = q('#leadStoryCard');
    const watchlistRail = q('#watchlistRail');
    const newsTimestamp = q('#newsTimestamp');
    const leadSignalMix = q('#leadSignalMix');
    const feedHeartbeat = q('#feedHeartbeat');
    const newsDeskNote = q('#newsDeskNote');
    const editorialBrief = q('#editorialBrief');
    const editorialTags = q('#editorialTags');
    const feedCountBadge = q('#feedCountBadge');

    let GLOBAL_NEWS = [];
    let LAST_NEWS_NOTE = null;
    let LAST_NEWS_DEBUG = null;
    let ACTIVE_QUERY = '';
    let searchDebounce = null;
    let LAST_FEED_SOURCE = 'idle';
    let LAST_SYNCED_AT = null;

    const LIVE_WINDOW_HOURS = 24;
    const FEED_WINDOW_HOURS = 24 * 5;
    const FEED_FETCH_LIMIT = 24;
    const FEED_DISPLAY_LIMIT = 8;
    const FRESH_CACHE_TTL_MS = 3 * 60 * 1000;

    function escapeHtml(value) {
        return String(value ?? '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#039;');
    }

    function safeUrl(url) {
        const value = String(url || '').trim();
        return /^https?:\/\//i.test(value) ? value : '#';
    }

    function normalizeBaseUrl(url) {
        return String(url || '').trim().replace(/\/+$/, '');
    }

    function isLocalFrontend() {
        return /^(localhost|127\.0\.0\.1)$/i.test(location.hostname);
    }

    function setRefreshState(loading) {
        if (!refreshBtn) return;
        refreshBtn.disabled = loading;
        refreshBtn.textContent = loading ? 'SYNCING...' : 'REFRESH FEED';
        refreshBtn.style.opacity = loading ? '0.75' : '1';
    }

    function updateSearchStatus(message) {
        if (searchStatus) searchStatus.textContent = message;
    }

    function getBackendBase() {
        const stored = normalizeBaseUrl(localStorage.getItem('arthashastra_backend_base'));
        if (stored) return stored;
        return isLocalFrontend() ? '' : 'https://ashstrashastra-backend.onrender.com';
    }

    function getBackendCandidates() {
        const candidates = [];
        const preferred = getBackendBase();
        if (preferred) candidates.push(preferred);

        if (!isLocalFrontend()) {
            candidates.push('');
            candidates.push('https://ashstrashastra-ai-backend.onrender.com');
            candidates.push('https://arthashastra-ai-backend.onrender.com');
        } else {
            candidates.push('');
            candidates.push('http://localhost:5050');
            candidates.push('http://127.0.0.1:5050');
        }

        return [...new Set(candidates.map(normalizeBaseUrl))];
    }

    async function fetchWithTimeout(url, options = {}, timeoutMs = 12000) {
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
        try {
            return await fetch(url, { ...options, signal: controller.signal });
        } catch (err) {
            if (err?.name === 'AbortError') {
                const timeoutErr = new Error(`Request timed out after ${Math.round(timeoutMs / 1000)}s`);
                timeoutErr.name = 'TimeoutError';
                throw timeoutErr;
            }
            throw err;
        } finally {
            window.clearTimeout(timeoutId);
        }
    }

    const CACHE_VERSION = 'v6';
    const cacheVersionKey = 'banking_news_version';
    if (localStorage.getItem(cacheVersionKey) !== CACHE_VERSION) {
        localStorage.removeItem('banking_news_cache');
        localStorage.removeItem('banking_news_cache_time');
        localStorage.setItem(cacheVersionKey, CACHE_VERSION);
    }

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

    function isLiveWindow(dateObj, hours = LIVE_WINDOW_HOURS) {
        return (Date.now() - dateObj.getTime()) <= hours * 60 * 60 * 1000;
    }

    function formatDeskTimestamp(dateObj) {
        if (!(dateObj instanceof Date) || Number.isNaN(dateObj.getTime())) return 'Awaiting sync';
        return `Updated ${dateObj.toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
            timeZone: 'Asia/Kolkata',
        })}`;
    }

    function setDeskNote(message) {
        if (newsDeskNote) newsDeskNote.textContent = message;
    }

    function setHeartbeat(message) {
        if (feedHeartbeat) feedHeartbeat.textContent = message;
    }

    function normalizeNewsItem(raw, index = 0) {
        const fallbackDate = new Date();
        const rawDate = raw?.rawDateISO
            ? new Date(raw.rawDateISO)
            : new Date(raw?.published_at || raw?.pubDate || raw?.rawDate || fallbackDate);
        const safeDate = Number.isNaN(rawDate.getTime()) ? fallbackDate : rawDate;
        const riskLevel = String(
            raw?.riskLevel ||
            raw?.risk_impact_level ||
            raw?.level ||
            'low'
        ).toLowerCase();
        const normalizedLevel = riskLevel === 'high' ? 'high' : (riskLevel === 'moderate' ? 'moderate' : 'low');
        const description = String(raw?.description || raw?.summary || '').trim();

        return {
            id: raw?.id || `news-${safeDate.getTime()}-${index}`,
            title: raw?.title || 'Untitled banking update',
            source: raw?.source || 'Live feed',
            description: description || 'No editor summary is available yet for this signal.',
            date: safeDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
            rawDate: safeDate,
            rawDateISO: safeDate.toISOString(),
            relativeLabel: getRelativeLabel(safeDate),
            isLive: isLiveWindow(safeDate),
            link: safeUrl(raw?.link),
            riskLevel: normalizedLevel,
            impactType: raw?.impactType || raw?.impact_type || 'Informational',
        };
    }

    function hydrateNewsItems(items) {
        return (Array.isArray(items) ? items : [])
            .map((item, index) => normalizeNewsItem(item, index))
            .sort((a, b) => b.rawDate - a.rawDate);
    }

    function readCachedNews() {
        try {
            return hydrateNewsItems(JSON.parse(localStorage.getItem('banking_news_cache') || '[]'));
        } catch {
            return [];
        }
    }

    function writeCachedNews(items) {
        try {
            localStorage.setItem('banking_news_cache', JSON.stringify(items));
            localStorage.setItem('banking_news_cache_time', Date.now().toString());
        } catch {
            // Ignore cache write failures.
        }
    }

    function setLoadingState(loading, { preserveFeed = false } = {}) {
        setRefreshState(loading);
        if (loader) loader.style.display = loading && !preserveFeed ? 'grid' : 'none';
        if (newsGrid) newsGrid.dataset.loading = loading ? 'true' : 'false';
    }

    function renderFeedSkeleton(count = 4) {
        if (!newsGrid) return;
        newsGrid.innerHTML = Array.from({ length: count }, (_, index) => `
            <article class="news-skeleton" style="animation-delay:${index * 80}ms;">
                <div class="skeleton-column"></div>
                <div class="skeleton-stack">
                    <div class="skeleton-line medium"></div>
                    <div class="skeleton-line wide"></div>
                    <div class="skeleton-line"></div>
                    <div class="skeleton-line"></div>
                    <div class="skeleton-line short"></div>
                </div>
            </article>
        `).join('');
    }

    function analyzeRisk(item) {
        const text = `${item.title || ''} ${item.content || ''}`.toLowerCase();
        const riskMatrix = {
            high: ['penalty', 'fraud', 'scam', 'npa', 'default', 'violation', 'fine', 'regulatory action', 'liquidation', 'bad loans', 'pmla'],
            moderate: ['merger', 'acquisition', 'rate hike', 'downgrade', 'liquidity', 'compliance failure', 'capital adequacy', 'bad debt', 'investigation'],
        };

        let riskLevel = 'low';
        let impactType = 'Informational';

        if (riskMatrix.high.some((kw) => text.includes(kw))) {
            riskLevel = 'high';
            impactType = 'Reputation/Compliance';
        } else if (riskMatrix.moderate.some((kw) => text.includes(kw))) {
            riskLevel = 'moderate';
            impactType = 'Operational/Credit';
        }

        if (text.includes('liquidity')) impactType = 'Liquidity Impact';
        if (text.includes('capital') || text.includes('adequacy')) impactType = 'Capital Adequacy';
        if (text.includes('kyc') || text.includes('rbi')) impactType = 'Compliance Impact';
        if (text.includes('loan') || text.includes('npa')) impactType = 'Credit Risk';

        return { level: riskLevel, impact: impactType };
    }

    async function fetchBankingNews(query = '', { forceRefresh = false } = {}) {
        const cacheTime = Number(localStorage.getItem('banking_news_cache_time') || '0');
        const cachedAny = readCachedNews();

        if (!query && !forceRefresh && cacheTime && (Date.now() - cacheTime < FRESH_CACHE_TTL_MS) && cachedAny.length) {
            LAST_FEED_SOURCE = 'cache';
            LAST_SYNCED_AT = new Date(cacheTime);
            LAST_NEWS_NOTE = 'Showing recently synced headlines from the newsroom cache.';
            return cachedAny;
        }

        let preserveFeed = Boolean(GLOBAL_NEWS.length || cachedAny.length || (newsGrid && newsGrid.children.length));
        if (!preserveFeed) {
            renderFeedSkeleton();
            preserveFeed = true;
        }
        setLoadingState(true, { preserveFeed });

        const timeoutMs = isLocalFrontend() ? 7000 : 12000;
        const searchQuery = query || 'Indian Banking Sector';
        const queryString = `q=${encodeURIComponent(searchQuery)}&hours=${FEED_WINDOW_HOURS}&limit=${FEED_FETCH_LIMIT}`;
        const apiUrls = getBackendCandidates().map((base) => (base ? `${base}/api/news?${queryString}` : `/api/news?${queryString}`));
        const attempts = [];

        try {
            for (const apiUrl of apiUrls) {
                try {
                    const response = await fetchWithTimeout(apiUrl, { cache: 'no-store' }, timeoutMs);
                    if (!response.ok) {
                        attempts.push({ url: apiUrl, error: `HTTP ${response.status}` });
                        continue;
                    }

                    const data = await response.json();
                    if (data?.status === 'success' && Array.isArray(data.items)) {
                        const items = hydrateNewsItems(data.items.map((item) => {
                            const analysis = analyzeRisk({
                                title: item.title || '',
                                content: item.summary || '',
                            });

                            return {
                                title: item.title || 'Untitled banking update',
                                source: item.source || 'Google News',
                                description: item.summary || '',
                                published_at: item.published_at || item.pubDate,
                                link: item.link,
                                riskLevel: item.risk_impact_level || analysis.level,
                                impactType: item.impact_type || analysis.impact,
                            };
                        }));

                        LAST_NEWS_NOTE = data.note || 'Live desk synced successfully.';
                        LAST_NEWS_DEBUG = attempts.length ? attempts : null;
                        LAST_FEED_SOURCE = 'live';
                        LAST_SYNCED_AT = new Date();

                        if (!query) writeCachedNews(items);
                        return items;
                    }

                    attempts.push({ url: apiUrl, error: data?.note || data?.message || 'Unexpected response' });
                } catch (err) {
                    attempts.push({ url: apiUrl, error: String(err?.message || err) });
                }
            }

            LAST_NEWS_DEBUG = attempts.length ? attempts : null;
            const bestAttempt = attempts.find((attempt) => attempt.error && attempt.error !== 'Failed to fetch') || attempts[0] || null;
            LAST_NEWS_NOTE = bestAttempt ? bestAttempt.error : 'No live headlines were returned.';

            if (!query && cachedAny.length) {
                LAST_FEED_SOURCE = 'stale-cache';
                LAST_SYNCED_AT = cacheTime ? new Date(cacheTime) : new Date();
                LAST_NEWS_NOTE = 'Live backend unreachable. Showing saved headlines so the desk stays useful.';
                return cachedAny;
            }
        } catch (err) {
            LAST_NEWS_NOTE = String(err?.message || err);
        } finally {
            setLoadingState(false, { preserveFeed: true });
        }

        LAST_FEED_SOURCE = 'empty';
        if (!LAST_SYNCED_AT && cacheTime) LAST_SYNCED_AT = new Date(cacheTime);
        return [];
    }

    function filterVisibleNews(items) {
        const selected = categoryFilter?.value || 'all';
        if (selected === 'rbi') {
            return items.filter((item) => item.title.toLowerCase().includes('rbi') || item.impactType.toLowerCase().includes('compliance'));
        }
        if (selected === 'risk') {
            return items.filter((item) => item.riskLevel === 'high' || item.impactType.toLowerCase().includes('credit'));
        }
        if (selected === 'compliance') {
            return items.filter((item) => item.impactType.toLowerCase().includes('compliance'));
        }
        return items;
    }

    function getFeedModeLabel() {
        if (LAST_FEED_SOURCE === 'live') return 'Live newsroom sync';
        if (LAST_FEED_SOURCE === 'cache') return 'Fresh cached feed';
        if (LAST_FEED_SOURCE === 'stale-cache') return 'Cached continuity mode';
        if (LAST_FEED_SOURCE === 'empty') return 'Signal desk awaiting feed';
        return 'Connecting to live desk';
    }

    function buildDeskSummary(items) {
        if (!items.length) {
            return 'The desk is standing by for verified banking and regulatory signals.';
        }

        const high = items.filter((item) => item.riskLevel === 'high').length;
        const compliance = items.filter((item) => item.impactType.toLowerCase().includes('compliance')).length;
        const liquidity = items.filter((item) => item.impactType.toLowerCase().includes('liquidity')).length;
        const lead = items[0];
        const cues = [];

        if (high) cues.push(`${high} high-risk headline${high === 1 ? '' : 's'} on the desk`);
        if (compliance) cues.push(`${compliance} compliance-driven signal${compliance === 1 ? '' : 's'}`);
        if (liquidity) cues.push(`${liquidity} liquidity watch item${liquidity === 1 ? '' : 's'}`);
        if (!cues.length) cues.push(`${items.length} banker-relevant update${items.length === 1 ? '' : 's'} tracked`);

        return `${cues.join(', ')}. Lead focus: ${lead.impactType.toLowerCase()} from ${lead.source}.`;
    }

    function buildEditorialTags(items) {
        if (!editorialTags) return;

        const tags = [];
        const pushTag = (value) => {
            const text = String(value || '').trim();
            if (!text || tags.includes(text) || tags.length >= 4) return;
            tags.push(text);
        };

        if (ACTIVE_QUERY) pushTag(`Search: ${ACTIVE_QUERY}`);
        items.slice(0, 3).forEach((item) => {
            pushTag(item.impactType);
            if (item.title.toLowerCase().includes('rbi')) pushTag('RBI watch');
            if (item.riskLevel === 'high') pushTag('High risk');
        });

        if (!tags.length) {
            pushTag('Live bulletin pending');
            pushTag('RBI watch');
            pushTag('Credit signals');
        }

        editorialTags.innerHTML = tags.map((tag) => `<span class="editorial-tag">${escapeHtml(tag)}</span>`).join('');
    }

    function renderLeadStory(items) {
        if (!leadStoryCard) return;
        const lead = items[0];

        if (!lead) {
            leadStoryCard.innerHTML = `
                <div class="lead-story-placeholder">
                    <div class="lead-story-kicker">Opening Bulletin</div>
                    <h2>Preparing the newsroom opener</h2>
                    <p>The desk is waiting for verified banking signals before publishing the lead bulletin.</p>
                </div>
            `;
            return;
        }

        const link = safeUrl(lead.link);
        leadStoryCard.innerHTML = `
            <div class="lead-story-content">
                <div class="lead-story-top">
                    ${lead.isLive ? '<span class="story-chip story-chip-live"><span class="live-dot"></span>LIVE DESK</span>' : `<span class="story-chip">${escapeHtml(lead.relativeLabel)}</span>`}
                    <span class="story-chip">${escapeHtml(lead.source)}</span>
                    <span class="story-chip">${escapeHtml(lead.impactType)}</span>
                </div>
                <div class="lead-story-kicker">Lead Bulletin</div>
                <h2>${escapeHtml(lead.title)}</h2>
                <p>${escapeHtml(lead.description)}</p>
                <div class="lead-story-footer">
                    <span>${escapeHtml(lead.date)} | ${escapeHtml(lead.relativeLabel)}</span>
                    ${link !== '#' ? `<a href="${link}" target="_blank" rel="noopener noreferrer">Open source</a>` : ''}
                </div>
            </div>
        `;
    }

    function rankForWatchlist(items) {
        return [...items].sort((left, right) => {
            const leftScore = (left.riskLevel === 'high' ? 3 : (left.riskLevel === 'moderate' ? 2 : 1)) + (left.isLive ? 1 : 0);
            const rightScore = (right.riskLevel === 'high' ? 3 : (right.riskLevel === 'moderate' ? 2 : 1)) + (right.isLive ? 1 : 0);
            if (rightScore !== leftScore) return rightScore - leftScore;
            return right.rawDate - left.rawDate;
        });
    }

    function renderWatchlist(items) {
        if (!watchlistRail) return;
        const watchItems = rankForWatchlist(items).slice(0, 4);

        if (!watchItems.length) {
            watchlistRail.innerHTML = '<div class="watchlist-empty">Lead risk and regulatory signals will appear here once the desk syncs.</div>';
            return;
        }

        watchlistRail.innerHTML = watchItems.map((item, index) => `
            <article class="watchlist-item">
                <div class="watchlist-index">${String(index + 1).padStart(2, '0')}</div>
                <div class="watchlist-copy">
                    <div class="watchlist-topline">
                        <span>${escapeHtml(item.riskLevel)} risk</span>
                        <span>${escapeHtml(item.relativeLabel)}</span>
                    </div>
                    <a class="watchlist-link" href="${safeUrl(item.link)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.title)}</a>
                </div>
            </article>
        `).join('');
    }

    function renderTicker(items) {
        if (!tickerContent) return;
        const tickerItems = rankForWatchlist(items).slice(0, 6);
        if (!tickerItems.length) {
            tickerContent.innerHTML = `
                <span class="ticker-pill">Awaiting live banking signals</span>
                <span class="ticker-pill">RBI and market scan active</span>
                <span class="ticker-pill">Cache desk standing by</span>
            `;
            return;
        }

        tickerContent.innerHTML = tickerItems.map((item) => `
            <span class="ticker-pill">${escapeHtml(item.title)}</span>
        `).join('');
    }

    function renderNews(items) {
        if (!newsGrid) return;
        const displayItems = items.slice(0, FEED_DISPLAY_LIMIT);

        if (!displayItems.length) {
            const note = LAST_NEWS_NOTE ? `<p class="news-empty-note">${escapeHtml(LAST_NEWS_NOTE)}</p>` : '';
            const debug = (LAST_NEWS_DEBUG && LAST_NEWS_DEBUG.length)
                ? `<details><summary>Debug</summary><div class="news-empty-note">${LAST_NEWS_DEBUG.map((attempt) => `${escapeHtml(attempt.url)} -> ${escapeHtml(attempt.error)}`).join('<br><br>')}</div></details>`
                : '';
            newsGrid.innerHTML = `
                <div class="news-empty-state">
                    <h3>No broadcast signals found</h3>
                    <p>The newsroom could not find matching headlines for this view yet.</p>
                    ${note}
                    ${debug}
                </div>
            `;
            return;
        }

        newsGrid.innerHTML = displayItems.map((item, index) => `
            <article class="news-item" data-tone="${escapeHtml(item.riskLevel)}" style="animation-delay:${index * 70}ms;">
                <div class="news-meta">
                    <div class="source-badge">${escapeHtml(item.source)}</div>
                    <div class="news-date">${escapeHtml(item.date)}</div>
                    <div class="news-relative">${escapeHtml(item.relativeLabel)}</div>
                </div>
                <div class="news-content">
                    <div class="story-topline">
                        ${item.isLive ? '<div class="live-tag"><span class="live-dot"></span>LIVE BROADCAST</div>' : '<div class="live-tag" style="color: var(--antique-gold);"><span class="live-dot" style="background: var(--antique-gold); box-shadow:none; animation:none;"></span>RECENT SIGNAL</div>'}
                        <span class="story-rank">Bulletin ${String(index + 1).padStart(2, '0')}</span>
                    </div>
                    <div class="story-tag-row">
                        <span class="risk-pill risk-${escapeHtml(item.riskLevel)}">${escapeHtml(item.riskLevel)} risk</span>
                        <span class="impact-tag">${escapeHtml(item.impactType)}</span>
                    </div>
                    <a href="${safeUrl(item.link)}" target="_blank" rel="noopener noreferrer" class="news-headline">${escapeHtml(item.title)}</a>
                    <p class="summary-news">${escapeHtml(item.description)}</p>
                    <div class="story-footer">
                        <span>Desk source: ${escapeHtml(item.source)}</span>
                        <a class="story-link" href="${safeUrl(item.link)}" target="_blank" rel="noopener noreferrer">Open source</a>
                    </div>
                </div>
            </article>
        `).join('');
    }

    function updateDeskMetrics(items) {
        const high = items.filter((item) => item.riskLevel === 'high').length;
        const compliance = items.filter((item) => item.impactType.toLowerCase().includes('compliance')).length;
        const liquidity = items.filter((item) => item.impactType.toLowerCase().includes('liquidity')).length;

        if (highRiskCount) highRiskCount.textContent = String(high);
        if (complianceCount) complianceCount.textContent = String(compliance);
        if (liquidityCount) liquidityCount.textContent = String(liquidity);
        if (leadSignalMix) leadSignalMix.textContent = `${high} risk | ${compliance} compliance | ${liquidity} liquidity`;
        if (feedCountBadge) feedCountBadge.textContent = `${Math.min(items.length, FEED_DISPLAY_LIMIT)} stories on desk`;
        if (newsTimestamp) newsTimestamp.textContent = formatDeskTimestamp(LAST_SYNCED_AT);
        setHeartbeat(getFeedModeLabel());
        setDeskNote(LAST_NEWS_NOTE || 'Arthashastra newsroom standing by.');
    }

    function renderCurrentNews() {
        const visible = filterVisibleNews(GLOBAL_NEWS);
        renderNews(visible);
        renderLeadStory(visible);
        renderWatchlist(visible);
        renderTicker(visible);
        updateDeskMetrics(visible);
        if (editorialBrief) editorialBrief.textContent = buildDeskSummary(visible);
        buildEditorialTags(visible);

        const queryText = ACTIVE_QUERY ? `Tracking "${ACTIVE_QUERY}"` : 'Tracking the broad Indian banking sector feed';
        const itemText = visible.length === 1 ? '1 signal' : `${visible.length} signals`;
        const note = LAST_NEWS_NOTE ? ` ${LAST_NEWS_NOTE}` : '';
        updateSearchStatus(`${queryText}. Showing ${itemText}.${note}`);
    }

    async function runNewsSearch(query = '', options = {}) {
        ACTIVE_QUERY = String(query || '').trim();
        if (!ACTIVE_QUERY) {
            setDeskNote('Syncing the Arthashastra live desk.');
        }
        GLOBAL_NEWS = await fetchBankingNews(ACTIVE_QUERY, options);
        renderCurrentNews();
    }

    function renderCirculars() {
        if (!circularsList) return;
        const circulars = [
            { id: 'RBI/2026/142', title: 'Master Direction on Foreign Investment', date: 'Issued Feb 26', cat: 'Prudential' },
            { id: 'RBI/2026/138', title: 'Microfinance Loans Review', date: 'Issued Feb 24', cat: 'Lending' },
            { id: 'RBI/2026/135', title: 'Basel III Capital Standards', date: 'Issued Feb 20', cat: 'Capital' },
            { id: 'RBI/2026/131', title: 'Cyber Framework for Cooperative Banks', date: 'Issued Feb 15', cat: 'Security' },
        ];

        circularsList.innerHTML = circulars.map((circular) => `
            <article class="circular-item">
                <div class="circular-meta">
                    <span class="circular-id">${escapeHtml(circular.id)}</span>
                    <span class="circular-cat">${escapeHtml(circular.cat)}</span>
                </div>
                <a href="#" class="circular-link">${escapeHtml(circular.title)}</a>
                <div class="circular-date">${escapeHtml(circular.date)}</div>
            </article>
        `).join('');
    }

    function renderArchive() {
        if (!archiveBody) return;
        const archive = [
            { date: 'DEC 12', title: 'KYC Enforcement Action', cat: 'Risk' },
            { date: 'OCT 05', title: 'Agri-Loan Digitization', cat: 'Agri' },
            { date: 'SEP 15', title: 'Fair Lending Norms', cat: 'Gov' },
        ];

        archiveBody.innerHTML = archive.map((item) => `
            <tr>
                <td class="archive-date">${escapeHtml(item.date)}</td>
                <td class="archive-title">${escapeHtml(item.title)}</td>
                <td style="text-align: right;"><span class="archive-tag">${escapeHtml(item.cat)}</span></td>
            </tr>
        `).join('');
    }

    if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
            localStorage.removeItem('banking_news_cache');
            localStorage.removeItem('banking_news_cache_time');
            setDeskNote('Manual refresh requested. Pulling the latest headlines.');
            await runNewsSearch(bankSearch?.value || '', { forceRefresh: true });
        });
    }

    if (categoryFilter) {
        categoryFilter.addEventListener('change', () => {
            renderCurrentNews();
        });
    }

    if (bankSearch) {
        bankSearch.addEventListener('input', () => {
            window.clearTimeout(searchDebounce);
            searchDebounce = window.setTimeout(() => {
                runNewsSearch(bankSearch.value, { forceRefresh: Boolean(bankSearch.value.trim()) });
            }, 350);
        });

        bankSearch.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            window.clearTimeout(searchDebounce);
            runNewsSearch(bankSearch.value, { forceRefresh: Boolean(bankSearch.value.trim()) });
        });
    }

    (function init() {
        renderCirculars();
        renderArchive();

        const cached = readCachedNews();
        const cacheTime = Number(localStorage.getItem('banking_news_cache_time') || '0');
        if (cached.length) {
            GLOBAL_NEWS = cached;
            LAST_FEED_SOURCE = 'cache';
            LAST_SYNCED_AT = cacheTime ? new Date(cacheTime) : new Date();
            LAST_NEWS_NOTE = 'Showing cached headlines while the live desk syncs.';
            renderCurrentNews();
        } else {
            renderFeedSkeleton();
            setDeskNote('Preparing the newsroom and connecting to live sources.');
            if (newsTimestamp) newsTimestamp.textContent = 'Syncing live desk...';
            setHeartbeat('Connecting to live desk');
        }

        void runNewsSearch('', { forceRefresh: true });
    })();
});
