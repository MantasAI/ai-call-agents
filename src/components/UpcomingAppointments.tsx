import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, ChevronRight, Clock, MapPin } from "lucide-react";

interface Appointment {
  id: string;
  title: string;
  datetime: string;
  location?: string;
}

interface UpcomingAppointmentsProps {
  appointments?: Appointment[];
}

const formatDateTime = (datetime: string): { date: string; time: string; isToday: boolean } => {
  const appointmentDate = new Date(datetime);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const appointmentDay = new Date(appointmentDate.getFullYear(), appointmentDate.getMonth(), appointmentDate.getDate());
  
  const isToday = appointmentDay.getTime() === today.getTime();
  const isTomorrow = appointmentDay.getTime() === today.getTime() + 24 * 60 * 60 * 1000;
  
  let dateString = appointmentDate.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric' 
  });
  
  if (isToday) {
    dateString = 'Today';
  } else if (isTomorrow) {
    dateString = 'Tomorrow';
  }
  
  const timeString = appointmentDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
  
  return { date: dateString, time: timeString, isToday };
};

const UpcomingAppointments: React.FC<UpcomingAppointmentsProps> = ({ appointments = [] }) => {
  // Sort and limit to 3 upcoming appointments
  const sortedAppointments = appointments
    .sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime())
    .slice(0, 3);

  return (
    <Card className="bg-gray-800 border-gray-700">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-white flex items-center">
            <Calendar className="w-5 h-5 mr-2" />
            Upcoming
          </h3>
          <Link to="/calendar">
            <Button variant="ghost" size="sm" className="text-blue-400 hover:text-blue-300">
              View all
            </Button>
          </Link>
        </div>

        {sortedAppointments.length > 0 ? (
          <div className="space-y-3" role="list">
            {sortedAppointments.map((appointment) => {
              const { date, time, isToday } = formatDateTime(appointment.datetime);
              
              return (
                <div
                  key={appointment.id}
                  className="flex items-center justify-between p-3 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors cursor-pointer"
                  role="listitem"
                >
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    <div className={`p-2 rounded-lg flex-shrink-0 ${
                      isToday ? 'bg-blue-500' : 'bg-gray-600'
                    }`}>
                      <Clock className={`w-4 h-4 ${
                        isToday ? 'text-white' : 'text-gray-300'
                      }`} />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium truncate">
                        {appointment.title}
                      </p>
                      <div className="flex items-center space-x-2 text-sm text-gray-400">
                        <span>{date} at {time}</span>
                        {appointment.location && (
                          <>
                            <span>•</span>
                            <div className="flex items-center space-x-1 truncate">
                              <MapPin className="w-3 h-3 flex-shrink-0" />
                              <span className="truncate">{appointment.location}</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-6">
            <Calendar className="w-8 h-8 mx-auto mb-3 text-gray-400 opacity-50" />
            <p className="text-gray-400 mb-3">No upcoming appointments</p>
            <Link to="/calendar">
              <Button variant="outline" size="sm" className="border-gray-600 text-gray-300 hover:bg-gray-700">
                Schedule one
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default UpcomingAppointments;
