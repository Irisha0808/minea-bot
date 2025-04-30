const puppeteer = require('puppeteer');
const { Telegraf, Markup } = require('telegraf');

const bot = new Telegraf('8114664828:AAF2rP7DlgsisFptD3TDDB3Ng2E7L8-lGg8');
const MINEA_EMAIL = 'johnfink2012@gmail.com';
const MINEA_PASSWORD = 'Croatia1#Fink';
const LOGIN_URL = 'https://app.minea.com/en/login';
const SHOPIFY_URL = 'https://app.minea.com/en/products/ecom?sort_by=-shopify__published_at';
const TIKTOK_URL = 'https://app.minea.com/en/products/tiktok?sort_by=-inserted_at';

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function acceptCookies(page) {
    console.log('🔵 Жду появления кнопки Accept...');
    try {
        for (let i = 0; i < 10; i++) {
            const accepted = await page.evaluate(() => {
                const buttons = Array.from(document.querySelectorAll('button'));
                const acceptBtn = buttons.find(btn => btn.textContent.includes('Accept'));
                if (acceptBtn) {
                    acceptBtn.click();
                    return true;
                }
                return false;
            });
            if (accepted) {
                console.log('✅ Кнопка Accept нажата!');
                return;
            }
            console.log('⏳ Кнопка Accept ещё не найдена, жду...');
            await wait(2000);
        }
        console.log('⚠️ Кнопка Accept так и не найдена, продолжаем.');
    } catch (e) {
        console.log('⚠️ Ошибка при поиске Accept кнопки:', e.message);
    }
}

bot.start((ctx) => {
    return ctx.reply('Выберите источник:', Markup.inlineKeyboard([
        [Markup.button.callback('Shopify', 'getshopify')],
        [Markup.button.callback('TikTok', 'gettiktok')]
    ]));
});

bot.action('getshopify', async (ctx) => {
    ctx.reply('⏳ Запускаю Shopify обработку...');
    const browser = await puppeteer.launch({
  headless: true,
  executablePath: puppeteer.executablePath(),
  args: ['--no-sandbox', '--disable-setuid-sandbox']
});
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    try {
        await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });
        await wait(2000);
        await acceptCookies(page);

        await page.type('input[type="email"]', MINEA_EMAIL, { delay: 100 });
        await page.type('input[type="password"]', MINEA_PASSWORD, { delay: 100 });
        await page.click('button[type="submit"]');
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });

        await page.goto(SHOPIFY_URL, { waitUntil: 'domcontentloaded' });
        await wait(4000);

        await page.waitForSelector('a[href*="/quickview"]', { timeout: 10000 });
        const productLinks = await page.$$eval('a[href*="/quickview"]', links =>
            links.slice(0, 8).map(link => link.href.replace('/quickview', '/details'))
        );

        for (let i = 0; i < productLinks.length; i++) {
            const productUrl = productLinks[i];
            const productPage = await browser.newPage();
            await productPage.goto(productUrl, { waitUntil: 'domcontentloaded' });
            await productPage.evaluate(() => window.scrollBy(0, 500));
            await wait(4000);

            const productData = await productPage.evaluate(() => {
                const getTextByLabel = (label) => {
                    const allDivs = Array.from(document.querySelectorAll('div.flex.items-center.justify-between'));
                    const div = allDivs.find(d => d.innerText.includes(label));
                    if (div) {
                        const valueDiv = div.querySelector('div.block.truncate') || div.querySelector('div.truncate');
                        return valueDiv ? valueDiv.innerText.trim() : 'Не найдено';
                    }
                    return 'Не найдено';
                };
                const getImage = () => {
                    const img = document.querySelector('img[src*="domainz-media"]');
                    return img ? img.src : null;
                };

                return {
                    price: getTextByLabel('Selling price'),
                    profit: getTextByLabel('Profit'),
                    date: getTextByLabel('Published on'),
                    image: getImage(),
                    link: window.location.href,
                };
            });

            if (productData.image && productData.image.startsWith('http')) {
                await ctx.telegram.sendPhoto(ctx.chat.id, productData.image, {
                    caption: `🛍️ <b>Товар</b>: <a href="${productData.link}">Перейти</a>\n💰 <b>Цена</b>: ${productData.price}\n📈 <b>Прибыль</b>: ${productData.profit}\n🗓️ <b>Дата</b>: ${productData.date}`,
                    parse_mode: 'HTML',
                });
            }

            await productPage.close();
            await wait(2000);
        }

        ctx.reply('✅ Все товары Shopify отправлены!');
    } catch (err) {
        console.error('❌ Ошибка Shopify:', err);
        ctx.reply('❌ Shopify: Произошла ошибка.');
    } finally {
        await browser.close();
    }
});

bot.action('gettiktok', async (ctx) => {
    ctx.reply('⏳ Запускаю TikTok обработку...');
    const browser = await puppeteer.launch({
        executablePath: '/opt/render/.cache/puppeteer/chrome/linux-135.0.7049.114/chrome-linux64/chrome',
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    try {
        await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });
        await wait(2000);
        await acceptCookies(page);

        await page.type('input[type="email"]', MINEA_EMAIL, { delay: 100 });
        await page.type('input[type="password"]', MINEA_PASSWORD, { delay: 100 });
        await page.click('button[type="submit"]');
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });

        await page.goto(TIKTOK_URL, { waitUntil: 'domcontentloaded' });
        await wait(4000);

        await page.waitForSelector('a[href*="/quickview"]', { timeout: 10000 });
        const tiktokLinks = await page.$$eval('a[href*="/quickview"]', links =>
            links.slice(0, 8).map(link => link.href.replace('/quickview', '/details'))
        );

        for (let i = 0; i < tiktokLinks.length; i++) {
            const tiktokUrl = tiktokLinks[i];
            const tiktokPage = await browser.newPage();

            try {
                await tiktokPage.goto(tiktokUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
                await tiktokPage.evaluate(() => window.scrollBy(0, 500));
                await wait(4000);

                const productData = await tiktokPage.evaluate(() => {
                    const getTextByLabel = (label) => {
                        const allDivs = Array.from(document.querySelectorAll('div.flex.items-center.justify-between.gap-3'));
                        const div = allDivs.find(d => d.innerText.toLowerCase().includes(label));
                        if (div) {
                            const valueDiv = div.querySelector('div.block.truncate.text-sm.font-semibold');
                            return valueDiv ? valueDiv.innerText.trim() : 'Не найдено';
                        }
                        return 'Не найдено';
                    };
                    const getImage = () => {
                        const img = document.querySelector('img[src*="domainz-media"], img[src*="tiktokcdn"]');
                        return img ? img.src : null;
                    };

                    return {
                        price: getTextByLabel('product price'),
                        sold: getTextByLabel('items sold'),
                        revenue: getTextByLabel('revenue'),
                        published: getTextByLabel('published on'),
                        image: getImage(),
                        link: window.location.href,
                    };
                });

                if (productData && productData.image) {
                    await ctx.telegram.sendPhoto(ctx.chat.id, productData.image, {
                        caption: `🎵 <b>TikTok Товар</b>: <a href="${productData.link}">Перейти</a>\n💰 <b>Цена</b>: ${productData.price}\n📈 <b>Продано</b>: ${productData.sold}\n💵 <b>Доход</b>: ${productData.revenue}\n📅 <b>Дата публикации</b>: ${productData.published}`,
                        parse_mode: 'HTML',
                    });
                }
            } catch (err) {
                console.error(`⚠️ Ошибка товара TikTok #${i + 1}:`, err.message);
            } finally {
                await tiktokPage.close();
                await wait(2000);
            }
        }

        ctx.reply('✅ Все товары TikTok отправлены!');
    } catch (err) {
        console.error('❌ Ошибка TikTok:', err);
        ctx.reply('❌ TikTok: Произошла ошибка.');
    } finally {
        await browser.close();
    }
});

bot.launch();
console.log('✅ Бот запущен! Жду команду.');
