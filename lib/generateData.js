const fs = require('fs');
const path = require('path');
const { createRng } = require('./rng');

const DATA_DIR = path.join(__dirname, '..', 'data');

const FIRST_NAMES = [
  'Aarav', 'Aditi', 'Akash', 'Amara', 'Ananya', 'Aria', 'Arjun', 'Benjamin', 'Chloe', 'Daniel',
  'David', 'Dev', 'Elena', 'Emily', 'Ethan', 'Fatima', 'Hannah', 'Harsh', 'Ishaan', 'James',
  'Kavya', 'Leo', 'Lucas', 'Maya', 'Meera', 'Michael', 'Nadia', 'Neha', 'Noah', 'Oliver',
  'Pooja', 'Priya', 'Rahul', 'Rhea', 'Rohan', 'Sam', 'Sara', 'Siddharth', 'Sophia', 'Tanvi',
  'Tara', 'Varun', 'Vikram', 'William', 'Yasmin', 'Zara', 'Zayn', 'Abhishek', 'Divya', 'Karan'
];

const LAST_NAMES = [
  'Sharma', 'Patel', 'Verma', 'Gupta', 'Iyer', 'Menon', 'Nair', 'Singh', 'Reddy', 'Chopra',
  'Deshmukh', 'Mehta', 'Bose', 'Mukherjee', 'Smith', 'Johnson', 'Williams', 'Brown', 'Jones',
  'Miller', 'Davis', 'Wilson', 'Anderson', 'Taylor', 'Thomas', 'Moore', 'Jackson', 'Martin',
  'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson',
  'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores'
];

const DEPARTMENTS = ['Sales', 'Ops', 'Tech', 'Finance', 'HR'];

const ENTITY_LOCATIONS = {
  'India Ops': ['Bangalore', 'Mumbai', 'Gurgaon'],
  'EU Financial Svcs': ['London', 'Dublin', 'Frankfurt'],
  'UAE Holding': ['Dubai', 'Abu Dhabi'],
  'US Corp': ['San Francisco', 'Austin', 'New York']
};

const ENTITIES = Object.keys(ENTITY_LOCATIONS);
const EMPLOYMENT_TYPES = ['Full-Time', 'Full-Time', 'Full-Time', 'Contract', 'Part-Time'];
const GENDERS = ['Female', 'Male', 'Non-Binary'];
const GENDER_WEIGHTS = [0.44, 0.52, 0.04];
const REQ_SOURCES = ['LinkedIn', 'Referral', 'Job Board', 'Agency', 'Campus', 'Internal'];
const DECLINE_REASONS = ['Compensation expectation mismatch', 'Accepted competing offer', 'Location/relocation constraint', 'Role scope misalignment', 'Personal reasons'];

function generateDataset() {
  const rng = createRng(772184); // deterministic seed

  // Reference date is mid-2026 (let's use 2026-06-30 as the anchor date)
  const REF_DATE = new Date('2026-06-30');

  // 1. Generate ~600 Employees
  const totalEmployees = 600;
  const rawEmployees = [];

  // Generate basic employee info
  for (let i = 1; i <= totalEmployees; i++) {
    const id = `EMP-${String(i).padStart(4, '0')}`;
    const fName = rng.pick(FIRST_NAMES);
    const lName = rng.pick(LAST_NAMES);
    const name = `${fName} ${lName}`;
    const dept = rng.pick(DEPARTMENTS);
    const entity = rng.pick(ENTITIES);
    const location = rng.pick(ENTITY_LOCATIONS[entity]);
    const employmentType = rng.pick(EMPLOYMENT_TYPES);

    // Gender selection
    const gRand = rng.next();
    let gender = 'Male';
    if (gRand < 0.44) gender = 'Female';
    else if (gRand < 0.96) gender = 'Male';
    else gender = 'Non-Binary';

    // Join date between 2021-01-01 and 2026-05-30
    const joinYear = rng.int(2021, 2026);
    const joinMonth = joinYear === 2026 ? rng.int(1, 5) : rng.int(1, 12);
    const joinDay = rng.int(1, 28);
    const doj = `${joinYear}-${String(joinMonth).padStart(2, '0')}-${String(joinDay).padStart(2, '0')}`;
    const joinDateObj = new Date(doj);

    // Level (1-5)
    // Distribution: L1 (15%), L2 (30%), L3 (30%), L4 (18%), L5 (7%)
    const lRand = rng.next();
    let level = 2;
    if (lRand < 0.15) level = 1;
    else if (lRand < 0.45) level = 2;
    else if (lRand < 0.75) level = 3;
    else if (lRand < 0.93) level = 4;
    else level = 5;

    // Base CTC per level
    const baseCtcByLevel = {
      1: rng.int(450000, 700000),
      2: rng.int(750000, 1300000),
      3: rng.int(1400000, 2400000),
      4: rng.int(2500000, 4200000),
      5: rng.int(4500000, 7500000)
    };
    const ctc = baseCtcByLevel[level];
    const grossPay = Math.round(ctc / 12);
    const pf = Math.round(grossPay * 0.06);
    const deductions = Math.round(grossPay * 0.14) + pf;
    const netPay = grossPay - deductions;
    const costCenter = `CC-${dept.toUpperCase().substring(0, 3)}-${entity.split(' ')[0].toUpperCase()}`;

    // Performance & Reviews
    const ratingDist = rng.next();
    let rating = 3;
    if (ratingDist < 0.08) rating = 1;
    else if (ratingDist < 0.22) rating = 2;
    else if (ratingDist < 0.65) rating = 3;
    else if (ratingDist < 0.90) rating = 4;
    else rating = 5;

    const goalsCompleted = rng.int(55, 100);
    // Last review date (between 1 and 12 months before REF_DATE)
    const reviewMonthsAgo = rng.int(1, 12);
    const reviewDate = new Date(REF_DATE.getTime() - reviewMonthsAgo * 30 * 86400000).toISOString().split('T')[0];

    // Attendance & Leave
    const leaveBalance = rng.int(2, 24);
    const leaveTaken = rng.int(0, 18);
    const daysPresent = rng.int(202, 248);
    const otHours = dept === 'Ops' || dept === 'Tech' ? rng.int(0, 38) : rng.int(0, 12);
    const lateMarks = rng.int(0, 9);

    rawEmployees.push({
      id,
      name,
      dept,
      entity,
      location,
      doj,
      employmentType,
      gender,
      level,
      ctc,
      grossPay,
      netPay,
      deductions,
      pf,
      costCenter,
      rating,
      goalsCompleted,
      lastReviewDate: reviewDate,
      leaveBalance,
      leaveTaken,
      daysPresent,
      otHours,
      lateMarks,
      status: 'Active',
      exitType: null,
      exitDate: null,
      tenureMonths: Math.max(1, Math.round((REF_DATE - joinDateObj) / (30 * 86400000))),
      managerId: null
    });
  }

  // Determine Exits to target ~12.5% TTM Attrition (approx 75 exits)
  // ~70% voluntary, 30% involuntary
  const targetExits = 76;
  const exitIndices = new Set();
  while (exitIndices.size < targetExits) {
    const idx = rng.int(0, totalEmployees - 1);
    // Exits should have joined before their exit date
    const emp = rawEmployees[idx];
    const joinDateObj = new Date(emp.doj);
    // Exit occurred in TTM (2025-07-01 to 2026-06-30)
    const joinMs = joinDateObj.getTime();
    const ttmStart = new Date('2025-07-01').getTime();
    if (joinMs < REF_DATE.getTime() - 90 * 86400000) {
      exitIndices.add(idx);
    }
  }

  exitIndices.forEach(idx => {
    const emp = rawEmployees[idx];
    emp.status = 'Exited';
    const isVoluntary = rng.next() < 0.70;
    emp.exitType = isVoluntary ? 'Voluntary' : 'Involuntary';
    
    // Exit date in the last 12 months after join date
    const joinTime = new Date(emp.doj).getTime();
    const minExitTime = Math.max(joinTime + 60 * 86400000, new Date('2025-07-01').getTime());
    const maxExitTime = REF_DATE.getTime();
    const exitTime = minExitTime + rng.next() * (maxExitTime - minExitTime);
    emp.exitDate = new Date(exitTime).toISOString().split('T')[0];
    emp.tenureMonths = Math.max(1, Math.round((new Date(emp.exitDate) - new Date(emp.doj)) / (30 * 86400000)));
  });

  // Assign Managers
  // Level 4 and 5 active employees act as managers within their dept
  const managersByDept = {};
  DEPARTMENTS.forEach(dept => {
    managersByDept[dept] = rawEmployees.filter(e => e.status === 'Active' && e.dept === dept && e.level >= 4);
    if (managersByDept[dept].length === 0) {
      // Fallback: make highest level active in dept a manager
      managersByDept[dept] = rawEmployees.filter(e => e.status === 'Active' && e.dept === dept && e.level >= 3);
    }
  });

  rawEmployees.forEach(emp => {
    if (emp.status === 'Active') {
      const deptManagers = managersByDept[emp.dept] || [];
      const eligible = deptManagers.filter(m => m.id !== emp.id && m.level > emp.level);
      if (eligible.length > 0) {
        emp.managerId = rng.pick(eligible).id;
      } else if (deptManagers.length > 0 && deptManagers[0].id !== emp.id) {
        emp.managerId = deptManagers[0].id;
      }
    }
  });

  // 2. Generate ~90 Requisitions
  const totalReqs = 92;
  const requisitions = [];
  for (let i = 1; i <= totalReqs; i++) {
    const id = `REQ-${String(i).padStart(4, '0')}`;
    const dept = rng.pick(DEPARTMENTS);
    const entity = rng.pick(ENTITIES);
    const source = rng.pick(REQ_SOURCES);
    
    // Open date in last 9 months
    const openDaysAgo = rng.int(10, 270);
    const openedDateObj = new Date(REF_DATE.getTime() - openDaysAgo * 86400000);
    const openedDate = openedDateObj.toISOString().split('T')[0];

    // Status: ~62% Filled, 38% Open
    const isFilled = rng.next() < 0.62;
    let status = isFilled ? 'Filled' : 'Open';
    let filledDate = null;
    let timeToFillDays = null;
    let offerExtended = true;
    let offerAccepted = true;
    let declineReason = null;

    if (isFilled) {
      timeToFillDays = rng.int(18, 75);
      const fillTime = openedDateObj.getTime() + timeToFillDays * 86400000;
      filledDate = new Date(fillTime).toISOString().split('T')[0];
    } else {
      // For open reqs, some had offer declined
      if (rng.next() < 0.35) {
        offerExtended = true;
        offerAccepted = false;
        declineReason = rng.pick(DECLINE_REASONS);
      } else {
        offerExtended = rng.next() < 0.5;
        offerAccepted = false;
      }
    }

    requisitions.push({
      id,
      dept,
      entity,
      openedDate,
      status,
      filledDate,
      timeToFillDays,
      source,
      offerExtended,
      offerAccepted,
      declineReason
    });
  }

  // 3. Generate Budgets
  // Actual CTC per dept based on active employees
  const actualCtcByDept = {};
  DEPARTMENTS.forEach(dept => {
    actualCtcByDept[dept] = rawEmployees
      .filter(e => e.status === 'Active' && e.dept === dept)
      .reduce((sum, e) => sum + e.ctc, 0);
  });

  const budgets = DEPARTMENTS.map(dept => {
    const actualCTC = actualCtcByDept[dept];
    // Variance between 85% and 115%
    const budgetFactor = rng.float(0.88, 1.14, 3);
    const budgetedCTC = Math.round(actualCTC * budgetFactor);
    return {
      dept,
      actualCTC,
      budgetedCTC,
      varianceCTC: actualCTC - budgetedCTC,
      variancePct: Number((((actualCTC - budgetedCTC) / budgetedCTC) * 100).toFixed(1))
    };
  });

  return {
    employees: rawEmployees,
    requisitions,
    budgets,
    customReports: []
  };
}

function initDataFiles(force = false) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const empFile = path.join(DATA_DIR, 'employees.json');
  const reqFile = path.join(DATA_DIR, 'requisitions.json');
  const budgetFile = path.join(DATA_DIR, 'budgets.json');
  const customFile = path.join(DATA_DIR, 'customReports.json');

  if (!force && fs.existsSync(empFile) && fs.existsSync(reqFile) && fs.existsSync(budgetFile)) {
    return false;
  }

  const dataset = generateDataset();
  fs.writeFileSync(empFile, JSON.stringify(dataset.employees, null, 2), 'utf-8');
  fs.writeFileSync(reqFile, JSON.stringify(dataset.requisitions, null, 2), 'utf-8');
  fs.writeFileSync(budgetFile, JSON.stringify(dataset.budgets, null, 2), 'utf-8');
  
  if (!fs.existsSync(customFile)) {
    fs.writeFileSync(customFile, JSON.stringify([], null, 2), 'utf-8');
  }

  return true;
}

module.exports = {
  generateDataset,
  initDataFiles,
  DATA_DIR
};
