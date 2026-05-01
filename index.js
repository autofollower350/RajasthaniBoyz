const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers } = require('@whiskeysockets/baileys');
const pino = require('pino');
const { exec } = require('child_process');
const fs = require('fs');
const qrcode = require('qrcode-terminal');

async function startBot() {
    // 1. Session Setup
    const { state, saveCreds } = await useMultiFileAuthState('./session');

    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: Browsers.ubuntu('Chrome'), 
        printQRInTerminal: false
    });

    // 2. QR & Connection Logic
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) {
            console.log("⬇️ SCAN THIS QR CODE WITH WHATSAPP ⬇️");
            qrcode.generate(qr, { small: true });
        }
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startBot();
        } else if (connection === 'open') {
            console.log('✅ JNVU BOT ONLINE - Ab .admit command bhejo!');
        }
    });

    sock.ev.on('creds.update', saveCreds);

    // 3. JNVU Command Handler
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message || m.key.fromMe) return;

        const from = m.key.remoteJid;
        const text = (m.message.conversation || m.message.extendedTextMessage?.text || "").trim();

        if (text.startsWith('.admit')) {
            const formNo = text.replace('.admit', '').trim();
            if (!formNo) return sock.sendMessage(from, { text: "❌ Form Number likho bhai!\nExample: `.admit 12345`" });

            await sock.sendMessage(from, { text: "⏳ Admit card nikal raha hoon, thoda wait karo..." });

            // Python Script ko run karna
            exec(`python3 jnvu.py ${formNo}`, async (err) => {
                const pdfPath = `./admit_card_${formNo}.pdf`;
                if (fs.existsSync(pdfPath)) {
                    await sock.sendMessage(from, { 
                        document: { url: pdfPath }, 
                        mimetype: 'application/pdf', 
                        fileName: `JNVU_${formNo}.pdf`,
                        caption: `✅ Aapka Admit Card (Form: ${formNo})`
                    }, { quoted: m });
                    
                    // File delete karein taaki memory clean rahe
                    setTimeout(() => { if(fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath); }, 5000);
                } else {
                    await sock.sendMessage(from, { text: "❌ Admit card nahi mila. Website check karein ya Form No." });
                }
            });
        }
    });
}

startBot();
