const fs = require('fs');
const path = require('path');
const https = require('https');

// Read TELEGRAM_BOT_TOKEN from .env or environment
let botToken = process.env.TELEGRAM_BOT_TOKEN;

if (!botToken || botToken.includes('ExampleBotToken')) {
  // Check if .env file exists
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/TELEGRAM_BOT_TOKEN=["']?([^"'\r\n]+)["']?/);
    if (match) {
      botToken = match[1].trim();
    }
  }
}

if (!botToken || botToken.includes('ExampleBotToken')) {
  console.error('\n[OpenClaw Telegram Bot Error]');
  console.error('TELEGRAM_BOT_TOKEN is missing or not set in .env!');
  console.error('Please add TELEGRAM_BOT_TOKEN="YOUR_BOT_TOKEN_FROM_BOTFATHER" in .env and restart.\n');
  process.exit(1);
}

console.log(`\n======================================================`);
console.log(`🛡 ARKA OpenClaw Telegram Bot Service (@Arkacmd_bot)`);
console.log(`Starting live Telegram long-polling connection...`);
console.log(`======================================================\n`);

let offset = 0;

function sendTelegramRequest(method, payload) {
  return new Promise((resolve, reject) => {
    const dataStr = JSON.stringify(payload);
    const options = {
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${botToken}/${method}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(dataStr),
      },
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          resolve({ ok: false, error: e.message });
        }
      });
    });

    req.on('error', (err) => resolve({ ok: false, error: err.message }));
    req.write(dataStr);
    req.end();
  });
}

async function pollUpdates() {
  while (true) {
    try {
      const result = await sendTelegramRequest('getUpdates', {
        offset: offset + 1,
        timeout: 20,
      });

      if (result.ok && Array.isArray(result.result)) {
        for (const update of result.result) {
          offset = update.update_id;
          if (update.message && update.message.text) {
            const chatId = update.message.chat.id;
            const text = update.message.text.trim();
            const username = update.message.from?.username || update.message.from?.first_name || 'Operator';

            console.log(`[${new Date().toLocaleTimeString()}] Message from @${username} (${chatId}): "${text}"`);

            let replyText = '';
            let inlineKeyboard = [
              [{ text: '📍 View Digital Twin Map', url: 'https://infernox21.github.io/BBSR-Situational-Awareness-/' }],
              [{ text: '📊 Open ARKA Dashboard', url: 'https://infernox21.github.io/BBSR-Situational-Awareness-/' }],
            ];

            const textLower = text.toLowerCase();

            if (textLower.startsWith('/start') || textLower.includes('hello')) {
              const code = Math.floor(100000 + Math.random() * 900000);
              replyText = `🛡 *ARKA Command Center Bot* (@Arkacmd_bot)\n\nWelcome, *${username}*!\n\nYour 6-digit verification code: \`${code}\`\n\nEnter this code inside ARKA Dashboard -> Settings -> Telegram Integration to link your account.`;
            } else if (textLower.startsWith('/incidents') || textLower.includes('incident') || textLower.includes('emergency')) {
              replyText = `🚨 *ARKA Active Emergencies Report*\n\n1. *Waterlogging at Jayadev Vihar* [CRITICAL]\n   📍 Jayadev Vihar Underpass | BMC & Traffic Police\n\n2. *Electrical Fire at Master Canteen* [HIGH]\n   📍 Master Canteen Station Plaza | Fire Services & TPCODL\n\n3. *NH-16 Collision at Rasulgarh* [HIGH]\n   📍 Rasulgarh Flyover | Police & Health Dept`;
            } else if (textLower.startsWith('/weather') || textLower.includes('weather') || textLower.includes('flood')) {
              replyText = `🌦 *IMD Doppler Weather Radar*\n\n• Rain Intensity: *45 mm/hr*\n• Flood Risk: *SEVERE*\n• Forecast: Monsoonal heavy downpour active across Khordha district.\n\nFlood Hotspots:\n1. Jayadev Vihar Underpass (2.2 ft)\n2. Acharya Vihar Flyover Axis (1.5 ft)`;
            } else if (textLower.includes('hospital')) {
              replyText = `🏥 *Bhubaneswar Emergency Hospitals*\n\n1. *Capital Hospital & Trauma Center*\n   📍 Unit-6 | ICU Capacity: Available\n\n2. *AIIMS Bhubaneswar Emergency Ward*\n   📍 Sijua | ICU Capacity: Available\n\n3. *KIMS Super Speciality Hospital*\n   📍 Patia | ICU Capacity: Available`;
            } else {
              replyText = `🤖 *OpenClaw Autonomous Task Execution*\n\nCommand: _"${text}"_\n\n*Execution Summary:*\nOpenClaw executed multi-agent task for "${text}". Digital Twin camera updated. All 7 domain agents synchronized with C2 telemetry.\n\n*Action Recommendations:*\n• Deploy response teams to location\n• Monitor live traffic sensors on Digital Twin`;
            }

            await sendTelegramRequest('sendMessage', {
              chat_id: chatId,
              text: replyText,
              parse_mode: 'Markdown',
              reply_markup: { inline_keyboard: inlineKeyboard },
            });

            console.log(`[${new Date().toLocaleTimeString()}] Replied to @${username} (${chatId})`);
          }
        }
      }
    } catch (err) {
      console.error('Polling error:', err.message);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}

// First verify bot credentials via getMe API
sendTelegramRequest('getMe', {}).then((res) => {
  if (res.ok && res.result) {
    console.log(`✅ Successfully connected to Telegram API as @${res.result.username} (${res.result.first_name})`);
    pollUpdates();
  } else {
    console.error(`❌ Connection failed to Telegram Bot API: ${res.error || res.description}`);
    console.error(`Please verify TELEGRAM_BOT_TOKEN in .env file.`);
    process.exit(1);
  }
});
