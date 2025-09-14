import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CreditCard, TrendingUp, Plus } from "lucide-react";

interface WalletBalanceProps {
  balance?: number;
}

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  }).format(amount);
};

const WalletBalance: React.FC<WalletBalanceProps> = ({ balance = 0 }) => {
  // Mock recent spending data for sparkline
  const recentSpend = [12, 8, 15, 3, 9, 18, 6];
  const maxSpend = Math.max(...recentSpend);
  
  return (
    <Card className="bg-gray-800 border-gray-700">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <CreditCard className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Wallet Balance</p>
              <p className="text-xl font-bold text-white" aria-label={`Current balance: ${formatCurrency(balance)}`}>
                {formatCurrency(balance)}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            {/* Mini sparkline */}
            <div className="hidden sm:flex items-end space-x-1 h-8" aria-label="Recent spending activity">
              {recentSpend.map((value, index) => (
                <div
                  key={index}
                  className="bg-blue-400 rounded-sm w-1"
                  style={{ height: `${(value / maxSpend) * 100}%` }}
                  aria-hidden="true"
                />
              ))}
            </div>
            
            {/* Recent activity indicator */}
            <div className="flex items-center text-xs text-gray-400">
              <TrendingUp className="w-3 h-3 mr-1 text-green-400" />
              <span className="hidden sm:inline">Active</span>
            </div>
            
            {/* Top up button */}
            <Link to="/wallet/top-up">
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white"
                aria-label="Top up wallet balance"
              >
                <Plus className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Top up</span>
              </Button>
            </Link>
          </div>
        </div>
        
        {/* Mobile spending indicator */}
        <div className="sm:hidden mt-3 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs text-gray-400">
            <TrendingUp className="w-3 h-3 text-green-400" />
            <span>Recent activity</span>
          </div>
          <div className="flex items-end space-x-1 h-4">
            {recentSpend.slice(-5).map((value, index) => (
              <div
                key={index}
                className="bg-blue-400 rounded-sm w-1"
                style={{ height: `${(value / maxSpend) * 100}%` }}
                aria-hidden="true"
              />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default WalletBalance;
