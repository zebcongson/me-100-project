// Gives the web app the public VAPID key it needs to subscribe to push.
exports.handler = async () => ({
  statusCode: 200,
  headers: { 'Content-Type': 'text/plain' },
  body: process.env.VAPID_PUBLIC || '',
});
