const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const dataStore = require('./lib/dataStore');
const reportDefs = require('./lib/reportDefs');
const builder = require('./lib/builder');
const copilot = require('./lib/copilot');
const { toCsv } = require('./lib/csv');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff'
};

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-cache, no-store, must-revalidate'
  });
  res.end(JSON.stringify(data));
}

function sendCsv(res, filename, csvString) {
  res.writeHead(200, {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="${filename}.csv"`,
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-cache, no-store, must-revalidate'
  });
  res.end(csvString);
}

function sendError(res, statusCode, message, details = null) {
  sendJson(res, statusCode, { error: message, details });
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > 2e6) reject(new Error('Payload too large'));
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function serveStatic(req, res, pathname) {
  let relativePath = pathname === '/' ? 'index.html' : pathname;
  const cleanPath = relativePath.split('?')[0];
  const safePath = path.normalize(cleanPath).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(PUBLIC_DIR, safePath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    return sendError(res, 403, 'Forbidden');
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      return sendError(res, 404, 'File Not Found');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    // Disable caching completely so browser always gets the newest UI
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stats.size,
      'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method.toUpperCase();
  const role = parsedUrl.query.role || req.headers['x-role'] || 'cxo';
  const entity = parsedUrl.query.entity || req.headers['x-entity'] || 'All';

  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Role, X-Entity'
    });
    return res.end();
  }

  try {
    // 1. GET /api/meta
    if (method === 'GET' && pathname === '/api/meta') {
      const meta = dataStore.getMeta(role);
      return sendJson(res, 200, meta);
    }

    // 2. GET /api/kpis
    if (method === 'GET' && pathname === '/api/kpis') {
      const kpis = dataStore.getKpis(role, entity);
      return sendJson(res, 200, kpis);
    }

    // 3. GET /api/charts/headcount-trend
    if (method === 'GET' && pathname === '/api/charts/headcount-trend') {
      const data = dataStore.getHeadcountTrend(role, entity);
      return sendJson(res, 200, data);
    }

    // 4. GET /api/charts/attrition-by-dept
    if (method === 'GET' && pathname === '/api/charts/attrition-by-dept') {
      const data = dataStore.getAttritionByDept(role, entity);
      return sendJson(res, 200, data);
    }

    // 5. GET /api/charts/gender-mix
    if (method === 'GET' && pathname === '/api/charts/gender-mix') {
      const data = dataStore.getGenderMix(role, entity);
      return sendJson(res, 200, data);
    }

    // 6. GET /api/reports
    if (method === 'GET' && pathname === '/api/reports') {
      const category = parsedUrl.query.category || 'All';
      const catalog = reportDefs.getReportCatalog(category, role);
      return sendJson(res, 200, catalog);
    }

    // 7. GET /api/reports/:id/csv
    const reportCsvMatch = pathname.match(/^\/api\/reports\/([a-zA-Z0-9_-]+)\/csv$/);
    if (method === 'GET' && reportCsvMatch) {
      const reportId = reportCsvMatch[1];
      const report = reportDefs.getReportById(reportId);

      if (!report) {
        return sendError(res, 404, `Report ID '${reportId}' was not found in the catalog.`);
      }

      const normalizedRole = role.toLowerCase();
      if (report.allowedRoles && !report.allowedRoles.includes(normalizedRole)) {
        dataStore.logAuditEvent({
          role: normalizedRole,
          action: 'ACCESS_DENIED',
          target: `Report ${report.id}: ${report.name}`,
          status: 'BLOCKED_RBAC'
        });
        return sendError(res, 403, `Access Denied: Your role (${role.toUpperCase()}) is not authorized to generate '${report.name}'.`);
      }

      const { columns, rows } = report.generator(role);
      const csvData = toCsv(columns, rows);
      const safeFilename = report.name.toLowerCase().replace(/[^a-z0-9]+/g, '_');

      dataStore.logAuditEvent({
        role: normalizedRole,
        action: 'DOWNLOAD_REPORT_CSV',
        target: `Report ${report.id}: ${report.name}`,
        recordCount: rows.length,
        status: 'SUCCESS'
      });

      return sendCsv(res, safeFilename, csvData);
    }

    // 8. GET /api/builder/fields
    if (method === 'GET' && pathname === '/api/builder/fields') {
      const fields = builder.getFieldCatalogForRole(role);
      return sendJson(res, 200, fields);
    }

    // 9. POST /api/builder/preview
    if (method === 'POST' && pathname === '/api/builder/preview') {
      const body = await parseBody(req);
      const userRole = body.role || role;
      const preview = builder.getPreview(body.fields, body.filters, userRole);
      return sendJson(res, 200, preview);
    }

    // 10. POST /api/builder/csv
    if (method === 'POST' && pathname === '/api/builder/csv') {
      const body = await parseBody(req);
      const userRole = body.role || role;
      const csvData = builder.getCsv(body.fields, body.filters, userRole);
      const filename = body.name ? body.name.toLowerCase().replace(/[^a-z0-9]+/g, '_') : 'custom_report';
      return sendCsv(res, filename, csvData);
    }

    // 11. POST /api/builder/save
    if (method === 'POST' && pathname === '/api/builder/save') {
      const body = await parseBody(req);
      if (!body.name) return sendError(res, 400, 'Report name is required');
      const saved = builder.saveCustomReport(body, role);
      return sendJson(res, 201, saved);
    }

    // 12. GET /api/builder/saved
    if (method === 'GET' && pathname === '/api/builder/saved') {
      const list = builder.getCustomReports();
      return sendJson(res, 200, list);
    }

    // 13. POST /api/copilot
    if (method === 'POST' && pathname === '/api/copilot') {
      const body = await parseBody(req);
      const question = body.question || '';
      const userRole = body.role || role;
      const response = copilot.answerQuestion(question, userRole);
      return sendJson(res, 200, response);
    }

    // 14. GET /api/schedules
    if (method === 'GET' && pathname === '/api/schedules') {
      const list = dataStore.getSchedules();
      return sendJson(res, 200, list);
    }

    // 15. POST /api/schedules
    if (method === 'POST' && pathname === '/api/schedules') {
      const body = await parseBody(req);
      const newJob = dataStore.saveSchedule({ ...body, role });
      return sendJson(res, 201, newJob);
    }

    // 16. GET /api/audit-log
    if (method === 'GET' && pathname === '/api/audit-log') {
      const logs = dataStore.getAuditLog();
      return sendJson(res, 200, logs);
    }

    // Static Assets
    if (method === 'GET') {
      return serveStatic(req, res, pathname);
    }

    return sendError(res, 404, 'Endpoint Not Found');
  } catch (err) {
    console.error('Server error:', err);
    return sendError(res, 500, 'Internal Server Error', err.message);
  }
});

server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`  ReportOS Server Active at http://localhost:${PORT}`);
  console.log(`  Cache-Control: Disabled (Instant Live Reload)`);
  console.log(`======================================================\n`);
});
