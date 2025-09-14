import React, { useState, useEffect } from 'react';
import { ScrollView, View, Alert, Pressable } from 'react-native';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Phone, 
  Calendar, 
  Clock, 
  CheckCircle, 
  RefreshCw, 
  MessageSquare, 
  User,
  MapPin,
  Mail
} from 'lucide-react-native';
import { followUpService } from '../services/followUpService';

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

interface FollowUpConfig {
  timingHours: number; // 1 or 2 hours before appointment
  enabled: boolean;
  autoTrigger: boolean;
}

export const FollowUpScreen: React.FC = () => {
  // State management
  const [appointment, setAppointment] = useState<AppointmentDetails | null>(null);
  const [callHistory, setCallHistory] = useState<CallHistory[]>([]);
  const [followUpConfig, setFollowUpConfig] = useState<FollowUpConfig>({
    timingHours: 2,
    enabled: true,
    autoTrigger: true
  });
  
  // Loading and action states
  const [isLoading, setIsLoading] = useState(true);
  const [isSendingFollowUp, setIsSendingFollowUp] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isRescheduling, setIsRescheduling] = useState(false);

  // Effect to load appointment data and call history
  useEffect(() => {
    loadAppointmentData();
  }, []);

  // Load appointment details and call history from the service
  const loadAppointmentData = async () => {
    setIsLoading(true);
    try {
      // In a real app, you'd get the appointment ID from navigation params
      const appointmentId = 'current_appointment'; // Placeholder
      
      const [appointmentData, historyData] = await Promise.all([
        followUpService.getAppointmentDetails(appointmentId),
        followUpService.getCallHistory(appointmentId)
      ]);

      setAppointment(appointmentData);
      setCallHistory(historyData);
    } catch (error) {
      Alert.alert('Error', 'Failed to load appointment data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate time until appointment
  const getTimeUntilAppointment = (): string => {
    if (!appointment) return '';
    
    const appointmentDateTime = new Date(`${appointment.appointmentDate} ${appointment.appointmentTime}`);
    const now = new Date();
    const timeDiff = appointmentDateTime.getTime() - now.getTime();
    
    const hours = Math.floor(timeDiff / (1000 * 60 * 60));
    const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m`;
    } else {
      return 'Now';
    }
  };

  // Check if follow-up should be triggered
  const shouldTriggerFollowUp = (): boolean => {
    if (!appointment) return false;
    
    const appointmentDateTime = new Date(`${appointment.appointmentDate} ${appointment.appointmentTime}`);
    const now = new Date();
    const hoursUntilAppointment = (appointmentDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    
    return hoursUntilAppointment <= followUpConfig.timingHours && hoursUntilAppointment > 0;
  };

  // Send follow-up call to client
  const handleSendFollowUp = async () => {
    if (!appointment) return;

    setIsSendingFollowUp(true);
    
    try {
      const followUpResult = await followUpService.sendFollowUp({
        appointmentId: appointment.id,
        clientPhone: appointment.clientPhone,
        clientName: appointment.clientName,
        appointmentDateTime: `${appointment.appointmentDate} ${appointment.appointmentTime}`,
        previousCallHistory: callHistory,
        followUpTiming: followUpConfig.timingHours
      });

      if (followUpResult.success) {
        Alert.alert(
          'Follow-Up Initiated', 
          `Claude AI is now calling ${appointment.clientName} to confirm their appointment. Call ID: ${followUpResult.callId}`
        );
        
        // Refresh call history to show the new follow-up call
        await loadAppointmentData();
      } else {
        Alert.alert('Error', followUpResult.error || 'Failed to initiate follow-up call.');
      }
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred while initiating the follow-up call.');
    } finally {
      setIsSendingFollowUp(false);
    }
  };

  // Confirm client attendance
  const handleConfirmAttendance = async () => {
    if (!appointment) return;

    setIsConfirming(true);

    try {
      const confirmResult = await followUpService.confirmAttendance({
        appointmentId: appointment.id,
        confirmedBy: 'manual', // or 'ai_call' if confirmed via Claude
        confirmationTime: new Date().toISOString()
      });

      if (confirmResult.success) {
        setAppointment(prev => prev ? { ...prev, status: 'confirmed' } : null);
        Alert.alert('Success', 'Attendance confirmed! The client will receive a confirmation notification.');
      } else {
        Alert.alert('Error', confirmResult.error || 'Failed to confirm attendance.');
      }
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred while confirming attendance.');
    } finally {
      setIsConfirming(false);
    }
  };

  // Reschedule appointment
  const handleReschedule = async () => {
    if (!appointment) return;

    // Show rescheduling options
    Alert.alert(
      'Reschedule Appointment',
      'How would you like to reschedule this appointment?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Let Client Choose New Time', onPress: () => initiateClientReschedule() },
        { text: 'Manual Reschedule', onPress: () => showManualRescheduleOptions() }
      ]
    );
  };

  // Initiate client-driven rescheduling
  const initiateClientReschedule = async () => {
    setIsRescheduling(true);

    try {
      const rescheduleResult = await followUpService.rescheduleAppointment({
        appointmentId: appointment!.id,
        rescheduleType: 'client_choice',
        clientPhone: appointment!.clientPhone,
        clientName: appointment!.clientName
      });

      if (rescheduleResult.success) {
        Alert.alert(
          'Rescheduling Initiated',
          'Claude AI will call the client to help them choose a new appointment time.'
        );
        await loadAppointmentData();
      } else {
        Alert.alert('Error', rescheduleResult.error || 'Failed to initiate rescheduling.');
      }
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred during rescheduling.');
    } finally {
      setIsRescheduling(false);
    }
  };

  // Show manual rescheduling options
  const showManualRescheduleOptions = () => {
    Alert.alert('Manual Reschedule', 'This feature will open the calendar picker to manually reschedule the appointment.');
    // In a real app, this would navigate to a calendar/datetime picker screen
  };

  // Update follow-up timing configuration
  const updateFollowUpTiming = (hours: number) => {
    setFollowUpConfig(prev => ({ ...prev, timingHours: hours }));
  };

  if (isLoading) {
    return (
      <View className="flex-1 bg-background justify-center items-center">
        <Label className="text-foreground text-lg">Loading appointment details...</Label>
      </View>
    );
  }

  if (!appointment) {
    return (
      <View className="flex-1 bg-background justify-center items-center p-4">
        <Label className="text-foreground text-lg text-center">No appointment found.</Label>
        <Button onPress={loadAppointmentData} className="mt-4">
          Retry
        </Button>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-background">
      <View className="p-4 space-y-6">
        {/* Header */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-foreground flex-row items-center">
              <Phone className="w-6 h-6 text-primary mr-2" />
              Follow-Up Call Agent
            </CardTitle>
            <Label className="text-muted-foreground">
              Time until appointment: {getTimeUntilAppointment()}
            </Label>
          </CardHeader>
        </Card>

        {/* Appointment Details */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-lg text-foreground flex-row items-center justify-between">
              <View className="flex-row items-center">
                <Calendar className="w-5 h-5 text-primary mr-2" />
                Appointment Details
              </View>
              <Badge 
                variant={
                  appointment.status === 'confirmed' ? 'default' :
                  appointment.status === 'scheduled' ? 'secondary' :
                  appointment.status === 'rescheduled' ? 'outline' : 'destructive'
                }
              >
                {appointment.status.toUpperCase()}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Client Information */}
            <View className="space-y-3">
              <View className="flex-row items-center">
                <User className="w-4 h-4 text-muted-foreground mr-3" />
                <Label className="text-foreground font-medium">{appointment.clientName}</Label>
              </View>
              
              <View className="flex-row items-center">
                <Mail className="w-4 h-4 text-muted-foreground mr-3" />
                <Label className="text-foreground">{appointment.clientEmail}</Label>
              </View>
              
              <View className="flex-row items-center">
                <Phone className="w-4 h-4 text-muted-foreground mr-3" />
                <Label className="text-foreground">{appointment.clientPhone}</Label>
              </View>
            </View>

            <Separator />

            {/* Appointment Time & Location */}
            <View className="space-y-3">
              <View className="flex-row items-center">
                <Calendar className="w-4 h-4 text-muted-foreground mr-3" />
                <Label className="text-foreground font-medium">{appointment.appointmentDate}</Label>
              </View>
              
              <View className="flex-row items-center">
                <Clock className="w-4 h-4 text-muted-foreground mr-3" />
                <Label className="text-foreground">{appointment.appointmentTime}</Label>
              </View>
              
              <View className="flex-row items-center">
                <MapPin className="w-4 h-4 text-muted-foreground mr-3" />
                <Label className="text-foreground">{appointment.location}</Label>
              </View>
            </View>

            <Separator />

            {/* API Number */}
            <View className="flex-row items-center">
              <Label className="text-muted-foreground text-sm">API Number: </Label>
              <Label className="text-foreground text-sm font-mono">{appointment.apiNumber}</Label>
            </View>
          </CardContent>
        </Card>

        {/* Follow-Up Configuration */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-lg text-foreground">Follow-Up Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <View>
              <Label className="text-foreground mb-3">Call timing before appointment:</Label>
              <View className="flex-row space-x-3">
                <Pressable
                  onPress={() => updateFollowUpTiming(1)}
                  className={`flex-1 p-3 rounded-lg border ${
                    followUpConfig.timingHours === 1 
                      ? 'bg-primary border-primary' 
                      : 'bg-background border-border'
                  }`}
                >
                  <Label className={`text-center ${
                    followUpConfig.timingHours === 1 ? 'text-primary-foreground' : 'text-foreground'
                  }`}>
                    1 Hour
                  </Label>
                </Pressable>
                
                <Pressable
                  onPress={() => updateFollowUpTiming(2)}
                  className={`flex-1 p-3 rounded-lg border ${
                    followUpConfig.timingHours === 2 
                      ? 'bg-primary border-primary' 
                      : 'bg-background border-border'
                  }`}
                >
                  <Label className={`text-center ${
                    followUpConfig.timingHours === 2 ? 'text-primary-foreground' : 'text-foreground'
                  }`}>
                    2 Hours
                  </Label>
                </Pressable>
              </View>
            </View>

            {/* Follow-up trigger indicator */}
            <View className="flex-row items-center p-3 bg-muted/50 rounded-lg">
              <View className={`w-3 h-3 rounded-full mr-3 ${
                shouldTriggerFollowUp() ? 'bg-green-500' : 'bg-yellow-500'
              }`} />
              <Label className="text-foreground text-sm">
                {shouldTriggerFollowUp() 
                  ? 'Ready for follow-up call' 
                  : `Follow-up will trigger ${followUpConfig.timingHours} hour(s) before appointment`}
              </Label>
            </View>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <View className="space-y-3">
          <Button
            onPress={handleSendFollowUp}
            disabled={isSendingFollowUp || !shouldTriggerFollowUp()}
            className={`w-full ${
              shouldTriggerFollowUp() && !isSendingFollowUp
                ? 'bg-primary hover:bg-primary/90'
                : 'bg-muted hover:bg-muted/90'
            }`}
          >
            {isSendingFollowUp ? 'Initiating Call...' : 'Send Follow-Up Call'}
          </Button>

          <View className="flex-row space-x-3">
            <Button
              onPress={handleConfirmAttendance}
              disabled={isConfirming || appointment.status === 'confirmed'}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              {isConfirming ? 'Confirming...' : 'Confirm Attendance'}
            </Button>

            <Button
              onPress={handleReschedule}
              disabled={isRescheduling}
              variant="outline"
              className="flex-1"
            >
              {isRescheduling ? 'Rescheduling...' : 'Reschedule'}
            </Button>
          </View>
        </View>

        {/* Call History */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-lg text-foreground flex-row items-center">
              <MessageSquare className="w-5 h-5 text-primary mr-2" />
              Call History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {callHistory.length === 0 ? (
              <Label className="text-muted-foreground text-center">No call history available</Label>
            ) : (
              <View className="space-y-4">
                {callHistory.map((call) => (
                  <Card key={call.id} className="bg-muted/30 border-muted">
                    <CardContent className="pt-4">
                      <View className="flex-row justify-between items-start mb-2">
                        <View>
                          <Label className="text-foreground font-medium capitalize">
                            {call.type.replace('_', ' ')} Call
                          </Label>
                          <Label className="text-muted-foreground text-sm">
                            {new Date(call.timestamp).toLocaleDateString()} at{' '}
                            {new Date(call.timestamp).toLocaleTimeString()}
                          </Label>
                        </View>
                        <Badge 
                          variant={
                            call.status === 'completed' ? 'default' :
                            call.status === 'failed' ? 'destructive' : 'secondary'
                          }
                        >
                          {call.status}
                        </Badge>
                      </View>
                      
                      <View className="space-y-2">
                        <View className="flex-row items-center">
                          <Clock className="w-3 h-3 text-muted-foreground mr-2" />
                          <Label className="text-muted-foreground text-sm">Duration: {call.duration}</Label>
                        </View>
                        
                        <Label className="text-foreground text-sm">{call.summary}</Label>
                        
                        {call.questions.length > 0 && (
                          <View className="mt-3 space-y-2">
                            <Label className="text-foreground text-sm font-medium">Key Information:</Label>
                            {call.questions.slice(0, 2).map((qa, index) => (
                              <View key={index} className="bg-background/50 p-2 rounded">
                                <Label className="text-muted-foreground text-xs">{qa.question}</Label>
                                <Label className="text-foreground text-sm">{qa.answer}</Label>
                              </View>
                            ))}
                            {call.questions.length > 2 && (
                              <Label className="text-muted-foreground text-xs">
                                +{call.questions.length - 2} more responses
                              </Label>
                            )}
                          </View>
                        )}
                      </View>
                    </CardContent>
                  </Card>
                ))}
              </View>
            )}
          </CardContent>
        </Card>
      </View>
    </ScrollView>
  );
};
