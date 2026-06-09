import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Leave, User } from '../../types';
import { useAuth } from '../../store/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Plus, Loader2, Check, X, CalendarDays, AlertTriangle, Edit3, Award, Info } from 'lucide-react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '../../components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { parseLocalDate } from '../../lib/utils';

interface LeaveWithUser extends Leave {
  users?: { first_name: string; last_name: string } | null;
}

interface LeaveBalance {
  id?: string;
  user_id: string;
  year: number;
  sick_leaves: number;
  casual_leaves: number;
  earned_leaves: number;
  users?: { first_name: string; last_name: string } | null;
}

export default function LeaveManagement() {
  const { user } = useAuth();
  const [leaves, setLeaves] = useState<LeaveWithUser[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('requests');
  
  // Dialogs
  const [showApplyDialog, setShowApplyDialog] = useState(false);
  const [showAdjustDialog, setShowAdjustDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedBalance, setSelectedBalance] = useState<LeaveBalance | null>(null);

  // Apply Leave form fields
  const [leaveType, setLeaveType] = useState('SICK');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [showWarning, setShowWarning] = useState(false);
  const [formError, setFormError] = useState('');

  // Adjust Balance form fields
  const [sickLeaves, setSickLeaves] = useState('6');
  const [casualLeaves, setCasualLeaves] = useState('6');
  const [earnedLeaves, setEarnedLeaves] = useState('6');

  // Employee own leave balance state
  const [myBalance, setMyBalance] = useState<LeaveBalance | null>(null);
  const [myUsedLeaves, setMyUsedLeaves] = useState(0);

  const currentYear = new Date().getFullYear();

  useEffect(() => {
    fetchData();
  }, [user, activeTab]);

  const fetchData = async () => {
    if (!user) return;
    setIsLoading(true);
    
    try {
      if (activeTab === 'requests') {
        await fetchLeaves();
        if (user.role === 'EMPLOYEE') {
          await fetchEmployeeBalance();
        }
      } else if (activeTab === 'balances') {
        await fetchAllBalances();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchLeaves = async () => {
    let query = supabase
      .from('leaves')
      .select('*, users:users!leaves_user_id_fkey(first_name, last_name)')
      .order('created_at', { ascending: false });

    if (user?.role === 'EMPLOYEE') {
      query = query.eq('user_id', user.id);
    }
    
    const { data, error } = await query;
    if (!error && data) {
      setLeaves(data as LeaveWithUser[]);
    }
  };

  const fetchEmployeeBalance = async () => {
    if (!user) return;

    // 1. Fetch leave_balances record
    let { data: balData, error: balError } = await supabase
      .from('leave_balances')
      .select('*')
      .eq('user_id', user.id)
      .eq('year', currentYear)
      .maybeSingle();

    // If no record exists, automatically initialize it with defaults
    if (!balData && !balError) {
      const { data: newBal, error: initError } = await supabase
        .from('leave_balances')
        .insert({
          user_id: user.id,
          year: currentYear,
          sick_leaves: 6,
          casual_leaves: 6,
          earned_leaves: 6,
        })
        .select()
        .single();
      
      if (!initError && newBal) {
        balData = newBal;
      }
    }

    if (balData) {
      setMyBalance(balData as LeaveBalance);
    }

    // 2. Fetch approved leave count YTD
    const { data: leavesData } = await supabase
      .from('leaves')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'APPROVED')
      .gte('start_date', `${currentYear}-01-01`)
      .lte('end_date', `${currentYear}-12-31`);

    let used = 0;
    if (leavesData) {
      leavesData.forEach(l => {
        const start = new Date(l.start_date);
        const end = new Date(l.end_date);
        const diffTime = Math.abs(end.getTime() - start.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        used += diffDays;
      });
    }
    setMyUsedLeaves(used);
  };

  const fetchAllBalances = async () => {
    // 1. Fetch all users
    const { data: usersData, error: usersError } = await supabase
      .from('users')
      .select('id, first_name, last_name, email');

    if (usersError || !usersData) return;

    // 2. Fetch all leave balances for current year
    const { data: balancesData } = await supabase
      .from('leave_balances')
      .select('*, users(first_name, last_name)')
      .eq('year', currentYear);

    const balMap = new Map<string, LeaveBalance>();
    if (balancesData) {
      balancesData.forEach((b: any) => balMap.set(b.user_id, b));
    }

    // Create a complete list. If a user has no balance record, we show them as uninitialized
    const completeList: LeaveBalance[] = usersData.map(u => {
      const existing = balMap.get(u.id);
      if (existing) return existing;
      return {
        user_id: u.id,
        year: currentYear,
        sick_leaves: 6,
        casual_leaves: 6,
        earned_leaves: 6,
        users: { first_name: u.first_name, last_name: u.last_name }
      };
    });

    setBalances(completeList);
  };

  // Recalculate warning when dates change
  useEffect(() => {
    if (!startDate || !endDate || user?.role !== 'EMPLOYEE' || !myBalance) {
      setShowWarning(false);
      return;
    }
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start <= end) {
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      const totalAllowed = myBalance.sick_leaves + myBalance.casual_leaves + myBalance.earned_leaves;
      if (diffDays + myUsedLeaves > totalAllowed) {
        setShowWarning(true);
      } else {
        setShowWarning(false);
      }
    } else {
      setShowWarning(false);
    }
  }, [startDate, endDate, myBalance, myUsedLeaves]);

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!leaveType || !startDate || !endDate || !reason) {
      setFormError('All fields are required.');
      return;
    }
    if (new Date(startDate) > new Date(endDate)) {
      setFormError('End date must be after or equal to start date.');
      return;
    }
    setIsSubmitting(true);

    try {
      const { error } = await supabase.from('leaves').insert({
        user_id: user!.id,
        leave_type: leaveType,
        start_date: startDate,
        end_date: endDate,
        reason,
        status: 'PENDING',
      });
      
      if (error) throw error;
      
      toast.success('Leave application submitted successfully!');
      setShowApplyDialog(false);
      setLeaveType('SICK');
      setStartDate('');
      setEndDate('');
      setReason('');
      await fetchLeaves();
      await fetchEmployeeBalance();
    } catch (err: any) {
      setFormError(err.message || 'Failed to submit leave request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAction = async (leave: LeaveWithUser, status: 'APPROVED' | 'REJECTED') => {
    try {
      // 1. Update the leave status
      const { error } = await supabase
        .from('leaves')
        .update({ status, approved_by: user!.id })
        .eq('id', leave.id);

      if (error) throw error;

      // Create a notification for the employee
      await supabase.from('notifications').insert({
        user_id: leave.user_id,
        title: `Leave Request ${status === 'APPROVED' ? 'Approved' : 'Rejected'}`,
        message: `Your leave request for ${leave.leave_type.toLowerCase()} leave starting ${format(parseLocalDate(leave.start_date), 'MMM d, yyyy')} has been ${status.toLowerCase()} by the HR department.`,
        is_read: false
      });

      // 2. If approved, automatically insert attendance records as 'ON_LEAVE'
      if (status === 'APPROVED') {
        const start = new Date(leave.start_date + 'T00:00:00Z');
        const end = new Date(leave.end_date + 'T00:00:00Z');
        const attendanceInserts = [];
        
        for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
          const dateStr = d.toISOString().split('T')[0];
          attendanceInserts.push({
            user_id: leave.user_id,
            date: dateStr,
            status: 'ON_LEAVE'
          });
        }
        
        if (attendanceInserts.length > 0) {
          await supabase.from('attendance').upsert(attendanceInserts, { onConflict: 'user_id,date' });
        }
      }

      toast.success(`Leave request ${status.toLowerCase()} successfully`);
      setLeaves(prev => prev.map(l => l.id === leave.id ? { ...l, status } : l));
    } catch (err: any) {
      toast.error('Operation failed: ' + err.message);
    }
  };

  const handleOpenAdjust = (bal: LeaveBalance) => {
    setSelectedBalance(bal);
    setSickLeaves(bal.sick_leaves.toString());
    setCasualLeaves(bal.casual_leaves.toString());
    setEarnedLeaves(bal.earned_leaves.toString());
    setFormError('');
    setShowAdjustDialog(true);
  };

  const handleAdjustBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!selectedBalance) return;
    setIsSubmitting(true);

    try {
      const sickVal = parseInt(sickLeaves) || 0;
      const casualVal = parseInt(casualLeaves) || 0;
      const earnedVal = parseInt(earnedLeaves) || 0;

      // Check if row already exists in database
      const { data: existing } = await supabase
        .from('leave_balances')
        .select('id')
        .eq('user_id', selectedBalance.user_id)
        .eq('year', currentYear)
        .maybeSingle();

      if (existing) {
        // Update
        const { error } = await supabase
          .from('leave_balances')
          .update({
            sick_leaves: sickVal,
            casual_leaves: casualVal,
            earned_leaves: earnedVal,
          })
          .eq('id', existing.id);
        
        if (error) throw error;
      } else {
        // Insert
        const { error } = await supabase
          .from('leave_balances')
          .insert({
            user_id: selectedBalance.user_id,
            year: currentYear,
            sick_leaves: sickVal,
            casual_leaves: casualVal,
            earned_leaves: earnedVal,
          });
        
        if (error) throw error;
      }

      toast.success('Leave balance adjusted successfully');
      setShowAdjustDialog(false);
      await fetchAllBalances();
    } catch (err: any) {
      setFormError(err.message || 'Failed to adjust balance');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      APPROVED: 'bg-green-100 text-green-800',
      REJECTED: 'bg-red-100 text-red-800',
      PENDING: 'bg-yellow-100 text-yellow-800',
    };
    return (
      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${styles[status] || 'bg-gray-100 text-gray-700'}`}>
        {status}
      </span>
    );
  };

  const isHrOrAdmin = user?.role === 'ADMIN' || user?.role === 'HR_MANAGER';

  // Accrued leaves dynamically (1.5 leaves per month elapsed this year)
  const currentMonth = new Date().getMonth() + 1;
  const accruedYtd = currentMonth * 1.5;

  const totalAllowedLeaves = myBalance 
    ? myBalance.sick_leaves + myBalance.casual_leaves + myBalance.earned_leaves 
    : 18;
  const remainingLeaves = totalAllowedLeaves - myUsedLeaves;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-800">Leave Management</h1>
          <p className="text-sm text-slate-500 mt-1">
            {user?.role === 'EMPLOYEE' ? 'Apply and track your leave requests and balances.' : 'Review leaves, manage allocations, and regulate balances.'}
          </p>
        </div>
        {user?.role === 'EMPLOYEE' && (
          <Button onClick={() => setShowApplyDialog(true)} className="bg-primary text-white">
            <Plus className="h-4 w-4 mr-2" /> Apply Leave
          </Button>
        )}
      </div>

      {/* Leave Balance Stats Cards (Employee View Only) */}
      {user?.role === 'EMPLOYEE' && (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-4">
          <Card className="border-0 shadow-sm bg-white">
            <CardContent className="p-5">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Accrued YTD (1.5/mo)</p>
              <p className="text-2xl font-bold text-indigo-600 mt-1">{accruedYtd.toFixed(1)} days</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-white">
            <CardContent className="p-5">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Annual Allocation</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">{totalAllowedLeaves} days</p>
              <div className="flex justify-between text-[10px] text-slate-500 mt-1 border-t pt-1">
                <span>Sick: {myBalance?.sick_leaves ?? 6}</span>
                <span>Casual: {myBalance?.casual_leaves ?? 6}</span>
                <span>Earned: {myBalance?.earned_leaves ?? 6}</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-white">
            <CardContent className="p-5">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Approved / Used Leaves</p>
              <p className="text-2xl font-bold text-rose-600 mt-1">{myUsedLeaves} days</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-white">
            <CardContent className="p-5">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Remaining Balance</p>
              <p className={`text-2xl font-bold mt-1 ${remainingLeaves < 0 ? 'text-rose-600' : 'text-green-600'}`}>
                {remainingLeaves.toFixed(1)} days
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs Layout for Admin/HR */}
      {isHrOrAdmin ? (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-xs grid-cols-2 mb-6 bg-slate-100 p-1 rounded-lg">
            <TabsTrigger value="requests" className="rounded-md">Requests</TabsTrigger>
            <TabsTrigger value="balances" className="rounded-md">Leave Balances</TabsTrigger>
          </TabsList>

          <TabsContent value="requests">
            <Card className="border-0 shadow-md bg-white">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-base font-semibold flex items-center gap-2 text-slate-800">
                  <CalendarDays className="h-4 w-4 text-primary" />
                  Employee Leave Requests
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="flex justify-center p-12">
                    <Loader2 className="h-8 w-8 animate-spin text-slate-350" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader className="bg-slate-50/70">
                      <TableRow>
                        <TableHead className="font-bold text-slate-700">Employee</TableHead>
                        <TableHead className="font-bold text-slate-700">Type</TableHead>
                        <TableHead className="font-bold text-slate-700">Start Date</TableHead>
                        <TableHead className="font-bold text-slate-700">End Date</TableHead>
                        <TableHead className="font-bold text-slate-700">Reason</TableHead>
                        <TableHead className="font-bold text-slate-700">Status</TableHead>
                        <TableHead className="text-right font-bold text-slate-700 pr-6">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leaves.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-12 text-slate-400">
                            <CalendarDays className="h-10 w-10 mx-auto mb-2 opacity-20" />
                            No leave requests found.
                          </TableCell>
                        </TableRow>
                      )}
                      {leaves.map((leave) => (
                        <TableRow key={leave.id} className="hover:bg-slate-50/50 transition-colors">
                          <TableCell className="font-semibold text-slate-700">
                            {leave.users?.first_name} {leave.users?.last_name}
                          </TableCell>
                          <TableCell className="font-semibold capitalize text-slate-700">
                            {leave.leave_type.toLowerCase()} Leave
                          </TableCell>
                          <TableCell className="text-slate-600">{format(parseLocalDate(leave.start_date), 'MMM d, yyyy')}</TableCell>
                          <TableCell className="text-slate-600">{format(parseLocalDate(leave.end_date), 'MMM d, yyyy')}</TableCell>
                          <TableCell className="max-w-[200px] truncate text-slate-500" title={leave.reason}>{leave.reason}</TableCell>
                          <TableCell>{getStatusBadge(leave.status)}</TableCell>
                          <TableCell className="text-right space-x-2 pr-6">
                            {leave.status === 'PENDING' && (
                              <>
                                <Button
                                  size="icon"
                                  variant="outline"
                                  className="h-8 w-8 text-green-600 border-green-200 hover:bg-green-50"
                                  onClick={() => handleAction(leave, 'APPROVED')}
                                  title="Approve"
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="outline"
                                  className="h-8 w-8 text-red-500 border-red-200 hover:bg-red-50"
                                  onClick={() => handleAction(leave, 'REJECTED')}
                                  title="Reject"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="balances">
            <Card className="border-0 shadow-md bg-white">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-base font-semibold flex items-center gap-2 text-slate-800">
                  <Award className="h-4 w-4 text-primary" />
                  Leave Balances & Regulation
                </CardTitle>
                <CardDescription>View, adjust, and allocate annual leave quotas for employees.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="flex justify-center p-12">
                    <Loader2 className="h-8 w-8 animate-spin text-slate-350" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader className="bg-slate-50/70">
                      <TableRow>
                        <TableHead className="font-bold text-slate-700">Employee</TableHead>
                        <TableHead className="font-bold text-slate-700">Year</TableHead>
                        <TableHead className="font-bold text-slate-700">Sick Leaves</TableHead>
                        <TableHead className="font-bold text-slate-700">Casual Leaves</TableHead>
                        <TableHead className="font-bold text-slate-700">Earned Leaves</TableHead>
                        <TableHead className="font-bold text-slate-700">Total Quota</TableHead>
                        <TableHead className="text-right font-bold text-slate-700 pr-6">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {balances.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-12 text-slate-500">
                            No employees found to list leave balances.
                          </TableCell>
                        </TableRow>
                      )}
                      {balances.map((b) => {
                        const totalQuota = b.sick_leaves + b.casual_leaves + b.earned_leaves;
                        return (
                          <TableRow key={b.user_id} className="hover:bg-slate-50/50 transition-colors">
                            <TableCell className="font-semibold text-slate-700">
                              {b.users?.first_name} {b.users?.last_name}
                            </TableCell>
                            <TableCell className="text-slate-500">{b.year}</TableCell>
                            <TableCell className="font-medium text-slate-700">{b.sick_leaves}</TableCell>
                            <TableCell className="font-medium text-slate-700">{b.casual_leaves}</TableCell>
                            <TableCell className="font-medium text-slate-700">{b.earned_leaves}</TableCell>
                            <TableCell className="font-bold text-indigo-700">{totalQuota} days</TableCell>
                            <TableCell className="text-right pr-6">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                                onClick={() => handleOpenAdjust(b)}
                              >
                                <Edit3 className="h-3.5 w-3.5 mr-1" /> Adjust Quotas
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      ) : (
        /* Requests Table (Employee View) */
        <Card className="border-0 shadow-md bg-white">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-base font-semibold flex items-center gap-2 text-slate-800">
              <CalendarDays className="h-4 w-4 text-primary" />
              My Leave Requests
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center p-12">
                <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-slate-50/70">
                  <TableRow>
                    <TableHead className="font-bold text-slate-700">Type</TableHead>
                    <TableHead className="font-bold text-slate-700">Start Date</TableHead>
                    <TableHead className="font-bold text-slate-700">End Date</TableHead>
                    <TableHead className="font-bold text-slate-700">Reason</TableHead>
                    <TableHead className="font-bold text-slate-700">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaves.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-12 text-slate-400">
                        <CalendarDays className="h-10 w-10 mx-auto mb-2 opacity-20" />
                        No leave requests found.
                      </TableCell>
                    </TableRow>
                  )}
                  {leaves.map((leave) => (
                    <TableRow key={leave.id} className="hover:bg-slate-50/50 transition-colors">
                      <TableCell className="font-semibold capitalize text-slate-700">
                        {leave.leave_type.toLowerCase()} Leave
                      </TableCell>
                      <TableCell className="text-slate-600">{format(parseLocalDate(leave.start_date), 'MMM d, yyyy')}</TableCell>
                      <TableCell className="text-slate-600">{format(parseLocalDate(leave.end_date), 'MMM d, yyyy')}</TableCell>
                      <TableCell className="max-w-[200px] truncate text-slate-500" title={leave.reason}>{leave.reason}</TableCell>
                      <TableCell>{getStatusBadge(leave.status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Apply Leave Dialog */}
      <Dialog open={showApplyDialog} onOpenChange={setShowApplyDialog}>
        <DialogContent className="sm:max-w-md bg-white border-0 shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-800">Apply for Leave</DialogTitle>
            <DialogDescription className="text-slate-500">Submit a leave request. You will be warned if it exceeds your balance.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleApply} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Leave Type</Label>
              <Select value={leaveType} onValueChange={setLeaveType}>
                <SelectTrigger className="border-slate-200">
                  <SelectValue placeholder="Select leave type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SICK">Sick Leave</SelectItem>
                  <SelectItem value="CASUAL">Casual Leave</SelectItem>
                  <SelectItem value="EARNED">Earned Leave</SelectItem>
                  <SelectItem value="UNPAID">Unpaid Leave</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date</Label>
                <Input id="startDate" type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} className="border-slate-200" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">End Date</Label>
                <Input id="endDate" type="date" required value={endDate} onChange={(e) => setEndDate(e.target.value)} className="border-slate-200" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reason">Reason</Label>
              <Input id="reason" required placeholder="Describe the reason for leave" value={reason} onChange={(e) => setReason(e.target.value)} className="border-slate-200" />
            </div>

            {showWarning && (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-lg text-xs">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Leave Credit Warning:</span> This leave duration exceeds your total remaining leave balance of <span className="font-bold">{remainingLeaves.toFixed(1)} days</span>. If approved, this may count as unpaid leave.
                </div>
              </div>
            )}

            {formError && <p className="text-xs text-rose-600 font-semibold">{formError}</p>}
            
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setShowApplyDialog(false)}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting} className="bg-primary text-white">
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Submit Request
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Adjust Leave Balance Dialog */}
      <Dialog open={showAdjustDialog} onOpenChange={setShowAdjustDialog}>
        <DialogContent className="sm:max-w-md bg-white border-0 shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-800">Adjust Leave Balances</DialogTitle>
            <DialogDescription className="text-slate-500">
              Regulate leave quotas for {selectedBalance?.users?.first_name} {selectedBalance?.users?.last_name} for the year {currentYear}.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAdjustBalance} className="space-y-4 py-2">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sick-leaves-quota">Sick Leaves</Label>
                <Input 
                  id="sick-leaves-quota" 
                  type="number" 
                  min="0" 
                  required 
                  value={sickLeaves} 
                  onChange={(e) => setSickLeaves(e.target.value)} 
                  className="border-slate-200" 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="casual-leaves-quota">Casual Leaves</Label>
                <Input 
                  id="casual-leaves-quota" 
                  type="number" 
                  min="0" 
                  required 
                  value={casualLeaves} 
                  onChange={(e) => setCasualLeaves(e.target.value)} 
                  className="border-slate-200" 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="earned-leaves-quota">Earned Leaves</Label>
                <Input 
                  id="earned-leaves-quota" 
                  type="number" 
                  min="0" 
                  required 
                  value={earnedLeaves} 
                  onChange={(e) => setEarnedLeaves(e.target.value)} 
                  className="border-slate-200" 
                />
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-100 p-3 rounded-lg flex gap-2 text-xs text-slate-500 leading-relaxed">
              <Info className="h-4 w-4 text-indigo-500 shrink-0 mt-0.5" />
              <div>
                Adjusting these quotas updates the annual leaves allowed. The total allowed quota will be: <span className="font-bold text-indigo-600">{(parseInt(sickLeaves) || 0) + (parseInt(casualLeaves) || 0) + (parseInt(earnedLeaves) || 0)} days</span>.
              </div>
            </div>

            {formError && <p className="text-xs text-rose-600 font-semibold">{formError}</p>}

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setShowAdjustDialog(false)}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting} className="bg-primary text-white">
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Save Adjustments
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
