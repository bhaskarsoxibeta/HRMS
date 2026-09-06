# ReportOS — Universal HR Reporting Engine (Enterprise RBAC Edition)

**ReportOS** is a zero-dependency, editorial-grade HR reporting and workforce intelligence platform built on Node.js and vanilla web standards. It features role-based access control (RBAC), executive dashboards, an enterprise standard report library with **all 21 executable report generators**, a live schema-projecting custom report builder, automated report scheduling, export audit logging, and a grounded AI copilot.

---

## 1. Quick Start

ReportOS requires **no build tools**, **no bundlers**, and **zero `npm install` steps**. It runs directly on any Node.js environment (v14+).

```bash
# 1. Start the server
node server.js

# 2. Open in your browser
http://localhost:3000
```

---

## 2. Role-Based Access Control (RBAC) System

ReportOS enforces distinct access boundaries, field masking, and data scoping across **5 user personas**:

| Role Persona | Identity & Access Scope | Report Library Authorization | Custom Builder Attributes | Copilot Boundary |
|---|---|---|---|---|
| **CXO (Executive)** | Full Global (4 Entities / 600 Records) | All 21 Reports Authorized | Full Schema (incl. Executive CTC) | Full Enterprise Analytics |
| **CHRO (People)** | Company-Wide Talent, Attrition & Recruitment | All 21 Reports Authorized | Full Schema | Talent, Attrition & Hiring |
| **HRBP (Sales)** | Scoped to Sales Dept (124 Records) | 12 Dept & Ops Reports | Sales Scope (Excl. Cross-Dept CTC) | Dept-Scoped Queries |
| **Line Manager** | Scoped to Direct Reports Pod (8 Records) | 5 Team Attendance & Review Reports | Attendance & Goals Only (No Payroll) | Pod Attendance & Reviews |
| **Employee (ESS)** | Self-Service (Personal Record Only) | Personal Statements Only | Masked (Personal View Only) | Personal Leave & Net Pay |

---

## 3. Core Screens & Capabilities

### 1. Executive Dashboard (`#dashboard`)
- Dynamic KPI calculations for all 5 roles with an **asymmetric hero layout**.
- **Hand-Rolled Inline SVG Charts:**
  - 6-Month Headcount Trajectory (Line & Area)
  - Workforce Gender Composition (Segmented Donut with Legend)
  - Departmental Attrition Rate (Horizontal Bar)
- Built-in **Print Brief / PDF** view for printable executive decks.

### 2. Standard Report Catalog (`#library`)
- **All 21 Enterprise Reports Fully Wired** with executable CSV data generators:
  1. *Headcount Trend & Movement*
  2. *Attrition Analysis*
  3. *Diversity & Inclusion Snapshot*
  4. *Recruitment Funnel & TAT*
  5. *Source Effectiveness & Channel ROI*
  6. *CTC Breakup & Cost Analysis*
  7. *Pay Equity & Level Compensation Matrix*
  8. *Leave Liability Report*
  9. *Absenteeism & Attendance Trend*
  10. *Appraisal Cycle Completion*
  11. *Span of Control & Org Hierarchy*
  12. *Offer Acceptance & Decline Reasons*
  13. *Statutory Contribution Summary*
  14. *Overtime Trend & Burnout Risk*
  15. *Rating Distribution & 9-Box Grid*
  16. *POSH Case Register & Compliance Audit*
  17. *Audit Trail & Access Log*
  18. *Training Hours & Completion Rate*
  19. *Skill Gap Heatmap by Role*
  20. *Engagement Survey Results (eNPS)*
  21. *Exit Interview Themes & Root Cause*

### 3. Custom Report Builder (`#builder`)
- Role-enforced field selection (*Employee, Payroll, Attendance, Performance*).
- Multi-attribute filtering with live preview table (first 8 rows + total count).
- Schema persistence to `data/customReports.json`.

### 4. Grounded AI Copilot (`#copilot`)
- Role-aware intelligence: checks user permissions before evaluating queries.
- Factual computations over real data with inline SVG bar and line charts.

### 5. Automated Schedules (`#schedules`)
- Configure recurring batch export jobs (Daily, Weekly, Monthly) with automated dispatch simulation.

### 6. Security & Audit Trail (`#audit`)
- Immutable real-time log tracking CSV downloads, custom queries, schedule configurations, and RBAC authorization blocks.

---

## 4. Visual & Typographic System

- **Strict Palette:** Warm off-white (`#f2ede4`), deep ink text (`#1a1714`), burnt terracotta accent (`#c1521f`), warm slate (`#8f887f`), and desaturated red (`#8b3a2a`).
- **Hard Constraints:** Zero blue, zero violet, zero glowing rings, zero drop-shadow depth simulation, zero glassmorphism.
- **Typography:** *Playfair Display* (headlines & numerals), *DM Sans* (UI body), *IBM Plex Mono* (data/tables).

---

## 5. API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/meta?role=<role>` | Scoped entities, departments, and metadata |
| `GET` | `/api/kpis?role=<role>` | 4 role-specific KPI cards |
| `GET` | `/api/charts/headcount-trend?role=<role>` | Scoped 6-month headcount trajectory |
| `GET` | `/api/charts/attrition-by-dept?role=<role>` | Scoped departmental attrition |
| `GET` | `/api/charts/gender-mix?role=<role>` | Scoped gender composition |
| `GET` | `/api/reports?category=<cat>&role=<role>` | Catalog with RBAC permission flags |
| `GET` | `/api/reports/:id/csv?role=<role>` | Streams authorized CSV (403 if restricted) |
| `GET` | `/api/builder/fields?role=<role>` | Available fields with sensitive payroll masking |
| `POST` | `/api/builder/preview` | Returns role-scoped preview rows + total count |
| `POST` | `/api/builder/csv` | Streams full CSV of custom query |
| `POST` | `/api/builder/save` | Persists custom report definition |
| `GET` | `/api/builder/saved` | Lists saved custom report definitions |
| `POST` | `/api/copilot` | Natural language query engine with RBAC security |
| `GET` | `/api/schedules` | Retrieves recurring automated export jobs |
| `POST` | `/api/schedules` | Creates a new recurring export job |
| `GET` | `/api/audit-log` | Retrieves immutable audit event stream |

---

## 6. License
MIT License. Built for enterprise HR reporting.
