/**
 * ReportOS — Universal HR Reporting Engine Frontend Application
 * Pure Vanilla JavaScript — Zero Frameworks / Zero External Dependencies
 */

(function () {
  'use strict';

  // --------------------------------------------------------------------------
  // Application State
  // --------------------------------------------------------------------------
  const state = {
    currentView: 'dashboard',
    currentRole: 'cxo',
    currentEntity: 'All',
    meta: { entities: [], departments: [], locations: [], employmentTypes: [] },
    fieldCatalog: null,
    builderSelectedFields: ['id', 'name', 'dept', 'entity', 'employmentType', 'ctc'],
    builderFilters: { entity: 'All', dept: 'All', employmentType: 'All', status: 'All' },
    builderPreviewData: null,
    copilotMessages: [
      {
        sender: 'assistant',
        text: 'Welcome to ReportOS Intelligence. I compute verified metrics directly from your HRMS dataset with grounded inline visualizations. Select a suggestion or type a question regarding attrition, leave liability, payroll budgets, or headcount.',
        chart: null
      }
    ]
  };

  // --------------------------------------------------------------------------
  // DOM Elements
  // --------------------------------------------------------------------------
  const mainEl = document.getElementById('main');
  const roleSelectEl = document.getElementById('role-select');
  const entitySelectEl = document.getElementById('global-entity-select');
  const breadcrumbCurrentEl = document.getElementById('breadcrumb-current');
  const quickExportBtn = document.getElementById('quick-export-btn');
  const toastContainer = document.getElementById('toast-container');
  const modalBackdrop = document.getElementById('modal-backdrop');
  const modalTitle = document.getElementById('modal-title');
  const modalBody = document.getElementById('modal-body');
  const modalCloseBtn = document.getElementById('modal-close-btn');
  const modalOkBtn = document.getElementById('modal-ok-btn');

  // --------------------------------------------------------------------------
  // API Fetch Utilities
  // --------------------------------------------------------------------------
  async function fetchJson(url, options = {}) {
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
  // Hand-Rolled Inline SVG Chart Helpers (Strict Palette: Ink, Terracotta, Slate)
  // --------------------------------------------------------------------------

  /**
   * Renders a clean horizontal bar chart SVG
   */
  function createHorizontalBarChartSvg(data, { width = 450, height = 200, unit = '' } = {}) {
    if (!data || data.length === 0) return '<div class="chart-empty">No data</div>';

    const maxVal = Math.max(...data.map(d => d.v), 1);
    const labelWidth = 110;
    const chartWidth = width - labelWidth - 60;
    const rowHeight = Math.max(28, Math.floor((height - 30) / data.length));
    const actualHeight = data.length * rowHeight + 20;

    let svg = `<svg viewBox="0 0 ${width} ${actualHeight}" class="chart-svg" xmlns="http://www.w3.org/2000/svg">`;

    data.forEach((item, idx) => {
      const y = idx * rowHeight + 10;
      const barWidth = Math.max(4, (item.v / maxVal) * chartWidth);
      const isMax = item.v === maxVal;
      const barColor = isMax ? '#c1521f' : '#1a1714';

      // Label
      svg += `<text x="${labelWidth - 10}" y="${y + 14}" text-anchor="end" class="chart-tick-label" fill="#1a1714">${item.k}</text>`;

      // Background track
      svg += `<rect x="${labelWidth}" y="${y + 2}" width="${chartWidth}" height="${rowHeight - 10}" fill="#e8e2d6" />`;

      // Active bar
      svg += `<rect x="${labelWidth}" y="${y + 2}" width="${barWidth}" height="${rowHeight - 10}" fill="${barColor}">
        <title>${item.k}: ${item.v}${unit ? ' ' + unit : ''}</title>
      </rect>`;

      // Value text
      svg += `<text x="${labelWidth + barWidth + 8}" y="${y + 14}" font-family="IBM Plex Mono" font-size="11" font-weight="600" fill="#1a1714">${item.v}${unit ? unit : ''}</text>`;
    });

    svg += `</svg>`;
    return svg;
  }

  /**
   * Renders a line/area chart SVG
   */
  function createLineChartSvg(data, { width = 500, height = 220, unit = '' } = {}) {
    if (!data || data.length === 0) return '<div class="chart-empty">No data</div>';

    const padding = { top: 20, right: 30, bottom: 35, left: 45 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    const values = data.map(d => d.v);
    const minVal = Math.min(...values) * 0.96;
    const maxVal = Math.max(...values) * 1.02;
    const range = maxVal - minVal || 1;

    const points = data.map((d, i) => {
      const x = padding.left + (i / (data.length - 1)) * chartW;
      const y = padding.top + chartH - ((d.v - minVal) / range) * chartH;
      return { x, y, k: d.k, v: d.v };
    });

    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${(padding.top + chartH).toFixed(1)} L ${points[0].x.toFixed(1)} ${(padding.top + chartH).toFixed(1)} Z`;

    let svg = `<svg viewBox="0 0 ${width} ${height}" class="chart-svg" xmlns="http://www.w3.org/2000/svg">`;

    // Horizontal grid lines (3 steps)
    for (let s = 0; s <= 3; s++) {
      const stepVal = minVal + (range / 3) * s;
      const y = padding.top + chartH - (s / 3) * chartH;
      svg += `<line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" class="chart-grid-line" />`;
      svg += `<text x="${padding.left - 8}" y="${y + 3}" text-anchor="end" class="chart-tick-label">${Math.round(stepVal)}</text>`;
    }

    // Shaded area
    svg += `<path d="${areaPath}" fill="#faece6" opacity="0.7" />`;

    // Main line
    svg += `<path d="${linePath}" class="chart-line-path" />`;

    // Points and labels
    points.forEach(p => {
      svg += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4" class="chart-point">
        <title>${p.k}: ${p.v} ${unit}</title>
      </circle>`;
      svg += `<text x="${p.x.toFixed(1)}" y="${height - 12}" text-anchor="middle" class="chart-tick-label">${p.k}</text>`;
    });

    svg += `</svg>`;
    return svg;
  }

  /**
   * Renders a donut chart SVG with legend
   */
  function createDonutChartSvg(data, { size = 180 } = {}) {
    if (!data || data.length === 0) return '<div class="chart-empty">No data</div>';

    const cx = size / 2;
    const cy = size / 2;
    const radius = size * 0.40;
    const innerRadius = size * 0.24;
    const strokeWidth = radius - innerRadius;

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

    // Center text
    svg += `<text x="${cx}" y="${cy + 4}" text-anchor="middle" font-family="Playfair Display" font-size="14" font-weight="700" fill="#1a1714">Mix</text>`;
    svg += `</svg>`;

    // Legend
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
  // VIEW: Dashboard
  // --------------------------------------------------------------------------
  async function renderDashboard() {
    breadcrumbCurrentEl.textContent = 'Dashboard';

    mainEl.innerHTML = `
      <div class="page-header">
        <div>
          <h2 class="page-title">Executive Dashboard</h2>
          <p class="page-subtitle">Perspective: <strong style="color:var(--ink);">${state.currentRole.toUpperCase()}</strong> • Real-time aggregates computed across active rosters</p>
        </div>
        <div class="page-meta">
          <span>DATA ANCHOR: JUNE 2026</span>
        </div>
      </div>

      <div class="dashboard-grid">
        <!-- KPI Row with Asymmetric Hero -->
        <div class="kpi-section" id="kpi-cards-host">
          <div class="kpi-card hero-kpi"><div class="kpi-label">Loading KPIs...</div></div>
        </div>

        <!-- Charts Grid -->
        <div class="charts-grid">
          <!-- Headcount Trend -->
          <div class="chart-card">
            <div class="chart-header">
              <h3 class="chart-title">Headcount Trajectory (Trailing 6 Months)</h3>
              <span class="chart-meta">Dynamic Date Alignment</span>
            </div>
            <div class="chart-container" id="chart-headcount-trend">Loading trend chart...</div>
          </div>

          <!-- Gender Composition -->
          <div class="chart-card">
            <div class="chart-header">
              <h3 class="chart-title">Workforce Gender Mix</h3>
              <span class="chart-meta">Active Personnel</span>
            </div>
            <div class="chart-container" id="chart-gender-mix">Loading composition...</div>
          </div>

          <!-- Attrition by Department (Full-bleed) -->
          <div class="chart-card full-bleed">
            <div class="chart-header">
              <h3 class="chart-title">TTM Attrition Rate by Operating Department</h3>
              <span class="chart-meta">Separations / Average Headcount</span>
            </div>
            <div class="chart-container" id="chart-attrition-dept">Loading department attrition...</div>
          </div>
        </div>
      </div>
    `;

    // Fetch and render KPIs
    try {
      const kpis = await fetchJson(`/api/kpis?role=${state.currentRole}`);
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

    // Fetch and render Headcount Trend Chart
    try {
      const trendData = await fetchJson('/api/charts/headcount-trend');
      const container = document.getElementById('chart-headcount-trend');
      if (container) {
        container.innerHTML = createLineChartSvg(trendData, { width: 520, height: 210, unit: 'employees' });
      }
    } catch (err) {
      console.error('Failed to load headcount trend:', err);
    }

    // Fetch and render Gender Mix Donut
    try {
      const mixData = await fetchJson('/api/charts/gender-mix');
      const container = document.getElementById('chart-gender-mix');
      if (container) {
        container.innerHTML = createDonutChartSvg(mixData, { size: 170 });
      }
    } catch (err) {
      console.error('Failed to load gender mix:', err);
    }

    // Fetch and render Attrition by Dept Bar Chart
    try {
      const attritionData = await fetchJson('/api/charts/attrition-by-dept');
      const container = document.getElementById('chart-attrition-dept');
      if (container) {
        container.innerHTML = createHorizontalBarChartSvg(attritionData, { width: 900, height: 180, unit: '%' });
      }
    } catch (err) {
      console.error('Failed to load attrition by dept:', err);
    }
  }

  // --------------------------------------------------------------------------
  // VIEW: Report Library
  // --------------------------------------------------------------------------
  let activeLibraryCategory = 'All';

  async function renderReportLibrary() {
    breadcrumbCurrentEl.textContent = 'Report Library';

    mainEl.innerHTML = `
      <div class="page-header">
        <div>
          <h2 class="page-title">Standard Report Catalog</h2>
          <p class="page-subtitle">21 categorized analytical rosters • 10 executable CSV generators &amp; 11 architectural catalog entries</p>
        </div>
        <div class="page-meta">
          <span>SPEC COMPLIANT v1.0</span>
        </div>
      </div>

      <div class="library-layout">
        <!-- Category Filter Tabs -->
        <div class="category-tabs" id="library-category-tabs">
          <button class="category-tab ${activeLibraryCategory === 'All' ? 'active' : ''}" data-cat="All">All Categories (21)</button>
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

    // Category tab listeners
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
      const reports = await fetchJson(`/api/reports?category=${encodeURIComponent(category)}`);
      
      // Group reports by category
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
                  <th style="width: 14%;">Status</th>
                  <th style="width: 14%; text-align:right;">Action</th>
                </tr>
              </thead>
              <tbody>
        `;

        catReports.forEach(r => {
          html += `
            <tr>
              <td class="report-name-cell">${r.name}</td>
              <td class="report-desc-cell">${r.desc}</td>
              <td>
                ${r.wired 
                  ? '<span class="badge-wired">Executable CSV</span>' 
                  : '<span class="badge-catalog">Catalog Only</span>'}
              </td>
              <td style="text-align:right;">
                <button class="btn ${r.wired ? 'btn-primary' : 'btn-secondary'} btn-sm run-report-btn" data-id="${r.id}" data-wired="${r.wired}" data-name="${r.name}">
                  ${r.wired ? 'Download CSV' : 'View Spec'}
                </button>
              </td>
            </tr>
          `;
        });

        html += `</tbody></table></div>`;
      });

      listHost.innerHTML = html;

      // Attach download/modal handlers
      listHost.querySelectorAll('.run-report-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const reportId = btn.getAttribute('data-id');
          const isWired = btn.getAttribute('data-wired') === 'true';
          const reportName = btn.getAttribute('data-name');

          if (isWired) {
            showToast(`Generating ${reportName}...`);
            window.location.href = `/api/reports/${reportId}/csv`;
          } else {
            showModal(
              'Catalog-Only Report Notice (HTTP 501)',
              `<p><strong>${reportName}</strong> is registered in the v1 HR reporting catalog as a specification blueprint.</p>
               <p style="margin-top:10px; color:var(--ink-secondary);">To execute this report with live data, connect a generator function in <code>lib/reportDefs.js</code> returning <code>{ columns, rows }</code>. The UI router and CSV stream handlers are already fully configured.</p>`
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

    if (!state.fieldCatalog) {
      try {
        state.fieldCatalog = await fetchJson('/api/builder/fields');
      } catch (err) {
        console.error('Failed to load fields:', err);
      }
    }

    mainEl.innerHTML = `
      <div class="page-header">
        <div>
          <h2 class="page-title">Custom Report Builder</h2>
          <p class="page-subtitle">No-code schema projection • Live synchronized preview table &amp; CSV serializer</p>
        </div>
        <div class="page-meta">
          <span>SCHEMA BUILDER ENGINE</span>
        </div>
      </div>

      <div class="builder-layout">
        <!-- Controls Grid: Field Selector + Filters -->
        <div class="builder-controls-grid">
          <!-- Field Selector Card -->
          <div class="field-selector-card">
            <div class="section-heading">
              <span>Select Attributes to Include</span>
              <button id="builder-select-all-btn" class="btn btn-secondary btn-sm">Select All</button>
            </div>
            <div class="field-categories" id="field-categories-host">
              <!-- Field Checkboxes -->
            </div>
          </div>

          <!-- Filters Card -->
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

        <!-- Live Preview Section -->
        <div class="preview-section">
          <div class="preview-header">
            <div>
              <h3 style="font-family:var(--font-serif); font-size:18px; font-weight:600;">Live Query Preview</h3>
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

        <!-- Saved Reports Registry -->
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

    // Render Field Categories
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

      // Checkbox event listeners
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

    // Filter change listeners
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

    // Select all button
    document.getElementById('builder-select-all-btn').addEventListener('click', () => {
      const allKeys = [];
      Object.values(state.fieldCatalog).forEach(list => list.forEach(f => allKeys.push(f.key)));
      state.builderSelectedFields = allKeys;
      categoriesHost.querySelectorAll('.field-checkbox').forEach(cb => cb.checked = true);
      refreshBuilderPreview();
    });

    // Download CSV
    document.getElementById('builder-download-btn').addEventListener('click', async () => {
      try {
        showToast('Serializing full query dataset to CSV...');
        const res = await fetch('/api/builder/csv', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fields: state.builderSelectedFields,
            filters: state.builderFilters,
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

    // Save definition
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
          filters: state.builderFilters
        })
      });

      if (countMeta) {
        countMeta.textContent = `Showing ${preview.rows.length} of ${preview.total} matching records`;
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
          filters: state.builderFilters
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
                ${item.fields.length} attributes selected • Saved on ${new Date(item.createdAt).toLocaleDateString()}
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

    mainEl.innerHTML = `
      <div class="page-header">
        <div>
          <h2 class="page-title">Grounded Intelligence Copilot</h2>
          <p class="page-subtitle">Natural language analytics • Factual computations and inline SVG charting</p>
        </div>
        <div class="page-meta">
          <span>GROUNDED NLU ENGINE</span>
        </div>
      </div>

      <div class="copilot-layout">
        <!-- Main Chat Stream -->
        <div class="chat-panel">
          <div class="chat-messages" id="chat-messages-host">
            <!-- Messages rendered here -->
          </div>
          <form class="chat-input-wrapper" id="chat-form">
            <input type="text" id="chat-input" class="chat-input" placeholder="Ask a question (e.g., 'What is our attrition rate?' or 'Show leave liability')..." autocomplete="off">
            <button type="submit" class="btn btn-primary">Query Engine</button>
          </form>
        </div>

        <!-- Sidebar / Suggestion Chips -->
        <div class="copilot-sidebar">
          <div class="card">
            <div class="section-heading">
              <span>Verified Data Prompts</span>
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
              <span>Architecture Seam</span>
            </div>
            <p style="font-size:11.5px; color:var(--ink-secondary); line-height:1.5;">
              In v1, queries are routed through a factual keyword analyzer backed by verified aggregate routines. In future releases, this binds seamlessly to Claude tool-use functions without data invention risk.
            </p>
          </div>
        </div>
      </div>
    `;

    renderChatMessages();

    // Form submit
    const form = document.getElementById('chat-form');
    const input = document.getElementById('chat-input');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;

      input.value = '';
      await handleUserCopilotQuery(text);
    });

    // Suggestion chips
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
      // Format markdown **bold**
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
          <span class="bubble-sender">${isUser ? 'Perspective Query' : 'ReportOS Intelligence'}</span>
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
        body: JSON.stringify({ question })
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
  // Router & Navigation
  // --------------------------------------------------------------------------
  function navigate(viewName) {
    const validViews = ['dashboard', 'library', 'builder', 'copilot'];
    state.currentView = validViews.includes(viewName) ? viewName : 'dashboard';

    // Update nav links
    document.querySelectorAll('.nav-item').forEach(el => {
      if (el.getAttribute('data-view') === state.currentView) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    });

    if (state.currentView === 'dashboard') {
      renderDashboard();
    } else if (state.currentView === 'library') {
      renderReportLibrary();
    } else if (state.currentView === 'builder') {
      renderCustomBuilder();
    } else if (state.currentView === 'copilot') {
      renderCopilot();
    }
  }

  function handleHashChange() {
    const hash = window.location.hash.replace(/^#/, '');
    navigate(hash || 'dashboard');
  }

  window.addEventListener('hashchange', handleHashChange);

  // --------------------------------------------------------------------------
  // Initialization
  // --------------------------------------------------------------------------
  async function initApp() {
    try {
      // 1. Fetch metadata
      state.meta = await fetchJson('/api/meta');

      // Populate entity dropdown
      if (entitySelectEl && state.meta.entities) {
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

    // Role selector listener
    if (roleSelectEl) {
      roleSelectEl.addEventListener('change', () => {
        state.currentRole = roleSelectEl.value;
        showToast(`Switched perspective to ${state.currentRole.toUpperCase()}`);
        if (state.currentView === 'dashboard') {
          renderDashboard();
        }
      });
    }

    // Entity selector listener
    if (entitySelectEl) {
      entitySelectEl.addEventListener('change', () => {
        state.currentEntity = entitySelectEl.value;
        showToast(`Filtered perspective to ${state.currentEntity}`);
      });
    }

    // Quick export listener
    if (quickExportBtn) {
      quickExportBtn.addEventListener('click', () => {
        showToast('Exporting current view metrics...');
        window.location.href = '/api/reports/1/csv';
      });
    }

    // Launch initial view
    handleHashChange();
  }

  // Boot on DOM Ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
})();
