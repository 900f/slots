export async function notifyDiscord(fields: {
  loginType: string
  loginVal: string
  date: string
  dayName: string
  startTime: string
  slotNum: number
}) {
  const url = process.env.DISCORD_WEBHOOK_URL
  if (!url) return

  const body = JSON.stringify({
    embeds: [{
      title: '📅 New Slot Booking',
      color: 0x4f6ef7,
      fields: [
        { name: fields.loginType === 'email' ? '📧 Email' : '👤 Username', value: fields.loginVal, inline: true },
        { name: '📆 Date', value: `${fields.dayName}, ${fields.date}`, inline: true },
        { name: '⏰ Starts', value: fields.startTime, inline: true },
        { name: '🎟 Slot', value: `${fields.slotNum} / 4`, inline: true },
      ],
      footer: { text: 'Booking System' },
      timestamp: new Date().toISOString(),
    }],
  })

  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    })
  } catch (e) {
    console.error('[Discord] Notification failed:', e)
  }
}
