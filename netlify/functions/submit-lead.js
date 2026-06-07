exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request' }) };
  }

  const { name, email, phone, project_type, property_type, square_footage, message, traffic_source, cfToken, website } = body;

  if (website) {
    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  }

  if (!name || !email) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Name and email are required' }) };
  }

  const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret: process.env.CLOUDFLARE_KEY, response: cfToken }),
  });
  const verifyData = await verifyRes.json();
  if (!verifyData.success) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Bot check failed' }) };
  }

  const SUPABASE_URL      = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

  // ── Duplicate check ────────────────────────────────────────────────────────
  // Flag as duplicate if same email + phone already exists for this client.
  // We still insert so it's visible in the dashboard, but it won't count as valid.
  let isDuplicate = false;
  if (phone) {
    const dupCheck = await fetch(
      `${SUPABASE_URL}/rest/v1/leads?client_id=eq.ccst&email=eq.${encodeURIComponent(email)}&phone=eq.${encodeURIComponent(phone)}&select=id&limit=1`,
      {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
      }
    );
    if (dupCheck.ok) {
      const existing = await dupCheck.json();
      if (existing.length > 0) isDuplicate = true;
    }
  }

  const supaRes = await fetch(`${SUPABASE_URL}/rest/v1/leads`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify({
      name, email, phone, project_type, property_type,
      square_footage, message, traffic_source,
      client_id: 'ccst',
      status: isDuplicate ? 'duplicate' : 'new',
    }),
  });

  if (!supaRes.ok) {
    const err = await supaRes.text();
    console.error('Supabase error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Failed to save lead' }) };
  }

  // ── Email notification (skip for duplicates) ───────────────────────────────
  const RESEND_KEY = process.env.RESEND_API_KEY;
  if (RESEND_KEY && !isDuplicate) {
    const submitted = new Date().toLocaleString('en-US', {
      timeZone: 'America/New_York',
      month: 'long', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true,
    });

    const row = (label, value) => value ? `
      <tr>
        <td style="padding:10px 16px;font-size:13px;color:#6a8090;font-weight:600;
                   text-transform:uppercase;letter-spacing:0.06em;white-space:nowrap;
                   width:140px;vertical-align:top;">${label}</td>
        <td style="padding:10px 16px;font-size:15px;color:#0D2B3E;vertical-align:top;">${value}</td>
      </tr>` : '';

    const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F0F4F7;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F0F4F7;padding:32px 16px;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#0E5F7A 0%,#1A8FA8 100%);
                     border-radius:12px 12px 0 0;padding:28px 32px;">
            <p style="margin:0 0 2px;font-size:11px;font-weight:700;letter-spacing:0.14em;
                      text-transform:uppercase;color:rgba(255,255,255,0.6);">
              Coastal Carolina Synthetic Turf
            </p>
            <h1 style="margin:0;font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.01em;">
              New Lead Received
            </h1>
            <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.65);">${submitted}</p>
          </td>
        </tr>

        <!-- Lead name banner -->
        <tr>
          <td style="background:#2E8B3E;padding:14px 32px;">
            <p style="margin:0;font-size:18px;font-weight:700;color:#ffffff;">${name}</p>
          </td>
        </tr>

        <!-- Lead details -->
        <tr>
          <td style="background:#ffffff;padding:8px 16px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              ${row('Phone', phone)}
              ${row('Email', `<a href="mailto:${email}" style="color:#1A8FA8;text-decoration:none;">${email}</a>`)}
              ${row('Project', project_type)}
              ${row('Size', square_footage)}
              ${row('Source', traffic_source)}
            </table>
          </td>
        </tr>

        ${message ? `
        <!-- Message -->
        <tr>
          <td style="background:#ffffff;padding:0 32px 8px;">
            <div style="border-top:1px solid #EBF0F2;padding-top:16px;">
              <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:0.1em;
                        text-transform:uppercase;color:#6a8090;">Message</p>
              <p style="margin:0;font-size:15px;color:#0D2B3E;line-height:1.6;">${message}</p>
            </div>
          </td>
        </tr>
        <tr><td style="background:#ffffff;height:20px;"></td></tr>
        ` : `<tr><td style="background:#ffffff;height:8px;"></td></tr>`}

        <!-- CTA -->
        <tr>
          <td style="background:#ffffff;padding:0 32px 28px;">
            <a href="https://coastalcarolinasyntheticturf.com/dashboard.html"
               style="display:inline-block;padding:12px 24px;background:#2E8B3E;color:#ffffff;
                      font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;
                      text-decoration:none;border-radius:7px;">
              View in Dashboard →
            </a>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#F0F4F7;border-radius:0 0 12px 12px;padding:20px 32px;
                     text-align:center;border-top:1px solid #DDE4E9;">
            <p style="margin:0;font-size:12px;color:#9ab0bc;">
              Tidewise Solutions · tidewisesolutions.com
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>

</body>
</html>`;

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from:     'Coastal Carolina Synthetic Turf <leads@tidewisesolutions.com>',
        to:       ['matt@ccstoib.com', 'justn.ccstoib@gmail.com'],
        reply_to: 'matt@ccstoib.com',
        subject:  `New Lead: ${name}${project_type ? ` — ${project_type}` : ''}`,
        html,
      }),
    }).catch(err => console.error('Resend error:', err));
  }

  return { statusCode: 200, body: JSON.stringify({ success: true }) };
};
