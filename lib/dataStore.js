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
  fs.writeFileSync(AUDIT_FILE, JSON.stringify([
    {
      id: 'AUD-001',
      timestamp: '2026-06-30T10:14:22Z',
      role: 'cxo',
      action: 'DOWNLOAD_CSV',
      target: 'Report 1: Headcount Trend & Movement',
      recordCount: 600,
      ip: '10.0.4.12',
      status: 'SUCCESS'
    },
    {
      id: 'AUD-002',
      timestamp: '2026-06-30T11:45:09Z',
      role: 'hrbp',
      action: 'QUERY_BUILDER',
      target: 'Custom Sales Compensation Projection',
      recordCount: 124,
      ip: '10.0.12.88',
      status: 'SUCCESS'
    }
  ], null, 2), 'utf-8');
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
    // Keep last 100 entries
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
function getScopedEmployees(role = 'cxo') {
  const employees = getEmployees();
  const r = (role || 'cxo').toLowerCase();

  if (r === 'cxo' || r === 'chro') {
    return employees;
  }
  if (r === 'hrbp') {
    // Scoped to Sales department
    return employees.filter(e => e.dept === 'Sales');
  }
  if (r === 'manager') {
    // Scoped to target manager's direct reports
    const activeEmps = employees.filter(e => e.status === 'Active');
    const mgrMap = {};
    activeEmps.forEach(e => {
      if (e.managerId) mgrMap[e.managerId] = (mgrMap[e.managerId] || 0) + 1;
    });
    const targetMgrId = Object.keys(mgrMap).find(id => mgrMap[id] >= 4) || Object.keys(mgrMap)[0];
    return employees.filter(e => e.managerId === targetMgrId || e.id === targetMgrId);
  }
  if (r === 'employee') {
    // Scoped to single active employee
    const defaultEmp = employees.find(e => e.status === 'Active') || employees[0];
    return [defaultEmp];
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

function getKpis(role = 'cxo') {
  const employees = getEmployees();
  const requisitions = getRequisitions();
  const activeEmps = employees.filter(e => e.status === 'Active');
  const exitedEmps = employees.filter(e => e.status === 'Exited');
  const totalActive = activeEmps.length;
  const totalEmployees = employees.length;

  const normalizedRole = (role || 'cxo').toLowerCase();

  switch (normalizedRole) {
    case 'cxo': {
      const ttmRate = ((exitedEmps.length / totalEmployees) * 100).toFixed(1);
      const totalPayroll = activeEmps.reduce((sum, e) => sum + e.ctc, 0);
      const nonMaleCount = activeEmps.filter(e => e.gender !== 'Male').length;
      const diversityPct = ((nonMaleCount / totalActive) * 100).toFixed(1);

      return [
        { label: 'Active Headcount', value: totalActive.toLocaleString(), delta: '+4.2% YoY', subtext: 'Across 4 global entities', cls: 'positive' },
        { label: 'TTM Attrition', value: `${ttmRate}%`, delta: '-1.4% vs LTM', subtext: `${exitedEmps.length} total departures`, cls: 'positive' },
        { label: 'Annualized Payroll', value: formatCurrency(totalPayroll), delta: '+3.1% vs budget', subtext: 'All departments combined', cls: 'neutral' },
        { label: 'Gender Diversity', value: `${diversityPct}%`, delta: '+2.8% YoY', subtext: 'Non-male active workforce', cls: 'positive' }
      ];
    }
    case 'chro': {
      const openReqs = requisitions.filter(r => r.status === 'Open').length;
      const filledReqs = requisitions.filter(r => r.status === 'Filled' && r.timeToFillDays);
      const avgTTH = filledReqs.length > 0 ? Math.round(filledReqs.reduce((sum, r) => sum + r.timeToFillDays, 0) / filledReqs.length) : 38;
      const regrettedExits = exitedEmps.filter(e => e.exitType === 'Voluntary' && e.tenureMonths > 12);
      const regrettedRate = ((regrettedExits.length / Math.max(1, exitedEmps.length)) * 100).toFixed(0);
      const avgGoals = (activeEmps.reduce((sum, e) => sum + e.goalsCompleted, 0) / totalActive).toFixed(0);

      return [
        { label: 'Open Requisitions', value: openReqs.toString(), delta: '-5 vs last month', subtext: `${filledReqs.length} closed this cycle`, cls: 'positive' },
        { label: 'Avg Time to Hire', value: `${avgTTH} days`, delta: '-4 days vs Q1', subtext: 'Benchmark: 45 days', cls: 'positive' },
        { label: 'Regretted Attrition', value: `${regrettedRate}%`, delta: `${regrettedExits.length} tenured exits`, subtext: 'Voluntary departures >12m', cls: 'negative' },
        { label: 'Engagement Index (Proxy)', value: `${avgGoals}%`, delta: '+3.4 pts', subtext: 'Avg goal completion rate', cls: 'positive' }
      ];
    }
    case 'hrbp': {
      const dept = 'Sales';
      const salesEmps = activeEmps.filter(e => e.dept === dept);
      const salesReqs = requisitions.filter(r => r.dept === dept && r.status === 'Open');
      const now = new Date('2026-06-30').getTime();
      const agingReqs = salesReqs.filter(r => (now - new Date(r.openedDate).getTime()) / 86400000 > 45).length;
      const leaveLiabilityVal = salesEmps.reduce((sum, e) => sum + (e.leaveBalance * (e.ctc / 260)), 0);
      const sevenMonthsAgo = new Date(now - 210 * 86400000);
      const appraisedCount = salesEmps.filter(e => new Date(e.lastReviewDate) >= sevenMonthsAgo).length;
      const appraisalPct = ((appraisedCount / Math.max(1, salesEmps.length)) * 100).toFixed(0);

      return [
        { label: 'Sales Headcount', value: salesEmps.length.toString(), delta: '+3 new hires', subtext: 'Department scope: Sales', cls: 'positive' },
        { label: 'Open Requisitions', value: salesReqs.length.toString(), delta: `${agingReqs} aging >45d`, subtext: 'Sales talent pipeline', cls: agingReqs > 2 ? 'negative' : 'neutral' },
        { label: 'Leave Liability', value: formatCurrency(leaveLiabilityVal), delta: 'Unused balances', subtext: `${salesEmps.reduce((s, e) => s + e.leaveBalance, 0)} days encashable`, cls: 'neutral' },
        { label: 'Appraisal Completion', value: `${appraisalPct}%`, delta: `${appraisedCount}/${salesEmps.length} reviewed`, subtext: 'Current appraisal cycle', cls: 'positive' }
      ];
    }
    case 'manager': {
      const scoped = getScopedEmployees('manager').filter(e => e.status === 'Active');
      const teamSize = scoped.length;
      const avgPresent = scoped.reduce((s, e) => s + e.daysPresent, 0) / Math.max(1, scoped.length);
      const attendancePct = Math.min(100, Math.round((avgPresent / 235) * 100));
      const pendingLeaveCount = scoped.filter(e => e.leaveBalance > 14 && e.leaveTaken < 6).length;
      const reviewedReports = scoped.filter(e => (new Date('2026-06-30').getTime() - new Date(e.lastReviewDate).getTime()) / 86400000 < 180).length;

      return [
        { label: 'Direct Reports', value: teamSize.toString(), delta: '100% active', subtext: 'Assigned Management Pod', cls: 'positive' },
        { label: 'Team Attendance', value: `${attendancePct}%`, delta: '+1.2% this month', subtext: 'Cycle presence rate', cls: 'positive' },
        { label: 'Pending Leave Proxy', value: `${pendingLeaveCount} members`, delta: 'High unused balance', subtext: 'Risk of end-of-year rush', cls: pendingLeaveCount > 2 ? 'negative' : 'neutral' },
        { label: 'Reviews Completed', value: `${reviewedReports} / ${teamSize}`, delta: `${Math.round((reviewedReports / teamSize) * 100)}% progress`, subtext: 'H1 Performance Cycle', cls: 'positive' }
      ];
    }
    case 'employee': {
      const emp = getScopedEmployees('employee')[0];
      return [
        { label: 'Available Leave', value: `${emp.leaveBalance} days`, delta: `${emp.leaveTaken} days taken`, subtext: 'Earned + casual pool', cls: 'positive' },
        { label: "Net Pay (This Month)", value: `$${emp.netPay.toLocaleString()}`, delta: 'Paid on 30th', subtext: `Gross: $${emp.grossPay.toLocaleString()}`, cls: 'positive' },
        { label: 'Performance Rating', value: `${emp.rating}.0 / 5.0`, delta: `${emp.goalsCompleted}% goals met`, subtext: `Last review: ${emp.lastReviewDate}`, cls: 'positive' },
        { label: 'Days Present', value: `${emp.daysPresent} days`, delta: `${emp.otHours} OT hrs logged`, subtext: `${emp.lateMarks} late marks logged`, cls: 'neutral' }
      ];
    }
    default:
      return getKpis('cxo');
  }
}

function getHeadcountTrend(role = 'cxo') {
  const employees = getScopedEmployees(role);
  const months = [
    { label: 'Jan 2026', date: '2026-01-31' },
    { label: 'Feb 2026', date: '2026-02-28' },
    { label: 'Mar 2026', date: '2026-03-31' },
    { label: 'Apr 2026', date: '2026-04-30' },
    { label: 'May 2026', date: '2026-05-31' },
    { label: 'Jun 2026', date: '2026-06-30' }
  ];

  return months.map(m => {
    const endOfMonth = new Date(m.date);
    const count = employees.filter(e => {
      const joinDate = new Date(e.doj);
      if (joinDate > endOfMonth) return false;
      if (e.status === 'Exited' && e.exitDate && new Date(e.exitDate) <= endOfMonth) return false;
      return true;
    }).length;
    return { k: m.label, v: count };
  });
}

function getAttritionByDept(role = 'cxo') {
  const employees = getScopedEmployees(role);
  const depts = [...new Set(employees.map(e => e.dept))].sort();

  return depts.map(dept => {
    const deptTotal = employees.filter(e => e.dept === dept).length;
    const deptExits = employees.filter(e => e.dept === dept && e.status === 'Exited').length;
    const pct = deptTotal > 0 ? Number(((deptExits / deptTotal) * 100).toFixed(1)) : 0;
    return { k: dept, v: pct };
  });
}

function getGenderMix(role = 'cxo') {
  const employees = getScopedEmployees(role);
  const active = employees.filter(e => e.status === 'Active');
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
  formatCurrency
};
