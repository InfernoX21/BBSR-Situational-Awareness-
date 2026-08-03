import fs from 'fs';
import path from 'path';
import { OpenClawOrchestrator } from '../openclaw/OpenClawOrchestrator';

export interface TelegramMessageLog {
  timestamp: string;
  chatId: string;
  username: string;
  direction: 'INCOMING' | 'OUTGOING' | 'SYSTEM' | 'ERROR';
  command?: string;
  content: string;
  executionTimeMs?: number;
}

export class OpenClawTelegramGateway {
  private static instance: OpenClawTelegramGateway;
  private botToken: string;
  private isRunning: boolean = false;
  private heartbeatTimer?: NodeJS.Timeout;
  private lastHeartbeat: string = new Date().toISOString();
  private pollOffset: number = 0;
  private orchestrator = OpenClawOrchestrator.getInstance();
  private logFilePath = path.join(process.cwd(), 'logs', 'openclaw_telegram.log');

  private constructor() {
    this.botToken = process.env.TELEGRAM_BOT_TOKEN || '7891234567:AAxExampleBotTokenForArkaCmd';
    this.ensureLogDirectory();
  }

  public static getInstance(): OpenClawTelegramGateway {
    if (!OpenClawTelegramGateway.instance) {
      OpenClawTelegramGateway.instance = new OpenClawTelegramGateway();
    }
    return OpenClawTelegramGateway.instance;
  }

  private ensureLogDirectory() {
    const dir = path.dirname(this.logFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  public logEvent(
    direction: TelegramMessageLog['direction'],
    chatId: string,
    username: string,
    content: string,
    command?: string,
    executionTimeMs?: number
  ) {
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] [${direction}] Chat:${chatId} (${username}) ${command ? `Cmd:${command}` : ''} Exec:${executionTimeMs || 0}ms - ${content}\n`;

    console.log(logLine.trim());

    try {
      fs.appendFileSync(this.logFilePath, logLine);
    } catch (e) {
      // Ignore write errors if disk unwritable
    }
  }

  public getGatewayHealth() {
    return {
      gatewayStatus: this.isRunning ? 'ACTIVE' : 'STANDBY',
      botName: '@Arkacmd_bot',
      tokenConfigured: !!(this.botToken && !this.botToken.includes('ExampleBotToken')),
      lastHeartbeat: this.lastHeartbeat,
      logFilePath: this.logFilePath,
    };
  }

  // Validate Token with Telegram Servers via getMe
  public async validateBotToken(): Promise<{ valid: boolean; botInfo?: any; error?: string }> {
    if (!this.botToken || this.botToken.includes('ExampleBotToken')) {
      return { valid: false, error: 'TELEGRAM_BOT_TOKEN not configured in .env' };
    }

    try {
      const res = await fetch(`https://api.telegram.org/bot${this.botToken}/getMe`);
      const data = await res.json();
      if (data.ok && data.result) {
        this.logEvent('SYSTEM', 'GATEWAY', 'SERVER', `Validated Telegram Bot Token for @${data.result.username}`);
        return { valid: true, botInfo: data.result };
      }
      return { valid: false, error: data.description || 'Invalid Bot Token' };
    } catch (err: any) {
      return { valid: false, error: err.message || 'Telegram API network unreachable' };
    }
  }

  // Execute Natural Language or Command Query (Internal & External test invocation)
  public async processQuery(
    chatId: string,
    username: string,
    text: string,
    context: any
  ): Promise<{ replyText: string; inlineKeyboard?: any[] }> {
    const startTime = Date.now();
    const promptTrim = text.trim();
    const promptLower = promptTrim.toLowerCase();

    this.logEvent('INCOMING', chatId, username, promptTrim, promptTrim.startsWith('/') ? promptTrim.split(' ')[0] : 'NATURAL_LANGUAGE');

    let replyText = '';
    let inlineKeyboard: any[] | undefined = undefined;

    if (promptLower.startsWith('/start')) {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      replyText = `
🛡 *ARKA Command Center Bot* (@Arkacmd_bot)

Welcome, *${username}*!

To link this Telegram account with your ARKA C2 Dashboard:
1. Copy your 6-digit verification code: \`${code}\`
2. Open ARKA Dashboard -> *Settings* -> *Telegram Integration*
3. Paste code \`${code}\` and click *Link Account*.

Available Commands:
/incidents - Active emergencies
/weather - IMD Doppler radar & flood warnings
/traffic - Live corridor speeds
/report - Executive operational briefing
/help - Command manual

_Or ask any natural language question!_
e.g. *"Show live incidents"*, *"Display nearby hospitals"*
`;
      inlineKeyboard = [
        [{ text: '📊 Open ARKA Dashboard', url: 'https://infernox21.github.io/BBSR-Situational-Awareness-/' }],
      ];
    } else if (promptLower.startsWith('/incidents') || promptLower.includes('live incident') || promptLower.includes('active incident')) {
      const activeList = (context.incidents || []).filter((i: any) => i.status === 'ACTIVE');
      replyText = `
🚨 *ARKA Active Emergencies Report*

Total Active Incidents: *${activeList.length}*

${(context.incidents || [])
  .map(
    (inc: any) => `
• *[${inc.priority}]* ${inc.title}
  📍 _${inc.location.name}_
  🏛 Agency: ${inc.agencyAssigned}
  🤖 Confidence: ${inc.aiConfidence}% | Status: ${inc.status}
`
  )
  .join('')}
`;
      inlineKeyboard = [
        [
          { text: '📍 View Map', url: 'https://infernox21.github.io/BBSR-Situational-Awareness-/' },
          { text: '🚨 Incident Center', url: 'https://infernox21.github.io/BBSR-Situational-Awareness-/' },
        ],
      ];
    } else if (promptLower.startsWith('/weather') || promptLower.includes('weather') || promptLower.includes('disaster report')) {
      const w = context.weather || {};
      replyText = `
🌦 *IMD Doppler Radar & Flood Telemetry*

• Temperature: *${w.tempC || 29}°C*
• Rain Intensity: *${w.rainIntensity || 45} mm/hr*
• Flood Risk Level: *${w.floodRiskLevel || 'SEVERE'}*
• Forecast: _${w.forecast || 'Monsoonal heavy downpour active across Khordha district.'}_

Flood Hotspots:
1. Jayadev Vihar Underpass (2.2 ft water level)
2. Acharya Vihar Flyover Axis (1.5 ft water level)
3. Master Canteen Station Plaza (1.2 ft water level)
`;
      inlineKeyboard = [
        [{ text: '🌊 View Flood Heatmap', url: 'https://infernox21.github.io/BBSR-Situational-Awareness-/' }],
      ];
    } else if (promptLower.includes('hospital') || promptLower.includes('nearby hospital')) {
      const hospitals = (context.landmarks || []).filter((l: any) => l.type === 'HOSPITAL');
      replyText = `
🏥 *Bhubaneswar Emergency Medical Facilities*

${hospitals
  .map(
    (h: any) => `
• *${h.name}*
  📍 ${h.address}
  🚑 Status: OPERATIONAL | ICU Capacity: Available
`
  )
  .join('')}
`;
      inlineKeyboard = [
        [{ text: '🏥 View Hospitals on Map', url: 'https://infernox21.github.io/BBSR-Situational-Awareness-/' }],
      ];
    } else {
      // Forward to OpenClaw Autonomous Multi-Agent Orchestrator
      try {
        const openclawResult = await this.orchestrator.executeCommand(promptTrim, context);
        replyText = `
🤖 *OpenClaw Autonomous Task Execution*

Command: _"${promptTrim}"_

*Execution Summary:*
${openclawResult.finalSummary}

*Action Recommendations:*
${openclawResult.recommendations.map((r) => `• ${r}`).join('\n')}

_Processed via 7 OpenClaw Domain Agents & MCP Tools._
`;
        inlineKeyboard = [
          [
            { text: '📍 View Map Target', url: 'https://infernox21.github.io/BBSR-Situational-Awareness-/' },
            { text: '🤖 Open AI Operations', url: 'https://infernox21.github.io/BBSR-Situational-Awareness-/' },
          ],
        ];
      } catch (err: any) {
        replyText = `⚠️ OpenClaw Execution Warning: Unable to process prompt.`;
      }
    }

    const durationMs = Date.now() - startTime;
    this.logEvent('OUTGOING', chatId, username, replyText.substring(0, 100).replace(/\n/g, ' '), undefined, durationMs);

    return { replyText, inlineKeyboard };
  }

  // Start Gateway Polling Loop with Reconnect & Heartbeat
  public async startGateway(contextGetter: () => any) {
    if (this.isRunning) return;
    this.isRunning = true;

    this.logEvent('SYSTEM', 'GATEWAY', 'SERVER', 'OpenClaw Telegram Gateway initialized.');

    // 15s Heartbeat Loop
    this.heartbeatTimer = setInterval(() => {
      this.lastHeartbeat = new Date().toISOString();
      this.logEvent('SYSTEM', 'HEARTBEAT', 'GATEWAY', 'OpenClaw Telegram Gateway heartbeat OK.');
    }, 15000);

    const botValidation = await this.validateBotToken();
    if (!botValidation.valid) {
      this.logEvent('ERROR', 'GATEWAY', 'SERVER', `Bot Token validation failed: ${botValidation.error}`);
      return;
    }

    this.logEvent('SYSTEM', 'GATEWAY', 'SERVER', `Starting live long-polling for @${botValidation.botInfo.username}...`);

    while (this.isRunning) {
      try {
        const res = await fetch(`https://api.telegram.org/bot${this.botToken}/getUpdates?offset=${this.pollOffset + 1}&timeout=25`);
        const data = await res.json();

        if (data.ok && Array.isArray(data.result)) {
          for (const update of data.result) {
            this.pollOffset = update.update_id;
            if (update.message) {
              const chatId = update.message.chat.id.toString();
              const username = update.message.from?.username || update.message.from?.first_name || 'Operator';
              const text = update.message.text || '';

              const { replyText, inlineKeyboard } = await this.processQuery(chatId, username, text, contextGetter());

              await fetch(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  chat_id: chatId,
                  text: replyText,
                  parse_mode: 'Markdown',
                  reply_markup: inlineKeyboard ? { inline_keyboard: inlineKeyboard } : undefined,
                }),
              });
            }
          }
        }
      } catch (err: any) {
        this.logEvent('ERROR', 'POLLING', 'RECONNECT', `Telegram Polling error: ${err.message}. Retrying in 5s...`);
        await new Promise((r) => setTimeout(r, 5000));
      }
    }
  }

  public stopGateway() {
    this.isRunning = false;
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.logEvent('SYSTEM', 'GATEWAY', 'SERVER', 'OpenClaw Telegram Gateway stopped.');
  }
}
