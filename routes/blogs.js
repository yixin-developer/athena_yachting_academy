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

    const qs = `populate=featuredimage&pagination[page]=${page}&pagination[pageSize]=9&sort=publisheddate:desc`;
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
    const slug = req.params.slug;

    // ✅ Use lowercase slug + lowercase featuredimage
    const url = `${POSTS_URL}?filters[slug][$eq]=${slug}`;
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

    // Convert markdown to HTML
    const htmlContent = marked.parse(post.richcontent || '');

    res.render('blog/single', { post, htmlContent });
  } catch (err) {
    console.error('🚨 Single post error:', err);
    res.status(500).send('Error loading post');
  }
});

module.exports = router;