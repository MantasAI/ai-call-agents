import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';

// TypeScript Types
export type LeadStatus = 'new' | 'contacted' | 'missed' | 'unreachable' | 'converted';
export type CallOutcome = 'answered' | 'no_answer' | 'busy' | 'failed';
export type LeadPriority = 'low' | 'medium' | 'high';
export type ApiProvider = 'twilio' | 'vonage' | 'plivo';

export interface CallHistory {
  id: string;
  timestamp: Date;
  duration: number;
  outcome: CallOutcome;
  notes?: string;
  apiNumber: string;
  apiProvider: ApiProvider;
  callId: string;
  recordingUrl?: string;
  aiInsights?: string;
}

export interface LeadData {
  id: string;
  name: string;
  phone: string;
  email?: string;
  status: LeadStatus;
  priority: LeadPriority;
  lastContact?: Date;
  notes?: string;
  callHistory?: CallHistory[];
  retryCount: number;
  nextRetryAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  tags?: string[];
  source?: string;
  assignedApiNumber?: string;
}

export interface CallRequest {
  leadId: string;
  pitch: string;
  priority: LeadPriority;
  previousContacts: number;
  customMessage?: string;
  scheduledAt?: Date;
}

export interface CallResponse {
  success: boolean;
  callId?: string;
  apiNumber?: string;
  apiProvider?: ApiProvider;
  error?: string;
  estimatedDuration?: number;
  retryAfter?: number;
}

export interface BatchImportData {
  fileName: string;
  fileUri: string;
  fileType: string;
  totalRecords: number;
  mapping?: Record<string, string>;
}

export interface BatchImportResponse {
  success: boolean;
  imported: number;
  errors: number;
  errorDetails?: string[];
  error?: string;
}

export interface RetryRules {
  maxRetries: number;
  initialDelay: number; // minutes
  backoffMultiplier: number;
  maxDelay: number; // minutes
}

export interface ApiNumberPool {
  id: string;
  number: string;
  provider: ApiProvider;
  isActive: boolean;
  currentLoad: number;
  maxConcurrent: number;
  region: string;
  lastUsed?: Date;
}

// Configuration
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
const EDGE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1`;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Retry Rules Configuration
const RETRY_RULES: RetryRules = {
  maxRetries: 3,
  initialDelay: 30, // 30 minutes
  backoffMultiplier: 2,
  maxDelay: 1440, // 24 hours
};

class ReEngagementService {
  private apiNumberPool: ApiNumberPool[] = [];
  private currentUser: string | null = null;

  constructor() {
    this.initializeService();
  }

  private async initializeService(): Promise<void> {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      this.currentUser = user?.id || null;

      // Load API number pool
      await this.loadApiNumberPool();
    } catch (error) {
      console.error('Failed to initialize ReEngagementService:', error);
    }
  }

  private async loadApiNumberPool(): Promise<void> {
    try {
      const response = await this.callEdgeFunction('get-api-numbers', {});
      if (response.success && response.data) {
        this.apiNumberPool = response.data;
      }
    } catch (error) {
      console.error('Failed to load API number pool:', error);
    }
  }

  private async callEdgeFunction(
    functionName: string, 
    payload: any
  ): Promise<any> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(`${EDGE_FUNCTION_URL}/${functionName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Edge function error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Edge function ${functionName} failed:`, error);
      throw error;
    }
  }

  private getAvailableApiNumber(priority: LeadPriority): ApiNumberPool | null {
    // Filter active numbers with available capacity
    const availableNumbers = this.apiNumberPool.filter(
      number => number.isActive && number.currentLoad < number.maxConcurrent
    );

    if (availableNumbers.length === 0) {
      return null;
    }

    // Prioritize by load balancing and priority
    availableNumbers.sort((a, b) => {
      // For high priority leads, prefer less loaded numbers
      if (priority === 'high') {
        return a.currentLoad - b.currentLoad;
      }
      // For low priority, use most loaded numbers first
      return b.currentLoad - a.currentLoad;
    });

    return availableNumbers[0];
  }

  private calculateNextRetry(retryCount: number): Date {
    const delayMinutes = Math.min(
      RETRY_RULES.initialDelay * Math.pow(RETRY_RULES.backoffMultiplier, retryCount),
      RETRY_RULES.maxDelay
    );
    
    return new Date(Date.now() + delayMinutes * 60 * 1000);
  }

  // Public Methods

  async getLeads(filters?: {
    status?: LeadStatus;
    priority?: LeadPriority;
    search?: string;
  }): Promise<LeadData[]> {
    try {
      let query = supabase
        .from('re_engagement_leads')
        .select(`
          *,
          call_history (
            id,
            timestamp,
            duration,
            outcome,
            notes,
            api_number,
            api_provider,
            call_id,
            recording_url,
            ai_insights
          )
        `)
        .eq('user_id', this.currentUser)
        .order('updated_at', { ascending: false });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.priority) {
        query = query.eq('priority', filters.priority);
      }
      if (filters?.search) {
        query = query.or(
          `name.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`
        );
      }

      const { data, error } = await query;

      if (error) throw error;

      return (data || []).map(this.transformLeadData);
    } catch (error) {
      console.error('Failed to fetch leads:', error);
      throw error;
    }
  }

  async addLead(leadData: Omit<LeadData, 'id' | 'status' | 'createdAt' | 'updatedAt'>): Promise<LeadData> {
    try {
      const newLead = {
        ...leadData,
        user_id: this.currentUser,
        status: 'new' as LeadStatus,
        retry_count: leadData.retryCount || 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('re_engagement_leads')
        .insert([newLead])
        .select()
        .single();

      if (error) throw error;

      return this.transformLeadData(data);
    } catch (error) {
      console.error('Failed to add lead:', error);
      throw error;
    }
  }

  async updateLead(leadId: string, updates: Partial<LeadData>): Promise<void> {
    try {
      const updateData = {
        ...updates,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('re_engagement_leads')
        .update(updateData)
        .eq('id', leadId)
        .eq('user_id', this.currentUser);

      if (error) throw error;
    } catch (error) {
      console.error('Failed to update lead:', error);
      throw error;
    }
  }

  async initiateCall(leadId: string, options: Omit<CallRequest, 'leadId'>): Promise<CallResponse> {
    try {
      // Get lead data
      const leads = await this.getLeads();
      const lead = leads.find(l => l.id === leadId);
      
      if (!lead) {
        return { success: false, error: 'Lead not found' };
      }

      // Check retry limits
      if (lead.retryCount >= RETRY_RULES.maxRetries) {
        return { success: false, error: 'Maximum retry attempts exceeded' };
      }

      // Get available API number
      const apiNumber = this.getAvailableApiNumber(lead.priority);
      if (!apiNumber) {
        return { success: false, error: 'No available API numbers' };
      }

      // Prepare call request for AI
      const callRequest: CallRequest = {
        leadId,
        ...options,
      };

      // Call Claude AI via Edge Function for call strategy
      const aiResponse = await this.callEdgeFunction('ai-call-strategy', {
        lead,
        callRequest,
        apiNumber: apiNumber.number,
        callHistory: lead.callHistory || [],
      });

      if (!aiResponse.success) {
        return { success: false, error: aiResponse.error };
      }

      // Initiate call via Edge Function
      const callResponse = await this.callEdgeFunction('initiate-call', {
        leadId,
        phone: lead.phone,
        apiNumber: apiNumber.number,
        apiProvider: apiNumber.provider,
        strategy: aiResponse.strategy,
        pitch: options.pitch,
        customMessage: options.customMessage,
      });

      if (callResponse.success) {
        // Update lead status
        await this.updateLead(leadId, {
          status: 'contacted',
          lastContact: new Date(),
          assignedApiNumber: apiNumber.number,
        });

        // Log self-learning data
        await this.logSelfLearningData(leadId, {
          action: 'call_initiated',
          strategy: aiResponse.strategy,
          apiNumber: apiNumber.number,
          timestamp: new Date(),
        });
      }

      return {
        success: callResponse.success,
        callId: callResponse.callId,
        apiNumber: apiNumber.number,
        apiProvider: apiNumber.provider,
        error: callResponse.error,
        estimatedDuration: callResponse.estimatedDuration,
      };
    } catch (error) {
      console.error('Failed to initiate call:', error);
      return { success: false, error: 'Call initiation failed' };
    }
  }

  async retryCall(leadId: string): Promise<CallResponse> {
    try {
      const leads = await this.getLeads();
      const lead = leads.find(l => l.id === leadId);
      
      if (!lead) {
        return { success: false, error: 'Lead not found' };
      }

      if (lead.retryCount >= RETRY_RULES.maxRetries) {
        return { success: false, error: 'Maximum retry attempts exceeded' };
      }

      // Calculate next retry time
      const nextRetryAt = this.calculateNextRetry(lead.retryCount);

      // Update retry count and schedule
      await this.updateLead(leadId, {
        retryCount: lead.retryCount + 1,
        nextRetryAt,
        status: 'missed',
      });

      // Schedule retry call via Edge Function
      const retryResponse = await this.callEdgeFunction('schedule-retry-call', {
        leadId,
        retryAt: nextRetryAt.toISOString(),
        retryCount: lead.retryCount + 1,
      });

      return {
        success: retryResponse.success,
        retryAfter: Math.floor((nextRetryAt.getTime() - Date.now()) / (1000 * 60)),
        error: retryResponse.error,
      };
    } catch (error) {
      console.error('Failed to schedule retry:', error);
      return { success: false, error: 'Retry scheduling failed' };
    }
  }

  async batchImportLeads(
    importData: BatchImportData,
    progressCallback?: (progress: number) => void
  ): Promise<BatchImportResponse> {
    try {
      // Read file content
      const fileContent = await RNFS.readFile(importData.fileUri, 'utf8');
      
      // Parse CSV/Excel via Edge Function
      const parseResponse = await this.callEdgeFunction('parse-import-file', {
        content: fileContent,
        fileType: importData.fileType,
        mapping: importData.mapping,
      });

      if (!parseResponse.success) {
        return { success: false, imported: 0, errors: 1, error: parseResponse.error };
      }

      const leads = parseResponse.data;
      let imported = 0;
      let errors = 0;
      const errorDetails: string[] = [];

      // Process leads in batches
      const batchSize = 50;
      for (let i = 0; i < leads.length; i += batchSize) {
        const batch = leads.slice(i, i + batchSize);
        
        try {
          const batchData = batch.map((lead: any) => ({
            ...lead,
            user_id: this.currentUser,
            status: 'new',
            retry_count: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }));

          const { data, error } = await supabase
            .from('re_engagement_leads')
            .insert(batchData)
            .select('id');

          if (error) {
            errors += batch.length;
            errorDetails.push(`Batch ${Math.floor(i / batchSize) + 1}: ${error.message}`);
          } else {
            imported += data?.length || 0;
          }
        } catch (error) {
          errors += batch.length;
          errorDetails.push(`Batch ${Math.floor(i / batchSize) + 1}: ${error}`);
        }

        // Update progress
        const progress = Math.floor(((i + batchSize) / leads.length) * 100);
        progressCallback?.(Math.min(progress, 100));
      }

      return {
        success: imported > 0,
        imported,
        errors,
        errorDetails: errorDetails.length > 0 ? errorDetails : undefined,
      };
    } catch (error) {
      console.error('Batch import failed:', error);
      return {
        success: false,
        imported: 0,
        errors: 1,
        error: 'Import processing failed',
      };
    }
  }

  async getCallHistory(leadId: string): Promise<CallHistory[]> {
    try {
      const { data, error } = await supabase
        .from('call_history')
        .select('*')
        .eq('lead_id', leadId)
        .order('timestamp', { ascending: false });

      if (error) throw error;

      return (data || []).map(this.transformCallHistory);
    } catch (error) {
      console.error('Failed to fetch call history:', error);
      throw error;
    }
  }

  async updateCallOutcome(
    callId: string,
    outcome: CallOutcome,
    duration: number,
    notes?: string,
    recordingUrl?: string
  ): Promise<void> {
    try {
      // Update call history
      const { error: callError } = await supabase
        .from('call_history')
        .update({
          outcome,
          duration,
          notes,
          recording_url: recordingUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('call_id', callId);

      if (callError) throw callError;

      // Get the lead ID for this call
      const { data: callData } = await supabase
        .from('call_history')
        .select('lead_id')
        .eq('call_id', callId)
        .single();

      if (callData) {
        // Update lead status based on outcome
        let newStatus: LeadStatus;
        switch (outcome) {
          case 'answered':
            newStatus = 'contacted';
            break;
          case 'no_answer':
          case 'busy':
            newStatus = 'missed';
            break;
          case 'failed':
            newStatus = 'unreachable';
            break;
          default:
            newStatus = 'missed';
        }

        await this.updateLead(callData.lead_id, {
          status: newStatus,
          lastContact: new Date(),
        });

        // Log self-learning data
        await this.logSelfLearningData(callData.lead_id, {
          action: 'call_completed',
          outcome,
          duration,
          notes,
          timestamp: new Date(),
        });

        // Get AI insights via Edge Function
        const insightsResponse = await this.callEdgeFunction('ai-call-insights', {
          leadId: callData.lead_id,
          callId,
          outcome,
          duration,
          notes,
        });

        if (insightsResponse.success && insightsResponse.insights) {
          // Update call with AI insights
          await supabase
            .from('call_history')
            .update({ ai_insights: insightsResponse.insights })
            .eq('call_id', callId);
        }
      }
    } catch (error) {
      console.error('Failed to update call outcome:', error);
      throw error;
    }
  }

  private async logSelfLearningData(leadId: string, data: any): Promise<void> {
    try {
      await this.callEdgeFunction('log-self-learning', {
        leadId,
        userId: this.currentUser,
        data,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Failed to log self-learning data:', error);
      // Don't throw - this shouldn't break the main flow
    }
  }

  private transformLeadData(data: any): LeadData {
    return {
      id: data.id,
      name: data.name,
      phone: data.phone,
      email: data.email,
      status: data.status,
      priority: data.priority,
      lastContact: data.last_contact ? new Date(data.last_contact) : undefined,
      notes: data.notes,
      callHistory: data.call_history?.map(this.transformCallHistory) || [],
      retryCount: data.retry_count || 0,
      nextRetryAt: data.next_retry_at ? new Date(data.next_retry_at) : undefined,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      tags: data.tags,
      source: data.source,
      assignedApiNumber: data.assigned_api_number,
    };
  }

  private transformCallHistory(data: any): CallHistory {
    return {
      id: data.id,
      timestamp: new Date(data.timestamp),
      duration: data.duration,
      outcome: data.outcome,
      notes: data.notes,
      apiNumber: data.api_number,
      apiProvider: data.api_provider,
      callId: data.call_id,
      recordingUrl: data.recording_url,
      aiInsights: data.ai_insights,
    };
  }

  // Utility Methods
  async getStats(): Promise<{
    totalLeads: number;
    newLeads: number;
    contactedLeads: number;
    missedLeads: number;
    convertedLeads: number;
    unreachableLeads: number;
  }> {
    try {
      const leads = await this.getLeads();
      
      return {
        totalLeads: leads.length,
        newLeads: leads.filter(l => l.status === 'new').length,
        contactedLeads: leads.filter(l => l.status === 'contacted').length,
        missedLeads: leads.filter(l => l.status === 'missed').length,
        convertedLeads: leads.filter(l => l.status === 'converted').length,
        unreachableLeads: leads.filter(l => l.status === 'unreachable').length,
      };
    } catch (error) {
      console.error('Failed to get stats:', error);
      throw error;
    }
  }

  async validateApiNumber(number: string): Promise<boolean> {
    try {
      const response = await this.callEdgeFunction('validate-api-number', { number });
      return response.success && response.valid;
    } catch (error) {
      console.error('API number validation failed:', error);
      return false;
    }
  }

  async refreshApiNumberPool(): Promise<void> {
    await this.loadApiNumberPool();
  }
}

// Export singleton instance
export const reEngagementService = new ReEngagementService();
export default reEngagementService;
