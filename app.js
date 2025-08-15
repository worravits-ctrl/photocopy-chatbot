const express = require('express');
const line = require('@line/bot-sdk');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const XLSX = require('xlsx');
const path = require('path');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ตรวจสอบ Environment Variables
const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN || 'dummy_token';
const channelSecret = process.env.LINE_CHANNEL_SECRET || 'dummy_secret';
const geminiApiKey = process.env.GEMINI_API_KEY;
const port = process.env.PORT || 3000;

console.log('Environment check:');
console.log('- LINE_CHANNEL_ACCESS_TOKEN:', channelAccessToken ? 'Set' : 'Not set');
console.log('- LINE_CHANNEL_SECRET:', channelSecret ? 'Set' : 'Not set');
console.log('- GEMINI_API_KEY:', geminiApiKey ? 'Set' : 'Not set');
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

// ตั้งค่า Gemini AI
let genAI;
if (geminiApiKey) {
    genAI = new GoogleGenerativeAI(geminiApiKey);
    console.log('Gemini AI initialized');
} else {
    console.log('Warning: GEMINI_API_KEY not set');
}

// อ่านข้อมูลจาก Excel
let priceData = {};
try {
    const workbook = XLSX.readFile(path.join(__dirname, 'price_table.xlsx'));
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);
    
    data.forEach(row => {
        const key = `${row['Paper Size']}_${row['Color']}_${row['Sides']}`;
        priceData[key] = row['Price per Page'];
    });
    console.log('Price data loaded:', Object.keys(priceData).length, 'entries');
} catch (error) {
    console.error('Error loading price data:', error);
    // ข้อมูลราคาสำรอง
    priceData = {
        'A4_BW_Single': 0.5,
        'A4_BW_Double': 1,
        'A4_Color_Single': 2,
        'A4_Color_Double': 4,
        'A3_BW_Single': 1,
        'A3_BW_Double': 2,
        'A3_Color_Single': 4,
        'A3_Color_Double': 8
    };
    console.log('Using fallback price data');
}

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
            details: `${paperSize} ${color} ${sides}-sided: ${pages} pages × ${pricePerPage} บาท/หน้า = ${totalPrice} บาท`
        };
    }
    return { success: false, message: 'ไม่พบข้อมูลราคาสำหรับตัวเลือกนี้' };
}

// ฟังก์ชันใช้ Gemini AI ตอบคำถาม
async function getGeminiResponse(question) {
    if (!genAI) {
        return 'ขออภัย ระบบ AI ไม่พร้อมใช้งานในขณะนี้';
    }
    
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        
        const context = `คุณคือผู้ช่วยของร้านถ่ายเอกสาร ข้อมูลราคาที่มี:
${Object.keys(priceData).map(key => {
    const [size, color, sides] = key.split('_');
    return `${size} ${color} ${sides}: ${priceData[key]} บาท/หน้า`;
}).join('\n')}

กรุณาตอบคำถามเกี่ยวกับการถ่ายเอกสารและราคาด้วยภาษาไทยที่เป็นมิตร`;

        const result = await model.generateContent([context, question].join('\n\n'));
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error('Gemini error:', error);
        return 'ขออภัย เกิดข้อผิดพลาดในการติดต่อระบบ AI กรุณาลองใหม่อีกครั้ง';
    }
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
            .message { margin: 10px 0; padding: 10px; border-radius: 5px; }
            .user { background-color: #007bff; color: white; text-align: right; }
            .bot { background-color: #f8f9fa; }
            input[type="text"] { width: 70%; padding: 10px; }
            button { width: 25%; padding: 10px; background-color: #007bff; color: white; border: none; cursor: pointer; }
        </style>
    </head>
    <body>
        <h1>🖨️ ระบบคำนวณราคาถ่ายเอกสาร</h1>
        <div class="chat-container" id="chatContainer">
            <div class="message bot">สวัสดีค่ะ! ยินดีให้บริการคำนวณราคาถ่ายเอกสาร<br>
            ลองถามเช่น "ราคาถ่ายเอกสาร A4 ขาวดำ 2 หน้า 50 หน้า"</div>
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
                messageDiv.innerHTML = text;
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
    const userMessage = req.body.message;
    
    // ลองจับคำถามเกี่ยวกับราคา
    const priceRegex = /(\w+).*?(ขาวดำ|สี|BW|Color|black|white|color).*?(หน้าเดียว|สองหน้า|single|double|1|2).*?(\d+)/i;
    const match = userMessage.match(priceRegex);
    
    if (match) {
        const paperSize = match[1].toUpperCase().includes('A4') ? 'A4' : 
                         match[1].toUpperCase().includes('A3') ? 'A3' : 'A4';
        const color = match[2].includes('สี') || match[2].toLowerCase().includes('color') ? 'Color' : 'BW';
        const sides = match[3].includes('สอง') || match[3].includes('double') || match[3].includes('2') ? 'Double' : 'Single';
        const pages = parseInt(match[4]);
        
        const result = calculatePrice(paperSize, color, sides, pages);
        
        if (result.success) {
            res.json({ reply: result.details });
            return;
        }
    }
    
    // ใช้ Gemini AI ตอบคำถาม
    const aiResponse = await getGeminiResponse(userMessage);
    res.json({ reply: aiResponse });
});

// Webhook สำหรับ LINE (เฉพาะเมื่อมี client)
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

        const userMessage = event.message.text;
        
        // ลองจับคำถามเกี่ยวกับราคา
        const priceRegex = /(\w+).*?(ขาวดำ|สี|BW|Color|black|white|color).*?(หน้าเดียว|สองหน้า|single|double|1|2).*?(\d+)/i;
        const match = userMessage.match(priceRegex);
        
        let replyText;
        
        if (match) {
            const paperSize = match[1].toUpperCase().includes('A4') ? 'A4' : 
                             match[1].toUpperCase().includes('A3') ? 'A3' : 'A4';
            const color = match[2].includes('สี') || match[2].toLowerCase().includes('color') ? 'Color' : 'BW';
            const sides = match[3].includes('สอง') || match[3].includes('double') || match[3].includes('2') ? 'Double' : 'Single';
            const pages = parseInt(match[4]);
            
            const result = calculatePrice(paperSize, color, sides, pages);
            replyText = result.success ? result.details : result.message;
        } else {
            replyText = await getGeminiResponse(userMessage);
        }

        return client.replyMessage(event.replyToken, {
            type: 'text',
            text: replyText
        });
    }
}

// เริ่มเซิร์ฟเวอร์
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
    console.log('Service Status:');
    console.log('- Web Interface: ✅ Ready');
    console.log('- LINE Bot:', client ? '✅ Ready' : '⚠️  Disabled (no token)');
    console.log('- Gemini AI:', genAI ? '✅ Ready' : '⚠️  Disabled (no API key)');
});
