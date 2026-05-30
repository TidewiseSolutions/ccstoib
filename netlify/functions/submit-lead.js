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

  const { name, email, phone, project_type, property_type, square_footage, message, traffic_source, cfToken } = body;

  if (!name || !email) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Name and email are required' }) };
  }

  // ⚠️ BEFORE DELIVERY — uncomment this block to enforce Turnstile bot protection.
  // Netlify env var needed: CLOUDFLARE_KEY (the secret key, NOT the site key).
  //
  // const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ secret: process.env.CLOUDFLARE_KEY, response: cfToken }),
  // });
  // const verifyData = await verifyRes.json();
  // if (!verifyData.success) {
  //   return { statusCode: 400, body: JSON.stringify({ error: 'Bot check failed' }) };
  // }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

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
      status: 'new',
    }),
  });

  if (!supaRes.ok) {
    const err = await supaRes.text();
    console.error('Supabase error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Failed to save lead' }) };
  }

  return { statusCode: 200, body: JSON.stringify({ success: true }) };
};
