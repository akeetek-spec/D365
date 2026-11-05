# D365 Licence Check

People confirm which D365 access they need, their supervisor approves, the IT Director approves and sets up the licence. Built from the AkeeTek prototype; the screens and licence rules are the same code.

| Who                               | How they get in                      | What they see                                                                         |
| --------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------- |
| Each person in the licence report | Personal link by email (`/#t=…`)     | Their details pre-filled, one question, one page per missing licence, review and send |
| Supervisor                        | Personal link by email (`/#m=…`)     | Their team's requests: approve or send back with a comment                            |
| IT Director, IT team, leadership  | Email + password sign-in at `/admin` | Answers received, licences to procure, approvals; drill down per person               |

It can run in two places, with the same screens and rules:

- **Firebase App Hosting** (`npm start`, data in Firestore): see [Firebase App Hosting](#firebase-app-hosting).
- **Azure Static Web Apps** (Azure Functions, data in Table Storage): see [Azure Static Web Apps](#azure-static-web-apps).

## Run it locally with npm (no Azure needed)

Needs Node.js 20 or later.

```
npm install
npm start
```

Open http://localhost:4280. On first start the 37 people from `data/roster.json` are loaded.

| To try              | Do this                                                                                                                                                                                            |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| IT dashboard        | Open http://localhost:4280/admin and sign in as Andres Santana (IT Director) or Jennifer Derby (IT team). On your PC a test sign-in page (no password) stands in for the email + password sign-in. |
| Person's form       | As the IT Director, click **Invite everyone not invited yet** on the dashboard, or run `npm run invite -- --only amy-hart`. Copy the link (`/#t=…`) from "Emails waiting to send".                 |
| Supervisor approval | After a person sends the form, the supervisor's email with a `/#m=…` link appears under "Emails waiting to send".                                                                                  |

Other commands: `npm run format` (tidy the code layout), `npm run dev` (restarts when you edit server files), `npm test` (workflow test), `npm run sync` (after editing the shared licence rules), `npm run reset` (clear local data and start again).

Local data is kept in `.local-data/db.json`. Emails are never sent locally (`MAIL_MODE=outbox`). To change the port, who can sign in, or other settings, copy `local.env.example` to `local.env`.

On your PC the dashboard uses the test sign-in page unless `SIGN_IN=firebase` and `FIREBASE_API_KEY` are set in `local.env`.

## Firebase App Hosting

Two App Hosting backends from the same GitHub repository:

|                    | Production                                 | Testing                                                        |
| ------------------ | ------------------------------------------ | -------------------------------------------------------------- |
| Settings           | `apphosting.yaml`                          | `apphosting.yaml` + `apphosting.testing.yaml`                  |
| Firestore database | `(default)`                                | `test`                                                         |
| People             | `data/roster.json` (37)                    | `data/roster.test.json` (pal@akeetek.com, akeetek01@gmail.com) |
| Dashboard sign-in  | email + password (Firebase Authentication) | test page, no password                                         |

The test page only runs in the cloud when `ALLOW_TEST_SIGNIN=true` **and** a separate `FIRESTORE_DATABASE` is set, so it can never open the real data. Microsoft sign-in is not used (it can still be switched on with the `AAD_*` settings).

### A. One-time setup

1. **Firebase project**: console.firebase.google.com > Add project. Then Usage and billing > switch to the **Blaze** plan (App Hosting needs it).
2. **GitHub**: create a private repository, then from the project folder:
   ```
   git init
   git add .
   git commit -m "D365 Licence Check"
   git branch -M main
   git remote add origin https://github.com/<you>/<repo>.git
   git push -u origin main
   ```
3. **Firestore, production database**: Build > Firestore Database > Create database > **Production mode** > your region.
4. **Firestore, test database**: in Firestore Database, open the database list at the top > Create database > Database ID `test` > Production mode > same region.
5. **Authentication**: Build > Authentication > Get started > Sign-in method > **Email/Password** > Enable > Save. Then Users > Add user for each production dashboard person (`andres.santana@championchair.com`, `jennifer.derby@championchair.com`) with a temporary password. They can change it with "Forgot password?" on the sign-in page.
6. **Web API key**: Project settings (gear) > General > copy **Web API key**. Put it in `apphosting.yaml` as `FIREBASE_API_KEY`.

### B. Production backend

1. App Hosting > Get started (or Create backend) > connect GitHub > your repository, branch `main`, root directory `/` > backend name `licence-prod` > region > Create. Turn on automatic rollouts.
2. Copy its address (`https://licence-prod--….hosted.app`) into `APP_URL` in `apphosting.yaml`.
3. Secret `sessionSecret`: random text of 32+ characters, for example from `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Create it in App Hosting > `licence-prod` > Settings > Environment (add secret), or with `firebase apphosting:secrets:set sessionSecret`, and give `licence-prod` access.
4. Commit and push. Watch App Hosting > `licence-prod` > Rollouts.

### C. Testing backend

1. App Hosting > Create backend > same repository and branch, root `/` > backend name `licence-test` > Create.
2. App Hosting > `licence-test` > Settings > Environment > **Environment name**: `testing` > Save. (This makes it read `apphosting.testing.yaml`.)
3. Give `licence-test` access to the `sessionSecret` secret (same place, or `firebase apphosting:secrets:grantaccess sessionSecret --backend licence-test`).
4. Copy its address into `APP_URL` in `apphosting.testing.yaml`. Commit and push.

### D. Test

1. Open `https://licence-test--….hosted.app/admin`. Pick **pal@akeetek.com** (IT Director). Only the two test people are listed.
2. Click **Invite everyone not invited yet (2)**. With `MAIL_MODE: outbox`, copy each link from **Emails waiting to send**; open it in a private window to answer as that person.
3. The other test person approves as supervisor; then approve and **Mark licence as set up** on the dashboard.

### E. Go live

1. Open `https://licence-prod--….hosted.app/admin`, sign in with email and password.
2. Trial: open 2 or 3 people > **Send invite**. Then **Invite everyone not invited yet**.

### Sending email automatically from Gmail

1. In the Gmail account: Google Account > Security > 2-Step Verification on > **App passwords** > create one > copy the 16-character code (never the normal password).
2. Create the secret `gmailAppPassword` with that code, and give the backend(s) access.
3. In `apphosting.yaml` set `MAIL_MODE` to `gmail` and remove the `#` from the two `GMAIL_APP_PASSWORD` lines (to send from testing only, put the same three lines in `apphosting.testing.yaml` instead). Push.

If an email can't be sent it stays under "Emails waiting to send" with the reason. Gmail allows about 500 emails a day.

### If something goes wrong

- **"Setup needed" page**: it lists the missing settings. Fix and push.
- **"Wrong email or password"**: check the user exists in Authentication > Users; use "Forgot password?".
- **"No access to the dashboard"**: the email isn't in `ROLE_ITDIRECTOR` / `ROLE_ITADMIN` / `ROLE_LEADERSHIP`.
- **Firestore `PERMISSION_DENIED` in the logs**: give `firebase-app-hosting-compute@<project-id>.iam.gserviceaccount.com` the **Cloud Datastore User** role (Google Cloud console > IAM).
- **Rollout fails on a secret**: the backend hasn't been given access to it (step B3 / C3).

**Load or update people from your PC** (optional): sign in with `gcloud auth application-default login`, then run `STORE=firestore GOOGLE_CLOUD_PROJECT=<project-id> APP_URL=https://<address> npm run roster` (add `FIRESTORE_DATABASE=test` for the test database).

## What's in the folder

```
server/                  Node.js server (npm start) for your PC and Firebase App Hosting
  index.js               serves web/, runs the API, setup checks
  auth.js                dashboard sign-in: email + password (Firebase), test page, or Microsoft
  store.js               Firestore in the cloud, .local-data/db.json on your PC
  roster.js              load people and invite them from the command line
apphosting.yaml          Firebase App Hosting settings (production)
apphosting.testing.yaml  changes for the testing backend
firestore.rules          locks Firestore to the app's server
web/                     front end (static files, no build step)
  index.html  boot.js    picks the view from the link
  form.js                person's form
  manager.js             supervisor approvals
  dashboard.js           IT dashboard
  licence.js catalog.js keep-roles.js   licence rules, shared with the API
  staticwebapp.config.json              sign-in, roles, security headers
api/                     Azure Functions (Node 20)
  src/lib/handler.js     every /api endpoint and the approval workflow
  src/lib/store.js       Azure Table Storage (one table per collection)
  src/lib/tokens.js      personal links (only SHA-256 hashes are stored; 30-day expiry)
  src/lib/mail.js        email: outbox, plus Microsoft Graph when MAIL_MODE=graph
  scripts/import-roster.js   load people and send invites
  test/flow.test.js      end-to-end workflow test (npm test)
  test/invite.test.js    invite checks (npm test)
data/roster.json, roster.csv   the 37 people from the 2 Nov report, with job title and supervisor
```

## Azure Static Web Apps

The alternative to Firebase (about 2 days of technical work).

1. **Azure resources** (Resource group in your tenant)
   - Static Web App, **Standard** plan (needed for Entra ID sign-in with custom roles).
   - Storage account (Standard LRS). Copy its connection string.
2. **Sign-in app registration** (Entra ID > App registrations > New)
   - Redirect URI: `https://<your-app>.azurestaticapps.net/.auth/login/aad/callback`
   - Create a client secret. Put your tenant ID into `web/staticwebapp.config.json` (`<TENANT_ID>`).
3. **Email** (optional at first; see `MAIL_MODE`)
   - App registration with Microsoft Graph **application** permission `Mail.Send`, admin consent.
   - In Exchange Online, limit it to the sender mailbox with an application access policy (`New-ApplicationAccessPolicy`), so it cannot send as anyone else.
4. **App settings** (Static Web App > Environment variables)

   | Setting                                                                    | Value                                                                  |
   | -------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
   | `STORAGE_CONNECTION`                                                       | storage connection string                                              |
   | `APP_URL`                                                                  | `https://<your-app>.azurestaticapps.net` (or your custom domain)       |
   | `AAD_CLIENT_ID`, `AAD_CLIENT_SECRET`                                       | sign-in app from step 2                                                |
   | `IT_DIRECTOR_EMAIL`                                                        | `andres.santana@championchair.com`                                     |
   | `ROLE_ITDIRECTOR` / `ROLE_ITADMIN` / `ROLE_LEADERSHIP`                     | comma-separated email addresses                                        |
   | `MAIL_MODE`                                                                | `outbox` (IT sends from the dashboard) or `graph` (sent automatically) |
   | `MAIL_SENDER`, `GRAPH_TENANT_ID`, `GRAPH_CLIENT_ID`, `GRAPH_CLIENT_SECRET` | from step 3, when `MAIL_MODE=graph`                                    |
   | `LINK_DAYS`                                                                | how long personal links work, default `30`                             |

5. **Deploy**: push this folder to a GitHub repo, add the Static Web App's deployment token as the secret `AZURE_STATIC_WEB_APPS_API_TOKEN`. The workflow runs the tests, then deploys.
6. **Load people and invite them**: sign in at `/admin` as the IT Director and click **Invite everyone not invited yet**. Or from your machine, with the same settings in your environment:
   ```
   cd api && npm ci
   node scripts/import-roster.js ../data/roster.json              # load
   node scripts/import-roster.js ../data/roster.json --invite     # email personal links
   ```

Run locally: `npm i -g azure-functions-core-tools@4 @azure/static-web-apps-cli`, copy `api/local.settings.sample.json` to `api/local.settings.json`, start Azurite, then `swa start web --api-location api`.

## Before you invite anyone

- [ ] Confirm the 12 supervisor emails marked `derived` in `data/roster.json` (built as First.Last@ChampionChair.com).
- [ ] Name an owner for the 3 shared logins (Receiving, Service Cell, Shipping), or plan to split them.
- [ ] Confirm "Angel Ness" is Angela Ness (Collin Jacobs).
- [ ] Have someone from each area check the task wording in `web/form.js` (`TASKS`).
- [ ] Trial with 2 or 3 people and their supervisors (sent back, resend, approve, set up).

## Changing things later

- Task lists: `TASKS` in `web/form.js`. Each task maps to a D365 role in `web/catalog.js`.
- Prices: dashboard (IT Director) or `DEFAULT_PRICES` in `web/licence.js`.
- After editing `web/licence.js`, `web/catalog.js` or `web/keep-roles.js`, run `npm run sync` in `api/` so the API uses the same rules.
# D365
