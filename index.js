const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { exec } = require('child_process');
const fs = require('fs');
const pino = require('pino');
const qrcode = require('qrcode-terminal'); // Ise install zaroor karna: !npm install qrcode-terminal

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('./session');
    
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        // printQRInTerminal: true, // Ise hata do, ye purana ho gaya hai
    });

    // --- Connection handling aur QR display ---
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            console.log("⚠️ DEPRECATION BYPASS: SCAN THIS NEW QR:");
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Connection closed due to ', lastDisconnect.error, ', reconnecting ', shouldReconnect);
            if (shouldReconnect) startBot();
        } else if (connection === 'open') {
            console.log('✅ JNVU BOT CONNECTED SUCCESSFULLY!');
        }
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

            await sock.sendMessage(from, { text: "⏳ Processing... JNVU Server se PDF nikal raha hoon." });

            // Python Script Run Karna
            exec(`python3 jnvu.py ${formNo}`, async (error) => {
                const pdfPath = `./admit_card_${formNo}.pdf`;

                if (fs.existsSync(pdfPath)) {
                    await sock.sendMessage(from, { 
                        document: { url: pdfPath }, 
                        mimetype: 'application/pdf', 
                        fileName: `JNVU_Admit_${formNo}.pdf`,
                        caption: `✅ *Success!*\nForm No: ${formNo}\nAapka Admit Card ready hai.`
                    });
                    setTimeout(() => { if(fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath); }, 5000);
                } else {
                    await sock.sendMessage(from, { text: "❌ Admit Card nahi mila. Check karein ki details sahi hain." });
                }
            });
        }
    });
}

startBot();
