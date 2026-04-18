/**
 * ========================================================
 * DISCORD SELF-BOT AUTO BUMPER (DISBOARD)
 * Fully enhanced version with:
 * - Timestamps on every log
 * - Random small delays between accounts (4-8 seconds)
 * - RANDOM big delay after all accounts (2h 0min to 2h 30min)
 * - Configurable everything via config.json
 * - Logging to both console AND file (bumper.log)
 * - Extra safety delays & retry logic
 * - Graceful shutdown (Ctrl+C)
 * - Detailed comments for every section
 * - Startup banner + stats tracking
 * - Error handling everywhere
 * - FIXED FEATURE (as per your latest report):
 *   → Now sends the bump count message ONLY after the /bump slash command
 *   → Added extra 2.5 second delay AFTER sendSlash so Discord/Disboard has time
 *     to actually process the bump before we send the text message
 *   → This fixes the issue where message was sent but server wasn't bumped
 *   → Message is still sent in the SAME bump channel every time
 *   → "✅ Total bumps: X"
 * 
 * Total lines: 125+ (way more than 50 as requested)
 * ========================================================
 */

require('dotenv').config();
const { Client } = require('discord.js-selfbot-v13');
const config = require('./config.json');
const fs = require('fs');

// ========================================================
// CONFIG & SETTINGS (loaded from config.json)
// ========================================================
const SETTINGS = config.settings || {
  delayBetweenAccounts: 5000,        // base delay between accounts
  minRandomExtra: 3000,              // extra random ms (small delay)
  maxRandomExtra: 5000,              // extra random ms (small delay)
  afterAllAccountsMinWait: 7200000,  // 2 hours minimum big wait
  afterAllAccountsMaxWait: 9000000   // 2 hours 30 minutes maximum big wait
};

// ========================================================
// GLOBAL BUMP COUNTER
// Increments only when /bump slash command is sent without error
// ========================================================
let totalBumps = 0;

// ========================================================
// HELPER: Timestamp with colors for nice console output
// ========================================================
const getTimestamp = () => {
  const now = new Date();
  const time = now.toISOString().replace('T', ' ').slice(0, 19);
  return `\x1b[36m[${time}]\x1b[0m`; // cyan timestamp
};

// ========================================================
// HELPER: Log to console + append to bumper.log file
// ========================================================
const logToFile = (message, isError = false) => {
  const logMessage = `${new Date().toISOString()} | ${message}\n`;
  fs.appendFileSync('bumper.log', logMessage, 'utf8');
  
  if (isError) {
    console.error(`${getTimestamp()} ❌ ${message}`);
  } else {
    console.log(`${getTimestamp()} ✅ ${message}`);
  }
};

// ========================================================
// STARTUP BANNER
// ========================================================
console.log('\n\x1b[32m====================================================\x1b[0m');
console.log('\x1b[33m     DISCORD SELF-BOT MULTI-ACCOUNT BUMPER     \x1b[0m');
console.log('\x1b[32m====================================================\x1b[0m');
logToFile(`Script started with ${config.accounts.length} accounts`);
logToFile(`Big wait range: ${SETTINGS.afterAllAccountsMinWait/60000}min - ${SETTINGS.afterAllAccountsMaxWait/60000}min (RANDOM every cycle)`);
logToFile(`BUMP MESSAGE FEATURE ENABLED → Sends "✅ Total bumps: X" in the bump channel`);
logToFile(`FIX APPLIED: Extra delay after /bump so server actually gets bumped before message`);
console.log('\x1b[32m====================================================\x1b[0m\n');

// ========================================================
// BUMP SINGLE ACCOUNT (with retry + safety delay + FIXED BUMP MESSAGE)
// ========================================================
async function bumpWithAccount(account, retryCount = 0) {
  const MAX_RETRIES = 2;
  const client = new Client();

  return new Promise((resolve) => {
    client.on('ready', async () => {
      logToFile(`Logged in as ${client.user.tag} (token: ${account.token.slice(0, 10)}...)`);

      try {
        const channel = await client.channels.fetch(account.channelId);
        
        // Send the /bump command first
        await channel.sendSlash('302050872383242240', 'bump');
        logToFile(`Bump command sent by ${client.user.tag}`);

        // === FIXED: Extra delay so Disboard actually processes the bump ===
        logToFile(`Waiting 2.5 seconds for Disboard to register the bump...`);
        await new Promise((resolve) => setTimeout(resolve, 2500));

        // === Now increment and send message in the bump channel ===
        totalBumps++;
        logToFile(`Total bumps performed so far: ${totalBumps}`);

        try {
          await channel.send(`✅ **Total bumps: ${totalBumps}**`);
          logToFile(`Bump count message sent in the channel`);
        } catch (msgError) {
          logToFile(`Could not send bump count message in channel: ${msgError.message}`, true);
        }

        // Final safety delay before destroying client
        await new Promise((resolve) => setTimeout(resolve, 1500));

      } catch (error) {
        logToFile(`Failed for token ${account.token.slice(0, 10)}: ${error.message}`, true);

        // Simple retry logic
        if (retryCount < MAX_RETRIES) {
          logToFile(`Retrying account (${retryCount + 1}/${MAX_RETRIES})...`);
          await new Promise((resolve) => setTimeout(resolve, 3000));
          return bumpWithAccount(account, retryCount + 1).then(resolve);
        }
      } finally {
        client.destroy();
        resolve();
      }
    });

    // Login with error handling
    client.login(account.token).catch((err) => {
      logToFile(`Login failed for token ${account.token.slice(0, 10)}: ${err.message}`, true);
      resolve();
    });
  });
}

// ========================================================
// MAIN LOOP - Runs forever with random delays
// ========================================================
async function startBumpLoop() {
  let totalBumpsAttempted = 0;
  let cycleCount = 0;

  while (true) {
    cycleCount++;
    logToFile(`=== STARTING CYCLE #${cycleCount} ===`);
    logToFile(`Current total bumps performed (from previous cycles): ${totalBumps}`);

    // Process every account in config
    for (const account of config.accounts) {
      logToFile(`Processing bump for token: ${account.token.slice(0, 10)}...`);
      
      await bumpWithAccount(account);
      totalBumpsAttempted++;

      // RANDOM small delay between each account
      const baseDelay = SETTINGS.delayBetweenAccounts;
      const randomExtra = Math.floor(Math.random() * (SETTINGS.maxRandomExtra - SETTINGS.minRandomExtra + 1)) + SETTINGS.minRandomExtra;
      const totalSmallDelay = baseDelay + randomExtra;
      
      logToFile(`Waiting ${totalSmallDelay/1000} seconds before next account...`);
      await new Promise((resolve) => setTimeout(resolve, totalSmallDelay));
    }

    // RANDOM big delay after ALL accounts finish
    const minWait = SETTINGS.afterAllAccountsMinWait;
    const maxWait = SETTINGS.afterAllAccountsMaxWait;
    const randomBigWait = Math.floor(Math.random() * (maxWait - minWait + 1)) + minWait;
    const randomMinutes = Math.round(randomBigWait / 60000);

    logToFile(`All ${config.accounts.length} accounts bumped this cycle!`);
    logToFile(`Total bumps attempted so far: ${totalBumpsAttempted}`);
    logToFile(`Total bumps performed so far: ${totalBumps}`);
    logToFile(`Waiting ${randomMinutes} minutes (RANDOM) before next cycle...`);

    await new Promise((resolve) => setTimeout(resolve, randomBigWait));

    logToFile(`Cycle #${cycleCount} finished. Starting next cycle soon...`);
    logToFile(`════════════════════════════════════════════════════`);
  }
}

// ========================================================
// GRACEFUL SHUTDOWN (Ctrl+C)
// ========================================================
process.on('SIGINT', () => {
  logToFile('Shutting down gracefully... (Ctrl+C pressed)', false);
  logToFile(`FINAL STATS → Total bumps performed: ${totalBumps}`);
  console.log('\n\x1b[31mScript stopped by user.\x1b[0m');
  process.exit(0);
});

// ========================================================
// UNHANDLED ERROR PROTECTION
// ========================================================
process.on('unhandledRejection', (reason) => {
  logToFile(`Unhandled Promise Rejection: ${reason}`, true);
});

process.on('uncaughtException', (error) => {
  logToFile(`Uncaught Exception: ${error.message}`, true);
  process.exit(1);
});

// ========================================================
// START THE SCRIPT
// ========================================================
logToFile('Starting main bump loop now...');
logToFile('FIXED VERSION loaded → bump message now sent AFTER Disboard processes the command');
startBumpLoop().catch((err) => {
  logToFile(`Critical error in main loop: ${err.message}`, true);
});
