const fs = require('fs');
const path = require('path');
const { DATA_DIR, initDataFiles } = require('./generateData');

// Ensure data directory and files exist
initDataFiles();

const SCHEDULES_FILE = path.join(DATA_DIR, 'scheduledReports.json');
const AUDIT_FILE = path.join(DATA_DIR, 'exportAuditLog.json');

if (!fs.existsSync(SCHEDULES_FILE)) {
  fs.writeFileSync(SCHEDULES_FILE, JSON.stringify([
    {
      id: 'SCHED-01',
      name: 'Weekly CXO Headcount & Attrition Digest',
      reportId: '1',
      frequency: 'Weekly (Mondays 08:00 AM)',
      format: 'CSV',
      recipients: 'cxo-office@company.com, chro@company.com',
      lastRun: '2026-06-29 08:00 AM',
      status: 'Active'
    },
    {
      id: 'SCHED-02',
      name: 'Monthly Departmental Leave Liability Accrual',
      reportId: '8',
      frequency: 'Monthly (1st of month)',
      format: 'CSV',
      recipients: 'finance-controllers@company.com, hrbp-lead@company.com',
      lastRun: '2026-06-01 06:00 AM',
      status: 'Active'
    }
  ], null, 2), 'utf-8');
}

if (!fs.existsSync(AUDIT_FILE)) {
  fs.writeFileSync(AUDIT_FILE, JSON.stringify([], null, 2), 'utf-8');
}

function readJson(filename) {
  const filePath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filePath)) {
    initDataFiles();
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function getEmployees() {
  return readJson('employees.json');
}

function getRequisitions() {
  return readJson('requisitions.json');
}

function getBudgets() {
  return readJson('budgets.json');
}

function getCustomReports() {
  return readJson('customReports.json');
}

function getSchedules() {
  if (!fs.existsSync(SCHEDULES_FILE)) return [];
  return JSON.parse(fs.readFileSync(SCHEDULES_FILE, 'utf-8'));
}

function saveSchedule(job) {
  const schedules = getSchedules();
  const newJob = {
    id: `SCHED-${String(Date.now()).slice(-4)}`,
    name: job.name || 'Custom Scheduled Export',
    reportId: job.reportId || 'custom',
    frequency: job.frequency || 'Weekly',
    format: job.format || 'CSV',
    recipients: job.recipients || 'reports@company.com',
    lastRun: 'Pending First Execution',
    status: 'Active',
    createdAt: new Date().toISOString()
  };
  schedules.unshift(newJob);
  fs.writeFileSync(SCHEDULES_FILE, JSON.stringify(schedules, null, 2), 'utf-8');
  logAuditEvent({
    role: job.role || 'admin',
    action: 'CREATE_SCHEDULE',
    target: `Schedule: ${newJob.name} (${newJob.frequency})`,
    recordCount: 1,
    status: 'SUCCESS'
  });
  return newJob;
}

function getAuditLog() {
  if (!fs.existsSync(AUDIT_FILE)) return [];
  return JSON.parse(fs.readFileSync(AUDIT_FILE, 'utf-8'));
}

function logAuditEvent(event) {
  try {
    const logs = getAuditLog();
    const entry = {
      id: `AUD-${String(Date.now()).slice(-6)}`,
      timestamp: new Date().toISOString(),
      role: event.role || 'system',
      action: event.action || 'ACCESS',
      target: event.target || 'General Query',
      recordCount: event.recordCount || 0,
      ip: event.ip || '127.0.0.1',
      status: event.status || 'SUCCESS'
    };
    logs.unshift(entry);
    fs.writeFileSync(AUDIT_FILE, JSON.stringify(logs.slice(0, 100), null, 2), 'utf-8');
    return entry;
  } catch (err) {
    console.error('Failed to log audit event:', err);
  }
}

function saveCustomReport(report, role = 'cxo') {
  const reports = getCustomReports();
  const newReport = {
    id: `CUSTOM-${Date.now()}`,
    name: report.name || 'Untitled Report',
    fields: report.fields || [],
    filters: report.filters || {},
    createdByRole: role,
    createdAt: new Date().toISOString()
  };
  reports.push(newReport);
  fs.writeFileSync(path.join(DATA_DIR, 'customReports.json'), JSON.stringify(reports, null, 2), 'utf-8');
  logAuditEvent({
    role,
    action: 'SAVE_CUSTOM_REPORT',
    target: `Report Schema: ${newReport.name}`,
    recordCount: newReport.fields.length,
    status: 'SUCCESS'
  });
  return newReport;
}

/**
 * Role-aware employee scoping helper (RBAC)
 */
function getScopedEmployees(role = 'cxo', entity = 'All') {
  let employees = getEmployees();
  const r = (role || 'cxo').toLowerCase();

  if (r === 'hrbp') {
    // Scoped strictly to Sales department
    employees = employees.filter(e => e.dept === 'Sales');
  } else if (r === 'manager') {
    // Scoped strictly to target manager's direct reports pod
    const activeEmps = employees.filter(e => e.status === 'Active');
    const mgrMap = {};
    activeEmps.forEach(e => {
      if (e.managerId) mgrMap[e.managerId] = (mgrMap[e.managerId] || 0) + 1;
    });
    const targetMgrId = Object.keys(mgrMap).find(id => mgrMap[id] >= 4) || Object.keys(mgrMap)[0];
    employees = employees.filter(e => e.managerId === targetMgrId || e.id === targetMgrId);
  } else if (r === 'employee') {
    // Scoped strictly to single active employee (self)
    const defaultEmp = employees.find(e => e.status === 'Active') || employees[0];
    employees = [defaultEmp];
  }

  // Filter by Entity if specified
  if (entity && entity !== 'All') {
    employees = employees.filter(e => e.entity === entity);
  }

  return employees;
}

function getMeta(role = 'cxo') {
  const employees = getScopedEmployees(role);
  const entities = [...new Set(employees.map(e => e.entity))].sort();
  const departments = [...new Set(employees.map(e => e.dept))].sort();
  const locations = [...new Set(employees.map(e => e.location))].sort();
  const employmentTypes = [...new Set(employees.map(e => e.employmentType))].sort();

  return {
    entities,
    departments,
    locations,
    employmentTypes,
    scopedCount: employees.length,
    activeRole: role
  };
}

function formatCurrency(val) {
  if (val >= 10000000) return `$${(val / 1000000).toFixed(2)}M`;
  if (val >= 100000) return `$${(val / 1000).toFixed(0)}k`;
  return `$${val.toLocaleString()}`;
}

function getKpis(role = 'cxo', entity = 'All') {
  const employees = getEmployees();
  const requisitions = getRequisitions();
  const scopedEmps = getScopedEmployees(role, entity);
  const activeEmps = scopedEmps.filter(e => e.status === 'Active');
  const exitedEmps = scopedEmps.filter(e => e.status === 'Exited');
  const totalActive = activeEmps.length;
  const totalScoped = scopedEmps.length;

  const normalizedRole = (role || 'cxo').toLowerCase();

  switch (normalizedRole) {
    case 'cxo': {
      const allActive = employees.filter(e => e.status === 'Active');
      const allExited = employees.filter(e => e.status === 'Exited');
      const ttmRate = ((allExited.length / employees.length) * 100).toFixed(1);
      const totalPayroll = allActive.reduce((sum, e) => sum + e.ctc, 0);
      const nonMaleCount = allActive.filter(e => e.gender !== 'Male').length;
      const diversityPct = ((nonMaleCount / allActive.length) * 100).toFixed(1);

      return [
        { label: 'Active Headcount', value: allActive.length.toLocaleString(), delta: '+4.2% YoY', subtext: 'Across 4 global entities', cls: 'positive' },
        { label: 'TTM Attrition', value: `${ttmRate}%`, delta: '-1.4% vs LTM', subtext: `${allExited.length} total departures`, cls: 'positive' },
        { label: 'Annualized Payroll', value: formatCurrency(totalPayroll), delta: '+3.1% vs budget', subtext: 'All departments combined', cls: 'neutral' },
        { label: 'Gender Diversity', value: `${diversityPct}%`, delta: '+2.8% YoY', subtext: 'Non-male active workforce', cls: 'positive' }
      ];
    }
    case 'chro': {
      const openReqs = requisitions.filter(r => r.status === 'Open').length;
      const filledReqs = requisitions.filter(r => r.status === 'Filled' && r.timeToFillDays);
      const avgTTH = filledReqs.length > 0 ? Math.round(filledReqs.reduce((sum, r) => sum + r.timeToFillDays, 0) / filledReqs.length) : 38;
      const allExits = employees.filter(e => e.status === 'Exited');
      const regrettedExits = allExits.filter(e => e.exitType === 'Voluntary' && e.tenureMonths > 12);
      const regrettedRate = ((regrettedExits.length / Math.max(1, allExits.length)) * 100).toFixed(0);
      const avgGoals = (employees.filter(e => e.status === 'Active').reduce((sum, e) => sum + e.goalsCompleted, 0) / Math.max(1, employees.filter(e => e.status === 'Active').length)).toFixed(0);

      return [
        { label: 'Open Requisitions', value: openReqs.toString(), delta: '-5 vs last month', subtext: `${filledReqs.length} closed this cycle`, cls: 'positive' },
        { label: 'Avg Time to Hire', value: `${avgTTH} days`, delta: '-4 days vs Q1', subtext: 'Benchmark: 45 days', cls: 'positive' },
        { label: 'Regretted Attrition', value: `${regrettedRate}%`, delta: `${regrettedExits.length} tenured exits`, subtext: 'Voluntary departures >12m', cls: 'negative' },
        { label: 'Engagement Index (Proxy)', value: `${avgGoals}%`, delta: '+3.4 pts', subtext: 'Avg goal completion rate', cls: 'positive' }
      ];
    }
    case 'hrbp': {
      const salesReqs = requisitions.filter(r => r.dept === 'Sales' && r.status === 'Open');
      const now = new Date('2026-06-30').getTime();
      const agingReqs = salesReqs.filter(r => (now - new Date(r.openedDate).getTime()) / 86400000 > 45).length;
      const leaveLiabilityVal = activeEmps.reduce((sum, e) => sum + (e.leaveBalance * (e.ctc / 260)), 0);
      const sevenMonthsAgo = new Date(now - 210 * 86400000);
      const appraisedCount = activeEmps.filter(e => new Date(e.lastReviewDate) >= sevenMonthsAgo).length;
      const appraisalPct = ((appraisedCount / Math.max(1, activeEmps.length)) * 100).toFixed(0);

      return [
        { label: 'Sales Headcount', value: activeEmps.length.toString(), delta: '+3 new hires', subtext: 'Scope: Sales Department', cls: 'positive' },
        { label: 'Sales Open Reqs', value: salesReqs.length.toString(), delta: `${agingReqs} aging >45d`, subtext: 'Sales hiring pipeline', cls: agingReqs > 2 ? 'negative' : 'neutral' },
        { label: 'Sales Leave Liability', value: formatCurrency(leaveLiabilityVal), delta: 'Unused balances', subtext: `${activeEmps.reduce((s, e) => s + e.leaveBalance, 0)} days encashable`, cls: 'neutral' },
        { label: 'Sales Appraisal Rate', value: `${appraisalPct}%`, delta: `${appraisedCount}/${activeEmps.length} reviewed`, subtext: 'Current appraisal cycle', cls: 'positive' }
      ];
    }
    case 'manager': {
      const avgPresent = activeEmps.reduce((s, e) => s + e.daysPresent, 0) / Math.max(1, activeEmps.length);
      const attendancePct = Math.min(100, Math.round((avgPresent / 235) * 100));
      const pendingLeaveCount = activeEmps.filter(e => e.leaveBalance > 14 && e.leaveTaken < 6).length;
      const reviewedReports = activeEmps.filter(e => (new Date('2026-06-30').getTime() - new Date(e.lastReviewDate).getTime()) / 86400000 < 180).length;

      return [
        { label: 'Direct Reports', value: totalActive.toString(), delta: '100% active', subtext: 'Management Pod Scope', cls: 'positive' },
        { label: 'Pod Attendance', value: `${attendancePct}%`, delta: '+1.2% this month', subtext: 'Presence across 240 days', cls: 'positive' },
        { label: 'Pending Leave Risk', value: `${pendingLeaveCount} members`, delta: 'High unused balance', subtext: 'End-of-year rush risk', cls: pendingLeaveCount > 2 ? 'negative' : 'neutral' },
        { label: 'Pod Reviews Done', value: `${reviewedReports} / ${totalActive}`, delta: `${Math.round((reviewedReports / Math.max(1, totalActive)) * 100)}% progress`, subtext: 'Performance appraisals', cls: 'positive' }
      ];
    }
    case 'employee': {
      const emp = activeEmps[0] || employees[0];
      return [
        { label: 'My Available Leave', value: `${emp.leaveBalance} days`, delta: `${emp.leaveTaken} days taken`, subtext: 'Earned + Casual balance', cls: 'positive' },
        { label: "My Net Take-Home", value: `$${emp.netPay.toLocaleString()}`, delta: 'Paid on 30th', subtext: `Gross Pay: $${emp.grossPay.toLocaleString()}`, cls: 'positive' },
        { label: 'My Performance Rating', value: `${emp.rating}.0 / 5.0`, delta: `${emp.goalsCompleted}% goals met`, subtext: `Last Review: ${emp.lastReviewDate}`, cls: 'positive' },
        { label: 'My Days Present', value: `${emp.daysPresent} days`, delta: `${emp.otHours} OT hrs logged`, subtext: `${emp.lateMarks} late marks`, cls: 'neutral' }
      ];
    }
    default:
      return getKpis('cxo');
  }
}

/**
 * Role-scoped dynamic headcount / attendance trend
 */
function getHeadcountTrend(role = 'cxo', entity = 'All') {
  const scopedEmps = getScopedEmployees(role, entity);
  const normalizedRole = (role || 'cxo').toLowerCase();

  const months = [
    { label: 'Jan 2026', date: '2026-01-31' },
    { label: 'Feb 2026', date: '2026-02-28' },
    { label: 'Mar 2026', date: '2026-03-31' },
    { label: 'Apr 2026', date: '2026-04-30' },
    { label: 'May 2026', date: '2026-05-31' },
    { label: 'Jun 2026', date: '2026-06-30' }
  ];

  // If Employee, show their monthly days present / activity trend
  if (normalizedRole === 'employee') {
    const emp = scopedEmps[0];
    const basePresent = Math.round((emp.daysPresent || 220) / 12);
    return [
      { k: 'Jan 2026', v: Math.max(18, basePresent - 1) },
      { k: 'Feb 2026', v: Math.max(18, basePresent - 2) },
      { k: 'Mar 2026', v: Math.max(18, basePresent + 1) },
      { k: 'Apr 2026', v: Math.max(18, basePresent) },
      { k: 'May 2026', v: Math.max(18, basePresent + 2) },
      { k: 'Jun 2026', v: Math.max(18, basePresent + 1) }
    ];
  }

  return months.map(m => {
    const endOfMonth = new Date(m.date);
    const count = scopedEmps.filter(e => {
      const joinDate = new Date(e.doj);
      if (joinDate > endOfMonth) return false;
      if (e.status === 'Exited' && e.exitDate && new Date(e.exitDate) <= endOfMonth) return false;
      return true;
    }).length;
    return { k: m.label, v: count };
  });
}

/**
 * Role-scoped attrition or distribution breakdown
 */
function getAttritionByDept(role = 'cxo', entity = 'All') {
  const scopedEmps = getScopedEmployees(role, entity);
  const normalizedRole = (role || 'cxo').toLowerCase();

  if (normalizedRole === 'employee') {
    // For employee, show their performance goal breakdown by category
    return [
      { k: 'Technical Execution', v: 92 },
      { k: 'Cross-functional Collab', v: 88 },
      { k: 'Strategic Initiatives', v: 85 },
      { k: 'Mentorship & Culture', v: 95 }
    ];
  }

  if (normalizedRole === 'manager') {
    // For manager, show direct reports' attendance % by pod member
    return scopedEmps.slice(0, 6).map(e => ({
      k: e.name.split(' ')[0],
      v: Math.round((e.daysPresent / 240) * 100)
    }));
  }

  if (normalizedRole === 'hrbp') {
    // For HRBP, show Sales sub-locations attrition rate
    const locations = [...new Set(scopedEmps.map(e => e.location))].sort();
    return locations.map(loc => {
      const locEmps = scopedEmps.filter(e => e.location === loc);
      const locExits = locEmps.filter(e => e.status === 'Exited').length;
      const pct = locEmps.length > 0 ? Number(((locExits / locEmps.length) * 100).toFixed(1)) : 0;
      return { k: loc, v: pct };
    });
  }

  // Company-wide / CXO / CHRO: Attrition by Department
  const depts = [...new Set(scopedEmps.map(e => e.dept))].sort();
  return depts.map(dept => {
    const deptTotal = scopedEmps.filter(e => e.dept === dept).length;
    const deptExits = scopedEmps.filter(e => e.dept === dept && e.status === 'Exited').length;
    const pct = deptTotal > 0 ? Number(((deptExits / deptTotal) * 100).toFixed(1)) : 0;
    return { k: dept, v: pct };
  });
}

/**
 * Role-scoped composition breakdown
 */
function getGenderMix(role = 'cxo', entity = 'All') {
  const scopedEmps = getScopedEmployees(role, entity);
  const normalizedRole = (role || 'cxo').toLowerCase();

  if (normalizedRole === 'employee') {
    const emp = scopedEmps[0];
    return [
      { label: 'Days Present', v: Math.round((emp.daysPresent / 260) * 100), count: emp.daysPresent, c: '#c1521f' },
      { label: 'Leave Utilized', v: Math.round((emp.leaveTaken / 260) * 100), count: emp.leaveTaken, c: '#1a1714' },
      { label: 'Available Balance', v: Math.round((emp.leaveBalance / 260) * 100), count: emp.leaveBalance, c: '#8f887f' }
    ];
  }

  const active = scopedEmps.filter(e => e.status === 'Active');
  const total = active.length || 1;

  const counts = { Female: 0, Male: 0, 'Non-Binary': 0 };
  active.forEach(e => {
    if (counts[e.gender] !== undefined) counts[e.gender]++;
    else counts['Non-Binary']++;
  });

  const colorMap = {
    Female: '#c1521f',
    Male: '#1a1714',
    'Non-Binary': '#8f887f'
  };

  return Object.keys(counts).map(gender => ({
    label: gender,
    v: Number(((counts[gender] / total) * 100).toFixed(1)),
    count: counts[gender],
    c: colorMap[gender] || '#8f887f'
  }));
}

function getCeoMetrics(role = 'cxo', entity = 'All') {
  const normalizedRole = (role || 'cxo').toLowerCase();
  if (normalizedRole !== 'cxo') {
    return null;
  }
  const employees = getEmployees();
  const scopedEmps = getScopedEmployees('cxo', entity);
  const activeEmps = scopedEmps.filter(e => e.status === 'Active');

  const entities = ['India Ops', 'US Corp', 'EU Financial Svcs', 'UAE Holding'];
  const entityBreakdown = entities.map(ent => {
    const entAll = employees.filter(e => e.entity === ent);
    const entActive = entAll.filter(e => e.status === 'Active');
    const entExited = entAll.filter(e => e.status === 'Exited');
    const payroll = entActive.reduce((sum, e) => sum + e.ctc, 0);
    const attrition = entAll.length ? ((entExited.length / entAll.length) * 100).toFixed(1) : '0.0';
    const avgSalary = entActive.length ? Math.round(payroll / entActive.length) : 0;
    return {
      entity: ent,
      headcount: entActive.length,
      totalCount: entAll.length,
      annualPayroll: (payroll / 1000000).toFixed(2),
      avgSalaryFormatted: '$' + avgSalary.toLocaleString(),
      attritionPct: attrition,
      marginContribution: ent === 'UAE Holding' ? '46%' : ent === 'EU Financial Svcs' ? '41%' : ent === 'India Ops' ? '34%' : '28%',
      runwayMonths: ent === 'UAE Holding' ? '28 Mo' : ent === 'EU Financial Svcs' ? '24 Mo' : ent === 'India Ops' ? '20 Mo' : '18 Mo'
    };
  });

  const totalPayrollM = (activeEmps.reduce((sum, e) => sum + e.ctc, 0) / 1000000).toFixed(2);
  const monthlyBurnM = (totalPayrollM / 12).toFixed(2);

  return {
    overview: {
      totalActive: activeEmps.length,
      totalPayrollM,
      monthlyBurnM,
      revenuePerHead: '$485,000',
      retentionTopTier: '97.2%',
      orgLeverageRatio: '1 : 6.8',
      entityScope: entity
    },
    entities: entityBreakdown,
    executiveInitiatives: [
      { id: 'INIT-01', title: 'Global Engineering Hub Expansion (India Ops)', budget: '$42.5M', targetQuarter: 'Q4 2026', status: 'On Track', pacing: '94%' },
      { id: 'INIT-02', title: 'Executive Succession & C-Suite Retention Matrix', budget: '$18.0M', targetQuarter: 'Q3 2026', status: 'Active Review', pacing: '88%' },
      { id: 'INIT-03', title: 'EU Financial Svcs Statutory Solvency Rebalancing', budget: '$12.2M', targetQuarter: 'Q1 2027', status: 'Approved', pacing: '100%' }
    ],
    pendingDecisions: [
      { id: 'DEC-01', title: 'Q3 FY27 Executive Stock Grant Pool ($8.4M Allocation)', department: 'Global Executive', urgency: 'High', status: 'Pending Approval' },
      { id: 'DEC-02', title: 'UAE Holding Tax-Advantaged Operating Expansion', department: 'Corporate Strategy', urgency: 'Medium', status: 'Pending Approval' },
      { id: 'DEC-03', title: 'Enterprise AI Infrastructure & Automation Headcount Cap', department: 'Operations & Tech', urgency: 'High', status: 'Pending Approval' }
    ]
  };
}

module.exports = {
  getEmployees,
  getRequisitions,
  getBudgets,
  getCustomReports,
  saveCustomReport,
  getScopedEmployees,
  getSchedules,
  saveSchedule,
  getAuditLog,
  logAuditEvent,
  getMeta,
  getKpis,
  getHeadcountTrend,
  getAttritionByDept,
  getGenderMix,
  getCeoMetrics,
  formatCurrency
};
