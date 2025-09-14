import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Rocket, Phone } from 'lucide-react';

const HeroSection: React.FC = () => {
  return (
    <header className="text-center space-y-6">
      <div className="space-y-3">
        <Badge 
          variant="secondary" 
          className="bg-slate-800/50 text-accent border-accent/20 backdrop-blur-sm"
        >
          Dark-mode • Mobile-first • AI-driven
        </Badge>
        
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="text-3xl sm:text-4xl font-bold leading-tight"
        >
          <span className="text-primary">Next-Gen AI Agents</span>
          <br />
          <span className="relative">
            Built for Tomorrow
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 1, delay: 0.5 }}
              className="absolute -bottom-1 left-0 right-0 h-0.5 bg-gradient-to-r from-accent to-primary origin-left"
            />
          </span>
        </motion.h1>

        <motion.p 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="text-slate-300 text-base leading-relaxed max-w-xs mx-auto"
        >
          Experience intelligent automation that adapts to your workflow and scales with your ambitions.
        </motion.p>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.6 }}
        className="flex flex-col gap-3"
        role="group"
        aria-label="Primary actions"
      >
        <Button 
          size="lg"
          className="bg-primary hover:bg-primary/90 ring-offset-slate-950 focus:ring-primary"
          aria-label="Start live demo experience"
        >
          <Rocket className="w-4 h-4 mr-2" />
          Try Live Demo
        </Button>
        
        <Button 
          variant="ghost" 
          size="lg"
          className="text-slate-300 hover:text-white border-slate-700 hover:bg-slate-800/50"
          aria-label="Browse available AI agents"
        >
          <Phone className="w-4 h-4 mr-2" />
          Explore Agents
        </Button>
      </motion.div>
    </header>
  );
};

export default HeroSection;
