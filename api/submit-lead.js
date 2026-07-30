// ============================================================
// api/submit-lead.js
//
// Vercel serverless function. Receives a completed lead from
// the calculator's Submit button and emails the full details
// to the site owner via Resend. No database — email is the
// only place a lead is stored, by design (see handoff doc).
//
// Required environment variables (set these in Vercel's
// project settings, NOT in this file, NOT in source control):
//
//   RESEND_API_KEY   — your Resend API key (starts with re_)
//   LEAD_EMAIL_TO    — the email address leads should be sent to
//   RESEND_FROM      — optional. Defaults to Resend's shared
//                       test sender (onboarding@resend.dev),
//                       which works immediately with zero setup.
//                       Once you verify your own domain in
//                       Resend, set this to something like
//                       "Case Calculator <leads@yourdomain.com>"
//                       for a more branded "from" address.
// ============================================================

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildEmailHtml(lead) {
  const {
    name, phone, email,
    categories, tierLabel, estimateDisplay,
    freeText, answers, // answers is an ordered array of {section, title, answer}
  } = lead;

  const answerRows = answers.map(a => `
    <tr>
      <td style="padding:6px 12px 6px 0; font-size:12px; color:#8a8474; text-transform:uppercase; letter-spacing:0.04em; white-space:nowrap; vertical-align:top;">${escapeHtml(a.section)}</td>
      <td style="padding:6px 0; font-size:14px; color:#211D17; vertical-align:top;">
        <div style="font-weight:600; margin-bottom:2px;">${escapeHtml(a.title)}</div>
        <div style="color:#5B5648;">${escapeHtml(a.answer)}</div>
      </td>
    </tr>
  `).join('');

  return `
  <div style="font-family: Arial, sans-serif; max-width:640px; margin:0 auto; color:#211D17;">
    <div style="background:#6E2332; color:#F6F1E6; padding:20px 24px; border-radius:4px 4px 0 0;">
      <div style="font-size:12px; letter-spacing:0.08em; text-transform:uppercase; opacity:0.8;">New Lead</div>
      <div style="font-size:22px; font-weight:700; margin-top:4px;">${escapeHtml(name || 'No name provided')}</div>
      <div style="font-size:14px; margin-top:6px; opacity:0.9;">${escapeHtml((categories || []).join(', '))} &middot; ${escapeHtml(tierLabel)} (${escapeHtml(estimateDisplay)})</div>
    </div>

    <div style="padding:20px 24px; border:1px solid #e6e0d2; border-top:none;">
      <table style="width:100%; border-collapse:collapse; margin-bottom:20px;">
        <tr>
          <td style="padding:4px 12px 4px 0; font-size:12px; color:#8a8474; text-transform:uppercase;">Phone</td>
          <td style="padding:4px 0; font-size:14px;"><a href="tel:${escapeHtml(phone)}" style="color:#6E2332;">${escapeHtml(phone || 'Not provided')}</a></td>
        </tr>
        <tr>
          <td style="padding:4px 12px 4px 0; font-size:12px; color:#8a8474; text-transform:uppercase;">Email</td>
          <td style="padding:4px 0; font-size:14px;"><a href="mailto:${escapeHtml(email)}" style="color:#6E2332;">${escapeHtml(email || 'Not provided')}</a></td>
        </tr>
      </table>

      ${freeText ? `
        <div style="background:#F6F1E6; border-left:3px solid #92793C; padding:12px 16px; margin-bottom:20px; font-size:14px; line-height:1.5;">
          <div style="font-size:11px; text-transform:uppercase; letter-spacing:0.06em; color:#8a8474; margin-bottom:6px;">In their own words</div>
          ${escapeHtml(freeText).replace(/\n/g, '<br>')}
        </div>
      ` : ''}

      <div style="font-size:11px; text-transform:uppercase; letter-spacing:0.06em; color:#8a8474; margin-bottom:8px; border-top:1px solid #e6e0d2; padding-top:16px;">
        Full case detail
      </div>
      <table style="width:100%; border-collapse:collapse;">
        ${answerRows}
      </table>
    </div>
  </div>
  `;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  let lead;
  try {
    lead = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch (err) {
    res.status(400).json({ error: 'Invalid request body' });
    return;
  }

  if (!lead || (!lead.email && !lead.phone)) {
    res.status(400).json({ error: 'Missing contact information' });
    return;
  }

  // ---- Bot detection ------------------------------------------
  // Both checks fail silently: respond with a normal success so
  // a bot gets no signal that it was caught, but skip sending
  // the email entirely. Log server-side (visible in Vercel's
  // Logs tab) so real bot traffic is visible without cluttering
  // the inbox.
  if (lead.website && String(lead.website).trim() !== '') {
    console.warn('submit-lead: blocked — honeypot field was filled', { name: lead.name });
    res.status(200).json({ ok: true });
    return;
  }

  // A real person can't read every question, tap through 15+
  // screens, and fill out a contact form in under ~8 seconds.
  // Adjust this threshold if it ever produces false positives
  // for genuinely fast real users.
  const MIN_PLAUSIBLE_MS = 8000;
  if (typeof lead.elapsedMs === 'number' && lead.elapsedMs < MIN_PLAUSIBLE_MS) {
    console.warn('submit-lead: blocked — submitted implausibly fast', { name: lead.name, elapsedMs: lead.elapsedMs });
    res.status(200).json({ ok: true });
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  const toAddress = process.env.LEAD_EMAIL_TO;
  const fromAddress = process.env.RESEND_FROM || 'Case Calculator <onboarding@resend.dev>';

  if (!apiKey || !toAddress) {
    // Misconfiguration on the server side. Log it clearly so
    // whoever's debugging can find it in Vercel's function logs,
    // but don't block the visitor's experience over it.
    console.error('submit-lead: missing RESEND_API_KEY or LEAD_EMAIL_TO environment variable');
    res.status(200).json({ ok: true, warning: 'email-not-configured' });
    return;
  }

  const subject = `New Lead: ${lead.name || 'Unknown'} — ${(lead.categories || []).join(', ')} — ${lead.tierLabel || ''}`;

  try {
    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [toAddress],
        subject,
        html: buildEmailHtml(lead),
      }),
    });

    if (!emailRes.ok) {
      const errBody = await emailRes.text();
      console.error('submit-lead: Resend API error', emailRes.status, errBody);
      // Still return success to the visitor — a failed email
      // shouldn't block their experience. The error is logged
      // server-side for the site owner to investigate.
      res.status(200).json({ ok: true, warning: 'email-send-failed' });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('submit-lead: unexpected error sending email', err);
    res.status(200).json({ ok: true, warning: 'email-send-failed' });
  }
};
