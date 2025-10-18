# 🏥 Clinic Availability Scraper MVP

A minimal proof-of-concept scraper for extracting appointment availability from clinic booking systems. Built for client demonstration purposes.

## ✨ Features

- **Real-time scraping** of Aspit booking system
- **Month navigation calendar** with date selection
- **XHR interception** to capture API responses
- **Doctor mapping** with appointment details
- **In-memory caching** (5-minute TTL)
- **Proxy rotation** support
- **Professional UI** with responsive design
- **Comprehensive data extraction** (45+ slots, 143+ dates)
- **Dynamic month loading** with real-time updates

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ (we use 18.20.8)
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd scrapper-mvp
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Install Playwright browsers**
   ```bash
   npx playwright install chromium
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 🎯 Usage

1. **Click "Fetch Availability"** to scrape the Aspit booking system
2. **Navigate months** using the arrow buttons or quick jump
3. **Select a date** to view available time slots
4. **View appointment details** including doctor names and times

## 🏗️ Architecture

### Tech Stack

- **Frontend**: Next.js 14 with TypeScript and Tailwind CSS
- **Scraping**: Playwright with Chromium browser
- **Caching**: In-memory Map (5-minute TTL)
- **Proxy**: https-proxy-agent with rotation support

### Project Structure

```
├── app/
│   ├── api/scrape/route.ts    # API endpoint for scraping
│   ├── page.tsx               # Main UI component
│   └── layout.tsx             # Root layout
├── lib/
│   ├── aspit-scraper.ts       # Core scraping logic
│   └── proxy-helper.ts        # Proxy rotation utilities
├── public/                    # Static assets
└── package.json
```

## 🔧 Configuration

### Environment Variables

Create a `.env.local` file:

```env
# Required: Target clinic URL to scrape
TARGET_CLINIC_URL=https://timebestilling.aspit.no/#/p3775/services/15/appointment/54/calendar#calendar-title

# Optional: Comma-separated list of proxy URLs
PROXY_LIST=http://proxy1:port,http://proxy2:port
```

### Target URL

The scraper URL is configured via the `TARGET_CLINIC_URL` environment variable. This ensures the target URL is not exposed in the public repository for security purposes.

## 📊 Data Structure

### API Response

```typescript
{
  clinic: string;
  availableDates: Array<{
    date: string;    // YYYY-MM-DD format
    count: number;   // Number of available slots
  }>;
  slots: Array<{
    date: string;    // YYYY-MM-DD format
    time: string;    // HH:MM format
    doctor?: string; // Doctor name
  }>;
  cached: boolean;
  scrapedAt: string;
}
```

## 🎨 UI Features

### Month Navigation
- **Previous/Next buttons** for month browsing
- **Quick jump** to months with appointments
- **Current month display** with appointment counts

### Date Selection
- **Interactive date cards** with slot counts
- **Visual selection states** with blue highlighting
- **Empty state handling** for months without appointments

### Time Slots
- **Date-specific filtering** of appointment times
- **Doctor information** display
- **Professional card layout** with availability status

## 🔍 How It Works

1. **Playwright launches** a headless Chromium browser
2. **Navigates to target URL** with optional proxy rotation
3. **Intercepts XHR/fetch requests** to capture API responses
4. **Parses JSON data** to extract availability information
5. **Maps doctor IDs** to names from therapist data
6. **Returns structured data** with dates and time slots
7. **Caches results** in memory for 5 minutes

## 🚨 Limitations (MVP)

- **No database storage** - data is ephemeral
- **Manual triggering only** - no automated scheduling
- **Single clinic support** - hardcoded to Aspit
- **In-memory caching** - lost on server restart
- **No user authentication** - public access only

## 🛠️ Development

### Available Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run start    # Start production server
```

### Testing

The scraper can be tested by:

1. Opening the browser interface
2. Clicking "Fetch Availability"
3. Checking the browser console for any errors
4. Verifying appointment data appears correctly

## 📝 Notes

This is a **proof-of-concept MVP** designed for client demonstration. It's not production-ready and should not be used for actual booking systems without significant modifications.

### Future Enhancements

If the project moves forward, consider:

- Database integration (PostgreSQL/MongoDB)
- Job queue system (BullMQ/Redis)
- Multiple clinic support
- User authentication
- Automated scheduling
- Advanced proxy health tracking
- Unit and integration tests

## 📄 License

This project is for demonstration purposes only.

## 🤝 Contributing

This is a client demonstration project. Please contact the project owner for any questions or modifications.

---

**Built with ❤️ for clinic availability monitoring**