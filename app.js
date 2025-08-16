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
const geminiApiKey = process.env.GEMINI_API_KEY;
const port = process.env.PORT || 3000;

console.log('Environment check:');
console.log('- LINE_CHANNEL_ACCESS_TOKEN:', channelAccessToken ? 'Set ✅' : 'Not set ❌');
console.log('- LINE_CHANNEL_SECRET:', channelSecret ? 'Set ✅' : 'Not set ❌');
console.log('- GEMINI_API_KEY:', geminiApiKey ? 'Set ✅' : 'Not set ❌');
console.log('- PORT:', port);

// LINE Bot Setup
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

// Price data storage
let priceData = {};
let priceList = [];

// Load prices from Excel
function loadPricesFromExcel() {
    try {
        const filePath = path.join(__dirname, 'prices.xlsx');
        
        if (!fs.existsSync(filePath)) {
            console.log('⚠️ prices.xlsx not found - using default prices');
            priceList = [
                { ขนาด: 'A4', ประเภท: 'ขาวดำ', รูปแบบ: 'หน้าเดียว', ราคา: 2 },
                { ขนาด: 'A4', ประเภท: 'ขาวดำ', รูปแบบ: 'หน้าหลัง', ราคา: 2.5 },
                { ขนาด: 'A4', ประเภท: 'สี', รูปแบบ: 'หน้าเดียว', ราคา: 3 },
                { ขนาด: 'A4', ประเภท: 'สี', รูปแบบ: 'หน้าหลัง', ราคา: 5 },
                { ขนาด: 'A3', ประเภท: 'ขาวดำ', รูปแบบ: 'หน้าเดียว', ราคา: 5 },
                { ขนาด: 'A3', ประเภท: 'ขาวดำ', รูปแบบ: 'หน้าหลัง', ราคา: 8 },
                { ขนาด: 'A3', ประเภท: 'สี', รูปแบบ: 'หน้าเดียว', ราคา: 12 },
                { ขนาด: 'A3', ประเภท: 'สี', รูปแบบ: 'หน้าหลัง', ราคา: 20 },
                { ขนาด: 'A5', ประเภท: 'ขาวดำ', รูปแบบ: 'หน้าเดียว', ราคา: 0.5 },
                { ขนาด: 'A5', ประเภท: 'ขาวดำ', รูปแบบ: 'หน้าหลัง', ราคา: 1 },
                { ขนาด: 'A5', ประเภท: 'สี', รูปแบบ: 'หน้าเดียว', ราคา: 3 },
                { ขนาด: 'A5', ประเภท: 'สี', รูปแบบ: 'หน้าหลัง', ราคา: 5 }
            ];
        } else {
            const workbook = XLSX.readFile(filePath);
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            priceList = XLSX.utils.sheet_to_json(worksheet);
            console.log('✅ Loaded prices from Excel:', priceList.length, 'items');
        }

        // Convert to object for faster lookup
        priceData = {};
        priceList.forEach(item => {
            const key = `${item.ขนาด}_${item.ประเภท}_${item.รูปแบบ}`;
            priceData[key] = item.ราคา;
        });

        console.log('Price data loaded:', Object.keys(priceData).length, 'entries');
        return true;

    } catch (error) {
        console.error('❌ Error loading Excel file:', error);
        return false;
    }
}

// Load prices on startup
loadPricesFromExcel();

// Business context for AI
function getBusinessContext() {
    let priceText = '';
    priceList.forEach(item => {
        priceText += `- ${item.ขนาด} ${item.ประเภท} ${item.รูปแบบ}: ${item.ราคา} บาท/แผ่น\n`;
    });

    return `คุณเป็นผู้ช่วย AI ของร้าน "It_Business" ร้านถ่ายเอกสารและปริ้นท์คุณภาพสูง

ข้อมูลร้าน:
- ชื่อร้าน: It_Business
- ที่อยู่: 136/2 หมู่10 ตำบลวัดประดู่ อ.เมือง จ.สุราษฎร์ธานี 84000
- โทร: 093-5799850
- Line: @kengprint
- เวลาทำการ: จันทร์-ศุกร์ 08:00-17:00, เสาร์ 09:00-17:00, อาทิตย์ ปิด

ราคาถ่ายเอกสาร:
${priceText}

โปรโมชั่น:
- 100 แผ่นขึ้นไป ลด 10%
- 500 แผ่นขึ้นไป ลด 15%
- 1000 แผ่นขึ้นไป ลด 20%

บริการอื่นๆ:
- เข้าเล่ม: 20-100 บาท
- สแกน: 3-5 บาท/หน้า
- ลามิเนต: 10-40 บาท
- พิมพ์ภาพ: 5-50 บาท

กรุณาตอบคำถามอย่างเป็นมิตร สุภาพ ใช้คำลงท้าย "ค่ะ" และใช้อีโมจิเมื่อเหมาะสม`;
}

// Calculate price function
function calculatePrice(paperSize, colorType, printType, sheets) {
    const key = `${paperSize}_${colorType}_${printType}`;
    const pricePerSheet = priceData[key];
    
    if (pricePerSheet !== undefined) {
        let totalPrice = pricePerSheet * sheets;
        let discount = 0;
        let discountText = '';
        
        if (sheets >= 1000) {
            discount = totalPrice * 0.20;
            discountText = ' (ลด 20%)';
        } else if (sheets >= 500) {
            discount = totalPrice * 0.15;
            discountText = ' (ลด 15%)';
        } else if (sheets >= 100) {
            discount = totalPrice * 0.10;
            discountText = ' (ลด 10%)';
        }
        
        const finalPrice = totalPrice - discount;
        
        let response = 'คำนวณราคา:\n';
        response += `- ${paperSize} ${colorType} ${printType}\n`;
        response += `- จำนวน: ${sheets} แผ่น\n`;
        response += `- ราคา: ${sheets} × ${pricePerSheet} = ${totalPrice.toFixed(2)} บาท\n`;
        
        if (discount > 0) {
            response += `- ส่วนลด${discountText}: -${discount.toFixed(2)} บาท\n`;
            response += `- ราคาสุทธิ: ${finalPrice.toFixed(2)} บาท`;
        } else {
            response += `- ราคารวม: ${totalPrice.toFixed(2)} บาท`;
        }
        
        return {
            success: true,
            response: response
        };
    }
    
    return { 
        success: false, 
        response: 'ไม่พบข้อมูลราคาสำหรับรายการนี้ กรุณาตรวจสอบข้อมูลอีกครั้ง'
    };
}

// Call Gemini AI
async function callGeminiAI(userMessage) {
    if (!geminiApiKey) {
        return {
            success: false,
            message: 'ขออภัยค่ะ AI ไม่พร้อมใช้งาน'
        };
    }

    try {
        const fetch = (await import('node-fetch')).default;
        
        const prompt = `${getBusinessContext()}\n\nลูกค้าถาม: ${userMessage}\n\nตอบ:`;
        
        const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + geminiApiKey, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 500,
                }
            })
        });

        if (!response.ok) {
            throw new Error('API request failed');
        }

        const data = await response.json();
        
        if (data.candidates && data.candidates[0]) {
            return {
                success: true,
                message: data.candidates[0].content.parts[0].text
            };
        }
        
        throw new Error('Invalid response');

    } catch (error) {
        console.error('Gemini AI Error:', error);
        return {
            success: false,
            message: 'ขออภัยค่ะ เกิดข้อผิดพลาด กรุณาลองใหม่'
        };
    }
}

// Parse message
async function parseMessage(message) {
    const text = message.toLowerCase();
    
    // Price list request
    if (text.includes('ราคา') && (text.includes('ตาราง') || text.includes('ทั้งหมด'))) {
        return {
            type: 'price_list',
            response: generatePriceTable()
        };
    }

    // Price calculation
    const hasNumber = /\d+/.test(message);
    const paperSizes = {
        'a3': 'A3', 'a4': 'A4', 'a5': 'A5'
    };
    
    let detectedSize = null;
    for (let [key, value] of Object.entries(paperSizes)) {
        if (text.includes(key)) {
            detectedSize = value;
            break;
        }
    }
    
    if (hasNumber && detectedSize) {
        let colorType = text.includes('สี') ? 'สี' : 'ขาวดำ';
        let printType = text.includes('หลัง') || text.includes('สองหน้า') ? 'หน้าหลัง' : 'หน้าเดียว';
        
        const numbers = message.match(/\d+/g);
        const sheets = Math.max(...numbers.map(n => parseInt(n)));
        
        if (sheets > 0) {
            const result = calculatePrice(detectedSize, colorType, printType, sheets);
            return {
                type: 'price',
                response: result.response
            };
        }
    }

    // AI response
    const aiResult = await callGeminiAI(message);
    return {
        type: 'ai',
        response: aiResult.success ? aiResult.message : 'สวัสดีค่ะ! ยินดีให้บริการ It-Business ค่ะ มีอะไรให้ช่วยไหมคะ?'
    };
}

// Generate price table
function generatePriceTable() {
    let table = 'ตารางราคาถ่ายเอกสาร\n\n';
    
    const sizes = ['A3', 'A4', 'A5'];
    sizes.forEach(size => {
        const items = priceList.filter(item => item.ขนาด === size);
        if (items.length > 0) {
            table += `${size}:\n`;
            items.forEach(item => {
                table += `• ${item.ประเภท} ${item.รูปแบบ}: ${item.ราคา} บาท\n`;
            });
            table += '\n';
        }
    });
    
    table += 'โปรโมชั่น:\n';
    table += '• 100+ แผ่น ลด 10%\n';
    table += '• 500+ แผ่น ลด 15%\n';
    table += '• 1000+ แผ่น ลด 20%';
    
    return table;
}

// Web interface
app.get('/', (req, res) => {
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>IT-Business - Chatbot</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            
            body { 
                font-family: 'Segoe UI', sans-serif; 
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
                padding: 20px;
            }
            
            .container {
                max-width: 1200px;
                margin: 0 auto;
                background: white;
                border-radius: 20px;
                padding: 30px;
                box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            }
            
            .header { 
                text-align: center; 
                margin-bottom: 30px;
                padding-bottom: 20px;
                border-bottom: 2px solid #f0f0f0;
            }
            
            .header h1 { 
                color: #2c3e50; 
                font-size: 2.5em;
                margin-bottom: 10px;
            }
            
            .status-grid { 
                display: grid; 
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); 
                gap: 15px; 
                margin: 30px 0; 
            }
            
            .status { 
                padding: 20px; 
                border-radius: 15px; 
                text-align: center;
                color: white;
                font-weight: bold;
            }
            
            .connected { background: linear-gradient(135deg, #56ab2f, #a8e6cf); }
            .disconnected { background: linear-gradient(135deg, #ff416c, #ff4b2b); }
            .ai-ready { background: linear-gradient(135deg, #4facfe, #00f2fe); }
            .excel-info { background: linear-gradient(135deg, #fa709a, #fee140); }
            
            .chat-container { 
                height: 400px; 
                overflow-y: auto; 
                padding: 20px; 
                margin: 20px 0; 
                border-radius: 15px; 
                background: #f8f9fa;
                border: 1px solid #dee2e6;
            }
            
            .message { 
                margin: 10px 0; 
                padding: 12px 18px; 
                border-radius: 18px; 
                max-width: 70%; 
                animation: fadeIn 0.3s;
            }
            
            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(10px); }
                to { opacity: 1; transform: translateY(0); }
            }
            
            .user { 
                background: linear-gradient(135deg, #667eea, #764ba2); 
                color: white; 
                margin-left: auto; 
                text-align: right;
            }
            
            .bot { 
                background: white; 
                border: 1px solid #dee2e6;
                margin-right: auto;
            }
            
            .input-group { 
                display: flex; 
                gap: 10px; 
                padding: 20px; 
                background: white;
                border-radius: 15px; 
                border: 1px solid #dee2e6;
            }
            
            input[type="text"] { 
                flex: 1; 
                padding: 12px 20px; 
                border: 2px solid #dee2e6; 
                border-radius: 25px; 
                font-size: 16px; 
                outline: none;
            }
            
            input[type="text"]:focus { 
                border-color: #667eea; 
            }
            
            button { 
                padding: 12px 30px; 
                background: linear-gradient(135deg, #667eea, #764ba2); 
                color: white; 
                border: none; 
                cursor: pointer; 
                border-radius: 25px; 
                font-weight: bold;
                transition: transform 0.2s;
            }
            
            button:hover { 
                transform: scale(1.05);
            }
            
            .examples { 
                margin: 20px 0; 
                padding: 20px;
                background: #f8f9fa;
                border-radius: 15px;
            }
            
            .example-buttons { 
                display: flex; 
                gap: 10px; 
                flex-wrap: wrap;
                margin-top: 10px;
            }
            
            .example-btn { 
                padding: 8px 16px; 
                background: white;
                border: 2px solid #667eea;
                color: #667eea;
                border-radius: 20px; 
                cursor: pointer;
                transition: all 0.2s;
            }
            
            .example-btn:hover { 
                background: #667eea;
                color: white;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>It-Business</h1>
                <p>ระบบถ่ายเอกสารอัจฉริยะ พร้อม AI Assistant</p>
            </div>
            
            <div class="status-grid">
                <div class="status ${client ? 'connected' : 'disconnected'}">
                    LINE Bot<br>
                    ${client ? 'เชื่อมต่อแล้ว' : 'ไม่ได้เชื่อมต่อ'}
                </div>
                <div class="status ${geminiApiKey ? 'ai-ready' : 'disconnected'}">
                    Gemini AI<br>
                    ${geminiApiKey ? 'พร้อมใช้งาน' : 'ไม่พร้อม'}
                </div>
                <div class="status excel-info">
                    ราคา Excel<br>
                    ${priceList.length} รายการ
                </div>
                <div class="status connected">
                    เวลาทำการ<br>
                    08:00-19:00
                </div>
            </div>
            
            <div class="examples">
                <strong>ตัวอย่างคำถาม:</strong>
                <div class="example-buttons">
                    <button class="example-btn" onclick="sendExample('A4 ขาวดำ 100 แผ่น')">A4 ขาวดำ 100 แผ่น</button>
                    <button class="example-btn" onclick="sendExample('ตารางราคา')">ตารางราคา</button>
                    <button class="example-btn" onclick="sendExample('ร้านเปิดกี่โมง')">เวลาทำการ</button>
                    <button class="example-btn" onclick="sendExample('มีบริการอะไรบ้าง')">บริการ</button>
                </div>
            </div>
            
            <div class="chat-container" id="chat">
                <div class="message bot">สวัสดีค่ะ! ยินดีต้อนรับสู่ It-Business ค่ะ<br>มีอะไรให้ช่วยไหมคะ?</div>
            </div>
            
            <div class="input-group">
                <input type="text" id="input" placeholder="พิมพ์ข้อความ..." onkeypress="if(event.key==='Enter') send()">
                <button onclick="send()">ส่ง</button>
            </div>
        </div>

        <script>
            function addMessage(text, isUser) {
                const chat = document.getElementById('chat');
                const div = document.createElement('div');
                div.className = 'message ' + (isUser ? 'user' : 'bot');
                div.innerHTML = text.replace(/\\n/g, '<br>');
                chat.appendChild(div);
                chat.scrollTop = chat.scrollHeight;
            }

            async function send() {
                const input = document.getElementById('input');
                const text = input.value.trim();
                if (!text) return;

                addMessage(text, true);
                input.value = '';

                try {
                    const response = await fetch('/chat', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ message: text })
                    });
                    
                    const data = await response.json();
                    addMessage(data.reply || 'ขออภัย เกิดข้อผิดพลาด', false);
                } catch (error) {
                    addMessage('ไม่สามารถเชื่อมต่อได้ กรุณาลองใหม่', false);
                }
            }
            
            function sendExample(text) {
                document.getElementById('input').value = text;
                send();
            }
        </script>
    </body>
    </html>
    `;
    
    res.send(html);
});

// Chat API
app.post('/chat', express.json(), async (req, res) => {
    try {
        const result = await parseMessage(req.body.message);
        res.json({ reply: result.response });
    } catch (error) {
        console.error('Chat error:', error);
        res.json({ reply: 'ขออภัยค่ะ เกิดข้อผิดพลาด' });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK',
        prices: priceList.length,
        ai: geminiApiKey ? 'ready' : 'not configured'
    });
});

// Price API
app.get('/api/prices', (req, res) => {
    res.json(priceList);
});

// LINE webhook
if (client && lineConfig) {
    app.post('/webhook', line.middleware(lineConfig), async (req, res) => {
        try {
            await Promise.all(req.body.events.map(handleLineEvent));
            res.json({ success: true });
        } catch (err) {
            console.error('LINE error:', err);
            res.status(500).end();
        }
    });

    async function handleLineEvent(event) {
        if (event.type !== 'message' || event.message.type !== 'text') {
            return null;
        }

        const result = await parseMessage(event.message.text);
        
        return client.replyMessage(event.replyToken, {
            type: 'text',
            text: result.response
        });
    }
} else {
    app.post('/webhook', (req, res) => {
        res.json({ message: 'LINE not configured' });
    });
}

// Start server
app.listen(port, () => {
    console.log(`
========================================
     It-Business Chatbot Started!
========================================
🚀 Server: http://localhost:${port}
📊 Prices: ${priceList.length} items loaded
🤖 AI: ${geminiApiKey ? 'Ready' : 'Not configured'}
📱 LINE: ${client ? 'Connected' : 'Not configured'}
========================================
    `);
});
