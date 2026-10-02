require('dotenv').config();

module.exports = {
  username: process.env.ATERNOS_USERNAME,
  password: process.env.ATERNOS_PASSWORD,
  serverName: process.env.SERVER_NAME,
  headless: process.env.HEADLESS === 'true',
  queueInterval: parseInt(process.env.QUEUE_CHECK_INTERVAL) || 5000,
  maxQueueWait: parseInt(process.env.MAX_QUEUE_WAIT_MINUTES) || 30,
  sessionDir: './aternos-session',
  loginUrl: 'https://aternos.org/go/',
  serversUrl: 'https://aternos.org/servers/',
};