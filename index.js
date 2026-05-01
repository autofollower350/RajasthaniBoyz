const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const { exec } = require('child_process');
const fs = require('fs');
const pino = require('pino');

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('./session');
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: true
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message || m.key.fromMe) return;

        const from = m.key.remoteJid;
        const text = m.message.conversation || m.message.extendedTextMessage?.text || "";

        if (text.startsWith('.admit')) {
            const formNo = text.replace('.admit', '').trim();
            if (!formNo) return sock.sendMessage(from, { text: "❌ Form No. likhein! (.admit 12345)" });

            await sock.sendMessage(from, { text: "⏳ Processing... Playwright browser start ho raha hai." });

            // Python Script Run Karna
            exec(`python3 jnvu.py ${formNo}`, async (error) => {
                const pdfPath = `./admit_card_${formNo}.pdf`;

                if (fs.existsSync(pdfPath)) {
                    await sock.sendMessage(from, { 
                        document: { url: pdfPath }, 
                        mimetype: 'application/pdf', 
                        fileName: `JNVU_Admit_${formNo}.pdf`,
                        caption: `✅ Admit Card Found for: ${formNo}`
                    });
                    // File delete karein taaki storage na bhare
                    setTimeout(() => fs.unlinkSync(pdfPath), 5000);
                } else {
                    await sock.sendMessage(from, { text: "❌ Admit Card nahi mila. Form No check karein." });
                }
            });
        }
    });
}
startBot();
