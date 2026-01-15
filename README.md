# QuickSnag

**Korea's unified secondhand marketplace**

Search listings from Naver Cafe, Joongna, and Bunjang all in one place.

## Features

- **Unified Search**: Search multiple secondhand platforms simultaneously
- **Real-time Crawling**: Fetch the latest listings in real-time
- **Smart Filtering**: Filter by platform and price
- **Responsive Design**: Optimized for both mobile and desktop
- **Modern UI**: Intuitive and beautiful user interface

## Supported Platforms

| Platform | Description |
|----------|-------------|
| Naver Cafe | Integrated search across various Naver cafe communities |
| Joongna | Korea's leading secondhand marketplace |
| Bunjang | Mobile-optimized secondhand trading platform |

## Tech Stack

### Frontend
- React 18 (TypeScript)
- CSS3 (Modern gradient design)
- Axios

### Backend
- Node.js + Express.js
- Puppeteer (Web crawling)
- Cheerio (HTML parsing)

## Installation

### 1. Clone the repository
```bash
git clone https://github.com/your-username/quicksnag.git
cd quicksnag
```

### 2. Install dependencies
```bash
# Install backend dependencies
npm install

# Install client dependencies
cd client
npm install
cd ..
```

### 3. Run development server
```bash
# Run both backend and frontend
npm run dev
```

Or run separately:
```bash
# Backend only (port 5000)
npm run server

# Frontend only (port 3000)
npm run client
```

### 4. Production build
```bash
npm run build
npm start
```

## Vercel Deployment

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy
vercel

# Production deploy
vercel --prod
```

### Environment Variables (Vercel Dashboard)

- `NODE_ENV`: production
- `VERCEL`: 1

### Notes

- Puppeteer is conditionally disabled in Vercel's serverless environment.
- Current implementation uses axios-based API calls and works without Puppeteer.

## Usage

1. **Enter search query**: Type the product name you're looking for
2. **Select platforms**: Choose which platforms to search (multiple selection available)
3. **Sort options**: Sort by relevance, lowest price, or highest price
4. **Search**: Click the search button

## API

### GET /api/search

**Parameters:**
- `q` (required): Search query
- `sources` (optional): Platforms to search (naver, joongna, bunjang)

**Response example:**
```json
{
  "query": "iPhone",
  "total": 25,
  "results": [
    {
      "title": "iPhone 14 Pro for sale",
      "link": "https://...",
      "price": "900,000 KRW",
      "image": "https://...",
      "cafe": "Bunjang",
      "source": "Bunjang"
    }
  ]
}
```

## Disclaimer

This project is for **educational and personal use only**.

- This is a personal project created for learning web crawling techniques
- Not intended for commercial use
- Please respect each platform's Terms of Service and robots.txt
- The developers are not responsible for any misuse of this software
- Use at your own risk

## License

MIT License
