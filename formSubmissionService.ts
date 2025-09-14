import { supabase } from '../lib/supabase';

export interface FormField {
  id: string;
  label: string;
  type: 'text' | 'email' | 'phone';
  required: boolean;
  value: string;
}

export interface AdditionalQuestion {
  id: string;
  question: string;
  type: 'text' | 'select' | 'boolean';
  options?: string[];
  required: boolean;
}

export interface CallSession {
  sessionId: string;
  agentId: string;
  clientPhone: string;
  collectedData: Record<string, any>;
  currentStep: 'greeting' | 'collecting' | 'confirming' | 'booking' | 'complete';
  interruptionCount: number;
}

export interface ServiceResponse<T> {
  data?: T;
  error?: string;
}

class FormSubmissionService {
  private readonly baseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL + '/functions/v1';
  private readonly retryDelay = 1000;
  private readonly maxRetries = 3;

  private async makeRequest<T>(
    endpoint: string, 
    data: any, 
    retryCount = 0
  ): Promise<ServiceResponse<T>> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        return { error: 'Authentication required' };
      }

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      return { data: result };

    } catch (error) {
      if (retryCount < this.maxRetries) {
        await new Promise(resolve => setTimeout(resolve, this.retryDelay * (retryCount + 1)));
        return this.makeRequest<T>(endpoint, data, retryCount + 1);
      }
      
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async processPayment(payload: {
    fields: FormField[];
    agentType: string;
  }): Promise<ServiceResponse<{
    agentId: string;
    formLink: string;
    webhookLink?: string;
  }>> {
    return this.makeRequest('/form-submission-payment', {
      fields: payload.fields,
      agentType: payload.agentType,
      timestamp: new Date().toISOString(),
    });
  }

  async deployAgent(payload: {
    agentId: string;
    coreFields: FormField[];
    additionalQuestions: AdditionalQuestion[];
    formLink: string;
    webhookLink?: string;
  }): Promise<ServiceResponse<{ success: boolean }>> {
    return this.makeRequest('/deploy-form-agent', {
      ...payload,
      aiInstructions: this.generateAIInstructions(payload.coreFields, payload.additionalQuestions),
      timestamp: new Date().toISOString(),
    });
  }

  async handleIncomingCall(payload: {
    agentId: string;
    clientPhone: string;
    sessionId?: string;
  }): Promise<ServiceResponse<CallSession>> {
    return this.makeRequest('/handle-call', {
      ...payload,
      callType: 'form_submission',
      timestamp: new Date().toISOString(),
    });
  }

  async processCallMessage(payload: {
    sessionId: string;
    message: string;
    isInterruption?: boolean;
    audioLevel?: number;
  }): Promise<ServiceResponse<{
    response: string;
    nextStep: string;
    shouldCollectMore: boolean;
    bookingAvailable: boolean;
  }>> {
    return this.makeRequest('/process-call-message', {
      ...payload,
      timestamp: new Date().toISOString(),
    });
  }

  async confirmCollectedData(payload: {
    sessionId: string;
    collectedData: Record<string, any>;
  }): Promise<ServiceResponse<{
    confirmationMessage: string;
    isAccurate: boolean;
  }>> {
    return this.makeRequest('/confirm-data', {
      ...payload,
      timestamp: new Date().toISOString(),
    });
  }

  async bookAppointment(payload: {
    sessionId: string;
    preferredDate?: string;
    preferredTime?: string;
  }): Promise<ServiceResponse<{
    bookingConfirmed: boolean;
    appointmentDetails?: {
      date: string;
      time: string;
      meetingLink?: string;
    };
    message: string;
  }>> {
    return this.makeRequest('/book-appointment', {
      ...payload,
      timestamp: new Date().toISOString(),
    });
  }

  private generateAIInstructions(
    coreFields: FormField[], 
    additionalQuestions: AdditionalQuestion[]
  ): string {
    const fieldDescriptions = coreFields.map(f => `${f.label} (${f.type})`).join(', ');
    const additionalQs = additionalQuestions.map(q => q.question).join('; ');

    return `
You are a professional call agent collecting client information. Follow these guidelines:

BEHAVIOR:
- Sound human and conversational
- Ask ONE question at a time
- Use natural fillers: "umm", "let me see", "gotcha", "that makes sense"
- Handle interruptions gracefully: pause, acknowledge, then continue
- Never reveal you're AI unless directly asked

COLLECTION PROCESS:
1. Collect: ${fieldDescriptions}
2. Ask additional questions: ${additionalQs || 'None configured'}
3. Confirm all information accuracy
4. Offer appointment booking

GUARDRAILS:
- Only collect the specified information
- Don't speculate or provide business advice
- If unsure, ask for clarification
- Keep responses under 30 words
- Stay professional but friendly

INTERRUPTION HANDLING:
- If client interrupts, lower your voice and pause
- Acknowledge their input: "Oh, I understand" or "That's helpful"
- Return to your question, rephrased differently
- Track interruption context for natural flow
    `.trim();
  }
}

export const formSubmissionService = new FormSubmissionService();
