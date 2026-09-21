// Real browser/service-worker lifecycle on an isolated local HTTP origin.
const http = require('node:http')
const fs = require('node:fs')
const assert = require('node:assert/strict')
const ts = require('typescript')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const compiled = ts.transpileModule(fs.readFileSync('lib/pwa-local.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
let recoverLoads = 0
const server = http.createServer((req, res) => {
  res.setHeader('Cache-Control', 'no-store')
  if (req.url === '/sw.js') {
    res.setHeader('Content-Type', 'application/javascript')
    return res.end("self.addEventListener('install',e=>e.waitUntil(self.skipWaiting())); self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));")
  }
  if (req.url === '/recover') {
    recoverLoads++
    res.setHeader('Content-Type', 'text/html')
    return res.end(`<html><body>Recovery<script>const exports={};${compiled}\nexports.clearLocalPercomWorker().then(()=>{document.body.dataset.cleaned='yes'});</script></body></html>`)
  }
  res.setHeader('Content-Type', 'text/html'); res.end('<html><body>Seed</body></html>')
})
async function main() {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const url = `http://127.0.0.1:${server.address().port}`
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  try {
    const page = await browser.newPage()
    await page.goto(url)
    await page.evaluate(async () => {
      await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready
      await (await caches.open('percom-v1')).put('/old-bundle.js', new Response('old'))
      await (await caches.open('unrelated-cache')).put('/keep', new Response('keep'))
    })
    await page.reload()
    assert.equal(await page.evaluate(() => !!navigator.serviceWorker.controller), true)
    // Demonstrate the missing step in the previous implementation.
    await page.evaluate(async () => { await (await navigator.serviceWorker.getRegistration()).unregister() })
    assert.equal(await page.evaluate(() => !!navigator.serviceWorker.controller), true)
    await page.goto(url + '/recover')
    // Seed again so recovery starts on a document with a controller.
    await page.goto(url)
    await page.evaluate(async () => { await navigator.serviceWorker.register('/sw.js'); await navigator.serviceWorker.ready; await caches.open('percom-v1') })
    await page.reload()
    recoverLoads = 0
    await page.goto(url + '/recover')
    await page.waitForFunction(async () => document.body.dataset.cleaned === 'yes' && !navigator.serviceWorker.controller && (await navigator.serviceWorker.getRegistrations()).length === 0)
    assert.equal(recoverLoads, 2, 'one initial navigation and exactly one recovery reload')
    assert.deepEqual(await page.evaluate(() => caches.keys()), ['unrelated-cache'])
    await page.reload()
    await page.waitForFunction(() => document.body.dataset.cleaned === 'yes')
    assert.equal(recoverLoads, 3, 'no repeated recovery reload')
    const local = new Function('exports', compiled + '; return exports.isLoopbackHost;')({})
    for (const host of ['localhost', 'percom.localhost', '127.0.0.1', '[::1]', '::1']) assert.equal(local(host), true)
    assert.equal(local('percom.example.com'), false)
    console.log('PASS: unregister alone keeps the controller; cleanup reloads once, detaches it, preserves other caches, no reload loop; loopback hosts supported.')
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)) }
}
main().catch(error => { console.error(error); server.close(); process.exitCode = 1 })
