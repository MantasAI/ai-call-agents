/**
 * Form Submission Service
 * Handles form submission to Supabase Edge Functions and payment processing
 * Integrates with Claude AI Call Agent system
 */

interface AdditionalQuestion {
  id: string;
  question: string;
  required: boolean;
}

interface FormSubmission {
  name: string;
  email: string;
  phone: string;
  additionalQuestions: AdditionalQuestion[];
  additionalAnswers: Record<string, string>;
  timestamp: string;
}

interface SubmissionResponse {
  success: boolean;
  apiNumber?: string;
  error?: string;
}

interface PaymentData {
  amount: number;
  description: string;
}

interface PaymentResponse {
  success: boolean;
  transactionId?: string;
  error?: string;
}

/**
 * Service configuration
 */
const SERVICE_CONFIG = {
  // Supabase Edge Function endpoints
  FORM_SUBMISSION_ENDPOINT: '/api/form-submission/submit',
  PAYMENT_ENDPOINT: '/api/payments/process',
  
  // Retry configuration
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000, // 1 second
  
  // API timeout
  REQUEST_TIMEOUT: 30000, // 30 seconds
};

/**
 * Utility function to generate unique API number for Claude AI Call Agent
 */
const generateApiNumber = (): string => {
  const prefix = 'CA'; // Claude Agent
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
};

/**
 * Utility function to implement retry logic with exponential backoff
 */
const retryWithBackoff = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = SERVICE_CONFIG.MAX_RETRIES,
  delay: number = SERVICE_CONFIG.RETRY_DELAY
): Promise<T> => {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxRetries) {
        throw lastError;
      }

      // Exponential backoff
      const backoffDelay = delay * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
    }
  }

  throw lastError!;
};

/**
 * Utility function to make HTTP requests with timeout
 */
const makeRequest = async <T>(
  url: string,
  options: RequestInit,
  timeout: number = SERVICE_CONFIG.REQUEST_TIMEOUT
): Promise<T> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
};

/**
 * Form Submission Service
 * Main service object with methods for form submission and payment processing
 */
export const formSubmissionService = {
  /**
   * Submit form data to Supabase Edge Function
   * Creates Claude AI Call Agent configuration and returns API number
   */
  async submitForm(formData: FormSubmission): Promise<SubmissionResponse> {
    try {
      // Generate unique API number for the Claude AI Call Agent
      const apiNumber = generateApiNumber();

      // Prepare submission payload with Claude AI integration data
      const submissionPayload = {
        ...formData,
        apiNumber,
        claudeAgentConfig: {
          // Claude AI Call Agent configuration
          conversationMission: {
            objective: 'Prequalify client and book appointment',
            requiredFields: ['name', 'email', 'phone'],
            additionalQuestions: formData.additionalQuestions.map(q => ({
              id: q.id,
              question: q.question,
              required: q.required
            })),
            conversationFlow: [
              'greet_professionally',
              'collect_required_fields',
              'ask_additional_questions',
              'confirm_answers',
              'schedule_appointment',
              'close_politely'
            ]
          },
          guardrails: {
            neverRevealInternalStructure: true,
            noSpeculation: true,
            respondOnlyFromBusinessContext: true,
            maintainProfessionalTone: true
          },
          integrations: {
            appointmentBooking: true,
            emailNotifications: true,
            crmIntegration: true
          }
        }
      };

      // Submit with retry logic
      const response = await retryWithBackoff(async () => {
        return await makeRequest<SubmissionResponse>(
          SERVICE_CONFIG.FORM_SUBMISSION_ENDPOINT,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${await this.getAuthToken()}`,
            },
            body: JSON.stringify(submissionPayload),
          }
        );
      });

      if (response.success) {
        // Store API configuration locally for quick access
        await this.storeApiConfiguration(apiNumber, formData);
        
        return {
          success: true,
          apiNumber: response.apiNumber || apiNumber
        };
      } else {
        return {
          success: false,
          error: response.error || 'Form submission failed'
        };
      }

    } catch (error) {
      console.error('Form submission error:', error);
      
      // Handle specific error types
      if (error instanceof TypeError && error.message.includes('fetch')) {
        return {
          success: false,
          error: 'Network error. Please check your internet connection and try again.'
        };
      } else if (error instanceof Error && error.name === 'AbortError') {
        return {
          success: false,
          error: 'Request timed out. Please try again.'
        };
      } else {
        return {
          success: false,
          error: 'An unexpected error occurred. Please try again.'
        };
      }
    }
  },

  /**
   * Handle payment processing through integrated payment gateway
   * Supports multiple payment methods (Stripe, Apple Pay, Google Pay, etc.)
   */
  async handlePayment(paymentData: PaymentData): Promise<PaymentResponse> {
    try {
      const paymentPayload = {
        ...paymentData,
        currency: 'USD',
        paymentMethods: ['card', 'apple_pay', 'google_pay'],
        metadata: {
          service: 'ai_call_agent_premium',
          features: ['unlimited_questions', 'advanced_analytics', 'priority_support']
        }
      };

      // Process payment with retry logic
      const response = await retryWithBackoff(async () => {
        return await makeRequest<PaymentResponse>(
          SERVICE_CONFIG.PAYMENT_ENDPOINT,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${await this.getAuthToken()}`,
            },
            body: JSON.stringify(paymentPayload),
          }
        );
      });

      if (response.success) {
        // Store payment confirmation
        await this.storePaymentConfirmation(response.transactionId!);
        
        return {
          success: true,
          transactionId: response.transactionId
        };
      } else {
        return {
          success: false,
          error: response.error || 'Payment processing failed'
        };
      }

    } catch (error) {
      console.error('Payment processing error:', error);
      
      return {
        success: false,
        error: 'Payment could not be processed. Please try again.'
      };
    }
  },

  /**
   * Get authentication token for API requests
   * Integrates with Supabase Auth
   */
  async getAuthToken(): Promise<string> {
    try {
      // In a real implementation, this would get the token from Supabase Auth
      // For now, we'll simulate token retrieval
      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient(
        process.env.EXPO_PUBLIC_SUPABASE_URL!,
        process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!
      );

      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('No valid authentication session');
      }

      return session.access_token;
    } catch (error) {
      console.error('Auth token retrieval error:', error);
      throw new Error('Authentication failed');
    }
  },

  /**
   * Store API configuration locally for offline access and quick retrieval
   */
  async storeApiConfiguration(apiNumber: string, formData: FormSubmission): Promise<void> {
    try {
      // In a real React Native app, you would use AsyncStorage or secure storage
      // For now, we'll simulate local storage
      const configData = {
        apiNumber,
        formData,
        timestamp: new Date().toISOString(),
        status: 'active'
      };

      // Simulate storing configuration
      console.log('Storing API configuration:', configData);
      
      // In a real implementation:
      // await AsyncStorage.setItem(`api_config_${apiNumber}`, JSON.stringify(configData));
      
    } catch (error) {
      console.error('Failed to store API configuration:', error);
      // Non-critical error, don't throw
    }
  },

  /**
   * Store payment confirmation for record keeping
   */
  async storePaymentConfirmation(transactionId: string): Promise<void> {
    try {
      const paymentRecord = {
        transactionId,
        amount: 97,
        currency: 'USD',
        status: 'completed',
        timestamp: new Date().toISOString()
      };

      // Simulate storing payment confirmation
      console.log('Storing payment confirmation:', paymentRecord);
      
      // In a real implementation:
      // await AsyncStorage.setItem(`payment_${transactionId}`, JSON.stringify(paymentRecord));
      
    } catch (error) {
      console.error('Failed to store payment confirmation:', error);
      // Non-critical error, don't throw
    }
  },

  /**
   * Validate form data before submission
   */
  validateFormData(formData: FormSubmission): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate required fields
    if (!formData.name?.trim()) {
      errors.push('Name is required');
    }

    if (!formData.email?.trim()) {
      errors.push('Email is required');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.push('Invalid email format');
    }

    if (!formData.phone?.trim()) {
      errors.push('Phone number is required');
    } else if (!/^[\+]?[1-9][\d]{3,14}$/.test(formData.phone.replace(/[\s\-\(\)]/g, ''))) {
      errors.push('Invalid phone number format');
    }

    // Validate additional questions
    if (!formData.additionalQuestions || formData.additionalQuestions.length < 3) {
      errors.push('At least 3 additional questions are required');
    }

    // Check for empty questions
    const emptyQuestions = formData.additionalQuestions.filter(q => !q.question?.trim());
    if (emptyQuestions.length > 0) {
      errors.push('All additional questions must have text');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
};

/**
 * Export types for external use
 */
export type {
  FormSubmission,
  SubmissionResponse,
  PaymentData,
  PaymentResponse,
  AdditionalQuestion
};
