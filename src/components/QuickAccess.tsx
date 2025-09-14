import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Clock, Phone } from "lucide-react";

interface QuickAccessProps {
  onStart?: () => void;
}

interface QuickActionItem {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  type: 'link' | 'action';
  path?: string;
  action?: () => void;
  variant?: 'default' | 'primary';
}

const QuickAccess: React.FC<QuickAccessProps> = ({ onStart }) => {
  const quickActions: QuickActionItem[] = [
    {
      id: 'agents',
      title: 'Agents',
      description: 'Manage AI agents',
      icon: Users,
      type: 'link',
      path: '/agents'
    },
    {
      id: 'call-logs',
      title: 'Call Logs',
      description: 'View recent calls',
      icon: Clock,
      type: 'link',
      path: '/calls'
    },
    {
      id: 'start-call',
      title: 'Start Call',
      description: 'Begin new call',
      icon: Phone,
      type: 'action',
      action: onStart,
      variant: 'primary'
    }
  ];

  const renderAction = (action: QuickActionItem) => {
    const Icon = action.icon;
    const isPrimary = action.variant === 'primary';
    
    const content = (
      <Card 
        className={`transition-all duration-200 hover:scale-105 cursor-pointer ${
          isPrimary 
            ? 'bg-blue-600 border-blue-500 hover:bg-blue-700' 
            : 'bg-gray-800 border-gray-700 hover:bg-gray-750'
        }`}
      >
        <CardContent className="p-4 text-center">
          <div className={`mx-auto mb-3 p-3 rounded-full w-fit ${
            isPrimary ? 'bg-blue-500' : 'bg-gray-700'
          }`}>
            <Icon className={`w-6 h-6 ${isPrimary ? 'text-white' : 'text-gray-300'}`} />
          </div>
          <h3 className={`font-semibold text-sm mb-1 ${
            isPrimary ? 'text-white' : 'text-gray-100'
          }`}>
            {action.title}
          </h3>
          <p className={`text-xs ${
            isPrimary ? 'text-blue-100' : 'text-gray-400'
          }`}>
            {action.description}
          </p>
        </CardContent>
      </Card>
    );

    if (action.type === 'link' && action.path) {
      return (
        <Link key={action.id} to={action.path} className="block">
          {content}
        </Link>
      );
    }

    if (action.type === 'action' && action.action) {
      return (
        <button
          key={action.id}
          onClick={action.action}
          className="block w-full text-left"
        >
          {content}
        </button>
      );
    }

    return (
      <div key={action.id} className="block">
        {content}
      </div>
    );
  };

  return (
    <div className="w-full">
      <h3 className="text-lg font-medium text-white mb-4">Quick Access</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {quickActions.map(renderAction)}
      </div>
    </div>
  );
};

export default QuickAccess;
