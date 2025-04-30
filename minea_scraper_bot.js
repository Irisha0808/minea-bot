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

async function processMineaSection(ctx, sectionName, url, labels) {
console.log(`🔁 Начинаем обработку раздела: ${sectionName}`);
  ctx.reply(`⏳ Запускаю обработку ${sectionName}...`);
const browser = await puppeteer.launch({
  headless: true,
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
  args: ['--no-sandbox', '--disable-setuid-sandbox']
});


  try {
        const page = await browser.newPage();
        console.log('🌐 Открываю страницу логина Minea...');
        await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });
        await wait(2000);
        await acceptCookies(page);
        console.log('🔐 Ввожу логин и пароль...');
await page.type('input[type="email"]', MINEA_EMAIL, { delay: 100 });
await page.type('input[type="password"]', MINEA_PASSWORD, { delay: 100 });

console.log('👉 Нажимаю кнопку входа...');
await page.click('button[type="submit"]');

console.log('⏳ Жду завершения входа...');
await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 });

console.log('✅ Вход выполнен, продолжаем...');


        await page.goto(url, { waitUntil: 'domcontentloaded' });
        await wait(4000);
        console.log('⏳ Жду карточки товаров на странице...');
await page.waitForSelector('a[href*="/quickview"]', { timeout: 30000 });
console.log('✅ Карточки найдены, продолжаю...');
        const links = await page.$$eval('a[href*="/quickview"]', els =>
            els.slice(0, 8).map(link => link.href.replace('/quickview', '/details'))
        );

        for (let i = 0; i < links.length; i++) {
            const link = links[i];
            const productPage = await browser.newPage();

            try {
                await productPage.goto(link, { waitUntil: 'domcontentloaded', timeout: 20000 });
                await productPage.evaluate(() => window.scrollBy(0, 500));
                await wait(4000);

                const productData = await productPage.evaluate((labels) => {
                    const getTextByLabel = (label) => {
                        const divs = Array.from(document.querySelectorAll('div.flex.items-center.justify-between, div.flex.items-center.justify-between.gap-3'));
                        const div = divs.find(d => d.innerText.toLowerCase().includes(label.toLowerCase()));
                        if (div) {
                            const val = div.querySelector('div.block.truncate, div.truncate, div.block.truncate.text-sm.font-semibold');
                            return val ? val.innerText.trim() : 'Не найдено';
                        }
                        return 'Не найдено';
                    };
                    const getImage = () => {
                        const img = document.querySelector('img[src*="domainz-media"], img[src*="tiktokcdn"]');
                        return img ? img.src : null;
                    };

                    const data = { link: window.location.href, image: getImage() };
                    for (const [key, label] of Object.entries(labels)) {
                        data[key] = getTextByLabel(label);
                    }
                    return data;
                }, labels);

                if (productData && productData.image) {
                    const caption = Object.entries(productData)
                        .filter(([k]) => !['image', 'link'].includes(k))
                        .map(([k, v]) => `🔸 <b>${k[0].toUpperCase() + k.slice(1)}</b>: ${v}`)
                        .join('\n');

                    await ctx.telegram.sendPhoto(ctx.chat.id, productData.image, {
                        caption: `🛒 <b>${sectionName} Товар</b>: <a href="${productData.link}">Перейти</a>\n${caption}`,
                        parse_mode: 'HTML'
                    });
                }
            } catch (e) {
                console.error(`⚠️ Ошибка товара ${sectionName} #${i + 1}:`, e.message);
            } finally {
                await productPage.close();
                await wait(2000);
            }
        }

        ctx.reply(`✅ Все товары ${sectionName} отправлены!`);
    } catch (err) {
        console.error(`❌ Ошибка ${sectionName}:`, err);
        ctx.reply(`❌ ${sectionName}: Произошла ошибка.`);
    } finally {
        await browser.close();
    }
}

bot.start((ctx) => {
  console.log('🧾 chat.id =', ctx.chat.id); // лог chat.id в Render
  return ctx.reply('Бот готов к работе!');
});

bot.command('autorun', async (ctx) => {
    console.log('⏰ Запуск Shopify + TikTok по /autorun');

    await ctx.reply('Запускаю Shopify...');
    await processMineaSection(ctx, 'Shopify', SHOPIFY_URL, {
        price: 'Selling price',
        profit: 'Profit',
        date: 'Published on'
    });

    await ctx.reply('Теперь TikTok...');
    await processMineaSection(ctx, 'TikTok', TIKTOK_URL, {
        price: 'product price',
        profit: 'revenue',
        date: 'published on'
    });
});

    await ctx.reply('Теперь TikTok...');
    await processMineaSection(ctx, 'TikTok', TIKTOK_URL, {
        price: 'product price',
        profit: 'revenue',
        date: 'published on'
    });
});

bot.action('getshopify', (ctx) => {
    console.log('🔵 Кнопка Shopify нажата, запускаем парсинг...');
    processMineaSection(ctx, 'Shopify', SHOPIFY_URL, {
        price: 'Selling price',
        profit: 'Profit',
        date: 'Published on'
    });
});


bot.launch();
console.log('✅ Бот запущен! Жду команду.');
// 👇 Обманка для Render, чтобы сервис не падал
require('http').createServer(() => {}).listen(process.env.PORT || 3000);
