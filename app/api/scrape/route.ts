import { NextRequest, NextResponse } from 'next/server';
import { scrapeAspit, ScrapingResult } from '@/lib/aspit-scraper';

// Simple in-memory cache
const cache = new Map<string, { data: ScrapingResult; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export async function GET(request: NextRequest) {
  try {
    // Get the target URL from environment variables
    const targetUrl = process.env.TARGET_CLINIC_URL;
    
    if (!targetUrl) {
      return NextResponse.json(
        { error: 'TARGET_CLINIC_URL environment variable is not configured' },
        { status: 500 }
      );
    }
    
    const { searchParams } = new URL(request.url);
    const proxy = searchParams.get('proxy') || undefined;
    const monthParam = searchParams.get('month');
    
    // Parse month parameter if provided
    let targetMonth: Date | undefined;
    if (monthParam) {
      try {
        targetMonth = new Date(monthParam);
        if (isNaN(targetMonth.getTime())) {
          targetMonth = undefined;
        }
      } catch (e) {
        targetMonth = undefined;
      }
    }
    
    // Check cache first (include month in cache key)
    const monthKey = targetMonth ? `-${targetMonth.getFullYear()}-${targetMonth.getMonth()}` : '';
    const cacheKey = `${targetUrl}-${proxy || 'no-proxy'}${monthKey}`;
    const cached = cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      console.log('Returning cached result');
      return NextResponse.json({
        ...cached.data,
        cached: true,
        cacheAge: Math.round((Date.now() - cached.timestamp) / 1000)
      });
    }
    
    console.log(`Scraping target URL from environment variables${targetMonth ? ` for month ${targetMonth.getFullYear()}-${targetMonth.getMonth() + 1}` : ''}`);
    
    // Scrape the data
    const result = await scrapeAspit(targetUrl, proxy, targetMonth);
    
    // Cache the result
    cache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    });
    
    // Clean up old cache entries
    cleanupCache();
    
    return NextResponse.json({
      ...result,
      cached: false,
      scrapedAt: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

function cleanupCache() {
  const now = Date.now();
  for (const [key, value] of cache.entries()) {
    if (now - value.timestamp > CACHE_DURATION) {
      cache.delete(key);
    }
  }
}
