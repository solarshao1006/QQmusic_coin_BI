import React, { useState, useMemo } from 'react';
import { Settings2, Plus, Wallet, Receipt, Trash2, Edit2, Calculator, CircleDollarSign, BarChart2, AlertTriangle, PieChart as PieChartIcon } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, PieChart, Pie, Cell } from 'recharts';
import { useLocalStorage } from './hooks/useLocalStorage';
import { AppSettings, Account, Transaction } from './types';

// Utility component for cards
const Card = ({ children, title, icon: Icon, action }: { children: React.ReactNode, title?: string, icon?: React.ElementType, action?: React.ReactNode }) => (
  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
    {(title || Icon || action) && (
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="w-5 h-5 text-gray-500" />}
          {title && <h2 className="text-lg font-medium text-gray-900">{title}</h2>}
        </div>
        {action && <div>{action}</div>}
      </div>
    )}
    <div className="p-6">
      {children}
    </div>
  </div>
);

export default function App() {
  const [settings, setSettings] = useLocalStorage<AppSettings>('lebi-settings', {
    albumPrice: 300,
    coversCount: 3,
    digitalPerCover: 10,
    giftCardPerCover: 10,
  });

  const [accounts, setAccounts] = useLocalStorage<Account[]>('lebi-accounts', [
    { id: '1', name: '大号', unexchangedLebi: 0 },
    { id: '2', name: '小号', unexchangedLebi: 0 }
  ]);

  const [transactions, setTransactions] = useLocalStorage<Transaction[]>('lebi-transactions', []);

  // Form states
  const [txForm, setTxForm] = useState({ rmb: '', lebi: '', accountId: accounts[0]?.id || '', note: '', source: 'none' as const });
  const [editingSettings, setEditingSettings] = useState(false);
  const [tempSettings, setTempSettings] = useState<AppSettings>(settings);
  const [addingAccount, setAddingAccount] = useState(false);
  const [newAccountForm, setNewAccountForm] = useState({ name: '', unexchanged: '' });
  const [confirmModal, setConfirmModal] = useState<{title: string, message: string, onConfirm: () => void} | null>(null);

  // Calculations
  const stats = useMemo(() => {
    let totalRmb = 0;
    let totalLebiEarned = 0;
    let totalAlbums = 0;

    const accountStats = accounts.map(account => {
      const accountTxs = transactions.filter(tx => tx.accountId === account.id);
      const rmbSpent = accountTxs.reduce((sum, tx) => sum + tx.rmb, 0);
      const lebiEarned = accountTxs.reduce((sum, tx) => sum + tx.lebi, 0);
      const totalLebi = lebiEarned + account.unexchangedLebi;

      const albumsFloat = totalLebi / settings.albumPrice;
      const maxDigital = (settings.coversCount || 3) * (settings.digitalPerCover || 10);
      const maxGiftCards = (settings.coversCount || 3) * (settings.giftCardPerCover || 10);
      const limitAlbums = maxDigital + maxGiftCards;
      const limitLebi = limitAlbums * settings.albumPrice;

      const digitalAlbums = Math.min(albumsFloat, maxDigital);
      const remainingForGiftCards = Math.max(0, albumsFloat - digitalAlbums);
      const giftCards = Math.min(remainingForGiftCards, maxGiftCards);

      const isCloseToLimit = totalLebi >= limitLebi * 0.9;
      const isOverLimit = totalLebi > limitLebi;
      const overflowLebi = Math.max(0, totalLebi - limitLebi);

      totalRmb += rmbSpent;
      totalLebiEarned += lebiEarned;
      totalAlbums += digitalAlbums + giftCards; // Adjust total to only count valid capacity

      return {
        ...account,
        rmbSpent,
        lebiEarned,
        totalLebi,
        albumsFloat,
        digitalAlbums,
        giftCards,
        limitLebi,
        isCloseToLimit,
        isOverLimit,
        overflowLebi
      };
    });

    return {
      totalRmb,
      totalLebiEarned,
      totalAlbums,
      accountStats
    };
  }, [accounts, transactions, settings]);

  const [activeChart, setActiveChart] = useState<'source' | 'discount'>('source');

  const sourceData = useMemo(() => {
    return [
      { name: '金币兑换', value: transactions.filter(t => t.source === 'exchange').reduce((sum, t) => sum + t.lebi, 0) },
      { name: '直接充值', value: transactions.filter(t => t.source === 'recharge').reduce((sum, t) => sum + t.lebi, 0) },
      { name: '未填其他', value: transactions.filter(t => !t.source || t.source === 'none').reduce((sum, t) => sum + t.lebi, 0) }
    ].filter(d => d.value > 0);
  }, [transactions]);
  const COLORS = ['#F59E0B', '#3B82F6', '#9CA3AF'];

  const discountData = useMemo(() => {
    return transactions
      .filter(tx => tx.rmb > 0 && tx.lebi > 0)
      .map(tx => {
        const dateStr = new Date(tx.date);
        return {
          id: tx.id,
          name: `${dateStr.getMonth() + 1}/${dateStr.getDate()}`,
          discount: Number(((tx.rmb / (tx.lebi / 10)) * 100).toFixed(2)),
          rmb: tx.rmb,
          account: accounts.find(a => a.id === tx.accountId)?.name || '未知'
        };
      }).slice(0, 20).reverse();
  }, [transactions, accounts]);

  const handleAddTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!txForm.accountId || !txForm.lebi) return;

    const newTx: Transaction = {
      id: Date.now().toString(),
      accountId: txForm.accountId,
      rmb: parseFloat(txForm.rmb) || 0,
      lebi: parseFloat(txForm.lebi) || 0,
      source: txForm.source as any,
      note: txForm.note,
      date: Date.now()
    };

    setTransactions([newTx, ...transactions]);
    setTxForm({ ...txForm, rmb: '', lebi: '', note: '', source: 'none' });
  };

  const handleAddAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccountForm.name) return;

    const newAcc: Account = {
      id: Date.now().toString(),
      name: newAccountForm.name,
      unexchangedLebi: parseFloat(newAccountForm.unexchanged) || 0
    };

    setAccounts([...accounts, newAcc]);
    setAddingAccount(false);
    setNewAccountForm({ name: '', unexchanged: '' });
    if (!txForm.accountId) {
      setTxForm(prev => ({ ...prev, accountId: newAcc.id }));
    }
  };

  const handleDeleteTransaction = (id: string) => {
    setConfirmModal({
      title: '删除记录',
      message: '确定要删除这条记账记录吗？此操作不可恢复。',
      onConfirm: () => {
        setTransactions(transactions.filter(tx => tx.id !== id));
        setConfirmModal(null);
      }
    });
  };

  const handleDeleteAccount = (id: string) => {
    setConfirmModal({
      title: '删除账号',
      message: '确定要删除此账号及其相关的所有充值记录吗？此操作不可恢复。',
      onConfirm: () => {
        setAccounts(accounts.filter(a => a.id !== id));
        setTransactions(transactions.filter(tx => tx.accountId !== id));
        setConfirmModal(null);
      }
    });
  };

  const updateAccountUnexchanged = (id: string, newAmount: number) => {
    setAccounts(accounts.map(a => a.id === id ? { ...a, unexchangedLebi: newAmount || 0 } : a));
  };


  return (
    <div className="min-h-screen bg-[#f5f5f5] text-gray-900 font-sans p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <header className="max-w-7xl mx-auto mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-gray-900 flex items-center gap-2">
            <Calculator className="w-8 h-8 text-blue-600" />
            乐币配置分析
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            快速计算专辑数、数专数及礼品卡数量
          </p>
        </div>
        
        {/* Global Stats */}
        <div className="flex bg-white rounded-xl shadow-sm border border-gray-100 p-2 overflow-hidden">
          <div className="px-4 py-2 border-r border-gray-100">
            <div className="text-[10px] uppercase tracking-wider text-gray-400 font-medium mb-1">总花费(RMB)</div>
            <div className="text-xl font-semibold text-gray-900">{stats.totalRmb.toFixed(2)}</div>
          </div>
          <div className="px-4 py-2 border-r border-gray-100">
            <div className="text-[10px] uppercase tracking-wider text-gray-400 font-medium mb-1">获得总乐币</div>
            <div className="text-xl font-semibold text-blue-600">{stats.totalLebiEarned.toLocaleString()}</div>
          </div>
          <div className="px-4 py-2">
            <div className="text-[10px] uppercase tracking-wider text-gray-400 font-medium mb-1">总可购专辑</div>
            <div className="text-xl font-semibold text-emerald-600">{stats.totalAlbums.toFixed(2)}</div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto grid grid-cols-1 xl:grid-cols-12 gap-8">
        
        {/* Left Column (Forms & Settings) */}
        <div className="xl:col-span-4 space-y-6">
          
          {/* Settings Box */}
          <Card 
            title="购买规则设定" 
            icon={Settings2} 
            action={
              <button 
                onClick={() => {
                  if (editingSettings) setSettings(tempSettings);
                  setEditingSettings(!editingSettings);
                }}
                className="text-sm px-3 py-1.5 rounded-lg font-medium text-blue-600 hover:bg-blue-50 transition-colors"
              >
                {editingSettings ? '保存' : '修改规则'}
              </button>
            }
          >
            {editingSettings ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">单张专辑价格 (乐币)</label>
                  <input type="number" className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" value={tempSettings.albumPrice} onChange={e => setTempSettings({...tempSettings, albumPrice: parseFloat(e.target.value) || 0})} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">专辑封面数</label>
                  <input type="number" className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" value={tempSettings.coversCount} onChange={e => setTempSettings({...tempSettings, coversCount: parseInt(e.target.value) || 0})} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">限购数专</label>
                    <input type="number" className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" value={tempSettings.digitalPerCover} onChange={e => setTempSettings({...tempSettings, digitalPerCover: parseInt(e.target.value) || 0})} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">限购礼品卡</label>
                    <input type="number" className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" value={tempSettings.giftCardPerCover || 10} onChange={e => setTempSettings({...tempSettings, giftCardPerCover: parseInt(e.target.value) || 0})} />
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-50 rounded-xl p-3">
                  <div className="text-xs text-gray-400 mb-1">单价</div>
                  <div className="font-medium text-gray-900">{settings.albumPrice} 乐币</div>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <div className="text-xs text-gray-400 mb-1">封面数</div>
                  <div className="font-medium text-gray-900">{settings.coversCount} 个</div>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <div className="text-xs text-gray-400 mb-1">单封面限购</div>
                  <div className="font-medium text-gray-900 text-sm whitespace-nowrap">{settings.digitalPerCover}数/{settings.giftCardPerCover || 10}卡</div>
                </div>
              </div>
            )}
          </Card>

          {/* Add Transaction Box */}
          <Card title="记录花销" icon={Receipt}>
            <form onSubmit={handleAddTransaction} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">充值来源</label>
                  <select 
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    value={txForm.source}
                    onChange={e => setTxForm({...txForm, source: e.target.value as any})}
                  >
                    <option value="none">未配置</option>
                    <option value="exchange">金币兑换</option>
                    <option value="recharge">直接充值</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">充值账号</label>
                  <select 
                    required
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    value={txForm.accountId}
                    onChange={e => setTxForm({...txForm, accountId: e.target.value})}
                  >
                    <option value="" disabled>选择账号...</option>
                    {accounts.map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">花销 (RMB)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    placeholder="0"
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    value={txForm.rmb}
                    onChange={e => setTxForm({...txForm, rmb: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">获得乐币 <span className="text-red-500">*</span></label>
                  <input 
                    type="number" 
                    required
                    placeholder="0"
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    value={txForm.lebi}
                    onChange={e => setTxForm({...txForm, lebi: e.target.value})}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">备注 (选填)</label>
                <input 
                  type="text" 
                  placeholder="e.g. 金币兑换, Q币充值..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  value={txForm.note}
                  onChange={e => setTxForm({...txForm, note: e.target.value})}
                />
              </div>

              <button 
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" /> 记一笔
              </button>
            </form>
          </Card>

        </div>

        {/* Right Column (Results & History) */}
        <div className="xl:col-span-8 space-y-6">
          
          {/* Accounts Breakdown */}
          <Card 
            title="购买方案分析" 
            icon={Wallet}
            action={
              <button 
                onClick={() => setAddingAccount(true)}
                className="text-sm px-3 py-1.5 rounded-lg font-medium text-gray-600 hover:bg-gray-100 transition-colors flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> 新增账号
              </button>
            }
          >
            {addingAccount && (
              <form onSubmit={handleAddAccount} className="mb-6 p-4 bg-blue-50 rounded-xl border border-blue-100 flex flex-col sm:flex-row items-end gap-4">
                <div className="flex-1 w-full">
                  <label className="block text-xs font-medium text-blue-800 uppercase tracking-wide mb-1">账号名称</label>
                  <input required autoFocus type="text" className="w-full bg-white border border-blue-200 rounded-lg px-3 py-2 p text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={newAccountForm.name} onChange={e => setNewAccountForm({...newAccountForm, name: e.target.value})} />
                </div>
                <div className="flex-1 w-full">
                  <label className="block text-xs font-medium text-blue-800 uppercase tracking-wide mb-1">当前未兑换乐币 (初始)</label>
                  <input type="number" placeholder="0" className="w-full bg-white border border-blue-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={newAccountForm.unexchanged} onChange={e => setNewAccountForm({...newAccountForm, unexchanged: e.target.value})} />
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  <button type="submit" className="flex-1 sm:flex-none bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">保存</button>
                  <button type="button" onClick={() => setAddingAccount(false)} className="flex-1 sm:flex-none border border-gray-300 bg-white text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">取消</button>
                </div>
              </form>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {stats.accountStats.map(acc => (
                <div key={acc.id} className={`relative group bg-white border-2 ${acc.isOverLimit ? 'border-red-200 pt-10' : acc.isCloseToLimit ? 'border-amber-200 pt-10' : 'border-gray-100 p-5'} rounded-2xl ${acc.isOverLimit || acc.isCloseToLimit ? 'px-5 pb-5' : ''} hover:border-blue-100 transition-all shadow-sm`}>
                  
                  {acc.isOverLimit && (
                    <div className="absolute top-0 left-0 right-0 bg-red-50 border-b border-red-100 text-red-700 px-3 py-1.5 rounded-t-xl text-xs font-medium flex items-center justify-center gap-1.5 shadow-sm">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      超上限 {acc.overflowLebi.toLocaleString()} 乐币 (无法继续分配)
                    </div>
                  )}
                  {!acc.isOverLimit && acc.isCloseToLimit && (
                    <div className="absolute top-0 left-0 right-0 bg-amber-50 border-b border-amber-100 text-amber-700 px-3 py-1.5 rounded-t-xl text-xs font-medium flex items-center justify-center gap-1.5 shadow-sm">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      乐币即将达到该账号购买上限
                    </div>
                  )}
                  
                  <button 
                    onClick={() => handleDeleteAccount(acc.id)}
                    className={`absolute ${acc.isOverLimit || acc.isCloseToLimit ? 'top-8 right-3' : 'top-4 right-4'} text-gray-300 hover:text-red-500 transition-opacity z-10`}
                    title="删除账号"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <h3 className={`text-lg font-semibold text-gray-900 mb-4 ${acc.isOverLimit || acc.isCloseToLimit ? 'mt-2' : ''}`}>{acc.name}</h3>
                  
                  <div className="space-y-4">
                    {/* Source Breakdown */}
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="flex flex-col">
                        <span className="text-gray-500 text-xs">累计进帐乐币</span>
                        <span className="font-medium">{acc.lebiEarned.toLocaleString()}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-gray-500 text-xs group/edit flex items-center gap-1">
                          未兑换储备
                          <Edit2 className="w-3 h-3 opacity-0 group-hover/edit:opacity-100 cursor-pointer text-blue-500" />
                        </span>
                        <input 
                          type="number"
                          className="font-medium text-gray-900 bg-transparent hover:bg-gray-50 focus:bg-white border focus:border-blue-500 rounded px-1 -mx-1 w-24 outline-none transition-colors"
                          value={acc.unexchangedLebi || ''}
                          placeholder="0"
                          onChange={(e) => updateAccountUnexchanged(acc.id, parseFloat(e.target.value) || 0)}
                        />
                      </div>
                    </div>

                    <div className="h-px bg-gray-100" />

                    {/* Results Box */}
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4">
                      
                      <div className="flex justify-between items-baseline mb-4">
                        <span className="text-sm font-medium text-blue-900">总计可购数</span>
                        <div className="text-right">
                          <span className="text-2xl font-bold text-blue-700">{Math.floor(acc.albumsFloat)}</span>
                          <span className="text-sm text-blue-500 ml-1">/{acc.albumsFloat.toFixed(2)} 张</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                        <div className="flex flex-col bg-white/60 p-2 rounded-lg border border-white/80">
                          <span className="text-xs text-blue-800/70 font-medium mb-0.5">数专 (<span className="opacity-70">优先</span>)</span>
                          <span className="font-semibold text-blue-900 text-lg">{acc.digitalAlbums.toFixed(2)}</span>
                        </div>
                        <div className="flex flex-col bg-white/60 p-2 rounded-lg border border-white/80">
                          <span className="text-xs text-indigo-800/70 font-medium mb-0.5">礼品卡 (<span className="opacity-70">剩余</span>)</span>
                          <span className="font-semibold text-indigo-900 text-lg">{acc.giftCards.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>
              ))}
            </div>
            {accounts.length === 0 && (
              <div className="text-center py-10 text-gray-400">尚未添加账号，请先新增。</div>
            )}
          </Card>

          {/* Charts Section */}
          {transactions.length > 0 && (
            <Card 
              title="数据可视化" 
              icon={BarChart2}
              action={
                <div className="flex bg-gray-100 rounded-lg p-1">
                  <button onClick={() => setActiveChart('source')} className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${activeChart === 'source' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>收入来源</button>
                  <button onClick={() => setActiveChart('discount')} className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${activeChart === 'discount' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>充值折扣</button>
                </div>
              }
            >
              <div className="h-[280px] w-full mt-2 flex items-center justify-center">
                {activeChart === 'source' && (
                  sourceData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={sourceData} cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={2} dataKey="value">
                          {sourceData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(value) => Number(value).toLocaleString() + ' 乐币'} 
                          contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                        />
                        <Legend iconType="circle" wrapperStyle={{fontSize: '12px'}} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : <div className="text-gray-400 text-sm">暂无来源数据</div>
                )}
                
                {activeChart === 'discount' && (
                  discountData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={discountData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 12}} dy={10} />
                        <YAxis yAxisId="left" orientation="left" axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 12}} tickFormatter={(val)=>val+'%'} dx={-10} />
                        <Tooltip 
                          cursor={{fill: '#F3F4F6'}}
                          contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                          formatter={(value, name) => [
                            name === 'discount' ? value + '%' : value, 
                            name === 'discount' ? '折扣比例' : name
                          ]}
                          labelFormatter={(label, payload) => {
                            if (payload?.[0]?.payload) {
                              const p = payload[0].payload;
                              return `${label} - ${p.account} (花销: ${p.rmb}元)`;
                            }
                            return label;
                          }}
                        />
                        <Legend iconType="circle" wrapperStyle={{fontSize: '12px', paddingTop: '20px'}} />
                        <Bar yAxisId="left" name="折扣比例" dataKey="discount" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <div className="text-gray-400 text-sm">暂无含RMB的充值数据来计算折扣</div>
                )}
              </div>
            </Card>
          )}

          {/* Transactions History */}
          <Card title="账单明细" icon={CircleDollarSign}>
            {transactions.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">暂无记录</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-gray-500 uppercase bg-gray-50/50">
                    <tr>
                      <th className="px-4 py-3 font-medium">时间</th>
                      <th className="px-4 py-3 font-medium">来源</th>
                      <th className="px-4 py-3 font-medium">账号</th>
                      <th className="px-4 py-3 font-medium text-right">RMB花销</th>
                      <th className="px-4 py-3 font-medium text-right">乐币入账</th>
                      <th className="px-4 py-3 font-medium">备注</th>
                      <th className="px-4 py-3 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {transactions.map(tx => {
                      const acc = accounts.find(a => a.id === tx.accountId);
                      return (
                        <tr key={tx.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-4 py-3 whitespace-nowrap text-gray-500">
                            {new Date(tx.date).toLocaleString('zh-CN', {month: 'numeric', day: 'numeric', hour: '2-digit', minute:'2-digit'})}
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            {tx.source === 'exchange' ? <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-xs">金币兑换</span> : tx.source === 'recharge' ? <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs">直接充值</span> : <span className="text-gray-400 text-xs">-</span>}
                          </td>
                          <td className="px-4 py-3 font-medium text-gray-900">
                            {acc ? acc.name : <span className="text-red-400">已删除</span>}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-600">
                            {tx.rmb > 0 ? tx.rmb.toFixed(2) : '-'}
                          </td>
                          <td className="px-4 py-3 text-right text-blue-600 font-medium">
                            +{tx.lebi}
                          </td>
                          <td className="px-4 py-3 text-gray-500 max-w-[150px] truncate" title={tx.note}>
                            {tx.note || '-'}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button 
                              onClick={() => handleDeleteTransaction(tx.id)}
                              className="text-gray-400 hover:text-red-500 transition-colors p-1"
                              title="删除记录"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto mt-12 mb-6 text-center text-gray-500 text-sm">
        Made with ❤️ by <a href="https://github.com/solarshao1006" target="_blank" rel="noopener noreferrer" className="font-medium text-blue-600 hover:text-blue-700 hover:underline transition-colors">Solar</a>
      </footer>

      {/* Confirm Modal */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 animate-in fade-in duration-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{confirmModal.title}</h3>
            <p className="text-gray-500 text-sm mb-6">{confirmModal.message}</p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors"
              >
                取消
              </button>
              <button 
                onClick={confirmModal.onConfirm}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

