export type UserRole = 'ADMIN' | 'HR_MANAGER' | 'EMPLOYEE';

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  department_id?: string;
  designation?: string;
  joining_date?: string;
}

export interface Department {
  id: string;
  name: string;
  manager_id?: string;
}

export interface Attendance {
  id: string;
  user_id: string;
  date: string;
  clock_in?: string;
  clock_out?: string;
  status: 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'ON_LEAVE';
}

export interface Leave {
  id: string;
  user_id: string;
  leave_type: 'SICK' | 'CASUAL' | 'EARNED' | 'UNPAID';
  start_date: string;
  end_date: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  approved_by?: string;
}

export interface Document {
  id: string;
  user_id?: string;
  title: string;
  file_url: string;
  document_type: string;
  uploaded_by?: string;
}
