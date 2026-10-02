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
      headless: config.headless ? 'new' : false,
      userDataDir: config.sessionDir,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--disable-blink-features=AutomationControlled',
        '--window-size=1280,800',
      ],
      defaultViewport: { width: 1280, height: 800 },
    });

    this.page = await this.browser.newPage();

    // Real Chrome jaisa dikhne ke liye user-agent set kar
    await this.page.setUserAgent(
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36'
    );

    await this.page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    });

    // WebDriver detect na ho
    await this.page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      });
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });
    });

    console.log('✅ Browser ready');
  }

  async login() {
    console.log('🔐 Login page khol rahe hain...');
    await this.page.goto(config.loginUrl, {
      waitUntil: 'networkidle2',
      timeout: 60000,
    });

    console.log('📍 Current URL:', this.page.url());

    if (this.page.url().includes('/servers/')) {
      console.log('✅ Pehle se logged in (session saved)');
      return;
    }

    console.log('✍️  Username field ka wait kar rahe hain...');
    try {
      await this.page.waitForSelector('#user', { timeout: 20000 });
      console.log('✅ Username field mil gaya');
    } catch (err) {
      console.log('❌ #user nahi mila. Page ka HTML:');
      console.log((await this.page.content()).slice(0, 2000));
      throw new Error('Login form nahi mila');
    }

    console.log('✍️  Credentials daal rahe hain...');
    await this.page.type('#user', config.username, { delay: 60 });
    await this.page.type('#password', config.password, { delay: 60 });

    console.log('🔘 Login button click kar rahe hain...');
    await Promise.all([
      this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 45000 }),
      this.page.click('#login-btn'),
    ]);

    console.log('✅ Login ke baad URL:', this.page.url());

    if (this.page.url().includes('/go/') || this.page.url().includes('/login')) {
      throw new Error('Login fail ho gaya (credentials ya 2FA check karo)');
    }
  }

  async openServer() {
    console.log(`🔍 Server dhundh rahe hain: "${config.serverName}"`);
    await this.page.goto(config.serversUrl, {
      waitUntil: 'networkidle2',
      timeout: 60000,
    });

    await this.page.waitForSelector('.server-name, .server-row, .servers .server', {
      timeout: 20000,
    });

    const clicked = await this.page.evaluate((name) => {
      const servers = [...document.querySelectorAll('.server-name, .server-row')];
      const target = servers.find((s) =>
        s.innerText.trim().toLowerCase().includes(name.toLowerCase())
      );
      if (target) {
        target.click();
        return true;
      }
      return false;
    }, config.serverName);

    if (!clicked) {
      const available = await this.page.evaluate(() =>
        [...document.querySelectorAll('.server-name')].map((s) => s.innerText.trim())
      );
      console.log('❌ Ye servers mile:', available);
      throw new Error(`Server "${config.serverName}" nahi mila`);
    }

    await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 45000 });
    console.log('✅ Server page khul gaya:', this.page.url());
  }

  async getStatus() {
    try {
      await this.page.waitForSelector('#status', { timeout: 10000 });
      return await this.page.$eval('#status', (el) => el.innerText.trim());
    } catch {
      return 'unknown';
    }
  }

  async startServer() {
    const status = await this.getStatus();
    console.log(`📊 Current status: "${status}"`);

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

    if (s.includes('queue') || s.includes('preparing') || s.includes('loading')) {
      console.log('⏳ Queue me hai, confirm ka wait...');
    }

    const startTime = Date.now();
    const maxWait = config.maxQueueWait * 60 * 1000;

    while (Date.now() - startTime < maxWait) {
      const confirmBtn = await this.page.$('#confirm, .btn-confirm, button.confirm');
      if (confirmBtn) {
        console.log('🟢 Confirm button mila, click kar rahe hain...');
        await confirmBtn.click().catch(() => {});
        await this.page.waitForTimeout(2000);
      }

      const currentStatus = await this.getStatus();
      const cs = currentStatus.toLowerCase();
      console.log(`   ↳ Status: "${currentStatus}"`);

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