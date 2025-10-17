# 🔍 통합 중고거래 검색 플랫폼

네이버 카페, 중고나라, 번개장터의 중고거래 게시글을 한 번에 검색할 수 있는 통합 검색 플랫폼입니다.

## 🚀 주요 기능

- **통합 검색**: 여러 중고거래 사이트를 동시에 검색
- **실시간 크롤링**: 최신 게시글 정보를 실시간으로 수집
- **스마트 필터링**: 사이트별, 가격별 필터링 기능
- **반응형 디자인**: 모바일과 데스크톱 모든 환경에서 최적화
- **모던 UI**: 직관적이고 아름다운 사용자 인터페이스

## 🛠️ 기술 스택

### Frontend
- React 18 (TypeScript)
- CSS3 (모던 그라디언트 디자인)
- Axios (HTTP 클라이언트)

### Backend
- Node.js + Express.js
- Puppeteer (웹 크롤링)
- Cheerio (HTML 파싱)
- CORS (크로스 오리진 요청 처리)

## 📦 설치 및 실행

### 1. 저장소 클론
\`\`\`bash
git clone <repository-url>
cd secondhand
\`\`\`

### 2. 의존성 설치
\`\`\`bash
# 루트 디렉토리에서 백엔드 의존성 설치
npm install

# 클라이언트 의존성 설치
cd client
npm install
cd ..
\`\`\`

### 3. 개발 서버 실행
\`\`\`bash
# 백엔드와 프론트엔드를 동시에 실행
npm run dev
\`\`\`

또는 개별 실행:
\`\`\`bash
# 백엔드만 실행 (포트 5000)
npm run server

# 프론트엔드만 실행 (포트 3000)
npm run client
\`\`\`

### 4. 프로덕션 빌드
\`\`\`bash
npm run build
npm start
\`\`\`

## 🚀 Vercel 배포

### Vercel CLI를 사용한 배포

1. Vercel CLI 설치
\`\`\`bash
npm install -g vercel
\`\`\`

2. Vercel 로그인
\`\`\`bash
vercel login
\`\`\`

3. 프로젝트 배포
\`\`\`bash
vercel
\`\`\`

4. 프로덕션 배포
\`\`\`bash
vercel --prod
\`\`\`

### Vercel 웹사이트를 통한 배포

1. [Vercel 웹사이트](https://vercel.com)에 접속
2. GitHub 계정으로 로그인
3. "New Project" 클릭
4. 저장소 선택
5. 프로젝트 설정:
   - **Framework Preset**: Other
   - **Root Directory**: ./
   - **Build Command**: `npm run vercel-build`
   - **Output Directory**: client/build
6. "Deploy" 클릭

### 환경 변수 설정 (Vercel 대시보드)

Vercel 프로젝트 설정에서 다음 환경 변수를 추가하세요:
- `NODE_ENV`: production
- `VERCEL`: 1

### 주의사항

- Puppeteer는 Vercel의 서버리스 환경에서 작동하지 않으므로, 코드에서 조건부로 비활성화됩니다.
- 현재 구현은 axios 기반 API 호출을 사용하므로 Puppeteer 없이도 정상 작동합니다.
- 서버리스 함수는 10초의 실행 시간 제한이 있습니다.

## 🌐 지원 사이트

### 1. 네이버 카페
- URL: https://section.cafe.naver.com/ca-fe/home/search/c-articles
- 특징: 다양한 카페의 중고거래 게시글 통합 검색

### 2. 중고나라
- URL: https://web.joongna.com/search/
- 특징: 국내 대표 중고거래 커뮤니티

### 3. 번개장터
- URL: https://m.bunjang.co.kr/search/products
- 특징: 모바일 최적화된 중고거래 플랫폼

## 📱 사용법

1. **검색어 입력**: 찾고 싶은 상품명을 입력합니다
2. **사이트 선택**: 검색할 사이트를 선택합니다 (다중 선택 가능)
3. **정렬 옵션**: 관련도순, 낮은 가격순, 높은 가격순 중 선택
4. **검색 실행**: 검색 버튼을 클릭하여 결과를 확인합니다

## 🎨 UI/UX 특징

- **그라디언트 배경**: 모던하고 세련된 보라-파랑 그라디언트
- **글래스모피즘**: 반투명 배경과 블러 효과로 깊이감 표현
- **호버 효과**: 카드와 버튼에 부드러운 애니메이션 효과
- **반응형 그리드**: 화면 크기에 따라 자동 조정되는 레이아웃
- **사이트별 배지**: 각 검색 결과의 출처를 색상으로 구분

## ⚙️ API 엔드포인트

### GET /api/search
검색 API 엔드포인트

**파라미터:**
- `q` (required): 검색어
- `sources` (optional): 검색할 사이트 (naver,joongna,bunjang)

**응답 예시:**
\`\`\`json
{
  "query": "아이폰",
  "total": 25,
  "results": [
    {
      "title": "아이폰 14 프로 판매합니다",
      "link": "https://...",
      "price": "900,000원",
      "image": "https://...",
      "cafe": "번개장터",
      "source": "번개장터"
    }
  ]
}
\`\`\`

## 🔧 환경 설정

### 환경 변수 (.env)
\`\`\`
PORT=5000
NODE_ENV=production
\`\`\`

## 📝 주의사항

1. **크롤링 정책**: 각 사이트의 robots.txt와 이용약관을 준수합니다
2. **요청 제한**: 과도한 요청을 방지하기 위한 적절한 딜레이 적용
3. **에러 처리**: 네트워크 오류나 사이트 변경에 대한 안정적인 처리

## 🤝 기여하기

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 있습니다.

## 📞 문의

프로젝트에 대한 문의사항이 있으시면 이슈를 생성해주세요.



