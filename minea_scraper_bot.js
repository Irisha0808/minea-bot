// minea_scraper_bot.js
require('dotenv').config();
const puppeteer = require('puppeteer');
const express = require('express');
const { Telegraf } = require('telegraf');

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
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
  args: ['--no-sandbox', '--disable-setuid-sandbox']
});


  const page = await browser.newPage();

  try {
    await page.goto('https://app.minea.com/en/login', { waitUntil: 'networkidle2' });
    console.log('🔵 Жду появления кнопки Accept...');

    for (let i = 0; i < 10; i++) {
      const acceptBtn = await page.$x("//button[contains(., 'Accept')]");
      if (acceptBtn.length > 0) {
        await acceptBtn[0].click();
        console.log('✅ Кнопка Accept нажата!');
        break;
      }
      console.log('⏳ Кнопка Accept ещё не найдена, жду...');
      await page.waitForTimeout(1000);
    }

    console.log('🔐 Авторизация...');
    await page.type('input[name="email"]', process.env.MINEA_EMAIL, { delay: 50 });
    await page.type('input[name="password"]', process.env.MINEA_PASSWORD, { delay: 50 });
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
    await ctx.reply('🔓 Успешный вход в Minea! Продолжаю работу...');

    const sections = [
      { name: 'Shopify', url: 'https://app.minea.com/en/ecom/products/shopify' },
      { name: 'TikTok', url: 'https://app.minea.com/en/ecom/products/tiktok' }
    ];

    for (const section of sections) {
      await ctx.reply(`🟡 Обработка секции: ${section.name}`);
      console.log(`🔵 Переход к секции ${section.name}`);

      try {
        await page.goto(section.url, { waitUntil: 'networkidle2' });
        await page.waitForSelector('a[href*="/quickview"]', { timeout: 30000 });
        const links = await page.$$eval('a[href*="/quickview"]', els => els.map(el => el.href));

        for (let i = 0; i < Math.min(5, links.length); i++) {
          await page.goto(links[i], { waitUntil: 'networkidle2' });
          await page.waitForSelector('img', { timeout: 10000 });
          const imageUrl = await page.$eval('img', el => el.src);
          await ctx.replyWithPhoto(imageUrl, { caption: `🛒 ${section.name} товар ${i + 1}: ${links[i]}` });
        }
      } catch (error) {
        console.error(`❌ Ошибка при обработке ${section.name}:`, error.message);
        await ctx.reply(`❌ Ошибка при обработке секции ${section.name}`);
      }
    }

    await ctx.reply('✅ Все секции обработаны. Работа завершена.');
    console.log('✅ Все секции обработаны');
  } catch (err) {
    console.error('❌ Ошибка при работе бота:', err.message);
    await ctx.reply('❌ Произошла ошибка при запуске. Проверьте лог на Render.');
  } finally {
    await browser.close();
  }
});

bot.launch({ webhook: { domain: process.env.RENDER_EXTERNAL_URL, hookPath: '/bot' } });



