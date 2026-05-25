import clsx from 'clsx'
import { createClient } from '@/lib/supabase/server'
import { FileText, Clock, CheckCircle, AlertCircle, Camera, PlayCircle, Globe, Layers } from 'lucide-react'
import Link from 'next/link'

const PLATFORMS = [
  { key: 'instagram', icon: Camera, activeColor: 'text-pink-400 bg-pink-500/10 border-pink-500/20', inactiveColor: 'text-gray-600 bg-gray-900/50 border-gray-800' },
  { key: 'youtube', icon: PlayCircle, activeColor: 'text-red-400 bg-red-500/10 border-red-500/20', inactiveColor: 'text-gray-600 bg-gray-900/50 border-gray-800' },
  { key: 'facebook', icon: Globe, activeColor: 'text-blue-400 bg-blue-500/10 border-blue-500/20', inactiveColor: 'text-gray-600 bg-gray-900/50 border-gray-800' },
]

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  // Fetch posts with draft versions and platform variants in a single query
  const { data: posts } = await supabase
    .from('posts')
    .select(`
      *,
      draft_versions ( id ),
      platform_variants ( platform )
    `)
    .eq('user_id', user?.id)
    .order('created_at', { ascending: false })

  const stats = {
    total: posts?.length ?? 0,
    drafts: posts?.filter(p => p.status === 'draft').length ?? 0,
    scheduled: posts?.filter(p => p.status === 'scheduled').length ?? 0,
    published: posts?.filter(p => p.status === 'published').length ?? 0,
  }

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white">Dashboard</h2>
        <p className="text-gray-400 mt-1">Your content at a glance</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Posts', value: stats.total, icon: FileText, color: 'text-blue-400' },
          { label: 'Drafts', value: stats.drafts, icon: AlertCircle, color: 'text-yellow-400' },
          { label: 'Scheduled', value: stats.scheduled, icon: Clock, color: 'text-orange-400' },
          { label: 'Published', value: stats.published, icon: CheckCircle, color: 'text-green-400' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-gray-400 text-sm">{label}</span>
              <Icon size={18} className={color} />
            </div>
            <p className="text-3xl font-bold text-white">{value}</p>
          </div>
        ))}
      </div>

      {/* Recent posts */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-gray-900/50">
          <h3 className="text-white font-semibold">Recent Posts</h3>
          <Link href="/dashboard/new" className="text-orange-400 text-sm hover:text-orange-300 font-medium transition">
            + New Post
          </Link>
        </div>

        {!posts?.length ? (
          <div className="px-6 py-12 text-center">
            <p className="text-gray-500">No posts yet.</p>
            <Link href="/dashboard/new" className="text-orange-400 text-sm mt-2 inline-block hover:text-orange-300 font-medium">
              Create your first post →
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-800">
            {posts.map(post => {
              // Extract unique generated platform keys
              const generatedPlatforms = new Set(
                (post.platform_variants as Array<{ platform: string }> | null)?.map(v => v.platform) || []
              )
              const versionCount = (post.draft_versions as Array<any> | null)?.length ?? 0

              return (
                <Link
                  key={post.id}
                  href={`/dashboard/posts/${post.id}`}
                  className="px-6 py-4 flex items-center justify-between hover:bg-gray-850 transition duration-150 group block"
                >
                  <div className="flex-1 min-w-0 pr-4">
                    <p className="text-white font-medium group-hover:text-orange-400 transition truncate">{post.title}</p>
                    <p className="text-gray-500 text-xs mt-1">
                      {new Date(post.created_at).toLocaleDateString()}
                    </p>
                  </div>

                  {/* Platforms Generated Badges */}
                  <div className="flex items-center gap-2 mr-6">
                    {PLATFORMS.map(({ key, icon: Icon, activeColor, inactiveColor }) => {
                      const isActive = generatedPlatforms.has(key)
                      return (
                        <div
                          key={key}
                          title={isActive ? `${key} variant generated` : `${key} variant missing`}
                          className={clsx(
                            'p-1.5 rounded-lg border text-xs flex items-center justify-center transition-all',
                            isActive ? activeColor : inactiveColor
                          )}
                        >
                          <Icon size={14} />
                        </div>
                      )
                    })}
                  </div>

                  {/* Version & Status */}
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1 bg-gray-800 text-gray-400 text-xs px-2.5 py-1 rounded-full border border-gray-700 font-medium">
                      <Layers size={12} />
                      v{versionCount}
                    </span>

                    <span className={clsx(
                      'text-xs px-2.5 py-1 rounded-full font-semibold border',
                      post.status === 'draft' && 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
                      post.status === 'scheduled' && 'bg-orange-500/10 text-orange-400 border-orange-500/20',
                      post.status === 'published' && 'bg-green-500/10 text-green-400 border-green-500/20',
                    )}>
                      {post.status}
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}