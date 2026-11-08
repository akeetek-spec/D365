# D365 Licence Check (Firebase)

Each person in Microsoft's D365 under-licensed report confirms what they need; the IT Director reviews it and decides which base and attach licences to buy, or which security roles to change.

- People open a personal link from their email: `https://<site>/#t=…`
- The IT Director, IT team and leadership sign in at `https://<site>/admin`

Runs on **Firebase**: Hosting serves the pages, one Cloud Function (Node.js 22) answers `/api/*` and `/.auth/*`, data is in **Cloud Firestore**, screenshots in **Cloud Storage**. Deployed with `firebase deploy`.

```
frontend/                 pages (static, no build step), served by Firebase Hosting
index.js                  the Cloud Function "app": definition (region, memory, Gmail secret)
src/app.js                routes /api/* and /.auth/*, loads people into Firestore on first use
src/handler.js            every API endpoint and the workflow
src/auth.js               dashboard sign-in: email + password (Firebase Authentication) or test sign-in
src/store.js              Firestore (or a local file on your PC)
src/blobs.js              screenshots in Cloud Storage (or a local folder)
src/mail.js               email: outbox, or Gmail
src/tokens.js             personal links (only SHA-256 hashes are stored)
src/shared/               licence rules, copied from frontend/ by scripts/sync.js
.env.prod, .env.test      the two source files (each is complete); edit these, then copy one to .env
.env                      the active settings: a copy of .env.test or .env.prod (npm run env:test / env:prod)
local.js                  runs everything on your PC (npm start)
scripts/                  import-roster.js, import-licensing-report.js, sync.js
test/                     workflow tests (npm test)
data/roster.json          the 37 people (6 Nov report)
data/roster.test.json     two test people: pal@akeetek.com, akeetek01@gmail.com
firebase.json             Hosting, rewrites to the function, security headers, rules, emulators
firestore.rules, storage.rules   no direct access from browsers; only the function reads and writes
docs/HANDOVER.md          how it works, decisions before go-live, security
```

## Run it on your PC

Needs Node.js 22 (20 also works locally).

```

npm install
npm start
```

Open http://localhost:4280/admin and pick a person on the test sign-in page. Data is kept in `.local-data/`; nothing is emailed. To use only the two test people, copy `.env.local.example` to `.env.local` and remove the `#` in front of the test lines, then delete `.local-data/` and start again.

`npm test` runs the workflow and invite checks.

## Production and testing

Two Firebase projects, same code:

|                   | `prod`                                     | `test`                               |
| ----------------- | ------------------------------------------ | ------------------------------------ |
| Settings          | `.env` + `.env.prod`             | `.env` + `.env.test`       |
| People            | the 37 (`data/roster.json`)                | pal@akeetek.com, akeetek01@gmail.com |
| Dashboard sign-in | email + password (Firebase Authentication) | test sign-in, no password            |
| Address           | `https://<prod-project-id>.web.app`        | `https://<test-project-id>.web.app`  |

The test sign-in only works where `ALLOW_TEST_SIGNIN=true` (only in `.env.test`). Without it the site shows a "Setup needed" page instead.

## Set up Firebase (first time)

Do this once for each project (testing first).

1. **Create the project**: console.firebase.google.com > Add project (e.g. `d365-licence-test`, later `d365-licence-prod`). Upgrade to the **Blaze** plan (Cloud Functions and Cloud Storage need it; this app's use stays within the free allowance).
2. **Firestore**: Build > Firestore Database > Create database > Standard edition > location (e.g. `nam5`) > **Start in production mode**.
3. **Storage** (screenshots): Build > Storage > Get started > production mode > same location.
4. **Authentication** (production project): Build > Authentication > Get started > Sign-in method > **Email/Password** > Enable. Then Users > Add user for each dashboard person (Andres Santana, Jennifer Derby) with a temporary password; they can change it with "Forgot password?" on the sign-in page. Copy the **Web API key** from Project settings (gear) > General into `WEB_API_KEY` in `.env.prod`.
5. **On your computer**, in the project folder:
   ```
   npm install -g firebase-tools
   firebase login
   firebase use --add        # pick the testing project, alias: test
   firebase use --add        # pick the production project, alias: prod
   npm install
   ```
6. **Deploy the testing project**:
   ```
   firebase use test
   firebase deploy
   ```
   The first deploy asks for **GMAIL_APP_PASSWORD**: type the Google App Password, or `none` while emails stay in the outbox. It runs the tests, then deploys Hosting, the function, and the Firestore and Storage rules.
7. Open `https://<test-project-id>.web.app/admin`, pick **pal@akeetek.com**, and click **Invite everyone not invited yet (2)**.
8. **Production**: `firebase use prod`, then `firebase deploy`. Open `https://<prod-project-id>.web.app/admin` and sign in with email and password.

After any change: `firebase use test` (or `prod`) then `firebase deploy`. To deploy only the pages: `firebase deploy --only hosting`; only the function: `firebase deploy --only functions`.

## Inviting people

On the dashboard (IT Director): **Invite everyone not invited yet**, **Remind everyone who hasn't answered**, or open a person > **Send invite** / **Send a new link**. The app adds anyone in the roster file who isn't in Firestore yet the first time it runs after a deploy, so new people appear after adding them to `data/roster.json` and deploying.

## Sending email from Gmail

1. In the Gmail account (akeetek01@gmail.com): Google Account > Security > 2-Step Verification on > **App passwords** > create one > copy the 16 letters. Never use the account's normal password, and don't paste it anywhere else.
2. `firebase functions:secrets:set GMAIL_APP_PASSWORD` and paste the code.
3. In `.env.test` (or `.env.prod`) set `MAIL_MODE=gmail`. Deploy.

If an email can't be sent it stays under "Emails waiting to send" with the reason. Gmail allows about 500 emails a day.

## If something isn't right

The site shows a **Setup needed** page naming what's missing (sign-in settings, the Gmail App Password, the Firestore database). Logs: Firebase console > Functions > `app` > Logs.

| You see                                      | Do this                                                                                                     |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| "Firestore database … doesn't exist"         | Step 2 above                                                                                                |
| "Cloud Storage isn't set up" or uploads fail | Step 3 above                                                                                                |
| "WEB_API_KEY is not set"                     | Step 4: paste the Web API key into `.env.prod`, deploy                                                      |
| "Wrong email or password"                    | Check the user in Authentication > Users; use "Forgot password?"                                            |
| "No access to the dashboard"                 | Add the email to `ROLE_ITDIRECTOR` / `ROLE_ITADMIN` / `ROLE_LEADERSHIP` in `.env` or `.env.<alias>`, deploy |
| Deploy says the project must be on Blaze     | Step 1                                                                                                      |

## Firebase emulators (optional)

Runs Hosting, the function, Firestore, Storage and Authentication on your PC (needs Java 11+):

```
npm run sync
firebase emulators:start --project demo-licence
```

Open http://localhost:5000/admin. Data is wiped when the emulators stop.
