// The ESP32 POSTs here when the alarm fires. This sends a push to your phone.
const webpush = require('web-push');

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
  
  webpush.setVapidDetails(
    VAPID_SUBJECT || 'awesomezeb@yahoo.com',
    VAPID_PUBLIC,
    VAPID_PRIVATE
  );

  try {
    await webpush.sendNotification(
      subscription,
      JSON.stringify({ title: 'U-lock alarm', message, level }),
      { TTL: 60, urgency: 'high' }
    );
    return { statusCode: 200, body: 'sent' };
  } catch (err) {
    return {
      statusCode: err.statusCode || 500,
      body: 'Push failed: ' + (err.body || err.message),
    };
  }
};
