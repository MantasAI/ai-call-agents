import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Phone, PhoneOff, Mic, MicOff, Volume2 } from 'lucide-react-native';
import { formSubmissionService } from '../services/formSubmissionService';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';

interface CallInterfaceProps {
  agentId: string;
  onCallEnd: () => void;
}

interface CallMessage {
  id: string;
  speaker: 'agent' | 'client';
  message: string;
  timestamp: Date;
  isInterruption?: boolean;
}

export const CallInterfaceComponent: React.FC<CallInterfaceProps> = ({ 
  agentId, 
  onCallEnd 
}) => {
  const [isCallActive, setIsCallActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [sessionId, setSessionId] = useState<string>('');
  const [messages, setMessages] = useState<CallMessage[]>([]);
  const [currentStep, setCurrentStep] = useState<string>('greeting');
  const [collectedData, setCollectedData] = useState<Record<string, any>>({});
  const [audioLevel, setAudioLevel] = useState(0);
  const [isAgentSpeaking, setIsAgentSpeaking] = useState(false);

  const scrollViewRef = useRef<ScrollView>(null);
  const interruptionTimeoutRef = useRef<NodeJS.Timeout>();

  const startCall = async () => {
    try {
      const result = await formSubmissionService.handleIncomingCall({
        agentId,
        clientPhone: '+1234567890', // Mock phone number
      });

      if (result.error) {
        console.error('Call start error:', result.error);
        return;
      }

      setSessionId(result.data!.sessionId);
      setIsCallActive(true);
      setCurrentStep(result.data!.currentStep);
      
      // Start with agent greeting
      setTimeout(() => {
        simulateAgentMessage("Hi there! I'm calling to help collect some information for your inquiry. Is this a good time to chat?");
      }, 1000);

    } catch (error) {
      console.error('Failed to start call:', error);
    }
  };

  const endCall = () => {
    setIsCallActive(false);
    setMessages([]);
    setCollectedData({});
    setCurrentStep('greeting');
    onCallEnd();
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const simulateClientMessage = async (message: string, isInterruption = false) => {
    if (!sessionId) return;

    const newMessage: CallMessage = {
      id: Date.now().toString(),
      speaker: 'client',
      message,
      timestamp: new Date(),
      isInterruption
    };

    setMessages(prev => [...prev, newMessage]);

    // If agent is speaking and client interrupts
    if (isAgentSpeaking && isInterruption) {
      setIsAgentSpeaking(false);
      clearTimeout(interruptionTimeoutRef.current);
    }

    try {
      const result = await formSubmissionService.processCallMessage({
        sessionId,
        message,
        isInterruption,
        audioLevel
      });

      if (result.data) {
        setTimeout(() => {
          simulateAgentMessage(result.data!.response);
          setCurrentStep(result.data!.nextStep);
        }, isInterruption ? 500 : 1500);
      }
    } catch (error) {
      console.error('Message processing error:', error);
    }
  };

  const simulateAgentMessage = (message: string) => {
    setIsAgentSpeaking(true);
    
    const agentMessage: CallMessage = {
      id: Date.now().toString(),
      speaker: 'agent',
      message,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, agentMessage]);

    // Simulate speaking duration
    const speakingDuration = message.length * 100; // 100ms per character
    interruptionTimeoutRef.current = setTimeout(() => {
      setIsAgentSpeaking(false);
    }, speakingDuration);
  };

  const handleQuickResponse = (response: string) => {
    simulateClientMessage(response);
  };

  const handleInterruption = (response: string) => {
    simulateClientMessage(response, true);
  };

  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  const getStepLabel = (step: string) => {
    switch (step) {
      case 'greeting': return 'Greeting';
      case 'collecting': return 'Collecting Info';
      case 'confirming': return 'Confirming Data';
      case 'booking': return 'Booking Appointment';
      case 'complete': return 'Call Complete';
      default: return step;
    }
  };

  const getQuickResponses = () => {
    switch (currentStep) {
      case 'greeting':
        return ['Yes, good time', 'Can you call back later?', 'What is this about?'];
      case 'collecting':
        return ['John Smith', 'john@email.com', '555-123-4567', 'ABC Company'];
      case 'confirming':
        return ['Yes, that\'s correct', 'No, let me fix that', 'Can you repeat?'];
      case 'booking':
        return ['Yes, I\'d like to book', 'No thanks', 'What times are available?'];
      default:
        return ['Okay', 'Thank you', 'Goodbye'];
    }
  };

  return (
    <View className="flex-1 bg-gray-900">
      {/* Header */}
      <View className="bg-gray-800 p-4 border-b border-gray-700">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-white text-lg font-semibold">Call Agent Demo</Text>
            <Text className="text-gray-400 text-sm">Form Submission Agent</Text>
          </View>
          <Badge className={`${isCallActive ? 'bg-green-600' : 'bg-gray-600'}`}>
            <Text className="text-white text-xs">
              {isCallActive ? getStepLabel(currentStep) : 'Inactive'}
            </Text>
          </Badge>
        </View>
      </View>

      {/* Call Controls */}
      <View className="bg-gray-800 p-4 flex-row justify-center space-x-6">
        {!isCallActive ? (
          <TouchableOpacity
            onPress={startCall}
            className="bg-green-600 w-16 h-16 rounded-full items-center justify-center"
          >
            <Phone size={24} color="white" />
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity
              onPress={toggleMute}
              className={`w-12 h-12 rounded-full items-center justify-center ${
                isMuted ? 'bg-red-600' : 'bg-gray-600'
              }`}
            >
              {isMuted ? <MicOff size={20} color="white" /> : <Mic size={20} color="white" />}
            </TouchableOpacity>
            
            <TouchableOpacity
              onPress={endCall}
              className="bg-red-600 w-16 h-16 rounded-full items-center justify-center"
            >
              <PhoneOff size={24} color="white" />
            </TouchableOpacity>
            
            <TouchableOpacity className="w-12 h-12 rounded-full items-center justify-center bg-gray-600">
              <Volume2 size={20} color="white" />
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Messages */}
      <ScrollView 
        ref={scrollViewRef}
        className="flex-1 p-4"
        showsVerticalScrollIndicator={false}
      >
        {messages.map((msg) => (
          <View
            key={msg.id}
            className={`mb-3 ${msg.speaker === 'agent' ? 'items-start' : 'items-end'}`}
          >
            <View
              className={`max-w-[80%] p-3 rounded-lg ${
                msg.speaker === 'agent' 
                  ? 'bg-blue-600 rounded-bl-sm' 
                  : 'bg-gray-700 rounded-br-sm'
              }`}
            >
              <Text className="text-white">{msg.message}</Text>
              <Text className="text-gray-300 text-xs mt-1">
                {msg.timestamp.toLocaleTimeString()}
                {msg.isInterruption && ' (interruption)'}
              </Text>
            </View>
          </View>
        ))}
        
        {isAgentSpeaking && (
          <View className="items-start mb-3">
            <View className="bg-blue-600 p-3 rounded-lg rounded-bl-sm">
              <Text className="text-white opacity-70">Agent is speaking...</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Quick Responses */}
      {isCallActive && (
        <View className="bg-gray-800 p-4 border-t border-gray-700">
          <Text className="text-gray-400 text-sm mb-3">Quick Responses:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View className="flex-row space-x-2">
              {getQuickResponses().map((response, index) => (
                <TouchableOpacity
                  key={index}
                  onPress={() => handleQuickResponse(response)}
                  className="bg-gray-700 px-4 py-2 rounded-full"
                >
                  <Text className="text-white text-sm">{response}</Text>
                </TouchableOpacity>
              ))}
              
              {/* Interruption button */}
              {isAgentSpeaking && (
                <TouchableOpacity
                  onPress={() => handleInterruption('Excuse me, can I interrupt?')}
                  className="bg-orange-600 px-4 py-2 rounded-full"
                >
                  <Text className="text-white text-sm">Interrupt</Text>
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>
        </View>
      )}
    </View>
  );
};
