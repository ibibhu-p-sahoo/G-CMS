# GITAM College Management System

GITAM (Bhubaneswar) ka college management system — **real backend + permanent database** ke saath. Logo aur campus images bhi GITAM ki actual website se liye gaye hain.

- **Frontend:** HTML + CSS + vanilla JavaScript (GITAM blue theme + official logo)
- **Backend:** Python (standard library only — `http.server` + `sqlite3`)
- **Database:** SQLite (`gitam.db`) — data **permanently** save hota hai, browser clear karne pe bhi nahi jata

> Koi extra installation nahi chahiye. Bas Python hona chahiye (aapke system me Python 3.14 already hai).

## Kaise chalayein

1. Terminal/PowerShell me is folder me jao:
   ```
   cd "D:\G CLONE"
   python server.py
   ```
2. Browser me kholo: **http://localhost:5500**
3. Band karne ke liye terminal me `Ctrl + C`.

Pehli baar chalane par `gitam.db` automatically ban jata hai aur demo data se bhar jata hai.

## Docker se chalana (3 containers)

Docker me app **3 alag containers** me chalta hai:

| Container | Kaam | Tech |
|---|---|---|
| 🟦 `gitam-frontend` | UI serve + `/api` proxy | Nginx |
| 🟩 `gitam-backend` | REST API | Python |
| 🟨 `gitam-db` | Database | PostgreSQL |

```
docker compose up -d --build      # teeno build + start
```
Browser me kholo: **http://localhost:5500**

```
docker compose ps                 # teeno containers dekho
docker compose logs -f backend    # kisi container ke logs
docker compose down               # sab band (database volume safe rehta hai)
```

**Docker Desktop me kahan dikhega:**
- **Containers** tab → `gitam-frontend`, `gitam-backend`, `gitam-db` (teeno alag)
- **Volumes** tab → `gclone_gitam-pgdata` (PostgreSQL ka data — restart/rebuild pe bhi safe)

**Flow:** browser → `gitam-frontend` (Nginx) → `gitam-backend` (Python API) → `gitam-db` (PostgreSQL).

- **Note:** Docker me **PostgreSQL** use hota hai (apna data, volume me). Local `python server.py` me **SQLite** (`gitam.db`) use hota hai — dono databases alag hote hain. Code khud detect karta hai (`PGHOST`/`DB_BACKEND` set ho to Postgres, warna SQLite).

## Demo Logins

| Role     | Username  | Password   |
|----------|-----------|------------|
| Admin    | `admin`   | `admin123` |
| Faculty  | `rmehta`  | `pass123`  |
| Student  | `21CS001` | `pass123`  |

> Login karte waqt sahi **role** select karna zaroori hai.

## Features (Modules)

| Module | Admin | Faculty | Student |
|--------|:---:|:---:|:---:|
| Dashboard (stats, overview)        | ✅ | ✅ | ✅ (personal) |
| Students (add/edit/delete, search) | ✅ | 👁 view | — |
| Faculty management                 | ✅ | — | — |
| Courses management                 | ✅ | — | — |
| Assignments overview (class→faculty)| ✅ | — | — |
| Attendance (mark + %)              | ✅ | ✅ | 👁 own |
| Marks & Results (auto grade/GPA)   | ✅ | ✅ | 👁 report card |
| Timetable (weekly grid)            | ✅ edit | 👁 | 👁 own class |
| Library (books, issue/return)      | ✅ | — | 👁 My Library |
| Fees (record payments, status)     | ✅ | — | 👁 own |
| ID Card + Marksheet (print/PDF)    | ✅ any student | — | ✅ own |
| Profile                            | — | ✅ | ✅ |

Saara data add/edit/delete turant SQLite database me save hota hai.

**Class Assignment (Admin → Faculty):** Courses module me admin har course ko **faculty + branch + semester + section** assign karta hai. Ya phir seedha **Faculty page** se kisi faculty ke saamne **📚 Classes** button dabao — ek modal me uski assigned classes dikhti hain jahan se **assign / unassign / nayi class create** kar sakte ho. Faculty ko sirf uski **assigned classes** dikhti hain — uska dashboard "My Assigned Classes" list dikhata hai, aur Attendance/Marks me sirf usi section ke students aate hain. (Demo: ek hi subject DSA — Sec A → Dr. Rajesh Mehta, Sec B → Prof. S. Venkat.)

**Library:** books ka catalogue, kisi student ko book issue karna (14 din ki due date auto), return karna, availability auto-track, overdue highlight. Student apni borrowed books "My Library" me dekh sakta hai.

**ID Card / Marksheet:** Student apne profile se ID card aur "My Results" se marksheet print/PDF kar sakta hai. Admin kisi bhi student ka ID card / marksheet Students table ke 🪪 ID / 📄 Sheet buttons se nikaal sakta hai. (Print dialog me "Save as PDF" choose karo. Popup allow karna zaroori hai.)

**Theme:** GITAM ke official green logo se match karta hua green + white theme.

## Grading Scale

| Total (/100) | Grade | Points |
|---|---|---|
| 90+ | O  | 10 |
| 80–89 | A+ | 9 |
| 70–79 | A  | 8 |
| 60–69 | B+ | 7 |
| 50–59 | B  | 6 |
| 40–49 | C  | 5 |
| <40   | F  | 0 |

GPA = Σ(grade points × credits) / Σ(credits). Attendance < 75% par warning aata hai.

## Project Structure

```
server.py          → Python backend: REST API + serves the site + SQLite
gitam.db           → SQLite database (auto-created on first run)
index.html         → login + app shell
css/styles.css     → GITAM theme
js/store.js        → talks to the backend API (with in-memory cache)
js/app.js          → auth, navigation, all modules
assets/            → GITAM logo + campus images (from gitam.ac.in)
Dockerfile         → container image (Python slim, stdlib only)
docker-compose.yml → run with a persistent volume for the database
.dockerignore      → keeps the image small / DB out of the image
.claude/launch.json→ preview-server config (for Claude Code)
```

## REST API (backend)

| Method | Route | Kaam |
|---|---|---|
| POST | `/api/login` | username + password + role verify |
| GET  | `/api/bootstrap` | saara data ek saath |
| GET  | `/api/<collection>` | list (students, faculty, courses, books, issues, ...) |
| POST | `/api/<collection>` | naya record |
| PUT  | `/api/<collection>/<id>` | record update |
| DELETE | `/api/<collection>/<id>` | record delete |

## Database reset

Demo data wapas laana ho to server band karke `gitam.db` file delete kar do, phir `python server.py` dobara chalao — naya DB ban jayega.

## Note (logo & images)

Logo aur campus images GITAM ki public website (gitam.ac.in) se liye gaye hain, sirf is educational/demo project ke liye. Production/public use ke liye college ki permission ya apne images use karein.
