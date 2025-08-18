# 🤖 แชทบอทร้านถ่ายเอกสาร It-Business

แชทบอท LINE AI-powered สำหรับคำนวณราคาถ่ายเอกสาร พร้อมระบบจัดการแบบ Interactive และ Web Dashboard

## ✨ ฟีเจอร์หลัก

- 💰 **คำนวณราคาอัตโนมัติ** - A3, A4, A5 (ขาวดำ/สี, หน้าเดียว/หน้าหลัง)
- 🎉 **ระบบส่วนลด** - 100+ แผ่น (10%), 500+ แผ่น (15%), 1000+ แผ่น (20%)
- ⏰ **ตรวจสอบเวลาทำการ** - แสดงสถานะเปิด/ปิดแบบ real-time
- 🤖 **Gemini AI** - ตอบคำถามทั่วไปเกี่ยวกับร้าน
- 🌐 **Web Dashboard** - หน้าเว็บสวยงามสำหรับทดสอบ
- 📊 **API ตารางราคา** - ดึงข้อมูลราคาแบบ JSON
- 📍 **ข้อมูลร้าน** - ที่อยู่, เบอร์โทร, เวลาทำการ

## 🛠 เทคโนโลยีที่ใช้

- **Backend**: Node.js, Express.js
- **AI**: Google Gemini 1.5 Flash
- **Database**: Excel file (XLSX)
- **Frontend**: HTML5, CSS3, JavaScript
- **Hosting**: Railway, Render, Heroku
- **API**: LINE Messaging API

## 📁 โครงสร้างโปรเจ็กต์

```
photocopy-chatbot/
├── app.js                 # ไฟล์หลัก
├── package.json           # Dependencies
├── package-lock.json      # Lock file
├── .env                   # Environment variables (ห้ามอัปโหลด)
├── .env.example          # ตัวอย่าง env
├── .gitignore            # ไฟล์ที่ไม่ต้องอัปโหลด
├── railway.toml          # การตั้งค่า Railway
├── prices.xlsx           # ตารางราคา (ถ้ามี)
└── README.md             # คู่มือนี้
```

## 🚀 ขั้นตอนการติดตั้งและ Deploy

### 1. เตรียมโปรเจ็กต์ใน VS Code

#### 1.1 สร้างโฟลเดอร์ใหม่
```bash
mkdir photocopy-chatbot
cd photocopy-chatbot
```

#### 1.2 เปิด VS Code
```bash
code .
```

#### 1.3 สร้างไฟล์สำคัญ
สร้างไฟล์ต่อไปนี้ใน VS Code:

**`package.json`**
```json
{
  "name": "photocopy-chatbot-ai",
  "version": "2.0.0",
  "description": "LINE Bot สำหรับคำนวณราคาถ่ายเอกสาร พร้อม Gemini AI",
  "main": "app.js",
  "scripts": {
    "start": "node app.js",
    "dev": "nodemon app.js"
  },
  "dependencies": {
    "@line/bot-sdk": "^8.0.0",
    "express": "^4.18.2",
    "dotenv": "^16.3.1",
    "xlsx": "^0.18.5",
    "node-fetch": "^3.3.2"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  },
  "engines": {
    "node": ">=18.0.0"
  },
  "keywords": ["line-bot", "chatbot", "photocopy", "thai"],
  "author": "Your Name",
  "license": "MIT"
}
```

**`.env.example`**
```env
# LINE Bot Configuration
LINE_CHANNEL_ACCESS_TOKEN=your_channel_access_token_here
LINE_CHANNEL_SECRET=your_channel_secret_here

# Gemini AI Configuration  
GEMINI_API_KEY=your_gemini_api_key_here

# Server Configuration
PORT=3000
NODE_ENV=development

# Timezone
TZ=Asia/Bangkok
```

**`.gitignore`**
```gitignore
# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Runtime data
pids
*.pid
*.seed
*.pid.lock

# Directory for instrumented libs
lib-cov

# Coverage directory used by tools like istanbul
coverage/
*.lcov

# nyc test coverage
.nyc_output

# Grunt intermediate storage
.grunt

# Bower dependency directory
bower_components

# node-waf configuration
.lock-wscript

# Compiled binary addons
build/Release

# Dependency directories
jspm_packages/

# TypeScript v1 declaration files
typings/

# Optional npm cache directory
.npm

# Optional eslint cache
.eslintcache

# Optional REPL history
.node_repl_history

# Output of 'npm pack'
*.tgz

# Yarn Integrity file
.yarn-integrity

# dotenv environment variables file
.env

# parcel-bundler cache
.cache
.parcel-cache

# next.js build output
.next

# nuxt.js build output
.nuxt

# vuepress build output
.vuepress/dist

# Serverless directories
.serverless

# FuseBox cache
.fusebox/

# DynamoDB Local files
.dynamodb/

# TernJS port file
.tern-port

# Stores VSCode versions used for testing VSCode extensions
.vscode-test

# OS generated files
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db

# Logs
logs
*.log

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# Temporary files
tmp/
temp/
```

**`railway.toml`**
```toml
[build]
builder = "NIXPACKS"

[deploy]
healthcheckPath = "/health"
healthcheckTimeout = 100
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10

[env]
NODE_ENV = "production"
TZ = "Asia/Bangkok"
```

#### 1.4 คัดลอกโค้ด app.js
คัดลอกโค้ดทั้งหมดจากไฟล์ `app.js` ที่คุณมีอยู่ไปใส่ในไฟล์ใหม่

### 2. การอัปโหลดไป GitHub

#### 2.1 ติดตั้ง Git (ถ้ายังไม่มี)
```bash
# ตรวจสอบว่ามี git แล้วหรือยัง
git --version

# ถ้ายังไม่มี ให้ติดตั้ง
# Windows: ดาวน์โหลดจาก https://git-scm.com/
# macOS: brew install git
# Ubuntu: sudo apt install git
```

#### 2.2 ตั้งค่า Git (ครั้งแรกเท่านั้น)
```bash
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

#### 2.3 สร้าง Repository ใน GitHub
1. เข้า [GitHub.com](https://github.com)
2. คลิก **"New repository"** (ปุ่มสีเขียว)
3. กรอกข้อมูล:
   - **Repository name**: `photocopy-chatbot`
   - **Description**: `LINE Bot สำหรับคำนวณราคาถ่ายเอกสาร พร้อม AI`
   - เลือก **Public** หรือ **Private**
   - ✅ **Add a README file** (ติ๊กถ้าต้องการ)
   - เลือก **.gitignore template**: `Node`
   - เลือก **License**: `MIT License`
4. คลิก **"Create repository"**

#### 2.4 อัปโหลดโค้ดจาก VS Code

**วิธีที่ 1: ใช้ VS Code Git Extension (แนะนำ)**

1. เปิด **Source Control** ใน VS Code (Ctrl+Shift+G)
2. คลิค **"Initialize Repository"**
3. เพิ่มไฟล์ทั้งหมด:
   - คลิก **"+"** ข้าง **Changes**
   - หรือคลิก **"Stage All Changes"**
4. เขียนข้อความ commit:
   ```
   🎉 Initial commit: AI-powered photocopy chatbot
   
   Features:
   - LINE Bot integration
   - Gemini AI support  
   - Price calculation
   - Real-time shop status
   - Web dashboard
   ```
5. คลิก **"Commit"**
6. คลิก **"Publish Branch"**
7. เลือก **GitHub** และเข้าสู่ระบบ
8. เลือก repository ที่สร้างไว้

**วิธีที่ 2: ใช้ Terminal**

```bash
# 1. สร้าง git repository
git init

# 2. เพิ่ม remote repository (แทน YOUR_USERNAME ด้วยชื่อจริง)
git remote add origin https://github.com/YOUR_USERNAME/photocopy-chatbot.git

# 3. สร้างไฟล์ .env และใส่ค่าจริง (ห้ามอัปโหลด)
cp .env.example .env
# แก้ไขไฟล์ .env ด้วย VS Code

# 4. เพิ่มไฟล์ทั้งหมด
git add .

# 5. Commit
git commit -m "🎉 Initial commit: AI-powered photocopy chatbot

Features:
- LINE Bot integration  
- Gemini AI support
- Price calculation
- Real-time shop status
- Web dashboard"

# 6. สร้าง main branch และ push
git branch -M main
git push -u origin main
```

#### 2.5 ตรวจสอบการอัปโหลด
1. รีเฟรช GitHub repository page
2. ควรเห็นไฟล์ทั้งหมดยกเว้น `.env`
3. README.md จะแสดงอัตโนมัติ

### 3. การตั้งค่า Environment Variables

#### 3.1 สร้างไฟล์ .env (ใน VS Code)
```env
LINE_CHANNEL_ACCESS_TOKEN=YOUR_ACTUAL_TOKEN_HERE
LINE_CHANNEL_SECRET=YOUR_ACTUAL_SECRET_HERE
GEMINI_API_KEY=YOUR_ACTUAL_GEMINI_KEY_HERE
PORT=3000
NODE_ENV=development
TZ=Asia/Bangkok
```

#### 3.2 รับ LINE Bot Credentials
1. ไป [LINE Developers Console](https://developers.line.biz)
2. สร้าง **Provider** ใหม่ (ถ้ายังไม่มี)
3. สร้าง **Messaging API Channel**:
   - **Channel name**: `ร้านถ่ายเอกสาร It-Business`
   - **Channel description**: `แชทบอทคำนวณราคาถ่ายเอกสาร`
   - **Category**: `Business`
   - **Subcategory**: `Printing/Publishing`
4. รับ **Channel Secret** จากแท็บ **Basic settings**
5. รับ **Channel Access Token** จากแท็บ **Messaging API**

#### 3.3 รับ Gemini API Key
1. ไป [Google AI Studio](https://aistudio.google.com/app/apikey)
2. สร้าง **API Key** ใหม่
3. คัดลอก key มาใส่ใน `.env`

### 4. Deploy ไปยัง Railway

#### 4.1 สร้างบัญชี Railway
1. ไป [Railway.app](https://railway.app)
2. สมัครด้วย GitHub account
3. ยืนยัน email

#### 4.2 Deploy โปรเจ็กต์
1. คลิก **"New Project"**
2. เลือก **"Deploy from GitHub repo"**
3. เลือก repository `photocopy-chatbot`
4. Railway จะ build และ deploy อัตโนมัติ

#### 4.3 ตั้งค่า Environment Variables ใน Railway
1. เข้า **Project Dashboard**
2. คลิกแท็บ **"Variables"**
3. เพิ่มตัวแปรทั้งหมด:
   ```
   LINE_CHANNEL_ACCESS_TOKEN=your_token
   LINE_CHANNEL_SECRET=your_secret  
   GEMINI_API_KEY=your_gemini_key
   PORT=3000
   NODE_ENV=production
   TZ=Asia/Bangkok
   ```

#### 4.4 รับ URL ของแอป
1. ในหน้า **Deployments**
2. คัดลอก URL ที่แสดง (เช่น `https://your-app.up.railway.app`)

### 5. ตั้งค่า LINE Bot Webhook

#### 5.1 กำหนด Webhook URL
1. กลับไป LINE Developers Console
2. เข้าแท็บ **Messaging API**
3. ใส่ **Webhook URL**: `https://your-app.up.railway.app/webhook`
4. เปิด **"Use webhook"** = ✅ **Enabled**
5. คลิก **"Verify"** เพื่อทดสอบ

#### 5.2 ปิด Auto Reply
1. **Auto-reply messages** = ❌ **Disabled**
2. **Greeting messages** = ❌ **Disabled**

### 6. ทดสอบระบบ

#### 6.1 ทดสอบ Web Dashboard
เข้า: `https://your-app.up.railway.app`

#### 6.2 ทดสอบ LINE Bot
1. สแกน QR Code ใน LINE Developers Console
2. ลองส่งข้อความ: `สวัสดี`
3. ลองคำนวณราคา: `A4 ขาวดำ หน้าเดียว 100 แผ่น`

#### 6.3 ตรวจสอบ Logs
ใน Railway Dashboard → **Deployments** → คลิก deployment ล่าสุด → ดู **Logs**

## 🔧 การปรับแต่ง

### 📊 แก้ไขตารางราคา

แก้ไขใน `app.js` ส่วน `priceList`:
```javascript
priceList = [
    { ขนาด: 'A4', ประเภท: 'ขาวดำ', รูปแบบ: 'หน้าเดียว', ราคา: 2 },
    { ขนาด: 'A4', ประเภท: 'ขาวดำ', รูปแบบ: 'หน้าหลัง', ราคา: 2.5 },
    // เพิ่มรายการอื่นๆ...
];
```

### 🏪 แก้ไขข้อมูลร้าน

แก้ไขใน `app.js` ฟังก์ชัน `getBusinessContext()`:
```javascript
ข้อมูลร้าน:
- ชื่อร้าน: ชื่อร้านใหม่
- ที่อยู่: ที่อยู่ใหม่
- โทร: เบอร์โทรใหม่
```

### ⏰ แก้ไขเวลาทำการ

แก้ไขใน `app.js` ฟังก์ชัน `getCurrentDateInfo()`:
```javascript
if (day >= 1 && day <= 5) { // จันทร์-ศุกร์
    isOpen = (hour >= 8 && hour < 17); // 08:00-17:00
} else if (day === 6) { // เสาร์
    isOpen = (hour >= 9 && hour < 17); // 09:00-17:00
}
```

## 🌐 Endpoints API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Web Dashboard |
| `/health` | GET | สุขภาพเซิร์ฟเวอร์ |
| `/chat` | POST | Chat API สำหรับ web |
| `/api/prices` | GET | ตารางราคา JSON |
| `/webhook` | POST | LINE Bot webhook |

### ตัวอย่างการใช้ API

**ดึงตารางราคา:**
```bash
curl https://your-app.up.railway.app/api/prices
```

**ส่งข้อความผ่าน Web:**
```bash
curl -X POST https://your-app.up.railway.app/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "A4 ขาวดำ 100 แผ่น"}'
```

## 🎨 การปรับแต่ง UI

### แก้ไขสี Theme
ใน `app.js` ส่วน CSS:
```css
:root {
    --primary: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    --secondary: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
    /* เปลี่ยนสีได้ตรงนี้ */
}
```

### เพิ่ม Quick Actions
ใน `app.js` ส่วน HTML:
```html
<div class="quick-btn" onclick="sendQuickMessage('ข้อความใหม่')">
    <i class="fas fa-icon-name"></i>
    <span>ปุ่มใหม่</span>
</div>
```

## 🔍 การแก้ปัญหา

### ❌ Bot ไม่ตอบ
1. ตรวจสอบ Webhook URL ถูกต้อง
2. ตรวจสอบ Environment Variables
3. ดู Logs ใน Railway:
   ```
   Railway Dashboard → Deployments → Latest → Logs
   ```

### ❌ Deploy ล้มเหลว
1. ตรวจสอบ `package.json` ถูกต้อง
2. ตรวจสอบ Node.js version:
   ```json
   "engines": {
     "node": ">=18.0.0"
   }
   ```
3. ตรวจสอบ dependencies:
   ```bash
   npm install
   npm start
   ```

### ❌ Gemini AI ไม่ทำงาน
1. ตรวจสอบ `GEMINI_API_KEY` ถูกต้อง
2. ตรวจสอบ quota ใน Google AI Studio
3. ดู error logs:
   ```javascript
   console.error('Gemini AI Error:', error);
   ```

### ❌ เวลาไม่ถูกต้อง
1. ตรวจสอบ `TZ=Asia/Bangkok` ใน Environment Variables
2. ดู debug logs:
   ```
   === Debug Shop Hours ===
   Bangkok Time: xx:xx
   ```

### ❌ ราคาผิด
1. ตรวจสอบ `priceList` ใน `app.js`
2. ตรวจสอบ key format:
   ```javascript
   const key = `${ขนาด}_${ประเภท}_${รูปแบบ}`;
   ```

## 📈 การอัปเดตโค้ด

### จาก VS Code
1. แก้ไขไฟล์ใน VS Code
2. เปิด **Source Control** (Ctrl+Shift+G)
3. Stage changes (+)
4. เขียน commit message
5. Commit & Push

### จาก Terminal
```bash
# แก้ไขไฟล์
git add .
git commit -m "✨ เพิ่มฟีเจอร์ใหม่"
git push origin main
```

Railway จะ auto-deploy เมื่อมีการ push ใหม่

## 🚀 ทางเลือก Hosting อื่นๆ

### Render.com
```bash
# ไม่ต้องการ railway.toml
# สร้าง render.yaml แทน
services:
  - type: web
    name: photocopy-chatbot
    env: node
    buildCommand: npm install
    startCommand: npm start
```

### Heroku
```bash
# สร้าง Procfile
echo "web: npm start" > Procfile
git add Procfile
git commit -m "Add Procfile for Heroku"
```

### DigitalOcean App Platform
```yaml
# สร้าง .do/app.yaml
name: photocopy-chatbot
services:
- name: web
  source_dir: /
  github:
    repo: YOUR_USERNAME/photocopy-chatbot
    branch: main
  run_command: npm start
  environment_slug: node-js
  instance_count: 1
  instance_size_slug: basic-xxs
```

## 📱 LINE Bot Features

### คำสั่งที่รองรับ
- **คำนวณราคา**: `A4 ขาวดำ หน้าเดียว 100 แผ่น`
- **ดูเวลา**: `วันนี้วันอะไร`, `กี่โมงแล้ว`, `ร้านเปิดหรือยัง`
- **ดูราคา**: `ตารางราคา`, `ราคาทั้งหมด`
- **ข้อมูลร้าน**: `ที่อยู่`, `เบอร์โทร`, `เวลาทำการ`
- **บริการอื่น**: `เข้าเล่ม`, `สแกน`, `ลามิเนต`, `พิมพ์ภาพ`

### ระบบ AI
- ใช้ **Gemini 1.5 Flash** ตอบคำถามทั่วไป
- Context ข้อมูลร้านครบถ้วน
- ตอบด้วยภาษาไทยที่สุภาพ

## 📊 Monitoring & Analytics

### ดู Usage Stats
```javascript
// เพิ่มใน app.js
let stats = {
    totalRequests: 0,
    priceCalculations: 0,
    uniqueUsers: new Set()
};

// Track ใน webhook
stats.totalRequests++;
stats.uniqueUsers.add(event.source.userId);
```

### Log Analysis
```bash
# ใน Railway/Render logs
grep "price calculation" logs.txt
grep "error" logs.txt | wc -l
```

## 🔐 Security Best Practices

### Environment Variables
- ไม่เก็บ secrets ใน code
- ใช้ `.env` สำหรับ development เท่านั้น
- ตั้งค่าใน hosting platform สำหรับ production

### LINE Bot Security
- ตรวจสอบ signature ใน webhook:
```javascript
const crypto = require('crypto');

function validateSignature(body, signature) {
    const hash = crypto
        .createHmac('SHA256', process.env.LINE_CHANNEL_SECRET)
        .update(body)
        .digest('base64');
    return hash === signature;
}
```

## 🎯 Next Steps

### ฟีเจอร์ที่ควรเพิ่ม
- 📊 **Analytics Dashboard** - สถิติการใช้งาน
- 💾 **Database Integration** - เก็บประวัติลูกค้า
- 📧 **Email Notifications** - แจ้งเตือนออเดอร์ใหม่
- 🛒 **Order Management** - ระบบรับออเดอร์
- 📱 **Rich Menu** - เมนูใน LINE Bot
- 🔔 **Push Messages** - ส่งโปรโมชั่น

### การปรับปรุงเพิ่มเติม
- ✅ Unit Tests
- ✅ Error Monitoring (Sentry)
- ✅ Rate Limiting
- ✅ Database (MongoDB/PostgreSQL)
- ✅ Admin Panel
- ✅ Multi-language support

## 📞 การสนับสนุน

### ถ้ามีปัญหา
1. ตรวจสอบ **Issues** ใน GitHub repository
2. สร้าง **New Issue** พร้อมรายละเอียด:
   - ขั้นตอนที่ทำ
   - Error message ที่ได้
   - Screenshots (ถ้ามี)
   - Environment (Railway/Render/etc.)

### ติดต่อ
- 📧 **Email**: your-email@example.com
- 💬 **LINE**: @your-line-id
- 🐙 **GitHub**: [@your-username](https://github.com/your-username)

## 📄 License

MIT License - ใช้งานและแก้ไขได้อย่างอิสระ

```
Copyright (c) 2025 Your Name

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## 🌟 สนับสนุนโปรเจ็กต์

ถ้าโปรเจ็กต์นี้มีประโยชน์กับคุณ:
- ⭐ **Star** repository ใน GitHub
- 🍴 **Fork** เพื่อพัฒนาต่อ
- 🐛 **Report bugs** ผ่าน Issues
- 💡 **Suggest features** ใหม่ๆ
- 📢 **แชร์** ให้เพื่อนๆ

**Happy Coding! 🚀**