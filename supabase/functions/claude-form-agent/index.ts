import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

interface CallContext {
  agentId: string;
  sessionId: string;
  collectedData: Record<string, any>;
  currentStep: string;
  coreFields: any[];
  additionalQuestions: any[];
  interruptionCount: number;
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
}

const HUMAN_FILLERS = ['umm', 'let me see', 'gotcha', 'that makes sense', 'I understand', 'hmm', 'aha'];
const INTERRUPTION_RESPONSES = [
  'Oh, I understand',
  'That\'s helpful',
  'Got it',
  'I see',
  'Right, okay'
];

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const payload = await req.json();
    const { sessionId, message, isInterruption, audioLevel } = payload;

    // Retrieve call context
    const { data: session, error: sessionError } = await supabase
      .from('call_sessions')
      .select('*')
      .eq('session_id', sessionId)
      .single();

    if (sessionError || !session) {
      return Response.json({ error: 'Session not found' }, { status: 404 });
    }

    const context: CallContext = {
      agentId: session.agent_id,
      sessionId: session.session_id,
      collectedData: session.collected_data || {},
      currentStep: session.current_step,
      coreFields: session.core_fields || [],
      additionalQuestions: session.additional_questions || [],
      interruptionCount: session.interruption_count || 0,
      conversationHistory: session.conversation_history || []
    };

    // Handle interruption
    if (isInterruption) {
      context.interruptionCount++;
      const interruptionResponse = INTERRUPTION_RESPONSES[
        Math.floor(Math.random() * INTERRUPTION_RESPONSES.length)
      ];
      
      await updateSession(sessionId, {
        interruption_count: context.interruptionCount
      });

      return Response.json({
        response: `${interruptionResponse}. ${await generateContextualResponse(context, message)}`,
        nextStep: context.currentStep,
        shouldCollectMore: needsMoreData(context),
        bookingAvailable: canOfferBooking(context)
      });
    }

    // Process normal message
    const response = await processMessage(context, message);
    
    return Response.json(response);

  } catch (error) {
    console.error('Edge function error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
});

async function processMessage(context: CallContext, message: string) {
  // Add to conversation history
  context.conversationHistory.push({ role: 'user', content: message });

  let aiResponse = '';
  let nextStep = context.currentStep;
  
  switch (context.currentStep) {
    case 'greeting':
      aiResponse = generateGreeting();
      nextStep = 'collecting';
      break;
      
    case 'collecting':
      const collectionResult = await handleDataCollection(context, message);
      aiResponse = collectionResult.response;
      nextStep = collectionResult.nextStep;
      break;
      
    case 'confirming':
      const confirmResult = await handleConfirmation(context, message);
      aiResponse = confirmResult.response;
      nextStep = confirmResult.nextStep;
      break;
      
    case 'booking':
      const bookingResult = await handleBooking(context, message);
      aiResponse = bookingResult.response;
      nextStep = bookingResult.nextStep;
      break;
      
    default:
      aiResponse = "I'm not sure how to help with that. Could you repeat?";
  }

  // Add AI response to history
  context.conversationHistory.push({ role: 'assistant', content: aiResponse });

  // Update session
  await updateSession(context.sessionId, {
    current_step: nextStep,
    collected_data: context.collectedData,
    conversation_history: context.conversationHistory
  });

  return {
    response: aiResponse,
    nextStep: nextStep,
    shouldCollectMore: needsMoreData(context),
    bookingAvailable: canOfferBooking(context)
  };
}

function generateGreeting(): string {
  const filler = HUMAN_FILLERS[Math.floor(Math.random() * HUMAN_FILLERS.length)];
  return `Hi there! ${filler}, I'm calling to help collect some information for your inquiry. Is this a good time to chat for a few minutes?`;
}

async function handleDataCollection(context: CallContext, message: string) {
  const missingFields = context.coreFields.filter(field => 
    !context.collectedData[field.id] || context.collectedData[field.id].trim() === ''
  );

  if (missingFields.length > 0) {
    // Extract info from message and ask for next missing field
    extractAndStoreData(context, message);
    
    const nextField = missingFields[0];
    const filler = HUMAN_FILLERS[Math.floor(Math.random() * HUMAN_FILLERS.length)];
    
    return {
      response: `${filler}, and what's your ${nextField.label.toLowerCase()}?`,
      nextStep: 'collecting'
    };
  }

  // Check additional questions
  const unansweredQuestions = context.additionalQuestions.filter(q => 
    !context.collectedData[q.id]
  );

  if (unansweredQuestions.length > 0) {
    const nextQuestion = unansweredQuestions[0];
    return {
      response: `Great! ${nextQuestion.question}`,
      nextStep: 'collecting'
    };
  }

  // All data collected, move to confirmation
  return {
    response: "Perfect! Let me confirm the information I've collected...",
    nextStep: 'confirming'
  };
}

async function handleConfirmation(context: CallContext, message: string) {
  const isConfirmed = message.toLowerCase().includes('yes') || 
                     message.toLowerCase().includes('correct') ||
                     message.toLowerCase().includes('right');

  if (isConfirmed) {
    return {
      response: "Excellent! Would you like me to help you schedule an appointment to discuss your needs further?",
      nextStep: 'booking'
    };
  }

  return {
    response: "No problem! What would you like me to correct?",
    nextStep: 'collecting'
  };
}

async function handleBooking(context: CallContext, message: string) {
  const wantsBooking = message.toLowerCase().includes('yes') ||
                       message.toLowerCase().includes('sure') ||
                       message.toLowerCase().includes('book');

  if (wantsBooking) {
    // In a real implementation, integrate with calendar system
    return {
      response: "Great! I'll have someone from our team reach out within 24 hours to schedule a convenient time. Thank you for your information!",
      nextStep: 'complete'
    };
  }

  return {
    response: "No worries! We have all your information and someone will be in touch. Have a great day!",
    nextStep: 'complete'
  };
}

function extractAndStoreData(context: CallContext, message: string) {
  // Simple extraction logic - in production, use more sophisticated NLP
  const words = message.toLowerCase().split(' ');
  
  // Look for email patterns
  const emailMatch = message.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
  if (emailMatch) {
    context.collectedData['email'] = emailMatch[0];
  }
  
  // Look for phone patterns
  const phoneMatch = message.match(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/);
  if (phoneMatch) {
    context.collectedData['phone'] = phoneMatch[0];
  }
  
  // Store full message as potential name/other data
  if (words.length <= 4 && !emailMatch && !phoneMatch) {
    const missingField = context.coreFields.find(f => !context.collectedData[f.id]);
    if (missingField) {
      context.collectedData[missingField.id] = message.trim();
    }
  }
}

async function generateContextualResponse(context: CallContext, message: string): Promise<string> {
  const filler = HUMAN_FILLERS[Math.floor(Math.random() * HUMAN_FILLERS.length)];
  
  // Generate contextual response based on current step
  switch (context.currentStep) {
    case 'collecting':
      return `${filler}, so about that ${getCurrentFieldLabel(context)}...`;
    case 'confirming':
      return `${filler}, let me make sure I have everything right...`;
    case 'booking':
      return `${filler}, so regarding the appointment...`;
    default:
      return `${filler}, let me get back on track here...`;
  }
}

function getCurrentFieldLabel(context: CallContext): string {
  const missingField = context.coreFields.find(field => 
    !context.collectedData[field.id]
  );
  return missingField ? missingField.label.toLowerCase() : 'information';
}

function needsMoreData(context: CallContext): boolean {
  const coreComplete = context.coreFields.every(field => 
    context.collectedData[field.id]
  );
  const additionalComplete = context.additionalQuestions.every(q => 
    context.collectedData[q.id]
  );
  
  return !coreComplete || !additionalComplete;
}

function canOfferBooking(context: CallContext): boolean {
  return !needsMoreData(context) && context.currentStep !== 'complete';
}

async function updateSession(sessionId: string, updates: any) {
  await supabase
    .from('call_sessions')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('session_id', sessionId);
}
