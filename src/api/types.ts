export interface PagingInfo {
  page: number;
  perPage: number;
  pageCount: number;
  totalCount: number;
}

export interface Account {
  id: number;
  name: string;
  type: string;
  iban?: string;
  balance?: number;
  currency?: string;
  contraAccountId?: number;
  depotIds?: number[];
  activeAssets?: number;
}

export interface AccountList {
  accounts: Account[];
}

export interface DateValuePair {
  date: string;
  value: number;
}

export interface DateValuePairList {
  dateValuePairs: DateValuePair[];
}

export interface InvestmentQuote {
  last?: number;
  currency?: string;
  changePercentAbs?: number;
}

export interface InvestmentQuoteAndValuation {
  quote?: InvestmentQuote;
  currentMarketValue?: number;
  returnOnInvestmentInPercent?: number;
}

export interface InvestmentV2 {
  id: number;
  name: string;
  isin?: string;
  type: string;
  currency: string;
  numberOfLots?: number;
  quoteAndValuation?: InvestmentQuoteAndValuation;
  depotId?: number;
}

export interface PageableInvestmentV2List {
  investments: InvestmentV2[];
  paging?: PagingInfo;
}

export interface InvestmentV1Quote {
  last?: number;
  changePercentAbs?: number;
}

export interface InvestmentV1 {
  id: number;
  name: string;
  isin?: string;
  type: string;
  currency: string;
  numberOfLots?: number;
  quote?: InvestmentV1Quote;
  currentMarketValue?: number;
  returnOnInvestmentInPercent?: number;
}

export interface PageableInvestmentList {
  investments: InvestmentV1[];
  paging?: PagingInfo;
}

export interface TwrorAndCashFlowResult {
  date: string;
  twror: number;
  currentMarketValue?: number;
  cashFlow?: number;
}

export interface PortfolioPerformanceResult {
  twrorResults?: TwrorAndCashFlowResult[];
}

export interface PortfolioPerformanceResultList {
  portfolioPerformanceResults: PortfolioPerformanceResult[];
}

export interface BookingInvestment {
  id: number;
  name: string;
  isin?: string;
  currency?: string;
}

export interface Booking {
  id: number;
  type: string;
  amount?: number;
  numberOfLots?: number;
  valueDate?: string;
  securityPrice?: number;
  taxAmount?: number;
  commission?: number;
  investment?: BookingInvestment;
}

export interface PageableBookingList {
  bookings: Booking[];
  paging?: PagingInfo;
}

export interface Transaction {
  id: number;
  accountId?: number;
  type: string;
  amount?: number;
  valueDate?: string;
  currency?: string;
  counterpartName?: string;
  purpose?: string;
  isRegular?: boolean;
  paymentInterval?: number;
  averageRegularAmount?: number;
}

export interface PageableTransactionList {
  transactions: Transaction[];
  paging?: PagingInfo;
}

export interface ExtendedDateValuePair {
  date: string;
  value: number;
  isOutlier?: boolean;
}

export interface ExtendedDateValuePairList {
  mean: number;
  curatedMean: number;
  extendedDateValuePairs: ExtendedDateValuePair[];
}

export interface IncomeAndSpendingHistory {
  averageRegularIncome?: ExtendedDateValuePairList;
  averageNonRegularIncome?: ExtendedDateValuePairList;
  averageRegularExpenses?: ExtendedDateValuePairList;
  averageNonRegularExpenses?: ExtendedDateValuePairList;
}
