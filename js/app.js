/* ===== GITAM CMS — Application logic ===== */
(function () {
  'use strict';

  let user = null;            // logged-in user
  let currentView = 'dashboard';

  /* ---------- tiny helpers ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => (
    { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const money = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');

  function toast(msg, type = 'ok') {
    const t = $('#toast');
    t.textContent = msg;
    t.className = 'toast ' + type;
    setTimeout(() => t.classList.add('hidden'), 2600);
  }

  function openModal(title, html) {
    $('#modalTitle').textContent = title;
    $('#modalBody').innerHTML = html;
    $('#modalOverlay').classList.remove('hidden');
  }
  function closeModal() { $('#modalOverlay').classList.add('hidden'); }

  /* ---------- lookups ---------- */
  const courseName = (id) => { const c = Store.find('courses', id); return c ? `${c.code} — ${c.name}` : '—'; };
  const facultyName = (id) => { const f = Store.find('faculty', id); return f ? f.name : '—'; };
  const studentName = (id) => { const s = Store.find('students', id); return s ? s.name : '—'; };

  /* ---------- grade logic ---------- */
  function gradeFor(total) {
    if (total >= 90) return { g: 'O',  p: 10 };
    if (total >= 80) return { g: 'A+', p: 9 };
    if (total >= 70) return { g: 'A',  p: 8 };
    if (total >= 60) return { g: 'B+', p: 7 };
    if (total >= 50) return { g: 'B',  p: 6 };
    if (total >= 40) return { g: 'C',  p: 5 };
    return { g: 'F', p: 0 };
  }
  function studentAttendancePct(sid) {
    const sessions = Store.all('attendance').filter(a => sid in a.records);
    if (!sessions.length) return null;
    const present = sessions.filter(a => a.records[sid] === 'P').length;
    return Math.round((present / sessions.length) * 100);
  }
  function studentGPA(sid) {
    const ms = Store.all('marks').filter(m => m.studentId === sid);
    if (!ms.length) return null;
    let pts = 0, cr = 0;
    ms.forEach(m => {
      const c = Store.find('courses', m.courseId);
      const credits = c ? c.credits : 0;
      const total = (m.internal || 0) + (m.external || 0);
      pts += gradeFor(total).p * credits;
      cr += credits;
    });
    return cr ? (pts / cr).toFixed(2) : null;
  }

  /* ========================================================= */
  /*  AUTH                                                      */
  /* ========================================================= */
  async function doLogin(e) {
    e.preventDefault();
    const u = $('#loginUser').value.trim();
    const p = $('#loginPass').value;
    const role = $('#loginRole').value;
    const btn = $('#loginForm button[type="submit"]');
    $('#loginError').textContent = '';
    btn.disabled = true; btn.textContent = 'Signing in...';
    try {
      const found = await Store.login(u, p, role);
      if (!found) { $('#loginError').textContent = 'Invalid credentials or wrong role selected.'; return; }
      user = found;
      sessionStorage.setItem('gitam_user', found.id);
      await Store.load();
      startApp();
    } catch (err) {
      $('#loginError').textContent = 'Cannot reach server. Run: python server.py';
    } finally {
      btn.disabled = false; btn.textContent = 'Sign In';
    }
  }

  function logout() {
    user = null;
    sessionStorage.removeItem('gitam_user');
    $('#appScreen').classList.add('hidden');
    $('#loginScreen').classList.remove('hidden');
    $('#loginForm').reset();
    $('#loginError').textContent = '';
  }

  /* ========================================================= */
  /*  NAV + ROUTER                                              */
  /* ========================================================= */
  const MENU = {
    admin: [
      ['dashboard','📊','Dashboard'], ['students','🎓','Students'], ['faculty','👨‍🏫','Faculty'],
      ['courses','📚','Courses'], ['assignments','🗂️','Assignments'], ['attendance','✅','Attendance'],
      ['marks','📝','Marks & Results'], ['timetable','🗓️','Timetable'], ['library','📖','Library'], ['fees','💳','Fees'],
    ],
    faculty: [
      ['dashboard','📊','Dashboard'], ['students','🎓','Students'], ['attendance','✅','Attendance'],
      ['marks','📝','Marks & Results'], ['timetable','🗓️','Timetable'], ['profile','👤','My Profile'],
    ],
    student: [
      ['dashboard','📊','Dashboard'], ['myattendance','✅','My Attendance'], ['myresults','📝','My Results'],
      ['timetable','🗓️','Timetable'], ['mybooks','📖','My Library'], ['myfees','💳','My Fees'], ['profile','👤','My Profile'],
    ],
  };

  function buildNav() {
    const nav = $('#navMenu');
    const label = { admin: 'Administration', faculty: 'Faculty Menu', student: 'Student Menu' }[user.role] || 'Menu';
    nav.innerHTML = `<div class="nav-section">${label}</div>`;
    MENU[user.role].forEach(([key, ico, txt]) => {
      const div = document.createElement('div');
      div.className = 'nav-item' + (key === currentView ? ' active' : '');
      div.title = txt;
      div.innerHTML = `<span class="ico">${ico}</span><span>${txt}</span>`;
      div.onclick = () => navigate(key);
      nav.appendChild(div);
    });
  }

  function navigate(key) {
    currentView = key;
    buildNav();
    $('.sidebar').classList.remove('open');
    render();
  }

  // sidebar close/open: desktop -> collapse to icon rail (remembered); mobile -> slide in/out
  const SIDEBAR_KEY = 'gitam_sidebar_collapsed';
  function toggleSidebar() {
    if (window.innerWidth <= 860) {
      $('.sidebar').classList.toggle('open');
    } else {
      const collapsed = document.body.classList.toggle('sidebar-collapsed');
      localStorage.setItem(SIDEBAR_KEY, collapsed ? '1' : '0');
    }
  }

  const TITLES = {
    dashboard:'Dashboard', students:'Students', faculty:'Faculty', courses:'Courses',
    attendance:'Attendance', marks:'Marks & Results', timetable:'Timetable', fees:'Fees Management',
    assignments:'Class Assignments', library:'Library Management', mybooks:'My Library',
    myattendance:'My Attendance', myresults:'My Results', myfees:'My Fees', profile:'My Profile',
  };

  function render() {
    $('#pageTitle').textContent = TITLES[currentView] || 'Dashboard';
    const v = $('#view');
    const fn = {
      dashboard: viewDashboard, students: viewStudents, faculty: viewFaculty, courses: viewCourses,
      attendance: viewAttendance, marks: viewMarks, timetable: viewTimetable, fees: viewFees,
      assignments: viewAssignments, library: viewLibrary, mybooks: viewMyBooks,
      myattendance: viewMyAttendance, myresults: viewMyResults, myfees: viewMyFees, profile: viewProfile,
    }[currentView] || viewDashboard;
    v.innerHTML = fn();
    if (typeof fn.after === 'function') fn.after();
  }

  /* ========================================================= */
  /*  VIEWS                                                     */
  /* ========================================================= */
  function statCard(ico, val, lbl, cls = '') {
    return `<div class="stat-card ${cls}"><div class="s-ico">${ico}</div>
      <div><div class="s-val">${val}</div><div class="s-lbl">${lbl}</div></div></div>`;
  }

  // ---- DASHBOARD ----
  function viewDashboard() {
    viewDashboard.after = null;
    if (user.role === 'student') return studentDashboard();
    if (user.role === 'faculty') return facultyDashboard();
    const students = Store.all('students');
    const nStu = students.length;
    const nFac = Store.all('faculty').length;
    const nCou = Store.all('courses').length;
    const nBooks = Store.all('books').reduce((s, b) => s + (b.total || 0), 0);
    const fees = Store.all('fees');
    const totalFee = fees.reduce((s, f) => s + (f.total || 0), 0);
    const collected = fees.reduce((s, f) => s + Math.min(f.total, f.paid || 0), 0);
    const pending = totalFee - collected;
    const collPct = totalFee ? Math.round((collected / totalFee) * 100) : 0;
    const onLoan = Store.all('issues').filter(i => !i.returnDate).length;

    // branch distribution
    const byBranch = {};
    students.forEach(s => { byBranch[s.branch] = (byBranch[s.branch] || 0) + 1; });
    const branchRows = Object.entries(byBranch).sort((a, b) => b[1] - a[1]);
    const maxBranch = Math.max(1, ...branchRows.map(r => r[1]));

    // attendance health
    const attVals = students.map(s => studentAttendancePct(s.id)).filter(v => v !== null);
    const goodAtt = attVals.filter(v => v >= 75).length;
    const lowAtt = attVals.filter(v => v < 75).length;

    // top performers by GPA
    const top = students
      .map(s => ({ s, gpa: studentGPA(s.id) }))
      .filter(x => x.gpa !== null)
      .sort((a, b) => b.gpa - a.gpa).slice(0, 5);

    // ---- welcome banner ----
    let html = `<div class="welcome-banner">
      <div class="wb-text">
        <h2>${greeting()}, ${esc(user.name.split(' ').slice(-1)[0] || user.name)} 👋</h2>
        <p>GITAM College Management System · ${prettyDate()}</p>
        <div class="wb-chips">
          <span>🎓 ${nStu} students</span><span>📚 ${nCou} courses</span>
          <span>📖 ${onLoan} books on loan</span><span>💳 ${collPct}% fees collected</span>
        </div>
      </div>
      <div class="wb-logo"><img src="assets/gitam-logo.png" alt="GITAM"></div>
    </div>`;

    // ---- stat cards ----
    html += `<div class="stat-grid">
      ${statCard('🎓', nStu, 'Total Students')}
      ${statCard('👨‍🏫', nFac, 'Faculty Members', 'c2')}
      ${statCard('📚', nCou, 'Courses Offered', 'c3')}
      ${statCard('📖', nBooks, 'Library Books', 'c2')}
    </div>`;

    // ---- charts row: branch distribution + fee donut ----
    html += `<div class="dash-2col">
      <div class="panel">
        <div class="panel-head"><h3>Students by Branch</h3></div>
        ${branchRows.length ? branchRows.map(([b, n]) => `
          <div class="dist-row">
            <span class="dist-label">${esc(b)}</span>
            <span class="dist-bar"><i style="width:${Math.round(n / maxBranch * 100)}%"></i></span>
            <span class="dist-val">${n}</span>
          </div>`).join('') : `<p class="empty">No data.</p>`}
      </div>
      <div class="panel">
        <div class="panel-head"><h3>Fee Collection</h3></div>
        <div class="donut-wrap">
          ${donutSVG(collPct, 'collected')}
          <div class="donut-legend">
            <div><span class="dot green"></span> Collected <b>${money(collected)}</b></div>
            <div><span class="dot line"></span> Pending <b>${money(pending)}</b></div>
            <div style="margin-top:6px;color:var(--muted);font-size:12.5px">Total ${money(totalFee)}</div>
          </div>
        </div>
      </div>
    </div>`;

    // ---- top performers + attendance health ----
    html += `<div class="dash-2col">
      <div class="panel">
        <div class="panel-head"><h3>🏆 Top Performers</h3></div>
        ${top.length ? top.map((x, i) => `
          <div class="rank-row">
            <span class="rank ${i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : ''}">${i + 1}</span>
            <div class="rank-info"><strong>${esc(x.s.name)}</strong><small>${esc(x.s.roll)} · ${esc(x.s.branch)}</small></div>
            <span class="pill green">GPA ${x.gpa}</span>
          </div>`).join('') : `<p class="empty">No results yet.</p>`}
      </div>
      <div class="panel">
        <div class="panel-head"><h3>Attendance Health</h3></div>
        <div class="health-grid">
          <div class="health-box ok"><div class="hv">${goodAtt}</div><div class="hl">≥ 75% (Safe)</div></div>
          <div class="health-box bad"><div class="hv">${lowAtt}</div><div class="hl">&lt; 75% (At risk)</div></div>
        </div>
        ${lowAtt ? `<p style="margin-top:12px;color:var(--red);font-size:13px">⚠ ${lowAtt} student(s) detention risk pe — follow up karein.</p>`
                 : `<p style="margin-top:12px;color:var(--green);font-size:13px">✓ Sab students attendance criteria me hain.</p>`}
      </div>
    </div>`;

    // ---- students overview table ----
    html += `<div class="panel"><div class="panel-head"><h3>Students Overview</h3></div>
      <div class="tbl-wrap"><table><thead><tr>
        <th>Roll No</th><th>Name</th><th>Branch</th><th>Sem</th><th>Attendance</th><th>GPA</th>
      </tr></thead><tbody>`;
    students.forEach(s => {
      const att = studentAttendancePct(s.id);
      const gpa = studentGPA(s.id);
      html += `<tr><td>${esc(s.roll)}</td><td>${esc(s.name)}</td><td>${esc(s.branch)}</td>
        <td>${s.semester}</td><td>${attBar(att)}</td><td>${gpa ?? '—'}</td></tr>`;
    });
    html += `</tbody></table></div></div>`;
    return html;
  }

  // greeting + date helpers for the dashboard banner
  function greeting() {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  }
  function prettyDate() {
    return new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }
  // SVG donut chart (no library)
  function donutSVG(pct, sub) {
    const r = 52, c = 2 * Math.PI * r, off = c * (1 - pct / 100);
    return `<svg class="donut" viewBox="0 0 140 140">
      <circle cx="70" cy="70" r="${r}" fill="none" stroke="var(--line)" stroke-width="16"></circle>
      <circle cx="70" cy="70" r="${r}" fill="none" stroke="var(--primary)" stroke-width="16"
        stroke-linecap="round" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"
        transform="rotate(-90 70 70)"></circle>
      <text x="70" y="68" text-anchor="middle" font-size="26" font-weight="700" fill="var(--primary-dark)">${pct}%</text>
      <text x="70" y="90" text-anchor="middle" font-size="11" fill="var(--muted)">${esc(sub)}</text>
    </svg>`;
  }

  // ---- FACULTY dashboard: only the classes the admin assigned ----
  function facultyDashboard() {
    const f = Store.find('faculty', user.refId) || {};
    const classes = teacherCourses();          // courses assigned to this faculty
    const studentSet = visibleStudents();      // students in those classes

    let html = `<div class="welcome-banner">
      <div class="wb-text">
        <h2>${greeting()}, ${esc((user.name || '').split(' ').slice(-1)[0])} 👋</h2>
        <p>${esc(f.designation || 'Faculty')} · ${esc(f.department || '')} · ${prettyDate()}</p>
        <div class="wb-chips"><span>📚 ${classes.length} classes assigned</span><span>🎓 ${studentSet.length} students</span></div>
      </div>
      <div class="wb-logo"><img src="assets/gitam-logo.png" alt="GITAM"></div>
    </div>`;

    html += `<div class="stat-grid">
      ${statCard('📚', classes.length, 'Assigned Classes')}
      ${statCard('🎓', studentSet.length, 'My Students', 'c3')}
      ${statCard('✅', 'Mark', 'Take Attendance', 'c2')}
    </div>`;

    html += `<div class="panel"><div class="panel-head"><h3>📋 My Assigned Classes</h3>
      <span style="font-size:12.5px;color:var(--muted)">System Admin dwara assign ki gayi</span></div>`;
    if (!classes.length) {
      html += `<p class="empty">Abhi aapko koi class assign nahi hui hai. System Admin se contact karein.</p>`;
    } else {
      html += `<div class="tbl-wrap"><table><thead><tr>
        <th>Code</th><th>Course</th><th>Branch</th><th>Sem</th><th>Section</th><th>Students</th><th>Actions</th>
      </tr></thead><tbody>${classes.map(c => `<tr>
        <td>${esc(c.code)}</td><td>${esc(c.name)}</td><td>${esc(c.branch)}</td><td>${c.semester}</td>
        <td><span class="pill blue">Sec ${esc(c.section || 'A')}</span></td>
        <td>${studentsOfCourse(c).length}</td>
        <td><div class="row-actions">
          <button class="btn-sm btn-edit" data-att="${c.id}">✅ Attendance</button>
          <button class="btn-sm btn-outline" data-mk="${c.id}">📝 Marks</button></div></td></tr>`).join('')}</tbody></table></div>`;
    }
    html += `</div>`;

    viewDashboard.after = () => {
      document.querySelectorAll('[data-att]').forEach(b => b.onclick = () => navigate('attendance'));
      document.querySelectorAll('[data-mk]').forEach(b => b.onclick = () => navigate('marks'));
    };
    return html;
  }

  function studentDashboard() {
    const s = Store.find('students', user.refId) || {};
    const att = studentAttendancePct(s.id);
    const gpa = studentGPA(s.id);
    const fee = Store.all('fees').find(f => f.studentId === s.id);
    const due = fee ? Math.max(0, fee.total - fee.paid) : 0;
    const courses = Store.all('courses').filter(c => c.branch === s.branch && c.semester === s.semester).length;

    const booksOnLoan = Store.all('issues').filter(i => i.studentId === s.id && !i.returnDate).length;

    let html = `<div class="welcome-banner">
      <div class="wb-text">
        <h2>${greeting()}, ${esc((s.name || '').split(' ')[0])} 👋</h2>
        <p>${esc(s.branch)} · Semester ${s.semester} · Section ${esc(s.section)} · Roll ${esc(s.roll)}</p>
        <div class="wb-chips"><span>📅 ${prettyDate()}</span></div>
      </div>
      <div class="wb-logo"><img src="assets/gitam-logo.png" alt="GITAM"></div>
    </div>`;
    html += `<div class="stat-grid">
      ${statCard('✅', (att ?? '—') + '%', 'Attendance', att !== null && att < 75 ? 'c4' : 'c3')}
      ${statCard('📝', gpa ?? '—', 'Current GPA', 'c2')}
      ${statCard('📚', courses, 'Enrolled Courses')}
      ${statCard('💳', money(due), 'Fees Due', due > 0 ? 'c4' : 'c3')}
    </div>`;
    html += `<div class="dash-2col">
      <div class="panel">
        <div class="panel-head"><h3>My Attendance</h3></div>
        <div class="donut-wrap">
          ${donutSVG(att ?? 0, 'present')}
          <div class="donut-legend">
            <div><span class="dot green"></span> Attendance <b>${att ?? '—'}%</b></div>
            <div style="color:var(--muted);font-size:12.5px;margin-top:4px">${att !== null && att < 75 ? 'Below the 75% requirement' : 'Meeting the 75% requirement'}</div>
          </div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h3>Quick Snapshot</h3></div>
        <div class="rank-row"><span class="rank">📖</span><div class="rank-info"><strong>${booksOnLoan} book(s) on loan</strong><small>Library</small></div></div>
        <div class="rank-row"><span class="rank">📝</span><div class="rank-info"><strong>GPA ${gpa ?? '—'}</strong><small>Academic performance</small></div></div>
        <div class="rank-row"><span class="rank">💳</span><div class="rank-info"><strong>${money(due)} due</strong><small>Fees</small></div></div>
      </div>
    </div>`;
    if (att !== null && att < 75)
      html += `<div class="panel" style="border-left:4px solid var(--red)"><strong style="color:var(--red)">⚠ Low Attendance.</strong> Aapki attendance 75% se kam hai. Detention se bachne ke liye classes attend karein.</div>`;
    return html;
  }

  function attBar(pct) {
    if (pct === null) return '—';
    const cls = pct < 75 ? 'low' : pct < 85 ? 'mid' : '';
    return `<span class="bar ${cls}"><i style="width:${pct}%"></i></span> ${pct}%`;
  }

  // ---- STUDENTS ----
  function viewStudents() {
    const canEdit = user.role === 'admin';
    let html = `<div class="panel"><div class="panel-head">
      <h3>All Students</h3>
      <div class="panel-tools">
        <input class="search-box" id="stuSearch" placeholder="Search name / roll..." />
        <select class="filter-sel" id="stuBranch">
          <option value="">All Branches</option>${branchOptions()}
        </select>
        ${canEdit ? `<button class="btn-primary" id="addStu">+ Add Student</button>` : ''}
      </div></div>
      <div class="tbl-wrap"><table><thead><tr>
        <th>Roll No</th><th>Name</th><th>Email</th><th>Phone</th><th>Branch</th><th>Year</th><th>Sem</th><th>Sec</th>
        ${canEdit ? '<th>Actions</th>' : ''}
      </tr></thead><tbody id="stuBody"></tbody></table></div></div>`;
    viewStudents.after = () => {
      const draw = () => {
        const q = ($('#stuSearch').value || '').toLowerCase();
        const b = $('#stuBranch').value;
        const rows = visibleStudents().filter(s =>
          (!q || s.name.toLowerCase().includes(q) || s.roll.toLowerCase().includes(q)) &&
          (!b || s.branch === b));
        $('#stuBody').innerHTML = rows.length ? rows.map(s => `<tr>
          <td>${esc(s.roll)}</td><td>${esc(s.name)}</td><td>${esc(s.email)}</td><td>${esc(s.phone)}</td>
          <td>${esc(s.branch)}</td><td>${s.year}</td><td>${s.semester}</td><td>${esc(s.section)}</td>
          ${canEdit ? `<td><div class="row-actions">
            <button class="btn-sm btn-edit" data-edit="${s.id}">Edit</button>
            <button class="btn-sm btn-outline" data-id="${s.id}" title="Print ID card">🪪 ID</button>
            <button class="btn-sm btn-outline" data-sheet="${s.id}" title="Print marksheet">📄 Sheet</button>
            <button class="btn-sm btn-del" data-del="${s.id}">Delete</button></div></td>` : ''}
        </tr>`).join('') : `<tr><td colspan="9" class="empty">No students found.</td></tr>`;
        if (canEdit) {
          $('#stuBody').querySelectorAll('[data-edit]').forEach(b => b.onclick = () => studentForm(b.dataset.edit));
          $('#stuBody').querySelectorAll('[data-id]').forEach(b => b.onclick = () => printIdCard(b.dataset.id));
          $('#stuBody').querySelectorAll('[data-sheet]').forEach(b => b.onclick = () => printMarksheet(b.dataset.sheet));
          $('#stuBody').querySelectorAll('[data-del]').forEach(b => b.onclick = () => delConfirm('students', b.dataset.del, 'student', draw));
        }
      };
      $('#stuSearch').oninput = draw;
      $('#stuBranch').onchange = draw;
      if (canEdit) $('#addStu').onclick = () => studentForm();
      draw();
    };
    return html;
  }

  function studentForm(id) {
    const s = id ? Store.find('students', id) : {};
    openModal((id ? 'Edit' : 'Add') + ' Student', `<form id="f">
      <div class="form-grid">
        <div class="field"><label>Roll Number</label><input name="roll" value="${esc(s.roll||'')}" required></div>
        <div class="field"><label>Full Name</label><input name="name" value="${esc(s.name||'')}" required></div>
        <div class="field"><label>Email</label><input name="email" type="email" value="${esc(s.email||'')}"></div>
        <div class="field"><label>Phone</label><input name="phone" value="${esc(s.phone||'')}"></div>
        <div class="field"><label>Branch</label><select name="branch">${branchOptions(s.branch)}</select></div>
        <div class="field"><label>Year</label><input name="year" type="number" min="1" max="4" value="${s.year||1}"></div>
        <div class="field"><label>Semester</label><input name="semester" type="number" min="1" max="8" value="${s.semester||1}"></div>
        <div class="field"><label>Section</label><input name="section" value="${esc(s.section||'A')}"></div>
      </div>
      <div class="form-actions"><button type="button" class="btn-outline" id="cx">Cancel</button>
        <button type="submit" class="btn-primary">Save</button></div></form>`);
    $('#cx').onclick = closeModal;
    $('#f').onsubmit = (e) => {
      e.preventDefault();
      const d = formData(e.target);
      d.year = +d.year; d.semester = +d.semester;
      if (id) Store.update('students', id, d);
      else { Store.add('students', d); ensureStudentLogin(d); }
      closeModal(); toast('Student saved.'); render();
    };
  }
  function ensureStudentLogin(s) {
    Store.add('users', { username: s.roll, password: 'pass123', role: 'student', refId: s.id, name: s.name });
  }

  // ---- FACULTY ----
  function viewFaculty() {
    let html = `<div class="panel"><div class="panel-head">
      <h3>Faculty Members</h3>
      <div class="panel-tools">
        <input class="search-box" id="facSearch" placeholder="Search name / dept...">
        <button class="btn-primary" id="addFac">+ Add Faculty</button>
      </div></div>
      <div class="tbl-wrap"><table><thead><tr>
        <th>Emp ID</th><th>Name</th><th>Department</th><th>Designation</th><th>Email</th><th>Phone</th><th>Actions</th>
      </tr></thead><tbody id="facBody"></tbody></table></div></div>`;
    viewFaculty.after = () => {
      const draw = () => {
        const q = ($('#facSearch').value||'').toLowerCase();
        const rows = Store.all('faculty').filter(f =>
          !q || f.name.toLowerCase().includes(q) || f.department.toLowerCase().includes(q));
        $('#facBody').innerHTML = rows.length ? rows.map(f => `<tr>
          <td>${esc(f.empId)}</td><td>${esc(f.name)}</td><td>${esc(f.department)}</td>
          <td>${esc(f.designation)}</td><td>${esc(f.email)}</td><td>${esc(f.phone)}</td>
          <td><div class="row-actions">
            <button class="btn-sm btn-edit" data-classes="${f.id}" title="Assign classes">📚 Classes</button>
            <button class="btn-sm btn-edit" data-edit="${f.id}">Edit</button>
            <button class="btn-sm btn-del" data-del="${f.id}">Delete</button></div></td></tr>`).join('')
          : `<tr><td colspan="7" class="empty">No faculty found.</td></tr>`;
        $('#facBody').querySelectorAll('[data-classes]').forEach(b => b.onclick = () => facultyClassesModal(b.dataset.classes, draw));
        $('#facBody').querySelectorAll('[data-edit]').forEach(b => b.onclick = () => facultyForm(b.dataset.edit));
        $('#facBody').querySelectorAll('[data-del]').forEach(b => b.onclick = () => delConfirm('faculty', b.dataset.del, 'faculty', draw));
      };
      $('#facSearch').oninput = draw;
      $('#addFac').onclick = () => facultyForm();
      draw();
    };
    return html;
  }
  function facultyForm(id) {
    const f = id ? Store.find('faculty', id) : {};
    // existing login account linked to this faculty (for edit)
    const acct = id ? Store.all('users').find(u => u.refId === id && u.role === 'faculty') : null;
    openModal((id?'Edit':'Add')+' Faculty', `<form id="f">
      <div class="form-grid">
        <div class="field"><label>Employee ID</label><input name="empId" value="${esc(f.empId||'')}" required></div>
        <div class="field"><label>Full Name</label><input name="name" value="${esc(f.name||'')}" required></div>
        <div class="field"><label>Department</label><input name="department" value="${esc(f.department||'')}"></div>
        <div class="field"><label>Designation</label><input name="designation" value="${esc(f.designation||'')}"></div>
        <div class="field"><label>Email</label><input name="email" type="email" value="${esc(f.email||'')}"></div>
        <div class="field"><label>Phone</label><input name="phone" value="${esc(f.phone||'')}"></div>
      </div>
      <h4 style="font-size:13px;color:var(--primary-dark);margin:18px 0 8px">LOGIN ACCOUNT</h4>
      <div class="form-grid">
        <div class="field"><label>Username</label><input name="username" value="${esc(acct?acct.username:'')}" required></div>
        <div class="field"><label>Password</label><input name="password" type="text" value="" placeholder="${id?'leave blank to keep current':'set a password'}" ${id?'':'required'}></div>
      </div>
      <div class="form-actions"><button type="button" class="btn-outline" id="cx">Cancel</button>
        <button type="submit" class="btn-primary">Save</button></div></form>`);
    $('#cx').onclick = closeModal;
    $('#f').onsubmit = (e) => {
      e.preventDefault();
      const d = formData(e.target);
      const username = (d.username||'').trim();
      const password = (d.password||'').trim();
      delete d.username; delete d.password;

      // username must be unique across all login accounts
      const clash = Store.all('users').find(u =>
        (u.username||'').toLowerCase() === username.toLowerCase() && !(acct && u.id === acct.id));
      if (clash) { toast('Username "'+username+'" already taken.'); return; }

      if (id) {
        Store.update('faculty', id, d);
        const patch = { username, role:'faculty', refId:id, name:d.name };
        if (password) patch.password = password;
        if (acct) Store.update('users', acct.id, patch);
        else Store.add('users', { username, password: password||'pass123', role:'faculty', refId:id, name:d.name });
      } else {
        const fac = Store.add('faculty', d);
        Store.add('users', { username, password, role:'faculty', refId: fac.id, name: fac.name });
      }
      closeModal(); toast('Faculty saved.'); render();
    };
  }

  // assign / unassign classes to a faculty (admin)
  function facultyClassesModal(fid, after) {
    const f = Store.find('faculty', fid); if (!f) return;
    const assigned = Store.all('courses').filter(c => c.facultyId === fid);
    const others = Store.all('courses').filter(c => c.facultyId !== fid);
    openModal('Classes — ' + f.name, `
      <p style="color:var(--muted);font-size:13px;margin-bottom:14px">${esc(f.designation || 'Faculty')} · ${esc(f.department || '')}</p>
      <h4 style="font-size:13px;color:var(--primary-dark);margin-bottom:8px">ASSIGNED CLASSES (${assigned.length})</h4>
      ${assigned.length ? `<div class="att-list">${assigned.map(c => `
        <div class="att-row"><div class="who"><strong>${esc(c.code)} — ${esc(c.name)}</strong>
          <small>${esc(c.branch)} · Sem ${c.semester} · Sec ${esc(c.section || 'A')} · ${studentsOfCourse(c).length} students</small></div>
          <button class="btn-sm btn-del" data-unassign="${c.id}">Unassign</button></div>`).join('')}</div>`
        : `<p class="empty" style="padding:14px">Abhi koi class assign nahi hai.</p>`}
      <h4 style="font-size:13px;color:var(--primary-dark);margin:18px 0 8px">ASSIGN AN EXISTING CLASS</h4>
      <div style="display:flex;gap:10px">
        <select class="filter-sel" id="asgSel" style="flex:1">
          <option value="">Select a class...</option>
          ${others.map(c => `<option value="${c.id}">${esc(c.code)} — ${esc(c.name)} (Sec ${esc(c.section || 'A')})${c.facultyId ? ' · currently ' + esc(facultyName(c.facultyId)) : ' · unassigned'}</option>`).join('')}
        </select>
        <button class="btn-primary" id="asgBtn">Assign</button>
      </div>
      <div class="form-actions" style="justify-content:space-between">
        <button class="btn-outline" id="newClassBtn">+ Create New Class</button>
        <button class="btn-primary" id="cxDone">Done</button>
      </div>`);

    const refresh = () => { if (after) after(); facultyClassesModal(fid, after); };
    $('#cxDone').onclick = () => { closeModal(); if (after) after(); };
    $('#asgBtn').onclick = () => {
      const cid = $('#asgSel').value;
      if (!cid) { toast('Pehle ek class select karein.', 'err'); return; }
      Store.update('courses', cid, { facultyId: fid });
      toast('Class assigned to ' + f.name + '.'); refresh();
    };
    $('#newClassBtn').onclick = () => { closeModal(); courseForm(null, { presetFaculty: fid }); };
    $('#modalBody').querySelectorAll('[data-unassign]').forEach(b => b.onclick = () => {
      Store.update('courses', b.dataset.unassign, { facultyId: '' });
      toast('Class unassigned.'); refresh();
    });
  }

  // ---- ASSIGNMENTS overview (admin) ----
  function viewAssignments() {
    const courses = Store.all('courses');
    const faculty = Store.all('faculty');
    const unassigned = courses.filter(c => !c.facultyId || !Store.find('faculty', c.facultyId));
    const assignedCount = courses.length - unassigned.length;

    let html = `<div class="stat-grid">
      ${statCard('🗂️', courses.length, 'Total Classes')}
      ${statCard('✅', assignedCount, 'Assigned', 'c3')}
      ${statCard('⚠️', unassigned.length, 'Unassigned', unassigned.length ? 'c4' : 'c3')}
      ${statCard('👨‍🏫', faculty.length, 'Faculty', 'c2')}
    </div>`;

    // unassigned classes — quick assign
    html += `<div class="panel" ${unassigned.length ? 'style="border-left:4px solid var(--red)"' : ''}>
      <div class="panel-head"><h3>⚠ Unassigned Classes</h3></div>
      ${unassigned.length ? `<div class="att-list">${unassigned.map(c => `
        <div class="att-row"><div class="who"><strong>${esc(c.code)} — ${esc(c.name)}</strong>
          <small>${esc(c.branch)} · Sem ${c.semester} · Sec ${esc(c.section || 'A')}</small></div>
          <div style="display:flex;gap:8px">
            <select class="filter-sel qa-sel" data-cid="${c.id}" style="min-width:170px">
              <option value="">Assign to...</option>${facultyOptions('')}</select>
            <button class="btn-sm btn-edit qa-btn" data-cid="${c.id}">Assign</button>
          </div></div>`).join('')}</div>`
        : `<p class="empty" style="padding:14px">✓ Saari classes assigned hain. Koi pending nahi.</p>`}
    </div>`;

    // by-faculty breakdown
    html += `<div class="panel"><div class="panel-head"><h3>Assignments by Faculty</h3></div>
      <div class="tbl-wrap"><table><thead><tr>
        <th>Faculty</th><th>Department</th><th>Assigned Classes</th><th># Classes</th><th>Manage</th>
      </tr></thead><tbody>${faculty.map(f => {
        const mine = courses.filter(c => c.facultyId === f.id);
        const chips = mine.length ? mine.map(c => `<span class="pill blue" style="margin:2px">${esc(c.code)} · Sec ${esc(c.section || 'A')}</span>`).join('')
                                  : `<span style="color:var(--muted);font-size:13px">— none —</span>`;
        return `<tr><td><strong>${esc(f.name)}</strong></td><td>${esc(f.department || '')}</td>
          <td>${chips}</td><td><span class="pill ${mine.length ? 'green' : 'amber'}">${mine.length}</span></td>
          <td><button class="btn-sm btn-edit" data-manage="${f.id}">📚 Manage</button></td></tr>`;
      }).join('')}</tbody></table></div></div>`;

    viewAssignments.after = () => {
      $('#view').querySelectorAll('.qa-btn').forEach(b => b.onclick = () => {
        const cid = b.dataset.cid;
        const fid = $('#view').querySelector(`.qa-sel[data-cid="${cid}"]`).value;
        if (!fid) { toast('Faculty select karein.', 'err'); return; }
        Store.update('courses', cid, { facultyId: fid });
        toast('Class assigned.'); render();
      });
      $('#view').querySelectorAll('[data-manage]').forEach(b => b.onclick = () => facultyClassesModal(b.dataset.manage, () => render()));
    };
    return html;
  }

  // ---- COURSES ----
  function viewCourses() {
    let html = `<div class="panel"><div class="panel-head">
      <h3>Courses</h3><div class="panel-tools">
        <input class="search-box" id="couSearch" placeholder="Search code / name...">
        <button class="btn-primary" id="addCou">+ Add Course</button></div></div>
      <div class="tbl-wrap"><table><thead><tr>
        <th>Code</th><th>Course Name</th><th>Branch</th><th>Sem</th><th>Section</th><th>Credits</th><th>Assigned Faculty</th><th>Actions</th>
      </tr></thead><tbody id="couBody"></tbody></table></div></div>`;
    viewCourses.after = () => {
      const draw = () => {
        const q = ($('#couSearch').value||'').toLowerCase();
        const rows = Store.all('courses').filter(c =>
          !q || c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q));
        $('#couBody').innerHTML = rows.length ? rows.map(c => `<tr>
          <td>${esc(c.code)}</td><td>${esc(c.name)}</td><td>${esc(c.branch)}</td><td>${c.semester}</td>
          <td><span class="pill blue">Sec ${esc(c.section||'A')}</span></td>
          <td>${c.credits}</td><td>${esc(facultyName(c.facultyId))}</td>
          <td><div class="row-actions">
            <button class="btn-sm btn-edit" data-edit="${c.id}">Edit</button>
            <button class="btn-sm btn-del" data-del="${c.id}">Delete</button></div></td></tr>`).join('')
          : `<tr><td colspan="8" class="empty">No courses found.</td></tr>`;
        $('#couBody').querySelectorAll('[data-edit]').forEach(b => b.onclick = () => courseForm(b.dataset.edit));
        $('#couBody').querySelectorAll('[data-del]').forEach(b => b.onclick = () => delConfirm('courses', b.dataset.del, 'course', draw));
      };
      $('#couSearch').oninput = draw;
      $('#addCou').onclick = () => courseForm();
      draw();
    };
    return html;
  }
  function courseForm(id, opts) {
    opts = opts || {};
    const c = id ? Store.find('courses', id) : (opts.presetFaculty ? { facultyId: opts.presetFaculty } : {});
    openModal((id?'Edit':'Add')+' Course', `<form id="f">
      <div class="form-grid">
        <div class="field"><label>Course Code</label><input name="code" value="${esc(c.code||'')}" required></div>
        <div class="field"><label>Course Name</label><input name="name" value="${esc(c.name||'')}" required></div>
        <div class="field"><label>Branch</label><select name="branch">${branchOptions(c.branch)}</select></div>
        <div class="field"><label>Semester</label><input name="semester" type="number" min="1" max="8" value="${c.semester||1}"></div>
        <div class="field"><label>Section</label><input name="section" value="${esc(c.section||'A')}" placeholder="e.g. A"></div>
        <div class="field"><label>Credits</label><input name="credits" type="number" min="1" max="6" value="${c.credits||3}"></div>
        <div class="field full"><label>Assign to Faculty</label><select name="facultyId">${facultyOptions(c.facultyId)}</select></div>
      </div>
      <div class="form-actions"><button type="button" class="btn-outline" id="cx">Cancel</button>
        <button type="submit" class="btn-primary">Save</button></div></form>`);
    $('#cx').onclick = closeModal;
    $('#f').onsubmit = (e) => {
      e.preventDefault();
      const d = formData(e.target);
      d.semester = +d.semester; d.credits = +d.credits;
      d.section = (d.section || 'A').toUpperCase();
      if (id) Store.update('courses', id, d); else Store.add('courses', d);
      closeModal(); toast('Course saved.'); render();
    };
  }

  // ---- ATTENDANCE (mark) ----
  function teacherCourses() {
    if (user.role === 'admin') return Store.all('courses');
    return Store.all('courses').filter(c => c.facultyId === user.refId);
  }
  // does a student belong to this course's class (branch + sem + assigned section)?
  function inCourseClass(s, c) {
    return s.branch === c.branch && s.semester === c.semester &&
           (!c.section || s.section === c.section);
  }
  function studentsOfCourse(c) {
    return Store.all('students').filter(s => inCourseClass(s, c));
  }
  function courseLabel(c) {
    return `${c.code} — ${c.name} (Sec ${c.section || 'A'})`;
  }
  // students that fall under THIS faculty's assigned classes (admin -> all)
  function visibleStudents() {
    if (user.role === 'admin') return Store.all('students');
    const classes = teacherCourses();
    return Store.all('students').filter(s => classes.some(c => inCourseClass(s, c)));
  }
  function viewAttendance() {
    const courses = teacherCourses();
    let html = `<div class="panel"><div class="panel-head"><h3>Mark Attendance</h3>
      <div class="panel-tools">
        <select class="filter-sel" id="attCourse"><option value="">Select class...</option>
          ${courses.map(c => `<option value="${c.id}">${esc(courseLabel(c))}</option>`).join('')}</select>
        <input class="filter-sel" type="date" id="attDate" value="${today()}">
      </div></div>
      ${courses.length ? '' : `<p class="empty">Aapko abhi koi class assign nahi hui. System Admin se assignment karwayein.</p>`}
      <div id="attArea"><p class="empty">Class aur date select karke attendance mark karein.</p></div></div>`;

    const summaryStudents = visibleStudents();
    html += `<div class="panel"><div class="panel-head"><h3>Attendance Summary (by student)</h3></div>
      <div class="tbl-wrap"><table><thead><tr><th>Roll</th><th>Name</th><th>Branch</th><th>Sec</th><th>Attendance %</th></tr></thead>
      <tbody>${summaryStudents.length ? summaryStudents.map(s => `<tr><td>${esc(s.roll)}</td><td>${esc(s.name)}</td>
        <td>${esc(s.branch)}</td><td>${esc(s.section)}</td><td>${attBar(studentAttendancePct(s.id))}</td></tr>`).join('')
        : `<tr><td colspan="5" class="empty">No students in your assigned classes.</td></tr>`}</tbody></table></div></div>`;

    viewAttendance.after = () => {
      const renderArea = () => {
        const cid = $('#attCourse').value, date = $('#attDate').value;
        const area = $('#attArea');
        if (!cid || !date) { area.innerHTML = `<p class="empty">Course aur date select karein.</p>`; return; }
        const c = Store.find('courses', cid);
        const studs = studentsOfCourse(c);
        if (!studs.length) { area.innerHTML = `<p class="empty">Is class (Sec ${esc(c.section||'A')}) me koi student nahi.</p>`; return; }
        let session = Store.all('attendance').find(a => a.courseId === cid && a.date === date);
        const rec = session ? session.records : {};
        area.innerHTML = `<div class="att-list">${studs.map(s => {
          const st = rec[s.id] || 'P';
          return `<div class="att-row"><div class="who"><strong>${esc(s.name)}</strong><small>${esc(s.roll)}</small></div>
            <div class="att-toggle" data-sid="${s.id}">
              <button type="button" class="toggle-btn p ${st==='P'?'on':''}" data-v="P">Present</button>
              <button type="button" class="toggle-btn a ${st==='A'?'on':''}" data-v="A">Absent</button>
            </div></div>`;
        }).join('')}</div>
        <div class="form-actions"><button class="btn-primary" id="saveAtt">Save Attendance</button></div>`;

        area.querySelectorAll('.att-toggle').forEach(grp => {
          grp.querySelectorAll('.toggle-btn').forEach(btn => btn.onclick = () => {
            grp.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('on'));
            btn.classList.add('on');
          });
        });
        $('#saveAtt').onclick = () => {
          const records = {};
          area.querySelectorAll('.att-toggle').forEach(grp => {
            const on = grp.querySelector('.toggle-btn.on');
            records[grp.dataset.sid] = on ? on.dataset.v : 'P';
          });
          if (session) Store.update('attendance', session.id, { records });
          else Store.add('attendance', { courseId: cid, date, records });
          toast('Attendance saved.'); render();
        };
      };
      $('#attCourse').onchange = renderArea;
      $('#attDate').onchange = renderArea;
    };
    return html;
  }

  // ---- MARKS (admin/faculty) ----
  function viewMarks() {
    const courses = teacherCourses();
    let html = `<div class="panel"><div class="panel-head"><h3>Enter / Edit Marks</h3>
      <div class="panel-tools">
        <select class="filter-sel" id="mkCourse"><option value="">Select class...</option>
          ${courses.map(c => `<option value="${c.id}">${esc(courseLabel(c))}</option>`).join('')}</select>
      </div></div>
      ${courses.length ? '' : `<p class="empty" style="padding:0 0 14px">Aapko abhi koi class assign nahi hui. System Admin se assignment karwayein.</p>`}
      <div id="mkArea"><p class="empty">Class select karke marks bharein. (Internal /40, External /60)</p></div></div>`;
    viewMarks.after = () => {
      $('#mkCourse').onchange = () => {
        const cid = $('#mkCourse').value, area = $('#mkArea');
        if (!cid) { area.innerHTML = `<p class="empty">Class select karein.</p>`; return; }
        const c = Store.find('courses', cid);
        const studs = studentsOfCourse(c);
        area.innerHTML = `<div class="tbl-wrap"><table><thead><tr>
          <th>Roll</th><th>Name</th><th>Internal /40</th><th>External /60</th><th>Total</th><th>Grade</th>
        </tr></thead><tbody>${studs.map(s => {
          const m = Store.all('marks').find(x => x.studentId === s.id && x.courseId === cid) || {};
          const total = (m.internal||0)+(m.external||0);
          const g = gradeFor(total);
          return `<tr data-sid="${s.id}"><td>${esc(s.roll)}</td><td>${esc(s.name)}</td>
            <td><input class="filter-sel mk-int" style="width:80px" type="number" min="0" max="40" value="${m.internal??''}"></td>
            <td><input class="filter-sel mk-ext" style="width:80px" type="number" min="0" max="60" value="${m.external??''}"></td>
            <td class="mk-tot">${total||'—'}</td><td class="mk-grd"><span class="pill ${g.p?'blue':'red'}">${total?g.g:'—'}</span></td></tr>`;
        }).join('')}</tbody></table></div>
        <div class="form-actions"><button class="btn-primary" id="saveMk">Save Marks</button></div>`;

        area.querySelectorAll('tr[data-sid]').forEach(tr => {
          const upd = () => {
            const i = +tr.querySelector('.mk-int').value||0, e = +tr.querySelector('.mk-ext').value||0;
            const t = i+e, g = gradeFor(t);
            tr.querySelector('.mk-tot').textContent = (tr.querySelector('.mk-int').value||tr.querySelector('.mk-ext').value)?t:'—';
            tr.querySelector('.mk-grd').innerHTML = `<span class="pill ${g.p?'blue':'red'}">${t?g.g:'—'}</span>`;
          };
          tr.querySelectorAll('input').forEach(inp => inp.oninput = upd);
        });
        $('#saveMk').onclick = () => {
          area.querySelectorAll('tr[data-sid]').forEach(tr => {
            const sid = tr.dataset.sid;
            const iv = tr.querySelector('.mk-int').value, ev = tr.querySelector('.mk-ext').value;
            if (iv === '' && ev === '') return;
            const internal = +iv||0, external = +ev||0;
            const existing = Store.all('marks').find(x => x.studentId === sid && x.courseId === cid);
            if (existing) Store.update('marks', existing.id, { internal, external });
            else Store.add('marks', { studentId: sid, courseId: cid, internal, external });
          });
          toast('Marks saved.');
        };
      };
    };
    return html;
  }

  // ---- TIMETABLE ----
  const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat'];
  const PERIODS = [1,2,3,4,5];
  function viewTimetable() {
    // determine scope
    let branch, semester, section;
    if (user.role === 'student') {
      const s = Store.find('students', user.refId);
      branch = s.branch; semester = s.semester; section = s.section;
    }
    const isAdmin = user.role === 'admin';
    let html = `<div class="panel"><div class="panel-head"><h3>Class Timetable</h3>
      <div class="panel-tools">`;
    if (user.role !== 'student') {
      html += `<select class="filter-sel" id="ttBranch">${branchOptions('CSE')}</select>
        <select class="filter-sel" id="ttSem">${[...Array(8)].map((_,i)=>`<option value="${i+1}" ${i+1===5?'selected':''}>Sem ${i+1}</option>`).join('')}</select>
        <input class="filter-sel" id="ttSec" value="A" style="width:60px">`;
      if (isAdmin) html += `<button class="btn-primary" id="addSlot">+ Add Slot</button>`;
    } else {
      html += `<span class="pill blue">${esc(branch)} · Sem ${semester} · Sec ${section}</span>`;
    }
    html += `</div></div><div id="ttArea" class="tt-grid"></div></div>`;

    viewTimetable.after = () => {
      const draw = () => {
        const b = user.role==='student'? branch : $('#ttBranch').value;
        const sem = user.role==='student'? semester : +$('#ttSem').value;
        const sec = user.role==='student'? section : $('#ttSec').value;
        const slots = Store.all('timetable').filter(t => t.branch===b && t.semester===sem && t.section===sec);
        const lookup = {};
        slots.forEach(t => lookup[t.day+'-'+t.period] = t);
        $('#ttArea').innerHTML = `<table><thead><tr><th>Day / Period</th>${PERIODS.map(p=>`<th>P${p}</th>`).join('')}</tr></thead>
          <tbody>${DAYS.map(d => `<tr><th>${d}</th>${PERIODS.map(p => {
            const t = lookup[d+'-'+p];
            if (!t) return `<td>—</td>`;
            const c = Store.find('courses', t.courseId);
            return `<td><div class="tt-cell"><strong>${c?esc(c.code):'?'}</strong>
              <small>${c?esc(facultyName(c.facultyId).split(' ').slice(-1)):''}</small>
              ${isAdmin?`<button class="btn-sm btn-del" data-del="${t.id}" style="margin-top:4px">✕</button>`:''}</div></td>`;
          }).join('')}</tr>`).join('')}</tbody></table>`;
        if (isAdmin) $('#ttArea').querySelectorAll('[data-del]').forEach(btn =>
          btn.onclick = () => { Store.remove('timetable', btn.dataset.del); toast('Slot removed.'); draw(); });
      };
      if (user.role !== 'student') {
        $('#ttBranch').onchange = draw; $('#ttSem').onchange = draw; $('#ttSec').oninput = draw;
        if (isAdmin) $('#addSlot').onclick = () => slotForm(draw);
      }
      draw();
    };
    return html;
  }
  function slotForm(after) {
    openModal('Add Timetable Slot', `<form id="f"><div class="form-grid">
      <div class="field"><label>Branch</label><select name="branch">${branchOptions('CSE')}</select></div>
      <div class="field"><label>Semester</label><input name="semester" type="number" min="1" max="8" value="5"></div>
      <div class="field"><label>Section</label><input name="section" value="A"></div>
      <div class="field"><label>Day</label><select name="day">${DAYS.map(d=>`<option>${d}</option>`).join('')}</select></div>
      <div class="field"><label>Period</label><select name="period">${PERIODS.map(p=>`<option value="${p}">P${p}</option>`).join('')}</select></div>
      <div class="field"><label>Course</label><select name="courseId">${Store.all('courses').map(c=>`<option value="${c.id}">${esc(c.code)} — ${esc(c.name)}</option>`).join('')}</select></div>
    </div><div class="form-actions"><button type="button" class="btn-outline" id="cx">Cancel</button>
      <button type="submit" class="btn-primary">Add</button></div></form>`);
    $('#cx').onclick = closeModal;
    $('#f').onsubmit = (e) => {
      e.preventDefault();
      const d = formData(e.target); d.semester=+d.semester; d.period=+d.period;
      Store.add('timetable', d); closeModal(); toast('Slot added.'); after();
    };
  }

  // ---- FEES (admin) ----
  function viewFees() {
    let html = `<div class="panel"><div class="panel-head"><h3>Fee Records</h3>
      <div class="panel-tools"><input class="search-box" id="feeSearch" placeholder="Search student..."></div></div>
      <div class="tbl-wrap"><table><thead><tr>
        <th>Roll</th><th>Student</th><th>Total</th><th>Paid</th><th>Due</th><th>Status</th><th>Due Date</th><th>Action</th>
      </tr></thead><tbody id="feeBody"></tbody></table></div></div>`;
    viewFees.after = () => {
      const draw = () => {
        const q = ($('#feeSearch').value||'').toLowerCase();
        const rows = Store.all('fees').filter(f => {
          const s = Store.find('students', f.studentId);
          return s && (!q || s.name.toLowerCase().includes(q) || s.roll.toLowerCase().includes(q));
        });
        $('#feeBody').innerHTML = rows.length ? rows.map(f => {
          const s = Store.find('students', f.studentId) || {};
          const due = Math.max(0, f.total - f.paid);
          const st = due===0 ? ['green','Paid'] : f.paid===0 ? ['red','Unpaid'] : ['amber','Partial'];
          return `<tr><td>${esc(s.roll)}</td><td>${esc(s.name)}</td><td>${money(f.total)}</td>
            <td>${money(f.paid)}</td><td>${money(due)}</td><td><span class="pill ${st[0]}">${st[1]}</span></td>
            <td>${esc(f.dueDate)}</td>
            <td><button class="btn-sm btn-edit" data-pay="${f.id}">Record Payment</button></td></tr>`;
        }).join('') : `<tr><td colspan="8" class="empty">No fee records.</td></tr>`;
        $('#feeBody').querySelectorAll('[data-pay]').forEach(b => b.onclick = () => payForm(b.dataset.pay, draw));
      };
      $('#feeSearch').oninput = draw;
      draw();
    };
    return html;
  }
  function payForm(id, after) {
    const f = Store.find('fees', id); const s = Store.find('students', f.studentId)||{};
    const due = Math.max(0, f.total - f.paid);
    openModal('Record Payment', `<form id="f">
      <p style="margin-bottom:14px;color:var(--muted)">${esc(s.name)} (${esc(s.roll)}) · Due: <strong>${money(due)}</strong></p>
      <div class="field full"><label>Payment Amount (₹)</label><input name="amt" type="number" min="1" max="${due}" value="${due}" required></div>
      <div class="form-actions"><button type="button" class="btn-outline" id="cx">Cancel</button>
        <button type="submit" class="btn-primary">Confirm Payment</button></div></form>`);
    $('#cx').onclick = closeModal;
    $('#f').onsubmit = (e) => {
      e.preventDefault();
      const amt = +formData(e.target).amt;
      Store.update('fees', id, { paid: Math.min(f.total, f.paid + amt) });
      closeModal(); toast('Payment of '+money(amt)+' recorded.'); after();
    };
  }

  /* ---------- STUDENT self-service views ---------- */
  function viewMyAttendance() {
    const sid = user.refId;
    const sessions = Store.all('attendance').filter(a => sid in a.records)
      .sort((a,b) => b.date.localeCompare(a.date));
    const pct = studentAttendancePct(sid);
    let html = `<div class="panel"><div class="panel-head"><h3>Overall Attendance</h3></div>
      <p style="font-size:15px">Total: <strong>${attBar(pct)}</strong> across ${sessions.length} sessions.</p>
      ${pct!==null && pct<75 ? `<p style="color:var(--red);margin-top:8px">⚠ Below 75% — please attend classes regularly.</p>`:''}</div>`;
    html += `<div class="panel"><div class="panel-head"><h3>Session History</h3></div><div class="tbl-wrap"><table>
      <thead><tr><th>Date</th><th>Course</th><th>Status</th></tr></thead><tbody>
      ${sessions.length? sessions.map(a => `<tr><td>${esc(a.date)}</td><td>${esc(courseName(a.courseId))}</td>
        <td><span class="pill ${a.records[sid]==='P'?'green':'red'}">${a.records[sid]==='P'?'Present':'Absent'}</span></td></tr>`).join('')
        : `<tr><td colspan="3" class="empty">No records.</td></tr>`}</tbody></table></div></div>`;
    return html;
  }

  function viewMyResults() {
    const sid = user.refId;
    const ms = Store.all('marks').filter(m => m.studentId === sid);
    const gpa = studentGPA(sid);
    let html = `<div class="panel"><div class="report-head">
      <div><h3 style="color:var(--primary-dark)">Academic Report Card</h3>
      <p style="color:var(--muted);font-size:14px">${esc(studentName(sid))} · ${esc((Store.find('students',sid)||{}).roll||'')}</p></div>
      <div class="gpa-box"><div class="v">${gpa ?? '—'}</div><div class="l">GPA</div></div></div>
      <div class="tbl-wrap"><table><thead><tr>
        <th>Code</th><th>Course</th><th>Credits</th><th>Internal</th><th>External</th><th>Total</th><th>Grade</th>
      </tr></thead><tbody>${ms.length? ms.map(m => {
        const c = Store.find('courses', m.courseId)||{};
        const total = (m.internal||0)+(m.external||0); const g = gradeFor(total);
        return `<tr><td>${esc(c.code||'')}</td><td>${esc(c.name||'')}</td><td>${c.credits||'—'}</td>
          <td>${m.internal??'—'}</td><td>${m.external??'—'}</td><td>${total}</td>
          <td><span class="pill ${g.p?'blue':'red'}">${g.g}</span></td></tr>`;
      }).join('') : `<tr><td colspan="7" class="empty">No results published yet.</td></tr>`}</tbody></table></div>
      ${ms.length ? `<div class="form-actions" style="justify-content:flex-start"><button class="btn-primary" id="dlSheet">📄 Download Marksheet (PDF)</button></div>` : ''}</div>`;
    viewMyResults.after = () => { const b = $('#dlSheet'); if (b) b.onclick = () => printMarksheet(sid); };
    return html;
  }

  function viewMyFees() {
    const sid = user.refId;
    const f = Store.all('fees').find(x => x.studentId === sid);
    if (!f) return `<div class="panel"><p class="empty">No fee record found.</p></div>`;
    const due = Math.max(0, f.total - f.paid);
    const st = due===0 ? ['green','Fully Paid'] : f.paid===0 ? ['red','Unpaid'] : ['amber','Partially Paid'];
    return `<div class="stat-grid">
      ${statCard('💰', money(f.total), 'Total Fees')}
      ${statCard('✅', money(f.paid), 'Paid', 'c3')}
      ${statCard('⏳', money(due), 'Balance Due', due>0?'c4':'c3')}
    </div>
    <div class="panel"><div class="panel-head"><h3>Fee Details</h3></div>
      <p>Status: <span class="pill ${st[0]}">${st[1]}</span></p>
      <p style="margin-top:10px">Due date: <strong>${esc(f.dueDate)}</strong></p>
      ${due>0?`<p style="margin-top:10px;color:var(--muted)">Payment ke liye accounts office / portal use karein.</p>`:''}</div>`;
  }

  function viewProfile() {
    viewProfile.after = null;
    if (user.role === 'student') {
      const s = Store.find('students', user.refId)||{};
      viewProfile.after = () => {
        const b = $('#printId'); if (b) b.onclick = () => printIdCard(s.id);
        const m = $('#printSheet'); if (m) m.onclick = () => printMarksheet(s.id);
      };
      return profileCard([['Roll Number',s.roll],['Name',s.name],['Email',s.email],['Phone',s.phone],
        ['Branch',s.branch],['Year',s.year],['Semester',s.semester],['Section',s.section]],
        `<button class="btn-primary" id="printId">🪪 Print ID Card</button>
         <button class="btn-outline" id="printSheet">📄 Download Marksheet</button>`);
    }
    if (user.role === 'faculty') {
      const f = Store.find('faculty', user.refId)||{};
      const mine = Store.all('courses').filter(c => c.facultyId === f.id);
      return profileCard([['Employee ID',f.empId],['Name',f.name],['Department',f.department],
        ['Designation',f.designation],['Email',f.email],['Phone',f.phone],
        ['Courses Teaching', mine.map(c=>c.code).join(', ')||'—']]);
    }
    return profileCard([['Username',user.username],['Role',user.role]]);
  }
  function profileCard(rows, actions) {
    return `<div class="panel" style="max-width:560px">
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px">
        <div class="logo-circle">${esc((user.name||'U')[0])}</div>
        <div><h3 style="color:var(--primary-dark)">${esc(user.name)}</h3>
        <span class="role-badge">${esc(user.role)}</span></div></div>
      <table><tbody>${rows.map(([k,v]) => `<tr><td style="font-weight:600;width:180px">${esc(k)}</td>
        <td>${esc(v??'—')}</td></tr>`).join('')}</tbody></table>
      ${actions ? `<div class="form-actions" style="justify-content:flex-start">${actions}</div>` : ''}</div>`;
  }

  /* ========================================================= */
  /*  LIBRARY                                                   */
  /* ========================================================= */
  function viewLibrary() {
    let html = `<div class="panel"><div class="panel-head"><h3>Books Catalogue</h3>
      <div class="panel-tools">
        <input class="search-box" id="bkSearch" placeholder="Search title / author / category...">
        <button class="btn-primary" id="addBook">+ Add Book</button></div></div>
      <div class="tbl-wrap"><table><thead><tr>
        <th>ISBN</th><th>Title</th><th>Author</th><th>Category</th><th>Total</th><th>Available</th><th>Actions</th>
      </tr></thead><tbody id="bkBody"></tbody></table></div></div>`;

    html += `<div class="panel"><div class="panel-head"><h3>Issue a Book</h3></div>
      <div class="panel-tools">
        <select class="filter-sel" id="issBook" style="min-width:240px"><option value="">Select book...</option></select>
        <select class="filter-sel" id="issStudent" style="min-width:220px"><option value="">Select student...</option>
          ${Store.all('students').map(s => `<option value="${s.id}">${esc(s.roll)} — ${esc(s.name)}</option>`).join('')}</select>
        <button class="btn-primary" id="doIssue">Issue (14 days)</button>
      </div></div>`;

    html += `<div class="panel"><div class="panel-head"><h3>Currently Issued</h3></div>
      <div class="tbl-wrap"><table><thead><tr>
        <th>Book</th><th>Student</th><th>Issued On</th><th>Due Date</th><th>Status</th><th>Action</th>
      </tr></thead><tbody id="issBody"></tbody></table></div></div>`;

    viewLibrary.after = () => {
      const drawBooks = () => {
        const q = ($('#bkSearch').value||'').toLowerCase();
        const rows = Store.all('books').filter(b =>
          !q || b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q) || (b.category||'').toLowerCase().includes(q));
        $('#bkBody').innerHTML = rows.length ? rows.map(b => `<tr>
          <td>${esc(b.isbn)}</td><td>${esc(b.title)}</td><td>${esc(b.author)}</td><td>${esc(b.category)}</td>
          <td>${b.total}</td><td><span class="pill ${b.available>0?'green':'red'}">${b.available}</span></td>
          <td><div class="row-actions">
            <button class="btn-sm btn-edit" data-edit="${b.id}">Edit</button>
            <button class="btn-sm btn-del" data-del="${b.id}">Delete</button></div></td></tr>`).join('')
          : `<tr><td colspan="7" class="empty">No books found.</td></tr>`;
        $('#bkBody').querySelectorAll('[data-edit]').forEach(x => x.onclick = () => bookForm(x.dataset.edit, refresh));
        $('#bkBody').querySelectorAll('[data-del]').forEach(x => x.onclick = () => delConfirm('books', x.dataset.del, 'book', refresh));
      };
      const drawIssueOptions = () => {
        $('#issBook').innerHTML = `<option value="">Select book...</option>` +
          Store.all('books').filter(b => b.available > 0)
            .map(b => `<option value="${b.id}">${esc(b.title)} (${b.available} left)</option>`).join('');
      };
      const drawIssued = () => {
        const active = Store.all('issues').filter(i => !i.returnDate);
        $('#issBody').innerHTML = active.length ? active.map(i => {
          const b = Store.find('books', i.bookId)||{}; const s = Store.find('students', i.studentId)||{};
          const overdue = i.dueDate < today();
          return `<tr><td>${esc(b.title||'?')}</td><td>${esc(s.name||'?')} (${esc(s.roll||'')})</td>
            <td>${esc(i.issueDate)}</td><td>${esc(i.dueDate)}</td>
            <td><span class="pill ${overdue?'red':'green'}">${overdue?'Overdue':'On loan'}</span></td>
            <td><button class="btn-sm btn-edit" data-ret="${i.id}">Return</button></td></tr>`;
        }).join('') : `<tr><td colspan="6" class="empty">No books currently issued.</td></tr>`;
        $('#issBody').querySelectorAll('[data-ret]').forEach(x => x.onclick = () => { returnBook(x.dataset.ret); refresh(); });
      };
      const refresh = () => { drawBooks(); drawIssueOptions(); drawIssued(); };

      $('#bkSearch').oninput = drawBooks;
      $('#addBook').onclick = () => bookForm(null, refresh);
      $('#doIssue').onclick = () => {
        const bookId = $('#issBook').value, studentId = $('#issStudent').value;
        if (!bookId || !studentId) { toast('Book aur student dono select karein.','err'); return; }
        issueBook(bookId, studentId); refresh();
      };
      refresh();
    };
    return html;
  }

  function bookForm(id, after) {
    const b = id ? Store.find('books', id) : {};
    openModal((id?'Edit':'Add')+' Book', `<form id="f">
      <div class="form-grid">
        <div class="field full"><label>Title</label><input name="title" value="${esc(b.title||'')}" required></div>
        <div class="field"><label>Author</label><input name="author" value="${esc(b.author||'')}"></div>
        <div class="field"><label>ISBN</label><input name="isbn" value="${esc(b.isbn||'')}"></div>
        <div class="field"><label>Category</label><input name="category" value="${esc(b.category||'')}"></div>
        <div class="field"><label>Total Copies</label><input name="total" type="number" min="1" value="${b.total||1}"></div>
      </div>
      <div class="form-actions"><button type="button" class="btn-outline" id="cx">Cancel</button>
        <button type="submit" class="btn-primary">Save</button></div></form>`);
    $('#cx').onclick = closeModal;
    $('#f').onsubmit = (e) => {
      e.preventDefault();
      const d = formData(e.target); const total = +d.total||1;
      if (id) {
        const issuedOut = b.total - b.available;            // keep availability consistent
        Store.update('books', id, { title:d.title, author:d.author, isbn:d.isbn, category:d.category,
          total, available: Math.max(0, total - issuedOut) });
      } else {
        Store.add('books', { title:d.title, author:d.author, isbn:d.isbn, category:d.category, total, available: total });
      }
      closeModal(); toast('Book saved.'); after();
    };
  }

  function issueBook(bookId, studentId) {
    const b = Store.find('books', bookId);
    if (!b || b.available <= 0) { toast('Book available nahi hai.','err'); return; }
    Store.add('issues', { bookId, studentId, issueDate: today(), dueDate: addDays(today(), 14), returnDate: '' });
    Store.update('books', bookId, { available: b.available - 1 });
    toast('Book issued.');
  }
  function returnBook(issueId) {
    const i = Store.find('issues', issueId);
    if (!i || i.returnDate) return;
    Store.update('issues', issueId, { returnDate: today() });
    const b = Store.find('books', i.bookId);
    if (b) Store.update('books', i.bookId, { available: Math.min(b.total, b.available + 1) });
    toast('Book returned.');
  }

  // student's library view
  function viewMyBooks() {
    const sid = user.refId;
    const mine = Store.all('issues').filter(i => i.studentId === sid)
      .sort((a,b) => (b.issueDate||'').localeCompare(a.issueDate||''));
    const active = mine.filter(i => !i.returnDate);
    let html = `<div class="stat-grid">
      ${statCard('📖', active.length, 'Books on Loan')}
      ${statCard('⏰', active.filter(i=>i.dueDate<today()).length, 'Overdue', 'c4')}
      ${statCard('📚', mine.length, 'Total Borrowed', 'c3')}
    </div>`;
    html += `<div class="panel"><div class="panel-head"><h3>My Borrowed Books</h3></div>
      <div class="tbl-wrap"><table><thead><tr>
        <th>Title</th><th>Author</th><th>Issued On</th><th>Due Date</th><th>Status</th>
      </tr></thead><tbody>${mine.length ? mine.map(i => {
        const b = Store.find('books', i.bookId)||{};
        let st;
        if (i.returnDate) st = `<span class="pill blue">Returned ${esc(i.returnDate)}</span>`;
        else st = i.dueDate < today() ? `<span class="pill red">Overdue</span>` : `<span class="pill green">On loan</span>`;
        return `<tr><td>${esc(b.title||'?')}</td><td>${esc(b.author||'')}</td>
          <td>${esc(i.issueDate)}</td><td>${esc(i.dueDate)}</td><td>${st}</td></tr>`;
      }).join('') : `<tr><td colspan="5" class="empty">Aapne abhi koi book issue nahi karayi.</td></tr>`}</tbody></table></div></div>`;
    return html;
  }

  /* ========================================================= */
  /*  PRINTABLE DOCUMENTS (ID card / Marksheet -> PDF)          */
  /* ========================================================= */
  function printDoc(title, inner) {
    const w = window.open('', '_blank', 'width=900,height=700');
    if (!w) { toast('Popup blocked — allow popups to print.','err'); return; }
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
    <style>
      *{box-sizing:border-box;margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif}
      body{padding:28px;color:#1f2a37}
      .doc-head{display:flex;align-items:center;gap:16px;border-bottom:3px solid #1c7c3c;padding-bottom:14px;margin-bottom:20px}
      .doc-head img{width:64px;height:64px;object-fit:contain}
      .doc-head h1{font-size:22px;color:#11592a}
      .doc-head p{font-size:13px;color:#555}
      table{width:100%;border-collapse:collapse;margin-top:10px;font-size:14px}
      th,td{border:1px solid #cfd8dc;padding:9px 11px;text-align:left}
      th{background:#e7f4ec;color:#11592a}
      .gpa{margin-top:16px;font-size:16px}
      .gpa b{color:#11592a;font-size:20px}
      .sign{margin-top:60px;display:flex;justify-content:space-between;font-size:13px;color:#555}
      .sign span{border-top:1px solid #888;padding-top:6px}
      /* ID card */
      .idcard{width:340px;border:2px solid #1c7c3c;border-radius:14px;overflow:hidden;margin:0 auto}
      .idcard .top{background:#1c7c3c;color:#fff;display:flex;align-items:center;gap:10px;padding:12px 14px}
      .idcard .top img{width:42px;height:42px;background:#fff;border-radius:8px;padding:3px}
      .idcard .top strong{font-size:16px;display:block}
      .idcard .top small{font-size:10px;opacity:.9}
      .idcard .body{padding:16px;display:flex;gap:14px}
      .idcard .photo{width:78px;height:90px;border:1px solid #cfd8dc;border-radius:8px;display:flex;
        align-items:center;justify-content:center;font-size:30px;font-weight:700;color:#1c7c3c;background:#e7f4ec}
      .idcard .info{font-size:12.5px;line-height:1.7}
      .idcard .info b{color:#11592a}
      .idcard .foot{background:#e7f4ec;font-size:10.5px;text-align:center;padding:7px;color:#555}
      @media print{body{padding:0}.noprint{display:none}}
    </style></head><body>${inner}
    <script>window.onload=function(){window.print();}<\/script></body></html>`);
    w.document.close();
  }
  function docHeader() {
    const logo = location.origin + '/assets/gitam-logo.png';
    return `<div class="doc-head"><img src="${logo}" alt="GITAM">
      <div><h1>GITAM</h1>
      <p>Gandhi Institute of Technology and Management · Bhubaneswar</p></div></div>`;
  }
  function printIdCard(sid) {
    const s = Store.find('students', sid); if (!s) return;
    const logo = location.origin + '/assets/gitam-logo.png';
    const inner = `<div class="idcard">
      <div class="top"><img src="${logo}"><div><strong>GITAM</strong><small>STUDENT IDENTITY CARD</small></div></div>
      <div class="body">
        <div class="photo">${esc((s.name||'?')[0])}</div>
        <div class="info">
          <div><b>Name:</b> ${esc(s.name)}</div>
          <div><b>Roll No:</b> ${esc(s.roll)}</div>
          <div><b>Branch:</b> ${esc(s.branch)}</div>
          <div><b>Year/Sem:</b> ${esc(s.year)} / ${esc(s.semester)}</div>
          <div><b>Section:</b> ${esc(s.section)}</div>
          <div><b>Phone:</b> ${esc(s.phone||'—')}</div>
        </div>
      </div>
      <div class="foot">Valid for Academic Year 2026-27 · Property of GITAM, Bhubaneswar</div>
    </div>`;
    printDoc('ID Card - ' + s.roll, inner);
  }
  function printMarksheet(sid) {
    const s = Store.find('students', sid); if (!s) return;
    const ms = Store.all('marks').filter(m => m.studentId === sid);
    const gpa = studentGPA(sid);
    const rows = ms.map(m => {
      const c = Store.find('courses', m.courseId)||{};
      const total = (m.internal||0)+(m.external||0); const g = gradeFor(total);
      return `<tr><td>${esc(c.code||'')}</td><td>${esc(c.name||'')}</td><td>${c.credits||'—'}</td>
        <td>${m.internal??'—'}</td><td>${m.external??'—'}</td><td>${total}</td><td>${g.g}</td></tr>`;
    }).join('') || `<tr><td colspan="7" style="text-align:center">No results published.</td></tr>`;
    const inner = `${docHeader()}
      <h2 style="font-size:17px;color:#11592a;margin-bottom:10px">Statement of Grades</h2>
      <table style="margin-bottom:6px"><tbody>
        <tr><th style="width:120px">Name</th><td>${esc(s.name)}</td><th style="width:120px">Roll No</th><td>${esc(s.roll)}</td></tr>
        <tr><th>Branch</th><td>${esc(s.branch)}</td><th>Semester</th><td>${esc(s.semester)}</td></tr>
      </tbody></table>
      <table><thead><tr><th>Code</th><th>Course</th><th>Credits</th><th>Internal</th><th>External</th><th>Total</th><th>Grade</th></tr></thead>
        <tbody>${rows}</tbody></table>
      <div class="gpa">GPA: <b>${gpa ?? '—'}</b> / 10</div>
      <div class="sign"><span>Controller of Examinations</span><span>Registrar</span></div>`;
    printDoc('Marksheet - ' + s.roll, inner);
  }

  /* ---------- shared form utils ---------- */
  function formData(form) {
    const o = {};
    new FormData(form).forEach((v, k) => o[k] = typeof v === 'string' ? v.trim() : v);
    return o;
  }
  function branchOptions(sel) {
    return ['CSE','ECE','ME','EEE','CIVIL','IT'].map(b =>
      `<option ${b===sel?'selected':''}>${b}</option>`).join('');
  }
  function facultyOptions(sel) {
    return Store.all('faculty').map(f =>
      `<option value="${f.id}" ${f.id===sel?'selected':''}>${esc(f.name)}</option>`).join('');
  }
  function delConfirm(col, id, label, after) {
    openModal('Delete ' + label, `<p>Kya aap is ${label} ko delete karna chahte hain? Ye action wapas nahi hoga.</p>
      <div class="form-actions"><button class="btn-outline" id="cx">Cancel</button>
        <button class="btn-primary" style="background:var(--red)" id="ok">Delete</button></div>`);
    $('#cx').onclick = closeModal;
    $('#ok').onclick = () => { Store.remove(col, id); closeModal(); toast(label+' deleted.','err'); after ? after() : render(); };
  }
  function today() { const d = new Date(); return d.toISOString().slice(0,10); }
  function addDays(dateStr, n) {
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0,10);
  }

  /* ========================================================= */
  /*  BOOT                                                      */
  /* ========================================================= */
  function startApp() {
    $('#loginScreen').classList.add('hidden');
    $('#appScreen').classList.remove('hidden');
    $('#topUserName').textContent = user.name;
    $('#topUserRole').textContent = user.role;
    $('#sideUser').innerHTML = `<span class="side-avatar">${esc((user.name || 'U')[0])}</span>
      <span class="su-meta"><strong>${esc(user.name)}</strong><small>${esc(user.role)} · @${esc(user.username)}</small></span>`;
    currentView = 'dashboard';
    buildNav();
    render();
  }

  async function init() {
    $('#year').textContent = new Date().getFullYear();
    $('#loginForm').onsubmit = doLogin;
    $('#logoutBtn').onclick = logout;
    $('#modalClose').onclick = closeModal;
    $('#modalOverlay').onclick = (e) => { if (e.target.id === 'modalOverlay') closeModal(); };
    $('#menuToggle').onclick = toggleSidebar;
    // apply saved collapsed preference (desktop)
    if (localStorage.getItem(SIDEBAR_KEY) === '1') document.body.classList.add('sidebar-collapsed');

    // restore session (re-fetch fresh data from server)
    const uid = sessionStorage.getItem('gitam_user');
    if (uid) {
      try {
        await Store.load();
        const u = Store.find('users', uid);
        if (u) { user = u; startApp(); }
      } catch (e) { /* server down — stay on login screen */ }
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
