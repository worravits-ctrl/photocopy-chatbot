require('dotenv').config();
process.env.TZ = 'Asia/Bangkok';

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

// ========== เพิ่มระบบจำการสนทนา ==========
// Memory storage for conversations
const conversationMemory = new Map();
const MAX_HISTORY_MESSAGES = 5;
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

// Function to add message to memory
function addToMemory(sessionId, message, isUser = true) {
    if (!conversationMemory.has(sessionId)) {
        conversationMemory.set(sessionId, {
            messages: [],
            lastActivity: Date.now()
        });
    }
    
    const session = conversationMemory.get(sessionId);
    session.messages.push({
        text: message,
        isUser: isUser,
        timestamp: Date.now()
    });
    
    // Keep only the last MAX_HISTORY_MESSAGES pairs (user + AI)
    const maxMessages = MAX_HISTORY_MESSAGES * 2;
    if (session.messages.length > maxMessages) {
        session.messages = session.messages.slice(-maxMessages);
    }
    
    session.lastActivity = Date.now();
    
    // Clean up expired sessions
    cleanupExpiredSessions();
}

// Function to get conversation history
function getConversationHistory(sessionId) {
    const session = conversationMemory.get(sessionId);
    if (!session) return '';
    
    // Check if session is expired
    if (Date.now() - session.lastActivity > SESSION_TIMEOUT) {
        conversationMemory.delete(sessionId);
        return '';
    }
    
    if (session.messages.length === 0) return '';
    
    let historyText = '\n\nประวัติการสนทนาล่าสุด:\n';
    session.messages.forEach((msg, index) => {
        const speaker = msg.isUser ? 'ลูกค้า' : 'AI';
        historyText += `${speaker}: ${msg.text}\n`;
    });
    historyText += '\nกรุณาใช้ประวัติการสนทนาข้างต้นเพื่อตอบให้เหมาะสมและต่อเนื่อง\n';
    
    return historyText;
}

// Function to reset conversation
function resetConversation(sessionId) {
    conversationMemory.delete(sessionId);
    console.log(`🔄 Reset conversation for session: ${sessionId}`);
}

// Function to clean up expired sessions
function cleanupExpiredSessions() {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [sessionId, session] of conversationMemory.entries()) {
        if (now - session.lastActivity > SESSION_TIMEOUT) {
            conversationMemory.delete(sessionId);
            cleanedCount++;
        }
    }
    
    if (cleanedCount > 0) {
        console.log(`🧹 Cleaned up ${cleanedCount} expired conversation sessions`);
    }
}

// Get session ID for different sources
function getSessionId(source, userId = null) {
    if (source === 'web') {
        return 'web-session';
    } else if (source === 'line' && userId) {
        return `line-${userId}`;
    }
    return `unknown-${Date.now()}`;
}

// ========== จบส่วนระบบจำการสนทนา ==========

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
    
    // ใช้ Intl.DateTimeFormat สำหรับเวลาไทย
    const thaiFormatter = new Intl.DateTimeFormat('th-TH', {
        timeZone: 'Asia/Bangkok',
        year: 'numeric',
        month: 'long', 
        day: 'numeric',
        weekday: 'long'
    });
    
    // ดึงเวลาไทยแบบ parts
    const thaiTimeParts = new Intl.DateTimeFormat('en', {
        timeZone: 'Asia/Bangkok',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    }).formatToParts(now);
    
    // แปลงเป็นตัวเลข
    const hour = parseInt(thaiTimeParts.find(part => part.type === 'hour').value);
    const minute = parseInt(thaiTimeParts.find(part => part.type === 'minute').value);
    const year = parseInt(thaiTimeParts.find(part => part.type === 'year').value);
    const month = parseInt(thaiTimeParts.find(part => part.type === 'month').value);
    const day_num = parseInt(thaiTimeParts.find(part => part.type === 'day').value);
    
    // สร้าง Date object สำหรับเวลาไทย
    const bangkokTime = new Date(year, month - 1, day_num, hour, minute);
    const day = bangkokTime.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    const thaiDate = thaiFormatter.format(now);
    const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    
    // ตรวจสอบสถานะร้าน
    let isOpen = false;
    let shopHours = '';
    
    if (day >= 1 && day <= 5) { // Monday to Friday (จันทร์-ศุกร์)
        // เวลา 08:00-17:00
        isOpen = (hour >= 8 && hour < 17);
        shopHours = '08:00-17:00';
    } else if (day === 6) { // Saturday (เสาร์)
        // เวลา 09:00-17:00
        isOpen = (hour >= 9 && hour < 17);
        shopHours = '09:00-17:00';
    } else { // Sunday (อาทิตย์)
        isOpen = false;
        shopHours = 'ปิด';
    }
    
    // Debug log เพื่อตรวจสอบ
    console.log(`=== Debug Shop Hours ===
        Server Time: ${now.toISOString()}
        Server Local: ${now.toString()}
        Thai Time Parts: ${JSON.stringify(thaiTimeParts)}
        Calculated Thai Time: ${year}-${month.toString().padStart(2,'0')}-${day_num.toString().padStart(2,'0')} ${hour.toString().padStart(2,'0')}:${minute.toString().padStart(2,'0')}
        Day of week: ${day} (0=Sun, 1=Mon, ..., 6=Sat)
        Should be open: ${isOpen}
        Shop hours today: ${shopHours}
        Display time: ${time}
    ========================`);
    
    return {
        date: thaiDate,
        time: time,
        isOpen: isOpen,
        day: day,
        hour: hour,
        minute: minute,
        shopHours: shopHours
    };
}

// เพิ่มฟังก์ชันใหม่นี้หลังจาก getCurrentDateInfo()
function getDetailedShopStatus() {
    const dateInfo = getCurrentDateInfo();
    const dayNames = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
    const currentDay = dayNames[dateInfo.day];
    
    let statusMessage = '';
    let nextOpenTime = '';
    
    if (dateInfo.isOpen) {
        // ร้านเปิดอยู่
        let closeTime = '';
        if (dateInfo.day >= 1 && dateInfo.day <= 6) {
            closeTime = '17:00';
        }
        statusMessage = `🟢 ร้านเปิดอยู่ (ปิดเวลา ${closeTime} น.)`;
    } else {
        // ร้านปิด - คำนวณเวลาเปิดครั้งต่อไป
        if (dateInfo.day === 0) { // อาทิตย์
            nextOpenTime = 'จันทร์ 08:00 น.';
        } else if (dateInfo.day === 6 && dateInfo.hour >= 17) { // เสาร์หลัง 17:00
            nextOpenTime = 'จันทร์ 08:00 น.';
        } else if (dateInfo.day >= 1 && dateInfo.day <= 5) {
            // จันทร์-ศุกร์
            if (dateInfo.hour < 8) {
                nextOpenTime = `วันนี้ 08:00 น.`;
            } else {
                nextOpenTime = 'พรุ่งนี้ 08:00 น.';
            }
        } else if (dateInfo.day === 6) {
            // เสาร์
            if (dateInfo.hour < 9) {
                nextOpenTime = `วันนี้ 09:00 น.`;
            } else {
                nextOpenTime = 'จันทร์ 08:00 น.';
            }
        }
        statusMessage = `🔴 ร้านปิด (เปิดอีกครั้ง: ${nextOpenTime})`;
    }
    
    return {
        ...dateInfo,
        currentDay: currentDay,
        statusMessage: statusMessage,
        nextOpenTime: nextOpenTime
    };
}

// ปรับปรุงฟังก์ชัน getBusinessContext() ให้รวมประวัติการสนทนา
function getBusinessContext(sessionId = null) {
    let priceText = '';
    priceList.forEach(item => {
        priceText += `- ${item.ขนาด} ${item.ประเภท} ${item.รูปแบบ}: ${item.ราคา} บาท/แผ่น\n`;
    });

    const shopStatus = getDetailedShopStatus();
    
    // เพิ่มประวัติการสนทนาถ้ามี sessionId
    let conversationHistory = '';
    if (sessionId) {
        conversationHistory = getConversationHistory(sessionId);
    }

    return `คุณเป็นผู้ช่วย AI ของร้าน "It_Business" ร้านถ่ายเอกสารและปริ้นท์คุณภาพสูง

ข้อมูลวันเวลาปัจจุบัน:
- วันที่: ${shopStatus.date}
- เวลา: ${shopStatus.time} น.
- สถานะร้าน: ${shopStatus.statusMessage}

ข้อมูลร้าน:
- ชื่อร้าน: It_Business
- บริการ: รับถ่ายเอกสาร, เคลือบบัตร, พิมพ์งานจาก LINE/Email
- ที่อยู่: 136/2 หมู่10 ตำบลวัดประดู่ อ.เมือง จ.สุราษฎร์ธานี 84000
- โทรศัพท์: 093-5799850
- LINE ID: เบอร์ร้าน
- เวลาทำการ: จันทร์-ศุกร์ 08:00-17:00, เสาร์ 09:00-17:00, อาทิตย์ ปิด
- เจ้าของร้าน: พี่เวฟ
- พ่อเจ้าของร้าน: ลุงเดียร์
- จุดสังเกต: ใกล้ TheHub Hotel, Central Plaza, ในบริเวณสถานีขนส่งสุราษฎร์ธานี

ราคาถ่ายเอกสาร:
${priceText}

โปรโมชั่น:
- 100 แผ่นขึ้นไป ลด 25%
- 500 แผ่นขึ้นไป ลด 30%
- 1000 แผ่นขึ้นไป ลด 35%

บริการอื่นๆ:
- เข้าเล่ม: 20-100 บาท
- สแกนเอกสาร: 3-5 บาท/หน้า
- ลามิเนต: 10-40 บาท
- พิมพ์ภาพ: 5-50 บาท

${conversationHistory}

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
        
        let response = '💰 คำนวณราคา:\n';
        response += `📄 ${paperSize} ${colorType} ${printType}\n`;
        response += `📊 จำนวน: ${sheets} แผ่น\n`;
        response += `💵 ราคา: ${sheets} × ${pricePerSheet} = ${totalPrice.toFixed(2)} บาท\n`;
        
        if (discount > 0) {
            response += `🎉 ส่วนลด${discountText}: -${discount.toFixed(2)} บาท\n`;
            response += `✅ ราคาสุทธิ: ${finalPrice.toFixed(2)} บาท`;
        } else {
            response += `✅ ราคารวม: ${totalPrice.toFixed(2)} บาท`;
        }
        
        return {
            success: true,
            response: response
        };
    }
    
    return { 
        success: false, 
        response: '❌ ไม่พบข้อมูลราคาสำหรับรายการนี้ กรุณาตรวจสอบข้อมูลอีกครั้งค่ะ'
    };
}

// ปรับปรุง Call Gemini AI function ให้รวมประวัติการสนทนา
async function callGeminiAI(userMessage, sessionId = null) {
    if (!geminiApiKey) {
        return {
            success: false,
            message: 'ขออภัยค่ะ ระบบ AI ไม่พร้อมใช้งานในขณะนี้'
        };
    }

    try {
        const fetch = (await import('node-fetch')).default;
        
        const prompt = `${getBusinessContext(sessionId)}\n\nลูกค้าถาม: ${userMessage}\n\nตอบ:`;
        
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
            throw new Error(`API request failed with status: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.candidates && data.candidates[0] && data.candidates[0].content) {
            return {
                success: true,
                message: data.candidates[0].content.parts[0].text
            };
        }
        
        throw new Error('Invalid response format from AI');

    } catch (error) {
        console.error('Gemini AI Error:', error);
        return {
            success: false,
            message: 'ขออภัยค่ะ เกิดข้อผิดพลาดกับระบบ AI กรุณาลองใหม่อีกครั้ง หรือติดต่อเจ้าหน้าที่ได้เลยค่ะ'
        };
    }
}

// ปรับปรุง Parse message function ให้รองรับการจัดเก็บประวัติ
async function parseMessage(message, sessionId = null, source = 'web') {
    const text = message.toLowerCase();
    
    // เก็บข้อความของผู้ใช้ลงใน memory
    if (sessionId) {
        addToMemory(sessionId, message, true);
    }
    
    // ตรวจสอบคำสั่งรีเซ็ต
    if (text.includes('รีเซ็ต') || text.includes('reset') || text.includes('เริ่มใหม่') || text.includes('clear')) {
        if (sessionId) {
            resetConversation(sessionId);
        }
        return {
            type: 'reset',
            response: '🔄 รีเซ็ตการสนทนาเรียบร้อยแล้วค่ะ เริ่มการสนทนาใหม่ได้เลยค่ะ'
        };
    }
    
    // Date/time queries
    if (text.includes('วันนี้') || text.includes('วันอะไร') || text.includes('กี่โมง') || text.includes('เวลา')) {
        const dateInfo = getCurrentDateInfo();
        let response = `📅 วันที่: ${dateInfo.date}\n⏰ เวลา: ${dateInfo.time} น.\n`;
        
        if (text.includes('เปิด') || text.includes('ปิด') || text.includes('ทำการ')) {
            response += `🏪 สถานะร้าน: ${dateInfo.isOpen ? '🟢 ร้านเปิดอยู่' : '🔴 ร้านปิด'}\n`;
            response += `📋 เวลาทำการ: จันทร์-ศุกร์ 08:00-17:00, เสาร์ 09:00-17:00, อาทิตย์ ปิด`;
        }
        
        const result = {
            type: 'datetime',
            response: response
        };
        
        // เก็บคำตอบลงใน memory
        if (sessionId) {
            addToMemory(sessionId, response, false);
        }
        
        return result;
    }
    
    // Price list request
    if (text.includes('ราคา') && (text.includes('ตาราง') || text.includes('ทั้งหมด'))) {
        const result = {
            type: 'price_list',
            response: generatePriceTable()
        };
        
        // เก็บคำตอบลงใน memory
        if (sessionId) {
            addToMemory(sessionId, result.response, false);
        }
        
        return result;
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
            
            const finalResult = {
                type: 'price',
                response: result.response
            };
            
            // เก็บคำตอบลงใน memory
            if (sessionId) {
                addToMemory(sessionId, result.response, false);
            }
            
            return finalResult;
        }
    }

    // AI response with conversation history
    const aiResult = await callGeminiAI(message, sessionId);
    const finalResponse = aiResult.success ? aiResult.message : 'สวัสดีค่ะ! 👋 ยินดีให้บริการร้าน It-Business ค่ะ\n\n📄 เรามีบริการถ่ายเอกสาร พิมพ์งาน และบริการอื่นๆ\n🤖 สามารถคำนวณราคาและสอบถามข้อมูลได้เลยค่ะ\n\nมีอะไรให้ช่วยไหมคะ?';
    
    // เก็บคำตอบลงใน memory
    if (sessionId) {
        addToMemory(sessionId, finalResponse, false);
    }
    
    return {
        type: 'ai',
        response: finalResponse
    };
}

// Generate price table
function generatePriceTable() {
    if (!priceList || priceList.length === 0) {
        return '❌ ไม่พบข้อมูลราคา กรุณาติดต่อเจ้าหน้าที่ที่ 093-5799850 ค่ะ';
    }

    let table = '📋 ตารางราคาถ่ายเอกสาร It-Business\n\n';
    
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
            table += `📏 ${size}:\n`;
            currentSize = size;
        }
        
        const icon = type === 'สี' ? '🎨' : '⚫';
        table += `${icon} ${type} ${format}: ${price} บาท/แผ่น\n`;
    });

    // เพิ่มโปรโมชั่น
    table += '\n🎉 โปรโมชั่นส่วนลด:\n';
    table += '• 100+ แผ่น ลด 10% 💥\n';
    table += '• 500+ แผ่น ลด 15% 🔥\n';
    table += '• 1000+ แผ่น ลด 20% 🎯\n\n';
    
    table += '📞 สอบถามเพิ่มเติม: 093-5799850';
    
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

            /* Memory Status */
            .memory-status {
                background: rgba(255,255,255,0.1);
                border-radius: 15px;
                padding: 15px;
                text-align: center;
                color: white;
                margin-bottom: 20px;
                border: 1px solid rgba(255,255,255,0.2);
            }
            
            .memory-status .memory-icon {
                font-size: 24px;
                margin-bottom: 10px;
                display: block;
                color: #00ff88;
            }
            
            /* Reset Button */
            .reset-btn {
                background: var(--danger) !important;
                color: white !important;
                margin-top: 10px;
                font-weight: bold;
            }
            
            .reset-btn:hover {
                background: linear-gradient(135deg, #ff6b6b 0%, #ee5a52 100%) !important;
                transform: translateY(-2px);
            }
            
            /* Shop Status */
            .shop-status {
                background: rgba(255,255,255,0.1);
                border-radius: 15px;
                padding: 15px;
                text-align: center;
                color: white;
                margin-top: 20px;
                border: 1px solid rgba(255,255,255,0.2);
            }
            
            .shop-status .status-icon {
                font-size: 24px;
                margin-bottom: 10px;
                display: block;
            }
            
            .shop-status.open .status-icon {
                color: #00ff88;
            }
            
            .shop-status.closed .status-icon {
                color: #ff6b6b;
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
                <div class="status-item">
                    <div class="status-dot status-connected"></div>
                    <span>Memory (${MAX_HISTORY_MESSAGES} msgs)</span>
                </div>
            </div>
            <div class="status-item">
                <i class="fas fa-database"></i>
                <span>${priceList.length} รายการราคา</span>
            </div>
        </div>

        <div class="container">
            <!-- Sidebar -->
            <div class="sidebar">
                <div class="logo">
                    <h1><i class="fas fa-print"></i> It-Business</h1>
                    <p>Smart Document Center</p>
                </div>

                <!-- Memory Status -->
                <div class="memory-status">
                    <i class="fas fa-brain memory-icon"></i>
                    <div><strong>ระบบจำการสนทนา</strong></div>
                    <div style="font-size: 12px; margin-top: 5px;">
                        จำได้ ${MAX_HISTORY_MESSAGES} ข้อความย้อนหลัง<br>
                        Session: <span id="sessionCount">${conversationMemory.size}</span> active
                    </div>
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

                <div class="menu-section">
                    <div class="menu-title">
                        <i class="fas fa-brain"></i> การสนทนา
                    </div>
                    <button class="menu-btn reset-btn" onclick="resetConversation()">
                        <i class="fas fa-refresh"></i> รีเซ็ตการสนทนา
                    </button>
                </div>

                <!-- Shop Status -->
                <div class="shop-status" id="shopStatus">
                    <i class="fas fa-store status-icon"></i>
                    <div id="statusText">กำลังตรวจสอบ...</div>
                    <div style="font-size: 12px; margin-top: 5px;">
                        จ-ศ 08:00-17:00<br>
                        เสาร์ 09:00-17:00
                    </div>
                </div>
            </div>

            <!-- Main Content -->
            <div class="main-content">
                <div class="chat-header">
                    <h2>🤖 AI Assistant</h2>
                    <p>ยินดีให้บริการข้อมูลและคำนวณราคา (จำการสนทนาได้ ${MAX_HISTORY_MESSAGES} ข้อความ)</p>
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
                        สวัสดีค่ะ! ยินดีต้อนรับสู่ <strong>It-Business</strong><br>
                        ระบบถ่ายเอกสารอัจฉริยะ พร้อมให้บริการคำนวณราคาและข้อมูลต่างๆ ค่ะ<br><br>
                        <strong>🧠 ระบบจำการสนทนา:</strong> ฉันจะจำการสนทนาของเราได้ ${MAX_HISTORY_MESSAGES} ข้อความย้อนหลัง<br>
                        <strong>🎯 ลองคลิกเมนูด้านซ้าย หรือปุ่มด้านบนเพื่อเริ่มต้น!</strong><br>
                        <small>💡 ตัวอย่าง: "A4 ขาวดำ 100 แผ่น" หรือ "ราคาเข้าเล่ม"</small>
                    </div>
                </div>

                <div class="input-section">
                    <div class="input-group">
                        <input type="text" id="input" placeholder="💬 พิมพ์คำถามของคุณ... (ฉันจะจำการสนทนานี้)" onkeypress="if(event.key==='Enter') send()">
                        <button class="send-btn" onclick="send()">
                            <i class="fas fa-paper-plane"></i>
                            ส่ง
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <script>
            // ตรวจสอบสถานะร้าน
            async function updateShopStatus() {
                try {
                    const response = await fetch('/api/shop-status');
                    const data = await response.json();
                    
                    const statusElement = document.getElementById('shopStatus');
                    const statusText = document.getElementById('statusText');
                    
                    if (data.isOpen) {
                        statusElement.className = 'shop-status open';
                        statusText.innerHTML = '🟢 เปิดอยู่<br><small>ปิดเวลา 17:00</small>';
                    } else {
                        statusElement.className = 'shop-status closed';
                        statusText.innerHTML = '🔴 ปิดแล้ว<br><small>' + (data.nextOpenTime || 'เปิดพรุ่งนี้') + '</small>';
                    }
                } catch (error) {
                    console.error('Error fetching shop status:', error);
                }
            }

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
                div.innerHTML = '<div class="typing"></div> กำลังคิด... (อ่านประวัติการสนทนา)';
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
                    
                    // Update session count
                    updateSessionCount();
                } catch (error) {
                    removeTyping();
                    addMessage('🔌 ไม่สามารถเชื่อมต่อได้ กรุณาลองใหม่ในภายหลัง', false);
                }
            }
            
            function sendQuickMessage(text) {
                document.getElementById('input').value = text;
                send();
            }

            // ฟังก์ชันรีเซ็ตการสนทนา
            async function resetConversation() {
                if (confirm('คุณต้องการรีเซ็ตการสนทนาใหม่หรือไม่?')) {
                    try {
                        const response = await fetch('/reset-conversation', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' }
                        });
                        
                        const data = await response.json();
                        
                        // ล้างข้อความในหน้าจอ
                        const chat = document.getElementById('chat');
                        chat.innerHTML = '<div class="message bot">🔄 รีเซ็ตการสนทนาเรียบร้อยแล้วค่ะ เริ่มการสนทนาใหม่ได้เลยค่ะ</div>';
                        
                        // Update session count
                        updateSessionCount();
                        
                        console.log('Conversation reset:', data);
                    } catch (error) {
                        console.error('Reset error:', error);
                        addMessage('❌ ไม่สามารถรีเซ็ตได้ กรุณาลองใหม่', false);
                    }
                }
            }

            // อัพเดตจำนวน session
            async function updateSessionCount() {
                try {
                    const response = await fetch('/api/memory-stats');
                    const data = await response.json();
                    document.getElementById('sessionCount').textContent = data.sessionCount || 0;
                } catch (error) {
                    console.error('Error updating session count:', error);
                }
            }

            // เรียกใช้เมื่อโหลดหน้า
            document.addEventListener('DOMContentLoaded', function() {
                updateShopStatus();
                updateSessionCount();
                document.getElementById('input').focus();
                
                // อัปเดตสถานะร้านทุก 1 นาที
                setInterval(updateShopStatus, 60000);
                
                // อัปเดต session count ทุก 30 วินาที
                setInterval(updateSessionCount, 30000);
            });
        </script>
    </body>
    </html>
    `;
    
    res.send(html);
});

// Chat API - ปรับปรุงเพื่อใช้ระบบประวัติการสนทนา
app.post('/chat', express.json(), async (req, res) => {
    try {
        const sessionId = getSessionId('web');
        const result = await parseMessage(req.body.message, sessionId, 'web');
        res.json({ reply: result.response });
    } catch (error) {
        console.error('Chat error:', error);
        res.json({ reply: 'ขออภัยค่ะ เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' });
    }
});

// API สำหรับรีเซ็ตการสนทนา
app.post('/reset-conversation', express.json(), (req, res) => {
    try {
        const sessionId = getSessionId('web');
        resetConversation(sessionId);
        res.json({ 
            success: true, 
            message: 'รีเซ็ตการสนทนาเรียบร้อยแล้ว',
            sessionId: sessionId
        });
    } catch (error) {
        console.error('Reset conversation error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'เกิดข้อผิดพลาดในการรีเซ็ต' 
        });
    }
});

// Shop status API
app.get('/api/shop-status', (req, res) => {
    const shopStatus = getDetailedShopStatus();
    res.json({
        isOpen: shopStatus.isOpen,
        currentTime: shopStatus.time,
        currentDay: shopStatus.currentDay,
        statusMessage: shopStatus.statusMessage,
        nextOpenTime: shopStatus.nextOpenTime
    });
});

// API สำหรับดูสถิติหน่วยความจำ
app.get('/api/memory-stats', (req, res) => {
    try {
        // ทำความสะอาดก่อนนับ
        cleanupExpiredSessions();
        
        let totalMessages = 0;
        for (const session of conversationMemory.values()) {
            totalMessages += session.messages.length;
        }
        
        res.json({
            success: true,
            sessionCount: conversationMemory.size,
            totalMessages: totalMessages,
            maxHistoryPerSession: MAX_HISTORY_MESSAGES,
            sessionTimeoutMinutes: SESSION_TIMEOUT / 60000
        });
    } catch (error) {
        console.error('Memory stats error:', error);
        res.status(500).json({
            success: false,
            message: 'ไม่สามารถดึงข้อมูลสถิติได้'
        });
    }
});

// Health check
app.get('/health', (req, res) => {
    cleanupExpiredSessions();
    res.json({ 
        status: 'OK',
        prices: priceList.length,
        ai: geminiApiKey ? 'ready' : 'not configured',
        line: client ? 'connected' : 'not configured',
        memory: {
            active: true,
            sessions: conversationMemory.size,
            maxHistoryPerSession: MAX_HISTORY_MESSAGES
        },
        timestamp: new Date().toISOString()
    });
});

// Price API
app.get('/api/prices', (req, res) => {
    res.json({
        success: true,
        data: priceList,
        count: priceList.length,
        lastUpdated: new Date().toISOString()
    });
});

// Test endpoint
app.get('/test', (req, res) => {
    res.redirect('/');
});

// LINE webhook - ปรับปรุงเพื่อใช้ระบบประวัติการสนทนา
if (client && lineConfig) {
    app.post('/webhook', line.middleware(lineConfig), async (req, res) => {
        try {
            await Promise.all(req.body.events.map(handleLineEvent));
            res.json({ success: true });
        } catch (err) {
            console.error('LINE error:', err);
            res.status(500).json({ success: false, error: err.message });
        }
    });

    async function handleLineEvent(event) {
        if (event.type !== 'message' || event.message.type !== 'text') {
            return null;
        }

        try {
            // สร้าง session key สำหรับผู้ใช้ LINE แต่ละคน
            const sessionId = getSessionId('line', event.source.userId);
            const result = await parseMessage(event.message.text, sessionId, 'line');
            
            return client.replyMessage(event.replyToken, {
                type: 'text',
                text: result.response
            });
        } catch (error) {
            console.error('Error handling LINE event:', error);
            return client.replyMessage(event.replyToken, {
                type: 'text',
                text: 'ขออภัยค่ะ เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง'
            });
        }
    }
} else {
    app.post('/webhook', (req, res) => {
        res.json({ 
            message: 'LINE Bot not configured', 
            status: 'warning',
            missingCredentials: !channelAccessToken || !channelSecret
        });
    });
}

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ 
        success: false, 
        message: 'Internal server error',
        timestamp: new Date().toISOString()
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ 
        success: false, 
        message: 'Endpoint not found',
        path: req.originalUrl
    });
});

// ทำความสะอาด session หมดอายุทุก 10 นาที
setInterval(() => {
    try {
        cleanupExpiredSessions();
    } catch (error) {
        console.error('Cleanup interval error:', error);
    }
}, 10 * 60 * 1000);

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
🧠 Memory: ${MAX_HISTORY_MESSAGES} messages per session, ${SESSION_TIMEOUT/60000} min timeout
🌍 Environment: ${process.env.NODE_ENV || 'development'}
⏰ Timezone: ${process.env.TZ || 'System default'}

🎯 New Features Added:
✅ Conversation Memory System
   - Remembers last ${MAX_HISTORY_MESSAGES} messages per session
   - Separate sessions for Web and LINE users
   - Auto cleanup expired sessions (${SESSION_TIMEOUT/60000} min)
   - Reset conversation functionality
   
📋 API Endpoints:
• POST /chat - Send message (with memory)
• POST /reset-conversation - Reset conversation
• GET  /api/shop-status - Shop status
• GET  /api/memory-stats - Memory statistics
• GET  /health - Health check
• POST /webhook - LINE Bot webhook

🔧 Memory Management:
• Active sessions: ${conversationMemory.size}
• Auto cleanup every 10 minutes
• Session timeout: ${SESSION_TIMEOUT/60000} minutes
========================================
    `);
});
