import { NextResponse } from 'next/server'

const PLATFORM_RULES = {
  instagram: 'Max 2200 chars. Conversational, emoji-friendly, 5-10 hashtags at the end, line breaks for readability, strong hook in first line.',
  youtube: 'Max 5000 chars. SEO-optimized description. First 150 chars are critical (shown before "more"). Include timestamps if relevant, 3-5 hashtags, call to action at end.',
  facebook: 'Max 63000 chars but keep it under 500 for best engagement. Conversational tone, minimal hashtags (1-2), encourage comments with a question at the end.',
}

export async function POST(req: Request) {
  try {
    const { content, brandVoice } = await req.json()

    const platforms = ['instagram', 'youtube', 'facebook'] as const

    const results: Record<string, { content: string; hashtags: string[] }> = {}

    await Promise.all(
      platforms.map(async (platform) => {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.ANTHROPIC_API_KEY!,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1000,
            messages: [
              {
                role: 'user',
                content: `You are a social media content expert. Adapt the content below for ${platform}.

Brand voice: ${brandVoice || 'professional and engaging'}

Platform rules: ${PLATFORM_RULES[platform]}

Return ONLY a JSON object in this exact format, no markdown, no explanation:
{"content": "the adapted post text here", "hashtags": ["tag1", "tag2", "tag3"]}

Original content:
${content}`,
              },
            ],
          }),
        })

        const data = await response.json()
console.log('Claude response:', JSON.stringify(data, null, 2))
const text = data.content[0].text.trim()
        const parsed = JSON.parse(text)
        results[platform] = parsed
      })
    )

    return NextResponse.json({ success: true, results })
  } catch (error) {
    console.error('Full error:', error)
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}