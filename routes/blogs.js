const express = require('express');
const fetch = require('node-fetch');
const { marked } = require('marked');
const router = express.Router();

// Your Strapi base URL
const CMS_BASE = process.env.CMS_BASE || 'http://localhost:1337';
const POSTS_URL = `${CMS_BASE}/api/blog-posts`;

router.get('/', async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;

    // const qs = `populate=featuredimage&pagination[page]=${page}&pagination[pageSize]=9&sort=publisheddate:desc`;
    const qs = `populate=featuredimage&populate=categories&pagination[page]=${page}&pagination[pageSize]=9&sort=publisheddate:desc`;
    const url = `${POSTS_URL}?${qs}`;
    console.log('🔎 Fetching blog list:', url);

    const response = await fetch(url);
    const json = await response.json();

    if (json.error) {
      console.error('❌ Strapi error:', json.error);
      return res.status(500).send(json.error.message);
    }

    const posts = json.data || [];
    if (posts.length > 0) {
  console.log('🧱 Example post structure:', JSON.stringify(posts[0], null, 2));
}
    const pagination = json.meta?.pagination || {};

    console.log(`✅ Loaded ${posts.length} posts`);
    res.render('blog/list',  { posts, pagination, CMS_BASE });
  } catch (err) {
    console.error('🚨 Blog list error:', err);
    res.status(500).send('Error loading blog list');
  }
});

router.get('/:slug', async (req, res) => {
  try {
    const slug = encodeURIComponent(req.params.slug);

    // ✅ Populate relations for single post
    const qs = `populate=featuredimage&populate=categories`;
    const url = `${POSTS_URL}?${qs}&filters[slug][$eq]=${slug}`;
    console.log('🔎 Fetching single post:', url);

    const response = await fetch(url);
    const json = await response.json();

    if (json.error) {
      console.error('❌ Strapi error (single):', json.error);
      return res.status(500).send(json.error.message);
    }

    const post = json.data?.[0];
    if (!post) {
      console.log('⚠️ Post not found for slug:', slug);
      return res.status(404).render('404');
    }

    console.log(`✅ Loaded post: ${post.title}`);
    const htmlContent = marked.parse(post.richcontent || '');

    // (Optional) log to confirm categories are present
    console.log('📚 Categories on post:', post.categories?.map(c => c.Name || c.name || c.Slug || c.slug));

    res.render('blog/single', { post, htmlContent });
  } catch (err) {
    console.error('🚨 Single post error:', err);
    res.status(500).send('Error loading post');
  }
});

// routes/blogs.js (add this route)
router.get('/category/:slug', async (req, res) => {
  try {
    const catSlug = decodeURIComponent(req.params.slug);
    const page = Number(req.query.page || 1);

    const params = new URLSearchParams();
    params.set('pagination[page]', page);
    params.set('pagination[pageSize]', 9);
    params.set('sort', 'publisheddate:desc');
    params.append('populate', 'featuredimage');
    params.append('populate', 'categories');

    // IMPORTANT: your Category fields are "Name" and "Slug" (capitalized)
    params.set('filters[categories][Slug][$eqi]', catSlug); // case-insensitive match

    const url = `${POSTS_URL}?${params.toString()}`;
    console.log('🔎 Fetch category list:', url);

    const r = await fetch(url);
    const json = await r.json();

    if (json.error) {
      console.error('❌ Strapi error (category):', json.error);
      return res.status(500).send(json.error.message);
    }

    const posts = json.data || [];
    const pagination = json.meta?.pagination || {};

    res.render('blog/list', {
      posts,
      pagination,
      selectedCategory: catSlug,
      pageTitle: `AYA Blog — ${catSlug}`,
      CMS_BASE, // so your EJS can build image URLs
    });
  } catch (e) {
    console.error(e);
    res.status(500).send('Error loading category page');
  }
});


module.exports = router;