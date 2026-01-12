#!/usr/bin/env node

/**
 * Generate Dynamic Sitemaps for Products, Vendors, and Categories
 * This ensures search engine bots can discover and index all individual product/service pages
 * 
 * Usage: node tools/generateSitemap.js
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const BASE_URL = 'https://indiantrademart.com';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Error: Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * XML Header for sitemap
 */
const xmlHeader = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';
const xmlFooter = '</urlset>';

/**
 * Create URL entry for sitemap
 */
const createUrlEntry = (location, lastmod, priority = '0.7', changefreq = 'weekly') => {
  return `  <url>
    <loc>${location}</loc>
    <lastmod>${lastmod}</lastmod>
    <priority>${priority}</priority>
    <changefreq>${changefreq}</changefreq>
  </url>`;
};

/**
 * Get current date in YYYY-MM-DD format
 */
const getCurrentDate = () => {
  const now = new Date();
  return now.toISOString().split('T')[0];
};

/**
 * Generate Products Sitemap
 */
const generateProductsSitemap = async () => {
  console.log('📦 Generating products sitemap...');
  
  try {
    const { data: products, error } = await supabase
      .from('products')
      .select('id, slug, updated_at, status')
      .eq('status', 'PUBLISHED')
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching products:', error);
      return null;
    }

    if (!products || products.length === 0) {
      console.warn('⚠️  No published products found');
      return null;
    }

    const urls = products.map(product => {
      const lastmod = product.updated_at ? product.updated_at.split('T')[0] : getCurrentDate();
      return createUrlEntry(
        `${BASE_URL}/p/${product.slug || product.id}`,
        lastmod,
        '0.8',
        'weekly'
      );
    });

    const sitemap = `${xmlHeader}
${urls.join('\n')}
${xmlFooter}`;

    return sitemap;
  } catch (err) {
    console.error('Fatal error generating products sitemap:', err);
    return null;
  }
};

/**
 * Generate Vendors Sitemap
 */
const generateVendorsSitemap = async () => {
  console.log('🏢 Generating vendors sitemap...');
  
  try {
    const { data: vendors, error } = await supabase
      .from('vendors')
      .select('id, company_slug, updated_at, status')
      .eq('status', 'VERIFIED')
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching vendors:', error);
      return null;
    }

    if (!vendors || vendors.length === 0) {
      console.warn('⚠️  No verified vendors found');
      return null;
    }

    const urls = vendors.map(vendor => {
      const lastmod = vendor.updated_at ? vendor.updated_at.split('T')[0] : getCurrentDate();
      return createUrlEntry(
        `${BASE_URL}/directory/vendor/${vendor.id}`,
        lastmod,
        '0.7',
        'monthly'
      );
    });

    const sitemap = `${xmlHeader}
${urls.join('\n')}
${xmlFooter}`;

    return sitemap;
  } catch (err) {
    console.error('Fatal error generating vendors sitemap:', err);
    return null;
  }
};

/**
 * Generate Categories Sitemap
 */
const generateCategoriesSitemap = async () => {
  console.log('📂 Generating categories sitemap...');
  
  try {
    const urls = [];

    // Fetch head categories
    const { data: headCats, error: headError } = await supabase
      .from('head_categories')
      .select('slug, updated_at')
      .order('updated_at', { ascending: false });

    if (headError) {
      console.error('Error fetching head categories:', headError);
      return null;
    }

    // Fetch sub categories
    const { data: subCats, error: subError } = await supabase
      .from('sub_categories')
      .select('slug, updated_at')
      .order('updated_at', { ascending: false });

    if (subError) {
      console.error('Error fetching sub categories:', subError);
      return null;
    }

    // Fetch micro categories
    const { data: microCats, error: microError } = await supabase
      .from('micro_categories')
      .select('slug, updated_at')
      .order('updated_at', { ascending: false });

    if (microError) {
      console.error('Error fetching micro categories:', microError);
      return null;
    }

    // Add head categories
    if (headCats) {
      headCats.forEach(cat => {
        const lastmod = cat.updated_at ? cat.updated_at.split('T')[0] : getCurrentDate();
        urls.push(createUrlEntry(
          `${BASE_URL}/directory/${cat.slug}`,
          lastmod,
          '0.8',
          'weekly'
        ));
      });
    }

    // Add sub categories
    if (subCats) {
      subCats.forEach(cat => {
        const lastmod = cat.updated_at ? cat.updated_at.split('T')[0] : getCurrentDate();
        urls.push(createUrlEntry(
          `${BASE_URL}/directory/subcategory/${cat.slug}`,
          lastmod,
          '0.75',
          'weekly'
        ));
      });
    }

    // Add micro categories
    if (microCats) {
      microCats.forEach(cat => {
        const lastmod = cat.updated_at ? cat.updated_at.split('T')[0] : getCurrentDate();
        urls.push(createUrlEntry(
          `${BASE_URL}/directory/microcategory/${cat.slug}`,
          lastmod,
          '0.7',
          'weekly'
        ));
      });
    }

    if (urls.length === 0) {
      console.warn('⚠️  No categories found');
      return null;
    }

    const sitemap = `${xmlHeader}
${urls.join('\n')}
${xmlFooter}`;

    return sitemap;
  } catch (err) {
    console.error('Fatal error generating categories sitemap:', err);
    return null;
  }
};

/**
 * Write sitemap file to public directory
 */
const writeSitemap = (filename, content) => {
  if (!content) {
    console.warn(`⚠️  Skipping empty sitemap: ${filename}`);
    return false;
  }

  const publicDir = path.join(process.cwd(), 'public');
  const filePath = path.join(publicDir, filename);

  try {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`✅ Created ${filename}`);
    return true;
  } catch (err) {
    console.error(`❌ Error writing ${filename}:`, err);
    return false;
  }
};

/**
 * Main execution
 */
const main = async () => {
  console.log('\n🤖 Starting dynamic sitemap generation...\n');

  const startTime = Date.now();

  try {
    const [productsSitemap, vendorsSitemap, categoriesSitemap] = await Promise.all([
      generateProductsSitemap(),
      generateVendorsSitemap(),
      generateCategoriesSitemap(),
    ]);

    let successCount = 0;

    if (writeSitemap('sitemap-products.xml', productsSitemap)) successCount++;
    if (writeSitemap('sitemap-vendors.xml', vendorsSitemap)) successCount++;
    if (writeSitemap('sitemap-categories.xml', categoriesSitemap)) successCount++;

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n✨ Sitemap generation complete! (${duration}s)`);
    console.log(`📊 Generated ${successCount}/3 sitemaps\n`);

    console.log('📍 Reference these in robots.txt:');
    console.log('   Sitemap: https://indiantrademart.com/sitemap-products.xml');
    console.log('   Sitemap: https://indiantrademart.com/sitemap-vendors.xml');
    console.log('   Sitemap: https://indiantrademart.com/sitemap-categories.xml\n');

  } catch (err) {
    console.error('❌ Fatal error:', err);
    process.exit(1);
  }
};

// Run
main().catch(err => {
  console.error('Uncaught error:', err);
  process.exit(1);
});
