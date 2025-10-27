const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');
// Puppeteer는 Vercel에서 작동하지 않으므로 조건부 로드
let puppeteer = null;
try {
  if (process.env.VERCEL !== '1') {
    puppeteer = require('puppeteer');
  }
} catch (err) {
  console.log('Puppeteer not available in this environment');
}
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// 브라우저 인스턴스 재사용을 위한 전역 변수
let globalBrowser = null;

// 간단한 메모리 캐시 (5분 TTL)
const cache = new Map();
const CACHE_TTL = 1 * 1000; // 5분

// 중고나라 카테고리 데이터
const joongnaCategories = {
  1: {
    name: "수입명품",
    subcategories: {
      101: { name: "여성신발", subcategories: { 1001: "구두/로퍼", 1002: "운동화/스니커즈", 1003: "샌들/슬리퍼", 1004: "워커/부츠" } },
      102: { name: "남성신발", subcategories: { 1005: "구두/로퍼", 1006: "운동화/스니커즈", 1007: "샌들/슬리퍼", 1008: "워커/부츠" } },
      103: { name: "가방/핸드백", subcategories: { 1009: "숄더백", 1010: "크로스백", 1011: "토트백", 1012: "백팩", 1013: "힙색/메신저백", 1014: "파우치/클러치백", 1015: "서류가방", 1016: "여행가방" } },
      104: { name: "지갑/벨트", subcategories: { 1017: "여성용지갑", 1018: "남성용지갑", 1019: "머니클립/명함/키지갑", 1020: "벨트/멜빵" } },
      105: { name: "여성의류", subcategories: { 1021: "자켓/코트", 1022: "패딩/야상/점퍼", 1023: "티셔츠/민소매/탑", 1024: "니트/스웨터/가디건", 1025: "블라우스/남방", 1026: "바지/데님", 1027: "스커트", 1028: "원피스/투피스", 1029: "언더웨어/수영복" } },
      106: { name: "남성의류", subcategories: { 1030: "자켓/코트", 1031: "패딩/야상/점퍼", 1032: "티셔츠/민소매", 1033: "니트/스웨터/가디건", 1034: "셔츠/남방", 1035: "바지/데님", 1036: "정장", 1037: "언더웨어/수영복" } },
      107: { name: "패션잡화", subcategories: { 1038: "모자", 1039: "넥타이", 1040: "장갑/손수건", 1041: "머플러/스카프", 1042: "선글라스/안경" } },
      108: { name: "시계/쥬얼리", subcategories: { 1043: "여성용시계", 1044: "남성용시계", 1045: "반지/목걸이/귀걸이", 1046: "팔찌/발찌" } },
      109: { name: "유아동", subcategories: { 1047: "영유아", 1048: "여아동복", 1049: "남아동복" } },
      110: { name: "기타 수입명품", subcategories: {} }
    }
  },
  2: {
    name: "패션의류",
    subcategories: {
      111: { name: "여성의류", subcategories: { 1050: "티셔츠/캐쥬얼의류", 1051: "니트/스웨터/가디건", 1052: "원피스/정장", 1053: "블라우스/셔츠/남방", 1054: "조끼/베스트", 1055: "바지/팬츠/청바지", 1056: "스커트/치마", 1057: "자켓/코트", 1058: "패딩/야상/점퍼", 1059: "트레이닝복", 1060: "언더웨어/잠옷", 1061: "파티복/드레스/기타" } },
      112: { name: "남성의류", subcategories: { 1062: "티셔츠/캐쥬얼의류", 1063: "니트/스웨터/가디건", 1064: "정장", 1065: "조끼/베스트", 1066: "셔츠/남방", 1067: "바지/팬츠/청바지", 1068: "자켓/코트", 1069: "패딩/야상/점퍼", 1070: "트레이닝복", 1071: "언더웨어/잠옷", 1072: "테마의상/기타" } },
      113: { name: "교복/체육복/단복", subcategories: {} },
      1339: { name: "클로젯셰어", subcategories: { 1341: "상의/하의", 1342: "원피스", 1343: "아우터" } }
    }
  },
  3: {
    name: "패션잡화",
    subcategories: {
      114: { name: "운동화", subcategories: { 1073: "런닝화/워킹화", 1074: "단화/캐쥬얼화", 1075: "기타운동화/관련용품" } },
      115: { name: "여성신발", subcategories: { 1076: "가보시/웨지힐/통굽", 1077: "펌프스/하이힐", 1078: "토오픈/오픈힐", 1079: "단화/로퍼", 1080: "워커/부츠/부티", 1081: "샌들/슬리퍼", 1082: "슬링백/뮬/블로퍼", 1083: "기타여성신발/관련용품" } },
      116: { name: "남성신발", subcategories: { 1084: "단화/로퍼/구두", 1085: "워커/부츠", 1086: "샌들/슬리퍼", 1087: "기타남성신발/관련용품" } },
      117: { name: "가방/핸드백", subcategories: { 1088: "숄더백", 1089: "크로스백", 1090: "토트백", 1091: "백팩", 1092: "힙색/세컨백", 1093: "파우치/클러치백", 1094: "서류가방", 1095: "여행가방", 1096: "기타가방/관련용품" } },
      118: { name: "지갑/벨트", subcategories: { 1097: "여성용지갑", 1098: "남성용지갑", 1099: "머니클립/명함/키지갑", 1100: "벨트/멜빵" } },
      119: { name: "악세서리/귀금속", subcategories: { 1101: "반지/귀걸이", 1102: "목걸이/팬던트", 1103: "팔찌/발찌", 1104: "순금/골드바/돌반지" } },
      120: { name: "시계", subcategories: { 1105: "여성용시계", 1106: "남성용시계" } },
      121: { name: "선글라스/안경", subcategories: { 1107: "선글라스", 1108: "안경/안경테" } },
      122: { name: "모자", subcategories: { 1109: "스냅백/야구모자", 1110: "패션/방한모자" } },
      123: { name: "기타잡화/관련용품", subcategories: {} }
    }
  },
  4: {
    name: "뷰티",
    subcategories: {
      124: { name: "스킨케어", subcategories: {} },
      125: { name: "메이크업", subcategories: { 1111: "베이스 메이크업", 1112: "아이 메이크업", 1113: "립 메이크업", 1114: "치크/하이라이터/쉐딩" } },
      126: { name: "팩/클렌징/필링", subcategories: {} },
      127: { name: "헤어/바디", subcategories: {} },
      128: { name: "향수", subcategories: {} },
      129: { name: "네일케어", subcategories: {} },
      130: { name: "남성 화장품", subcategories: {} },
      131: { name: "가발/기타용품", subcategories: {} }
    }
  },
  5: {
    name: "출산/유아동",
    subcategories: {
      132: { name: "출산/육아용품", subcategories: { 1115: "모유수유용품", 1116: "분유수유용품", 1117: "튼살크림/스킨케어", 1118: "임부복/수유복/언더웨어", 1119: "물티슈/기저귀", 1120: "분유/이유식", 1121: "아기띠/기저귀가방", 1122: "신생아/영유아의류", 1123: "유아로션/목욕용품", 1124: "유아건강/위생용품", 1125: "유모차/웨건" } },
      133: { name: "유아동안전/실내용품", subcategories: { 1126: "카시트", 1127: "놀이매트", 1128: "보행기/쏘서/바운서/부스터" } },
      134: { name: "유아동의류", subcategories: { 1129: "유아용의류", 1130: "아동용의류", 1131: "내의/잠옷/속옷", 1132: "패딩/자켓", 1133: "한복/소품" } },
      135: { name: "유아동잡화", subcategories: { 1134: "구두/운동화/샌들/부츠", 1135: "장화/우비/우산", 1136: "모자/장갑", 1137: "책가방/여행가방" } },
      136: { name: "유아동가구", subcategories: { 1138: "침대/매트리스", 1139: "옷장/서랍장", 1140: "책상/공부상/책장", 1141: "의자/소파/빈백" } },
      137: { name: "유아동교구/완구", subcategories: { 1142: "신생아완구", 1143: "원목교구", 1144: "음악놀이/자석교구", 1145: "전동차/핫휠", 1146: "로봇", 1147: "인형/디즈니의상", 1148: "블록/레고", 1149: "대형 완구용품" } },
      138: { name: "기타 유아동용품", subcategories: {} }
    }
  },
  6: {
    name: "모바일/태블릿",
    subcategories: {
      139: { name: "스마트폰", subcategories: { 1150: "삼성", 1151: "애플", 1152: "LG", 1153: "기타 제조사" } },
      140: { name: "태블릿PC", subcategories: { 1154: "삼성", 1155: "애플", 1156: "기타 제조사" } },
      141: { name: "스마트워치/밴드", subcategories: {} },
      142: { name: "일반/피쳐폰", subcategories: {} },
      143: { name: "케이스/거치대/보호필름", subcategories: {} },
      144: { name: "배터리/충전기/케이블", subcategories: {} },
      145: { name: "메모리/젠더/리더기", subcategories: {} }
    }
  },
  7: {
    name: "가전제품",
    subcategories: {
      147: { name: "냉장고", subcategories: {} },
      148: { name: "TV", subcategories: {} },
      149: { name: "세탁기/건조기", subcategories: {} },
      150: { name: "주방가전", subcategories: { 1157: "전기밥솥", 1158: "가스/전기레인지", 1159: "전자레인지/오븐/제빵기", 1160: "정수기/탄산수제조기", 1161: "커피기기", 1162: "살균기/세척기", 1163: "주방소형가전", 1164: "업소용주방가전" } },
      151: { name: "스마트홈", subcategories: { 1165: "인공지능 스피커", 1166: "360카메라/홈캠", 1167: "스마트 램프/플러그/스위치" } },
      152: { name: "영상가전", subcategories: { 1168: "영상플레이어", 1169: "프로젝터/스마트빔", 1170: "전자사전/PMP/DMB" } },
      153: { name: "음향가전", subcategories: { 1171: "이어폰/헤드폰", 1172: "스피커", 1173: "마이크", 1174: "음향플레이어", 1175: "오디오/홈시어터", 1176: "LP/턴테이블", 1177: "리시버/앰프", 1178: "보이스레코더" } },
      154: { name: "계절가전", subcategories: { 1179: "공기청정기/가습기/제습기", 1180: "히터/난방/온풍기", 1181: "전기/온수매트", 1182: "에어컨", 1183: "선풍기/냉풍기" } },
      155: { name: "생활가전", subcategories: { 1184: "청소기", 1185: "비데", 1186: "안마기/안마의자", 1187: "스탠드/조명", 1188: "다리미/미싱/보풀제거기", 1189: "도어록" } },
      156: { name: "미용가전", subcategories: { 1190: "드라이기/고데기", 1191: "면도기/제모기/이발기", 1192: "구강세정기/전동칫솔" } },
      157: { name: "기타 가전제품", subcategories: {} }
    }
  },
  8: {
    name: "노트북/PC",
    subcategories: {
      158: { name: "노트북/넷북", subcategories: { 1193: "삼성", 1194: "애플", 1195: "LG", 1196: "기타 제조사" } },
      159: { name: "데스크탑/본체", subcategories: { 1197: "일체형PC", 1198: "브랜드PC", 1199: "조립PC" } },
      160: { name: "모니터", subcategories: {} },
      161: { name: "CPU/메인보드", subcategories: {} },
      162: { name: "HDD/SSD/ODD", subcategories: {} },
      163: { name: "RAM/VGA/SOUND", subcategories: {} },
      164: { name: "USB/케이블", subcategories: {} },
      165: { name: "케이스/파워/쿨러", subcategories: {} },
      166: { name: "키보드/마우스/스피커", subcategories: {} },
      167: { name: "프린터/복합기/잉크/토너", subcategories: {} },
      168: { name: "공유기/랜카드", subcategories: {} },
      169: { name: "소프트웨어", subcategories: {} },
      170: { name: "기타 주변기기", subcategories: {} }
    }
  },
  9: {
    name: "카메라/캠코더",
    subcategories: {
      171: { name: "DSLR", subcategories: {} },
      172: { name: "미러리스", subcategories: {} },
      173: { name: "디지털카메라", subcategories: {} },
      174: { name: "필름/즉석카메라", subcategories: {} },
      175: { name: "캠코더/액션캠", subcategories: {} },
      176: { name: "기타 카메라", subcategories: {} },
      177: { name: "카메라렌즈", subcategories: {} },
      178: { name: "삼각대/조명/플래시", subcategories: {} },
      179: { name: "기타 악세서리", subcategories: {} }
    }
  },
  10: {
    name: "가구/인테리어",
    subcategories: {
      180: { name: "침실가구", subcategories: { 1200: "침대/매트리스", 1201: "서랍장/옷장", 1202: "화장대/협탁/거울" } },
      181: { name: "거실가구", subcategories: { 1203: "소파", 1204: "거실테이블/의자", 1205: "거실장/장식장" } },
      182: { name: "주방가구", subcategories: { 1206: "식탁/식탁의자", 1207: "렌지대/수납장", 1208: "기타 주방가구" } },
      183: { name: "수납/선반/공간박스", subcategories: {} },
      184: { name: "학생/서재/사무용가구", subcategories: {} },
      185: { name: "기타가구", subcategories: {} },
      186: { name: "침구", subcategories: {} },
      187: { name: "커튼/카페트", subcategories: {} },
      188: { name: "조명/무드등", subcategories: {} },
      189: { name: "인테리어소품", subcategories: {} },
      190: { name: "이벤트/파티용품", subcategories: {} },
      191: { name: "디퓨저/캔들", subcategories: {} },
      192: { name: "시계/액자/팝아트", subcategories: {} },
      193: { name: "원예", subcategories: {} }
    }
  },
  11: {
    name: "리빙/생활",
    subcategories: {
      194: { name: "주방용품", subcategories: { 1209: "조리도구", 1210: "식기/컵/텀블러", 1211: "밀폐용기", 1212: "주방잡화" } },
      195: { name: "식품", subcategories: {} },
      196: { name: "욕실용품", subcategories: {} },
      197: { name: "청소/세탁용품", subcategories: {} },
      198: { name: "생활잡화", subcategories: {} },
      199: { name: "기타 생활용품", subcategories: {} },
      246: { name: "차량용품", subcategories: { 1325: "휠/타이어", 1326: "블랙박스/네비게이션", 1327: "카오디오/카시트", 1328: "기타 부품/용품" } }
    }
  },
  12: {
    name: "게임",
    subcategories: {
      200: { name: "PC게임", subcategories: {} },
      201: { name: "플레이스테이션", subcategories: {} },
      202: { name: "PSP", subcategories: {} },
      203: { name: "닌텐도", subcategories: {} },
      204: { name: "Wii", subcategories: {} },
      205: { name: "XBOX", subcategories: {} },
      206: { name: "게임타이틀", subcategories: {} },
      207: { name: "기타 게임", subcategories: {} }
    }
  },
  13: {
    name: "반려동물/취미",
    subcategories: {
      208: { name: "반려동물", subcategories: { 1213: "강아지용품", 1214: "고양이용품", 1215: "관상어용품", 1216: "기타 반려동물 용품" } },
      209: { name: "키덜트", subcategories: { 1217: "피규어/브릭", 1218: "프라모델", 1219: "레고/조립/블록", 1220: "무선조종/드론/헬리캠" } },
      210: { name: "핸드메이드/DIY", subcategories: { 1221: "자수/뜨개질", 1222: "뷰티/아로마/캔들", 1223: "아트북/스크래치북", 1224: "DIY/공예" } },
      211: { name: "악기", subcategories: { 1225: "건반악기", 1226: "현악기", 1227: "관악기/타악기" } },
      212: { name: "예술작품/골동품/수집", subcategories: {} },
      213: { name: "미술재료/미술도구", subcategories: {} }
    }
  },
  14: {
    name: "도서/음반/문구",
    subcategories: {
      214: { name: "유아동도서/음반", subcategories: { 1228: "0-3세", 1229: "4-7세", 1230: "8-9세", 1231: "10-13세", 1232: "그림/놀이/만화책", 1233: "학습/전집", 1234: "음반/DVD" } },
      215: { name: "학습/교육", subcategories: { 1235: "학습/참고서", 1236: "수험서/자격증", 1237: "컴퓨터/인터넷", 1238: "국어/외국어", 1239: "대학교재", 1240: "인터넷강의", 1241: "백과사전/전집", 1242: "기타 학습도서" } },
      216: { name: "소설/만화책", subcategories: { 1243: "소설책", 1244: "만화책" } },
      217: { name: "여행/취미/레저", subcategories: { 1245: "여행/레저도서", 1246: "취미도서" } },
      218: { name: "문학/과학/경영", subcategories: { 1247: "문학도서", 1248: "과학도서", 1249: "경영도서" } },
      219: { name: "예술/디자인", subcategories: {} },
      220: { name: "잡지", subcategories: {} },
      221: { name: "기타 도서", subcategories: {} },
      222: { name: "음반/DVD/굿즈", subcategories: { 1250: "CD", 1251: "DVD", 1252: "LP/기타음반", 1253: "스타굿즈" } },
      223: { name: "문구/사무용품", subcategories: {} }
    }
  },
  15: {
    name: "티켓/쿠폰",
    subcategories: {
      224: { name: "티켓", subcategories: { 1254: "콘서트", 1255: "스포츠", 1256: "뮤지컬/연극/클래식" } },
      225: { name: "상품권/쿠폰", subcategories: { 1257: "백화점/마트/편의점", 1258: "영화/문화/게임", 1259: "외식/주유" } },
      226: { name: "여행숙박/이용권", subcategories: {} },
      227: { name: "기타 티켓/쿠폰/이용권", subcategories: {} }
    }
  },
  16: {
    name: "스포츠",
    subcategories: {
      228: { name: "골프", subcategories: { 1260: "드라이버", 1261: "우드/유틸리티", 1262: "아이언", 1263: "웨지/퍼터", 1264: "골프백/풀세트", 1265: "골프의류/골프화", 1266: "볼/용품/기타" } },
      229: { name: "자전거", subcategories: { 1267: "하이브리드/픽시/미니벨로", 1268: "로드바이크/사이클", 1269: "산악자전거", 1270: "전기자전거", 1271: "유아/아동자전거", 1272: "특수자전거", 1273: "자전거용품", 1274: "부품/부속/공구", 1275: "악세서리/기타용품" } },
      230: { name: "인라인/스케이트/전동", subcategories: { 1276: "인라인/스케이트용품", 1277: "스케이트보드용품", 1278: "전기/전동레저용품" } },
      231: { name: "축구", subcategories: { 1279: "축구의류/축구화", 1280: "축구공/용품" } },
      232: { name: "야구", subcategories: { 1281: "야구의류/야구화", 1282: "야구공/용품" } },
      233: { name: "농구", subcategories: { 1283: "농구의류/농구화", 1284: "농구공/용품" } },
      234: { name: "라켓스포츠", subcategories: { 1285: "배드민턴의류/용품", 1286: "테니스의류/용품", 1287: "스쿼시의류/용품", 1288: "탁구의류/용품" } },
      235: { name: "헬스/요가", subcategories: { 1289: "헬스기구", 1290: "헬스용품", 1291: "요가/필라테스용품", 1292: "보충/보조제" } },
      236: { name: "수상스포츠", subcategories: { 1293: "비키니/여성수영복", 1294: "남성수영복", 1295: "웨이크바지/래쉬가드", 1296: "아동용의류/용품", 1297: "스쿠버/다이빙용품" } },
      237: { name: "겨울스포츠", subcategories: { 1298: "스키/보드의류", 1299: "스키/보드장비", 1300: "아동용스키/보드" } },
      238: { name: "검도/격투/권투", subcategories: { 1301: "도복", 1302: "검도/격투/권투용품" } },
      239: { name: "기타 스포츠", subcategories: {} },
      1347: { name: "라브인증 자전거", subcategories: { 1344: "로드자전거", 1345: "MTB/그래블" } }
    }
  },
  17: {
    name: "레저/여행",
    subcategories: {
      240: { name: "등산의류/용품", subcategories: { 1303: "남성 등산의류", 1304: "여성 등산의류", 1305: "등산화/배낭/장비", 1306: "기타 등산용품" } },
      241: { name: "캠핑용품", subcategories: { 1307: "텐트/침낭", 1308: "취사용품/장비", 1309: "기타 캠핑용품" } },
      242: { name: "낚시용품", subcategories: {} },
      243: { name: "기타 레저/여행용품", subcategories: {} }
    }
  },
  19: {
    name: "오토바이",
    subcategories: {
      247: { name: "125cc 이하", subcategories: {} },
      248: { name: "125cc 초과", subcategories: {} },
      249: { name: "오토바이 용품", subcategories: {} },
      1329: { name: "신차", subcategories: {} }
    }
  },
  20: {
    name: "공구/산업용품",
    subcategories: {
      250: { name: "드릴/전동공구", subcategories: {} },
      251: { name: "에어/유압", subcategories: {} },
      252: { name: "작업공구", subcategories: {} },
      253: { name: "측정공구", subcategories: {} },
      254: { name: "초경/절삭/접착윤활", subcategories: {} },
      255: { name: "전기/전자", subcategories: {} },
      256: { name: "배관설비/포장운송", subcategories: {} },
      257: { name: "금형공작", subcategories: {} },
      258: { name: "용접기자재", subcategories: {} },
      259: { name: "산업/안전/공구함", subcategories: {} },
      260: { name: "산업자재", subcategories: {} },
      261: { name: "농기계/농업용공구", subcategories: {} }
    }
  },
  21: {
    name: "무료나눔",
    subcategories: {}
  },
  1348: {
    name: "중고차",
    subcategories: {
      1349: { name: "국산차", subcategories: { 1351: "제네시스", 1352: "현대", 1353: "기아", 1354: "쉐보레(GM대우)", 1355: "르노", 1356: "KGM", 1357: "기타 국산차" } },
      1350: { name: "수입차", subcategories: { 1358: "BMW", 1359: "벤츠", 1360: "아우디", 1361: "폭스바겐", 1362: "미니", 1363: "렉서스", 1364: "도요타", 1365: "기타 수입차" } }
    }
  }
};

// 브라우저 초기화
async function initBrowser() {
  if (!puppeteer) {
    console.log('Puppeteer not available - skipping browser initialization');
    return null;
  }
  if (!globalBrowser) {
    globalBrowser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--no-first-run',
        '--disable-blink-features=AutomationControlled',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ]
    });
  }
  return globalBrowser;
}

// 서버 시작 시 네이버 카테고리 미리 로딩
async function preloadNaverCategories() {
  try {
    console.log('서버 시작 - 네이버 카페 카테고리 미리 로딩 중...');
    const result = await fetchNaverCafeCategories();
    if (result.success) {
      // 캐시에 저장
      naverCategoriesCache = {
        data: result,
        timestamp: Date.now(),
        ttl: naverCategoriesCache.ttl
      };
      console.log(`✅ 네이버 카페 카테고리 ${result.totalCount}개 미리 로딩 완료`);
    } else {
      console.error('❌ 네이버 카페 카테고리 미리 로딩 실패:', result.error);
    }
  } catch (error) {
    console.error('❌ 네이버 카페 카테고리 미리 로딩 오류:', error.message);
  }
}

// 서버 종료시 브라우저 정리
process.on('SIGINT', async () => {
  if (globalBrowser && puppeteer) {
    await globalBrowser.close();
  }
  process.exit();
});

// 미들웨어
app.use(cors());
app.use(express.json());

// 중고나라 빌드 ID 캐시
let joongnaBuildIdCache = {
  buildId: null,
  lastFetched: null,
  ttl: 30 * 60 * 1000 // 30분 TTL
};

// 중고나라 빌드 ID 추출 함수
async function getJoongnaBuildId() {
  try {
    // 캐시된 빌드 ID가 있고 TTL이 유효하면 사용
    if (joongnaBuildIdCache.buildId && 
        joongnaBuildIdCache.lastFetched && 
        (Date.now() - joongnaBuildIdCache.lastFetched) < joongnaBuildIdCache.ttl) {
      console.log('중고나라 빌드 ID 캐시 사용:', joongnaBuildIdCache.buildId);
      return joongnaBuildIdCache.buildId;
    }

    console.log('중고나라 메인 페이지에서 빌드 ID 추출 중...');
    const response = await axios.get('https://web.joongna.com/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 10000
    });

    // HTML에서 _next/static/xxx/_buildManifest.js 또는 buildId를 찾기
    const html = response.data;
    
    // 방법 1: _next/static/{buildId}/ 패턴 찾기
    const buildIdMatch = html.match(/_next\/static\/([^\/]+)\/_buildManifest\.js/);
    if (buildIdMatch && buildIdMatch[1]) {
      const buildId = buildIdMatch[1];
      console.log('중고나라 빌드 ID 추출 성공:', buildId);
      
      // 캐시에 저장
      joongnaBuildIdCache.buildId = buildId;
      joongnaBuildIdCache.lastFetched = Date.now();
      
      return buildId;
    }

    // 방법 2: __NEXT_DATA__ 스크립트에서 buildId 찾기
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.+?)<\/script>/);
    if (nextDataMatch && nextDataMatch[1]) {
      try {
        const nextData = JSON.parse(nextDataMatch[1]);
        if (nextData.buildId) {
          const buildId = nextData.buildId;
          console.log('중고나라 빌드 ID 추출 성공 (NEXT_DATA):', buildId);
          
          // 캐시에 저장
          joongnaBuildIdCache.buildId = buildId;
          joongnaBuildIdCache.lastFetched = Date.now();
          
          return buildId;
        }
      } catch (parseError) {
        console.error('NEXT_DATA 파싱 오류:', parseError);
      }
    }

    throw new Error('빌드 ID를 찾을 수 없습니다');
    
  } catch (error) {
    console.error('중고나라 빌드 ID 추출 실패:', error.message);
    
    // 캐시된 빌드 ID가 있으면 사용 (TTL 무시)
    if (joongnaBuildIdCache.buildId) {
      console.log('오류 발생, 캐시된 빌드 ID 사용:', joongnaBuildIdCache.buildId);
      return joongnaBuildIdCache.buildId;
    }
    
    // 기본값으로 폴백 (최신 알려진 빌드 ID)
    console.log('기본 빌드 ID 사용');
    return '9wVw4ZsKe7pgOCBw1WW-Y';
  }
}

// 중고나라 검색 API
async function searchJoongna(query, filters = {}, page = 0) {
  try {
    const encodedQuery = encodeURIComponent(query);
    
    // 동적으로 빌드 ID 가져오기
    const buildId = await getJoongnaBuildId();
    
    // Next.js 데이터 API URL (동적 빌드 ID 사용)
    const url = `https://web.joongna.com/_next/data/${buildId}/search/${encodedQuery}.json`;
    
    const params = {
      keyword: query, // 검색어
      keywordSource: 'INPUT_KEYWORD',
      productFilterType: 'APP' // 앱상품으로 고정 (네이버카페와 중복 방지)
    };

    // 중고나라 카테고리 필터 추가 (명시적으로 지정된 경우에만)
    if (filters.joongnaCategoryId) {
      params.category = parseInt(filters.joongnaCategoryId);
      console.log('중고나라 카테고리 필터 적용:', filters.joongnaCategoryId, '→', parseInt(filters.joongnaCategoryId));
    }
    // 기본 카테고리는 설정하지 않음 (전체 카테고리 검색)

    // 판매완료 상품 포함 여부 - 공통 판매상태 필터 사용
    console.log('중고나라 필터 상태:', { onSale: filters.onSale, includeSoldOut: filters.includeSoldOut });
    
    // includeSoldOut이 true이면 판매완료 상품 포함
    // 그렇지 않으면 판매완료 상품 제외
    if (filters.includeSoldOut === true) {
      params.saleYn = 'SALE_Y'; // 판매완료 상품 포함
      console.log('중고나라: 판매완료 상품 포함 (SALE_Y)');
    } else {
      params.saleYn = 'SALE_N'; // 판매완료 상품 제외
      console.log('중고나라: 판매완료 상품 제외 (SALE_N)');
    }

    // 정렬 옵션 (기본: 추천순)
    const sortMapping = {
      'RECOMMEND': 'RECOMMEND_SORT',
      'RECENT': 'RECENT_SORT',
      'PRICE_ASC': 'PRICE_ASC_SORT',
      'PRICE_DESC': 'PRICE_DESC_SORT'
    };
    
    const sortValue = sortMapping[filters.sort] || 'RECOMMEND_SORT';
    params.sort = sortValue;
    

    // 페이지 정보
    if (page > 0) {
      params.page = page;
    }

    // 가격 필터
    if (filters.minPrice || filters.maxPrice) {
      const priceFilter = {
        minPrice: filters.minPrice || 0,
        maxPrice: filters.maxPrice || 100000000
      };
      // 중고나라는 priceFilter를 JSON 문자열로 전달할 수도 있음
      if (filters.minPrice) params.minPrice = filters.minPrice;
      if (filters.maxPrice) params.maxPrice = filters.maxPrice;
    }

    // 배송비 필터는 API 파라미터로 전달하지 않고 응답 후 클라이언트에서 필터링
    // parcelFee: 0 = 무료배송, 1 = 배송비 별도

    console.log('중고나라 API 요청:', { url, params });
    console.log('중고나라 최종 saleYn 설정:', params.saleYn);
    
    // 카테고리 필터 디버깅
    if (filters.joongnaCategoryId) {
      console.log('🔍 중고나라 카테고리 필터 디버깅:');
      console.log('  - 원본 카테고리 ID:', filters.joongnaCategoryId);
      console.log('  - 설정된 category 파라미터:', params.category);
      console.log('  - 최종 요청 URL:', url + '?' + new URLSearchParams(params).toString());
    }
    
    const response = await axios.get(url, { 
      params,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
        'Referer': 'https://web.joongna.com/'
      },
      timeout: 10000
    });

    if (response.data && response.data.pageProps && response.data.pageProps.dehydratedState) {
      const queries = response.data.pageProps.dehydratedState.queries;
      // 실제 응답에서는 'get-search-category-products'를 사용
      const searchQuery = queries.find(q => q.queryKey[0] === 'get-search-category-products' || q.queryKey[0] === 'get-search-products');
      
      if (searchQuery && searchQuery.state && searchQuery.state.data) {
        const data = searchQuery.state.data.data;
        
        if (data && data.items) {
          let products = data.items.map(item => ({
            title: item.title,
            link: `https://web.joongna.com/product/${item.seq}`,
            price: `${item.price?.toLocaleString()}원` || '가격 정보 없음',
            image: item.url || null,
            cafe: '중고나라',
            source: '중고나라',
            region: item.mainLocationName || (item.locationNames && item.locationNames[0]) || '',
            date: item.sortDate,
            timestamp: item.sortDate ? new Date(item.sortDate).getTime() : 0, // 통합 정렬용 타임스탬프
            // 중고나라 관련 필드들
            wishCount: item.wishCount || 0,
            chatCount: item.chatCount || 0,
            parcelFee: item.parcelFee, // 0: 무료배송, 1: 배송비 별도
            state: item.state, // 0: 판매중, 1: 예약중, 2: 예약중, 3: 판매완료
            platform: '중고나라'
          }));

          // 배송비 필터 적용 (parcelFee: 0 = 무료배송, 1 = 배송비 별도)
          if (filters.parcelFeeYn === true) {
            // 무료배송만 (parcelFee가 0인 것만)
            products = products.filter(product => product.parcelFee === 0);
            console.log('중고나라: 무료배송 상품만 필터링 적용');
          }
          // filters.parcelFeeYn === false 또는 undefined면 전체 (필터링 안함)
          // 체크 해제 시 무료배송 + 배송비별도 모두 표시

          return {
            success: true,
            data: {
              products,
              totalCount: data.totalSize || 0,
              currentPage: page,
              hasMore: data.items.length === 80, // 80개를 다 가져왔으면 더 있을 수 있음
              platform: '중고나라'
            }
          };
        }
      }
    }

    return {
      success: false,
      error: '검색 결과를 찾을 수 없습니다.',
      data: { products: [], totalCount: 0, currentPage: page, hasMore: false, platform: '중고나라' }
    };

  } catch (error) {
    console.error('중고나라 검색 오류:', error.message);
    return {
      success: false,
      error: error.message,
      data: { products: [], totalCount: 0, currentPage: page, hasMore: false, platform: '중고나라' }
    };
  }
}

// 네이버 카페 검색 - 공식 API 사용
async function searchNaverCafe(query, filters = {}, page = 1) {
  // 캐시 확인 (페이지별로 캐시)
  const cacheKey = `navercafe_${query}_${JSON.stringify(filters)}_page${page}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`네이버 카페 캐시에서 "${query}" 결과 반환`);
    return cached.data;
  }

  try {
    console.log(`네이버 카페 API에서 "${query}" 검색 중...`);

    // API URL 및 파라미터 구성
    const apiUrl = 'https://apis.naver.com/cafe-web/cafe-search-api/v6.0/trade-search/all';
    const params = new URLSearchParams({
      recommendKeyword: 'true',
      query: query,
      page: page.toString(),
      size: '50', // 페이지당 결과 수
      deliveryTypes: '' // v6.0에서 필요한 파라미터
    });

    // 카테고리 필터 추가
    if (filters.categoryId && filters.categoryId !== '0' && filters.categoryId !== '') {
      params.append('categoryId', filters.categoryId);
      console.log(`네이버 카페 카테고리 필터 적용: ${filters.categoryId}`);
    }

    // 판매상태 필터 (transactionStatuses) - v6.0에서는 조건부로만 추가
    const transactionStatuses = [];
    if (filters.onSale) transactionStatuses.push('ON_SALE');
    if (filters.includeSoldOut) {
      // 판매완료 포함이 선택되면 예약중과 판매완료 둘 다 포함
      transactionStatuses.push('RESERVED');
      transactionStatuses.push('COMPLETED');
    }
    // v6.0에서는 특정 필터가 선택된 경우에만 transactionStatuses 추가
    if (transactionStatuses.length > 0 && (filters.onSale || filters.includeSoldOut)) {
      params.append('transactionStatuses', transactionStatuses.join(','));
    }

    // 정렬 옵션 (searchOrderParamType)
    let sortOrder = 'DEFAULT'; // 기본값: 관련성
    if (filters.sort) {
      const sortMap = {
        'RECOMMEND': 'DEFAULT',        // 추천순 (관련성)
        'RECENT': 'DATE_DESC',         // 최신순
        'PRICE_ASC': 'COST_ASC',       // 낮은 가격순
        'PRICE_DESC': 'COST_DESC',     // 높은 가격순
        // 기존 형식도 지원 (하위 호환)
        'RECENT_SORT': 'DATE_DESC',    
        'PRICE_ASC_SORT': 'COST_ASC',  
        'PRICE_DESC_SORT': 'COST_DESC' 
      };
      sortOrder = sortMap[filters.sort] || 'DEFAULT';
    }
    params.append('searchOrderParamType', sortOrder);
    
    console.log(`네이버 카페 정렬 설정: ${filters.sort} -> ${sortOrder}`);

    // 결제방법 필터 (escrows)
    const escrows = [];
    if (filters.directPay) escrows.push('DIRECT');
    if (filters.escrowPay) escrows.push('ESCROW');
    if (escrows.length > 0) {
      params.append('escrows', escrows.join(','));
    }

    // 배송방법 필터 (deliveryTypes)
    const deliveryTypes = [];
    if (filters.meetTrade) deliveryTypes.push('MEET');
    if (filters.deliveryTrade) deliveryTypes.push('DELIVERY');
    if (filters.onlineTrade) deliveryTypes.push('ONLINE');
    if (deliveryTypes.length > 0) {
      params.append('deliveryTypes', deliveryTypes.join(','));
    }

    // 가격 필터 (cost.min: 최소가격, cost.max: 최대가격)
    if (filters.minPrice) {
      params.append('cost.min', filters.minPrice.toString());
    }
    if (filters.maxPrice) {
      params.append('cost.max', filters.maxPrice.toString());
    }

    // 등록기간 필터 (writeTime.min, writeTime.max)
    if (filters.registrationPeriod && filters.registrationPeriod !== 'ALL') {
      const now = new Date();
      let startDate;
      
      switch (filters.registrationPeriod) {
        case '1D': // 1일
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case '1W': // 1주일
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '1M': // 1개월
          startDate = new Date(now);
          startDate.setMonth(startDate.getMonth() - 1);
          break;
        case '3M': // 3개월
          startDate = new Date(now);
          startDate.setMonth(startDate.getMonth() - 3);
          break;
        default:
          startDate = null;
      }
      
      if (startDate) {
        // 네이버 카페 API 날짜 형식: YYYYMMDDHHMMSS
        const formatDate = (date) => {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          const hours = String(date.getHours()).padStart(2, '0');
          const minutes = String(date.getMinutes()).padStart(2, '0');
          const seconds = String(date.getSeconds()).padStart(2, '0');
          return `${year}${month}${day}${hours}${minutes}${seconds}`;
        };
        
        params.append('writeTime.min', formatDate(startDate));
        params.append('writeTime.max', formatDate(now));
        
        console.log(`네이버 카페 등록기간 필터: ${filters.registrationPeriod} (${formatDate(startDate)} ~ ${formatDate(now)})`);
      }
    }

    console.log(`네이버 카페 API URL: ${apiUrl}?${params.toString()}`);

    // API 호출
    const response = await axios.get(apiUrl, {
      params: Object.fromEntries(params),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
        'Referer': 'https://cafe.naver.com/',
        'Origin': 'https://cafe.naver.com'
      },
      timeout: 10000
    });

    const data = response.data;
    
    // API 응답에서 결과 추출
    const results = [];
    if (data.result && data.result.tradeArticleList) {
      data.result.tradeArticleList.forEach((article, index) => {
        try {
          const item = article.item;
          if (!item) return;

          // 기본 정보 추출
          const title = item.subject || '';
          
          // 링크 생성 (타입에 따라 다르게 처리)
          let link = '';
          if (article.type === 'NFLEA_TRADE_ARTICLE' && item.marketProductId) {
            // NFLEA 상품의 경우 네이버 플리마켓 링크
            link = `https://fleamarket.naver.com/market-products/${item.marketProductId}`;
          } else if (item.cafeUrl && item.articleId) {
            // 일반 카페 글의 경우 기존 방식
            link = `https://cafe.naver.com/${item.cafeUrl}/${item.articleId}`;
          } else {
            // 대체 링크 (cafeId와 articleId 사용)
            link = `https://cafe.naver.com/ArticleRead.nhn?clubid=${item.cafeId}&articleid=${item.articleId}`;
          }
          
          const cafeName = item.mobileCafeName || item.cafeName || '네이버 카페';
          
          // 판매상태 정보
          let saleStatusText = '';
          if (item.productSale && item.productSale.saleStatus) {
            const statusMap = {
              'ON_SALE': '판매중',
              'RESERVED': '예약중', 
              'COMPLETED': '판매완료'
            };
            saleStatusText = statusMap[item.productSale.saleStatus] || '';
          }

          // 가격 정보 (productSale에서 추출)
          let price = '가격 정보 없음';
          let isSafePayment = false;
          if (item.productSale) {
            const cost = item.productSale.cost;
            if (cost && cost !== 999999) {  // 999999는 가격협의를 의미
              price = `${cost.toLocaleString()}원`;
            } else {
              price = '가격협의';
            }
            
            // 안전결제 여부 확인
            isSafePayment = item.productSale.escrow === true;
          }

          // 이미지 URL
          let image = item.thumbnailImageUrl || 'https://via.placeholder.com/200x200';

          // 지역 정보
          let region = '';
          if (item.productSale && item.productSale.regionList && item.productSale.regionList.length > 0) {
            const regionInfo = item.productSale.regionList[0];
            region = `${regionInfo.regionName1} ${regionInfo.regionName2}`;
          }

          // 배송 방법 (온라인전송 제외)
          let delivery = '';
          if (item.productSale && item.productSale.deliveryTypeList) {
            const deliveryMap = {
              'MEET': '직거래',
              'DELIVERY': '택배'
            };
            const filteredDeliveryTypes = item.productSale.deliveryTypeList
              .filter(type => type !== 'ONLINE') // 온라인전송 제외
              .map(type => deliveryMap[type] || type);
            
            if (filteredDeliveryTypes.length > 0) {
              delivery = filteredDeliveryTypes.join(', ');
            }
          }

          // 작성일시
          let date = '';
          let timestamp = 0;
          if (item.writeTime) {
            const writeDate = new Date(item.writeTime);
            date = writeDate.toLocaleDateString('ko-KR');
            timestamp = writeDate.getTime(); // 타임스탬프 (밀리초)
          }

          // 상품 상태
          let productCondition = '';
          if (item.productSale && item.productSale.productCondition) {
            const conditionMap = {
              'NEW': '새상품',
              'ALMOST_NEW': '거의새것',
              'USED': '중고'
            };
            productCondition = conditionMap[item.productSale.productCondition] || '';
          }

          if (title && title.length > 2) {
            results.push({
              title: title,
              link: link,
              price: price,
              image: image,
              cafe: cafeName,
              source: '네이버 카페',
              region: region,
              delivery: delivery,
              date: date,
              timestamp: timestamp,
              imageCount: item.attachImageCount || 0,
              isSafePayment: isSafePayment,
              saleStatus: saleStatusText,
              productCondition: productCondition,
              type: article.type  // NFLEA_TRADE_ARTICLE 등의 타입 정보
            });
          }
        } catch (itemError) {
          console.log(`네이버 카페 API 아이템 ${index} 파싱 오류:`, itemError);
        }
      });
    }

    console.log(`네이버 카페 API에서 ${results.length}개 결과 찾음 (v6.0)`);
    
    // 결과 캐싱
    cache.set(cacheKey, {
      data: results,
      timestamp: Date.now()
    });
    
    return results;

  } catch (error) {
    console.error('네이버 카페 API 호출 오류:', error);
    console.error('오류 상세:', {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText
    });
    
    // API 호출 실패시 빈 배열 반환
    return [];
  }
}

// 골마켓 카테고리 정의
const golmarketCategories = {
  22: '드라이버',
  23: '아이언',
  24: '우드/유틸리티',
  25: '웨지',
  183: '퍼터',
  30: '여성용 클럽',
  32: '왼손 클럽',
  258: '골프백',
  259: '골프화/의류',
  26: '볼/기타 골프용품',
  37: '풀세트',
  44: '헤드/샤프트',
  792: '일반의류/신발',
  1109: '파크골프',
  50: '바꿔쓰고싶어요!',
  644: '골프연습장/스크린이용권',
  555: '무료나눔',
  233: '짝퉁구별(안전거래권장!)'
};

// 골마켓 검색 함수
async function searchGolmarket(query, filters = {}, page = 1) {
  // 캐시 확인
  const cacheKey = `golmarket_${query}_${JSON.stringify(filters)}_page${page}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`골마켓 캐시에서 "${query}" 결과 반환`);
    return cached.data;
  }

  try {
    console.log(`골마켓 API에서 "${query}" 검색 중...`);
    
    // 골마켓 카테고리 필터가 있는 경우
    const menuId = filters.golmarketCategoryId || 22; // 기본값: 드라이버
    
    // API URL (cafe-search-api 사용)
    const apiUrl = `https://apis.naver.com/cafe-web/cafe-search-api/v1.0/cafes/14940923/search/articles`;
    const params = new URLSearchParams({
      query: query, // 검색어
      perPage: '50', // 페이지당 개수
      page: page.toString(),
      menuId: menuId.toString(),
      views: 'MEMBER_LEVEL,COUNT,SALE_INFO,CAFE_MENU'
    });

    console.log(`골마켓 API URL: ${apiUrl}?${params.toString()}`);

    // API 호출
    const response = await axios.get(apiUrl, {
      params: Object.fromEntries(params),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
        'Referer': 'https://cafe.naver.com/',
        'Origin': 'https://cafe.naver.com'
      },
      timeout: 10000
    });

    const data = response.data;
    
    // API 응답에서 결과 추출
    const results = [];
    if (data.result && data.result.articleList) {
      data.result.articleList.forEach((article, index) => {
        try {
          const item = article.item;
          if (!item || article.type !== 'ARTICLE') return;

          // 기본 정보 추출
          const title = item.subject || '';
          const link = `https://cafe.naver.com/golmarket/${item.articleId}`;
          const cafeName = '골마켓';
          
          // 이미지 (thumbnailImageUrl 사용)
          let imageUrl = null;
          if (item.thumbnailImageUrl) {
            // 네이버 카페 이미지 URL 완성
            imageUrl = item.thumbnailImageUrl.startsWith('http') 
              ? item.thumbnailImageUrl 
              : `https://cafeptthumb-phinf.pstatic.net${item.thumbnailImageUrl}`;
          }
          
          // 작성 시간 (addDate 파싱)
          let timestamp = Date.now();
          if (item.addDate) {
            timestamp = new Date(item.addDate).getTime();
          }
          
          // 조회수
          const readCount = item.readCount || 0;
          
          // 댓글 수
          const commentCount = item.commentCount || 0;
          
          // 좋아요 수
          const likeCount = item.likeCount || item.likeItCount || 0;

          // 작성자 정보
          const nickName = item.writerInfo?.nickname || '익명';
          
          // 판매 상태
          const saleStatus = item.headName || '판매중';

          results.push({
            title,
            link,
            price: '가격문의', // 골마켓은 가격 정보가 별도로 없음
            image: imageUrl,
            cafe: cafeName,
            source: '골마켓',
            timestamp,
            date: new Date(timestamp).toLocaleDateString('ko-KR'),
            region: nickName,
            saleStatus: saleStatus,
            imageCount: item.attachImage ? (item.imageAttachCount || 1) : 0,
            platform: '골마켓'
          });
        } catch (err) {
          console.error('골마켓 결과 파싱 오류:', err);
        }
      });
    }

    console.log(`골마켓에서 ${results.length}개 결과 찾음`);

    // 캐시에 저장
    cache.set(cacheKey, {
      data: results,
      timestamp: Date.now()
    });

    return results;
  } catch (error) {
    console.error('골마켓 검색 오류:', error.message);
    
    // API 호출 실패시 빈 배열 반환
    return [];
  }
}

// 번개장터 정렬 순서 매핑 함수
function getBunjangSortOrder(sort) {
  const sortMap = {
    'RECOMMEND': 'score',       // 추천순 (정확도)
    'RECENT': 'date',           // 최신순
    'PRICE_ASC': 'price_asc',   // 낮은 가격순 (저가순)
    'PRICE_DESC': 'price_desc', // 높은 가격순 (고가순)
    // 기존 형식도 지원 (하위 호환)
    'RECENT_SORT': 'date',      
    'PRICE_ASC_SORT': 'price_asc',  
    'PRICE_DESC_SORT': 'price_desc', 
    'POPULAR_SORT': 'score'     
  };
  return sortMap[sort] || 'score'; // 기본값: 정확도순
}

// 번개장터 검색 - 실제 API 사용 (필터 지원)
async function searchBunjang(query, filters = {}, page = 1) {
  // 캐시 확인 (페이지별로 캐시)
  const cacheKey = `bunjang_${query}_${JSON.stringify(filters)}_page${page}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`번개장터 캐시에서 "${query}" 결과 반환`);
    return cached.data;
  }

  try {
    console.log(`번개장터 API에서 "${query}" 검색 중...`);
    
    // API URL 및 파라미터 구성
    const apiUrl = 'https://api.bunjang.co.kr/api/1/find_v2.json';
    const params = new URLSearchParams({
      q: query,
      order: getBunjangSortOrder(filters.sort), // 정렬 순서
      page: (page - 1).toString(), // 페이지는 0부터 시작
      stat_device: 'w', // 웹 버전
      stat_category_required: '1',
      req_ref: 'search',
      version: '5'
    });

    // 번개장터 카테고리 필터 적용
    if (filters.bunjangCategoryId) {
      params.append('f_category_id', filters.bunjangCategoryId);
      console.log('번개장터 카테고리 필터 적용:', filters.bunjangCategoryId);
    }

    // 기존 공통 카테고리 매핑 제거됨 - 플랫폼별 전용 카테고리만 사용

    // 가격 필터
    if (filters.minPrice) {
      params.append('f_price_min', filters.minPrice.toString());
    }
    if (filters.maxPrice) {
      params.append('f_price_max', filters.maxPrice.toString());
    }

    // 번개장터는 기본적으로 판매완료 상품을 제외하고 반환함
    // API 레벨에서 status 필터링을 지원하지 않으므로 클라이언트 사이드에서 처리

    // 상품 상태 필터 (새상품/중고)
    if (filters.newItem || filters.usedItem) {
      const usedFilters = [];
      if (filters.newItem) usedFilters.push('2'); // 새상품
      if (filters.usedItem) usedFilters.push('1'); // 중고
      if (usedFilters.length > 0) {
        params.append('used', usedFilters.join(','));
      }
    }

    // 번개장터는 API 레벨에서 무료배송/검수 필터를 지원하지 않음
    // 대신 응답 후 클라이언트 사이드에서 필터링 처리
    // API 파라미터로는 전달하지 않고, 응답 데이터를 기반으로 필터링

    console.log(`번개장터 API URL: ${apiUrl}?${params.toString()}`);
    console.log('번개장터 필터 상태:', {
      freeShipping: filters.freeShipping,
      inspection: filters.inspection,
      bunjangCategoryId: filters.bunjangCategoryId
    });

    // API 호출
    const response = await axios.get(apiUrl, {
      params: Object.fromEntries(params),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
        'Referer': 'https://m.bunjang.co.kr/',
        'Origin': 'https://m.bunjang.co.kr'
      },
      timeout: 10000
    });

    const data = response.data;
    
    // API 응답에서 결과 추출
    const results = [];
    if (data.result === 'success' && data.list) {
      data.list.forEach((item, index) => {
        try {
          // 외부 광고는 제외
          if (item.type === 'EXT_AD') {
            console.log(`외부 광고 제외: ${item.name}`);
            return;
          }
          
          // 번개장터 광고도 일단 포함 (ad: true)
          
          const title = item.name || '';
          const link = `https://m.bunjang.co.kr/products/${item.pid}`;
          
          // 가격 정보
          let price = '가격 정보 없음';
          if (item.price && item.price !== '0') {
            const priceNum = parseInt(item.price);
            price = `${priceNum.toLocaleString()}원`;
          }

          // 이미지 URL (해상도 변경)
          let image = 'https://via.placeholder.com/200x200';
          if (item.product_image) {
            // {res}를 실제 해상도로 교체 (300x300 정도)
            image = item.product_image.replace('{res}', '300');
            // {cnt}가 있으면 1로 교체 (첫 번째 이미지)
            image = image.replace('{cnt}', '1');
          }

          // 지역 정보 (위치 정보가 없으면 "위치 정보 없음"으로 표시)
          const location = item.location && item.location.trim() ? item.location : '위치 정보 없음';

          // 기본 검증
          if (title && title.length > 2) {
          // 상품 상태 정보
          let productCondition = '';
          if (item.used === 1) {
            productCondition = '중고';
          } else if (item.used === 2) {
            productCondition = '새상품';
          }

          // 판매 상태 정보 (번개장터)
          let saleStatus = '';
          if (item.status !== undefined) {
            switch(item.status) {
              case '0':
                saleStatus = '판매중';
                break;
              case '1':
                saleStatus = '예약중';
                break;
              case '2':
                saleStatus = '판매완료';
                break;
              default:
                saleStatus = '판매중'; // 기본값
            }
          }

          // 무료배송 여부 (API 응답의 free_shipping 필드 사용)
          const freeShipping = item.free_shipping === true;
          
          // 배송비 정보 (무료배송/배송비별도 구분)
          let shippingInfo = '';
          if (freeShipping) {
            shippingInfo = '무료배송';
          } else {
            shippingInfo = '배송비별도';
          }
          
          // 시간 정보를 더 자세히 파싱
          let timeAgo = '';
          let timestamp = 0;
          if (item.update_time) {
            const updateTime = new Date(item.update_time * 1000);
            timestamp = updateTime.getTime(); // 타임스탬프 (밀리초)
            const now = new Date();
            const diffMs = now.getTime() - updateTime.getTime();
            const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
            const diffDays = Math.floor(diffHours / 24);
            
            if (diffHours < 1) {
              const diffMinutes = Math.floor(diffMs / (1000 * 60));
              timeAgo = diffMinutes < 1 ? '방금 전' : `${diffMinutes}분 전`;
            } else if (diffHours < 24) {
              timeAgo = `${diffHours}시간 전`;
            } else if (diffDays < 7) {
              timeAgo = `${diffDays}일 전`;
            } else {
              timeAgo = updateTime.toLocaleDateString('ko-KR');
            }
          }
          
          // 검수 가능 여부 (API 응답의 care 필드 사용)
          const isBunjangCare = item.care === true;
          const isInspectionAvailable = isBunjangCare; // care 필드가 검수 가능 여부를 나타냄
          
          // 디버깅: 첫 번째 아이템의 필드 값 확인
          if (index === 0) {
            console.log('번개장터 API 응답 필드 확인:', {
              title: item.name,
              free_shipping: item.free_shipping,
              care: item.care,
              freeShipping: freeShipping,
              isBunjangCare: isBunjangCare
            });
          }
            
            results.push({
              title: title,
              link: link,
              price: price,
              image: image,
              cafe: '번개장터', // cafe 이름은 항상 "번개장터"
              source: '번개장터',
              region: location !== '위치 정보 없음' ? location : '', // 지역 정보 (없으면 빈 문자열)
              productCondition: productCondition,
              saleStatus: saleStatus, // 판매 상태 (판매중/예약중/판매완료)
              freeShipping: freeShipping,
              inspection: isInspectionAvailable,
              isAd: item.ad || false,
              date: item.update_time ? new Date(item.update_time * 1000).toLocaleDateString('ko-KR') : '',
              timestamp: timestamp, // 통합 정렬용 타임스탬프
              timeAgo: timeAgo, // 상대 시간 표시 (예: "2시간 전")
              shippingInfo: shippingInfo, // 무료배송 정보 (무료인 경우만)
              imageCount: 1, // 번개장터는 이미지 개수 정보가 명확하지 않음
              isSafePayment: true, // 번개장터는 모든 거래가 안전거래
              isBunjangCare: isBunjangCare, // 번개케어 서비스 (검수 가능 또는 care)
              // 번개장터 찜/채팅 수 추가
              wishCount: parseInt(item.num_faved) || 0,
              chatCount: parseInt(item.num_comment) || 0
            });
          }
        } catch (itemError) {
          console.log(`번개장터 API 아이템 ${index} 파싱 오류:`, itemError);
        }
      });
    }

    console.log(`번개장터 API에서 ${results.length}개 결과 찾음`);
    
    // 클라이언트 사이드 필터링 적용
    let filteredResults = results;
    
    // 무료배송 필터 적용
    if (filters.freeShipping === true) {
      // 무료배송 체크시: free_shipping이 true인 상품만
      filteredResults = filteredResults.filter(product => product.freeShipping === true);
      console.log('번개장터: 무료배송 상품만 필터링 적용');
    }
    // 무료배송 체크 해제시 (기본값): 무료배송 + 배송비별도 모두 표시 (필터링 안함)
    
    // 검수 가능 필터 적용  
    if (filters.inspection === true) {
      // 검수 가능 체크시: care가 true이거나 inspection이 가능한 상품만
      filteredResults = filteredResults.filter(product => product.isBunjangCare === true);
      console.log('번개장터: 검수 가능 상품만 필터링 적용');
    }
    // 검수 가능 체크 해제시 (기본값): 검수 가능 + 불가능 모두 표시 (필터링 안함)
    
    console.log(`번개장터 필터링 후 ${filteredResults.length}개 결과`);
    
    // 결과 캐싱
    cache.set(cacheKey, {
      data: filteredResults,
      timestamp: Date.now()
    });
    
    return filteredResults;

  } catch (error) {
    console.error('번개장터 API 호출 오류:', error);
    console.error('오류 상세:', {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      url: error.config?.url
    });
    
    // CORS 오류나 API 제한 등의 경우 테스트 데이터 반환
    if (error.response?.status === 403 || error.response?.status === 429 || 
        error.message.includes('CORS') || error.message.includes('Network Error')) {
      console.log('번개장터 API 접근 제한 - 테스트 데이터 반환');
      return [
        {
          title: `${query} 미개봉 새상품 (테스트)`,
          link: 'https://m.bunjang.co.kr/products/test1',
          price: '80,000원',
          image: 'https://via.placeholder.com/200x200',
          cafe: '번개장터',
          source: '번개장터',
          region: '서울특별시 강남구', // 테스트 지역
          productCondition: '새상품',
          saleStatus: '판매중', // 테스트 판매상태
          freeShipping: true,
          inspection: true,
          isAd: false,
          date: new Date().toLocaleDateString('ko-KR'),
          timeAgo: '2시간 전', // 테스트 시간
          shippingInfo: '무료배송', // 테스트 배송정보
          imageCount: 1,
          isSafePayment: true, // 번개장터는 모든 거래가 안전거래
          isBunjangCare: true // 번개케어 서비스
        },
        {
          title: `${query} 급매! 반값 판매 (테스트)`,
          link: 'https://m.bunjang.co.kr/products/test2',
          price: '25,000원',
          image: 'https://via.placeholder.com/200x200',
          cafe: '번개장터',
          source: '번개장터',
          region: '', // 위치 정보 없음
          productCondition: '중고',
          saleStatus: '예약중', // 테스트 예약상태
          freeShipping: false,
          inspection: false,
          isAd: false,
          date: new Date().toLocaleDateString('ko-KR'),
          timeAgo: '1일 전', // 테스트 시간
          shippingInfo: '', // 무료배송 아님
          imageCount: 1,
          isSafePayment: true, // 번개장터는 모든 거래가 안전거래
          isBunjangCare: false // 번개케어 미제공
        }
      ];
    }
    
    // 기타 오류의 경우 빈 배열 반환
    return [];
  }
}

// 카테고리 정보 (대분류 + 소분류)
const categories = [
  { id: 0, name: '전체', parent: null },
  
  // 수입명품 (1)
  { id: 1, name: '수입명품', parent: null },
  { id: 101, name: '여성신발', parent: 1 },
  { id: 102, name: '남성신발', parent: 1 },
  { id: 103, name: '가방/핸드백', parent: 1 },
  { id: 104, name: '지갑/벨트', parent: 1 },
  { id: 105, name: '여성의류', parent: 1 },
  { id: 106, name: '남성의류', parent: 1 },
  { id: 107, name: '패션잡화', parent: 1 },
  { id: 108, name: '시계/쥬얼리', parent: 1 },
  { id: 109, name: '유아동', parent: 1 },
  { id: 110, name: '기타 수입명품', parent: 1 },
  
  // 패션의류 (2)
  { id: 2, name: '패션의류', parent: null },
  { id: 111, name: '여성의류', parent: 2 },
  { id: 112, name: '남성의류', parent: 2 },
  { id: 113, name: '교복/체육복/단복', parent: 2 },
  { id: 1339, name: '클로젯셰어', parent: 2 },
  
  // 패션잡화 (3)
  { id: 3, name: '패션잡화', parent: null },
  { id: 114, name: '운동화', parent: 3 },
  { id: 115, name: '여성신발', parent: 3 },
  { id: 116, name: '남성신발', parent: 3 },
  { id: 117, name: '가방/핸드백', parent: 3 },
  { id: 118, name: '지갑/벨트', parent: 3 },
  { id: 119, name: '악세서리/귀금속', parent: 3 },
  { id: 120, name: '시계', parent: 3 },
  { id: 121, name: '선글라스/안경', parent: 3 },
  { id: 122, name: '모자', parent: 3 },
  { id: 123, name: '기타잡화/관련용품', parent: 3 },
  
  // 뷰티 (4)
  { id: 4, name: '뷰티', parent: null },
  { id: 124, name: '스킨케어', parent: 4 },
  { id: 125, name: '메이크업', parent: 4 },
  { id: 126, name: '팩/클렌징/필링', parent: 4 },
  { id: 127, name: '헤어/바디', parent: 4 },
  { id: 128, name: '향수', parent: 4 },
  { id: 129, name: '네일케어', parent: 4 },
  { id: 130, name: '남성 화장품', parent: 4 },
  { id: 131, name: '가발/기타용품', parent: 4 },
  
  // 출산/유아동 (5)
  { id: 5, name: '출산/유아동', parent: null },
  { id: 132, name: '출산/육아용품', parent: 5 },
  { id: 133, name: '유아동안전/실내용품', parent: 5 },
  { id: 134, name: '유아동의류', parent: 5 },
  { id: 135, name: '유아동잡화', parent: 5 },
  { id: 136, name: '유아동가구', parent: 5 },
  { id: 137, name: '유아동교구/완구', parent: 5 },
  { id: 138, name: '기타 유아동용품', parent: 5 },
  
  // 모바일/태블릿 (6)
  { id: 6, name: '모바일/태블릿', parent: null },
  { id: 139, name: '스마트폰', parent: 6 },
  { id: 140, name: '태블릿PC', parent: 6 },
  { id: 141, name: '스마트워치/밴드', parent: 6 },
  { id: 142, name: '일반/피쳐폰', parent: 6 },
  { id: 143, name: '케이스/거치대/보호필름', parent: 6 },
  { id: 144, name: '배터리/충전기/케이블', parent: 6 },
  { id: 145, name: '메모리/젠더/리더기', parent: 6 },
  
  // 가전제품 (7)
  { id: 7, name: '가전제품', parent: null },
  { id: 147, name: '냉장고', parent: 7 },
  { id: 148, name: 'TV', parent: 7 },
  { id: 149, name: '세탁기/건조기', parent: 7 },
  { id: 150, name: '주방가전', parent: 7 },
  { id: 151, name: '스마트홈', parent: 7 },
  { id: 152, name: '영상가전', parent: 7 },
  { id: 153, name: '음향가전', parent: 7 },
  { id: 154, name: '계절가전', parent: 7 },
  { id: 155, name: '생활가전', parent: 7 },
  { id: 156, name: '미용가전', parent: 7 },
  { id: 157, name: '기타 가전제품', parent: 7 },
  
  // 노트북/PC (8)
  { id: 8, name: '노트북/PC', parent: null },
  { id: 158, name: '노트북/넷북', parent: 8 },
  { id: 159, name: '데스크탑/본체', parent: 8 },
  { id: 160, name: '모니터', parent: 8 },
  { id: 161, name: 'CPU/메인보드', parent: 8 },
  { id: 162, name: 'HDD/SSD/ODD', parent: 8 },
  { id: 163, name: 'RAM/VGA/SOUND', parent: 8 },
  { id: 164, name: 'USB/케이블', parent: 8 },
  { id: 165, name: '케이스/파워/쿨러', parent: 8 },
  { id: 166, name: '키보드/마우스/스피커', parent: 8 },
  { id: 167, name: '프린터/복합기/잉크/토너', parent: 8 },
  { id: 168, name: '공유기/랜카드', parent: 8 },
  { id: 169, name: '소프트웨어', parent: 8 },
  { id: 170, name: '기타 주변기기', parent: 8 },
  
  // 카메라/캠코더 (9)
  { id: 9, name: '카메라/캠코더', parent: null },
  { id: 171, name: 'DSLR', parent: 9 },
  { id: 172, name: '미러리스', parent: 9 },
  { id: 173, name: '디지털카메라', parent: 9 },
  { id: 174, name: '필름/즉석카메라', parent: 9 },
  { id: 175, name: '캠코더/액션캠', parent: 9 },
  { id: 176, name: '기타 카메라', parent: 9 },
  { id: 177, name: '카메라렌즈', parent: 9 },
  { id: 178, name: '삼각대/조명/플래시', parent: 9 },
  { id: 179, name: '기타 악세서리', parent: 9 },
  
  // 가구/인테리어 (10)
  { id: 10, name: '가구/인테리어', parent: null },
  { id: 180, name: '침실가구', parent: 10 },
  { id: 181, name: '거실가구', parent: 10 },
  { id: 182, name: '주방가구', parent: 10 },
  { id: 183, name: '수납/선반/공간박스', parent: 10 },
  { id: 184, name: '학생/서재/사무용가구', parent: 10 },
  { id: 185, name: '기타가구', parent: 10 },
  { id: 186, name: '침구', parent: 10 },
  { id: 187, name: '커튼/카페트', parent: 10 },
  { id: 188, name: '조명/무드등', parent: 10 },
  { id: 189, name: '인테리어소품', parent: 10 },
  { id: 190, name: '이벤트/파티용품', parent: 10 },
  { id: 191, name: '디퓨저/캔들', parent: 10 },
  { id: 192, name: '시계/액자/팝아트', parent: 10 },
  { id: 193, name: '원예', parent: 10 },
  
  // 리빙/생활 (11)
  { id: 11, name: '리빙/생활', parent: null },
  { id: 194, name: '주방용품', parent: 11 },
  { id: 195, name: '식품', parent: 11 },
  { id: 196, name: '욕실용품', parent: 11 },
  { id: 197, name: '청소/세탁용품', parent: 11 },
  { id: 198, name: '생활잡화', parent: 11 },
  { id: 199, name: '기타 생활용품', parent: 11 },
  { id: 246, name: '차량용품', parent: 11 },
  
  // 게임 (12)
  { id: 12, name: '게임', parent: null },
  { id: 200, name: 'PC게임', parent: 12 },
  { id: 201, name: '플레이스테이션', parent: 12 },
  { id: 202, name: 'PSP', parent: 12 },
  { id: 203, name: '닌텐도', parent: 12 },
  { id: 204, name: 'Wii', parent: 12 },
  { id: 205, name: 'XBOX', parent: 12 },
  { id: 206, name: '게임타이틀', parent: 12 },
  { id: 207, name: '기타 게임', parent: 12 },
  
  // 반려동물/취미 (13)
  { id: 13, name: '반려동물/취미', parent: null },
  { id: 208, name: '반려동물', parent: 13 },
  { id: 209, name: '키덜트', parent: 13 },
  { id: 210, name: '핸드메이드/DIY', parent: 13 },
  { id: 211, name: '악기', parent: 13 },
  { id: 212, name: '예술작품/골동품/수집', parent: 13 },
  { id: 213, name: '미술재료/미술도구', parent: 13 },
  
  // 도서/음반/문구 (14)
  { id: 14, name: '도서/음반/문구', parent: null },
  { id: 214, name: '유아동도서/음반', parent: 14 },
  { id: 215, name: '학습/교육', parent: 14 },
  { id: 216, name: '소설/만화책', parent: 14 },
  { id: 217, name: '여행/취미/레저', parent: 14 },
  { id: 218, name: '문학/과학/경영', parent: 14 },
  { id: 219, name: '예술/디자인', parent: 14 },
  { id: 220, name: '잡지', parent: 14 },
  { id: 221, name: '기타 도서', parent: 14 },
  { id: 222, name: '음반/DVD/굿즈', parent: 14 },
  { id: 223, name: '문구/사무용품', parent: 14 },
  
  // 티켓/쿠폰 (15)
  { id: 15, name: '티켓/쿠폰', parent: null },
  { id: 224, name: '티켓', parent: 15 },
  { id: 225, name: '상품권/쿠폰', parent: 15 },
  { id: 226, name: '여행숙박/이용권', parent: 15 },
  { id: 227, name: '기타 티켓/쿠폰/이용권', parent: 15 },
  
  // 스포츠 (16)
  { id: 16, name: '스포츠', parent: null },
  { id: 228, name: '골프', parent: 16 },
  { id: 229, name: '자전거', parent: 16 },
  { id: 230, name: '인라인/스케이트/전동', parent: 16 },
  { id: 231, name: '축구', parent: 16 },
  { id: 232, name: '야구', parent: 16 },
  { id: 233, name: '농구', parent: 16 },
  { id: 234, name: '라켓스포츠', parent: 16 },
  { id: 235, name: '헬스/요가', parent: 16 },
  { id: 236, name: '수상스포츠', parent: 16 },
  { id: 237, name: '겨울스포츠', parent: 16 },
  { id: 238, name: '검도/격투/권투', parent: 16 },
  { id: 239, name: '기타 스포츠', parent: 16 },
  { id: 1347, name: '라브인증 자전거', parent: 16 },
  
  // 레저/여행 (17)
  { id: 17, name: '레저/여행', parent: null },
  { id: 240, name: '등산의류/용품', parent: 17 },
  { id: 241, name: '캠핑용품', parent: 17 },
  { id: 242, name: '낚시용품', parent: 17 },
  { id: 243, name: '기타 레저/여행용품', parent: 17 },
  
  // 오토바이 (19)
  { id: 19, name: '오토바이', parent: null },
  { id: 247, name: '125cc 이하', parent: 19 },
  { id: 248, name: '125cc 초과', parent: 19 },
  { id: 249, name: '오토바이 용품', parent: 19 },
  { id: 1329, name: '신차', parent: 19 },
  
  // 공구/산업용품 (20)
  { id: 20, name: '공구/산업용품', parent: null },
  { id: 250, name: '드릴/전동공구', parent: 20 },
  { id: 251, name: '에어/유압', parent: 20 },
  { id: 252, name: '작업공구', parent: 20 },
  { id: 253, name: '측정공구', parent: 20 },
  { id: 254, name: '초경/절삭/접착윤활', parent: 20 },
  { id: 255, name: '전기/전자', parent: 20 },
  { id: 256, name: '배관설비/포장운송', parent: 20 },
  { id: 257, name: '금형공작', parent: 20 },
  { id: 258, name: '용접기자재', parent: 20 },
  { id: 259, name: '산업/안전/공구함', parent: 20 },
  { id: 260, name: '산업자재', parent: 20 },
  { id: 261, name: '농기계/농업용공구', parent: 20 },
  
  // 무료나눔 (21)
  { id: 21, name: '무료나눔', parent: null },
  
  // 중고차 (1348)
  { id: 1348, name: '중고차', parent: null },
  { id: 1349, name: '국산차', parent: 1348 },
  { id: 1350, name: '수입차', parent: 1348 }
];

/**
 * 네이버 카페 카테고리 API 사용법:
 * 
 * 1. 모든 카테고리 가져오기: GET /api/naver-categories
 *    - 네이버 카페의 모든 카테고리 정보를 계층 구조로 가져옵니다
 *    - 캐시: 1시간 TTL
 *    - 응답: { success: true, categories: [...], totalCount: 2517, lastUpdated: "2025-09-25T..." }
 * 
 * 2. 카테고리 ID만 가져오기: GET /api/naver-categories/ids
 *    - 모든 카테고리의 ID만 배열로 가져옵니다 (필터링용)
 *    - 응답: { success: true, categoryIds: ["50000004", "50000101", ...], totalCount: 2517 }
 * 
 * 3. 특정 카테고리의 하위 카테고리: GET /api/naver-categories/{categoryId}/children
 *    - 특정 카테고리의 직접적인 하위 카테고리만 가져옵니다
 *    - 응답: { success: true, categoryId: "50000004", children: [...], count: 17 }
 * 
 * 4. 카테고리 검색: GET /api/naver-categories/search?q=검색어
 *    - 카테고리 이름으로 검색합니다
 *    - 응답: { success: true, query: "가구", categories: [...], totalCount: 183 }
 * 
 * 5. 검색 시 카테고리 필터 적용: GET /api/search?q=검색어&sources=naver&categoryId={categoryId}
 *    - 네이버 카페 검색 시 특정 카테고리로 필터링
 *    - 예시: /api/search?q=아이폰&sources=naver&categoryId=50000003 (디지털/가전)
 *    - 예시: /api/search?q=소파&sources=naver&categoryId=50000004 (가구/인테리어)
 */

// 네이버 카페 카테고리 가져오기 함수
async function fetchNaverCafeCategories() {
  try {
    console.log('네이버 카페 루트 카테고리 가져오는 중...');
    
    // 루트 카테고리 가져오기
    const rootResponse = await axios.get('https://apis.naver.com/cafe-web/cafe-add-api/v1.0/categories/root?used=true', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
        'Referer': 'https://cafe.naver.com/',
        'Origin': 'https://cafe.naver.com'
      },
      timeout: 10000
    });

    if (!rootResponse.data || !rootResponse.data.result || !rootResponse.data.result.productCategoryList) {
      throw new Error('루트 카테고리 데이터가 없습니다.');
    }

    const rootCategories = rootResponse.data.result.productCategoryList;
    // console.log(`${rootCategories.length}개의 루트 카테고리 찾음`);

    const allCategories = [];
    
    // 각 루트 카테고리에 대해 하위 카테고리 가져오기
    for (const rootCategory of rootCategories) {
      // 루트 카테고리 추가
      allCategories.push({
        categoryId: rootCategory.categoryId,
        parentCategoryId: rootCategory.parentCategoryId || null,
        categoryName: rootCategory.categoryName,
        categoryLevel: rootCategory.categoryLevel,
        lastLevel: rootCategory.lastLevel,
        exposureOrder: rootCategory.exposureOrder,
        fullPathLabel: rootCategory.fullPathLabel,
        deleted: rootCategory.deleted
      });

      // 하위 카테고리가 있는 경우 가져오기
      if (!rootCategory.lastLevel) {
        try {
          // console.log(`"${rootCategory.categoryName}" 하위 카테고리 가져오는 중...`);
          
          const childResponse = await axios.get(`https://apis.naver.com/cafe-web/cafe-add-api/v1.0/categories/${rootCategory.categoryId}/child?used=true`, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'application/json, text/plain, */*',
              'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
              'Referer': 'https://cafe.naver.com/',
              'Origin': 'https://cafe.naver.com'
            },
            timeout: 10000
          });

          if (childResponse.data && childResponse.data.result && childResponse.data.result.productCategoryList) {
            const childCategories = childResponse.data.result.productCategoryList;
            // console.log(`"${rootCategory.categoryName}"에서 ${childCategories.length}개의 하위 카테고리 찾음`);
            
            // 하위 카테고리들 추가
            for (const childCategory of childCategories) {
              allCategories.push({
                categoryId: childCategory.categoryId,
                parentCategoryId: childCategory.parentCategoryId,
                categoryName: childCategory.categoryName,
                categoryLevel: childCategory.categoryLevel,
                lastLevel: childCategory.lastLevel,
                exposureOrder: childCategory.exposureOrder,
                fullPathLabel: childCategory.fullPathLabel,
                deleted: childCategory.deleted
              });

              // 2단계 하위 카테고리도 확인 (필요한 경우)
              if (!childCategory.lastLevel) {
                try {
                  // console.log(`"${childCategory.categoryName}" 2단계 하위 카테고리 가져오는 중...`);
                  
                  const grandChildResponse = await axios.get(`https://apis.naver.com/cafe-web/cafe-add-api/v1.0/categories/${childCategory.categoryId}/child?used=true`, {
                    headers: {
                      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                      'Accept': 'application/json, text/plain, */*',
                      'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
                      'Referer': 'https://cafe.naver.com/',
                      'Origin': 'https://cafe.naver.com'
                    },
                    timeout: 10000
                  });

                  if (grandChildResponse.data && grandChildResponse.data.result && grandChildResponse.data.result.productCategoryList) {
                    const grandChildCategories = grandChildResponse.data.result.productCategoryList;
                    // console.log(`"${childCategory.categoryName}"에서 ${grandChildCategories.length}개의 2단계 하위 카테고리 찾음`);
                    
                    for (const grandChildCategory of grandChildCategories) {
                      allCategories.push({
                        categoryId: grandChildCategory.categoryId,
                        parentCategoryId: grandChildCategory.parentCategoryId,
                        categoryName: grandChildCategory.categoryName,
                        categoryLevel: grandChildCategory.categoryLevel,
                        lastLevel: grandChildCategory.lastLevel,
                        exposureOrder: grandChildCategory.exposureOrder,
                        fullPathLabel: grandChildCategory.fullPathLabel,
                        deleted: grandChildCategory.deleted
                      });
                    }
                  }
                } catch (grandChildError) {
                  console.log(`"${childCategory.categoryName}" 2단계 하위 카테고리 가져오기 실패:`, grandChildError.message);
                }
              }
            }
          }
          
          // API 요청 간격 조절 (서버 부하 방지)
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (childError) {
          console.log(`"${rootCategory.categoryName}" 하위 카테고리 가져오기 실패:`, childError.message);
        }
      }
    }

    console.log(`총 ${allCategories.length}개의 네이버 카페 카테고리 수집 완료`);
    
    return {
      success: true,
      categories: allCategories,
      totalCount: allCategories.length,
      lastUpdated: new Date().toISOString()
    };

  } catch (error) {
    console.error('네이버 카페 카테고리 가져오기 오류:', error);
    return {
      success: false,
      error: error.message,
      categories: [],
      totalCount: 0
    };
  }
}

// 네이버 카페 카테고리 캐시 (1시간 TTL)
let naverCategoriesCache = {
  data: null,
  timestamp: 0,
  ttl: 60 * 60 * 1000 // 1시간
};

// 번개장터 카테고리 캐시 (1시간 TTL)
let bunjangCategoriesCache = {
  data: null,
  timestamp: 0,
  ttl: 60 * 60 * 1000 // 1시간
};

// 번개장터 카테고리 가져오기 함수
async function fetchBunjangCategories() {
  try {
    console.log('번개장터 카테고리 가져오는 중...');
    
    const response = await axios.get('https://api.bunjang.co.kr/api/1/categories/list.json', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
        'Referer': 'https://m.bunjang.co.kr/',
        'Origin': 'https://m.bunjang.co.kr'
      },
      timeout: 10000
    });

    if (response.data && response.data.result === 'success' && response.data.categories) {
      const categories = response.data.categories;
      console.log(`번개장터 카테고리 ${categories.length}개 로드됨`);
      
      // 카테고리 구조 분석 및 정리
      const structuredCategories = categories.map(category => {
        const categoryData = {
          id: category.id,
          title: category.title,
          icon_url: category.icon_url,
          count: category.count,
          order: category.order,
          subcategories: []
        };

        // 하위 카테고리 처리
        if (category.categories && category.categories.length > 0) {
          categoryData.subcategories = category.categories.map(subCategory => {
            const subCategoryData = {
              id: subCategory.id,
              title: subCategory.title,
              icon_url: subCategory.icon_url,
              count: subCategory.count,
              order: subCategory.order,
              subcategories: []
            };

            // 3단계 하위 카테고리 처리
            if (subCategory.categories && subCategory.categories.length > 0) {
              subCategoryData.subcategories = subCategory.categories.map(thirdCategory => ({
                id: thirdCategory.id,
                title: thirdCategory.title,
                icon_url: thirdCategory.icon_url,
                count: thirdCategory.count,
                order: thirdCategory.order,
                require_size: thirdCategory.require_size,
                require_brand: thirdCategory.require_brand,
                disable_price: thirdCategory.disable_price,
                disable_quantity: thirdCategory.disable_quantity,
                disable_inspection: thirdCategory.disable_inspection
              }));
            }

            return subCategoryData;
          });
        }

        return categoryData;
      });

      return {
        success: true,
        categories: structuredCategories,
        totalCount: categories.length,
        lastUpdated: new Date().toISOString()
      };

    } else {
      throw new Error('번개장터 카테고리 데이터 형식이 올바르지 않습니다.');
    }

  } catch (error) {
    console.error('번개장터 카테고리 가져오기 오류:', error);
    return {
      success: false,
      error: error.message,
      categories: [],
      totalCount: 0
    };
  }
}

// 네이버 카페 카테고리 가져오기 API
app.get('/api/naver-categories', async (req, res) => {
  try {
    // 캐시 확인
    const now = Date.now();
    if (naverCategoriesCache.data && (now - naverCategoriesCache.timestamp) < naverCategoriesCache.ttl) {
      console.log('네이버 카테고리 캐시에서 반환');
      return res.json(naverCategoriesCache.data);
    }

    // 새로 가져오기
    console.log('네이버 카테고리 새로 가져오는 중...');
    const result = await fetchNaverCafeCategories();
    
    if (result.success) {
      // 캐시 업데이트
      naverCategoriesCache = {
        data: result,
        timestamp: now,
        ttl: naverCategoriesCache.ttl
      };
    }

    res.json(result);
  } catch (error) {
    console.error('네이버 카테고리 API 오류:', error);
    res.status(500).json({
      success: false,
      error: '카테고리를 가져오는 중 오류가 발생했습니다.',
      details: error.message
    });
  }
});

// 특정 카테고리의 하위 카테고리 가져오기 API
app.get('/api/naver-categories/:categoryId/children', async (req, res) => {
  const { categoryId } = req.params;
  
  try {
    // console.log(`카테고리 ${categoryId}의 하위 카테고리 가져오는 중...`);
    
    const response = await axios.get(`https://apis.naver.com/cafe-web/cafe-add-api/v1.0/categories/${categoryId}/child?used=true`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
        'Referer': 'https://cafe.naver.com/',
        'Origin': 'https://cafe.naver.com'
      },
      timeout: 10000
    });

    if (response.data && response.data.result && response.data.result.productCategoryList) {
      const childCategories = response.data.result.productCategoryList;
      res.json({
        success: true,
        categoryId: categoryId,
        children: childCategories,
        count: childCategories.length
      });
    } else {
      res.json({
        success: true,
        categoryId: categoryId,
        children: [],
        count: 0
      });
    }
  } catch (error) {
    console.error(`카테고리 ${categoryId} 하위 카테고리 가져오기 오류:`, error);
    res.status(500).json({
      success: false,
      error: '하위 카테고리를 가져오는 중 오류가 발생했습니다.',
      details: error.message
    });
  }
});

// 카테고리 ID만 추출하는 유틸리티 API
app.get('/api/naver-categories/ids', async (req, res) => {
  try {
    // 캐시 확인
    const now = Date.now();
    if (naverCategoriesCache.data && (now - naverCategoriesCache.timestamp) < naverCategoriesCache.ttl) {
      console.log('네이버 카테고리 캐시에서 ID만 추출하여 반환');
      const categoryIds = naverCategoriesCache.data.categories.map(cat => cat.categoryId);
      return res.json({
        success: true,
        categoryIds: categoryIds,
        totalCount: categoryIds.length,
        lastUpdated: naverCategoriesCache.data.lastUpdated
      });
    }

    // 새로 가져오기
    console.log('네이버 카테고리 새로 가져와서 ID만 추출...');
    const result = await fetchNaverCafeCategories();
    
    if (result.success) {
      // 캐시 업데이트
      naverCategoriesCache = {
        data: result,
        timestamp: now,
        ttl: naverCategoriesCache.ttl
      };
      
      const categoryIds = result.categories.map(cat => cat.categoryId);
      return res.json({
        success: true,
        categoryIds: categoryIds,
        totalCount: categoryIds.length,
        lastUpdated: result.lastUpdated
      });
    }

    res.status(500).json({
      success: false,
      error: '카테고리 ID를 가져오는 중 오류가 발생했습니다.'
    });
  } catch (error) {
    console.error('네이버 카테고리 ID API 오류:', error);
    res.status(500).json({
      success: false,
      error: '카테고리 ID를 가져오는 중 오류가 발생했습니다.',
      details: error.message
    });
  }
});

// 카테고리 검색 API (이름으로 카테고리 찾기)
app.get('/api/naver-categories/search', async (req, res) => {
  const { q } = req.query;
  
  if (!q) {
    return res.status(400).json({
      success: false,
      error: '검색어가 필요합니다.'
    });
  }

  try {
    // 캐시 확인
    const now = Date.now();
    if (!naverCategoriesCache.data || (now - naverCategoriesCache.timestamp) >= naverCategoriesCache.ttl) {
      // 캐시가 없거나 만료된 경우 새로 가져오기
      console.log('네이버 카테고리 새로 가져오는 중...');
      const result = await fetchNaverCafeCategories();
      
      if (result.success) {
        naverCategoriesCache = {
          data: result,
          timestamp: now,
          ttl: naverCategoriesCache.ttl
        };
      }
    }

    if (naverCategoriesCache.data && naverCategoriesCache.data.success) {
      const searchTerm = q.toLowerCase();
      const matchedCategories = naverCategoriesCache.data.categories.filter(cat => 
        cat.categoryName.toLowerCase().includes(searchTerm) ||
        cat.fullPathLabel.toLowerCase().includes(searchTerm)
      );

      res.json({
        success: true,
        query: q,
        categories: matchedCategories,
        totalCount: matchedCategories.length
      });
    } else {
      res.status(500).json({
        success: false,
        error: '카테고리 데이터를 찾을 수 없습니다.'
      });
    }
  } catch (error) {
    console.error('네이버 카테고리 검색 API 오류:', error);
    res.status(500).json({
      success: false,
      error: '카테고리 검색 중 오류가 발생했습니다.',
      details: error.message
    });
  }
});

// 골마켓 카테고리 API
app.get('/api/golmarket-categories', async (req, res) => {
  try {
    const categories = Object.entries(golmarketCategories).map(([id, name]) => ({
      id: parseInt(id),
      name
    }));

    res.json({
      success: true,
      categories,
      totalCount: categories.length
    });
  } catch (error) {
    console.error('골마켓 카테고리 API 오류:', error);
    res.status(500).json({
      success: false,
      error: '골마켓 카테고리를 불러오는 중 오류가 발생했습니다.',
      details: error.message
    });
  }
});

// 기존 카테고리 목록 API (기본 카테고리)
app.get('/api/categories', (req, res) => {
  res.json({
    categories: categories
  });
});

// 중고나라 카테고리 API
app.get('/api/joongna-categories', (req, res) => {
  try {
    res.json({
      success: true,
      data: joongnaCategories,
      totalCount: Object.keys(joongnaCategories).length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('중고나라 카테고리 조회 오류:', error);
    res.status(500).json({
      success: false,
      error: '카테고리 정보를 가져오는 중 오류가 발생했습니다.',
      details: error.message
    });
  }
});

// 캐시 클리어 API
app.post('/api/clear-cache', (req, res) => {
  try {
    cache.clear();
    console.log('캐시가 모두 클리어되었습니다.');
    res.json({ 
      success: true, 
      message: '캐시가 성공적으로 클리어되었습니다.' 
    });
  } catch (error) {
    console.error('캐시 클리어 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '캐시 클리어 중 오류가 발생했습니다.' 
    });
  }
});

// 통합 검색 API (필터 기능 추가)
app.get('/api/search', async (req, res) => {
  const { 
    q, 
    sources, 
    page,
    category, 
    categoryId, // 네이버 카페 카테고리 ID 필터 추가
    minPrice, 
    maxPrice, 
    parcelFeeYn, 
    certifiedSellerYn, 
    sort,
    // 공통 판매상태 필터들 (모든 플랫폼 공통)
    onSale,
    includeSoldOut,
    // 네이버 카페 전용 필터들
    directPay,
    escrowPay,
    meetTrade,
    deliveryTrade,
    onlineTrade,
    newItem,
    almostNew,
    usedItem,
    registrationPeriod,
    // 번개장터 추가 필터들
    freeShipping,
    inspection
  } = req.query;
  
  if (!q) {
    return res.status(400).json({ error: '검색어가 필요합니다.' });
  }

  const selectedSources = sources ? sources.split(',') : ['naver', 'joongna', 'bunjang'];
  const currentPage = parseInt(page) || 1;
  const searchPromises = [];

  // 필터 옵션 객체 생성
  const filters = {
    // 공통 카테고리는 사용하지 않음 - 플랫폼별 전용 카테고리만 사용
    // category: category ? parseInt(category) : 0, // 제거됨
    categoryId: categoryId || null, // 네이버 카페 카테고리 ID 필터
    joongnaCategoryId: req.query.joongnaCategoryId || null, // 중고나라 카테고리 ID 필터 추가
    bunjangCategoryId: req.query.bunjangCategoryId || null, // 번개장터 카테고리 ID 필터 추가
    golmarketCategoryId: req.query.golmarketCategoryId || null, // 골마켓 카테고리 ID 필터 추가
    minPrice: minPrice ? parseInt(minPrice) : null,
    maxPrice: maxPrice ? parseInt(maxPrice) : null,
    parcelFeeYn: parcelFeeYn === 'true',
    certifiedSellerYn: certifiedSellerYn === 'true',
    sort: sort || 'RECOMMEND', // 기본값: 추천순
    // 공통 판매상태 필터들 (모든 플랫폼 공통)
    onSale: onSale === 'true',
    includeSoldOut: includeSoldOut === 'true',
    // 네이버 카페 전용 필터들
    directPay: directPay === 'true',
    escrowPay: escrowPay === 'true',
    meetTrade: meetTrade === 'true',
    deliveryTrade: deliveryTrade === 'true',
    onlineTrade: onlineTrade === 'true',
    newItem: newItem === 'true',
    almostNew: almostNew === 'true',
    usedItem: usedItem === 'true',
    registrationPeriod: registrationPeriod || 'ALL',
    // 번개장터 추가 필터들
    freeShipping: freeShipping === 'true',
    inspection: inspection === 'true'
  };

  if (selectedSources.includes('naver')) {
    searchPromises.push(searchNaverCafe(q, filters, currentPage));
  }
  if (selectedSources.includes('joongna')) {
    searchPromises.push(searchJoongna(q, filters, currentPage));
  }
  if (selectedSources.includes('bunjang')) {
    searchPromises.push(searchBunjang(q, filters, currentPage));
  }
  if (selectedSources.includes('golmarket')) {
    searchPromises.push(searchGolmarket(q, filters, currentPage));
  }

  try {
    const results = await Promise.all(searchPromises);
    let combinedResults = [];
    
    // console.log('통합 검색 결과 구조 확인:');
    // results.forEach((result, index) => {
    //   console.log(`결과 ${index}:`, {
    //     type: Array.isArray(result) ? 'Array' : typeof result,
    //     hasSuccess: result && result.hasOwnProperty('success'),
    //     hasData: result && result.data,
    //     hasProducts: result && result.data && result.data.products,
    //     length: Array.isArray(result) ? result.length : (result && result.data && result.data.products ? result.data.products.length : 'N/A')
    //   });
    // });
    
    // 각 플랫폼의 결과를 결합
    results.forEach((result, index) => {
      if (result && Array.isArray(result)) {
        // 네이버 카페, 번개장터 (배열 직접 반환)
        console.log(`플랫폼 ${index}: 배열 형태 ${result.length}개 결과 추가`);
        combinedResults = combinedResults.concat(result);
      } else if (result && result.success && result.data && result.data.products) {
        // 중고나라 (객체 구조 반환)
        console.log(`플랫폼 ${index}: 객체 형태 ${result.data.products.length}개 결과 추가`);
        combinedResults = combinedResults.concat(result.data.products);
      } else {
        console.log(`플랫폼 ${index}: 결과 형태를 인식할 수 없음`, result);
      }
    });
    
    // 서버 사이드에서 모든 필터링 완료 (클라이언트 사이드 필터링 제거)
    
    res.json({
      query: q,
      filters: filters,
      total: combinedResults.length,
      results: combinedResults,
      categories: categories,
      pagination: {
        currentPage: currentPage,
        hasResults: combinedResults.length > 0,
        // 결과가 있으면 다음 페이지가 있을 가능성이 높음
        hasNextPage: combinedResults.length > 0,
        hasPrevPage: currentPage > 1
      }
    });
  } catch (error) {
    console.error('검색 오류:', error);
    res.status(500).json({ error: '검색 중 오류가 발생했습니다.' });
  }
});

// 중고나라 개별 검색 API
app.get('/api/search/joongna', async (req, res) => {
  const { 
    q, 
    page, 
    minPrice, 
    maxPrice, 
    sort, 
    joongnaCategoryId,
    parcelFeeYn,
    // 공통 판매상태 필터들
    onSale,
    includeSoldOut 
  } = req.query;
  
  if (!q) {
    return res.status(400).json({ error: '검색어가 필요합니다.' });
  }

  const currentPage = parseInt(page) || 0;
  const filters = {
    minPrice: minPrice ? parseInt(minPrice) : null,
    maxPrice: maxPrice ? parseInt(maxPrice) : null,
    sort: sort || 'RECOMMEND', // 공통 정렬 값 사용
    joongnaCategoryId, // 중고나라 카테고리 ID
    // 공통 판매상태 필터들
    onSale: onSale === 'true',
    includeSoldOut: includeSoldOut === 'true',
    parcelFeeYn: parcelFeeYn === 'true' ? true : parcelFeeYn === 'false' ? false : undefined // 배송비 필터
  };

  try {
    const result = await searchJoongna(q, filters, currentPage);
    res.json(result);
  } catch (error) {
    console.error('중고나라 검색 API 오류:', error);
    res.status(500).json({ 
      error: '검색 중 오류가 발생했습니다.',
      details: error.message 
    });
  }
});

// 중고나라 카테고리 API (기존 joongnaCategories 변수 사용)
app.get('/api/joongna-categories', (req, res) => {
  try {
    res.json({
      success: true,
      data: joongnaCategories,
      totalCount: Object.keys(joongnaCategories).length
    });
  } catch (error) {
    console.error('중고나라 카테고리 API 오류:', error);
    res.status(500).json({
      success: false,
      error: '카테고리를 가져오는 중 오류가 발생했습니다.',
      details: error.message 
    });
  }
});

// 번개장터 카테고리 가져오기 API
app.get('/api/bunjang-categories', async (req, res) => {
  try {
    // 캐시 확인
    const now = Date.now();
    if (bunjangCategoriesCache.data && (now - bunjangCategoriesCache.timestamp) < bunjangCategoriesCache.ttl) {
      console.log('번개장터 카테고리 캐시에서 반환');
      return res.json(bunjangCategoriesCache.data);
    }

    // 새로 가져오기
    console.log('번개장터 카테고리 새로 가져오는 중...');
    const result = await fetchBunjangCategories();
    
    if (result.success) {
      // 캐시 업데이트
      bunjangCategoriesCache = {
        data: result,
        timestamp: now,
        ttl: bunjangCategoriesCache.ttl
      };
    }

    res.json(result);
  } catch (error) {
    console.error('번개장터 카테고리 API 오류:', error);
    res.status(500).json({
      success: false,
      error: '카테고리를 가져오는 중 오류가 발생했습니다.',
      details: error.message
    });
  }
});

// 이미지 프록시 엔드포인트 (네이버 카페 이미지 CORS 문제 해결용)
app.get('/api/proxy-image', async (req, res) => {
  const { url } = req.query;
  
  if (!url) {
    return res.status(400).json({ error: '이미지 URL이 필요합니다.' });
  }

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://cafe.naver.com/',
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8'
      },
      responseType: 'stream',
      timeout: 10000
    });

    // 원본 이미지의 Content-Type 헤더 복사
    if (response.headers['content-type']) {
      res.set('Content-Type', response.headers['content-type']);
    }
    
    // 캐시 헤더 설정 (1시간)
    res.set('Cache-Control', 'public, max-age=3600');
    
    // CORS 헤더 설정
    res.set('Access-Control-Allow-Origin', '*');
    
    // 이미지 데이터 스트리밍
    response.data.pipe(res);
    
  } catch (error) {
    console.error('이미지 프록시 오류:', error.message);
    res.status(404).json({ error: '이미지를 불러올 수 없습니다.' });
  }
});

// 클라이언트 사이드 필터링 함수 제거됨 - 모든 필터링은 서버 API 레벨에서 처리

// 정적 파일 제공
app.use(express.static(path.join(__dirname, '../client/build')));

// 모든 라우트를 React 앱으로 리다이렉트 (API 제외)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
});

// Vercel에서는 app.listen이 필요하지 않으므로 module.exports로 export
if (process.env.VERCEL !== '1') {
  app.listen(PORT, async () => {
    console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
    
    // 백그라운드에서 네이버 카테고리 미리 로딩
    setTimeout(async () => {
      await preloadNaverCategories();
    }, 1000); // 1초 후 실행 (서버 완전 시작 후)
  });
}

// Vercel을 위한 export
module.exports = app;
