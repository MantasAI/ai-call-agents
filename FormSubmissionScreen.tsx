import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  Text,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@supabase/auth-helpers-react';
import { supabase } from '../lib/supabase';
import { LeadForm } from '../components/lead_form';
import { LoadingOverlay } from '../components/loading_overlay';
import { ErrorBanner } from '../components/error_banner';
import { CallScriptDisplay } from '../components/call_script_display';
import { formSubmissionService } from '../services/form_submission_service';
import { claudeEdgeService } from '../services/claude_edge_service';
import type { LeadFormData, CallScript } from '../types/form_types';

/**
 * FormSubmissionScreen - Main screen for lead form submission
 * 
 * Features:
 * - Dark mode by default
 * - Mobile-first responsive design
 * - Form validation with Zod
 * - Supabase Auth integration
 * - Claude Edge Function integration for call script generation
 * - Retry logic for failed API calls
 * - Loading and error states
 * 
 * Future AI Enhancement Opportunities:
 * - Add AI-powered form field suggestions based on user context
 * - Implement smart form validation with AI feedback
 * - Add voice-to-text input for notes field
 * - Integrate AI-powered lead scoring
 */
export const FormSubmissionScreen: React.FC = () => {
  const { session, loading: authLoading } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [callScript, setCallScript] = useState<CallScript | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // Maximum retry attempts for API calls
  const MAX_RETRIES = 3;

  useEffect(() => {
    // Clear error when component mounts or session changes
    if (session) {
      setError(null);
    }
  }, [session]);

  /**
   * Handle form submission with retry logic
   * Future AI Enhancement: Add intelligent retry timing based on error type
   */
  const handleFormSubmit = async (formData: LeadFormData) => {
    if (!session?.user?.id) {
      setError('Authentication required. Please log in.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    
    try {
      // Submit form data with retry logic
      const leadId = await submitWithRetry(formData);
      
      // Generate call script after successful submission
      await generateCallScript(formData, leadId);
      
      Alert.alert(
        'Success!', 
        'Lead information submitted and call script generated successfully.'
      );
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage);
      Alert.alert('Error', errorMessage);
    } finally {
      setIsSubmitting(false);
      setRetryCount(0);
    }
  };

  /**
   * Submit form data with exponential backoff retry logic
   * Future AI Enhancement: Use AI to predict optimal retry timing
   */
  const submitWithRetry = async (formData: LeadFormData): Promise<string> => {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        setRetryCount(attempt);
        
        const leadId = await formSubmissionService.submitLead({
          ...formData,
          userId: session!.user.id,
        });
        
        return leadId;
        
      } catch (error) {
        if (attempt === MAX_RETRIES) {
          throw new Error(`Failed to submit lead after ${MAX_RETRIES + 1} attempts`);
        }
        
        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw new Error('Unexpected error in retry logic');
  };

  /**
   * Generate call script using Claude Edge Function
   * Future AI Enhancement: Cache scripts and use context-aware generation
   */
  const generateCallScript = async (formData: LeadFormData, leadId: string) => {
    setIsGeneratingScript(true);
    
    try {
      const script = await claudeEdgeService.generateCallScript({
        leadName: formData.name,
        leadEmail: formData.email,
        leadPhone: formData.phone,
        notes: formData.notes,
        leadId,
        userId: session!.user.id,
      });
      
      setCallScript(script);
      
    } catch (error) {
      console.error('Failed to generate call script:', error);
      // Don't throw here - form submission was successful
      setError('Lead submitted successfully, but call script generation failed. You can retry later.');
    } finally {
      setIsGeneratingScript(false);
    }
  };

  /**
   * Clear error state
   */
  const clearError = () => setError(null);

  /**
   * Retry call script generation
   */
  const retryScriptGeneration = async () => {
    if (!callScript) return;
    
    setError(null);
    await generateCallScript(
      {
        name: callScript.leadName,
        email: callScript.leadEmail || '',
        phone: callScript.leadPhone || '',
        notes: callScript.notes || '',
      },
      callScript.leadId
    );
  };

  // Show loading screen while auth is loading
  if (authLoading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-900">
        <LoadingOverlay message="Loading authentication..." />
      </SafeAreaView>
    );
  }

  // Show authentication required message
  if (!session) {
    return (
      <SafeAreaView className="flex-1 bg-gray-900 justify-center items-center px-6">
        <View className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
          <Text className="text-white text-xl font-bold mb-4 text-center">
            Authentication Required
          </Text>
          <Text className="text-gray-300 text-center">
            Please log in to submit lead information and generate call scripts.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-900">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View className="px-6 py-4 border-b border-gray-700">
            <Text className="text-white text-2xl font-bold">
              Submit Lead Information
            </Text>
            <Text className="text-gray-400 mt-1">
              Generate personalized call scripts with AI
            </Text>
          </View>

          {/* Error Banner */}
          {error && (
            <ErrorBanner
              message={error}
              onDismiss={clearError}
              onRetry={callScript ? retryScriptGeneration : undefined}
            />
          )}

          {/* Main Content */}
          <View className="flex-1 px-6 py-6">
            {/* Lead Form */}
            <LeadForm
              onSubmit={handleFormSubmit}
              isSubmitting={isSubmitting}
              retryCount={retryCount}
              maxRetries={MAX_RETRIES}
            />

            {/* Call Script Display */}
            {callScript && (
              <View className="mt-8">
                <CallScriptDisplay
                  script={callScript}
                  isGenerating={isGeneratingScript}
                  onRegenerate={retryScriptGeneration}
                />
              </View>
            )}
          </View>
        </ScrollView>

        {/* Loading Overlay */}
        {(isSubmitting || isGeneratingScript) && (
          <LoadingOverlay
            message={
              isSubmitting
                ? `Submitting lead information${retryCount > 0 ? ` (Retry ${retryCount}/${MAX_RETRIES})` : ''}...`
                : 'Generating call script with AI...'
            }
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};
