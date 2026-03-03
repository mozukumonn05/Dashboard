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
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from "firebase/auth";
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, writeBatch } from "firebase/firestore";

// --- Config & Helpers ---
const apiKey = ""; // 必要に応じてAPIキーを設定
const FISCAL_YEAR_MONTHS = ['4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月', '1月', '2月', '3月'];
const MONTHS_ORDER = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3];
const CURRENT_FISCAL_YEAR = 2025; 
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

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);
const appId = 'default-app-id';

// --- CDN Hook ---
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

// --- Initial Data ---
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

  // --- Test Mode State ---
  const [isTestMode, setIsTestMode] = useState(true); // デフォルトON

  // --- Load Data ---
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
      detailsSnap.forEach(doc => {
        loadedDetails[doc.id] = doc.data();
      });
        
      if (Object.keys(loadedDetails).length > 0) {
        setDetailData(prev => ({ ...prev, ...loadedDetails }));
      }
      setDbStatus("idle");
    } catch (error) {
      console.error("Error loading data:", error);
      setDbStatus("error");
    } finally {
      setIsDbLoading(false);
    }
  }, []);

  // --- Auth ---
  useEffect(() => {
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) await loadFromFirestore(u);
      else await signInAnonymously(auth);
    });
    return () => unsubscribe();
  }, [loadFromFirestore]);

  // --- Save ---
  const saveToFirestore = async (newSummary, newDetails, targetCity = null) => {
    // 【テストモード判定】
    if (isTestMode) {
        console.log("【テストモード】DB保存をスキップしました。");
        console.log("保存予定だったデータ:", { newSummary, newDetails, targetCity });
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
      console.error("Error saving data:", error);
      setDbStatus("error");
    }
  };

  const handleRefresh = useCallback(async () => {
    if (user) await loadFromFirestore(user);
  }, [user, loadFromFirestore]);

  const handleRunAIAnalysis = async () => {
    setIsAiLoading(true);
    setShowAiPanel(true);
    setAiAnalysis("");
    try {
      let prompt = "";
      if (activeTab === 'overview') {
        const dataStr = JSON.stringify(summaryData.map(d => ({
          name: d.name, current: d.current, target: d.target, achievement: d.achievement, yoy: d.yoy
        })), null, 2);
        prompt = `あなたはふるさと納税の専門データアナリストです。以下のデータから日本語レポートを作成してください。\n## データ\n${dataStr}`;
      } else {
        const detail = detailData[selectedCity];
        const dataStr = JSON.stringify({
          city: selectedCity, platforms: detail.platforms, monthly: detail.monthly, targetMonth: selectedMonth
        }, null, 2);
        prompt = `あなたはふるさと納税の専門データアナリストです。${selectedCity}のデータから日本語レポートを作成してください。\n## データ\n${dataStr}`;
      }
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      if (!response.ok) throw new Error(`API Error: ${response.status}`);
      const data = await response.json();
      setAiAnalysis(data.candidates?.[0]?.content?.parts?.[0]?.text || "解析できませんでした。");
    } catch (error) {
      setAiAnalysis("エラーが発生しました。");
    } finally {
      setIsAiLoading(false);
    }
  };

  // --- Main Logic: File Upload & Parse ---
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (xlsxStatus !== "ready" && typeof window.XLSX === 'undefined') return;

    setUploadStatus("loading");
    setUploadMessage("解析中...");

    try {
      const data = await file.arrayBuffer();
      const workbook = window.XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const json = window.XLSX.utils.sheet_to_json(sheet, { header: 1 });

      // === 分岐処理 ===
      const titleRow = json[0] ? json[0].join('') : '';

      // 大洗町フォーマット (タイトル行に含まれる文字列で判定)
      if (selectedCity === '大洗町' || titleRow.includes('寄附方法年度別集計') || titleRow.includes('寄附方法別集計')) {
          await processOaraiFormat(json, titleRow);
      } else {
          // 他自治体用フォーマット
          if (file.name.includes('月別')) {
              await processNewMonthlyFormat(json);
          } else if (file.name.includes('日毎') || file.name.includes('日別')) {
              await processNewDailyFormat(json);
          } else {
              throw new Error("不明なファイル形式です。");
          }
      }

    } catch (error) {
      console.error(error);
      setUploadStatus("error");
      setUploadMessage(`エラー: ${error.message || "解析失敗"}`);
    }
  };

  // --- 大洗町専用フォーマット処理 ---
  const processOaraiFormat = async (json, titleRow) => {
      // json[0]: Title
      // json[1]: Header (Method names at 3, 5, 7...)
      // json[2]: Sub-header (Count, Amount)
      // json[3~]: Data

      const isMonthly = titleRow.includes('年度別集計');
      const isDaily = titleRow.includes('寄附方法別集計');

      if (isMonthly) {
          // === 月別データの更新 (年度推移) ===
          // 形式: [月, 件数, 金額, (Method1件数, Method1金額), ...]
          // 開始行: index 3 (4行目)
          const newMonthly = [...(detailData[selectedCity]?.monthly || [])];
          
          let totalCurrent = 0;

          for (let i = 3; i < json.length; i++) {
              const row = json[i];
              if (!row || row.length < 3) continue;

              const monthVal = row[0]; // 4, 5, ..., 12, 1, 2, 3
              if (!monthVal) continue;
              
              const amountVal = row[2]; // 全体合計金額
              const amount = typeof amountVal === 'number' ? amountVal : parseFloat(String(amountVal).replace(/,/g, '')) || 0;

              const mStr = `${monthVal}月`;
              const idx = newMonthly.findIndex(m => m.month === mStr);
              if (idx !== -1) {
                  // 今年度(thisYear)を更新。過去データは既存を維持
                  newMonthly[idx] = {
                      ...newMonthly[idx],
                      thisYear: amount,
                      // 前年比計算
                      yoyRate: newMonthly[idx].lastYear > 0 ? parseFloat(((amount / newMonthly[idx].lastYear) * 100).toFixed(1)) : 0
                  };
                  totalCurrent += amount;
              }
          }

          // Summary Update
          const currentSummary = summaryData.find(c => c.name === selectedCity) || {};
          const updatedSummary = summaryData.map(c => {
              if (c.name === selectedCity) {
                  const currentTotal = newMonthly.reduce((sum, m) => sum + m.thisYear, 0);
                  const achievement = c.target > 0 ? Math.round((currentTotal / c.target) * 100) : 0;
                  const totalLast = newMonthly.reduce((sum, m) => sum + m.lastYear, 0);
                  const yoy = totalLast > 0 ? parseFloat(((currentTotal / totalLast) * 100).toFixed(1)) : c.yoy;
                  
                  return { ...c, current: currentTotal, achievement, yoy };
              }
              return c;
          });

          // Save
          const updatedDetail = { ...detailData[selectedCity], monthly: newMonthly };
          setDetailData(prev => ({ ...prev, [selectedCity]: updatedDetail }));
          setSummaryData(updatedSummary);
          await saveToFirestore(updatedSummary, { [selectedCity]: updatedDetail }, selectedCity);
          setUploadStatus("success");
          setUploadMessage("大洗町：月別実績を更新しました" + (isTestMode ? "(テスト)" : ""));

      } else if (isDaily) {
          // === 日別・ポータル別データの更新 ===
          // タイトルから対象年月を取得 (例: "寄附方法別集計(2026年3月)")
          const dateMatch = titleRow.match(/(\d+)年(\d+)月/);
          if (!dateMatch) throw new Error("ファイル名またはタイトルから対象年月を特定できませんでした");
          
          const year = parseInt(dateMatch[1]);
          const month = parseInt(dateMatch[2]);
          
          // ポータル名の抽出 (Row 1, index 1)
          const headerRow = json[1];
          const platforms = [];
          const platformColIndices = {}; // { colIndex: "PlatformName" }

          for (let c = 3; c < headerRow.length; c += 2) {
              const pName = headerRow[c];
              if (pName && typeof pName === 'string' && pName.trim() !== "") {
                  // 金額カラムは c+1
                  platformColIndices[c + 1] = pName.trim();
                  platforms.push({ name: pName.trim(), value: 0 }); // 初期化
              }
          }

          const dailyTotals = {};
          
          // データ行スキャン (Row 3 ~)
          for (let i = 3; i < json.length; i++) {
              const row = json[i];
              if (!row || row.length < 3) continue;

              const dayVal = row[0]; // 日付 (1, 2, ..., 31)
              // "合計"行等はスキップ
              if (isNaN(parseInt(dayVal))) continue; 
              const day = parseInt(dayVal);

              const totalAmountVal = row[2];
              const totalAmount = typeof totalAmountVal === 'number' ? totalAmountVal : parseFloat(String(totalAmountVal).replace(/,/g, '')) || 0;
              
              dailyTotals[day] = totalAmount;

              // ポータル別集計加算
              Object.entries(platformColIndices).forEach(([colIdx, pName]) => {
                  const val = row[colIdx];
                  const amount = typeof val === 'number' ? val : parseFloat(String(val).replace(/,/g, '')) || 0;
                  const p = platforms.find(p => p.name === pName);
                  if (p) p.value += amount;
              });
          }

          platforms.sort((a, b) => b.value - a.value);

          // Save
          const currentDetail = detailData[selectedCity] || {};
          const rawDailyData = { ...currentDetail.rawDailyData };
          
          if (!rawDailyData[year]) rawDailyData[year] = {};
          if (!rawDailyData[year][month]) rawDailyData[year][month] = {};

          rawDailyData[year][month] = {
              ...dailyTotals,
              platforms: platforms
          };

          const updatedDetail = {
              ...currentDetail,
              rawDailyData: rawDailyData,
              platforms: platforms // 最新月としてセット
          };

          setDetailData(prev => ({ ...prev, [selectedCity]: updatedDetail }));
          
          await saveToFirestore(summaryData, { [selectedCity]: updatedDetail }, selectedCity);
          
          setUploadStatus("success");
          setUploadMessage(`大洗町：${month}月の日別・ポータル別データを更新しました` + (isTestMode ? "(テスト)" : ""));
      }
  };

  // --- 他自治体用ロジック 1: 月別寄附集計 ---
  const processNewMonthlyFormat = async (json) => {
    const headerRowIdx = json.findIndex(row => row.some(c => String(c).includes('04月') || String(c).includes('4月')));
    if (headerRowIdx === -1) throw new Error("月別データのヘッダーが見つかりません");
    
    const header = json[headerRowIdx];
    const monthMap = {};
    FISCAL_YEAR_MONTHS.forEach(m => {
        const idx = header.findIndex(c => String(c).replace(/^0/, '') === m.replace(/^0/, ''));
        if (idx !== -1) monthMap[m] = idx;
    });

    let thisYearRow, lastYearRow, prevYearRow;
    json.forEach(row => {
        const rowStr = row.join('');
        if (rowStr.includes('今年')) thisYearRow = row;
        if (rowStr.includes('前年') && !rowStr.includes('前々年') && !rowStr.includes('対比')) lastYearRow = row;
        if (rowStr.includes('前々年')) prevYearRow = row;
    });

    const newMonthly = FISCAL_YEAR_MONTHS.map(m => {
        const colIdx = monthMap[m];
        if (colIdx === undefined) return { month: m, thisYear: 0, lastYear: 0, prevYear: 0, yoyRate: 0 };

        const cleanVal = (val) => {
             const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/,/g, '')) || 0;
             return num * 1000; 
        };

        const thisYear = thisYearRow ? cleanVal(thisYearRow[colIdx]) : 0;
        const lastYear = lastYearRow ? cleanVal(lastYearRow[colIdx]) : 0;
        const prevYear = prevYearRow ? cleanVal(prevYearRow[colIdx]) : 0;
        const yoyRate = lastYear > 0 ? parseFloat(((thisYear / lastYear) * 100).toFixed(1)) : 0;

        return { month: m, thisYear, lastYear, prevYear, yoyRate };
    });

    const currentDetail = detailData[selectedCity] || {};
    const updatedDetail = { ...currentDetail, monthly: newMonthly };

    const totalCurrent = newMonthly.reduce((sum, m) => sum + m.thisYear, 0);
    const totalLast = newMonthly.reduce((sum, m) => sum + m.lastYear, 0);
    const totalYoY = totalLast > 0 ? parseFloat(((totalCurrent / totalLast) * 100).toFixed(1)) : 0;

    const updatedSummaryList = summaryData.map(city => {
        if (city.name === selectedCity) {
            const achievement = city.target > 0 ? Math.round((totalCurrent / city.target) * 100) : 0;
            return { ...city, current: totalCurrent, yoy: totalYoY, achievement };
        }
        return city;
    });

    setDetailData(prev => ({ ...prev, [selectedCity]: updatedDetail }));
    setSummaryData(updatedSummaryList);
    await saveToFirestore(updatedSummaryList, { [selectedCity]: updatedDetail }, selectedCity);

    setUploadStatus("success");
    setUploadMessage(`${selectedCity}: 月別データを更新しました` + (isTestMode ? "(テスト)" : ""));
  };

  // --- 他自治体用ロジック 2: 日毎寄附集計 ---
  const processNewDailyFormat = async (json) => {
    const headerRowIdx = json.findIndex(row => row.some(c => String(c).includes('寄附方法') || String(c).includes('1日')));
    if (headerRowIdx === -1) throw new Error("日別データのヘッダーが見つかりません");

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
        if (!row || !row[0]) continue;
        
        const name = String(row[0]).trim();
        if (['合計', '計', '総計'].includes(name)) continue;

        const isPlatform = PLATFORM_KEYWORDS.some(kw => name.includes(kw));
        if (!isPlatform) continue;

        let rowTotal = 0;
        Object.entries(dayMap).forEach(([day, colIdx]) => {
            let val = row[colIdx];
            let num = typeof val === 'number' ? val : parseFloat(String(val).replace(/,/g, '')) || 0;
            if (num > 0) {
                 if (!dailyTotals[day]) dailyTotals[day] = 0;
                 dailyTotals[day] += num;
                 rowTotal += num;
            }
        });

        if (rowTotal > 0) {
            platformTotals.push({ name, value: rowTotal });
        }
    }
    platformTotals.sort((a, b) => b.value - a.value);

    const currentDetail = detailData[selectedCity] || {};
    const rawDailyData = { ...currentDetail.rawDailyData };
    
    const fiscalYear = CURRENT_FISCAL_YEAR;
    const calendarYear = getFiscalYearCalendarYear(fiscalYear, selectedMonth);

    if (!rawDailyData[calendarYear]) rawDailyData[calendarYear] = {};
    if (!rawDailyData[calendarYear][selectedMonth]) rawDailyData[calendarYear][selectedMonth] = {};

    rawDailyData[calendarYear][selectedMonth] = {
        ...dailyTotals,
        platforms: platformTotals
    };

    const updatedDetail = {
        ...currentDetail,
        rawDailyData: rawDailyData,
        platforms: platformTotals
    };

    setDetailData(prev => ({ ...prev, [selectedCity]: updatedDetail }));
    await saveToFirestore(summaryData, { [selectedCity]: updatedDetail }, selectedCity);

    setUploadStatus("success");
    setUploadMessage(`${selectedCity}: ${selectedMonth}月の日別データを更新しました` + (isTestMode ? "(テスト)" : ""));
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
        
        const yoyRate = y2024 > 0 ? parseFloat(((y2025 / y2024) * 100).toFixed(1)) : 0;
        data.push({ day: `${selectedMonth}/${d}`, y2025, y2024, y2023, yoyRate });
    }

    if (!hasData) return <div className="h-full flex items-center justify-center text-slate-400">データなし</div>;

    return (
      <ResponsiveContainer width="100%" height={350}>
        <ComposedChart data={data} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="day" tick={{fontSize: 10}} interval={2} />
          <YAxis yAxisId="left" tickFormatter={(val) => `${(val/10000).toFixed(0)}万`} width={40} tick={{fontSize: 10}} />
          <YAxis yAxisId="right" orientation="right" unit="%" width={40} tick={{fontSize: 10}} />
          <RechartsTooltip 
            formatter={(value, name) => [name === "昨対比" ? `${value}%` : formatCurrency(value), name]}
            labelFormatter={(label) => String(label)}
          />
          <Legend wrapperStyle={{paddingTop: '10px'}} iconType="circle"/>
          <ReferenceLine yAxisId="right" y={100} stroke="red" strokeDasharray="3 3" />
          <Bar yAxisId="left" dataKey="y2025" name="2025年度 (R7)" fill="#0088FE" radius={[4, 4, 0, 0]} />
          <Bar yAxisId="left" dataKey="y2024" name="2024年度 (R6)" fill="#00C49F" radius={[4, 4, 0, 0]} />
          <Bar yAxisId="left" dataKey="y2023" name="2023年度 (R5)" fill="#FF8042" radius={[4, 4, 0, 0]} />
          <Line yAxisId="right" type="monotone" dataKey="yoyRate" name="昨対比" stroke="#FF0000" strokeWidth={2} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    );
  };
  
  const PlatformShareChart = () => {
      const detail = detailData[selectedCity] || {};
      const calendarYear = getFiscalYearCalendarYear(CURRENT_FISCAL_YEAR, selectedMonth);
      const currentMonthPlatforms = detail.rawDailyData?.[calendarYear]?.[selectedMonth]?.platforms || detail.platforms || [];
      
      const data = currentMonthPlatforms;
      if (data.length === 0) return <div className="h-full flex items-center justify-center text-slate-400">データなし</div>;

      return (
        <ResponsiveContainer width="100%" height={300}>
            <PieChart>
                <Pie
                    data={data} cx="50%" cy="50%" innerRadius={40} outerRadius={70} fill="#8884d8" paddingAngle={2} dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                    {data.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                </Pie>
                <RechartsTooltip formatter={(value) => formatCurrency(value)} />
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
            <RechartsTooltip formatter={(value, name) => [`${value}%`, name]} />
            <Legend wrapperStyle={{paddingTop: '10px'}}/>
            <Bar dataKey="achievement" name="目標達成率" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={12} />
            <Bar dataKey="yoy" name="昨年対比" fill="#10b981" radius={[0, 4, 4, 0]} barSize={12} />
        </ComposedChart>
    </ResponsiveContainer>
  );

  return (
    <div className="flex h-screen bg-slate-50 text-slate-800 font-sans overflow-hidden">
      {/* サイドバー */}
      <div className={`fixed inset-y-0 left-0 z-50 bg-slate-900 text-white transition-all duration-300 ease-in-out flex flex-col ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 ${isCollapsed ? 'w-20' : 'w-72'}`}>
        
        <button onClick={() => setIsSidebarOpen(false)} className="md:hidden absolute top-4 right-4 text-slate-400 hover:text-white p-2">
          <X size={24} />
        </button>

        <button onClick={() => setIsCollapsed(!isCollapsed)} className="hidden md:flex absolute -right-3 top-9 bg-slate-700 rounded-full p-1 border border-slate-600 text-slate-300 hover:text-white hover:bg-slate-600 shadow-md z-50">
          {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>

        <div className={`p-6 border-b border-slate-700 flex items-center ${isCollapsed ? 'justify-center' : 'gap-2'}`}>
          <LayoutDashboard size={24} className="text-blue-400 shrink-0" />
          {!isCollapsed && (
            <h1 className="text-xl font-bold leading-tight">ふるさと納税<br/>管理ボード</h1>
          )}
        </div>
        
        <nav className="p-4 space-y-2 flex-1">
          <button onClick={() => { setActiveTab('overview'); setIsSidebarOpen(false); }} className={`w-full flex items-center px-4 py-3 rounded-lg transition-colors ${activeTab === 'overview' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-300 hover:bg-slate-800'} ${isCollapsed ? 'justify-center' : 'gap-3'}`}>
            <TrendingUp size={20} className="shrink-0" />
            {!isCollapsed && <span>全体サマリー</span>}
          </button>
          <button onClick={() => { setActiveTab('detail'); setIsSidebarOpen(false); }} className={`w-full flex items-center px-4 py-3 rounded-lg transition-colors ${activeTab === 'detail' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-300 hover:bg-slate-800'} ${isCollapsed ? 'justify-center' : 'gap-3'}`}>
            <FileSpreadsheet size={20} className="shrink-0" />
            {!isCollapsed && <span>個別詳細・昨対分析</span>}
          </button>
        </nav>

        {!isCollapsed && (
          <div className="px-4 pb-2">
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
              <Database size={14} /><span>データ保存状況</span>
            </div>
            <div className="bg-slate-800 rounded px-3 py-2 border border-slate-700 flex items-center justify-between">
              <span className={`text-xs flex items-center gap-1 ${dbStatus === 'saving' ? 'text-yellow-400' : dbStatus === 'saved' ? 'text-emerald-400' : 'text-slate-400'}`}>
                {dbStatus === 'idle' && <CheckCircle size={12} />}
                {dbStatus === 'saving' && <Activity size={12} className="animate-spin" />}
                {dbStatus === 'loading' && <Activity size={12} className="animate-spin" />}
                {dbStatus === 'saved' && <Cloud size={12} />}
                {dbStatus === 'idle' ? '変更なし' : dbStatus === 'saving' ? '保存中...' : dbStatus === 'loading' ? '読込中...' : '保存完了'}
              </span>
            </div>
          </div>
        )}

        {/* Test Mode Toggle */}
        {!isCollapsed && (
          <div className="px-4 pb-4">
             <div className="flex items-center justify-between bg-slate-800 p-3 rounded border border-slate-700">
               <span className="text-xs font-bold text-slate-300">テストモード</span>
               <button 
                 onClick={() => setIsTestMode(!isTestMode)}
                 className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${isTestMode ? 'bg-orange-500' : 'bg-slate-600'}`}
               >
                 <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${isTestMode ? 'translate-x-5' : 'translate-x-1'}`} />
               </button>
             </div>
             {isTestMode && <p className="text-[10px] text-orange-400 mt-1">※DB保存されません（表示のみ）</p>}
          </div>
        )}

        <div className="p-4 border-t border-slate-700 bg-slate-800">
          <label className="flex flex-col gap-2 cursor-pointer group">
            {!isCollapsed && (
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 group-hover:text-blue-400 transition-colors">データ取込 ({selectedCity})</span>
                {uploadStatus === 'loading' && <Activity size={12} className="animate-spin text-blue-400" />}
                {uploadStatus === 'success' && <CheckCircle size={12} className="text-emerald-400" />}
                {uploadStatus === 'error' && <AlertCircle size={12} className="text-red-400" />}
              </div>
            )}
            
            <div className={`relative flex items-center justify-center bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-md transition-colors border border-slate-600 group-hover:border-blue-500 border-dashed overflow-hidden ${isCollapsed ? 'p-3' : 'px-3 py-4 gap-2'}`} title="Excelをドロップ">
              <Upload size={isCollapsed ? 20 : 18} className="shrink-0" />
              {!isCollapsed && <span className="text-sm font-bold">ファイルをドロップ</span>}
              <input type="file" className="hidden" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} />
              {uploadStatus === 'loading' && <div className="absolute bottom-0 left-0 h-1 bg-blue-500 animate-pulse w-full"></div>}
            </div>
            
            {!isCollapsed && uploadMessage && <p className={`text-[10px] leading-tight mt-1 ${uploadStatus === 'error' ? 'text-red-400' : uploadStatus === 'success' ? 'text-emerald-400' : 'text-blue-300'}`}>{uploadMessage}</p>}
          </label>
        </div>
      </div>

      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        <header className="bg-white border-b border-slate-200 p-4 flex justify-between items-center md:hidden">
          <button onClick={() => setIsSidebarOpen(true)} className="text-slate-600"><Menu size={24} /></button>
          <span className="font-bold text-slate-800">ダッシュボード</span>
          <div className="w-6"></div>
        </header>

        <div className="bg-white px-8 py-4 border-b border-slate-100 flex justify-between items-center">
          <h2 className="text-xl font-bold text-slate-800">
            {activeTab === 'overview' ? '全体サマリー' : '個別詳細・昨対分析'}
          </h2>
          <div className="flex gap-2">
            <button 
              onClick={handleRefresh} disabled={isDbLoading}
              className="flex items-center gap-2 bg-slate-100 text-slate-600 px-4 py-2 rounded-lg hover:bg-slate-200 transition-all disabled:opacity-50"
            >
               <RefreshCw size={18} className={isDbLoading ? "animate-spin" : ""} />
               <span className="hidden md:inline">再読込</span>
            </button>
            <button 
              onClick={handleRunAIAnalysis} disabled={isAiLoading}
              className="flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-4 py-2 rounded-lg hover:shadow-md transition-all disabled:opacity-70"
            >
              {isAiLoading ? <Activity size={18} className="animate-spin" /> : <Sparkles size={18} />}
              <span>{isAiLoading ? '分析中...' : 'AI分析を実行'}</span>
            </button>
          </div>
        </div>

        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          {showAiPanel && (
            <div className="mb-6 bg-white rounded-xl shadow-sm border border-indigo-100 overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300">
              <div className="bg-indigo-50 px-6 py-3 border-b border-indigo-100 flex justify-between items-center">
                <div className="flex items-center gap-2 text-indigo-800 font-bold"><Bot size={20} /><span>AI アナリストの分析レポート</span></div>
                <button onClick={() => setShowAiPanel(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
              </div>
              <div className="p-6 text-slate-700 leading-relaxed whitespace-pre-wrap">{aiAnalysis || "データを分析中..."}</div>
            </div>
          )}

          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-2">
                <div><p className="text-slate-500 text-sm mt-1">R7年度 実績と目標達成状況</p></div>
                <div className="bg-white px-4 py-2 rounded-full shadow-sm border border-slate-200 text-sm text-slate-600 flex items-center gap-2"><Calendar size={16} /><span>データ基準: 4月1日〜現在</span></div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                 <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 relative overflow-hidden">
                  <div className="absolute right-0 top-0 p-4 opacity-10"><DollarSign size={64} className="text-blue-600" /></div>
                  <p className="text-slate-500 text-sm font-medium">総寄附実績 (年度累計)</p>
                  <p className="text-3xl font-bold text-slate-800 mt-2">{formatCurrency(summaryData.reduce((acc, curr) => acc + curr.current, 0))}</p>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 relative overflow-hidden">
                  <div className="absolute right-0 top-0 p-4 opacity-10"><Target size={64} className="text-emerald-600" /></div>
                  <p className="text-slate-500 text-sm font-medium">平均達成率</p>
                  <p className="text-3xl font-bold text-slate-800 mt-2">{(summaryData.reduce((acc, curr) => acc + curr.achievement, 0) / summaryData.length).toFixed(1)}%</p>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 relative overflow-hidden">
                  <div className="absolute right-0 top-0 p-4 opacity-10"><Activity size={64} className="text-orange-600" /></div>
                  <p className="text-slate-500 text-sm font-medium">トップ達成率</p>
                  <div className="flex items-baseline gap-2 mt-2">
                    <p className="text-3xl font-bold text-slate-800">{[...summaryData].sort((a,b) => b.achievement - a.achievement)[0]?.name}</p>
                    <span className="text-lg font-semibold text-orange-600">{[...summaryData].sort((a,b) => b.achievement - a.achievement)[0]?.achievement}%</span>
                  </div>
                </div>
                 <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 relative overflow-hidden">
                  <div className="absolute right-0 top-0 p-4 opacity-10"><ArrowUpRight size={64} className="text-indigo-600" /></div>
                  <p className="text-slate-500 text-sm font-medium">トップ昨対 (年度)</p>
                  <div className="flex items-baseline gap-2 mt-2">
                    <p className="text-3xl font-bold text-slate-800">{[...summaryData].sort((a,b) => b.yoy - a.yoy)[0]?.name}</p>
                    <span className="text-lg font-semibold text-indigo-600">{[...summaryData].sort((a,b) => b.yoy - a.yoy)[0]?.yoy}%</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                  <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><BarChart2 size={20} className="text-blue-500" />自治体別 目標達成率 vs 年度昨対比</h3>
                  <SummaryChart />
                </div>
                <div className="bg-white p-0 rounded-xl shadow-sm border border-slate-100 flex flex-col">
                  <div className="p-6 border-b border-slate-100"><h3 className="text-lg font-bold text-slate-800">実績額ランキング</h3></div>
                  <div className="flex-1 overflow-auto p-2" style={{maxHeight: '400px'}}>
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 text-slate-500 sticky top-0 z-10">
                        <tr><th className="px-4 py-2 text-left font-medium">自治体</th><th className="px-4 py-2 text-right font-medium">実績額</th><th className="px-4 py-2 text-right font-medium">達成率</th></tr>
                      </thead>
                      <tbody>
                        {[...summaryData].sort((a, b) => b.current - a.current).map((item, idx) => (
                          <tr key={item.name} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-3 font-medium"><div className="flex items-center gap-2"><span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs text-white shrink-0 ${idx < 3 ? 'bg-yellow-500' : 'bg-slate-300'}`}>{idx + 1}</span><span>{item.name}</span></div></td>
                            <td className="px-4 py-3 text-right font-semibold text-slate-700">{formatCurrency(item.current)}</td>
                            <td className={`px-4 py-3 text-right ${item.achievement >= 100 ? 'text-green-600' : 'text-blue-500'}`}>{item.achievement}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'detail' && (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                <div><h2 className="text-2xl font-bold text-slate-800">個別詳細・昨対分析</h2><p className="text-slate-500 text-sm mt-1">3か年日次比較 (サイト合算)</p></div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-600">自治体:</span>
                  <div className="relative">
                    <select value={selectedCity} onChange={(e) => setSelectedCity(e.target.value)} className="appearance-none bg-slate-50 border border-slate-300 text-slate-800 py-2 pl-4 pr-10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium cursor-pointer hover:bg-slate-100">
                      {summaryData.map(city => <option key={city.name} value={city.name}>{city.name}</option>)}
                    </select>
                    <ChevronRight size={16} className="absolute right-3 top-1/2 transform -translate-y-1/2 rotate-90 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              <div className="flex justify-end mb-2">
                <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-slate-200">
                    <span className="text-xs text-slate-500 font-bold">表示月:</span>
                    <select value={selectedMonth} onChange={(e) => setSelectedMonth(parseInt(e.target.value))} className="text-sm font-bold text-slate-700 bg-transparent focus:outline-none">
                        {MONTHS_ORDER.map(m => <option key={m} value={m}>{m}月</option>)}
                    </select>
                </div>
              </div>

              {(() => {
                const targetMonthStr = `${selectedMonth}月`;
                const monthData = (detailData[selectedCity]?.monthly || []).find(m => m.month === targetMonthStr || m.month === `0${selectedMonth}月`) || {};
                const thisYearAmount = monthData.thisYear || 0;
                const lastYearAmount = monthData.lastYear || 0;
                const yoyMonth = monthData.yoyRate || 0;
                const isPositiveMonth = yoyMonth >= 100;

                const citySummary = summaryData.find(c => c.name === selectedCity) || {};
                const totalAmount = citySummary.current || 0;
                const totalYoy = citySummary.yoy || 0;
                const isPositiveTotal = totalYoy >= 100;

                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between relative overflow-hidden">
                      <div className="relative z-10">
                        <p className="text-slate-500 text-sm font-bold mb-1">{selectedMonth}月度 寄附実績</p>
                        <p className="text-3xl font-bold text-slate-800">{formatCurrency(thisYearAmount)}</p>
                        <p className="text-xs text-slate-400 mt-1">前年実績: {formatCurrency(lastYearAmount)}</p>
                      </div>
                      <div className="p-3 bg-blue-50 rounded-full text-blue-600 relative z-10"><DollarSign size={28} /></div>
                    </div>

                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between relative overflow-hidden">
                      <div className="relative z-10">
                        <p className="text-slate-500 text-sm font-bold mb-1">{selectedMonth}月度 昨年対比</p>
                        <div className="flex items-baseline gap-2">
                          <p className={`text-3xl font-bold ${isPositiveMonth ? 'text-emerald-600' : 'text-red-500'}`}>{yoyMonth}%</p>
                          <span className={`text-sm font-medium ${isPositiveMonth ? 'text-emerald-600' : 'text-red-500'}`}>{isPositiveMonth ? '▲' : '▼'} {Math.abs(yoyMonth - 100).toFixed(1)}%</span>
                        </div>
                      </div>
                      <div className={`p-3 rounded-full relative z-10 ${isPositiveMonth ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}><Activity size={28} /></div>
                    </div>

                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between relative overflow-hidden">
                      <div className="relative z-10">
                        <p className="text-slate-500 text-sm font-bold mb-1">年度累計 寄附実績</p>
                        <p className="text-3xl font-bold text-slate-800">{formatCurrency(totalAmount)}</p>
                        <p className="text-xs text-slate-400 mt-1">目標: {formatCurrency(citySummary.target)}</p>
                      </div>
                      <div className="p-3 bg-indigo-50 rounded-full text-indigo-600 relative z-10"><DollarSign size={28} /></div>
                    </div>

                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between relative overflow-hidden">
                      <div className="relative z-10">
                        <p className="text-slate-500 text-sm font-bold mb-1">年度累計 昨年対比</p>
                        <div className="flex items-baseline gap-2">
                          <p className={`text-3xl font-bold ${isPositiveTotal ? 'text-emerald-600' : 'text-red-500'}`}>{totalYoy}%</p>
                          <span className={`text-sm font-medium ${isPositiveTotal ? 'text-emerald-600' : 'text-red-500'}`}>{isPositiveTotal ? '▲' : '▼'} {Math.abs(totalYoy - 100).toFixed(1)}%</span>
                        </div>
                      </div>
                      <div className={`p-3 rounded-full relative z-10 ${isPositiveTotal ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}><Activity size={28} /></div>
                    </div>
                  </div>
                );
              })()}

              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><BarChart2 size={20} className="text-blue-500" />{selectedMonth}月の実績比較 (日別・3か年)</h3>
                  <div className="text-sm text-slate-500"><span className="bg-blue-50 text-blue-600 px-2 py-1 rounded border border-blue-100 font-bold">対象: {selectedMonth}月</span></div>
                </div>
                <DailyComparisonChart />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                  <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                    <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><TrendingUp size={20} className="text-emerald-500" />月別 寄附実績 (3か年比較)</h3>
                    <ResponsiveContainer width="100%" height={250}>
                      <ComposedChart data={detailData[selectedCity]?.monthly || []} margin={{ top: 5, right: 10, left: 0, bottom: 0 }} barGap={0}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="month" tick={{fontSize: 10}} />
                        <YAxis yAxisId="left" tickFormatter={(val) => `${(val/10000).toFixed(0)}万`} width={50} tick={{fontSize: 10}} />
                        <YAxis yAxisId="right" orientation="right" unit="%" width={40} tick={{fontSize: 10}} />
                        <RechartsTooltip formatter={(value, name) => [name === "昨対比" ? `${value}%` : formatCurrency(value), name]} />
                        <Legend wrapperStyle={{paddingTop: '10px'}} iconType="circle"/>
                        <Bar yAxisId="left" dataKey="thisYear" fill="#0088FE" radius={[4, 4, 0, 0]} name="今年(R7)" />
                        <Bar yAxisId="left" dataKey="lastYear" fill="#00C49F" radius={[4, 4, 0, 0]} name="前年(R6)" />
                        <Bar yAxisId="left" dataKey="prevYear" fill="#FF8042" radius={[4, 4, 0, 0]} name="前々年(R5)" />
                        <Line yAxisId="right" type="monotone" dataKey="yoyRate" name="昨対比" stroke="#FF0000" strokeWidth={2} dot={false} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                    <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><PieChartIcon size={20} className="text-orange-500" />ポータルサイト別 シェア ({selectedMonth}月)</h3>
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