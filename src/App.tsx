// --- 修正版 App.js 抜粋（主要部分のみ。全体を差し替えてください） ---

import React, { useState, useEffect, useCallback } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, 
  LineChart, Line, PieChart, Pie, Cell, ComposedChart, ReferenceLine
} from 'recharts';
import { 
  LayoutDashboard, TrendingUp, DollarSign, Calendar, Upload, 
  FileSpreadsheet, Target, ChevronRight, Menu, X, Activity, AlertCircle, CheckCircle, BarChart2, PieChart as PieChartIcon,
  ChevronLeft, Database, Cloud, RefreshCw, Sparkles, Bot
} from 'lucide-react';

// --- Firebase系 (既存と同じ) ---
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, writeBatch } from "firebase/firestore";

const FISCAL_YEAR_MONTHS = ['4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月', '1月', '2月', '3月'];
const MONTHS_ORDER = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3];
const CURRENT_FISCAL_YEAR = 2025;
const PLATFORM_KEYWORDS = ['楽天', 'ふるさとチョイス', 'さとふる', 'ふるなび', 'ANA', 'au PAY', '三越伊勢丹', 'JRE', 'JAL', 'マイナビ', 'セゾン', 'モンベル', 'ふるラボ', 'まいふる', 'Amazon'];
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

  // 初期化：すべての自治体の詳細データをセット
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
    if (isTestMode) return;
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

  // --- 解析ロジック (大洗町特化) ---
  const processOaraiFormat = async (json, titleRow) => {
    const yearMatch = titleRow.match(/(20\d{2}|令和\d+)/);
    const fiscalYear = yearMatch && yearMatch[0].includes('令和') ? 2018 + parseInt(yearMatch[0].replace(/\D/g, '')) : 2025;
    
    const isMonthly = titleRow.includes('年度別集計');
    const cityData = { ...detailData[selectedCity] };

    if (isMonthly) {
      const newMonthly = [...cityData.monthly];
      for (let i = 3; i < json.length; i++) {
        const row = json[i];
        if (!row || isNaN(parseInt(row[0]))) continue;
        const monthStr = `${parseInt(row[0])}月`;
        const amount = typeof row[2] === 'number' ? row[2] : parseFloat(String(row[2]).replace(/,/g, '')) || 0;
        
        const idx = newMonthly.findIndex(m => m.month === monthStr);
        if (idx !== -1) {
          if (fiscalYear === 2025) newMonthly[idx].thisYear = amount;
          else if (fiscalYear === 2024) newMonthly[idx].lastYear = amount;
          else if (fiscalYear === 2023) newMonthly[idx].prevYear = amount;
          
          if (newMonthly[idx].lastYear > 0) {
            newMonthly[idx].yoyRate = parseFloat(((newMonthly[idx].thisYear / newMonthly[idx].lastYear) * 100).toFixed(1));
          }
        }
      }
      cityData.monthly = newMonthly;
      const totalCurrent = newMonthly.reduce((s, m) => s + m.thisYear, 0);
      const updatedSummary = summaryData.map(c => c.name === selectedCity ? { ...c, current: totalCurrent, achievement: c.target > 0 ? Math.round((totalCurrent/c.target)*100) : 0 } : c);
      
      setDetailData(prev => ({ ...prev, [selectedCity]: cityData }));
      setSummaryData(updatedSummary);
      await saveToFirestore(updatedSummary, { [selectedCity]: cityData }, selectedCity);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!window.confirm(`${selectedCity} のデータを更新しますか？`)) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const bstr = evt.target.result;
      const wb = window.XLSX.read(bstr, { type: 'binary' });
      const json = window.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
      const title = json[0] ? json[0].join('') : '';
      
      if (selectedCity === '大洗町' || title.includes('寄附方法')) {
        await processOaraiFormat(json, title);
      }
    };
    reader.readAsBinaryString(file);
  };

  // --- グラフコンポーネント ---
  const MonthlyChart = () => {
    const data = detailData[selectedCity]?.monthly || [];
    return (
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 20, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="month" tick={{fontSize: 12}} />
            <YAxis yAxisId="left" tickFormatter={v => `${(v/10000).toFixed(0)}万`} width={50} />
            <YAxis yAxisId="right" orientation="right" unit="%" width={40} />
            <RechartsTooltip formatter={(v, n) => [n === "昨対比" ? `${v}%` : formatCurrency(v), n]} />
            <Legend verticalAlign="top" height={36}/>
            <Bar yAxisId="left" dataKey="thisYear" fill="#3b82f6" name="今年(R7)" radius={[4, 4, 0, 0]} />
            <Bar yAxisId="left" dataKey="lastYear" fill="#10b981" name="前年(R6)" radius={[4, 4, 0, 0]} />
            <Bar yAxisId="left" dataKey="prevYear" fill="#f59e0b" name="前々年(R5)" radius={[4, 4, 0, 0]} />
            <Line yAxisId="right" type="monotone" dataKey="yoyRate" name="昨対比" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-slate-50 text-slate-800 font-sans overflow-hidden">
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
            {isTestMode && <p className="text-[10px] text-orange-300 leading-tight">データは保存されません</p>}
          </div>
          
          <label className="block w-full cursor-pointer bg-blue-600 hover:bg-blue-500 text-center py-3 rounded-lg font-bold transition-colors">
            <Upload size={18} className="inline mr-2" />
            {!isCollapsed && "データ取込"}
            <input type="file" className="hidden" onChange={handleFileUpload} />
          </label>
        </div>
      </aside>

      {/* メイン */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white h-16 border-b border-slate-200 px-8 flex items-center justify-between shrink-0">
          <h2 className="text-xl font-bold">{activeTab === 'overview' ? '全体サマリー' : '自治体別詳細'}</h2>
          <div className="flex items-center gap-4">
            {dbStatus === 'saving' && <span className="text-xs text-orange-500 flex items-center gap-1"><RefreshCw size={12} className="animate-spin"/> 保存中...</span>}
            {dbStatus === 'saved' && <span className="text-xs text-green-500 flex items-center gap-1"><CheckCircle size={12}/> 保存完了</span>}
            <div className="bg-slate-100 px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2">
              <Database size={14} /> {selectedCity}
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8">
          {activeTab === 'detail' ? (
            <div className="max-w-6xl mx-auto space-y-8">
              {/* セレクター */}
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-wrap gap-4 items-center">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-500">自治体:</span>
                  <select value={selectedCity} onChange={(e) => setSelectedCity(e.target.value)} className="bg-slate-50 border border-slate-300 rounded px-3 py-1 font-bold outline-none focus:ring-2 focus:ring-blue-500">
                    {INITIAL_SUMMARY_DATA.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-500">分析月:</span>
                  <select value={selectedMonth} onChange={(e) => setSelectedMonth(parseInt(e.target.value))} className="bg-slate-50 border border-slate-300 rounded px-3 py-1 font-bold outline-none">
                    {MONTHS_ORDER.map(m => <option key={m} value={m}>{m}月</option>)}
                  </select>
                </div>
              </div>

              {/* メインチャートエリア */}
              <div className="grid grid-cols-1 gap-8">
                {/* 3か年比較 */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold flex items-center gap-2"><BarChart2 className="text-blue-500" /> 月別 寄附実績 (3か年比較)</h3>
                    <span className="text-xs text-slate-400 font-medium">※年度別のファイルをアップロードすると各年の棒が表示されます</span>
                  </div>
                  <MonthlyChart />
                </div>

                {/* 下段：シェアと詳細 */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                   <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 min-h-[400px]">
                      <h3 className="text-lg font-bold mb-6 flex items-center gap-2"><PieChartIcon className="text-orange-500" /> ポータルシェア</h3>
                      <div className="h-[300px] flex items-center justify-center text-slate-300 font-bold border-2 border-dashed border-slate-100 rounded-xl italic">
                        日別データをアップロードすると表示されます
                      </div>
                   </div>
                   <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                      <h3 className="text-lg font-bold mb-6 flex items-center gap-2"><Target className="text-green-500" /> 月別数値一覧</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="text-slate-500 border-b border-slate-100">
                            <tr><th className="py-2 text-left">月</th><th className="py-2 text-right">今年</th><th className="py-2 text-right">前年比</th></tr>
                          </thead>
                          <tbody>
                            {(detailData[selectedCity]?.monthly || []).map(m => (
                              <tr key={m.month} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                                <td className="py-3 font-bold">{m.month}</td>
                                <td className="py-3 text-right">{formatCurrency(m.thisYear)}</td>
                                <td className={`py-3 text-right font-bold ${m.yoyRate >= 100 ? 'text-green-600' : 'text-red-500'}`}>{m.yoyRate}%</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                   </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="max-w-6xl mx-auto flex items-center justify-center h-full text-slate-400 italic">
              サマリー画面（構築中）
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;