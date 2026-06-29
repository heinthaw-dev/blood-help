---
marp: true
paginate: true
size: 16:9
---

<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&family=JetBrains+Mono:wght@500&display=swap');
:root { --bg:#f8fafc; --ink:#0f172a; --muted:#64748b; --accent:#d13e2f; --line:#e2e8f0; --code:#0f172a; }
section {
  background:var(--bg); color:var(--ink);
  font-family:'Inter','Noto Sans','Pyidaungsu',sans-serif;
  font-size:26px; line-height:1.5; padding:48px 64px;
}
h1 { color:var(--ink); font-weight:800; font-size:1.6em; margin:0 0 .35em; }
h2 { color:var(--accent); font-weight:600; }
h3 { color:var(--muted); font-weight:600; }
strong { color:var(--accent); }
a { color:var(--accent); text-decoration:none; }
img { border-radius:12px; box-shadow:0 12px 30px rgba(15,23,42,.18); }
code { background:#fdeceb; color:#b3261e; padding:.06em .35em; border-radius:5px; font-family:'JetBrains Mono',monospace; }
pre  { background:var(--code); border-radius:10px; }
pre code { background:none; color:#e2e8f0; }
blockquote { border-left:4px solid var(--accent); background:#fdeceb; color:#8c1d18; padding:.5em 1em; }
header,footer,section::after { color:var(--muted); font-size:.5em; }

/* Cover */
section.cover {
  background:radial-gradient(820px 380px at 82% 14%, rgba(209,62,47,.16), transparent 60%), var(--bg);
}
section.cover h1 { font-size:2.4em; }
section.cover h2 { color:var(--muted); font-weight:400; }

/* Split: copy on the left, one phone on the right.
   Markdown images render as <p><img>, so the <p> is the flex item. */
section.split .split { display:flex; align-items:center; gap:56px; height:100%; }
section.split .copy { flex:1 1 auto; }
section.split .copy h1 { font-size:1.7em; }
section.split .copy ul { margin:.2em 0 0; padding-left:1.1em; }
section.split .copy li { margin:.35em 0; }
section.split .split > p { margin:0; flex:0 0 auto; }
section.split img { height:560px; }
section.split.hero {
  background:radial-gradient(680px 520px at 78% 50%, rgba(209,62,47,.14), transparent 62%), var(--bg);
}

/* Flow: 2–3 phones in a row on the ORIGINAL light background — same soft grey
   shadow as the hero slide, no dark stage (the dark stage rendered as a hard
   panel over the title/caption in PDF print mode). Flex both .row and the inner
   <p> so phones space evenly whether markdown wraps them in one <p> or several. */
section.flow .row,
section.flow .row p { display:flex; align-items:center; justify-content:center; gap:34px; margin:0; }
section.flow .row img { height:450px; box-shadow:0 16px 38px rgba(15,23,42,.20); }
section.flow .cap { text-align:center; color:var(--muted); font-size:.74em; margin:.9em 0 0; }
</style>

<!--
  Export to per-slide PNGs (local screenshots need the file-access flag):
    marp slides/intro.md --images png --allow-local-files
  Paths are ../screenshots/* because this deck lives in slides/.
-->

<!-- _class: cover -->
<!-- _paginate: false -->

# Blood Help

## Connect with nearby blood donors, support patients in need, and appreciate our community heroes.

Hein Thaw · @heinthaw-dev · vibecode.tours

---

# When blood is needed _now_, the search takes hours

- Families cold-call hospitals and post to Facebook groups
- No fast way to reach a **compatible** donor who's actually nearby
- Every minute of delay raises the risk
- Encourage and appreciate to donors in community.

---

# One request → nearby donors alerted → a callback

- **Post a request** — blood type, units, location
- **Compatible donors nearby get a push** — within minutes
- **They call you back or you can start the call** — help arrives, not paperwork

This end-to-end loop is the whole product. Everything else serves it.

---

<!-- _class: flow -->

# Sign in within seconds

<div class="row">

![h:450](../screenshots/01-phone-entry.png)
![h:450](../screenshots/02-otp-verification.png)

</div>

<p class="cap">Phone number → one-time code. No passwords, no email.</p>

---

<!-- _class: split -->

<div class="split">
<div class="copy">

## One account

# Need blood — or give blood

- A single profile; **requesting** and **donating** are just actions you take
- You choose your path the first time you open the app
- Switch sides anytime — the same you, either way

</div>

![h:560](../screenshots/03-intent-choice.png)

</div>

---

<!-- _class: flow -->

# Become a donor in under a minute

<div class="row">

![h:450](../screenshots/04-donor-setup-filled.png)
![h:450](../screenshots/05-donor-thankyou.png)

</div>

<p class="cap">Blood type, township & contact → opt in to emergency push alerts.</p>

---

<!-- _class: flow -->

# Post a blood request

<div class="row">

![h:450](../screenshots/06-requester-form-filled.png)
![h:450](../screenshots/07-requester-location-dialog.png)

</div>

<p class="cap">Type, units & urgency → share location so we can match donors nearby.</p>

---

<!-- _class: split hero -->

<div class="split">
<div class="copy">

## The core loop, live

# Nearby compatible donors, alerted in real time

- Matches light up as donors respond — no refreshing, no waiting
- The moment someone taps **"I'll help"**, you can call them back
- Hours of phone calls collapse into minutes

</div>

![h:560](../screenshots/08-requester-live-screen.png)

</div>

---

<!-- _class: flow -->

# Confirm the donation with a QR code

<div class="row">

![h:450](../screenshots/09-requester-fulfill-sheet.png)
![h:450](../screenshots/11-requester-qr-scanner.png)
![h:450](../screenshots/12-donor-profile-screen.png)

</div>

<p class="cap">Mark fulfilled → scan the donor's code → the donor shows their QR. Verified, both sides.</p>

---

<!-- _class: flow -->

# Recognition that builds trust

<div class="row">

![h:450](../screenshots/13-donor-congrats.png)
![h:450](../screenshots/14-leaderboard.png)

</div>

<p class="cap">A genuine thank-you and donation milestones → a community leaderboard.</p>

---

# How it's built

**React 19 · Vite 8 · Tailwind v4 · TypeScript** — an installable **PWA** with one merged service worker

- **Supabase (Postgres)** — auth, row-level security, Edge Functions, `pg_cron` expiry jobs
- **Supabase Realtime** — the live donor list & donor congrats-on-scan, over websockets
- **Firebase Cloud Messaging** — donor alerts, "I'll help" responses & resolution pushes
- **Phone + OTP · browser geolocation** — coarse, foreground-only for privacy

Built with **Claude Code**

---

# Try it

- **Live:** https://blood-help-ten.vercel.app/
- **Repo:** https://github.com/heinthaw-dev/blood-help
- **License:** MIT
