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
      const result = await formSubmissionService.handle
