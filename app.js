require('dotenv').config();

const express = require('express');
const line = require('@line/bot-sdk');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const app = express();

// Environment Variables
const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const channelSecret = process.env.LINE_CHANNEL_SECRET;
const port = process.env.PORT || 3000;

console.log('Environment check:');
console.log('- LINE_CHANNEL_ACCESS_TOKEN:', channelAccessToken ? `Set ✅ (${channelAccessToken.substring(0, 20)}...)` : 'Not set ❌');
console.log('- LINE_CHANNEL_SECRET:', channelSecret ? `Set ✅ (${channelSecret.substring(0, 10)}...)` : 'Not set ❌');
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

// ข้อมูลราคา (default ถ้าไม่มี Excel)
let priceData = {
    'A4_BW_Single': 0.5,
    'A4_BW_Double': 1,
    'A4_Color_Single': 2,
    'A4_Color_Double': 4,
    'A3_BW_Single': 1,
    'A3_BW_Double': 2,
    'A3_Color_Single': 4,
    'A3_Color_Double': 8
};

// ฟังก์ชันโหลดราคาจาก Excel
function loadPricesFromExcel() {
    const excelFiles = ['prices.xlsx', 'ราคา.xlsx', 'price-list.xlsx'];
    
    for (const fileName of excelFiles) {
        const filePath = path.join(__dirname, fileName);
        
        if (fs.existsSync(filePath)) {
            try {
                console.log(`📊 กำลังโหลดราคาจาก: ${fileName}`);
                
                const workbook = XLSX.readFile(filePath);
                const sheetName = workbook.SheetNames[0]; // ใช้ sheet แรก
                const worksheet = workbook.Sheets[sheetName];
                const data = XLSX.utils.sheet_to_json(worksheet);
                
                console.log(`📋 พบข้อมูล ${data.length} รายการ`);
                
                // แปลงข้อมูลจาก Excel เป็น priceData object
                const newPriceData = {};
                
                data.forEach((row, index) => {
                    try {
                        // รองรับหลายรูปแบบ column names
                        const paperSize = row['ขนาด'] || row['Size'] || row['paper_size'] || row['Paper Size'] || 'A4';
                        const color = row['สี'] || row['Color'] || row['color'] || row['Type'] || 'BW';
                        const sides = row['หน้า'] || row['Sides'] || row['sides'] || row['Page'] || 'Single';
                        const price = parseFloat(row['ราคา'] || row['Price'] || row['price'] || row['ราคาต่อแผ่น'] || 0);
                        
                        if (price > 0) {
                            // แปลงเป็นรูปแบบที่ใช้ในโค้ด
                            const sizeKey = paperSize.toUpperCase().replace(/[^A-Z0-9]/g, '');
                            const colorKey = normalizeColor(color);
                            const sidesKey = normalizeSides(sides);
                            
                            const key = `${sizeKey}_${colorKey}_${sidesKey}`;
                            newPriceData[key] = price;
                            
                            console.log(`   ✅ ${key}: ${price} บาท`);
                        }
                    } catch (error) {
                        console.log(`   ⚠️ ข้ามแถวที่ ${index + 1}: ${error.message}`);
                    }
                });
                
                if (Object.keys(newPriceData).length > 0) {
                    priceData = { ...priceData, ...newPriceData };
                    console.log(`✅ โหลดราคาจาก Excel สำเร็จ: ${Object.keys(newPriceData).length} รายการ`);
                    return true;
                }
                
            } catch (error) {
                console.log(`❌ ไม่สามารถอ่าน ${fileName}: ${error.message}`);
            }
        }
    }
    
    console.log('📝 ใช้ราคา default');
    return false;
}

// ฟังก์ชันแปลงสีให้เป็นมาตรฐาน
function normalizeColor(color) {
    const colorStr = color.toString().toLowerCase();
    if (colorStr.includes('สี') || colorStr.includes('color') || colorStr.includes('c')) {
        return 'Color';
    }
    return 'BW';
}

// ฟังก์ชันแปลงหน้าให้เป็นมาตรฐาน
function normalizeSides(sides) {
    const sidesStr = sides.toString().toLowerCase();
    if (sidesStr.includes('สอง') || sidesStr.includes('double') || sidesStr.includes('2') || sidesStr.includes('หลัง')) {
        return 'Double';
    }
    return 'Single';
}

// โหลดราคาจาก Excel เมื่อเริ่มต้น
loadPricesFromExcel();

console.log('Current price data:', Object.keys(priceData).length, 'entries');

// ฟังก์ชันคำนวณราคา
function calculatePrice(paperSize, color, sides, sheets) {
    const key = `${paperSize}_${color}_${sides}`;
    const pricePerSheet = priceData[key];
    
    if (pricePerSheet) {
        const totalPrice = pricePerSheet * sheets;
        return {
            success: true,
            pricePerSheet: pricePerSheet,
            totalPrice: totalPrice,
            details: `📊 คำนวณราคา:\n🔸 ${paperSize} ${color === 'BW' ? 'ขาวดำ' : 'สี'} ${sides === 'Single' ? 'หน้าเดียว' : 'สองหน้า'}\n🔸 จำนวน: ${sheets} แผ่น\n🔸 ราคา: ${sheets} × ${pricePerSheet} = ${totalPrice} บาท`
        };
    }
    return { success: false, message: 'ไม่พบข้อมูลราคาสำหรับตัวเลือกนี้' };
}

// ฟังก์ชันจับคำถาม (อัพเดตให้รองรับ "แผ่น")
function parseMessage(message) {
    const text = message.toLowerCase();
    
    if (text.includes('สวัสดี') || text.includes('hello') || text.includes('hi')) {
        return {
            type: 'greeting',
            response: 'สวัสดีค่ะ! 😊\nยินดีให้บริการคำนวณราคาถ่ายเอกสาร\n\nตัวอย่างการถาม:\n"A4 ขาวดำ หน้าเดียว 50 แผ่น"\n"A3 สี สองหน้า 20 แผ่น"'
        };
    }
    
    // โหลดราคาใหม่หากมีคำสั่ง
    if (text.includes('โหลดราคา') || text.includes('reload') || text.includes('refresh')) {
        const loaded = loadPricesFromExcel();
        return {
            type: 'system',
            response: loaded ? '✅ โหลดราคาจาก Excel สำเร็จแล้ว' : '⚠️ ไม่พบไฟล์ Excel ใช้ราคา default'
        };
    }
    
    // แสดงตารางราคา
    if (text.includes('ราคา') && (text.includes('ตาราง') || text.includes('ทั้งหมด') || text.includes('list'))) {
        return {
            type: 'price_list',
            response: generatePriceTable()
        };
    }
    
    // จับราคา - pattern ที่รองรับทั้ง "หน้า" และ "แผ่น"
    const patterns = [
        // A4/A3 + สี + หน้า/แผ่น + จำนวน
        /(\w*a4\w*).*?(ขาวดำ|สี|bw|color|black|white).*?(หน้าเดียว|สองหน้า|หน้าหลัง|single|double|\d+\s*(หน้า|แผ่น)|\b(หน้า|แผ่น)\b).*?(\d+)/i,
        /(\w*a3\w*).*?(ขาวดำ|สี|bw|color|black|white).*?(หน้าเดียว|สองหน้า|หน้าหลัง|single|double|\d+\s*(หน้า|แผ่น)|\b(หน้า|แผ่น)\b).*?(\d+)/i,
        
        // สี + A4/A3 + หน้า/แผ่น + จำนวน
        /(ขาวดำ|สี|bw|color|black|white).*?(\w*a4\w*|\w*a3\w*).*?(หน้าเดียว|สองหน้า|หน้าหลัง|single|double|\d+\s*(หน้า|แผ่น)|\b(หน้า|แผ่น)\b).*?(\d+)/i,
        
        // จำนวน + แผ่น/หน้า + A4/A3 + สี + หน้าเดียว/สองหน้า
        /(\d+).*?(หน้า|แผ่น).*?(a4|a3).*?(ขาวดำ|สี|bw|color|black|white).*?(หน้าเดียว|สองหน้า|หน้าหลัง|single|double)/i
    ];
    
    for (let pattern of patterns) {
        const match = message.match(pattern);
        if (match) {
            let paperSize = 'A4';
            let color = 'BW';
            let sides = 'Single';
            let sheets = 0;
            
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
            
            // หา sheets (จำนวน)
            for (let part of match) {
                if (part && /^\d+$/.test(part)) {
                    sheets = parseInt(part);
                    break;
                }
            }
            
            if (sheets > 0) {
                const result = calculatePrice(paperSize, color, sides, sheets);
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
        response: generateHelpMessage()
    };
}

// ฟังก์ชันสร้างตารางราคา
function generatePriceTable() {
    let table = '💰 ตารางราคาปัจจุบัน:\n\n';
    
    const sizes = ['A4', 'A3'];
    const colors = [['BW', 'ขาวดำ'], ['Color', 'สี']];
    const sidesList = [['Single', 'หน้าเดียว'], ['Double', 'สองหน้า']];
    
    sizes.forEach(size => {
        table += `📄 ${size}:\n`;
        colors.forEach(([colorKey, colorName]) => {
            sidesList.forEach(([sidesKey, sidesName]) => {
                const key = `${size}_${colorKey}_${sidesKey}`;
                const price = priceData[key];
                if (price) {
                    table += `• ${colorName} ${sidesName}: ${price} บาท/แผ่น\n`;
                }
            });
        });
        table += '\n';
    });
    
    table += '🔄 พิมพ์ "โหลดราคา" เพื่ออัพเดตราคาจาก Excel';
    
    return table;
}

// ฟังก์ชันสร้างข้อความช่วยเหลือ
function generateHelpMessage() {
    return `📝 ไม่เข้าใจคำถาม กรุณาถามในรูปแบบ:

"A4 ขาวดำ หน้าเดียว 50 แผ่น"
"A3 สี สองหน้า 20 แผ่น"

💰 ดูตารางราคา: พิมพ์ "ตารางราคา"
🔄 อัพเดตราคา: พิมพ์ "โหลดราคา"

💡 รองรับคำว่า: หน้า, แผ่น, sheets, pages`;
}

// หน้าแรก
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Photocopy Chatbot with Excel Support</title>
        <style>
            body { font-family: Arial, sans-serif; max-width: 900px; margin: 0 auto; padding: 20px; }
            .header { text-align: center; margin-bottom: 20px; }
            .status { padding: 15px; margin: 10px 0; border-radius: 8px; display: flex; justify-content: space-between; }
            .connected { background-color: #d4edda; color: #155724; }
            .disconnected { background-color: #f8d7da; color: #721c24; }
            .excel-info { background-color: #e7f3ff; color: #004085; }
            .chat-container { border: 2px solid #ddd; height: 400px; overflow-y: auto; padding: 15px; margin: 15px 0; border-radius: 8px; }
            .message { margin: 10px 0; padding: 12px; border-radius: 8px; white-space: pre-wrap; }
            .user { background-color: #007bff; color: white; text-align: right; margin-left: 20%; }
            .bot { background-color: #f8f9fa; border: 1px solid #e9ecef; margin-right: 20%; }
            .input-group { display: flex; gap: 10px; }
            input[type="text"] { flex: 1; padding: 12px; border: 1px solid #ddd; border-radius: 5px; }
            button { padding: 12px 20px; background-color: #007bff; color: white; border: none; cursor: pointer; border-radius: 5px; }
            button:hover { background-color: #0056b3; }
            .examples { background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin: 15px 0; }
            .price-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; margin: 15px 0; }
            .price-card { background: #fff; border: 1px solid #ddd; padding: 10px; border-radius: 5px; text-align: center; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>🖨️ ระบบคำนวณราคาถ่ายเอกสาร</h1>
            <p>รองรับการโหลดราคาจาก Excel และคำนวณราคาอัตโนมัติ</p>
        </div>
        
        <div class="status ${client ? 'connected' : 'disconnected'}">
            <span>LINE Bot: ${client ? '✅ เชื่อมต่อแล้ว' : '⚠️ ไม่ได้เชื่อมต่อ'}</span>
            <span>ราคา: ${Object.keys(priceData).length} รายการ</span>
        </div>
        
        <div class="excel-info status">
            <span>💡 วางไฟล์ Excel (prices.xlsx, ราคา.xlsx) ในโฟลเดอร์เดียวกับ app.js</span>
            <span>🔄 พิมพ์ "โหลดราคา" เพื่ออัพเดต</span>
        </div>
        
        <div class="examples">
            <h3>📋 ตัวอย่างการใช้งาน:</h3>
            <div class="price-grid">
                <div class="price-card">
                    <strong>A4 ขาวดำ หน้าเดียว 50 แผ่น</strong><br>
                    <small>ได้ผล: 50 × ราคา = ยอดรวม</small>
                </div>
                <div class="price-card">
                    <strong>A3 สี สองหน้า 20 แผ่น</strong><br>
                    <small>ได้ผล: 20 × ราคา = ยอดรวม</small>
                </div>
                <div class="price-card">
                    <strong>ตารางราคา</strong><br>
                    <small>แสดงราคาทั้งหมด</small>
                </div>
                <div class="price-card">
                    <strong>โหลดราคา</strong><br>
                    <small>อัพเดตจาก Excel</small>
                </div>
            </div>
        </div>
        
        <div class="chat-container" id="chatContainer">
            <div class="message bot">สวัสดีค่ะ! ยินดีให้บริการคำนวณราคาถ่ายเอกสาร 😊

💡 รองรับการโหลดราคาจาก Excel แล้ว!
📁 วางไฟล์ Excel ในโฟลเดอร์เดียวกัน
🔄 พิมพ์ "โหลดราคา" เพื่ออัพเดต

ลองถามเช่น:
• "A4 ขาวดำ หน้าเดียว 50 แผ่น"
• "A3 สี สองหน้า 20 แผ่น"
• "ตารางราคา" (ดูราคาทั้งหมด)</div>
        </div>
        
        <div class="input-group">
            <input type="text" id="messageInput" placeholder="พิมพ์คำถามของคุณ... (เช่น A4 ขาวดำ หน้าเดียว 10 แผ่น)" onkeypress="if(event.key==='Enter') sendMessage()">
            <button onclick="sendMessage()">ส่ง</button>
            <button onclick="loadPriceTable()">ตารางราคา</button>
            <button onclick="reloadPrices()">โหลดราคา</button>
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
            
            function loadPriceTable() {
                sendMessageText('ตารางราคา');
            }
            
            function reloadPrices() {
                sendMessageText('โหลดราคา');
            }
            
            function sendMessageText(text) {
                document.getElementById('messageInput').value = text;
                sendMessage();
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
        lineBot: client ? 'Connected' : 'Disconnected',
        priceEntries: Object.keys(priceData).length
    });
});

// Chat API
app.post('/chat', express.json(), (req, res) => {
    console.log('Received web message:', req.body.message);
    const result = parseMessage(req.body.message);
    console.log('Web response:', result.response);
    res.json({ reply: result.response });
});

// Reload prices API
app.post('/reload-prices', express.json(), (req, res) => {
    const loaded = loadPricesFromExcel();
    res.json({ 
        success: loaded, 
        message: loaded ? 'โหลดราคาจาก Excel สำเร็จ' : 'ไม่พบไฟล์ Excel',
        priceEntries: Object.keys(priceData).length
    });
});

// LINE Webhook
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
    console.log('- Excel Support: ✅ Ready');
    console.log('- Price Entries:', Object.keys(priceData).length);
});