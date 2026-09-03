export enum StationCode {
  RECEIVING = 'RECEIVING',
  SORTING = 'SORTING',
  WASHING = 'WASHING',
  DRYING = 'DRYING',
  FOLDING = 'FOLDING',
  DISPATCH = 'DISPATCH',
}

export const STATION_ORDER: StationCode[] = [
  StationCode.RECEIVING,
  StationCode.SORTING,
  StationCode.WASHING,
  StationCode.DRYING,
  StationCode.FOLDING,
  StationCode.DISPATCH,
];

export const STATION_RANKS: Record<StationCode, number> = {
  [StationCode.RECEIVING]: 1,
  [StationCode.SORTING]: 2,
  [StationCode.WASHING]: 3,
  [StationCode.DRYING]: 4,
  [StationCode.FOLDING]: 5,
  [StationCode.DISPATCH]: 6,
};

export function getStationRank(station: StationCode): number {
  return STATION_RANKS[station] ?? 0;
}

export function isStationCode(value: string): value is StationCode {
  return Object.values(StationCode).includes(value as StationCode);
}
