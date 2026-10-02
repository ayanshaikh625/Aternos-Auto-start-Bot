const AternosBot = require('./bot');

(async () => {
  const bot = new AternosBot();

  try {
    await bot.init();
    await bot.login();
    await bot.openServer();

    const success = await bot.startServer();

    if (success) {
      console.log('\n✅ Kaam ho gaya bhai! Server chal raha hai.');
    } else {
      console.log('\n❌ Server start nahi ho paya.');
    }

    // Browser khula rakho agar chahte ho
    // await bot.close();
  } catch (err) {
    console.error('💥 Error:', err.message);
    await bot.close();
    process.exit(1);
  }
})();