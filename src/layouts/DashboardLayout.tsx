import React, { ReactNode } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import WalletBalance from "@/components/wallet-balance";
import BottomTabNavigator from "@/navigation/bottom-tab-navigator";
import { Bell } from "lucide-react";

interface DashboardLayoutProps {
  children: ReactNode;
  notificationsCount?: number;
  walletBalance?: string;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  children,
  notificationsCount = 3,
  walletBalance = "$1,250.00"
}) => {
  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col">
      {/* Fixed Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-gray-800 border-b border-gray-700">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold text-white">Call Agents</h1>
          </div>
          
          <div className="flex items-center space-x-3">
            {/* Wallet Balance */}
            <div className="hidden sm:block">
              <WalletBalance balance={walletBalance} />
            </div>
            
            {/* Notification Bell */}
            <Button
              variant="ghost"
              size="sm"
              className="relative p-2 hover:bg-gray-700"
            >
              <Bell className="h-5 w-5 text-gray-300" />
              {notificationsCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {notificationsCount > 9 ? '9+' : notificationsCount}
                </span>
              )}
            </Button>
          </div>
        </div>
        
        {/* Mobile Wallet Balance */}
        <div className="sm:hidden px-4 pb-3">
          <WalletBalance balance={walletBalance} />
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 pt-16 sm:pt-20 pb-20 overflow-auto">
        <div className="container mx-auto px-4 py-6">
          {children}
        </div>
      </main>

      {/* Fixed Bottom Navigation */}
      <footer className="fixed bottom-0 left-0 right-0 z-50 bg-gray-800 border-t border-gray-700">
        <BottomTabNavigator />
      </footer>
    </div>
  );
};

export default DashboardLayout;
