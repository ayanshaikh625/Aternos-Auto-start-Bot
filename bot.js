const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const config = require('./config');

puppeteer.use(StealthPlugin());

class AternosBot {
  constructor() {
    this.browser = null;
    this.page = null;
  }

  async init() {
    console.log('🚀 Browser launch kar rahe hain...');
    this.browser = await puppeteer.launch({
      headless: config.headless,
      userDataDir: config.sessionDir,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
      ],
      defaultViewport: { width: 1280, height: 800 },
    });

    this.page = await this.browser.newPage();
    console.log('✅ Browser ready');
  }

  async login() {
    console.log('🔐 Login page khol rahe hain...');
    await this.page.goto(config.loginUrl, { waitUntil: 'networkidle2' });

    // Check agar already logged in hai
    const currentUrl = this.page.url();
    if (currentUrl.includes('/servers/')) {
      console.log('✅ Pehle se logged in hai (session saved)');
      return;
    }

    console.log('✍️  Credentials daal rahe hain...');
    await this.page.waitForSelector('#user', { timeout: 15000 });
    await this.page.type('#user', config.username, { delay: 50 });
    await this.page.type('#password', config.password, { delay: 50 });

    await Promise.all([
      this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
      this.page.click('#login-btn'),
    ]);

    console.log('✅ Login successful');
  }

  async openServer() {
    console.log(`🔍 Server dhundh rahe hain: ${config.serverName}`);
    await this.page.goto(config.serversUrl, { waitUntil: 'networkidle2' });

    const clicked = await this.page.evaluate((name) => {
      const servers = [...document.querySelectorAll('.server-name, .server-row')];
      const target = servers.find(s =>
        s.innerText.trim().toLowerCase().includes(name.toLowerCase())
      );
      if (target) {
        target.click();
        return true;
      }
      return false;
    }, config.serverName);

    if (!clicked) {
      throw new Error(`❌ Server "${config.serverName}" nahi mila`);
    }

    await this.page.waitForNavigation({ waitUntil: 'networkidle2' });
    console.log('✅ Server page khul gaya');
  }

  async getStatus() {
    try {
      await this.page.waitForSelector('#status', { timeout: 10000 });
      return await this.page.$eval('#status', el => el.innerText.trim());
    } catch {
      return 'unknown';
    }
  }

  async startServer() {
    const status = await this.getStatus();
    console.log(`📊 Current status: ${status}`);

    const s = status.toLowerCase();

    if (s.includes('online') || s.includes('running')) {
      console.log('✅ Server pehle se online hai');
      return true;
    }

    if (s.includes('offline')) {
      console.log('▶️  Start button click kar rahe hain...');
      await this.page.click('#start');
      await this.page.waitForTimeout(3000);
    }

    if (s.includes('queue') || s.includes('preparing')) {
      console.log('⏳ Queue me hai, confirm ka wait...');
    }

    // Queue confirm loop
    const startTime = Date.now();
    const maxWait = config.maxQueueWait * 60 * 1000;

    while (Date.now() - startTime < maxWait) {
      // Confirm button check
      const confirmBtn = await this.page.$('#confirm, .btn-confirm');
      if (confirmBtn) {
        console.log('🟢 Confirm button mila, click kar rahe hain...');
        await confirmBtn.click();
        await this.page.waitForTimeout(2000);
      }

      const currentStatus = await this.getStatus();
      const cs = currentStatus.toLowerCase();
      console.log(`   ↳ Status: ${currentStatus}`);

      if (cs.includes('online') || cs.includes('running')) {
        console.log('🎉 Server ONLINE ho gaya!');
        return true;
      }

      await this.page.waitForTimeout(config.queueInterval);
    }

    console.log('⏰ Timeout: Server start nahi hua');
    return false;
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      console.log('🔒 Browser band kar diya');
    }
  }
}

module.exports = AternosBot;