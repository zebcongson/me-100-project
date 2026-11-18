const { connectLambda, getStore } = require('@netlify/blobs');

exports.handler = async (event) => {
  connectLambda(event);
  const store = getStore('alerts');
  const recent = (await store.get('recent', { type: 'json' })) || [];
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify(recent),
  };
};
