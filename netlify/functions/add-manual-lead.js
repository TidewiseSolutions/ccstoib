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

  const { name, email, phone, project_type, square_footage, traffic_source, message, status } = body;

  if (!name || !email) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Name and email are required' }) };
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

  const res = await fetch(`${SUPABASE_URL}/rest/v1/leads`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify({
      name, email,
      phone:          phone          || null,
      project_type:   project_type   || null,
      square_footage: square_footage || null,
      traffic_source: traffic_source || null,
      message:        message        || null,
      client_id:      'ccst',
      status:         status         || 'new',
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('Supabase error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Failed to save lead' }) };
  }

  return { statusCode: 200, body: JSON.stringify({ success: true }) };
};
