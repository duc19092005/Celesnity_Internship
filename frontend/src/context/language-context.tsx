'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

export type Locale = 'en' | 'vi';

export const translations = {
  en: {
    // Navigation
    appTitle: 'Factory Data & Production Line',
    appSubtitle: 'Industrial Laundry Tracking & Traceability Platform',
    navDataSources: 'Data Sources',
    navProductionLines: 'Production Lines',
    navOverview: 'Overview',
    navCollapse: 'Collapse Menu',
    navExpand: 'Expand Menu',

    // Theme & Language
    lightMode: 'Light Mode',
    darkMode: 'Dark Mode',
    language: 'Language',

    // Data Sources
    sourcesTitle: 'Data Sources Management',
    sourcesDesc: 'Register, test connections, discover schemas, and trigger manual or scheduled collections.',
    registerSource: 'Register New Source',
    testConnection: 'Test Connection',
    discoverSchema: 'Discover Schema',
    runCollection: 'Run Collection',
    autoSync: 'Auto-Sync (30s)',
    autoSyncEnabled: 'Auto-Sync ON',
    autoSyncDisabled: 'Auto-Sync OFF',
    lastRun: 'Last Run',
    status: 'Status',
    verified: 'Verified',
    unverified: 'Unverified',
    error: 'Error',
    sourceType: 'Source Type',
    runHistory: 'Collection Runs & Logs',
    previewRecords: 'Preview Normalized Records',
    provenance: 'Provenance & Lineage',
    malformedRows: 'Malformed Rows Isolated',

    // Production Lines
    productionTitle: 'Production Line 6-Station Monitoring',
    productionDesc: 'End-to-end real-time visibility, deterministic states, station WIP, and provenance traceability.',
    line: 'Line',
    wip: 'WIP',
    completedQty: 'Completed Qty',
    dataFreshness: 'Freshness',
    staleThreshold: 'Stale Alert Threshold',
    minutes: 'minutes',
    saveSettings: 'Save Settings',

    // 6 Stations
    stationReceiving: '1. Receiving',
    stationSorting: '2. Sorting',
    stationWashing: '3. Washing',
    stationDrying: '4. Drying',
    stationFolding: '5. Folding',
    stationDispatch: '6. Dispatch',

    // States & Indicators
    statePlanned: 'PLANNED',
    stateInProgress: 'IN PROGRESS',
    stateBlocked: 'BLOCKED',
    stateCompleted: 'COMPLETED',
    staleIndicator: 'STALE',
    blockedIndicator: 'BLOCKED',
    missingDataIndicator: 'MISSING DATA',
    qualityIndicator: 'QUALITY ISSUE',

    // Management Actions
    blockBatch: 'Block Batch',
    resumeBatch: 'Resume Batch',
    acknowledge: 'Acknowledge Alert',
    addNote: 'Add Note',
    actionLogs: 'Activity & Management Audit Log',
    confirm: 'Confirm',
    cancel: 'Cancel',
    reason: 'Reason',
    noteText: 'Enter your note...',

    // Common
    loading: 'Loading data...',
    noData: 'No records available',
    refresh: 'Refresh',
    close: 'Close',
    success: 'Success',
  },
  vi: {
    // Navigation
    appTitle: 'Nền Tảng Dữ Liệu Nhà Máy & Dây Chuyền',
    appSubtitle: 'Hệ thống Giám sát & Truy xuất Nguồn gốc Xưởng Giặt Công nghiệp',
    navDataSources: 'Nguồn Dữ Liệu',
    navProductionLines: 'Dây Chuyền Sản Xuất',
    navOverview: 'Tổng Quan',
    navCollapse: 'Thu gọn Menu',
    navExpand: 'Mở rộng Menu',

    // Theme & Language
    lightMode: 'Chế độ Sáng',
    darkMode: 'Chế độ Tối',
    language: 'Ngôn ngữ',

    // Data Sources
    sourcesTitle: 'Quản Lý Nguồn Dữ Liệu',
    sourcesDesc: 'Đăng ký nguồn, kiểm tra kết nối, khám phá schema và kích hoạt thu thập dữ liệu.',
    registerSource: 'Thêm Nguồn Mới',
    testConnection: 'Kiểm Tra Kết Nối',
    discoverSchema: 'Khám Phá Schema',
    runCollection: 'Chạy Thu Thập',
    autoSync: 'Tự Động Cào (30s)',
    autoSyncEnabled: 'Tự động BẬT',
    autoSyncDisabled: 'Tự động TẮT',
    lastRun: 'Lần chạy cuối',
    status: 'Trạng thái',
    verified: 'Đã xác thực',
    unverified: 'Chưa xác thực',
    error: 'Lỗi',
    sourceType: 'Loại nguồn',
    runHistory: 'Lịch Sử Đợt Thu Thập & Logs',
    previewRecords: 'Xem Trước Dữ Liệu Chuẩn Hóa',
    provenance: 'Nguồn Gốc (Provenance)',
    malformedRows: 'Dòng Lỗi Được Cách Ly',

    // Production Lines
    productionTitle: 'Giám Sát Dây Chuyền 6 Công Đoạn',
    productionDesc: 'Theo dõi trực quan thời gian thực, trạng thái tất định, WIP từng trạm và truy vết nguồn gốc.',
    line: 'Dây chuyền',
    wip: 'WIP (Đang xử lý)',
    completedQty: 'Sản lượng hoàn thành',
    dataFreshness: 'Độ tươi dữ liệu',
    staleThreshold: 'Ngưỡng cảnh báo trễ (Stale)',
    minutes: 'phút',
    saveSettings: 'Lưu Cài Đặt',

    // 6 Stations
    stationReceiving: '1. Tiếp Nhận',
    stationSorting: '2. Phân Loại',
    stationWashing: '3. Giặt',
    stationDrying: '4. Sấy',
    stationFolding: '5. Ủi & Gấp',
    stationDispatch: '6. Xuất Hàng',

    // States & Indicators
    statePlanned: 'KẾ HOẠCH',
    stateInProgress: 'ĐANG XỬ LÝ',
    stateBlocked: 'TẠM DỪNG',
    stateCompleted: 'HOÀN THÀNH',
    staleIndicator: 'TRỄ TIẾN ĐỘ',
    blockedIndicator: 'BỊ CHẶN',
    missingDataIndicator: 'THIẾU DỮ LIỆU',
    qualityIndicator: 'LỖI CHẤT LƯỢNG',

    // Management Actions
    blockBatch: 'Tạm Dừng Lô Hàng',
    resumeBatch: 'Mở Lại Lô Hàng',
    acknowledge: 'Xác Nhận Cảnh Báo',
    addNote: 'Thêm Ghi Chú',
    actionLogs: 'Nhật Ký Vận Hành & Kiểm Toán',
    confirm: 'Xác Nhận',
    cancel: 'Hủy',
    reason: 'Lý do',
    noteText: 'Nhập nội dung ghi chú...',

    // Common
    loading: 'Đang tải dữ liệu...',
    noData: 'Chưa có bản ghi nào',
    refresh: 'Làm mới',
    close: 'Đóng',
    success: 'Thành công',
  },
};

interface LanguageContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: keyof typeof translations['en']) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  locale: 'vi',
  setLocale: () => {},
  t: (key) => translations.vi[key] || key,
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locale, setLocale] = useState<Locale>('vi');

  useEffect(() => {
    const saved = localStorage.getItem('celesnity-locale') as Locale;
    if (saved && (saved === 'en' || saved === 'vi')) {
      setLocale(saved);
    }
  }, []);

  const changeLocale = (loc: Locale) => {
    setLocale(loc);
    localStorage.setItem('celesnity-locale', loc);
  };

  const t = (key: keyof typeof translations['en']): string => {
    return translations[locale]?.[key] || translations.en[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ locale, setLocale: changeLocale, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
