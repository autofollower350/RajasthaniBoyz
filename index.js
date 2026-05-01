const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    generateForwardMessageContent,
    prepareWAMessageMedia,
    generateWAMessageFromContent,
    generateMessageID,
    downloadContentFromMessage,
    makeInMemoryStore,
    jidDecode,
    proto,
    Browsers
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const { Boom } = require("@hapi/boom");
const fs = require("fs");
const { exec } = require("child_process");
const qrcode = require("qrcode-terminal");

const store = makeInMemoryStore({ logger: pino().child({ level: "silent", stream: "store" }) });

async function startKnightJnvu() {
    const { state, saveCreds } = await useMultiFileAuthState('./session');
    const { version, isLatest } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: pino({ level: "silent" }),
        printQRInTerminal: false, // Hum manually handle karenge bypass ke liye
        browser: Browsers.ubuntu("Chrome"),
        auth: state,
        getMessage: async (key) => {
            if (store) {
                const msg = await store.loadMessage(key.remoteJid, key.id);
                return msg.message || undefined;
            }
            return { conversation: "Knight Bot JNVU" };
        }
    });

    store.bind(sock.ev);

    // --- Connection handling (Knight Style) ---
    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) {
            console.log("⬇️ JNVU BOT QR CODE - SCAN NOW ⬇️");
            qrcode.generate(qr, { small: true });
        }
        if (connection === "close") {
            let reason = new Boom(lastDisconnect?.error)?.output.statusCode;
            if (reason === DisconnectReason.restartRequired) {
                console.log("Restart Required, Restarting...");
                startKnightJnvu();
            } else if (reason === DisconnectReason.loggedOut) {
                console.log("Device Logged Out, Please Scan Again.");
                process.exit();
            } else {
                console.log("Connection Closed, Reconnecting...");
                startKnightJnvu();
            }
        } else if (connection === "open") {
            console.log("✅ Knight JNVU Bot is Online!");
        }
    });

    sock.ev.on("creds.update", saveCreds);

    // --- Message Handler (Sirf JNVU Rakha Hai) ---
    sock.ev.on("messages.upsert", async (chatUpdate) => {
        try {
            const m = chatUpdate.messages[0];
            if (!m.message || m.key.fromMe) return;

            const from = m.key.remoteJid;
            const text = m.message.conversation || m.message.extendedTextMessage?.text || "";

            // .admit command logic
            if (text.startsWith(".admit")) {
                const formNo = text.replace(".admit", "").trim();
                if (!formNo) return sock.sendMessage(from, { text: "❌ *Error:* Form No. likhein!\nExample: `.admit 12345`" });

                await sock.sendMessage(from, { text: "⏳ *JNVU Server se link connect ho raha hai...*" });

                // Python script call
                exec(`python3 jnvu.py ${formNo}`, async (error, stdout, stderr) => {
                    const pdfPath = `./admit_card_${formNo}.pdf`;

                    if (fs.existsSync(pdfPath)) {
                        await sock.sendMessage(from, { 
                            document: { url: pdfPath }, 
                            mimetype: "application/pdf", 
                            fileName: `JNVU_Admit_${formNo}.pdf`,
                            caption: `✅ *JNVU Admit Card Downloaded*\n\n*Form No:* ${formNo}\n*Status:* Success`
                        }, { quoted: m });

                        // Clean up
                        setTimeout(() => { if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath); }, 5000);
                    } else {
                        await sock.sendMessage(from, { text: "❌ *Failed:* Admit card nahi mila. Website check karein ya Form No. re-verify karein." });
                    }
                });
            }
        } catch (err) {
            console.log("Error in message handler: ", err);
        }
    });
}

startKnightJnvu();
