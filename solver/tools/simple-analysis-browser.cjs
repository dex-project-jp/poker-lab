const {chromium,webkit}=require('playwright');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),engine=process.env.POKER_BROWSER||'chromium';
const server=http.createServer((req,res)=>{let p=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!p.startsWith(root+path.sep)){res.writeHead(403).end();return;}try{res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':p.endsWith('.html')?'text/html':p.endsWith('.css')?'text/css':'text/plain');res.end(fs.readFileSync(p));}catch{res.writeHead(404).end();}});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;try{
 browser=await ({chromium,webkit}[engine]).launch();
 for(const width of [375,390,430]){
  const page=await browser.newPage({viewport:{width,height:844},isMobile:true,hasTouch:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/simple-analysis.html`);
  const picker = page.locator('#picker');
  const choose = async (index, card) => {
   await page.locator('#card' + index).tap();
   await page.locator('#rankOptions').getByRole('button',{name:card[0],exact:true}).tap();
   await page.locator('#suitOptions [data-suit=' + card[1] + ']').tap();
   assert.equal(await page.locator('#card' + index).getAttribute('data-suit'),card[1]);
  };
  await page.waitForFunction(()=>document.querySelectorAll('#range button').length===169);
  assert.equal(await page.locator('#customRange').isVisible(),false);
  assert.equal(await page.locator('#result').isVisible(),false);
  await page.locator('#card0').tap();
  assert.ok(await picker.evaluate(el=>el.open && el.getBoundingClientRect().bottom >= innerHeight - 1));
  await page.locator('#rankOptions').getByRole('button',{name:'A',exact:true}).tap();
  await page.locator('#suitOptions [data-suit=s]').tap();
  assert.match(await page.locator('#pickerTitle').textContent(),/自分の2枚目/);
  await page.locator('#rankOptions').getByRole('button',{name:'A',exact:true}).tap();
  assert.equal(await page.locator('#suitOptions [data-suit=s]').isDisabled(),true);
  await page.locator('#autoNext').uncheck();
  await page.locator('#suitOptions [data-suit=h]').tap();
  for(const [i,c] of ['Ac','Ad','2c','3d','4h'].entries()) await choose(i+2,c);
  await page.locator('#pot').fill('100');await page.locator('#bet').fill('50');
  assert.ok(await page.locator('.amounts').evaluate(el=>el.children[0].getBoundingClientRect().top===el.children[1].getBoundingClientRect().top));
  await page.locator('#calculate').tap();
  assert.match(await page.locator('#status').textContent(),/相手レンジを選択/);
  assert.equal(await page.locator('#result').isVisible(),false);
  for(const [mode,count] of [['all',169],['tight',9],['middle',21],['loose',43]]){
   await page.locator('#preset').selectOption(mode);
   assert.match(await page.locator('#presetSummary').textContent(),new RegExp(count+'クラス'));
   assert.equal(await page.locator('#customRange').isVisible(),false);
  }
  await page.locator('#calculate').tap();
  await page.waitForFunction(()=>!document.querySelector('#result').hidden);
  await page.locator('#preset').selectOption('custom');
  assert.equal(await page.locator('#result').isVisible(),false);
  assert.equal(await page.locator('#customRange').isVisible(),true);
  await page.locator('#calculate').tap();
  assert.match(await page.locator('#status').textContent(),/空/);
  await page.locator('[data-hand=KK]').tap();await page.locator('#calculate').tap();
  await page.waitForFunction(()=>!document.querySelector('#result').hidden);
  assert.equal(await page.locator('#verdict').textContent(),'コール有利');
  assert.equal(await page.locator('#equity').textContent(),'100.000%');
  assert.equal(await page.locator('#callEV').textContent(),'150.0000 BB');
  assert.equal(await page.locator('#breakdown').isVisible(),false);
  await page.locator('#resultDetails summary').tap();
  assert.equal(await page.locator('#breakdown').isVisible(),true);
  await page.locator('#bet').fill('51');
  assert.equal(await page.locator('#result').isVisible(),false);
  for(const i of [6,5]){
   await page.locator('#card'+i).tap();await page.locator('#clearCard').tap();
  }
  await page.locator('#preset').selectOption('all');
  await page.locator('#calculate').tap();await page.locator('#cancel').tap();
  assert.equal(await page.locator('#result').isVisible(),false);
  assert.match(await page.locator('#status').textContent(),/中止/);
  for(const [i,c] of ['As','Kd','Ac','7h','8h','9d','2c'].entries()) await choose(i,c);
  await page.locator('#pot').fill('12');await page.locator('#bet').fill('6');
  await page.locator('#preset').selectOption('custom');
  await page.locator('#clear').tap();await page.locator('#selectionSummary').tap();
  for(const [hand,frequency] of [['AA','9'],['KK','1']]){
   await page.locator('[data-hand='+hand+']').tap();
   const input=page.getByRole('spinbutton',{name:hand+' 頻度',exact:true});
   await input.fill(frequency);await input.press('Tab');
  }
  await page.locator('#calculate').tap();
  await page.waitForFunction(()=>!document.querySelector('#result').hidden);
  assert.equal(await page.locator('#verdict').textContent(),'コールとフォールドは同EV');
  assert.equal(await page.locator('#required').textContent(),'25.000%');
  assert.equal(await page.locator('#callEV').textContent(),'0.0000 BB');
  await page.locator('#pot').fill('11.9');await page.locator('#calculate').tap();
  await page.waitForFunction(()=>!document.querySelector('#result').hidden);
  assert.equal(await page.locator('#verdict').textContent(),'フォールド有利');
  await choose(6,'3c');
  assert.equal(await page.locator('#result').isVisible(),false);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);await page.close();
 }
 console.log(engine+': simple analysis passed at 375/390/430px');
}finally{await browser?.close();server.close();}})().catch(e=>{console.error(e);process.exitCode=1});
