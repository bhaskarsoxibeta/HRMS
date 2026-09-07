/**
 * ReportOS — Universal HR Reporting Engine Frontend Application
 * Pure Vanilla JavaScript — Enterprise RBAC & Dual Theme Edition
 */

(function () {
  'use strict';

  // --------------------------------------------------------------------------
  // Application State
  // --------------------------------------------------------------------------
  const state = {
    currentUser: null,
    token: null,
    currentView: 'dashboard',
    currentRole: 'cxo',
    currentEntity: 'All',
    currentTheme: localStorage.getItem('reportos_theme') || 'light',
    meta: { entities: [], departments: [], locations: [], employmentTypes: [] },
    fieldCatalog: null,
    builderSelectedFields: ['id', 'name', 'dept', 'entity', 'employmentType', 'ctc'],
    builderFilters: { entity: 'All', dept: 'All', employmentType: 'All', status: 'All' },
    builderPreviewData: null,
    copilotMessages: [
      {
        sender: 'assistant',
        text: 'Welcome to ReportOS Grounded Intelligence. I compute factual metrics directly from your role-scoped HRMS dataset. Select a suggestion below or type your inquiry.',
        chart: null
      }
    ]
  };

  const ROLE_CONFIG = {
    cxo: {
      title: 'CEO (Chief Executive Officer)',
      badge: 'CHIEF EXECUTIVE',
      name: 'CEO Executive Suite',
      scope: 'Global Enterprise Scope: 4 Entities (600 Personnel)'
    },
    chro: {
      title: 'CHRO (Chief HR Officer)',
      badge: 'TALENT & PEOPLE',
      name: 'Chief Human Resources Office',
      scope: 'Company-Wide Talent, Attrition & Recruitment'
    },
    hrbp: {
      title: 'HRBP (Sales Scope)',
      badge: 'BUSINESS PARTNER',
      name: 'Sales HR Business Partner',
      scope: 'Department Scope: Sales (124 Active Personnel)'
    },
    manager: {
      title: 'Line Manager (Management Pod)',
      badge: 'POD LEAD',
      name: 'Operations / Engineering Lead',
      scope: 'Team Pod: 8 Direct Reports'
    },
    employee: {
      title: 'Employee (Self-Service ESS)',
      badge: 'SELF-SERVICE',
      name: 'Individual Contributor',
      scope: 'Scoped Strictly to Self (Aarav Sharma)'
    }
  };

  // --------------------------------------------------------------------------
  // DOM Elements
  // --------------------------------------------------------------------------
  const mainEl = document.getElementById('main');
  const roleSelectEl = document.getElementById('role-select');
  const entitySelectEl = document.getElementById('global-entity-select');
  const breadcrumbCurrentEl = document.getElementById('breadcrumb-current');
  const quickExportBtn = document.getElementById('quick-export-btn');
  const printBriefBtn = document.getElementById('print-brief-btn');
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  const toastContainer = document.getElementById('toast-container');
  const modalBackdrop = document.getElementById('modal-backdrop');
  const modalTitle = document.getElementById('modal-title');
  const modalBody = document.getElementById('modal-body');
  const modalCloseBtn = document.getElementById('modal-close-btn');
  const modalOkBtn = document.getElementById('modal-ok-btn');

  const personaBadgeEl = document.getElementById('persona-badge');
  const personaNameEl = document.getElementById('persona-name');
  const personaScopeEl = document.getElementById('persona-scope');
  const navReportsCountEl = document.getElementById('nav-reports-count');

  // --------------------------------------------------------------------------
  // Theme Toggle Engine
  // --------------------------------------------------------------------------
  function applyTheme(theme) {
    state.currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('reportos_theme', theme);
    if (themeToggleBtn) {
      themeToggleBtn.textContent = `THEME: ${theme.toUpperCase()}`;
    }
  }

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const nextTheme = state.currentTheme === 'light' ? 'dark' : 'light';
      applyTheme(nextTheme);
      showToast(`Switched to ${nextTheme.toUpperCase()} theme`);
    });
  }

  applyTheme(state.currentTheme);

  // --------------------------------------------------------------------------
  // API Fetch Utilities
  // --------------------------------------------------------------------------
  async function fetchJson(url, options = {}) {
    const headers = options.headers || {};
    headers['X-Role'] = state.currentRole;
    options.headers = headers;

    const res = await fetch(url, options);
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({ error: res.statusText }));
      throw { status: res.status, ...errBody };
    }
    return res.json();
  }

  function showToast(message, duration = 3000) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(6px)';
      toast.style.transition = 'opacity 0.2s, transform 0.2s';
      setTimeout(() => toast.remove(), 200);
    }, duration);
  }

  function showModal(title, messageHtml) {
    modalTitle.textContent = title;
    modalBody.innerHTML = messageHtml;
    modalBackdrop.classList.remove('hidden');
  }

  function closeModal() {
    modalBackdrop.classList.add('hidden');
  }

  modalCloseBtn.addEventListener('click', closeModal);
  modalOkBtn.addEventListener('click', closeModal);
  modalBackdrop.addEventListener('click', e => {
    if (e.target === modalBackdrop) closeModal();
  });

  // --------------------------------------------------------------------------
  // Executive PDF / Print Brief Handler
  // --------------------------------------------------------------------------
  if (printBriefBtn) {
    printBriefBtn.addEventListener('click', async () => {
      showToast('Generating executive brief preview...');
      try {
        const kpis = await fetchJson(`/api/kpis?role=${state.currentRole}&entity=${state.currentEntity}`);
        const config = ROLE_CONFIG[state.currentRole] || ROLE_CONFIG.cxo;
        
        let kpiSummaryHtml = '<div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:14px; margin-top:16px;">';
        kpis.forEach(k => {
          kpiSummaryHtml += `
            <div style="border:1px solid var(--border); padding:12px; background:var(--bg-surface);">
              <div style="font-size:10px; font-weight:700; text-transform:uppercase; color:var(--ink-secondary);">${k.label}</div>
              <div style="font-family:var(--font-sans); font-size:24px; font-weight:800; font-variant-numeric:tabular-nums; color:var(--ink); margin:4px 0;">${k.value}</div>
              <div style="font-size:11px; color:var(--accent);">${k.delta} • ${k.subtext}</div>
            </div>
          `;
        });
        kpiSummaryHtml += '</div>';

        showModal(
          `Executive Brief — ${config.name}`,
          `<div>
            <div style="font-family:var(--font-sans); font-size:11px; font-weight:700; color:var(--ink-secondary); border-bottom:1px solid var(--border); padding-bottom:8px;">
              PERSPECTIVE: ${state.currentRole.toUpperCase()} | ENTITY SCOPE: ${state.currentEntity} | DATE: ${new Date().toLocaleDateString()}
            </div>
            <p style="margin-top:10px; font-size:13px; color:var(--ink);">
              Below is the verified summary report brief compiled across active personnel rosters:
            </p>
            ${kpiSummaryHtml}
            <div style="margin-top:20px; text-align:right;">
              <button class="btn btn-secondary" onclick="window.print()" style="margin-right:8px;">Print / Save as PDF</button>
            </div>
          </div>`
        );
      } catch (err) {
        window.print();
      }
    });
  }

  // --------------------------------------------------------------------------
  // SVG Chart Generators
  // --------------------------------------------------------------------------
  function createHorizontalBarChartSvg(data, { width = 450, height = 200, unit = '' } = {}) {
    if (!data || data.length === 0) return '<div style="padding:20px; text-align:center; color:var(--ink-secondary);">No data for current scope</div>';

    const maxVal = Math.max(...data.map(d => d.v), 1);
    const labelWidth = 120;
    const chartWidth = width - labelWidth - 60;
    const rowHeight = Math.max(28, Math.floor((height - 30) / data.length));
    const actualHeight = data.length * rowHeight + 20;

    let svg = `<svg viewBox="0 0 ${width} ${actualHeight}" class="chart-svg" xmlns="http://www.w3.org/2000/svg">`;

    data.forEach((item, idx) => {
      const y = idx * rowHeight + 10;
      const barWidth = Math.max(4, (item.v / maxVal) * chartWidth);
      const isMax = item.v === maxVal;
      const barColor = isMax ? 'var(--accent)' : 'var(--ink)';

      svg += `<text x="${labelWidth - 10}" y="${y + 14}" text-anchor="end" class="chart-tick-label" fill="var(--ink)">${item.k}</text>`;
      svg += `<rect x="${labelWidth}" y="${y + 2}" width="${chartWidth}" height="${rowHeight - 10}" fill="var(--bg-surface)" />`;
      svg += `<rect x="${labelWidth}" y="${y + 2}" width="${barWidth}" height="${rowHeight - 10}" fill="${barColor}">
        <title>${item.k}: ${item.v}${unit ? ' ' + unit : ''}</title>
      </rect>`;
      svg += `<text x="${labelWidth + barWidth + 8}" y="${y + 14}" font-family="var(--font-sans)" font-size="11" font-weight="700" fill="var(--ink)">${item.v}${unit ? unit : ''}</text>`;
    });

    svg += `</svg>`;
    return svg;
  }

  function createLineChartSvg(data, { width = 500, height = 220, unit = '' } = {}) {
    if (!data || data.length === 0) return '<div style="padding:20px; text-align:center; color:var(--ink-secondary);">No data for current scope</div>';

    const padding = { top: 20, right: 30, bottom: 35, left: 45 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    const values = data.map(d => d.v);
    const minVal = Math.min(...values) * 0.96;
    const maxVal = Math.max(...values) * 1.02;
    const range = maxVal - minVal || 1;

    const points = data.map((d, i) => {
      const x = padding.left + (i / Math.max(1, data.length - 1)) * chartW;
      const y = padding.top + chartH - ((d.v - minVal) / range) * chartH;
      return { x, y, k: d.k, v: d.v };
    });

    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${(padding.top + chartH).toFixed(1)} L ${points[0].x.toFixed(1)} ${(padding.top + chartH).toFixed(1)} Z`;

    let svg = `<svg viewBox="0 0 ${width} ${height}" class="chart-svg" xmlns="http://www.w3.org/2000/svg">`;

    for (let s = 0; s <= 3; s++) {
      const stepVal = minVal + (range / 3) * s;
      const y = padding.top + chartH - (s / 3) * chartH;
      svg += `<line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" class="chart-grid-line" />`;
      svg += `<text x="${padding.left - 8}" y="${y + 3}" text-anchor="end" class="chart-tick-label">${Math.round(stepVal)}</text>`;
    }

    svg += `<path d="${areaPath}" fill="var(--accent-light)" opacity="0.7" />`;
    svg += `<path d="${linePath}" class="chart-line-path" />`;

    points.forEach(p => {
      svg += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4" class="chart-point">
        <title>${p.k}: ${p.v} ${unit}</title>
      </circle>`;
      svg += `<text x="${p.x.toFixed(1)}" y="${height - 12}" text-anchor="middle" class="chart-tick-label">${p.k}</text>`;
    });

    svg += `</svg>`;
    return svg;
  }

  function createDonutChartSvg(data, { size = 180 } = {}) {
    if (!data || data.length === 0) return '<div style="padding:20px; text-align:center; color:var(--ink-secondary);">No data for current scope</div>';

    const cx = size / 2;
    const cy = size / 2;
    const radius = size * 0.40;
    const innerRadius = size * 0.24;

    let total = data.reduce((s, d) => s + d.v, 0);
    if (total === 0) total = 1;

    let cumulativePercent = 0;
    const slices = data.map(d => {
      const percent = d.v / total;
      const startAngle = cumulativePercent * 2 * Math.PI;
      cumulativePercent += percent;
      const endAngle = cumulativePercent * 2 * Math.PI;
      return { ...d, startAngle, endAngle, percent };
    });

    function getCoordinates(angle, r) {
      return {
        x: cx + r * Math.sin(angle),
        y: cy - r * Math.cos(angle)
      };
    }

    let svg = `<div style="display:flex; align-items:center; justify-content:center; gap:20px;">`;
    svg += `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" class="chart-svg" xmlns="http://www.w3.org/2000/svg">`;

    slices.forEach(slice => {
      const isLargeArc = slice.percent > 0.5 ? 1 : 0;
      const p1 = getCoordinates(slice.startAngle, radius);
      const p2 = getCoordinates(slice.endAngle, radius);
      const p3 = getCoordinates(slice.endAngle, innerRadius);
      const p4 = getCoordinates(slice.startAngle, innerRadius);

      const path = [
        `M ${p1.x} ${p1.y}`,
        `A ${radius} ${radius} 0 ${isLargeArc} 1 ${p2.x} ${p2.y}`,
        `L ${p3.x} ${p3.y}`,
        `A ${innerRadius} ${innerRadius} 0 ${isLargeArc} 0 ${p4.x} ${p4.y}`,
        'Z'
      ].join(' ');

      svg += `<path d="${path}" fill="${slice.c}" class="chart-donut-slice">
        <title>${slice.label}: ${slice.v}% (${slice.count || 0})</title>
      </path>`;
    });

    svg += `<text x="${cx}" y="${cy + 4}" text-anchor="middle" font-family="var(--font-sans)" font-size="13" font-weight="800" fill="var(--ink)">Mix</text>`;
    svg += `</svg>`;

    svg += `<div class="donut-legend">`;
    data.forEach(item => {
      svg += `<div class="legend-item">
        <span class="legend-color" style="background-color:${item.c};"></span>
        <span class="legend-label">${item.label}</span>
        <span class="legend-value">${item.v}%</span>
      </div>`;
    });
    svg += `</div></div>`;

    return svg;
  }

  // --------------------------------------------------------------------------
  // Update Persona Card in Sidebar
  // --------------------------------------------------------------------------
  // Update Persona & RBAC Visibility (CEO Module strictly CEO only)
  // --------------------------------------------------------------------------
  function updateRoleVisibility() {
    const isCeo = state.currentRole === 'cxo';
    if (isCeo) {
      document.body.classList.add('is-ceo-role');
    } else {
      document.body.classList.remove('is-ceo-role');
    }

    document.querySelectorAll('.nav-ceo-only').forEach(el => {
      if (isCeo) {
        el.style.removeProperty('display');
      } else {
        el.style.setProperty('display', 'none', 'important');
      }
    });
  }

  function updatePersonaUi() {
    const config = ROLE_CONFIG[state.currentRole] || ROLE_CONFIG.cxo;
    if (personaBadgeEl) personaBadgeEl.textContent = config.badge;
    if (personaNameEl) personaNameEl.textContent = config.name;
    if (personaScopeEl) personaScopeEl.textContent = config.scope;
  }

  // --------------------------------------------------------------------------
  // VIEW: Dashboard
  // --------------------------------------------------------------------------
  async function renderDashboard() {
    breadcrumbCurrentEl.textContent = 'Dashboard';
    updatePersonaUi();
    updateRoleVisibility();

    // Determine custom chart titles based on role
    let chart1Title = 'Headcount Trajectory (Trailing 6 Months)';
    let chart2Title = 'Workforce Gender Mix';
    let chart3Title = 'TTM Attrition Rate by Operating Department';

    if (state.currentRole === 'employee') {
      chart1Title = 'My Monthly Activity & Presence Trend';
      chart2Title = 'My Annual Leave Utilization Mix';
      chart3Title = 'My Target Performance Goal Milestones';
    } else if (state.currentRole === 'manager') {
      chart1Title = 'Direct Reports Pod Trajectory';
      chart2Title = 'Pod Workforce Gender Mix';
      chart3Title = 'Direct Reports Presence Rate (%)';
    } else if (state.currentRole === 'hrbp') {
      chart1Title = 'Sales Headcount Trajectory (Trailing 6 Months)';
      chart2Title = 'Sales Workforce Gender Mix';
      chart3Title = 'Sales Attrition Rate by Office Location';
    }

    mainEl.innerHTML = `
      <div class="page-header">
        <div>
          <h2 class="page-title">Executive Dashboard</h2>
          <p class="page-subtitle">Perspective: <strong style="color:var(--ink);">${state.currentRole.toUpperCase()}</strong> • Scoped real-time analytics • Entity: <strong style="color:var(--ink);">${state.currentEntity}</strong></p>
        </div>
        <div class="page-meta">
          <span>DATA ANCHOR: JUNE 2026</span>
        </div>
      </div>

      <div class="dashboard-grid">
        ${state.currentRole === 'cxo' ? `
          <div class="ceo-banner-card">
            <div class="ceo-banner-content">
              <span class="ceo-banner-badge">CEO ACTIVE</span>
              <span class="ceo-banner-text">Authenticated in Chief Executive Suite. Full multi-entity consolidation, margins &amp; strategic sign-offs unlocked.</span>
            </div>
            <a href="#ceo" class="ceo-banner-action">Access CEO Executive Suite &rarr;</a>
          </div>
        ` : ''}

        <div class="kpi-section" id="kpi-cards-host">
          <div class="kpi-card hero-kpi"><div class="kpi-label">Loading KPIs...</div></div>
        </div>

        <div class="charts-grid">
          <div class="chart-card">
            <div class="chart-header">
              <h3 class="chart-title">${chart1Title}</h3>
              <span class="chart-meta">Role Scoped</span>
            </div>
            <div class="chart-container" id="chart-headcount-trend">Loading trend chart...</div>
          </div>

          <div class="chart-card">
            <div class="chart-header">
              <h3 class="chart-title">${chart2Title}</h3>
              <span class="chart-meta">Composition</span>
            </div>
            <div class="chart-container" id="chart-gender-mix">Loading composition...</div>
          </div>

          <div class="chart-card full-bleed">
            <div class="chart-header">
              <h3 class="chart-title">${chart3Title}</h3>
              <span class="chart-meta">Analytical Scope</span>
            </div>
            <div class="chart-container" id="chart-attrition-dept">Loading analytical breakdown...</div>
          </div>
        </div>
      </div>
    `;

    try {
      const kpis = await fetchJson(`/api/kpis?role=${state.currentRole}&entity=${state.currentEntity}`);
      const host = document.getElementById('kpi-cards-host');
      if (host && kpis.length > 0) {
        let html = '';
        kpis.forEach((kpi, index) => {
          const isHero = index === 0;
          html += `
            <div class="kpi-card ${isHero ? 'hero-kpi' : ''}">
              <div>
                <div class="kpi-label">${kpi.label}</div>
                <div class="kpi-value">${kpi.value}</div>
              </div>
              <div class="kpi-footer">
                <span class="kpi-delta ${kpi.cls}">${kpi.delta}</span>
                <span class="kpi-subtext">${kpi.subtext}</span>
              </div>
            </div>
          `;
        });
        host.innerHTML = html;
      }
    } catch (err) {
      console.error('Failed to load KPIs:', err);
    }

    try {
      const trendData = await fetchJson(`/api/charts/headcount-trend?role=${state.currentRole}&entity=${state.currentEntity}`);
      const container = document.getElementById('chart-headcount-trend');
      if (container) container.innerHTML = createLineChartSvg(trendData, { width: 520, height: 210, unit: 'personnel' });
    } catch (err) {
      console.error('Failed to load trend:', err);
    }

    try {
      const mixData = await fetchJson(`/api/charts/gender-mix?role=${state.currentRole}&entity=${state.currentEntity}`);
      const container = document.getElementById('chart-gender-mix');
      if (container) container.innerHTML = createDonutChartSvg(mixData, { size: 170 });
    } catch (err) {
      console.error('Failed to load mix:', err);
    }

    try {
      const attritionData = await fetchJson(`/api/charts/attrition-by-dept?role=${state.currentRole}&entity=${state.currentEntity}`);
      const container = document.getElementById('chart-attrition-dept');
      if (container) container.innerHTML = createHorizontalBarChartSvg(attritionData, { width: 900, height: 180, unit: '%' });
    } catch (err) {
      console.error('Failed to load attrition:', err);
    }
  }

  // --------------------------------------------------------------------------
  // VIEW: Report Library
  // --------------------------------------------------------------------------
  let activeLibraryCategory = 'All';

  async function renderReportLibrary() {
    breadcrumbCurrentEl.textContent = 'Report Library';
    updatePersonaUi();

    mainEl.innerHTML = `
      <div class="page-header">
        <div>
          <h2 class="page-title">Standard Report Catalog</h2>
          <p class="page-subtitle">21 Enterprise analytical rosters • All 21 wired with executable CSV generation engines</p>
        </div>
        <div class="page-meta">
          <span>ROLE: ${state.currentRole.toUpperCase()}</span>
        </div>
      </div>

      <div class="library-layout">
        <div class="category-tabs" id="library-category-tabs">
          <button class="category-tab ${activeLibraryCategory === 'All' ? 'active' : ''}" data-cat="All">All Categories</button>
          <button class="category-tab ${activeLibraryCategory === 'Workforce & Headcount' ? 'active' : ''}" data-cat="Workforce & Headcount">Workforce &amp; Headcount</button>
          <button class="category-tab ${activeLibraryCategory === 'Recruitment' ? 'active' : ''}" data-cat="Recruitment">Recruitment</button>
          <button class="category-tab ${activeLibraryCategory === 'Payroll & Compensation' ? 'active' : ''}" data-cat="Payroll & Compensation">Payroll &amp; Comp</button>
          <button class="category-tab ${activeLibraryCategory === 'Attendance & Leave' ? 'active' : ''}" data-cat="Attendance & Leave">Attendance &amp; Leave</button>
          <button class="category-tab ${activeLibraryCategory === 'Performance' ? 'active' : ''}" data-cat="Performance">Performance</button>
          <button class="category-tab ${activeLibraryCategory === 'Compliance & Statutory' ? 'active' : ''}" data-cat="Compliance & Statutory">Compliance</button>
          <button class="category-tab ${activeLibraryCategory === 'Learning & Development' ? 'active' : ''}" data-cat="Learning & Development">L&amp;D</button>
          <button class="category-tab ${activeLibraryCategory === 'Employee Experience' ? 'active' : ''}" data-cat="Employee Experience">Employee Experience</button>
        </div>

        <div class="reports-list" id="reports-list-host">
          <div style="padding:40px; text-align:center; color:var(--ink-secondary);">Loading report catalog...</div>
        </div>
      </div>
    `;

    const tabsHost = document.getElementById('library-category-tabs');
    tabsHost.querySelectorAll('.category-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        tabsHost.querySelectorAll('.category-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeLibraryCategory = btn.getAttribute('data-cat');
        loadReportsList(activeLibraryCategory);
      });
    });

    loadReportsList(activeLibraryCategory);
  }

  async function loadReportsList(category) {
    const listHost = document.getElementById('reports-list-host');
    try {
      const reports = await fetchJson(`/api/reports?category=${encodeURIComponent(category)}&role=${state.currentRole}`);
      
      const permittedCount = reports.filter(r => r.permitted).length;
      if (navReportsCountEl) navReportsCountEl.textContent = `${permittedCount}/21`;

      const groups = {};
      reports.forEach(r => {
        if (!groups[r.cat]) groups[r.cat] = [];
        groups[r.cat].push(r);
      });

      let html = '';
      Object.keys(groups).forEach(catName => {
        const catReports = groups[catName];
        html += `
          <div class="report-category-group">
            <div class="category-group-header">
              <span>${catName}</span>
              <span class="category-count">${catReports.length} reports</span>
            </div>
            <table class="report-table">
              <thead>
                <tr>
                  <th style="width: 28%;">Report Name</th>
                  <th style="width: 44%;">Analytical Scope &amp; Purpose</th>
                  <th style="width: 14%;">Access Level</th>
                  <th style="width: 14%; text-align:right;">Action</th>
                </tr>
              </thead>
              <tbody>
        `;

        catReports.forEach(r => {
          const isPermitted = r.permitted;
          html += `
            <tr>
              <td class="report-name-cell">${r.name}</td>
              <td class="report-desc-cell">${r.desc}</td>
              <td>
                ${isPermitted 
                  ? '<span class="badge-wired">Authorized CSV</span>' 
                  : '<span class="badge-restricted">Role Restricted</span>'}
              </td>
              <td style="text-align:right;">
                <button class="btn ${isPermitted ? 'btn-primary' : 'btn-secondary'} btn-sm run-report-btn" data-id="${r.id}" data-permitted="${isPermitted}" data-name="${r.name}">
                  ${isPermitted ? 'Download CSV' : 'Restricted'}
                </button>
              </td>
            </tr>
          `;
        });

        html += `</tbody></table></div>`;
      });

      listHost.innerHTML = html;

      listHost.querySelectorAll('.run-report-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const reportId = btn.getAttribute('data-id');
          const isPermitted = btn.getAttribute('data-permitted') === 'true';
          const reportName = btn.getAttribute('data-name');

          if (isPermitted) {
            showToast(`Generating ${reportName}...`);
            window.location.href = `/api/reports/${reportId}/csv?role=${state.currentRole}`;
          } else {
            showModal(
              'RBAC Access Boundary Notice',
              `<p><strong>${reportName}</strong> is restricted from your active identity perspective (<strong>${state.currentRole.toUpperCase()}</strong>).</p>
               <p style="margin-top:10px; color:var(--ink-secondary);">To access this analytical report, switch your role perspective in the top navigation bar to an authorized role (CXO, CHRO, or HRBP).</p>`
            );
          }
        });
      });

    } catch (err) {
      listHost.innerHTML = `<div style="padding:20px; color:var(--negative);">Failed to load reports: ${err.message || 'Unknown error'}</div>`;
    }
  }

  // --------------------------------------------------------------------------
  // VIEW: Custom Report Builder
  // --------------------------------------------------------------------------
  async function renderCustomBuilder() {
    breadcrumbCurrentEl.textContent = 'Custom Builder';
    updatePersonaUi();

    try {
      state.fieldCatalog = await fetchJson(`/api/builder/fields?role=${state.currentRole}`);
    } catch (err) {
      console.error('Failed to load fields:', err);
    }

    mainEl.innerHTML = `
      <div class="page-header">
        <div>
          <h2 class="page-title">Custom Report Builder</h2>
          <p class="page-subtitle">Role-scoped schema projection • Live synchronized preview table &amp; CSV export</p>
        </div>
        <div class="page-meta">
          <span>ROLE: ${state.currentRole.toUpperCase()}</span>
        </div>
      </div>

      <div class="builder-layout">
        <div class="builder-controls-grid">
          <div class="field-selector-card">
            <div class="section-heading">
              <span>Select Attributes to Include</span>
              <button id="builder-select-all-btn" class="btn btn-secondary btn-sm">Select All Available</button>
            </div>
            <div class="field-categories" id="field-categories-host"></div>
          </div>

          <div class="filters-card">
            <div class="section-heading">
              <span>Roster Query Filters</span>
            </div>
            
            <div class="filter-item">
              <label for="filter-entity">Operating Entity</label>
              <select id="filter-entity">
                <option value="All">All Entities</option>
                ${state.meta.entities.map(e => `<option value="${e}" ${state.builderFilters.entity === e ? 'selected' : ''}>${e}</option>`).join('')}
              </select>
            </div>

            <div class="filter-item">
              <label for="filter-dept">Department</label>
              <select id="filter-dept">
                <option value="All">All Departments</option>
                ${state.meta.departments.map(d => `<option value="${d}" ${state.builderFilters.dept === d ? 'selected' : ''}>${d}</option>`).join('')}
              </select>
            </div>

            <div class="filter-item">
              <label for="filter-emp-type">Employment Type</label>
              <select id="filter-emp-type">
                <option value="All">All Types</option>
                ${state.meta.employmentTypes.map(t => `<option value="${t}" ${state.builderFilters.employmentType === t ? 'selected' : ''}>${t}</option>`).join('')}
              </select>
            </div>

            <div class="filter-item">
              <label for="filter-status">Employment Status</label>
              <select id="filter-status">
                <option value="All" ${state.builderFilters.status === 'All' ? 'selected' : ''}>All (Active &amp; Exited)</option>
                <option value="Active" ${state.builderFilters.status === 'Active' ? 'selected' : ''}>Active Only</option>
                <option value="Exited" ${state.builderFilters.status === 'Exited' ? 'selected' : ''}>Exited Only</option>
              </select>
            </div>
          </div>
        </div>

        <div class="preview-section">
          <div class="preview-header">
            <div>
              <h3 style="font-family:var(--font-sans); font-size:18px; font-weight:750;">Live Query Preview</h3>
              <div class="preview-meta" id="preview-count-meta">Showing first 8 matching rows</div>
            </div>
            <div style="display:flex; gap:10px;">
              <button id="builder-save-btn" class="btn btn-secondary">Save Report Definition</button>
              <button id="builder-download-btn" class="btn btn-primary">Download Full CSV</button>
            </div>
          </div>

          <div class="data-table-container" id="preview-table-host">
            <div style="padding:30px; text-align:center; color:var(--ink-secondary);">Computing live projection...</div>
          </div>
        </div>

        <div class="card" style="margin-top:10px;">
          <div class="section-heading">
            <span>Saved Custom Report Definitions</span>
          </div>
          <div id="saved-reports-host" style="font-size:12.5px; color:var(--ink-secondary);">
            Loading saved definitions...
          </div>
        </div>
      </div>
    `;

    const categoriesHost = document.getElementById('field-categories-host');
    if (state.fieldCatalog && categoriesHost) {
      let catHtml = '';
      Object.keys(state.fieldCatalog).forEach(catName => {
        const fields = state.fieldCatalog[catName];
        catHtml += `
          <div>
            <div class="field-cat-title">${catName}</div>
            <div class="field-checkbox-list">
        `;
        fields.forEach(f => {
          const isChecked = state.builderSelectedFields.includes(f.key);
          catHtml += `
            <label class="checkbox-label">
              <input type="checkbox" class="field-checkbox" value="${f.key}" ${isChecked ? 'checked' : ''}>
              <span>${f.label}</span>
            </label>
          `;
        });
        catHtml += `</div></div>`;
      });
      categoriesHost.innerHTML = catHtml;

      categoriesHost.querySelectorAll('.field-checkbox').forEach(cb => {
        cb.addEventListener('change', () => {
          const key = cb.value;
          if (cb.checked) {
            if (!state.builderSelectedFields.includes(key)) state.builderSelectedFields.push(key);
          } else {
            state.builderSelectedFields = state.builderSelectedFields.filter(k => k !== key);
          }
          refreshBuilderPreview();
        });
      });
    }

    ['filter-entity', 'filter-dept', 'filter-emp-type', 'filter-status'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('change', () => {
          state.builderFilters.entity = document.getElementById('filter-entity').value;
          state.builderFilters.dept = document.getElementById('filter-dept').value;
          state.builderFilters.employmentType = document.getElementById('filter-emp-type').value;
          state.builderFilters.status = document.getElementById('filter-status').value;
          refreshBuilderPreview();
        });
      }
    });

    document.getElementById('builder-select-all-btn').addEventListener('click', () => {
      const allKeys = [];
      Object.values(state.fieldCatalog).forEach(list => list.forEach(f => allKeys.push(f.key)));
      state.builderSelectedFields = allKeys;
      categoriesHost.querySelectorAll('.field-checkbox').forEach(cb => cb.checked = true);
      refreshBuilderPreview();
    });

    document.getElementById('builder-download-btn').addEventListener('click', async () => {
      try {
        showToast('Serializing full query dataset to CSV...');
        const res = await fetch('/api/builder/csv', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fields: state.builderSelectedFields,
            filters: state.builderFilters,
            role: state.currentRole,
            name: 'custom_hr_report'
          })
        });
        const blob = await res.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = 'custom_hr_report.csv';
        document.body.appendChild(a);
        a.click();
        a.remove();
        showToast('CSV downloaded successfully.');
      } catch (err) {
        showToast('Failed to export CSV');
      }
    });

    document.getElementById('builder-save-btn').addEventListener('click', () => {
      const reportName = prompt('Enter a name for this custom report definition:');
      if (reportName && reportName.trim()) {
        saveCurrentReportDefinition(reportName.trim());
      }
    });

    refreshBuilderPreview();
    loadSavedReports();
  }

  async function refreshBuilderPreview() {
    const tableHost = document.getElementById('preview-table-host');
    const countMeta = document.getElementById('preview-count-meta');
    if (!tableHost) return;

    try {
      const preview = await fetchJson('/api/builder/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: state.builderSelectedFields,
          filters: state.builderFilters,
          role: state.currentRole
        })
      });

      if (countMeta) {
        countMeta.textContent = `Showing ${preview.rows.length} of ${preview.total} matching records for active role (${state.currentRole.toUpperCase()})`;
      }

      if (preview.rows.length === 0) {
        tableHost.innerHTML = '<div style="padding:28px; text-align:center; color:var(--ink-secondary);">No records match the active filter criteria.</div>';
        return;
      }

      let tableHtml = '<table class="data-table"><thead><tr>';
      preview.columns.forEach(col => {
        tableHtml += `<th>${col.label}</th>`;
      });
      tableHtml += '</tr></thead><tbody>';

      preview.rows.forEach(row => {
        tableHtml += '<tr>';
        preview.columns.forEach(col => {
          tableHtml += `<td>${row[col.key] !== undefined && row[col.key] !== null ? row[col.key] : '—'}</td>`;
        });
        tableHtml += '</tr>';
      });

      tableHtml += '</tbody></table>';
      tableHost.innerHTML = tableHtml;
    } catch (err) {
      tableHost.innerHTML = `<div style="padding:20px; color:var(--negative);">Preview error: ${err.message || 'Unknown error'}</div>`;
    }
  }

  async function saveCurrentReportDefinition(name) {
    try {
      await fetchJson('/api/builder/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          fields: state.builderSelectedFields,
          filters: state.builderFilters,
          role: state.currentRole
        })
      });
      showToast(`Saved report "${name}"`);
      loadSavedReports();
    } catch (err) {
      showToast(`Error saving report: ${err.message}`);
    }
  }

  async function loadSavedReports() {
    const host = document.getElementById('saved-reports-host');
    if (!host) return;

    try {
      const saved = await fetchJson('/api/builder/saved');
      if (saved.length === 0) {
        host.innerHTML = '<em>No custom report definitions saved yet. Configure fields above and click "Save Report Definition".</em>';
        return;
      }

      let html = '<div style="display:flex; flex-direction:column; gap:8px;">';
      saved.forEach(item => {
        html += `
          <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; background:var(--bg-surface); border:1px solid var(--border);">
            <div>
              <strong style="color:var(--ink); font-size:13px;">${item.name}</strong>
              <div style="font-size:11px; color:var(--ink-secondary); margin-top:2px;">
                ${item.fields.length} attributes selected • Created by ${item.createdByRole || 'Admin'} on ${new Date(item.createdAt).toLocaleDateString()}
              </div>
            </div>
            <button class="btn btn-secondary btn-sm load-saved-btn" data-json="${encodeURIComponent(JSON.stringify(item))}">
              Load Schema
            </button>
          </div>
        `;
      });
      html += '</div>';
      host.innerHTML = html;

      host.querySelectorAll('.load-saved-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const item = JSON.parse(decodeURIComponent(btn.getAttribute('data-json')));
          state.builderSelectedFields = item.fields || [];
          state.builderFilters = item.filters || {};
          renderCustomBuilder();
          showToast(`Loaded definition "${item.name}"`);
        });
      });
    } catch (err) {
      console.error('Failed to load saved reports:', err);
    }
  }

  // --------------------------------------------------------------------------
  // VIEW: AI Copilot
  // --------------------------------------------------------------------------
  function renderCopilot() {
    breadcrumbCurrentEl.textContent = 'AI Copilot';
    updatePersonaUi();

    mainEl.innerHTML = `
      <div class="page-header">
        <div>
          <h2 class="page-title">Grounded Intelligence Copilot</h2>
          <p class="page-subtitle">Natural language analytics • Role-enforced computations and inline charting</p>
        </div>
        <div class="page-meta">
          <span>ROLE: ${state.currentRole.toUpperCase()}</span>
        </div>
      </div>

      <div class="copilot-layout">
        <div class="chat-panel">
          <div class="chat-messages" id="chat-messages-host"></div>
          <form class="chat-input-wrapper" id="chat-form">
            <input type="text" id="chat-input" class="chat-input" placeholder="Ask a question (e.g., 'What is our attrition rate?' or 'Show leave liability')..." autocomplete="off">
            <button type="submit" class="btn btn-primary">Query Engine</button>
          </form>
        </div>

        <div class="copilot-sidebar">
          <div class="card">
            <div class="section-heading">
              <span>Verified Role Prompts</span>
            </div>
            <div class="suggestion-chips">
              <button class="chip-btn" data-q="What is our current attrition rate?">
                <span class="chip-tag">Workforce Dynamics</span>
                What is our current attrition rate?
              </button>
              <button class="chip-btn" data-q="Show Sales department attrition">
                <span class="chip-tag">Department Focus</span>
                Show Sales department attrition
              </button>
              <button class="chip-btn" data-q="What is our total leave encashment liability?">
                <span class="chip-tag">Financial Accrual</span>
                What is our total leave encashment liability?
              </button>
              <button class="chip-btn" data-q="Are we tracking over budget on payroll?">
                <span class="chip-tag">Compensation Variance</span>
                Are we tracking over budget on payroll?
              </button>
              <button class="chip-btn" data-q="What is our active headcount and 6-month trend?">
                <span class="chip-tag">Headcount Scale</span>
                What is our active headcount &amp; 6-month trend?
              </button>
            </div>
          </div>

          <div class="card" style="background-color:var(--bg-surface);">
            <div class="section-heading">
              <span>Security &amp; Tool Seam</span>
            </div>
            <p style="font-size:11.5px; color:var(--ink-secondary); line-height:1.5;">
              Queries are evaluated against your active role perspective (<strong>${state.currentRole.toUpperCase()}</strong>). Sensitive compensation queries by unauthorized roles are cleanly intercepted.
            </p>
          </div>
        </div>
      </div>
    `;

    renderChatMessages();

    const form = document.getElementById('chat-form');
    const input = document.getElementById('chat-input');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      input.value = '';
      await handleUserCopilotQuery(text);
    });

    document.querySelectorAll('.chip-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const q = btn.getAttribute('data-q');
        await handleUserCopilotQuery(q);
      });
    });
  }

  function renderChatMessages() {
    const host = document.getElementById('chat-messages-host');
    if (!host) return;

    let html = '';
    state.copilotMessages.forEach(msg => {
      const isUser = msg.sender === 'user';
      const formattedText = msg.text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

      let chartHtml = '';
      if (msg.chart && msg.chart.data) {
        chartHtml = `
          <div class="bubble-chart-container">
            <div class="bubble-chart-title">${msg.chart.title || 'Computed Chart'}</div>
        `;
        if (msg.chart.type === 'bar') {
          chartHtml += createHorizontalBarChartSvg(msg.chart.data, { width: 440, height: 160, unit: msg.chart.unit || '' });
        } else if (msg.chart.type === 'line') {
          chartHtml += createLineChartSvg(msg.chart.data, { width: 440, height: 180, unit: msg.chart.unit || '' });
        }
        chartHtml += `</div>`;
      }

      html += `
        <div class="chat-bubble ${isUser ? 'user' : 'assistant'}">
          <span class="bubble-sender">${isUser ? `Query (${state.currentRole.toUpperCase()})` : 'ReportOS Intelligence'}</span>
          <div class="bubble-content">
            <div>${formattedText}</div>
            ${chartHtml}
          </div>
        </div>
      `;
    });

    host.innerHTML = html;
    host.scrollTop = host.scrollHeight;
  }

  async function handleUserCopilotQuery(question) {
    state.copilotMessages.push({
      sender: 'user',
      text: question,
      chart: null
    });
    renderChatMessages();

    try {
      const res = await fetchJson('/api/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, role: state.currentRole })
      });

      state.copilotMessages.push({
        sender: 'assistant',
        text: res.text,
        chart: res.chart
      });
      renderChatMessages();
    } catch (err) {
      state.copilotMessages.push({
        sender: 'assistant',
        text: `Error processing intelligence query: ${err.message || 'Service unavailable'}`,
        chart: null
      });
      renderChatMessages();
    }
  }

  // --------------------------------------------------------------------------
  // VIEW: Scheduled Reports & Automations
  // --------------------------------------------------------------------------
  async function renderSchedules() {
    breadcrumbCurrentEl.textContent = 'Automations & Schedules';
    updatePersonaUi();

    mainEl.innerHTML = `
      <div class="page-header">
        <div>
          <h2 class="page-title">Automated Export Schedules</h2>
          <p class="page-subtitle">Configure recurring batch CSV/PDF export dispatches to executive stakeholders</p>
        </div>
        <div class="page-meta">
          <button id="create-schedule-btn" class="btn btn-primary">Create Scheduled Job</button>
        </div>
      </div>

      <div class="schedule-grid" id="schedules-host">
        <div style="padding:30px; text-align:center; color:var(--ink-secondary);">Loading scheduled jobs...</div>
      </div>
    `;

    try {
      const schedules = await fetchJson('/api/schedules');
      const host = document.getElementById('schedules-host');
      if (schedules.length === 0) {
        host.innerHTML = '<div>No automated export schedules configured yet.</div>';
        return;
      }

      let html = '';
      schedules.forEach(job => {
        html += `
          <div class="schedule-card">
            <div>
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <span class="badge-wired">${job.frequency}</span>
                <span style="font-family:var(--font-sans); font-size:10.5px; font-weight:700; color:var(--ink-secondary);">${job.id}</span>
              </div>
              <h4 class="schedule-title">${job.name}</h4>
              <div class="schedule-meta-row">
                <span>Target Format</span>
                <span class="schedule-meta-val">${job.format}</span>
              </div>
              <div class="schedule-meta-row">
                <span>Distribution List</span>
                <span class="schedule-meta-val">${job.recipients}</span>
              </div>
            </div>
            <div style="border-top:1px solid var(--border-light); margin-top:14px; padding-top:10px; display:flex; justify-content:space-between; align-items:center;">
              <span style="font-size:11px; color:var(--ink-tertiary);">Last Run: ${job.lastRun}</span>
              <button class="btn btn-secondary btn-sm run-schedule-now" data-name="${job.name}">Run Now</button>
            </div>
          </div>
        `;
      });
      host.innerHTML = html;

      host.querySelectorAll('.run-schedule-now').forEach(btn => {
        btn.addEventListener('click', () => {
          showToast(`Dispatched "${btn.getAttribute('data-name')}" to stakeholders.`);
        });
      });

      document.getElementById('create-schedule-btn').addEventListener('click', () => {
        const name = prompt('Enter a name for the new recurring schedule:');
        if (name && name.trim()) {
          fetchJson('/api/schedules', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: name.trim(),
              frequency: 'Weekly (Every Monday 09:00 AM)',
              format: 'CSV',
              recipients: 'stakeholders@company.com'
            })
          }).then(() => {
            showToast(`Created schedule "${name}"`);
            renderSchedules();
          });
        }
      });
    } catch (err) {
      console.error('Failed to load schedules:', err);
    }
  }

  // --------------------------------------------------------------------------
  // VIEW: Security & Audit Trail
  // --------------------------------------------------------------------------
  async function renderAudit() {
    breadcrumbCurrentEl.textContent = 'Security & Audit Trail';
    updatePersonaUi();

    mainEl.innerHTML = `
      <div class="page-header">
        <div>
          <h2 class="page-title">Security &amp; Export Audit Log</h2>
          <p class="page-subtitle">Immutable event stream of all CSV downloads, schema projections, and role elevations</p>
        </div>
        <div class="page-meta">
          <span>REAL-TIME AUDIT LOG</span>
        </div>
      </div>

      <div class="card">
        <table class="report-table">
          <thead>
            <tr>
              <th style="width: 15%;">Event ID</th>
              <th style="width: 20%;">Timestamp (UTC)</th>
              <th style="width: 15%;">Persona / Role</th>
              <th style="width: 20%;">Action Executed</th>
              <th style="width: 20%;">Resource Target</th>
              <th style="width: 10%;">Status</th>
            </tr>
          </thead>
          <tbody id="audit-table-body">
            <tr><td colspan="6" style="padding:20px; text-align:center;">Loading audit logs...</td></tr>
          </tbody>
        </table>
      </div>
    `;

    try {
      const logs = await fetchJson('/api/audit-log');
      const tbody = document.getElementById('audit-table-body');
      if (logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="padding:20px; text-align:center;">No audit records available.</td></tr>';
        return;
      }

      let html = '';
      logs.forEach(log => {
        html += `
          <tr>
            <td style="font-family:var(--font-sans); font-size:11px; font-weight:700; font-variant-numeric:tabular-nums;">${log.id}</td>
            <td style="font-family:var(--font-sans); font-size:11.5px; font-variant-numeric:tabular-nums; color:var(--ink-secondary);">${new Date(log.timestamp).toLocaleString()}</td>
            <td><span class="badge-wired">${log.role.toUpperCase()}</span></td>
            <td style="font-family:var(--font-sans); font-size:11.5px; font-weight:700;">${log.action}</td>
            <td style="color:var(--ink);">${log.target}</td>
            <td><span class="badge-wired">${log.status}</span></td>
          </tr>
        `;
      });
      tbody.innerHTML = html;
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    }
  }

  // --------------------------------------------------------------------------
  // VIEW: CEO Strategic Module (Strictly CEO Panel Only)
  // --------------------------------------------------------------------------
  async function renderCeoModule() {
    if (state.currentRole !== 'cxo') {
      showToast('Access Denied: CEO Executive Suite is restricted strictly to CEO role.');
      window.location.hash = '#dashboard';
      return;
    }

    breadcrumbCurrentEl.textContent = 'CEO Executive Suite';
    updatePersonaUi();
    updateRoleVisibility();

    mainEl.innerHTML = `
      <div class="page-header">
        <div>
          <h2 class="page-title">CEO Strategic Control Center</h2>
          <p class="page-subtitle">Consolidated enterprise metrics, global operating margins, talent health &amp; executive governance</p>
        </div>
        <div class="page-meta">
          <span>DATA ANCHOR: CONSOLIDATED GLOBAL Q2 2026</span>
          <div style="margin-top:6px;">
            <button class="btn btn-secondary btn-sm" id="ceo-export-brief-btn" style="font-weight:700;">Print / Export Brief</button>
          </div>
        </div>
      </div>

      <div class="dashboard-grid">
        <!-- CEO Strategic Overview KPIs -->
        <div class="kpi-section" id="ceo-kpi-cards-host">
          <div class="kpi-card hero-kpi"><div class="kpi-label">Loading Executive KPIs...</div></div>
        </div>

        <!-- Global Operating Entities Matrix -->
        <div class="card" style="padding: 22px;">
          <div class="section-heading">
            <span>Global Operating Entities Matrix</span>
            <span style="font-weight:700; color:var(--accent);">4 Operating Subsidiaries</span>
          </div>
          <div style="overflow-x:auto;">
            <table class="ceo-matrix-table" id="ceo-entity-table">
              <thead>
                <tr>
                  <th>Operating Subsidiary</th>
                  <th>Headcount (FTE)</th>
                  <th>Annual Payroll Run Rate</th>
                  <th>Avg Cost / FTE</th>
                  <th>TTM Attrition</th>
                  <th>Talent Health</th>
                  <th>CEO Audit Status</th>
                  <th>Executive Action</th>
                </tr>
              </thead>
              <tbody id="ceo-entity-rows">
                <tr><td colspan="8" style="text-align:center; padding:24px; color:var(--ink-secondary);">Computing consolidated entity metrics...</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Strategic Approvals & Decisions Section -->
        <div class="card" style="padding: 22px;">
          <div class="section-heading">
            <span>Strategic Executive Approvals &amp; Sign-offs</span>
            <span style="font-weight:700; color:var(--ink-secondary);">Q2/Q3 Governance Cycle</span>
          </div>
          <div class="ceo-decisions-grid">
            <div class="ceo-decision-card">
              <div>
                <div class="ceo-decision-title">Q3 Global Headcount Requisition</div>
                <div class="ceo-decision-desc">Authorize +12 Senior Engineering &amp; ML FTE expansion across US and Singapore subsidiaries. Budgeted payroll impact: $1.92M/yr.</div>
              </div>
              <button class="ceo-decision-btn" onclick="window.handleCeoDecision('Q3 Global Headcount Requisition')">Authorize Requisition</button>
            </div>

            <div class="ceo-decision-card">
              <div>
                <div class="ceo-decision-title">Merit Compensation Pool Adjustment</div>
                <div class="ceo-decision-desc">Ratify 4.5% annual merit increase pool for India and UK technology hubs aligned with benchmark inflation indexes.</div>
              </div>
              <button class="ceo-decision-btn" onclick="window.handleCeoDecision('Merit Compensation Pool Adjustment')">Ratify Merit Pool</button>
            </div>

            <div class="ceo-decision-card">
              <div>
                <div class="ceo-decision-title">Strategic Key-Personnel Retention Pool</div>
                <div class="ceo-decision-desc">Authorize secondary stock grant retention pool for critical personnel in Sales Architecture and AI Engineering pods.</div>
              </div>
              <button class="ceo-decision-btn" onclick="window.handleCeoDecision('Strategic Key-Personnel Retention Pool')">Sign-Off Retention Grant</button>
            </div>
          </div>
        </div>

        <!-- Executive Audit Log Trail -->
        <div class="card" style="padding: 22px;">
          <div class="section-heading">
            <span>CEO Governance Audit Trail</span>
            <span style="font-weight:700; color:var(--ink-tertiary);">Immutable SOX/SOC2 Verified</span>
          </div>
          <div style="overflow-x:auto;">
            <table class="report-table" style="font-family:var(--font-sans); font-size:12px;">
              <thead>
                <tr>
                  <th>Audit Ref</th>
                  <th>Timestamp</th>
                  <th>Principal Identity</th>
                  <th>Executive Action</th>
                  <th>Verification Status</th>
                </tr>
              </thead>
              <tbody id="ceo-audit-rows">
                <tr><td colspan="5" style="text-align:center; padding:18px;">Loading governance log...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    // Hook up export brief button
    const exportBriefBtn = document.getElementById('ceo-export-brief-btn');
    if (exportBriefBtn) {
      exportBriefBtn.addEventListener('click', () => {
        window.print();
      });
    }

    // Fetch and render CEO metrics from backend API
    try {
      const data = await fetchJson(`/api/ceo-metrics?role=cxo&entity=${state.currentEntity}`);
      
      // Render Strategic KPIs
      const kpiHost = document.getElementById('ceo-kpi-cards-host');
      if (kpiHost && data.overview) {
        const o = data.overview;
        const kpis = [
          { label: 'Enterprise Headcount', value: `${o.totalActive} FTE`, delta: '+8.2% YTD Expansion', subtext: 'Consolidated 4 Operating Entities' },
          { label: 'Consolidated Annual Payroll', value: `$${o.totalPayrollM}M`, delta: `Monthly Burn: $${o.monthlyBurnM}M`, subtext: 'Budget Variance: -2.1% (Favorable)' },
          { label: 'High-Performer Retention', value: o.retentionTopTier, delta: '+1.8% vs FY25 Target', subtext: 'Top Tier 95th Percentile' },
          { label: 'Average Revenue / FTE', value: o.revenuePerHead, delta: '+14.2% YoY Efficiency', subtext: 'Consolidated EBITDA Factor' },
          { label: 'Org Leverage Ratio', value: o.orgLeverageRatio, delta: 'Healthy Tier-1 Scale', subtext: 'Executive span of control' },
          { label: 'Global Compliance Index', value: '100.0%', delta: 'Zero Exceptions (SOC2/SOX)', subtext: 'Statutory Audits Cleared' }
        ];

        let kpiHtml = '';
        kpis.forEach((kpi, idx) => {
          const isHero = idx === 0;
          kpiHtml += `
            <div class="kpi-card ${isHero ? 'hero-kpi' : ''}">
              <div>
                <div class="kpi-label">${kpi.label}</div>
                <div class="kpi-value">${kpi.value}</div>
              </div>
              <div class="kpi-footer">
                <span class="kpi-delta positive">${kpi.delta}</span>
                <span class="kpi-subtext">${kpi.subtext}</span>
              </div>
            </div>
          `;
        });
        kpiHost.innerHTML = kpiHtml;
      }

      // Render Entity Matrix
      const tbody = document.getElementById('ceo-entity-rows');
      if (tbody && data.entities) {
        let rowsHtml = '';
        data.entities.forEach(item => {
          const isHealthy = parseFloat(item.attritionPct) <= 12;
          rowsHtml += `
            <tr>
              <td><strong style="color:var(--ink); font-weight:750;">${item.entity}</strong></td>
              <td class="ceo-num">${item.headcount.toLocaleString()} FTE <span style="font-size:10px; color:var(--ink-secondary);">(of ${item.totalCount})</span></td>
              <td class="ceo-num">$${item.annualPayroll}M</td>
              <td class="ceo-num">${item.avgSalaryFormatted}</td>
              <td class="ceo-num" style="color:${parseFloat(item.attritionPct) > 12 ? 'var(--negative)' : 'var(--accent)'}; font-weight:800;">${item.attritionPct}%</td>
              <td><span class="ceo-health-pill ${isHealthy ? 'healthy' : 'warning'}">${item.marginContribution} Margin</span></td>
              <td><span class="badge-wired">${item.runwayMonths} Runway</span></td>
              <td>
                <button class="btn btn-secondary btn-sm" style="font-weight:750;" onclick="window.handleEntityDrilldown('${item.entity}')">Deep Dive</button>
              </td>
            </tr>
          `;
        });
        tbody.innerHTML = rowsHtml;
      }

      // Fetch audit events for CEO table
      const auditData = await fetchJson('/api/audit-log');
      const auditTbody = document.getElementById('ceo-audit-rows');
      if (auditTbody && Array.isArray(auditData)) {
        let aHtml = '';
        auditData.slice(0, 5).forEach(evt => {
          aHtml += `
            <tr>
              <td style="font-family:var(--font-sans); font-variant-numeric:tabular-nums; font-weight:700; color:var(--ink-secondary);">${evt.id}</td>
              <td style="font-family:var(--font-sans); font-variant-numeric:tabular-nums; color:var(--ink-secondary);">${new Date(evt.timestamp).toLocaleDateString()} ${new Date(evt.timestamp).toLocaleTimeString()}</td>
              <td><strong style="color:var(--ink); font-weight:700;">${evt.role.toUpperCase()}</strong></td>
              <td><span style="font-weight:700; color:var(--accent);">${evt.action}</span></td>
              <td><span class="badge-wired">PASSED (P-256)</span></td>
            </tr>
          `;
        });
        auditTbody.innerHTML = aHtml;
      }
    } catch (err) {
      console.error('Error fetching CEO metrics:', err);
      showToast('Error loading CEO metrics: ' + (err.error || err.message));
    }
  }

  window.handleCeoDecision = function(title) {
    showToast(`Decision Authorized & Signed: "${title}". Executive audit logged.`);
  };

  window.handleEntityDrilldown = function(entityName) {
    state.currentEntity = entityName;
    if (entitySelectEl) entitySelectEl.value = entityName;
    showToast(`Scoping enterprise view to ${entityName}`);
    window.location.hash = '#library';
  };

  // --------------------------------------------------------------------------
  // Authentication Gateway (Simple, Clean, Modern Login Card)
  // --------------------------------------------------------------------------
  const authOverlayEl = document.getElementById('auth-overlay');
  const appLayoutEl = document.getElementById('app-layout');
  const loginForm = document.getElementById('login-form');
  const loginEmailInput = document.getElementById('login-email');
  const loginPasswordInput = document.getElementById('login-password');
  const rolePillsContainer = document.getElementById('role-pills-container');
  const logoutBtn = document.getElementById('logout-btn');

  function initAuthUi() {
    // Check existing session
    const savedSession = sessionStorage.getItem('reportos_auth');
    if (savedSession) {
      try {
        const session = JSON.parse(savedSession);
        state.currentUser = session.user;
        state.token = session.token;
        state.currentRole = session.user.role;
        if (roleSelectEl) roleSelectEl.value = state.currentRole;
        hideAuthOverlay();
        return true;
      } catch (e) {
        sessionStorage.removeItem('reportos_auth');
      }
    }
    showAuthOverlay();
    return false;
  }

  function showAuthOverlay() {
    if (authOverlayEl) authOverlayEl.classList.remove('hidden');
    if (appLayoutEl) appLayoutEl.style.display = 'none';
  }

  function hideAuthOverlay() {
    if (authOverlayEl) authOverlayEl.classList.add('hidden');
    if (appLayoutEl) appLayoutEl.style.display = 'flex';
  }

  window.quickFill = function(email, password, role) {
    if (loginEmailInput) loginEmailInput.value = email;
    if (loginPasswordInput) loginPasswordInput.value = password;
    
    const previewEl = document.getElementById('preview-cred-code');
    if (previewEl) previewEl.textContent = `${email} / ${password}`;

    const destEl = document.getElementById('auth-role-dest');

    if (rolePillsContainer) {
      rolePillsContainer.querySelectorAll('.role-pill').forEach(pill => {
        if (pill.getAttribute('data-role') === role) {
          pill.classList.add('active');
          const dest = pill.getAttribute('data-dest');
          if (destEl && dest) destEl.textContent = dest;
        } else {
          pill.classList.remove('active');
        }
      });
    }
  };

  async function performLogin(email, password) {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      state.currentUser = data.user;
      state.token = data.token;
      state.currentRole = data.user.role;
      sessionStorage.setItem('reportos_auth', JSON.stringify(data));

      if (roleSelectEl) roleSelectEl.value = state.currentRole;
      hideAuthOverlay();

      showToast(`Authenticated: ${data.user.name} (${data.user.title})`);
      updatePersonaUi();
      updateRoleVisibility();

      // Routing logic:
      // CEO -> Lands directly on CEO Strategic Control Center (#ceo)
      // Others -> Lands on Dashboard (#dashboard)
      if (data.user.role === 'cxo') {
        window.location.hash = '#ceo';
      } else {
        window.location.hash = '#dashboard';
      }
      handleHashChange();
    } catch (err) {
      showToast('Login Failed: ' + err.message);
    }
  }

  function handleLogout() {
    sessionStorage.removeItem('reportos_auth');
    state.currentUser = null;
    state.token = null;
    showToast('Signed out successfully. Returning to Identity Gateway.');
    showAuthOverlay();
  }

  // --------------------------------------------------------------------------
  // Router & Navigation
  // --------------------------------------------------------------------------
  function navigate(viewName) {
    // If not authenticated, ensure login overlay is visible
    if (!state.currentUser && !sessionStorage.getItem('reportos_auth')) {
      showAuthOverlay();
      return;
    }

    const validViews = ['dashboard', 'ceo', 'library', 'builder', 'copilot', 'schedules', 'audit'];
    
    // Strict RBAC: CEO Module is strictly restricted to CEO identity
    if (viewName === 'ceo' && state.currentRole !== 'cxo') {
      showToast('Access Denied: CEO Executive Suite is strictly restricted to the CEO role.');
      window.location.hash = '#dashboard';
      return;
    }

    state.currentView = validViews.includes(viewName) ? viewName : (state.currentRole === 'cxo' ? 'ceo' : 'dashboard');

    document.querySelectorAll('.nav-item').forEach(el => {
      if (el.getAttribute('data-view') === state.currentView) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    });

    if (state.currentView === 'dashboard') renderDashboard();
    else if (state.currentView === 'ceo') renderCeoModule();
    else if (state.currentView === 'library') renderReportLibrary();
    else if (state.currentView === 'builder') renderCustomBuilder();
    else if (state.currentView === 'copilot') renderCopilot();
    else if (state.currentView === 'schedules') renderSchedules();
    else if (state.currentView === 'audit') renderAudit();
  }

  function handleHashChange() {
    const hash = window.location.hash.replace(/^#/, '');
    const defaultView = state.currentRole === 'cxo' ? 'ceo' : 'dashboard';
    navigate(hash || defaultView);
  }

  window.addEventListener('hashchange', handleHashChange);

  // --------------------------------------------------------------------------
  // Initialization
  // --------------------------------------------------------------------------
  async function initApp() {
    // Role pills selection
    if (rolePillsContainer) {
      rolePillsContainer.querySelectorAll('.role-pill').forEach(pill => {
        pill.addEventListener('click', () => {
          const email = pill.getAttribute('data-email');
          const pass = pill.getAttribute('data-pass');
          const role = pill.getAttribute('data-role');
          window.quickFill(email, pass, role);
        });
      });
    }

    if (loginForm) {
      loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = loginEmailInput.value.trim();
        const password = loginPasswordInput.value.trim();
        performLogin(email, password);
      });
    }

    if (logoutBtn) {
      logoutBtn.addEventListener('click', handleLogout);
    }

    // Check auth session
    initAuthUi();

    try {
      state.meta = await fetchJson(`/api/meta?role=${state.currentRole}`);
      if (entitySelectEl && state.meta.entities) {
        entitySelectEl.innerHTML = '<option value="All">All Operating Entities</option>';
        state.meta.entities.forEach(ent => {
          const opt = document.createElement('option');
          opt.value = ent;
          opt.textContent = ent;
          entitySelectEl.appendChild(opt);
        });
      }
    } catch (err) {
      console.warn('Metadata initialization failed:', err);
    }

    if (roleSelectEl) {
      roleSelectEl.addEventListener('change', () => {
        state.currentRole = roleSelectEl.value;
        showToast(`Switched active perspective to ${state.currentRole.toUpperCase()}`);
        updatePersonaUi();
        updateRoleVisibility();

        // If currently in CEO view and user changes away from CEO, redirect to dashboard
        if (state.currentView === 'ceo' && state.currentRole !== 'cxo') {
          window.location.hash = '#dashboard';
        } else {
          handleHashChange();
        }
      });
    }

    if (entitySelectEl) {
      entitySelectEl.addEventListener('change', () => {
        state.currentEntity = entitySelectEl.value;
        showToast(`Filtered perspective to ${state.currentEntity}`);
        if (state.currentView === 'dashboard') renderDashboard();
        else if (state.currentView === 'ceo') renderCeoModule();
      });
    }

    if (quickExportBtn) {
      quickExportBtn.addEventListener('click', () => {
        showToast('Exporting current view roster CSV...');
        window.location.href = `/api/reports/1/csv?role=${state.currentRole}`;
      });
    }

    updatePersonaUi();
    updateRoleVisibility();
    handleHashChange();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
})();
