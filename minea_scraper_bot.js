const puppeteer = require('puppeteer');
const { Telegraf } = require('telegraf');
const express = require('express');

const bot = new Telegraf('8114664828:AAF2rP7DlgsisFptD3TDDB3Ng2E7L8-lGg8');

const MINEA_EMAIL = 'johnfink2012@gmail.com';
const MINEA_PASSWORD = 'Croatia1#Fink';
const LOGIN_URL = 'https://app.minea.com/en/login';
const SHOPIFY_URL = 'https://app.minea.com/en/products/ecom?sort_by=-shopify__published_at';
const TIKTOK_URL = 'https://app.minea.com/en/products/tiktok?sort_by=-inserted_at';

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function acceptCookies(page) {
    try {
        for (let i = 0; i < 10; i++) {
            const accepted = await page.evaluate(() => {
                const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Accept'));
                if (btn) {
                    btn.click();
                    return true;
                }
                return false;
            });
            if (accepted) break;
            await wait(2000);
        }
    } catch (e) {
        console.log('Ошибка при нажатии на Accept:', e.message);
    }
}

async function processMineaSection(ctx, sectionName, url, labels) {
    console.log(`🟡 Обработка секции: ${sectionName}`);
    ctx.reply(`⏳ Загружаю ${sectionName}...`);
    const browser = await puppeteer.launch({
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();
        await page.goto(LOGIN_URL, { waitUntil: 'networkidle2' });
        await acceptCookies(page);
        await page.type('input[name="email"]', MINEA_EMAIL);
        await page.type('input[name="password"]', MINEA_PASSWORD);
        await page.click('button[type="submit"]');
        await page.waitForNavigation({ waitUntil: 'networkidle2' });

        await page.goto(url, { waitUntil: 'networkidle2' });

        const selector = 'a[href*="/quickview"]';
        let found = false;

        try {
            found = await page.waitForSelector(selector, { timeout: 90000 }).then(() => true);
        } catch (e) {
            console.warn(`⏳ Таймаут при ожидании карточек: ${e.message}`);
        }

        if (!found) {
            ctx.reply(`⚠️ ${sectionName}: карточки не найдены`);
            await browser.close();
            return;
        }

        const links = await page.$$eval(selector, els =>
            els.slice(0, 8).map(link => link.href.replace('/quickview', '/details'))
        );

        for (let link of links) {
            const productPage = await browser.newPage();
            try {
                await productPage.goto(link, { waitUntil: 'domcontentloaded', timeout: 20000 });
                await wait(3000);

                const productData = await productPage.evaluate((labels) => {
                    const getText = (label) => {
                        const divs = Array.from(document.querySelectorAll('div.flex.items-center.justify-between, div.gap-3'));
                        const found = divs.find(d => d.innerText.toLowerCase().includes(label.toLowerCase()));
                        const val = found?.querySelector('div.truncate');
                        return val?.innerText.trim() || 'не найдено';
                    };
                    const img = document.querySelector('img[src*="tiktokcdn"], img[src*="domainz"]');
                    const image = img?.src || null;

                    const data = { link: window.location.href, image };
                    for (const [key, label] of Object.entries(labels)) {
                        data[key] = getText(label);
                    }
                    return data;
                }, labels);

                if (productData?.image) {
                    const caption = Object.entries(productData)
                        .filter(([k]) => !['image', 'link'].includes(k))
                        .map(([k, v]) => `🔸 <b>${k}:</b> ${v}`)
                        .join('\n');

                    await ctx.telegram.sendPhoto(ctx.chat.id, productData.image, {
                        caption: `🛍️ <b>${sectionName} товар</b>\n<a href="${productData.link}">Открыть</a>\n${caption}`,
                        parse_mode: 'HTML'
                    });
                }

            } catch (e) {
                console.log(`Ошибка при обработке товара: ${e.message}`);
            } finally {
                await productPage.close();
                await wait(2000);
            }
        }

        ctx.reply(`✅ ${sectionName} завершено`);

    } catch (e) {
        ctx.reply(`❌ Ошибка в ${sectionName}: ${e.message}`);
    } finally {
        await browser.close();
    }
}

bot.start((ctx) => ctx.reply('Бот готов к работе!'));

bot.command('autorun', async (ctx) => {
    console.log('▶️ Запуск по /autorun');
    await processMineaSection(ctx, 'Shopify', SHOPIFY_URL, {
        price: 'Selling price',
        profit: 'Profit',
        date: 'Published on'
    });
    await processMineaSection(ctx, 'TikTok', TIKTOK_URL, {
        price: 'product price',
        profit: 'revenue',
        date: 'published on'
    });
});

// === Webhook через Express для Render ===
const app = express();
app.use(bot.webhookCallback('/bot'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log('✅ Бот запущен! Жду команду.');
    console.log(`🚀 Webhook server listening on port ${PORT}`);
});

bot.telegram.setWebhook('https://minea-bot-docker.onrender.com/bot');
