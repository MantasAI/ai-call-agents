/**
 * Follow-Up Service
 * Handles follow-up call operations, appointment confirmations, and rescheduling
 * Integrates with Claude AI Call Agent for automated follow-up calls
 */

interface AppointmentDetails {
  id: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  appointmentDate: string;
  appointmentTime: string;
  location: string;
  status: 'scheduled' | 'confirmed' | 'rescheduled' | 'cancelled';
  apiNumber: string;
}

interface CallHistory {
  id: string;
  timestamp: string;
  type: 'initial_form' | 'follow_up';
  duration: string;
  status: 'completed' | 'failed' | 'no_answer';
  summary: string;
  questions: Array<{
    question: string;
    answer: string;
  }>;
}

interface FollowUpRequest {
  appointmentId: string;
  clientPhone: string;
  clientName: string;
  appointmentDateTime: string;
  previousCallHistory: CallHistory[];
  followUpTiming: number; // hours before appointment
}

interface FollowUpResponse {
  success: boolean;
  callId?: string;
  error?: string;
}

interface ConfirmationRequest {
  appointmentId: string;
  confirmedBy: 'manual' | 'ai_call';
  confirmationTime: string;
}

interface ConfirmationResponse {
  success: boolean;
  error?: string;
}

interface RescheduleRequest {
  appointmentId: string;
  rescheduleType: 'client_choice' | 'manual' | 'ai_suggested';
  clientPhone?: string;
  clientName?: string;
  newDateTime?: string;
}

interface RescheduleResponse {
  success: boolean;
  newAppointmentId?: string;
  error?: string;
}

/**
 * Service configuration
 */
const SERVICE_CONFIG = {
  // Supabase Edge Function endpoints
  FOLLOW_UP_ENDPOINT: '/api/follow-up/initiate',
  CONFIRMATION_ENDPOINT: '/api/appointments/confirm',
  RESCHEDULE_ENDPOINT: '/api/appointments/reschedule',
  APPOINTMENT_DETAILS_ENDPOINT: '/api/appointments/details',
  CALL_HISTORY_ENDPOINT: '/api/calls/history',
  
  // Retry configuration
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000, // 1 second
  
  // API timeout
  REQUEST_TIMEOUT: 30000, // 30 seconds
  
  // Follow-up configuration
  DEFAULT_FOLLOW_UP_HOURS: 2,
  MIN_FOLLOW_UP_HOURS: 1,
  MAX_FOLLOW_UP_HOURS: 24,
};

/**
 * Utility function to generate unique call ID for follow-up calls
 */
const generateCallId = (): string => {
  const prefix = 'FU'; // Follow-Up
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
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

      // Exponential backoff with jitter
      const backoffDelay = delay * Math.pow(2, attempt - 1) + Math.random() * 1000;
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
 * Follow-Up Service
 * Main service object with methods for follow-up operations
 */
export const followUpService = {
  /**
   * Send follow-up call to client using Claude AI Call Agent
   * Triggers Edge Function that initiates the Claude AI call
   */
  async sendFollowUp(request: FollowUpRequest): Promise<FollowUpResponse> {
    try {
      // Generate unique call ID for tracking
      const callId = generateCallId();

      // Prepare Claude AI Call Agent configuration
      const followUpPayload = {
        ...request,
        callId,
        claudeAgentConfig: {
          // Claude AI Follow-Up Call Agent mission
          conversationMission: {
            objective: 'Confirm client attendance for upcoming appointment',
            primaryGoals: [
              'reference_previous_conversation',
              'confirm_attendance',
              'offer_reschedule_if_needed'
            ],
            conversationContext: {
              clientName: request.clientName,
              appointmentDateTime: request.appointmentDateTime,
              previousCallSummary: this.extractCallSummary(request.previousCallHistory),
              followUpTiming: `${request.followUpTiming} hour(s) before appointment`
            }
          },
          
          // Guardrails for follow-up calls
          guardrails: {
            neverRevealInternalStructure: true,
            noSpeculation: true,
            stayOnTopic: true,
            onlyConfirmOrReschedule: true,
            referencePreviousConversation: true,
            maintainProfessionalTone: true
          },
          
          // Structured conversation flow
          conversationFlow: [
            {
              step: 'greet_and_reference',
              action: 'Greet client professionally and reference upcoming appointment',
              template: `Hello ${request.clientName}, this is a follow-up call about your appointment scheduled for ${request.appointmentDateTime}.`
            },
            {
              step: 'reference_previous_call',
              action: 'Briefly reference key points from previous conversation',
              context: 'previous_call_summary'
            },
            {
              step: 'confirm_attendance',
              action: 'Ask if client will attend the scheduled appointment',
              options: ['yes_confirm', 'no_reschedule', 'maybe_clarify']
            },
            {
              step: 'handle_response',
              action: 'Process client response and take appropriate action',
              branches: {
                confirm: 'confirm_appointment_and_close',
                reschedule: 'offer_reschedule_options',
                clarify: 'provide_appointment_details'
              }
            },
            {
              step: 'close_professionally',
              action: 'Thank client and end call politely'
            }
          ],
          
          // Integration settings
          integrations: {
            appointmentSystem: true,
            notificationService: true,
            callLogging: true,
            rescheduleWorkflow: true
          }
        }
      };

      // Send follow-up request with retry logic
      const response = await retryWithBackoff(async () => {
        return await makeRequest<FollowUpResponse>(
          SERVICE_CONFIG.FOLLOW_UP_ENDPOINT,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${await this.getAuthToken()}`,
            },
            body: JSON.stringify(followUpPayload),
          }
        );
      });

      if (response.success) {
        // Log follow-up initiation
        await this.logFollowUpInitiation(callId, request);
        
        return {
          success: true,
          callId: response.callId || callId
        };
      } else {
        return {
          success: false,
          error: response.error || 'Failed to confirm attendance'
        };
      }

    } catch (error) {
      console.error('Attendance confirmation error:', error);
      
      return {
        success: false,
        error: 'An unexpected error occurred while confirming attendance.'
      };
    }
  },

  /**
   * Reschedule appointment with various options
   * Can trigger AI-assisted rescheduling or manual rescheduling
   */
  async rescheduleAppointment(request: RescheduleRequest): Promise<RescheduleResponse> {
    try {
      const reschedulePayload = {
        ...request,
        rescheduleTimestamp: new Date().toISOString(),
        rescheduleReason: 'client_request',
        claudeAgentConfig: request.rescheduleType === 'client_choice' ? {
          // Claude AI Rescheduling Agent configuration
          conversationMission: {
            objective: 'Help client reschedule appointment to a convenient time',
            primaryGoals: [
              'understand_rescheduling_reason',
              'offer_available_time_slots',
              'confirm_new_appointment_time'
            ],
            availableTimeSlots: 'dynamic', // Fetched from calendar system
            rescheduleConstraints: {
              businessHours: '9:00 AM - 6:00 PM',
              excludeWeekends: false,
              advanceNotice: '24 hours minimum'
            }
          },
          
          guardrails: {
            neverRevealInternalStructure: true,
            onlyOfferAvailableSlots: true,
            confirmBeforeBooking: true,
            maintainProfessionalTone: true
          },
          
          conversationFlow: [
            {
              step: 'acknowledge_reschedule',
              action: 'Acknowledge rescheduling request professionally'
            },
            {
              step: 'understand_reason',
              action: 'Optionally ask for rescheduling reason (brief)'
            },
            {
              step: 'offer_time_slots',
              action: 'Present available appointment times'
            },
            {
              step: 'confirm_selection',
              action: 'Confirm new appointment details'
            },
            {
              step: 'finalize_booking',
              action: 'Complete rescheduling and provide confirmation'
            }
          ]
        } : undefined
      };

      // Process reschedule request with retry logic
      const response = await retryWithBackoff(async () => {
        return await makeRequest<RescheduleResponse>(
          SERVICE_CONFIG.RESCHEDULE_ENDPOINT,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${await this.getAuthToken()}`,
            },
            body: JSON.stringify(reschedulePayload),
          }
        );
      });

      if (response.success) {
        // Log rescheduling event
        await this.logAppointmentEvent(request.appointmentId, 'rescheduled', request.rescheduleType);
        
        return {
          success: true,
          newAppointmentId: response.newAppointmentId
        };
      } else {
        return {
          success: false,
          error: response.error || 'Failed to reschedule appointment'
        };
      }

    } catch (error) {
      console.error('Appointment rescheduling error:', error);
      
      return {
        success: false,
        error: 'An unexpected error occurred while rescheduling the appointment.'
      };
    }
  },

  /**
   * Get appointment details from database
   * Used to populate the follow-up screen
   */
  async getAppointmentDetails(appointmentId: string): Promise<AppointmentDetails> {
    try {
      const response = await retryWithBackoff(async () => {
        return await makeRequest<AppointmentDetails>(
          `${SERVICE_CONFIG.APPOINTMENT_DETAILS_ENDPOINT}/${appointmentId}`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${await this.getAuthToken()}`,
            },
          }
        );
      });

      return response;

    } catch (error) {
      console.error('Failed to load appointment details:', error);
      throw new Error('Unable to load appointment details');
    }
  },

  /**
   * Get call history for the appointment
   * Includes both initial form submission call and any follow-up calls
   */
  async getCallHistory(appointmentId: string): Promise<CallHistory[]> {
    try {
      const response = await retryWithBackoff(async () => {
        return await makeRequest<CallHistory[]>(
          `${SERVICE_CONFIG.CALL_HISTORY_ENDPOINT}/${appointmentId}`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${await this.getAuthToken()}`,
            },
          }
        );
      });

      return response;

    } catch (error) {
      console.error('Failed to load call history:', error);
      return []; // Return empty array if history can't be loaded
    }
  },

  /**
   * Get authentication token for API requests
   * Integrates with Supabase Auth
   */
  async getAuthToken(): Promise<string> {
    try {
      // In a real implementation, this would get the token from Supabase Auth
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
   * Extract summary from previous call history for context
   * Provides Claude AI with relevant context from previous conversations
   */
  extractCallSummary(callHistory: CallHistory[]): string {
    if (callHistory.length === 0) {
      return 'No previous call history available.';
    }

    const latestCall = callHistory[callHistory.length - 1];
    
    let summary = `Previous ${latestCall.type.replace('_', ' ')} call: ${latestCall.summary}`;
    
    // Add key information from questions/answers
    if (latestCall.questions.length > 0) {
      const keyInfo = latestCall.questions
        .slice(0, 3) // Limit to 3 most important questions
        .map(qa => `${qa.question}: ${qa.answer}`)
        .join('; ');
      
      summary += ` Key information: ${keyInfo}`;
    }

    return summary;
  },

  /**
   * Log follow-up call initiation for tracking and analytics
   */
  async logFollowUpInitiation(callId: string, request: FollowUpRequest): Promise<void> {
    try {
      const logData = {
        callId,
        appointmentId: request.appointmentId,
        clientPhone: request.clientPhone,
        initiationType: 'follow_up',
        initiatedAt: new Date().toISOString(),
        followUpTiming: request.followUpTiming,
        status: 'initiated'
      };

      // In a real implementation, this would log to your analytics/logging system
      console.log('Follow-up call initiated:', logData);
      
      // You could also store this in Supabase for tracking:
      // await supabase.from('call_logs').insert(logData);
      
    } catch (error) {
      console.error('Failed to log follow-up initiation:', error);
      // Non-critical error, don't throw
    }
  },

  /**
   * Log appointment events (confirmations, rescheduling, etc.)
   */
  async logAppointmentEvent(
    appointmentId: string, 
    eventType: 'confirmed' | 'rescheduled' | 'cancelled',
    triggeredBy: string
  ): Promise<void> {
    try {
      const eventData = {
        appointmentId,
        eventType,
        triggeredBy,
        timestamp: new Date().toISOString()
      };

      // In a real implementation, this would log to your database
      console.log('Appointment event logged:', eventData);
      
      // Store in Supabase:
      // await supabase.from('appointment_events').insert(eventData);
      
    } catch (error) {
      console.error('Failed to log appointment event:', error);
      // Non-critical error, don't throw
    }
  },

  /**
   * Validate follow-up timing configuration
   * Ensures follow-up timing is within acceptable bounds
   */
  validateFollowUpTiming(hours: number): { isValid: boolean; error?: string } {
    if (hours < SERVICE_CONFIG.MIN_FOLLOW_UP_HOURS) {
      return {
        isValid: false,
        error: `Follow-up timing must be at least ${SERVICE_CONFIG.MIN_FOLLOW_UP_HOURS} hour(s) before appointment`
      };
    }

    if (hours > SERVICE_CONFIG.MAX_FOLLOW_UP_HOURS) {
      return {
        isValid: false,
        error: `Follow-up timing cannot exceed ${SERVICE_CONFIG.MAX_FOLLOW_UP_HOURS} hours before appointment`
      };
    }

    return { isValid: true };
  },

  /**
   * Check if appointment is eligible for follow-up
   * Validates appointment status and timing
   */
  isEligibleForFollowUp(appointment: AppointmentDetails, followUpHours: number): boolean {
    // Check appointment status
    if (appointment.status === 'cancelled' || appointment.status === 'confirmed') {
      return false;
    }

    // Check timing - appointment should be in the future and within follow-up window
    const appointmentDateTime = new Date(`${appointment.appointmentDate} ${appointment.appointmentTime}`);
    const now = new Date();
    const hoursUntilAppointment = (appointmentDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    return hoursUntilAppointment > 0 && hoursUntilAppointment <= followUpHours;
  },

  /**
   * Get available time slots for rescheduling
   * Integrates with calendar system to fetch availability
   */
  async getAvailableTimeSlots(appointmentId: string): Promise<Array<{ date: string; time: string }>> {
    try {
      // In a real implementation, this would fetch from your calendar/scheduling system
      // For now, return mock data
      const mockSlots = [
        { date: '2024-03-15', time: '10:00 AM' },
        { date: '2024-03-15', time: '2:00 PM' },
        { date: '2024-03-16', time: '9:00 AM' },
        { date: '2024-03-16', time: '11:00 AM' },
        { date: '2024-03-17', time: '3:00 PM' }
      ];

      return mockSlots;

    } catch (error) {
      console.error('Failed to load available time slots:', error);
      return [];
    }
  }
};

/**
 * Export types for external use
 */
export type {
  AppointmentDetails,
  CallHistory,
  FollowUpRequest,
  FollowUpResponse,
  ConfirmationRequest,
  ConfirmationResponse,
  RescheduleRequest,
  RescheduleResponse
}; || 'Failed to initiate follow-up call'
        };
      }

    } catch (error) {
      console.error('Follow-up call error:', error);
      
      // Handle specific error types
      if (error instanceof TypeError && error.message.includes('fetch')) {
        return {
          success: false,
          error: 'Network error. Please check your internet connection and try again.'
        };
      } else if (error instanceof Error && error.name === 'AbortError') {
        return {
          success: false,
          error: 'Follow-up call request timed out. Please try again.'
        };
      } else {
        return {
          success: false,
          error: 'An unexpected error occurred while initiating the follow-up call.'
        };
      }
    }
  },

  /**
   * Confirm client attendance for appointment
   * Updates appointment status in Supabase database
   */
  async confirmAttendance(request: ConfirmationRequest): Promise<ConfirmationResponse> {
    try {
      const confirmationPayload = {
        ...request,
        confirmationTimestamp: new Date().toISOString(),
        notificationRequired: true // Send confirmation email/SMS to client
      };

      // Confirm attendance with retry logic
      const response = await retryWithBackoff(async () => {
        return await makeRequest<ConfirmationResponse>(
          SERVICE_CONFIG.CONFIRMATION_ENDPOINT,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${await this.getAuthToken()}`,
            },
            body: JSON.stringify(confirmationPayload),
          }
        );
      });

      if (response.success) {
        // Log confirmation event
        await this.logAppointmentEvent(request.appointmentId, 'confirmed', request.confirmedBy);
        
        return { success: true };
      } else {
        return {
          success: false,
          error: response.error
