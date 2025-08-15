const express = require('express');
const line = require('@line/bot-sdk');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const XLSX = require('xlsx');
const path = require('path');
const bodyParser = require('body-parser');

const app = express();

// Security headers (basic security without helmet dependency)
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
});

// Simple rate limiting without external dependency
const requestCounts = new Map();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX = 50; // 50 requests per window

const simpleRateLimit = (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const windowStart = now - RATE_LIMIT_WINDOW;
    
    if (!requestCounts.has(ip)) {
        requestCounts.set(ip, []);
    }
    
    const requests = requestCounts.get(ip).filter(time => time > windowStart);
    
    if (requests.length >= RATE_LIMIT_MAX) {
        return res.status(429).json({ 
            error: 'Too many requests. Please try again later.',
            retryAfter: Math.ceil(RATE_LIMIT_WINDOW / 1000)
        });
    }
    
    requests.push(now);
    requestCounts.set(ip, requests);
    
    // Clean old entries periodically
    if (Math.random() < 0.01) {
        for (const [key, times] of requestCounts.entries()) {
            const filtered = times.filter(time => time > windowStart);
            if (filtered.length === 0) {
                requestCounts.delete(key);
            } else {
                requestCounts.set(key, filtered);
            }
        }
    }
    
    next();
};

app.use(simpleRateLimit);
app.use(bodyParser.json({ limit: '5mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '5mb' }));

// Environment Variables Validation
const validateEnvironment = () => {
    const config = {
        channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || 'dummy_token',
        channelSecret: process.env.LINE_CHANNEL_SECRET || 'dummy_secret',
        geminiApiKey: process.env.GEMINI_API_KEY,
        port: process.env.PORT || 3000,
        nodeEnv: process.env.NODE_ENV || 'development'
    };

    console.log('🔧 Environment Configuration:');
    console.log(`├── NODE_ENV: ${config.nodeEnv}`);
    console.log(`├── PORT: ${config.port}`);
    console.log(`├── LINE_CHANNEL_ACCESS_TOKEN: ${config.channelAccessToken !== 'dummy_token' ? '✅ Set' : '❌ Not set'}`);
    console.log(`├── LINE_CHANNEL_SECRET: ${config.channelSecret !== 'dummy_secret' ? '✅ Set' : '❌ Not set'}`);
    console.log(`└── GEMINI_API_KEY: ${config.geminiApiKey ? '✅ Set' : '❌ Not set'}`);

    return config;
};

const config = validateEnvironment();

// Gemini Service with enhanced error handling and retry logic
class GeminiService {
    constructor() {
        this.genAI = null;
        this.model = null;
        this.isEnabled = false;
        this.requestCount = 0;
        this.dailyLimit = 50; // Conservative daily limit
        this.minuteLimit = 2; // Conservative per minute limit
        this.minuteRequests = [];
        this.lastResetTime = Date.now();
        this.initialize();
    }

    initialize() {
        if (config.geminiApiKey) {
            try {
                this.genAI = new GoogleGenerativeAI(config.geminiApiKey);
                this.model = this.genAI.getGenerativeModel({ 
                    model: "gemini-1.5-flash", // Use flash model for better quota
                    generationConfig: {
                        maxOutputTokens: 500, // Reduced to save quota
                        temperature: 0.5,
                    }
                });
                this.isEnabled = true;
                console.log('✅ Gemini AI service initialized (Flash model for better quota)');
            } catch (error) {
                console.error('❌ Failed to initialize Gemini AI:', error.message);
                this.isEnabled = false;
            }
        } else {
            console.log('⚠️  Gemini AI service disabled - API key not provided');
        }
    }

    checkRateLimit() {
        const now = Date.now();
        
        // Reset daily counter if needed
        if (now - this.lastResetTime > 24 * 60 * 60 * 1000) {
            this.requestCount = 0;
            this.lastResetTime = now;
        }
        
        // Clean minute requests
        this.minuteRequests = this.minuteRequests.filter(time => now - time < 60000);
        
        // Check limits
        if (this.requestCount >= this.dailyLimit) {
            return { allowed: false, reason: 'daily_limit' };
        }
        
        if (this.minuteRequests.length >= this.minuteLimit) {
            return { allowed: false, reason: 'minute_limit' };
        }
        
        return { allowed: true };
    }

    async generateResponse(question, context) {
        if (!this.isEnabled) {
            return 'ขออภัย ระบบ AI ไม่พร้อมใช้งานในขณะนี้ กรุณาใช้คำสั่งคำนวณราคาโดยตรง เช่น "A4 ขาวดำ หน้าเดียว 10 หน้า"';
        }

        const rateCheck = this.checkRateLimit();
        if (!rateCheck.allowed) {
            if (rateCheck.reason === 'daily_limit') {
                return 'ขออภัย ระบบ AI ใช้งานเต็มขีดจำกัดรายวันแล้ว กรุณาใช้คำสั่งคำนวณราคาโดยตรง เช่น "A4 ขาวดำ 10 หน้า"';
            } else {
                return 'ขออภัย กรุณารอสักครู่แล้วลองใหม่ กรุณาใช้คำสั่งคำนวณราคาโดยตรง เช่น "A4 ขาวดำ 10 หน้า"';
            }
        }

        try {
            // Shorter prompt to save tokens
            const shortContext = `ร้านถ่ายเอกสาร - ตอบสั้นๆ เป็นภาษาไทย ราคา: A4 ขาวดำ 1หน้า=0.5บ., A4 ขาวดำ 2หน้า=1บ., A4 สี 1หน้า=2บ., A4 สี 2หน้า=4บ., A3 ขาวดำ 1หน้า=1บ., A3 ขาวดำ 2หน้า=2บ., A3 สี 1หน้า=4บ., A3 สี 2หน้า=8บ.`;
            const shortPrompt = `${shortContext}\n\nQ: ${question.substring(0, 100)}`; // Limit question length
            
            const result = await this.model.generateContent(shortPrompt);
            const response = await result.response;
            
            // Update counters on success
            this.requestCount++;
            this.minuteRequests.push(Date.now());
            
            return response.text();
        } catch (error) {
            console.error('Gemini API Error:', error);
            
            if (error.status === 429) {
                // Disable service temporarily on quota exceeded
                setTimeout(() => {
                    console.log('🔄 Re-enabling Gemini service after cooldown');
                }, 60000); // 1 minute cooldown
                
                return 'ขออภัย ระบบ AI ใช้งานเต็มขีดจำกัด กรุณาใช้คำสั่งคำนวณราคาโดยตรง เช่น "A4 ขาวดำ หน้าเดียว 10 หน้า"';
            }
            
            if (error.message.includes('quota')) {
                return 'ขออภัย ระบบ AI ใช้งานเต็มขีดจำกัด กรุณาใช้คำสั่งคำนวณราคาโดยตรง เช่น "A4 ขาวดำ 10 หน้า"';
            }
            
            return 'ขออภัย เกิดข้อผิดพลาดชั่วคราว กรุณาใช้คำสั่งคำนวณราคาโดยตรง เช่น "A4 ขาวดำ 10 หน้า"';
        }
    }
}

// LINE Bot Service
class LineService {
    constructor() {
        this.client = null;
        this.isEnabled = false;
        this.initialize();
    }

    initialize() {
        if (config.channelAccessToken !== 'dummy_token' && config.channelSecret !== 'dummy_secret') {
            try {
                const lineConfig = {
                    channelAccessToken: config.channelAccessToken,
                    channelSecret: config.channelSecret,
                };
                this.client = new line.Client(lineConfig);
                this.isEnabled = true;
                console.log('✅ LINE Bot service initialized');
            } catch (error) {
                console.error('❌ Failed to initialize LINE Bot:', error.message);
                this.isEnabled = false;
            }
        } else {
            console.log('⚠️  LINE Bot service disabled - using dummy credentials');
        }
    }

    async replyMessage(replyToken, message) {
        if (!this.isEnabled) {
            throw new Error('LINE Bot service is not enabled');
        }
        return await this.client.replyMessage(replyToken, message);
    }

    getMiddleware() {
        if (!this.isEnabled) {
            return (req, res, next) => next();
        }
        return line.middleware({ channelSecret: config.channelSecret });
    }
}

// Enhanced Price Service with comprehensive fallback data
class PriceService {
    constructor() {
        this.priceData = {};
        this.fallbackPriceData = {
            'A4_BW_Single': 0.5,
            'A4_BW_Double': 1.0,
            'A4_Color_Single': 2.0,
            'A4_Color_Double': 4.0,
            'A3_BW_Single': 1.0,
            'A3_BW_Double': 2.0,
            'A3_Color_Single': 4.0,
            'A3_Color_Double': 8.0,
            'A5_BW_Single': 0.3,
            'A5_BW_Double': 0.6,
            'A5_Color_Single': 1.5,
            'A5_Color_Double': 3.0
        };
        this.loadPriceData();
    }

    loadPriceData() {
        try {
            const filePath = path.join(__dirname, 'price_table.xlsx');
            console.log(`📁 Looking for price file at: ${filePath}`);
            
            const workbook = XLSX.readFile(filePath);
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const data = XLSX.utils.sheet_to_json(worksheet);
            
            console.log(`📊 Raw Excel data:`, data);
            
            data.forEach(row => {
                // More flexible column name matching
                const paperSize = row['Paper Size'] || row['paper_size'] || row['size'] || row['Size'];
                const color = row['Color'] || row['color'] || row['Type'] || row['type'];
                const sides = row['Sides'] || row['sides'] || row['Side'] || row['side'];
                const price = row['Price per Page'] || row['price_per_page'] || row['Price'] || row['price'];
                
                if (paperSize && color && sides && price !== undefined) {
                    const key = `${paperSize}_${color}_${sides}`;
                    this.priceData[key] = parseFloat(price) || 0;
                    console.log(`📝 Loaded price: ${key} = ${price}`);
                }
            });
            
            if (Object.keys(this.priceData).length === 0) {
                throw new Error('No valid price data found in Excel file');
            }
            
            console.log(`✅ Price data loaded from Excel: ${Object.keys(this.priceData).length} entries`);
            
        } catch (error) {
            console.warn(`⚠️  Excel file not found or invalid (${error.message}), using comprehensive fallback data`);
            this.priceData = { ...this.fallbackPriceData };
            console.log(`✅ Using fallback price data: ${Object.keys(this.priceData).length} entries`);
        }
    }

    calculatePrice(paperSize, color, sides, pages) {
        // Input validation
        if (!paperSize || !color || !sides || !pages) {
            return { 
                success: false, 
                message: 'กรุณาระบุข้อมูลให้ครบถ้วน: ขนาดกระดาษ สี จำนวนหน้าพิมพ์ และจำนวนหน้า\n\n' +
                        'ตัวอย่าง: "A4 ขาวดำ หน้าเดียว 50 หน้า"'
            };
        }

        const numPages = parseInt(pages);
        if (isNaN(numPages) || numPages <= 0) {
            return { 
                success: false, 
                message: 'กรุณาระบุจำนวนหน้าที่ถูกต้อง (ตัวเลขมากกว่า 0)' 
            };
        }

        if (numPages > 10000) {
            return { 
                success: false, 
                message: 'จำนวนหน้าเกินขีดจำกัด (สูงสุด 10,000 หน้า)' 
            };
        }

        const key = `${paperSize}_${color}_${sides}`;
        const pricePerPage = this.priceData[key];
        
        if (pricePerPage !== undefined && pricePerPage > 0) {
            const totalPrice = pricePerPage * numPages;
            return {
                success: true,
                pricePerPage: pricePerPage,
                totalPrice: totalPrice,
                details: `📄 ${paperSize} ${color === 'BW' ? 'ขาวดำ' : 'สี'} ${sides === 'Single' ? 'หน้าเดียว' : 'สองหน้า'}\n` +
                        `📊 ${numPages.toLocaleString('th-TH')} หน้า × ${pricePerPage} บาท/หน้า\n` +
                        `💰 ราคารวม: ${totalPrice.toLocaleString('th-TH')} บาท`
            };
        }

        const availableOptions = Object.keys(this.priceData)
            .filter(k => this.priceData[k] > 0)
            .map(k => {
                const [size, clr, side] = k.split('_');
                return `• ${size} ${clr === 'BW' ? 'ขาวดำ' : 'สี'} ${side === 'Single' ? 'หน้าเดียว' : 'สองหน้า'}: ${this.priceData[k]} บาท/หน้า`;
            })
            .join('\n');

        return { 
            success: false, 
            message: `❌ ไม่พบข้อมูลราคาสำหรับ: ${paperSize} ${color} ${sides}\n\n📋 ตัวเลือกที่มี:\n${availableOptions}` 
        };
    }

    getAllPrices() {
        return Object.keys(this.priceData)
            .filter(key => this.priceData[key] > 0)
            .map(key => {
                const [size, color, sides] = key.split('_');
                return `• ${size} ${color === 'BW' ? 'ขาวดำ' : 'สี'} ${sides === 'Single' ? 'หน้าเดียว' : 'สองหน้า'}: ${this.priceData[key]} บาท/หน้า`;
            }).join('\n');
    }
}

// Enhanced Message Parser
class MessageParser {
    static parseMessage(message) {
        const normalizedMessage = message.toLowerCase().trim();
        
        // Enhanced regex patterns
        const patterns = [
            // Thai pattern: A4 ขาวดำ หน้าเดียว 50 หน้า
            /(?:กระดาษ\s*)?(a[345])\s*(?:ขนาด\s*)?(ขาวดำ|สี|สีดำ|black|white|color|bw)\s*(?:พิมพ์\s*)?(หน้าเดียว|สองหน้า|single|double|1\s*หน้า|2\s*หน้า)?\s*(?:จำนวน\s*)?(\d+)\s*(?:หน้า)?/i,
            // English pattern: A4 BW single 50 pages
            /(a[345])\s*(bw|black|white|color|สี|ขาวดำ)\s*(single|double|หน้าเดียว|สองหน้า|1|2)?\s*(?:side[ds]?)?\s*(\d+)\s*(?:page[s]?|หน้า)?/i,
            // Simple pattern: ขาวดำ A4 50 หน้า
            /(ขาวดำ|สี|bw|color)\s*(a[345])\s*(\d+)\s*(?:หน้า|page[s]?)/i,
            // Very simple: A4 50 (default to BW single)
            /(a[345])\s+(\d+)(?:\s*หน้า|page[s]?)?$/i
        ];

        for (let i = 0; i < patterns.length; i++) {
            const pattern = patterns[i];
            const match = normalizedMessage.match(pattern);
            if (match) {
                let paperSize, color, sides, pages;

                if (i === 2) { // Simple pattern
                    color = match[1];
                    paperSize = match[2].toUpperCase();
                    pages = match[3];
                    sides = 'Single'; // Default
                } else if (i === 3) { // Very simple pattern
                    paperSize = match[1].toUpperCase();
                    color = 'BW'; // Default
                    sides = 'Single'; // Default
                    pages = match[2];
                } else { // Full patterns
                    paperSize = match[1] ? match[1].toUpperCase() : 'A4';
                    color = match[2];
                    sides = match[3] || 'Single'; // Default if not specified
                    pages = match[4];
                }

                // Normalize values
                paperSize = this.normalizePaperSize(paperSize);
                color = this.normalizeColor(color);
                sides = this.normalizeSides(sides);

                console.log(`🔍 Parsed message: ${paperSize} ${color} ${sides} ${pages} pages`);
                return { paperSize, color, sides, pages };
            }
        }

        return null;
    }

    static normalizePaperSize(size) {
        const normalized = size.toUpperCase();
        return ['A3', 'A4', 'A5'].includes(normalized) ? normalized : 'A4';
    }

    static normalizeColor(color) {
        const colorMap = {
            'ขาวดำ': 'BW',
            'สีดำ': 'BW',
            'black': 'BW',
            'white': 'BW',
            'bw': 'BW',
            'สี': 'Color',
            'color': 'Color'
        };
        return colorMap[color.toLowerCase()] || 'BW';
    }

    static normalizeSides(sides) {
        const sidesMap = {
            'หน้าเดียว': 'Single',
            'single': 'Single',
            '1': 'Single',
            '1หน้า': 'Single',
            'สองหน้า': 'Double',
            'double': 'Double',
            '2': 'Double',
            '2หน้า': 'Double'
        };
        return sidesMap[sides.toLowerCase()] || 'Single';
    }
}

// Initialize services
const lineService = new LineService();
const geminiService = new GeminiService();
const priceService = new PriceService();

// Enhanced web interface with better mobile support
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="th">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>🖨️ ระบบคำนวณราคาถ่ายเอกสาร</title>
        <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { 
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
                max-width: 900px; 
                margin: 0 auto; 
                padding: 10px; 
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
                font-size: 16px;
            }
            .container { 
                background: white; 
                border-radius: 15px; 
                box-shadow: 0 10px 30px rgba(0,0,0,0.2); 
                overflow: hidden;
            }
            .header { 
                background: linear-gradient(45deg, #667eea, #764ba2); 
                color: white; 
                padding: 20px; 
                text-align: center; 
            }
            .header h1 { font-size: 1.8em; margin-bottom: 10px; }
            .header p { opacity: 0.9; font-size: 0.9em; }
            .chat-container { 
                height: 400px; 
                overflow-y: auto; 
                padding: 15px; 
                background: #f8f9fa;
            }
            .message { 
                margin: 10px 0; 
                padding: 12px 15px; 
                border-radius: 15px; 
                max-width: 85%; 
                word-wrap: break-word;
                line-height: 1.4;
                font-size: 14px;
            }
            .user { 
                background: linear-gradient(45deg, #667eea, #764ba2); 
                color: white; 
                margin-left: auto; 
                text-align: right;
            }
            .bot { 
                background: white; 
                border: 2px solid #e9ecef;
                margin-right: auto;
            }
            .input-area { 
                padding: 15px; 
                background: white; 
                border-top: 1px solid #e9ecef;
                display: flex;
                gap: 8px;
                flex-wrap: wrap;
            }
            .input-area input { 
                flex: 1; 
                min-width: 200px;
                padding: 12px 15px; 
                border: 2px solid #e9ecef; 
                border-radius: 20px; 
                font-size: 14px;
                outline: none;
                transition: border-color 0.3s;
            }
            .input-area input:focus { border-color: #667eea; }
            .input-area button { 
                padding: 12px 20px; 
                background: linear-gradient(45deg, #667eea, #764ba2); 
                color: white; 
                border: none; 
                border-radius: 20px; 
                cursor: pointer; 
                font-size: 14px;
                font-weight: bold;
                transition: transform 0.2s;
                min-width: 60px;
            }
            .input-area button:hover { transform: scale(1.05); }
            .input-area button:disabled { 
                opacity: 0.5; 
                cursor: not-allowed; 
                transform: none;
            }
            .examples { 
                padding: 15px; 
                background: #f8f9fa; 
                border-top: 1px solid #e9ecef;
            }
            .examples h3 { color: #495057; margin-bottom: 10px; font-size: 1em; }
            .example-item { 
                background: white; 
                padding: 8px 12px; 
                margin: 4px 0; 
                border-radius: 8px; 
                cursor: pointer; 
                transition: background-color 0.3s;
                font-size: 13px;
            }
            .example-item:hover { background: #e9ecef; }
            .status { 
                padding: 8px 15px; 
                background: #d4edda; 
                color: #155724; 
                font-size: 12px;
                text-align: center;
            }
            .loading { 
                display: none; 
                text-align: center; 
                padding: 15px;
                font-size: 14px;
            }
            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
            }
            .loading.active { display: block; animation: pulse 1s infinite; }
            
            @media (max-width: 600px) {
                body { padding: 5px; font-size: 14px; }
                .header h1 { font-size: 1.5em; }
                .header p { font-size: 0.8em; }
                .chat-container { height: 350px; padding: 10px; }
                .message { font-size: 13px; padding: 10px 12px; max-width: 90%; }
                .input-area { padding: 10px; flex-direction: column; }
                .input-area input { min-width: 100%; margin-bottom: 8px; }
                .example-item { font-size: 12px; padding: 6px 10px; }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🖨️ ระบบคำนวณราคาถ่ายเอกสาร</h1>
                <p>ยินดีให้บริการคำนวณราคาถ่ายเอกสารแบบรวดเร็วและแม่นยำ</p>
            </div>
            
            <div class="status">
                ✅ พร้อมให้บริการ | 🤖 AI: ${geminiService.isEnabled ? 'เปิด' : 'ปิด'} | 📱 LINE: ${lineService.isEnabled ? 'เปิด' : 'ปิด'} | 💰 ราคา: ${Object.keys(priceService.priceData).length} รายการ
            </div>

            <div class="chat-container" id="chatContainer">
                <div class="message bot">
                    สวัสดีค่ะ! 👋 ยินดีให้บริการคำนวณราคาถ่ายเอกสาร<br><br>
                    🎯 <strong>วิธีใช้งาน:</strong><br>
                    พิมพ์รายละเอียดการถ่ายเอกสารของคุณ เช่น:<br>
                    • "A4 ขาวดำ หน้าเดียว 50 หน้า"<br>
                    • "A4 สี 20 หน้า"<br>
                    • "A3 ขาวดำ สองหน้า 10 หน้า"<br><br>
                    💡 หรือพิมพ์ "ราคา" เพื่อดูรายการราคาทั้งหมด
                </div>
            </div>

            <div class="loading" id="loading">
                🤔 กำลังคิด...
            </div>

            <div class="input-area">
                <input type="text" id="messageInput" placeholder="พิมพ์คำถามของคุณ..." onkeypress="if(event.key==='Enter' && !event.shiftKey) sendMessage()">
                <button onclick="sendMessage()" id="sendButton">ส่ง</button>
            </div>

            <div class="examples">
                <h3>💡 ตัวอย่างคำถาม:</h3>
                <div class="example-item" onclick="setMessage('A4 ขาวดำ 100 หน้า')">A4 ขาวดำ 100 หน้า</div>
                <div class="example-item" onclick="setMessage('A4 สี หน้าเดียว 50 หน้า')">A4 สี หน้าเดียว 50 หน้า</div>
                <div class="example-item" onclick="setMessage('A3 ขาวดำ สองหน้า 20 หน้า')">A3 ขาวดำ สองหน้า 20 หน้า</div>
                <div class="example-item" onclick="setMessage('ราคา')">แสดงราคาทั้งหมด</div>
            </div>
        </div>

        <script>
            let isProcessing = false;

            function addMessage(text, isUser) {
                const chatContainer = document.getElementById('chatContainer');
                const messageDiv = document.createElement('div');
                messageDiv.className = 'message ' + (isUser ? 'user' : 'bot');
                messageDiv.innerHTML = text.replace(/\\n/g, '<br>');
                chatContainer.appendChild(messageDiv);
                chatContainer.scrollTop = chatContainer.scrollHeight;
            }

            function setMessage(text) {
                document.getElementById('messageInput').value = text;
                document.getElementById('messageInput').focus();
            }

            function showLoading(show) {
                const loading = document.getElementById('loading');
                const sendButton = document.getElementById('sendButton');
                const messageInput = document.getElementById('messageInput');
                
                if (show) {
                    loading.classList.add('active');
                    sendButton.disabled = true;
                    sendButton.textContent = 'กำลังส่ง...';
                    messageInput.disabled = true;
                } else {
                    loading.classList.remove('active');
                    sendButton.disabled = false;
                    sendButton.textContent = 'ส่ง';
                    messageInput.disabled = false;
                    messageInput.focus();
                }
            }

            async function sendMessage() {
                if (isProcessing) return;
                
                const input = document.getElementById('messageInput');
                const message = input.value.trim();
                if (!message) return;

                isProcessing = true;
                addMessage(message, true);
                input.value = '';
                showLoading(true);

                try {
                    const response = await fetch('/chat', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ message: message })
                    });
                    
                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.reply || \`HTTP error! status: \${response.status}\`);
                    }
                    
                    const data = await response.json();
                    addMessage(data.reply, false);
                } catch (error) {
                    console.error('Error:', error);
                    addMessage('❌ ' + (error.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง'), false);
                } finally {
                    showLoading(false);
                    isProcessing = false;
                }
            }

            // Auto-focus on input
            document.addEventListener('DOMContentLoaded', function() {
                document.getElementById('messageInput').focus();
            });
        </script>
    </body>
    </html>
    `);
});

// Enhanced chat API with better error handling
app.post('/chat', async (req, res) => {
    try {
        const userMessage = req.body.message?.trim();
        
        if (!userMessage) {
            return res.status(400).json({ reply: 'กรุณาพิมพ์ข้อความ' });
        }

        if (userMessage.length > 200) {
            return res.status(400).json({ reply: 'ข้อความยาวเกินไป กรุณาพิมพ์ไม่เกิน 200 ตัวอักษร' });
        }

        console.log(`💬 User message: "${userMessage}"`);

        // Check for price list request
        if (userMessage.includes('ราคา') || userMessage.toLowerCase().includes('price')) {
            const priceList = \`📋 **รายการราคาถ่ายเอกสาร**\\n\\n\${priceService.getAllPrices()}\\n\\n💡 ตัวอย่างการใช้งาน:\\n• "A4 ขาวดำ 50 หน้า"\\n• "A3 สี สองหน้า 20 หน้า"\`;
            console.log(\`📊 Returning price list (\${Object.keys(priceService.priceData).length} items)\`);
            return res.json({ reply: priceList });
        }

        // Try to parse price calculation request
        const parsedMessage = MessageParser.parseMessage(userMessage);
        
        if (parsedMessage) {
            const { paperSize, color, sides, pages } = parsedMessage;
            console.log(\`🔍 Parsed: \${paperSize} \${color} \${sides} \${pages}p\`);
            
            const result = priceService.calculatePrice(paperSize, color, sides, pages);
            
            if (result.success) {
                console.log(\`✅ Price calculated: \${result.totalPrice} บาท\`);
                return res.json({ reply: result.details });
            } else {
                console.log(\`❌ Price calculation failed: \${result.message}\`);
                return res.json({ reply: result.message });
            }
        }
        
        // For unrecognized messages, provide helpful guidance instead of using AI
        const helpMessage = \`🤔 ไม่เข้าใจคำถามของคุณ กรุณาลองใช้รูปแบบเหล่านี้:\\n\\n\` +
            \`📝 **รูปแบบที่รองรับ:**\\n\` +
            \`• "A4 ขาวดำ 50 หน้า"\\n\` +
            \`• "A4 สี หน้าเดียว 20 หน้า"\\n\` +
            \`• "A3 ขาวดำ สองหน้า 10 หน้า"\\n\` +
            \`• "ราคา" (ดูรายการราคาทั้งหมด)\\n\\n\` +
            \`💡 **คำแนะนำ:**\\n\` +
            \`• ระบุขนาดกระดาษ: A3, A4, A5\\n\` +
            \`• ระบุสี: ขาวดำ หรือ สี\\n\` +
            \`• ระบุจำนวนหน้าพิมพ์: หน้าเดียว หรือ สองหน้า\\n\` +
            \`• ระบุจำนวนหน้า: ตัวเลข\`;

        console.log('❓ Unrecognized message, providing help');
        res.json({ reply: helpMessage });

    } catch (error) {
        console.error('💥 Chat API Error:', error);
        res.status(500).json({ 
            reply: 'ขออภัย เกิดข้อผิดพลาดภายในระบบ กรุณาลองใหม่อีกครั้ง' 
        });
    }
});

// Enhanced LINE webhook
if (lineService.isEnabled) {
    app.post('/webhook', lineService.getMiddleware(), (req, res) => {
        Promise
            .all(req.body.events.map(handleLineEvent))
            .then((result) => res.json(result))
            .catch((err) => {
                console.error('💥 LINE Webhook Error:', err);
                res.status(500).end();
            });
    });

    async function handleLineEvent(event) {
        if (event.type !== 'message' || event.message.type !== 'text') {
            return Promise.resolve(null);
        }

        try {
            const userMessage = event.message.text.trim();
            console.log(\`📱 LINE message: "\${userMessage}"\`);
            
            // Check for price list request
            if (userMessage.includes('ราคา') || userMessage.toLowerCase().includes('price')) {
                const priceList = \`📋 รายการราคาถ่ายเอกสาร\\n\\n\${priceService.getAllPrices()}\\n\\n💡 ตัวอย่าง: "A4 ขาวดำ 50 หน้า"\`;
                return lineService.replyMessage(event.replyToken, {
                    type: 'text',
                    text: priceList
                });
            }

            // Try to parse price calculation
            const parsedMessage = MessageParser.parseMessage(userMessage);
            let replyText;
            
            if (parsedMessage) {
                const { paperSize, color, sides, pages } = parsedMessage;
                const result = priceService.calculatePrice(paperSize, color, sides, pages);
                replyText = result.success ? result.details : result.message;
            } else {
                // Provide guidance for unrecognized messages
                replyText = \`🤔 ไม่เข้าใจคำถามของคุณ กรุณาลองใช้:\\n\\n\` +
                    \`📝 รูปแบบ:\\n\` +
                    \`• "A4 ขาวดำ 50 หน้า"\\n\` +
                    \`• "A4 สี หน้าเดียว 20 หน้า"\\n\` +
                    \`• "ราคา" (ดูรายการทั้งหมด)\\n\\n\` +
                    \`💡 ระบุ: ขนาด สี หน้าพิมพ์ จำนวน\`;
            }

            // Limit message length for LINE
            if (replyText.length > 2000) {
                replyText = replyText.substring(0, 1900) + '...\\n\\nดูรายละเอียดเพิ่มเติมที่เว็บไซต์';
            }

            return lineService.replyMessage(event.replyToken, {
                type: 'text',
                text: replyText
            });

        } catch (error) {
            console.error('💥 LINE Event Handler Error:', error);
            return lineService.replyMessage(event.replyToken, {
                type: 'text',
                text: 'ขออภัย เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง'
            });
        }
    }
}

// Health check endpoint
app.get('/health', (req, res) => {
    const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
            web: '✅ Running',
            lineBot: lineService.isEnabled ? '✅ Ready' : '⚠️  Disabled',
            geminiAI: geminiService.isEnabled ? '✅ Ready' : '⚠️  Disabled',
            priceData: Object.keys(priceService.priceData).length > 0 ? \`✅ Loaded (\${Object.keys(priceService.priceData).length} entries)\` : '❌ Missing'
        },
        environment: config.nodeEnv,
        port: config.port,
        priceDataEntries: Object.keys(priceService.priceData).length,
        geminiRequests: geminiService.requestCount || 0
    };
    res.json(health);
});

// API endpoint to get price data
app.get('/api/prices', (req, res) => {
    try {
        const formattedPrices = Object.keys(priceService.priceData).map(key => {
            const [size, color, sides] = key.split('_');
            return {
                paperSize: size,
                color: color,
                sides: sides,
                pricePerPage: priceService.priceData[key],
                description: \`\${size} \${color === 'BW' ? 'ขาวดำ' : 'สี'} \${sides === 'Single' ? 'หน้าเดียว' : 'สองหน้า'}\`
            };
        });
        
        res.json({
            success: true,
            data: formattedPrices,
            count: formattedPrices.length
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve price data'
        });
    }
});

// API endpoint for price calculation
app.post('/api/calculate', (req, res) => {
    try {
        const { paperSize, color, sides, pages } = req.body;
        
        if (!paperSize || !color || !sides || !pages) {
            return res.status(400).json({
                success: false,
                error: 'Missing required parameters: paperSize, color, sides, pages'
            });
        }

        const result = priceService.calculatePrice(paperSize, color, sides, pages);
        
        if (result.success) {
            res.json({
                success: true,
                data: {
                    paperSize,
                    color,
                    sides,
                    pages: parseInt(pages),
                    pricePerPage: result.pricePerPage,
                    totalPrice: result.totalPrice,
                    details: result.details
                }
            });
        } else {
            res.status(400).json({
                success: false,
                error: result.message
            });
        }
    } catch (error) {
        console.error('💥 Calculate API Error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Endpoint not found',
        availableEndpoints: [
            'GET /',
            'POST /chat',
            'POST /webhook',
            'GET /health',
            'GET /api/prices',
            'POST /api/calculate'
        ]
    });
});

// Global error handler
app.use((error, req, res, next) => {
    console.error('💥 Global Error Handler:', error);
    
    if (error.type === 'entity.parse.failed') {
        return res.status(400).json({
            error: 'Invalid JSON format'
        });
    }
    
    if (error.type === 'entity.too.large') {
        return res.status(413).json({
            error: 'Request entity too large'
        });
    }
    
    res.status(500).json({
        error: 'Internal server error',
        ...(config.nodeEnv === 'development' && { details: error.message })
    });
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🔄 Received SIGTERM, shutting down gracefully...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('🔄 Received SIGINT, shutting down gracefully...');
    process.exit(0);
});

process.on('uncaughtException', (error) => {
    console.error('💥 Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start server
const server = app.listen(config.port, () => {
    console.log('\\n🚀 Server Started Successfully!');
    console.log('='.repeat(60));
    console.log(\`🌐 Server URL: http://localhost:\${config.port}\`);
    console.log(\`📱 Environment: \${config.nodeEnv}\`);
    console.log(\`⏰ Started at: \${new Date().toLocaleString('th-TH')}\`);
    console.log('='.repeat(60));
    console.log('📊 Service Status:');
    console.log(\`├── 🌐 Web Interface: ✅ Ready\`);
    console.log(\`├── 🤖 LINE Bot: \${lineService.isEnabled ? '✅ Ready' : '⚠️  Disabled (no credentials)'}\`);
    console.log(\`├── 🧠 Gemini AI: \${geminiService.isEnabled ? '✅ Ready (Flash model)' : '⚠️  Disabled (no API key)'}\`);
    console.log(\`└── 💰 Price Data: \${Object.keys(priceService.priceData).length} entries loaded\`);
    console.log('='.repeat(60));
    console.log('📚 Available Endpoints:');
    console.log('├── GET  /           - Web Interface');
    console.log('├── POST /chat       - Chat API');
    console.log('├── POST /webhook    - LINE Webhook');
    console.log('├── GET  /health     - Health Check');
    console.log('├── GET  /api/prices - Price List API');
    console.log('└── POST /api/calculate - Price Calculation API');
    console.log('='.repeat(60));
    
    // Log price data for debugging
    console.log('💰 Current Price Data:');
    Object.keys(priceService.priceData).forEach(key => {
        const [size, color, sides] = key.split('_');
        console.log(\`   • \${size} \${color === 'BW' ? 'ขาวดำ' : 'สี'} \${sides === 'Single' ? '1หน้า' : '2หน้า'}: \${priceService.priceData[key]} บาท\`);
    });
    console.log('='.repeat(60));
});

// Handle server errors
server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error(\`❌ Port \${config.port} is already in use. Please try a different port.\`);
        process.exit(1);
    } else {
        console.error('❌ Server error:', error);
        process.exit(1);
    }
});

module.exports = app;
