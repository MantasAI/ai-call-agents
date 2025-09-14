import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/lib/supabaseClient';

const emailSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const phoneSchema = z.object({
  phone: z.string().min(10, 'Phone number must be at least 10 digits'),
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

type EmailFormData = z.infer<typeof emailSchema>;
type PhoneFormData = z.infer<typeof phoneSchema>;
type ForgotPasswordData = z.infer<typeof forgotPasswordSchema>;

export default function LoginScreen() {
  const navigation = useNavigation();
  const [loginMode, setLoginMode] = useState<'email' | 'phone' | 'forgot'>('email');
  const [loading, setLoading] = useState(false);

  const emailForm = useForm<EmailFormData>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: '', password: '' },
  });

  const phoneForm = useForm<PhoneFormData>({
    resolver: zodResolver(phoneSchema),
    defaultValues: { phone: '' },
  });

  const forgotForm = useForm<ForgotPasswordData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const handleEmailLogin = async (data: EmailFormData) => {
    setLoading(true);
    try {
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (error) throw new Error(error.message);

      const fraudResponse = await fetch('/api/fraud/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: authData.user.id, device: 'mobile' }),
      });

      if (!fraudResponse.ok) throw new Error('Security check failed');

      navigation.navigate('Home' as never);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneLogin = async (data: PhoneFormData) => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone: data.phone });
      if (error) throw new Error(error.message);
      Alert.alert('Success', 'OTP sent to your phone');
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (data: ForgotPasswordData) => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(data.email);
      if (error) throw new Error(error.message);
      Alert.alert('Success', 'Password reset email sent');
      setLoginMode('email');
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-white px-6 pt-16">
      <Text className="text-3xl font-bold text-center mb-8">Welcome Back</Text>
      
      <View className="flex-row mb-6">
        <TouchableOpacity
          className={`flex-1 py-3 rounded-l-lg ${loginMode === 'email' ? 'bg-blue-500' : 'bg-gray-200'}`}
          onPress={() => setLoginMode('email')}
          testID="email-tab"
        >
          <Text className={`text-center font-medium ${loginMode === 'email' ? 'text-white' : 'text-gray-600'}`}>Email</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className={`flex-1 py-3 rounded-r-lg ${loginMode === 'phone' ? 'bg-blue-500' : 'bg-gray-200'}`}
          onPress={() => setLoginMode('phone')}
          testID="phone-tab"
        >
          <Text className={`text-center font-medium ${loginMode === 'phone' ? 'text-white' : 'text-gray-600'}`}>Phone</Text>
        </TouchableOpacity>
      </View>

      {loginMode === 'email' && (
        <View>
          <Controller
            control={emailForm.control}
            name="email"
            render={({ field: { onChange, value }, fieldState: { error } }) => (
              <View className="mb-4">
                <TextInput
                  className="border border-gray-300 rounded-lg px-4 py-3 text-base"
                  placeholder="Email"
                  value={value}
                  onChangeText={onChange}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  testID="email-input"
                  accessibilityLabel="Email"
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
                <TextInput
                  className="border border-gray-300 rounded-lg px-4 py-3 text-base"
                  placeholder="Password"
                  value={value}
                  onChangeText={onChange}
                  secureTextEntry
                  testID="password-input"
                  accessibilityLabel="Password"
                />
                {error && <Text className="text-red-500 text-sm mt-1">{error.message}</Text>}
              </View>
            )}
          />
        </View>
      )}

      {loginMode === 'phone' && (
        <Controller
          control={phoneForm.control}
          name="phone"
          render={({ field: { onChange, value }, fieldState: { error } }) => (
            <View className="mb-6">
              <TextInput
                className="border border-gray-300 rounded-lg px-4 py-3 text-base"
                placeholder="Phone Number"
                value={value}
                onChangeText={onChange}
                keyboardType="phone-pad"
                testID="phone-input"
                accessibilityLabel="Phone Number"
              />
              {error && <Text className="text-red-500 text-sm mt-1">{error.message}</Text>}
            </View>
          )}
        />
      )}

      {loginMode === 'forgot' && (
        <Controller
          control={forgotForm.control}
          name="email"
          render={({ field: { onChange, value }, fieldState: { error } }) => (
            <View className="mb-6">
              <TextInput
                className="border border-gray-300 rounded-lg px-4 py-3 text-base"
                placeholder="Enter email for password reset"
                value={value}
                onChangeText={onChange}
                keyboardType="email-address"
                autoCapitalize="none"
                testID="forgot-email-input"
                accessibilityLabel="Reset Email"
              />
              {error && <Text className="text-red-500 text-sm mt-1">{error.message}</Text>}
            </View>
          )}
        />
      )}

      <TouchableOpacity
        className="bg-blue-500 py-4 rounded-lg mb-4"
        onPress={
          loginMode === 'email' 
            ? emailForm.handleSubmit(handleEmailLogin)
            : loginMode === 'phone'
            ? phoneForm.handleSubmit(handlePhoneLogin)
            : forgotForm.handleSubmit(handleForgotPassword)
        }
        disabled={loading}
        testID="login-button"
      >
        {loading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text className="text-white text-center font-semibold text-base">
            {loginMode === 'email' ? 'Sign In' : loginMode === 'phone' ? 'Send OTP' : 'Send Reset Email'}
          </Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => setLoginMode(loginMode === 'forgot' ? 'email' : 'forgot')}
        testID="forgot-password-link"
      >
        <Text className="text-blue-500 text-center">
          {loginMode === 'forgot' ? 'Back to Sign In' : 'Forgot Password?'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
