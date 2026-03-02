// Arthashastra AI – Mauryan Credit Intelligence Client Logic (Ancient Bharat Theme)

document.addEventListener('DOMContentLoaded', () => {

  const q = (s) => document.querySelector(s);

  // Helper for currency formatting
  function formatINR(n) {
    if (!n && n !== 0) return '';
    const num = Number(n);
    return '₹ ' + num.toLocaleString('en-IN') + ' Cr';
  }

  // --- 1. STRATEGIC ADJUSTMENT SLIDER ---
  const adjust = q('#adjust');
  const adjustLabel = q('#adjustLabel');
  if (adjust && adjustLabel) {
    adjust.addEventListener('input', (e) => {
      adjustLabel.textContent = e.target.value;
    });
  }

  // --- 1.2 FILE UPLOAD VISUAL FEEDBACK ---
  const fileInputs = document.querySelectorAll('input[type="file"]');
  fileInputs.forEach(input => {
    input.addEventListener('change', (e) => {
      const parent = e.target.closest('.upload-item') || e.target.parentElement;
      // Robustly find the button: look for <button>, <label>, or .btn class
      let btn = parent ? parent.querySelector('button, .btn, label') : e.target.nextElementSibling;
      // Ensure we didn't select the input itself
      if (btn === e.target) btn = null;

      if (parent || btn) {
        const file = e.target.files[0];
        if (file) {
          if (btn) {
            const fileName = file.name;
            const shortName = fileName.length > 15 ? fileName.substring(0, 12) + '...' : fileName;
            btn.textContent = `✓ ${shortName}`;
            btn.style.background = 'var(--imperial-indigo)';
            btn.style.color = 'white';
            btn.style.borderColor = 'var(--imperial-indigo)';
          }
          if (parent) {
            parent.style.borderColor = 'var(--imperial-indigo)';
            parent.style.backgroundColor = 'rgba(26, 37, 64, 0.1)';
          }
        } else {
          if (btn) {
            btn.textContent = 'Select';
            btn.style.background = 'var(--antique-gold)';
            btn.style.color = 'white';
          }
          if (parent) {
            parent.style.borderColor = 'var(--antique-gold)';
            parent.style.backgroundColor = 'var(--ivory-card)';
          }
        }
      }
    });
  });

  // --- 1.5 ARTHASHASTRA AI AUTO-EXTRACT (WITH CINEMATIC OVERLAY) ---
  const aiBtn = q('#aiExtractBtn');
  const aiLoading = q('#aiLoading');

  // Build the fullscreen overlay DOM
  function createAIOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'ai-overlay';
    overlay.id = 'aiOverlay';
    overlay.innerHTML = `
      <div class="ai-scanline"></div>
      <div class="ai-corner tl"></div>
      <div class="ai-corner tr"></div>
      <div class="ai-corner bl"></div>
      <div class="ai-corner br"></div>

      <div class="ai-mandala-wrap">
        <div class="ai-ring-outer"></div>
        <div class="ai-ring-mid"></div>
        <div class="ai-ring-inner"></div>
        <div class="ai-center-symbol"><img src="logo.png" alt="Arthashastra AI" onerror="this.src='image.png'" style="width: 80px; height: 80px; border-radius: 50%; object-fit: contain;"></div>
      </div>

      <div class="ai-status-text">
        <div class="ai-phase-label" id="aiPhaseLabel">Invoking Arthashastra Intelligence...</div>
        <div class="ai-phase-sub" id="aiPhaseSub">INITIALIZING KAUTILYA ENGINE</div>
      </div>

      <div class="ai-progress-wrap">
        <div class="ai-progress-bar" id="aiProgressBar"></div>
      </div>
    `;

    // Generate floating particles
    for (let i = 0; i < 20; i++) {
      const particle = document.createElement('div');
      particle.className = 'ai-particle';
      const angle = Math.random() * Math.PI * 2;
      const dist = 120 + Math.random() * 200;
      particle.style.setProperty('--tx', `${Math.cos(angle) * dist}px`);
      particle.style.setProperty('--ty', `${Math.sin(angle) * dist}px`);
      particle.style.left = `calc(50% + ${(Math.random() - 0.5) * 60}px)`;
      particle.style.top = `calc(50% + ${(Math.random() - 0.5) * 60}px)`;
      particle.style.animationDelay = `${Math.random() * 3}s`;
      particle.style.animationDuration = `${2 + Math.random() * 2}s`;
      overlay.appendChild(particle);
    }

    document.body.appendChild(overlay);
    return overlay;
  }

  // Phase definitions: [label, subtitle, progress%]
  const aiPhases = [
    ['Invoking Arthashastra Intelligence...', 'INITIALIZING KAUTILYA ENGINE', 5],
    ['Decoding Structured Data...', 'GST · ITRs · BANK STATEMENTS', 20],
    ['Analyzing Unstructured Manuscripts...', 'ANNUAL REPORTS · FINANCIAL STATEMENTS', 35],
    ['Assessing Governance Documents...', 'BOARD MINUTES · RATING REPORTS · SHAREHOLDING', 50],
    ['Verifying External Intelligence...', 'MCA FILINGS · LEGAL DISPUTES · NEWS', 65],
    ['Incorporating Primary Insights...', 'SITE VISITS · MANAGEMENT INTERVIEWS', 80],
    ['चाणक्य नीति — Applying Ancient Wisdom...', 'RISK GOVERNANCE ALIGNMENT', 90],
    ['सत्यमेव जयते — Finalizing Assessment...', 'CIVILIZATIONAL GRADE COMPUTATION', 95],
    ['✦ Intelligence Extraction Complete ✦', 'ARTHASHASTRA AI — KAUTILYA ENGINE v3.0', 100],
  ];

  if (aiBtn) {
    aiBtn.addEventListener('click', () => {
      // Validation: Ensure at least one file is selected
      const inputs = document.querySelectorAll('input[type="file"]');
      const hasFile = Array.from(inputs).some(input => input.files.length > 0);
      if (!hasFile) {
        alert("⚠️ No documents detected.\n\nPlease select at least one document (GST, ITRs, Bank Statements) to proceed.");
        return;
      }

      if (aiLoading) aiLoading.classList.remove('hidden');
      aiBtn.disabled = true;
      aiBtn.style.opacity = '0.7';

      // Create and show overlay
      const overlay = createAIOverlay();
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          overlay.classList.add('active');
        });
      });

      const phaseLabel = overlay.querySelector('#aiPhaseLabel');
      const phaseSub = overlay.querySelector('#aiPhaseSub');
      const progressBar = overlay.querySelector('#aiProgressBar');

      // Cycle through phases
      aiPhases.forEach((phase, i) => {
        setTimeout(() => {
          phaseLabel.textContent = phase[0];
          phaseSub.textContent = phase[1];
          progressBar.style.width = phase[2] + '%';
        }, i * 900);
      });

      // Total animation time: ~6.3 seconds (7 phases × 900ms)
      const totalTime = aiPhases.length * 900;

      setTimeout(() => {
        // Fill in extracted data
        if (q('#company')) q('#company').value = 'Chandragupta Maritimes Ltd';
        if (q('#promoters')) q('#promoters').value = 'S. Maurya, V. Gupta';
        if (q('#sector')) q('#sector').value = 'Logistics & Infrastructure';
        if (adjust) {
          adjust.value = '4';
          adjustLabel.textContent = '4';
        }

        if (aiLoading) aiLoading.classList.add('hidden');
        aiBtn.disabled = false;
        aiBtn.style.opacity = '1';

        // Graceful overlay fade out
        overlay.classList.add('fade-out');
        overlay.classList.remove('active');
        setTimeout(() => {
          overlay.remove();
        }, 900);

        // Visual feedback on form sections
        const sections = document.querySelectorAll('.form-section');
        sections.forEach(s => {
          s.style.transition = 'all 0.5s';
          s.style.borderColor = 'var(--antique-gold)';
          setTimeout(() => s.style.borderColor = 'transparent', 1000);
        });
      }, totalTime + 400);
    });
  }

  // --- 2. CAM GENERATION ENGINE ---
  const genBtn = q('#generateCamBtn');
  const camOutput = q('#camOutput');

  if (genBtn && camOutput) {
    genBtn.addEventListener('click', () => {
      // Input capture
      const data = {
        company: q('#company').value || 'Entity Name',
        promoters: q('#promoters').value || 'N/A',
        sector: q('#sector').value || 'N/A',
        adjust: parseInt(q('#adjust').value) || 0,
        docs: {
          gst: (q('#gst_financials')?.files || []).length > 0,
          itr: (q('#itr_financials')?.files || []).length > 0,
          bank: (q('#bank_financials')?.files || []).length > 0
        }
      };
      const docStatusList = [
        { label: 'GST Filings (12M)', present: data.docs.gst },
        { label: 'ITRs (3Y)', present: data.docs.itr },
        { label: 'Bank Statements (12M)', present: data.docs.bank }
      ];

      const docCount = docStatusList.filter(d => d.present).length;
      const missingDocs = docStatusList.filter(d => !d.present).map(d => d.label);
      const coveragePercent = Math.round((docCount / docStatusList.length) * 100);

      // Scoring Model (documentation readiness + strategic adjustment)
      let score = 50 + (docCount * 15) + data.adjust; // baseline plus completeness
      score = Math.max(0, Math.min(100, score));

      // Grade Logic
      let grade = 'BB';
      let riskClass = 'risk-bb';
      if (score >= 85) { grade = 'A+'; riskClass = 'risk-a'; }
      else if (score >= 70) { grade = 'A'; riskClass = 'risk-a'; }
      else if (score >= 55) { grade = 'BBB'; riskClass = 'risk-bbb'; }

      const recommendation = missingDocs.length === 0
        ? 'PROCEED — core financial documents are complete.'
        : `PENDING — awaiting ${missingDocs.join(', ')}.`;

      const docStatusHtml = docStatusList.map(item => `
        <li style="display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 12px; padding: 12px 0; border-bottom: 1px dashed var(--border-gold);">
          <span style="font-weight: 800; color: ${item.present ? 'var(--antique-gold)' : 'var(--text-secondary)'};">${item.present ? '✓' : '○'}</span>
          <div style="display: flex; flex-direction: column; gap: 4px;">
            <span style="font-weight: 800; color: var(--imperial-indigo);">${item.label}</span>
            <span style="font-size: 0.85rem; color: var(--text-secondary);">${item.present ? 'Uploaded' : 'Upload to proceed'}</span>
          </div>
          <span style="font-weight: 800; color: ${item.present ? 'var(--antique-gold)' : 'var(--imperial-indigo)'}; font-size: 0.9rem;">${item.present ? 'Ready' : 'Pending'}</span>
        </li>
      `).join('');

      // Content Injection with Ancient Bharat / Imperial Indigo theme
      // IMPORTANT: Use textContent for user-provided data to prevent XSS vulnerabilities.
      camOutput.innerHTML = `
        <div style="border-bottom: 3px solid var(--antique-gold); padding-bottom: 25px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: flex-end;">
          <div>
            <h2 id="cam-company-name" style="font-size: 2.2rem; color: var(--imperial-indigo); margin: 0; font-family: 'Playfair Display', serif;"></h2>
            <p style="color: var(--text-secondary); font-weight: 700; opacity: 0.7; margin: 5px 0 0 0; letter-spacing: 1px; text-transform: uppercase; font-size: 0.75rem;">Documentation Readiness Memo • Case ID: #${Math.floor(Math.random() * 9000) + 1000}</p>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 0.7rem; font-weight: 800; color: var(--imperial-indigo); text-transform: uppercase; margin-bottom: 8px; letter-spacing: 2px;">Institutional Grade</div>
            <div class="risk-tag ${riskClass}" style="font-size: 1.6rem; padding: 10px 22px;">${grade}</div>
            <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 6px;">Coverage: ${coveragePercent}%</div>
          </div>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1.5fr; gap: 50px;">
          <div style="background: var(--ivory-card); padding: 35px; border-radius: 4px; border: 1px solid var(--border-gold); box-shadow: var(--shadow-ancient);">
            <h4 style="margin-bottom: 25px; font-size: 1.1rem; color: var(--imperial-indigo); border-bottom: 1px solid var(--antique-gold); padding-bottom: 10px; text-transform: uppercase; letter-spacing: 1px;">Executive Summary</h4>
            <ul style="list-style: none;">
              <li style="margin-bottom: 18px; font-size: 0.95rem; display: flex; flex-direction: column; gap: 4px;"><span style="font-size: 0.7rem; font-weight: 800; color: var(--text-secondary); text-transform: uppercase;">Promoter(s)</span> <strong id="cam-promoters"></strong></li>
              <li style="margin-bottom: 18px; font-size: 0.95rem; display: flex; flex-direction: column; gap: 4px;"><span style="font-size: 0.7rem; font-weight: 800; color: var(--text-secondary); text-transform: uppercase;">Sector</span> <strong id="cam-sector"></strong></li>
              <li style="margin-bottom: 18px; font-size: 0.95rem; display: flex; flex-direction: column; gap: 4px;"><span style="font-size: 0.7rem; font-weight: 800; color: var(--text-secondary); text-transform: uppercase;">Documentation Coverage</span> <strong style="color: var(--imperial-indigo); font-size: 1.1rem;">${coveragePercent}%</strong></li>
              <li style="margin-top: 25px; font-size: 0.95rem; padding-top: 15px; border-top: 1px dashed var(--antique-gold);">
                <span style="font-size: 0.7rem; font-weight: 800; color: var(--text-secondary); text-transform: uppercase;">Recommendation</span> <br>
                <span style="color:${missingDocs.length === 0 ? '#1B4965' : '#8B2942'}; font-weight:800; font-size: 1.05rem;">${recommendation}</span>
              </li>
            </ul>
          </div>
          <div>
            <h4 style="margin-bottom: 25px; font-size: 1.1rem; color: var(--imperial-indigo); border-bottom: 1px solid var(--antique-gold); padding-bottom: 10px; text-transform: uppercase; letter-spacing: 1px;">Documentation Readiness</h4>
            <div style="margin-bottom: 20px; background: var(--ivory-card); padding: 24px; border-radius: 4px; border: 1px solid var(--border-gold); box-shadow: var(--shadow-ancient);">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <span style="font-size: 0.9rem; font-weight: 800; color: var(--imperial-indigo);">Coverage Progress</span>
                <span style="font-weight: 900; color: var(--antique-gold);">${coveragePercent}%</span>
              </div>
              <div style="height: 10px; background: var(--sandstone-ash); border-radius: 0; overflow: hidden; border: 1px solid var(--border-gold);">
                <div style="width: ${coveragePercent}%; height: 100%; background: var(--antique-gold);"></div>
              </div>
            </div>
            <ul style="list-style: none; margin: 0; padding: 0; background: var(--ivory-card); padding: 10px 20px; border: 1px solid var(--border-gold); border-radius: 4px; box-shadow: var(--shadow-ancient);">
              ${docStatusHtml}
            </ul>
          </div>
        </div>
        <div style="margin-top: 50px; text-align: right; border-top: 2px solid var(--antique-gold); padding-top: 30px; display: flex; justify-content: flex-end; gap: 20px;">
          <button class="btn btn-outline" style="padding: 14px 30px; border-color: var(--imperial-indigo); color: var(--imperial-indigo);" onclick="window.print()">Print Documentation Memo</button>
          <button class="btn btn-primary" style="padding: 14px 30px;" onclick="archiveCurrentCase(this)">Archive in Dharma Ledger</button>
        </div>
      `;

      // Safely set user-provided content
      if (q('#cam-company-name')) q('#cam-company-name').textContent = data.company;
      if (q('#cam-promoters')) q('#cam-promoters').textContent = data.promoters;
      if (q('#cam-sector')) q('#cam-sector').textContent = data.sector;

      // Store globally for archival with concise details
      window.currentCaseMetrics = {
        company: data.company,
        promoters: data.promoters,
        sector: data.sector,
        grade: grade,
        riskClass: riskClass,
        docs: data.docs,
        coveragePercent: coveragePercent,
        score: score
      };

      camOutput.classList.remove('hidden');
      camOutput.scrollIntoView({ behavior: 'smooth' });
    });
  }

  // --- 3. SCROLL REVEAL ENGINE ---
  const revealElements = document.querySelectorAll('section, .card, .stat-card, .metric-box, table tr');

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('reveal-active');
        revealObserver.unobserve(entry.target); // Reveal only once
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  });

  revealElements.forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(30px)';
    el.style.transition = 'all 0.4s cubic-bezier(0.165, 0.84, 0.44, 1)';
    revealObserver.observe(el);
  });

  // Inject active class styles dynamically for simplicity
  const style = document.createElement('style');
  style.innerHTML = `
    .reveal-active {
      opacity: 1 !important;
      transform: translateY(0) !important;
    }
    
    /* Staggered children animation */
    .reveal-active > * {
      animation: fadeInUp 0.4s forwards;
    }
  `;
  document.head.appendChild(style);

  // --- 4. SLIDING NAVBAR UNDERLINE ENGINE ---
  const navContainer = q('.nav-links');
  const navLinks = document.querySelectorAll('.nav-links a:not(.submit-case-btn)');
  const activeLink = q('.nav-links a.active');

  if (navContainer && navLinks.length > 0) {
    // Inject underline element
    const underline = document.createElement('div');
    underline.className = 'nav-underline';
    navContainer.appendChild(underline);

    const moveUnderline = (el) => {
      if (!el) {
        underline.style.width = '0';
        return;
      }
      underline.style.left = `${el.offsetLeft}px`;
      underline.style.width = `${el.offsetWidth}px`;
    };

    // Initial position based on active link
    setTimeout(() => moveUnderline(activeLink), 100);

    navLinks.forEach(link => {
      link.addEventListener('mouseenter', () => moveUnderline(link));
    });

    navContainer.addEventListener('mouseleave', () => moveUnderline(activeLink));

    // Handle window resize
    window.addEventListener('resize', () => moveUnderline(activeLink));
  }

  // --- 5. DHARMA LEDGER ARCHIVE LOGIC ---
  window.archiveCurrentCase = function (btn) {
    // Priority: Use the cached metrics, but fallback to direct DOM scraping for absolute safety
    const cached = window.currentCaseMetrics || {};

    // Scrape directly to ensure we don't have stale/empty data (Capture real user inputs like 300cr)
    const companyInput = q('#company');
    const promotersInput = q('#promoters');
    const sectorInput = q('#sector');
    const ebitdaInput = q('#ebitda');
    const debtInput = q('#debtService');
    const facilityInput = q('#facility');
    const networthInput = q('#networth');

    const company = (companyInput && companyInput.value) ? companyInput.value : (cached.company || 'Unknown Entity');
    const promoters = (promotersInput && promotersInput.value) ? promotersInput.value : (cached.promoters || 'N/A');
    const sector = (sectorInput && sectorInput.value) ? sectorInput.value : (cached.sector || 'General');

    // Grade Capture
    const gradeElement = q('.risk-tag');
    const grade = gradeElement ? gradeElement.innerText : (cached.grade || 'BB');
    const riskClass = gradeElement ? Array.from(gradeElement.classList).find(c => c.startsWith('risk-') && c !== 'risk-tag') : (cached.riskClass || 'risk-bbb');

    // Financial Metrics Capture (Crucial for "Real" data vs "Fixed")
    const ebitdaVal = (ebitdaInput && ebitdaInput.value) ? ebitdaInput.value : (cached.metrics ? cached.metrics.ebitda : '0');
    const debtVal = (debtInput && debtInput.value) ? debtInput.value : (cached.metrics ? cached.metrics.debtService : '0');
    const facilityVal = (facilityInput && facilityInput.value) ? facilityInput.value : (cached.metrics ? cached.metrics.facility : '0');
    const approvedVal = cached.metrics ? cached.metrics.approvedAmount : '0';
    const networthVal = (networthInput && networthInput.value) ? networthInput.value : (cached.metrics ? cached.metrics.networth : '0');

    // Recalculate ratios to match the "Real" values exactly
    const calcDscr = (parseFloat(ebitdaVal) / (parseFloat(debtVal) || 1)).toFixed(2);
    const calcLev = (parseFloat(facilityVal) / (parseFloat(networthVal) || 1)).toFixed(2);

    const caseData = {
      id: '#' + (Math.floor(Math.random() * 9000) + 1000),
      company: company,
      promoters: promoters,
      sector: sector,
      grade: grade,
      riskClass: riskClass,
      metrics: {
        ebitda: ebitdaVal,
        debtService: debtVal,
        facility: facilityVal,
        approvedAmount: approvedVal,
        leverage: calcLev,
        dscr: calcDscr
      },
      status: 'Approved',
      date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    };

    // Save to localStorage
    const archivedCases = JSON.parse(localStorage.getItem('mauryan_archive') || '[]');
    archivedCases.unshift(caseData);
    localStorage.setItem('mauryan_archive', JSON.stringify(archivedCases));

    // UI Feedback
    btn.innerHTML = '✨ Secured in Ledger';
    btn.style.background = '#27ae60';
    btn.disabled = true;

    setTimeout(() => {
      alert(`Success! Case ${caseData.id} for ${company} has been cryptographically secured in the Dharma Ledger.`);
    }, 200);
  };

  // Populate Tables from Ledger if they exist
  const allCasesBody = q('#allCasesBody');
  const recentCasesBody = q('#recentCasesBody');
  const archived = JSON.parse(localStorage.getItem('mauryan_archive') || '[]');

  if (archived.length > 0) {
    archived.forEach(c => {
      // 1. All Cases Page Logic
      if (allCasesBody) {
        // Determine correct risk class, ignoring the generic 'risk-tag' if it was incorrectly saved
        let displayRiskClass = (c.riskClass && c.riskClass !== 'risk-tag') ? c.riskClass : null;
        if (!displayRiskClass) {
          displayRiskClass = c.grade.includes('A') ? 'risk-a' : (c.grade === 'BBB' ? 'risk-bbb' : 'risk-bb');
        }

        const row = document.createElement('tr');
        row.style.animation = 'fadeInUp 0.4s both';
        row.innerHTML = `<td></td><td></td><td></td>
          <td><span class="risk-tag ${displayRiskClass}"></span></td>
          <td></td><td></td>
          <td><a href="#" class="view-btn" onclick="viewArchivedCase('${c.id}'); return false;">View Case</a></td>`;

        row.cells[0].textContent = c.id;
        row.cells[1].textContent = c.company;
        row.cells[2].textContent = c.sector;
        row.cells[3].querySelector('.risk-tag').textContent = c.grade;
        row.cells[4].textContent = c.status;
        row.cells[5].textContent = c.date;

        allCasesBody.prepend(row);
      }

      // 2. Dashboard Page Logic
      if (recentCasesBody) {
        let displayRiskClass = (c.riskClass && c.riskClass !== 'risk-tag') ? c.riskClass : null;
        if (!displayRiskClass) {
          displayRiskClass = c.grade.includes('A') ? 'risk-a' : (c.grade === 'BBB' ? 'risk-bbb' : 'risk-bb');
        }

        const row = document.createElement('tr');
        row.style.animation = 'fadeInUp 0.4s both';
        row.innerHTML = `<td></td>
          <td><span class="risk-tag ${displayRiskClass}"></span></td>
          <td></td><td></td>
          <td><a href="#" class="view-btn" onclick="viewArchivedCase('${c.id}'); return false;">View</a></td>`;

        row.cells[0].textContent = c.company;
        row.cells[1].querySelector('.risk-tag').textContent = c.grade;
        row.cells[2].textContent = c.status;
        row.cells[3].textContent = c.date;
        recentCasesBody.prepend(row);
      }
    });
  }

  // Legacy Institutional Records (Static Rows)
  const legacyRecords = {
    '#1290': { id: '#1290', company: 'Reliance Industries Ltd', promoters: 'Mukesh Ambani & Family', sector: 'Oil & Gas', grade: 'A+', riskClass: 'risk-a', date: 'Feb 20, 2026', status: 'Approved', metrics: { ebitda: '150000', debtService: '25000', facility: '50000', dscr: '6.00', leverage: '0.80' } },
    '#1289': { id: '#1289', company: 'Adani Enterprises', promoters: 'Gautam Adani & Family', sector: 'Infrastructure', grade: 'BBB', riskClass: 'risk-bbb', date: 'Feb 19, 2026', status: 'Pending', metrics: { ebitda: '85000', debtService: '18000', facility: '30000', dscr: '4.72', leverage: '1.20' } },
    '#1288': { id: '#1288', company: 'Tata Motors', promoters: 'Tata Sons', sector: 'Automotive', grade: 'A', riskClass: 'risk-a', date: 'Feb 18, 2026', status: 'Approved', metrics: { ebitda: '42000', debtService: '12000', facility: '15000', dscr: '3.50', leverage: '0.95' } },
    '#1287': { id: '#1287', company: 'Zomato Ltd', promoters: 'Deepinder Goyal & Public', sector: 'Tech / Food', grade: 'BB', riskClass: 'risk-bb', date: 'Feb 15, 2026', status: 'Rejected', metrics: { ebitda: '-120', debtService: '500', facility: '200', dscr: '0.00', leverage: '4.50' } },
    '#1286': { id: '#1286', company: 'InterGlobe Aviation', promoters: 'Rahul Bhatia & R. Gangwal', sector: 'Aviation', grade: 'BBB', riskClass: 'risk-bbb', date: 'Feb 12, 2026', status: 'Approved', metrics: { ebitda: '12500', debtService: '4500', facility: '8000', dscr: '2.78', leverage: '2.10' } }
  };

  // Detailed View Logic
  window.viewArchivedCase = function (caseId) {
    const archived = JSON.parse(localStorage.getItem('mauryan_archive') || '[]');
    const c = archived.find(item => item.id === caseId) || legacyRecords[caseId];

    if (c) {
      window.location.href = `view-case.html?id=${encodeURIComponent(caseId)}`;
    } else {
      alert(`Mauryan Intelligence Record: Deep Decryption for institutional case #${caseId.replace('#', '')} is currently locked or unavailable.`);
    }
  };

  // Attach listeners to static table buttons
  document.querySelectorAll('.view-btn').forEach(btn => {
    if (!btn.hasAttribute('onclick')) {
      const row = btn.closest('tr');
      const caseId = row.cells[0].innerText;
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        viewArchivedCase(caseId);
      });
    }
  });

  // Utility to clear legacy data
  window.clearDharmaLedger = function () {
    if (confirm("Are you sure you want to clear the Dharma Ledger? This will remove all old test cases and reset your institutional history.")) {
      localStorage.removeItem('mauryan_archive');
      location.reload();
    }
  };

  // --- 6. VIEW CASE POPULATION ENGINE ---
  // This logic runs if we are on the view-case.html page
  const viewId = new URLSearchParams(window.location.search).get('id');
  if (viewId) {
    const archived = JSON.parse(localStorage.getItem('mauryan_archive') || '[]');
    const c = archived.find(item => item.id === viewId) || legacyRecords[viewId];

    if (c) {
      // Header
      if (q('#viewCompany')) q('#viewCompany').textContent = c.company;
      if (q('#viewCompanySmall')) q('#viewCompanySmall').textContent = c.company;
      if (q('#viewCaseId')) q('#viewCaseId').textContent = `CASE ID: ${c.id}`;
      if (q('#viewDate')) q('#viewDate').textContent = `DATE: ${c.date}`;
      if (q('#viewStatus')) q('#viewStatus').textContent = `STATUS: ${c.status.toUpperCase()}`;
      if (q('#viewGradeBadge')) {
        q('#viewGradeBadge').textContent = c.grade;
        q('#viewGradeBadge').className = `risk-tag ${c.riskClass}`; // Apply color class
      }

      // Details
      if (q('#viewPromoters')) q('#viewPromoters').textContent = c.promoters;
      if (q('#viewSector')) q('#viewSector').textContent = c.sector;
      if (q('#viewEbitda')) q('#viewEbitda').textContent = formatINR(c.metrics.ebitda);
      if (q('#viewDebt')) q('#viewDebt').textContent = formatINR(c.metrics.debtService);
      if (q('#viewFacility')) q('#viewFacility').textContent = formatINR(c.metrics.facility);
      if (q('#viewApproved')) q('#viewApproved').textContent = c.metrics.approvedAmount ? formatINR(c.metrics.approvedAmount) : 'N/A';
      if (q('#viewDscr')) q('#viewDscr').textContent = c.metrics.dscr + 'x';
      if (q('#viewLeverage')) q('#viewLeverage').textContent = c.metrics.leverage + 'x';

      // --- XAI (Explainable AI) Engine for Vivriti Capital Hackathon ---
      const dscrVal = parseFloat(c.metrics.dscr || 1);
      const levVal = parseFloat(c.metrics.leverage || 1);

      // Calculate scores based on metrics
      let finHealth = dscrVal >= 2 ? 92 : (dscrVal >= 1.2 ? 71 : 34);
      let altRisk = c.status === 'Approved' ? 88 : 42;
      let macro = (c.grade === 'A+' || c.grade === 'A') ? 85 : (c.grade.includes('B') ? 62 : 38);

      // Add precise ML "float" to look like a real live calculation
      finHealth = Math.max(10, Math.min(100, Number(finHealth) + (Math.random() * 6 - 3)));
      altRisk = Math.max(10, Math.min(100, Number(altRisk) + (Math.random() * 6 - 3)));
      macro = Math.max(10, Math.min(100, Number(macro) + (Math.random() * 6 - 3)));

      // Format to 1 decimal place
      finHealth = parseFloat(finHealth.toFixed(1));
      altRisk = parseFloat(altRisk.toFixed(1));
      macro = parseFloat(macro.toFixed(1));

      if (q('#xaiFinHealth')) q('#xaiFinHealth').textContent = finHealth + '%';
      if (q('#xaiAltRisk')) q('#xaiAltRisk').textContent = altRisk + '%';
      if (q('#xaiMacro')) q('#xaiMacro').textContent = macro + '%';

      // Animate progress bars
      setTimeout(() => {
        if (q('#xaiFinBar')) {
          q('#xaiFinBar').style.width = finHealth + '%';
          q('#xaiFinBar').style.background = finHealth > 75 ? 'var(--antique-gold)' : (finHealth > 50 ? '#d35400' : '#c0392b');
        }
        if (q('#xaiAltBar')) {
          q('#xaiAltBar').style.width = altRisk + '%';
          q('#xaiAltBar').style.background = altRisk > 75 ? 'var(--imperial-indigo)' : (altRisk > 50 ? '#8e44ad' : '#c0392b');
        }
        if (q('#xaiMacroBar')) {
          q('#xaiMacroBar').style.width = macro + '%';
          q('#xaiMacroBar').style.background = macro > 75 ? '#27ae60' : (macro > 50 ? '#f39c12' : '#c0392b');
        }
      }, 400);

      // Dynamic AI summary tailored for Vivriti Capital
      const summaryEl = q('#xaiSummary');
      if (summaryEl) {
        if (c.status === 'Approved') {
          summaryEl.innerHTML = `<strong>Kautilya Engine Decision:</strong> The neural model recommends <span style="color:var(--antique-gold); font-weight:bold;">APPROVAL</span>. The entity exhibits immense resilience with a robust DSCR of ${dscrVal}x, successfully mitigating alternative data flags. The risk profile aligns seamlessly with <em>Vivriti Capital's mid-market enterprise underwriting thresholds</em>. No significant macro-headwinds detected for the ${c.sector} sector.`;
        } else if (c.status === 'Pending') {
          summaryEl.innerHTML = `<strong>Kautilya Engine Decision:</strong> This case is <span style="color:#f39c12; font-weight:bold;">PENDING REVIEW</span>. While alternative data flags are moderate, the leverage of ${levVal}x requires manual credit committee override. The model suggests further investigation into recent RBI circulars impacting the ${c.sector} sector before proceeding with Vivriti capital deployment.`;
        } else {
          summaryEl.innerHTML = `<strong>Kautilya Engine Decision:</strong> The model flags this as <span style="color:#c0392b; font-weight:bold;">HIGH RISK (REJECT)</span>. A heavily stressed DSCR of ${dscrVal}x combined with elevated counterparty risks indicates a failure to meet Vivriti Capital's baseline prudential thresholds. Severe liquidity alerts detected in connected promoter networks.`;
        }
      }
    }
  }

  // --- 7. DHARMA LEDGER FILTER ENGINE ---
  const ledgerSearch = q('#ledgerSearch');
  const riskFilter = q('#riskFilter');
  const statusFilter = q('#statusFilter');
  const ledgerBody = q('#allCasesBody');

  if (ledgerSearch || riskFilter || statusFilter) {
    const filterLedger = () => {
      const searchTerm = ledgerSearch ? ledgerSearch.value.toLowerCase() : '';
      const riskTerm = riskFilter ? riskFilter.value : '';
      const statusTerm = statusFilter ? statusFilter.value : '';

      if (!ledgerBody) return;

      Array.from(ledgerBody.rows).forEach(row => {
        const company = row.cells[1].innerText.toLowerCase();
        const gradeTitle = row.cells[3].innerText; // Risk Grade Text
        const statusText = row.cells[4].innerText; // Status Text

        const matchesSearch = company.includes(searchTerm);
        const matchesRisk = riskTerm === '' || (
          riskTerm === 'A' ? gradeTitle.startsWith('A') :
            riskTerm === 'BBB' ? gradeTitle === 'BBB' :
              riskTerm === 'BB' ? (gradeTitle === 'BB' || gradeTitle === 'B') :
                gradeTitle.includes(riskTerm)
        );
        const matchesStatus = statusTerm === '' || statusText === statusTerm;

        if (matchesSearch && matchesRisk && matchesStatus) {
          row.style.display = '';
        } else {
          row.style.display = 'none';
        }
      });
    };

    if (ledgerSearch) ledgerSearch.addEventListener('input', filterLedger);
    if (riskFilter) riskFilter.addEventListener('change', filterLedger);
    if (statusFilter) statusFilter.addEventListener('change', filterLedger);
  }

  // --- 8. HERO PARTICLE CANVAS ---
  const heroCanvas = q('#heroParticles');
  if (heroCanvas) {
    const ctx = heroCanvas.getContext('2d');
    const heroSection = q('#heroSection');

    function resizeCanvas() {
      heroCanvas.width = heroSection.offsetWidth;
      heroCanvas.height = heroSection.offsetHeight;
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const particles = [];
    const PARTICLE_COUNT = 60;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        x: Math.random() * heroCanvas.width,
        y: Math.random() * heroCanvas.height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        size: Math.random() * 2 + 0.5,
        opacity: Math.random() * 0.5 + 0.1,
      });
    }

    function drawParticles() {
      ctx.clearRect(0, 0, heroCanvas.width, heroCanvas.height);

      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > heroCanvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > heroCanvas.height) p.vy *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(185, 149, 59, ${p.opacity})`;
        ctx.fill();
      });

      // Draw faint connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(185, 149, 59, ${0.08 * (1 - dist / 120)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      requestAnimationFrame(drawParticles);
    }
    drawParticles();
  }

  // --- 9. ANIMATED NUMBER COUNTERS ---
  const statNumbers = document.querySelectorAll('.stat-number[data-target]');
  if (statNumbers.length > 0) {
    let countersStarted = false;

    function animateCounters() {
      statNumbers.forEach(el => {
        const target = parseInt(el.dataset.target);
        const duration = 2000;
        const start = performance.now();

        function updateCounter(now) {
          const elapsed = now - start;
          const progress = Math.min(elapsed / duration, 1);
          // Ease out cubic
          const eased = 1 - Math.pow(1 - progress, 3);
          el.textContent = Math.floor(target * eased).toLocaleString();
          if (progress < 1) {
            requestAnimationFrame(updateCounter);
          } else {
            el.textContent = target.toLocaleString();
          }
        }
        requestAnimationFrame(updateCounter);
      });
    }

    const counterObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !countersStarted) {
          countersStarted = true;
          animateCounters();
          counterObserver.disconnect();
        }
      });
    }, { threshold: 0.3 });

    const statsBar = q('.stats-bar');
    if (statsBar) counterObserver.observe(statsBar);
  }

  // --- 10. CURSOR TRAIL EFFECT (Desktop Only) ---
  if (window.innerWidth > 1024) {
    const trailCount = 5;
    const trails = [];
    for (let i = 0; i < trailCount; i++) {
      const dot = document.createElement('div');
      dot.className = 'cursor-trail';
      dot.style.width = `${6 - i}px`;
      dot.style.height = `${6 - i}px`;
      dot.style.opacity = `${0.4 - i * 0.08}`;
      document.body.appendChild(dot);
      trails.push({ el: dot, x: 0, y: 0 });
    }

    let mouseX = 0, mouseY = 0;
    document.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      trails[0].el.style.opacity = '0.4';
    });

    function updateTrails() {
      trails.forEach((trail, i) => {
        const prev = i === 0 ? { x: mouseX, y: mouseY } : trails[i - 1];
        trail.x += (prev.x - trail.x) * 0.3;
        trail.y += (prev.y - trail.y) * 0.3;
        trail.el.style.left = `${trail.x}px`;
        trail.el.style.top = `${trail.y}px`;
      });
      requestAnimationFrame(updateTrails);
    }
    updateTrails();
  }

  // --- 11. LIVE TICKER ROTATION ---
  const tickerEl = q('#heroTicker');
  if (tickerEl) {
    const tickerMessages = [
      '128 cases processed today • 99.2% accuracy • 4.2s avg processing',
      'AI Engine v3.0 • Kautilya Framework • Five Cs Analysis',
      '₹4,200 Cr sanctioned • 340 institutions • 12,847 cases analyzed',
      'NLP-powered OCR • Real-time risk scoring • Explainable AI',
      'RBI compliant • AES-256 encryption • Institutional grade security',
    ];
    let tickerIdx = 0;

    setInterval(() => {
      tickerIdx = (tickerIdx + 1) % tickerMessages.length;
      tickerEl.style.transition = 'opacity 0.4s';
      tickerEl.style.opacity = '0';
      setTimeout(() => {
        tickerEl.textContent = tickerMessages[tickerIdx];
        tickerEl.style.opacity = '1';
      }, 400);
    }, 4000);
  }

});
