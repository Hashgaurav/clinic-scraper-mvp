# 🚀 Deployment Guide

## Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/Hashgaurav/clinic-scraper-mvp.git
   cd clinic-scraper-mvp
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Install Playwright browsers**
   ```bash
   npx playwright install chromium
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

5. **Open browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Production Deployment

### Vercel (Recommended)

1. **Connect to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Import your GitHub repository
   - Deploy automatically

2. **Environment Variables**
   - **Required**: Add `TARGET_CLINIC_URL` with your clinic booking URL
   - **Optional**: Add `PROXY_LIST` if using proxies
   - Set these in Vercel dashboard → Project Settings → Environment Variables

3. **Vercel Configuration**
   - The `vercel.json` file is included for proper function timeout settings
   - Scraping operations are set to 60-second timeout
   - No additional configuration needed

### Docker Deployment

1. **Create Dockerfile**
   ```dockerfile
   FROM node:18-alpine
   
   WORKDIR /app
   COPY package*.json ./
   RUN npm ci --only=production
   
   COPY . .
   RUN npx playwright install chromium
   
   EXPOSE 3000
   CMD ["npm", "start"]
   ```

2. **Build and run**
   ```bash
   docker build -t clinic-scraper-mvp .
   docker run -p 3000:3000 clinic-scraper-mvp
   ```

### Manual Server Deployment

1. **Server requirements**
   - Node.js 18+
   - 1GB RAM minimum
   - Chromium browser support

2. **Deployment steps**
   ```bash
   git clone https://github.com/Hashgaurav/clinic-scraper-mvp.git
   cd clinic-scraper-mvp
   npm install
   npx playwright install chromium
   npm run build
   npm start
   ```

## Environment Configuration

### Required
- `TARGET_CLINIC_URL`: The clinic booking URL to scrape

### Optional
- `PROXY_LIST`: Comma-separated proxy URLs for rotation

## Performance Considerations

- **Memory usage**: ~200MB base + ~100MB per concurrent scrape
- **CPU usage**: Moderate during scraping operations
- **Network**: Requires internet access for scraping
- **Storage**: No persistent storage (in-memory only)

## Security Notes

- This is a demonstration MVP
- No authentication required
- No sensitive data storage
- Proxy credentials should be secured
- Consider rate limiting for production use

## Monitoring

- Check application logs for scraping errors
- Monitor memory usage during peak times
- Verify Playwright browser installation
- Test proxy connectivity if configured

## Troubleshooting

### Common Issues

1. **Playwright browser not found**
   ```bash
   npx playwright install chromium
   ```

2. **Memory issues**
   - Increase server RAM
   - Reduce concurrent scraping

3. **Proxy connection errors**
   - Verify proxy URLs
   - Check proxy credentials
   - Test proxy connectivity

4. **Scraping timeouts**
   - Increase timeout values
   - Check target website availability
   - Verify network connectivity
