import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../store/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { 
  Users, CalendarCheck, Clock, FileText, TrendingUp, CheckCircle, 
  XCircle, AlertCircle, Calendar, Megaphone, UserCheck, UserMinus 
} from 'lucide-react';
import { format } from 'date-fns';
import { getLocalDateString, parseLocalDate } from '../../lib/utils';

interface Stats {
  totalEmployees: number;
  presentToday: number;
  absentToday: number;
  onLeaveToday: number;
  pendingLeaves: number;
  totalDocuments: number;
}

interface RecentLeave {
  id: string;
  leave_type: string;
  status: string;
  start_date: string;
  end_date: string;
  user_id: string;
  users?: { first_name: string; last_name: string };
}

interface Announcement {
  id: string;
  title: string;
  content: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  pinned: boolean;
  expires_at?: string;
  created_at: string;
}

interface Holiday {
  id: string;
  name: string;
  holiday_date: string;
  type: 'NATIONAL' | 'COMPANY';
}

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats>({ 
    totalEmployees: 0, 
    presentToday: 0, 
    absentToday: 0,
    onLeaveToday: 0,
    pendingLeaves: 0, 
    totalDocuments: 0 
  });
  const [recentLeaves, setRecentLeaves] = useState<RecentLeave[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  
  // Employee leave balance
  const [leaveCredit, setLeaveCredit] = useState({ credited: 0, used: 0, remaining: 0 });
  
  const [todayAttendance, setTodayAttendance] = useState<{ clock_in?: string; clock_out?: string; status?: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, [user]);

  const fetchDashboardData = async () => {
    if (!user) return;
    setIsLoading(true);
    const today = getLocalDateString();
    const currentYear = new Date().getFullYear();

    try {
      const promises: Promise<void>[] = [];

      // 1. Announcements (Both Admin and Employee view)
      promises.push((async () => {
        const { data } = await supabase
          .from('announcements')
          .select('*')
          .or(`expires_at.is.null,expires_at.gte.${today}`)
          .order('pinned', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(5);
        setAnnouncements((data || []) as Announcement[]);
      })());

      // 2. Upcoming Holidays (Both Admin and Employee view)
      promises.push((async () => {
        const { data } = await supabase
          .from('holidays')
          .select('*')
          .gte('holiday_date', today)
          .order('holiday_date', { ascending: true })
          .limit(5);
        setHolidays((data || []) as Holiday[]);
      })());

      if (user.role === 'ADMIN' || user.role === 'HR_MANAGER') {
        // ADMIN / HR VIEW
        promises.push(
          (async () => {
            const { count } = await supabase.from('users').select('id', { count: 'exact', head: true });
            setStats(s => ({ ...s, totalEmployees: count || 0 }));
          })(),
          (async () => {
            const { count } = await supabase.from('attendance').select('id', { count: 'exact', head: true }).eq('date', today).eq('status', 'PRESENT');
            setStats(s => ({ ...s, presentToday: count || 0 }));
          })(),
          (async () => {
            const { count } = await supabase.from('attendance').select('id', { count: 'exact', head: true }).eq('date', today).eq('status', 'ON_LEAVE');
            setStats(s => ({ ...s, onLeaveToday: count || 0 }));
          })(),
          (async () => {
            const { count } = await supabase.from('leaves').select('id', { count: 'exact', head: true }).eq('status', 'PENDING');
            setStats(s => ({ ...s, pendingLeaves: count || 0 }));
          })(),
          (async () => {
            const { count } = await supabase.from('documents').select('id', { count: 'exact', head: true });
            setStats(s => ({ ...s, totalDocuments: count || 0 }));
          })(),
          (async () => {
            const { data } = await supabase
              .from('leaves')
              .select('*, users(first_name, last_name)')
              .order('created_at', { ascending: false })
              .limit(5);
            setRecentLeaves((data || []) as RecentLeave[]);
          })(),
        );
      } else {
        // EMPLOYEE VIEW
        promises.push(
          (async () => {
            const { count } = await supabase.from('leaves').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'PENDING');
            setStats(s => ({ ...s, pendingLeaves: count || 0 }));
          })(),
          (async () => {
            const { count } = await supabase.from('documents').select('id', { count: 'exact', head: true }).eq('user_id', user.id);
            setStats(s => ({ ...s, totalDocuments: count || 0 }));
          })(),
          (async () => {
            const { data } = await supabase.from('leaves').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(5);
            setRecentLeaves((data || []) as RecentLeave[]);
          })(),
          (async () => {
            const { data } = await supabase.from('attendance').select('clock_in, clock_out, status').eq('user_id', user.id).eq('date', today).maybeSingle();
            setTodayAttendance(data);
          })(),
          // Calculate leave balance dynamically:
          // 1.5 leaves credited per month elapsed this year.
          (async () => {
            const currentMonth = new Date().getMonth() + 1; // 1 to 12
            const credited = currentMonth * 1.5;

            // Fetch approved leaves in this year
            const { data } = await supabase
              .from('leaves')
              .select('*')
              .eq('user_id', user.id)
              .eq('status', 'APPROVED')
              .gte('start_date', `${currentYear}-01-01`)
              .lte('end_date', `${currentYear}-12-31`);

            let used = 0;
            if (data) {
              data.forEach(l => {
                const start = new Date(l.start_date);
                const end = new Date(l.end_date);
                const diffTime = Math.abs(end.getTime() - start.getTime());
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                used += diffDays;
              });
            }
            setLeaveCredit({
              credited,
              used,
              remaining: credited - used
            });
          })()
        );
      }

      await Promise.all(promises);
    } catch (e) {
      console.error('Error fetching dashboard data:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    if (status === 'APPROVED') return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (status === 'REJECTED') return <XCircle className="h-4 w-4 text-red-500" />;
    return <AlertCircle className="h-4 w-4 text-yellow-500" />;
  };

  const getStatusColor = (status: string) => {
    if (status === 'APPROVED') return 'text-green-700 bg-green-50';
    if (status === 'REJECTED') return 'text-red-700 bg-red-50';
    return 'text-yellow-700 bg-yellow-50';
  };

  const formatTime = (isoString?: string) => {
    if (!isoString) return '—';
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const adminCards = [
    { title: 'Total Employees', value: stats.totalEmployees, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
    { title: 'Present Today', value: stats.presentToday, icon: UserCheck, color: 'text-green-600', bg: 'bg-green-50' },
    { title: 'On Leave Today', value: stats.onLeaveToday, icon: Calendar, color: 'text-orange-600', bg: 'bg-orange-50' },
    { 
      title: 'Absent Today', 
      value: Math.max(0, stats.totalEmployees - stats.presentToday - stats.onLeaveToday), 
      icon: UserMinus, 
      color: 'text-red-600', 
      bg: 'bg-red-50' 
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-800">
            Welcome back, {user?.first_name} 👋
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {format(new Date(), 'EEEE, MMMM dd, yyyy')} | Role: <span className="font-semibold text-slate-700 capitalize">{user?.role?.replace('_', ' ').toLowerCase()}</span>
          </p>
        </div>
      </div>

      {/* Admin Analytics Panel */}
      {(user?.role === 'ADMIN' || user?.role === 'HR_MANAGER') && (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {adminCards.map((card) => {
            const Icon = card.icon;
            return (
              <Card key={card.title} className="border-0 shadow-md hover:shadow-lg transition-shadow bg-white">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{card.title}</p>
                      <p className="text-3xl font-bold text-slate-800 mt-2">
                        {isLoading ? '—' : card.value}
                      </p>
                    </div>
                    <div className={`p-4 rounded-xl ${card.bg}`}>
                      <Icon className={`h-6 w-6 ${card.color}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Employee Self Service Leave Balance Summary */}
      {user?.role === 'EMPLOYEE' && (
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="border-0 shadow-md bg-gradient-to-br from-indigo-500 to-purple-600 text-white md:col-span-2">
            <CardContent className="p-6 flex flex-col justify-between h-full min-h-[160px]">
              <div>
                <p className="text-sm font-medium opacity-90">Monthly Leave Credit Summary</p>
                <h2 className="text-3xl font-bold mt-2">1.5 Leaves Credited / Month</h2>
              </div>
              <div className="grid grid-cols-3 gap-4 border-t border-white/20 pt-4 mt-4 text-center">
                <div>
                  <p className="text-2xl font-extrabold">{leaveCredit.credited.toFixed(1)}</p>
                  <p className="text-xs opacity-75">Credited YTD</p>
                </div>
                <div>
                  <p className="text-2xl font-extrabold text-red-200">{leaveCredit.used.toFixed(1)}</p>
                  <p className="text-xs opacity-75">Used</p>
                </div>
                <div>
                  <p className={`text-2xl font-extrabold ${leaveCredit.remaining < 0 ? 'text-rose-300 animate-pulse' : 'text-green-200'}`}>
                    {leaveCredit.remaining.toFixed(1)}
                  </p>
                  <p className="text-xs opacity-75">Remaining Balance</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Today's Attendance Widget */}
          <Card className="border-0 shadow-md bg-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-800">
                <Clock className="h-4 w-4 text-primary" />
                Today's Attendance
              </CardTitle>
            </CardHeader>
            <CardContent>
              {todayAttendance ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between py-2 border-b">
                    <span className="text-sm text-slate-500">Clock In</span>
                    <span className="font-semibold text-green-600">{formatTime(todayAttendance.clock_in)}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b">
                    <span className="text-sm text-slate-500">Clock Out</span>
                    <span className="font-semibold text-red-600">{formatTime(todayAttendance.clock_out)}</span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm text-slate-500">Status</span>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${getStatusColor(todayAttendance.status || '')}`}>
                      {todayAttendance.status}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 text-slate-400">
                  <Clock className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No attendance logged today</p>
                  <p className="text-xs mt-1 text-slate-500">Clock in from the Attendance tab</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Warnings & Alerts */}
      {user?.role === 'EMPLOYEE' && leaveCredit.remaining < 0 && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl shadow-sm">
          <AlertCircle className="h-5 w-5 shrink-0 text-amber-600" />
          <p className="text-sm">
            <span className="font-bold">Leave warning:</span> You have exceeded your credited leave balance for the year by {-leaveCredit.remaining} days. Future leaves may result in salary deductions.
          </p>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        {/* Recent Leave Requests List */}
        <Card className="border-0 shadow-md bg-white md:col-span-2">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-lg font-bold flex items-center gap-2 text-slate-800">
              <TrendingUp className="h-5 w-5 text-primary" />
              {user?.role === 'EMPLOYEE' ? 'My Recent Leave Requests' : 'All Recent Leave Requests'}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {recentLeaves.length === 0 ? (
              <div className="text-center py-10 text-slate-400">
                <CalendarCheck className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No leave requests found</p>
              </div>
            ) : (
              <div className="divide-y">
                {recentLeaves.map((leave) => (
                  <div key={leave.id} className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(leave.status)}
                      <div>
                        <p className="text-sm font-semibold text-slate-700 capitalize">
                          {leave.leave_type.toLowerCase()} Leave
                        </p>
                        <p className="text-xs text-slate-400">
                          {format(parseLocalDate(leave.start_date), 'MMM dd')} – {format(parseLocalDate(leave.end_date), 'MMM dd, yyyy')}
                        </p>
                        {user?.role !== 'EMPLOYEE' && leave.users && (
                          <p className="text-xs text-indigo-600 font-medium mt-0.5">
                            By: {leave.users.first_name} {leave.users.last_name}
                          </p>
                        )}
                      </div>
                    </div>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${getStatusColor(leave.status)}`}>
                      {leave.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Side panel: Announcements Feed */}
        <div className="space-y-6">
          <Card className="border-0 shadow-md bg-white">
            <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-bold flex items-center gap-2 text-slate-800">
                <Megaphone className="h-5 w-5 text-indigo-500" />
                Announcements
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {announcements.length === 0 ? (
                <div className="text-center py-6 text-slate-400">
                  <Megaphone className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No announcements posted</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {announcements.map((ann) => (
                    <div 
                      key={ann.id} 
                      className={`p-3 rounded-lg border text-sm transition-all ${
                        ann.pinned ? 'bg-indigo-50/50 border-indigo-100' : 'bg-slate-50 border-slate-100'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-bold text-slate-800 truncate">{ann.title}</h4>
                        {ann.pinned && (
                          <span className="text-[10px] bg-indigo-600 text-white px-1.5 py-0.5 rounded-full shrink-0">Pinned</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 mt-1 line-clamp-3 whitespace-pre-wrap">{ann.content}</p>
                      <div className="flex justify-between items-center mt-2.5 text-[10px] text-slate-400 font-medium">
                        <span className={`px-1.5 py-0.5 rounded ${
                          ann.priority === 'HIGH' ? 'bg-rose-50 text-rose-600 font-bold' :
                          ann.priority === 'MEDIUM' ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {ann.priority} Priority
                        </span>
                        <span>{format(new Date(ann.created_at), 'MMM dd')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Holiday Calendar Panel */}
          <Card className="border-0 shadow-md bg-white">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-lg font-bold flex items-center gap-2 text-slate-800">
                <Calendar className="h-5 w-5 text-emerald-500" />
                Upcoming Holidays
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {holidays.length === 0 ? (
                <div className="text-center py-6 text-slate-400">
                  <Calendar className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No upcoming holidays</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {holidays.map((h) => (
                    <div key={h.id} className="flex items-center justify-between p-2 rounded-lg border border-slate-50 bg-slate-50/50 hover:bg-slate-50 transition-colors">
                      <div>
                        <p className="text-sm font-semibold text-slate-700">{h.name}</p>
                        <p className="text-[11px] text-slate-400 uppercase tracking-wider mt-0.5">{h.type} Holiday</p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-bold bg-white text-indigo-600 border px-2 py-1 rounded-md shadow-xs">
                          {format(parseLocalDate(h.holiday_date), 'MMM dd')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
