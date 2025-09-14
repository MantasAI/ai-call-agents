import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/lib/supabaseClient';

const emailSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const phoneSchema = z.object({
  phone: z.string().min(10, 'Phone number must be at least 10 digits'),
});

type EmailFormData = z.infer<typeof emailSchema>;
type PhoneFormData = z.infer<typeof phoneSchema>;

export default function RegisterScreen() {
  const navigation = useNavigation();
  const [registrationMode, setRegistrationMode] = useState<'email' | 'phone'>('email');
  const [loading, setLoading] = useState(false);

  const emailForm = useForm<EmailFormData>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: '', password: '' },
  });

  const phoneForm = useForm<PhoneFormData>({
    resolver: zodResolver(phoneSchema),
    defaultValues: { phone: '' },
  });

  const handleEmailRegistration = async (data: EmailFormData) => {
    setLoading(true);
    try {
      const { data: authData, error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
      });

      if (error) throw new Error(error.message);

      const fraudResponse = await fetch('/api/fraud/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.email, userId: authData.user?.id }),
      });

      if (!fraudResponse.ok) {
        throw new Error('Fraud detection failed');
      }

      Alert.alert('Success', 'Registration successful!');
      navigation.navigate('IDVerification' as never);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneRegistration = async (data: PhoneFormData) => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone: data.phone,
      });

      if (error) throw new Error(error.message);

      const fraudResponse = await fetch('/api/fraud/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: data.phone }),
      });

      if (!fraudResponse.ok) {
        throw new Error('Fraud detection failed');
      }

      Alert.alert('Success', 'OTP sent successfully!');
      navigation.navigate('IDVerification' as never);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-white px-6 pt-12">
      <Text className="text-2xl font-bold text-center mb-8">Create Account</Text>
      
      <View className="flex-row mb-6">
        <TouchableOpacity
          className={`flex-1 py-3 rounded-l-lg ${registrationMode === 'email' ? 'bg-blue-500' : 'bg-gray-200'}`}
          onPress={() => setRegistrationMode('email')}
          testID="email-tab"
        >
          <Text className={`text-center font-medium ${registrationMode === 'email' ? 'text-white' : 'text-gray-600'}`}>
            Email
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          className={`flex-1 py-3 rounded-r-lg ${registrationMode === 'phone' ? 'bg-blue-500' : 'bg-gray-200'}`}
          onPress={() => setRegistrationMode('phone')}
          testID="phone-tab"
        >
          <Text className={`text-center font-medium ${registrationMode === 'phone' ? 'text-white' : 'text-gray-600'}`}>
            Phone
          </Text>
        </TouchableOpacity>
      </View>

      {registrationMode === 'email' ? (
        <View>
          <Controller
            control={emailForm.control}
            name="email"
            render={({ field: { onChange, value }, fieldState: { error } }) => (
              <View className="mb-4">
                <Text className="text-gray-700 mb-2" accessibilityLabel="Email">Email</Text>
                <TextInput
                  className="border border-gray-300 rounded-lg px-4 py-3 text-base"
                  placeholder="Enter your email"
                  value={value}
                  onChangeText={onChange}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  testID="email-input"
                />
                {error && <Text className="text-red-500 text-sm mt-1">{error.message}</Text>}
              </View>
            )}
          />
          
          <Controller
            control={emailForm.control}
            name="password"
            render={({ field: { onChange, value }, fieldState: { error } }) => (
              <View className="mb-6">
                <Text className="text-gray-700 mb-2" accessibilityLabel="Password">Password</Text>
                <TextInput
                  className="border border-gray-300 rounded-lg px-4 py-3 text-base"
                  placeholder="Enter your password"
                  value={value}
                  onChangeText={onChange}
                  secureTextEntry
                  testID="password-input"
                />
                {error && <Text className="text-red-500 text-sm mt-1">{error.message}</Text>}
              </View>
            )}
          />
        </View>
      ) : (
        <View>
          <Controller
            control={phoneForm.control}
            name="phone"
            render={({ field: { onChange, value }, fieldState: { error } }) => (
              <View className="mb-6">
                <Text className="text-gray-700 mb-2" accessibilityLabel="Phone Number">Phone Number</Text>
                <TextInput
                  className="border border-gray-300 rounded-lg px-4 py-3 text-base"
                  placeholder="Enter your phone number"
                  value={value}
                  onChangeText={onChange}
                  keyboardType="phone-pad"
                  testID="phone-input"
                />
                {error && <Text className="text-red-500 text-sm mt-1">{error.message}</Text>}
              </View>
            )}
          />
        </View>
      )}

      <TouchableOpacity
        className="bg-blue-500 py-4 rounded-lg mb-4"
        onPress={registrationMode === 'email' 
          ? emailForm.handleSubmit(handleEmailRegistration)
          : phoneForm.handleSubmit(handlePhoneRegistration)
        }
        disabled={loading}
        testID="register-button"
      >
        {loading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text className="text-white text-center font-semibold text-base">
            {registrationMode === 'email' ? 'Create Account' : 'Send OTP'}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}
