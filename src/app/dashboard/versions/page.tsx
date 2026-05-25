'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { History, FileText, Plus, Calendar, Layers, CheckCircle } from 'lucide-react'
import clsx from 'clsx'

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
  created_at: string
  draft_versions: DraftVersion[]
}

export default function VersionsPage() {
  const supabase = createClient()
  
  const [posts, setPosts] = useState<Post[]>([])
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingNewVersion, setSavingNewVersion] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  async function fetchPosts() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase
      .from('posts')
      .select(`
        *,
        draft_versions ( id, version_number, content_snapshot, created_at )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (data) {
      // Sort draft_versions within each post descending by version_number
      const formattedPosts = data.map((post: any) => ({
        ...post,
        draft_versions: (post.draft_versions || []).sort((a: any, b: any) => b.version_number - a.version_number)
      }))
      setPosts(formattedPosts)
      
      // Select the first post by default if none is selected
      if (formattedPosts.length > 0 && !selectedPostId) {
        setSelectedPostId(formattedPosts[0].id)
      }
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchPosts()
  }, [])

  const selectedPost = posts.find(p => p.id === selectedPostId) ?? null

  async function handleSaveNewVersion() {
    if (!selectedPost || savingNewVersion) return
    setSavingNewVersion(true)
    setSaveSuccess(false)

    // Calculate next version number
    const maxVersion = selectedPost.draft_versions.reduce((max, v) => Math.max(max, v.version_number), 0)
    const nextVersion = maxVersion + 1

    const { data, error } = await supabase
      .from('draft_versions')
      .insert({
        post_id: selectedPost.id,
        content_snapshot: selectedPost.original_content,
        version_number: nextVersion
      })
      .select()
      .single()

    if (data) {
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
      await fetchPosts()
    }
    setSavingNewVersion(false)
  }

  return (
    <div className="flex flex-col h-[calc(100vh-10rem)]">
      <div className="mb-6 flex-shrink-0">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <History className="text-orange-500" />
          Draft Versions
        </h2>
        <p className="text-gray-400 mt-1">Track and snapshot your content history</p>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
        </div>
      ) : posts.length === 0 ? (
        <div className="flex-1 bg-gray-900 border border-gray-800 rounded-2xl flex flex-col items-center justify-center p-8 text-center">
          <Layers size={48} className="text-gray-600 mb-4 animate-pulse" />
          <h3 className="text-white text-lg font-semibold mb-2">No posts available</h3>
          <p className="text-gray-500 max-w-sm">Create a new draft in the dashboard to start versioning.</p>
        </div>
      ) : (
        <div className="flex-1 flex gap-6 overflow-hidden min-h-0">
          {/* Post Selection List */}
          <div className="w-1/3 bg-gray-900 border border-gray-800 rounded-2xl flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-800 bg-gray-900/50">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Your Posts</span>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-gray-800/60 p-2 space-y-1">
              {posts.map(post => (
                <button
                  key={post.id}
                  onClick={() => setSelectedPostId(post.id)}
                  className={clsx(
                    'w-full text-left p-3.5 rounded-xl transition duration-150 flex flex-col gap-1 border',
                    selectedPostId === post.id
                      ? 'bg-orange-500/10 border-orange-500/30 text-white'
                      : 'bg-transparent border-transparent text-gray-400 hover:bg-gray-800/40 hover:text-white'
                  )}
                >
                  <span className="font-semibold text-sm truncate block">{post.title}</span>
                  <div className="flex items-center justify-between text-xs text-gray-500 mt-1 w-full">
                    <span className="flex items-center gap-1">
                      <Layers size={12} />
                      {post.draft_versions.length} versions
                    </span>
                    <span>{new Date(post.created_at).toLocaleDateString()}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Timeline and version history */}
          <div className="w-2/3 bg-gray-900 border border-gray-800 rounded-2xl flex flex-col overflow-hidden">
            {selectedPost ? (
              <>
                {/* Header */}
                <div className="px-6 py-5 border-b border-gray-800 flex items-center justify-between bg-gray-900/50 flex-shrink-0">
                  <div className="min-w-0 pr-4">
                    <span className="text-xs text-orange-400 font-semibold uppercase tracking-wider">Active Workspace</span>
                    <h3 className="text-white font-bold text-lg truncate mt-0.5">{selectedPost.title}</h3>
                  </div>

                  <button
                    onClick={handleSaveNewVersion}
                    disabled={savingNewVersion}
                    className={clsx(
                      'flex items-center gap-2 font-semibold text-sm px-4 py-2.5 rounded-lg transition duration-200 shadow-md',
                      saveSuccess 
                        ? 'bg-green-500 hover:bg-green-600 text-white'
                        : 'bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-50'
                    )}
                  >
                    {saveSuccess ? (
                      <>
                        <CheckCircle size={16} />
                        Version Saved!
                      </>
                    ) : (
                      <>
                        <Plus size={16} />
                        {savingNewVersion ? 'Saving...' : 'Save Current Version'}
                      </>
                    )}
                  </button>
                </div>

                {/* Main panel - Scrollable list of versions */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8 relative">
                  <div className="absolute top-0 bottom-0 left-[35px] w-0.5 bg-gray-850 z-0"></div>

                  {selectedPost.draft_versions.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-gray-500">No saved versions found for this post.</p>
                    </div>
                  ) : (
                    selectedPost.draft_versions.map((version, index) => (
                      <div key={version.id} className="relative z-10 flex gap-6 group">
                        {/* Timeline Node */}
                        <div className="w-10 h-10 rounded-full border border-gray-800 bg-gray-950 flex items-center justify-center text-sm font-semibold text-orange-400 font-mono shadow-inner group-hover:border-orange-500/50 group-hover:text-orange-300 transition duration-150">
                          v{version.version_number}
                        </div>

                        {/* Card Content */}
                        <div className="flex-1 bg-gray-900/40 border border-gray-800/80 rounded-xl p-5 group-hover:border-gray-800 transition duration-150 shadow-sm">
                          <div className="flex items-center justify-between mb-3 border-b border-gray-850 pb-2">
                            <span className="text-xs text-gray-500 font-medium flex items-center gap-1">
                              <Calendar size={12} />
                              {new Date(version.created_at).toLocaleString()}
                            </span>
                            {index === 0 && (
                              <span className="text-[10px] uppercase font-bold tracking-wider text-orange-400 bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 rounded-full">
                                Latest
                              </span>
                            )}
                          </div>
                          
                          <p className="text-gray-300 text-sm whitespace-pre-wrap leading-relaxed">
                            {version.content_snapshot}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                <FileText size={40} className="text-gray-700 mb-3" />
                <p className="text-gray-500">Select a post to view its draft history timeline.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
