const { chromium } = require('playwright');
const fs = require('fs');

module.exports = {
    name: 'admit',
    aliases: ['jnvu'],
    category: 'general',
    description: 'Download JNVU Admit Card PDF',
    usage: '.admit [form_number]',

    async execute(sock, msg, args, extra) {
        const formNo = args[0];
        if (!formNo) return await extra.reply("❌ भाई, फॉर्म नंबर तो लिखो!");

        await extra.reply("⏳ एडमिट कार्ड डाउनलोड कर रहा हूँ...");

        const pdfPath = `./admit_card_${formNo}.pdf`;
        let browser;

        try {
            browser = await chromium.launch({ 
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox'] 
            });
            const context = await browser.newContext({ acceptDownloads: true });
            const page = await context.newPage();
            const url = "https://erp.jnvuiums.in/Exam/Pre_Exam/Exam_ForALL_AdmitCard.aspx";

            await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
            await page.fill("#txtchallanNo", formNo);
            
            const submitBtn = page.locator("#btnGetResult");
            const [download] = await Promise.all([
                page.waitForEvent('download', { timeout: 40000 }),
                submitBtn.click().then(() => submitBtn.click())
            ]);

            await download.saveAs(pdfPath);
            await browser.close();

            await sock.sendMessage(extra.from, { 
                document: fs.readFileSync(pdfPath), 
                mimetype: 'application/pdf', 
                fileName: `JNVU_${formNo}.pdf`,
                caption: `✅ *JNVU Admit Card*`
            }, { quoted: msg });

            if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);

        } catch (error) {
            if (browser) await browser.close();
            await extra.reply("❌ एरर: एडमिट कार्ड नहीं मिला।");
        }
    }
};
