/**
 * Single source of truth for the address every outbound email is sent from.
 *
 * Resend refuses to deliver mail from a domain it has not verified, so the
 * domain part of MAIL_FROM must exist in the Resend dashboard with all of its
 * DNS records (the `send` MX + SPF, `resend._domainkey` DKIM and `_dmarc`)
 * confirmed. Until then every verification code and password-reset link fails
 * with:
 *
 *   {"error":"The shieldsafebank.com domain is not verified.
 *             Please, add and verify your domain on https://resend.com/domains"}
 *
 * `node check-email-dns.js` reads these values and reports exactly which
 * records are still missing, so the address never has to be duplicated (and
 * silently drift) between the mailer and the diagnostics.
 */
const MAILBOX = 'no-reply@shieldsafebank.com';

/** `From` header for every email the API sends, display name included. */
export const MAIL_FROM = `Shield Safe Bank <${MAILBOX}>`;

/** Domain that must be verified in Resend — the part after "@" in MAILBOX. */
export const SENDING_DOMAIN = MAILBOX.slice(MAILBOX.indexOf('@') + 1);
