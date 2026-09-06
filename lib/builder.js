const { getScopedEmployees, getCustomReports, saveCustomReport, logAuditEvent } = require('./dataStore');
const { toCsv } = require('./csv');

const FIELD_CATALOG = {
  Employee: [
    { key: 'id', label: 'Employee ID' },
    { key: 'name', label: 'Full Name' },
    { key: 'dept', label: 'Department' },
    { key: 'entity', label: 'Entity' },
    { key: 'location', label: 'Location' },
    { key: 'doj', label: 'Date of Joining' },
    { key: 'employmentType', label: 'Employment Type' }
  ],
  Payroll: [
    { key: 'grossPay', label: 'Gross Pay ($)' },
    { key: 'netPay', label: 'Net Pay ($)' },
    { key: 'ctc', label: 'Annual CTC ($)' },
    { key: 'deductions', label: 'Deductions ($)' },
    { key: 'pf', label: 'PF Contribution ($)' },
    { key: 'costCenter', label: 'Cost Center' }
  ],
  Attendance: [
    { key: 'daysPresent', label: 'Days Present' },
    { key: 'leaveTaken', label: 'Leave Taken (Days)' },
    { key: 'leaveBalance', label: 'Leave Balance (Days)' },
    { key: 'otHours', label: 'OT Hours' },
    { key: 'lateMarks', label: 'Late Marks' }
  ],
  Performance: [
    { key: 'rating', label: 'Latest Rating' },
    { key: 'goalsCompleted', label: 'Goals Completed (%)' },
    { key: 'lastReviewDate', label: 'Last Review Date' }
  ]
};

// Flattened field map for fast label lookup
const ALL_FIELDS_MAP = {};
Object.values(FIELD_CATALOG).forEach(group => {
  group.forEach(f => {
    ALL_FIELDS_MAP[f.key] = f.label;
  });
});

/**
 * Filter available fields by role permissions (RBAC)
 */
function getFieldCatalogForRole(role = 'cxo') {
  const r = (role || 'cxo').toLowerCase();
  // Employees and Line Managers are restricted from viewing executive payroll
  if (r === 'employee' || r === 'manager') {
    return {
      Employee: FIELD_CATALOG.Employee,
      Attendance: FIELD_CATALOG.Attendance,
      Performance: FIELD_CATALOG.Performance
    };
  }
  return FIELD_CATALOG;
}

/**
 * Executes a custom query against role-scoped employees dataset
 */
function runQuery(selectedFields = [], filters = {}, role = 'cxo') {
  const employees = getScopedEmployees(role);
  const r = (role || 'cxo').toLowerCase();

  // If no fields selected, default to a sensible set
  let fields = (selectedFields && selectedFields.length > 0)
    ? selectedFields
    : ['id', 'name', 'dept', 'entity', 'employmentType', 'ctc'];

  // Mask payroll fields for non-executives
  if (r === 'employee' || r === 'manager') {
    const sensitive = ['ctc', 'grossPay', 'deductions', 'pf'];
    fields = fields.filter(f => !sensitive.includes(f));
  }

  const columns = fields.map(key => ({
    key,
    label: ALL_FIELDS_MAP[key] || key
  }));

  // Apply filters
  let filtered = employees.filter(emp => {
    if (filters.entity && filters.entity !== 'All' && emp.entity !== filters.entity) {
      return false;
    }
    if (filters.dept && filters.dept !== 'All' && emp.dept !== filters.dept) {
      return false;
    }
    if (filters.employmentType && filters.employmentType !== 'All' && emp.employmentType !== filters.employmentType) {
      return false;
    }
    if (filters.status && filters.status !== 'All' && emp.status !== filters.status) {
      return false;
    }
    return true;
  });

  // Project selected fields
  const rows = filtered.map(emp => {
    const projected = {};
    fields.forEach(f => {
      projected[f] = emp[f] !== undefined ? emp[f] : '';
    });
    return projected;
  });

  return {
    columns,
    rows,
    total: rows.length
  };
}

function getPreview(selectedFields, filters, role = 'cxo') {
  const result = runQuery(selectedFields, filters, role);
  return {
    columns: result.columns,
    rows: result.rows.slice(0, 8),
    total: result.total
  };
}

function getCsv(selectedFields, filters, role = 'cxo') {
  const result = runQuery(selectedFields, filters, role);
  logAuditEvent({
    role,
    action: 'DOWNLOAD_CUSTOM_CSV',
    target: `Custom Query (${result.columns.length} fields)`,
    recordCount: result.total,
    status: 'SUCCESS'
  });
  return toCsv(result.columns, result.rows);
}

module.exports = {
  FIELD_CATALOG,
  getFieldCatalogForRole,
  runQuery,
  getPreview,
  getCsv,
  saveCustomReport,
  getCustomReports
};
