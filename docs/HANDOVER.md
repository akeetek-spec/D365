# D365 Licence Check: developer handover

Prepared by AkeeTek. This repository is the production version of the prototype Champion Chair approved in claude.ai. The screens, wording and licence rules match the prototype; the prototype's demo pickers and in-browser storage are replaced by Firebase: Hosting, one Cloud Function, Cloud Firestore, Cloud Storage and Firebase Authentication.

## 1. What it does

Microsoft's D365 licence report flagged 37 users whose security roles need a licence they don't have. Instead of buying every flagged licence, each person confirms what they actually need, and the IT Director decides.

| Who                          | Gets in by                            | Sees                                                                                               |
| ---------------------------- | ------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Each person in the report    | Personal link by email, `/#t=<token>` | Four tabs: What you have today · one tab per missing licence · Additional modules · Review summary |
| IT Director (Andres Santana) | Email + password sign-in at `/admin`  | Totals, people list, drill-down; sends invites; approves, sends back, declines, marks as set up    |
| IT team (Jennifer Derby)     | Email + password sign-in at `/admin`  | Same view; can add IT evidence, resend one person's link and mark emails sent; can't decide        |
| Leadership                   | Email + password sign-in at `/admin`  | Read-only                                                                                          |

There is no supervisor step. Licence costs are never shown to users; only IT sees them.

### What people see (agreed wording)

- **First tab:** an "Action needed: your D365 access isn’t fully licensed" box naming the licences their roles need, that Microsoft requires this to be fixed, and that IT may need to remove that access.
- **Each missing-licence tab:** the same heading, then "One of your D365 roles, _role_, includes features that need a _licence_ licence. You don't currently have this licence." Role names come from Microsoft's licensing report (`gapRoles` on each person). Then: "Please tell us below if you use these features. If you do, we'll get you the right licence. If you don't, we'll remove the access."
- Have the IT Director confirm two phrases before launch: "Microsoft … checks this" and "IT may need to remove this access", so they match Champion's agreement and what IT will actually do.

## 2. How the licence is decided

All rules live in `frontend/levels.js` (copied to `src/shared/`), on top of the prototype's licence model in `frontend/licence.js` and the role catalog in `frontend/catalog.js`.

1. **What people already have is kept.** Their current licences are not questioned (`keep-*` roles).
2. **Each missing licence gets its own tab.** The person first picks a level: Full user ("the Editor"), Team Member ("the Viewer / Light User") or "I don't need it". Then they tick the D365 menu areas they use and, optionally, tasks.
3. **The level decides the licence; tasks are evidence.** Each level maps to a stand-in role (`level-full-fin`, `level-tm`…), and the licence model works out the licence from those plus the kept roles. Tasks map to real D365 roles and are only used to flag a mismatch ("The tasks ticked usually need a Full user licence").
4. **Base + attach.** If a person already has a full licence that costs at least as much, it stays the base and the new app is bought as an attach (about $30). Otherwise the most expensive app is the base.
5. **Team Member or "not needed" for a missing licence means a role change, not a purchase.** A full licence already covers Team Member and Activity rights in other apps, but D365 will keep reporting the person as under-licensed until IT removes or replaces the security roles that need the full licence. The dashboard names the role, for example "Remove Inventory Manager (needs Commerce, not needed)".
6. **"I don't use D365 at all"** means the licence can be freed.
7. **The server recalculates everything.** The browser sends answers only; `src/handler.js` cleans them (`cleanForm`), refuses incomplete answers (`openItems`) and works out the licence itself.

Operations – Activity is supported by the rules but not offered to users (Champion asked to remove it from the form). The IT Director can still settle on Activity during review by changing roles in D365.

## 3. Workflow

`none → submitted (with IT Director) → approved → provisioned`, plus `returned` (sent back with a comment; the person gets a fresh link and sees the comment) and `rejected` (declined with a comment). A person can change and resend at any time; resending after approval starts the review again. Emails: invite, request to the IT Director, sent back, approved, set up, declined.

## 4. Repository

```
frontend/index.html, boot.js        page shell; /admin → dashboard, #t= → form
frontend/form.js, dashboard.js      the two screens (the dashboard includes the Invites box)
frontend/common.js                  helpers (API calls, private image loading)
frontend/levels.js                  licence check rules (shared with the function)
frontend/licence.js, catalog.js     licence model and D365 role catalog (shared with the function)
firebase.json                  Hosting, rewrites of /api/** and /.auth/** to the function, security headers
firestore.rules, storage.rules no access from browsers; only the function reads and writes
index.js             Cloud Function "app" (Node.js 22, us-central1), Gmail secret
src/app.js           routes /api/* and /.auth/*; adds people from the roster file on first use
src/handler.js       every endpoint and the workflow
src/auth.js          dashboard sign-in (Firebase Authentication email + password, or test sign-in)
src/store.js         Cloud Firestore (one collection per kind of record)
src/blobs.js         screenshots in Cloud Storage, folder screenshots/ (private)
src/tokens.js        personal links (only SHA-256 hashes stored; 30-day expiry)
src/mail.js          email: outbox, or Gmail when MAIL_MODE=gmail
.env, .env.prod, .env.test   settings (shared, production, testing)
local.js             runs everything on a PC (npm start)
scripts/import-roster.js           load people and send invites from the command line
scripts/import-licensing-report.js turn Microsoft's licensing report CSV into a roster file
test/                workflow and invite tests (npm test)
data/roster.json, .csv         the 37 people, with job title and the roles behind each missing licence (6 Nov report)
data/roster.test.json          two test people for the testing project
```

Firestore collections: `roster`, `responses`, `evidence`, `outbox`, `tokens`, `settings`.

### API

| Endpoint                                                         | Who                         | Does                                                                                                         |
| ---------------------------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `GET /api/me`                                                    | person (`x-invite-token`)   | their details and current request                                                                            |
| `POST /api/upload`                                               | person                      | screenshot for Additional modules (PNG/JPG/WebP, ≤10 MB, checked by content)                                 |
| `POST /api/respond`                                              | person                      | send answers; server works out the licence                                                                   |
| `GET /api/file/<id>`                                             | owner or any dashboard role | a screenshot                                                                                                 |
| `GET /api/admin/data`                                            | dashboard roles             | everything the dashboard shows                                                                               |
| `POST /api/admin/approval`                                       | IT Director                 | `approve`, `return`, `reject` (comment needed for the last two), `provision`                                 |
| `POST /api/admin/invite`                                         | IT Director                 | invite everyone not invited yet (`scope: "new"`), remind everyone who hasn't answered (`"remind"`), or `ids` |
| `POST /api/admin/evidence`, `/api/admin/upload`                  | IT Director, IT team        | IT-only notes and screenshots per person                                                                     |
| `POST /api/admin/reissue`                                        | IT Director, IT team        | revoke old links, email a new one                                                                            |
| `POST /api/admin/outbox-sent`                                    | IT Director, IT team        | mark a queued email as sent                                                                                  |
| `POST /api/admin/prices`                                         | IT Director                 | change list prices                                                                                           |
| `/.auth/login/aad`, `/.auth/me`, `/.auth/logout`, `/.auth/reset` | everyone                    | dashboard sign-in, who is signed in, sign out, password reset                                                |

## 5. Setting it up

See the README, "Set up Firebase". In short: a Firebase project per environment (testing, production) on the Blaze plan; Firestore and Storage in production mode; Authentication with Email/Password and an account per dashboard person; the Web API key in `.env.prod`; `firebase use --add` for both projects; `firebase deploy`.

Settings (`.env`, overridden by `.env.prod` / `.env.test`):

| Setting                                              | Meaning                                                                                            |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `SIGN_IN`                                            | `firebase` (email + password) or `test` (pick who to be; cloud only with `ALLOW_TEST_SIGNIN=true`) |
| `WEB_API_KEY`                                        | Firebase Web API key, for email + password sign-in                                                 |
| `ROLE_ITDIRECTOR`, `ROLE_ITADMIN`, `ROLE_LEADERSHIP` | dashboard access, comma-separated emails                                                           |
| `IT_DIRECTOR_NAME`, `IT_DIRECTOR_EMAIL`              | shown to people; gets "new request" emails                                                         |
| `ROSTER_FILE`                                        | people added to Firestore on first use (`data/roster.json`, or `data/roster.test.json`)            |
| `MAIL_MODE`, `MAIL_SENDER`, `MAIL_FROM_NAME`         | `outbox` or `gmail`; sender address and name                                                       |
| `GMAIL_APP_PASSWORD`                                 | secret (Cloud Secret Manager), the Google App Password                                             |
| `APP_URL`                                            | only for a custom domain; otherwise `https://<project-id>.web.app`                                 |
| `FIRESTORE_DATABASE`                                 | only to use a named Firestore database instead of `(default)`                                      |
| `LINK_DAYS`                                          | how long personal links work (default 30)                                                          |

**Inviting:** the IT Director uses the Invites box on the dashboard (pilot first: open a person > Send invite). From a computer instead: `STORE=firestore GOOGLE_CLOUD_PROJECT=<project-id> APP_URL=https://<site> node scripts/import-roster.js data/roster.json --invite --only id1,id2` after `gcloud auth application-default login`.

**Refreshing from a new licensing report:** export the Finance and Operations Licensing Detailed Report (CSV), run `node scripts/import-licensing-report.js report.csv data/new-roster.json --existing data/roster.json`, review new people, replace `data/roster.json` and deploy (new people are added; existing ones are left as they are).

## 6. Data and decisions before go-live

**Already loaded from the 6 Nov licensing report:** each person's missing licences and the roles causing them; corrected logins (Brianna.Zlotecki, Christine.Kiscellus, Receiving@wincomfg.onmicrosoft.com); Amy Hart's Commerce gap.

**Decisions pending:** the report shows 5 more under-licensed accounts not in `data/roster.json`: Ryan Labonte, Vickie Pauly, Sharon Almquist, Deborah.Contreras (no licence) and dcontreras (Finance). Confirm which Contreras login is real and add job titles before inviting them (the importer above produces their entries).

**Still to gather:**

| Item                                                               | Why                                                                                                                           | Source                                        |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Licence requirement per role, including custom roles               | The catalog only knows Microsoft's standard roles; Champion has custom workspaces, buttons and Pacejet, Avalara and EDI menus | D365 licence reports / Security configuration |
| Sign-in history                                                    | Check answers against real use; find licences to free                                                                         | D365 user log                                 |
| Licences already owned and contract prices                         | "To buy" may be covered by unassigned seats; prices may differ from list                                                      | Microsoft 365 admin centre; reseller          |
| Owners for the 3 shared logins (Receiving, Service Cell, Shipping) | Named licences can't be shared; decide device licence or named logins                                                         | IT Director                                   |
| Finance level wording                                              | Finance has fewer light roles than Supply Chain; confirm the wording                                                          | Microsoft reseller or partner                 |

The roster's supervisor fields are kept for reference but no longer used by the workflow.

## 7. Security notes

- Personal links: 256-bit random tokens in the URL fragment (never sent to servers or logs), stored only as SHA-256 hashes, expire after `LINK_DAYS`; reissuing revokes old ones.
- Dashboard: email + password checked by Firebase Authentication; roles from the `ROLE_*` settings, checked on every request; signed 8-hour session cookie (`__session`, HttpOnly, Secure, SameSite=Lax); only the IT Director can decide or send invites. The no-password test sign-in only runs where `ALLOW_TEST_SIGNIN=true` (the testing project).
- Screenshots: private Cloud Storage folder (storage rules deny all direct access), content checked as PNG/JPEG/WebP, served only through `/api/file/<id>` to their owner or dashboard roles; IT evidence is never visible to the person.
- Strict Content Security Policy; all user text is escaped before display.
- Firestore and Storage rules deny all browser access; only the Cloud Function (Admin SDK) reads and writes.
- Personal data: names, emails, job titles, answers and screenshots in the Firebase project. Agree a retention period and delete the Firestore data and the `screenshots/` folder after the review.

## 8. Changing things

- Task list, menu areas, level wording: `frontend/levels.js` (copied into the function automatically before every deploy, `npm start` and `npm test`).
- Prices: `DEFAULT_PRICES` in `frontend/licence.js`, or the prices endpoint.
- Email wording: `T` in `src/handler.js`.
- IT Director name shown to users: `IT_DIRECTOR_NAME`.

## 9. Testing

- `npm test`: full workflow and invites against in-memory storage, including access checks on screenshots and dashboard roles.
- Manual trial with 3 to 5 people (one each from Finance, order entry, planning, engineering, plus one shared login): answer, send back, change and resend, approve, set up; check emails, screenshots and the dashboard totals.

## 10. Launch recommendations

- **Pilot with 3 to 5 people** (Finance, order entry, planning, engineering, one shared login) and watch where they hesitate, especially the level choice and role names.
- **Send the first email from the IT Director**, with a deadline (for example two weeks) and one reminder.
- **Consider one reassurance line under the level choice**, so the "may remove access" warning doesn't push people to pick Full user just to be safe: "Choose what matches your real work. IT checks this against what you do in D365, so you won't lose anything you genuinely use." Not yet added; agree it with the IT Director.
- **Check answers against real use** (sign-in history, "created by" on records) before approving Full user requests.

## 11. Known limits and possible next steps

- Team Members, Activity and device prices are estimates; full-user prices are list prices from Microsoft's guide (October 2026).
- No automatic reminders; use "Remind everyone who hasn't answered" on the dashboard.
- No export of decisions yet; a CSV export from `/api/admin/data` is a small addition.
- Once role and sign-in exports are available, load them per person and show them beside each answer.
- After role changes, re-run the D365 licence report to confirm the under-licensed count drops.
