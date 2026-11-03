// Run with Playwright installed. Starts its own static server; no deployment needed.
const {chromium}=require('playwright');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..');
const server=http.createServer((req,res)=>{const target=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!target.startsWith(root+path.sep)&&target!==root){res.writeHead(403);return res.end();}try{const file=target===root?path.join(root,'index.html'):target;res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.html')?'text/html':'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404);res.end();}});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${server.address().port}/index.html`,browser=await chromium.launch({headless:true});
 let checks=0;try{
 for(const width of [375,390,430]){
  const page=await browser.newPage({viewport:{width,height:844},isMobile:true,hasTouch:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url);assert.equal(await page.locator('.cell').count(),169);assert.equal(await page.locator('#dataFlag').textContent(),'GTOデータ未接続');
  await page.locator('#hu10').click();assert.match(await page.locator('#dataFlag').textContent(),/検証済み/);
  await page.getByRole('button',{name:'43s',exact:true}).click();assert.equal(await page.locator('.actionPercent').first().textContent(),'71.1 %');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.getByRole('button',{name:'BB',exact:true}).click();assert.equal(await page.locator('#scenario').inputValue(),'vsshove');
  await page.getByRole('button',{name:'AA',exact:true}).click();assert.equal(await page.locator('.actionPercent').nth(2).textContent(),'100.0 %');
  await page.locator('#scenario').selectOption('vsopen');assert.equal(await page.locator('#dataFlag').textContent(),'GTOデータ未接続');assert.equal(await page.locator('.actionPercent').nth(2).textContent(),'— %');
  await page.locator('#hu10').click();await page.locator('#toggle').click();await page.locator('#ante').selectOption({label:'BBアンティ'});assert.equal(await page.locator('#dataFlag').textContent(),'GTOデータ未接続');
  await page.locator('#ante').selectOption({label:'なし'});await page.locator('#heroStack').fill('9.5');assert.equal(await page.locator('#dataFlag').textContent(),'GTOデータ未接続');
  await page.locator('#hu10').click();await page.locator('#players').selectOption('9');assert.equal(await page.locator('#dataFlag').textContent(),'GTOデータ未接続');
  await page.locator('#close').click();await page.locator('#hu10').click();await page.locator('#tableToggle').click();assert.equal(await page.locator('.seat').count(),2);
  await page.locator('#tableToggle').click();
  assert.equal(await page.locator('#huStack option').count(),16);
  for(const S of ['5','8','12','15','20']){await page.locator('#huStack').selectOption(S);assert.equal(await page.locator('#dataFlag').textContent(),'検証済み · HU '+S+'BB');}
  await page.locator('#huStack').selectOption('8');await page.locator('#toggle').click();await page.locator('#villainStack').fill('20');assert.equal(await page.locator('#stackLabel').textContent(),'8 BB');assert.match(await page.locator('#dataFlag').textContent(),/8BB/);
  await page.getByRole('button',{name:'BB',exact:true}).click();await page.locator('#villainStack').fill('20');assert.match(await page.locator('#dataFlag').textContent(),/8BB/);
  await page.locator('#heroStack').fill('8.5');assert.equal(await page.locator('#dataFlag').textContent(),'GTOデータ未接続');
  await page.locator('#close').click();await page.locator('#huStack').selectOption('10');
  await page.locator('#refreshApp').click();await page.waitForURL(/refresh=/);assert.equal(await page.locator('.cell').count(),169);assert.equal(await page.locator('#dataFlag').textContent(),'GTOデータ未接続');
  await page.locator('#hu10').click();assert.match(await page.locator('#dataFlag').textContent(),/10BB/);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.deepEqual(errors,[]);
  if(process.env.POKER_SCREENSHOT&&width===390)await page.screenshot({path:process.env.POKER_SCREENSHOT,fullPage:true});
  await page.close();checks++;
 }
 const page=await browser.newPage();await page.route('**/hu-strategies.js*',r=>r.abort());await page.goto(url);assert.ok(await page.locator('#hu10').isDisabled());assert.equal(await page.locator('#dataFlag').textContent(),'GTOデータ未接続');await page.close();checks++;
 const noView=await browser.newPage();await noView.route('**/hu10-view.js*',r=>r.abort());await noView.goto(url);await noView.locator('#hu10').click();assert.equal(await noView.locator('#dataFlag').textContent(),'GTOデータ未接続');await noView.close();checks++;
 console.log(JSON.stringify({passed:true,scenarios:checks,widths:[375,390,430],checks:'SB/BB roles, 16-stack selector, unequal stacks, exact mixed frequencies, unsupported fractional stacks/ante/9max/actions, missing dataset/view, refresh button, no horizontal overflow, table toggle'}));
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
