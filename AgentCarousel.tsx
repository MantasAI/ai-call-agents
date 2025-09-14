import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';

interface Agent {
  id: string;
  name: string;
  role: string;
  languages: string[];
  highlight: string;
}

const agents: Agent[] = [
  {
    id: '1',
    name: 'Nova',
    role: 'Code Assistant',
    languages: ['Python', 'TypeScript'],
    highlight: 'AI-powered debugging'
  },
  {
    id: '2',
    name: 'Axel',
    role: 'Data Analyst',
    languages: ['SQL', 'R'],
    highlight: 'Real-time insights'
  },
  {
    id: '3',
    name: 'Zara',
    role: 'Content Creator',
    languages: ['Markdown', 'HTML'],
    highlight: 'Creative automation'
  }
];

const AgentCarousel: React.FC = () => {
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold text-primary px-2">AI Agents</h2>
      
      <div className="overflow-x-auto scrollbar-hide">
        <div className="flex gap-4 pb-4 snap-x snap-mandatory px-2">
          {agents.map((agent) => (
            <motion.div
              key={agent.id}
              whileHover={{ scale: 1.02 }}
              transition={{ duration: 0.2 }}
              className="flex-shrink-0 snap-start"
            >
              <Card className="w-64 bg-slate-800/50 border-slate-700 backdrop-blur-sm">
                <CardContent className="p-4 space-y-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-10 h-10 bg-gradient-to-br from-primary to-accent">
                      <span className="text-sm font-bold text-white">
                        {agent.name[0]}
                      </span>
                    </Avatar>
                    <div>
                      <h3 className="font-semibold text-white">{agent.name}</h3>
                      <p className="text-sm text-slate-400">{agent.role}</p>
                    </div>
                  </div>

                  <p className="text-sm text-accent font-medium">
                    {agent.highlight}
                  </p>

                  <div className="flex flex-wrap gap-1">
                    {agent.languages.map((lang) => (
                      <span
                        key={lang}
                        className="px-2 py-1 text-xs bg-slate-700 text-slate-300 rounded-full"
                      >
                        {lang}
                      </span>
                    ))}
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
                    aria-label={`Start demo with ${agent.name} AI agent`}
                  >
                    Start Demo
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default AgentCarousel;
