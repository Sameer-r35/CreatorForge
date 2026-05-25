import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { post_id, content_snapshot } = await request.json();
  if (!post_id) {
    return NextResponse.json({ error: 'post_id required' }, { status: 400 });
  }
  // Get current max version number for the post
  const { data: existing, error: fetchErr } = await supabase
    .from('draft_versions')
    .select('version_number')
    .eq('post_id', post_id)
    .order('version_number', { ascending: false })
    .limit(1)
    .single();
  if (fetchErr && fetchErr.code !== 'PGRST116') {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }
  const nextVersion = (existing?.version_number ?? 0) + 1;
  const { error: insertErr } = await supabase.from('draft_versions').insert({
    post_id,
    content_snapshot: content_snapshot ?? null,
    version_number: nextVersion,
  });
  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }
  return NextResponse.json({ success: true, version_number: nextVersion });
}
