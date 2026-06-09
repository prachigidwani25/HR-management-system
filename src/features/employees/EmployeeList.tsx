import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { createClient } from '@supabase/supabase-js';
import { User, Department } from '../../types';
import { useAuth } from '../../store/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { parseLocalDate } from '../../lib/utils';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Plus, Loader2, Edit, Trash2, ShieldAlert, BellRing } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '../../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { toast } from 'sonner';

// Define a type for users that includes departments relation
interface EmployeeUser extends User {
  departments?: { name: string } | null;
}

export default function EmployeeList() {
  const { user: currentUser } = useAuth();
  const [employees, setEmployees] = useState<EmployeeUser[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Dialogs
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showNotifDialog, setShowNotifDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeUser | null>(null);

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState<'ADMIN' | 'HR_MANAGER' | 'EMPLOYEE'>('EMPLOYEE');
  const [designation, setDesignation] = useState('');
  const [departmentId, setDepartmentId] = useState<string>('NONE');
  const [joiningDate, setJoiningDate] = useState('');
  const [formError, setFormError] = useState('');

  // Notification form states
  const [notifTitle, setNotifTitle] = useState('');
  const [notifMessage, setNotifMessage] = useState('');

  useEffect(() => {
    fetchEmployees();
    fetchDepartments();
  }, []);

  const fetchEmployees = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('users')
      .select('*, departments:departments!users_department_id_fkey(name)')
      .order('first_name', { ascending: true });
    
    if (!error && data) {
      setEmployees(data as EmployeeUser[]);
    } else if (error) {
      toast.error('Failed to load employees');
    }
    setIsLoading(false);
  };

  const fetchDepartments = async () => {
    const { data, error } = await supabase.from('departments').select('*');
    if (!error && data) {
      setDepartments(data as Department[]);
    }
  };

  const handleOpenAdd = () => {
    setEmail('');
    setPassword('');
    setFirstName('');
    setLastName('');
    setRole('EMPLOYEE');
    setDesignation('');
    setDepartmentId('NONE');
    setJoiningDate('');
    setFormError('');
    setShowAddDialog(true);
  };

  const handleOpenEdit = (emp: EmployeeUser) => {
    setSelectedEmployee(emp);
    setFirstName(emp.first_name || '');
    setLastName(emp.last_name || '');
    setRole(emp.role || 'EMPLOYEE');
    setDesignation(emp.designation || '');
    setDepartmentId(emp.department_id || 'NONE');
    setJoiningDate(emp.joining_date || '');
    setFormError('');
    setShowEditDialog(true);
  };

  const handleOpenSendNotif = (emp: EmployeeUser) => {
    setSelectedEmployee(emp);
    setNotifTitle('');
    setNotifMessage('');
    setFormError('');
    setShowNotifDialog(true);
  };

  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!selectedEmployee) return;
    if (!notifTitle || !notifMessage) {
      setFormError('Title and message are required.');
      return;
    }
    setIsSubmitting(true);

    try {
      const { error } = await supabase.from('notifications').insert({
        user_id: selectedEmployee.id,
        title: notifTitle,
        message: notifMessage,
        is_read: false,
      });

      if (error) throw error;

      toast.success(`Notification sent to ${selectedEmployee.first_name}`);
      setShowNotifDialog(false);
    } catch (err: any) {
      setFormError(err.message || 'Failed to send notification');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Add Employee using secondary client trick to prevent admin sign-out
  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!email || !password || !firstName || !lastName) {
      setFormError('Required fields are missing.');
      return;
    }
    setIsSubmitting(true);

    try {
      // 1. Create a non-persistent supabase client
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const tempSupabase = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      });

      // 2. Sign up the user in Auth
      const { data: authData, error: authError } = await tempSupabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
            role,
            designation,
          },
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('User creation failed.');

      // 3. Since RLS triggerhandle_new_user should run, wait a split second
      // then update the profile details (department_id) which the trigger might not have set.
      const deptVal = departmentId === 'NONE' ? null : departmentId;
      const joinDateVal = joiningDate || new Date().toISOString().split('T')[0];
      
      const { error: updateError } = await supabase
        .from('users')
        .update({
          department_id: deptVal,
          joining_date: joinDateVal,
        })
        .eq('id', authData.user.id);

      if (updateError) {
        // If trigger didn't run, manually insert the user profile (as we are Admin, the insert policy allows it)
        const { error: insertError } = await supabase
          .from('users')
          .insert({
            id: authData.user.id,
            email,
            first_name: firstName,
            last_name: lastName,
            role,
            designation,
            department_id: deptVal,
            joining_date: joinDateVal,
          });
        
        if (insertError) throw insertError;
      }

      toast.success(`Employee ${firstName} ${lastName} created successfully!`);
      setShowAddDialog(false);
      fetchEmployees();
    } catch (err: any) {
      setFormError(err.message || 'Failed to create employee');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!selectedEmployee) return;
    if (!firstName || !lastName) {
      setFormError('First and last names are required.');
      return;
    }
    setIsSubmitting(true);

    try {
      const deptVal = departmentId === 'NONE' ? null : departmentId;
      const { error } = await supabase
        .from('users')
        .update({
          first_name: firstName,
          last_name: lastName,
          role,
          designation,
          department_id: deptVal,
          joining_date: joiningDate || null,
        })
        .eq('id', selectedEmployee.id);

      if (error) throw error;

      toast.success('Employee updated successfully');
      setShowEditDialog(false);
      fetchEmployees();
    } catch (err: any) {
      setFormError(err.message || 'Failed to update employee');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteEmployee = async (emp: EmployeeUser) => {
    if (emp.id === currentUser?.id) {
      toast.error('You cannot delete your own account!');
      return;
    }
    if (!confirm(`Are you sure you want to delete ${emp.first_name} ${emp.last_name}?`)) return;

    try {
      const { error } = await supabase.from('users').delete().eq('id', emp.id);
      if (error) throw error;
      toast.success('Employee deleted successfully');
      fetchEmployees();
    } catch (err: any) {
      toast.error('Failed to delete employee: ' + err.message);
    }
  };

  const canManage = currentUser?.role === 'ADMIN';

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-800">Employee Management</h1>
          <p className="text-sm text-slate-500 mt-1">Add, edit, delete and view roles of company workforce.</p>
        </div>
        {canManage && (
          <Button onClick={handleOpenAdd} className="bg-primary hover:bg-primary/95 text-white">
            <Plus className="mr-2 h-4 w-4" /> Add Employee
          </Button>
        )}
      </div>

      <Card className="border-0 shadow-md bg-white">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center p-12">
              <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50/70">
                <TableRow>
                  <TableHead className="font-bold text-slate-700">Employee / Title</TableHead>
                  <TableHead className="font-bold text-slate-700">Email</TableHead>
                  <TableHead className="font-bold text-slate-700">Role</TableHead>
                  <TableHead className="font-bold text-slate-700">Department</TableHead>
                  <TableHead className="font-bold text-slate-700">Joining Date</TableHead>
                  {canManage && <TableHead className="text-right font-bold text-slate-700 pr-6">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={canManage ? 6 : 5} className="text-center py-12 text-slate-500">
                      No employees found.
                    </TableCell>
                  </TableRow>
                )}
                {employees.map((employee) => (
                  <TableRow key={employee.id} className="hover:bg-slate-50/50 transition-colors">
                    <TableCell className="font-semibold text-slate-700">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-slate-50 flex items-center justify-center text-slate-600 font-bold text-sm shrink-0 border border-slate-200">
                          {employee.first_name?.[0] || ''}{employee.last_name?.[0] || ''}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800">{employee.first_name} {employee.last_name}</p>
                          <p className="text-xs text-slate-400 font-normal">{employee.designation || '—'}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-600">{employee.email}</TableCell>
                    <TableCell>
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                        employee.role === 'ADMIN' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' :
                        employee.role === 'HR_MANAGER' ? 'bg-orange-50 text-orange-700 border-orange-100' : 'bg-slate-50 text-slate-600 border-slate-200'
                      }`}>
                        {employee.role?.replace('_', ' ')}
                      </span>
                    </TableCell>
                    <TableCell className="text-slate-600">{employee.departments?.name || '—'}</TableCell>
                    <TableCell className="text-slate-600">
                      {employee.joining_date ? parseLocalDate(employee.joining_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                    </TableCell>
                    {canManage && (
                      <TableCell className="text-right space-x-2 pr-6">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-indigo-600 hover:bg-indigo-50"
                          onClick={() => handleOpenSendNotif(employee)}
                          title="Send Notification"
                        >
                          <BellRing className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-blue-600 hover:bg-blue-50"
                          onClick={() => handleOpenEdit(employee)}
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-rose-600 hover:bg-rose-50"
                          onClick={() => handleDeleteEmployee(employee)}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Employee Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md bg-white border-0 shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-800">Add New Employee</DialogTitle>
            <DialogDescription className="text-slate-500">Create login credentials and company profile details.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddEmployee} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input id="firstName" required value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Jane" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input id="lastName" required value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Doe" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane.doe@company.com" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Temporary Password</Label>
              <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 6 characters" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="designation">Designation</Label>
                <Input id="designation" value={designation} onChange={(e) => setDesignation(e.target.value)} placeholder="e.g. Developer" />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={role} onValueChange={(val: any) => setRole(val)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EMPLOYEE">Employee</SelectItem>
                    <SelectItem value="HR_MANAGER">HR Manager</SelectItem>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="add-joiningDate">Joining Date</Label>
                <Input 
                  id="add-joiningDate" 
                  type="date" 
                  value={joiningDate} 
                  onChange={(e) => setJoiningDate(e.target.value)} 
                  className="border-slate-200"
                />
              </div>
              <div className="space-y-2">
                <Label>Department</Label>
                <Select value={departmentId} onValueChange={setDepartmentId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">No Department</SelectItem>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {formError && (
              <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 text-rose-800 p-2.5 rounded-lg text-xs font-semibold">
                <ShieldAlert className="h-4 w-4 text-rose-600 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting} className="bg-primary text-white">
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Create Employee
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Employee Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-md bg-white border-0 shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-800">Edit Employee Profile</DialogTitle>
            <DialogDescription className="text-slate-500">Update company details, department, or assign a new role.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditEmployee} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-firstName">First Name</Label>
                <Input id="edit-firstName" required value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-lastName">Last Name</Label>
                <Input id="edit-lastName" required value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-designation">Designation</Label>
                <Input id="edit-designation" value={designation} onChange={(e) => setDesignation(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={role} onValueChange={(val: any) => setRole(val)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EMPLOYEE">Employee</SelectItem>
                    <SelectItem value="HR_MANAGER">HR Manager</SelectItem>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-joiningDate">Joining Date</Label>
                <Input 
                  id="edit-joiningDate" 
                  type="date" 
                  value={joiningDate} 
                  onChange={(e) => setJoiningDate(e.target.value)} 
                  className="border-slate-200"
                />
              </div>
              <div className="space-y-2">
                <Label>Department</Label>
                <Select value={departmentId} onValueChange={setDepartmentId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">No Department</SelectItem>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {formError && (
              <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 text-rose-800 p-2.5 rounded-lg text-xs font-semibold">
                <ShieldAlert className="h-4 w-4 text-rose-600 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setShowEditDialog(false)}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting} className="bg-primary text-white">
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Send Notification Dialog */}
      <Dialog open={showNotifDialog} onOpenChange={setShowNotifDialog}>
        <DialogContent className="sm:max-w-md bg-white border-0 shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-800">Send Notification</DialogTitle>
            <DialogDescription className="text-slate-500">
              Send a direct alert/message to {selectedEmployee?.first_name} {selectedEmployee?.last_name}.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSendNotification} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="notif-title">Subject / Title</Label>
              <Input
                id="notif-title"
                required
                value={notifTitle}
                onChange={(e) => setNotifTitle(e.target.value)}
                placeholder="e.g. Action Required: Fill your timesheet"
                className="border-slate-200"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notif-message">Message</Label>
              <textarea
                id="notif-message"
                required
                rows={4}
                value={notifMessage}
                onChange={(e) => setNotifMessage(e.target.value)}
                placeholder="Enter the notice details here..."
                className="flex w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            {formError && <p className="text-xs text-rose-600 font-semibold">{formError}</p>}

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setShowNotifDialog(false)}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting} className="bg-primary text-white">
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Send Alert
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
