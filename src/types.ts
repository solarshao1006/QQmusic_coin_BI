export interface AppSettings {
  albumPrice: number;
  coversCount: number;
  digitalPerCover: number;
  giftCardPerCover: number;
}

export type TransactionSource = 'exchange' | 'recharge' | 'none';

export interface Account {
  id: string;
  name: string;
  unexchangedLebi: number;
}

export interface Transaction {
  id: string;
  accountId: string;
  rmb: number;
  lebi: number;
  source?: TransactionSource;
  note: string;
  date: number;
}
