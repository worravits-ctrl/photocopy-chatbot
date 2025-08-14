require('dotenv').config(); // โหลดค่าจาก .env file

const line = require('@line/bot-sdk');
const express = require('express');
const XLSX = require('xlsx');
const path = require('path');

// Configuration - ใช้ Environment Variables
const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET
};

const client = new line.Client(config);
const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public')); // เสิร์ฟไฟล์ static

// ข้อมูลร้าน - แก้ไขเป็นข้อมูลจริงของคุณ
const shopInfo = {
  name: "ร้านถ่ายเอกสาร เจ้เก่า",
  openTime: "08:00",
  closeTime: "18:00",
  phone: "081-234-5678",
  address: "123 ถนนรัชดาภิเษก แขวงลาดยาว เขตจตุจักร กรุงเทพฯ 10900"
};

// ตารางราคาพื้นฐาน (จะโหลดจาก Excel ทีหลัง)
let priceTable = {
  "A4": {
    "ขาวดำ": { "หน้าเดียว": 1, "หน้าหลัง": 1.5 },
    "สี": { "หน้าเดียว": 5, "หน้าหลัง": 8 }
  },
  "A3": {
    "ขาวดำ": { "หน้าเดียว": 3, "หน้าหลัง": 5 },
    "สี": { "หน้าเดียว": 12, "หน้าหลัง": 20 }
  },
  "A5": {
    "ขาวดำ": { "หน้าเดียว": 0.5, "หน้าหลัง": 1 },
    "สี": { "หน้าเดียว": 3, "หน้าหลัง": 5 }
  }
};

// เก็บสถานะการสนทนาของแต่ละผู้ใช้
const userSessions = {};

// ===================== ROUTES =====================

// หน้าแรก - Dashboard
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    message: 'แชทบอทร้านถ่ายเอกสารกำลังทำงาน',
    shop: shopInfo,
    endpoints: {
      webhook: '/webhook',
      status: '/status',
      prices: '/api/prices',
      test: '/test'
    },
    timestamp: new Date().toLocaleString('th-TH', {
      timeZone: 'Asia/Bangkok'
    })
  });
});

// หน้าสถานะ
app.get('/status', (req, res) => {
  res.json({
    server: 'running',
    shop: shopInfo.name,
    hours: `${shopInfo.openTime} - ${shopInfo.closeTime}`,
    priceTableLoaded: Object.keys(priceTable).length > 0,
    activeSessions: Object.keys(userSessions).length,
    timestamp: new Date().toLocaleString('th-TH', {
      timeZone: 'Asia/Bangkok'
    })
  });
});

// API แสดงตารางราคา
app.get('/api/prices', (req, res) => {
  res.json({
    success: true,
    data: priceTable,
    shop: shopInfo.name
  });
});

// หน้าทดสอบ
app.get('/test', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="th">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${shopInfo.name} - แชทบอท</title>
        <style>
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                max-width: 600px;
                margin: 50px auto;
                padding: 20px;
                background-color: #f5f5f5;
            }
            .container {
                background: white;
                padding: 30px;
                border-radius: 10px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            h1 {
                color: #1DB446;
                text-align: center;
                margin-bottom: 30px;
            }
            .status {
                background: #e8f5e8;
                padding: 15px;
                border-radius: 5px;
                margin-bottom: 20px;
                border-left: 4px solid #1DB446;
            }
            .info-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                gap: 20px;
                margin: 20px 0;
            }
            .info-card {
                background: #f9f9f9;
                padding: 15px;
                border-radius: 5px;
                border: 1px solid #ddd;
            }
            .endpoints {
                background: #fff3cd;
                padding: 15px;
                border-radius: 5px;
                border-left: 4px solid #ffc107;
            }
            .endpoint {
                margin: 10px 0;
                padding: 8px;
                background: white;
                border-radius: 3px;
                font-family: monospace;
            }
            a {
                color: #1DB446;
                text-decoration: none;
            }
            a:hover {
                text-decoration: underline;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🤖 ${shopInfo.name}</h1>
            
            <div class="status">
                <strong>✅ สถานะ: เซิร์ฟเวอร์ทำงานปกติ</strong><br>
                เวลา: ${new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}
            </div>

            <div class="info-grid">
                <div class="info-card">
                    <h3>📍 ข้อมูลร้าน</h3>
                    <p><strong>ชื่อ:</strong> ${shopInfo.name}</p>
                    <p><strong>เวลา:</strong> ${shopInfo.openTime} - ${shopInfo.closeTime} น.</p>
                    <p><strong>โทร:</strong> ${shopInfo.phone}</p>
                </div>
                
                <div class="info-card">
                    <h3>📊 สถิติ</h3>
                    <p><strong>ตารางราคา:</strong> โหลดสำเร็จ</p>
                    <p><strong>ขนาดที่รองรับ:</strong> ${Object.keys(priceTable).join(', ')}</p>
                    <p><strong>ผู้ใช้ออนไลน์:</strong> ${Object.keys(userSessions).length} คน</p>
                </div>
            </div>

            <div class="endpoints">
                <h3>🔗 API Endpoints</h3>
                <div class="endpoint">
                    <strong>GET</strong> <a href="/">/ </a> - หน้าแรก
                </div>
                <div class="endpoint">
                    <strong>GET</strong> <a href="/status">/status</a> - สถานะเซิร์ฟเวอร์
                </div>
                <div class="endpoint">
                    <strong>GET</strong> <a href="/api/prices">/api/prices</a> - ตารางราคา
                </div>
                <div class="endpoint">
                    <strong>POST</strong> /webhook - LINE Bot Webhook
                </div>
            </div>

            <div style="text-align: center; margin-top: 30px; color: #666;">
                <p>🚀 พัฒนาโดย LINE Bot SDK</p>
                <p><small>กำลังรอรับข้อความจาก LINE...</small></p>
            </div>
        </div>
    </body>
    </html>
  `);
});

// ===================== LINE BOT WEBHOOK =====================

// Webhook สำหรับ LINE Bot
app.post('/webhook', line.middleware(config), (req, res) => {
  Promise
    .all(req.body.events.map(handleEvent))
    .then((result) => res.json(result))
    .catch((err) => {
      console.error('❌ Webhook Error:', err);
      res.status(500).end();
    });
});

// ===================== HELPER FUNCTIONS =====================

// โหลดตารางราคาจาก Excel
function loadPriceTableFromExcel(filePath) {
  try {
    const workbook = XLSX.readFile(filePath);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(worksheet);
    
    const newPriceTable = {};
    data.forEach(row => {
      if (!newPriceTable[row.ขนาด]) {
        newPriceTable[row.ขนาด] = {};
      }
      if (!newPriceTable[row.ขนาด][row.ประเภท]) {
        newPriceTable[row.ขนาด][row.ประเภท] = {};
      }
      newPriceTable[row.ขนาด][row.ประเภท][row.รูปแบบ] = row.ราคา;
    });
    
    priceTable = newPriceTable;
    console.log("✅ โหลดตารางราคาจาก Excel สำเร็จ");
  } catch (error) {
    console.error("⚠️ ไม่สามารถโหลดตารางราคาจาก Excel:", error.message);
    console.log("📋 ใช้ราคาพื้นฐานแทน");
  }
}

// ===================== LINE BOT EVENT HANDLERS =====================

// จัดการ Events ต่างๆ
async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') {
    return Promise.resolve(null);
  }

  const userId = event.source.userId;
  const userMessage = event.message.text.toLowerCase();

  console.log(`👤 User ${userId.substring(0, 8)}...: ${event.message.text}`);

  // เริ่มต้น session ใหม่ถ้ายังไม่มี
  if (!userSessions[userId]) {
    userSessions[userId] = {
      state: 'idle',
      order: {},
      lastActivity: new Date()
    };
  }

  // อัปเดตเวลาใช้งานล่าสุด
  userSessions[userId].lastActivity = new Date();

  const session = userSessions[userId];
  let replyMessage;

  // จัดการคำสั่งต่างๆ
  if (userMessage.includes('สวัสดี') || userMessage.includes('hello') || userMessage.includes('hi')) {
    replyMessage = getWelcomeMessage();
  } else if (userMessage.includes('เวลา') || userMessage.includes('เปิด') || userMessage.includes('ปิด')) {
    replyMessage = getShopHours();
  } else if (userMessage.includes('ราคา') || userMessage.includes('คิด') || userMessage.includes('คำนวณ')) {
    session.state = 'calculating';
    session.order = {};
    replyMessage = startPriceCalculation();
  } else if (userMessage.includes('ที่อยู่') || userMessage.includes('ไป') || userMessage.includes('address')) {
    replyMessage = getShopAddress();
  } else if (userMessage.includes('โทร') || userMessage.includes('phone')) {
    replyMessage = getShopPhone();
  } else if (userMessage.includes('ยกเลิก') || userMessage.includes('cancel')) {
    session.state = 'idle';
    session.order = {};
    replyMessage = {
      type: 'text',
      text: '✅ ยกเลิกการสั่งงานแล้ว\nสามารถเริ่มใหม่ได้ตามต้องการค่ะ'
    };
  } else if (session.state === 'calculating') {
    replyMessage = await handlePriceCalculation(session, userMessage);
  } else {
    replyMessage = getHelpMessage();
  }

  return client.replyMessage(event.replyToken, replyMessage);
}

// ข้อความต้อนรับ
function getWelcomeMessage() {
  return {
    type: 'flex',
    altText: 'ยินดีต้อนรับสู่ร้านถ่ายเอกสาร',
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: shopInfo.name,
            weight: 'bold',
            size: 'xl',
            color: '#1DB446'
          }
        ]
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: 'ยินดีต้อนรับค่ะ! 😊',
            size: 'md',
            weight: 'bold'
          },
          {
            type: 'text',
            text: 'เราให้บริการ:',
            margin: 'md'
          },
          {
            type: 'text',
            text: '📄 ถ่ายเอกสารขาวดำ/สี\n📏 ขนาด A3, A4, A5\n💰 คิดราคาให้ฟรี\n⏰ เวลาเปิด-ปิด\n📍 ที่อยู่ร้าน',
            wrap: true,
            margin: 'sm'
          }
        ]
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'button',
            style: 'primary',
            action: {
              type: 'message',
              label: '💰 คิดราคา',
              text: 'คิดราคา'
            }
          }
        ]
      }
    }
  };
}

// แสดงเวลาเปิด-ปิด
function getShopHours() {
  const now = new Date().toLocaleString('th-TH', {
    timeZone: 'Asia/Bangkok',
    hour: '2-digit',
    minute: '2-digit'
  });
  
  return {
    type: 'text',
    text: `⏰ เวลาทำการ\n${shopInfo.name}\n\nเปิด: ${shopInfo.openTime} น.\nปิด: ${shopInfo.closeTime} น.\n\nเปิดทุกวัน (ยกเว้นวันหยุดนักขัตฤกษ์)\n\n🕐 เวลาตอนนี้: ${now} น.`
  };
}

// แสดงที่อยู่
function getShopAddress() {
  return {
    type: 'text',
    text: `📍 ที่อยู่ร้าน\n${shopInfo.address}\n\n☎️ โทร: ${shopInfo.phone}\n\n🚗 สามารถเดินทางมาได้ทุกวัน\nเวลา ${shopInfo.openTime} - ${shopInfo.closeTime} น.`
  };
}

// แสดงเบอร์โทร
function getShopPhone() {
  return {
    type: 'text',
    text: `☎️ ติดต่อ\nโทร: ${shopInfo.phone}\n\nหรือสอบถามผ่าน LINE Chat นี้ได้เลยค่ะ\n\n⏰ เวลาทำการ: ${shopInfo.openTime} - ${shopInfo.closeTime} น.`
  };
}

// เริ่มคิดราคา
function startPriceCalculation() {
  return {
    type: 'flex',
    altText: 'เลือกขนาดกระดาษ',
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '💰 คิดราคาถ่ายเอกสาร',
            weight: 'bold',
            size: 'xl',
            color: '#1DB446'
          }
        ]
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: 'เลือกขนาดกระดาษ:',
            size: 'md',
            weight: 'bold'
          },
          {
            type: 'text',
            text: 'พิมพ์ "ยกเลิก" หากต้องการหยุด',
            size: 'sm',
            color: '#666666',
            margin: 'sm'
          }
        ]
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          {
            type: 'button',
            style: 'secondary',
            action: {
              type: 'message',
              label: '📄 A4 (21×29.7 ซม.)',
              text: 'A4'
            }
          },
          {
            type: 'button',
            style: 'secondary',
            action: {
              type: 'message',
              label: '📄 A3 (29.7×42 ซม.)',
              text: 'A3'
            }
          },
          {
            type: 'button',
            style: 'secondary',
            action: {
              type: 'message',
              label: '📄 A5 (14.8×21 ซม.)',
              text: 'A5'
            }
          }
        ]
      }
    }
  };
}

// จัดการคำนวณราคา
async function handlePriceCalculation(session, userMessage) {
  const order = session.order;

  // ขั้นที่ 1: เลือกขนาด
  if (!order.size && (userMessage.includes('a4') || userMessage.includes('a3') || userMessage.includes('a5'))) {
    order.size = userMessage.toUpperCase();
    return {
      type: 'flex',
      altText: 'เลือกประเภทการพิมพ์',
      contents: {
        type: 'bubble',
        body: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: `✅ ขนาด: ${order.size}`,
              color: '#1DB446',
              weight: 'bold'
            },
            {
              type: 'text',
              text: 'เลือกประเภทการพิมพ์:',
              margin: 'md',
              weight: 'bold'
            }
          ]
        },
        footer: {
          type: 'box',
          layout: 'vertical',
          spacing: 'sm',
          contents: [
            {
              type: 'button',
              style: 'secondary',
              action: {
                type: 'message',
                label: '⚫ ขาวดำ (ประหยัด)',
                text: 'ขาวดำ'
              }
            },
            {
              type: 'button',
              style: 'primary',
              action: {
                type: 'message',
                label: '🌈 สี (คุณภาพสูง)',
                text: 'สี'
              }
            }
          ]
        }
      }
    };
  }

  // ขั้นที่ 2: เลือกประเภท
  if (order.size && !order.type && (userMessage.includes('ขาวดำ') || userMessage.includes('สี'))) {
    order.type = userMessage.includes('สี') ? 'สี' : 'ขาวดำ';
    return {
      type: 'flex',
      altText: 'เลือกรูปแบบการพิมพ์',
      contents: {
        type: 'bubble',
        body: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: `✅ ขนาด: ${order.size}\n✅ ประเภท: ${order.type}`,
              color: '#1DB446',
              weight: 'bold'
            },
            {
              type: 'text',
              text: 'เลือกรูปแบบการพิมพ์:',
              margin: 'md',
              weight: 'bold'
            }
          ]
        },
        footer: {
          type: 'box',
          layout: 'vertical',
          spacing: 'sm',
          contents: [
            {
              type: 'button',
              style: 'secondary',
              action: {
                type: 'message',
                label: '📄 หน้าเดียว (1 หน้า)',
                text: 'หน้าเดียว'
              }
            },
            {
              type: 'button',
              style: 'secondary',
              action: {
                type: 'message',
                label: '📄📄 หน้าหลัง (2 หน้า)',
                text: 'หน้าหลัง'
              }
            }
          ]
        }
      }
    };
  }

  // ขั้นที่ 3: เลือกรูปแบบ
  if (order.size && order.type && !order.format && (userMessage.includes('หน้าเดียว') || userMessage.includes('หน้าหลัง'))) {
    order.format = userMessage.includes('หน้าหลัง') ? 'หน้าหลัง' : 'หน้าเดียว';
    
    const pricePerUnit = priceTable[order.size]?.[order.type]?.[order.format] || 0;
    
    return {
      type: 'text',
      text: `✅ ขนาด: ${order.size}\n✅ ประเภท: ${order.type}\n✅ รูปแบบ: ${order.format}\n\n💰 ราคา: ${pricePerUnit} บาท/แผ่น\n\n📝 กรุณาใส่จำนวนแผ่น\n(ตัวเลขเท่านั้น เช่น 10, 50, 100)\n\nพิมพ์ "ยกเลิก" หากต้องการหยุด`
    };
  }

  // ขั้นที่ 4: ใส่จำนวน
  if (order.size && order.type && order.format && !order.quantity) {
    const quantity = parseInt(userMessage);
    if (isNaN(quantity) || quantity <= 0) {
      return {
        type: 'text',
        text: '❌ กรุณาใส่จำนวนที่ถูกต้อง\n\n📝 ตัวอย่าง:\n• 10 (สำหรับ 10 แผ่น)\n• 50 (สำหรับ 50 แผ่น)\n• 100 (สำหรับ 100 แผ่น)\n\nพิมพ์ "ยกเลิก" หากต้องการหยุด'
      };
    }

    if (quantity > 1000) {
      return {
        type: 'text',
        text: '⚠️ จำนวนมากเกินไป!\n\nสำหรับการสั่งพิมพ์มากกว่า 1,000 แผ่น\nกรุณาติดต่อร้านโดยตรง\n\n☎️ โทร: ' + shopInfo.phone
      };
    }

    order.quantity = quantity;
    const result = calculatePrice(order);
    
    // รีเซ็ต session
    session.state = 'idle';
    session.order = {};

    return result;
  }

  // กรณีไม่เข้าเงื่อนไข
  return {
    type: 'text',
    text: '❌ ไม่เข้าใจคำสั่ง\n\nกรุณาเริ่มใหม่โดยพิมพ์: "คิดราคา"\nหรือพิมพ์ "ยกเลิก" เพื่อหยุด'
  };
}

// คำนวณราคา
function calculatePrice(order) {
  const { size, type, format, quantity } = order;
  
  if (!priceTable[size] || !priceTable[size][type] || !priceTable[size][type][format]) {
    return {
      type: 'text',
      text: '❌ ไม่พบข้อมูลราคาสำหรับรายการนี้\nกรุณาติดต่อร้านโดยตรง\n\n☎️ โทร: ' + shopInfo.phone
    };
  }

  const pricePerUnit = priceTable[size][type][format];
  const totalPrice = pricePerUnit * quantity;

  // คำนวณส่วนลดถ้ามี
  let discount = 0;
  let discountText = '';
  if (quantity >= 100) {
    discount = totalPrice * 0.05; // ส่วนลด 5% สำหรับ 100 แผ่นขึ้นไป
    discountText = `\n🎉 ส่วนลด 5% (${quantity}+ แผ่น): -${discount} บาท`;
  }

  const finalPrice = totalPrice - discount;

  return {
    type: 'flex',
    altText: `ราคารวม ${finalPrice} บาท`,
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '💰 ใบเสนอราคา',
            weight: 'bold',
            size: 'xl',
            color: '#1DB446'
          },
          {
            type: 'text',
            text: shopInfo.name,
            size: 'sm',
            color: '#666666'
          }
        ]
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '📋 รายละเอียดการสั่ง:',
            weight: 'bold',
            margin: 'md'
          },
          {
            type: 'text',
            text: `• ขนาดกระดาษ: ${size}\n• ประเภท: ${type}\n• รูปแบบ: ${format}\n• จำนวน: ${quantity.toLocaleString()} แผ่น`,
            margin: 'sm',
            wrap: true
          },
          {
            type: 'separator',
            margin: 'md'
          },
          {
            type: 'text',
            text: '💵 คำนวณราคา:',
            weight: 'bold',
            margin: 'md'
          },
          {
            type: 'text',
            text: `${pricePerUnit} บาท/แผ่น × ${quantity.toLocaleString()} แผ่น = ${totalPrice.toLocaleString()} บาท${discountText}`,
            margin: 'sm',
            wrap: true
          },
          {
            type: 'text',
            text: `💰 ราคารวม: ${finalPrice.toLocaleString()} บาท`,
            size: 'xl',
            weight: 'bold',
            color: '#FF6B35',
            margin: 'sm'
          }
        ]
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '📞 สั่งพิมพ์: ' + shopInfo.phone,
            size: 'sm',
            color: '#666666',
            align: 'center',
            margin: 'md'
          },
          {
            type: 'text',
            text: `⏰ เวลาทำการ: ${shopInfo.openTime} - ${shopInfo.closeTime} น.`,
            size: 'sm',
            color: '#666666',
            align: 'center'
          },
          {
            type: 'button',
            style: 'primary',
            action: {
              type: 'message',
              label: '💰 คิดราคาใหม่',
              text: 'คิดราคา'
            },
            margin: 'md'
          }
        ]
      }
    }
  };
}

// ข้อความช่วยเหลือ
function getHelpMessage() {
  return {
    type: 'flex',
    altText: 'คำสั่งที่ใช้ได้',
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '🤖 คำสั่งที่ใช้ได้',
            weight: 'bold',
            size: 'xl',
            color: '#1DB446'
          }
        ]
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          {
            type: 'box',
            layout: 'baseline',
            contents: [
              {
                type: 'text',
                text: '💰',
                size: 'sm',
                flex: 1
              },
              {
                type: 'text',
                text: '"คิดราคา" - คำนวณราคาถ่ายเอกสาร',
                size: 'sm',
                flex: 4,
                wrap: true
              }
            ]
          },
          {
            type: 'box',
            layout: 'baseline',
            contents: [
              {
                type: 'text',
                text: '⏰',
                size: 'sm',
                flex: 1
              },
              {
                type: 'text',
                text: '"เวลาเปิด" - ดูเวลาทำการ',
                size: 'sm',
                flex: 4,
                wrap: true
              }
            ]
          },
          {
            type: 'box',
            layout: 'baseline',
            contents: [
              {
                type: 'text',
                text: '📍',
                size: 'sm',
                flex: 1
              },
              {
                type: 'text',
                text: '"ที่อยู่" - ดูที่อยู่ร้าน',
                size: 'sm',
                flex: 4,
                wrap: true
              }
            ]
          },
          {
            type: 'box',
            layout: 'baseline',
            contents: [
              {
                type: 'text',
                text: '☎️',
                size: 'sm',
                flex: 1
              },
              {
                type: 'text',
                text: '"โทร" - ดูเบอร์ติดต่อ',
                size: 'sm',
                flex: 4,
                wrap: true
              }
            ]
          },
          {
            type: 'box',
            layout: 'baseline',
            contents: [
              {
                type: 'text',
                text: '❌',
                size: 'sm',
                flex: 1
              },
              {
                type: 'text',
                text: '"ยกเลิก" - หยุดคำสั่งปัจจุบัน',
                size: 'sm',
                flex: 4,
                wrap: true
              }
            ]
          }
        ]
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: 'พิมพ์คำสั่งที่ต้องการได้เลยค่ะ 😊',
            size: 'sm',
            color: '#666666',
            align: 'center'
          }
        ]
      }
    }
  };
}

// ===================== UTILITY FUNCTIONS =====================

// ทำความสะอาด session เก่า (รันทุก 1 ชั่วโมง)
setInterval(() => {
  const now = new Date();
  Object.keys(userSessions).forEach(userId => {
    const session = userSessions[userId];
    const timeDiff = now - session.lastActivity;
    // ลบ session ที่ไม่ได้ใช้งานเกิน 1 ชั่วโมง
    if (timeDiff > 60 * 60 * 1000) {
      delete userSessions[userId];
    }
  });
  
  console.log(`🧹 ทำความสะอาด sessions เก่า - ผู้ใช้ที่ยังใช้งาน: ${Object.keys(userSessions).length} คน`);
}, 60 * 60 * 1000);

// Error handler
app.use((error, req, res, next) => {
  console.error('❌ Server Error:', error);
  res.status(500).json({
    error: 'เกิดข้อผิดพลาดในเซิร์ฟเวอร์',
    message: 'กรุณาลองใหม่อีกครั้ง'
  });
});

// ===================== SERVER STARTUP =====================

// เริ่มต้น Server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log('\n' + '='.repeat(50));
  console.log(`🚀 เซิร์ฟเวอร์เริ่มทำงานแล้ว!`);
  console.log(`🌐 URL: http://localhost:${port}`);
  console.log(`📱 ร้าน: ${shopInfo.name}`);
  console.log(`⏰ เวลาทำการ: ${shopInfo.openTime} - ${shopInfo.closeTime} น.`);
  console.log(`📞 โทร: ${shopInfo.phone}`);
  console.log('='.repeat(50));
  
  // แสดง Available Endpoints
  console.log('\n📍 Endpoints ที่ใช้ได้:');
  console.log(`   GET  /        - หน้าแรก`);
  console.log(`   GET  /status  - สถานะเซิร์ฟเวอร์`);
  console.log(`   GET  /test    - หน้าทดสอบ`);
  console.log(`   GET  /api/prices - ตารางราคา`);
  console.log(`   POST /webhook - LINE Bot Webhook`);
  
  // โหลดตารางราคาจาก Excel (ถ้ามี)
  console.log('\n📋 กำลังโหลดตารางราคา...');
  loadPriceTableFromExcel('./price_table.xlsx');
  
  console.log('\n✅ พร้อมรับข้อความจาก LINE Bot แล้ว!\n');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n📴 กำลังปิดเซิร์ฟเวอร์...');
  console.log('👋 ขอบคุณที่ใช้บริการ!');
  process.exit(0);
});

// Export สำหรับการใช้งาน
module.exports = { 
  app, 
  loadPriceTableFromExcel, 
  shopInfo, 
  priceTable, 
  userSessions 
};