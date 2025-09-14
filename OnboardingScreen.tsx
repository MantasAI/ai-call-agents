import React from 'react';
import { motion } from 'framer-motion';
import HeroSection from './HeroSection';
import AgentCarousel from './AgentCarousel';
import LiveDemoForm from './LiveDemoForm';
import PricingSection from './PricingSection';
import Footer from './Footer';

const OnboardingScreen: React.FC = () => {
  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white"
      role="main"
      aria-label="AI Agent Onboarding Interface"
    >
      <div className="w-full max-w-md mx-auto px-4 py-6 space-y-8">
        <section 
          className="space-y-2"
          role="banner"
          aria-labelledby="hero-section"
        >
          <HeroSection />
        </section>

        <section 
          className="space-y-4"
          role="region"
          aria-labelledby="agent-carousel-section"
        >
          <AgentCarousel />
        </section>

        <section 
          className="space-y-4"
          role="region"
          aria-labelledby="demo-form-section"
        >
          <LiveDemoForm />
        </section>

        <section 
          className="space-y-4"
          role="region"
          aria-labelledby="pricing-section"
        >
          <PricingSection />
        </section>

        <footer 
          className="pt-8 border-t border-slate-800"
          role="contentinfo"
          aria-label="Site footer"
        >
          <Footer />
        </footer>
      </div>
    </motion.main>
  );
};

export default OnboardingScreen;
