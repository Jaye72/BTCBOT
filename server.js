const axios = require('axios');
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Telegram Bot Configuration
const TELEGRAM_BOT_TOKEN = '7853444390:AAGKyrH1B7kexDFq_4_moOf4xHtIx48f8Gk';
const TELEGRAM_CHAT_ID = '869023013';

// Binance API URL for BTC/USDT 15-minute data
const BINANCE_URL = 'https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=15m&limit=100';

let lastAlert = null; // Track last alert type

// Send Telegram Alert
async function sendTelegramAlert(message) {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    try {
        await axios.post(url, {
            chat_id: TELEGRAM_CHAT_ID,
            text: message,
            parse_mode: 'Markdown'
        });
        console.log('Telegram alert sent!');
    } catch (error) {
        console.error('Error sending Telegram message:', error.response?.data || error.message);
    }
}

// Fetch BTC/USDT 15-minute candlestick data
async function fetchBitcoinData() {
    try {
        const response = await axios.get(BINANCE_URL);
        return response.data.map(candle => ({
            timestamp: new Date(candle[0]),
            open: parseFloat(candle[1]),
            high: parseFloat(candle[2]),
            low: parseFloat(candle[3]),
            close: parseFloat(candle[4]),
            volume: parseFloat(candle[5])
        }));
    } catch (error) {
        console.error('Error fetching Binance data:', error.response?.status || error.message);
        return null;
    }
}

// Calculate RSI
function calculateRSI(data, period = 14) {
    const changes = data.map((candle, i) => i === 0 ? 0 : candle.close - data[i - 1].close);
    const gains = changes.map(change => (change > 0 ? change : 0));
    const losses = changes.map(change => (change < 0 ? -change : 0));
    
    let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
    let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
    
    const rsis = [];
    for (let i = period; i < data.length; i++) {
        avgGain = (avgGain * (period - 1) + gains[i]) / period;
        avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
        const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
        rsis.push(100 - (100 / (1 + rs)));
    }
    return rsis;
}

// Check RSI Alert
async function checkRSIAlert() {
    const data = await fetchBitcoinData();
    if (!data || data.length < 15) return;
    
    const rsis = calculateRSI(data);
    const latestRSI = rsis[rsis.length - 1];
    const lastClose = data[data.length - 1].close;
    const binanceLink = 'https://www.binance.com/en/trade/BTC_USDT';
    
    let alertType = null;
    let message = '';
    
    if (latestRSI < 20 && lastAlert !== 'oversold') {
        alertType = 'oversold';
        message = `\u2B07\U0001F534 RSI OVERSOLD ALERT: BTC/USDT\nRSI: ${latestRSI.toFixed(2)} (Below 20)\nCurrent Price: ${lastClose.toFixed(4)}\n[Open on Binance](${binanceLink})`;
    } else if (latestRSI > 80 && lastAlert !== 'overbought') {
        alertType = 'overbought';
        message = `\u2B06\U0001F7E2 RSI OVERBOUGHT ALERT: BTC/USDT\nRSI: ${latestRSI.toFixed(2)} (Above 80)\nCurrent Price: ${lastClose.toFixed(4)}\n[Open on Binance](${binanceLink})`;
    }
    
    if (alertType) {
        await sendTelegramAlert(message);
        lastAlert = alertType;
    }
}

// Monitor BTC RSI every minute
async function monitorRSI() {
    console.log('🚀 BTC/USDT RSI Monitoring Started...');
    while (true) {
        await checkRSIAlert();
        await new Promise(resolve => setTimeout(resolve, 60000)); // 60 seconds delay
    }
}

// Start monitoring
monitorRSI();

// Express Server (For AWS EC2 Hosting)
app.get('/', (req, res) => {
    res.send('Bitcoin RSI Alert System is Running!');
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
