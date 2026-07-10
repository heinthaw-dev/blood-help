# User Feedback — Blood Help

- **How collected:** Feedback from Relative
- **When:** 2026-07-08

## Raw feedback

1. Instructions and UI/UX are clear in Burmese, and the app guides the user through each step so it's obvious what to do next.
2. Requesters and donors can actually reach and communicate with each other through the app — this is a real, working connection, not just a demo/test flow.
3. Both donors and requesters get live push notifications via FCM, so nobody has to sit and refresh the app to know what's happening.
4. She genuinely hopes this app will go on to help a lot of people.

For improvement:

1. FCM push notifications need to be optimized on iOS — delivery/behavior isn't as reliable there as on Android.
2. On iOS, "Add to Home Screen" only works from Safari — the app should clearly instruct iOS users to open it in Safari first, or they'll get stuck.
3. When a donor taps "I'll help," the requester should get a live FCM notification right away, not just a delayed or missing update.
4. The app needs public marketing — a campaign or other outreach — to grow its donor base. More donors means better odds of finding a compatible match near any given requester.

## Themes (what keeps coming up)

- Burmese-first, step-by-step UX is landing well and building trust
- The core request ↔ donor loop is genuinely functional end-to-end, not just simulated
- FCM push is a highlight, but iOS is the weak platform for it (delivery reliability, install flow)
- Growth is now the bottleneck — the product works, but needs more donors on the platform to be useful at scale

## Top 3 things to fix

- [ ] Optimize FCM push delivery on iOS, and add clear "open in Safari to Add to Home Screen" onboarding for iOS users
- [ ] Send requesters a live FCM notification the moment a donor taps "I'll help"
- [ ] Plan a public marketing/outreach campaign to grow the donor base and improve nearby-donor match rates
