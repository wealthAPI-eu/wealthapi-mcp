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

export interface Region {
  id: number;
  name?: string;
  regionType?: string;
  parentId?: number;
}

export interface Industry {
  id: number;
  name?: string;
  industryType?: string;
  parentId?: number;
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
  region?: Region;
  industry?: Industry;
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

export interface InvestmentReference {
  id: number;
  name: string;
  standardisedName?: string;
  isin?: string;
  wkn?: string;
  type?: string;
  currency?: string;
  numberOfLots?: number;
  tickerSymbol?: string;
  quoteProvider?: string;
}

export interface DividendHistoryTreeNode {
  year: number;
  calendarMonth?: number;
  paymentDate?: string;
  grossAmount: number;
  netAmount: number;
  taxAndCommission: number;
  isPrediction: boolean;
  children?: Record<string, DividendHistoryTreeNode>;
  investmentIds?: number[];
}

export interface DividendHistoryTree {
  nodesByYear?: Record<string, DividendHistoryTreeNode>;
  investmentReferenceById?: Record<string, InvestmentReference>;
}

export interface DividendCalendarRecord {
  investmentReference: InvestmentReference;
  currency: string;
  grossDividend: number;
  netDividend: number;
  numberOfLots: number;
  numberOfPaymentsPerYear?: number;
  paymentDate: string;
  exDate?: string;
  monthOfPaymentGregorian?: number;
  isPrediction: boolean;
  currentGrossYieldPerYear?: number;
  currentNetYieldPerYear?: number;
}

export interface DividendCalendarRecordList {
  dividendCalendarRecords?: DividendCalendarRecord[];
}

export interface CagrResult {
  initialYear?: number;
  finalYear?: number;
  cagr: number;
  years: number;
}

export interface DividendYield {
  year: number;
  portfolioValue: number;
  purchaseValue: number;
  totalNetDividend: number;
  totalGrossDividend: number;
  netYield: number;
  netYieldOnInvestedCapital: number;
  grossYield: number;
  grossYieldOnInvestedCapital: number;
  currency?: string;
}

export interface DividendYieldList {
  cagrResult?: CagrResult;
  dividendYields?: DividendYield[];
}

export interface RiskYield {
  annualizedStandardDeviation?: number;
  annualizedRiskClass?: number;
  annualizedReturn?: number;
  annualizedReturnClass?: number;
}

export interface RiskYieldWithInvestment {
  investmentReference: InvestmentReference;
  annualizedStandardDeviation?: number;
  annualizedRiskClass?: number;
  annualizedReturn?: number;
  annualizedReturnClass?: number;
}

export interface BatchRiskYieldMetrics {
  riskYieldMetrics?: RiskYieldWithInvestment[];
}

export interface RealizedGainByYear {
  year: number;
  totalGrossGain: number;
  totalNetGain: number;
  grossTradingGain: number;
  netTradingGain: number;
  grossInterestGain: number;
  netInterestGain: number;
  grossDividendGain: number;
  netDividendGain: number;
  grossOtherGain: number;
  netOtherGain: number;
  taxRefund: number;
}

export interface RealizedGainByYearList {
  realizedGainsByYear?: RealizedGainByYear[];
}

export interface StockIndex {
  id: number;
  name?: string;
  isin?: string;
}

export interface SecurityInfo {
  id: number;
  isin?: string;
  wkn?: string;
  currency?: string;
  name?: string;
  country?: Region;
  sector?: Industry;
  lastBalanceUpdate?: string;
  stockIndexes?: StockIndex[];
}

export interface FundamentalStatistic {
  date?: string;
  fScore?: number;
  priceToBook?: number;
  priceToCashflow?: number;
  priceToFreeCashflow?: number;
  priceToSales?: number;
  priceToEarnings?: number;
}

export interface StatisticList {
  security?: SecurityInfo;
  statistics?: FundamentalStatistic[];
}

export interface QuoteV2 {
  id: string;
  tickerSymbol: string;
  currency: string;
  priceUnit: string;
  stockExchangeName?: string;
  last: number;
  lastDateTime: string;
  changeAbs: number;
  changePercent: number;
}

export interface QuoteList {
  quotes?: QuoteV2[];
}

export interface SymbolV2 {
  id: string;
  isin?: string;
  wkn?: string;
  name: string;
  regionName?: string;
  sectorName?: string;
  type: string;
  quoteProvider: string;
}

export interface SymbolListV2 {
  symbols?: SymbolV2[];
}

export interface MandatorReference {
  id: number;
  publicId?: string;
}

export interface User {
  id: number;
  email?: string;
  isEmailConfirmed?: boolean;
  name?: string;
  userCreatedAt?: string;
  twoFactorAuthEnabled?: boolean;
  mandatorReference?: MandatorReference;
  thirdPartyAccounts?: string[];
}
