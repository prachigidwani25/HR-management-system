import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../store/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Clock, LogIn, LogOut, Loader2, CalendarDays } from 'lucide-react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../components/ui/table';

interface AttendanceRecord {
  id: string;
  user_id: string;
  date: string;
  clock_in?: string;
  clock_out?: string;
  status: string;
  users?: { first_name: string; last_name: string };
}

export default function AttendancePage() {
  const { user } = useAuth();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isClocking, setIsClocking] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    fetchAttendance();
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, [user]);

  const fetchAttendance = async () => {
    if (!user) return;
    setIsLoading(true);

    let query = supabase
      .from('attendance')
      .select('*, users(first_name, last_name)')
      .order('date', { ascending: false });

    if (user.role === 'EMPLOYEE') {
      query = query.eq('user_id', user.id);
    }

    const { data } = await query.limit(20);
    const all = (data || []) as AttendanceRecord[];
    setRecords(all);

    const todayRec = all.find(r => r.date === today && r.user_id === user.id);
    setTodayRecord(todayRec || null);
    setIsLoading(false);
  };

  const handleClockIn = async () => {
    if (!user) return;
    setIsClocking(true);
    const { error } = await supabase.from('attendance').insert({
      user_id: user.id,
      date: today,
      clock_in: new Date().toISOString(),
      status: 'PRESENT',
    });
    if (!error) await fetchAttendance();
    setIsClocking(false);
  };

  const handleClockOut = async () => {
    if (!user || !todayRecord) return;
    setIsClocking(true);
    const { error } = await supabase.from('attendance').update({
      clock_out: new Date().toISOString(),
    }).eq('id', todayRecord.id);
    if (!error) await fetchAttendance();
    setIsClocking(false);
  };

  const formatTime = (iso?: string) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const calcDuration = (clockIn?: string, clockOut?: string) => {
    if (!clockIn || !clockOut) return '—';
    const diff = new Date(clockOut).getTime() - new Date(clockIn).getTime();
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return `${h}h ${m}m`;
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, string> = {
      PRESENT: 'bg-green-100 text-green-800',
      ABSENT: 'bg-red-100 text-red-800',
      HALF_DAY: 'bg-yellow-100 text-yellow-800',
      ON_LEAVE: 'bg-blue-100 text-blue-800',
    };
    return (
      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${map[status] || 'bg-gray-100 text-gray-800'}`}>
        {status.replace('_', ' ')}
      </span>
    );
  };

  const isClockInDisabled = !!todayRecord;
  const isClockOutDisabled = !todayRecord || !!todayRecord.clock_out;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Attendance</h1>
        <p className="text-sm text-slate-500">
          {user?.role === 'EMPLOYEE' ? 'Track your daily attendance.' : 'Monitor company-wide attendance.'}
        </p>
      </div>

      {/* Clock In/Out Card — Visible to all users */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="text-center md:text-left">
              <p className="text-4xl font-mono font-bold text-slate-800">
                {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </p>
              <p className="text-sm text-slate-500 mt-1">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>

            <div className="flex items-center gap-4">
              {todayRecord && (
                <div className="text-center px-4 py-2 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">Clocked In</p>
                  <p className="font-semibold text-green-600">{formatTime(todayRecord.clock_in)}</p>
                </div>
              )}
              {todayRecord?.clock_out && (
                <div className="text-center px-4 py-2 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">Clocked Out</p>
                  <p className="font-semibold text-red-600">{formatTime(todayRecord.clock_out)}</p>
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  onClick={handleClockIn}
                  disabled={isClockInDisabled || isClocking}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  {isClocking ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <LogIn className="h-4 w-4 mr-2" />}
                  Clock In
                </Button>
                <Button
                  onClick={handleClockOut}
                  disabled={isClockOutDisabled || isClocking}
                  variant="outline"
                  className="border-red-200 text-red-600 hover:bg-red-50"
                >
                  {isClocking ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <LogOut className="h-4 w-4 mr-2" />}
                  Clock Out
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Attendance Logs Table */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" />
            {user?.role === 'EMPLOYEE' ? 'My Attendance History' : 'Company Attendance Logs'}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {user?.role !== 'EMPLOYEE' && <TableHead>Employee</TableHead>}
                  <TableHead>Date</TableHead>
                  <TableHead>Clock In</TableHead>
                  <TableHead>Clock Out</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10 text-slate-400">
                      <Clock className="h-10 w-10 mx-auto mb-2 opacity-20" />
                      No attendance records found.
                    </TableCell>
                  </TableRow>
                )}
                {records.map((rec) => (
                  <TableRow key={rec.id}>
                    {user?.role !== 'EMPLOYEE' && (
                      <TableCell className="font-medium">
                        {rec.users?.first_name} {rec.users?.last_name}
                      </TableCell>
                    )}
                    <TableCell>{new Date(rec.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</TableCell>
                    <TableCell className="text-green-600 font-medium">{formatTime(rec.clock_in)}</TableCell>
                    <TableCell className="text-red-500 font-medium">{formatTime(rec.clock_out)}</TableCell>
                    <TableCell>{calcDuration(rec.clock_in, rec.clock_out)}</TableCell>
                    <TableCell>{getStatusBadge(rec.status)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
