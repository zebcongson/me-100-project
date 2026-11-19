const { connectLambda, getStore } = require('@netlify/blobs');

exports.handler = async (event) => {
  connectLambda(event);
  const store = getStore({ name: 'alerts', consistency: 'strong' });
  const recent = (await store.get('recent', { type: 'json' })) || [];
  const state = await store.get('armed', { type: 'json' });
  const armed = !state || state.armed !== false;
  return {
    statusCode: 200,
    // X-Armed rides along so the page learns the armed state without a second request.
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Armed': String(armed) },
    body: JSON.stringify(recent),
  };
};
