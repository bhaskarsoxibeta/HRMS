const { getEmployees, getRequisitions, getBudgets } = require('./dataStore');

/**
 * Report Catalog & Generator Definitions
 */

const REPORT_CATALOG = [
  // 1. Workforce & Headcount
  {
    id: '1',
    cat: 'Workforce & Headcount',
    name: 'Headcount Trend & Movement',
    desc: 'Comprehensive employee roster with date of joining, current employment status, exit date, and organizational hierarchy placement.',
    fmt: 'CSV',
    wired: true,
    generator: () => {
      const employees = getEmployees();
      const columns = [
        { key: 'id', label: 'Employee ID' },
        { key: 'name', label: 'Full Name' },
        { key: 'dept', label: 'Department' },
        { key: 'entity', label: 'Legal Entity' },
        { key: 'location', label: 'Location' },
        { key: 'employmentType', label: 'Employment Type' },
        { key: 'doj', label: 'Date of Joining' },
        { key: 'status', label: 'Status' },
        { key: 'exitDate', label: 'Exit Date' },
        { key: 'tenureMonths', label: 'Tenure (Months)' }
      ];
      return { columns, rows: employees };
    }
  },
  {
    id: '2',
    cat: 'Workforce & Headcount',
    name: 'Attrition Analysis',
    desc: 'Detailed breakdown of all exited personnel including exit classification (Voluntary/Involuntary), completed tenure, and exit timestamp.',
    fmt: 'CSV',
    wired: true,
    generator: () => {
      const employees = getEmployees();
      const exits = employees.filter(e => e.status === 'Exited');
      const columns = [
        { key: 'id', label: 'Employee ID' },
        { key: 'name', label: 'Name' },
        { key: 'dept', label: 'Department' },
        { key: 'entity', label: 'Entity' },
        { key: 'doj', label: 'Date of Joining' },
        { key: 'exitDate', label: 'Exit Date' },
        { key: 'exitType', label: 'Exit Classification' },
        { key: 'tenureMonths', label: 'Tenure (Months)' },
        { key: 'level', label: 'Seniority Level' }
      ];
      return { columns, rows: exits };
    }
  },
  {
    id: '3',
    cat: 'Workforce & Headcount',
    name: 'Diversity & Inclusion Snapshot',
    desc: 'Demographic composition of active workforce across gender, seniority bands, department, and tenure brackets.',
    fmt: 'CSV',
    wired: true,
    generator: () => {
      const employees = getEmployees().filter(e => e.status === 'Active');
      const columns = [
        { key: 'id', label: 'Employee ID' },
        { key: 'name', label: 'Name' },
        { key: 'gender', label: 'Gender' },
        { key: 'level', label: 'Level' },
        { key: 'dept', label: 'Department' },
        { key: 'entity', label: 'Entity' },
        { key: 'tenureMonths', label: 'Tenure (Months)' }
      ];
      return { columns, rows: employees };
    }
  },
  {
    id: '11',
    cat: 'Workforce & Headcount',
    name: 'Span of Control & Org Hierarchy',
    desc: 'Manager-to-direct-report ratios and structural depth analysis across departments.',
    fmt: 'CSV',
    wired: false
  },

  // 2. Recruitment
  {
    id: '4',
    cat: 'Recruitment',
    name: 'Recruitment Funnel & TAT',
    desc: 'Complete requisition log with requisition open dates, fulfillment status, time-to-fill turnaround (TAT), and sourcing channels.',
    fmt: 'CSV',
    wired: true,
    generator: () => {
      const requisitions = getRequisitions();
      const columns = [
        { key: 'id', label: 'Requisition ID' },
        { key: 'dept', label: 'Department' },
        { key: 'entity', label: 'Entity' },
        { key: 'openedDate', label: 'Date Opened' },
        { key: 'status', label: 'Status' },
        { key: 'filledDate', label: 'Date Filled' },
        { key: 'timeToFillDays', label: 'TAT (Days)' },
        { key: 'source', label: 'Source Channel' },
        { key: 'offerAccepted', label: 'Offer Accepted' }
      ];
      return { columns, rows: requisitions };
    }
  },
  {
    id: '5',
    cat: 'Recruitment',
    name: 'Source Effectiveness & Channel ROI',
    desc: 'Aggregated hiring efficiency, total reqs, fulfillment rate, and average time-to-fill categorized by sourcing channel.',
    fmt: 'CSV',
    wired: true,
    generator: () => {
      const requisitions = getRequisitions();
      const sources = [...new Set(requisitions.map(r => r.source))].sort();
      const rows = sources.map(src => {
        const reqs = requisitions.filter(r => r.source === src);
        const filled = reqs.filter(r => r.status === 'Filled');
        const fillRate = ((filled.length / reqs.length) * 100).toFixed(1) + '%';
        const totalTAT = filled.reduce((s, r) => s + (r.timeToFillDays || 0), 0);
        const avgTAT = filled.length > 0 ? (totalTAT / filled.length).toFixed(1) : 'N/A';
        return {
          source: src,
          totalRequisitions: reqs.length,
          filledCount: filled.length,
          fillRate,
          avgTimeToFillDays: avgTAT
        };
      });
      const columns = [
        { key: 'source', label: 'Sourcing Channel' },
        { key: 'totalRequisitions', label: 'Total Requisitions' },
        { key: 'filledCount', label: 'Positions Filled' },
        { key: 'fillRate', label: 'Fulfillment Rate' },
        { key: 'avgTimeToFillDays', label: 'Avg Time to Fill (Days)' }
      ];
      return { columns, rows };
    }
  },
  {
    id: '12',
    cat: 'Recruitment',
    name: 'Offer Acceptance & Decline Reasons',
    desc: 'Granular log of candidate offer declinations with categorized feedback rationale.',
    fmt: 'CSV',
    wired: false
  },

  // 3. Payroll & Compensation
  {
    id: '6',
    cat: 'Payroll & Compensation',
    name: 'CTC Breakup & Cost Analysis',
    desc: 'Departmental payroll budget variance analysis comparing actual annualized CTC commitment versus planned budgetary allocation.',
    fmt: 'CSV',
    wired: true,
    generator: () => {
      const budgets = getBudgets();
      const columns = [
        { key: 'dept', label: 'Department' },
        { key: 'actualCTC', label: 'Actual CTC ($)' },
        { key: 'budgetedCTC', label: 'Budgeted CTC ($)' },
        { key: 'varianceCTC', label: 'Variance ($)' },
        { key: 'variancePct', label: 'Variance (%)' }
      ];
      return { columns, rows: budgets };
    }
  },
  {
    id: '7',
    cat: 'Payroll & Compensation',
    name: 'Pay Equity & Level Compensation Matrix',
    desc: 'Gender pay parity audit analyzing average annual CTC by seniority level and gender group with calculated parity gap percentage.',
    fmt: 'CSV',
    wired: true,
    generator: () => {
      const employees = getEmployees().filter(e => e.status === 'Active');
      const levels = [1, 2, 3, 4, 5];
      const rows = levels.map(lvl => {
        const lvlEmps = employees.filter(e => e.level === lvl);
        const maleEmps = lvlEmps.filter(e => e.gender === 'Male');
        const femaleEmps = lvlEmps.filter(e => e.gender === 'Female');
        
        const avgMale = maleEmps.length > 0 ? Math.round(maleEmps.reduce((s, e) => s + e.ctc, 0) / maleEmps.length) : 0;
        const avgFemale = femaleEmps.length > 0 ? Math.round(femaleEmps.reduce((s, e) => s + e.ctc, 0) / femaleEmps.length) : 0;
        
        const gapPct = avgMale > 0 ? (((avgMale - avgFemale) / avgMale) * 100).toFixed(1) + '%' : '0.0%';
        
        return {
          level: `Level ${lvl}`,
          headcount: lvlEmps.length,
          avgMaleCTC: avgMale ? `$${avgMale.toLocaleString()}` : 'N/A',
          avgFemaleCTC: avgFemale ? `$${avgFemale.toLocaleString()}` : 'N/A',
          payGapPct: gapPct
        };
      });
      const columns = [
        { key: 'level', label: 'Seniority Level' },
        { key: 'headcount', label: 'Active Headcount' },
        { key: 'avgMaleCTC', label: 'Avg Male CTC' },
        { key: 'avgFemaleCTC', label: 'Avg Female CTC' },
        { key: 'payGapPct', label: 'Pay Gap (%)' }
      ];
      return { columns, rows };
    }
  },
  {
    id: '13',
    cat: 'Payroll & Compensation',
    name: 'Statutory Contribution Summary',
    desc: 'Audit of PF, pension, health contributions and withholding tax by legal entity.',
    fmt: 'CSV',
    wired: false
  },

  // 4. Attendance & Leave
  {
    id: '8',
    cat: 'Attendance & Leave',
    name: 'Leave Liability Report',
    desc: 'Financial accrual report estimating unutilized earned leave liability encashment value across all legal operating entities.',
    fmt: 'CSV',
    wired: true,
    generator: () => {
      const employees = getEmployees().filter(e => e.status === 'Active');
      const entities = [...new Set(employees.map(e => e.entity))].sort();
      
      const rows = entities.map(entity => {
        const entityEmps = employees.filter(e => e.entity === entity);
        const totalLeaveBalance = entityEmps.reduce((s, e) => s + e.leaveBalance, 0);
        const totalLiability = Math.round(entityEmps.reduce((s, e) => {
          const dailyRate = e.ctc / 260;
          return s + (e.leaveBalance * dailyRate);
        }, 0));
        
        return {
          entity,
          activeHeadcount: entityEmps.length,
          totalUnusedDays: totalLeaveBalance,
          avgDaysPerEmployee: (totalLeaveBalance / entityEmps.length).toFixed(1),
          totalLiabilityCost: `$${totalLiability.toLocaleString()}`
        };
      });
      const columns = [
        { key: 'entity', label: 'Legal Entity' },
        { key: 'activeHeadcount', label: 'Active Headcount' },
        { key: 'totalUnusedDays', label: 'Total Unused Days' },
        { key: 'avgDaysPerEmployee', label: 'Avg Days / Emp' },
        { key: 'totalLiabilityCost', label: 'Estimated Liability ($)' }
      ];
      return { columns, rows };
    }
  },
  {
    id: '9',
    cat: 'Attendance & Leave',
    name: 'Absenteeism & Attendance Trend',
    desc: 'Employee-level log of working days present, leave consumed, overtime hours logged, and late arrival records.',
    fmt: 'CSV',
    wired: true,
    generator: () => {
      const employees = getEmployees().filter(e => e.status === 'Active');
      const columns = [
        { key: 'id', label: 'Employee ID' },
        { key: 'name', label: 'Full Name' },
        { key: 'dept', label: 'Department' },
        { key: 'daysPresent', label: 'Days Present' },
        { key: 'leaveTaken', label: 'Leave Taken' },
        { key: 'leaveBalance', label: 'Leave Balance' },
        { key: 'otHours', label: 'Overtime Hours' },
        { key: 'lateMarks', label: 'Late Marks' }
      ];
      return { columns, rows: employees };
    }
  },
  {
    id: '14',
    cat: 'Attendance & Leave',
    name: 'Overtime Trend & Burnout Risk',
    desc: 'Monthly tracking of high-overtime pods with potential fatigue flags.',
    fmt: 'CSV',
    wired: false
  },

  // 5. Performance
  {
    id: '10',
    cat: 'Performance',
    name: 'Appraisal Cycle Completion',
    desc: 'Audit roster of employee annual performance reviews, latest numerical rating, target goal attainment %, and last appraisal timestamp.',
    fmt: 'CSV',
    wired: true,
    generator: () => {
      const employees = getEmployees().filter(e => e.status === 'Active');
      const columns = [
        { key: 'id', label: 'Employee ID' },
        { key: 'name', label: 'Full Name' },
        { key: 'dept', label: 'Department' },
        { key: 'level', label: 'Level' },
        { key: 'rating', label: 'Latest Rating' },
        { key: 'goalsCompleted', label: 'Goals Completed (%)' },
        { key: 'lastReviewDate', label: 'Last Review Date' }
      ];
      return { columns, rows: employees };
    }
  },
  {
    id: '15',
    cat: 'Performance',
    name: 'Rating Distribution & 9-Box Grid',
    desc: 'Performance vs Potential talent matrix distribution per business unit.',
    fmt: 'CSV',
    wired: false
  },

  // 6. Compliance & Statutory
  {
    id: '16',
    cat: 'Compliance & Statutory',
    name: 'POSH Case Register & Compliance Audit',
    desc: 'Confidential tracking log for internal complaints committee cases and statutory filings.',
    fmt: 'CSV',
    wired: false
  },
  {
    id: '17',
    cat: 'Compliance & Statutory',
    name: 'Audit Trail & Access Log',
    desc: 'System event log monitoring HRIS privilege elevation and sensitive data views.',
    fmt: 'CSV',
    wired: false
  },

  // 7. Learning & Development
  {
    id: '18',
    cat: 'Learning & Development',
    name: 'Training Hours & Completion Rate',
    desc: 'Tracking of mandatory compliance and technical skill development modules.',
    fmt: 'CSV',
    wired: false
  },
  {
    id: '19',
    cat: 'Learning & Development',
    name: 'Skill Gap Heatmap by Role',
    desc: 'Competency assessment matrix identifying organizational technical capabilities.',
    fmt: 'CSV',
    wired: false
  },

  // 8. Employee Experience
  {
    id: '20',
    cat: 'Employee Experience',
    name: 'Engagement Survey Results (eNPS)',
    desc: 'Quarterly pulse survey sentiment score by team, tenure, and office location.',
    fmt: 'CSV',
    wired: false
  },
  {
    id: '21',
    cat: 'Employee Experience',
    name: 'Exit Interview Themes & Root Cause',
    desc: 'Qualitative exit interview sentiment aggregation and retention friction points.',
    fmt: 'CSV',
    wired: false
  }
];

function getReportCatalog(category = 'All') {
  return REPORT_CATALOG.map(r => ({
    id: r.id,
    cat: r.cat,
    name: r.name,
    desc: r.desc,
    fmt: r.fmt,
    wired: r.wired
  })).filter(r => {
    if (!category || category === 'All') return true;
    return r.cat.toLowerCase() === category.toLowerCase();
  });
}

function getReportById(id) {
  return REPORT_CATALOG.find(r => r.id === String(id));
}

module.exports = {
  REPORT_CATALOG,
  getReportCatalog,
  getReportById
};
