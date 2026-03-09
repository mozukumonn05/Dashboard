import React, { useState } from 'react';
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, collection, addDoc, serverTimestamp } from "firebase/firestore";
import * as XLSX from 'xlsx';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, ComposedChart 
} from 'recharts';
import { AlertCircle, CheckCircle2, Database, Sparkles, ShieldCheck, History } from 'lucide-react';

// --- Firebase 設定 (ご提示いただいた情報) ---
const firebaseConfig = {
  apiKey: "AIzaSyCI9ix2QXgbSEhHlrLUBe_OgHbvm9Ey0Ec",
  authDomain: "furusato-dashboard.firebaseapp.com",
  projectId: "furusato-dashboard",
  storageBucket: "furusato-dashboard.firebasestorage.app",
  messagingSenderId: "573154898493",
  appId: "1:573154898493:web:a0c1ea5dfe4bf23712f054"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const App = () => {
  const [data, setData] = useState<any[]>([]);
  const [isTestMode, setIsTestMode] = useState(true);
  const [municipality, setMunicipality] = useState("行方市");
  const [status, setStatus] = useState({ type: '', message: '' });
  const [aiResult, setAiResult] = useState("");

  // ファイル読み込み処理 (TypeErrorを修正)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const arrayBuffer = evt.target?.result;
        if (!arrayBuffer) return;
        
        const wb = XLSX.read(arrayBuffer, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

        processData(rawRows);
      } catch (err) {
        setStatus({ type: 'error', message: "ファイル解析に失敗しました。" });
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // フォーマット判定とデータ変換
  const processData = (rows: any[][]) => {
    const firstCell = String(rows[0]?.[0] || "");
    
    // 大洗町フォーマット (Source 4) の場合
    if (firstCell.includes("大洗町") || firstCell.includes("日付")) {
      const processed = rows.slice(3) // ヘッダーを飛ばす
        .filter(row => row[0] && row[0] !== '合計')
        .map(row => ({
          name: `${row[0]}日`,
          total: Number(row[2] || 0),    // 総計
          rakuten: Number(row[18] || 0), // 楽天金額 (18番目の列)
          choice: Number(row[16] || 0),  // チョイス金額 (16番目の列)
        }));
      setData(processed);
      setMunicipality("大洗町");
      setStatus({ type: 'success', message: "大洗町の詳細データを読み込みました。" });
    } else {
      // 標準フォーマット (Source 1)
      const days = rows[0].slice(1, -1); // 1日〜31日
      const totalRow = rows.find(r => r[0] === '合計') || rows[rows.length-1];
      
      const processed = days.map((day, idx) => ({
        name: day,
        total: Number(rows.reduce((sum, row) => sum + (Number(row[idx + 1]) || 0), 0))
      }));
      setData(processed);
      setStatus({ type: 'success', message: "標準データを読み込みました。" });
    }
  };

  // AI分析シミュレーション
  const runAIAnalysis = () => {
    if (data.length === 0) return;
    const total = data.reduce((s, i) => s + i.total, 0);
    setAiResult(`【AI分析】${municipality}の現在の合計寄附額は${total.toLocaleString()}円です。楽天経由の寄附が全体の約${Math.round((data[0]?.rakuten/data[0]?.total)*100) || 0}%を占めており、特定のポータルへの依存度が高い傾向にあります。週末に向けた広告強化を推奨します。`);
  };

  // 保存処理 (バックアップ機能付き)
  const saveToFirebase = async () => {
    if (isTestMode) {
      setStatus({ type: 'info', message: "テストモード：表示のみ更新しました（DB保存なし）" });
      return;
    }
    try {
      const payload = { data, municipality, updatedAt: serverTimestamp() };
      await setDoc(doc(db, "stats", municipality), payload); // 最新データ
      await addDoc(collection(db, "history"), payload); // 履歴（リカバリー用）
      setStatus({ type: 'success', message: "本番データを更新しました。履歴も保存済みです。" });
    } catch (err) {
      setStatus({ type: 'error', message: "Firebaseへの保存に失敗しました。" });
    }
  };

  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* ヘッダー */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-slate-800">ふるさと納税 AIダッシュボード</h1>
            <p className="text-sm text-slate-500">自治体: {municipality}</p>
          </div>
          <div className="flex gap-4 items-center">
            <div className={`px-4 py-2 rounded-full text-xs font-bold border ${isTestMode ? 'bg-orange-50 text-orange-600 border-orange-200' : 'bg-green-50 text-green-600 border-green-200'}`}>
              {isTestMode ? "テストモード実行中" : "本番環境"}
            </div>
            <input type="checkbox" checked={isTestMode} onChange={() => setIsTestMode(!isTestMode)} className="w-5 h-5 cursor-pointer" />
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* 左側：操作 */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h2 className="font-bold flex items-center gap-2 mb-4"><Database size={18}/> データ取込</h2>
              <input type="file" onChange={handleFileUpload} className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
              <button onClick={saveToFirebase} className="w-full mt-4 bg-slate-800 text-white py-2 rounded-xl font-bold hover:bg-black transition-all">反映する</button>
            </div>

            <div className="bg-indigo-600 p-6 rounded-2xl shadow-sm text-white">
              <h2 className="font-bold flex items-center gap-2 mb-2"><Sparkles size={18}/> AI分析</h2>
              <p className="text-xs text-indigo-100 mb-4">{aiResult || "データを取り込んでから実行してください。"}</p>
              <button onClick={runAIAnalysis} className="w-full bg-white/20 hover:bg-white/30 py-2 rounded-lg text-sm font-bold transition-all">分析を実行</button>
            </div>
          </div>

          {/* 右側：グラフ */}
          <div className="md:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h2 className="font-bold mb-6">寄附実績推移</h2>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="total" fill="#3b82f6" name="合計寄附額" radius={[4, 4, 0, 0]} />
                  {municipality === "大洗町" && (
                    <Line type="monotone" dataKey="rakuten" stroke="#ef4444" strokeWidth={2} name="楽天推移" />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* 通知エリア */}
        {status.message && (
          <div className={`p-4 rounded-xl border flex items-center gap-3 ${status.type === 'error' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700'}`}>
            {status.type === 'error' ? <AlertCircle size={20}/> : <CheckCircle2 size={20}/>}
            <span className="text-sm font-bold">{status.message}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;