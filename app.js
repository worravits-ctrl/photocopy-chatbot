require('dotenv').config();

const express = require('express');
const line = require('@line/bot-sdk');

const app = express();

// Environment Variables
const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const channelSecret = process.env.LINE_CHANNEL_SECRET;
const port = process.env.PORT || 3000;

console.log('Environment check:');
console.log('- LINE_CHANNEL_ACCESS_TOKEN:', channelAccessToken ? 'Set ✅' : 'Not set ❌');
console.log('- LINE_CHANNEL_SECRET:', channelSecret ? 'Set ✅' : 'Not set ❌');
console.log('- PORT:', port);

// ตั้งค่า LINE Bot
let client;
let lineConfig;
if (channelAccessToken && channelSecret) {
    lineConfig = {
        channelAccessToken: channelAccessToken,
        channelSecret: channelSecret,
    };
    client = new line.Client(lineConfig);
    console.log('LINE Bot client initialized ✅');
} else {
    console.log('LINE Bot client skipped ⚠️ - Missing credentials');
}

// ข้อมูลราคา
const priceData = {
    'A4_BW_Single': 0.5,
    'A4_BW_Double': 1,
    'A4_Color_Single': 2,
    'A4_Color_Double': 4,
    'A3_BW_Single': 1,
    'A3_BW_Double': 2,
    'A3_Color_Single': 4,
    'A3_Color_Double': 8
};

// ฟังก์ชันคำนวณราคา
function calculatePrice(paperSize, color, sides, pages) {
    const key = `${paperSize}_${color}_${sides}`;
    const pricePerPage = priceData[key];
    
    if (pricePerPage) {
        const totalPrice = pricePerPage * pages;
        return {
            success: true,
            pricePerPage: pricePerPage,
            totalPrice: totalPrice,
            details: `📊 คำนวณราคา:\n🔸 ${paperSize} ${color === 'BW' ? 'ขาวดำ' : 'สี'} ${sides === 'Single' ? 'หน้าเดียว' : 'สองหน้า'}\n🔸 จำนวน: ${pages} หน้า\n🔸 ราคา: ${pages} × ${pricePerPage} = ${totalPrice} บาท`
        };
    }
    return { success: false, message: 'ไม่พบข้อมูลราคาสำหรับตัวเลือกนี้' };
}

// ฟังก์ชันจับคำถาม
function parseMessage(message) {
    const text = message.toLowerCase();
    
    if (text.includes('สวัสดี') || text.includes('hello') || text.includes('hi')) {
        return {
            type: 'greeting',
            response: 'สวัสดีค่ะ! 😊\nยินดีให้บริการคำนวณราคาถ่ายเอกสาร\n\nตัวอย่างการถาม:\n"A4 ขาวดำ หน้าเดียว 50 หน้า"\n"A3 สี สองหน้า 20 หน้า"'
        };
    }
    
    const patterns = [
        /(\w*a4\w*).*?(ขาวดำ|สี|bw|color|black|white).*?(หน้าเดียว|สองหน้า|หน้าหลัง|single|double|\d+\s*หน้า|\bหน้า\b).*?(\d+)/i,
        /(\w*a3\w*).*?(ขาวดำ|สี|bw|color|black|white).*?(หน้าเดียว|สองหน้า|หน้าหลัง|single|double|\d+\s*หน้า|\bหน้า\b).*?(\d+)/i,
        /(ขาวดำ|สี|bw|color|black|white).*?(\w*a4\w*|\w*a3\w*).*?(หน้าเดียว|สองหน้า|หน้าหลัง|single|double|\d+\s*หน้า|\bหน้า\b).*?(\d+)/i,
        /(\d+).*?(หน้า).*?(a4|a3).*?(ขาวดำ|สี|bw|color|black|white).*?(หน้าเดียว|สองหน้า|หน้าหลัง|single|double)/i
    ];
    
    for (let pattern of patterns) {
        const match = message.match(pattern);
        if (match) {
            let paperSize = 'A4';
            let color = 'BW';
            let sides = 'Single';
            let pages = 0;
            
            for (let part of match) {
                if (part && part.toLowerCase().includes('a4')) paperSize = 'A4';
                if (part && part.toLowerCase().includes('a3')) paperSize = 'A3';
            }
            
            for (let part of match) {
                if (part && (part.includes('สี') || part.toLowerCase().includes('color'))) color = 'Color';
            }
            
            for (let part of match) {
                if (part && (part.includes('สอง') || part.includes('หลัง') || part.toLowerCase().includes('double'))) sides = 'Double';
            }
            
            for (let part of match) {
                if (part && /^\d+$/.test(part)) {
                    pages = parseInt(part);
                    break;
                }
            }
            
            if (pages > 0) {
                const result = calculatePrice(paperSize, color, sides, pages);
                return {
                    type: 'price',
                    response: result.success ? result.details : result.message
                };
            }
        }
    }
    
    return {
        type: 'help',
        response: '📝 ไม่เข้าใจคำถาม กรุณาถามในรูปแบบ:\n\n"A4 ขาวดำ หน้าเดียว 50 หน้า"\n"A3 สี สองหน้า 20 หน้า"\n\n💰 ตารางราคา:\n• A4 ขาวดำ หน้าเดียว: 0.5 บาท/หน้า\n• A4 ขาวดำ สองหน้า: 1 บาท/หน้า\n• A4 สี หน้าเดียว: 2 บาท/หน้า\n• A4 สี สองหน้า: 4 บาท/หน้า\n• A3 ขาวดำ หน้าเดียว: 1 บาท/หน้า\n• A3 ขาวดำ สองหน้า: 2 บาท/หน้า\n• A3 สี หน้าเดียว: 4 บาท/หน้า\n• A3 สี สองหน้า: 8 บาท/หน้า'
    };
}

// หน้าแรก
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Photocopy Chatbot</title>
        <style>
            body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
            .chat-container { border: 1px solid #ddd; height: 400px; overflow-y: auto; padding: 10px; margin: 10px 0; }
            .message { margin: 10px 0; padding: 10px; border-radius: 5px; white-space: pre-wrap; }
            .user { background-color: #007bff; color: white; text-align: right; }
            .bot { background-color: #f8f9fa; }
            input[type="text"] { width: 70%; padding: 10px; }
            button { width: 25%; padding: 10px; background-color: #007bff; color: white; border: none; cursor: pointer; }
            .status { padding: 10px; margin: 10px 0; border-radius: 5px; }
            .connected { background-color: #d4edda; color: #155724; }
            .disconnected { background-color: #f8d7da; color: #721c24; }
        </style>
    </head>
    <body>
        <h1>🖨️ ระบบคำนวณราคาถ่ายเอกสาร</h1>
        <div class="status ${client ? 'connected' : 'disconnected'}">
            LINE Bot: ${client ? '✅ เชื่อมต่อแล้ว' : '⚠️ ไม่ได้เชื่อมต่อ'}
        </div>
        <div class="chat-container" id="chatContainer">
            <div class="message bot">สวัสดีค่ะ! ยินดีให้บริการคำนวณราคาถ่ายเอกสาร
ลองถามเช่น:
• "A4 ขาวดำ หน้าเดียว 50 หน้า"
• "A3 สี สองหน้า 20 หน้า"
• "สวัสดี" (ดูคำแนะนำ)</div>
        </div>
        <div>
            <input type="text" id="messageInput" placeholder="พิมพ์คำถามของคุณ..." onkeypress="if(event.key==='Enter') sendMessage()">
            <button onclick="sendMessage()">ส่ง</button>
        </div>

        <script>
            function addMessage(text, isUser) {
                const chatContainer = document.getElementById('chatContainer');
                const messageDiv = document.createElement('div');
                messageDiv.className = 'message ' + (isUser ? 'user' : 'bot');
                messageDiv.textContent = text;
                chatContainer.appendChild(messageDiv);
                chatContainer.scrollTop = chatContainer.scrollHeight;
            }

            async function sendMessage() {
                const input = document.getElementById('messageInput');
                const message = input.value.trim();
                if (!message) return;

                addMessage(message, true);
                input.value = '';

                try {
                    const response = await fetch('/chat', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ message: message })
                    });
                    const data = await response.json();
                    addMessage(data.reply, false);
                } catch (error) {
                    addMessage('ขออภัย เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง', false);
                }
            }
        </script>
    </body>
    </html>
    `);
});

// Health check
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        lineBot: client ? 'Connected' : 'Disconnected'
    });
});

// Chat API - ใช้ JSON parser เฉพาะ endpoint นี้
app.post('/chat', express.json(), (req, res) => {
    console.log('Received web message:', req.body.message);
    const result = parseMessage(req.body.message);
    console.log('Web response:', result.response);
    res.json({ reply: result.response });
});

// LINE Webhook - ใช้ LINE middleware โดยไม่ผ่าน JSON parser ของ Express
if (client && lineConfig) {
    app.post('/webhook', line.middleware(lineConfig), (req, res) => {
        console.log('🎯 LINE Webhook received successfully!');
        
        if (!req.body.events || req.body.events.length === 0) {
            return res.status(200).json({ message: 'No events' });
        }

        Promise.all(req.body.events.map(handleEvent))
            .then(() => res.status(200).json({ success: true }))
            .catch((err) => {
                console.error('LINE Event error:', err);
                res.status(500).json({ error: 'Processing failed' });
            });
    });

    async function handleEvent(event) {
        console.log('Processing LINE event:', event.type);
        
        if (event.type !== 'message' || event.message.type !== 'text') {
            return null;
        }

        console.log('LINE message:', event.message.text);
        const result = parseMessage(event.message.text);

        try {
            await client.replyMessage(event.replyToken, {
                type: 'text',
                text: result.response
            });
            console.log('✅ Reply sent to LINE');
        } catch (error) {
            console.error('❌ LINE reply error:', error);
            throw error;
        }
    }
} else {
    app.post('/webhook', express.json(), (req, res) => {
        res.status(200).json({ message: 'LINE not configured' });
    });
}

// 404 handler
app.use((req, res) => {
    if (req.originalUrl.includes('favicon.ico')) {
        return res.status(204).end();
    }
    console.log('404:', req.originalUrl);
    res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((error, req, res, next) => {
    console.error('Express error:', error);
    res.status(500).json({ error: 'Server error' });
});

// Start server
app.listen(port, () => {
    console.log(`\n🚀 Server running on port ${port}`);
    console.log('🌐 URL: https://photocopy-chatbot.onrender.com');
    console.log('\n📊 Status:');
    console.log('- Web Interface: ✅');
    console.log('- LINE Bot:', client ? '✅ Ready' : '⚠️ Disabled');
    console.log('- Webhook: ✅ /webhook');
});
