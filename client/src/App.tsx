import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

interface SearchResult {
  title: string;
  link: string;
  price: string;
  image: string | null;
  cafe: string;
  source: string;
  region?: string;
  delivery?: string;
  date?: string;
  timestamp?: number;     // 통합 정렬용 타임스탬프 (밀리초)
  imageCount?: number;
  isSafePayment?: boolean;
  saleStatus?: string;
  productCondition?: string;
  isBunjangCare?: boolean; // 번개케어 서비스
  freeShipping?: boolean;  // 무료배송
  inspection?: boolean;    // 검수 가능
  isAd?: boolean;         // 광고 여부
  timeAgo?: string;       // 상대 시간 (예: "2시간 전")
  shippingInfo?: string;  // 무료배송 정보 (무료인 경우만)
  // 중고나라 관련 필드들
  wishCount?: number;     // 찜 수
  chatCount?: number;     // 채팅 수
  parcelFee?: number;     // 0: 배송비 별도, 1: 배송비 포함
  state?: number;         // 0: 판매중, 1: 예약중, 2: 판매완료
  platform?: string;     // 플랫폼 구분 (중고나라, 번개장터 등)
  type?: string;         // 게시글 타입 (NFLEA_TRADE_ARTICLE: N플리마켓)
}

interface SearchResponse {
  query: string;
  filters: any;
  total: number;
  results: SearchResult[];
  categories: Category[];
  pagination?: {
    currentPage: number;
    hasResults: boolean;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

interface Category {
  id: number;
  name: string;
  parent: number | null;
}

interface NaverCategory {
  categoryId: string;
  parentCategoryId: string;
  categoryName: string;
  categoryLevel: number;
  lastLevel: boolean;
  exposureOrder: number;
  fullPathLabel: string;
  deleted: boolean;
}

interface JoongnaCategory {
  id: number;
  name: string;
  subcategories: { [key: number]: JoongnaCategoryItem };
}

interface JoongnaCategoryItem {
  name: string;
  subcategories: { [key: number]: string };
}

interface BunjangCategory {
  id: string;
  title: string;
  icon_url?: string;
  count: number;
  order: number;
  subcategories: BunjangSubCategory[];
}

interface BunjangSubCategory {
  id: string;
  title: string;
  icon_url?: string;
  count: number;
  order: number;
  subcategories: BunjangThirdCategory[];
}

interface BunjangThirdCategory {
  id: string;
  title: string;
  icon_url?: string;
  count: number;
  order: number;
  require_size?: boolean;
  require_brand?: boolean;
  disable_price?: boolean;
  disable_quantity?: boolean;
  disable_inspection?: boolean;
}

function App() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSources, setSelectedSources] = useState(['naver', 'joongna', 'bunjang']);

  // 모바일 디바이스 감지 함수
  const isMobileDevice = () => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
           window.innerWidth <= 768;
  };

  // 앱 스킴을 통한 링크 처리 함수
  const handleAppLink = (result: SearchResult, event: React.MouseEvent) => {
    event.preventDefault();
    
    if (result.source === '번개장터' && isMobileDevice()) {
      // 모바일에서만 번개장터 앱 스킴 시도
      const productIdMatch = result.link.match(/\/products\/(\d+)/);
      if (productIdMatch) {
        const productId = productIdMatch[1];
        const bunjangScheme = `bunjang://product/${productId}`;
        
        // 앱이 설치되어 있는지 확인하기 위해 앱 스킴으로 시도
        const appLink = document.createElement('a');
        appLink.href = bunjangScheme;
        appLink.style.display = 'none';
        document.body.appendChild(appLink);
        appLink.click();
        document.body.removeChild(appLink);
        
        // 앱이 없을 경우를 대비해 일정 시간 후 웹 링크로 이동
        setTimeout(() => {
          window.open(result.link, '_blank', 'noopener,noreferrer');
        }, 1000);
      } else {
        // 상품 ID를 찾을 수 없으면 웹 링크로 이동
        window.open(result.link, '_blank', 'noopener,noreferrer');
      }
    } else {
      // 데스크톱 또는 다른 플랫폼은 기존 방식대로 처리
      window.open(result.link, '_blank', 'noopener,noreferrer');
    }
  };
  
  // 다크모드 상태
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved === 'true';
  });
  
  // 스크롤 투 탑 버튼 표시 상태
  const [showScrollTop, setShowScrollTop] = useState(false);
  
  // 다크모드 적용
  useEffect(() => {
    if (isDarkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
    localStorage.setItem('darkMode', isDarkMode.toString());
  }, [isDarkMode]);
  
  // 스크롤 이벤트 리스너
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 300) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  
  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };
  
  // 기존 공통 카테고리 상태 제거됨 - 플랫폼별 전용 카테고리만 사용
  
  // 네이버 카페 카테고리 상태
  const [naverCategories, setNaverCategories] = useState<NaverCategory[]>([]);
  const [naverCategoriesLoading, setNaverCategoriesLoading] = useState(false);
  const [showNaverCategorySelector, setShowNaverCategorySelector] = useState(false);
  const [selectedMainCategory, setSelectedMainCategory] = useState<string | null>(null);
  const [selectedSubCategory, setSelectedSubCategory] = useState<string | null>(null);
  const [subcategories, setSubcategories] = useState<NaverCategory[]>([]);
  const [subcategoriesLoading, setSubcategoriesLoading] = useState(false);
  const [thirdLevelCategories, setThirdLevelCategories] = useState<NaverCategory[]>([]);
  const [thirdLevelLoading, setThirdLevelLoading] = useState(false);
  
  // 중고나라 카테고리 상태
  const [joongnaCategories, setJoongnaCategories] = useState<{ [key: number]: JoongnaCategory }>({});
  const [joongnaCategoriesLoading, setJoongnaCategoriesLoading] = useState(false);
  const [showJoongnaCategorySelector, setShowJoongnaCategorySelector] = useState(false);
  const [selectedJoongnaMainCategory, setSelectedJoongnaMainCategory] = useState<number | null>(null);
  const [selectedJoongnaSubCategory, setSelectedJoongnaSubCategory] = useState<number | null>(null);
  
  // 번개장터 카테고리 상태
  const [bunjangCategories, setBunjangCategories] = useState<BunjangCategory[]>([]);
  const [bunjangCategoriesLoading, setBunjangCategoriesLoading] = useState(false);
  const [showBunjangCategorySelector, setShowBunjangCategorySelector] = useState(false);
  const [selectedBunjangMainCategory, setSelectedBunjangMainCategory] = useState<string | null>(null);
  const [selectedBunjangSubCategory, setSelectedBunjangSubCategory] = useState<string | null>(null);
  
  // 골마켓 카테고리 상태
  const [golmarketCategories, setGolmarketCategories] = useState<{id: number, name: string}[]>([]);
  const [golmarketCategoriesLoading, setGolmarketCategoriesLoading] = useState(false);
  const [showGolmarketCategorySelector, setShowGolmarketCategorySelector] = useState(false);
  
  // 페이지네이션 상태
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<SearchResponse['pagination']>(undefined);
  
  // 모바일 감지 및 아코디언 상태
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [expandedMobileCategories, setExpandedMobileCategories] = useState<{[key: string]: boolean}>({});
  
  // 화면 크기 변경 감지
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 기존 공통 카테고리 로딩 코드 제거됨 - 플랫폼별 전용 카테고리만 사용

  // 네이버 카페 카테고리 로딩 함수 (서버에서 미리 로딩된 데이터 사용)
  const loadNaverCategories = async () => {
    if (naverCategories.length > 0) return; // 이미 로딩됨
    
    setNaverCategoriesLoading(true);
    try {
      console.log('📡 네이버 카페 카테고리 로딩 중... (서버 미리 로딩된 데이터 사용)');
      const response = await axios.get('/api/naver-categories');
      if (response.data.success) {
        console.log(`✅ 네이버 카페 카테고리 ${response.data.totalCount}개 로드됨`);
        console.log('카테고리 레벨별 분포:', {
          level1: response.data.categories.filter((c: NaverCategory) => c.categoryLevel === 1).length,
          level2: response.data.categories.filter((c: NaverCategory) => c.categoryLevel === 2).length,
          level3: response.data.categories.filter((c: NaverCategory) => c.categoryLevel === 3).length
        });
        setNaverCategories(response.data.categories);
      } else {
        console.error('❌ 네이버 카테고리 로딩 실패:', response.data.error);
      }
    } catch (error) {
      console.error('❌ 네이버 카테고리 로드 오류:', error);
    } finally {
      setNaverCategoriesLoading(false);
    }
  };

  // 소분류 로딩 함수 (Level 2)
  const loadSubcategories = async (parentCategoryId: string) => {
    console.log(`🔍 소분류 로딩 시작: ${parentCategoryId}`);
    console.log(`전체 네이버 카테고리 수: ${naverCategories.length}`);
    
    setSubcategoriesLoading(true);
    // 3단계 카테고리 초기화
    setSelectedSubCategory(null);
    setThirdLevelCategories([]);
    
    try {
      // 이미 로딩된 전체 카테고리에서 해당 부모의 하위 카테고리를 찾음
      const childCategories = naverCategories.filter(cat => {
        const isChild = cat.parentCategoryId === parentCategoryId && cat.categoryLevel === 2;
        if (isChild) {
          console.log(`찾은 소분류: ${cat.categoryName} (${cat.categoryId})`);
        }
        return isChild;
      });
      
      console.log(`로컬에서 찾은 소분류 수: ${childCategories.length}`);
      
      if (childCategories.length > 0) {
        // 로컬 데이터에서 찾은 경우
        setSubcategories(childCategories);
        console.log(`✅ 소분류 ${childCategories.length}개 로드됨 (로컬 데이터)`);
      } else {
        // API에서 직접 가져오기
        console.log(`🌐 API에서 소분류 가져오는 중: ${parentCategoryId}`);
        const response = await axios.get(`/api/naver-categories/${parentCategoryId}/children`);
        if (response.data.success) {
          setSubcategories(response.data.children);
          console.log(`✅ 소분류 ${response.data.children.length}개 로드됨 (API)`);
        } else {
          console.error('❌ 소분류 로딩 실패:', response.data.error);
          setSubcategories([]);
        }
      }
    } catch (error) {
      console.error('❌ 소분류 로드 오류:', error);
      setSubcategories([]);
    } finally {
      setSubcategoriesLoading(false);
    }
  };

  // 3단계 카테고리 로딩 함수 (Level 3)
  const loadThirdLevelCategories = async (parentCategoryId: string) => {
    console.log(`🔍 3단계 카테고리 로딩 시작: ${parentCategoryId}`);
    
    setThirdLevelLoading(true);
    try {
      // 이미 로딩된 전체 카테고리에서 해당 부모의 하위 카테고리를 찾음
      const thirdLevelCats = naverCategories.filter(cat => {
        const isThirdLevel = cat.parentCategoryId === parentCategoryId && cat.categoryLevel === 3;
        if (isThirdLevel) {
          console.log(`찾은 3단계 카테고리: ${cat.categoryName} (${cat.categoryId})`);
        }
        return isThirdLevel;
      });
      
      console.log(`로컬에서 찾은 3단계 카테고리 수: ${thirdLevelCats.length}`);
      
      if (thirdLevelCats.length > 0) {
        // 로컬 데이터에서 찾은 경우
        setThirdLevelCategories(thirdLevelCats);
        console.log(`✅ 3단계 카테고리 ${thirdLevelCats.length}개 로드됨 (로컬 데이터)`);
      } else {
        // API에서 직접 가져오기
        console.log(`🌐 API에서 3단계 카테고리 가져오는 중: ${parentCategoryId}`);
        const response = await axios.get(`/api/naver-categories/${parentCategoryId}/children`);
        if (response.data.success) {
          setThirdLevelCategories(response.data.children);
          console.log(`✅ 3단계 카테고리 ${response.data.children.length}개 로드됨 (API)`);
        } else {
          console.error('❌ 3단계 카테고리 로딩 실패:', response.data.error);
          setThirdLevelCategories([]);
        }
      }
    } catch (error) {
      console.error('❌ 3단계 카테고리 로드 오류:', error);
      setThirdLevelCategories([]);
    } finally {
      setThirdLevelLoading(false);
    }
  };

  // 중고나라 카테고리 로딩 함수
  const loadJoongnaCategories = async () => {
    if (Object.keys(joongnaCategories).length > 0) return; // 이미 로딩됨
    
    setJoongnaCategoriesLoading(true);
    try {
      console.log('📡 중고나라 카테고리 로딩 중...');
      const response = await axios.get('/api/joongna-categories');
      if (response.data.success) {
        console.log(`✅ 중고나라 카테고리 ${response.data.totalCount}개 로드됨`);
        setJoongnaCategories(response.data.data);
      } else {
        console.error('❌ 중고나라 카테고리 로딩 실패:', response.data.error);
      }
    } catch (error) {
      console.error('❌ 중고나라 카테고리 로드 오류:', error);
    } finally {
      setJoongnaCategoriesLoading(false);
    }
  };

  // 번개장터 카테고리 로딩 함수
  const loadBunjangCategories = async () => {
    if (bunjangCategories.length > 0) return; // 이미 로딩됨
    
    setBunjangCategoriesLoading(true);
    try {
      console.log('📡 번개장터 카테고리 로딩 중...');
      const response = await axios.get('/api/bunjang-categories');
      if (response.data.success) {
        console.log(`✅ 번개장터 카테고리 ${response.data.totalCount}개 로드됨`);
        setBunjangCategories(response.data.categories);
      } else {
        console.error('❌ 번개장터 카테고리 로딩 실패:', response.data.error);
      }
    } catch (error) {
      console.error('❌ 번개장터 카테고리 로드 오류:', error);
    } finally {
      setBunjangCategoriesLoading(false);
    }
  };

  // 골마켓 카테고리 로딩 함수
  const loadGolmarketCategories = async () => {
    if (golmarketCategories.length > 0) return; // 이미 로딩됨
    
    setGolmarketCategoriesLoading(true);
    try {
      console.log('📡 골마켓 카테고리 로딩 중...');
      const response = await axios.get('/api/golmarket-categories');
      if (response.data.success) {
        console.log(`✅ 골마켓 카테고리 ${response.data.totalCount}개 로드됨`);
        setGolmarketCategories(response.data.categories);
      } else {
        console.error('❌ 골마켓 카테고리 로딩 실패:', response.data.error);
      }
    } catch (error) {
      console.error('❌ 골마켓 카테고리 로드 오류:', error);
    } finally {
      setGolmarketCategoriesLoading(false);
    }
  };
  
  // 필터 탭 상태
  const [activeFilterTab, setActiveFilterTab] = useState('common');

  // 사이트별 필터 상태
  const [filters, setFilters] = useState({
    // 공통 필터 (카테고리 제거됨)
    common: {
      minPrice: '',
      maxPrice: '',
      sort: 'RECOMMEND',
      // 공통 판매상태 필터들 (모든 플랫폼 공통)
      onSale: true, // 기본으로 판매중 체크
      includeSoldOut: false // 판매완료 포함 여부
    },
    // 네이버 카페 필터
    naver: {
      categoryId: '', // 네이버 카페 카테고리 ID
      directPay: false,
      escrowPay: false,
      meetTrade: false,
      deliveryTrade: false,
      onlineTrade: false,
      newItem: false,
      almostNew: false,
      usedItem: false,
      registrationPeriod: 'ALL'
    },
    // 중고나라 필터
    joongna: {
      categoryId: '', // 중고나라 카테고리 ID
      parcelFeeYn: false,
      certifiedSellerYn: false
    },
    // 번개장터 필터
    bunjang: {
      categoryId: '', // 번개장터 카테고리 ID
      freeShipping: false,
      inspection: false
    },
    // 골마켓 필터
    golmarket: {
      categoryId: '' // 골마켓 카테고리 ID
    }
  });

  const handleSearch = async (e: React.FormEvent, pageNum: number = 1) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    // 골마켓 선택 시 카테고리 필수 체크
    if (selectedSources.includes('golmarket') && !filters.golmarket.categoryId) {
      setActiveFilterTab('golmarket');
      // 약간의 딜레이 후 카테고리 선택기로 스크롤
      setTimeout(() => {
        const categorySelector = document.querySelector('.golmarket-category-container');
        if (categorySelector) {
          categorySelector.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
      alert('⛳ 골마켓은 카테고리 선택이 필수입니다.\n골마켓 필터에서 카테고리를 선택해주세요.');
      return;
    }

    // 디버깅: 모든 필터 상태 확인
    console.log('🔍 클라이언트: 검색 시작');
    console.log('  - 검색어:', query);
    console.log('  - 선택된 소스들:', selectedSources);
    console.log('  - 전체 필터 상태:', filters);
    console.log('  - 중고나라 필터 상태:', filters.joongna);
    console.log('  - 번개장터 필터 상태:', filters.bunjang);
    
    if (filters.joongna.categoryId) {
      console.log('✅ 중고나라 카테고리 필터 적용됨');
      console.log('  - 카테고리 ID:', filters.joongna.categoryId);
    } else {
      console.log('❌ 중고나라 카테고리 필터 없음');
    }
    
    if (filters.bunjang.freeShipping || filters.bunjang.inspection) {
      console.log('✅ 번개장터 필터 적용됨');
      console.log('  - 무료배송:', filters.bunjang.freeShipping);
      console.log('  - 검수가능:', filters.bunjang.inspection);
    } else {
      console.log('❌ 번개장터 필터 없음');
    }

    setLoading(true);
    try {
      const response = await axios.get<SearchResponse>('/api/search', {
        params: {
          q: query,
          sources: selectedSources.join(','),
          page: pageNum,
          // 공통 필터 (카테고리 제거됨)
          ...(filters.common.minPrice && { minPrice: filters.common.minPrice }),
          ...(filters.common.maxPrice && { maxPrice: filters.common.maxPrice }),
          ...(filters.common.sort !== 'RECOMMEND' && { sort: filters.common.sort }),
          // 공통 판매상태 필터들 (모든 플랫폼 공통)
          ...(filters.common.onSale && { onSale: filters.common.onSale }),
          ...(filters.common.includeSoldOut && { includeSoldOut: filters.common.includeSoldOut }),
          // 네이버 카페 전용 필터
          ...(filters.naver.categoryId && { categoryId: filters.naver.categoryId }),
          ...(filters.naver.directPay && { directPay: filters.naver.directPay }),
          ...(filters.naver.escrowPay && { escrowPay: filters.naver.escrowPay }),
          ...(filters.naver.meetTrade && { meetTrade: filters.naver.meetTrade }),
          ...(filters.naver.deliveryTrade && { deliveryTrade: filters.naver.deliveryTrade }),
          ...(filters.naver.onlineTrade && { onlineTrade: filters.naver.onlineTrade }),
          ...(filters.naver.newItem && { newItem: filters.naver.newItem }),
          ...(filters.naver.almostNew && { almostNew: filters.naver.almostNew }),
          ...(filters.naver.usedItem && { usedItem: filters.naver.usedItem }),
          ...(filters.naver.registrationPeriod !== 'ALL' && { registrationPeriod: filters.naver.registrationPeriod }),
          // 중고나라 필터
          ...(filters.joongna.categoryId && { joongnaCategoryId: filters.joongna.categoryId }),
          ...(filters.joongna.parcelFeeYn && { parcelFeeYn: filters.joongna.parcelFeeYn }),
          ...(filters.joongna.certifiedSellerYn && { certifiedSellerYn: filters.joongna.certifiedSellerYn }),
          // 번개장터 필터
          ...(filters.bunjang.categoryId && { bunjangCategoryId: filters.bunjang.categoryId }),
          ...(filters.bunjang.freeShipping && { freeShipping: filters.bunjang.freeShipping }),
          ...(filters.bunjang.inspection && { inspection: filters.bunjang.inspection }),
          // 골마켓 필터
          ...(filters.golmarket.categoryId && { golmarketCategoryId: filters.golmarket.categoryId })
        }
      });
      setResults(response.data.results);
      setPagination(response.data.pagination || undefined);
      setCurrentPage(pageNum);
    } catch (error) {
      console.error('검색 오류:', error);
      alert('검색 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 정렬 변경 시 자동 재검색
  const [initialLoad, setInitialLoad] = useState(true);
  
  useEffect(() => {
    // 최초 로드 시에는 실행하지 않음
    if (initialLoad) {
      setInitialLoad(false);
      return;
    }
    
    // 검색어가 있고 결과가 있을 때만 자동 재검색
    if (query.trim() && results.length > 0) {
      handleSearch(null as any, 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.common.sort]);

  const handleSourceToggle = (source: string) => {
    setSelectedSources(prev => 
      prev.includes(source) 
        ? prev.filter(s => s !== source)
        : [...prev, source]
    );
    // 소스가 변경되면 첫 페이지로 리셋
    setCurrentPage(1);
    setPagination(undefined);
  };

  // 페이지네이션 핸들러
  const handlePrevPage = () => {
    if (pagination?.hasPrevPage) {
      // 모바일과 데스크톱 모두에서 작동하도록 여러 방법 시도
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      handleSearch(null as any, currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (pagination?.hasNextPage) {
      // 모바일과 데스크톱 모두에서 작동하도록 여러 방법 시도
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      handleSearch(null as any, currentPage + 1);
    }
  };

  // 기존 공통 카테고리 관련 함수들 제거됨 - 플랫폼별 전용 카테고리만 사용

  // 통일된 시간 표시 함수
  const formatTimeAgo = (timestamp: number | undefined): string => {
    if (!timestamp) return '';
    
    const now = new Date().getTime();
    const diffMs = now - timestamp;
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMinutes < 1) {
      return '방금 전';
    } else if (diffMinutes < 60) {
      return `${diffMinutes}분 전`;
    } else if (diffHours < 24) {
      return `${diffHours}시간 전`;
    } else if (diffDays < 7) {
      return `${diffDays}일 전`;
    } else {
      // 7일 이상은 날짜로 표시
      return new Date(timestamp).toLocaleDateString('ko-KR');
    }
  };

  // 통합 정렬 로직 구현
  const sortedResults = (() => {
    if (!results || results.length === 0) return [];
    
    const sortValue = filters.common.sort;
    
    // 정렬 로직
    const sorted = [...results].sort((a, b) => {
      switch (sortValue) {
        case 'RECENT': // 최신순
          // timestamp가 있으면 사용, 없으면 0으로 처리 (맨 뒤로)
          const aTime = a.timestamp || 0;
          const bTime = b.timestamp || 0;
          return bTime - aTime; // 내림차순 (최신이 먼저)
          
        case 'PRICE_ASC': // 가격 낮은순
          const aPrice = parseInt(a.price.replace(/[^0-9]/g, '')) || 0;
          const bPrice = parseInt(b.price.replace(/[^0-9]/g, '')) || 0;
          return aPrice - bPrice;
          
        case 'PRICE_DESC': // 가격 높은순
          const aPriceDesc = parseInt(a.price.replace(/[^0-9]/g, '')) || 0;
          const bPriceDesc = parseInt(b.price.replace(/[^0-9]/g, '')) || 0;
          return bPriceDesc - aPriceDesc;
          
        case 'RECOMMEND': // 추천순 (기본값)
        default:
          // 라운드로빈 방식: 번개장터 → 중고나라 → 네이버 카페 → 골마켓 순으로 번갈아가며 배치
          const platformOrder = ['번개장터', '중고나라', '네이버 카페', '골마켓'];
          
          // 각 플랫폼별로 결과를 분류
          const resultsByPlatform: { [key: string]: SearchResult[] } = {};
          platformOrder.forEach(platform => {
            resultsByPlatform[platform] = results.filter(r => r.source === platform);
          });
          
          // 각 아이템의 라운드로빈 순서 계산
          const getRoundRobinOrder = (item: SearchResult) => {
            const platform = item.source;
            const platformIndex = platformOrder.indexOf(platform);
            const positionInPlatform = resultsByPlatform[platform]?.findIndex(r => r === item) || 0;
            
            // 라운드로빈 순서: (플랫폼 내 순서 * 플랫폼 수) + 플랫폼 인덱스
            return positionInPlatform * platformOrder.length + platformIndex;
          };
          
          const aOrder = getRoundRobinOrder(a);
          const bOrder = getRoundRobinOrder(b);
          
          return aOrder - bOrder; // 오름차순 (작은 순서가 먼저)
      }
    });
    
    return sorted;
  })();

  return (
    <div className="App">
      {/* 다크모드 토글 버튼 - 항상 고정 */}
      <button 
        className="theme-toggle" 
        onClick={toggleDarkMode}
        aria-label="다크모드 토글"
        title={isDarkMode ? '라이트 모드로 전환' : '다크 모드로 전환'}
      >
        {isDarkMode ? '☀️' : '🌙'}
      </button>

      <header className="app-header">
        <h1>🔍 통합 중고거래 검색</h1>
        <p>클릭 한 번으로 <br></br> 찾고 싶은 중고, 한 곳에서</p>
      </header>

      <main className="main-content">
        <form onSubmit={handleSearch} className="search-form">
          <div className="search-input-container">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="찾고 싶은 상품을 입력하세요..."
              className="search-input"
            />
            <button type="submit" disabled={loading} className="search-button">
              {loading ? '검색 중...' : '검색'}
            </button>
          </div>

          <div className="filters">
            <div className="source-filters">
              <h3>검색 사이트</h3>
              <label>
                <input
                  type="checkbox"
                  checked={selectedSources.includes('naver')}
                  onChange={() => handleSourceToggle('naver')}
                />
                네이버 카페
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={selectedSources.includes('joongna')}
                  onChange={() => handleSourceToggle('joongna')}
                />
                중고나라
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={selectedSources.includes('bunjang')}
                  onChange={() => handleSourceToggle('bunjang')}
                />
                번개장터
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={selectedSources.includes('golmarket')}
                  onChange={() => handleSourceToggle('golmarket')}
                />
                골마켓 ⛳ <span className="required-text">(카테고리 필수)</span>
              </label>
            </div>

            {/* 필터 탭 */}
            <div className="filter-tabs">
              <h3>필터 옵션</h3>
              <div className="tab-buttons">
                <button 
                  type="button"
                  className={`tab-button ${activeFilterTab === 'common' ? 'active' : ''}`}
                  onClick={() => setActiveFilterTab('common')}
                >
                  공통 필터
                </button>
                {selectedSources.includes('naver') && (
                <button 
                  type="button"
                    className={`tab-button ${activeFilterTab === 'naver' ? 'active' : ''}`}
                    onClick={() => setActiveFilterTab('naver')}
                >
                    네이버 카페
                </button>
                )}
                {selectedSources.includes('joongna') && (
                <button 
                  type="button"
                    className={`tab-button ${activeFilterTab === 'joongna' ? 'active' : ''}`}
                    onClick={() => setActiveFilterTab('joongna')}
                >
                    중고나라
                </button>
                )}
                {selectedSources.includes('bunjang') && (
                <button 
                  type="button"
                    className={`tab-button ${activeFilterTab === 'bunjang' ? 'active' : ''}`}
                    onClick={() => setActiveFilterTab('bunjang')}
                >
                    번개장터
                </button>
                )}
                {selectedSources.includes('golmarket') && (
                <button 
                  type="button"
                    className={`tab-button ${activeFilterTab === 'golmarket' ? 'active' : ''}`}
                    onClick={() => setActiveFilterTab('golmarket')}
                >
                    골마켓 ⛳
                </button>
                )}
              </div>
            </div>

            {/* 탭 기반 필터 컨텐츠 */}
            <div className="tab-content">
              {activeFilterTab === 'common' && (
                <div className="common-filters">


                  {/* 가격 */}
            <div className="price-filters">
                    <h4>가격</h4>
              <div className="price-range">
                <input
                  type="number"
                  placeholder="최소 가격"
                        value={filters.common.minPrice}
                        onChange={(e) => setFilters(prev => ({
                          ...prev, 
                          common: { ...prev.common, minPrice: e.target.value }
                        }))}
                />
                <span>~</span>
                <input
                  type="number"
                  placeholder="최대 가격"
                        value={filters.common.maxPrice}
                        onChange={(e) => setFilters(prev => ({
                          ...prev, 
                          common: { ...prev.common, maxPrice: e.target.value }
                        }))}
                />
              </div>
            </div>

                  {/* 정렬 */}
                  <div className="sort-filters">
                    <h4>정렬</h4>
                    <select 
                      value={filters.common.sort} 
                      onChange={(e) => setFilters(prev => ({
                        ...prev, 
                        common: { ...prev.common, sort: e.target.value }
                      }))}
                    >
                      <option value="RECOMMEND">추천순</option>
                      <option value="RECENT">최신순</option>
                      <option value="PRICE_ASC">낮은 가격순</option>
                      <option value="PRICE_DESC">높은 가격순</option>
                    </select>
                  </div>

                  {/* 판매상태 필터 (모든 플랫폼 공통) */}
                  <div className="option-filters">
                    <h4>판매상태</h4>
                    <label className="disabled-label">
                      <input
                        type="checkbox"
                        checked={filters.common.onSale}
                        disabled={true}
                        onChange={(e) => setFilters(prev => ({
                          ...prev, 
                          common: { ...prev.common, onSale: e.target.checked }
                        }))}
                      />
                      판매중 (필수)
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={filters.common.includeSoldOut}
                        onChange={(e) => setFilters(prev => ({
                          ...prev, 
                          common: { ...prev.common, includeSoldOut: e.target.checked }
                        }))}
                      />
                      판매완료 포함
                    </label>
                  </div>
                </div>
              )}

              {activeFilterTab === 'naver' && (
                <div className="naver-filters">
                  <h4>네이버 카페 전용 필터</h4>
                  
                  {/* 네이버 카페 카테고리 선택 */}
                  <div className="filter-group category-filter-group">
                    
                    <div className="naver-category-container">
                      <button 
                        type="button"
                        className={`category-selector-btn ${showNaverCategorySelector ? 'active' : ''}`}
                        onClick={() => {
                          setShowNaverCategorySelector(!showNaverCategorySelector);
                          if (!showNaverCategorySelector) {
                            loadNaverCategories();
                          }
                        }}
                      >
                        {filters.naver.categoryId ? 
                          naverCategories.find(cat => cat.categoryId === filters.naver.categoryId)?.categoryName || '카테고리 선택' 
                          : '카테고리 선택'
                        }
                        <span className={`arrow ${showNaverCategorySelector ? 'expanded' : ''}`}>▼</span>
                      </button>
                      
                      {showNaverCategorySelector && (
                        <div className="naver-category-dropdown">
                          <div className="dropdown-header">
                            <button
                              type="button"
                              className="clear-category-btn"
                              onClick={() => {
                                setFilters(prev => ({
                                  ...prev,
                                  naver: { ...prev.naver, categoryId: '' }
                                }));
                                setSelectedMainCategory(null);
                                setSelectedSubCategory(null);
                                setSubcategories([]);
                                setThirdLevelCategories([]);
                              }}
                            >
                              전체 카테고리
                            </button>
                          </div>
                          
                          <div className="dropdown-content">
                            {naverCategoriesLoading ? (
                              <div className="loading-message">
                                <p>카테고리 로딩 중...</p>
                              </div>
                            ) : naverCategories.length > 0 ? (
                              isMobile ? (
                                // 모바일 아코디언 뷰
                                <div className="category-panels mobile-accordion">
                                  {naverCategories
                                    .filter(cat => cat.categoryLevel === 1)
                                    .sort((a, b) => a.exposureOrder - b.exposureOrder)
                                    .map(mainCategory => {
                                      const mainCatKey = `naver-main-${mainCategory.categoryId}`;
                                      const isMainExpanded = expandedMobileCategories[mainCatKey];
                                      const mainSubs = naverCategories.filter(cat => 
                                        cat.parentCategoryId === mainCategory.categoryId && cat.categoryLevel === 2
                                      ).sort((a, b) => a.exposureOrder - b.exposureOrder);
                                      
                                      return (
                                        <div key={mainCategory.categoryId} className="mobile-category-group">
                                          <button
                                            type="button"
                                            className={`category-option-btn ${filters.naver.categoryId === mainCategory.categoryId ? 'selected' : ''}`}
                                            onClick={() => {
                                              if (mainCategory.lastLevel || mainSubs.length === 0) {
                                                setFilters(prev => ({
                                                  ...prev,
                                                  naver: { ...prev.naver, categoryId: mainCategory.categoryId }
                                                }));
                                                setShowNaverCategorySelector(false);
                                              } else {
                                                setExpandedMobileCategories(prev => ({
                                                  ...prev,
                                                  [mainCatKey]: !prev[mainCatKey]
                                                }));
                                              }
                                            }}
                                          >
                                            <span className="category-name">{mainCategory.categoryName}</span>
                                            {!mainCategory.lastLevel && mainSubs.length > 0 && (
                                              <span className="has-children">{isMainExpanded ? '▼' : '▶'}</span>
                                            )}
                                          </button>
                                          
                                          {isMainExpanded && mainSubs.length > 0 && (
                                            <div className="mobile-subcategories expanded">
                                              {mainSubs.map(subCategory => {
                                                const subCatKey = `naver-sub-${subCategory.categoryId}`;
                                                const isSubExpanded = expandedMobileCategories[subCatKey];
                                                const thirdLevelCats = naverCategories.filter(cat =>
                                                  cat.parentCategoryId === subCategory.categoryId && cat.categoryLevel === 3
                                                ).sort((a, b) => a.exposureOrder - b.exposureOrder);
                                                
                                                return (
                                                  <div key={subCategory.categoryId} className="mobile-category-group">
                                                    <button
                                                      type="button"
                                                      className={`category-option-btn ${filters.naver.categoryId === subCategory.categoryId ? 'selected' : ''}`}
                                                      onClick={() => {
                                                        if (subCategory.lastLevel || thirdLevelCats.length === 0) {
                                                          setFilters(prev => ({
                                                            ...prev,
                                                            naver: { ...prev.naver, categoryId: subCategory.categoryId }
                                                          }));
                                                          setShowNaverCategorySelector(false);
                                                        } else {
                                                          setExpandedMobileCategories(prev => ({
                                                            ...prev,
                                                            [subCatKey]: !prev[subCatKey]
                                                          }));
                                                        }
                                                      }}
                                                    >
                                                      <span className="category-name">{subCategory.categoryName}</span>
                                                      {!subCategory.lastLevel && thirdLevelCats.length > 0 && (
                                                        <span className="has-children">{isSubExpanded ? '▼' : '▶'}</span>
                                                      )}
                                                    </button>
                                                    
                                                    {isSubExpanded && thirdLevelCats.length > 0 && (
                                                      <div className="mobile-third-categories expanded">
                                                        {thirdLevelCats.map(thirdCategory => (
                                                          <button
                                                            key={thirdCategory.categoryId}
                                                            type="button"
                                                            className={`category-option-btn ${filters.naver.categoryId === thirdCategory.categoryId ? 'selected' : ''}`}
                                                            onClick={() => {
                                                              setFilters(prev => ({
                                                                ...prev,
                                                                naver: { ...prev.naver, categoryId: thirdCategory.categoryId }
                                                              }));
                                                              setShowNaverCategorySelector(false);
                                                            }}
                                                          >
                                                            <span className="category-name">{thirdCategory.categoryName}</span>
                                                          </button>
                                                        ))}
                                                      </div>
                                                    )}
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                </div>
                              ) : (
                                // PC 가로 3등분 뷰
                                <div className="category-panels">
                                {/* 대분류 패널 */}
                                <div className="main-category-panel">
                                  <div className="panel-header">대분류</div>
                                  <div className="category-list">
                                    {naverCategories
                                      .filter(cat => cat.categoryLevel === 1)
                                      .sort((a, b) => a.exposureOrder - b.exposureOrder)
                                      .map(category => (
                                        <div key={category.categoryId} className="category-option">
                                          <button
                                            type="button"
                                            className={`category-option-btn ${
                                              filters.naver.categoryId === category.categoryId ? 'selected' : ''
                                            } ${
                                              selectedMainCategory === category.categoryId ? 'highlighted' : ''
                                            }`}
                                            onClick={() => {
                                              setFilters(prev => ({
                                                ...prev,
                                                naver: { ...prev.naver, categoryId: category.categoryId }
                                              }));
                                              setShowNaverCategorySelector(false);
                                              setSelectedMainCategory(null);
                                              setSelectedSubCategory(null);
                                              setSubcategories([]);
                                              setThirdLevelCategories([]);
                                            }}
                                            onMouseEnter={() => {
                                              console.log(`🖱️ 마우스 호버: ${category.categoryName} (${category.categoryId})`);
                                              if (selectedMainCategory !== category.categoryId) {
                                                setSelectedMainCategory(category.categoryId);
                                                loadSubcategories(category.categoryId);
                                              }
                                            }}
                                            onFocus={() => {
                                              console.log(`🎯 포커스: ${category.categoryName} (${category.categoryId})`);
                                              if (selectedMainCategory !== category.categoryId) {
                                                setSelectedMainCategory(category.categoryId);
                                                loadSubcategories(category.categoryId);
                                              }
                                            }}
                                          >
                                            <span className="category-name">{category.categoryName}</span>
                                            {!category.lastLevel && <span className="has-children">▶</span>}
                                          </button>
                                        </div>
                                      ))
                                    }
                                  </div>
                                </div>

                                {/* 소분류 패널 - 테스트를 위해 항상 표시 */}
                                <div className="sub-category-panel">
                                    <div className="panel-header">
                                      소분류
                                      {subcategoriesLoading && <span className="loading-indicator">⏳</span>}
                                      {selectedMainCategory && <span className="selected-main">({naverCategories.find(c => c.categoryId === selectedMainCategory)?.categoryName})</span>}
                                    </div>
                                    <div className="category-list">
                                      {selectedMainCategory ? (
                                        subcategoriesLoading ? (
                                          <div className="loading-message">
                                            <p>소분류 로딩 중...</p>
                                          </div>
                                        ) : subcategories.length > 0 ? (
                                          subcategories
                                            .sort((a, b) => a.exposureOrder - b.exposureOrder)
                                            .map(subcategory => (
                                              <div key={subcategory.categoryId} className="category-option">
                                                <button
                                                  type="button"
                                                  className={`category-option-btn ${
                                                    filters.naver.categoryId === subcategory.categoryId ? 'selected' : ''
                                                  } ${
                                                    selectedSubCategory === subcategory.categoryId ? 'highlighted' : ''
                                                  }`}
                                                  onClick={() => {
                                                    setFilters(prev => ({
                                                      ...prev,
                                                      naver: { ...prev.naver, categoryId: subcategory.categoryId }
                                                    }));
                                                    setShowNaverCategorySelector(false);
                                                    setSelectedMainCategory(null);
                                                    setSelectedSubCategory(null);
                                                    setSubcategories([]);
                                                    setThirdLevelCategories([]);
                                                  }}
                                                  onMouseEnter={() => {
                                                    console.log(`🖱️ 소분류 호버: ${subcategory.categoryName} (${subcategory.categoryId})`);
                                                    if (selectedSubCategory !== subcategory.categoryId) {
                                                      setSelectedSubCategory(subcategory.categoryId);
                                                      loadThirdLevelCategories(subcategory.categoryId);
                                                    }
                                                  }}
                                                  onFocus={() => {
                                                    console.log(`🎯 소분류 포커스: ${subcategory.categoryName} (${subcategory.categoryId})`);
                                                    if (selectedSubCategory !== subcategory.categoryId) {
                                                      setSelectedSubCategory(subcategory.categoryId);
                                                      loadThirdLevelCategories(subcategory.categoryId);
                                                    }
                                                  }}
                                                >
                                                  <span className="category-name">{subcategory.categoryName}</span>
                                                  {!subcategory.lastLevel && <span className="has-children">▶</span>}
                                                </button>
                                              </div>
                                            ))
                                        ) : (
                                          <div className="no-subcategories">
                                            <p>소분류가 없습니다</p>
                                          </div>
                                        )
                                      ) : (
                                        <div className="no-subcategories">
                                          <p>대분류를 선택하면<br/>소분류가 표시됩니다</p>
                                        </div>
                                      )}
                                    </div>
                                </div>

                                {/* 3단계 카테고리 패널 */}
                                <div className="third-level-panel">
                                    <div className="panel-header">
                                      세부분류
                                      {thirdLevelLoading && <span className="loading-indicator">⏳</span>}
                                      {selectedSubCategory && <span className="selected-sub">({naverCategories.find(c => c.categoryId === selectedSubCategory)?.categoryName})</span>}
                                    </div>
                                    <div className="category-list">
                                      {selectedSubCategory ? (
                                        thirdLevelLoading ? (
                                          <div className="loading-message">
                                            <p>세부분류 로딩 중...</p>
                                          </div>
                                        ) : thirdLevelCategories.length > 0 ? (
                                          thirdLevelCategories
                                            .sort((a, b) => a.exposureOrder - b.exposureOrder)
                                            .map(thirdCategory => (
                                              <div key={thirdCategory.categoryId} className="category-option">
                                                <button
                                                  type="button"
                                                  className={`category-option-btn ${
                                                    filters.naver.categoryId === thirdCategory.categoryId ? 'selected' : ''
                                                  }`}
                                                  onClick={() => {
                                                    setFilters(prev => ({
                                                      ...prev,
                                                      naver: { ...prev.naver, categoryId: thirdCategory.categoryId }
                                                    }));
                                                    setShowNaverCategorySelector(false);
                                                    setSelectedMainCategory(null);
                                                    setSelectedSubCategory(null);
                                                    setSubcategories([]);
                                                    setThirdLevelCategories([]);
                                                  }}
                                                >
                                                  <span className="category-name">{thirdCategory.categoryName}</span>
                                                </button>
                                              </div>
                                            ))
                                        ) : (
                                          <div className="no-subcategories">
                                            <p>세부분류가 없습니다</p>
                                          </div>
                                        )
                                      ) : (
                                        <div className="no-subcategories">
                                          <p>소분류를 선택하면<br/>세부분류가 표시됩니다</p>
                                        </div>
                                      )}
                                    </div>
                                </div>
                              </div>
                              )
                            ) : (
                              <div className="error-message">
                                <p>카테고리를 불러올 수 없습니다.</p>
                                <button 
                                  type="button"
                                  onClick={loadNaverCategories}
                                  className="retry-btn"
                                >
                                  다시 시도
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="filter-group">
                    <h5>결제방법</h5>
                    <label>
                      <input
                        type="checkbox"
                        checked={filters.naver.directPay}
                        onChange={(e) => setFilters(prev => ({
                          ...prev, 
                          naver: { ...prev.naver, directPay: e.target.checked }
                        }))}
                      />
                      직접결제
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={filters.naver.escrowPay}
                        onChange={(e) => setFilters(prev => ({
                          ...prev, 
                          naver: { ...prev.naver, escrowPay: e.target.checked }
                        }))}
                      />
                      에스크로결제
                    </label>
                  </div>

                  <div className="filter-group">
                    <h5>배송방법</h5>
                    <label>
                      <input
                        type="checkbox"
                        checked={filters.naver.meetTrade}
                        onChange={(e) => setFilters(prev => ({
                          ...prev, 
                          naver: { ...prev.naver, meetTrade: e.target.checked }
                        }))}
                      />
                      직거래
                    </label>
              <label>
                <input
                  type="checkbox"
                        checked={filters.naver.deliveryTrade}
                        onChange={(e) => setFilters(prev => ({
                          ...prev, 
                          naver: { ...prev.naver, deliveryTrade: e.target.checked }
                        }))}
                      />
                      택배거래
              </label>
              <label>
                <input
                  type="checkbox"
                        checked={filters.naver.onlineTrade}
                        onChange={(e) => setFilters(prev => ({
                          ...prev, 
                          naver: { ...prev.naver, onlineTrade: e.target.checked }
                        }))}
                      />
                      온라인거래
                    </label>
                  </div>

                  <div className="filter-group">
                    <h5>상품상태</h5>
                    <label>
                      <input
                        type="checkbox"
                        checked={filters.naver.newItem}
                        onChange={(e) => setFilters(prev => ({
                          ...prev, 
                          naver: { ...prev.naver, newItem: e.target.checked }
                        }))}
                      />
                      새상품
              </label>
              <label>
                <input
                  type="checkbox"
                        checked={filters.naver.almostNew}
                        onChange={(e) => setFilters(prev => ({
                          ...prev, 
                          naver: { ...prev.naver, almostNew: e.target.checked }
                        }))}
                      />
                      거의새것
              </label>
              <label>
                <input
                  type="checkbox"
                        checked={filters.naver.usedItem}
                        onChange={(e) => setFilters(prev => ({
                          ...prev, 
                          naver: { ...prev.naver, usedItem: e.target.checked }
                        }))}
                      />
                      중고상품
              </label>
            </div>

                  <div className="filter-group">
                    <h5>등록기간</h5>
                    <select 
                      value={filters.naver.registrationPeriod} 
                      onChange={(e) => setFilters(prev => ({
                        ...prev, 
                        naver: { ...prev.naver, registrationPeriod: e.target.value }
                      }))}
                    >
                      <option value="ALL">전체</option>
                      <option value="1D">1일</option>
                      <option value="1W">1주일</option>
                      <option value="1M">1개월</option>
                      <option value="3M">3개월</option>
                    </select>
                  </div>
                </div>
              )}

              {activeFilterTab === 'joongna' && (
                <div className="joongna-filters">
                  <h4>중고나라 전용 필터</h4>
                  
                  {/* 중고나라 카테고리 선택 */}
                  <div className="filter-group category-filter-group">
                    
                    <div className="joongna-category-container">
                      <button 
                        type="button"
                        className={`category-selector-btn ${showJoongnaCategorySelector ? 'active' : ''}`}
                        onClick={() => {
                          setShowJoongnaCategorySelector(!showJoongnaCategorySelector);
                          if (!showJoongnaCategorySelector) {
                            loadJoongnaCategories();
                          }
                        }}
                      >
                        {(() => {
                          if (!filters.joongna.categoryId) return '카테고리 선택';
                          
                          // 카테고리 ID로부터 카테고리 이름 찾기
                          const categoryId = parseInt(filters.joongna.categoryId);
                          
                          // 먼저 메인 카테고리에서 찾기
                          if (joongnaCategories[categoryId]) {
                            return joongnaCategories[categoryId].name;
                          }
                          
                          // 서브 카테고리에서 찾기
                          for (const mainCat of Object.values(joongnaCategories)) {
                            if (mainCat.subcategories[categoryId]) {
                              return `${mainCat.name} > ${mainCat.subcategories[categoryId].name}`;
                            }
                            
                            // 세부 카테고리에서 찾기
                            for (const [, subCat] of Object.entries(mainCat.subcategories)) {
                              if (typeof subCat === 'object' && subCat.subcategories && subCat.subcategories[categoryId]) {
                                return `${mainCat.name} > ${subCat.name} > ${subCat.subcategories[categoryId]}`;
                              }
                            }
                          }
                          
                          return '카테고리 선택';
                        })()}
                        <span className={`arrow ${showJoongnaCategorySelector ? 'expanded' : ''}`}>▼</span>
                      </button>
                      
                      {showJoongnaCategorySelector && (
                        <div className="joongna-category-dropdown">
                          <div className="dropdown-header">
                            <button
                              type="button"
                              className="clear-category-btn"
                              onClick={() => {
                                setFilters(prev => ({
                                  ...prev,
                                  joongna: { ...prev.joongna, categoryId: '' }
                                }));
                                setSelectedJoongnaMainCategory(null);
                                setSelectedJoongnaSubCategory(null);
                              }}
                            >
                              전체 카테고리
                            </button>
                          </div>
                          
                          <div className="dropdown-content">
                            {joongnaCategoriesLoading ? (
                              <div className="loading-message">
                                <p>카테고리 로딩 중...</p>
                              </div>
                            ) : Object.keys(joongnaCategories).length > 0 ? (
                              isMobile ? (
                                // 모바일 아코디언 뷰
                                <div className="category-panels mobile-accordion">
                                  {Object.entries(joongnaCategories)
                                    .sort(([a], [b]) => parseInt(a) - parseInt(b))
                                    .map(([categoryId, category]) => {
                                      const mainCatKey = `joongna-main-${categoryId}`;
                                      const isMainExpanded = expandedMobileCategories[mainCatKey];
                                      const mainSubs = Object.entries(category.subcategories);
                                      
                                      return (
                                        <div key={categoryId} className="mobile-category-group">
                                          <button
                                            type="button"
                                            className={`category-option-btn ${filters.joongna.categoryId === categoryId ? 'selected' : ''}`}
                                            onClick={() => {
                                              if (mainSubs.length === 0) {
                                                setFilters(prev => ({
                                                  ...prev,
                                                  joongna: { ...prev.joongna, categoryId: categoryId }
                                                }));
                                                setShowJoongnaCategorySelector(false);
                                              } else {
                                                setExpandedMobileCategories(prev => ({
                                                  ...prev,
                                                  [mainCatKey]: !prev[mainCatKey]
                                                }));
                                              }
                                            }}
                                          >
                                            <span className="category-name">{category.name}</span>
                                            {mainSubs.length > 0 && (
                                              <span className="has-children">{isMainExpanded ? '▼' : '▶'}</span>
                                            )}
                                          </button>
                                          
                                          {isMainExpanded && mainSubs.length > 0 && (
                                            <div className="mobile-subcategories expanded">
                                              {mainSubs
                                                .sort(([a], [b]) => parseInt(a) - parseInt(b))
                                                .map(([subId, subCategory]) => {
                                                  const subCatKey = `joongna-sub-${subId}`;
                                                  const isSubExpanded = expandedMobileCategories[subCatKey];
                                                  const thirdLevelCats = typeof subCategory === 'object' && subCategory.subcategories ? 
                                                    Object.entries(subCategory.subcategories) : [];
                                                  
                                                  return (
                                                    <div key={subId} className="mobile-category-group">
                                                      <button
                                                        type="button"
                                                        className={`category-option-btn ${filters.joongna.categoryId === subId ? 'selected' : ''}`}
                                                        onClick={() => {
                                                          if (thirdLevelCats.length === 0) {
                                                            setFilters(prev => ({
                                                              ...prev,
                                                              joongna: { ...prev.joongna, categoryId: subId }
                                                            }));
                                                            setShowJoongnaCategorySelector(false);
                                                          } else {
                                                            setExpandedMobileCategories(prev => ({
                                                              ...prev,
                                                              [subCatKey]: !prev[subCatKey]
                                                            }));
                                                          }
                                                        }}
                                                      >
                                                        <span className="category-name">{subCategory.name}</span>
                                                        {thirdLevelCats.length > 0 && (
                                                          <span className="has-children">{isSubExpanded ? '▼' : '▶'}</span>
                                                        )}
                                                      </button>
                                                      
                                                      {isSubExpanded && thirdLevelCats.length > 0 && (
                                                        <div className="mobile-third-categories expanded">
                                                          {thirdLevelCats
                                                            .sort(([a], [b]) => parseInt(a) - parseInt(b))
                                                            .map(([thirdId, thirdName]) => (
                                                              <button
                                                                key={thirdId}
                                                                type="button"
                                                                className={`category-option-btn ${filters.joongna.categoryId === thirdId ? 'selected' : ''}`}
                                                                onClick={() => {
                                                                  setFilters(prev => ({
                                                                    ...prev,
                                                                    joongna: { ...prev.joongna, categoryId: thirdId }
                                                                  }));
                                                                  setShowJoongnaCategorySelector(false);
                                                                }}
                                                              >
                                                                <span className="category-name">{thirdName}</span>
                                                              </button>
                                                            ))}
                                                        </div>
                                                      )}
                                                    </div>
                                                  );
                                                })}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                </div>
                              ) : (
                                // PC 가로 3등분 뷰
                                <div className="category-panels">
                                {/* 대분류 패널 */}
                                <div className="main-category-panel">
                                  <div className="panel-header">대분류</div>
                                  <div className="category-list">
                                    {Object.entries(joongnaCategories)
                                      .sort(([a], [b]) => parseInt(a) - parseInt(b))
                                      .map(([categoryId, category]) => (
                                        <div key={categoryId} className="category-option">
                                          <button
                                            type="button"
                                            className={`category-option-btn ${
                                              filters.joongna.categoryId === categoryId ? 'selected' : ''
                                            } ${
                                              selectedJoongnaMainCategory === parseInt(categoryId) ? 'highlighted' : ''
                                            }`}
                                            onClick={() => {
                                              console.log('🎯 중고나라 대분류 카테고리 선택:', categoryId, category.name);
                                              setFilters(prev => ({
                                                ...prev,
                                                joongna: { ...prev.joongna, categoryId: categoryId }
                                              }));
                                              setShowJoongnaCategorySelector(false);
                                              setSelectedJoongnaMainCategory(null);
                                              setSelectedJoongnaSubCategory(null);
                                            }}
                                            onMouseEnter={() => {
                                              setSelectedJoongnaMainCategory(parseInt(categoryId));
                                              setSelectedJoongnaSubCategory(null);
                                            }}
                                          >
                                            <span className="category-name">{category.name}</span>
                                            {Object.keys(category.subcategories).length > 0 && (
                                              <span className="has-children">▶</span>
                                            )}
                                          </button>
                                        </div>
                                      ))
                                    }
                                  </div>
                                </div>

                                {/* 소분류 패널 */}
                                <div className="sub-category-panel">
                                  <div className="panel-header">
                                    소분류
                                    {selectedJoongnaMainCategory && (
                                      <span className="selected-main">
                                        ({joongnaCategories[selectedJoongnaMainCategory]?.name})
                                      </span>
                                    )}
                                  </div>
                                  <div className="category-list">
                                    {selectedJoongnaMainCategory ? (
                                      Object.keys(joongnaCategories[selectedJoongnaMainCategory]?.subcategories || {}).length > 0 ? (
                                        Object.entries(joongnaCategories[selectedJoongnaMainCategory].subcategories)
                                          .sort(([a], [b]) => parseInt(a) - parseInt(b))
                                          .map(([subId, subCategory]) => (
                                            <div key={subId} className="category-option">
                                              <button
                                                type="button"
                                                className={`category-option-btn ${
                                                  filters.joongna.categoryId === subId ? 'selected' : ''
                                                } ${
                                                  selectedJoongnaSubCategory === parseInt(subId) ? 'highlighted' : ''
                                                }`}
                                                onClick={() => {
                                                  console.log('🎯 중고나라 소분류 카테고리 선택:', subId, subCategory.name);
                                                  setFilters(prev => ({
                                                    ...prev,
                                                    joongna: { ...prev.joongna, categoryId: subId }
                                                  }));
                                                  setShowJoongnaCategorySelector(false);
                                                  setSelectedJoongnaMainCategory(null);
                                                  setSelectedJoongnaSubCategory(null);
                                                }}
                                                onMouseEnter={() => {
                                                  setSelectedJoongnaSubCategory(parseInt(subId));
                                                }}
                                              >
                                                <span className="category-name">{subCategory.name}</span>
                                                {typeof subCategory === 'object' && subCategory.subcategories && 
                                                 Object.keys(subCategory.subcategories).length > 0 && (
                                                  <span className="has-children">▶</span>
                                                )}
                                              </button>
                                            </div>
                                          ))
                                      ) : (
                                        <div className="no-subcategories">
                                          <p>소분류가 없습니다</p>
                                        </div>
                                      )
                                    ) : (
                                      <div className="no-subcategories">
                                        <p>대분류를 선택하면<br/>소분류가 표시됩니다</p>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* 세부분류 패널 */}
                                <div className="third-level-panel">
                                  <div className="panel-header">
                                    세부분류
                                    {selectedJoongnaSubCategory && selectedJoongnaMainCategory && (
                                      <span className="selected-sub">
                                        ({joongnaCategories[selectedJoongnaMainCategory]?.subcategories[selectedJoongnaSubCategory]?.name})
                                      </span>
                                    )}
                                  </div>
                                  <div className="category-list">
                                    {selectedJoongnaSubCategory && selectedJoongnaMainCategory ? (
                                      (() => {
                                        const subCat = joongnaCategories[selectedJoongnaMainCategory]?.subcategories[selectedJoongnaSubCategory];
                                        if (typeof subCat === 'object' && subCat.subcategories && Object.keys(subCat.subcategories).length > 0) {
                                          return Object.entries(subCat.subcategories)
                                            .sort(([a], [b]) => parseInt(a) - parseInt(b))
                                            .map(([thirdId, thirdName]) => (
                                              <div key={thirdId} className="category-option">
                                                <button
                                                  type="button"
                                                  className={`category-option-btn ${
                                                    filters.joongna.categoryId === thirdId ? 'selected' : ''
                                                  }`}
                                                  onClick={() => {
                                                    console.log('🎯 중고나라 세부분류 카테고리 선택:', thirdId, thirdName);
                                                    setFilters(prev => ({
                                                      ...prev,
                                                      joongna: { ...prev.joongna, categoryId: thirdId }
                                                    }));
                                                    setShowJoongnaCategorySelector(false);
                                                    setSelectedJoongnaMainCategory(null);
                                                    setSelectedJoongnaSubCategory(null);
                                                  }}
                                                >
                                                  <span className="category-name">{thirdName}</span>
                                                </button>
                                              </div>
                                            ));
                                        } else {
                                          return (
                                            <div className="no-subcategories">
                                              <p>세부분류가 없습니다</p>
                                            </div>
                                          );
                                        }
                                      })()
                                    ) : (
                                      <div className="no-subcategories">
                                        <p>소분류를 선택하면<br/>세부분류가 표시됩니다</p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                              )
                            ) : (
                              <div className="error-message">
                                <p>카테고리를 불러올 수 없습니다.</p>
                                <button 
                                  type="button"
                                  onClick={loadJoongnaCategories}
                                  className="retry-btn"
                                >
                                  다시 시도
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="filter-group">
                    <label>
                      <input
                        type="checkbox"
                        checked={filters.joongna.parcelFeeYn}
                        onChange={(e) => setFilters(prev => ({
                          ...prev, 
                          joongna: { ...prev.joongna, parcelFeeYn: e.target.checked }
                        }))}
                      />
                      무료배송
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={filters.joongna.certifiedSellerYn}
                        onChange={(e) => setFilters(prev => ({
                          ...prev, 
                          joongna: { ...prev.joongna, certifiedSellerYn: e.target.checked }
                        }))}
                      />
                      인증셀러 상품
                    </label>
                  </div>
                </div>
              )}

              {activeFilterTab === 'bunjang' && (
                <div className="bunjang-filters">
                  <h4>번개장터 전용 필터</h4>
                  
                  {/* 번개장터 카테고리 선택 */}
                  <div className="filter-group category-filter-group">
                    
                    <div className="bunjang-category-container">
                      <button 
                        type="button"
                        className={`category-selector-btn ${showBunjangCategorySelector ? 'active' : ''}`}
                        onClick={() => {
                          setShowBunjangCategorySelector(!showBunjangCategorySelector);
                          if (!showBunjangCategorySelector) {
                            loadBunjangCategories();
                          }
                        }}
                      >
                        {(() => {
                          if (!filters.bunjang.categoryId) return '카테고리 선택';
                          
                          // 카테고리 ID로부터 카테고리 이름 찾기
                          const categoryId = filters.bunjang.categoryId;
                          
                          // 대분류에서 찾기
                          const mainCategory = bunjangCategories.find(cat => cat.id === categoryId);
                          if (mainCategory) {
                            return mainCategory.title;
                          }
                          
                          // 중분류에서 찾기
                          for (const mainCat of bunjangCategories) {
                            const subCategory = mainCat.subcategories.find(sub => sub.id === categoryId);
                            if (subCategory) {
                              return `${mainCat.title} > ${subCategory.title}`;
                            }
                            
                            // 소분류에서 찾기
                            for (const subCat of mainCat.subcategories) {
                              const thirdCategory = subCat.subcategories.find(third => third.id === categoryId);
                              if (thirdCategory) {
                                return `${mainCat.title} > ${subCat.title} > ${thirdCategory.title}`;
                              }
                            }
                          }
                          
                          return '카테고리 선택';
                        })()}
                        <span className={`arrow ${showBunjangCategorySelector ? 'expanded' : ''}`}>▼</span>
                      </button>
                      
                      {showBunjangCategorySelector && (
                        <div className="bunjang-category-dropdown">
                          <div className="dropdown-header">
                            <button
                              type="button"
                              className="clear-category-btn"
                              onClick={() => {
                                setFilters(prev => ({
                                  ...prev,
                                  bunjang: { ...prev.bunjang, categoryId: '' }
                                }));
                                setSelectedBunjangMainCategory(null);
                                setSelectedBunjangSubCategory(null);
                              }}
                            >
                              전체 카테고리
                            </button>
                          </div>
                          
                          <div className="dropdown-content">
                            {bunjangCategoriesLoading ? (
                              <div className="loading-message">
                                <p>카테고리 로딩 중...</p>
                              </div>
                            ) : bunjangCategories.length > 0 ? (
                              isMobile ? (
                                // 모바일 아코디언 뷰
                                <div className="category-panels mobile-accordion">
                                  {bunjangCategories
                                    .sort((a, b) => a.order - b.order)
                                    .map(mainCategory => {
                                      const mainCatKey = `bunjang-main-${mainCategory.id}`;
                                      const isMainExpanded = expandedMobileCategories[mainCatKey];
                                      
                                      return (
                                        <div key={mainCategory.id} className="mobile-category-group">
                                          <button
                                            type="button"
                                            className={`category-option-btn ${filters.bunjang.categoryId === mainCategory.id ? 'selected' : ''}`}
                                            onClick={() => {
                                              if (mainCategory.subcategories.length === 0) {
                                                setFilters(prev => ({
                                                  ...prev,
                                                  bunjang: { ...prev.bunjang, categoryId: mainCategory.id }
                                                }));
                                                setShowBunjangCategorySelector(false);
                                              } else {
                                                setExpandedMobileCategories(prev => ({
                                                  ...prev,
                                                  [mainCatKey]: !prev[mainCatKey]
                                                }));
                                              }
                                            }}
                                          >
                                            <span className="category-name">{mainCategory.title}</span>
                                            {mainCategory.subcategories.length > 0 && (
                                              <span className="has-children">{isMainExpanded ? '▼' : '▶'}</span>
                                            )}
                                          </button>
                                          
                                          {isMainExpanded && mainCategory.subcategories.length > 0 && (
                                            <div className="mobile-subcategories expanded">
                                              {mainCategory.subcategories
                                                .sort((a, b) => a.order - b.order)
                                                .map(subCategory => {
                                                  const subCatKey = `bunjang-sub-${subCategory.id}`;
                                                  const isSubExpanded = expandedMobileCategories[subCatKey];
                                                  
                                                  return (
                                                    <div key={subCategory.id} className="mobile-category-group">
                                                      <button
                                                        type="button"
                                                        className={`category-option-btn ${filters.bunjang.categoryId === subCategory.id ? 'selected' : ''}`}
                                                        onClick={() => {
                                                          if (subCategory.subcategories.length === 0) {
                                                            setFilters(prev => ({
                                                              ...prev,
                                                              bunjang: { ...prev.bunjang, categoryId: subCategory.id }
                                                            }));
                                                            setShowBunjangCategorySelector(false);
                                                          } else {
                                                            setExpandedMobileCategories(prev => ({
                                                              ...prev,
                                                              [subCatKey]: !prev[subCatKey]
                                                            }));
                                                          }
                                                        }}
                                                      >
                                                        <span className="category-name">{subCategory.title}</span>
                                                        {subCategory.subcategories.length > 0 && (
                                                          <span className="has-children">{isSubExpanded ? '▼' : '▶'}</span>
                                                        )}
                                                      </button>
                                                      
                                                      {isSubExpanded && subCategory.subcategories.length > 0 && (
                                                        <div className="mobile-third-categories expanded">
                                                          {subCategory.subcategories
                                                            .sort((a, b) => a.order - b.order)
                                                            .map(thirdCategory => (
                                                              <button
                                                                key={thirdCategory.id}
                                                                type="button"
                                                                className={`category-option-btn ${filters.bunjang.categoryId === thirdCategory.id ? 'selected' : ''}`}
                                                                onClick={() => {
                                                                  setFilters(prev => ({
                                                                    ...prev,
                                                                    bunjang: { ...prev.bunjang, categoryId: thirdCategory.id }
                                                                  }));
                                                                  setShowBunjangCategorySelector(false);
                                                                }}
                                                              >
                                                                <span className="category-name">{thirdCategory.title}</span>
                                                              </button>
                                                            ))}
                                                        </div>
                                                      )}
                                                    </div>
                                                  );
                                                })}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                </div>
                              ) : (
                                // PC 가로 3등분 뷰
                                <div className="category-panels">
                                {/* 대분류 패널 */}
                                <div className="main-category-panel">
                                  <div className="panel-header">대분류</div>
                                  <div className="category-list">
                                    {bunjangCategories
                                      .sort((a, b) => a.order - b.order)
                                      .map(category => (
                                        <div key={category.id} className="category-option">
                                          <button
                                            type="button"
                                            className={`category-option-btn ${
                                              filters.bunjang.categoryId === category.id ? 'selected' : ''
                                            } ${
                                              selectedBunjangMainCategory === category.id ? 'highlighted' : ''
                                            }`}
                                            onClick={() => {
                                              console.log('🎯 번개장터 대분류 카테고리 선택:', category.id, category.title);
                                              setFilters(prev => ({
                                                ...prev,
                                                bunjang: { ...prev.bunjang, categoryId: category.id }
                                              }));
                                              setShowBunjangCategorySelector(false);
                                              setSelectedBunjangMainCategory(null);
                                              setSelectedBunjangSubCategory(null);
                                            }}
                                            onMouseEnter={() => {
                                              setSelectedBunjangMainCategory(category.id);
                                              setSelectedBunjangSubCategory(null);
                                            }}
                                          >
                                            <span className="category-name">{category.title}</span>
                                            {category.subcategories.length > 0 && (
                                              <span className="has-children">▶</span>
                                            )}
                                          </button>
                                        </div>
                                      ))
                                    }
                                  </div>
                                </div>

                                {/* 중분류 패널 */}
                                <div className="sub-category-panel">
                                  <div className="panel-header">
                                    중분류
                                    {selectedBunjangMainCategory && (
                                      <span className="selected-main">
                                        ({bunjangCategories.find(c => c.id === selectedBunjangMainCategory)?.title})
                                      </span>
                                    )}
                                  </div>
                                  <div className="category-list">
                                    {selectedBunjangMainCategory ? (
                                      (() => {
                                        const mainCat = bunjangCategories.find(c => c.id === selectedBunjangMainCategory);
                                        return mainCat && mainCat.subcategories.length > 0 ? (
                                          mainCat.subcategories
                                            .sort((a, b) => a.order - b.order)
                                            .map(subCategory => (
                                              <div key={subCategory.id} className="category-option">
                                                <button
                                                  type="button"
                                                  className={`category-option-btn ${
                                                    filters.bunjang.categoryId === subCategory.id ? 'selected' : ''
                                                  } ${
                                                    selectedBunjangSubCategory === subCategory.id ? 'highlighted' : ''
                                                  }`}
                                                  onClick={() => {
                                                    console.log('🎯 번개장터 중분류 카테고리 선택:', subCategory.id, subCategory.title);
                                                    setFilters(prev => ({
                                                      ...prev,
                                                      bunjang: { ...prev.bunjang, categoryId: subCategory.id }
                                                    }));
                                                    setShowBunjangCategorySelector(false);
                                                    setSelectedBunjangMainCategory(null);
                                                    setSelectedBunjangSubCategory(null);
                                                  }}
                                                  onMouseEnter={() => {
                                                    setSelectedBunjangSubCategory(subCategory.id);
                                                  }}
                                                >
                                                  <span className="category-name">{subCategory.title}</span>
                                                  {subCategory.subcategories.length > 0 && (
                                                    <span className="has-children">▶</span>
                                                  )}
                                                </button>
                                              </div>
                                            ))
                                        ) : (
                                          <div className="no-subcategories">
                                            <p>중분류가 없습니다</p>
                                          </div>
                                        );
                                      })()
                                    ) : (
                                      <div className="no-subcategories">
                                        <p>대분류를 선택하면<br/>중분류가 표시됩니다</p>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* 소분류 패널 */}
                                <div className="third-level-panel">
                                  <div className="panel-header">
                                    소분류
                                    {selectedBunjangSubCategory && selectedBunjangMainCategory && (
                                      <span className="selected-sub">
                                        ({(() => {
                                          const mainCat = bunjangCategories.find(c => c.id === selectedBunjangMainCategory);
                                          const subCat = mainCat?.subcategories.find(s => s.id === selectedBunjangSubCategory);
                                          return subCat?.title;
                                        })()})
                                      </span>
                                    )}
                                  </div>
                                  <div className="category-list">
                                    {selectedBunjangSubCategory && selectedBunjangMainCategory ? (
                                      (() => {
                                        const mainCat = bunjangCategories.find(c => c.id === selectedBunjangMainCategory);
                                        const subCat = mainCat?.subcategories.find(s => s.id === selectedBunjangSubCategory);
                                        return subCat && subCat.subcategories.length > 0 ? (
                                          subCat.subcategories
                                            .sort((a, b) => a.order - b.order)
                                            .map(thirdCategory => (
                                              <div key={thirdCategory.id} className="category-option">
                                                <button
                                                  type="button"
                                                  className={`category-option-btn ${
                                                    filters.bunjang.categoryId === thirdCategory.id ? 'selected' : ''
                                                  }`}
                                                  onClick={() => {
                                                    console.log('🎯 번개장터 소분류 카테고리 선택:', thirdCategory.id, thirdCategory.title);
                                                    setFilters(prev => ({
                                                      ...prev,
                                                      bunjang: { ...prev.bunjang, categoryId: thirdCategory.id }
                                                    }));
                                                    setShowBunjangCategorySelector(false);
                                                    setSelectedBunjangMainCategory(null);
                                                    setSelectedBunjangSubCategory(null);
                                                  }}
                                                >
                                                  <span className="category-name">{thirdCategory.title}</span>
                                                </button>
                                              </div>
                                            ))
                                        ) : (
                                          <div className="no-subcategories">
                                            <p>소분류가 없습니다</p>
                                          </div>
                                        );
                                      })()
                                    ) : (
                                      <div className="no-subcategories">
                                        <p>중분류를 선택하면<br/>소분류가 표시됩니다</p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                              )
                            ) : (
                              <div className="error-message">
                                <p>카테고리를 불러올 수 없습니다.</p>
                                <button 
                                  type="button"
                                  onClick={loadBunjangCategories}
                                  className="retry-btn"
                                >
                                  다시 시도
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="filter-group">
                    <label>
                      <input
                        type="checkbox"
                        checked={filters.bunjang.freeShipping}
                        onChange={(e) => setFilters(prev => ({
                          ...prev, 
                          bunjang: { ...prev.bunjang, freeShipping: e.target.checked }
                        }))}
                      />
                      무료배송
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={filters.bunjang.inspection}
                        onChange={(e) => setFilters(prev => ({
                          ...prev, 
                          bunjang: { ...prev.bunjang, inspection: e.target.checked }
                        }))}
                      />
                      검수 가능
                    </label>
                  </div>
                </div>
              )}

              {activeFilterTab === 'golmarket' && (
                <div className="golmarket-filters">
                  <h4>골마켓 전용 필터 ⛳</h4>
                  
                  {/* 골마켓 카테고리 선택 */}
                  <div className="filter-group category-filter-group">
                    <h5>
                      ⛳ 카테고리 선택
                      <span className="required-badge">필수</span>
                    </h5>
                    <div className="golmarket-category-container">
                      <button 
                        type="button"
                        className={`category-selector-btn ${showGolmarketCategorySelector ? 'active' : ''}`}
                        onClick={() => {
                          setShowGolmarketCategorySelector(!showGolmarketCategorySelector);
                          if (!showGolmarketCategorySelector) {
                            loadGolmarketCategories();
                          }
                        }}
                      >
                        {filters.golmarket.categoryId ? 
                          golmarketCategories.find(cat => cat.id.toString() === filters.golmarket.categoryId)?.name || '카테고리 선택' 
                          : '카테고리 선택'
                        }
                        <span className={`arrow ${showGolmarketCategorySelector ? 'expanded' : ''}`}>▼</span>
                      </button>
                      
                      {showGolmarketCategorySelector && (
                        <div className="golmarket-category-dropdown">
                          <div className="dropdown-header">
                            <button
                              type="button"
                              className="clear-category-btn"
                              onClick={() => {
                                setFilters(prev => ({
                                  ...prev,
                                  golmarket: { ...prev.golmarket, categoryId: '' }
                                }));
                              }}
                            >
                              전체 카테고리
                            </button>
                          </div>
                          
                          <div className="dropdown-content">
                            {golmarketCategoriesLoading ? (
                              <div className="loading-message">
                                <p>카테고리 로딩 중...</p>
                              </div>
                            ) : golmarketCategories.length > 0 ? (
                              <div className="category-list">
                                {golmarketCategories.map(category => (
                                  <div key={category.id} className="category-option">
                                    <button
                                      type="button"
                                      className={`category-option-btn ${
                                        filters.golmarket.categoryId === category.id.toString() ? 'selected' : ''
                                      }`}
                                      onClick={() => {
                                        console.log('🎯 골마켓 카테고리 선택:', category.id, category.name);
                                        setFilters(prev => ({
                                          ...prev,
                                          golmarket: { ...prev.golmarket, categoryId: category.id.toString() }
                                        }));
                                        setShowGolmarketCategorySelector(false);
                                      }}
                                    >
                                      <span className="category-name">{category.name}</span>
                                    </button>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="error-message">
                                <p>카테고리를 불러올 수 없습니다.</p>
                                <button 
                                  type="button"
                                  onClick={loadGolmarketCategories}
                                  className="retry-btn"
                                >
                                  다시 시도
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="filter-actions">
              <button 
                type="button" 
                onClick={() => {
                  setFilters({
                    common: {
                      minPrice: '',
                      maxPrice: '',
                      sort: 'RECOMMEND',
                      onSale: true, // 항상 true 유지
                      includeSoldOut: false
                    },
                    naver: {
                      categoryId: '',
                      directPay: false,
                      escrowPay: false,
                      meetTrade: false,
                      deliveryTrade: false,
                      onlineTrade: false,
                      newItem: false,
                      almostNew: false,
                      usedItem: false,
                      registrationPeriod: 'ALL'
                    },
                    joongna: {
                      categoryId: '',
                      parcelFeeYn: false,
                      certifiedSellerYn: false
                    },
                    bunjang: {
                      categoryId: '',
                      freeShipping: false,
                      inspection: false
                    },
                    golmarket: {
                      categoryId: ''
                    }
                  });
                  // 카테고리 선택 상태도 초기화
                  setSelectedMainCategory(null);
                  setSelectedSubCategory(null);
                  setSelectedJoongnaMainCategory(null);
                  setSelectedJoongnaSubCategory(null);
                  setSelectedBunjangMainCategory(null);
                  setSelectedBunjangSubCategory(null);
                }}
                className="reset-filters-button"
              >
                필터 초기화
              </button>
              <button 
                type="submit" 
                disabled={loading} 
                className="mobile-search-button"
              >
                {loading ? '검색 중...' : '검색'}
              </button>
            </div>
          </div>
        </form>

        {loading && (
          <div className="loading">
            <div className="spinner"></div>
            <p>검색 중입니다...</p>
          </div>
        )}

        {results.length > 0 && (
          <div className="results-section">
            <div className="results-header">
            <h2>검색 결과 ({results.length}개)</h2>
              {pagination && (
                <div className="pagination-info">
                  <span>페이지 {pagination.currentPage}</span>
                </div>
              )}
            </div>
            
            <div className="results-grid">
              {sortedResults.map((result, index) => (
                <div key={index} className="result-card">
                  <div className={`result-image ${(() => {
                    // 중고나라 state 값 확인: 판매중(0)이 아니면 오버레이 적용
                    if (result.source === '중고나라' && result.state !== undefined && result.state !== 0) {
                      return 'has-overlay';
                    }
                    // 다른 플랫폼: 판매중이 아니면 오버레이 적용
                    if (result.saleStatus && result.saleStatus !== '판매중') {
                      return 'has-overlay';
                    }
                    return '';
                  })()}`}>
                    {result.image && result.image !== 'https://via.placeholder.com/200x200' ? (
                      (() => {
                        // 네이버 카페 이미지는 프록시를 통해 로딩
                        if (result.source === '네이버 카페' && result.image.includes('naver.com')) {
                          return (
                            <img 
                              src={`/api/proxy-image?url=${encodeURIComponent(result.image)}`}
                              alt={result.title}
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                target.parentElement!.innerHTML = '<div class="no-image">이미지 로딩 실패</div>';
                              }}
                              loading="lazy"
                            />
                          );
                        }
                        // 다른 플랫폼은 기존 방식 유지
                        return (
                          <img 
                            src={result.image} 
                            alt={result.title}
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              target.parentElement!.innerHTML = '<div class="no-image">이미지 로딩 실패</div>';
                            }}
                            loading="lazy"
                          />
                        );
                      })()
                    ) : (
                      <div className="no-image">이미지 없음</div>
                    )}
                    
                    {/* 판매 상태 오버레이 (모든 플랫폼) */}
                    {(() => {
                      
                      // 중고나라 state 값 확인: 실제 상태 그대로 표시
                      if (result.source === '중고나라' && result.state !== undefined && result.state !== 0) {
                        if (result.state === 1) {
                          return (
                            <div className="sale-status-overlay reserved">
                              🔒 예약중
                            </div>
                          );
                        } else if (result.state === 2) {
                          return (
                            <div className="sale-status-overlay reserved">
                              🔒 예약중
                            </div>
                          );
                        } else if (result.state === 3) {
                          return (
                            <div className="sale-status-overlay completed">
                              ✅ 판매완료
                            </div>
                          );
                        } else {
                          return (
                            <div className="sale-status-overlay completed">
                              ❌ 구매불가
                            </div>
                          );
                        }
                      }
                      
                      // 골마켓: 판매완료와 판매취소만 오버레이 표시
                      if (result.source === '골마켓' && result.saleStatus) {
                        if (result.saleStatus === '판매완료' || result.saleStatus === '판매취소') {
                          const statusText = result.saleStatus === '판매완료' ? '✅ 판매완료' : '❌ 판매취소';
                          return (
                            <div className="sale-status-overlay completed">
                              {statusText}
                            </div>
                          );
                        }
                      }
                      
                      // 다른 플랫폼 saleStatus 확인: 실제 상태 그대로 표시
                      if (result.source !== '골마켓' && result.saleStatus && result.saleStatus !== '판매중') {
                        const statusClass = result.saleStatus === '예약중' ? 'reserved' : 'completed';
                        const statusText = result.saleStatus === '예약중' ? '🔒 예약중' : '✅ 판매완료';
                        return (
                          <div className={`sale-status-overlay ${statusClass}`}>
                            {statusText}
                          </div>
                        );
                      }
                      
                      return null;
                    })()}
                  </div>
                  <div className="result-content">
                    {/* 뱃지들 - 제일 위로 */}
                    <div className="badges">
                      {result.isSafePayment && (
                        <span className="safe-payment-badge">🔒 안전결제</span>
                      )}
                      {(() => {
                        // 번개장터 배송비 정보
                        if (result.source === '번개장터' && result.shippingInfo) {
                          if (result.shippingInfo === '무료배송') {
                            return <span className="shipping-badge free">📦 무료배송</span>;
                          } else if (result.shippingInfo === '배송비별도') {
                            return <span className="shipping-badge separate">📦 배송비별도</span>;
                          }
                        }
                        // 중고나라 배송비 정보
                        if (result.source === '중고나라' && result.parcelFee !== undefined) {
                          if (result.parcelFee === 1) {
                            return <span className="shipping-badge free">📦 무료배송</span>;
                          } else {
                            return <span className="shipping-badge separate">📦 배송비별도</span>;
                          }
                        }
                        return null;
                      })()}
                      {(() => {
                        // 네이버카페 거래방식 정보
                        if (result.source === '네이버 카페' && result.delivery) {
                          if (result.delivery.includes('직거래') && result.delivery.includes('택배')) {
                            return <span className="trade-badge both">🤝 직거래/택배</span>;
                          } else if (result.delivery.includes('직거래')) {
                            return <span className="trade-badge meet">🤝 직거래</span>;
                          } else if (result.delivery.includes('택배')) {
                            return <span className="trade-badge delivery">📦 택배</span>;
                          }
                        }
                        return null;
                      })()}
                      {result.isBunjangCare && (
                        <span className="bunjang-care-badge">🛡️ 번개케어</span>
                      )}
                      {result.inspection && !result.isBunjangCare && (
                        <span className="inspection-badge">✅ 검수가능</span>
                      )}
                    </div>

                    <div className="result-main-info">
                      <h3 className="result-title">
                        <a 
                          href={result.link} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          onClick={(e) => handleAppLink(result, e)}
                        >
                          {result.title}
                        </a>
                      </h3>
                    </div>
                    
                    <div className="result-details-wrapper">
                      {/* 추가 정보 표시 */}
                      {/* 모든 카드에 details 영역 표시 (위치정보는 항상 표시) */}
                      <div className="result-details">
                        {/* 첫 번째 줄: 판매상태 + 찜 */}
                        <div className="top-left">
                          {/* 판매상태 표시 - 모든 플랫폼에서 통일된 스타일 사용 */}
                          {result.source === '중고나라' && result.state !== undefined ? (
                            <span className={`result-sale-status ${result.state === 2 ? 'completed' : result.state === 1 ? 'reserved' : 'on-sale'}`}>
                              {result.state === 0 ? '💚 판매중' : 
                               result.state === 1 ? '🔒 예약중' : 
                               result.state === 2 ? '✅ 판매완료' : '💚 판매중'}
                            </span>
                          ) : result.saleStatus && (
                            <span className={`result-sale-status ${result.saleStatus === '판매완료' ? 'completed' : result.saleStatus === '예약중' ? 'reserved' : 'on-sale'}`}>
                              {result.saleStatus === '판매완료' ? '✅' : result.saleStatus === '예약중' ? '🔒' : '💚'} {result.saleStatus}
                            </span>
                          )}
                          {/* 찜 표시 */}
                          {(result.source === '중고나라' || result.source === '번개장터') && result.wishCount !== undefined && (
                            <span className="result-wish-count">❤️ {result.wishCount}</span>
                          )}
                        </div>

                        {/* 상단 오른쪽: 숨김 */}
                        <div className="top-right">
                        </div>

                        {/* 두 번째 줄: 위치 정보만 */}
                        <div className="middle-center">
                          {result.region ? (
                            <span className="result-region">📍 {result.region}</span>
                          ) : (
                            <span className="result-region-none">📍 위치 정보 없음</span>
                          )}
                        </div>

                        {/* 하단: 숨김 */}
                        <div className="bottom-left"></div>
                        <div className="bottom-right"></div>
                      </div>
                    </div>
                  </div>

                  <div className="result-price-section">
                    {/* 가격 + 시간 */}
                    <div className="price-section">
                        <p className="result-price">{result.price}</p>
                        {(() => {
                          const timeAgoText = formatTimeAgo(result.timestamp);
                          if (timeAgoText) {
                            return <span className="result-time-ago">🕒 {timeAgoText}</span>;
                          } else if (result.date) {
                            return <span className="result-date">⏰ {result.date}</span>;
                          }
                          return null;
                        })()}
                      </div>
                    
                      <div className="result-meta">
                        <span className={`source-badge ${result.source.replace(/\s+/g, '-').toLowerCase()}`}>
                          {result.source}
                        </span>
                        {(result.type === 'NFLEA_TRADE_ARTICLE' || (result.cafe && result.cafe !== result.source)) && (
                          <span className="cafe-name">
                            {result.type === 'NFLEA_TRADE_ARTICLE' ? 'N플리마켓' : result.cafe}
                          </span>
                        )}
                      </div>
                  </div>
                </div>
              ))}
            </div>

            {/* 페이지네이션 버튼 */}
            {pagination && (pagination.hasPrevPage || pagination.hasNextPage) && (
              <div className="pagination-controls">
                <button 
                  onClick={handlePrevPage}
                  disabled={!pagination.hasPrevPage || loading}
                  className={`pagination-btn prev-btn ${!pagination.hasPrevPage ? 'disabled' : ''}`}
                >
                  ← 이전 페이지
                </button>
                
                <span className="page-info">
                  페이지 {pagination.currentPage}
                </span>
                
                <button 
                  onClick={handleNextPage}
                  disabled={!pagination.hasNextPage || loading}
                  className={`pagination-btn next-btn ${!pagination.hasNextPage ? 'disabled' : ''}`}
                >
                  다음 페이지 →
                </button>
              </div>
            )}
          </div>
        )}

        {!loading && results.length === 0 && query && (
          <div className="no-results">
            <p>검색 결과가 없습니다.</p>
            <p>다른 검색어를 시도해보세요.</p>
          </div>
        )}
      </main>

      {/* 위로 가기 버튼 */}
      <button 
        className={`scroll-to-top ${showScrollTop ? 'visible' : ''}`}
        onClick={scrollToTop}
        aria-label="맨 위로"
        title="맨 위로"
      >
        ↑
      </button>

      <footer className="app-footer">
        <p>© 2024 통합 중고거래 검색 - 모든 권리 보유</p>
      </footer>
    </div>
  );
}

export default App;

