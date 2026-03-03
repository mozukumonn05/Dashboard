import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, 
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area, ComposedChart, Brush, ReferenceLine
} from 'recharts';
import { 
  LayoutDashboard, TrendingUp, DollarSign, Calendar, Upload, 
  FileSpreadsheet, ArrowUpRight, ArrowDownRight, Target, ChevronRight, Menu, X, Activity, AlertCircle, CheckCircle, FileClock, BarChart2, PieChart as PieChartIcon,
  ChevronLeft, Database, Cloud, Save, Sparkles, Bot, RefreshCw
} from 'lucide-react';

// --- Firebase Imports ---
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, writeBatch } from "firebase/firestore";

// --- Config & Helpers ---
const apiKey = ""; 
const FISCAL_YEAR_MONTHS = ['4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月', '1月', '2月', '3月'];
const MONTHS_ORDER = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3];
const CURRENT_FISCAL_YEAR = 2025; // R7
const PLATFORM_KEYWORDS = ['楽天', 'ふるさとチョイス', 'さとふる', 'ふるなび', 'ANA', 'au PAY', '三越伊勢丹', 'JRE', 'JAL', 'マイナビ', 'セゾン', 'モンベル', 'ふるラボ', 'まいふる', '電話', 'FAX', '窓口', '直接', '郵便', '郵送', 'ふるぽ', 'ふるさとプレミアム', '特設サイト', 'ふるさと本舗', '電子感謝券', '百選', 'ぺいふる', 'Amazon', 'KABU'];
const COLORS = ['#0088FE', '#00C49F', '#FF8042', '#FFBB28', '#8884d8', '#82ca9d', '#a4de6c', '#d0ed57', '#ffc658'];

const getFiscalYearCalendarYear = (fiscalYear, month) => {
  return month <= 3 ? fiscalYear + 1 : fiscalYear;
};

const formatCurrency = (value) => {
  if (value === null || value === undefined || isNaN(value)) return '-';
  if (value >= 100000000) return `${(value / 100000000).toFixed(1)}億円`;
  return `${(value / 10000).toLocaleString()}万円`;
};

// --- Firebase Config Object ---
const firebaseConfig = {
  apiKey: "AIzaSyCI9ix2QXgbSEhHlrLUBe_OgHbvm9Ey0Ec",
  authDomain: "furusato-dashboard.firebaseapp.com",
  projectId: "furusato-dashboard",
  storageBucket: "furusato-dashboard.firebasestorage.app",
  messagingSenderId: "573154898493",
  appId: "1:573154898493:web:a0c1ea5dfe4bf23712f054"
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);
const appId = 'default-app-id';

const useScript = (src) => {
  const [status, setStatus] = useState(src ? "loading" : "idle");
  useEffect(() => {
    if (!src) { setStatus("idle"); return; }
    let script = document.querySelector(`script[src="${src}"]`);
    if (!script) {
      script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.setAttribute("data-status", "loading");
      document.body.appendChild(script);
      const setAttributeFromEvent = (event) => {
        script.setAttribute("data-status", event.type === "load" ? "ready" : "error");
        setStatus(event.type === "load" ? "ready" : "error");
      };
      script.addEventListener("load", setAttributeFromEvent);
      script.addEventListener("error", setAttributeFromEvent);
    } else {
      setStatus(script.getAttribute("data-status"));
    }
  }, [src]);
  return status;
};

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
INITIAL_SUMMARY_DATA.forEach(city => {
    INITIAL_DETAIL_DATA[city.name] = {
        monthly: FISCAL_YEAR_MONTHS.map(m => ({ month: m, thisYear: 0, lastYear: 0, prevYear: 0, yoyRate: 0 })),
        rawDailyData: {}, 
        platforms: [],
        targetMonth: new Date().getMonth() + 1
    };
});

const App = () => {
  const xlsxStatus = useScript("https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js");
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedCity, setSelectedCity] = useState(INITIAL_SUMMARY_DATA[0].name);
  const [summaryData, setSummaryData] = useState(INITIAL_SUMMARY_DATA);
  const [detailData, setDetailData] = useState(INITIAL_DETAIL_DATA);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1); 
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false); 
  const [uploadStatus, setUploadStatus] = useState("");
  const [uploadMessage, setUploadMessage] = useState("");
  const [user, setUser] = useState(null);
  const [isDbLoading, setIsDbLoading] = useState(false);
  const [dbStatus, setDbStatus] = useState("idle"); 
  const [aiAnalysis, setAiAnalysis] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [isTestMode, setIsTestMode] = useState(true);

  // --- Helpers ---
  const parseYearFromText = (text) => {
      if (!text) return null;
      // 令和判定
      const reiwaMatch = text.match(/令和(\d+)年度?/);
      if (reiwaMatch) return 2018 + parseInt(reiwaMatch[1]);
      // 西暦判定
      const yearMatch = text.match(/(20\d{2})/);
      if (yearMatch) return parseInt(yearMatch[1]);
      return null;
  };

  const loadFromFirestore = useCallback(async (u) => {
    if (!u || !db) return;
    setIsDbLoading(true);
    setDbStatus("loading");
    try {
      const summaryRef = doc(db, 'artifacts', appId, 'public', 'data', 'summary', 'main');
      const summarySnap = await getDoc(summaryRef);
      if (summarySnap.exists()) {
        setSummaryData(summarySnap.data().list || []);
      }
      const detailsRef = collection(db, 'artifacts', appId, 'public', 'data', 'details');
      const detailsSnap = await getDocs(detailsRef);
      const loadedDetails = {};
      detailsSnap.forEach(doc => { loadedDetails[doc.id] = doc.data(); });
      if (Object.keys(loadedDetails).length > 0) {
        setDetailData(prev => ({ ...prev, ...loadedDetails }));
      }
      setDbStatus("idle");
    } catch (error) {
      console.error(error);
      setDbStatus("error");
    } finally {
      setIsDbLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) await loadFromFirestore(u);
      else await signInAnonymously(auth);
    });
    return () => unsubscribe();
  }, [loadFromFirestore]);

  const saveToFirestore = async (newSummary, newDetails, targetCity = null) => {
    if (isTestMode) {
        setDbStatus("idle"); 
        return; 
    }
    if (!user || !db) return;
    setDbStatus("saving");
    try {
      const batch = writeBatch(db);
      const summaryRef = doc(db, 'artifacts', appId, 'public', 'data', 'summary', 'main');
      batch.set(summaryRef, { list: newSummary }, { merge: true });
      if (targetCity) {
          const cityRef = doc(db, 'artifacts', appId, 'public', 'data', 'details', targetCity);
          batch.set(cityRef, newDetails[targetCity], { merge: true });
      } else {
          Object.entries(newDetails).forEach(([cityName, data]) => {
            const cityRef = doc(db, 'artifacts', appId, 'public', 'data', 'details', cityName);
            batch.set(cityRef, data, { merge: true });
          });
      }
      await batch.commit();
      setDbStatus("saved");
      setTimeout(() => setDbStatus("idle"), 3000);
    } catch (error) {
      console.error(error);
      setDbStatus("error");
    }
  };

  const handleRefresh = useCallback(async () => {
    if (user) await loadFromFirestore(user);
  }, [user, loadFromFirestore]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // 自治体チェック
    const confirmMsg = `【確認】\n現在「${selectedCity}」が選択されています。データを更新しますか？`;
    if (!window.confirm(confirmMsg)) { e.target.value = ""; return; }

    setUploadStatus("loading");
    setUploadMessage("解析中...");

    try {
      const data = await file.arrayBuffer();
      const workbook = window.XLSX.read(data);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = window.XLSX.utils.sheet_to_json(sheet, { header: 1 });
      const titleRow = json[0] ? json[0].join('') : '';

      // 1. ファイルから年を特定（ファイル名または1行目）
      const detectedYear = parseYearFromText(file.name) || parseYearFromText(titleRow);
      
      // 2. 他自治体名が含まれていないかチェック
      const otherCities = summaryData.map(c => c.name).filter(name => name !== selectedCity);
      if (otherCities.some(name => json.slice(0, 5).join('').includes(name))) {
          throw new Error("自治体不一致の可能性があります。");
      }

      if (selectedCity === '大洗町' || titleRow.includes('寄附方法')) {
          await processOaraiFormat(json, titleRow, detectedYear);
      } else {
          if (file.name.includes('月別')) {
              await processNewMonthlyFormat(json);
          } else if (file.name.includes('日毎') || file.name.includes('日別')) {
              await processNewDailyFormat(json, detectedYear);
          } else {
              throw new Error("不明な形式です。");
          }
      }
    } catch (error) {
      setUploadStatus("error");
      setUploadMessage(error.message);
      alert(error.message);
    } finally { e.target.value = ""; }
  };

  // --- 大洗町：年度別・日別 ---
  const processOaraiFormat = async (json, titleRow, detectedYear) => {
      const isMonthly = titleRow.includes('年度別集計');
      const isDaily = titleRow.includes('寄附方法別集計');

      if (isMonthly) {
          const fiscalYear = detectedYear || CURRENT_FISCAL_YEAR;
          const newMonthly = [...(detailData[selectedCity]?.monthly || [])];
          
          for (let i = 3; i < json.length; i++) {
              const row = json[i];
              if (!row || isNaN(parseInt(row[0]))) continue;
              const monthVal = parseInt(row[0]);
              const amount = typeof row[2] === 'number' ? row[2] : parseFloat(String(row[2]).replace(/,/g, '')) || 0;

              const idx = newMonthly.findIndex(m => m.month === `${monthVal}月`);
              if (idx !== -1) {
                  // 年度によってスロットを分ける
                  if (fiscalYear === CURRENT_FISCAL_YEAR) newMonthly[idx].thisYear = amount;
                  else if (fiscalYear === CURRENT_FISCAL_YEAR - 1) newMonthly[idx].lastYear = amount;
                  else if (fiscalYear === CURRENT_FISCAL_YEAR - 2) newMonthly[idx].prevYear = amount;
                  
                  if (newMonthly[idx].lastYear > 0) {
                      newMonthly[idx].yoyRate = parseFloat(((newMonthly[idx].thisYear / newMonthly[idx].lastYear) * 100).toFixed(1));
                  }
              }
          }

          const currentTotal = newMonthly.reduce((sum, m) => sum + m.thisYear, 0);
          const updatedSummary = summaryData.map(c => {
              if (c.name === selectedCity) {
                  const achievement = c.target > 0 ? Math.round((currentTotal / c.target) * 100) : 0;
                  return { ...c, current: currentTotal, achievement };
              }
              return c;
          });

          const updatedDetail = { ...detailData[selectedCity], monthly: newMonthly };
          setDetailData(prev => ({ ...prev, [selectedCity]: updatedDetail }));
          setSummaryData(updatedSummary);
          await saveToFirestore(updatedSummary, { [selectedCity]: updatedDetail }, selectedCity);
          setUploadStatus("success");
          setUploadMessage(`${fiscalYear}年度分を読み込みました`);

      } else if (isDaily) {
          const dateMatch = titleRow.match(/(\d+)年(\d+)月/);
          const year = dateMatch ? parseInt(dateMatch[1]) : (detectedYear || 2025);
          const month = dateMatch ? parseInt(dateMatch[2]) : selectedMonth;
          
          const headerRow = json[1];
          const platforms = [];
          const platformColIndices = {};
          for (let c = 3; c < headerRow.length; c += 2) {
              if (headerRow[c]) {
                  platformColIndices[c + 1] = headerRow[c].trim();
                  platforms.push({ name: headerRow[c].trim(), value: 0 });
              }
          }

          const dailyTotals = {};
          for (let i = 3; i < json.length; i++) {
              const row = json[i];
              if (!row || isNaN(parseInt(row[0]))) continue;
              const day = parseInt(row[0]);
              const totalAmount = typeof row[2] === 'number' ? row[2] : parseFloat(String(row[2]).replace(/,/g, '')) || 0;
              dailyTotals[day] = totalAmount;

              Object.entries(platformColIndices).forEach(([colIdx, pName]) => {
                  const p = platforms.find(p => p.name === pName);
                  if (p) p.value += (typeof row[colIdx] === 'number' ? row[colIdx] : 0);
              });
          }

          const currentDetail = detailData[selectedCity] || {};
          const rawDailyData = { ...currentDetail.rawDailyData };
          if (!rawDailyData[year]) rawDailyData[year] = {};
          rawDailyData[year][month] = { ...dailyTotals, platforms: platforms.sort((a,b)=>b.value-a.value) };

          const updatedDetail = { ...currentDetail, rawDailyData };
          setDetailData(prev => ({ ...prev, [selectedCity]: updatedDetail }));
          await saveToFirestore(summaryData, { [selectedCity]: updatedDetail }, selectedCity);
          setUploadStatus("success");
          setUploadMessage(`${year}年${month}月分の日別データを読み込みました`);
      }
  };

  // --- 他自治体：月別 ---
  const processNewMonthlyFormat = async (json) => {
    const headerRowIdx = json.findIndex(row => row.some(c => String(c).includes('4月')));
    if (headerRowIdx === -1) throw new Error("形式エラー");
    
    const header = json[headerRowIdx];
    const monthMap = {};
    FISCAL_YEAR_MONTHS.forEach(m => {
        const idx = header.findIndex(c => String(c).replace(/^0/, '') === m);
        if (idx !== -1) monthMap[m] = idx;
    });

    let rThis, rLast, rPrev;
    json.forEach(row => {
        const s = row.join('');
        if (s.includes('今年')) rThis = row;
        if (s.includes('前年') && !s.includes('前々年')) rLast = row;
        if (s.includes('前々年')) rPrev = row;
    });

    const newMonthly = FISCAL_YEAR_MONTHS.map(m => {
        const colIdx = monthMap[m];
        const cleanVal = (r) => (r && colIdx !== undefined ? (parseFloat(String(r[colIdx]).replace(/,/g, '')) || 0) * 1000 : 0);
        const thisYear = cleanVal(rThis);
        const lastYear = cleanVal(rLast);
        const prevYear = cleanVal(rPrev);
        return { month: m, thisYear, lastYear, prevYear, yoyRate: lastYear > 0 ? parseFloat(((thisYear / lastYear) * 100).toFixed(1)) : 0 };
    });

    const totalCurrent = newMonthly.reduce((sum, m) => sum + m.thisYear, 0);
    const updatedSummaryList = summaryData.map(city => {
        if (city.name === selectedCity) {
            const achievement = city.target > 0 ? Math.round((totalCurrent / city.target) * 100) : 0;
            return { ...city, current: totalCurrent, achievement };
        }
        return city;
    });

    const updatedDetail = { ...detailData[selectedCity], monthly: newMonthly };
    setDetailData(prev => ({ ...prev, [selectedCity]: updatedDetail }));
    setSummaryData(updatedSummaryList);
    await saveToFirestore(updatedSummaryList, { [selectedCity]: updatedDetail }, selectedCity);
    setUploadStatus("success");
    setUploadMessage("月別データを一括更新しました");
  };

  // --- 他自治体：日別 ---
  const processNewDailyFormat = async (json, detectedYear) => {
    const headerRowIdx = json.findIndex(row => row.some(c => String(c).includes('寄附方法')));
    if (headerRowIdx === -1) throw new Error("形式エラー");

    // 年の決定：ファイル名から取れなければ現在の表示中のカレンダー年
    const year = detectedYear || getFiscalYearCalendarYear(CURRENT_FISCAL_YEAR, selectedMonth);
    const month = selectedMonth;

    const header = json[headerRowIdx];
    const dayMap = {};
    for(let d=1; d<=31; d++) {
        const idx = header.findIndex(c => String(c).replace(/日|\s/g, '') === String(d));
        if (idx !== -1) dayMap[d] = idx;
    }

    const platformTotals = [];
    const dailyTotals = {}; 
    for(let i = headerRowIdx + 1; i < json.length; i++) {
        const row = json[i];
        if (!row || !row[0] || ['合計','計'].includes(row[0])) continue;
        if (!PLATFORM_KEYWORDS.some(kw => String(row[0]).includes(kw))) continue;

        let rowTotal = 0;
        Object.entries(dayMap).forEach(([day, colIdx]) => {
            const val = typeof row[colIdx] === 'number' ? row[colIdx] : 0;
            if (val > 0) {
                 dailyTotals[day] = (dailyTotals[day] || 0) + val;
                 rowTotal += val;
            }
        });
        if (rowTotal > 0) platformTotals.push({ name: String(row[0]), value: rowTotal });
    }

    const currentDetail = detailData[selectedCity] || {};
    const rawDailyData = { ...currentDetail.rawDailyData };
    if (!rawDailyData[year]) rawDailyData[year] = {};
    rawDailyData[year][month] = { ...dailyTotals, platforms: platformTotals.sort((a,b)=>b.value-a.value) };

    const updatedDetail = { ...currentDetail, rawDailyData };
    setDetailData(prev => ({ ...prev, [selectedCity]: updatedDetail }));
    await saveToFirestore(summaryData, { [selectedCity]: updatedDetail }, selectedCity);
    setUploadStatus("success");
    setUploadMessage(`${year}年${month}月の日別データを読み込みました`);
  };

  // --- Charts ---
  const DailyComparisonChart = () => {
    const detail = detailData[selectedCity] || {};
    const raw = detail.rawDailyData || {};
    const baseYear = getFiscalYearCalendarYear(CURRENT_FISCAL_YEAR, selectedMonth);
    
    const data = [];
    let hasData = false;
    for (let d = 1; d <= 31; d++) {
        const y2025 = raw[baseYear]?.[selectedMonth]?.[d] || 0;
        const y2024 = raw[baseYear-1]?.[selectedMonth]?.[d] || 0;
        const y2023 = raw[baseYear-2]?.[selectedMonth]?.[d] || 0;
        if (y2025 || y2024 || y2023) hasData = true;
        data.push({ day: `${selectedMonth}/${d}`, y2025, y2024, y2023, yoyRate: y2024 > 0 ? parseFloat(((y2025/y2024)*100).toFixed(1)) : 0 });
    }

    if (!hasData) return <div className="h-full flex items-center justify-center text-slate-400">データなし（過去分をアップロードしてください）</div>;

    return (
      <ResponsiveContainer width="100%" height={350}>
        <ComposedChart data={data} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="day" tick={{fontSize: 10}} interval={2} />
          <YAxis yAxisId="left" tickFormatter={(val) => `${(val/10000).toFixed(0)}万`} width={40} tick={{fontSize: 10}} />
          <YAxis yAxisId="right" orientation="right" unit="%" width={40} tick={{fontSize: 10}} />
          <RechartsTooltip formatter={(v, n) => [n === "昨対比" ? `${v}%` : formatCurrency(v), n]} />
          <Legend wrapperStyle={{paddingTop: '10px'}} iconType="circle"/>
          <ReferenceLine yAxisId="right" y={100} stroke="red" strokeDasharray="3 3" />
          <Bar yAxisId="left" dataKey="y2025" name="今年度 (R7)" fill="#0088FE" radius={[4, 4, 0, 0]} />
          <Bar yAxisId="left" dataKey="y2024" name="前年度 (R6)" fill="#00C49F" radius={[4, 4, 0, 0]} />
          <Bar yAxisId="left" dataKey="y2023" name="前々年度 (R5)" fill="#FF8042" radius={[4, 4, 0, 0]} />
          <Line yAxisId="right" type="monotone" dataKey="yoyRate" name="昨対比" stroke="#FF0000" strokeWidth={2} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    );
  };

  const PlatformShareChart = () => {
    const detail = detailData[selectedCity] || {};
    const calendarYear = getFiscalYearCalendarYear(CURRENT_FISCAL_YEAR, selectedMonth);
    const data = detail.rawDailyData?.[calendarYear]?.[selectedMonth]?.platforms || detail.platforms || [];
    if (data.length === 0) return <div className="h-full flex items-center justify-center text-slate-400">データなし</div>;
    return (
      <ResponsiveContainer width="100%" height={300}>
          <PieChart>
              <Pie data={data} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={2} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {data.map((_, i) => <Cell key={`c-${i}`} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <RechartsTooltip formatter={(v) => formatCurrency(v)} />
              <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: '10px' }}/>
          </PieChart>
      </ResponsiveContainer>
    );
  };

  const SummaryChart = () => (
    <ResponsiveContainer width="100%" height={400}>
        <ComposedChart layout="vertical" data={[...summaryData].sort((a, b) => b.achievement - a.achievement)} margin={{ top: 20, right: 30, left: 60, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" unit="%" />
            <YAxis dataKey="name" type="category" width={80} tick={{fontSize: 12, fontWeight: 'bold'}} />
            <RechartsTooltip formatter={(v) => [`${v}%`, ""]} />
            <Legend />
            <Bar dataKey="achievement" name="目標達成率" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={12} />
            <Bar dataKey="yoy" name="昨年対比" fill="#10b981" radius={[0, 4, 4, 0]} barSize={12} />
        </ComposedChart>
    </ResponsiveContainer>
  );

  return (
    <div className="flex h-screen bg-slate-50 text-slate-800 font-sans overflow-hidden">
      <div className={`fixed inset-y-0 left-0 z-50 bg-slate-900 text-white transition-all duration-300 md:relative md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} ${isCollapsed ? 'w-20' : 'w-72'}`}>
        <button onClick={() => setIsSidebarOpen(false)} className="md:hidden absolute top-4 right-4 text-slate-400 p-2"><X size={24} /></button>
        <button onClick={() => setIsCollapsed(!isCollapsed)} className="hidden md:flex absolute -right-3 top-9 bg-slate-700 rounded-full p-1 border border-slate-600 text-slate-300 z-50">
          {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
        <div className={`p-6 border-b border-slate-700 flex items-center ${isCollapsed ? 'justify-center' : 'gap-2'}`}>
          <LayoutDashboard size={24} className="text-blue-400 shrink-0" />
          {!isCollapsed && <h1 className="text-xl font-bold leading-tight">ふるさと納税<br/>管理ボード</h1>}
        </div>
        <nav className="p-4 space-y-2 flex-1">
          <button onClick={() => setActiveTab('overview')} className={`w-full flex items-center px-4 py-3 rounded-lg ${activeTab === 'overview' ? 'bg-blue-600' : 'text-slate-300'} ${isCollapsed ? 'justify-center' : 'gap-3'}`}>
            <TrendingUp size={20} />{!isCollapsed && <span>全体サマリー</span>}
          </button>
          <button onClick={() => setActiveTab('detail')} className={`w-full flex items-center px-4 py-3 rounded-lg ${activeTab === 'detail' ? 'bg-blue-600' : 'text-slate-300'} ${isCollapsed ? 'justify-center' : 'gap-3'}`}>
            <FileSpreadsheet size={20} />{!isCollapsed && <span>個別詳細・昨対分析</span>}
          </button>
        </nav>
        {!isCollapsed && (
          <div className="px-4 pb-4">
             <div className="flex items-center justify-between bg-slate-800 p-3 rounded border border-slate-700">
               <span className="text-xs font-bold text-slate-300">テストモード</span>
               <button onClick={() => setIsTestMode(!isTestMode)} className={`relative inline-flex h-5 w-9 items-center rounded-full ${isTestMode ? 'bg-orange-500' : 'bg-slate-600'}`}>
                 <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${isTestMode ? 'translate-x-5' : 'translate-x-1'}`} />
               </button>
             </div>
             {isTestMode && <p className="text-[10px] text-orange-400 mt-1">※DB保存されません</p>}
          </div>
        )}
        <div className="p-4 border-t border-slate-700 bg-slate-800">
          <label className="flex flex-col gap-2 cursor-pointer group">
            {!isCollapsed && <div className="flex items-center justify-between"><span className="text-xs font-semibold text-slate-400">データ取込 ({selectedCity})</span></div>}
            <div className={`relative flex items-center justify-center bg-slate-700 text-slate-300 rounded-md border border-slate-600 border-dashed ${isCollapsed ? 'p-3' : 'px-3 py-4 gap-2'}`}>
              <Upload size={18} /><input type="file" className="hidden" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} />
              {!isCollapsed && <span className="text-sm font-bold">ファイルをドロップ</span>}
            </div>
            {!isCollapsed && uploadMessage && <p className={`text-[10px] ${uploadStatus === 'error' ? 'text-red-400' : 'text-emerald-400'}`}>{uploadMessage}</p>}
          </label>
        </div>
      </div>

      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="bg-white border-b border-slate-200 p-4 flex justify-between items-center md:hidden">
          <button onClick={() => setIsSidebarOpen(true)} className="text-slate-600"><Menu size={24} /></button>
          <span className="font-bold text-slate-800">ダッシュボード</span><div className="w-6"></div>
        </header>
        <div className="bg-white px-8 py-4 border-b border-slate-100 flex justify-between items-center">
          <h2 className="text-xl font-bold text-slate-800">{activeTab === 'overview' ? '全体サマリー' : '個別詳細・昨対分析'}</h2>
          <div className="flex gap-2">
            <button onClick={handleRefresh} className="flex items-center gap-2 bg-slate-100 px-4 py-2 rounded-lg text-slate-600"><RefreshCw size={18} /><span className="hidden md:inline">再読込</span></button>
          </div>
        </div>

        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                 <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                  <p className="text-slate-500 text-sm">総寄附実績</p>
                  <p className="text-3xl font-bold text-slate-800 mt-2">{formatCurrency(summaryData.reduce((a,c)=>a+c.current, 0))}</p>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                  <p className="text-slate-500 text-sm">平均達成率</p>
                  <p className="text-3xl font-bold text-slate-800 mt-2">{(summaryData.reduce((a,c)=>a+c.achievement, 0)/summaryData.length).toFixed(1)}%</p>
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-100"><SummaryChart /></div>
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 flex flex-col overflow-hidden">
                  <div className="p-6 border-b border-slate-100"><h3 className="text-lg font-bold">実績ランキング</h3></div>
                  <div className="flex-1 overflow-auto"><table className="w-full text-sm"><tbody>
                      {[...summaryData].sort((a,b)=>b.current-a.current).map((item, i) => (
                        <tr key={i} className="border-b border-slate-50"><td className="px-4 py-3">{item.name}</td><td className="px-4 py-3 text-right font-bold">{formatCurrency(item.current)}</td></tr>
                      ))}
                  </tbody></table></div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'detail' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-100">
                <div className="flex items-center gap-4">
                  <select value={selectedCity} onChange={(e)=>setSelectedCity(e.target.value)} className="bg-slate-50 border border-slate-300 py-2 px-4 rounded-lg font-bold">
                    {summaryData.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                  </select>
                  <select value={selectedMonth} onChange={(e)=>setSelectedMonth(parseInt(e.target.value))} className="bg-slate-50 border border-slate-300 py-2 px-4 rounded-lg font-bold">
                    {MONTHS_ORDER.map(m => <option key={m} value={m}>{m}月</option>)}
                  </select>
                </div>
                <div className="text-xs text-slate-400">※比較には去年の同月ファイルをアップロードしてください</div>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2"><BarChart2 className="text-blue-500" />{selectedMonth}月の日別実績・3か年比較</h3>
                <DailyComparisonChart />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                    <h3 className="text-lg font-bold mb-4">月別 寄附実績 (3か年比較)</h3>
                    <ResponsiveContainer width="100%" height={250}>
                      <ComposedChart data={detailData[selectedCity]?.monthly || []}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="month" tick={{fontSize: 10}} />
                        <YAxis yAxisId="left" tickFormatter={(v)=>`${(v/10000).toFixed(0)}万`} width={50} />
                        <YAxis yAxisId="right" orientation="right" unit="%" width={40} />
                        <RechartsTooltip formatter={(v, n) => [n === "昨対比" ? `${v}%` : formatCurrency(v), n]} />
                        <Bar yAxisId="left" dataKey="thisYear" fill="#0088FE" name="今年" />
                        <Bar yAxisId="left" dataKey="lastYear" fill="#00C49F" name="前年" />
                        <Bar yAxisId="left" dataKey="prevYear" fill="#FF8042" name="前々年" />
                        <Line yAxisId="right" dataKey="yoyRate" name="昨対比" stroke="#FF0000" dot={false} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                    <h3 className="text-lg font-bold mb-4">ポータルシェア ({selectedMonth}月)</h3>
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