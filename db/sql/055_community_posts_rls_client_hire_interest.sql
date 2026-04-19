-- Allow clients who tapped Hire to read the related community post and its images
-- after the pulse expires (RLS previously hid expired rows from everyone except the author).

drop policy if exists "community_posts_select_visible" on public.community_posts;
create policy "community_posts_select_visible"
  on public.community_posts for select
  using (
    author_id = auth.uid()
    or (
      status = 'active'
      and expires_at > now()
    )
    or exists (
      select 1
      from public.community_post_hire_interests h
      where h.community_post_id = community_posts.id
        and h.client_id = auth.uid()
    )
  );

drop policy if exists "community_post_images_select_if_post_visible" on public.community_post_images;
create policy "community_post_images_select_if_post_visible"
  on public.community_post_images for select
  using (
    exists (
      select 1 from public.community_posts p
      where p.id = community_post_images.post_id
        and (
          p.author_id = auth.uid()
          or (p.status = 'active' and p.expires_at > now())
          or exists (
            select 1 from public.community_post_hire_interests h
            where h.community_post_id = p.id
              and h.client_id = auth.uid()
          )
        )
    )
  );
