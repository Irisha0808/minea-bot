// minea_scraper_bot.js
require('dotenv').config();
const puppeteer = require('puppeteer-core');
const express = require('express');
const { Telegraf } = require('telegraf');

const bot = new Telegraf(process.env.BOT_TOKEN);
const app = express();

app.use(express.json());
app.use(bot.webhookCallback('/bot'));

bot.telegram.setWebhook(`${process.env.RENDER_EXTERNAL_URL}/bot`).then(() => {
  console.log('✅ Webhook установлен');
});

app.get('/', (_, res) => {
  res.send('🤖 Бот работает');
});

app.listen(10000, () => {
  console.log('🚀 Webhook server listening on port 10000');
});

bot.start((ctx) => ctx.reply('✅ Бот готов к работе. Введите /autorun'));

bot.command('autorun', async (ctx) => {
  console.log('▶️ Запуск по /autorun');
  await ctx.reply('⏳ Запускаю бота... Ожидайте, идёт вход в Minea');

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  try {
    console.log('🔵 Жду появления кнопки Accept...');
    await page.goto('https://app.minea.com/en/login', { waitUntil: 'networkidle2' });
    await page.waitForSelector('button:has-text("Accept")', { timeout: 10000 });
    await page.click('button:has-text("Accept")');
    console.log('✅ Кнопка Accept нажата!');

    console.log('🔐 Авторизация...');
    await page.type('input[name="email"]', process.env.MINEA_EMAIL, { delay: 50 });
    await page.type('input[name="password"]', process.env.MINEA_PASSWORD, { delay: 50 });
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });

    console.log('✅ Успешный вход в Minea!');
    await ctx.reply('🔓 Успешный вход в Minea! Продолжаю работу...');

    // Пример обработки Shopify карточек (можно расширить)
    await page.goto('https://app.minea.com/en/ecom/products/shopify', { waitUntil: 'networkidle2' });
    console.log('🔵 Открыта страница Shopify');

    await page.waitForSelector('a[href*="/quickview"]', { timeout: 30000 });
    const links = await page.$$eval('a[href*="/quickview"]', els => els.map(el => el.href));

    for (let i = 0; i < Math.min(5, links.length); i++) {
      await page.goto(links[i], { waitUntil: 'networkidle2' });
      await page.waitForSelector('img', { timeout: 10000 });

      const imageUrl = await page.$eval('img', el => el.src);
      await ctx.replyWithPhoto(imageUrl, { caption: `🛒 Товар ${i + 1}: ${links[i]}` });
    }

    console.log('✅ Работа завершена');
    await ctx.reply('✅ Работа завершена');
  } catch (err) {
    console.error('❌ Ошибка при работе бота:', err.message);
    await ctx.reply('❌ Произошла ошибка при запуске. Проверьте лог на Render.');
  } finally {
    await browser.close();
  }
});

bot.launch();
