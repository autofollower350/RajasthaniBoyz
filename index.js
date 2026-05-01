const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    Browsers
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const { Boom } = require("@hapi/boom");
const fs = require("fs");
const { exec } = require("child_process");
const qrcode = require("qrcode-terminal");

async function startKnightJnvu() {
    const { state, saveCreds } = await useMultiFileAuthState('./session');

    const sock = makeWASocket({
    const sock = makeWASocket({
    auth: state,
    logger: pino({ level: "silent" }),
    browser: Browsers.macOS('Desktop'), // Browser change karne se 405 fix hota hai
    printQRInTerminal: false,
    connectTimeoutMs: 60000,
    // Add these lines
    syncFullHistory: false,
    markOnlineOnConnect: true,
});


    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            console.log("⬇️ NEW QR CODE - SCAN NOW ⬇️");
            qrcode.generate(qr, { small: true });
        }

        if (connection === "close") {
            let reason = new Boom(lastDisconnect?.error)?.output.statusCode;
            console.log(`Connection closed. Reason: ${reason}`);
            
            if (reason === DisconnectReason.restartRequired || reason === 405) {
                console.log("Restarting connection...");
                startKnightJnvu();
            } else if (reason === DisconnectReason.loggedOut) {
                console.log("Logged out. Please delete session folder and scan again.");
                process.exit();
            } else {
                startKnightJnvu();
            }
        } else if (connection === "open") {
            console.log("✅ Knight JNVU Bot is Online!");
        }
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("messages.upsert", async (chatUpdate) => {
        const m = chatUpdate.messages[0];
        if (!m.message || m.key.fromMe) return;

        const from = m.key.remoteJid;
        const text = m.message.conversation || m.message.extendedTextMessage?.text || "";

        if (text.startsWith(".admit")) {
            const formNo = text.replace(".admit", "").trim();
            if (!formNo) return sock.sendMessage(from, { text: "❌ Form No. likhein!" });

            await sock.sendMessage(from, { text: "⏳ Processing JNVU Admit Card..." });

            exec(`python3 jnvu.py ${formNo}`, async (error) => {
                const pdfPath = `./admit_card_${formNo}.pdf`;
                if (fs.existsSync(pdfPath)) {
                    await sock.sendMessage(from, { 
                        document: { url: pdfPath }, 
                        mimetype: "application/pdf", 
                        fileName: `JNVU_Admit_${formNo}.pdf`,
                        caption: `✅ Admit Card for ${formNo}`
                    }, { quoted: m });
                    setTimeout(() => fs.unlinkSync(pdfPath), 5000);
                } else {
                    await sock.sendMessage(from, { text: "❌ Error: Admit card nahi mila." });
                }
            });
        }
    });
}

startKnightJnvu();
