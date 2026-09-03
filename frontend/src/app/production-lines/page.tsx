'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  Ban,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  ExternalLink,
  Eye,
  Factory,
  FileText,
  Filter,
  History,
  Layers,
  LayoutGrid,
  List,
  Package,
  PackageCheck,
  PackageOpen,
  Play,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Sparkles,
  Truck,
  User,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import { ProductionApi } from '@/services/api';
import { useLanguage } from '@/context/language-context';
import { Portal } from '@/components/ui/portal';
import { toast } from 'sonner';

interface StationMeta {
  code: string;
  stepNum: string;
  name: string;
  enName: string;
  icon: React.ComponentType<{ className?: string }>;
  desc: string;
}

export default function ProductionLinesPage() {
  const { t, locale } = useLanguage();
  const [lines, setLines] = useState<any[]>([]);
  const [selectedLineId, setSelectedLineId] = useState<string>('LINE-A');
  const [staleThreshold, setStaleThreshold] = useState<number>(15);
  const [loading, setLoading] = useState(true);

  // Filters & Views
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'IN_PROGRESS' | 'BLOCKED' | 'COMPLETED' | 'STALE'>('ALL');
  const [selectedStationFilter, setSelectedStationFilter] = useState<string>('ALL');
  const [showSettingsPopover, setShowSettingsPopover] = useState(false);

  // Modals & Drawers
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [batchDetail, setBatchDetail] = useState<any | null>(null);
  const [provenanceData, setProvenanceData] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<'timeline' | 'management' | 'provenance'>('timeline');

  // Actions state
  const [blockReason, setBlockReason] = useState('');
  const [resumeNote, setResumeNote] = useState('');
  const [newNote, setNewNote] = useState('');
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);

  const safeFormatDate = (dateVal: any): string => {
    if (!dateVal) return locale === 'vi' ? 'Vừa xong' : 'Just now';
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return locale === 'vi' ? 'Vừa xong' : 'Just now';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ' + d.toLocaleDateString();
  };

  const formatCardTime = (dateVal: any): string => {
    if (!dateVal) return locale === 'vi' ? 'Vừa xong' : 'Just now';
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return locale === 'vi' ? 'Vừa xong' : 'Just now';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const stationsOrder: StationMeta[] = [
    {
      code: 'RECEIVING',
      stepNum: '01',
      name: locale === 'vi' ? 'Tiếp Nhận' : 'Receiving',
      enName: 'Receiving',
      icon: Truck,
      desc: locale === 'vi' ? 'Nhận đồ vải bẩn' : 'Inbound deliveries',
    },
    {
      code: 'SORTING',
      stepNum: '02',
      name: locale === 'vi' ? 'Phân Loại' : 'Sorting',
      enName: 'Sorting',
      icon: Activity,
      desc: locale === 'vi' ? 'Tách ga, khăn & cân' : 'Sort & weight check',
    },
    {
      code: 'WASHING',
      stepNum: '03',
      name: locale === 'vi' ? 'Giặt Khử Khuẩn' : 'Washing',
      enName: 'Washing',
      icon: Sparkles,
      desc: locale === 'vi' ? 'Giặt tẩy nhiệt độ cao' : 'Disinfection wash',
    },
    {
      code: 'DRYING',
      stepNum: '04',
      name: locale === 'vi' ? 'Sấy Khô' : 'Drying',
      enName: 'Drying',
      icon: Zap,
      desc: locale === 'vi' ? 'Sấy hơi nóng tự động' : 'Tunnel drying',
    },
    {
      code: 'FOLDING',
      stepNum: '05',
      name: locale === 'vi' ? 'Ủi & Gấp' : 'Folding',
      enName: 'Folding',
      icon: CheckCircle2,
      desc: locale === 'vi' ? 'Ủi phẳng & máy gấp' : 'Ironing & folding',
    },
    {
      code: 'DISPATCH',
      stepNum: '06',
      name: locale === 'vi' ? 'Xuất Xưởng' : 'Dispatch',
      enName: 'Dispatch',
      icon: PackageCheck,
      desc: locale === 'vi' ? 'Đóng gói & giao xe' : 'Packing & delivery',
    },
  ];

  const loadData = async () => {
    try {
      setLoading(true);
      const [linesData, thresholdData] = await Promise.all([
        ProductionApi.getLines(),
        ProductionApi.getStaleThreshold(),
      ]);
      setLines(linesData || []);
      if (thresholdData?.staleThresholdMinutes) {
        setStaleThreshold(thresholdData.staleThresholdMinutes);
      }
      if (linesData && linesData.length > 0 && !linesData.some((l: any) => l.lineId === selectedLineId)) {
        setSelectedLineId(linesData[0].lineId);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to load production line data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSelectBatch = async (batchId: string, keepTab = false) => {
    setSelectedBatchId(batchId);
    if (!keepTab) {
      setActiveTab('timeline');
    }
    try {
      const [detail, provenance] = await Promise.all([
        ProductionApi.getBatch(batchId),
        ProductionApi.getProvenance(batchId),
      ]);
      setBatchDetail(detail);
      setProvenanceData(provenance);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleBlockBatch = async () => {
    if (!selectedBatchId || !blockReason.trim()) return;
    try {
      setIsSubmittingAction(true);
      await ProductionApi.blockBatch(selectedBatchId, blockReason.trim());
      toast.success(locale === 'vi' ? `Đã tạm dừng lô hàng ${selectedBatchId}` : `Batch ${selectedBatchId} blocked`, {
        description: `Lý do: ${blockReason}`,
      });
      setBlockReason('');
      await Promise.all([
        handleSelectBatch(selectedBatchId, true),
        loadData(),
      ]);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const handleResumeBatch = async () => {
    if (!selectedBatchId) return;
    try {
      setIsSubmittingAction(true);
      await ProductionApi.resumeBatch(selectedBatchId, resumeNote.trim());
      toast.success(locale === 'vi' ? `Đã tiếp tục xử lý lô hàng ${selectedBatchId}` : `Batch ${selectedBatchId} resumed`, {
        description: resumeNote ? `Ghi chú: ${resumeNote}` : undefined,
      });
      setResumeNote('');
      await Promise.all([
        handleSelectBatch(selectedBatchId, true),
        loadData(),
      ]);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const handleAddNote = async () => {
    if (!selectedBatchId || !newNote.trim()) return;
    try {
      setIsSubmittingAction(true);
      await ProductionApi.addNote(selectedBatchId, newNote.trim());
      toast.success(locale === 'vi' ? 'Đã thêm nhật ký ghi chú' : 'Audit note added');
      setNewNote('');
      await handleSelectBatch(selectedBatchId, true);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const handleSaveThreshold = async () => {
    try {
      await ProductionApi.updateStaleThreshold(staleThreshold);
      toast.success(locale === 'vi' ? `Đã cập nhật ngưỡng cảnh báo trễ: ${staleThreshold} phút` : `Stale threshold updated: ${staleThreshold}m`);
      setShowSettingsPopover(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const currentLine = lines.find((l) => l.lineId === selectedLineId) || lines[0];

  // Global KPIs for Selected Line
  const lineKpis = useMemo(() => {
    const batches = currentLine?.batches || [];
    const activeWip = batches.filter((b: any) => b.status === 'IN_PROGRESS' || b.status === 'PLANNED').length;
    const blockedCount = batches.filter((b: any) => b.status === 'BLOCKED').length;
    const completedCount = batches.filter((b: any) => b.status === 'COMPLETED').length;
    const alertCount = batches.filter((b: any) => b.indicators?.isStale || b.indicators?.hasQualityWarning || b.indicators?.hasMissingData).length;
    
    return {
      totalBatches: batches.length,
      activeWip,
      blockedCount,
      completedCount,
      alertCount,
    };
  }, [currentLine]);

  // Filtered batches for display
  const filteredBatchesByStation = useMemo(() => {
    const batches = currentLine?.batches || [];
    return stationsOrder.map((st) => {
      let list = batches.filter((b: any) => b.currentStation === st.code);

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        list = list.filter(
          (b: any) =>
            b.batchId?.toLowerCase().includes(q) ||
            b.workOrderId?.toLowerCase().includes(q) ||
            b.workOrder?.customerName?.toLowerCase().includes(q)
        );
      }

      // Status Filter
      if (statusFilter === 'IN_PROGRESS') {
        list = list.filter((b: any) => b.status === 'IN_PROGRESS');
      } else if (statusFilter === 'BLOCKED') {
        list = list.filter((b: any) => b.status === 'BLOCKED');
      } else if (statusFilter === 'COMPLETED') {
        list = list.filter((b: any) => b.status === 'COMPLETED');
      } else if (statusFilter === 'STALE') {
        list = list.filter((b: any) => b.indicators?.isStale);
      }

      return {
        station: st,
        batches: list,
      };
    });
  }, [currentLine, searchQuery, statusFilter, stationsOrder]);

  return (
    <div className="w-full max-w-full p-4 sm:p-5 lg:p-6 space-y-5">
      {/* 1. Top Header & Operational Controls */}
      <header className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs">
            <Factory className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight leading-tight">
              {locale === 'vi' ? 'Giám Sát Dây Chuyền 6 Trạm' : 'Production Line 6-Station Monitoring'}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {locale === 'vi'
                ? 'Tiến trình lô hàng tất định qua 6 công đoạn từ Tiếp nhận đến Xuất xưởng'
                : 'Deterministic 6-station batch progression from Receiving to Dispatch'}
            </p>
          </div>
        </div>

        {/* Action Controls Group */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Compact Line Switcher */}
          <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800/80 p-1 border border-slate-200 dark:border-slate-700/60">
            {lines.map((line) => {
              const isSelected = selectedLineId === line.lineId;
              const shortName = line.lineId === 'LINE-A' ? (locale === 'vi' ? 'Dây chuyền A' : 'Line A') :
                                line.lineId === 'LINE-B' ? (locale === 'vi' ? 'Dây chuyền B' : 'Line B') :
                                line.lineId === 'LINE-C' ? (locale === 'vi' ? 'Dây chuyền C' : 'Line C') :
                                line.name;
              return (
                <button
                  key={line.lineId}
                  onClick={() => setSelectedLineId(line.lineId)}
                  className={`rounded-lg px-3 py-1 text-xs font-semibold transition-all ${
                    isSelected
                      ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {shortName}
                </button>
              );
            })}
          </div>

          {/* Stale Threshold Settings Button */}
          <div className="relative">
            <button
              onClick={() => setShowSettingsPopover(!showSettingsPopover)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 shadow-xs transition-colors"
            >
              <Clock className="h-3.5 w-3.5 text-amber-500" />
              <span>
                {locale === 'vi' ? 'Ngưỡng:' : 'Stale:'} <strong className="font-semibold">{staleThreshold}m</strong>
              </span>
              <Settings2 className="h-3.5 w-3.5 text-slate-400 ml-0.5" />
            </button>

            {/* Compact Settings Popover */}
            {showSettingsPopover && (
              <div className="absolute right-0 mt-2 w-72 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xl z-30 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    {locale === 'vi' ? 'Cấu Hình Ngưỡng Cảnh Báo' : 'Alert Threshold Settings'}
                  </span>
                  <button
                    onClick={() => setShowSettingsPopover(false)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="text-[11px] text-slate-500">
                  {locale === 'vi'
                    ? 'Thời gian một lô hàng lưu lại ở 1 trạm vượt quá mức này sẽ kích hoạt cảnh báo trễ.'
                    : 'A batch remaining at any station longer than this duration will trigger a stale alert.'}
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={180}
                    value={staleThreshold}
                    onChange={(e) => setStaleThreshold(Number(e.target.value))}
                    className="w-20 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-1 text-center text-xs font-bold text-slate-900 dark:text-white focus:outline-blue-600"
                  />
                  <span className="text-xs text-slate-500">{locale === 'vi' ? 'phút' : 'minutes'}</span>
                  <button
                    onClick={handleSaveThreshold}
                    className="ml-auto rounded-lg bg-blue-600 hover:bg-blue-700 px-3 py-1 text-xs font-bold text-white transition-colors"
                  >
                    {locale === 'vi' ? 'Lưu' : 'Save'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Refresh Button */}
          <button
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 shadow-xs transition-colors disabled:opacity-60"
            title="Làm mới dữ liệu"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-blue-600' : ''}`} />
            <span className="hidden sm:inline">{locale === 'vi' ? 'Làm mới' : 'Refresh'}</span>
          </button>
        </div>
      </header>

      {/* 2. Overview KPI Stat Cards with Rich Colors & Micro-Animations */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        {/* Card 1: Active WIP */}
        <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs hover:shadow-md hover:-translate-y-1 transition-all duration-300">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-cyan-500" />
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{locale === 'vi' ? 'Đang Xử Lý (WIP)' : 'Active WIP'}</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
              <Activity className="h-4 w-4 animate-pulse" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums">
              {lineKpis.activeWip}
            </span>
            <span className="text-xs text-slate-400 font-medium">
              / {lineKpis.totalBatches} {locale === 'vi' ? 'lô' : 'batches'}
            </span>
          </div>
          <div className="mt-3 w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-blue-600 h-full rounded-full transition-all duration-500"
              style={{ width: `${lineKpis.totalBatches > 0 ? (lineKpis.activeWip / lineKpis.totalBatches) * 100 : 0}%` }}
            />
          </div>
        </div>

        {/* Card 2: Completed Batches */}
        <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs hover:shadow-md hover:-translate-y-1 transition-all duration-300">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{locale === 'vi' ? 'Đã Hoàn Thành' : 'Completed Batches'}</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
              <PackageCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums">
                {lineKpis.completedCount}
              </span>
              <span className="text-xs text-slate-400 font-medium">{locale === 'vi' ? 'lô' : 'batches'}</span>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/80 dark:border-emerald-800/60 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
              <Sparkles className="h-3 w-3" />
              {lineKpis.totalBatches > 0
                ? `${Math.round((lineKpis.completedCount / lineKpis.totalBatches) * 100)}%`
                : '0%'}
            </span>
          </div>
          <div className="mt-3 w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${lineKpis.totalBatches > 0 ? (lineKpis.completedCount / lineKpis.totalBatches) * 100 : 0}%` }}
            />
          </div>
        </div>

        {/* Card 3: Blocked Batches */}
        <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs hover:shadow-md hover:-translate-y-1 transition-all duration-300">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 to-pink-600" />
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{locale === 'vi' ? 'Lô Tạm Dừng' : 'Blocked Batches'}</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 group-hover:scale-110 transition-transform">
              <Ban className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums">
              {lineKpis.blockedCount}
            </span>
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold border ${
              lineKpis.blockedCount > 0
                ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                : 'bg-slate-50 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
            }`}>
              {lineKpis.blockedCount > 0 ? (locale === 'vi' ? 'Cần can thiệp' : 'Action req.') : (locale === 'vi' ? 'Bình thường' : 'Normal')}
            </span>
          </div>
          <div className="mt-3 w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${lineKpis.blockedCount > 0 ? 'bg-rose-500' : 'bg-slate-300 dark:bg-slate-700'}`}
              style={{ width: `${lineKpis.totalBatches > 0 ? (lineKpis.blockedCount / lineKpis.totalBatches) * 100 : 0}%` }}
            />
          </div>
        </div>

        {/* Card 4: Active Alerts */}
        <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs hover:shadow-md hover:-translate-y-1 transition-all duration-300">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 to-orange-500" />
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{locale === 'vi' ? 'Cảnh Báo Hoạt Động' : 'Active Alerts'}</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform">
              <AlertTriangle className={`h-4 w-4 ${lineKpis.alertCount > 0 ? 'animate-bounce text-amber-500' : ''}`} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums">
              {lineKpis.alertCount}
            </span>
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold border ${
              lineKpis.alertCount > 0
                ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
            }`}>
              {lineKpis.alertCount > 0 ? (locale === 'vi' ? 'Quá hạn / Lỗi' : 'Alerts active') : (locale === 'vi' ? 'Ổn định' : 'Healthy')}
            </span>
          </div>
          <div className="mt-3 w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${lineKpis.alertCount > 0 ? 'bg-amber-500' : 'bg-emerald-500'}`}
              style={{ width: `${lineKpis.alertCount > 0 ? 100 : 100}%` }}
            />
          </div>
        </div>
      </section>

      {/* 3. RESPONSIVE SEQUENTIAL 6-STEP WORKFLOW FLOW PIPELINE */}
      <section className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 sm:p-4 shadow-xs space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
            <Layers className="h-4 w-4 text-blue-600" />
            <span>{locale === 'vi' ? 'Tiến Trình 6 Công Đoạn Sản Xuất' : 'Standardized 6-Station Process Pipeline'}</span>
          </div>
          <span className="text-xs text-slate-400 hidden sm:inline">
            {locale === 'vi' ? 'Quy trình 1 chiều cố định' : 'Strict 1-way sequence'}
          </span>
        </div>

        {/* 6-Column Grid on Desktop (ALL 6 STATIONS FIT 100% VISIBLE), Responsive 2/3 cols on smaller screens */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2 sm:gap-2.5">
          {stationsOrder.map((st, idx) => {
            const summary = currentLine?.stations?.find((s: any) => s.station === st.code);
            const wip = summary?.wipCount ?? 0;
            const completedQty = summary?.completedQuantity ?? 0;
            const Icon = st.icon;

            return (
              <div
                key={st.code}
                className={`rounded-xl border p-3 transition-all ${
                  wip > 0
                    ? 'border-blue-500/60 bg-blue-50/40 dark:border-blue-600/60 dark:bg-blue-950/20 shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold text-slate-400">
                    BƯỚC {st.stepNum}
                  </span>
                  <div
                    className={`flex h-6 w-6 items-center justify-center rounded-lg ${
                      wip > 0
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300'
                        : 'bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    <Icon className="h-3 w-3" />
                  </div>
                </div>

                <h3 className="mt-1.5 text-xs font-bold text-slate-900 dark:text-white leading-tight truncate">
                  {st.name}
                </h3>
                <p className="text-[10px] text-slate-400 truncate mt-0.5">{st.desc}</p>

                <div className="mt-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-xs">
                  <span className="inline-flex items-center gap-1 rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                    WIP: <strong className={wip > 0 ? 'text-blue-600 dark:text-blue-400 font-bold' : ''}>{wip} {locale === 'vi' ? 'lô' : 'batch'}</strong>
                  </span>
                  <span className="font-mono text-[10px] text-slate-500">
                    {completedQty.toLocaleString()} {locale === 'vi' ? 'cái' : 'pcs'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 4. Filter Toolbar & Search */}
      <section className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 p-3 shadow-xs">
        {/* Search Input */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder={locale === 'vi' ? 'Tìm theo Mã Lô, Đơn Hàng, Khách Hàng...' : 'Search Batch ID, Order, Customer...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pl-8 pr-7 py-1 text-xs text-slate-900 dark:text-white focus:outline-blue-600"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Status Filter Chips */}
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5 md:pb-0">
          {(
            [
              { key: 'ALL', label: locale === 'vi' ? 'Tất cả' : 'All' },
              { key: 'IN_PROGRESS', label: locale === 'vi' ? 'Đang chạy' : 'Running' },
              { key: 'BLOCKED', label: locale === 'vi' ? 'Tạm dừng' : 'Blocked' },
              { key: 'STALE', label: locale === 'vi' ? 'Cảnh báo trễ' : 'Stale' },
              { key: 'COMPLETED', label: locale === 'vi' ? 'Đã xong' : 'Done' },
            ] as const
          ).map((filterItem) => (
            <button
              key={filterItem.key}
              onClick={() => setStatusFilter(filterItem.key)}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors shrink-0 ${
                statusFilter === filterItem.key
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-semibold'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {filterItem.label}
            </button>
          ))}
        </div>
      </section>

      {/* Station Selector Pill Bar: Clearly view all 6 or focus on 1 */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 shrink-0 mr-1">
          {locale === 'vi' ? 'Xem trạm:' : 'Station:'}
        </span>
        <button
          onClick={() => setSelectedStationFilter('ALL')}
          className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors shrink-0 ${
            selectedStationFilter === 'ALL'
              ? 'bg-blue-600 text-white font-bold shadow-xs'
              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:border-slate-300'
          }`}
        >
          {locale === 'vi' ? 'Toàn Bộ 6 Trạm' : 'All 6 Stations'}
        </button>
        {stationsOrder.map((st) => (
          <button
            key={st.code}
            onClick={() => setSelectedStationFilter(st.code)}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors shrink-0 ${
              selectedStationFilter === st.code
                ? 'bg-blue-600 text-white font-bold shadow-xs'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:border-slate-300'
            }`}
          >
            {st.stepNum}. {st.name}
          </button>
        ))}
      </div>

      {/* 5. 6-STATION KANBAN BOARD (Fits cleanly on 6 columns on xl, wraps or scrolls gracefully on smaller screens) */}
      <section className="space-y-3">
        {selectedStationFilter !== 'ALL' && (
          <div className="flex items-center justify-between text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 rounded-xl px-3 py-2">
            <span>
              {locale === 'vi'
                ? `Đang xem riêng Trạm ${stationsOrder.find((s) => s.code === selectedStationFilter)?.stepNum}: ${stationsOrder.find((s) => s.code === selectedStationFilter)?.name}`
                : `Focusing on Station ${stationsOrder.find((s) => s.code === selectedStationFilter)?.stepNum}: ${stationsOrder.find((s) => s.code === selectedStationFilter)?.name}`}
            </span>
            <button
              onClick={() => setSelectedStationFilter('ALL')}
              className="font-bold underline ml-2"
            >
              {locale === 'vi' ? 'Xem lại toàn bộ 6 trạm' : 'Reset to all 6 stations'}
            </button>
          </div>
        )}

        {/* Board Container: 
            - When viewing ALL: on >=1280px (xl): 6 equal columns side-by-side. 
            - On medium screens: 2-3 columns or horizontal scroll without overflowing the page! */}
        <div
          className={
            selectedStationFilter === 'ALL'
              ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3'
              : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3'
          }
        >
          {filteredBatchesByStation
            .filter(
              ({ station }) =>
                selectedStationFilter === 'ALL' || selectedStationFilter === station.code
            )
            .map(({ station: st, batches: stationBatches }) => {
              const summary = currentLine?.stations?.find((s: any) => s.station === st.code);
              const Icon = st.icon;

              return (
                <div
                  key={st.code}
                  className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/60 p-3 flex flex-col min-h-[500px] shadow-xs"
                >
                  {/* Column Header */}
                  <div className="space-y-1.5 pb-2.5 border-b border-slate-200 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 border border-slate-200 dark:border-slate-700 shadow-xs">
                          <Icon className="h-3 w-3" />
                        </div>
                        <div>
                          <span className="text-[10px] font-mono font-bold text-slate-400 uppercase">
                            TRẠM {st.stepNum}
                          </span>
                          <h3 className="text-xs font-bold text-slate-900 dark:text-white leading-tight truncate">
                            {st.name}
                          </h3>
                        </div>
                      </div>
                      <span className="rounded-full bg-slate-200 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-700 dark:text-slate-300">
                        {stationBatches.length}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                      <span>WIP: <strong className="text-slate-800 dark:text-slate-200">{summary?.wipCount ?? 0}</strong></span>
                      <span className="font-mono text-[10px]">
                        {locale === 'vi' ? 'Xong:' : 'Done:'} <strong className="text-slate-800 dark:text-slate-200">{(summary?.completedQuantity || 0).toLocaleString()}</strong>
                      </span>
                    </div>
                  </div>

                  {/* Column Cards List */}
                  <div className="flex-1 space-y-2 py-2.5 overflow-y-auto max-h-[600px]">
                    {stationBatches.length === 0 ? (
                      <div className="h-36 flex flex-col items-center justify-center text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl p-3 text-center">
                        <PackageOpen className="h-5 w-5 text-slate-300 dark:text-slate-600 mb-1" />
                        <span className="text-[11px] font-medium">{locale === 'vi' ? 'Không có lô tại trạm' : 'No batches here'}</span>
                      </div>
                    ) : (
                      stationBatches.map((batch: any) => {
                        const isCompleted = batch.status === 'COMPLETED';
                        const isBlocked = batch.status === 'BLOCKED';
                        const isStale = batch.indicators?.isStale;
                        const hasQuality = batch.indicators?.hasQualityWarning;
                        const hasMissing = batch.indicators?.hasMissingData;

                        return (
                          <div
                            key={batch.batchId}
                            onClick={() => handleSelectBatch(batch.batchId)}
                            className={`group rounded-xl border bg-white dark:bg-slate-800/90 p-3 cursor-pointer transition-all duration-150 hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 space-y-2 relative ${
                              isBlocked
                                ? 'border-l-4 border-l-rose-500 border-slate-200 dark:border-slate-800'
                                : isCompleted
                                ? 'border-l-4 border-l-emerald-500 border-slate-200 dark:border-slate-800'
                                : isStale
                                ? 'border-l-4 border-l-amber-500 border-slate-200 dark:border-slate-800'
                                : 'border-l-4 border-l-blue-500 border-slate-200 dark:border-slate-800'
                            }`}
                          >
                            {/* Card Header: Batch ID & Status Pill */}
                            <div className="flex items-center justify-between">
                              <span className="font-mono font-bold text-xs text-blue-600 dark:text-blue-400 group-hover:underline">
                                {batch.batchId}
                              </span>
                              <span
                                className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold ${
                                  isCompleted
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300'
                                    : isBlocked
                                    ? 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300'
                                    : 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300'
                                }`}
                              >
                                {batch.status}
                              </span>
                            </div>

                            {/* Work Order & Customer Info */}
                            <div className="text-xs space-y-0.5">
                              <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                                {batch.workOrderId}
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                {batch.workOrder?.customerName || (locale === 'vi' ? 'Khách sạn đối tác' : 'Partner Hotel')}
                              </div>
                            </div>

                            {/* Quantity & Freshness */}
                            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1.5 border-t border-slate-100 dark:border-slate-700/60">
                              <span className="font-semibold text-slate-800 dark:text-slate-200">
                                {batch.completedQuantity} {locale === 'vi' ? 'cái' : 'pcs'}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {formatCardTime(batch.lastEventTime)}
                              </span>
                            </div>

                            {/* Alert Indicator Chips */}
                            {(isStale || hasMissing || hasQuality) && (
                              <div className="flex flex-wrap gap-1 pt-0.5">
                                {isStale && (
                                  <span className="inline-flex items-center gap-1 rounded bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/60 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700 dark:text-amber-300">
                                    <Clock className="h-2.5 w-2.5" />
                                    {locale === 'vi' ? 'Quá hạn >15p' : 'Stale >15m'}
                                  </span>
                                )}
                                {hasMissing && (
                                  <span className="inline-flex items-center gap-1 rounded bg-purple-50 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-800/60 px-1.5 py-0.5 text-[9px] font-semibold text-purple-700 dark:text-purple-300">
                                    <AlertOctagon className="h-2.5 w-2.5" />
                                    {locale === 'vi' ? 'Nhảy trạm' : 'Missing Prev'}
                                  </span>
                                )}
                                {hasQuality && (
                                  <span className="inline-flex items-center gap-1 rounded bg-orange-50 dark:bg-orange-950/50 border border-orange-200 dark:border-orange-800/60 px-1.5 py-0.5 text-[9px] font-semibold text-orange-700 dark:text-orange-300">
                                    <AlertTriangle className="h-2.5 w-2.5" />
                                    {locale === 'vi' ? 'Lỗi vải' : 'Defect'}
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Hover Micro-action */}
                            <div className="flex items-center justify-between text-[10px] text-blue-600 dark:text-blue-400 font-medium opacity-0 group-hover:opacity-100 transition-opacity pt-0.5">
                              <span>{locale === 'vi' ? 'Chi tiết' : 'Details'}</span>
                              <ArrowRight className="h-3 w-3" />
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      </section>

      {/* 6. BATCH DETAIL & MANAGEMENT DRAWER (Slide-over) */}
      {selectedBatchId && batchDetail && (
        <Portal>
          <div
            onClick={(e) => { if (e.target === e.currentTarget) setSelectedBatchId(null); }}
            className="fixed inset-0 z-[9999] flex justify-end bg-slate-950/75 backdrop-blur-md transition-all animate-in fade-in duration-200"
          >
            <div className="w-full max-w-xl sm:max-w-2xl bg-white dark:bg-slate-900 h-full shadow-2xl p-5 sm:p-6 overflow-y-auto space-y-5 border-l border-slate-200 dark:border-slate-800 animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="flex items-start justify-between pb-3.5 border-b border-slate-200 dark:border-slate-800">
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <h2 className="text-lg sm:text-xl font-bold font-mono text-slate-900 dark:text-white">
                    {batchDetail.batch.batchId}
                  </h2>
                  <span
                    className={`rounded-md px-2 py-0.5 text-xs font-bold ${
                      batchDetail.batch.status === 'COMPLETED'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300'
                        : batchDetail.batch.status === 'BLOCKED'
                        ? 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/50 dark:text-rose-300'
                        : 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/50 dark:text-blue-300'
                    }`}
                  >
                    {batchDetail.batch.status}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  {locale === 'vi' ? 'Đơn hàng:' : 'Order:'} <strong className="text-slate-800 dark:text-slate-200">{batchDetail.batch.workOrderId}</strong> • {locale === 'vi' ? 'Khách hàng:' : 'Customer:'} <strong className="text-blue-600">{batchDetail.workOrder?.customerName}</strong>
                </p>
              </div>
              <button
                onClick={() => setSelectedBatchId(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Đóng"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 text-xs font-bold gap-4 sm:gap-6">
              <button
                onClick={() => setActiveTab('timeline')}
                className={`pb-2.5 border-b-2 transition-colors flex items-center gap-1.5 ${
                  activeTab === 'timeline'
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                <Clock className="h-3.5 w-3.5" />
                <span>{locale === 'vi' ? 'Tiến Trình 6 Trạm' : 'Station Timeline'}</span>
              </button>
              <button
                onClick={() => setActiveTab('management')}
                className={`pb-2.5 border-b-2 transition-colors flex items-center gap-1.5 ${
                  activeTab === 'management'
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                <Sliders className="h-3.5 w-3.5" />
                <span>{locale === 'vi' ? 'Điều Phối & Nhật Ký' : 'Actions & Audit Log'}</span>
              </button>
              <button
                onClick={() => setActiveTab('provenance')}
                className={`pb-2.5 border-b-2 transition-colors flex items-center gap-1.5 ${
                  activeTab === 'provenance'
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>{locale === 'vi' ? 'Truy Vết Nguồn Gốc' : 'Provenance'}</span>
              </button>
            </div>

            {/* Tab 1: Timeline 6 Trạm */}
            {activeTab === 'timeline' && (
              <div className="space-y-2.5">
                {stationsOrder.map((st) => {
                  const canonical = batchDetail.canonicalEvents?.find((c: any) => c.station === st.code);
                  const isCompleted = Boolean(canonical);

                  return (
                    <div
                      key={st.code}
                      className={`rounded-xl border p-3 transition-all flex items-start gap-3 ${
                        isCompleted
                          ? 'border-emerald-200 bg-emerald-50/40 dark:border-emerald-900/60 dark:bg-emerald-950/20'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 opacity-60'
                      }`}
                    >
                      <div
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                          isCompleted
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-400'
                        }`}
                      >
                        {isCompleted ? <Check className="h-3.5 w-3.5" /> : st.stepNum}
                      </div>

                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                            {st.name} <span className="text-slate-400 font-normal">({st.enName})</span>
                          </span>
                          {canonical && (
                            <span className="text-xs font-mono font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 rounded-md">
                              {canonical.quantity} {locale === 'vi' ? 'cái' : 'pcs'}
                            </span>
                          )}
                        </div>

                        {canonical ? (
                          <div className="text-xs text-slate-500 space-y-1 pt-0.5">
                            <div>
                              {locale === 'vi' ? 'Thời điểm ghi nhận:' : 'Recorded at:'}{' '}
                              <strong className="text-slate-700 dark:text-slate-300">{safeFormatDate(canonical.occurredAt)}</strong>
                            </div>
                            <div className="font-mono text-[11px] text-blue-600 dark:text-blue-400">
                              {locale === 'vi' ? 'Dữ liệu đối soát chuẩn:' : 'Verified Record ID:'} {canonical.winningSourceRecordId}
                            </div>
                            {canonical.payload && typeof canonical.payload === 'object' && Object.keys(canonical.payload).length > 0 && (
                              <div className="mt-2 space-y-1.5 font-sans">
                                <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                                  {canonical.payload.supplier && (
                                    <div className="rounded-lg bg-slate-50 dark:bg-slate-800/80 px-2.5 py-1.5 border border-slate-200/60 dark:border-slate-700/60">
                                      <span className="text-slate-400 block text-[10px]">{locale === 'vi' ? 'Đối tác / Khách hàng' : 'Partner / Supplier'}</span>
                                      <span className="font-semibold text-slate-800 dark:text-slate-200">{canonical.payload.supplier}</span>
                                    </div>
                                  )}
                                  {canonical.payload.deliveryNumber && (
                                    <div className="rounded-lg bg-slate-50 dark:bg-slate-800/80 px-2.5 py-1.5 border border-slate-200/60 dark:border-slate-700/60">
                                      <span className="text-slate-400 block text-[10px]">{locale === 'vi' ? 'Số phiếu giao nhận' : 'Delivery Slip'}</span>
                                      <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono">{canonical.payload.deliveryNumber}</span>
                                    </div>
                                  )}
                                  {canonical.payload.linenType && (
                                    <div className="rounded-lg bg-slate-50 dark:bg-slate-800/80 px-2.5 py-1.5 border border-slate-200/60 dark:border-slate-700/60">
                                      <span className="text-slate-400 block text-[10px]">{locale === 'vi' ? 'Loại đồ vải' : 'Linen Type'}</span>
                                      <span className="font-semibold text-slate-800 dark:text-slate-200">{canonical.payload.linenType}</span>
                                    </div>
                                  )}
                                  {canonical.payload.machineId && (
                                    <div className="rounded-lg bg-slate-50 dark:bg-slate-800/80 px-2.5 py-1.5 border border-slate-200/60 dark:border-slate-700/60">
                                      <span className="text-slate-400 block text-[10px]">{locale === 'vi' ? 'Mã máy xử lý' : 'Machine Code'}</span>
                                      <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono">{canonical.payload.machineId}</span>
                                    </div>
                                  )}
                                  {canonical.payload.destination && (
                                    <div className="col-span-2 rounded-lg bg-slate-50 dark:bg-slate-800/80 px-2.5 py-1.5 border border-slate-200/60 dark:border-slate-700/60">
                                      <span className="text-slate-400 block text-[10px]">{locale === 'vi' ? 'Điểm xuất hàng' : 'Destination'}</span>
                                      <span className="font-semibold text-slate-800 dark:text-slate-200">{canonical.payload.destination}</span>
                                    </div>
                                  )}
                                  {canonical.payload.vehicleNumber && (
                                    <div className="rounded-lg bg-slate-50 dark:bg-slate-800/80 px-2.5 py-1.5 border border-slate-200/60 dark:border-slate-700/60">
                                      <span className="text-slate-400 block text-[10px]">{locale === 'vi' ? 'Biển số xe điều phối' : 'Vehicle Plate'}</span>
                                      <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono">{canonical.payload.vehicleNumber}</span>
                                    </div>
                                  )}
                                </div>

                                <details className="pt-1">
                                  <summary className="cursor-pointer text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-medium">
                                    {locale === 'vi' ? 'Xem chi tiết JSON kỹ thuật' : 'View Technical JSON'}
                                  </summary>
                                  <pre className="mt-1 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/90 font-mono text-[10px] text-slate-700 dark:text-slate-300 overflow-x-auto whitespace-pre-wrap border border-slate-200/60 dark:border-slate-700/60">
                                    {JSON.stringify(canonical.payload, null, 2)}
                                  </pre>
                                </details>
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400 italic">
                            {locale === 'vi' ? 'Đang chờ chuyển đồ vải đến công đoạn này...' : 'Pending batch arrival...'}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Tab 2: Điều Phối & Nhật Ký Quản Lý */}
            {activeTab === 'management' && (
              <div className="space-y-5 text-xs sm:text-sm">
                {/* Management Action Box */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-4 space-y-3">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500">
                    {locale === 'vi' ? 'Thao Tác Điều Phối Quản Đốc' : 'Plant Manager Controls'}
                  </h4>

                  {batchDetail.batch.status === 'COMPLETED' ? (
                    <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 p-3.5 space-y-1.5 text-xs">
                      <div className="flex items-center gap-2 font-bold text-emerald-800 dark:text-emerald-300">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                        <span>{locale === 'vi' ? 'Lô hàng đã xuất xưởng hoàn tất (COMPLETED)' : 'Batch Completed & Dispatched'}</span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
                        {locale === 'vi'
                          ? 'Toàn bộ 6 công đoạn sản xuất đã kết thúc và đồ vải đã bàn giao xe xuất xưởng. Theo đề bài & quy tắc quản lý dây chuyền, không thể áp dụng lệnh tạm dừng (BLOCK) đối với lô hàng đã xuất xưởng.'
                          : 'All 6 production steps have concluded and the batch is dispatched. In accordance with plant management rules, completed batches cannot be blocked.'}
                      </p>
                    </div>
                  ) : batchDetail.batch.status === 'BLOCKED' ? (
                    <div className="space-y-2">
                      <p className="text-xs text-rose-600 font-semibold flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        <span>{locale === 'vi' ? 'Lô hàng đang bị tạm dừng. Nhập ghi chú để mở lại:' : 'Batch is blocked. Enter note to resume:'}</span>
                      </p>
                      <input
                        type="text"
                        placeholder={locale === 'vi' ? 'Nhập ghi chú kết quả xử lý sự cố...' : 'Resolution note...'}
                        value={resumeNote}
                        onChange={(e) => setResumeNote(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2.5 text-xs text-slate-900 dark:text-white focus:outline-emerald-600"
                      />
                      <button
                        onClick={handleResumeBatch}
                        disabled={isSubmittingAction}
                        className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 py-2.5 text-xs font-bold text-white transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60"
                      >
                        <Play className="h-3.5 w-3.5" />
                        <span>{locale === 'vi' ? 'Mở Lại Lô Hàng (RESUME)' : 'Resume Batch'}</span>
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                        {locale === 'vi' ? 'Tạm dừng lô hàng khi phát hiện sự cố hoặc lỗi kỹ thuật:' : 'Block batch if issue or defect is identified:'}
                      </p>
                      <input
                        type="text"
                        placeholder={locale === 'vi' ? 'Nhập lý do tạm dừng lô hàng...' : 'Reason for blocking...'}
                        value={blockReason}
                        onChange={(e) => setBlockReason(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2.5 text-xs text-slate-900 dark:text-white focus:outline-rose-600"
                      />
                      <button
                        onClick={handleBlockBatch}
                        disabled={isSubmittingAction || !blockReason.trim()}
                        className="w-full rounded-xl bg-rose-600 hover:bg-rose-700 py-2.5 text-xs font-bold text-white transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60"
                      >
                        <Ban className="h-3.5 w-3.5" />
                        <span>{locale === 'vi' ? 'Tạm Dừng Lô Hàng (BLOCK)' : 'Block Batch'}</span>
                      </button>
                    </div>
                  )}

                  {/* Add Operational Note */}
                  <div className="space-y-2 pt-3 border-t border-slate-200 dark:border-slate-700">
                    <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                      {locale === 'vi' ? 'Thêm ghi chú kiểm toán (Lưu bất biến Append-only):' : 'Add operational audit note:'}
                    </p>
                    <textarea
                      rows={2}
                      placeholder={locale === 'vi' ? 'Nhập nội dung ghi chú...' : 'Enter note details...'}
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2.5 text-xs text-slate-900 dark:text-white focus:outline-blue-600"
                    />
                    <button
                      onClick={handleAddNote}
                      disabled={isSubmittingAction || !newNote.trim()}
                      className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 py-2 text-xs font-bold text-white transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>{locale === 'vi' ? 'Lưu Ghi Chú' : 'Save Note'}</span>
                    </button>
                  </div>
                </div>

                {/* Append-only Audit Stream */}
                <div className="space-y-2">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <History className="h-3.5 w-3.5 text-slate-400" />
                    <span>{locale === 'vi' ? 'Nhật Ký Quản Lý Bất Biến (Audit Trail)' : 'Audit Trail Stream'}</span>
                  </h4>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {batchDetail.managementEvents?.length === 0 ? (
                      <p className="text-xs text-slate-400 italic py-2">
                        {locale === 'vi' ? 'Chưa có hành động quản lý nào được ghi nhận.' : 'No management actions recorded yet.'}
                      </p>
                    ) : (
                      batchDetail.managementEvents.map((evt: any) => (
                        <div
                          key={evt.id}
                          className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 text-xs space-y-1 bg-white dark:bg-slate-800/50"
                        >
                          <div className="flex items-center justify-between font-bold">
                            <span className="text-blue-600 dark:text-blue-400">{evt.action}</span>
                            <span className="text-slate-400 font-normal text-[11px]">{safeFormatDate(evt.timestamp)}</span>
                          </div>
                          <p className="text-slate-800 dark:text-slate-200 font-medium">{evt.reason || evt.note}</p>
                          <div className="text-[10px] text-slate-400 flex items-center gap-1">
                            <User className="h-2.5 w-2.5" />
                            <span>
                              {evt.actorName} ({evt.actorId})
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Tab 3: Truy Vết Nguồn Gốc (Provenance) */}
            {activeTab === 'provenance' && (
              <div className="space-y-3.5 text-xs">
                {(() => {
                  const lineageMap = new Map<string, any>();
                  let totalObsCount = 0;
                  for (const lin of provenanceData?.lineage || []) {
                    lineageMap.set(lin.station, lin);
                    for (const c of lin.contributions || []) {
                      totalObsCount += c.occurrenceCount || 1;
                    }
                  }

                  // Determine furthest station reached
                  const currentStation = batchDetail?.batch?.currentStation;
                  const currentRank = stationsOrder.findIndex((s) => s.code === currentStation);
                  const maxIdx = currentRank >= 0 ? currentRank : 0;

                  // Render stations in deterministic order from Step 1 up to max station reached
                  const renderedStations = stationsOrder.filter((st, idx) => {
                    return idx <= maxIdx || lineageMap.has(st.code);
                  });

                  const verifiedCount = lineageMap.size;
                  const missingCount = renderedStations.filter((s) => !lineageMap.has(s.code)).length;
                  const totalPassed = renderedStations.length;

                  return (
                    <>
                      {/* Provenance Statistics Bar */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5 space-y-0.5 shadow-2xs">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">{locale === 'vi' ? 'Tiến Trình Trạm' : 'Stages Reached'}</span>
                          <div className="flex items-baseline gap-1">
                            <span className="text-base font-extrabold text-slate-900 dark:text-white tabular-nums">{totalPassed}/6</span>
                            <span className="text-[10px] text-slate-500 font-medium">{locale === 'vi' ? 'công đoạn' : 'steps'}</span>
                          </div>
                        </div>

                        <div className="rounded-xl border border-emerald-200/80 dark:border-emerald-900/60 bg-emerald-50/40 dark:bg-emerald-950/20 p-2.5 space-y-0.5 shadow-2xs">
                          <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400 block tracking-wider">{locale === 'vi' ? 'Đã Đối Soát' : 'Verified'}</span>
                          <div className="flex items-baseline gap-1">
                            <span className="text-base font-extrabold text-emerald-700 dark:text-emerald-300 tabular-nums">{verifiedCount}</span>
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">/ {totalPassed} {locale === 'vi' ? 'trạm' : 'stations'}</span>
                          </div>
                        </div>

                        <div className={`rounded-xl border p-2.5 space-y-0.5 shadow-2xs ${
                          missingCount > 0
                            ? 'border-amber-300 dark:border-amber-800/80 bg-amber-50/50 dark:bg-amber-950/30'
                            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                        }`}>
                          <span className={`text-[10px] uppercase font-bold block tracking-wider ${
                            missingCount > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-slate-400'
                          }`}>
                            {locale === 'vi' ? 'Thiếu Dữ Liệu' : 'Missing Data'}
                          </span>
                          <div className="flex items-baseline gap-1">
                            <span className={`text-base font-extrabold tabular-nums ${
                              missingCount > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-slate-900 dark:text-white'
                            }`}>
                              {missingCount}
                            </span>
                            <span className={`text-[10px] font-medium ${missingCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500'}`}>
                              {locale === 'vi' ? 'trạm thiếu' : 'missing'}
                            </span>
                          </div>
                        </div>

                        <div className="rounded-xl border border-blue-200/80 dark:border-blue-900/60 bg-blue-50/40 dark:bg-blue-950/20 p-2.5 space-y-0.5 shadow-2xs">
                          <span className="text-[10px] uppercase font-bold text-blue-700 dark:text-blue-400 block tracking-wider">{locale === 'vi' ? 'Bản Ghi Quan Sát' : 'Total Raw Obs'}</span>
                          <div className="flex items-baseline gap-1">
                            <span className="text-base font-extrabold text-blue-700 dark:text-blue-300 tabular-nums">{totalObsCount}</span>
                            <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">{locale === 'vi' ? 'bản ghi' : 'records'}</span>
                          </div>
                        </div>
                      </div>

                      <p className="text-slate-500 pt-1">
                        {locale === 'vi'
                          ? 'Truy vết minh bạch 100% từ Sự Kiện Canonical về Bản Ghi Quan Sát Thô Ban Đầu (Sắp xếp theo thứ tự 6 trạm):'
                          : '100% end-to-end lineage tracing from Canonical Event to Raw Observations (Sorted by 6 Stations):'}
                      </p>

                      {renderedStations.length === 0 ? (
                        <p className="text-slate-400 italic py-3 text-center">
                          {locale === 'vi' ? 'Chưa có bản ghi truy vết cho lô hàng này' : 'No provenance records found'}
                        </p>
                      ) : (
                        renderedStations.map((stationInfo) => {
                          const lin = lineageMap.get(stationInfo.code);

                          // If station is missing before furthest station: Show Missing Data Gap card!
                          if (!lin) {
                            return (
                              <div
                                key={stationInfo.code}
                                className="rounded-xl border border-amber-300/80 dark:border-amber-800/80 bg-amber-50/50 dark:bg-amber-950/20 p-3.5 space-y-1.5"
                              >
                                <div className="flex items-center justify-between font-bold text-xs sm:text-sm border-b border-amber-200/80 dark:border-amber-800/60 pb-2">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-mono text-xs text-amber-600 dark:text-amber-400">TRẠM {stationInfo.stepNum}</span>
                                    <span className="text-amber-900 dark:text-amber-200">{stationInfo.name}</span>
                                  </div>
                                  <span className="inline-flex items-center gap-1 font-sans text-amber-800 dark:text-amber-300 font-bold bg-amber-100/90 dark:bg-amber-900/60 border border-amber-300 dark:border-amber-800 px-2 py-0.5 rounded-md text-[10px]">
                                    <AlertTriangle className="h-3 w-3 text-amber-600" />
                                    <span>{locale === 'vi' ? 'Thiếu Dữ Liệu' : 'Missing Data'}</span>
                                  </span>
                                </div>
                                <p className="text-[11px] text-amber-800 dark:text-amber-300/90 leading-relaxed">
                                  {locale === 'vi'
                                    ? 'Lô hàng đã tiến tới công đoạn tiếp theo nhưng không có bản ghi thô nào được ghi nhận tại công đoạn này. Hệ thống tự động kích hoạt cờ cảnh báo thiếu dữ liệu theo đúng yêu cầu đề bài.'
                                    : 'Batch progressed to later stations but no source records were captured at this step. Missing-data indicator automatically activated as required.'}
                                </p>
                              </div>
                            );
                          }

                    // Otherwise render the normal Verified Canonical & Contributing Records
                    return (
                      <div
                        key={lin.station}
                        className="rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 space-y-2.5 bg-slate-50/50 dark:bg-slate-800/40"
                      >
                        <div className="flex items-center justify-between font-bold text-xs sm:text-sm border-b border-slate-200/60 dark:border-slate-700/60 pb-2">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs text-slate-400">TRẠM {stationInfo?.stepNum || ''}</span>
                            <span className="text-blue-600 dark:text-blue-400">
                              {stationInfo?.name || lin.station}
                            </span>
                          </div>
                          <span className="font-mono text-emerald-600 font-bold bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/60 px-2 py-0.5 rounded-md text-xs">
                            {lin.canonicalEvent?.quantity} {locale === 'vi' ? 'cái' : 'pcs'}
                          </span>
                        </div>

                        <div className="space-y-2">
                          <span className="font-semibold text-slate-600 dark:text-slate-400 text-[11px] block">
                            {locale === 'vi' ? 'Bản ghi nguồn tham gia giải quyết xung đột:' : 'Contributing source records:'}
                          </span>
                          {lin.contributions?.map((c: any, idx: number) => (
                            <div
                              key={idx}
                              className={`rounded-xl p-3 font-mono text-[11px] space-y-1.5 border transition-all ${
                                c.isWinner
                                  ? 'bg-emerald-50/30 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800/80 shadow-2xs'
                                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700/60'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <span className="font-bold text-slate-800 dark:text-slate-200 font-sans">
                                  {c.sourceName} <span className="text-slate-400 font-normal">({c.sourceType})</span>
                                </span>
                                {c.isWinner && (
                                  <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300 font-bold bg-emerald-100/80 dark:bg-emerald-900/60 border border-emerald-300 dark:border-emerald-800 px-2 py-0.5 rounded text-[10px] font-sans">
                                    <ShieldCheck className="h-3 w-3 text-emerald-600" />
                                    <span>{locale === 'vi' ? 'Dữ liệu đối soát chuẩn (Verified Record)' : 'Verified Canonical Record'}</span>
                                  </span>
                                )}
                              </div>

                              <div className="space-y-0.5 pt-0.5 text-slate-600 dark:text-slate-300">
                                <div>Source Record ID: <strong className="text-blue-600 dark:text-blue-400">{c.normalizedRecord?.sourceRecordId}</strong></div>
                                <div className="text-slate-500">Run ID: {c.normalizedRecord?.collectionRunId}</div>
                                {c.occurrenceCount > 1 && (
                                  <div className="inline-flex items-center gap-1 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 text-[10px] font-sans font-semibold mt-0.5">
                                    <Clock className="h-2.5 w-2.5" />
                                    <span>{locale === 'vi' ? `Đã quan sát ${c.occurrenceCount} lần qua Auto-Sync (Đã deduplicate)` : `Observed ${c.occurrenceCount} times via Auto-Sync`}</span>
                                  </div>
                                )}
                              </div>

                              {/* Collapsible Raw Payload */}
                              {c.sourceObservation?.rawPayload && (
                                <details className="mt-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-800/80">
                                  <summary className="cursor-pointer text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-sans font-medium flex items-center gap-1">
                                    <FileText className="h-3 w-3" />
                                    <span>{locale === 'vi' ? 'Xem Raw Payload JSON' : 'View Raw Payload JSON'}</span>
                                  </summary>
                                  <pre className="mt-1 p-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-[10px] text-slate-700 dark:text-slate-300 overflow-x-auto whitespace-pre-wrap border border-slate-200/60 dark:border-slate-700/60">
                                    {JSON.stringify(c.sourceObservation.rawPayload, null, 2)}
                                  </pre>
                                </details>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  }))}
                </>
              );
            })()}
          </div>
            )}
          </div>
        </div>
        </Portal>
      )}
    </div>
  );
}
