# End-to-End Test Plan: HR Management System (HRMS)

This document details the step-by-step testing scenarios, target roles, inputs, and expected outcomes to verify all modules in the HRMS.

---

## 1. Authentication & Routing Scenarios

### Test Case 1.1: Public Route Access & Protection
* **Goal**: Verify route guards redirect unauthenticated users and block unauthorized roles.
* **Steps**:
  1. Open an incognito browser window and navigate to the root path: `/` (or any sub-path like `/attendance`).
  2. Verify that you are immediately redirected to the `/login` page.
  3. Attempt to manually navigate to `/employees` in the URL bar.
  4. Verify that you are redirected back to `/login`.

### Test Case 1.2: Single-Attempt Sign-In (Double Login Bug Fix)
* **Goal**: Verify that entering valid credentials logs the user in immediately without redirecting them back to `/login`.
* **Steps**:
  1. Go to `/login` and select the **Sign In** tab.
  2. Enter valid employee/admin credentials.
  3. Click **Sign in**.
  4. Verify that the app displays a loading spinner for a brief moment and transitions directly to the Dashboard `/` without kicking you back to `/login`.

### Test Case 1.3: Page Refresh Fallback (404 Bug Fix)
* **Goal**: Verify that refreshing the page on client routes doesn't trigger a 404.
* **Steps**:
  1. Sign in to the portal.
  2. Navigate to the `/attendance` page.
  3. Hit the browser's refresh button (or press `F5` / `Cmd+R`).
  4. Verify that the page reloads successfully and renders the Attendance view, rather than showing a "404 Not Found" page.
  5. Repeat this on `/leave`, `/holidays`, and `/settings`.

### Test Case 1.4: Role-Based Authorization Restrictions
* **Goal**: Verify that employees cannot access administrative routes.
* **Steps**:
  1. Log in with an account having the `EMPLOYEE` role.
  2. Check the sidebar menu; verify that the **Employees** link is **not** visible.
  3. Manually type `/employees` in the browser URL bar and hit enter.
  4. Verify that the application redirects to `/unauthorized` showing a `403` error page with a link to return to the dashboard.

---

## 2. Attendance System Scenarios

### Test Case 2.1: Clock-In Flow
* **Goal**: Verify checking in records the correct local time and marks the user as Present.
* **Steps**:
  1. Log in as an Employee.
  2. Go to the **Attendance** tab.
  3. Verify that the "Clock In" button is active and the "Clock Out" button is disabled.
  4. Click **Clock In**.
  5. Verify that:
     - The button shows a loading spinner during the process.
     - The clock-in time is displayed under "Clocked In" on the card.
     - The status badge changes to **Present** (Green).
     - The "Clock In" button is now disabled.
     - The "Clock Out" button becomes active.
     - A new record appears at the top of the "My Attendance History" log list with today's date and the correct clock-in time.

### Test Case 2.2: Clock-Out & Duration Flow
* **Goal**: Verify checking out logs the end time and computes duration.
* **Steps**:
  1. Having clocked in from Test Case 2.1, click **Clock Out**.
  2. Verify that:
     - The clock-out time is logged under "Clocked Out".
     - The duration is calculated and matches the time difference (e.g. `0h 5m`).
     - Both "Clock In" and "Clock Out" buttons are disabled for the remainder of the day.
     - The attendance record in the history list updates to show the clock-out time and calculated duration.

### Test Case 2.3: Date Stability (Timezone Shift Verification)
* **Goal**: Verify dates don't drift (e.g. show yesterday's date) due to client timezone offsets.
* **Steps**:
  1. Log in as an employee in a negative or positive timezone (e.g., USA, UK, India).
  2. Log an attendance, submit a leave, or look at a holiday.
  3. Verify that the date displayed in tables (e.g. `"Jun 9, 2026"`) matches exactly what is recorded, and doesn't shift forward/backward when refreshing or reloading.

---

## 3. Leave Management Scenarios

### Test Case 3.1: Leave Request Submission & Credit Warnings
* **Goal**: Verify leave warnings trigger if the duration exceeds remaining credit quotas.
* **Steps**:
  1. Log in as an Employee. Go to the **Dashboard** and note your "Remaining Balance" (e.g., `9.0` days).
  2. Navigate to the **Leave** tab.
  3. Click **Apply for Leave**.
  4. Fill in the form:
     - Select a duration of 3 days (e.g. Jun 10 to Jun 12).
     - Verify no warning banner is shown since 3 days is less than your remaining balance.
  5. Now, change the dates to a duration of 12 days (exceeding your 9.0 remaining days).
  6. Verify that an amber warning banner appears: *"Leave warning: You are requesting more days than your remaining balance..."*
  7. Click **Submit**. Verify the leave request appears in your history as **Pending**.

### Test Case 3.2: HR/Admin Approval & Attendance Synchronization
* **Goal**: Verify that approving a leave automatically logs `ON_LEAVE` attendance records.
* **Steps**:
  1. Log in as an Admin or HR Manager.
  2. Navigate to the **Leave** tab.
  3. Locate the pending leave request submitted in Test Case 3.1.
  4. Click the green checkmark/Approve button.
  5. Verify the status changes to **Approved**.
  6. Navigate to the **Attendance** tab (or check the Admin Dashboard stats).
  7. Verify that for each date in that approved leave range, an attendance entry has been automatically created with the status **On Leave** (Blue).
  8. Log back in as the Employee who requested the leave; check their Dashboard "Used Leaves" count and verify it has updated to include the approved days.

### Test Case 3.3: Manual Quota Adjustment (Leave Regulation)
* **Goal**: Verify HR/Admin can directly modify individual leave balances.
* **Steps**:
  1. Log in as an Admin. Go to the **Leave** tab.
  2. Click on the **Leave Balances & Regulation** tab.
  3. Find the target employee and click the edit/adjust button next to their name.
  4. Change their Sick Leaves, Casual Leaves, or Earned Leaves quota to new values.
  5. Click **Save Changes**.
  6. Verify the new balances are reflected in the table.
  7. Log in as that employee, look at the Dashboard, and verify their credited leaves and remaining balance have changed accordingly.

---

## 4. Holidays & Announcements

### Test Case 4.1: Holiday Creation & Feed Display
* **Goal**: Verify that creating a holiday updates the company calendar.
* **Steps**:
  1. Log in as an Admin. Navigate to the **Holidays** tab.
  2. Click **Add Holiday**.
  3. Enter name, type, and choose a date in the future. Click **Save**.
  4. Verify the holiday appears in the Holiday Schedule list.
  5. Go to the **Dashboard** page; verify the holiday appears in the "Upcoming Holidays" calendar widget.

### Test Case 4.2: Pinned Announcements priority sorting
* **Goal**: Verify announcements feed sorts pinned notices to the top.
* **Steps**:
  1. Log in as an Admin or HR Manager. Navigate to the **Announcements** tab.
  2. Click **Post Announcement** and create a standard notification (not pinned).
  3. Create another announcement, select the **Pin Announcement** checkbox, and select **High Priority**.
  4. Go to the **Dashboard** page.
  5. Verify the pinned announcement sits at the very top of the feed with a "Pinned" badge and "High Priority" formatting, regardless of creation timestamp.

---

## 5. Employee Management (Admin Panel)

### Test Case 5.1: Non-Disruptive Employee Sign-Up
* **Goal**: Verify admins can create accounts without being logged out.
* **Steps**:
  1. Log in as an Admin. Go to the **Employees** tab.
  2. Click **Add Employee**.
  3. Enter a new email, temporary password, name, department, designation, and select a role (e.g. `EMPLOYEE`).
  4. Click **Create Employee**.
  5. Verify that:
     - A success alert appears.
     - The new employee is added to the directory list.
     - You (the Admin) are **still logged in** to your session and have not been kicked back to `/login`!

### Test Case 5.2: Employee Profile Modifications & Deletions
* **Goal**: Verify CRUD settings update database fields correctly.
* **Steps**:
  1. As Admin, click the edit button next to the newly created employee.
  2. Modify their designation, change their role to `HR_MANAGER`, and select a department.
  3. Save changes; verify details reflect in the employees list.
  4. Click the delete/trash icon. Confirm the prompt.
  5. Verify the employee profile is removed from the system.

---

## 6. Notification Center

### Test Case 6.1: Real-Time Notifications Broadcast
* **Goal**: Verify notifications are delivered immediately to employees.
* **Steps**:
  1. Open two browser sessions side-by-side:
     - Session A: Logged in as Admin.
     - Session B: Logged in as Employee.
  2. In Session A, go to **Employees**, click **Send Notification** next to the Employee in Session B, enter a title/message, and click send.
  3. In Session B, watch the bell icon in the top header.
  4. Verify that the notification badge incremented in real-time without refreshing the page, and the dropdown shows the new notification.
  5. In Session B, click **Mark as Read** and verify the unread count decrements.
