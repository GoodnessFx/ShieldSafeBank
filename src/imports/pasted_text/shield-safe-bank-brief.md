Build Shield Safe Bank, a crypto-to-fiat banking web platform. It must look and read like a real, operating financial company, not a demo or template.

BRAND
Name: Shield Safe Bank. Logo: a navy shield with a padlock, wordmark stacked "SHIELD / SAFE / BANK."
Colors: Primary Navy #1B3A5C, Deep Navy #12283F, Steel Blue #4A7DA8, Ink #0F2338, Fog #F4F6F8 (section backgrounds), Border #DCE3EA, Success Green #1E7A4C, Amber #9A6B00, White #FFFFFF. Use only this palette.
Typography: one confident geometric sans for headlines (e.g. Sora), one clean sans for body and UI (e.g. Inter), a monospace face for every number, balance, and rate (e.g. IBM Plex Mono). Numbers should always look like ledger entries, never like body text.
Tone: direct, confident, unhurried, short sentences. No em dashes. No "unlock," "seamless," "revolutionize," "empower," or similar filler. Nothing that reads like it was generated rather than written by someone who has moved money before.

DESIGN DIRECTION (be deliberate here, not decorative)
The subject is a bank that does one specific thing: converts crypto to dollars at a locked rate. Let that fact drive the visual language instead of generic fintech styling.
- Signature device: the site's one bold, memorable element is a live conversion ledger, an interactive widget where someone types an amount of BTC or USDT and watches it resolve into a dollar figure in real monospace type. This appears in the homepage hero and nowhere else, so it stays special.
- Surfaces: flat white and fog backgrounds with hairline borders (1px, #DCE3EA), not rounded shadow cards. This should feel like a ledger or a statement, not a SaaS dashboard. Avoid the identical-rounded-card-with-soft-shadow pattern entirely.
- Structure as information: use numbered steps only where content is genuinely sequential (the deposit-to-withdrawal flow). Do not add numbering, eyebrow labels, or all-caps section tags anywhere else, they read as decoration.
- Motion: one deliberate moment only, a balance count-up animation when the dashboard loads. Hover states on buttons and links change color, not scale or shadow. No scroll-triggered fade-ins on every section, that is the generic default and should be avoided on purpose.
- Iconography: a single consistent line-icon set, one stroke weight throughout, used sparingly (chat, copy, download, status). No mixed icon styles, no emoji.
- No stock photography anywhere. If imagery is needed, use abstract geometric treatments built from the shield motif and straight ledger lines, nothing generic or AI-image-looking.
- Line length under 80 characters for body copy, left-aligned throughout, no centered paragraphs.

CORE PRODUCT LOGIC
Deposits are crypto-only: BTC and USDT (ERC-20 and TRC-20). Withdrawals are fiat-only: USD, to a linked bank account (ACH/wire) or debit card. No crypto withdrawals, no fiat deposits. State this plainly on the homepage.
Flow: sign up, verify identity (ID plus liveness check), receive a unique BTC and USDT deposit address, deposit is confirmed on-chain and converted to a USD balance at the rate locked at confirmation time (not at withdrawal time), balance sits like a normal bank balance, user withdraws to bank or card whenever they want, full transaction history and downloadable statements.
Currency and number formatting: USD always to two decimals with thousands separators ($12,480.50). Crypto amounts show up to 8 decimals for BTC, 2 for USDT, trimmed of trailing zeros. All figures in monospace, right-aligned in tables.

PAGES
Home: hero stating "Send crypto. Bank in dollars," the conversion ledger widget, a three-step how-it-works section, a why-us section, a security section, a closing call to action.
How It Works: detailed step-by-step walkthrough with a worked numeric example.
Security: custody model, cold storage majority, segregated reserve accounts, per-account on-chain monitoring, 2FA, withdrawal review, independent audits.
Fees: flat, fully itemized fee table, no hidden markups.
Personal Banking and Business Banking: separate pages, each with its own feature set and a signup CTA.
About: founding story, written like people actually wrote it.
Support: help center organized into categories (Getting Started, Deposits, Withdrawals, Security, Fees, Verification), a contact form, support email and hours.
Legal: Terms, Privacy, and AML/KYC policy sections.
Login, Sign Up, and Forgot Password: simple forms, personal/business toggle on signup, a working password-reset request flow (email sent confirmation screen, even if the email itself is stubbed for now).
Email verification: a screen shown right after signup prompting the user to confirm their address before continuing to identity verification.
Dashboard (authenticated): balance, BTC/USDT deposit addresses with copy buttons, a withdrawal form, transaction history, downloadable statements.
404 page for any unmatched route.
Hidden admin console: not linked anywhere in the public site or sitemap, reachable only by a long, non-guessable path. Separate login from customer accounts, 2FA. Inside: a live chat inbox to talk to customers, a user directory with balance and status, a transaction log with hold/release controls, a KYC review queue with approve/reject actions.

EMPTY, ERROR, AND LOADING STATES (do not skip these)
- New account with no activity: dashboard shows an empty-state message inviting the first deposit, not a blank table.
- No open chat threads (admin side): a plain message saying there is nothing waiting right now.
- Withdrawal exceeds balance: inline error stating the available balance, no generic "something went wrong."
- Deposit sent on the wrong network or wrong asset: a support-facing help article covers this, and the dashboard deposit screen warns which network to use before showing the address.
- Pending KYC: dashboard shows a clear "verification in progress" state instead of letting the user reach a broken deposit screen.
- Any async action (submitting a withdrawal, sending a chat message, approving KYC) shows a brief loading state on the button itself, not a full-page spinner.
- Confirmations use plain language in the product's own voice: "Withdrawal requested" not "Success!"

CUSTOMER CARE
A persistent chat widget, bottom right, on every public and dashboard page (not on the admin console). Opens with "Talk to a real person." Falls back to a contact form when no one is available.

ACCESSIBILITY AND QUALITY BAR
Visible keyboard focus states on every interactive element. Alt text on any meaningful graphic. Reduced-motion respected for the one animated moment. Color contrast meets normal text-readability standards against both white and fog backgrounds. No content or action that depends on color alone (pair status colors with a text label, as in "Pending").

SEO AND METADATA
Unique page title and meta description per page. A social preview image using the shield mark and navy background, not a screenshot of the UI. Favicon built from the shield mark alone (no wordmark, it needs to read at 16px).

TECHNICAL
React, TypeScript, Tailwind, fully responsive from 320px up, no horizontal overflow anywhere, tap targets at least 44px. Breakpoints tested at 375, 768, 1024, and 1440px. Statements should be print-friendly (clean printed layout, no navigation or chat widget in the print view).

ONE THING TO KEEP IN MIND
This platform is being built for demonstration and investor review first. Taking real customer deposits later means operating in regulated territory (money transmission, KYC/AML, possibly a banking charter), which is a separate legal step from the build itself.