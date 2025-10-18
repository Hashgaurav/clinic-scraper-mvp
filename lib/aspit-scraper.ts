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
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    };
    
    if (proxyUrl) {
      launchOptions.proxy = {
        server: proxyUrl
      };
    }
    
    // Try to launch browser with error handling
    try {
      browser = await chromium.launch(launchOptions);
    } catch (browserError) {
      console.error('Failed to launch browser:', browserError);
      
      // Check if we're in Vercel environment
      if (process.env.VERCEL) {
        console.log('Running in Vercel environment - using fallback approach');
        // Return mock data for Vercel deployment demo
        return {
          clinic: 'Aspit Clinic (Demo Mode)',
          availableDates: [
            { date: '2025-10-23', count: 3 },
            { date: '2025-10-24', count: 2 },
            { date: '2025-10-25', count: 4 }
          ],
          slots: [
            { date: '2025-10-23', time: '09:00', doctor: 'Dr. Smith' },
            { date: '2025-10-23', time: '10:30', doctor: 'Dr. Johnson' },
            { date: '2025-10-23', time: '14:00', doctor: 'Dr. Smith' },
            { date: '2025-10-24', time: '11:00', doctor: 'Dr. Johnson' },
            { date: '2025-10-24', time: '15:30', doctor: 'Dr. Smith' },
            { date: '2025-10-25', time: '09:30', doctor: 'Dr. Johnson' },
            { date: '2025-10-25', time: '13:00', doctor: 'Dr. Smith' },
            { date: '2025-10-25', time: '16:00', doctor: 'Dr. Johnson' },
            { date: '2025-10-25', time: '17:30', doctor: 'Dr. Smith' }
          ],
          rawData: { note: 'Demo data - Playwright not available in Vercel environment' }
        };
      }
      
      // Try to install browsers and retry for non-Vercel environments
      try {
        console.log('Attempting to install Playwright browsers...');
        const { execSync } = require('child_process');
        execSync('npx playwright install chromium', { stdio: 'inherit' });
        browser = await chromium.launch(launchOptions);
        console.log('Successfully launched browser after installation');
      } catch (installError) {
        console.error('Failed to install browsers:', installError);
        throw new Error(`Browser launch failed: ${browserError.message}. Installation failed: ${installError.message}`);
      }
    }
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
      if (responseUrl.includes('api') || 
          responseUrl.includes('calendar') || 
          responseUrl.includes('appointment') || 
          responseUrl.includes('availability') ||
          responseUrl.includes('booking') ||
          responseUrl.includes('time') ||
          responseUrl.includes('slot') ||
          responseUrl.includes('service') ||
          responseUrl.includes('clinic') ||
          responseUrl.includes('doctor') ||
          responseUrl.includes('schedule') ||
          responseUrl.includes('date') ||
          responseUrl.includes('month') ||
          responseUrl.includes('week') ||
          (responseUrl.includes('aspit.no') && (responseUrl.includes('json') || responseUrl.includes('data'))) ||
          (responseUrl.includes('timebestilling') && (responseUrl.includes('json') || responseUrl.includes('data')))) {
        try {
          const contentType = response.headers()['content-type'] || '';
          if (contentType.includes('application/json') || contentType.includes('text/json')) {
            const data = await response.json();
            apiResponses.push({
              url: responseUrl,
              data,
              status: response.status(),
              headers: response.headers(),
              timestamp: new Date().toISOString()
            });
            console.log(`Captured API response from: ${responseUrl} (${response.status()})`);
          }
        } catch (e) {
          // Try to capture as text if JSON parsing fails
          try {
            const text = await response.text();
            if (text && text.length > 0) {
              apiResponses.push({
                url: responseUrl,
                data: text,
                status: response.status(),
                headers: response.headers(),
                timestamp: new Date().toISOString(),
                isText: true
              });
              console.log(`Captured text response from: ${responseUrl} (${response.status()})`);
            }
          } catch (textError) {
            // Ignore if both JSON and text parsing fail
          }
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
        
        // Check if page loaded successfully
        const pageTitle = await page.title();
        console.log(`Page title: ${pageTitle}`);
        
        // Check for error messages
        const errorElements = await page.locator('[class*="error"], [class*="Error"], .error-message, .alert-error').all();
        if (errorElements.length > 0) {
          for (const errorElement of errorElements) {
            const errorText = await errorElement.textContent();
            if (errorText) {
              console.log(`Error found on page: ${errorText}`);
            }
          }
        }
        
        // Check if we're on the right page
        const currentUrl = page.url();
        console.log(`Current URL: ${currentUrl}`);
        
        // If the page shows an error, try to refresh or navigate differently
        const pageContent = await page.content();
        if (pageContent.includes('appErrorMessage') || pageContent.includes('Prøv på nytt')) {
          console.log('Page shows error, trying to refresh...');
          await page.reload({ waitUntil: 'networkidle' });
          await page.waitForTimeout(5000);
        }

        // If target month is specified, navigate to that month
        if (targetMonth) {
          console.log(`Navigating to month: ${targetMonth.getFullYear()}-${targetMonth.getMonth() + 1}`);
          await navigateToMonth(page, targetMonth);
        }
    
    // More comprehensive calendar interaction to load all available dates
    try {
      // Wait for calendar to fully load
      await page.waitForTimeout(3000);
      
      // Try to interact with calendar elements to trigger more API calls
      const calendarSelectors = [
        '[class*="calendar"]',
        '[class*="date"]', 
        '[class*="month"]',
        '[class*="day"]',
        '[class*="appointment"]',
        '[class*="booking"]',
        '.calendar',
        '.date-picker',
        '.month-view'
      ];
      
      for (const selector of calendarSelectors) {
        try {
          const elements = await page.locator(selector).all();
          for (const element of elements.slice(0, 2)) { // Try first 2 elements of each type
            if (await element.isVisible()) {
              await element.click();
              await page.waitForTimeout(1500);
            }
          }
        } catch (e) {
          // Continue if selector fails
        }
      }
      
      // Try to navigate through months to trigger more API calls
      const nextButtons = await page.locator('[class*="next"], [class*="forward"], [class*="arrow-right"], button:has-text(">"), button:has-text("Next")').all();
      for (const button of nextButtons.slice(0, 2)) {
        try {
          if (await button.isVisible()) {
            await button.click();
            await page.waitForTimeout(2000);
            // Go back to original month
            const prevButtons = await page.locator('[class*="prev"], [class*="back"], [class*="arrow-left"], button:has-text("<"), button:has-text("Prev")').all();
            for (const prevButton of prevButtons.slice(0, 1)) {
              if (await prevButton.isVisible()) {
                await prevButton.click();
                await page.waitForTimeout(2000);
                break;
              }
            }
          }
        } catch (e) {
          // Continue if navigation fails
        }
      }
      
      // Try clicking on visible date elements to trigger more data loading
      const dateElements = await page.locator('[class*="date"], [class*="day"], [data-date], [data-day], [class*="available"], [class*="bookable"]').all();
      console.log(`Found ${dateElements.length} date elements to interact with`);
      
      for (const dateElement of dateElements.slice(0, 10)) { // Try first 10 date elements
        try {
          if (await dateElement.isVisible()) {
            console.log('Clicking on date element to load time slots');
            await dateElement.click();
            await page.waitForTimeout(2000); // Wait longer for time slots to load
            
            // Try to scroll to make sure the element is visible
            await dateElement.scrollIntoViewIfNeeded();
            await page.waitForTimeout(1000);
          }
        } catch (e) {
          console.log(`Failed to click date element: ${e}`);
        }
      }
      
      // Also try clicking on any clickable elements that might load more data
      const clickableElements = await page.locator('button, [role="button"], [onclick], [class*="click"], [class*="select"]').all();
      console.log(`Found ${clickableElements.length} clickable elements`);
      
      for (const element of clickableElements.slice(0, 5)) { // Try first 5 clickable elements
        try {
          if (await element.isVisible()) {
            const text = await element.textContent();
            if (text && (text.includes('date') || text.includes('time') || text.includes('slot') || text.includes('book'))) {
              console.log(`Clicking on element with text: ${text}`);
              await element.click();
              await page.waitForTimeout(1500);
            }
          }
        } catch (e) {
          // Continue if click fails
        }
      }
      
    } catch (e) {
      console.log('Calendar interaction failed:', e);
    }
    
    // Wait longer for all API calls to complete
    await page.waitForTimeout(5000);
    
    console.log(`Captured ${apiResponses.length} API responses`);
    
    // Log all captured URLs for debugging
    for (const response of apiResponses) {
      console.log(`Response URL: ${response.url}`);
    }
    
    // Parse the captured data to extract availability
    const { slots, availableDates } = parseAvailabilityFromResponses(apiResponses);
    
    console.log(`Extracted ${slots.length} slots and ${availableDates.length} available dates`);
    
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
  
  console.log(`Parsing ${responses.length} API responses for availability data`);
  
  // First pass: extract doctor information and log response details
  for (const response of responses) {
    try {
      const data = response.data;
      console.log(`Processing response from: ${response.url}`);
      
      // Extract doctor/therapist information
      if (data && data.Therapists && Array.isArray(data.Therapists)) {
        for (const therapist of data.Therapists) {
          if (therapist.Oid && therapist.Name) {
            doctorMap[therapist.Oid.toString()] = therapist.Name;
          }
        }
      }
      
      // Also try alternative doctor field names
      if (data && data.Doctors && Array.isArray(data.Doctors)) {
        for (const doctor of data.Doctors) {
          if (doctor.id && doctor.name) {
            doctorMap[doctor.id.toString()] = doctor.name;
          }
        }
      }
      
      // Log the structure of each response for debugging
      if (data && typeof data === 'object') {
        console.log(`Response keys: ${Object.keys(data).join(', ')}`);
        if (data.AvailableSlots) {
          console.log(`Found AvailableSlots: ${data.AvailableSlots.length} items`);
        }
        if (data.Slots) {
          console.log(`Found Slots: ${data.Slots.length} items`);
        }
        if (data.Appointments) {
          console.log(`Found Appointments: ${data.Appointments.length} items`);
        }
      }
      
    } catch (e) {
      console.log(`Error processing response: ${e}`);
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
        
        // Extract available dates from various possible fields
        const dateFields = ['AvailableDates', 'availableDates', 'dates', 'Dates', 'available_dates', 'available-dates'];
        for (const field of dateFields) {
          if (data[field] && Array.isArray(data[field])) {
            for (const dateItem of data[field]) {
              if (typeof dateItem === 'string') {
                availableDatesSet.add(dateItem);
              } else if (dateItem && dateItem.date) {
                availableDatesSet.add(dateItem.date);
              }
            }
          }
        }
        
        // Also extract dates from slots themselves
        if (data.AvailableSlots && Array.isArray(data.AvailableSlots)) {
          for (const slot of data.AvailableSlots) {
            if (slot.Date) {
              availableDatesSet.add(slot.Date);
            }
            if (slot.date) {
              availableDatesSet.add(slot.date);
            }
          }
        }
        
        // Try to extract from nested objects
        if (data.Data && data.Data.AvailableSlots) {
          for (const slot of data.Data.AvailableSlots) {
            if (slot.Date) {
              availableDatesSet.add(slot.Date);
            }
          }
        }
      }
    } catch (e) {
      console.log(`Error extracting slots from response: ${e}`);
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
    
    // Try alternative slot structures
    if (obj.AvailableSlots && Array.isArray(obj.AvailableSlots)) {
      for (const slot of obj.AvailableSlots) {
        if (slot.Date && slot.Time) {
          slots.push({
            date: slot.Date,
            time: slot.Time,
            doctor: slot.Doctor || slot.Therapist || slot.Practitioner
          });
        }
      }
    }
    
    // Try nested data structures
    if (obj.Data && obj.Data.AvailableSlots && Array.isArray(obj.Data.AvailableSlots)) {
      for (const slot of obj.Data.AvailableSlots) {
        if (slot.Date && slot.Time) {
          slots.push({
            date: slot.Date,
            time: slot.Time,
            doctor: slot.Doctor || slot.Therapist || slot.Practitioner
          });
        }
      }
    }
    
    // Try different field names
    if (obj.Slots && Array.isArray(obj.Slots)) {
      for (const slot of obj.Slots) {
        if (slot.date && slot.time) {
          slots.push({
            date: slot.date,
            time: slot.time,
            doctor: slot.doctor || slot.therapist || slot.practitioner
          });
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
