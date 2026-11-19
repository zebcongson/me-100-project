// Arm / disarm the alarm.
//   GET  /api/arm  -> {"armed": true|false}   (the receiver polls this)
//   POST /api/arm  -> body {"armed": true|false}, needs the x-alert-secret header
// While disarmed, alerts are still saved and shown, but no phone push is sent,
// and the receiver tells the sender to mute its buzzer.
const { connectLambda, getStore } = require('@netlify/blobs');

const HEADERS = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET' && event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: HEADERS, body: JSON.stringify({ error: 'Use GET or POST' }) };
  }

  if (event.httpMethod === 'POST') {
    const secret = event.headers['x-alert-secret'] || '';
    if (!process.env.ALERT_SECRET || secret !== process.env.ALERT_SECRET) {
      return { statusCode: 401, headers: HEADERS, body: JSON.stringify({ error: 'Wrong or missing secret' }) };
    }
  }

  try {
    connectLambda(event);
    const store = getStore('alerts');

    if (event.httpMethod === 'GET') {
      const saved = await store.get('armed', { type: 'json' });
      const armed = !saved || saved.armed !== false;
      return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ armed }) };
    }

    let raw = event.body || '';
    if (event.isBase64Encoded) raw = Buffer.from(raw, 'base64').toString('utf8');
    let armed;
    try { armed = JSON.parse(raw).armed; } catch (err) { /* handled below */ }
    if (typeof armed !== 'boolean') {
      return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Send {"armed": true} or {"armed": false}' }) };
    }

    await store.setJSON('armed', { armed, ts: Date.now() });
    return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ armed }) };
  } catch (err) {
    return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: 'Storage error: ' + err.message }) };
  }
};
