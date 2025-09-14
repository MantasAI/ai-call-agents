import React from 'react';
import { NavLink } from "react-router-dom";
import { Home, Users, Calendar, Phone, Wallet, Settings, Briefcase } from "lucide-react";

interface TabItem {
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}

const tabs: TabItem[] = [
  {
    path: '/dashboard',
    icon: Home,
    label: 'Home'
  },
  {
    path: '/agents',
    icon: Users,
    label: 'Agents'
  },
  {
    path: '/crm',
    icon: Briefcase,
    label: 'CRM'
  },
  {
    path: '/calendar',
    icon: Calendar,
    label: 'Calendar'
  },
  {
    path: '/calls',
    icon: Phone,
    label: 'Calls'
  },
  {
    path: '/wallet',
    icon: Wallet,
    label: 'Wallet'
  },
  {
    path: '/settings',
    icon: Settings,
    label: 'Settings'
  }
];

const BottomTabNavigator: React.FC = () => {
  return (
    <nav className="md:hidden" role="navigation" aria-label="Main navigation">
      <div className="flex justify-around items-center py-2 px-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          
          return (
            <NavLink
              key={tab.path}
              to={tab.path}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center px-2 py-1 min-w-0 flex-1 transition-colors duration-200 ${
                  isActive
                    ? 'text-blue-400'
                    : 'text-gray-400 hover:text-gray-300'
                }`
              }
              aria-label={tab.label}
            >
              {({ isActive }) => (
                <>
                  <div
                    className={`p-1 rounded-lg transition-all duration-200 ${
                      isActive
                        ? 'bg-blue-400/20'
                        : 'hover:bg-gray-700/50'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <span
                    className={`text-xs mt-1 font-medium truncate max-w-full ${
                      isActive ? 'text-blue-400' : 'text-gray-400'
                    }`}
                  >
                    {tab.label}
                  </span>
                  {isActive && (
                    <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-blue-400 rounded-full" />
                  )}
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomTabNavigator;
