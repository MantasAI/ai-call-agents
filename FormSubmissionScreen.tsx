import React, { useState, useEffect } from 'react';
import { View, ScrollView, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { formSubmissionService } from '../services/formSubmissionService';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';

interface FormField {
  id: string;
  label: string;
  type: 'text' | 'email' | 'phone';
  required: boolean;
  value: string;
}

interface AdditionalQuestion {
  id: string;
  question: string;
  type: 'text' | 'select' | 'boolean';
  options?: string[];
  required: boolean;
}

export const FormSubmissionScreen: React.FC = () => {
  const navigation = useNavigation();
  const [isLoading, setIsLoading] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const [agentId, setAgentId] = useState<string>('');
  const [formLink, setFormLink] = useState<string>('');
  const [webhookLink, setWebhookLink] = useState<string>('');

  // Core form fields
  const [coreFields, setCoreFields] = useState<FormField[]>([
    { id: 'name', label: 'Full Name', type: 'text', required: true, value: '' },
    { id: 'email', label: 'Email', type: 'email', required: true, value: '' },
    { id: 'phone', label: 'Phone Number', type: 'phone', required: true, value: '' },
    { id: 'custom1', label: 'Company Name', type: 'text', required: true, value: '' },
    { id: 'custom2', label: 'Industry', type: 'text', required: true, value: '' },
    { id: 'custom3', label: 'Budget Range', type: 'text', required: true, value: '' }
  ]);

  // Additional questions (post-payment)
  const [additionalQuestions, setAdditionalQuestions] = useState<AdditionalQuestion[]>([]);
  const [questionAnswers, setQuestionAnswers] = useState<Record<string, string>>({});

  const updateFieldValue = (fieldId: string, value: string) => {
    setCoreFields(prev => prev.map(field => 
      field.id === fieldId ? { ...field, value } : field
    ));
  };

  const isFormValid = () => {
    return coreFields.every(field => field.required ? field.value.trim() !== '' : true);
  };

  const handlePayment = async () => {
    if (!isFormValid()) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    setIsLoading(true);
    try {
      const result = await formSubmissionService.processPayment({
        fields: coreFields,
        agentType: 'form_submission'
      });

      if (result.error) {
        Alert.alert('Payment Error', result.error);
        return;
      }

      setIsPaid(true);
      setAgentId(result.data.agentId);
      setFormLink(result.data.formLink);
      setWebhookLink(result.data.webhookLink || '');
      
    } catch (error) {
      Alert.alert('Error', 'Payment processing failed');
    } finally {
      setIsLoading(false);
    }
  };

  const addQuestion = () => {
    if (additionalQuestions.length >= 10) {
      Alert.alert('Limit Reached', 'Maximum 10 additional questions allowed');
      return;
    }

    const newQuestion: AdditionalQuestion = {
      id: `q_${Date.now()}`,
      question: '',
      type: 'text',
      required: false
    };

    setAdditionalQuestions(prev => [...prev, newQuestion]);
  };

  const updateQuestion = (questionId: string, updates: Partial<AdditionalQuestion>) => {
    setAdditionalQuestions(prev => prev.map(q => 
      q.id === questionId ? { ...q, ...updates } : q
    ));
  };

  const removeQuestion = (questionId: string) => {
    setAdditionalQuestions(prev => prev.filter(q => q.id !== questionId));
    const newAnswers = { ...questionAnswers };
    delete newAnswers[questionId];
    setQuestionAnswers(newAnswers);
  };

  const deployAgent = async () => {
    setIsLoading(true);
    try {
      const result = await formSubmissionService.deployAgent({
        agentId,
        coreFields,
        additionalQuestions,
        formLink,
        webhookLink
      });

      if (result.error) {
        Alert.alert('Deployment Error', result.error);
        return;
      }

      Alert.alert('Success!', 'Your Form Submission Call Agent is now active', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
      
    } catch (error) {
      Alert.alert('Error', 'Agent deployment failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-gray-900 p-4">
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white text-xl">Form Submission Call Agent</CardTitle>
          <Text className="text-gray-400">
            Collect client information and book appointments automatically
          </Text>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Core Form Fields */}
          <View className="space-y-4">
            <Text className="text-white text-lg font-semibold">Required Information</Text>
            {coreFields.map((field) => (
              <View key={field.id}>
                <Text className="text-gray-300 mb-2">{field.label}</Text>
                <Input
                  className="bg-gray-700 border-gray-600 text-white"
                  placeholder={`Enter ${field.label.toLowerCase()}`}
                  value={field.value}
                  onChangeText={(value) => updateFieldValue(field.id, value)}
                  keyboardType={
                    field.type === 'email' ? 'email-address' :
                    field.type === 'phone' ? 'phone-pad' : 'default'
                  }
                />
              </View>
            ))}
          </View>

          {/* Payment/Activation Button */}
          {!isPaid && (
            <Button
              className={`w-full ${isFormValid() ? 'bg-blue-600' : 'bg-gray-600'}`}
              disabled={!isFormValid() || isLoading}
              onPress={handlePayment}
            >
              <Text className="text-white font-semibold">
                {isLoading ? 'Processing...' : 'Activate Agent ($29/month)'}
              </Text>
            </Button>
          )}

          {/* Post-Payment Configuration */}
          {isPaid && (
            <>
              <View className="space-y-4">
                <View className="flex-row items-center justify-between">
                  <Text className="text-white text-lg font-semibold">Agent Links</Text>
                  <Badge className="bg-green-600">
                    <Text className="text-white text-xs">ACTIVE</Text>
                  </Badge>
                </View>
                
                <View>
                  <Text className="text-gray-300 mb-2">Form Link</Text>
                  <Text className="text-blue-400 text-xs bg-gray-700 p-2 rounded">
                    {formLink}
                  </Text>
                </View>

                {webhookLink && (
                  <View>
                    <Text className="text-gray-300 mb-2">Webhook URL</Text>
                    <Text className="text-blue-400 text-xs bg-gray-700 p-2 rounded">
                      {webhookLink}
                    </Text>
                  </View>
                )}
              </View>

              {/* Additional Questions */}
              <View className="space-y-4">
                <View className="flex-row items-center justify-between">
                  <Text className="text-white text-lg font-semibold">
                    Additional Questions ({additionalQuestions.length}/10)
                  </Text>
                  <TouchableOpacity
                    onPress={addQuestion}
                    disabled={additionalQuestions.length >= 10}
                    className={`px-4 py-2 rounded ${
                      additionalQuestions.length >= 10 ? 'bg-gray-600' : 'bg-blue-600'
                    }`}
                  >
                    <Text className="text-white text-sm">+ Add</Text>
                  </TouchableOpacity>
                </View>

                {additionalQuestions.map((question, index) => (
                  <Card key={question.id} className="bg-gray-700 border-gray-600">
                    <CardContent className="p-4 space-y-3">
                      <View className="flex-row justify-between items-center">
                        <Text className="text-gray-300">Question {index + 1}</Text>
                        <TouchableOpacity
                          onPress={() => removeQuestion(question.id)}
                          className="bg-red-600 px-2 py-1 rounded"
                        >
                          <Text className="text-white text-xs">Remove</Text>
                        </TouchableOpacity>
                      </View>
                      
                      <Input
                        className="bg-gray-600 border-gray-500 text-white"
                        placeholder="What question should the agent ask?"
                        value={question.question}
                        onChangeText={(text) => updateQuestion(question.id, { question: text })}
                      />
                    </CardContent>
                  </Card>
                ))}
              </View>

              {/* Deploy Button */}
              <Button
                className="w-full bg-green-600"
                disabled={isLoading}
                onPress={deployAgent}
              >
                <Text className="text-white font-semibold">
                  {isLoading ? 'Deploying...' : 'Deploy Call Agent'}
                </Text>
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </ScrollView>
  );
};
