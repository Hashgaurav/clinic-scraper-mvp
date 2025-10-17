import { chromium, Browser, Page } from 'playwright';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { getNextProxy, getRandomUserAgent } from './proxy-helper';

export interface AvailabilitySlot {
  date: string;
  time: string;
  doctor?: string;
}

export interface AvailableDate {
  date: string;
  count: number;
}

export interface ScrapingResult {
  clinic: string;
  availableDates: AvailableDate[];
  slots: AvailabilitySlot[];
  rawData?: any;
  error?: string;
}

export async function scrapeAspit(url: string, proxy?: string, targetMonth?: Date): Promise<ScrapingResult> {
  let browser: Browser | null = null;
  
  try {
    // Get proxy if not provided
    const proxyUrl = proxy || getNextProxy();
    const userAgent = getRandomUserAgent();
    
    console.log(`Scraping Aspit with proxy: ${proxyUrl || 'none'}`);
    
    // Launch browser with proxy configuration
    const launchOptions: any = {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    };
    
    if (proxyUrl) {
      launchOptions.proxy = {
        server: proxyUrl
      };
    }
    
    browser = await chromium.launch(launchOptions);
    const context = await browser.newContext({
      userAgent,
      viewport: { width: 1280, height: 720 }
    });
    
    const page = await context.newPage();
    
    // Intercept network requests to capture API calls
    const apiResponses: any[] = [];
    
    page.on('response', async (response) => {
      const responseUrl = response.url();
      
      // Look for API endpoints that might contain availability data
      if (responseUrl.includes('api') || responseUrl.includes('calendar') || responseUrl.includes('appointment') || responseUrl.includes('availability')) {
        try {
          const contentType = response.headers()['content-type'] || '';
          if (contentType.includes('application/json')) {
            const data = await response.json();
            apiResponses.push({
              url: responseUrl,
              data,
              status: response.status()
            });
          }
        } catch (e) {
          // Ignore non-JSON responses
        }
      }
    });
    
        // Navigate to the page
        console.log(`Navigating to: ${url}`);
        await page.goto(url, {
          waitUntil: 'networkidle',
          timeout: 30000
        });

        // Wait for calendar/booking interface to load
        await page.waitForTimeout(3000);

        // If target month is specified, navigate to that month
        if (targetMonth) {
          console.log(`Navigating to month: ${targetMonth.getFullYear()}-${targetMonth.getMonth() + 1}`);
          await navigateToMonth(page, targetMonth);
        }
    
    // Try to find and click calendar elements to trigger API calls
    try {
      // Look for calendar navigation buttons or date selectors
      const calendarElements = await page.locator('[class*="calendar"], [class*="date"], [class*="month"], [class*="day"]').first();
      if (await calendarElements.isVisible()) {
        await calendarElements.click();
        await page.waitForTimeout(2000);
      }
    } catch (e) {
      console.log('No calendar elements found to interact with');
    }
    
    // Try to trigger more API calls by interacting with the page
    try {
      // Look for any buttons that might load more data
      const buttons = await page.locator('button, [role="button"]').all();
      for (const button of buttons.slice(0, 3)) { // Only try first 3 buttons
        try {
          if (await button.isVisible()) {
            await button.click();
            await page.waitForTimeout(1000);
          }
        } catch (e) {
          // Continue if button click fails
        }
      }
    } catch (e) {
      console.log('No interactive elements found');
    }
    
    // Wait a bit more for any delayed API calls
    await page.waitForTimeout(2000);
    
    console.log(`Captured ${apiResponses.length} API responses`);
    
    // Parse the captured data to extract availability
    const { slots, availableDates } = parseAvailabilityFromResponses(apiResponses);
    
    return {
      clinic: 'Aspit Clinic',
      availableDates,
      slots,
      rawData: apiResponses
    };
    
  } catch (error) {
    console.error('Scraping error:', error);
    return {
      clinic: 'Aspit Clinic',
      availableDates: [],
      slots: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

function parseAvailabilityFromResponses(responses: any[]): { slots: AvailabilitySlot[], availableDates: AvailableDate[] } {
  const slots: AvailabilitySlot[] = [];
  const doctorMap: { [key: string]: string } = {};
  const availableDatesSet = new Set<string>();
  
  // First pass: extract doctor information
  for (const response of responses) {
    try {
      const data = response.data;
      if (data && data.Therapists && Array.isArray(data.Therapists)) {
        for (const therapist of data.Therapists) {
          if (therapist.Oid && therapist.Name) {
            doctorMap[therapist.Oid.toString()] = therapist.Name;
          }
        }
      }
    } catch (e) {
      // Skip invalid responses
    }
  }
  
  // Second pass: extract availability slots and dates
  for (const response of responses) {
    try {
      const data = response.data;
      
      // Look for common patterns in the API response
      if (data && typeof data === 'object') {
        // Try different possible structures
        const possibleSlots = extractSlotsFromObject(data, '', doctorMap);
        slots.push(...possibleSlots);
        
        // Extract available dates from API response
        if (data.AvailableDates && Array.isArray(data.AvailableDates)) {
          for (const dateStr of data.AvailableDates) {
            availableDatesSet.add(dateStr);
          }
        }
      }
    } catch (e) {
      // Skip invalid responses
    }
  }
  
  // Remove duplicates and sort slots
  const uniqueSlots = slots.filter((slot, index, self) => 
    index === self.findIndex(s => s.date === slot.date && s.time === slot.time)
  );
  
  const sortedSlots = uniqueSlots.sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date);
    return dateCompare !== 0 ? dateCompare : a.time.localeCompare(b.time);
  });
  
  // Create available dates list with slot counts
  const availableDates: AvailableDate[] = [];
  const slotsByDate = sortedSlots.reduce((acc, slot) => {
    if (!acc[slot.date]) {
      acc[slot.date] = 0;
    }
    acc[slot.date]++;
    return acc;
  }, {} as Record<string, number>);
  
  // Add dates from API response
  for (const dateStr of availableDatesSet) {
    const count = slotsByDate[dateStr] || 0;
    availableDates.push({ date: dateStr, count });
  }
  
  // Add dates from actual slots (in case API doesn't provide all dates)
  for (const [date, count] of Object.entries(slotsByDate)) {
    if (!availableDatesSet.has(date)) {
      availableDates.push({ date, count });
    }
  }
  
  // Sort available dates
  availableDates.sort((a, b) => a.date.localeCompare(b.date));
  
  return { slots: sortedSlots, availableDates };
}

async function navigateToMonth(page: Page, targetMonth: Date): Promise<void> {
  try {
    const currentDate = new Date();
    const monthsDiff = (targetMonth.getFullYear() - currentDate.getFullYear()) * 12 + 
                      (targetMonth.getMonth() - currentDate.getMonth());
    
    if (monthsDiff === 0) {
      // Already on the target month
      return;
    }

    // Look for month navigation buttons
    const nextButton = page.locator('[class*="next"], [class*="forward"], [class*="arrow-right"]').first();
    const prevButton = page.locator('[class*="prev"], [class*="back"], [class*="arrow-left"]').first();
    
    const clicksNeeded = Math.abs(monthsDiff);
    const isNext = monthsDiff > 0;
    
    for (let i = 0; i < clicksNeeded; i++) {
      try {
        if (isNext) {
          if (await nextButton.isVisible()) {
            await nextButton.click();
          } else {
            // Try alternative selectors
            const altNext = page.locator('button:has-text(">"), button:has-text("Next"), [aria-label*="next"]').first();
            if (await altNext.isVisible()) {
              await altNext.click();
            }
          }
        } else {
          if (await prevButton.isVisible()) {
            await prevButton.click();
          } else {
            // Try alternative selectors
            const altPrev = page.locator('button:has-text("<"), button:has-text("Prev"), [aria-label*="previous"]').first();
            if (await altPrev.isVisible()) {
              await altPrev.click();
            }
          }
        }
        
        // Wait for the month to load
        await page.waitForTimeout(2000);
        
        // Wait for any API calls to complete
        await page.waitForTimeout(1000);
        
      } catch (e) {
        console.log(`Month navigation attempt ${i + 1} failed:`, e);
        // Continue trying other methods
      }
    }
    
    console.log(`Navigated to target month: ${targetMonth.getFullYear()}-${targetMonth.getMonth() + 1}`);
    
  } catch (error) {
    console.log('Month navigation failed:', error);
    // Continue with scraping even if month navigation fails
  }
}

function extractSlotsFromObject(obj: any, path: string = '', doctorMap: { [key: string]: string } = {}): AvailabilitySlot[] {
  const slots: AvailabilitySlot[] = [];
  
  if (Array.isArray(obj)) {
    for (const item of obj) {
        slots.push(...extractSlotsFromObject(item, path, doctorMap));
    }
  } else if (obj && typeof obj === 'object') {
    // Aspit-specific parsing for DurationTimeSlots
    if (obj.DurationTimeSlots && Array.isArray(obj.DurationTimeSlots)) {
      for (const durationSlot of obj.DurationTimeSlots) {
        if (durationSlot.TimeSlots && Array.isArray(durationSlot.TimeSlots)) {
          for (const timeSlot of durationSlot.TimeSlots) {
            if (timeSlot.Start && timeSlot.TimeSlot) {
              const startDate = new Date(timeSlot.Start);
              const dateStr = startDate.toISOString().split('T')[0];
              const timeStr = timeSlot.TimeSlot;
              
              slots.push({
                date: dateStr,
                time: timeStr,
                doctor: doctorMap[obj.User] || `User ${obj.User}`
              });
            }
          }
        }
      }
    }
    
    // Look for common availability patterns
    if (obj.date && obj.time) {
      slots.push({
        date: String(obj.date),
        time: String(obj.time),
        doctor: obj.doctor || obj.doctorName || obj.practitioner
      });
    }
    
    if (obj.Start && obj.TimeSlot) {
      const startDate = new Date(obj.Start);
      const dateStr = startDate.toISOString().split('T')[0];
      
      slots.push({
        date: dateStr,
        time: String(obj.TimeSlot),
        doctor: doctorMap[obj.User] || `User ${obj.User}`
      });
    }
    
    if (obj.startTime && obj.endTime) {
      slots.push({
        date: String(obj.date || obj.startDate),
        time: `${obj.startTime} - ${obj.endTime}`,
        doctor: obj.doctor || obj.doctorName || obj.practitioner
      });
    }
    
    if (obj.availableSlots && Array.isArray(obj.availableSlots)) {
      for (const slot of obj.availableSlots) {
        slots.push(...extractSlotsFromObject(slot, path, doctorMap));
      }
    }
    
    if (obj.appointments && Array.isArray(obj.appointments)) {
      for (const appointment of obj.appointments) {
        slots.push(...extractSlotsFromObject(appointment, path, doctorMap));
      }
    }
    
    // Recursively search nested objects
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'object' && value !== null) {
        slots.push(...extractSlotsFromObject(value, `${path}.${key}`, doctorMap));
      }
    }
  }
  
  return slots;
}
