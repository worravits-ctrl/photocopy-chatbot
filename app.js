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
            
            // Debug: แสดงข้อมูลตัวอย่าง
            if (priceList.length > 0) {
                console.log('Sample data:', priceList[0]);
                console.log('Available columns:', Object.keys(priceList[0]));
            }
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

// Get current date and time info
function getCurrentDateInfo() {
    const now = new Date();
    const options = { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        timeZone: 'Asia/Bangkok'
    };
    const thaiDate = now.toLocaleDateString('th-TH', options);
    const time = now.toLocaleTimeString('th-TH', { 
        hour: '2-digit', 
        minute: '2-digit',
        timeZone: 'Asia/Bangkok'
    });
    
    // Check if shop is open
    const hour = now.getHours();
    const day = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    let isOpen = false;
    
    if (day >= 1 && day <= 5) { // Monday to Friday
        isOpen = hour >= 8 && hour < 17;
    } else if (day === 6) { // Saturday
        isOpen = hour >= 9 && hour < 17;
    } // Sunday is closed
    
    return {
        date: thaiDate,
        time: time,
        isOpen: isOpen,
        day: day
    };
}

// Business context for AI
function getBusinessContext() {
    let priceText = '';
    priceList.forEach(item => {
        priceText += `- ${item.ขนาด} ${item.ประเภท} ${item.รูปแบบ}: ${item.ราคา} บาท/แผ่น\n`;
    });

    const dateInfo = getCurrentDateInfo();
    const shopStatus = dateInfo.isOpen ? '🟢 ร้านเปิดอยู่' : '🔴 ร้านปิด';

    return `คุณเป็นผู้ช่วย AI ของร้าน "It_Business" ร้านถ่ายเอกสารและปริ้นท์คุณภาพสูง

ข้อมูลวันเวลาปัจจุบัน:
- วันที่: ${dateInfo.date}
- เวลา: ${dateInfo.time} น.
- สถานะร้าน: ${shopStatus}

ข้อมูลร้าน:
- ชื่อร้าน: It_Business
- ที่อยู่: 136/2 หมู่10 ตำบลวัดประดู่ อ.เมือง จ.สุราษฎร์ธานี 84000
- โทร: 093-5799850
- Line: id เบอร์ร้าน
- เวลาทำการ: จันทร์-ศุกร์ 08:00-17:00, เสาร์ 09:00-17:00, อาทิตย์ ปิด
- เจ้าของร้าน: พี่เวฟ
- พ่อเจ้าของร้าน: ลุงเดียร์
- ใกล้โรงแรม: Thehub
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
        
        let response = 'คำนวดราคา:\n';
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
    
    // Date/time queries
    if (text.includes('วันนี้') || text.includes('วันอะไร') || text.includes('กี่โมง') || text.includes('เวลา')) {
        const dateInfo = getCurrentDateInfo();
        let response = `📅 วันที่: ${dateInfo.date}\n⏰ เวลา: ${dateInfo.time} น.\n`;
        
        if (text.includes('เปิด') || text.includes('ปิด') || text.includes('ทำการ')) {
            response += `🏪 สถานะร้าน: ${dateInfo.isOpen ? '🟢 ร้านเปิดอยู่' : '🔴 ร้านปิด'}\n`;
            response += `📋 เวลาทำการ: จันทร์-ศุกร์ 08:00-17:00, เสาร์ 09:00-17:00, อาทิตย์ ปิด`;
        }
        
        return {
            type: 'datetime',
            response: response
        };
    }
    
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

// Generate price table - แก้ไขส่วนนี้
function generatePriceTable() {
    if (!priceList || priceList.length === 0) {
        return 'ไม่พบข้อมูลราคา กรุณาติดต่อเจ้าหน้าที่ค่ะ';
    }

    let table = '📋 ตารางราคาถ่ายเอกสาร\n\n';
    
    // จัดเรียงข้อมูลตาม ขนาด -> ประเภท -> รูปแบบ
    const sortedData = priceList.sort((a, b) => {
        if (a.ขนาด !== b.ขนาด) {
            return a.ขนาด.localeCompare(b.ขนาด);
        }
        if (a.ประเภท !== b.ประเภท) {
            return a.ประเภท.localeCompare(b.ประเภท);
        }
        return a.รูปแบบ.localeCompare(b.รูปแบบ);
    });
    
    let currentSize = '';
    
    sortedData.forEach(item => {
        const size = item.ขนาด;
        const type = item.ประเภท;
        const format = item.รูปแบบ;
        const price = item.ราคา;
        
        // แสดงขนาดกระดาษใหม่
        if (size !== currentSize) {
            if (currentSize !== '') table += '\n';
            table += `${size}:\n`;
            currentSize = size;
        }
        
        table += `• ${type} ${format}: ${price} บาท\n`;
    });

    // เพิ่มโปรโมชั่น
    table += '\n🎉 โปรโมชั่น:\n';
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
        <title>It-Business - Smart Document Center</title>
        <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            
            :root {
                --primary: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                --secondary: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
                --success: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
                --warning: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
                --danger: linear-gradient(135deg, #ff416c 0%, #ff4b2b 100%);
                --glass: rgba(255,255,255,0.1);
                --shadow: 0 20px 40px rgba(0,0,0,0.1);
            }
            
            body { 
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
                background: var(--primary);
                min-height: 100vh;
                overflow-x: hidden;
            }
            
            /* Status Bar */
            .status-bar {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                z-index: 1000;
                background: rgba(0,0,0,0.8);
                backdrop-filter: blur(10px);
                padding: 8px 20px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                font-size: 12px;
                color: white;
            }
            
            .status-item {
                display: flex;
                align-items: center;
                gap: 5px;
            }
            
            .status-dot {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                animation: pulse 2s infinite;
            }
            
            .status-connected { background: #00ff00; }
            .status-disconnected { background: #ff0000; }
            
            @keyframes pulse {
                0% { opacity: 1; }
                50% { opacity: 0.5; }
                100% { opacity: 1; }
            }
            
            /* Main Container */
            .container {
                max-width: 1400px;
                margin: 0 auto;
                padding: 60px 20px 20px;
                min-height: 100vh;
                display: grid;
                grid-template-columns: 300px 1fr;
                gap: 20px;
            }
            
            /* Sidebar */
            .sidebar {
                background: var(--glass);
                backdrop-filter: blur(20px);
                border-radius: 20px;
                padding: 20px;
                box-shadow: var(--shadow);
                border: 1px solid rgba(255,255,255,0.2);
                height: fit-content;
                position: sticky;
                top: 80px;
            }
            
            .logo {
                text-align: center;
                margin-bottom: 30px;
                padding: 20px;
                background: white;
                border-radius: 15px;
                box-shadow: var(--shadow);
            }
            
            .logo h1 {
                background: var(--primary);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                font-size: 2em;
                margin-bottom: 5px;
            }
            
            .logo p {
                color: #666;
                font-size: 14px;
            }
            
            .menu-section {
                margin-bottom: 25px;
            }
            
            .menu-title {
                color: white;
                font-weight: bold;
                margin-bottom: 15px;
                font-size: 16px;
                display: flex;
                align-items: center;
                gap: 10px;
            }
            
            .menu-btn {
                width: 100%;
                padding: 12px 15px;
                margin-bottom: 8px;
                background: rgba(255,255,255,0.1);
                border: none;
                border-radius: 12px;
                color: white;
                cursor: pointer;
                transition: all 0.3s;
                display: flex;
                align-items: center;
                gap: 10px;
                font-size: 14px;
                backdrop-filter: blur(10px);
            }
            
            .menu-btn:hover {
                background: rgba(255,255,255,0.2);
                transform: translateY(-2px);
                box-shadow: 0 10px 20px rgba(0,0,0,0.2);
            }
            
            .menu-btn.active {
                background: white;
                color: #667eea;
                font-weight: bold;
            }
            
            /* Main Content */
            .main-content {
                background: white;
                border-radius: 20px;
                box-shadow: var(--shadow);
                overflow: hidden;
                display: flex;
                flex-direction: column;
                min-height: calc(100vh - 120px);
            }
            
            .chat-header {
                background: var(--primary);
                color: white;
                padding: 20px;
                text-align: center;
            }
            
            .chat-header h2 {
                font-size: 24px;
                margin-bottom: 5px;
            }
            
            .chat-header p {
                opacity: 0.9;
            }
            
            .chat-container { 
                flex: 1;
                padding: 20px;
                overflow-y: auto;
                background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
                position: relative;
            }
            
            .message { 
                margin: 15px 0; 
                padding: 15px 20px; 
                border-radius: 20px; 
                max-width: 80%; 
                animation: fadeIn 0.5s ease-out;
                position: relative;
            }
            
            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(20px); }
                to { opacity: 1; transform: translateY(0); }
            }
            
            .user { 
                background: var(--primary);
                color: white; 
                margin-left: auto; 
                border-bottom-right-radius: 5px;
                box-shadow: 0 10px 30px rgba(102, 126, 234, 0.3);
            }
            
            .bot { 
                background: white;
                border: 1px solid #e9ecef;
                margin-right: auto;
                border-bottom-left-radius: 5px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.1);
            }
            
            .bot::before {
                content: '🤖';
                position: absolute;
                left: -30px;
                top: 15px;
                font-size: 20px;
            }
            
            .input-section {
                padding: 20px;
                background: white;
                border-top: 1px solid #e9ecef;
            }
            
            .input-group { 
                display: flex; 
                gap: 15px; 
                align-items: center;
            }
            
            input[type="text"] { 
                flex: 1; 
                padding: 15px 25px; 
                border: 2px solid #e9ecef; 
                border-radius: 25px; 
                font-size: 16px; 
                outline: none;
                transition: all 0.3s;
            }
            
            input[type="text"]:focus { 
                border-color: #667eea;
                box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
            }
            
            .send-btn { 
                padding: 15px 25px; 
                background: var(--primary);
                color: white; 
                border: none; 
                cursor: pointer; 
                border-radius: 25px; 
                font-weight: bold;
                transition: all 0.3s;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            
            .send-btn:hover { 
                transform: translateY(-2px);
                box-shadow: 0 15px 30px rgba(102, 126, 234, 0.4);
            }
            
            /* Quick Actions */
            .quick-actions {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 15px;
                padding: 20px;
                background: #f8f9fa;
            }
            
            .quick-btn {
                padding: 15px;
                background: white;
                border: 2px solid #e9ecef;
                border-radius: 15px;
                cursor: pointer;
                transition: all 0.3s;
                text-align: center;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 10px;
            }
            
            .quick-btn:hover {
                border-color: #667eea;
                transform: translateY(-3px);
                box-shadow: 0 15px 30px rgba(0,0,0,0.1);
            }
            
            .quick-btn i {
                font-size: 24px;
                color: #667eea;
            }
            
            .quick-btn span {
                font-weight: 500;
                color: #333;
            }
            
            /* Mobile Responsive */
            @media (max-width: 768px) {
                .container {
                    grid-template-columns: 1fr;
                    padding: 60px 10px 10px;
                }
                
                .sidebar {
                    position: relative;
                    top: 0;
                    order: 2;
                }
                
                .status-bar {
                    font-size: 10px;
                    padding: 5px 10px;
                }
                
                .quick-actions {
                    grid-template-columns: repeat(2, 1fr);
                }
            }
            
            /* Loading Animation */
            .typing {
                display: inline-block;
                width: 20px;
                height: 20px;
            }
            
            .typing::after {
                content: '●●●';
                animation: typing 1.4s infinite;
                color: #999;
            }
            
            @keyframes typing {
                0% { content: '●○○'; }
                33% { content: '●●○'; }
                66% { content: '●●●'; }
                100% { content: '●○○'; }
            }
        </style>
    </head>
    <body>
        <!-- Status Bar -->
        <div class="status-bar">
            <div style="display: flex; gap: 20px;">
                <div class="status-item">
                    <div class="status-dot ${client ? 'status-connected' : 'status-disconnected'}"></div>
                    <span>LINE Bot</span>
                </div>
                <div class="status-item">
                    <div class="status-dot ${geminiApiKey ? 'status-connected' : 'status-disconnected'}"></div>
                    <span>Gemini AI</span>
                </div>
            </div>
            <div class="status-item">
                <i class="fas fa-database"></i>
                <span>${priceList.length} ราคา</span>
            </div>
        </div>

        <div class="container">
            <!-- Sidebar -->
            <div class="sidebar">
                <div class="logo">
                    <h1><i class="fas fa-print"></i> It-Business</h1>
                    <p>Smart Document Center</p>
                </div>

                <div class="menu-section">
                    <div class="menu-title">
                        <i class="fas fa-calculator"></i> คำนวณราคา
                    </div>
                    <button class="menu-btn" onclick="sendQuickMessage('A4 ขาวดำ หน้าเดียว 50 แผ่น')">
                        <i class="fas fa-file-alt"></i> A4 ขาวดำ 50 แผ่น
                    </button>
                    <button class="menu-btn" onclick="sendQuickMessage('A4 สี หน้าหลัง 100 แผ่น')">
                        <i class="fas fa-palette"></i> A4 สี 100 แผ่น
                    </button>
                    <button class="menu-btn" onclick="sendQuickMessage('A3 ขาวดำ หน้าเดียว 20 แผ่น')">
                        <i class="fas fa-expand"></i> A3 ขาวดำ 20 แผ่น
                    </button>
                </div>

                <div class="menu-section">
                    <div class="menu-title">
                        <i class="fas fa-list"></i> ข้อมูลร้าน
                    </div>
                    <button class="menu-btn" onclick="sendQuickMessage('ตารางราคาทั้งหมด')">
                        <i class="fas fa-table"></i> ตารางราคา
                    </button>
                    <button class="menu-btn" onclick="sendQuickMessage('เวลาทำการ')">
                        <i class="fas fa-clock"></i> เวลาทำการ
                    </button>
                    <button class="menu-btn" onclick="sendQuickMessage('ที่อยู่ร้าน')">
                        <i class="fas fa-map-marker-alt"></i> ที่อยู่ร้าน
                    </button>
                    <button class="menu-btn" onclick="sendQuickMessage('โทรศัพท์')">
                        <i class="fas fa-phone"></i> เบอร์โทร
                    </button>
                </div>

                <div class="menu-section">
                    <div class="menu-title">
                        <i class="fas fa-tools"></i> บริการอื่นๆ
                    </div>
                    <button class="menu-btn" onclick="sendQuickMessage('ราคาเข้าเล่ม')">
                        <i class="fas fa-book"></i> เข้าเล่ม
                    </button>
                    <button class="menu-btn" onclick="sendQuickMessage('ราคาสแกน')">
                        <i class="fas fa-scanner"></i> สแกน
                    </button>
                    <button class="menu-btn" onclick="sendQuickMessage('ราคาลามิเนต')">
                        <i class="fas fa-layer-group"></i> ลามิเนต
                    </button>
                    <button class="menu-btn" onclick="sendQuickMessage('ราคาพิมพ์ภาพ')">
                        <i class="fas fa-image"></i> พิมพ์ภาพ
                    </button>
                </div>
            </div>

            <!-- Main Content -->
            <div class="main-content">
                <div class="chat-header">
                    <h2>🤖 AI Assistant</h2>
                    <p>ยินดีให้บริการข้อมูลและคำนวณราคา</p>
                </div>

                <div class="quick-actions">
                    <div class="quick-btn" onclick="sendQuickMessage('วันนี้วันอะไร')">
                        <i class="fas fa-calendar-day"></i>
                        <span>วันนี้วันอะไร</span>
                    </div>
                    <div class="quick-btn" onclick="sendQuickMessage('ร้านเปิดหรือยัง')">
                        <i class="fas fa-store"></i>
                        <span>สถานะร้าน</span>
                    </div>
                    <div class="quick-btn" onclick="sendQuickMessage('โปรโมชั่น')">
                        <i class="fas fa-tags"></i>
                        <span>โปรโมชั่น</span>
                    </div>
                    <div class="quick-btn" onclick="sendQuickMessage('มีบริการอะไรบ้าง')">
                        <i class="fas fa-concierge-bell"></i>
                        <span>บริการทั้งหมด</span>
                    </div>
                </div>

                <div class="chat-container" id="chat">
                    <div class="message bot">
                        สวัสดีค่ะ! 👋 ยินดีต้อนรับสู่ It-Business<br>
                        ระบบถ่ายเอกสารอัจฉริยะ พร้อมให้บริการคำนวณราคาและข้อมูลต่างๆ ค่ะ<br><br>
                        <strong>🎯 ลองคลิกเมนูด้านซ้าย หรือปุ่มด้านบนเพื่อเริ่มต้น!</strong>
                    </div>
                </div>

                <div class="input-section">
                    <div class="input-group">
                        <input type="text" id="input" placeholder="💬 พิมพ์คำถามของคุณ..." onkeypress="if(event.key==='Enter') send()">
                        <button class="send-btn" onclick="send()">
                            <i class="fas fa-paper-plane"></i>
                            ส่ง
                        </button>
                    </div>
                </div>
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

            function showTyping() {
                const chat = document.getElementById('chat');
                const div = document.createElement('div');
                div.className = 'message bot';
                div.id = 'typing-indicator';
                div.innerHTML = '<div class="typing"></div> กำลังพิมพ์...';
                chat.appendChild(div);
                chat.scrollTop = chat.scrollHeight;
            }

            function removeTyping() {
                const typing = document.getElementById('typing-indicator');
                if (typing) typing.remove();
            }

            async function send() {
                const input = document.getElementById('input');
                const text = input.value.trim();
                if (!text) return;

                addMessage(text, true);
                input.value = '';
                showTyping();

                try {
                    const response = await fetch('/chat', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ message: text })
                    });
                    
                    const data = await response.json();
                    removeTyping();
                    addMessage(data.reply || '❌ ขออภัย เกิดข้อผิดพลาด', false);
                } catch (error) {
                    removeTyping();
                    addMessage('🔌 ไม่สามารถเชื่อมต่อได้ กรุณาลองใหม่ในภายหลัง', false);
                }
            }
            
            function sendQuickMessage(text) {
                document.getElementById('input').value = text;
                send();
            }

            // Auto-focus input
            document.getElementById('input').focus();
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
