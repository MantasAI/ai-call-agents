import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectItem } from '@/components/ui/select';

interface FormValues {
  name: string;
  contact: string;
  agent: string;
  language: string;
}

interface LiveDemoFormProps {
  onStartDemo?: (data: FormValues) => void;
}

const LiveDemoForm: React.FC<LiveDemoFormProps> = ({ onStartDemo }) => {
  const [formData, setFormData] = useState<FormValues>({
    name: '',
    contact: '',
    agent: '',
    language: ''
  });
  const [errors, setErrors] = useState<Partial<FormValues>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');

  const validateForm = (): boolean => {
    const newErrors: Partial<FormValues> = {};
    
    if (!formData.name.trim()) newErrors.name = 'Name is required';
    if (!formData.contact.trim()) newErrors.contact = 'Email or phone is required';
    if (!formData.agent) newErrors.agent = 'Please select an agent';
    if (!formData.language) newErrors.language = 'Please select a language';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setIsSubmitting(true);
    setSubmitMessage('');
    
    setTimeout(() => {
      setSubmitMessage('Demo starting...');
      onStartDemo?.(formData);
      setIsSubmitting(false);
    }, 1500);
  };

  const handleInputChange = (field: keyof FormValues, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold text-primary">Start Live Demo</h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1">
          <Input
            placeholder="Your name"
            value={formData.name}
            onChange={(e) => handleInputChange('name', e.target.value)}
            className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-400"
            aria-invalid={!!errors.name}
            aria-label="Enter your full name"
          />
          {errors.name && (
            <p className="text-xs text-red-400" role="alert">{errors.name}</p>
          )}
        </div>

        <div className="space-y-1">
          <Input
            placeholder="Email or phone"
            value={formData.contact}
            onChange={(e) => handleInputChange('contact', e.target.value)}
            className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-400"
            aria-invalid={!!errors.contact}
            aria-label="Enter email or phone number"
          />
          {errors.contact && (
            <p className="text-xs text-red-400" role="alert">{errors.contact}</p>
          )}
        </div>

        <Button
          type="submit"
          className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50"
          disabled={isSubmitting}
          aria-label="Submit demo request"
        >
          {isSubmitting ? 'Starting Demo...' : 'Start Demo'}
        </Button>
        
        <div aria-live="polite" className="text-center">
          {submitMessage && (
            <p className="text-sm text-accent font-medium">{submitMessage}</p>
          )}
        </div>
      </form>
    </section>
  );
};

export default LiveDemoForm;
