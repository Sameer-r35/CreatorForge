'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Clock, Calendar, Camera, PlayCircle, Globe, Trash2, Edit2, Check, RefreshCw } from 'lucide-react'
import clsx from 'clsx'

const PLATFORMS = {
  instagram: { label: 'Instagram', icon: Camera, color: 'text-pink-400', border: 'border-pink-500/30', bg: 'bg-pink-500/5' },
  youtube: { label: 'YouTube', icon: PlayCircle, color: 'text-red-400', border: 'border-red-500/30', bg: 'bg-red-500/5' },
  facebook: { label: 'Facebook', icon: Globe, color: 'text-blue-400', border: 'border-blue-500/30', bg: 'bg-blue-500/5' },
}

interface ScheduledVariant {
  id: string
  post_id: string
  platform: 'instagram' | 'youtube' | 'facebook'
  adapted_content: string
  hashtags: string[]
  scheduled_at: string
  posts: {
    id: string
    title: string
  } | null
}

export default function SchedulePage() {
  const supabase = createClient()
  const [variants, setVariants] = useState<ScheduledVariant[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDate, setEditDate] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)

  async function fetchScheduled() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Fetch platform_variants with scheduled_at not null, joining posts table
    const { data, error } = await supabase
      .from('platform_variants')
      .select(`
        id,
        post_id,
        platform,
        adapted_content,
        hashtags,
        scheduled_at,
        posts ( id, title, user_id )
      `)
      .not('scheduled_at', 'is', null)
      .order('scheduled_at', { ascending: true })

    if (data) {
      // Filter by current user in client-side to be extra secure
      const userVariants = (data as any[]).filter(v => v.posts?.user_id === user.id)
      setVariants(userVariants)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchScheduled()
  }, [])

  // Helper to group variants by Date
  const groupVariantsByDate = () => {
    const groups: Record<string, ScheduledVariant[]> = {}
    variants.forEach(variant => {
      const dateKey = new Date(variant.scheduled_at).toLocaleDateString(undefined, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
      if (!groups[dateKey]) {
        groups[dateKey] = []
      }
      groups[dateKey].push(variant)
    })
    return groups
  }

  async function handleUpdateSchedule(variantId: string, newDateStr: string) {
    if (!newDateStr) return
    setSavingId(variantId)
    const isoDate = new Date(newDateStr).toISOString()

    const { error } = await supabase
      .from('platform_variants')
      .update({ scheduled_at: isoDate })
      .eq('id', variantId)

    if (!error) {
      setVariants(prev =>
        prev.map(v => (v.id === variantId ? { ...v, scheduled_at: isoDate } : v))
          .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
      )
      setEditingId(null)
    }
    setSavingId(null)
  }

  async function handleCancelSchedule(variantId: string) {
    if (!confirm('Are you sure you want to unschedule this post variant?')) return
    setSavingId(variantId)

    const { error } = await supabase
      .from('platform_variants')
      .update({ scheduled_at: null })
      .eq('id', variantId)

    if (!error) {
      setVariants(prev => prev.filter(v => v.id !== variantId))
    }
    setSavingId(null)
  }

  const grouped = groupVariantsByDate()

  return (
    <div className="max-w-4xl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Clock className="text-orange-500" />
            Content Schedule
          </h2>
          <p className="text-gray-400 mt-1">Grouped chronological feed of your scheduled platform posts</p>
        </div>

        <button 
          onClick={fetchScheduled}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs font-semibold bg-gray-900 border border-gray-800 text-gray-400 hover:text-white px-3 py-1.5 rounded-lg transition"
        >
          <RefreshCw size={12} className={clsx(loading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
        </div>
      ) : variants.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl flex flex-col items-center justify-center p-12 text-center">
          <Calendar size={48} className="text-gray-600 mb-4 animate-pulse" />
          <h3 className="text-white text-lg font-semibold mb-2">No scheduled variants</h3>
          <p className="text-gray-500 max-w-sm mb-4">Go to a post's detail page or create a new post to schedule variants for social media.</p>
        </div>
      ) : (
        <div className="space-y-10">
          {Object.entries(grouped).map(([dateLabel, items]) => (
            <div key={dateLabel} className="space-y-4">
              {/* Date Header */}
              <div className="flex items-center gap-4">
                <span className="text-xs font-bold text-orange-400 uppercase tracking-wider bg-orange-500/10 border border-orange-500/20 px-3 py-1 rounded-full">
                  {dateLabel}
                </span>
                <div className="flex-1 h-px bg-gray-800/80"></div>
              </div>

              {/* Items under this date */}
              <div className="grid gap-4">
                {items.map(item => {
                  const platInfo = PLATFORMS[item.platform] ?? PLATFORMS.instagram
                  const Icon = platInfo.icon
                  const formattedTime = new Date(item.scheduled_at).toLocaleTimeString(undefined, {
                    hour: 'numeric',
                    minute: '2-digit',
                  })

                  // Convert ISO string to datetime-local friendly format (YYYY-MM-DDThh:mm)
                  const localDateString = new Date(item.scheduled_at).toLocaleString('sv').replace(' ', 'T').slice(0, 16)

                  const isEditing = editingId === item.id
                  const isSaving = savingId === item.id

                  return (
                    <div 
                      key={item.id} 
                      className={clsx(
                        'bg-gray-900/60 border rounded-xl p-5 hover:border-gray-700 transition duration-150 relative overflow-hidden',
                        platInfo.border
                      )}
                    >
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div className="min-w-0">
                          {/* Platform Badge */}
                          <div className="flex items-center gap-2 mb-1.5">
                            <Icon size={16} className={platInfo.color} />
                            <span className={clsx('font-bold text-xs uppercase tracking-wide', platInfo.color)}>
                              {platInfo.label}
                            </span>
                            <span className="text-sm text-gray-500">{item.posts?.title}</span>
                            <span className="text-orange-500 font-semibold text-xs flex items-center gap-1">
                              <Clock size={12} />
                              {formattedTime}
                            </span>
                          </div>

                          <h4 className="text-white font-semibold text-base truncate">
                            {item.posts?.title || 'Untitled Post'}
                          </h4>
                        </div>

                        {/* Card Controls */}
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {isEditing ? (
                            <>
                              <button
                                onClick={() => handleUpdateSchedule(item.id, editDate)}
                                disabled={isSaving}
                                title="Save date"
                                className="p-2 rounded-lg bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500 hover:text-white transition"
                              >
                                <Check size={14} />
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="px-2 py-1 text-xs text-gray-500 hover:text-white font-medium"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => {
                                  setEditingId(item.id)
                                  setEditDate(localDateString)
                                }}
                                disabled={isSaving}
                                title="Reschedule"
                                className="p-2 rounded-lg bg-gray-800 text-gray-400 border border-gray-700 hover:text-white hover:border-gray-600 transition"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                onClick={() => handleCancelSchedule(item.id)}
                                disabled={isSaving}
                                title="Cancel Schedule"
                                className="p-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500 hover:text-white transition"
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Scheduling Form (if editing) */}
                      {isEditing && (
                        <div className="mb-4 bg-gray-950 p-3.5 rounded-lg border border-gray-800 flex flex-col sm:flex-row sm:items-center gap-3">
                          <div className="flex-1">
                            <label className="text-gray-500 text-[10px] uppercase font-bold tracking-wider mb-1 block">New Schedule Date & Time</label>
                            <input
                              type="datetime-local"
                              value={editDate}
                              onChange={e => setEditDate(e.target.value)}
                              className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-orange-500"
                            />
                          </div>
                        </div>
                      )}

                      <p className="text-gray-300 text-sm whitespace-pre-wrap leading-relaxed mb-3 mt-1.5 max-h-36 overflow-y-auto pr-2">
                        {item.adapted_content}
                      </p>

                      {/* Tags */}
                      {item.hashtags && item.hashtags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {item.hashtags.map(tag => (
                            <span key={tag} className="text-xs bg-gray-850 text-gray-500 px-2 py-0.5 rounded-full border border-gray-800">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
