import React, { useState, useEffect } from 'react';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Bell, 
  CheckCircle2, 
  Clock, 
  AlertTriangle,
  Info,
  ExternalLink,
  Plus,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Deadline {
  id: number;
  title: string;
  deadlineDate: string;
  category: string;
  isCompleted: boolean;
  description: string;
}

export default function ComplianceCalendar() {
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDeadlines();
  }, []);

  const fetchDeadlines = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/compliance');
      const data = await res.json();
      setDeadlines(data);
    } catch (err) {
      console.error('Failed to fetch deadlines', err);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleComplete = async (id: number) => {
    try {
      await fetch(`/api/compliance/toggle/${id}`, { method: 'POST' });
      fetchDeadlines();
    } catch (err) {
      console.error('Failed to toggle deadline status', err);
    }
  };

  const daysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const firstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const renderCalendarDays = () => {
    const days = [];
    const totalDays = daysInMonth(currentMonth);
    const startDay = firstDayOfMonth(currentMonth);

    // Empty spaces for previous month
    for (let i = 0; i < startDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-24 md:h-32 border-b border-r border-zinc-50 bg-zinc-50/20" />);
    }

    // Actual days
    for (let i = 1; i <= totalDays; i++) {
      const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i);
      const dateStr = date.toISOString().split('T')[0];
      const dayDeadlines = deadlines.filter(d => d.deadlineDate === dateStr);
      const isToday = new Date().toDateString() === date.toDateString();

      days.push(
        <div 
          key={i} 
          onClick={() => setSelectedDate(date)}
          className={cn(
            "h-24 md:h-32 p-2 border-b border-r border-zinc-50 transition-all cursor-pointer hover:bg-zinc-50/50 relative group",
            isToday && "bg-brand-50/30"
          )}
        >
          <span className={cn(
            "text-xs font-black w-6 h-6 flex items-center justify-center rounded-full",
            isToday ? "bg-brand-600 text-white" : "text-zinc-400 group-hover:text-zinc-900"
          )}>
            {i}
          </span>
          <div className="mt-1 space-y-1 overflow-hidden">
            {dayDeadlines.map(d => (
              <div 
                key={d.id} 
                className={cn(
                  "px-1.5 py-0.5 rounded text-[8px] md:text-[10px] font-bold truncate",
                  d.isCompleted ? "bg-emerald-100 text-emerald-700 line-through" : "bg-brand-100 text-brand-700"
                )}
              >
                {d.title}
              </div>
            ))}
          </div>
        </div>
      );
    }

    return days;
  };

  const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));

  const selectedDeadlines = selectedDate 
    ? deadlines.filter(d => d.deadlineDate === selectedDate.toISOString().split('T')[0])
    : [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-black tracking-tight flex items-center gap-3">
              <CalendarIcon className="text-brand-500" size={32} /> Compliance Calendar
            </h2>
            <p className="text-zinc-500">Stay ahead of tax and VAT deadlines in Bangladesh</p>
          </div>
          <div className="flex items-center gap-2 bg-white p-2 rounded-2xl border border-zinc-100 shadow-sm">
            <button onClick={prevMonth} className="p-2 hover:bg-zinc-50 rounded-xl transition-all"><ChevronLeft size={20} /></button>
            <span className="px-4 font-black text-sm uppercase tracking-widest text-zinc-900">
              {currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
            </span>
            <button onClick={nextMonth} className="p-2 hover:bg-zinc-50 rounded-xl transition-all"><ChevronRight size={20} /></button>
          </div>
        </div>

        <div className="bg-white rounded-[2.5rem] border border-zinc-100 shadow-sm overflow-hidden">
          <div className="grid grid-cols-7 border-b border-zinc-100 bg-zinc-50/50">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="py-3 text-center text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {renderCalendarDays()}
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="bg-zinc-900 text-white p-8 rounded-[2.5rem] shadow-xl shadow-zinc-200">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-black tracking-tight">Upcoming Tasks</h3>
            <Bell size={20} className="text-brand-400" />
          </div>
          <div className="space-y-4">
            {deadlines.filter(d => !d.isCompleted).slice(0, 3).map(d => (
              <div key={d.id} className="p-4 bg-white/5 rounded-2xl border border-white/10 hover:bg-white/10 transition-all cursor-pointer">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="px-2 py-0.5 bg-brand-500/20 text-brand-400 rounded text-[10px] font-bold uppercase tracking-widest">
                    {d.category}
                  </span>
                  <span className="text-[10px] font-mono text-zinc-400">
                    {new Date(d.deadlineDate).toLocaleDateString()}
                  </span>
                </div>
                <p className="font-bold text-sm mb-1">{d.title}</p>
                <p className="text-xs text-zinc-400 line-clamp-2">{d.description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] border border-zinc-100 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-black tracking-tight">
              {selectedDate ? selectedDate.toLocaleDateString('default', { day: 'numeric', month: 'long' }) : 'Select a date'}
            </h3>
            {selectedDate && <button onClick={() => setSelectedDate(null)} className="text-zinc-400 hover:text-zinc-900"><X size={20} /></button>}
          </div>

          <div className="space-y-4">
            {selectedDeadlines.length > 0 ? (
              selectedDeadlines.map(d => (
                <div key={d.id} className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-bold text-zinc-900">{d.title}</p>
                    <button 
                      onClick={() => toggleComplete(d.id)}
                      className={cn(
                        "p-1.5 rounded-lg transition-all",
                        d.isCompleted ? "bg-emerald-100 text-emerald-600" : "bg-zinc-200 text-zinc-400 hover:bg-emerald-50 hover:text-emerald-500"
                      )}
                    >
                      <CheckCircle2 size={16} />
                    </button>
                  </div>
                  <p className="text-xs text-zinc-500 mb-3">{d.description}</p>
                  <div className="flex items-center gap-2">
                    <button className="flex-1 py-2 bg-white border border-zinc-100 text-zinc-600 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-zinc-50 transition-all flex items-center justify-center gap-2">
                      <Info size={14} /> Details
                    </button>
                    <button className="flex-1 py-2 bg-brand-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-brand-700 transition-all flex items-center justify-center gap-2 shadow-sm">
                      <ExternalLink size={14} /> File Now
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-12 text-center">
                <div className="w-12 h-12 bg-zinc-50 rounded-full flex items-center justify-center text-zinc-300 mx-auto mb-4">
                  <Clock size={24} />
                </div>
                <p className="text-zinc-400 text-sm italic">No deadlines for this date.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
