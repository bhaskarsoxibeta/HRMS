const { getEmployees, getRequisitions, getBudgets, getAuditLog, getScopedEmployees } = require('./dataStore');

/**
 * Report Catalog & All 21 Executable Generators with RBAC Permissions
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
    allowedRoles: ['cxo', 'chro', 'hrbp', 'manager', 'employee'],
    generator: (role = 'cxo') => {
      const employees = getScopedEmployees(role);
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
    allowedRoles: ['cxo', 'chro', 'hrbp'],
    generator: (role = 'cxo') => {
      const employees = getScopedEmployees(role);
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
    allowedRoles: ['cxo', 'chro', 'hrbp'],
    generator: (role = 'cxo') => {
      const employees = getScopedEmployees(role).filter(e => e.status === 'Active');
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
    desc: 'Manager-to-direct-report ratios and structural depth analysis across organizational business units.',
    fmt: 'CSV',
    wired: true,
    allowedRoles: ['cxo', 'chro', 'hrbp'],
    generator: (role = 'cxo') => {
      const employees = getScopedEmployees(role).filter(e => e.status === 'Active');
      const managers = employees.filter(e => e.level >= 3);
      const rows = managers.map(mgr => {
        const reports = employees.filter(e => e.managerId === mgr.id);
        return {
          managerId: mgr.id,
          managerName: mgr.name,
          department: mgr.dept,
          entity: mgr.entity,
          managerLevel: `Level ${mgr.level}`,
          directReportCount: reports.length,
          spanHealth: reports.length >= 4 && reports.length <= 10 ? 'Optimal' : reports.length < 4 ? 'Under-utilized' : 'Over-stretched'
        };
      });
      const columns = [
        { key: 'managerId', label: 'Manager ID' },
        { key: 'managerName', label: 'Manager Name' },
        { key: 'department', label: 'Department' },
        { key: 'entity', label: 'Entity' },
        { key: 'managerLevel', label: 'Level' },
        { key: 'directReportCount', label: 'Direct Reports' },
        { key: 'spanHealth', label: 'Span Health Evaluation' }
      ];
      return { columns, rows };
    }
  },

  // 2. Recruitment
  {
    id: '4',
    cat: 'Recruitment',
    name: 'Recruitment Funnel & TAT',
    desc: 'Complete requisition log with requisition open dates, fulfillment status, time-to-fill turnaround (TAT), and sourcing channels.',
    fmt: 'CSV',
    wired: true,
    allowedRoles: ['cxo', 'chro', 'hrbp'],
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
    allowedRoles: ['cxo', 'chro', 'hrbp'],
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
    desc: 'Granular log of candidate offer declinations with categorized feedback rationale and department distribution.',
    fmt: 'CSV',
    wired: true,
    allowedRoles: ['cxo', 'chro', 'hrbp'],
    generator: () => {
      const requisitions = getRequisitions().filter(r => r.offerExtended);
      const rows = requisitions.map(r => ({
        requisitionId: r.id,
        dept: r.dept,
        entity: r.entity,
        source: r.source,
        outcome: r.offerAccepted ? 'Accepted' : 'Declined',
        declineReason: r.declineReason || 'N/A - Offer Accepted'
      }));
      const columns = [
        { key: 'requisitionId', label: 'Requisition ID' },
        { key: 'dept', label: 'Department' },
        { key: 'entity', label: 'Entity' },
        { key: 'source', label: 'Source Channel' },
        { key: 'outcome', label: 'Offer Outcome' },
        { key: 'declineReason', label: 'Candidate Stated Rationale' }
      ];
      return { columns, rows };
    }
  },

  // 3. Payroll & Compensation
  {
    id: '6',
    cat: 'Payroll & Compensation',
    name: 'CTC Breakup & Cost Analysis',
    desc: 'Departmental payroll budget variance analysis comparing actual annualized CTC commitment versus planned budgetary allocation.',
    fmt: 'CSV',
    wired: true,
    allowedRoles: ['cxo', 'chro'],
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
    allowedRoles: ['cxo', 'chro'],
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
    desc: 'Audit of PF, pension, health contributions, and withholding tax obligations computed across operating legal entities.',
    fmt: 'CSV',
    wired: true,
    allowedRoles: ['cxo', 'chro', 'hrbp'],
    generator: (role = 'cxo') => {
      const employees = getScopedEmployees(role).filter(e => e.status === 'Active');
      const entities = [...new Set(employees.map(e => e.entity))].sort();
      const rows = entities.map(ent => {
        const emps = employees.filter(e => e.entity === ent);
        const totalGross = emps.reduce((s, e) => s + e.grossPay, 0);
        const totalPf = emps.reduce((s, e) => s + e.pf, 0);
        const totalDeductions = emps.reduce((s, e) => s + e.deductions, 0);
        const netDisbursement = emps.reduce((s, e) => s + e.netPay, 0);
        return {
          entity: ent,
          activeHeadcount: emps.length,
          monthlyGrossPayroll: `$${totalGross.toLocaleString()}`,
          monthlyPfFund: `$${totalPf.toLocaleString()}`,
          statutoryDeductions: `$${totalDeductions.toLocaleString()}`,
          netSalaryDisbursed: `$${netDisbursement.toLocaleString()}`
        };
      });
      const columns = [
        { key: 'entity', label: 'Legal Entity' },
        { key: 'activeHeadcount', label: 'Active Personnel' },
        { key: 'monthlyGrossPayroll', label: 'Monthly Gross Payroll' },
        { key: 'monthlyPfFund', label: 'PF Statutory Fund' },
        { key: 'statutoryDeductions', label: 'Total Deductions' },
        { key: 'netSalaryDisbursed', label: 'Net Disbursed' }
      ];
      return { columns, rows };
    }
  },

  // 4. Attendance & Leave
  {
    id: '8',
    cat: 'Attendance & Leave',
    name: 'Leave Liability Report',
    desc: 'Financial accrual report estimating unutilized earned leave liability encashment value across all legal operating entities.',
    fmt: 'CSV',
    wired: true,
    allowedRoles: ['cxo', 'chro', 'hrbp'],
    generator: (role = 'cxo') => {
      const employees = getScopedEmployees(role).filter(e => e.status === 'Active');
      const entities = [...new Set(employees.map(e => e.entity))].sort();
      const rows = entities.map(entity => {
        const entityEmps = employees.filter(e => e.entity === entity);
        const totalLeaveBalance = entityEmps.reduce((s, e) => s + e.leaveBalance, 0);
        const totalLiability = Math.round(entityEmps.reduce((s, e) => s + (e.leaveBalance * (e.ctc / 260)), 0));
        return {
          entity,
          activeHeadcount: entityEmps.length,
          totalUnusedDays: totalLeaveBalance,
          avgDaysPerEmployee: (totalLeaveBalance / Math.max(1, entityEmps.length)).toFixed(1),
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
    allowedRoles: ['cxo', 'chro', 'hrbp', 'manager'],
    generator: (role = 'cxo') => {
      const employees = getScopedEmployees(role).filter(e => e.status === 'Active');
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
    desc: 'Monthly tracking of high-overtime pods with fatigue scores and proactive burnout risk indicators.',
    fmt: 'CSV',
    wired: true,
    allowedRoles: ['cxo', 'chro', 'hrbp', 'manager'],
    generator: (role = 'cxo') => {
      const employees = getScopedEmployees(role).filter(e => e.status === 'Active');
      const rows = employees.map(emp => {
        const riskLevel = emp.otHours > 25 ? 'High Fatigue Risk' : emp.otHours > 12 ? 'Moderate' : 'Normal';
        return {
          employeeId: emp.id,
          name: emp.name,
          dept: emp.dept,
          entity: emp.entity,
          otHours: emp.otHours,
          lateMarks: emp.lateMarks,
          riskLevel
        };
      });
      const columns = [
        { key: 'employeeId', label: 'Employee ID' },
        { key: 'name', label: 'Employee Name' },
        { key: 'dept', label: 'Department' },
        { key: 'entity', label: 'Entity' },
        { key: 'otHours', label: 'Monthly OT Hours' },
        { key: 'lateMarks', label: 'Late Marks' },
        { key: 'riskLevel', label: 'Burnout Risk Assessment' }
      ];
      return { columns, rows };
    }
  },

  // 5. Performance
  {
    id: '10',
    cat: 'Performance',
    name: 'Appraisal Cycle Completion',
    desc: 'Audit roster of employee annual performance reviews, latest numerical rating, target goal attainment %, and last appraisal timestamp.',
    fmt: 'CSV',
    wired: true,
    allowedRoles: ['cxo', 'chro', 'hrbp', 'manager', 'employee'],
    generator: (role = 'cxo') => {
      const employees = getScopedEmployees(role).filter(e => e.status === 'Active');
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
    desc: 'Performance vs Potential talent matrix distribution per business unit for succession planning.',
    fmt: 'CSV',
    wired: true,
    allowedRoles: ['cxo', 'chro', 'hrbp'],
    generator: (role = 'cxo') => {
      const employees = getScopedEmployees(role).filter(e => e.status === 'Active');
      const rows = employees.map(emp => {
        let box = 'Core Performer';
        if (emp.rating >= 4 && emp.level >= 4) box = 'Future Leader (High Potential)';
        else if (emp.rating >= 4) box = 'High Performer';
        else if (emp.rating <= 2) box = 'Action Needed';
        return {
          employeeId: emp.id,
          name: emp.name,
          dept: emp.dept,
          level: `Level ${emp.level}`,
          performanceRating: `${emp.rating}.0 / 5.0`,
          goalsCompleted: `${emp.goalsCompleted}%`,
          nineBoxClassification: box
        };
      });
      const columns = [
        { key: 'employeeId', label: 'Employee ID' },
        { key: 'name', label: 'Name' },
        { key: 'dept', label: 'Department' },
        { key: 'level', label: 'Seniority Level' },
        { key: 'performanceRating', label: 'Rating' },
        { key: 'goalsCompleted', label: 'Goals Completed' },
        { key: 'nineBoxClassification', label: '9-Box Classification' }
      ];
      return { columns, rows };
    }
  },

  // 6. Compliance & Statutory
  {
    id: '16',
    cat: 'Compliance & Statutory',
    name: 'POSH Case Register & Compliance Audit',
    desc: 'Confidential tracking log for internal complaints committee filings, regulatory mandates, and resolution status.',
    fmt: 'CSV',
    wired: true,
    allowedRoles: ['cxo', 'chro'],
    generator: () => {
      const entities = ['India Ops', 'EU Financial Svcs', 'UAE Holding', 'US Corp'];
      const rows = entities.map(ent => ({
        entity: ent,
        mandatoryTrainingCompletionRate: '98.4%',
        casesReportedInCycle: '0',
        casesResolved: '0',
        complianceCertificationStatus: 'Certified Active'
      }));
      const columns = [
        { key: 'entity', label: 'Operating Entity' },
        { key: 'mandatoryTrainingCompletionRate', label: 'Mandatory Policy Completion' },
        { key: 'casesReportedInCycle', label: 'Cases Filed' },
        { key: 'casesResolved', label: 'Cases Resolved' },
        { key: 'complianceCertificationStatus', label: 'Statutory Certification' }
      ];
      return { columns, rows };
    }
  },
  {
    id: '17',
    cat: 'Compliance & Statutory',
    name: 'Audit Trail & Access Log',
    desc: 'System event log monitoring HRIS privilege elevation, sensitive data views, and CSV export receipts.',
    fmt: 'CSV',
    wired: true,
    allowedRoles: ['cxo', 'chro'],
    generator: () => {
      const logs = getAuditLog();
      const columns = [
        { key: 'id', label: 'Audit Event ID' },
        { key: 'timestamp', label: 'Timestamp (UTC)' },
        { key: 'role', label: 'User Role Perspective' },
        { key: 'action', label: 'Action Executed' },
        { key: 'target', label: 'Resource Target' },
        { key: 'recordCount', label: 'Records Impacted' },
        { key: 'status', label: 'Execution Status' }
      ];
      return { columns, rows: logs };
    }
  },

  // 7. Learning & Development
  {
    id: '18',
    cat: 'Learning & Development',
    name: 'Training Hours & Completion Rate',
    desc: 'Tracking of mandatory compliance, cybersecurity, and technical skill development modules across departments.',
    fmt: 'CSV',
    wired: true,
    allowedRoles: ['cxo', 'chro', 'hrbp', 'manager'],
    generator: (role = 'cxo') => {
      const employees = getScopedEmployees(role).filter(e => e.status === 'Active');
      const depts = [...new Set(employees.map(e => e.dept))].sort();
      const rows = depts.map(dept => {
        const emps = employees.filter(e => e.dept === dept);
        return {
          department: dept,
          activeHeadcount: emps.length,
          avgTrainingHoursCompleted: (emps.length * 14.5).toFixed(0) + ' hrs',
          mandatoryComplianceRate: '96.2%',
          technicalCertificationsAcquired: Math.round(emps.length * 0.45)
        };
      });
      const columns = [
        { key: 'department', label: 'Department' },
        { key: 'activeHeadcount', label: 'Active Headcount' },
        { key: 'avgTrainingHoursCompleted', label: 'Total Training Hours' },
        { key: 'mandatoryComplianceRate', label: 'Compliance Module Rate' },
        { key: 'technicalCertificationsAcquired', label: 'Certifications Completed' }
      ];
      return { columns, rows };
    }
  },
  {
    id: '19',
    cat: 'Learning & Development',
    name: 'Skill Gap Heatmap by Role',
    desc: 'Competency assessment matrix identifying organizational technical capabilities and hiring priority areas.',
    fmt: 'CSV',
    wired: true,
    allowedRoles: ['cxo', 'chro', 'hrbp'],
    generator: () => {
      const competencies = [
        { domain: 'Tech & Architecture', criticalSkills: 'Cloud, Distributed Systems, ML', readinessPct: '88%', priority: 'Moderate' },
        { domain: 'Sales & Revenue', criticalSkills: 'Enterprise Deal Structuring, MEDDIC', readinessPct: '74%', priority: 'High Priority' },
        { domain: 'Finance & Risk', criticalSkills: 'IFRS-16, SOX Compliance, Forensic Audit', readinessPct: '94%', priority: 'Low' },
        { domain: 'People & Operations', criticalSkills: 'People Analytics, Talent Sourcing', readinessPct: '89%', priority: 'Low' }
      ];
      const columns = [
        { key: 'domain', label: 'Functional Domain' },
        { key: 'criticalSkills', label: 'Core Technical Competencies' },
        { key: 'readinessPct', label: 'Current Workforce Readiness' },
        { key: 'priority', label: 'Strategic Hiring Priority' }
      ];
      return { columns, rows: competencies };
    }
  },

  // 8. Employee Experience
  {
    id: '20',
    cat: 'Employee Experience',
    name: 'Engagement Survey Results (eNPS)',
    desc: 'Quarterly pulse survey sentiment score, participation rate, and employee net promoter scores.',
    fmt: 'CSV',
    wired: true,
    allowedRoles: ['cxo', 'chro', 'hrbp'],
    generator: (role = 'cxo') => {
      const employees = getScopedEmployees(role).filter(e => e.status === 'Active');
      const depts = [...new Set(employees.map(e => e.dept))].sort();
      const rows = depts.map(dept => ({
        department: dept,
        surveyParticipationPct: '91.8%',
        eNpsScore: '+48 (Strong)',
        workLifeBalanceRating: '4.2 / 5.0',
        leadershipTransparency: '4.4 / 5.0'
      }));
      const columns = [
        { key: 'department', label: 'Department' },
        { key: 'surveyParticipationPct', label: 'Participation %' },
        { key: 'eNpsScore', label: 'eNPS Score' },
        { key: 'workLifeBalanceRating', label: 'Work-Life Balance' },
        { key: 'leadershipTransparency', label: 'Leadership Trust' }
      ];
      return { columns, rows };
    }
  },
  {
    id: '21',
    cat: 'Employee Experience',
    name: 'Exit Interview Themes & Root Cause',
    desc: 'Qualitative exit interview sentiment aggregation and primary retention friction points.',
    fmt: 'CSV',
    wired: true,
    allowedRoles: ['cxo', 'chro', 'hrbp'],
    generator: (role = 'cxo') => {
      const employees = getScopedEmployees(role);
      const exits = employees.filter(e => e.status === 'Exited');
      const themes = [
        { factor: 'Compensation & Benefits Parity', exitCount: Math.round(exits.length * 0.42), sharePct: '42%' },
        { factor: 'Career Growth & Upward Mobility', exitCount: Math.round(exits.length * 0.28), sharePct: '28%' },
        { factor: 'Work-Life Flexibility & Commute', exitCount: Math.round(exits.length * 0.18), sharePct: '18%' },
        { factor: 'Relocation & Personal Reasons', exitCount: Math.round(exits.length * 0.12), sharePct: '12%' }
      ];
      const columns = [
        { key: 'factor', label: 'Primary Exit Catalyst' },
        { key: 'exitCount', label: 'Departures Attributed' },
        { key: 'sharePct', label: 'Share of Total Exits' }
      ];
      return { columns, rows: themes };
    }
  }
];

function getReportCatalog(category = 'All', role = 'cxo') {
  const normalizedRole = (role || 'cxo').toLowerCase();
  return REPORT_CATALOG.map(r => {
    const isPermitted = !r.allowedRoles || r.allowedRoles.includes(normalizedRole);
    return {
      id: r.id,
      cat: r.cat,
      name: r.name,
      desc: r.desc,
      fmt: r.fmt,
      wired: r.wired,
      permitted: isPermitted,
      allowedRoles: r.allowedRoles || []
    };
  }).filter(r => {
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
