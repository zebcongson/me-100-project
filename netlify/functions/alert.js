// The ESP32 POSTs here when the alarm fires. Saves every alert, pushes only HIGH.
const webpush = require('web-push');
const { connectLambda, getStore } = require('@netlify/blobs');

function levelFrom(text) {
  if (/HIGH/i.test(text)) return 'HIGH';
  if (/MID/i.test(text)) return 'MID';
  if (/LOW/i.test(text)) return 'LOW';
  return 'HIGH';
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Use POST' };
  }

  const secret = event.headers['x-alert-secret'] || '';
  if (!process.env.ALERT_SECRET || secret !== process.env.ALERT_SECRET) {
    return { statusCode: 401, body: 'Wrong or missing secret' };
  }

  const { VAPID_PUBLIC, VAPID_PRIVATE, VAPID_SUBJECT, PUSH_SUBSCRIPTION } = process.env;
  if (!VAPID_PUBLIC || !VAPID_PRIVATE || !PUSH_SUBSCRIPTION) {
    return { statusCode: 500, body: 'Missing VAPID_PUBLIC, VAPID_PRIVATE or PUSH_SUBSCRIPTION' };
  }

  let subscription;
  try {
    subscription = JSON.parse(PUSH_SUBSCRIPTION);
  } catch (err) {
    return { statusCode: 500, body: 'PUSH_SUBSCRIPTION is not valid JSON' };
  }

  // Accept JSON ({"level":"HIGH","message":"..."}) or plain text from the ESP32.
  let raw = event.body || '';
  if (event.isBase64Encoded) raw = Buffer.from(raw, 'base64').toString('utf8');
  let message = 'Movement detected';
  let level;
  try {
    const parsed = JSON.parse(raw);
    if (parsed.message) message = String(parsed.message);
    if (parsed.level) level = String(parsed.level).toUpperCase();
  } catch (err) {
    if (raw) message = raw;
  }
  if (!['LOW', 'MID', 'HIGH'].includes(level)) level = levelFrom(message);

  console.log('ALERT', level, JSON.stringify(message), 'from', event.headers['user-agent'] || 'unknown');

  // Save every alert so the page can show LOW/MID/HIGH history, and read the armed state.
  let armed = true;
  try {
    connectLambda(event);
    const store = getStore('alerts');
    const recent = (await store.get('recent', { type: 'json' })) || [];
    recent.unshift({ level, message, ts: Date.now() });
    await store.setJSON('recent', recent.slice(0, 50));
    const state = await store.get('armed', { type: 'json' });
    armed = !state || state.armed !== false;
  } catch (err) {
    console.log('Could not save alert:', err.message);
  }

  // The receiver reads "armed" from this reply and passes it on to the sender.
  const reply = (statusCode, result) => ({
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ armed, result }),
  });

  // Only HIGH sends a phone push, and only while armed
  if (level !== 'HIGH') {
    return reply(200, 'saved, no push');
  }
  if (!armed) {
    return reply(200, 'disarmed, no push');
  }

  webpush.setVapidDetails(
    VAPID_SUBJECT || 'mailto:awesomezeb@yahoo.com',
    VAPID_PUBLIC,
    VAPID_PRIVATE
  );

  try {
    await webpush.sendNotification(
      subscription,
      JSON.stringify({ title: 'U-lock alarm', message, level }),
      { TTL: 60, urgency: 'high' }
    );
    return reply(200, 'sent');
  } catch (err) {
    return reply(err.statusCode || 500, 'Push failed: ' + (err.body || err.message));
  }
};
