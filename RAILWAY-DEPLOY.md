# 🤖 It-Business Photocopy Chatbot

LINE Bot สำหรับคำนวณราคาถ่ายเอกสาร พร้อม Gemini AI Assistant และระบบโปรโมชั่นพิเศษ

## ✨ Features

- 🖨️ คำนวณราคาถ่ายเอกสาร (A3, A4, A5)
- 🌟 โปรโมชั่นพิเศษ: 5 บาท/แผ่น สำหรับไม่เกิน 5 แผ่น
- 🤖 Gemini AI Assistant
- 📱 LINE Bot Integration
- 🧠 Conversation Memory System
- 💰 ระบบส่วนลดอัตโนมัติ
- 📊 Live Status Monitoring

## 🚀 Quick Deploy to Railway

### 1. Fork this repository

### 2. Connect to Railway
1. ไปที่ [Railway.app](https://railway.app)
2. Login และสร้าง New Project
3. เลือก "Deploy from GitHub repo"
4. เลือก repository นี้

### 3. Set Environment Variables
ในหน้า Railway dashboard ให้ตั้งค่า Environment Variables:

```bash
# Required for LINE Bot
LINE_CHANNEL_ACCESS_TOKEN=your_line_channel_access_token
LINE_CHANNEL_SECRET=your_line_channel_secret

# Optional for AI features  
GEMINI_API_KEY=your_gemini_api_key

# Auto-set by Railway
PORT=3000
NODE_ENV=production
```

### 4. Deploy
Railway จะ deploy อัตโนมัติ! 🎉

## 📋 Environment Variables Guide

### LINE Bot Setup
1. ไปที่ [LINE Developers](https://developers.line.biz/)
2. สร้าง Channel ใหม่ (Messaging API)
3. ได้รับ Channel Access Token และ Channel Secret
4. ตั้ง Webhook URL เป็น: `https://your-app-domain.railway.app/webhook`

### Gemini AI Setup (Optional)
1. ไปที่ [Google AI Studio](https://makersuite.google.com/)
2. สร้าง API Key สำหรับ Gemini
3. ใส่ใน GEMINI_API_KEY

## 🔧 Local Development

```bash
# Clone repository
git clone https://github.com/worravits-ctrl/photocopy-chatbot.git
cd photocopy-chatbot

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your credentials

# Start development server
npm run dev
```

## 📊 API Endpoints

- `POST /webhook` - LINE Bot webhook
- `POST /chat` - Web chat interface
- `GET /api/shop-status` - Shop operating hours
- `GET /api/memory-stats` - Memory usage statistics
- `GET /health` - Health check

## 🎯 Usage Examples

### คำนวณราคาถ่ายเอกสาร
```
- "ถ่าย A4 ขาวดำ 10 แผ่น"
- "ถ่าย 4 แผ่น" (ใช้โปรโมชั่นอัตโนมัติ)
- "A3 สี สองหน้า 50 แผ่น"
```

### ดูข้อมูลร้าน
```
- "โปรโมชั่นมีอะไรบ้าง"
- "ดูราคา"
- "เวลาทำการ"
- "เบอร์โทร"
```

## 🏪 Shop Information

- 📞 เบอร์โทร: 093-5799850
- ⏰ เวลาทำการ: จันทร์-ศุกร์ 09:00-16.30, เสาร์ 09:00-15:00
- 🎉 โปรโมชั่นพิเศษ: ≤ 5 แผ่น = 5 บาท/แผ่น

## 📈 Monitoring

ระบบมี live monitoring:
- 🟢 LINE Bot Status
- 🟢 Gemini AI Status  
- 📊 Active Sessions
- 💾 Memory Usage
- 🏪 Shop Status

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License.

---

Made with ❤️ for It-Business Photocopy Shop