const { exec } = require('child_process');
const fs = require('fs');

module.exports = {
    name: 'admit',
    alias: ['jnvu', 'card'],
    category: 'downloader',
    desc: 'Download JNVU Admit Card',
    async execute(m, { sock, args }) {
        const formNo = args[0];
        const from = m.key.remoteJid;

        if (!formNo) return sock.sendMessage(from, { text: "❌ Please enter Form Number!\nExample: *.admit 12345*" });

        await sock.sendMessage(from, { text: "⏳ Admit Card fetch ho raha hai... Playwright start ho gaya hai." });

        // Python file ko call karna
        exec(`python3 jnvu.py ${formNo}`, async (error, stdout, stderr) => {
            const pdfPath = `./admit_card_${formNo}.pdf`;

            if (fs.existsSync(pdfPath)) {
                await sock.sendMessage(from, { 
                    document: { url: pdfPath }, 
                    mimetype: 'application/pdf', 
                    fileName: `JNVU_Admit_${formNo}.pdf`,
                    caption: `✅ *Success!*\nAapka Admit Card ready hai.`
                }, { quoted: m });

                // File clean-up
                setTimeout(() => { if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath); }, 5000);
            } else {
                await sock.sendMessage(from, { text: "❌ Admit Card nahi mila. Form No. check karein ya site down ho sakti hai." });
            }
        });
    }
};

