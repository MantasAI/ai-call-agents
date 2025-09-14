import React, { useState, useEffect } from 'react';
import { ScrollView, View, Alert, Pressable } from 'react-native';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, Phone, Mail, User, Zap } from 'lucide-react-native';
import { formSubmissionService } from '../services/formSubmissionService';

interface AdditionalQuestion {
  id: string;
  question: string;
  required: boolean;
}

interface FormData {
  name: string;
  email: string;
  phone: string;
  additionalAnswers: Record<string, string>;
}

export const FormSubmissionScreen: React.FC = () => {
  // Form state
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    phone: '',
    additionalAnswers: {}
  });

  // Additional questions state
  const [additionalQuestions, setAdditionalQuestions] = useState<AdditionalQuestion[]>([
    { id: '1', question: 'What is your biggest business challenge?', required: true },
    { id: '2', question: 'What is your monthly budget range?', required: true },
    { id: '3', question: 'When do you need this solution implemented?', required: true }
  ]);

  // Payment and submission state
  const [isPaid, setIsPaid] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // Validation state
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Check if required fields are filled
  const areRequiredFieldsFilled = () => {
    const requiredFieldsFilled = formData.name.trim() !== '' && 
                                 formData.email.trim() !== '' && 
                                 formData.phone.trim() !== '';
    
    const requiredQuestionsFilled = additionalQuestions
      .filter(q => q.required)
      .every(q => formData.additionalAnswers[q.id]?.trim() !== '');

    return requiredFieldsFilled && requiredQuestionsFilled;
  };

  // Validate email format
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Validate phone format (basic validation)
  const validatePhone = (phone: string): boolean => {
    const phoneRegex = /^[\+]?[1-9][\d]{3,14}$/;
    return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
  };

  // Handle input changes with validation
  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear errors on input
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }

    // Real-time validation
    if (field === 'email' && value && !validateEmail(value)) {
      setErrors(prev => ({ ...prev, email: 'Please enter a valid email address' }));
    }
    if (field === 'phone' && value && !validatePhone(value)) {
      setErrors(prev => ({ ...prev, phone: 'Please enter a valid phone number' }));
    }
  };

  // Handle additional question answer changes
  const handleAdditionalAnswerChange = (questionId: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      additionalAnswers: {
        ...prev.additionalAnswers,
        [questionId]: value
      }
    }));
  };

  // Add new additional question (only after payment)
  const addAdditionalQuestion = () => {
    if (!isPaid) return;
    
    if (additionalQuestions.length >= 10) {
      Alert.alert('Limit Reached', 'You can add up to 10 additional questions.');
      return;
    }

    const newQuestion: AdditionalQuestion = {
      id: Date.now().toString(),
      question: '',
      required: false
    };
    
    setAdditionalQuestions(prev => [...prev, newQuestion]);
  };

  // Remove additional question
  const removeAdditionalQuestion = (questionId: string) => {
    // Don't allow removal if it brings us below 3 questions or if it's a default required question
    if (additionalQuestions.length <= 3) {
      Alert.alert('Minimum Required', 'You must have at least 3 additional questions.');
      return;
    }

    setAdditionalQuestions(prev => prev.filter(q => q.id !== questionId));
    
    // Remove corresponding answer
    setFormData(prev => {
      const newAnswers = { ...prev.additionalAnswers };
      delete newAnswers[questionId];
      return { ...prev, additionalAnswers: newAnswers };
    });
  };

  // Update question text
  const updateQuestionText = (questionId: string, text: string) => {
    setAdditionalQuestions(prev => 
      prev.map(q => q.id === questionId ? { ...q, question: text } : q)
    );
  };

  // Handle payment flow
  const handlePayment = async () => {
    if (!areRequiredFieldsFilled()) {
      Alert.alert('Missing Information', 'Please fill all required fields before proceeding to payment.');
      return;
    }

    setIsProcessingPayment(true);
    
    try {
      const paymentResult = await formSubmissionService.handlePayment({
        amount: 97, // $97 for premium features
        description: 'AI Call Agent Premium Features'
      });

      if (paymentResult.success) {
        setIsPaid(true);
        Alert.alert('Payment Successful', 'You can now add up to 10 additional questions and submit your form to go live!');
      } else {
        Alert.alert('Payment Failed', paymentResult.error || 'Payment could not be processed. Please try again.');
      }
    } catch (error) {
      Alert.alert('Payment Error', 'An unexpected error occurred during payment processing.');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // Handle form submission
  const handleSubmit = async () => {
    if (!isPaid) {
      Alert.alert('Payment Required', 'Please complete payment to submit and go live.');
      return;
    }

    // Validate all fields
    const newErrors: Record<string, string> = {};
    
    if (!formData.name.trim()) newErrors.name = 'Name is required';
    if (!formData.email.trim()) newErrors.email = 'Email is required';
    else if (!validateEmail(formData.email)) newErrors.email = 'Please enter a valid email address';
    if (!formData.phone.trim()) newErrors.phone = 'Phone is required';
    else if (!validatePhone(formData.phone)) newErrors.phone = 'Please enter a valid phone number';

    // Check if all questions have text
    const emptyQuestions = additionalQuestions.filter(q => !q.question.trim());
    if (emptyQuestions.length > 0) {
      newErrors.questions = 'Please fill in all question fields';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      Alert.alert('Validation Error', 'Please fix the errors and try again.');
      return;
    }

    setIsSubmitting(true);

    try {
      const submission = {
        ...formData,
        additionalQuestions: additionalQuestions,
        timestamp: new Date().toISOString()
      };

      const result = await formSubmissionService.submitForm(submission);
      
      if (result.success) {
        Alert.alert(
          'Success!', 
          `Your AI Call Agent is now live! API Number: ${result.apiNumber}`,
          [{ text: 'OK', onPress: () => {/* Navigate to dashboard or success screen */} }]
        );
      } else {
        Alert.alert('Submission Error', result.error || 'Failed to submit form. Please try again.');
      }
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-background">
      <View className="p-4 space-y-6">
        {/* Header */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-foreground flex-row items-center">
              <Zap className="w-6 h-6 text-primary mr-2" />
              AI Call Agent Setup
            </CardTitle>
          </CardHeader>
        </Card>

        {/* Required Fields Section */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-lg text-foreground">Required Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Name Field */}
            <View>
              <Label className="text-foreground mb-2 flex-row items-center">
                <User className="w-4 h-4 mr-2" />
                Full Name *
              </Label>
              <Input
                placeholder="Enter your full name"
                value={formData.name}
                onChangeText={(value) => handleInputChange('name', value)}
                className={`${errors.name ? 'border-destructive' : 'border-border'}`}
              />
              {errors.name && <Label className="text-destructive text-sm mt-1">{errors.name}</Label>}
            </View>

            {/* Email Field */}
            <View>
              <Label className="text-foreground mb-2 flex-row items-center">
                <Mail className="w-4 h-4 mr-2" />
                Email Address *
              </Label>
              <Input
                placeholder="Enter your email address"
                value={formData.email}
                onChangeText={(value) => handleInputChange('email', value)}
                keyboardType="email-address"
                autoCapitalize="none"
                className={`${errors.email ? 'border-destructive' : 'border-border'}`}
              />
              {errors.email && <Label className="text-destructive text-sm mt-1">{errors.email}</Label>}
            </View>

            {/* Phone Field */}
            <View>
              <Label className="text-foreground mb-2 flex-row items-center">
                <Phone className="w-4 h-4 mr-2" />
                Phone Number *
              </Label>
              <Input
                placeholder="Enter your phone number"
                value={formData.phone}
                onChangeText={(value) => handleInputChange('phone', value)}
                keyboardType="phone-pad"
                className={`${errors.phone ? 'border-destructive' : 'border-border'}`}
              />
              {errors.phone && <Label className="text-destructive text-sm mt-1">{errors.phone}</Label>}
            </View>
          </CardContent>
        </Card>

        {/* Additional Questions Section */}
        <Card className="bg-card border-border">
          <CardHeader className="flex-row justify-between items-center">
            <CardTitle className="text-lg text-foreground">
              Additional Questions ({additionalQuestions.length}/10)
            </CardTitle>
            {isPaid && additionalQuestions.length < 10 && (
              <Pressable onPress={addAdditionalQuestion}>
                <Plus className="w-5 h-5 text-primary" />
              </Pressable>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {additionalQuestions.map((question, index) => (
              <View key={question.id} className="space-y-2">
                <View className="flex-row justify-between items-center">
                  <Label className="text-foreground font-medium">
                    Question {index + 1} {question.required && '*'}
                  </Label>
                  {isPaid && !question.required && additionalQuestions.length > 3 && (
                    <Pressable onPress={() => removeAdditionalQuestion(question.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Pressable>
                  )}
                </View>
                
                <Textarea
                  placeholder="Enter your question"
                  value={question.question}
                  onChangeText={(text) => updateQuestionText(question.id, text)}
                  className="border-border"
                  editable={isPaid || index < 3}
                />
                
                <Textarea
                  placeholder="Client's answer will appear here"
                  value={formData.additionalAnswers[question.id] || ''}
                  onChangeText={(text) => handleAdditionalAnswerChange(question.id, text)}
                  className="border-border bg-muted/50"
                  multiline
                />
              </View>
            ))}
            
            {errors.questions && (
              <Label className="text-destructive text-sm">{errors.questions}</Label>
            )}
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <View className="space-y-3">
          {!isPaid ? (
            <Button
              onPress={handlePayment}
              disabled={!areRequiredFieldsFilled() || isProcessingPayment}
              className={`w-full ${
                areRequiredFieldsFilled() 
                  ? 'bg-primary hover:bg-primary/90' 
                  : 'bg-muted hover:bg-muted/90'
              }`}
            >
              {isProcessingPayment ? 'Processing Payment...' : 'Activate Premium Features - $97'}
            </Button>
          ) : (
            <Button
              onPress={handleSubmit}
              disabled={!areRequiredFieldsFilled() || isSubmitting}
              className="w-full bg-primary hover:bg-primary/90"
            >
              {isSubmitting ? 'Submitting...' : 'Submit & Go Live'}
            </Button>
          )}
        </View>

        {/* Status Indicators */}
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <View className="space-y-2">
              <View className="flex-row items-center">
                <View className={`w-3 h-3 rounded-full mr-3 ${
                  areRequiredFieldsFilled() ? 'bg-green-500' : 'bg-yellow-500'
                }`} />
                <Label className="text-foreground">
                  Required fields {areRequiredFieldsFilled() ? 'completed' : 'pending'}
                </Label>
              </View>
              
              <View className="flex-row items-center">
                <View className={`w-3 h-3 rounded-full mr-3 ${
                  isPaid ? 'bg-green-500' : 'bg-red-500'
                }`} />
                <Label className="text-foreground">
                  Payment {isPaid ? 'completed' : 'required'}
                </Label>
              </View>
            </View>
          </CardContent>
        </Card>
      </View>
    </ScrollView>
  );
};
