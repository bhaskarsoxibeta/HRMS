/**
 * Zero-dependency CSV Serializer
 */

function escapeCsvCell(value) {
  if (value === null || value === undefined) {
    return '';
  }
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Serializes column headers and rows into CSV format.
 * @param {Array<{key: string, label: string}>|Array<string>} columns
 * @param {Array<Object>} rows
 * @returns {string}
 */
function toCsv(columns, rows) {
  if (!columns || columns.length === 0) {
    return '';
  }

  const normalizedCols = columns.map(col => {
    if (typeof col === 'string') {
      return { key: col, label: col };
    }
    return col;
  });

  const headerLine = normalizedCols.map(c => escapeCsvCell(c.label || c.key)).join(',');
  const rowLines = (rows || []).map(row => {
    return normalizedCols.map(c => escapeCsvCell(row[c.key])).join(',');
  });

  return [headerLine, ...rowLines].join('\r\n');
}

module.exports = {
  toCsv,
  escapeCsvCell
};
