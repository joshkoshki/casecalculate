# Case Calculator — Setup & Deploy

This folder is a complete, ready-to-deploy website. The email backend is
already written — nothing left to build, only to configure and deploy.

## What's in here

- `index.html` — the entire calculator (front-end), already wired to call the
  email backend when someone submits.
- `api/submit-lead.js` — the backend function that sends you an email with
  the full lead details every time someone completes the calculator.
- `.env.example` — a list of the settings you need to add in Vercel (see below).

## Step 1 — Get your Resend API key

1. Go to [resend.com](https://resend.com) and log into the account you already made.
2. Go to **API Keys** in the left sidebar.
3. Click **Create API Key**, name it anything (e.g. "case calculator"), and copy the key it gives you. It starts with `re_`.
4. Keep this somewhere safe for a moment — you'll paste it into Vercel in Step 3, not here in this folder.

## Step 2 — Deploy this folder to Vercel

If you're using Claude Code, just ask it to deploy this folder to your Vercel account and it will walk you through connecting your account and pushing this up. If you're doing it yourself:

1. Go to [vercel.com](https://vercel.com) and log into the account you already made.
2. Click **Add New... > Project**.
3. Import this folder (Claude Code can help you get it into a GitHub repo first, which is the easiest way for Vercel to pick it up — or use the Vercel CLI's `vercel deploy` command from inside this folder).

## Step 3 — Add your environment variables in Vercel

1. In your new Vercel project, go to **Settings > Environment Variables**.
2. Add these two (matching `.env.example`):
   - `RESEND_API_KEY` → paste the key you copied in Step 1
   - `LEAD_EMAIL_TO` → the email address you want leads sent to (your own inbox)
3. Leave `RESEND_FROM` unset for now — it'll default to a shared Resend test address that works immediately with no extra setup. You can come back and set this later once you verify your own domain in Resend, if you want the "from" address to look more branded.
4. Redeploy the project after adding these (Vercel will prompt you to, or it happens automatically on the next deploy).

## Step 4 — Connect your domain

1. In your Vercel project, go to **Settings > Domains**.
2. Add the domain you already purchased.
3. Vercel will show you one or two DNS records to add. Go to wherever you bought the domain (Namecheap, Google Domains, etc.), find the DNS settings, and add exactly what Vercel shows you.
4. This can take anywhere from a few minutes to a few hours to fully connect — that's normal.

## Step 5 — Test it

1. Visit your deployed site (Vercel gives you a `.vercel.app` link immediately, even before your custom domain finishes connecting).
2. Click through the whole calculator with a real name, your own phone/email, and hit Submit.
3. Check the inbox you set as `LEAD_EMAIL_TO` — you should get a fully formatted email with everything you just entered within a few seconds.
4. If no email arrives: in your Vercel project, go to the **Logs** tab and look for anything starting with `submit-lead:` — the backend logs a clear error message there if something's misconfigured (usually a missing or mistyped environment variable).

That's it — no database, no login system, nothing else to configure. Every submission becomes an email in your inbox.
