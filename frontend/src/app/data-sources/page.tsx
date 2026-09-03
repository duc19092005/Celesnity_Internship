'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Clock,
  Database,
  ExternalLink,
  Eye,
  FileCode,
  Globe,
  HardDrive,
  Info,
  Layers,
  Loader2,
  Lock,
  Play,
  Plus,
  RefreshCw,
  Search,
  Server,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Table,
  X,
  Zap,
} from 'lucide-react';
import { SourcesApi } from '@/services/api';
import { useLanguage } from '@/context/language-context';
import { Portal } from '@/components/ui/portal';
import { toast } from 'sonner';

export default function DataSourcesPage() {
  const { t, locale } = useLanguage();
  const [sources, setSources] = useState<any[]>([]);
  const [runs, setRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Filters, Search & Pagination
  const [runSearchQuery, setRunSearchQuery] = useState('');
  const [runStatusFilter, setRunStatusFilter] = useState<'ALL' | 'SUCCEEDED' | 'PARTIAL_SUCCESS' | 'FAILED'>('ALL');
  const [runPage, setRunPage] = useState<number>(1);
  const [runPageSize, setRunPageSize] = useState<number>(10);

  // Modals state
  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [schemaModalSource, setSchemaModalSource] = useState<any | null>(null);
  const [discoveredSchema, setDiscoveredSchema] = useState<any | null>(null);
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [previewRunId, setPreviewRunId] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<any | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [errorModalRun, setErrorModalRun] = useState<any | null>(null);

  // New source form state
  const [newSource, setNewSource] = useState({
    name: '',
    type: 'POSTGRESQL',
    host: 'production-db',
    port: 5432,
    database: 'production_db',
    username: 'postgres',
    secret: 'postgres',
    url: 'http://localhost:4000/fixtures/supplier/deliveries',
    baseUrl: 'http://localhost:4000/fixtures/application-api',
    maxPages: 5,
  });

  const formatTimeOnly = (dateVal: any): string => {
    if (!dateVal || (typeof dateVal === 'object' && Object.keys(dateVal).length === 0)) return '—';
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleTimeString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  };

  const formatDateOnly = (dateVal: any): string => {
    if (!dateVal || (typeof dateVal === 'object' && Object.keys(dateVal).length === 0)) return '—';
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const safeFormatDate = (dateVal: any): string => {
    if (!dateVal || (typeof dateVal === 'object' && Object.keys(dateVal).length === 0)) {
      return locale === 'vi' ? 'Chưa ghi nhận' : 'Not recorded';
    }
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return locale === 'vi' ? 'Chưa ghi nhận' : 'Not recorded';
    const time = d.toLocaleTimeString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const date = d.toLocaleDateString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    return `${time} (${date})`;
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [srcList, runList] = await Promise.all([
        SourcesApi.list(),
        SourcesApi.listRuns(),
      ]);
      setSources(srcList || []);
      setRuns(runList || []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleTest = async (source: any) => {
    setActionLoading(`test-${source.id}`);
    try {
      const res = await SourcesApi.test(source.id);
      if (res.connected) {
        toast.success(
          locale === 'vi' ? 'Kết nối thành công!' : 'Connection verified!',
          {
            description: `${source.name} • ${res.latencyMs ? `${res.latencyMs}ms` : 'Sẵn sàng'}`,
          },
        );
      } else {
        toast.error(
          locale === 'vi' ? 'Kiểm tra thất bại' : 'Connection failed',
          {
            description: `[${source.name}]: ${res.message}`,
          },
        );
      }
      loadData();
    } catch (err: any) {
      toast.error(locale === 'vi' ? 'Lỗi kiểm tra kết nối' : 'Connection test error', {
        description: `[${source.name}]: ${err.message}`,
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDiscover = async (source: any) => {
    setActionLoading(`discover-${source.id}`);
    try {
      const res = await SourcesApi.discover(source.id);
      setDiscoveredSchema(res);
      setSchemaModalSource(source);
      setSelectedTable(source.selectedSchema?.selectedTable || res.tables?.[0]?.name || '');
      toast.info(
        locale === 'vi' ? 'Khám phá cấu trúc thành công' : 'Schema discovered',
        {
          description: `${source.name} • ${res.tables?.length || res.headers?.length || 0} mục dữ liệu`,
        },
      );
    } catch (err: any) {
      toast.error(locale === 'vi' ? 'Khám phá cấu trúc thất bại' : 'Schema discovery error', {
        description: `[${source.name}]: ${err.message}`,
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleSaveSelection = async () => {
    if (!schemaModalSource) return;
    try {
      await SourcesApi.saveSelection(schemaModalSource.id, {
        selectedTable,
      });
      toast.success(
        locale === 'vi' ? 'Đã lưu cấu hình bảng dữ liệu' : 'Schema configuration saved',
        {
          description: `Bảng chọn: ${selectedTable}`,
        },
      );
      setSchemaModalSource(null);
      loadData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleCollect = async (source: any) => {
    setActionLoading(`collect-${source.id}`);
    try {
      // Step 1: Pre-flight connection check before scraping
      const ping = await SourcesApi.test(source.id);
      if (!ping.connected) {
        toast.error(
          locale === 'vi' ? `Lỗi kết nối nguồn: ${source.name}` : `Connection failed: ${source.name}`,
          {
            description: ping.message || 'Không thể kết nối đến máy chủ nguồn dữ liệu',
          },
        );
        loadData();
        return;
      }

      // Step 2: Execute Collection
      const run = await SourcesApi.collect(source.id);
      const isSuccess = run.status === 'SUCCEEDED' || run.status === 'PARTIAL_SUCCESS';
      if (isSuccess) {
        toast.success(
          locale === 'vi' ? `Thu thập hoàn tất: ${source.name}` : `Ingestion completed: ${source.name}`,
          {
            description: `Kết nối tốt (${ping.latencyMs}ms) • ${run.durationMs}ms cào • ${run.acceptedCount} hợp lệ / ${run.observedCount} quan sát${run.errorCount > 0 ? ` • ${run.errorCount} lỗi cách ly` : ''}`,
            action: {
              label: locale === 'vi' ? 'Xem trước' : 'Preview',
              onClick: () => handleOpenPreview(run.id),
            },
            duration: 5000,
          },
        );
      } else {
        toast.error(
          locale === 'vi' ? `Thu thập thất bại: ${source.name}` : `Ingestion failed: ${source.name}`,
          {
            description: `Run ${run.id}: ${run.status}`,
          },
        );
      }
      loadData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleAutoSync = async (source: any) => {
    const nextState = !source.autoSync;
    try {
      await SourcesApi.autoSync(source.id, nextState, 30);
      if (nextState) {
        toast.success(
          locale === 'vi' ? 'Đã kích hoạt Tự Động Cào 30s' : 'Auto-Sync (30s) enabled',
          {
            description: `${source.name} sẽ tự động thu thập mỗi 30 giây`,
          },
        );
      } else {
        toast.info(
          locale === 'vi' ? 'Đã tắt Tự Động Cào' : 'Auto-Sync disabled',
          {
            description: `${source.name}`,
          },
        );
      }
      loadData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleRegisterSource = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const config: any = {};
      if (newSource.type === 'POSTGRESQL') {
        config.host = newSource.host;
        config.port = Number(newSource.port);
        config.database = newSource.database;
        config.username = newSource.username;
      } else if (newSource.type === 'WEB_CRAWLER') {
        config.url = newSource.url;
        config.maxPages = Number(newSource.maxPages);
      } else if (newSource.type === 'REST_API') {
        config.baseUrl = newSource.baseUrl;
      }

      const created = await SourcesApi.register({
        name: newSource.name,
        type: newSource.type,
        config,
        secret: newSource.secret,
      });

      // Automatically verify connection right at registration step!
      let pingMs = 0;
      let isVerified = false;
      try {
        const testRes = await SourcesApi.test(created.id);
        if (testRes.connected) {
          isVerified = true;
          pingMs = testRes.latencyMs || 0;
        }
      } catch (e) {}

      if (isVerified) {
        toast.success(
          locale === 'vi' ? 'Đã thêm & Xác thực kết nối thành công!' : 'Source registered & verified!',
          {
            description: `${newSource.name} • Đã kiểm tra kết nối (${pingMs}ms)`,
          },
        );
      } else {
        toast.success(
          locale === 'vi' ? 'Đăng ký nguồn mới thành công!' : 'Source registered successfully!',
          {
            description: newSource.name,
          },
        );
      }
      setRegisterModalOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleOpenPreview = async (runId: string) => {
    setPreviewRunId(runId);
    setPreviewLoading(true);
    try {
      const res = await SourcesApi.previewRecords(runId, 1, 50);
      setPreviewData(res);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setPreviewLoading(false);
    }
  };

  // Top KPI Metrics
  const kpiStats = useMemo(() => {
    const verifiedSources = sources.filter((s) => s.status === 'VERIFIED').length;
    const autoSyncActive = sources.filter((s) => s.autoSync).length;
    const totalAcceptedRecords = runs.reduce((acc, r) => acc + (r.acceptedCount || 0), 0);
    const totalRuns = runs.length;

    return {
      totalSources: sources.length,
      verifiedSources,
      autoSyncActive,
      totalAcceptedRecords,
      totalRuns,
    };
  }, [sources, runs]);

  // Filtered runs
  const filteredRuns = useMemo(() => {
    return runs.filter((run) => {
      // Query filter
      if (runSearchQuery.trim()) {
        const q = runSearchQuery.toLowerCase().trim();
        const src = sources.find((s) => s.id === run.sourceId);
        const matchId = run.id?.toLowerCase().includes(q);
        const matchSrc = src?.name?.toLowerCase().includes(q) || run.sourceId?.toLowerCase().includes(q);
        if (!matchId && !matchSrc) return false;
      }

      // Status filter
      if (runStatusFilter !== 'ALL' && run.status !== runStatusFilter) {
        return false;
      }

      return true;
    });
  }, [runs, runSearchQuery, runStatusFilter, sources]);

  // Reset pagination to page 1 whenever filters change
  useEffect(() => {
    setRunPage(1);
  }, [runSearchQuery, runStatusFilter, runPageSize]);

  const totalRunPages = Math.max(1, Math.ceil(filteredRuns.length / runPageSize));
  const paginatedRuns = useMemo(() => {
    const startIndex = (runPage - 1) * runPageSize;
    return filteredRuns.slice(startIndex, startIndex + runPageSize);
  }, [filteredRuns, runPage, runPageSize]);

  return (
    <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      {/* 1. Header & Primary Actions */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200/80 dark:border-slate-800">
        <div className="flex items-center gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-600 text-white shadow-md shadow-blue-500/20">
            <Database className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight leading-tight">
                {t('sourcesTitle')}
              </h1>
              <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200/60 dark:border-blue-800/60 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700 dark:text-blue-300">
                <Activity className="h-3 w-3 animate-pulse text-blue-600" />
                MES Connect
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              {t('sourcesDesc')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 shadow-xs transition-all active:scale-95 disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-blue-600' : ''}`} />
            <span>{t('refresh')}</span>
          </button>
          <button
            onClick={() => setRegisterModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 px-4 py-2 text-xs font-bold text-white shadow-md shadow-blue-500/20 transition-all active:scale-95"
          >
            <Plus className="h-4 w-4" />
            <span>{t('registerSource')}</span>
          </button>
        </div>
      </header>
       {/* 2. Enterprise Overview Metric Strip */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Metric 1 */}
        <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-xs flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {locale === 'vi' ? 'Tổng Nguồn Dữ Liệu' : 'Connected Sources'}
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
              <Server className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums">
              {kpiStats.totalSources}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/80 dark:border-emerald-800/60 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {kpiStats.verifiedSources}/{kpiStats.totalSources} {locale === 'vi' ? 'sẵn sàng' : 'ready'}
            </span>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-xs flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {locale === 'vi' ? 'Tự Động Thu Thập (30s)' : 'Auto-Sync Active'}
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
              <Zap className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums">
              {kpiStats.autoSyncActive}
            </span>
            <span className="text-xs text-slate-500">
              {locale === 'vi' ? `trên ${kpiStats.totalSources} nguồn` : `of ${kpiStats.totalSources} sources`}
            </span>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-xs flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {locale === 'vi' ? 'Tổng Đợt Thu Thập' : 'Collection Runs'}
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400">
              <Activity className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums">
              {kpiStats.totalRuns}
            </span>
            <span className="text-xs text-slate-500">
              {locale === 'vi' ? 'đợt cào hoàn tất' : 'completed runs'}
            </span>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-xs flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {locale === 'vi' ? 'Bản Ghi Chuẩn Hóa' : 'Ingested Records'}
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums">
              {kpiStats.totalAcceptedRecords.toLocaleString()}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 dark:bg-blue-950/50 border border-blue-200/80 dark:border-blue-800/60 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700 dark:text-blue-300">
              <Check className="h-3 w-3" />
              100% {locale === 'vi' ? 'chuẩn hóa' : 'normalized'}
            </span>
          </div>
        </div>
      </section>

      {/* 3. Sources Cards Grid */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-2">
            <Server className="h-4 w-4 text-blue-600" />
            <span>{locale === 'vi' ? 'Danh Sách Nguồn Dữ Liệu' : 'Registered Data Sources'} ({sources.length})</span>
          </h2>
          <span className="text-xs text-slate-400 hidden sm:inline">
            {locale === 'vi' ? 'Kiểm tra kết nối, khám phá cấu trúc hoặc chạy thu thập trực tiếp' : 'Test, discover schema or run collection'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {sources.map((source) => {
            const isTesting = actionLoading === `test-${source.id}`;
            const isDiscovering = actionLoading === `discover-${source.id}`;
            const isCollecting = actionLoading === `collect-${source.id}`;

            const SourceIcon =
              source.type === 'POSTGRESQL'
                ? HardDrive
                : source.type === 'WEB_CRAWLER'
                ? Globe
                : Activity;

            return (
              <div
                key={source.id}
                className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between space-y-4"
              >
                {/* Header & Meta */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
                      <SourceIcon className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                      <span>{source.type}</span>
                    </span>

                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        source.status === 'VERIFIED'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60'
                          : source.status === 'ERROR'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60'
                          : 'bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${source.status === 'VERIFIED' ? 'bg-emerald-500' : source.status === 'ERROR' ? 'bg-rose-500' : 'bg-slate-400'}`} />
                      <span>{source.status === 'VERIFIED' ? t('verified') : source.status === 'ERROR' ? t('error') : t('unverified')}</span>
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                      {source.name}
                    </h3>
                  </div>

                  {/* Monospace Endpoint Box */}
                  <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-500 bg-slate-50 dark:bg-slate-800/60 px-2.5 py-1.5 rounded-lg border border-slate-100 dark:border-slate-800 truncate">
                    <span className="text-slate-400 font-sans text-[10px]">URL:</span>
                    <span className="truncate">
                      {source.config?.url ||
                        source.config?.baseUrl ||
                        `${source.config?.host}:${source.config?.port}/${source.config?.database}`}
                    </span>
                  </div>

                  {/* Badges */}
                  <div className="flex flex-wrap gap-1.5">
                    {source.hasSecret && (
                      <span className="inline-flex items-center gap-1 rounded bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 px-2 py-0.5 text-[10px] font-medium">
                        <ShieldCheck className="h-3 w-3 text-emerald-600" />
                        <span>Mật khẩu mã hóa AES-256</span>
                      </span>
                    )}

                    {source.selectedSchema && (
                      <span className="inline-flex items-center gap-1 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900 px-2 py-0.5 text-[10px] font-mono font-medium">
                        <Table className="h-3 w-3" />
                        <span>{source.selectedSchema.selectedTable || 'Bảng mặc định'}</span>
                      </span>
                    )}
                  </div>

                  {/* Source Timestamps Strip (UTC+7) */}
                  <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-2.5 text-[11px] font-mono space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 font-sans text-[10px] flex items-center gap-1">
                        <Clock className="h-3 w-3 text-slate-400" />
                        <span>{locale === 'vi' ? 'Cào gần nhất:' : 'Last run:'}</span>
                      </span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {safeFormatDate(source.lastRunAt)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 font-sans text-[10px] flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3 text-slate-400" />
                        <span>{locale === 'vi' ? 'Xác thực lúc:' : 'Verified at:'}</span>
                      </span>
                      <span className="text-slate-500 dark:text-slate-400">
                        {safeFormatDate(source.lastVerifiedAt || source.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Action Controls */}
                <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleTest(source)}
                      disabled={isTesting}
                      title={locale === 'vi' ? 'Kiểm tra lại kết nối & độ trễ' : 'Re-test connection & latency'}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors disabled:opacity-60"
                    >
                      {isTesting ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
                      ) : (
                        <Activity className="h-3.5 w-3.5 text-slate-400" />
                      )}
                      <span>{isTesting ? (locale === 'vi' ? 'Đang kiểm tra...' : 'Testing...') : (locale === 'vi' ? 'Kiểm tra lại' : 'Re-test')}</span>
                    </button>

                    <button
                      onClick={() => handleDiscover(source)}
                      disabled={isDiscovering}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors disabled:opacity-60"
                    >
                      {isDiscovering ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
                      ) : (
                        <Layers className="h-3.5 w-3.5 text-slate-400" />
                      )}
                      <span>{isDiscovering ? 'Đang đọc...' : t('discoverSchema')}</span>
                    </button>
                  </div>

                  {/* Primary Collect Button */}
                  <button
                    onClick={() => handleCollect(source)}
                    disabled={isCollecting}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.99] py-2 text-xs font-bold text-white shadow-xs transition-colors disabled:opacity-60"
                  >
                    {isCollecting ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Play className="h-3.5 w-3.5 fill-current" />
                    )}
                    <span>{isCollecting ? 'Đang thu thập dữ liệu...' : t('runCollection')}</span>
                  </button>

                  {/* Auto-Sync Toggle Switch Row */}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <Zap className={`h-3.5 w-3.5 ${source.autoSync ? 'text-amber-500 fill-current' : 'text-slate-400'}`} />
                      <span>{locale === 'vi' ? 'Tự động cào (30s)' : 'Auto-Sync (30s)'}</span>
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={source.autoSync}
                      onClick={() => handleToggleAutoSync(source)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none ${
                        source.autoSync ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out translate-y-0.5 ${
                          source.autoSync ? 'translate-x-4' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 4. Collection Runs History & Logs Section */}
      <section className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-xs space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              <Activity className="h-3.5 w-3.5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                {t('runHistory')}
              </h2>
              <p className="text-xs text-slate-500">
                {locale === 'vi' ? 'Nhật ký các đợt cào, số lượng bản ghi và xem trước kết quả' : 'Execution history, ingested counts, and preview'}
              </p>
            </div>
          </div>

          {/* Search & Status Filter for Runs */}
          <div className="flex items-center gap-2">
            <div className="relative w-48 sm:w-56">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
              <input
                type="text"
                placeholder={locale === 'vi' ? 'Tìm mã đợt hoặc nguồn...' : 'Search runs...'}
                value={runSearchQuery}
                onChange={(e) => setRunSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pl-7 pr-6 py-1 text-xs text-slate-900 dark:text-white focus:outline-blue-600"
              />
              {runSearchQuery && (
                <button
                  onClick={() => setRunSearchQuery('')}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            <div className="inline-flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5">
              {(
                [
                  { key: 'ALL', label: locale === 'vi' ? 'Tất cả' : 'All' },
                  { key: 'SUCCEEDED', label: locale === 'vi' ? 'Thành công' : 'Success' },
                  { key: 'FAILED', label: locale === 'vi' ? 'Lỗi' : 'Failed' },
                ] as const
              ).map((f) => (
                <button
                  key={f.key}
                  onClick={() => setRunStatusFilter(f.key as any)}
                  className={`rounded-md px-2 py-0.5 text-xs font-semibold transition-colors ${
                    runStatusFilter === f.key
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Runs Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400 font-semibold">
              <tr>
                <th className="py-2.5 px-3">Mã Đợt Chạy</th>
                <th className="py-2.5 px-3">Nguồn Dữ Liệu</th>
                <th className="py-2.5 px-3">{t('status')}</th>
                <th className="py-2.5 px-3">Bắt Đầu ➔ Kết Thúc</th>
                <th className="py-2.5 px-3 text-center">Thời Lượng</th>
                <th className="py-2.5 px-3 text-center">Quan Sát</th>
                <th className="py-2.5 px-3 text-center">Hợp Lệ</th>
                <th className="py-2.5 px-3 text-center">Trùng Lặp</th>
                <th className="py-2.5 px-3 text-center">Dòng Lỗi</th>
                <th className="py-2.5 px-3 text-right">Xem Trước</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {paginatedRuns.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-10 text-center text-slate-400 font-medium">
                    {locale === 'vi'
                      ? 'Chưa có đợt thu thập nào phù hợp. Hãy bấm nút "Chạy Thu Thập" ở trên!'
                      : 'No collection runs found.'}
                  </td>
                </tr>
              ) : (
                paginatedRuns.map((run) => (
                  <tr key={run.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-800 dark:text-slate-200">{run.id}</td>
                    <td className="py-2.5 px-3 font-semibold text-slate-700 dark:text-slate-300">
                      {sources.find((s) => s.id === run.sourceId)?.name || run.sourceId}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-bold ${
                          run.status === 'SUCCEEDED'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60'
                            : run.status === 'PARTIAL_SUCCESS'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60'
                            : 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60'
                        }`}
                      >
                        {run.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 font-mono text-xs text-slate-800 dark:text-slate-200">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                        <span className="text-[10px] text-slate-400 font-sans">{locale === 'vi' ? 'Bắt đầu:' : 'Start:'}</span>
                        <strong className="font-semibold">{formatTimeOnly(run.startedAt || run.createdAt)}</strong>
                      </div>
                      <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-500 mt-0.5">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        <span className="text-[10px] text-slate-400 font-sans">{locale === 'vi' ? 'Kết thúc:' : 'End:'}</span>
                        <span>
                          {run.finishedAt
                            ? formatTimeOnly(run.finishedAt)
                            : (run.durationMs
                              ? formatTimeOnly(new Date(new Date(run.startedAt || run.createdAt).getTime() + run.durationMs))
                              : formatTimeOnly(run.startedAt || run.createdAt)
                            )}
                        </span>
                        <span className="text-[10px] text-slate-400 font-sans">({formatDateOnly(run.startedAt || run.createdAt)})</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-xs whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-slate-700 dark:text-slate-300 font-semibold text-[11px]">
                        <Clock className="h-3 w-3 text-slate-400" />
                        <span>{run.durationMs ?? 0}ms</span>
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center font-bold text-slate-900 dark:text-white">{run.observedCount}</td>
                    <td className="py-2.5 px-3 text-center font-bold text-emerald-600 dark:text-emerald-400">{run.acceptedCount}</td>
                    <td className="py-2.5 px-3 text-center font-medium text-amber-600 dark:text-amber-400">{run.duplicateCount}</td>
                    <td className="py-2.5 px-3 text-center">
                      {run.errorCount > 0 ? (
                        <button
                          onClick={() => setErrorModalRun(run)}
                          className="font-bold text-rose-600 dark:text-rose-400 hover:underline bg-rose-50 dark:bg-rose-950/40 px-1.5 py-0.5 rounded text-[10px]"
                        >
                          {run.errorCount} lỗi (Xem)
                        </button>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() => handleOpenPreview(run.id)}
                        className="inline-flex items-center gap-1 rounded-md bg-blue-50 dark:bg-blue-950/50 px-2 py-1 font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                      >
                        <Eye className="h-3 w-3" />
                        <span>Preview</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer Controls */}
        {filteredRuns.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <span>{locale === 'vi' ? 'Hiển thị' : 'Showing'}</span>
              <select
                value={runPageSize}
                onChange={(e) => {
                  setRunPageSize(Number(e.target.value));
                  setRunPage(1);
                }}
                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-1 text-xs text-slate-900 dark:text-white focus:outline-blue-600 font-semibold cursor-pointer"
              >
                <option value={10}>10 đợt/trang</option>
                <option value={20}>20 đợt/trang</option>
                <option value={50}>50 đợt/trang</option>
                <option value={100}>100 đợt/trang</option>
              </select>
              <span>
                {locale === 'vi'
                  ? `(Tổng cộng ${filteredRuns.length} đợt thu thập)`
                  : `(Total ${filteredRuns.length} runs)`}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setRunPage(1)}
                disabled={runPage === 1}
                className="rounded-lg border border-slate-200 dark:border-slate-700 p-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-slate-600 dark:text-slate-400"
                title={locale === 'vi' ? 'Trang đầu tiên' : 'First page'}
              >
                <ChevronsLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setRunPage((p) => Math.max(1, p - 1))}
                disabled={runPage === 1}
                className="rounded-lg border border-slate-200 dark:border-slate-700 p-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-slate-600 dark:text-slate-400"
                title={locale === 'vi' ? 'Trang trước' : 'Previous page'}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <span className="px-3 font-semibold text-slate-800 dark:text-slate-200 font-mono">
                {locale === 'vi' ? `Trang ${runPage} / ${totalRunPages}` : `Page ${runPage} of ${totalRunPages}`}
              </span>

              <button
                onClick={() => setRunPage((p) => Math.min(totalRunPages, p + 1))}
                disabled={runPage === totalRunPages}
                className="rounded-lg border border-slate-200 dark:border-slate-700 p-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-slate-600 dark:text-slate-400"
                title={locale === 'vi' ? 'Trang tiếp theo' : 'Next page'}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <button
                onClick={() => setRunPage(totalRunPages)}
                disabled={runPage === totalRunPages}
                className="rounded-lg border border-slate-200 dark:border-slate-700 p-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-slate-600 dark:text-slate-400"
                title={locale === 'vi' ? 'Trang cuối cùng' : 'Last page'}
              >
                <ChevronsRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </section>

      {/* MODAL 1: Register Source */}
      {registerModalOpen && (
        <Portal>
          <div
            onClick={(e) => { if (e.target === e.currentTarget) setRegisterModalOpen(false); }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/75 backdrop-blur-md p-4 sm:p-6 overflow-y-auto transition-all animate-in fade-in duration-200"
          >
            <div className="w-full max-w-lg my-auto rounded-2xl bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-2xl space-y-4 border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Plus className="h-4 w-4 text-blue-600" />
                  <span>{t('registerSource')}</span>
                </h3>
                <button
                  onClick={() => setRegisterModalOpen(false)}
                  className="rounded-lg p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleRegisterSource} className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-bold mb-1 text-slate-700 dark:text-slate-300">Tên Nguồn Dữ Liệu</label>
                  <input
                    type="text"
                    required
                    value={newSource.name}
                    onChange={(e) => setNewSource({ ...newSource, name: e.target.value })}
                    placeholder="Ví dụ: Cổng thông tin Nhà cung cấp 2"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-blue-600"
                  />
                </div>

                <div>
                  <label className="block font-bold mb-1 text-slate-700 dark:text-slate-300">{t('sourceType')}</label>
                  <select
                    value={newSource.type}
                    onChange={(e) => setNewSource({ ...newSource, type: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-blue-600"
                  >
                    <option value="POSTGRESQL">PostgreSQL Database</option>
                    <option value="WEB_CRAWLER">Supplier Web Crawler (HTML)</option>
                    <option value="REST_API">Application REST API</option>
                    <option value="MQTT">Mosquitto MQTT Telemetry</option>
                  </select>
                </div>

                {newSource.type === 'POSTGRESQL' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold mb-1 text-slate-700 dark:text-slate-300">Host</label>
                      <input
                        type="text"
                        value={newSource.host}
                        onChange={(e) => setNewSource({ ...newSource, host: e.target.value })}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-blue-600"
                      />
                    </div>
                    <div>
                      <label className="block font-bold mb-1 text-slate-700 dark:text-slate-300">Port</label>
                      <input
                        type="number"
                        value={newSource.port}
                        onChange={(e) => setNewSource({ ...newSource, port: Number(e.target.value) })}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-blue-600"
                      />
                    </div>
                    <div>
                      <label className="block font-bold mb-1 text-slate-700 dark:text-slate-300">Database</label>
                      <input
                        type="text"
                        value={newSource.database}
                        onChange={(e) => setNewSource({ ...newSource, database: e.target.value })}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-blue-600"
                      />
                    </div>
                    <div>
                      <label className="block font-bold mb-1 text-slate-700 dark:text-slate-300">Username</label>
                      <input
                        type="text"
                        value={newSource.username}
                        onChange={(e) => setNewSource({ ...newSource, username: e.target.value })}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-blue-600"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block font-bold mb-1 text-slate-700 dark:text-slate-300">Mật khẩu (Mã hóa AES-256 an toàn)</label>
                      <input
                        type="password"
                        value={newSource.secret}
                        onChange={(e) => setNewSource({ ...newSource, secret: e.target.value })}
                        placeholder="postgres"
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-blue-600"
                      />
                    </div>
                  </div>
                )}

                {newSource.type === 'WEB_CRAWLER' && (
                  <div>
                    <label className="block font-bold mb-1 text-slate-700 dark:text-slate-300">Đường dẫn Website Nhà cung cấp (URL)</label>
                    <input
                      type="url"
                      required
                      value={newSource.url}
                      onChange={(e) => setNewSource({ ...newSource, url: e.target.value })}
                      placeholder="http://localhost:4000/fixtures/supplier/deliveries"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-blue-600"
                    />
                  </div>
                )}

                {newSource.type === 'REST_API' && (
                  <div>
                    <label className="block font-bold mb-1 text-slate-700 dark:text-slate-300">Đường dẫn Base API (URL)</label>
                    <input
                      type="url"
                      required
                      value={newSource.baseUrl}
                      onChange={(e) => setNewSource({ ...newSource, baseUrl: e.target.value })}
                      placeholder="http://localhost:4000/fixtures/application-api"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-blue-600"
                    />
                  </div>
                )}

                <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setRegisterModalOpen(false)}
                    className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    {t('cancel')}
                  </button>
                  <button
                    type="submit"
                    className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 transition-colors inline-flex items-center gap-1.5 shadow-xs"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    <span>{locale === 'vi' ? 'Đăng Ký & Xác Thực Ngay' : 'Register & Verify Now'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </Portal>
      )}

      {/* MODAL 2: Schema Discovery & Table Selection */}
      {schemaModalSource && (
        <Portal>
          <div
            onClick={(e) => { if (e.target === e.currentTarget) setSchemaModalSource(null); }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/75 backdrop-blur-md p-4 sm:p-6 overflow-y-auto transition-all animate-in fade-in duration-200"
          >
            <div className="w-full max-w-2xl my-auto rounded-2xl bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-2xl space-y-4 border border-slate-200 dark:border-slate-800 max-h-[85vh] overflow-y-auto animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Layers className="h-4 w-4 text-blue-600" />
                    <span>Khám Phá Cấu Trúc: {schemaModalSource.name}</span>
                  </h3>
                  <p className="text-xs text-slate-500">Xem và chọn bảng dữ liệu thu thập</p>
                </div>
              <button
                onClick={() => setSchemaModalSource(null)}
                className="rounded-lg p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {discoveredSchema?.tables && (
              <div className="space-y-3">
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Chọn 1 Bảng Dữ Liệu Để Thu Thập:
                </p>
                <div className="space-y-2.5">
                  {discoveredSchema.tables.map((table: any) => (
                    <label
                      key={table.name}
                      className={`block rounded-xl border p-3.5 cursor-pointer transition-all ${
                        selectedTable === table.name
                          ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/30 dark:border-blue-500 shadow-xs'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="radio"
                          name="selectedTable"
                          value={table.name}
                          checked={selectedTable === table.name}
                          onChange={(e) => setSelectedTable(e.target.value)}
                          className="h-3.5 w-3.5 text-blue-600"
                        />
                        <span className="font-bold text-xs text-slate-900 dark:text-white">
                          {table.name}
                        </span>
                        {table.name === 'production_events' && (
                          <span className="rounded bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 text-[10px] font-bold px-1.5 py-0.5">
                            Bảng Sự Kiện Trạm 2-5
                          </span>
                        )}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1 pl-6">
                        {table.columns?.map((col: any) => (
                          <span
                            key={col.name}
                            className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono text-slate-600 dark:text-slate-400"
                          >
                            {col.name} ({col.type})
                          </span>
                        ))}
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {discoveredSchema?.headers && (
              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Các Tiêu Đề Cột HTML Tự Động Nhận Diện:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {discoveredSchema.headers.map((h: string) => (
                    <span key={h} className="inline-flex items-center gap-1 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 px-2.5 py-1 text-xs font-semibold">
                      <Check className="h-3 w-3 text-blue-600" />
                      <span>{h}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {discoveredSchema?.fields && (
              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Trường Dữ Liệu REST API Sẵn Sàng:
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {discoveredSchema.fields.map((f: any) => (
                    <div key={f.name} className="rounded-lg bg-slate-50 dark:bg-slate-800 p-2 text-xs border border-slate-200 dark:border-slate-700">
                      <div className="font-bold text-blue-600 dark:text-blue-400">{f.name} ({f.type})</div>
                      <div className="text-[10px] text-slate-400">Ví dụ: {String(f.example)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setSchemaModalSource(null)}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleSaveSelection}
                className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-blue-700 transition-colors"
              >
                Lưu Cấu Hình
              </button>
            </div>
          </div>
        </div>
        </Portal>
      )}

      {/* MODAL 3: Preview Normalized Records & Lineage */}
      {previewRunId && (
        <Portal>
          <div
            onClick={(e) => { if (e.target === e.currentTarget) setPreviewRunId(null); }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/75 backdrop-blur-md p-4 sm:p-6 overflow-y-auto transition-all animate-in fade-in duration-200"
          >
            <div className="w-full max-w-4xl my-auto rounded-2xl bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-2xl space-y-4 border border-slate-200 dark:border-slate-800 max-h-[85vh] overflow-y-auto animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Eye className="h-4 w-4 text-blue-600" />
                    <span>{t('previewRecords')} &amp; Nguồn Gốc (Provenance)</span>
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">Run ID: {previewRunId}</p>
                </div>
                <button
                  onClick={() => setPreviewRunId(null)}
                  className="rounded-lg p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {previewLoading ? (
                <div className="py-12 text-center text-xs font-bold text-blue-600 flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Đang tải dữ liệu chuẩn hóa...</span>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50/60 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="py-2.5 px-3">Mã Lô</th>
                        <th className="py-2.5 px-3">Công Đoạn</th>
                        <th className="py-2.5 px-3">Sản Lượng</th>
                        <th className="py-2.5 px-3">Phân Loại</th>
                        <th className="py-2.5 px-3">Mã Nguồn Thô</th>
                        <th className="py-2.5 px-3">Thời Điểm</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                      {previewData?.items?.length === 0 ? (
                        <tr><td colSpan={6} className="py-8 text-center text-slate-400">Không có bản ghi nào</td></tr>
                      ) : (
                        previewData?.items?.map((rec: any) => (
                          <tr key={rec.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                            <td className="py-2.5 px-3 font-bold text-blue-600 dark:text-blue-400">{rec.batchId}</td>
                            <td className="py-2.5 px-3 font-semibold">{rec.station}</td>
                            <td className="py-2.5 px-3 font-bold">{rec.quantity}</td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                                  rec.disposition === 'ACCEPTED'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300'
                                    : rec.disposition === 'DUPLICATE'
                                    ? 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300'
                                    : 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300'
                                }`}
                              >
                                {rec.disposition}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-slate-500">{rec.sourceRecordId}</td>
                            <td className="py-2.5 px-3 text-slate-500">{safeFormatDate(rec.occurredAt)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setPreviewRunId(null)}
                  className="rounded-lg bg-slate-100 dark:bg-slate-800 px-4 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                >
                  {t('close')}
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* MODAL 4: Malformed Rows & Error Isolation */}
      {errorModalRun && (
        <Portal>
          <div
            onClick={(e) => { if (e.target === e.currentTarget) setErrorModalRun(null); }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/75 backdrop-blur-md p-4 sm:p-6 overflow-y-auto transition-all animate-in fade-in duration-200"
          >
            <div className="w-full max-w-2xl my-auto rounded-2xl bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-2xl space-y-4 border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div>
                  <h3 className="text-base font-bold text-rose-600 dark:text-rose-400 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    <span>Dòng Lỗi Bị Cách Ly (Malformed Rows)</span>
                  </h3>
                  <p className="text-xs text-slate-500">Các dòng lỗi được hệ thống tự động cách ly mà không làm gián đoạn đợt cào</p>
                </div>
                <button
                  onClick={() => setErrorModalRun(null)}
                  className="rounded-lg p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-2.5 max-h-[60vh] overflow-y-auto">
                {errorModalRun.errors?.map((err: any, idx: number) => (
                  <div key={idx} className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/20 p-3 text-xs space-y-1">
                    <div className="flex items-center justify-between font-bold text-rose-800 dark:text-rose-300">
                      <span>Mã Lỗi: {err.code}</span>
                      {err.rowNumber && <span className="bg-rose-100 dark:bg-rose-900/60 px-1.5 py-0.5 rounded text-[10px]">Dòng #{err.rowNumber}</span>}
                    </div>
                    <p className="text-slate-700 dark:text-slate-300 font-medium">{err.message}</p>
                    {err.rawExcerpt && (
                      <pre className="mt-1.5 font-mono text-[11px] bg-white dark:bg-slate-900 p-2 rounded-lg border border-rose-100 dark:border-rose-950 overflow-x-auto text-slate-800 dark:text-slate-200">
                        {err.rawExcerpt}
                      </pre>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setErrorModalRun(null)}
                  className="rounded-lg bg-slate-100 dark:bg-slate-800 px-4 py-1.5 text-xs font-semibold"
                >
                  {t('close')}
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}
