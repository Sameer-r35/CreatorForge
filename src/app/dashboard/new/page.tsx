'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Sparkles, Camera, PlayCircle, Globe, Copy, Check, Save } from 'lucide-react'
import clsx from 'clsx'

const PLATFORMS = [
  { key: 'instagram', label: 'Instagram', icon: Camera, color: 'text-pink-400', border: 'border-pink-500/30', bg: 'bg-pink-500/5' },
  { key: 'youtube', label: 'YouTube', icon: PlayCircle, color: 'text-red-400', border: 'border-red-500/30', bg: 'bg-red-500/5' },
  { key: 'facebook', label: 'Facebook', icon: Globe, color: 'text-blue-400', border: 'border-blue-500/30', bg: 'bg-blue-500/5' },
]

export default function NewPostPage() {
  const router = useRouter()
  const supabase = createClient()

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [brandVoice, setBrandVoice] = useState('professional and engaging')
  const [adapting, setAdapting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [results, setResults] = useState<Record<string, { content: string; hashtags: string[] }> | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase
        .from('profiles')
        .select('brand_voice')
        .eq('id', user.id)
        .single()
      if (profile?.brand_voice) {
        setBrandVoice(profile.brand_voice)
      }
    }
    loadProfile()
  }, [])

  async function handleAdapt() {
    if (!content.trim()) return
    setAdapting(true)
    setError('')
    try {
      const res = await fetch('/api/adapt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, brandVoice }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      setResults(data.results)

      // Save brand voice back to the profiles table
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase
          .from('profiles')
          .update({ brand_voice: brandVoice })
          .eq('id', user.id)
      }
    } catch (e) {
      setError('AI adaptation failed. Check your API key.')
    } finally {
      setAdapting(false)
    }
  }

  async function handleSave() {
    if (!title.trim() || !content.trim()) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()

    const { data: post, error: postError } = await supabase
      .from('posts')
      .insert({ user_id: user?.id, title, original_content: content, status: 'draft' })
      .select()
      .single()

    if (postError || !post) { setSaving(false); return }

    // Save version 1
    await supabase.from('draft_versions').insert({
      post_id: post.id,
      content_snapshot: content,
      version_number: 1,
    })

    // Save platform variants if we have them
    if (results) {
      await supabase.from('platform_variants').insert(
        Object.entries(results).map(([platform, data]) => ({
          post_id: post.id,
          platform,
          adapted_content: data.content,
          hashtags: data.hashtags,
        }))
      )
    }

    setSaving(false)
    router.push('/dashboard')
  }

  async function handleCopy(platform: string, text: string) {
    await navigator.clipboard.writeText(text)
    setCopied(platform)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white">New Post</h2>
        <p className="text-gray-400 mt-1">Write once, adapt for every platform with AI</p>
      </div>

      {/* Editor */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-4">
        <div className="mb-4">
          <label className="text-gray-400 text-sm mb-1 block">Post Title</label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. My morning productivity routine"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 transition"
          />
        </div>

        <div className="mb-4">
          <label className="text-gray-400 text-sm mb-1 block">Original Content</label>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="Paste your blog post, YouTube script, podcast notes, or any long-form content here..."
            rows={8}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 transition resize-none"
          />
          <p className="text-gray-600 text-xs mt-1">{content.length} characters</p>
        </div>

        <div className="mb-5">
          <label className="text-gray-400 text-sm mb-1 block">Brand Voice</label>
          <input
            value={brandVoice}
            onChange={e => setBrandVoice(e.target.value)}
            placeholder="e.g. casual and funny, professional and inspiring..."
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 transition"
          />
        </div>

        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

        <div className="flex gap-3">
          <button
            onClick={handleAdapt}
            disabled={adapting || !content.trim()}
            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold px-5 py-2.5 rounded-lg transition"
          >
            <Sparkles size={16} />
            {adapting ? 'Adapting with AI...' : 'Adapt for All Platforms'}
          </button>

          <button
            onClick={handleSave}
            disabled={saving || !title.trim() || !content.trim()}
            className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white font-semibold px-5 py-2.5 rounded-lg transition"
          >
            <Save size={16} />
            {saving ? 'Saving...' : 'Save Draft'}
          </button>
        </div>
      </div>

      {/* AI Results */}
      {adapting && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
          <div className="inline-flex items-center gap-3 text-orange-400">
            <Sparkles size={20} className="animate-pulse" />
            <span>Claude is adapting your content for 3 platforms simultaneously...</span>
          </div>
        </div>
      )}

      {results && !adapting && (
        <div className="space-y-4">
          <h3 className="text-white font-semibold text-lg">AI-Adapted Variants</h3>
          {PLATFORMS.map(({ key, label, icon: Icon, color, border, bg }) => {
            const variant = results[key]
            if (!variant) return null
            return (
              <div key={key} className={clsx('border rounded-xl p-5', border, bg)}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Icon size={18} className={color} />
                    <span className={clsx('font-semibold', color)}>{label}</span>
                    <span className="text-gray-600 text-xs">{variant.content.length} chars</span>
                  </div>
                  <button
                    onClick={() => handleCopy(key, variant.content + '\n\n' + variant.hashtags.map(h => `#${h}`).join(' '))}
                    className="flex items-center gap-1.5 text-gray-400 hover:text-white text-xs transition"
                  >
                    {copied === key ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                    {copied === key ? 'Copied!' : 'Copy'}
                  </button>
                </div>

                <p className="text-gray-300 text-sm whitespace-pre-wrap leading-relaxed mb-3">
                  {variant.content}
                </p>

                <div className="flex flex-wrap gap-1.5">
                  {variant.hashtags.map(tag => (
                    <span key={tag} className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}