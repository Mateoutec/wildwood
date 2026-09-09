const {test} = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const {assetPath,serveAsset} = require('../desktop/assets.cjs');
const root = path.resolve(__dirname,'../dist');
test('desktop protocol resolves its own bundled resources and rejects outside paths',()=>{
  assert.equal(assetPath(root,'wildwood://game/'),path.join(root,'index.html'));
  assert.equal(assetPath(root,'wildwood://game/assets/example.js'),path.join(root,'assets','example.js'));
  for(const url of ['file:///C:/Windows/win.ini','https://example.com/game.js','wildwood://other/index.html','wildwood://game/%2e%2e%5cpackage.json','wildwood://user:pass@game/index.html','wildwood://game/%00file'])assert.equal(assetPath(root,url),null);
});
test('desktop responses use a restrictive policy and correct module MIME types',async()=>{
  const response=await serveAsset(root,{url:'wildwood://game/',method:'GET'});
  assert.equal(response.status,200);assert.match(response.headers.get('Content-Type'),/text\/html/);
  assert.match(response.headers.get('Content-Security-Policy'),/worker-src 'self'/);
  assert.match(await response.text(),/Wildwood/);
  assert.equal((await serveAsset(root,{url:'wildwood://game/not-found',method:'GET'})).status,404);
  assert.equal((await serveAsset(root,{url:'wildwood://game/',method:'POST'})).status,405);
});
