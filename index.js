require('dotenv').config()
const express = require('express')
const line = require('@line/bot-sdk')
const cron = require('node-cron')
const fs = require('fs')

const app = express()

const config = {
  channelSecret: process.env.CHANNEL_SECRET,
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN
}

const client = new line.Client(config)

app.post('/webhook', line.middleware(config), (req, res) => {
  Promise.all(req.body.events.map(handleEvent))
  res.end()
})

let data = fs.existsSync('data.json')
  ? JSON.parse(fs.readFileSync('data.json'))
  : { bookings: {}, groups: {} }

function save() {
  fs.writeFileSync('data.json', JSON.stringify(data, null, 2))
}

async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') return

  const text = event.message.text.trim()
  const userId = event.source.userId
  const groupId = event.source.groupId

  // เก็บกลุ่ม
  if (groupId && !data.groups[groupId]) {
    data.groups[groupId] = `กลุ่ม ${Object.keys(data.groups).length + 1}`
    save()
  }

  // เช็กกลุ่ม (แอดมิน)
  if (text === 'เช็กกลุ่ม' && userId === process.env.ADMIN_ID) {
    let msg = '* รายชื่อกลุ่มทั้งหมด *\n'
    let i = 1
    for (let g in data.groups) {
      msg += `${i}. ${data.groups[g]}\n`
      i++
    }
    return reply(event, msg)
  }

  // จองเลข
  if (/^\d+\-\d+$/.test(text)) {
    if (!data.bookings[text]) {
      data.bookings[text] = {
        userId,
        time: new Date().toLocaleTimeString()
      }
      save()
      return reply(event, `✅ จอง ${text} สำเร็จ`)
    } else {
      return reply(event, `❌ เลข ${text} มีคนจองแล้ว`)
    }
  }
}

function reply(event, text) {
  return client.replyMessage(event.replyToken, {
    type: 'text',
    text
  })
}

// ตั้งเวลาส่งอัตโนมัติ (ตัวอย่าง 16:00)
cron.schedule('0 16 * * *', () => {
  let msg = '📢 ส่งห้อง บ้านแชร์จังๆ ❤️\n'
  msg += 'เวลา 16:00\n'
  msg += 'ข้อความ\n'
  msg += Object.keys(data.bookings).join(', ')

  for (let g in data.groups) {
    client.pushMessage(g, { type: 'text', text: msg })
  }
})

app.listen(3000, () => console.log('BOT RUNNING'))
