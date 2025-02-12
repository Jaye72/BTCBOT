const axios = require('axios');
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Telegram Bot Configuration
const TELEGRAM_BOT_TOKEN = '7865441654:AAEkoQg2IlfumRyRYV26dfQDx-9i4QMOOSc';
const TELEGRAM_CHAT_ID = '869023013';

// Timeframes to monitor
const TIMEFRAMES = ['5m', '15m', '30m', '1h'];

// Fetch Bitcoin Candlestick Data
async function getBitcoinData(interval) {
    try {
        const response = await axios.get('https://api.binance.com/api/v3/klines', {
            params: {
                symbol: 'BTCUSDT',
                interval: interval, // Dynamic interval
                limit: 2 // Get last 2 candlesticks
            }
        });
        return response.data;
    } catch (error) {
        console.error(`Error fetching Bitcoin data for ${interval}:`, error);
        return null;
    }
}

// Identify Hammer Doji, Shooting Star & Doji
function detectPatterns(candles) {
    if (!candles || candles.length < 2) return null;

    const [prevCandle, lastCandle] = candles.slice(-2).map(candle => ({
        open: parseFloat(candle[1]),
        high: parseFloat(candle[2]),
        low: parseFloat(candle[3]),
        close: parseFloat(candle[4])
    }));

    const bodySize = Math.abs(lastCandle.open - lastCandle.close);
    const upperWick = lastCandle.high - Math.max(lastCandle.open, lastCandle.close);
    const lowerWick = Math.min(lastCandle.open, lastCandle.close) - lastCandle.low;
    const totalRange = lastCandle.high - lastCandle.low;

    if (totalRange === 0) return null; // Avoid division by zero

    // Hammer Doji
    if (bodySize < totalRange * 0.2 && lowerWick >= bodySize * 2 && upperWick < bodySize * 0.5) {
        return 'Hammer Doji';
    }
    // Shooting Star
    if (bodySize < totalRange * 0.2 && upperWick >= bodySize * 2 && lowerWick < bodySize * 0.5) {
        return 'Shooting Star';
    }
    // Doji (Small body, long wicks)
    if (bodySize < totalRange * 0.1 && upperWick > bodySize && lowerWick > bodySize) {
        return 'Doji';
    }
    
    return null;
}

// Send Telegram Alert
async function sendTelegramAlert(message) {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    await axios.post(url, {
        chat_id: TELEGRAM_CHAT_ID,
        text: message
    }).catch(err => console.error('Error sending Telegram message:', err));
}

// Continuously check market for all timeframes
async function monitorMarket() {
    console.log('🚀 Market Monitoring Started...');
    
    while (true) {
        for (const timeframe of TIMEFRAMES) {
            const data = await getBitcoinData(timeframe);
            const pattern = detectPatterns(data);

            if (pattern) {
                const message = `⚠️ Bitcoin Alert: ${pattern} detected on ${timeframe} candle!`;
                console.log(message);
                await sendTelegramAlert(message);
            }
        }
        
        // Short delay to prevent excessive API requests
        await new Promise(resolve => setTimeout(resolve, 5000)); // 5 seconds delay
    }
}

// Start market monitoring
monitorMarket();

// Express Server (For AWS EC2 Hosting)
app.get('/', (req, res) => {
    res.send('Bitcoin Candlestick Alert System is Running!');
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
