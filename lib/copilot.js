/**
 * AI Copilot Module — Grounded Q&A over the HRMS Dataset with Role Permissions
 */

const {
  getEmployees,
  getBudgets,
  getHeadcountTrend,
  getScopedEmployees,
  logAuditEvent,
  formatCurrency
} = require('./dataStore');

function answerQuestion(question = '', role = 'cxo') {
  const q = question.toLowerCase();
  const normalizedRole = (role || 'cxo').toLowerCase();
  const employees = getScopedEmployees(role);
  const activeEmps = employees.filter(e => e.status === 'Active');
  const exitedEmps = employees.filter(e => e.status === 'Exited');
  const budgets = getBudgets();

  // Log Copilot Query
  logAuditEvent({
    role: normalizedRole,
    action: 'COPILOT_QUERY',
    target: question.substring(0, 60),
    recordCount: 1,
    status: 'SUCCESS'
  });

  // RBAC PERMISSION CHECK: Employees cannot query enterprise compensation or global attrition
  if (normalizedRole === 'employee') {
    if (q.includes('payroll') || q.includes('budget') || q.includes('salary') || q.includes('ctc') || q.includes('compensation') || q.includes('attrition') || q.includes('all employees')) {
      return {
        text: `🔒 **Permission Scope Notice (ESS Mode):** Your active role is **Employee Self-Service (ESS)**. Confidential enterprise compensation budgets and organization-wide attrition analytics are restricted to HRBP and Executive roles. 

As an Employee, you can query your own personal metrics:
• **"What is my available leave balance and leave taken?"**
• **"What is my latest performance rating and goals completed?"**
• **"Show my monthly net take-home pay"**`,
        chart: null
      };
    }
  }

  // 1. ATTRITION INTENT
  if (q.includes('attrition') || q.includes('churn') || q.includes('turnover') || q.includes('exit')) {
    const depts = ['sales', 'ops', 'tech', 'finance', 'hr'];
    const matchedDept = depts.find(d => q.includes(d));

    let relevantEmployees = employees;
    let relevantExits = exitedEmps;
    let deptLabel = normalizedRole === 'hrbp' ? 'within Sales (your assigned department)' : 'organization-wide';

    if (matchedDept && normalizedRole !== 'hrbp') {
      const canonicalDept = matchedDept.charAt(0).toUpperCase() + matchedDept.slice(1);
      relevantEmployees = employees.filter(e => e.dept.toLowerCase() === matchedDept);
      relevantExits = exitedEmps.filter(e => e.dept.toLowerCase() === matchedDept);
      deptLabel = `within the ${canonicalDept} department`;
    }

    const ttmRate = ((relevantExits.length / Math.max(1, relevantEmployees.length)) * 100).toFixed(1);
    const voluntaryCount = relevantExits.filter(e => e.exitType === 'Voluntary').length;
    const voluntaryPct = ((voluntaryCount / Math.max(1, relevantExits.length)) * 100).toFixed(0);

    const b1 = relevantExits.filter(e => e.tenureMonths <= 12).length;
    const b2 = relevantExits.filter(e => e.tenureMonths > 12 && e.tenureMonths <= 36).length;
    const b3 = relevantExits.filter(e => e.tenureMonths > 36).length;

    const chartData = [
      { k: '0-12 months', v: b1 },
      { k: '13-36 months', v: b2 },
      { k: '37+ months', v: b3 }
    ];

    return {
      text: `Trailing Twelve Month (TTM) attrition ${deptLabel} is **${ttmRate}%** (${relevantExits.length} total exits across ${relevantEmployees.length} total personnel). Of these departures, **${voluntaryPct}% (${voluntaryCount})** were voluntary exits. The chart below illustrates departures grouped by tenure band prior to separation.`,
      chart: {
        type: 'bar',
        title: 'Exits by Tenure Band',
        data: chartData,
        unit: 'exits'
      }
    };
  }

  // 2. LEAVE LIABILITY INTENT
  if ((q.includes('leave') && q.includes('liability')) || q.includes('encashment') || q.includes('leave balance')) {
    if (normalizedRole === 'employee') {
      const emp = activeEmps[0];
      return {
        text: `Your current available leave balance is **${emp.leaveBalance} days** (with **${emp.leaveTaken} days** utilized this calendar year). Your days present for this cycle stand at **${emp.daysPresent} days** with ${emp.otHours} overtime hours logged.`,
        chart: null
      };
    }

    const entities = [...new Set(activeEmps.map(e => e.entity))].sort();
    const entityBreakdown = entities.map(entity => {
      const emps = activeEmps.filter(e => e.entity === entity);
      const totalDays = emps.reduce((s, e) => s + e.leaveBalance, 0);
      const liability = emps.reduce((s, e) => s + (e.leaveBalance * (e.ctc / 260)), 0);
      return {
        entity,
        headcount: emps.length,
        totalDays,
        liability: Math.round(liability)
      };
    });

    const totalLiability = entityBreakdown.reduce((s, item) => s + item.liability, 0);
    const totalUnusedDays = entityBreakdown.reduce((s, item) => s + item.totalDays, 0);

    const chartData = entityBreakdown.map(e => ({
      k: e.entity,
      v: Math.round(e.liability / 1000)
    }));

    return {
      text: `Total estimated leave encashment liability for your active scope stands at **${formatCurrency(totalLiability)}** across **${totalUnusedDays.toLocaleString()} unused leave days** (${activeEmps.length} active personnel).`,
      chart: {
        type: 'bar',
        title: 'Leave Liability by Legal Entity ($ in Thousands)',
        data: chartData,
        unit: '$k'
      }
    };
  }

  // 3. PAYROLL & BUDGET VARIANCE INTENT
  if (q.includes('payroll') || q.includes('budget') || q.includes('variance') || q.includes('compensation cost') || q.includes('over budget')) {
    if (normalizedRole === 'manager') {
      return {
        text: `🔒 **Permission Scope Notice (Manager Role):** Direct compensation budget comparisons are restricted to CHRO and CXO executive roles. For your pod of ${activeEmps.length} direct reports, all attendance, appraisal completion, and leave utilization metrics are fully accessible.`,
        chart: null
      };
    }

    const overBudgetDepts = budgets.filter(b => b.varianceCTC > 0);
    const totalActual = budgets.reduce((s, b) => s + b.actualCTC, 0);
    const totalBudget = budgets.reduce((s, b) => s + b.budgetedCTC, 0);
    const netVariance = totalActual - totalBudget;
    const netVariancePct = (((netVariance) / totalBudget) * 100).toFixed(1);

    const overListStr = overBudgetDepts.length > 0
      ? overBudgetDepts.map(b => `**${b.dept}** (+${b.variancePct}%, +${formatCurrency(b.varianceCTC)})`).join(', ')
      : 'None';

    const chartData = budgets.map(b => ({
      k: b.dept,
      v: Math.round(b.actualCTC / 1000000)
    }));

    return {
      text: `Total annualized payroll stands at **${formatCurrency(totalActual)}** against a planned budget of **${formatCurrency(totalBudget)}** (Net variance: **${netVariance >= 0 ? '+' : ''}${netVariancePct}%**). Departments tracking above planned allocation: ${overListStr}.`,
      chart: {
        type: 'bar',
        title: 'Actual Annual Payroll by Department ($ in Millions)',
        data: chartData,
        unit: '$M'
      }
    };
  }

  // 4. HEADCOUNT INTENT
  if (q.includes('headcount') || q.includes('workforce') || q.includes('how many employees') || q.includes('staff') || q.includes('team size')) {
    const trend = getHeadcountTrend(role);
    const currentCount = activeEmps.length;
    const earliestCount = trend[0].v;
    const growth = currentCount - earliestCount;

    return {
      text: `Current active workforce for role perspective (${normalizedRole.toUpperCase()}) is **${currentCount.toLocaleString()} personnel**. Over the trailing 6 months, net headcount shifted by **${growth >= 0 ? '+' : ''}${growth}** (${earliestCount} in ${trend[0].k} → ${currentCount} in ${trend[trend.length - 1].k}).`,
      chart: {
        type: 'line',
        title: '6-Month Scoped Headcount Trend',
        data: trend,
        unit: 'personnel'
      }
    };
  }

  // FALLBACK
  return {
    text: `I can compute verified metrics and render inline visualizations for questions grounded in your HRMS dataset. Supported queries:
• **"What is our current attrition rate?"**
• **"Show total leave liability and entity breakdown"**
• **"What is our payroll budget variance?"**
• **"What is our current active headcount and 6-month trend?"**`,
    chart: null
  };
}

module.exports = {
  answerQuestion
};
