async function processMineaSection(ctx, sectionName, url, labels) {
  console.log(`🟡 Обработка секции: ${sectionName}`);
  await ctx.reply(`⏳ Загружаю ${sectionName}...`);

  let browser;

  try {
    browser = await puppeteer.launch({
      headless: true,
      executablePath: '/usr/bin/google-chrome',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded' });

    const selector = 'a[href*="/quickview"]';
    await page.waitForSelector(selector);

    const links = await page.$$eval(selector, els =>
      els.slice(0, 8).map(link => link.href.replace('/quickview', '/details'))
    );

    for (let i = 0; i < links.length; i++) {
      const link = links[i];
      const productPage = await browser.newPage();

      try {
        await productPage.goto(link, { waitUntil: 'domcontentloaded' });
        await productPage.evaluate(() => window.scrollBy(0, 500));
        await new Promise(res => setTimeout(res, 3000));

        const productData = await productPage.evaluate((labels) => {
          const getTextByLabel = (label) => {
            const divs = Array.from(document.querySelectorAll('div.flex.items-center.justify-between, div.flex.items-center.justify-between.gap-3'));
            const div = divs.find(d => d.innerText.toLowerCase().includes(label.toLowerCase()));
            if (div) {
              const val = div.querySelector('div.block.truncate, div.truncate, div.block.truncate.text-sm.font-semibold');
              return val ? val.innerText.trim() : 'Not found';
            }
            return 'Not found';
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

        if (productData?.image) {
          const caption = Object.entries(productData)
            .filter(([k]) => !['image', 'link'].includes(k))
            .map(([k, v]) => `🔸 <b>${k}</b>: ${v}`)
            .join('\n');

          await ctx.telegram.sendPhoto(ctx.chat.id, productData.image, {
            caption: `🛒 <b>${sectionName} Product</b>: <a href="${productData.link}">View</a>\n${caption}`,
            parse_mode: 'HTML'
          });
        }
      } catch (err) {
        console.error(`⚠️ Ошибка в товаре #${i + 1}:`, err.message);
      } finally {
        await productPage.close();
        await new Promise(res => setTimeout(res, 1500));
      }
    }

    await ctx.reply(`✅ Все товары ${sectionName} обработаны!`);

  } catch (err) {
    console.error(`❌ Ошибка при обработке ${sectionName}:`, err.message);
    await ctx.reply(`❌ Ошибка в ${sectionName}: ${err.message}`);
  } finally {
    if (browser) await browser.close();
  }
}
