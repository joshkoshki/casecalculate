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

const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ============================================================
// PDF generation — matches the branded lead document style
// (warm vellum accents, oxblood + gold), attached to every lead
// email alongside the HTML body. Pure JS via pdf-lib, no native
// dependencies, so it runs cleanly in Vercel's serverless
// environment with nothing extra to configure.
// ============================================================
const COLOR = {
  oxblood: rgb(0x6e / 255, 0x23 / 255, 0x32 / 255),
  gold: rgb(0x92 / 255, 0x79 / 255, 0x3c / 255),
  ink: rgb(0x21 / 255, 0x1d / 255, 0x17 / 255),
  inkSoft: rgb(0x5b / 255, 0x56 / 255, 0x48 / 255),
  line: rgb(0xe6 / 255, 0xe0 / 255, 0xd2 / 255),
  bg: rgb(0xf6 / 255, 0xf1 / 255, 0xe6 / 255),
};

function wrapText(text, font, size, maxWidth) {
  const words = String(text).split(' ');
  const lines = [];
  let current = '';
  for (const w of words) {
    const trial = (current + ' ' + w).trim();
    if (font.widthOfTextAtSize(trial, size) <= maxWidth) {
      current = trial;
    } else {
      if (current) lines.push(current);
      current = w;
    }
  }
  if (current) lines.push(current);
  return lines;
}

async function buildLeadPdf(lead) {
  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const PAGE_W = 612, PAGE_H = 792;
  const margin = 61;
  const contentW = PAGE_W - margin * 2;

  let page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - margin;

  function newPage() {
    page = pdfDoc.addPage([PAGE_W, PAGE_H]);
    y = PAGE_H - margin;
  }

  function ensureSpace(needed) {
    if (y - needed < margin) newPage();
  }

  function text(str, x, size, font, color, yOverride) {
    page.drawText(str, { x, y: yOverride !== undefined ? yOverride : y, size, font, color });
  }

  function hr(color = COLOR.line, width = 0.5) {
    page.drawLine({
      start: { x: margin, y },
      end: { x: margin + contentW, y },
      thickness: width,
      color,
    });
  }

  // ---- Header ----
  text('N E W   L E A D', margin, 9, fontBold, COLOR.gold);
  y -= 26;
  text(lead.name || 'No name provided', margin, 24, fontBold, COLOR.ink);
  y -= 22;
  text((lead.categories || []).join(', '), margin, 12, fontRegular, COLOR.inkSoft);
  y -= 30;

  // ---- Contact block ----
  const rowH = 24;
  page.drawRectangle({ x: margin, y: y - rowH, width: contentW, height: rowH, color: COLOR.bg });
  text('PHONE', margin + 10, 8, fontBold, COLOR.gold, y - 15);
  text(lead.phone || 'Not provided', margin + 100, 11, fontRegular, COLOR.ink, y - 16);
  y -= rowH;
  hr();
  text('EMAIL', margin + 10, 8, fontBold, COLOR.gold, y - 15);
  text(lead.email || 'Not provided', margin + 100, 11, fontRegular, COLOR.ink, y - 16);
  y -= rowH;
  page.drawRectangle({
    x: margin, y, width: contentW, height: rowH * 2,
    borderColor: COLOR.ink, borderWidth: 1,
  });
  y -= 30;

  // ---- Free text, if provided ----
  if (lead.freeText && lead.freeText.trim()) {
    const labelY = y;
    text('IN THEIR OWN WORDS', margin + 12, 8, fontBold, COLOR.gold);
    y -= 16;
    const lines = wrapText(lead.freeText, fontRegular, 11, contentW - 24);
    const blockTop = labelY + 10;
    lines.forEach(line => {
      ensureSpace(16);
      text(line, margin + 12, 11, fontRegular, COLOR.ink);
      y -= 15;
    });
    const blockBottom = y - 6;
    page.drawRectangle({
      x: margin, y: blockBottom, width: 3, height: blockTop - blockBottom,
      color: COLOR.gold,
    });
    y -= 20;
  }

  // ---- Full case detail ----
  ensureSpace(40);
  text('F U L L   C A S E   D E T A I L', margin, 11, fontBold, COLOR.ink);
  y -= 6;
  hr(COLOR.ink, 1);
  y -= 22;

  let lastSection = null;
  for (const a of lead.answers || []) {
    ensureSpace(70);

    if (a.section !== lastSection) {
      ensureSpace(30);
      text(a.section, margin, 9, fontBold, COLOR.gold);
      y -= 18;
      lastSection = a.section;
    }

    const qLines = wrapText(a.title, fontBold, 11, contentW);
    qLines.forEach(line => {
      ensureSpace(15);
      text(line, margin, 11, fontBold, COLOR.ink);
      y -= 15;
    });

    const ansLines = wrapText(a.answer, fontRegular, 11, contentW);
    ansLines.forEach(line => {
      ensureSpace(15);
      text(line, margin, 11, fontRegular, COLOR.inkSoft);
      y -= 15;
    });

    y -= 6;
    hr();
    y -= 18;
  }

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes).toString('base64');
}

function buildEmailHtml(lead) {
  const {
    name, phone, email,
    categories,
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
      <div style="font-size:14px; margin-top:6px; opacity:0.9;">${escapeHtml((categories || []).join(', '))}</div>
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

  const subject = `New Lead: ${lead.name || 'Unknown'} — ${(lead.categories || []).join(', ')}`;

  // Build the attached PDF. Isolated in its own try/catch so a
  // PDF generation failure never blocks the email itself from
  // sending — the email body has the full details either way.
  let pdfAttachment = null;
  try {
    const pdfBase64 = await buildLeadPdf(lead);
    const safeName = (lead.name || 'lead').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    pdfAttachment = {
      filename: `lead-${safeName}.pdf`,
      content: pdfBase64,
    };
  } catch (err) {
    console.error('submit-lead: PDF generation failed, sending email without attachment', err);
  }

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
        attachments: pdfAttachment ? [pdfAttachment] : undefined,
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
