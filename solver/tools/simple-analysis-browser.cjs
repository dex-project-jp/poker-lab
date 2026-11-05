const {chromium,webkit}=require('playwright');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),engine=process.env.POKER_BROWSER||'chromium';
const server=http.createServer((req,res)=>{let p=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!p.startsWith(root+path.sep)){res.writeHead(403).end();return;}try{res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':p.endsWith('.html')?'text/html':'text/plain');res.end(fs.readFileSync(p));}catch{res.writeHead(404).end();}});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;try{
 browser=await ({chromium,webkit}[engine]).launch();
 for(const width of [375,390,430]){
  const page=await browser.newPage({viewport:{width,height:844},isMobile:true,hasTouch:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/simple-analysis.html`);
  await page.waitForFunction(()=>document.querySelectorAll('#range button').length===169);
  assert.equal(await page.locator('#result').isVisible(),false);
  await page.locator('#calculate').click();assert.equal(await page.locator('#result').isVisible(),false);
  for(const [i,c] of ['As','Ah','Ac','Ad','2c','3d','4h'].entries())await page.locator('#card'+i).selectOption(c);
  assert.equal(await page.locator('#card1 option[value=As]').isDisabled(),true);
  await page.locator('#pot').fill('100');await page.locator('#bet').fill('50');
  await page.locator('#calculate').click();assert.match(await page.locator('#status').textContent(),/空/);
  await page.locator('[data-hand=KK]').click();await page.locator('#calculate').click();
  await page.waitForFunction(()=>!document.querySelector('#result').hidden);
  assert.match(await page.locator('#output').textContent(),/100.000%/);assert.match(await page.locator('#output').textContent(),/コール有利/);
  await page.locator('#bet').fill('51');assert.equal(await page.locator('#result').isVisible(),false);
  await page.locator('#selectionSummary').click();await page.getByRole('spinbutton',{name:'KK 頻度',exact:true}).fill('25');await page.locator('#calculate').click();
  await page.waitForFunction(()=>!document.querySelector('#result').hidden);
  await page.locator('#card6').selectOption('');await page.locator('#card5').selectOption('');await page.locator('#all').click();await page.locator('#calculate').click();await page.locator('#cancel').click();
  assert.equal(await page.locator('#result').isVisible(),false);assert.match(await page.locator('#status').textContent(),/中止/);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);await page.close();
 }
 console.log(engine+': simple analysis passed at 375/390/430px');
}finally{await browser?.close();server.close();}})().catch(e=>{console.error(e);process.exitCode=1});
