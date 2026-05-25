'use client'
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Camera, PlayCircle, Globe, CheckCircle, Calendar, RefreshCw, Save, Copy, Check } from 'lucide-react'
import clsx from 'clsx'

interface PlatformVariant {
  id: string
  platform: string
  adapted_content: string
  hashtags: string[]
  scheduled_at: string | null
}

interface DraftVersion {
  id: string
  version_number: number
  content_snapshot: string
  created_at: string
}

interface Post {
  id: string
  title: string
  original_content: string
  draft_versions: DraftVersion[]
  platform_variants: PlatformVariant[]
}

export default function PostDetailPage({ params }: { params: { id: string } }) {
  const { id } = params
  const router = useRouter()
  const supabase = createClient()

  const [post, setPost] = useState<Post | null>(null)
  const [loading, setLoading] = useState(true)
  const [adapting, setAdapting] = useState(false)
  const [savingVersion, setSavingVersion] = useState(false)
  const [scheduleUpdating, setScheduleUpdating] = useState<string | null>(null)
  const [scheduleSuccess, setScheduleSuccess] = useState<string | null>(null)

  // Fetch post data
  useEffect(() => {
    async function fetchPost() {
      setLoading(true)
      const { data, error } = await supabase
        .from('posts')
        .select(`*, draft_versions ( id, version_number, content_snapshot, created_at ), platform_variants ( id, platform, adapted_content, hashtags, scheduled_at )`)
        .eq('id', id)
        .single()
      if (!error && data) {
        setPost(data as Post)
      }
      setLoading(false)
    }
    fetchPost()
  }, [id])

  async function reAdapt() {
    if (!post) return
    setAdapting(true)
    try {
      const res = await fetch('/api/adapt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: post.original_content, brandVoice: '' }) // brandVoice not needed here
      })
      const result = await res.json()
      if (result.success) {
        // Refresh post to get new variants
        const { data, error } = await supabase
          .from('posts')
          .select('platform_variants(*)')
          .eq('id', id)
          .single()
        if (!error) setPost(prev => ({ ...prev!, platform_variants: data.platform_variants }))
      }
    } catch (e) {
      console.error(e)
    }
    setAdapting(false)
  }

  async function saveVersion() {
    if (!post) return
    setSavingVersion(true)
    // Determine next version number
    const maxVersion = post.draft_versions.reduce((m, v) => Math.max(m, v.version_number), 0)
    const nextVersion = maxVersion + 1
    const { error } = await supabase
      .from('draft_versions')
      .insert({ post_id: post.id, content_snapshot: post.original_content, version_number: nextVersion })
    if (!error) {
      // Refresh versions
      const { data, error: fetchErr } = await supabase
        .from('posts')
        .select('draft_versions (*)')
        .eq('id', id)
        .single()
      if (!fetchErr) setPost(prev => ({ ...prev!, draft_versions: data.draft_versions }))
    }
    setSavingVersion(false)
  }

  async function handleScheduleChange(variantId: string, newValue: string) {
    setScheduleUpdating(variantId)
    const { error } = await supabase
      .from('platform_variants')
      .update({ scheduled_at: newValue })
      .eq('id', variantId)
    if (!error) {
      setScheduleSuccess(variantId)
      setTimeout(() => setScheduleSuccess(null), 2000)
      // Refresh variants
      const { data, error: fetchErr } = await supabase
        .from('posts')
        .select('platform_variants (*)')
        .eq('id', id)
        .single()
      if (!fetchErr) setPost(prev => ({ ...prev!, platform_variants: data.platform_variants }))
    }
    setScheduleUpdating(null)
  }

  const platformMap: Record<string, { label: string; Icon: any }> = {
    instagram: { label: 'Instagram', Icon: Camera },
    youtube: { label: 'YouTube', Icon: PlayCircle },
    facebook: { label: 'Facebook', Icon: Globe },
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
      </div>
    )
  }

  if (!post) {
    return <p className="text-red-400">Post not found.</p>
  }

  return (
    <div className="space-y-8">
      {/* Original Content */}
      <section className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h2 className="text-xl font-bold text-white mb-2">{post.title}</h2>
        <p className="text-gray-300 whitespace-pre-wrap">{post.original_content}</p>
        <div className="mt-4 flex gap-3">
          <button
            onClick={reAdapt}
            disabled={adapting}
            className={clsx('flex items-center gap-2 px-4 py-2 rounded bg-orange-500 hover:bg-orange-600 text-white', adapting && 'opacity-50')}
          >
            <RefreshCw size={16} />
            {adapting ? 'Re‑adapting...' : 'Re‑adapt with AI'}
          </button>
          <button
            onClick={saveVersion}
            disabled={savingVersion}
            className={clsx('flex items-center gap-2 px-4 py-2 rounded bg-green-500 hover:bg-green-600 text-white', savingVersion && 'opacity-50')}
          >
            <Save size={16} />
            {savingVersion ? 'Saving...' : 'Save Version'}
          </button>
        </div>
      </section>

      {/* Platform Variants */}
      <section className="space-y-6">
        <h3 className="text-2xl font-bold text-white">Platform Variants</h3>
        <div className="grid md:grid-cols-2 gap-4">
          {post.platform_variants.map(v => {
            const { label, Icon } = platformMap[v.platform] || { label: v.platform, Icon: Camera }
            return (
              <div key={v.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon size={18} className="text-pink-400" />
                    <span className="font-semibold text-gray-200">{label}</span>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(v.adapted_content + '\n\n' + v.hashtags.map(h => `#${h}`).join(' '))
                      // Could add copy feedback but omitted for brevity
                    }}
                    className="flex items-center gap-1 text-gray-400 hover:text-white"
                  >
                    <Copy size={14} /> Copy
                  </button>
                </div>
                <p className="text-gray-300 whitespace-pre-wrap leading-relaxed text-sm">{v.adapted_content}</p>
                <div className="flex flex-wrap gap-1">
                  {v.hashtags.map(tag => (
                    <span key={tag} className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded">
                      #{tag}
                    </span>
                  ))}
                </div>
                <div className="flex items-center space-x-2 mt-2">
                  <label className="text-sm text-gray-400">Schedule:</label>
                  <input
                    type="datetime-local"
                    className={clsx('bg-gray-800 border border-gray-700 rounded-md p-1 text-white', scheduleUpdating === v.id && 'animate-pulse')}
                    value={new Date(v.scheduled_at ?? new Date()).toISOString().slice(0, 16)}
                    onChange={e => handleScheduleChange(v.id, e.target.value)}
                    disabled={scheduleUpdating === v.id}
                  />
                  {scheduleSuccess === v.id && <CheckCircle size={16} className="text-green-400" />}
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
