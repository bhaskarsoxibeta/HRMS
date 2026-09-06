# ReportOS — Universal HR Reporting Engine

**ReportOS** is a zero-dependency, editorial-grade HR reporting and workforce intelligence platform built on Node.js and vanilla web standards. It features role-based executive dashboards, an enterprise standard report library, a live schema-projecting custom report builder, and a grounded AI copilot.

---

## 1. Quick Start

ReportOS requires **no build tools**, **no bundlers**, and **zero `npm install` steps**. It runs directly on any Node.js environment (v14+).

```bash
# 1. Start the server
node server.js

# 2. Open in your browser
http://localhost:3000
```

On first execution, ReportOS automatically seeds a deterministic synthetic dataset containing ~600 employee records, ~90 recruitment requisitions, and departmental compensation budgets in `data/*.json`.

---

## 2. Core Screens & Capabilities

### 1. Executive Dashboard (`#dashboard`)
- **Role Perspectives:** Switches live aggregations across **5 distinct roles**:
  - **CXO:** Enterprise active headcount, TTM attrition rate, annualized payroll volume, non-male gender diversity.
  - **CHRO:** Open requisitions, average time-to-hire (days), regretted attrition (>12m tenure departures), goal completion engagement index proxy.
  - **HRBP:** Sales-scoped headcount, aging talent pipeline (>45d), accrued leave liability (\$), and appraisal review rate.
  - **Line Manager:** Direct report pod size, cycle attendance %, pending leave rush proxy, and review completion.
  - **Employee (ESS):** Available leave balance, monthly net take-home pay, performance rating, and cycle days present.
- **Hand-Rolled SVG Visualizations:**
  - Trailing 6-Month Headcount Trajectory (Line & Area chart)
  - Departmental TTM Attrition Comparison (Horizontal Bar chart)
  - Active Workforce Gender Mix (Segmented Donut chart)

### 2. Standard Report Catalog (`#library`)
- **21 Enterprise Reports** categorized across 8 domains: Workforce & Headcount, Recruitment, Payroll & Compensation, Attendance & Leave, Performance, Compliance & Statutory, Learning & Development, and Employee Experience.
- **10 Fully Executable CSV Generators:** Produces validated CSV exports directly computed from the data layer.
- **11 Catalog-Only Specifications:** Explicitly badged blueprints that return friendly HTTP 501 guidance for developer extensibility.

### 3. Custom Report Builder (`#builder`)
- **Categorized Field Catalog:** Select attributes from Employee, Payroll, Attendance, and Performance groups.
- **Dynamic Roster Filters:** Filter by Operating Entity, Department, Employment Type, and Status.
- **Live Preview Table:** Instant projection showing the first 8 matching rows and total matched record count.
- **Guaranteed Consistency:** Preview engine and CSV export engine execute the identical `runQuery` pipeline.
- **Saved Definitions:** Persist custom report schemas to `data/customReports.json` across server restarts.

### 4. Grounded AI Copilot (`#copilot`)
- **Natural Language Analytics:** Computes real factual numbers over the dataset with inline SVG visual cards:
  - *Attrition queries:* Computes TTM rate + tenure band breakdown chart.
  - *Leave liability queries:* Computes total encashment cost + legal entity distribution.
  - *Payroll queries:* Computes budget variance and flags over-budget departments.
  - *Headcount queries:* Computes active workforce and 6-month growth.
- **Factual Grounding:** Zero data fabrication; provides structured fallback for unsupported queries.

---

## 3. Visual & Typographic Discipline

ReportOS adheres to a strict **Editorial/Paper design system**:
- **Palette:** Warm off-white (`#f2ede4`), near-black deep ink (`#1a1714`), burnt terracotta accent (`#c1521f`), warm slate gray (`#8f887f`), and desaturated red (`#8b3a2a`).
- **Strict Constraints:** Zero blue, zero violet, zero neon/glow rings, zero drop-shadow depth simulation, zero glassmorphism.
- **Typography:** *Playfair Display* (confident editorial headlines and large KPI numerals), *DM Sans* (workhorse UI body), and *IBM Plex Mono* (tabular/numeric values).
- **Composition:** Asymmetric hero KPI hierarchy with fine 1px paper borders and printed-page aesthetics.

---

## 4. API Reference

All routes return JSON, except CSV endpoints which stream `text/csv`:

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/meta` | Unique entities, departments, locations, employment types |
| `GET` | `/api/kpis?role=<role>` | 4 role-specific KPI cards `{ label, value, delta, subtext, cls }` |
| `GET` | `/api/charts/headcount-trend` | 6 monthly `{ k, v }` active headcount points |
| `GET` | `/api/charts/attrition-by-dept` | Trailing 12-month attrition % per department |
| `GET` | `/api/charts/gender-mix` | Gender composition % and counts for active personnel |
| `GET` | `/api/reports?category=<cat>` | Catalog listing `{ id, cat, name, desc, fmt, wired }` |
| `GET` | `/api/reports/:id/csv` | Streams generated CSV (404 if missing, 501 if catalog-only) |
| `GET` | `/api/builder/fields` | Available schema attributes grouped by category |
| `POST` | `/api/builder/preview` | Returns `{ columns, rows (first 8), total }` |
| `POST` | `/api/builder/csv` | Streams full CSV of filtered custom report query |
| `POST` | `/api/builder/save` | Persists custom report definition to `data/customReports.json` |
| `GET` | `/api/builder/saved` | Retrieves all saved custom report definitions |
| `POST` | `/api/copilot` | Natural language query resolver `{ text, chart }` |

---

## 5. Architectural Seams & Extension Roadmap

### Data Access Seam (`lib/dataStore.js`)
All reads route through a single data-access layer. To migrate from JSON files to PostgreSQL, MySQL, or an HRIS API (e.g., Workday, BambooHR), replace the data loader functions in `lib/dataStore.js` without touching server routes or frontend logic.

### Future Claude API Copilot Integration (`lib/copilot.js`)
In v1, keyword-intent routing evaluates actual aggregate functions. To upgrade to Claude:
1. Expose dataStore routines as callable tool definitions:
   - `getAttritionRate({ dept?: string })`
   - `getLeaveLiability({ entity?: string })`
   - `getPayrollVariance()`
   - `getHeadcountTrend()`
2. Pass tools to the Anthropic Messages API with `tool_choice: "auto"`.
3. Execute tool calls against `lib/dataStore.js` and return `tool_result` blocks. This ensures the model only articulates retrieved numbers.

### Document Export Expansion
- **PDF Export:** Connect `pdfkit` to serialize report data into formatted executive summary briefs.
- **Excel / PPTX:** Integrate `exceljs` for multi-tab workbooks and `pptxgenjs` for board deck slide generation.

---

## 6. Project Structure

```
soxibeta hrms/
  server.js                 # Pure Node.js HTTP server and router (zero dependencies)
  package.json              # Zero-dependency manifest
  lib/
    rng.js                  # Mulberry32 seeded PRNG for reproducible data
    generateData.js         # Synthetic dataset generator (~600 emps, ~90 reqs, budgets)
    dataStore.js            # Single data-access seam + role KPI engines + aggregate analytics
    reportDefs.js           # 21-report catalog metadata + 10 executable CSV generators
    builder.js              # Custom schema projection engine + saved reports
    copilot.js              # Grounded Q&A intent analyzer + inline chart data
    csv.js                  # Dependency-free CSV serializer
  data/                     # Human-inspectable JSON database
    employees.json
    requisitions.json
    budgets.json
    customReports.json
  public/
    index.html              # Semantic HTML app shell with Google Fonts
    styles.css              # Editorial/paper design system (no blue/glow/shadows)
    app.js                  # Client router, reactive state, hand-rolled SVG charts
  README.md                 # Product manual and technical specifications
```

---

## 7. License
MIT License. Built for enterprise HR reporting.
