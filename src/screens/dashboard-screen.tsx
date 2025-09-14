import React from 'react';
import DashboardLayout from "@/layouts/dashboard-layout";
import WalletBalance from "@/components/wallet-balance";
import QuickAccess from "@/components/quick-access";
import UpcomingAppointments from "@/components/upcoming-appointments";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Phone, Clock, User, CheckCircle, AlertCircle } from "lucide-react";

const useDashboardData = () => {
  return {
    user: {
      name: "Alex",
      avatar: null
    },
    recentCalls: [
      {
        id: "1",
        contact: "Sarah Johnson",
        timestamp: "10:30 AM",
        status: "completed" as const,
        duration: "5m 32s"
      },
      {
        id: "2",
        contact: "Mike Chen",
        timestamp: "9:15 AM", 
        status: "missed" as const,
        duration: null
      }
    ],
    appointments: [
      {
        id: "1",
        title: "Sales Call - TechCorp",
        time: "2:00 PM",
        type: "call"
      },
      {
        id: "2",
        title: "Follow-up - Healthcare Inc",
        time: "4:30 PM",
        type: "meeting"
      },
      {
        id: "3",
        title: "Demo - StartupXYZ",
        time: "Tomorrow 10:00 AM",
        type: "demo"
      }
    ]
  };
};

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
};

const DashboardScreen: React.FC = () => {
  const { user, recentCalls, appointments } = useDashboardData();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Greeting */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center">
            <User className="w-6 h-6 text-gray-300" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">
              {getGreeting()}, {user.name}
            </h2>
            <p className="text-sm text-gray-400">Ready to make some calls?</p>
          </div>
        </div>

        {/* Wallet Balance */}
        <WalletBalance balance="$1,250.00" />

        {/* Quick Access */}
        <QuickAccess />

        {/* Recent Calls */}
        <Card className="bg-gray-800 border-gray-700">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-white flex items-center">
                <Phone className="w-5 h-5 mr-2" />
                Recent Calls
              </h3>
              <Button variant="ghost" size="sm" className="text-blue-400 hover:text-blue-300">
                View all
              </Button>
            </div>
            
            <div className="space-y-3">
              {recentCalls.length > 0 ? (
                recentCalls.map((call) => (
                  <div key={call.id} className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className={`p-1 rounded-full ${call.status === 'completed' ? 'bg-green-500' : 'bg-red-500'}`}>
                        {call.status === 'completed' ? (
                          <CheckCircle className="w-4 h-4 text-white" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-white" />
                        )}
                      </div>
                      <div>
                        <p className="text-white font-medium">{call.contact}</p>
                        <p className="text-sm text-gray-400">{call.duration || 'No answer'}</p>
                      </div>
                    </div>
                    <span className="text-sm text-gray-400">{call.timestamp}</span>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-gray-400">
                  <Phone className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No recent calls</p>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Upcoming Appointments */}
        <UpcomingAppointments appointments={appointments} />
      </div>
    </DashboardLayout>
  );
};

export default DashboardScreen;
