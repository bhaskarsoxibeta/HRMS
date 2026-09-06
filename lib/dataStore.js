const fs = require('fs');
const path = require('path');
const { DATA_DIR, initDataFiles } = require('./generateData');

// Ensure data exists on startup
initDataFiles();

function readJson(filename) {
  const filePath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filePath)) {
    initDataFiles();
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
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

function saveCustomReport(report) {
  const reports = getCustomReports();
  const newReport = {
    id: `CUSTOM-${Date.now()}`,
    name: report.name || 'Untitled Report',
    fields: report.fields || [],
    filters: report.filters || {},
    createdAt: new Date().toISOString()
  };
  reports.push(newReport);
  fs.writeFileSync(
    path.join(DATA_DIR, 'customReports.json'),
    JSON.stringify(reports, null, 2),
    'utf-8'
  );
  return newReport;
}

function getMeta() {
  const employees = getEmployees();
  const entities = [...new Set(employees.map(e => e.entity))].sort();
  const departments = [...new Set(employees.map(e => e.dept))].sort();
  const locations = [...new Set(employees.map(e => e.location))].sort();
  const employmentTypes = [...new Set(employees.map(e => e.employmentType))].sort();

  return {
    entities,
    departments,
    locations,
    employmentTypes
  };
}

// Format numbers
function formatCurrency(val) {
  if (val >= 10000000) {
    return `$${(val / 1000000).toFixed(2)}M`;
  }
  if (val >= 100000) {
    return `$${(val / 1000).toFixed(0)}k`;
  }
  return `$${val.toLocaleString()}`;
}

/**
 * Role-based KPIs computation
 * Returns 4-5 cards per role: { label, value, delta, subtext, cls }
 */
function getKpis(role = 'cxo') {
  const employees = getEmployees();
  const requisitions = getRequisitions();
  const budgets = getBudgets();

  const activeEmps = employees.filter(e => e.status === 'Active');
  const exitedEmps = employees.filter(e => e.status === 'Exited');
  const totalActive = activeEmps.length;
  const totalEmployees = employees.length;

  const normalizedRole = (role || 'cxo').toLowerCase();

  switch (normalizedRole) {
    case 'cxo': {
      // 1. Total Active Headcount
      // 2. TTM Attrition Rate (exits / total average headcount)
      const ttmRate = ((exitedEmps.length / totalEmployees) * 100).toFixed(1);
      // 3. Total Annualized Payroll Cost
      const totalPayroll = activeEmps.reduce((sum, e) => sum + e.ctc, 0);
      // 4. Gender Diversity % (non-male active / total active)
      const nonMaleCount = activeEmps.filter(e => e.gender !== 'Male').length;
      const diversityPct = ((nonMaleCount / totalActive) * 100).toFixed(1);

      return [
        {
          label: 'Active Headcount',
          value: totalActive.toLocaleString(),
          delta: '+4.2% YoY',
          subtext: 'Across 4 global entities',
          cls: 'positive'
        },
        {
          label: 'TTM Attrition',
          value: `${ttmRate}%`,
          delta: '-1.4% vs LTM',
          subtext: `${exitedEmps.length} total departures`,
          cls: 'positive'
        },
        {
          label: 'Annualized Payroll',
          value: formatCurrency(totalPayroll),
          delta: '+3.1% vs budget',
          subtext: 'All departments combined',
          cls: 'neutral'
        },
        {
          label: 'Gender Diversity',
          value: `${diversityPct}%`,
          delta: '+2.8% YoY',
          subtext: 'Non-male active workforce',
          cls: 'positive'
        }
      ];
    }

    case 'chro': {
      // 1. Open Requisitions
      const openReqs = requisitions.filter(r => r.status === 'Open').length;
      // 2. Avg Time to Hire (days)
      const filledReqs = requisitions.filter(r => r.status === 'Filled' && r.timeToFillDays);
      const avgTTH = filledReqs.length > 0
        ? Math.round(filledReqs.reduce((sum, r) => sum + r.timeToFillDays, 0) / filledReqs.length)
        : 38;
      // 3. Regretted Attrition (voluntary exits with >12mo tenure)
      const regrettedExits = exitedEmps.filter(e => e.exitType === 'Voluntary' && e.tenureMonths > 12);
      const regrettedRate = ((regrettedExits.length / Math.max(1, exitedEmps.length)) * 100).toFixed(0);
      // 4. Engagement Proxy (avg goal completion %)
      const avgGoals = (activeEmps.reduce((sum, e) => sum + e.goalsCompleted, 0) / totalActive).toFixed(0);

      return [
        {
          label: 'Open Requisitions',
          value: openReqs.toString(),
          delta: '-5 vs last month',
          subtext: `${filledReqs.length} closed this cycle`,
          cls: 'positive'
        },
        {
          label: 'Avg Time to Hire',
          value: `${avgTTH} days`,
          delta: '-4 days vs Q1',
          subtext: 'Benchmark: 45 days',
          cls: 'positive'
        },
        {
          label: 'Regretted Attrition',
          value: `${regrettedRate}%`,
          delta: `${regrettedExits.length} tenured exits`,
          subtext: 'Voluntary departures >12m',
          cls: 'negative'
        },
        {
          label: 'Engagement Index (Proxy)',
          value: `${avgGoals}%`,
          delta: '+3.4 pts',
          subtext: 'Avg goal completion rate',
          cls: 'positive'
        }
      ];
    }

    case 'hrbp': {
      // Scoped to department: Sales default
      const dept = 'Sales';
      const salesEmps = activeEmps.filter(e => e.dept === dept);
      const salesReqs = requisitions.filter(r => r.dept === dept && r.status === 'Open');
      
      // Calculate aging > 45 days
      const now = new Date('2026-06-30').getTime();
      const agingReqs = salesReqs.filter(r => {
        const opened = new Date(r.openedDate).getTime();
        return (now - opened) / 86400000 > 45;
      }).length;

      // Leave liability for Sales (unused leave * daily rate where daily rate = ctc / 260)
      const leaveLiabilityVal = salesEmps.reduce((sum, e) => {
        const dailyRate = e.ctc / 260;
        return sum + (e.leaveBalance * dailyRate);
      }, 0);

      // Appraisal completion (reviewed in last ~7 months)
      const sevenMonthsAgo = new Date(now - 210 * 86400000);
      const appraisedCount = salesEmps.filter(e => new Date(e.lastReviewDate) >= sevenMonthsAgo).length;
      const appraisalPct = ((appraisedCount / Math.max(1, salesEmps.length)) * 100).toFixed(0);

      return [
        {
          label: 'Sales Headcount',
          value: salesEmps.length.toString(),
          delta: '+3 new hires',
          subtext: 'Department scope: Sales',
          cls: 'positive'
        },
        {
          label: 'Open Requisitions',
          value: salesReqs.length.toString(),
          delta: `${agingReqs} aging >45d`,
          subtext: 'Sales talent pipeline',
          cls: agingReqs > 2 ? 'negative' : 'neutral'
        },
        {
          label: 'Leave Liability',
          value: formatCurrency(leaveLiabilityVal),
          delta: 'Unused balances',
          subtext: `${salesEmps.reduce((s, e) => s + e.leaveBalance, 0)} days encashable`,
          cls: 'neutral'
        },
        {
          label: 'Appraisal Completion',
          value: `${appraisalPct}%`,
          delta: `${appraisedCount}/${salesEmps.length} reviewed`,
          subtext: 'Current appraisal cycle',
          cls: 'positive'
        }
      ];
    }

    case 'manager': {
      // Scoped to a manager's direct reports (find a manager with 4-10 direct reports)
      const managersWithReports = {};
      activeEmps.forEach(e => {
        if (e.managerId) {
          managersWithReports[e.managerId] = (managersWithReports[e.managerId] || 0) + 1;
        }
      });
      
      const targetMgrId = Object.keys(managersWithReports).find(id => managersWithReports[id] >= 4) || Object.keys(managersWithReports)[0];
      const directReports = activeEmps.filter(e => e.managerId === targetMgrId);
      const teamSize = directReports.length || 6;

      // Attendance % (avg days present / 240)
      const avgPresent = directReports.reduce((s, e) => s + e.daysPresent, 0) / Math.max(1, directReports.length);
      const attendancePct = Math.min(100, Math.round((avgPresent / 235) * 100));

      // Pending leave proxy (team members with leaveBalance > 14 and leaveTaken < 5)
      const pendingLeaveCount = directReports.filter(e => e.leaveBalance > 14 && e.leaveTaken < 6).length;

      // Reviews completed
      const reviewedReports = directReports.filter(e => {
        const revTime = new Date(e.lastReviewDate).getTime();
        return (new Date('2026-06-30').getTime() - revTime) / 86400000 < 180;
      }).length;

      return [
        {
          label: 'Direct Reports',
          value: teamSize.toString(),
          delta: '100% active',
          subtext: `Manager Pod (${targetMgrId || 'MGR-01'})`,
          cls: 'positive'
        },
        {
          label: 'Team Attendance',
          value: `${attendancePct}%`,
          delta: '+1.2% this month',
          subtext: 'Cycle presence rate',
          cls: 'positive'
        },
        {
          label: 'Pending Leave Proxy',
          value: `${pendingLeaveCount} members`,
          delta: 'High unused balance',
          subtext: 'Risk of end-of-year rush',
          cls: pendingLeaveCount > 2 ? 'negative' : 'neutral'
        },
        {
          label: 'Reviews Completed',
          value: `${reviewedReports} / ${teamSize}`,
          delta: `${Math.round((reviewedReports / teamSize) * 100)}% progress`,
          subtext: 'H1 Performance Cycle',
          cls: 'positive'
        }
      ];
    }

    case 'employee': {
      // First active employee
      const defaultEmp = activeEmps[0] || employees[0];

      return [
        {
          label: 'Available Leave',
          value: `${defaultEmp.leaveBalance} days`,
          delta: `${defaultEmp.leaveTaken} days taken`,
          subtext: 'Earned + casual pool',
          cls: 'positive'
        },
        {
          label: "Net Pay (This Month)",
          value: `$${defaultEmp.netPay.toLocaleString()}`,
          delta: 'Paid on 30th',
          subtext: `Gross: $${defaultEmp.grossPay.toLocaleString()}`,
          cls: 'positive'
        },
        {
          label: 'Performance Rating',
          value: `${defaultEmp.rating}.0 / 5.0`,
          delta: `${defaultEmp.goalsCompleted}% goals met`,
          subtext: `Last review: ${defaultEmp.lastReviewDate}`,
          cls: 'positive'
        },
        {
          label: 'Days Present',
          value: `${defaultEmp.daysPresent} days`,
          delta: `${defaultEmp.otHours} OT hrs logged`,
          subtext: `${defaultEmp.lateMarks} late marks logged`,
          cls: 'neutral'
        }
      ];
    }

    default:
      return getKpis('cxo');
  }
}

/**
 * Headcount trend for the last 6 months (Jan 2026 to Jun 2026)
 * Computed dynamically by checking each employee's join date and exit date against each month end.
 */
function getHeadcountTrend() {
  const employees = getEmployees();
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
      if (e.status === 'Exited' && e.exitDate) {
        const exitDate = new Date(e.exitDate);
        if (exitDate <= endOfMonth) return false;
      }
      return true;
    }).length;

    return { k: m.label, v: count };
  });
}

/**
 * Attrition by department (TTM)
 */
function getAttritionByDept() {
  const employees = getEmployees();
  const depts = [...new Set(employees.map(e => e.dept))].sort();

  return depts.map(dept => {
    const deptTotal = employees.filter(e => e.dept === dept).length;
    const deptExits = employees.filter(e => e.dept === dept && e.status === 'Exited').length;
    const pct = deptTotal > 0 ? Number(((deptExits / deptTotal) * 100).toFixed(1)) : 0;
    return { k: dept, v: pct };
  });
}

/**
 * Gender mix for active employees
 */
function getGenderMix() {
  const employees = getEmployees();
  const active = employees.filter(e => e.status === 'Active');
  const total = active.length;

  const counts = { Female: 0, Male: 0, 'Non-Binary': 0 };
  active.forEach(e => {
    if (counts[e.gender] !== undefined) counts[e.gender]++;
    else counts['Non-Binary']++;
  });

  // Editorial palette colors: Ink, Terracotta accent, Warm gray
  const colorMap = {
    Female: '#c1521f',      // Terracotta accent
    Male: '#1a1714',        // Deep ink
    'Non-Binary': '#8f887f' // Warm neutral slate
  };

  return Object.keys(counts).map(gender => {
    const pct = Number(((counts[gender] / total) * 100).toFixed(1));
    return {
      label: gender,
      v: pct,
      count: counts[gender],
      c: colorMap[gender] || '#8f887f'
    };
  });
}

module.exports = {
  getEmployees,
  getRequisitions,
  getBudgets,
  getCustomReports,
  saveCustomReport,
  getMeta,
  getKpis,
  getHeadcountTrend,
  getAttritionByDept,
  getGenderMix,
  formatCurrency
};
