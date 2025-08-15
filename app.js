const express = require('express');
const line = require('@line/bot-sdk');
const XLSX = require('xlsx');
const path = require('path');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Environment Variables
const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN || 'dummy_token';
const channelSecret = process.env.LINE_CHANNEL_SECRET || 'dummy_secret';
const port = process.env.PORT || 3000;

console.log('Environment check:');
console.log('- LINE_CHANNEL_ACCESS_TOKEN:', channelAccessToken ? 'Set' : 'Not set');
console.log('- LINE_CHANNEL_SECRET:', channelSecret ? 'Set' : 'Not set');
console.log('- PORT:', port);

// ตั้งค่า LINE Bot (เฉพาะเมื่อมี token จริง)
let client;
if (channelAccessToken !== 'dummy_token') {
    const config = {
        channelAccessToken: channelAccessToken,
        channelSecret: channelSecret,
    };
    client = new line.Client(config);
    console.log('LINE Bot client initialized');
} else {
    console.log('LINE Bot client skipped - using dummy token');
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

console.log('Using default price data:', Object.keys(priceData).length, 'entries');

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
    
    // ถ้าเป็นคำทักทาย
    if (text.includes('สวัสดี') || text.includes('hello') || text.includes('hi')) {
        return {
            type: 'greeting',
            response: 'สวัสดีค่ะ! 😊\nยินดีให้บริการคำนวณราคาถ่ายเอกสาร\n\nตัวอย่างการถาม:\n"A4 ขาวดำ หน้าเดียว 50 หน้า"\n"A3 สี สองหน้า 20 หน้า"'
        };
    }
    
    // จับราคา - pattern ใหม่ที่ง่ายขึ้น
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
            
            // หา paper size
            for (let part of match) {
                if (part && part.toLowerCase().includes('a4')) paperSize = 'A4';
                if (part && part.toLowerCase().includes('a3')) paperSize = 'A3';
            }
            
            // หา color
            for (let part of match) {
                if (part && (part.includes('สี') || part.toLowerCase().includes('color'))) color = 'Color';
            }
            
            // หา sides
            for (let part of match) {
                if (part && (part.includes('สอง') || part.includes('หลัง') || part.toLowerCase().includes('double'))) sides = 'Double';
            }
            
            // หา pages
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
    
    // ถ้าไม่จับได้
    return {
        type: 'help',
        response: '📝 ไม่เข้าใจคำถาม กรุณาถามในรูปแบบ:\n\n"A4 ขาวดำ หน้าเดียว 50 หน้า"\n"A3 สี สองหน้า 20 หน้า"\n\n💰 ตารางราคา:\n• A4 ขาวดำ หน้าเดียว: 0.5 บาท/หน้า\n• A4 ขาวดำ สองหน้า: 1 บาท/หน้า\n• A4 สี หน้าเดียว: 2 บาท/หน้า\n• A4 สี สองหน้า: 4 บาท/หน้า\n• A3 ขาวดำ หน้าเดียว: 1 บาท/หน้า\n• A3 ขาวดำ สองหน้า: 2 บาท/หน้า\n• A3 สี หน้าเดียว: 4 บาท/หน้า\n• A3 สี สองหน้า: 8 บาท/หน้า'
    };
}

// หน้าแรกของเว็บไซต์
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
        </style>
    </head>
    <body>
        <h1>🖨️ ระบบคำนวณราคาถ่ายเอกสาร</h1>
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

// API สำหรับแชทบนเว็บ
app.post('/chat', async (req, res) => {
    console.log('Received message:', req.body.message);
    const result = parseMessage(req.body.message);
    console.log('Response:', result.response);
    res.json({ reply: result.response });
});

// Webhook สำหรับ LINE
if (client) {
    app.post('/webhook', line.middleware({
        channelSecret: channelSecret
    }), (req, res) => {
        Promise
            .all(req.body.events.map(handleEvent))
            .then((result) => res.json(result))
            .catch((err) => {
                console.error(err);
                res.status(500).end();
            });
    });

    async function handleEvent(event) {
        if (event.type !== 'message' || event.message.type !== 'text') {
            return Promise.resolve(null);
        }

        const result = parseMessage(event.message.text);
        
        return client.replyMessage(event.replyToken, {
            type: 'text',
            text: result.response
        });
    }
}

// เริ่มเซิร์ฟเวอร์
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
    console.log('Service Status:');
    console.log('- Web Interface: ✅ Ready');
    console.log('- LINE Bot:', client ? '✅ Ready' : '⚠️  Disabled (no token)');
    console.log('- Price Calculator: ✅ Ready');
});
