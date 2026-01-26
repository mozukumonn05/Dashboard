import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  ComposedChart,
  ReferenceLine,
} from 'recharts';
import {
  LayoutDashboard,
  TrendingUp,
  DollarSign,
  Calendar,
  Upload,
  FileSpreadsheet,
  ArrowUpRight,
  Target,
  ChevronRight,
  Menu,
  X,
  Activity,
  AlertCircle,
  CheckCircle,
  BarChart2,
  PieChart as PieChartIcon,
  ChevronLeft,
  Database,
  Cloud,
  Sparkles,
  Bot,
  RefreshCw,
  Download,
} from 'lucide-react';
import html2canvas from 'html2canvas';

// --- Firebase Imports ---
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
  signInWithCustomToken,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  writeBatch,
} from 'firebase/firestore';

// --- Gemini API Key ---
const apiKey = ''; // 環境から提供されるキーを使用

// --- CDNからの外部ライブラリ読み込み用フック ---
const useScript = (src) => {
  const [status, setStatus] = useState(src ? 'loading' : 'idle');
  useEffect(() => {
    if (!src) {
      setStatus('idle');
      return;
    }
    let script = document.querySelector(`script[src="${src}"]`);
    if (!script) {
      script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.setAttribute('data-status', 'loading');
      document.body.appendChild(script);
      const setAttributeFromEvent = (event) => {
        script.setAttribute(
          'data-status',
          event.type === 'load' ? 'ready' : 'error'
        );
        setStatus(event.type === 'load' ? 'ready' : 'error');
      };
      script.addEventListener('load', setAttributeFromEvent);
      script.addEventListener('error', setAttributeFromEvent);
    } else {
      setStatus(script.getAttribute('data-status'));
    }
  }, [src]);
  return status;
};

// --- 年度（4月〜3月）の月リスト ---
const FISCAL_YEAR_MONTHS = [
  '4月',
  '5月',
  '6月',
  '7月',
  '8月',
  '9月',
  '10月',
  '11月',
  '12月',
  '1月',
  '2月',
  '3月',
];
const MONTHS_ORDER = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3];
const CURRENT_FISCAL_YEAR = 2025; // R7年度

// --- ポータルサイト検知用キーワード ---
const PLATFORM_KEYWORDS = [
  '楽天',
  'ふるさとチョイス',
  'さとふる',
  'ふるなび',
  'ANA',
  'au PAY',
  '三越伊勢丹',
  'JRE',
  'JAL',
  'マイナビ',
  'セゾン',
  'モンベル',
  'ふるラボ',
  'まいふる',
  '電話',
  'FAX',
  '窓口',
  '直接',
  '郵便',
  '郵送',
  // 追加キーワード
  'ふるぽ',
  'ふるさとプレミアム',
  '特設サイト',
  'ふるさと本舗',
  '電子感謝券',
  '百選',
  'ぺいふる',
  'Amazon',
];

// --- ヘルパー関数 ---
// 会計年度と月から暦年（カレンダー年）を求める
const getFiscalYearCalendarYear = (fiscalYear, month) => {
  return month <= 3 ? fiscalYear + 1 : fiscalYear;
};

// 月次データの初期生成 (Excelに月次がない場合のフォールバック)
const generateMonthlyData = (totalCurrent) => {
  return FISCAL_YEAR_MONTHS.map((m) => ({
    month: m,
    thisYear: 0,
    lastYear: 0,
    prevYear: 0,
    yoyRate: 0,
  }));
};

// --- 初期データ ---
const INITIAL_SUMMARY_DATA = [
  { name: '大洗町', current: 0, target: 2000000000, yoy: 0, achievement: 0 },
  { name: '行方市', current: 0, target: 1200000000, yoy: 0, achievement: 0 },
  { name: '鹿嶋市', current: 0, target: 600000000, yoy: 0, achievement: 0 },
  { name: '水戸市', current: 0, target: 800000000, yoy: 0, achievement: 0 },
  { name: '取手市', current: 0, target: 3000000000, yoy: 0, achievement: 0 },
  { name: '北茨城市', current: 0, target: 300000000, yoy: 0, achievement: 0 },
  { name: '大子町', current: 0, target: 100000000, yoy: 0, achievement: 0 },
  { name: '阿見町', current: 0, target: 200000000, yoy: 0, achievement: 0 },
  { name: '豊見城市', current: 0, target: 560000000, yoy: 0, achievement: 0 },
  { name: '益子町', current: 0, target: 150000000, yoy: 0, achievement: 0 },
  { name: '城里町', current: 0, target: 100000000, yoy: 0, achievement: 0 },
  { name: '紫波町', current: 0, target: 600000000, yoy: 0, achievement: 0 },
  { name: '春日部市', current: 0, target: 100000000, yoy: 0, achievement: 0 },
];

const INITIAL_DETAIL_DATA = {};
// 初期化
INITIAL_SUMMARY_DATA.forEach((city) => {
  INITIAL_DETAIL_DATA[city.name] = {
    monthly: [],
    rawDailyData: {}, // { year: { month: { day: amount } } }
    platforms: [],
    targetMonth: new Date().getMonth() + 1,
  };
});

const COLORS = [
  '#0088FE',
  '#00C49F',
  '#FF8042',
  '#FFBB28',
  '#8884d8',
  '#82ca9d',
  '#a4de6c',
  '#d0ed57',
  '#ffc658',
];

const formatCurrency = (value) => {
  if (value === null || value === undefined || isNaN(value)) return '-';
  if (typeof value === 'object') return '-'; // Ensure strictly no objects
  if (typeof value !== 'number') return '-'; // Ensure strict number type for arithmetic
  if (value >= 100000000) return `${(value / 100000000).toFixed(1)}億円`;
  return `${(value / 10000).toLocaleString()}万円`;
};

// --- Firebase Setup ---
// ステップ2で取得した値をここに入力してください
const firebaseConfig = {
  apiKey: 'AIzaSyCI9ix2QXgbSEhHlrLUBe_OgHbvm9Ey0Ec',
  authDomain: 'furusato-dashboard.firebaseapp.com',
  projectId: 'furusato-dashboard',
  storageBucket: 'furusato-dashboard.firebasestorage.app',
  messagingSenderId: '573154898493',
  appId: '1:573154898493:web:a0c1ea5dfe4bf23712f054',
};

// アプリ共通のID（これを変えると別のデータボックスになります）
const appId = 'furusato-tax-manager-v1';

let firebaseApp, auth, db;

try {
  firebaseApp = initializeApp(firebaseConfig);
  auth = getAuth(firebaseApp);
  db = getFirestore(firebaseApp);
  console.log('Firebase Connected Successfully');
} catch (e) {
  console.error('Firebase Initialization Error:', e);
}

const App = () => {
  const xlsxStatus = useScript(
    'https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js'
  );

  const [activeTab, setActiveTab] = useState('overview');
  const [selectedCity, setSelectedCity] = useState(
    INITIAL_SUMMARY_DATA[0].name
  );
  const [summaryData, setSummaryData] = useState(INITIAL_SUMMARY_DATA);
  const [detailData, setDetailData] = useState(INITIAL_DETAIL_DATA);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const [uploadStatus, setUploadStatus] = useState('');
  const [uploadMessage, setUploadMessage] = useState('');

  const [user, setUser] = useState(null);
  const [isDbLoading, setIsDbLoading] = useState(false);
  const [dbStatus, setDbStatus] = useState('idle');

  const [aiAnalysis, setAiAnalysis] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [showAiPanel, setShowAiPanel] = useState(false);

  // スクリーンショット用Ref
  const dashboardRef = useRef(null);

  // --- Load Data ---
  const loadFromFirestore = useCallback(async (u) => {
    if (!u || !db) return;
    setIsDbLoading(true);
    setDbStatus('loading');
    try {
      const summaryRef = doc(
        db,
        'artifacts',
        appId,
        'public',
        'data',
        'summary',
        'main'
      );
      const summarySnap = await getDoc(summaryRef);
      if (summarySnap.exists()) {
        setSummaryData(summarySnap.data().list || []);
      }

      const detailsRef = collection(
        db,
        'artifacts',
        appId,
        'public',
        'data',
        'details'
      );
      const detailsSnap = await getDocs(detailsRef);
      const loadedDetails = {};
      detailsSnap.forEach((doc) => {
        loadedDetails[doc.id] = doc.data();
      });

      if (Object.keys(loadedDetails).length > 0) {
        setDetailData((prev) => ({ ...prev, ...loadedDetails }));
      }
      setDbStatus('idle');
    } catch (error) {
      console.error('Error loading data:', error);
      setDbStatus('error');
    } finally {
      setIsDbLoading(false);
    }
  }, []);

  // --- Auth ---
  useEffect(() => {
    if (!auth) return;
    const initAuth = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
      } else {
        await signInAnonymously(auth);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) await loadFromFirestore(u);
    });
    return () => unsubscribe();
  }, [loadFromFirestore]);

  // --- Handle Refresh ---
  const handleRefresh = useCallback(async () => {
    if (user) {
      await loadFromFirestore(user);
    }
  }, [user, loadFromFirestore]);

  // --- Download Image ---
  const handleDownloadImage = async () => {
    if (!dashboardRef.current) return;
    try {
      const canvas = await html2canvas(dashboardRef.current, {
        scale: 2, // 高解像度で保存
        backgroundColor: '#F8FAFC', // bg-slate-50
        logging: false,
      });
      const link = document.createElement('a');
      link.download = `dashboard-${activeTab}-${new Date()
        .toISOString()
        .slice(0, 10)}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('Screenshot failed:', error);
      alert('画像の保存に失敗しました。');
    }
  };

  // --- Save ---
  const saveToFirestore = async (newSummary, newDetails) => {
    if (!user || !db) return;
    setDbStatus('saving');
    try {
      const batch = writeBatch(db);
      const summaryRef = doc(
        db,
        'artifacts',
        appId,
        'public',
        'data',
        'summary',
        'main'
      );
      batch.set(summaryRef, { list: newSummary }, { merge: true });

      Object.entries(newDetails).forEach(([cityName, data]) => {
        const cityRef = doc(
          db,
          'artifacts',
          appId,
          'public',
          'data',
          'details',
          cityName
        );
        batch.set(cityRef, data, { merge: true });
      });

      await batch.commit();
      setDbStatus('saved');
      setTimeout(() => setDbStatus('idle'), 3000);
    } catch (error) {
      console.error('Error saving data:', error);
      setDbStatus('error');
    }
  };

  // --- AI Analysis ---
  const handleRunAIAnalysis = async () => {
    setIsAiLoading(true);
    setShowAiPanel(true);
    setAiAnalysis('');
    try {
      let prompt = '';
      if (activeTab === 'overview') {
        const dataStr = JSON.stringify(
          summaryData.map((d) => ({
            name: d.name,
            current: d.current,
            target: d.target,
            achievement: d.achievement,
            yoy: d.yoy,
          })),
          null,
          2
        );
        prompt = `あなたはふるさと納税の専門データアナリストです。以下のデータから日本語レポートを作成してください。\n## データ\n${dataStr}`;
      } else {
        const detail = detailData[selectedCity];
        const dataStr = JSON.stringify(
          {
            city: selectedCity,
            platforms: detail.platforms,
            monthly: detail.monthly,
            targetMonth: selectedMonth,
          },
          null,
          2
        );
        prompt = `あなたはふるさと納税の専門データアナリストです。${selectedCity}のデータから日本語レポートを作成してください。\n## データ\n${dataStr}`;
      }
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        }
      );
      if (!response.ok) throw new Error(`API Error: ${response.status}`);
      const data = await response.json();
      setAiAnalysis(
        data.candidates?.[0]?.content?.parts?.[0]?.text ||
          '解析できませんでした。'
      );
    } catch (error) {
      setAiAnalysis('エラーが発生しました。');
    } finally {
      setIsAiLoading(false);
    }
  };

  // --- Excel Upload ---
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (xlsxStatus !== 'ready' && typeof window.XLSX === 'undefined') return;

    setUploadStatus('loading');
    setUploadMessage('解析中...');

    let detectedFileMonth = null;
    const monthMatch = file.name.match(/(\d+|[０-９]+)月/);
    if (monthMatch) {
      const mStr = monthMatch[1].replace(/[０-９]/g, (s) =>
        String.fromCharCode(s.charCodeAt(0) - 0xfee0)
      );
      detectedFileMonth = parseInt(mStr, 10);
    }

    try {
      const data = await file.arrayBuffer();
      const workbook = window.XLSX.read(data);

      // 1. Summary Sheet
      const summarySheet = workbook.Sheets[workbook.SheetNames[0]];
      const summaryJson = window.XLSX.utils.sheet_to_json(summarySheet, {
        header: 1,
      });

      let headerRowIndex = summaryJson.findIndex((row) =>
        row.some((cell) => typeof cell === 'string' && cell.includes('自治体'))
      );
      if (headerRowIndex === -1) headerRowIndex = 0;
      const headers = summaryJson[headerRowIndex];
      const nameIdx = headers.findIndex((h) => h && h.includes('自治体'));

      // 列特定の厳密化
      let currentTotalIdx = headers.findIndex(
        (h) => h && h.includes('寄附合計')
      );
      if (currentTotalIdx === -1) {
        currentTotalIdx = headers.findIndex((h) => {
          if (!h) return false;
          const s = String(h);
          const isTargetYear = s.includes('R7') || s.includes('2025');
          const isNotExcluded =
            !s.includes('目標') &&
            !s.includes('対比') &&
            !s.includes('件数') &&
            !s.includes('率') &&
            !s.includes('順位') &&
            !s.includes('No') &&
            !s.includes('月');
          return isTargetYear && isNotExcluded;
        });
      }

      // 単位の自動検出
      let unitMultiplier = 1;
      if (currentTotalIdx !== -1) {
        const headerText = String(headers[currentTotalIdx]);
        if (headerText.includes('千円')) unitMultiplier = 1000;
        else if (headerText.includes('百万円')) unitMultiplier = 1000000;
      }

      const targetIdx = headers.findIndex((h) => h && h.includes('目標額'));
      const achievementIdx = headers.findIndex(
        (h) => h && h.includes('目標達成率')
      );
      let yoyIdx = headers.findIndex(
        (h) => h && h.includes('昨年対比(R7年度)')
      );
      if (yoyIdx === -1)
        yoyIdx = headers.findIndex(
          (h) => h && (h.includes('昨年対比') || h.includes('年対比'))
        );

      const tempSummaryData = [];
      for (let i = headerRowIndex + 1; i < summaryJson.length; i++) {
        const row = summaryJson[i];
        if (!row[nameIdx]) continue;
        const cleanVal = (val) =>
          typeof val === 'number'
            ? val
            : parseFloat(String(val).replace(/,/g, '')) || 0;

        // Use multiplier logic
        const rawVal = cleanVal(row[currentTotalIdx]);
        const currentVal = rawVal * unitMultiplier;

        tempSummaryData.push({
          name: row[nameIdx],
          current: currentVal,
          target: cleanVal(row[targetIdx]) || 1,
          yoy: row[yoyIdx]
            ? Math.round(
                cleanVal(row[yoyIdx]) * (cleanVal(row[yoyIdx]) <= 10 ? 100 : 1)
              )
            : 0,
          achievement: row[achievementIdx]
            ? Math.round(
                cleanVal(row[achievementIdx]) *
                  (cleanVal(row[achievementIdx]) <= 10 ? 100 : 1)
              )
            : 0,
        });
      }

      // 2. Detail Sheets
      const newDetailData = {};
      let mostFrequentMonth = detectedFileMonth;

      workbook.SheetNames.slice(1).forEach((sheetName) => {
        const sheet = workbook.Sheets[sheetName];
        const json = window.XLSX.utils.sheet_to_json(sheet, { header: 1 });
        const summaryItem = tempSummaryData.find((c) => c.name === sheetName);
        if (!summaryItem) return;

        let monthlyData = [];
        let platformData = [];
        let rawDailyData = {};
        let targetMonth = detectedFileMonth || 1;

        if (!detectedFileMonth) {
          for (let r = 0; r < Math.min(50, json.length); r++) {
            const row = json[r];
            if (!row) continue;
            const rowStr = row.map((c) => String(c)).join('');
            const mMatch =
              rowStr.match(/(\d+)月(分|集計|実績)/) ||
              rowStr.match(/(\d+)年(\d+)月/);
            if (mMatch) {
              if (rowStr.match(/(\d+)年(\d+)月/))
                targetMonth = parseInt(mMatch[2], 10);
              else targetMonth = parseInt(mMatch[1], 10);
              break;
            }
          }
        }
        if (targetMonth) mostFrequentMonth = targetMonth;

        if (sheetName.includes('大洗')) {
          const allDailyData = {};

          for (let r = 0; r < json.length; r++) {
            const row = json[r];
            const rowStr = row ? row.map((c) => String(c)).join('') : '';

            if (rowStr.includes('寄附方法別集計')) {
              const dateMatch = rowStr.match(/(\d+)年(\d+)月/);
              if (dateMatch) {
                const year = parseInt(dateMatch[1], 10);
                const month = parseInt(dateMatch[2], 10);

                if (!allDailyData[year]) allDailyData[year] = {};
                if (!allDailyData[year][month]) allDailyData[year][month] = {};

                let dateCol = -1,
                  amountCol = -1,
                  dataStart = -1;
                const platformCols = {};
                for (let h = r + 1; h < Math.min(r + 15, json.length); h++) {
                  const hRow = json[h];
                  if (!hRow) continue;
                  const dIdx = hRow.findIndex((c) =>
                    String(c).includes('日付')
                  );
                  let aIdx = -1;
                  if (dIdx !== -1) {
                    for (let k = dIdx + 1; k < hRow.length; k++) {
                      if (String(hRow[k]).trim() === '金額') {
                        aIdx = k;
                        break;
                      }
                    }
                  }
                  hRow.forEach((cell, idx) => {
                    const cellStr = String(cell).trim();
                    if (PLATFORM_KEYWORDS.some((kw) => cellStr.includes(kw))) {
                      const subHeaderRow = json[h + 1];
                      if (subHeaderRow) {
                        if (String(subHeaderRow[idx]).includes('金額'))
                          platformCols[cellStr] = idx;
                        else if (String(subHeaderRow[idx + 1]).includes('金額'))
                          platformCols[cellStr] = idx + 1;
                        else if (String(subHeaderRow[idx + 2]).includes('金額'))
                          platformCols[cellStr] = idx + 2;
                      }
                    }
                  });

                  if (dIdx !== -1 && aIdx !== -1) {
                    dateCol = dIdx;
                    amountCol = aIdx;
                    dataStart = h + 2;
                    break;
                  }
                }

                if (dataStart !== -1) {
                  const currentMonthPlatformTotals = {};

                  for (
                    let dr = dataStart;
                    dr < Math.min(dataStart + 60, json.length);
                    dr++
                  ) {
                    const dRow = json[dr];
                    if (!dRow) continue;
                    const dVal = dRow[dateCol];
                    const dayStr = String(dVal);

                    if (
                      dayStr.includes('比率') ||
                      (dayStr.includes('寄附方法別集計') && dr > dataStart + 10)
                    )
                      break;
                    if (!dVal) continue;

                    if (dayStr.includes('合計') || dayStr.includes('計')) {
                      continue;
                    }

                    const day = parseInt(dayStr.replace('日', ''));
                    if (!isNaN(day) && day >= 1 && day <= 31) {
                      const val = dRow[amountCol];
                      const dailyAmt =
                        typeof val === 'number'
                          ? val
                          : parseFloat(String(val).replace(/,/g, '')) || 0;
                      allDailyData[year][month][day] = dailyAmt;

                      Object.entries(platformCols).forEach(
                        ([pfName, colIdx]) => {
                          const pfVal = dRow[colIdx];
                          const pfNum =
                            typeof pfVal === 'number'
                              ? pfVal
                              : parseFloat(String(pfVal).replace(/,/g, '')) ||
                                0;
                          if (pfNum > 0) {
                            currentMonthPlatformTotals[pfName] =
                              (currentMonthPlatformTotals[pfName] || 0) + pfNum;
                          }
                        }
                      );
                    }
                  }

                  if (!allDailyData[year][month]['platforms'])
                    allDailyData[year][month]['platforms'] = [];

                  const platformsArray = Object.entries(
                    currentMonthPlatformTotals
                  )
                    .map(([name, value]) => ({ name, value }))
                    .sort((a, b) => b.value - a.value);

                  allDailyData[year][month]['platforms'] = platformsArray;
                }
              }
            }
          }

          rawDailyData = allDailyData;

          let rowIndicesOarai = { thisYear: -1, lastYear: -1, prevYear: -1 };
          let monthlyHeaderRowOarai = -1;

          let candidateHeaders = [];
          for (let r = 0; r < json.length; r++) {
            const row = json[r];
            if (!row) continue;
            const rowStr = row.map((c) => String(c)).join('');
            if (
              rowStr.includes('4月') &&
              rowStr.includes('3月') &&
              rowStr.includes('合計')
            ) {
              candidateHeaders.push(r);
            }
          }

          if (candidateHeaders.length > 0) {
            monthlyHeaderRowOarai = candidateHeaders.reduce((prev, curr) => {
              return Math.abs(curr - 166) < Math.abs(prev - 166) ? curr : prev;
            });
          }

          if (monthlyHeaderRowOarai !== -1) {
            const headerRow = json[monthlyHeaderRowOarai];

            for (
              let r = monthlyHeaderRowOarai + 1;
              r < Math.min(monthlyHeaderRowOarai + 10, json.length);
              r++
            ) {
              const row = json[r];
              if (!row) continue;
              const rowStr = row.map((c) => String(c)).join('');

              if (
                (rowStr.includes('今年') ||
                  rowStr.includes('R7') ||
                  rowStr.includes('2025')) &&
                (rowStr.includes('千') || rowStr.includes('円'))
              ) {
                rowIndicesOarai.thisYear = r;
              } else if (
                (rowStr.includes('前年') ||
                  rowStr.includes('R6') ||
                  rowStr.includes('2024')) &&
                (rowStr.includes('千') || rowStr.includes('円')) &&
                !rowStr.includes('前々年')
              ) {
                rowIndicesOarai.lastYear = r;
              } else if (
                (rowStr.includes('前々年') ||
                  rowStr.includes('R5') ||
                  rowStr.includes('2023')) &&
                (rowStr.includes('千') || rowStr.includes('円'))
              ) {
                rowIndicesOarai.prevYear = r;
              }
            }

            monthlyData = FISCAL_YEAR_MONTHS.map((m) => {
              const colIdx = headerRow.findIndex((c) => {
                let s = String(c).trim();
                if (s.startsWith('0')) s = s.substring(1);
                return s === m;
              });
              const getData = (rowIdx) => {
                if (rowIdx === -1 || colIdx === -1) return 0;
                const dataRow = json[rowIdx];
                if (!dataRow) return 0;
                const rawVal = dataRow[colIdx];
                const val =
                  rawVal !== undefined && rawVal !== null && rawVal !== ''
                    ? typeof rawVal === 'number'
                      ? rawVal
                      : parseFloat(String(rawVal).replace(/,/g, '')) || 0
                    : 0;
                return val;
              };
              const thisYear = getData(rowIndicesOarai.thisYear);
              const lastYear = getData(rowIndicesOarai.lastYear);
              const prevYear = getData(rowIndicesOarai.prevYear);
              const yoyRate =
                lastYear > 0
                  ? parseFloat(((thisYear / lastYear) * 100).toFixed(1))
                  : 0;
              return { month: m, thisYear, lastYear, prevYear, yoyRate };
            });
          } else {
            monthlyData = generateMonthlyData(summaryItem.current);
          }

          const specificRangePortals = [];

          let portalNameColIdx = -1;
          let valueColIdx = -1;
          let headerRowIndexSpecific = -1;

          for (let r = 0; r < Math.min(20, json.length); r++) {
            const row = json[r];
            if (!row) continue;
            for (let c = 0; c < row.length; c++) {
              const cellVal = String(row[c]).trim();
              if (cellVal === '寄附方法') {
                portalNameColIdx = c;
                headerRowIndexSpecific = r;
                for (let c2 = 0; c2 < row.length; c2++) {
                  if (c2 === c) continue;
                  const headerVal = String(row[c2]).trim();
                  if (
                    headerVal.includes('金額') ||
                    headerVal.includes('寄附額') ||
                    headerVal.includes('実績') ||
                    headerVal.includes('計')
                  ) {
                    valueColIdx = c2;
                    if (
                      headerVal.includes('金額') ||
                      headerVal.includes('寄附額')
                    )
                      break;
                  }
                }
                if (valueColIdx === -1) {
                  for (let c2 = 0; c2 < row.length; c2++) {
                    if (c2 === c) continue;
                    const headerVal = String(row[c2]).trim();
                    if (
                      headerVal.includes('比率') ||
                      headerVal.includes('構成比')
                    ) {
                      valueColIdx = c2;
                      break;
                    }
                  }
                }
                break;
              }
            }
            if (portalNameColIdx !== -1) break;
          }

          if (portalNameColIdx === -1) {
            if (
              json[3] &&
              json[3][56] &&
              String(json[3][56]).includes('寄附方法')
            ) {
              portalNameColIdx = 56;
              headerRowIndexSpecific = 3;
              valueColIdx = 57;
            }
          }

          if (
            portalNameColIdx !== -1 &&
            valueColIdx !== -1 &&
            headerRowIndexSpecific !== -1
          ) {
            for (
              let r = headerRowIndexSpecific + 1;
              r < Math.min(headerRowIndexSpecific + 30, json.length);
              r++
            ) {
              const row = json[r];
              if (!row) continue;
              const nameVal = row[portalNameColIdx];
              const valVal = row[valueColIdx];

              if (
                nameVal &&
                (typeof valVal === 'number' || typeof valVal === 'string')
              ) {
                const sName = String(nameVal).trim();
                if (!sName || sName === '合計' || sName.includes('計'))
                  continue;
                let sAmount =
                  typeof valVal === 'number'
                    ? valVal
                    : parseFloat(String(valVal).replace(/,/g, '')) || 0;
                if (sAmount > 0)
                  specificRangePortals.push({ name: sName, value: sAmount });
              }
            }
          }

          if (specificRangePortals.length > 0) {
            const totalExtracted = specificRangePortals.reduce(
              (sum, p) => sum + p.value,
              0
            );

            let correctTotal = 0;
            if (detectedFileMonth) {
              const mData = monthlyData.find(
                (m) =>
                  m.month === `${detectedFileMonth}月` ||
                  m.month === `0${detectedFileMonth}月`
              );
              if (mData) correctTotal = mData.thisYear;
            }

            if (correctTotal > 0) {
              if (
                totalExtracted > correctTotal * 1.5 ||
                totalExtracted <= 1.1
              ) {
                specificRangePortals.forEach((p) => {
                  p.value = (p.value / totalExtracted) * correctTotal;
                });
              }
            }

            if (detectedFileMonth) {
              const y = getFiscalYearCalendarYear(
                CURRENT_FISCAL_YEAR,
                detectedFileMonth
              );
              if (!rawDailyData[y]) rawDailyData[y] = {};
              if (!rawDailyData[y][detectedFileMonth])
                rawDailyData[y][detectedFileMonth] = {};
              rawDailyData[y][detectedFileMonth]['platforms'] =
                specificRangePortals.sort((a, b) => b.value - a.value);
            }
          }
        } else {
          let monthlyHeaderRowIdx = -1;
          let rowIndices = { thisYear: -1, lastYear: -1, prevYear: -1 };

          for (let r = 0; r < 20; r++) {
            const row = json[r];
            if (!row) continue;
            const rowStr = row.map((c) => String(c)).join('');
            if (rowStr.includes('4月') || rowStr.includes('04月')) {
              monthlyHeaderRowIdx = r;
              break;
            }
          }

          if (monthlyHeaderRowIdx !== -1) {
            for (
              let r = monthlyHeaderRowIdx + 1;
              r < Math.min(monthlyHeaderRowIdx + 20, json.length);
              r++
            ) {
              const row = json[r];
              if (!row) continue;
              const rowStrJoined = row.map((c) => String(c)).join('');
              if (rowStrJoined.includes('千円')) {
                if (
                  rowStrJoined.includes('今年') ||
                  rowStrJoined.includes('R7') ||
                  rowStrJoined.includes('2025')
                )
                  rowIndices.thisYear = r;
                else if (
                  rowStrJoined.includes('前々年') ||
                  (rowStrJoined.includes('R5') &&
                    !rowStrJoined.includes('R7') &&
                    !rowStrJoined.includes('R6'))
                )
                  rowIndices.prevYear = r;
                else if (
                  rowStrJoined.includes('前年') ||
                  (rowStrJoined.includes('R6') && !rowStrJoined.includes('R7'))
                )
                  rowIndices.lastYear = r;
              }
            }
          }

          if (monthlyHeaderRowIdx !== -1) {
            const headerRow = json[monthlyHeaderRowIdx];
            monthlyData = FISCAL_YEAR_MONTHS.map((m) => {
              const colIdx = headerRow.findIndex((c) => {
                let s = String(c).trim();
                if (s.startsWith('0')) s = s.substring(1);
                return s === m;
              });
              const getData = (rowIdx) => {
                if (rowIdx === -1 || colIdx === -1) return 0;
                const dataRow = json[rowIdx];
                if (!dataRow) return 0;
                const rawVal = dataRow[colIdx];
                let val = 0;
                if (rawVal !== undefined && rawVal !== null && rawVal !== '') {
                  val =
                    typeof rawVal === 'number'
                      ? rawVal
                      : parseFloat(String(rawVal).replace(/,/g, '')) || 0;
                }
                return val * 1000;
              };
              const thisYear = getData(rowIndices.thisYear);
              const lastYear = getData(rowIndices.lastYear);
              const prevYear = getData(rowIndices.prevYear);
              const yoyRate =
                lastYear > 0
                  ? parseFloat(((thisYear / lastYear) * 100).toFixed(1))
                  : 0;
              return { month: m, thisYear, lastYear, prevYear, yoyRate };
            });
          } else {
            monthlyData = generateMonthlyData(summaryItem.current);
          }

          const extractDailyFromYearBlock = (
            yearKeywords,
            excludeKeywords = []
          ) => {
            let daily = {};
            let platformStats = [];
            let foundBlock = false;

            for (let r = 0; r < json.length; r++) {
              if (foundBlock) break;
              const row = json[r];
              if (!row) continue;
              const rowStr = row.map((c) => String(c)).join(' ');

              if (yearKeywords.some((kw) => rowStr.includes(kw))) {
                if (
                  excludeKeywords.length > 0 &&
                  excludeKeywords.some((kw) => rowStr.includes(kw))
                )
                  continue;

                let headerRow = null;
                let headerRowIdx = -1;
                for (let h = r + 1; h < Math.min(r + 10, json.length); h++) {
                  const hRow = json[h];
                  if (!hRow) continue;
                  const hRowStr = hRow.map((c) => String(c)).join('');
                  if (
                    hRow.some(
                      (c) =>
                        String(c).trim() === '1' || String(c).trim() === '1日'
                    )
                  ) {
                    headerRow = hRow;
                    headerRowIdx = h;
                    break;
                  }
                  if (
                    targetMonth &&
                    (hRowStr.includes(`${targetMonth}月`) ||
                      hRowStr.includes(`0${targetMonth}月`))
                  ) {
                    headerRow = hRow;
                    headerRowIdx = h;
                    break;
                  }
                }

                if (headerRow) {
                  foundBlock = true;
                  let totalColIdx = headerRow.findIndex(
                    (c) =>
                      String(c).includes('合計') || String(c).trim() === '計'
                  );
                  let targetMonthColIdx = -1;
                  if (targetMonth) {
                    targetMonthColIdx = headerRow.findIndex((c) => {
                      const s = String(c).trim();
                      return (
                        s === `${targetMonth}月` || s === `0${targetMonth}月`
                      );
                    });
                  }

                  let maxRowTotal = -1;

                  for (
                    let d = headerRowIdx + 1;
                    d < Math.min(headerRowIdx + 60, json.length);
                    d++
                  ) {
                    const dRow = json[d];
                    if (!dRow) continue;
                    const rowStrFull = dRow.map((c) => String(c)).join('');
                    if (/(20\d{2}|R\d+)(年度|年)/.test(rowStrFull)) break;

                    const dRowStr = dRow.map((c) => String(c)).join('');
                    const rowLabel = String(dRow[0] || '').trim();

                    if (PLATFORM_KEYWORDS.some((kw) => rowLabel.includes(kw))) {
                      let val = 0;
                      if (targetMonthColIdx !== -1) {
                        val = dRow[targetMonthColIdx];
                      } else if (totalColIdx !== -1 && !targetMonth) {
                        val = dRow[totalColIdx];
                      }

                      const numVal =
                        typeof val === 'number'
                          ? val
                          : parseFloat(String(val).replace(/,/g, '')) || 0;
                      if (numVal > 0) {
                        if (!platformStats.some((p) => p.name === rowLabel)) {
                          platformStats.push({
                            name: rowLabel,
                            value: numVal * 1000,
                          });
                        }
                      }
                    }

                    if (dRowStr.includes('合計') || dRowStr.includes('計')) {
                      let tempDaily = {};
                      let tempTotal = 0;
                      for (let day = 1; day <= 31; day++) {
                        const colIdx = headerRow.findIndex((c) => {
                          let s = String(c).trim();
                          s = s.replace(/[０-９]/g, (s) =>
                            String.fromCharCode(s.charCodeAt(0) - 0xfee0)
                          );
                          return s === `${day}` || s === `${day}日`;
                        });
                        if (colIdx !== -1) {
                          const val = dRow[colIdx];
                          const numVal =
                            typeof val === 'number'
                              ? val
                              : parseFloat(String(val).replace(/,/g, '')) || 0;
                          tempDaily[day] = numVal * 1000;
                          tempTotal += numVal;
                        }
                      }

                      if (tempTotal > maxRowTotal) {
                        maxRowTotal = tempTotal;
                        daily = tempDaily;
                      }
                    }
                  }
                }
              }
            }
            return { daily, platformStats };
          };

          const data2025 = extractDailyFromYearBlock(['2025年度', 'R7年度']);
          const data2024 = extractDailyFromYearBlock(
            ['2024年度', 'R6年度'],
            ['2025', 'R7', 'R07']
          );
          const data2023 = extractDailyFromYearBlock(
            ['2023年度', 'R5年度'],
            ['2025', 'R7', 'R07', '2024', 'R6', 'R06']
          );

          const realYear = getFiscalYearCalendarYear(
            CURRENT_FISCAL_YEAR,
            targetMonth
          );
          const lastYear = getFiscalYearCalendarYear(
            CURRENT_FISCAL_YEAR - 1,
            targetMonth
          );
          const prevYear = getFiscalYearCalendarYear(
            CURRENT_FISCAL_YEAR - 2,
            targetMonth
          );

          if (!rawDailyData[realYear]) rawDailyData[realYear] = {};
          if (!rawDailyData[lastYear]) rawDailyData[lastYear] = {};
          if (!rawDailyData[prevYear]) rawDailyData[prevYear] = {};

          if (Object.keys(data2025.daily).length > 0)
            rawDailyData[realYear][targetMonth] = data2025.daily;
          if (Object.keys(data2024.daily).length > 0)
            rawDailyData[lastYear][targetMonth] = data2024.daily;
          if (Object.keys(data2023.daily).length > 0)
            rawDailyData[prevYear][targetMonth] = data2023.daily;

          if (data2025.platformStats.length > 0) {
            platformData = data2025.platformStats;

            const totalExtracted = platformData.reduce(
              (sum, p) => sum + p.value,
              0
            );
            let correctTotal = 0;

            const targetMStr = detectedFileMonth
              ? detectedFileMonth < 10
                ? `0${detectedFileMonth}月`
                : `${detectedFileMonth}月`
              : `${targetMonth}月`;
            const mDataSimple = monthlyData.find(
              (m) => parseInt(m.month.replace('月', '')) === targetMonth
            );

            if (mDataSimple) correctTotal = mDataSimple.thisYear;

            if (
              correctTotal > 0 &&
              (totalExtracted > correctTotal * 1.5 || totalExtracted <= 1.1)
            ) {
              platformData.forEach((p) => {
                p.value = (p.value / totalExtracted) * correctTotal;
              });
            }

            if (!rawDailyData[realYear]) rawDailyData[realYear] = {};
            if (!rawDailyData[realYear][targetMonth])
              rawDailyData[realYear][targetMonth] = {};

            rawDailyData[realYear][targetMonth]['platforms'] =
              platformData.sort((a, b) => b.value - a.value);
          }

          if (platformData.length === 0 && detectedFileMonth) {
            let portalNameColIdx = -1;
            let valueColIdx = -1;
            let headerRowIndexSpecific = -1;

            for (let r = 0; r < Math.min(20, json.length); r++) {
              const row = json[r];
              if (!row) continue;
              for (let c = 0; c < row.length; c++) {
                const cellVal = String(row[c]).trim();
                if (cellVal === '寄附方法') {
                  portalNameColIdx = c;
                  headerRowIndexSpecific = r;

                  for (let c2 = 0; c2 < row.length; c2++) {
                    if (c2 === c) continue;
                    const headerVal = String(row[c2]).trim();
                    if (
                      headerVal.includes('金額') ||
                      headerVal.includes('寄附額') ||
                      headerVal.includes('実績') ||
                      headerVal.includes('計')
                    ) {
                      valueColIdx = c2;
                      if (
                        headerVal.includes('金額') ||
                        headerVal.includes('寄附額')
                      )
                        break;
                    }
                  }
                  if (valueColIdx === -1) {
                    for (let c2 = 0; c2 < row.length; c2++) {
                      if (c2 === c) continue;
                      const headerVal = String(row[c2]).trim();
                      if (
                        headerVal.includes('比率') ||
                        headerVal.includes('構成比')
                      ) {
                        valueColIdx = c2;
                        break;
                      }
                    }
                  }
                  break;
                }
              }
              if (portalNameColIdx !== -1) break;
            }

            if (portalNameColIdx !== -1 && valueColIdx !== -1) {
              for (
                let r = headerRowIndexSpecific + 1;
                r < Math.min(headerRowIndexSpecific + 30, json.length);
                r++
              ) {
                const row = json[r];
                if (!row) continue;
                const nameVal = row[portalNameColIdx];
                const valVal = row[valueColIdx];

                if (
                  nameVal &&
                  (typeof valVal === 'number' || typeof valVal === 'string')
                ) {
                  const sName = String(nameVal).trim();
                  if (!sName || sName === '合計' || sName.includes('計'))
                    continue;
                  let sAmount =
                    typeof valVal === 'number'
                      ? valVal
                      : parseFloat(String(valVal).replace(/,/g, '')) || 0;
                  if (sAmount > 0) {
                    platformData.push({ name: sName, value: sAmount });
                  }
                }
              }
            }
          }

          if (platformData.length > 0) {
            const totalExtracted = platformData.reduce(
              (sum, p) => sum + p.value,
              0
            );
            let correctTotal = 0;

            const targetMStr = detectedFileMonth
              ? detectedFileMonth < 10
                ? `0${detectedFileMonth}月`
                : `${detectedFileMonth}月`
              : `${targetMonth}月`;
            const mDataSimple = monthlyData.find(
              (m) => parseInt(m.month.replace('月', '')) === targetMonth
            );

            if (mDataSimple) correctTotal = mDataSimple.thisYear;

            if (correctTotal > 0) {
              const ratio = totalExtracted / correctTotal;
              if (ratio > 1.5 || ratio < 0.8 || totalExtracted <= 10) {
                platformData.forEach((p) => {
                  p.value = (p.value / totalExtracted) * correctTotal;
                });
              } else if (totalExtracted < correctTotal * 0.01) {
                platformData.forEach((p) => {
                  p.value = (p.value / totalExtracted) * correctTotal;
                });
              }
            }

            if (!rawDailyData[realYear]) rawDailyData[realYear] = {};
            if (!rawDailyData[realYear][targetMonth])
              rawDailyData[realYear][targetMonth] = {};

            rawDailyData[realYear][targetMonth]['platforms'] =
              platformData.sort((a, b) => b.value - a.value);
          }
        }

        newDetailData[sheetName] = {
          platforms: platformData.sort((a, b) => b.value - a.value),
          monthly: monthlyData,
          rawDailyData: rawDailyData,
          targetMonth: targetMonth,
        };

        // 補正処理
        monthlyData.forEach((mItem) => {
          const m = parseInt(mItem.month.replace('月', ''));
          const y = getFiscalYearCalendarYear(CURRENT_FISCAL_YEAR, m);

          let dailyTotal = 0;
          if (rawDailyData[y] && rawDailyData[y][m]) {
            const days = rawDailyData[y][m];
            Object.entries(days).forEach(([dayKey, val]) => {
              const dayNum = parseInt(dayKey);
              if (!isNaN(dayNum) && typeof val === 'number') {
                dailyTotal += val;
              }
            });
          }

          const isTargetMonth = detectedFileMonth === m;

          if (dailyTotal > 0) {
            if (mItem.thisYear === 0 || isTargetMonth) {
              mItem.thisYear = dailyTotal;
            }
          }
        });
      });

      // --- マージと保存 ---
      const mergedSummary = [...summaryData];
      const fileFiscalIdx = detectedFileMonth
        ? MONTHS_ORDER.indexOf(detectedFileMonth)
        : -1;

      tempSummaryData.forEach((newItem) => {
        const idx = mergedSummary.findIndex((d) => d.name === newItem.name);
        if (idx !== -1) {
          const currentItem = mergedSummary[idx];
          const currentFiscalIdx = currentItem.dataMonth
            ? MONTHS_ORDER.indexOf(currentItem.dataMonth)
            : -1;

          let shouldUpdate = false;
          if (fileFiscalIdx > -1) {
            if (fileFiscalIdx >= currentFiscalIdx) {
              shouldUpdate = true;
            }
          } else {
            if (newItem.current >= currentItem.current) {
              shouldUpdate = true;
            }
          }

          if (shouldUpdate) {
            mergedSummary[idx] = {
              ...newItem,
              dataMonth: detectedFileMonth || currentItem.dataMonth,
            };
          }
        } else {
          mergedSummary.push({
            ...newItem,
            dataMonth: detectedFileMonth,
          });
        }
      });

      setDetailData((prev) => {
        const merged = { ...prev };
        Object.entries(newDetailData).forEach(([key, val]) => {
          const existing = merged[key];
          const mergedRaw =
            existing && existing.rawDailyData
              ? JSON.parse(JSON.stringify(existing.rawDailyData))
              : {};

          Object.keys(val.rawDailyData).forEach((y) => {
            if (!mergedRaw[y]) mergedRaw[y] = {};
            Object.keys(val.rawDailyData[y]).forEach((m) => {
              if (Object.keys(val.rawDailyData[y][m]).length > 0) {
                mergedRaw[y][m] = val.rawDailyData[y][m];
              }
            });
          });

          let mergedMonthly = [];
          if (
            existing &&
            Array.isArray(existing.monthly) &&
            existing.monthly.length > 0
          ) {
            mergedMonthly = JSON.parse(JSON.stringify(existing.monthly));
          } else {
            mergedMonthly = JSON.parse(JSON.stringify(val.monthly));
          }

          const fileMonthFiscalIdx = detectedFileMonth
            ? MONTHS_ORDER.indexOf(detectedFileMonth)
            : -1;

          if (Array.isArray(val.monthly)) {
            val.monthly.forEach((newM, i) => {
              const newMonthNum = parseInt(newM.month.replace('月', ''));
              const newMonthFiscalIdx = MONTHS_ORDER.indexOf(newMonthNum);

              let allowUpdate = true;
              if (fileMonthFiscalIdx !== -1 && newMonthFiscalIdx !== -1) {
                if (newMonthFiscalIdx > fileMonthFiscalIdx) {
                  allowUpdate = false;
                }
              }

              if (allowUpdate) {
                if (!mergedMonthly[i]) {
                  mergedMonthly[i] = { ...newM };
                } else {
                  if (newM.thisYear > 0)
                    mergedMonthly[i].thisYear = newM.thisYear;
                  if (newM.lastYear > 0)
                    mergedMonthly[i].lastYear = newM.lastYear;
                  if (newM.prevYear > 0)
                    mergedMonthly[i].prevYear = newM.prevYear;
                  if (newM.yoyRate > 0) mergedMonthly[i].yoyRate = newM.yoyRate;
                }
              }
            });
          }

          merged[key] = {
            ...existing,
            ...val,
            rawDailyData: mergedRaw,
            monthly: mergedMonthly,
          };
        });

        saveToFirestore(mergedSummary, merged);
        return merged;
      });

      setSummaryData(mergedSummary);
      if (mostFrequentMonth) setSelectedMonth(mostFrequentMonth);
      setUploadStatus('success');
      setUploadMessage('更新完了');
      setTimeout(() => {
        setUploadStatus('');
        setUploadMessage('');
      }, 4000);
    } catch (error) {
      console.error(error);
      setUploadStatus('error');
      setUploadMessage('エラー: 解析に失敗しました');
    }
  };

  const currentCityDetail = useMemo(() => {
    const detail = detailData[selectedCity];
    if (detail) return detail;
    return { monthly: [], rawDailyData: {}, platforms: [], targetMonth: 1 };
  }, [detailData, selectedCity]);

  // チャートコンポーネント
  const DailyComparisonChart = () => {
    const raw = currentCityDetail.rawDailyData || {};
    const baseYear = getFiscalYearCalendarYear(
      CURRENT_FISCAL_YEAR,
      selectedMonth
    );

    const data = [];
    let hasData = false;
    for (let d = 1; d <= 31; d++) {
      const y2025 = raw[baseYear]?.[selectedMonth]?.[d] || 0;
      const y2024 = raw[baseYear - 1]?.[selectedMonth]?.[d] || 0;
      const y2023 = raw[baseYear - 2]?.[selectedMonth]?.[d] || 0;
      if (y2025 || y2024 || y2023) hasData = true;

      const yoyRate =
        y2024 > 0 ? parseFloat(((y2025 / y2024) * 100).toFixed(1)) : 0;
      data.push({ day: `${selectedMonth}/${d}`, y2025, y2024, y2023, yoyRate });
    }

    if (!hasData)
      return (
        <div className="h-full flex items-center justify-center text-slate-400">
          データなし
        </div>
      );

    return (
      <ResponsiveContainer width="100%" height={350}>
        <ComposedChart
          data={data}
          margin={{ top: 10, right: 30, left: 10, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="day" tick={{ fontSize: 10 }} interval={2} />
          <YAxis
            yAxisId="left"
            tickFormatter={(val) => `${(val / 10000).toFixed(0)}万`}
            width={40}
            tick={{ fontSize: 10 }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            unit="%"
            width={40}
            tick={{ fontSize: 10 }}
          />
          <RechartsTooltip
            formatter={(value, name) => [
              name === '昨対比' ? `${value}%` : formatCurrency(value),
              name,
            ]}
            labelFormatter={(label) => String(label)}
          />
          <Legend wrapperStyle={{ paddingTop: '10px' }} iconType="circle" />
          <ReferenceLine
            yAxisId="right"
            y={100}
            stroke="red"
            strokeDasharray="3 3"
            label={{
              position: 'right',
              value: '100%',
              fill: 'red',
              fontSize: 10,
            }}
          />
          <Bar
            yAxisId="left"
            dataKey="y2025"
            name="2025年度 (R7)"
            fill="#0088FE"
            radius={[4, 4, 0, 0]}
          />
          <Bar
            yAxisId="left"
            dataKey="y2024"
            name="2024年度 (R6)"
            fill="#00C49F"
            radius={[4, 4, 0, 0]}
          />
          <Bar
            yAxisId="left"
            dataKey="y2023"
            name="2023年度 (R5)"
            fill="#FF8042"
            radius={[4, 4, 0, 0]}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="yoyRate"
            name="昨対比"
            stroke="#FF0000"
            strokeWidth={2}
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    );
  };

  // 累計推移チャート
  const CumulativeChart = () => {
    const monthly = currentCityDetail.monthly || [];

    // 累計データの計算
    let tCum = 0,
      lCum = 0,
      pCum = 0;
    const data = monthly.map((m) => {
      if (m.thisYear > 0 || tCum > 0) tCum += m.thisYear;
      lCum += m.lastYear;
      pCum += m.prevYear;

      return {
        month: m.month,
        thisYear: m.thisYear === 0 && tCum === 0 ? null : tCum,
        lastYear: lCum,
        prevYear: pCum,
      };
    });

    const lastValidIndex = data.findIndex((d) => d.thisYear === null);
    const displayData = data.map((d, i) => ({
      ...d,
      thisYear:
        lastValidIndex !== -1 && i >= lastValidIndex ? null : d.thisYear,
    }));

    return (
      <ResponsiveContainer width="100%" height={300}>
        <LineChart
          data={displayData}
          margin={{ top: 10, right: 30, left: 10, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 10 }} />
          <YAxis
            tickFormatter={(val) => `${(val / 100000000).toFixed(1)}億`}
            width={40}
            tick={{ fontSize: 10 }}
          />
          <RechartsTooltip formatter={(value) => formatCurrency(value)} />
          <Legend wrapperStyle={{ paddingTop: '10px' }} iconType="circle" />
          <Line
            type="monotone"
            dataKey="thisYear"
            name="今年(R7) 累計"
            stroke="#0088FE"
            strokeWidth={3}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
          />
          <Line
            type="monotone"
            dataKey="lastYear"
            name="前年(R6) 累計"
            stroke="#00C49F"
            strokeWidth={2}
            dot={false}
            strokeDasharray="5 5"
          />
          <Line
            type="monotone"
            dataKey="prevYear"
            name="前々年(R5) 累計"
            stroke="#FF8042"
            strokeWidth={2}
            dot={false}
            strokeDasharray="3 3"
          />
        </LineChart>
      </ResponsiveContainer>
    );
  };

  // ポータルシェア円グラフ
  const PlatformShareChart = () => {
    const currentMonthPlatforms = useMemo(() => {
      const detail = detailData[selectedCity];
      if (!detail) return [];

      const y = getFiscalYearCalendarYear(CURRENT_FISCAL_YEAR, selectedMonth);
      const dailyData = detail.rawDailyData?.[y]?.[selectedMonth];
      if (dailyData && dailyData.platforms && dailyData.platforms.length > 0) {
        return dailyData.platforms;
      }
      return detail.platforms || [];
    }, [detailData, selectedCity, selectedMonth]);

    const data = currentMonthPlatforms;
    if (data.length === 0)
      return (
        <div className="h-full flex items-center justify-center text-slate-400">
          データなし
        </div>
      );

    return (
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={40}
            outerRadius={70}
            fill="#8884d8"
            paddingAngle={2}
            dataKey="value"
            label={({ name, percent }) =>
              `${name} ${(percent * 100).toFixed(0)}%`
            }
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={COLORS[index % COLORS.length]}
              />
            ))}
          </Pie>
          <RechartsTooltip formatter={(value) => formatCurrency(value)} />
          <Legend
            layout="horizontal"
            verticalAlign="bottom"
            align="center"
            wrapperStyle={{ fontSize: '10px' }}
          />
        </PieChart>
      </ResponsiveContainer>
    );
  };

  // 目標達成率 vs 昨年対比 (集計シート値) チャート
  const SummaryChart = () => (
    <ResponsiveContainer width="100%" height={400}>
      <ComposedChart
        layout="vertical"
        data={[...summaryData].sort((a, b) => b.achievement - a.achievement)}
        margin={{ top: 20, right: 30, left: 60, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" unit="%" />
        <YAxis
          dataKey="name"
          type="category"
          width={80}
          tick={{ fontSize: 12, fontWeight: 'bold' }}
        />
        <RechartsTooltip
          formatter={(value, name) => {
            return [`${value}%`, name];
          }}
        />
        <Legend wrapperStyle={{ paddingTop: '10px' }} />
        <Bar
          dataKey="achievement"
          name="目標達成率"
          fill="#3b82f6"
          radius={[0, 4, 4, 0]}
          barSize={12}
        />
        <Bar
          dataKey="yoy"
          name="昨年対比"
          fill="#10b981"
          radius={[0, 4, 4, 0]}
          barSize={12}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );

  return (
    <div className="flex h-screen bg-slate-50 text-slate-800 font-sans overflow-hidden">
      {/* サイドバー */}
      <div
        className={`fixed inset-y-0 left-0 z-50 bg-slate-900 text-white transition-all duration-300 ease-in-out flex flex-col ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } md:relative md:translate-x-0 ${isCollapsed ? 'w-20' : 'w-72'}`}
      >
        {/* モバイル用閉じるボタン */}
        <button
          onClick={() => setIsSidebarOpen(false)}
          className="md:hidden absolute top-4 right-4 text-slate-400 hover:text-white p-2"
        >
          <X size={24} />
        </button>

        {/* トグルボタン (デスクトップのみ) */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="hidden md:flex absolute -right-3 top-9 bg-slate-700 rounded-full p-1 border border-slate-600 text-slate-300 hover:text-white hover:bg-slate-600 shadow-md z-50"
        >
          {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>

        {/* ヘッダー */}
        <div
          className={`p-6 border-b border-slate-700 flex items-center ${
            isCollapsed ? 'justify-center' : 'gap-2'
          }`}
        >
          <LayoutDashboard size={24} className="text-blue-400 shrink-0" />
          {!isCollapsed && (
            <h1 className="text-xl font-bold leading-tight">
              ふるさと納税
              <br />
              管理ボード
            </h1>
          )}
        </div>

        {/* ナビゲーション */}
        <nav className="p-4 space-y-2 flex-1">
          <button
            onClick={() => {
              setActiveTab('overview');
              setIsSidebarOpen(false);
            }}
            className={`w-full flex items-center px-4 py-3 rounded-lg transition-colors ${
              activeTab === 'overview'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'text-slate-300 hover:bg-slate-800'
            } ${isCollapsed ? 'justify-center' : 'gap-3'}`}
            title={isCollapsed ? '全体サマリー' : ''}
          >
            <TrendingUp size={20} className="shrink-0" />
            {!isCollapsed && <span>全体サマリー</span>}
          </button>
          <button
            onClick={() => {
              setActiveTab('detail');
              setIsSidebarOpen(false);
            }}
            className={`w-full flex items-center px-4 py-3 rounded-lg transition-colors ${
              activeTab === 'detail'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'text-slate-300 hover:bg-slate-800'
            } ${isCollapsed ? 'justify-center' : 'gap-3'}`}
            title={isCollapsed ? '個別詳細・昨対分析' : ''}
          >
            <FileSpreadsheet size={20} className="shrink-0" />
            {!isCollapsed && <span>個別詳細・昨対分析</span>}
          </button>
        </nav>

        {/* Database Status */}
        {!isCollapsed && (
          <div className="px-4 pb-2">
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
              <Database size={14} />
              <span>データ保存状況</span>
            </div>
            <div className="bg-slate-800 rounded px-3 py-2 border border-slate-700 flex items-center justify-between">
              <span
                className={`text-xs flex items-center gap-1 ${
                  dbStatus === 'saving'
                    ? 'text-yellow-400'
                    : dbStatus === 'saved'
                    ? 'text-emerald-400'
                    : 'text-slate-400'
                }`}
              >
                {dbStatus === 'idle' && <CheckCircle size={12} />}
                {dbStatus === 'saving' && (
                  <Activity size={12} className="animate-spin" />
                )}
                {dbStatus === 'loading' && (
                  <Activity size={12} className="animate-spin" />
                )}
                {dbStatus === 'saved' && <Cloud size={12} />}
                {dbStatus === 'idle'
                  ? '変更なし'
                  : dbStatus === 'saving'
                  ? '保存中...'
                  : dbStatus === 'loading'
                  ? '読込中...'
                  : '保存完了'}
              </span>
              {dbStatus === 'saved' && (
                <span className="text-[10px] text-slate-500">Just now</span>
              )}
            </div>
          </div>
        )}

        {/* Upload Area */}
        <div className="p-4 border-t border-slate-700 bg-slate-800">
          <label className="flex flex-col gap-2 cursor-pointer group">
            {!isCollapsed && (
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 group-hover:text-blue-400 transition-colors">
                  データ一括更新
                </span>
                {uploadStatus === 'loading' && (
                  <Activity size={12} className="animate-spin text-blue-400" />
                )}
                {uploadStatus === 'success' && (
                  <CheckCircle size={12} className="text-emerald-400" />
                )}
                {uploadStatus === 'error' && (
                  <AlertCircle size={12} className="text-red-400" />
                )}
              </div>
            )}

            <div
              className={`relative flex items-center justify-center bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-md transition-colors border border-slate-600 group-hover:border-blue-500 border-dashed overflow-hidden ${
                isCollapsed ? 'p-3' : 'px-3 py-4 gap-2'
              }`}
              title={isCollapsed ? 'Excelをドロップ' : ''}
            >
              <Upload size={isCollapsed ? 20 : 18} className="shrink-0" />
              {!isCollapsed && (
                <span className="text-sm font-bold">Excelをドロップ</span>
              )}
              <input
                type="file"
                className="hidden"
                accept=".xlsx, .xls"
                onChange={handleFileUpload}
              />
              {uploadStatus === 'loading' && (
                <div className="absolute bottom-0 left-0 h-1 bg-blue-500 animate-pulse w-full"></div>
              )}
            </div>

            {!isCollapsed && uploadMessage && (
              <p
                className={`text-[10px] leading-tight mt-1 ${
                  uploadStatus === 'error'
                    ? 'text-red-400'
                    : uploadStatus === 'success'
                    ? 'text-emerald-400'
                    : 'text-blue-300'
                }`}
              >
                {uploadMessage}
              </p>
            )}
          </label>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        <header className="bg-white border-b border-slate-200 p-4 flex justify-between items-center md:hidden">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="text-slate-600"
          >
            <Menu size={24} />
          </button>
          <span className="font-bold text-slate-800">ダッシュボード</span>
          <div className="w-6"></div>
        </header>

        {/* Header with AI Button & Refresh */}
        <div className="bg-white px-8 py-4 border-b border-slate-100 flex justify-between items-center">
          <h2 className="text-xl font-bold text-slate-800">
            {activeTab === 'overview' ? '全体サマリー' : '個別詳細・昨対分析'}
          </h2>
          <div className="flex gap-2">
            <button
              onClick={handleRefresh}
              disabled={isDbLoading}
              className="flex items-center gap-2 bg-slate-100 text-slate-600 px-4 py-2 rounded-lg hover:bg-slate-200 transition-all disabled:opacity-50"
              title="データを再読み込み"
            >
              <RefreshCw
                size={18}
                className={isDbLoading ? 'animate-spin' : ''}
              />
              <span className="hidden md:inline">再読込</span>
            </button>
            <button
              onClick={handleDownloadImage}
              className="flex items-center gap-2 bg-slate-100 text-slate-600 px-4 py-2 rounded-lg hover:bg-slate-200 transition-all border border-slate-200"
              title="画面を画像保存"
            >
              <Download size={18} />
              <span className="hidden md:inline">保存</span>
            </button>
            <button
              onClick={handleRunAIAnalysis}
              disabled={isAiLoading}
              className="flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-4 py-2 rounded-lg hover:shadow-md transition-all disabled:opacity-70"
            >
              {isAiLoading ? (
                <Activity size={18} className="animate-spin" />
              ) : (
                <Sparkles size={18} />
              )}
              <span>{isAiLoading ? '分析中...' : 'AI分析を実行'}</span>
            </button>
          </div>
        </div>

        <main className="flex-1 overflow-y-auto p-4 md:p-8" ref={dashboardRef}>
          {/* AI Analysis Panel */}
          {showAiPanel && (
            <div className="mb-6 bg-white rounded-xl shadow-sm border border-indigo-100 overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300">
              <div className="bg-indigo-50 px-6 py-3 border-b border-indigo-100 flex justify-between items-center">
                <div className="flex items-center gap-2 text-indigo-800 font-bold">
                  <Bot size={20} />
                  <span>AI アナリストの分析レポート</span>
                </div>
                <button
                  onClick={() => setShowAiPanel(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="p-6 text-slate-700 leading-relaxed whitespace-pre-wrap">
                {aiAnalysis || (
                  <div className="flex flex-col items-center justify-center py-8 text-slate-400 gap-3">
                    <Sparkles
                      size={32}
                      className="animate-pulse text-indigo-300"
                    />
                    <p>データを分析中...</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-2">
                <div>
                  <p className="text-slate-500 text-sm mt-1">
                    R7年度 実績と目標達成状況
                  </p>
                </div>
                <div className="bg-white px-4 py-2 rounded-full shadow-sm border border-slate-200 text-sm text-slate-600 flex items-center gap-2">
                  <Calendar size={16} />
                  <span>データ基準: 4月1日〜現在</span>
                </div>
              </div>

              {/* KPIs */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 relative overflow-hidden">
                  <div className="absolute right-0 top-0 p-4 opacity-10">
                    <DollarSign size={64} className="text-blue-600" />
                  </div>
                  <p className="text-slate-500 text-sm font-medium">
                    総寄附実績 (年度累計)
                  </p>
                  <p className="text-3xl font-bold text-slate-800 mt-2">
                    {formatCurrency(
                      summaryData.reduce((acc, curr) => acc + curr.current, 0)
                    )}
                  </p>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 relative overflow-hidden">
                  <div className="absolute right-0 top-0 p-4 opacity-10">
                    <Target size={64} className="text-emerald-600" />
                  </div>
                  <p className="text-slate-500 text-sm font-medium">
                    平均達成率
                  </p>
                  <p className="text-3xl font-bold text-slate-800 mt-2">
                    {(
                      summaryData.reduce(
                        (acc, curr) => acc + curr.achievement,
                        0
                      ) / summaryData.length
                    ).toFixed(1)}
                    %
                  </p>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 relative overflow-hidden">
                  <div className="absolute right-0 top-0 p-4 opacity-10">
                    <Activity size={64} className="text-orange-600" />
                  </div>
                  <p className="text-slate-500 text-sm font-medium">
                    トップ達成率
                  </p>
                  <div className="flex items-baseline gap-2 mt-2">
                    <p className="text-3xl font-bold text-slate-800">
                      {
                        [...summaryData].sort(
                          (a, b) => b.achievement - a.achievement
                        )[0]?.name
                      }
                    </p>
                    <span className="text-lg font-semibold text-orange-600">
                      {
                        [...summaryData].sort(
                          (a, b) => b.achievement - a.achievement
                        )[0]?.achievement
                      }
                      %
                    </span>
                  </div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 relative overflow-hidden">
                  <div className="absolute right-0 top-0 p-4 opacity-10">
                    <ArrowUpRight size={64} className="text-indigo-600" />
                  </div>
                  <p className="text-slate-500 text-sm font-medium">
                    トップ昨対 (年度)
                  </p>
                  <div className="flex items-baseline gap-2 mt-2">
                    <p className="text-3xl font-bold text-slate-800">
                      {[...summaryData].sort((a, b) => b.yoy - a.yoy)[0]?.name}
                    </p>
                    <span className="text-lg font-semibold text-indigo-600">
                      {[...summaryData].sort((a, b) => b.yoy - a.yoy)[0]?.yoy}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Main Chart */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                  <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <BarChart2 size={20} className="text-blue-500" />
                    自治体別 目標達成率 vs 年度昨対比
                  </h3>
                  <SummaryChart />
                </div>
                {/* Ranking Table */}
                <div className="bg-white p-0 rounded-xl shadow-sm border border-slate-100 flex flex-col">
                  <div className="p-6 border-b border-slate-100">
                    <h3 className="text-lg font-bold text-slate-800">
                      実績額ランキング
                    </h3>
                  </div>
                  <div
                    className="flex-1 overflow-auto p-2"
                    style={{ maxHeight: '400px' }}
                  >
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 text-slate-500 sticky top-0 z-10">
                        <tr>
                          <th className="px-4 py-2 text-left font-medium whitespace-nowrap">
                            自治体
                          </th>
                          <th className="px-4 py-2 text-right font-medium whitespace-nowrap">
                            実績額
                          </th>
                          <th className="px-4 py-2 text-right font-medium whitespace-nowrap">
                            達成率
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...summaryData]
                          .sort((a, b) => b.current - a.current)
                          .map((item, idx) => (
                            <tr
                              key={item.name}
                              className="border-b border-slate-50 hover:bg-slate-50 transition-colors"
                            >
                              <td className="px-4 py-3 font-medium whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`w-5 h-5 rounded-full flex items-center justify-center text-xs text-white shrink-0 ${
                                      idx < 3 ? 'bg-yellow-500' : 'bg-slate-300'
                                    }`}
                                  >
                                    {idx + 1}
                                  </span>
                                  <span>{item.name}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right font-semibold text-slate-700 whitespace-nowrap">
                                {formatCurrency(item.current)}
                              </td>
                              <td
                                className={`px-4 py-3 text-right whitespace-nowrap ${
                                  item.achievement >= 100
                                    ? 'text-green-600'
                                    : 'text-blue-500'
                                }`}
                              >
                                {item.achievement}%
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Detail Tab */}
          {activeTab === 'detail' && (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                <div>
                  <h2 className="text-2xl font-bold text-slate-800">
                    個別詳細・昨対分析
                  </h2>
                  <p className="text-slate-500 text-sm mt-1">
                    3か年日次比較 (サイト合算)
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-600">
                    自治体:
                  </span>
                  <div className="relative">
                    <select
                      value={selectedCity}
                      onChange={(e) => setSelectedCity(e.target.value)}
                      className="appearance-none bg-slate-50 border border-slate-300 text-slate-800 py-2 pl-4 pr-10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium cursor-pointer hover:bg-slate-100"
                    >
                      {summaryData.map((city) => (
                        <option key={city.name} value={city.name}>
                          {city.name}
                        </option>
                      ))}
                    </select>
                    <ChevronRight
                      size={16}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 rotate-90 text-slate-400 pointer-events-none"
                    />
                  </div>
                </div>
              </div>

              {/* 表示対象月選択 (New UI) */}
              <div className="flex justify-end mb-2">
                <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-slate-200">
                  <span className="text-xs text-slate-500 font-bold">
                    表示月:
                  </span>
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                    className="text-sm font-bold text-slate-700 bg-transparent focus:outline-none"
                  >
                    {MONTHS_ORDER.map((m) => (
                      <option key={m} value={m}>
                        {m}月
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 月次・年次実績サマリー (Modified Feature) */}
              {(() => {
                const targetMonthStr = `${selectedMonth}月`; // selectedMonthを使用
                // 月次データ
                const monthData =
                  currentCityDetail.monthly.find(
                    (m) =>
                      m.month === targetMonthStr ||
                      m.month === `0${selectedMonth}月`
                  ) || {};

                const thisYearAmount = monthData.thisYear || 0;
                const lastYearAmount = monthData.lastYear || 0;
                const yoyMonth =
                  monthData.yoyRate !== undefined ? monthData.yoyRate : 0;
                const isPositiveMonth = yoyMonth >= 100;

                // 年次データ (summaryDataから取得)
                const citySummary =
                  summaryData.find((c) => c.name === selectedCity) || {};
                const totalAmount = citySummary.current || 0;
                const totalYoy = citySummary.yoy || 0;
                const isPositiveTotal = totalYoy >= 100;

                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* 月次実績 */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between relative overflow-hidden">
                      <div className="relative z-10">
                        <p className="text-slate-500 text-sm font-bold mb-1">
                          {selectedMonth}月度 寄附実績
                        </p>
                        <p className="text-3xl font-bold text-slate-800">
                          {formatCurrency(thisYearAmount)}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          前年実績: {formatCurrency(lastYearAmount)}
                        </p>
                      </div>
                      <div className="p-3 bg-blue-50 rounded-full text-blue-600 relative z-10">
                        <DollarSign size={28} />
                      </div>
                      <div className="absolute right-0 top-0 p-4 opacity-5 pointer-events-none">
                        <DollarSign size={100} className="text-blue-600" />
                      </div>
                    </div>

                    {/* 月次昨対 */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between relative overflow-hidden">
                      <div className="relative z-10">
                        <p className="text-slate-500 text-sm font-bold mb-1">
                          {selectedMonth}月度 昨年対比
                        </p>
                        <div className="flex items-baseline gap-2">
                          <p
                            className={`text-3xl font-bold ${
                              isPositiveMonth
                                ? 'text-emerald-600'
                                : 'text-red-500'
                            }`}
                          >
                            {yoyMonth}%
                          </p>
                          <span
                            className={`text-sm font-medium ${
                              isPositiveMonth
                                ? 'text-emerald-600'
                                : 'text-red-500'
                            }`}
                          >
                            {isPositiveMonth ? '▲' : '▼'}{' '}
                            {Math.abs(yoyMonth - 100).toFixed(1)}%
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          {isPositiveMonth
                            ? '前年を上回っています'
                            : '前年を下回っています'}
                        </p>
                      </div>
                      <div
                        className={`p-3 rounded-full relative z-10 ${
                          isPositiveMonth
                            ? 'bg-emerald-50 text-emerald-600'
                            : 'bg-red-50 text-red-600'
                        }`}
                      >
                        <Activity size={28} />
                      </div>
                      <div
                        className={`absolute right-0 top-0 p-4 opacity-5 pointer-events-none`}
                      >
                        <Activity
                          size={100}
                          className={
                            isPositiveMonth
                              ? 'text-emerald-600'
                              : 'text-red-600'
                          }
                        />
                      </div>
                    </div>

                    {/* 年次実績 (追加) */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between relative overflow-hidden">
                      <div className="relative z-10">
                        <p className="text-slate-500 text-sm font-bold mb-1">
                          年度累計 寄附実績
                        </p>
                        <p className="text-3xl font-bold text-slate-800">
                          {formatCurrency(totalAmount)}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          目標: {formatCurrency(citySummary.target)}
                        </p>
                      </div>
                      <div className="p-3 bg-indigo-50 rounded-full text-indigo-600 relative z-10">
                        <DollarSign size={28} />
                      </div>
                      <div className="absolute right-0 top-0 p-4 opacity-5 pointer-events-none">
                        <DollarSign size={100} className="text-indigo-600" />
                      </div>
                    </div>

                    {/* 年次昨対 (追加) */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between relative overflow-hidden">
                      <div className="relative z-10">
                        <p className="text-slate-500 text-sm font-bold mb-1">
                          年度累計 昨年対比
                        </p>
                        <div className="flex items-baseline gap-2">
                          <p
                            className={`text-3xl font-bold ${
                              isPositiveTotal
                                ? 'text-emerald-600'
                                : 'text-red-500'
                            }`}
                          >
                            {totalYoy}%
                          </p>
                          <span
                            className={`text-sm font-medium ${
                              isPositiveTotal
                                ? 'text-emerald-600'
                                : 'text-red-500'
                            }`}
                          >
                            {isPositiveTotal ? '▲' : '▼'}{' '}
                            {Math.abs(totalYoy - 100).toFixed(1)}%
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          達成率: {citySummary.achievement}%
                        </p>
                      </div>
                      <div
                        className={`p-3 rounded-full relative z-10 ${
                          isPositiveTotal
                            ? 'bg-emerald-50 text-emerald-600'
                            : 'bg-red-50 text-red-600'
                        }`}
                      >
                        <Activity size={28} />
                      </div>
                      <div
                        className={`absolute right-0 top-0 p-4 opacity-5 pointer-events-none`}
                      >
                        <Activity
                          size={100}
                          className={
                            isPositiveTotal
                              ? 'text-emerald-600'
                              : 'text-red-600'
                          }
                        />
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* 3か年日次比較チャート (メイン) */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <BarChart2 size={20} className="text-blue-500" />
                    {selectedMonth}月の実績比較 (日別・3か年)
                  </h3>
                  <div className="text-sm text-slate-500">
                    <span className="bg-blue-50 text-blue-600 px-2 py-1 rounded border border-blue-100 font-bold">
                      対象: {selectedMonth}月
                    </span>
                  </div>
                </div>
                <DailyComparisonChart />
                <p className="text-xs text-slate-400 mt-2 text-center">
                  ※
                  グラフは各日ごとの寄附金額合計(全サイト合算)を表示しています。
                </p>
              </div>

              {/* 中段：累計推移 (進捗管理) - 新規追加 */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 mt-6">
                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <TrendingUp size={20} className="text-indigo-500" />
                  年度累計 推移シミュレーション
                </h3>
                <p className="text-xs text-slate-500 mb-4">
                  目標達成に向けた進捗ペースを前年と比較します。
                </p>
                <CumulativeChart />
              </div>

              {/* 下段：月次推移 & ポータルシェア */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                {/* 月次推移 (R7年度 全体推移) */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                  <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <TrendingUp size={20} className="text-emerald-500" />
                    月別 寄附実績 (3か年比較)
                  </h3>
                  <p className="text-xs text-slate-500 mb-4">
                    ※
                    自治体シートの「今年・前年・前々年」行を参照して表示しています。
                  </p>
                  <ResponsiveContainer width="100%" height={250}>
                    <ComposedChart
                      data={currentCityDetail.monthly}
                      margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
                      barGap={0}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                      <YAxis
                        yAxisId="left"
                        tickFormatter={(val) => `${(val / 10000).toFixed(0)}万`}
                        width={50}
                        tick={{ fontSize: 10 }}
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        unit="%"
                        width={40}
                        tick={{ fontSize: 10 }}
                      />
                      <RechartsTooltip
                        formatter={(value, name) => [
                          name === '昨対比'
                            ? `${value}%`
                            : formatCurrency(value),
                          name,
                        ]}
                      />
                      <Legend
                        wrapperStyle={{ paddingTop: '10px' }}
                        iconType="circle"
                      />
                      <Bar
                        yAxisId="left"
                        dataKey="thisYear"
                        fill="#0088FE"
                        radius={[4, 4, 0, 0]}
                        name="今年(R7)"
                      />
                      <Bar
                        yAxisId="left"
                        dataKey="lastYear"
                        fill="#00C49F"
                        radius={[4, 4, 0, 0]}
                        name="前年(R6)"
                      />
                      <Bar
                        yAxisId="left"
                        dataKey="prevYear"
                        fill="#FF8042"
                        radius={[4, 4, 0, 0]}
                        name="前々年(R5)"
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="yoyRate"
                        name="昨対比"
                        stroke="#FF0000"
                        strokeWidth={2}
                        dot={false}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>

                {/* ポータルシェア円グラフ */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                  <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <PieChartIcon size={20} className="text-orange-500" />
                    ポータルサイト別 シェア ({selectedMonth}月)
                  </h3>
                  <PlatformShareChart />
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default App;
