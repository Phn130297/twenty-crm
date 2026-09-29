// Shared types for Twenty CRM Custom Modules

export interface TwentyContact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  createdAt: string;
}

export interface TwentyDeal {
  id: string;
  name: string;
  amount: number;
  stage: string;
  contactId?: string;
  createdAt: string;
}

export interface TwentyTag {
  id: string;
  name: string;
  color: string;
  entityType: 'contact' | 'deal' | 'company';
  entityId: string;
  createdAt: string;
}

export interface LandingPage {
  id: string;
  name: string;
  slug: string;
  title: string;
  content: string;
  presetId?: string;
  published: boolean;
  url?: string;
  createdAt: string;
}

export interface EmailCampaign {
  id: string;
  name: string;
  subject: string;
  status: 'draft' | 'sending' | 'sent';
  sentCount: number;
  openCount: number;
  clickCount: number;
  createdAt: string;
}

export interface PaymentInvoice {
  id: string;
  orderId: string;
  amount: number;
  method: 'cash' | 'transfer' | 'card' | 'momo';
  status: 'pending' | 'paid' | 'failed';
  vietqrUrl?: string;
  sepayTransaction?: SepayTransaction;
  createdAt: string;
}

export interface SepayTransaction {
  id: string;
  amount: number;
  content: string;
  code: string;
  status: 'RECEIVED' | 'MATCHED' | 'ERROR';
  transactionDate: string;
}

export interface VinPetiSyncRecord {
  id: string;
  twentyId: string;
  vinpetiId: number;
  entityType: 'contact' | 'order' | 'product';
  lastSyncedAt: string;
  status: 'synced' | 'pending' | 'error';
}

export interface DashboardMetrics {
  totalRevenue: number;
  totalDeals: number;
  totalContacts: number;
  conversionRate: number;
  averageOrderValue: number;
  periodStart: string;
  periodEnd: string;
}
