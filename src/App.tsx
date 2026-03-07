// --- 修正版 App.js (全文) ---
import React, { useState, useEffect, useCallback } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, 
  LineChart, Line, PieChart, Pie, Cell, ComposedChart, ReferenceLine
} from 'recharts';
import { 
  LayoutDashboard, TrendingUp, DollarSign, Calendar, Upload, 
  FileSpreadsheet, Target, ChevronRight, Menu, X, Activity, AlertCircle, CheckCircle, BarChart2, PieChart as PieChartIcon,
  ChevronLeft, Database, Cloud, RefreshCw
} from 'lucide-react';
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, writeBatch } from "firebase/firestore";

// --- 定数 ---
const FISCAL_YEAR_MONTHS = ['4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月', '1月', '2月', '3月'];
const MONTHS_ORDER = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3];
const PLATFORM_KEYWORDS = ['楽天', 'チョイス', 'さとふる', 'ふるなび', 'ANA', 'au PAY', '三越伊勢丹', 'JRE', 'JAL', 'マイナビ', 'セゾン', 'モンベル', 'ふるラボ', 'まいふる', 'Amazon'];
const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

const formatCurrency = (v) => {
  if (!v) return '0円';
  if (v >= 100000000) return `${(v / 100000000).toFixed(1)}億円`;
  return `${(v / 10000).toLocaleString()}万円`;
};

// Firebase設定
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

const App = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedCity, setSelectedCity] = useState('大洗町');
  const [summaryData, setSummaryData] = useState(INITIAL_SUMMARY_DATA);
  const [detailData, setDetailData] = useState({});
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isTestMode, setIsTestMode] = useState(true);
  const [dbStatus, setDbStatus] = useState('idle');
  const [uploadMsg, setUploadMsg] = useState('');

  // 詳細データの初期化
  useEffect(() => {
    const initialDetails = {};
    INITIAL_SUMMARY_DATA.forEach(city => {
      initialDetails[city.name] = {
        monthly: FISCAL_YEAR_MONTHS.map(m => ({ month: m, thisYear: 0, lastYear: 0, prevYear: 0, yoyRate: 0 })),
        rawDailyData: {},
        platforms: []
      };
    });
    setDetailData(initialDetails);
  }, []);

  const loadFromFirestore = useCallback(async (u) => {
    if (!u || !db) return;
    setDbStatus("loading");
    try {
      const summaryRef = doc(db, 'artifacts', appId, 'public', 'data', 'summary', 'main');
      const summarySnap = await getDoc(summaryRef);
      if (summarySnap.exists()) setSummaryData(summarySnap.data().list);

      const detailsRef = collection(db, 'artifacts', appId, 'public', 'data', 'details');
      const detailsSnap = await getDocs(detailsRef);
      const loaded = {};
      detailsSnap.forEach(doc => { loaded[doc.id] = doc.data(); });
      if (Object.keys(loaded).length > 0) setDetailData(prev => ({ ...prev, ...loaded }));
      setDbStatus("idle");
    } catch (e) { setDbStatus("error"); }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (u) loadFromFirestore(u);
      else signInAnonymously(auth);
    });
    return () => unsubscribe();
  }, [loadFromFirestore]);

  const saveToFirestore = async (newSummary, newDetails, targetCity) => {
    if (isTestMode) {
      console.log("【テストモード】保存をスキップしました:", targetCity);
      return;
    }
    setDbStatus("saving");
    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'artifacts', appId, 'public', 'data', 'summary', 'main'), { list: newSummary }, { merge: true });
      batch.set(doc(db, 'artifacts', appId, 'public', 'data', 'details', targetCity), newDetails[targetCity], { merge: true });
      await batch.commit();
      setDbStatus("saved");
      setTimeout(() => setDbStatus("idle"), 2000);
    } catch (e) { setDbStatus("error"); }
  };

  // --- 解析コアロジック ---
  const normalizeMonth = (val) => {
    const m = String(val).replace(/\D/g, '');
    return m ? `${parseInt(m)}月` : null;
  };

  const cleanNum = (val) => {
    if (typeof val === 'number') return val;
    return parseFloat(String(val).replace(/,/g, '')) || 0;
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!window.confirm(`${selectedCity} のデータを読み込みますか？`)) return;

    setUploadMsg('解析中...');
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = window.XLSX.read(bstr, { type: 'binary' });
        const json = window.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
        
        console.log("ファイル読み込み完了:", file.name, "行数:", json.length);

        const cityData = { ...detailData[selectedCity] };
        const title = json[0] ? String(json[0].join('')) : '';
        
        // --- 判定：大洗町フォーマット ---
        if (title.includes('寄附方法') || selectedCity === '大洗町') {
          console.log("大洗形式として解析開始");
          const yearMatch = title.match(/(20\d{2}|令和\d+)/);
          let fYear = 2025;
          if (yearMatch) {
            fYear = yearMatch[0].includes('令和') ? 2018 + parseInt(yearMatch[0].replace(/\D/g, '')) : parseInt(yearMatch[0]);
          }
          console.log("対象年度:", fYear);

          if (title.includes('年度別')) {
            const newMonthly = [...cityData.monthly];
            json.slice(3).forEach(row => {
              const mName = normalizeMonth(row[0]);
              if (!mName) return;
              const val = cleanNum(row[2]);
              const idx = newMonthly.findIndex(m => m.month === mName);
              if (idx !== -1) {
                if (fYear === 2025) newMonthly[idx].thisYear = val;
                else if (fYear === 2024) newMonthly[idx].lastYear = val;
                else if (fYear === 2023) newMonthly[idx].prevYear = val;
                
                if (newMonthly[idx].lastYear > 0) {
                  newMonthly[idx].yoyRate = parseFloat(((newMonthly[idx].thisYear / newMonthly[idx].lastYear) * 100).toFixed(1));
                }
              }
            });
            cityData.monthly = newMonthly;
          }
        } 
        // --- 判定：他自治体（標準）フォーマット ---
        else if (json.some(r => r.includes('今年（千円）'))) {
          console.log("標準形式(月別)として解析開始");
          const header = json.find(r => r.includes('04月') || r.includes('4月'));
          const rThis = json.find(r => String(r[0]).includes('今年'));
          const rLast = json.find(r => String(r[0]).includes('前年') && !String(r[0]).includes('前々年'));
          const rPrev = json.find(r => String(r[0]).includes('前々年'));

          const newMonthly = cityData.monthly.map(m => {
            const colIdx = header.findIndex(h => normalizeMonth(h) === m.month);
            if (colIdx === -1) return m;
            const thisY = cleanNum(rThis?.[colIdx]) * 1000;
            const lastY = cleanNum(rLast?.[colIdx]) * 1000;
            const prevY = cleanNum(rPrev?.[colIdx]) * 1000;
            return {
              ...m,
              thisYear: thisY,
              lastYear: lastY,
              prevYear: prevY,
              yoyRate: lastY > 0 ? parseFloat(((thisY / lastY) * 100).toFixed(1)) : 0
            };
          });
          cityData.monthly = newMonthly;
        }

        // 状態更新
        const totalCurrent = cityData.monthly.reduce((s, m) => s + m.thisYear, 0);
        const updatedSummary = summaryData.map(c => c.name === selectedCity ? { ...c, current: totalCurrent, achievement: c.target > 0 ? Math.round((totalCurrent/c.target)*100) : 0 } : c);
        
        setDetailData(prev => ({ ...prev, [selectedCity]: cityData }));
        setSummaryData(updatedSummary);
        await saveToFirestore(updatedSummary, { [selectedCity]: cityData }, selectedCity);
        
        console.log("解析成功:", selectedCity, "累計額:", totalCurrent);
        setUploadMsg('完了！');
        setTimeout(() => setUploadMsg(''), 3000);

      } catch (err) {
        console.error("解析エラー:", err);
        setUploadMsg('エラー発生');
      }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="flex h-screen bg-slate-50 text-slate-800 overflow-hidden font-sans">
      {/* サイドバー */}
      <aside className={`bg-slate-900 text-white flex flex-col transition-all duration-300 ${isCollapsed ? 'w-20' : 'w-64'} hidden md:flex`}>
        <div className="p-6 border-b border-slate-700 flex items-center gap-3">
          <LayoutDashboard className="text-blue-400" />
          {!isCollapsed && <span className="font-bold text-lg">ふるさと納税管理</span>}
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <button onClick={() => setActiveTab('overview')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg ${activeTab === 'overview' ? 'bg-blue-600' : 'hover:bg-slate-800'}`}>
            <TrendingUp size={20} /> {!isCollapsed && <span>全体サマリー</span>}
          </button>
          <button onClick={() => setActiveTab('detail')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg ${activeTab === 'detail' ? 'bg-blue-600' : 'hover:bg-slate-800'}`}>
            <FileSpreadsheet size={20} /> {!isCollapsed && <span>個別詳細・分析</span>}
          </button>
        </nav>

        <div className="p-4 border-t border-slate-700 space-y-4">
          <div className="bg-slate-800 p-3 rounded-lg border border-slate-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-400">テストモード</span>
              <button onClick={() => setIsTestMode(!isTestMode)} className={`w-8 h-4 rounded-full relative transition-colors ${isTestMode ? 'bg-orange-500' : 'bg-slate-600'}`}>
                <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${isTestMode ? 'right-0.5' : 'left-0.5'}`} />
              </button>
            </div>
          </div>
          
          <label className="block w-full cursor-pointer bg-blue-600 hover:bg-blue-500 text-center py-3 rounded-lg font-bold transition-all shadow-lg active:scale-95">
            <Upload size={18} className="inline mr-2" />
            {!isCollapsed && (uploadMsg || "データ取込")}
            <input type="file" className="hidden" onChange={handleFileUpload} accept=".xlsx,.xls,.csv" />
          </label>
        </div>
      </aside>

      {/* メイン */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white h-16 border-b border-slate-200 px-8 flex items-center justify-between shrink-0">
          <h2 className="text-xl font-bold">{activeTab === 'overview' ? '全体サマリー' : `${selectedCity} 詳細分析`}</h2>
          <div className="flex items-center gap-4">
            {dbStatus === 'loading' && <span className="text-xs text-slate-400 animate-pulse">読込中...</span>}
            <div className="bg-slate-100 px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2">
              <Database size={14} className="text-blue-600" /> {selectedCity}
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          {activeTab === 'detail' ? (
            <div className="max-w-6xl mx-auto space-y-6">
              {/* セレクター */}
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-wrap gap-6 items-center">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">自治体</span>
                  <select value={selectedCity} onChange={(e) => setSelectedCity(e.target.value)} className="bg-slate-50 border border-slate-300 rounded-lg px-4 py-1.5 font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all">
                    {INITIAL_SUMMARY_DATA.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
              </div>

              {/* グラフ */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <h3 className="text-lg font-bold mb-8 flex items-center gap-2 text-slate-700">
                  <BarChart2 className="text-blue-500" /> 月別 寄附実績 (3か年比較)
                </h3>
                <div className="h-[400px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={detailData[selectedCity]?.monthly || []} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                      <YAxis yAxisId="left" axisLine={false} tickLine={false} tickFormatter={v => `${(v/10000).toFixed(0)}万`} width={60} tick={{fill: '#64748b', fontSize: 12}} />
                      <YAxis yAxisId="right" orientation="right" unit="%" axisLine={false} tickLine={false} tick={{fill: '#ef4444', fontSize: 12}} />
                      <RechartsTooltip 
                        contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                        formatter={(v, n) => [n === "昨対比" ? `${v}%` : formatCurrency(v), n]} 
                      />
                      <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{paddingBottom: '20px'}} />
                      <Bar yAxisId="left" dataKey="thisYear" fill="#3b82f6" name="今年(R7)" radius={[4, 4, 0, 0]} barSize={20} />
                      <Bar yAxisId="left" dataKey="lastYear" fill="#94a3b8" name="前年(R6)" radius={[4, 4, 0, 0]} barSize={20} />
                      <Bar yAxisId="left" dataKey="prevYear" fill="#e2e8f0" name="前々年(R5)" radius={[4, 4, 0, 0]} barSize={20} />
                      <Line yAxisId="right" type="monotone" dataKey="yoyRate" name="昨対比" stroke="#ef4444" strokeWidth={3} dot={{ r: 4, fill: '#ef4444' }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* テーブル */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                  <Target className="text-green-500" /> 月別数値詳細
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-slate-400 text-sm border-b border-slate-100">
                        <th className="pb-3 text-left font-medium">対象月</th>
                        <th className="pb-3 text-right font-medium">今年度実績</th>
                        <th className="pb-3 text-right font-medium">前年度実績</th>
                        <th className="pb-3 text-right font-medium">昨年対比</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {(detailData[selectedCity]?.monthly || []).map(m => (
                        <tr key={m.month} className="hover:bg-slate-50 transition-colors">
                          <td className="py-4 font-bold text-slate-700">{m.month}</td>
                          <td className="py-4 text-right font-semibold">{formatCurrency(m.thisYear)}</td>
                          <td className="py-4 text-right text-slate-500">{formatCurrency(m.lastYear)}</td>
                          <td className={`py-4 text-right font-bold ${m.yoyRate >= 100 ? 'text-emerald-600' : 'text-rose-500'}`}>
                            {m.yoyRate > 0 ? `${m.yoyRate}%` : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-300">
              <PieChartIcon size={48} className="mb-4 opacity-20" />
              <p className="font-bold italic">Summary View Coming Soon...</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;