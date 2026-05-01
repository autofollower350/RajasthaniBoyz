/**
 * Message Handler - Clean Version (Admit Card Focused)
 */

const config = require('./config');
const database = require('./database');
const { loadCommands } = require('./utils/commandLoader');
const { jidDecode, jidEncode } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');

// Group metadata cache
const groupMetadataCache = new Map();
const CACHE_TTL = 60000; 

const commands = loadCommands();

// Message content unwrapper
const getMessageContent = (msg) => {
  if (!msg || !msg.message) return null;
  let m = msg.message;
  if (m.ephemeralMessage) m = m.ephemeralMessage.message;
  if (m.viewOnceMessageV2) m = m.viewOnceMessageV2.message;
  if (m.viewOnceMessage) m = m.viewOnceMessage.message;
  if (m.documentWithCaptionMessage) m = m.documentWithCaptionMessage.message;
  return m;
};

// Metadata helpers
const getGroupMetadata = async (sock, groupId) => {
  try {
    if (!groupId || !groupId.endsWith('@g.us')) return null;
    const cached = groupMetadataCache.get(groupId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) return cached.data;
    const metadata = await sock.groupMetadata(groupId);
    groupMetadataCache.set(groupId, { data: metadata, timestamp: Date.now() });
    return metadata;
  } catch { return null; }
};

const isOwner = (sender) => {
  if (!sender) return false;
  const num = sender.split('@')[0].split(':')[0];
  return config.ownerNumber.some(owner => owner.replace(/[^0-9]/g, '') === num);
};

const isAdmin = async (sock, participant, groupId, groupMetadata = null) => {
  if (!groupId?.endsWith('@g.us')) return false;
  const metadata = groupMetadata || await getGroupMetadata(sock, groupId);
  if (!metadata) return false;
  const p = metadata.participants.find(p => p.id.split('@')[0] === participant.split('@')[0]);
  return p?.admin === 'admin' || p?.admin === 'superadmin';
};

const isBotAdmin = async (sock, groupId) => {
  if (!groupId?.endsWith('@g.us')) return false;
  return await isAdmin(sock, sock.user.id, groupId);
};

// Main Handler
const handleMessage = async (sock, msg) => {
  try {
    if (!msg.message || msg.key.remoteJid === 'status@broadcast') return;

    const from = msg.key.remoteJid;
    const content = getMessageContent(msg);
    if (!content) return;

    const sender = msg.key.fromMe ? sock.user.id : (msg.key.participant || from);
    const isGroup = from.endsWith('@g.us');
    const groupMetadata = isGroup ? await getGroupMetadata(sock, from) : null;

    // Get body text
    let body = content.conversation || content.extendedTextMessage?.text || content.imageMessage?.caption || '';
    body = body.trim();

    // --- DIRECT JNVU NUMBER SEARCH (8 Digits) ---
    if (/^\d{8}$/.test(body)) {
      const admitCmd = commands.get('admit');
      if (admitCmd) {
        return await admitCmd.execute(sock, msg, [body], {
          from, sender, isGroup, groupMetadata,
          isOwner: isOwner(sender),
          reply: (text) => sock.sendMessage(from, { text }, { quoted: msg }),
          react: (emoji) => sock.sendMessage(from, { react: { text: emoji, key: msg.key } })
        });
      }
    }

    // Command Check
    if (!body.startsWith(config.prefix)) return;

    const args = body.slice(config.prefix.length).trim().split(/\s+/);
    const commandName = args.shift().toLowerCase();
    const command = commands.get(commandName);
    if (!command) return;

    // Permissions
    if (config.selfMode && !isOwner(sender)) return;
    if (command.ownerOnly && !isOwner(sender)) return;
    if (command.groupOnly && !isGroup) return;
    if (command.adminOnly && !(await isAdmin(sock, sender, from, groupMetadata)) && !isOwner(sender)) return;

    // Execute
    await command.execute(sock, msg, args, {
      from, sender, isGroup, groupMetadata,
      isOwner: isOwner(sender),
      isAdmin: await isAdmin(sock, sender, from, groupMetadata),
      isBotAdmin: await isBotAdmin(sock, from),
      reply: (text) => sock.sendMessage(from, { text }, { quoted: msg }),
      react: (emoji) => sock.sendMessage(from, { react: { text: emoji, key: msg.key } })
    });

  } catch (error) {
    console.error('Handler Error:', error);
  }
};

// Empty handlers to prevent crashes if other files call them
const handleGroupUpdate = async () => {};
const handleAntilink = async () => {};
const handleAntigroupmention = async () => {};
const initializeAntiCall = () => {};

module.exports = {
  handleMessage, handleGroupUpdate, handleAntilink,
  handleAntigroupmention, initializeAntiCall,
  isOwner, isAdmin, isBotAdmin, getGroupMetadata
};
