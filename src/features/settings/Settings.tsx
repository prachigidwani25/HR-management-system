import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../store/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Loader2, Settings2, User, Lock } from 'lucide-react';

export default function SettingsPage() {
  const { user, setUser } = useAuth();
  const [firstName, setFirstName] = useState(user?.first_name || '');
  const [lastName, setLastName] = useState(user?.last_name || '');
  const [designation, setDesignation] = useState(user?.designation || '');
  const [isSaving, setIsSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPw, setIsChangingPw] = useState(false);
  const [pwMsg, setPwMsg] = useState('');

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSaving(true);
    setProfileMsg('');

    const { error } = await supabase
      .from('users')
      .update({ first_name: firstName, last_name: lastName, designation })
      .eq('id', user.id);

    if (error) {
      setProfileMsg('❌ Failed to update profile.');
    } else {
      setUser({ ...user, first_name: firstName, last_name: lastName, designation });
      setProfileMsg('✅ Profile updated successfully!');
    }
    setIsSaving(false);
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMsg('');
    if (newPassword !== confirmPassword) {
      setPwMsg('❌ New passwords do not match.');
      return;
    }
    if (newPassword.length < 6) {
      setPwMsg('❌ Password must be at least 6 characters.');
      return;
    }
    setIsChangingPw(true);

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setPwMsg('❌ ' + error.message);
    } else {
      setPwMsg('✅ Password changed successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
    setIsChangingPw(false);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500">Manage your account preferences.</p>
      </div>

      {/* Profile Card */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            Profile Information
          </CardTitle>
          <CardDescription>Update your personal details.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleProfileSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={user?.email || ''} disabled className="bg-slate-50 text-slate-500" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="designation">Designation</Label>
              <Input id="designation" value={designation} onChange={(e) => setDesignation(e.target.value)} placeholder="e.g. Software Engineer" />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Input value={user?.role?.replace('_', ' ') || ''} disabled className="bg-slate-50 text-slate-500 capitalize" />
            </div>
            {profileMsg && <p className="text-sm">{profileMsg}</p>}
            <Button type="submit" disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Settings2 className="h-4 w-4 mr-2" />}
              Save Changes
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Password Card */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Lock className="h-4 w-4 text-primary" />
            Change Password
          </CardTitle>
          <CardDescription>Update your password to keep your account secure.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPw">Current Password</Label>
              <Input id="currentPw" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPw">New Password</Label>
              <Input id="newPw" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPw">Confirm New Password</Label>
              <Input id="confirmPw" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            </div>
            {pwMsg && <p className="text-sm">{pwMsg}</p>}
            <Button type="submit" disabled={isChangingPw} variant="outline">
              {isChangingPw ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Lock className="h-4 w-4 mr-2" />}
              Update Password
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
