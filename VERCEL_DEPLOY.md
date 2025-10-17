# 🚀 Vercel 배포 가이드

이 프로젝트를 Vercel에 배포하는 방법을 단계별로 안내합니다.

## 📋 사전 준비

1. [Vercel 계정](https://vercel.com) 생성
2. Git 저장소에 프로젝트 업로드 (GitHub, GitLab, Bitbucket)
3. 로컬에서 프로젝트가 정상 작동하는지 확인

## 🌐 방법 1: Vercel 웹사이트를 통한 배포 (추천)

### 단계별 가이드

1. **Vercel 웹사이트 접속**
   - https://vercel.com 방문
   - GitHub/GitLab/Bitbucket 계정으로 로그인

2. **새 프로젝트 생성**
   - "New Project" 또는 "Add New..." > "Project" 클릭
   - 저장소 연동 및 선택

3. **프로젝트 설정**
   ```
   Framework Preset: Other
   Root Directory: ./
   Build Command: npm run vercel-build
   Output Directory: client/build
   Install Command: npm install
   ```

4. **환경 변수 설정**
   - "Environment Variables" 섹션에서 추가:
     ```
     NODE_ENV = production
     VERCEL = 1
     ```

5. **배포 실행**
   - "Deploy" 버튼 클릭
   - 약 2-3분 후 배포 완료

6. **도메인 확인**
   - 배포 완료 후 자동으로 제공되는 URL 확인
   - 예: `your-project.vercel.app`

## 💻 방법 2: Vercel CLI를 통한 배포

### CLI 설치

```bash
# npm을 사용하는 경우
npm install -g vercel

# yarn을 사용하는 경우
yarn global add vercel
```

### 로그인

```bash
vercel login
```

이메일 또는 GitHub 계정으로 로그인합니다.

### 배포

```bash
# 프로젝트 루트 디렉토리에서 실행
cd /path/to/your/project

# 테스트 배포 (미리보기)
vercel

# 프로덕션 배포
vercel --prod
```

### CLI 배포 과정

1. 프로젝트 설정을 물어보면 다음과 같이 답변:
   ```
   ? Set up and deploy "~/your-project"? [Y/n] y
   ? Which scope do you want to deploy to? [선택]
   ? Link to existing project? [N/y] n
   ? What's your project's name? [프로젝트명 입력]
   ? In which directory is your code located? ./
   ```

2. 배포 진행 상황 확인
3. 배포 완료 후 URL 제공

## 🔧 설정 파일 설명

### vercel.json

```json
{
  "version": 2,
  "builds": [
    {
      "src": "server.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "/server.js"
    },
    {
      "src": "/static/(.*)",
      "dest": "/client/build/static/$1"
    },
    {
      "src": "/manifest.json",
      "dest": "/client/build/manifest.json"
    },
    {
      "src": "/robots.txt",
      "dest": "/client/build/robots.txt"
    },
    {
      "src": "/(.*)",
      "dest": "/client/build/index.html"
    }
  ],
  "env": {
    "NODE_ENV": "production"
  }
}
```

### .vercelignore

```
node_modules
client/node_modules
.env
.env.local
.git
*.log
.DS_Store
client/src
client/public
*.md
```

## ⚠️ 주의사항

### 1. Puppeteer 제한

Vercel의 서버리스 환경에서는 Puppeteer가 작동하지 않습니다. 다행히 이 프로젝트는 Puppeteer 없이도 정상 작동하도록 구현되어 있습니다.

### 2. 서버리스 함수 제한

- **실행 시간**: 최대 10초 (Hobby 플랜)
- **메모리**: 1024MB
- **요청 크기**: 최대 4.5MB

### 3. 빌드 시간

- 클라이언트 빌드는 약 1-2분 소요
- 전체 배포는 약 2-3분 소요

### 4. 환경 변수

민감한 정보(API 키 등)는 Vercel 대시보드의 환경 변수 설정에서 관리하세요.

## 🔄 자동 배포 설정

### GitHub 연동 후 자동 배포

1. Vercel에서 GitHub 저장소 연동
2. 이후 GitHub에 push할 때마다 자동으로 배포됨
3. Pull Request 생성 시 미리보기 배포 자동 생성

### 브랜치별 배포 설정

- `main` 또는 `master` 브랜치: 프로덕션 배포
- 다른 브랜치: 미리보기 배포

## 📊 배포 확인

### 배포 상태 확인

```bash
vercel ls
```

### 로그 확인

```bash
vercel logs [deployment-url]
```

### 도메인 확인

- 기본 도메인: `your-project.vercel.app`
- 커스텀 도메인 추가 가능

## 🌐 커스텀 도메인 설정

1. Vercel 대시보드에서 프로젝트 선택
2. "Settings" > "Domains" 이동
3. 도메인 추가 및 DNS 설정
4. Vercel에서 제공하는 DNS 레코드 추가

## 🐛 문제 해결

### 배포 실패 시

1. **빌드 로그 확인**
   - Vercel 대시보드에서 배포 로그 확인
   - 오류 메시지 검토

2. **로컬에서 테스트**
   ```bash
   npm run build
   npm start
   ```

3. **환경 변수 확인**
   - 필요한 모든 환경 변수가 설정되었는지 확인

4. **의존성 확인**
   - `package.json`의 dependencies 확인
   - 불필요한 devDependencies 제거

### 일반적인 문제

1. **빌드 명령어 오류**
   - Build Command를 `npm run vercel-build`로 설정

2. **정적 파일 404 오류**
   - Output Directory가 `client/build`로 설정되었는지 확인

3. **API 라우트 오류**
   - `vercel.json`의 routes 설정 확인

## 📞 도움받기

- [Vercel 공식 문서](https://vercel.com/docs)
- [Vercel 커뮤니티](https://github.com/vercel/vercel/discussions)
- [Vercel 서포트](https://vercel.com/support)

## ✅ 배포 완료 체크리스트

- [ ] Vercel 계정 생성
- [ ] Git 저장소 연동
- [ ] 프로젝트 설정 완료
- [ ] 환경 변수 설정
- [ ] 배포 성공
- [ ] 도메인 작동 확인
- [ ] API 엔드포인트 테스트
- [ ] 검색 기능 테스트
- [ ] 필터 기능 테스트

## 🎉 축하합니다!

프로젝트가 성공적으로 배포되었습니다! 이제 전 세계 어디서나 접근 가능한 통합 중고거래 검색 플랫폼을 사용할 수 있습니다.

