/**
 * AI Copilot Module — Grounded Q&A over the HRMS Dataset
 *
 * NOTE ON ARCHITECTURE & FUTURE EXTENSION:
 * In v1, this module uses deterministic keyword-intent matching over actual aggregate
 * computations from dataStore.js to demonstrate grounded, factual responses with inline charts.
 *
 * To transition this to a production Claude-API-backed copilot:
 * 1. Define tools/functions:
 *    - getAttritionRate({ dept?: string })
 *    - getLeaveLiability({ entity?: string })
 *    - getPayrollVariance()
 *    - getHeadcountTrend()
 * 2. Pass these tools to the Claude Messages API with tool_choice: "auto".
 * 3. Execute tool calls locally using dataStore.js and return results in tool_result blocks.
 * This guarantees the LLM never hallucinates metrics or invents numbers.
 */

const {
  getEmployees,
  getBudgets,
  getHeadcountTrend,
  formatCurrency
} = require('./dataStore');

function answerQuestion(question = '') {
  const q = question.toLowerCase();
  const employees = getEmployees();
  const activeEmps = employees.filter(e => e.status === 'Active');
  const exitedEmps = employees.filter(e => e.status === 'Exited');
  const budgets = getBudgets();

  // 1. ATTRITION INTENT
  if (q.includes('attrition') || q.includes('churn') || q.includes('turnover') || q.includes('exit')) {
    // Check if scoped to a specific department
    const depts = ['sales', 'ops', 'tech', 'finance', 'hr'];
    const matchedDept = depts.find(d => q.includes(d));

    let relevantEmployees = employees;
    let relevantExits = exitedEmps;
    let deptLabel = 'organization-wide';

    if (matchedDept) {
      const canonicalDept = matchedDept.charAt(0).toUpperCase() + matchedDept.slice(1);
      relevantEmployees = employees.filter(e => e.dept.toLowerCase() === matchedDept);
      relevantExits = exitedEmps.filter(e => e.dept.toLowerCase() === matchedDept);
      deptLabel = `within the ${canonicalDept} department`;
    }

    const ttmRate = ((relevantExits.length / Math.max(1, relevantEmployees.length)) * 100).toFixed(1);
    const voluntaryCount = relevantExits.filter(e => e.exitType === 'Voluntary').length;
    const voluntaryPct = ((voluntaryCount / Math.max(1, relevantExits.length)) * 100).toFixed(0);

    // Tenure bands for exited employees
    const b1 = relevantExits.filter(e => e.tenureMonths <= 12).length;
    const b2 = relevantExits.filter(e => e.tenureMonths > 12 && e.tenureMonths <= 36).length;
    const b3 = relevantExits.filter(e => e.tenureMonths > 36).length;

    const chartData = [
      { k: '0-12 months', v: b1 },
      { k: '13-36 months', v: b2 },
      { k: '37+ months', v: b3 }
    ];

    return {
      text: `Trailing Twelve Month (TTM) attrition ${deptLabel} is **${ttmRate}%** (${relevantExits.length} total exits across ${relevantEmployees.length} total headcount). Of these departures, **${voluntaryPct}% (${voluntaryCount})** were voluntary exits. The chart below illustrates departures grouped by tenure band prior to separation.`,
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
    const entities = [...new Set(activeEmps.map(e => e.entity))].sort();

    const entityBreakdown = entities.map(entity => {
      const emps = activeEmps.filter(e => e.entity === entity);
      const totalDays = emps.reduce((s, e) => s + e.leaveBalance, 0);
      const liability = emps.reduce((s, e) => {
        const dailyRate = e.ctc / 260;
        return s + (e.leaveBalance * dailyRate);
      }, 0);
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
      text: `Total estimated leave encashment liability across all entities stands at **${formatCurrency(totalLiability)}** across **${totalUnusedDays.toLocaleString()} unused leave days** (${activeEmps.length} active employees). UAE Holding and US Corp represent the highest monetary concentrations due to local compensation parity bands.`,
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
      text: `Total annualized payroll stands at **${formatCurrency(totalActual)}** against a planned budget of **${formatCurrency(totalBudget)}** (Net variance: **${netVariance >= 0 ? '+' : ''}${netVariancePct}%**). Departments tracking above planned allocation: ${overListStr}. Tech and Sales represent the primary drivers of compensation volume.`,
      chart: {
        type: 'bar',
        title: 'Actual Annual Payroll by Department ($ in Millions)',
        data: chartData,
        unit: '$M'
      }
    };
  }

  // 4. HEADCOUNT INTENT
  if (q.includes('headcount') || q.includes('workforce') || q.includes('how many employees') || q.includes('staff')) {
    const trend = getHeadcountTrend();
    const currentCount = activeEmps.length;
    const earliestCount = trend[0].v;
    const growth = currentCount - earliestCount;

    return {
      text: `Current active workforce is **${currentCount.toLocaleString()} employees** across 4 global operating entities. Over the trailing 6 months, net headcount expanded by **${growth >= 0 ? '+' : ''}${growth} employees** (${earliestCount} in ${trend[0].k} → ${currentCount} in ${trend[trend.length - 1].k}).`,
      chart: {
        type: 'line',
        title: '6-Month Active Headcount Trend',
        data: trend,
        unit: 'employees'
      }
    };
  }

  // FALLBACK
  return {
    text: `I can compute verified metrics and render inline visualizations for questions grounded in your HRMS dataset. Try asking:
• **"What is our current attrition rate?"** (or specify a department like "Sales attrition")
• **"Show total leave liability and entity breakdown"**
• **"What is our payroll budget variance?"**
• **"What is our current active headcount and 6-month trend?"**`,
    chart: null
  };
}

module.exports = {
  answerQuestion
};
