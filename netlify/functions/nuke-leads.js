exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  let body;
  try { body = JSON.parse(event.body); } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request' }) };
  }

  if (body.confirm !== 'DELETE') {
    return { statusCode: 400, body: JSON.stringify({ error: 'Confirmation required' }) };
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;

  console.log('SUPABASE_URL set:', !!url);
  console.log('SUPABASE_SERVICE_KEY set:', !!key);

  if (!url || !key) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Server not configured' }) };
  }

  const res = await fetch(`${url}/rest/v1/leads?client_id=eq.ccst`, {
    method: 'DELETE',
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
  });

  console.log('Supabase DELETE status:', res.status);

  if (!res.ok) {
    const err = await res.text();
    console.error('Supabase delete error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Delete failed', detail: err }) };
  }

  const deleted = await res.json().catch(() => []);
  console.log('Rows deleted:', deleted.length);

  return { statusCode: 200, body: JSON.stringify({ success: true, deleted: deleted.length }) };
};
