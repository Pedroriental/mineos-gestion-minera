const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  page.on('pageerror', err => {
    console.error('PAGE ERROR:', err.message);
  });
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.error('CONSOLE ERROR:', msg.text());
    }
  });

  try {
    await page.goto('http://localhost:3000/mina/nomina', { waitUntil: 'networkidle0' });
    console.log("Page loaded successfully.");
  } catch (err) {
    console.error('GOTO ERROR:', err.message);
  }

  await browser.close();
})();
