// TEMPORARY: prints a fresh VAPID key pair. Open /api/keys once, copy the keys
// into Netlify environment variables, then DELETE this file and redeploy.
const webpush = require('web-push');

exports.handler = async () => ({
  statusCode: 200,
  headers: { 'Content-Type': 'text/plain' },
  body: JSON.stringify(webpush.generateVAPIDKeys(), null, 2),
});
