// Öffentliche Testimonial-Ausspielung (Widget/Website) – nur freigegebene und veröffentlichte Zitate.
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const url = new URL(req.url);
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit') ?? 12)));

    const { data } = await admin.from('survey_testimonials')
      .select('id, quote, author_name, company_name, allow_name, allow_company, published_at')
      .eq('status', 'freigegeben').not('published_at', 'is', null)
      .order('published_at', { ascending: false }).limit(limit);

    const items = (data ?? []).map((t) => ({
      id: t.id,
      quote: t.quote,
      author: t.allow_name ? t.author_name : null,
      company: t.allow_company ? t.company_name : null,
      published_at: t.published_at,
    }));

    // Fertiges Carousel-Widget als JavaScript ausliefern (?format=js)
    if (url.searchParams.get('format') === 'js') {
      const accent = url.searchParams.get('accent') ?? '#c9a227';
      const interval = Math.max(3000, Number(url.searchParams.get('interval') ?? 6000));
      const js = `(function(){
  var ITEMS = ${JSON.stringify(items)};
  var ACCENT = ${JSON.stringify(accent)};
  var root = document.getElementById('alix-testimonials');
  if(!root || !ITEMS.length) return;
  var css = document.createElement('style');
  css.textContent = '.axt-wrap{position:relative;max-width:720px;margin:0 auto;font-family:inherit}'
    + '.axt-slide{opacity:0;position:absolute;inset:0;transition:opacity .6s ease;padding:28px 24px;text-align:center}'
    + '.axt-slide.is-on{opacity:1;position:relative}'
    + '.axt-q{font-size:1.05rem;line-height:1.6;margin:0 0 14px}'
    + '.axt-a{font-size:.85rem;opacity:.7}'
    + '.axt-mark{font-size:2.5rem;line-height:1;color:' + ACCENT + '}'
    + '.axt-dots{display:flex;gap:6px;justify-content:center;margin-top:14px}'
    + '.axt-dot{width:8px;height:8px;border-radius:50%;border:0;padding:0;cursor:pointer;background:currentColor;opacity:.25}'
    + '.axt-dot.is-on{opacity:1;background:' + ACCENT + '}';
  document.head.appendChild(css);
  var wrap = document.createElement('div'); wrap.className = 'axt-wrap';
  var stage = document.createElement('div'); stage.style.position = 'relative';
  ITEMS.forEach(function(t,i){
    var s = document.createElement('div'); s.className = 'axt-slide' + (i===0?' is-on':'');
    var meta = [t.author,t.company].filter(Boolean).join(', ');
    s.innerHTML = '<div class="axt-mark">\\u201C</div><p class="axt-q"></p><div class="axt-a"></div>';
    s.querySelector('.axt-q').textContent = t.quote;
    s.querySelector('.axt-a').textContent = meta;
    stage.appendChild(s);
  });
  wrap.appendChild(stage);
  var dots = document.createElement('div'); dots.className = 'axt-dots';
  ITEMS.forEach(function(_,i){
    var b = document.createElement('button'); b.className='axt-dot'+(i===0?' is-on':'');
    b.setAttribute('aria-label','Kundenstimme '+(i+1));
    b.onclick = function(){ show(i); };
    dots.appendChild(b);
  });
  if(ITEMS.length>1) wrap.appendChild(dots);
  root.innerHTML = ''; root.appendChild(wrap);
  var cur = 0, timer;
  function show(i){
    cur = (i + ITEMS.length) % ITEMS.length;
    stage.querySelectorAll('.axt-slide').forEach(function(el,x){ el.className = 'axt-slide' + (x===cur?' is-on':''); });
    dots.querySelectorAll('.axt-dot').forEach(function(el,x){ el.className = 'axt-dot' + (x===cur?' is-on':''); });
    clearInterval(timer); timer = setInterval(function(){ show(cur+1); }, ${interval});
  }
  if(ITEMS.length>1) timer = setInterval(function(){ show(cur+1); }, ${interval});
})();`;
      return new Response(js, {
        headers: { ...cors, 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'public, max-age=300' },
      });
    }


    return new Response(JSON.stringify({ items }), {
      headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});
