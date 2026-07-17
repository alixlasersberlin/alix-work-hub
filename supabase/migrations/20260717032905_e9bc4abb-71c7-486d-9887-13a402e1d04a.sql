
CREATE TABLE public.news_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  image_path TEXT,
  link_url TEXT,
  link_label TEXT,
  published BOOLEAN NOT NULL DEFAULT false,
  priority INTEGER NOT NULL DEFAULT 0,
  require_ack BOOLEAN NOT NULL DEFAULT true,
  publish_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.news_posts TO authenticated;
GRANT ALL ON public.news_posts TO service_role;
ALTER TABLE public.news_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "news_posts read published or super admin"
ON public.news_posts FOR SELECT TO authenticated
USING (published = true OR public.has_role('Super Admin'));

CREATE POLICY "news_posts insert super admin"
ON public.news_posts FOR INSERT TO authenticated
WITH CHECK (public.has_role('Super Admin'));

CREATE POLICY "news_posts update super admin"
ON public.news_posts FOR UPDATE TO authenticated
USING (public.has_role('Super Admin'))
WITH CHECK (public.has_role('Super Admin'));

CREATE POLICY "news_posts delete super admin"
ON public.news_posts FOR DELETE TO authenticated
USING (public.has_role('Super Admin'));

CREATE TABLE public.news_acknowledgements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  news_id UUID NOT NULL REFERENCES public.news_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (news_id, user_id)
);
GRANT SELECT, INSERT ON public.news_acknowledgements TO authenticated;
GRANT ALL ON public.news_acknowledgements TO service_role;
ALTER TABLE public.news_acknowledgements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "news_ack select own or super admin"
ON public.news_acknowledgements FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role('Super Admin'));

CREATE POLICY "news_ack insert own"
ON public.news_acknowledgements FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE TRIGGER trg_news_posts_updated_at
BEFORE UPDATE ON public.news_posts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "news-images authenticated read"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'news-images');

CREATE POLICY "news-images super admin insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'news-images' AND public.has_role('Super Admin'));

CREATE POLICY "news-images super admin update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'news-images' AND public.has_role('Super Admin'));

CREATE POLICY "news-images super admin delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'news-images' AND public.has_role('Super Admin'));
