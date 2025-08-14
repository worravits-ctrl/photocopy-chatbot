# 🤖 แชทบอทร้านถ่ายเอกสาร เจ้เก่า

แชทบอท LINE สำหรับคำนวณราคาถ่ายเอกสาร พร้อมระบบจัดการคำสั่งแบบ Interactive

## ✨ ฟีเจอร์

- 💰 คำนวณราคาถ่ายเอกสาร (A3, A4, A5)
- 🎨 รองรับทั้งขาวดำและสี
- 📄 รองรับหน้าเดียว/หน้าหลัง
- 🎉 ระบบส่วนลดสำหรับจำนวนมาก
- ⏰ แสดงเวลาทำการ
- 📍 แสดงที่อยู่และเบอร์ติดต่อ
- 🌐 หน้าเว็บ Dashboard
- 📊 API ตารางราคา

## 🚀 วิธี Deploy

### 1. เตรียมไฟล์

สร้างไฟล์ต่อไปนี้ในโปรเจ็กต์:
- `app.js` (ไฟล์หลัก)
- `package.json` 
- `railway.toml`
- `.gitignore`
- `.env.example`
- `price_table.xlsx` (ถ้ามี)

### 2. Deploy บน Railway

1. สมัคร/เข้าสู่ระบบ [Railway](https://railway.app)
2. เชื่อมต่อกับ GitHub
3. สร้าง New Project → Deploy from GitHub repo
4. เลือก repository ของคุณ
5. รอ deploy เสร็จ (~2-3 นาที)

### 3. ตั้งค่า Environment Variables

ใน Railway Dashboard → Variables:
```
CHANNEL_ACCESS_TOKEN=your_line_channel_access_token
CHANNEL_SECRET=your_line_channel_secret
PORT=3000
NODE_ENV=production
```

### 4. รับ URL

หลัง deploy เสร็จ จะได้ URL ประมาณ:
```
https://your-app-name.up.railway.app
```

## 🔗 LINE Bot Setup

### 1. สร้าง LINE Bot

1. เข้า [LINE Developers Console](https://developers.line.biz)
2. สร้าง Provider (ถ้ายังไม่มี)
3. สร้าง Channel → Messaging API
4. กรอกข้อมูล:
   - Channel name: `ร้านถ่ายเอกสาร เจ้เก่า`
   - Channel description: `แชทบอทคำนวณราคาถ่ายเอกสาร`
   - Category: `Others`
   - Subcategory: `Others`

### 2. ตั้งค่า Webhook

1. ในหน้า Channel → Messaging API
2. Webhook URL: `https://your-app-name.up.railway.app/webhook`
3. เปิด "Use webhook" = Enabled
4. เปิด "Auto-reply messages" = Disabled
5. เปิด "Greeting messages" = Disabled

### 3. รับ Credentials

1. **Channel Secret**: ในหน้า Basic settings
2. **Channel Access Token**: ในหน้า Messaging API → สร้างใหม่

### 4. อัปเดต Environment Variables

ใส่ค่าที่ได้ใน Railway → Variables

## 🌐 Endpoints

- `GET /` - หน้าแรก (JSON status)
- `GET /test` - Dashboard หน้าเว็บ
- `GET /status` - สถานะเซิร์ฟเวอร์
- `GET /api/prices` - ตารางราคา (JSON)
- `POST /webhook` - LINE Bot webhook

## 💬 คำสั่งที่รองรับ

- `สวัสดี`, `hello`, `hi` - ข้อความต้อนรับ
- `คิดราคา` - เริ่มคำนวณราคา
- `เวลาเปิด` - ดูเวลาทำการ
- `ที่อยู่` - ดูที่อยู่ร้าน
- `โทร` - ดูเบอร์ติดต่อ
- `ยกเลิก` - หยุดคำสั่งปัจจุบัน

## 🏪 การปรับแต่งข้อมูลร้าน

แก้ไขใน `app.js`:

```javascript
const shopInfo = {
  name: "ชื่อร้านของคุณ",
  openTime: "08:00",
  closeTime: "18:00",
  phone: "0xx-xxx-xxxx",
  address: "ที่อยู่ร้านของคุณ"
};
```

## 💰 การปรับราคา

แก้ไข `priceTable` ใน `app.js` หรือสร้างไฟล์ `price_table.xlsx`

### รูปแบบ Excel:

| ขนาด | ประเภท | รูปแบบ | ราคา |
|------|--------|--------|------|
| A4   | ขาวดำ  | หน้าเดียว | 1 |
| A4   | ขาวดำ  | หน้าหลัง | 1.5 |
| A4   | สี     | หน้าเดียว | 5 |

## 🐛 การแก้ปัญหา

### Bot ไม่ตอบ
1. ตรวจสอบ Webhook URL
2. ตรวจสอบ CHANNEL_ACCESS_TOKEN และ CHANNEL_SECRET
3. ดู logs ใน Railway

### Deploy ล้มเหลว
1. ตรวจสอบ package.json
2. ตรวจสอบ Node.js version
3. ตรวจสอบ dependencies

### ราคาไม่ถูกต้อง
1. ตรวจสอบ priceTable ใน app.js
2. ตรวจสอบไฟล์ price_table.xlsx

## 📞 ติดต่อ

หากมีปัญหาการใช้งาน สามารถติดต่อได้ที่:
- 📧 Email: your-email@example.com
- 📱 LINE: @your-line-id

## 📄 License

MIT License - ใช้งานได้อย่างอิสระ

---

⭐ ถ้าโปรเจ็กต์นี้มีประโยชน์ อย่าลืม Star ให้ด้วยนะครับ!