# Acadia Clean IQ

A mobile-first washroom cleaning compliance tracking app for business owners and their staff.

## Brand Colors

The app uses a consistent color palette across all screens:

| Color | Hex | Usage |
|-------|-----|-------|
| Mint Background | `#F0FFF7` | Main background for all screens |
| Dark Emerald | `#065F46` | Headers, primary admin buttons, "Acadia" logo text |
| Action Green | `#10B981` | User action buttons (Sign In, Complete Cleaning, Submit) |
| Text Primary | `#064E3B` | High-contrast text (HIG compliant) |
| Error Red | `#EF4444` | Error states, issue reporting borders |

## Features

- **Location Management**: Business owners can create and manage multiple washroom locations
- **Alert Email Persistence**: The alert email entered during location creation is saved to Supabase and pre-filled when viewing location settings. Saving an alert email automatically enables overdue cleaning alerts for that location.
- **Staff PIN Protection**: Each location has a 4-5 digit PIN that staff must enter before logging a cleaning (prevents fake log submissions)
- **Unique Public URLs**: Each location has a unique URL (`/washroom/[location_id]`) for staff to log cleanings via QR code
- **Bilingual Checklist**: Staff complete a 12-item checklist organized in 3 sections (English/French):

  **1. Supplies & Restocking (Hygiene & Handwashing)**
  - Handwashing Station: Liquid/Powder soap is full; paper towels or air dryer are functional. Bar soap is not permitted.
  - Toilet Paper: All dispensers are stocked with at least one backup roll. Paper must be stored in the dispenser and not on the floor or tank.
  - Bins: Covered disposal bin in stalls is emptied and sanitized. Ensure liners are replaced and the lid is functioning correctly.
  - Required Signage: "Wash Your Hands" / "Lavez vos mains" signage is clearly posted near the sink (Mandatory for staff/food premises compliance). **Has N/A option for non-food premises.**

  **2. Sanitization (Infection Control)**
  - Surfaces Disinfected: All high-touch points (faucets, flush handles, stall locks, grab bars, and door handles) cleaned with DIN-registered disinfectant.
  - Fixtures: Sinks, toilets, and urinals are scrubbed and free of visible scale/waste. Ensure no "biofilm" or slime buildup is present around drain rings.
  - Cleaning Tools: Ensure cloths used for toilets are not used for sinks (color-coding) to prevent cross-contamination.
  - Chemical Storage: All cleaning chemicals are labeled and stored in a secure area away from public reach.

  **3. Facility & Safety (Compliance)**
  - Water Temperature: Confirmed hot water is functional (must be between 35°C and 43°C). Cold water must also be available to allow for tempered mixing.
  - Floors: Swept and mopped; confirmed dry and free of trip hazards. Check that floor drains (if present) are clear and not emitting odors.
  - Ventilation & Lighting: Exhaust fan is running and all light bulbs are functional. Ventilation covers must be free of visible dust accumulation.
  - Structural Integrity: Walls and floors are checked for cracks or water damage (surfaces must remain "impervious to moisture" per NB Health code).
- **Staff Name Tracking**: Each cleaning log records the staff member's name
- **Conditional Status**:
  - **Complete**: All checklist items are checked
  - **Attention Required / Attention requise**: One or more items are unchecked
- **Mandatory Notes**: When status is "Attention Required", maintenance notes are mandatory
- **Status Icons**: Public display shows green checkmark for Complete, yellow warning for Attention Required (unless resolved)
- **Email Alerts**: Automated server-side email alerts via Resend API when a cleaning requires attention or an issue is reported. Supports multiple recipients with flexible configuration.
- **Global & Location-Specific Alert Emails**:
  - **Global Alerts**: Set one or more email addresses to receive alerts for ALL locations (great for general managers, operations directors)
  - **Location-Specific Alerts**: Set different email addresses for each location (great for day/night supervisors at specific locations)
  - **Toggle Control**: Enable "Use Global Emails for All Locations" to send all alerts to global emails, or disable to use location-specific emails only
  - **Combined Delivery**: When global alerts are enabled, both global AND location-specific emails receive alerts
- **Manager Resolution**: Managers can mark "Attention Required" entries as resolved, which removes the yellow warning from the public badge while keeping the note for audit purposes
- **Issue Resolution with Actions**: When resolving a reported issue, managers choose from context-specific resolution options:
  - **Out of Supplies**: "Restocked" (creates cleaning log) or "Not Needed"
  - **Needs Cleaning**: "Cleaned" (creates cleaning log) or "Already Clean"
  - **Maintenance Required**: "Fixed", "Scheduled for Repair", or "Not an Issue"
  - **Safety Concern**: "Resolved", "Area Secured", or "Not an Issue"
  - **Other**: "Addressed", "Cleaned" (creates cleaning log), or "Not an Issue"
  - Options that create a cleaning log automatically update the location status to CLEAN and update the `last_cleaned` timestamp on both the manager dashboard and public status card
  - All labels are bilingual (English/French)
- **Compliance Record**: Displays the 2 most recent cleaning entries with date, time, staff name, and status
- **Password-Protected Access**: Manager Dashboard requires password authentication from the main page
- **NEW Washroom Badge**: New washrooms without any cleaning logs are highlighted with a blue "NEW" badge and "NEEDS QR CODE" status to remind admins to generate QR codes.
- **Admin Email Notifications**: When a manager adds a new washroom, the admin (chris@acadiacleaniq.ca) receives an email notification with washroom details and a reminder to generate QR codes.
- **Export History (PDF)**: Managers can export cleaning history for any location with custom date range selection (7, 14, 30, or 90 days, or custom dates)
- **Send to Inspector**: Generate professional audit reports for NB Department of Health compliance with custom date ranges
- **Incident Reports Export (PDF)**: Separate export for public-reported issues with:
  - Bilingual headers (English/French)
  - Issue type, time reported, time resolved, resolution notes
  - Resolution metrics (average time to resolve)
  - Toggle to include/exclude open issues
  - Summary showing total issues, resolved count, open count

## Subscription Tiers (Future)

The database supports subscription tiers for future premium features. Currently all features are available to all users.

### Admin Management
- Admins can toggle subscription tier (Standard/Premium) for each business from the Admin Dashboard
- The `subscription_tier` column exists in the database for future feature gating
- **Customizable Trial Length**: Admins can set the free trial period (7, 14, 30, 60, or 90 days) when creating a new business
- **Trial Extension**: Admins can extend a business's trial period directly from the dashboard by tapping the "Extend" button next to the trial status. Options: +7, +14, +30, +60, or +90 days
- **Alert Threshold Options**: Alert settings support 1, 2, 4, 6, 8, 12, or 24 hour thresholds for overdue cleaning notifications
- **Per-Day Business Hours Schedule**: Business-level alert scheduling with different start/end times for each day of the week. All washrooms inherit the business hours. Editable by managers, supervisors, and admin from both the Manager Dashboard (Settings tab) and Admin Dashboard. Changes sync bidirectionally via the `alert_schedule` JSONB column on the businesses table.
- **Admin Dashboard Visibility**:
  - Staff PINs are displayed under business emails for quick reference (updates automatically when managers change their PIN)
  - Trial status shows days remaining and expiration date
  - Logs and issues counts are tappable to open quick view modal
- **Quick View Modal**: Tap on logs or issues count to see recent entries without navigating away. Includes:
  - Tab switcher between Logs and Issues
  - Recent cleaning logs with status, staff name, and notes
  - Reported issues with status (open/resolved) and descriptions
  - "View Full Details" button to navigate to full business detail page
- **Logs & Issues Display**: Each business card shows total logs count and open issues count
- Future premium features may include: photo attachments, automated reminders, supply tracking, analytics dashboard

## Security

- **Universal Staff PIN**: Each business can set a single staff PIN that works for all their washroom locations. This simplifies PIN management when cleaning staff work across multiple locations.
- **PIN-Protected Cleaning Forms**: Each location requires a PIN to submit cleaning logs, preventing unauthorized submissions from people who guess URLs. The system first checks the universal business PIN, then falls back to the individual washroom PIN.
- **PIN Verification**: PINs are stored hashed in Supabase and verified against the database
- **PIN Management in Location Settings**: Managers can view and change the Universal Staff PIN from within the individual Location Settings modal (not on the main overview page)
- **Immediate PIN Invalidation**: When a manager updates the Universal PIN, the old PIN is immediately invalidated - only the new PIN works for cleaning log submissions
- **PIN Display for Managers**: The Location Settings modal displays the plain PIN so managers can share it with authorized staff
- **Editable Alert Email**: Location alert emails can be edited and saved directly from the Location Management modal
- **Soft Delete (Active Toggle)**: Locations can be deactivated instead of deleted, preserving data while hiding them from the cleaning app
- **Public Badge**: The washroom public page showing the last two cleanings is accessible without authentication
- **Staff Form**: Staff only see PIN entry, checklist and notes field - no access to email or settings
- **Manager Access**: The shield icon on the main page requires password authentication to access settings and the Manager Dashboard
- **Manager Dashboard**: Password-protected; shows unresolved attention items, location settings (including supervisor email and PIN), and allows resolution
- **Forgot Password**: Manager login includes contact information for password recovery (jay@acadiacleaniq.ca)
- **Secure Password Storage**: Manager passwords are hashed using bcrypt before storage. Plain-text passwords are never stored or displayed.
- **Environment Variables**: Supabase credentials are stored in environment variables (`EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`), not hardcoded
- **Safe Session Data**: Login sessions only store non-sensitive business data (no password hashes in AsyncStorage)
- **Automatic Password Migration**: Legacy plain-text passwords are automatically upgraded to bcrypt hashes on successful login
- **Supabase Auth Disabled**: The Supabase client is configured with `persistSession: false` and `autoRefreshToken: false` to prevent auth token refresh issues on Safari/web. This app uses a custom auth system via AsyncStorage, not Supabase Auth.

### Secure Manager Access (Hidden URL)

For enhanced security on public-facing deployments, managers access the portal via a hidden URL:

- **Hidden Manager URL**: `/manage-acadia9511` - not linked from the public site
- **Email + Password Authentication**: Managers log in with their business email and password (stored hashed in Supabase)
- **Rate Limiting Protection**:
  - 5 failed login attempts triggers a 15-minute lockout
  - Countdown timer shows remaining lockout time
  - Attempts counter warns users before lockout
  - Lockout data persists in AsyncStorage
- **Per-Location Credentials**: Each business location has unique email/password credentials
- **Admin-Only Business Creation**: Only admins can create new business accounts with credentials

**Manager Login Flow:**
1. Admin creates new business in admin dashboard with email + password
2. Admin shares the hidden URL (`/manage-acadia9511`) with the business manager
3. Manager bookmarks the URL and uses email/password to log in
4. Rate limiting protects against brute-force attacks even on public URLs

**Password Recovery:**
If a manager forgets their password, the admin can update it directly in Supabase (businesses table → password_hash field) or create a new business account

## Design

- **Unified Branding**: All screens use the AcadiaLogo component for consistent logo display (Business Login, Cleaning Page, Admin Dashboard)
- **Consistent Brand Identity**: All screens use the same color palette (Mint background #F0FFF7, Dark Emerald #065F46 for headers, Action Green #10B981 for user buttons)
- **Atlantic Timezone**: All timestamps throughout the app are displayed in Atlantic Time (Moncton/Dieppe). This is the single standardized timezone for the entire application.
- **Premium Navigation Bar**: The Manager Dashboard features a refined bottom navigation bar with:
  - Subtle glow effect (light emerald background) on the active tab icon
  - Filled icons for active state, outline icons for inactive state
  - Small dot indicator below the active tab
  - Increased stroke weight for active icons
- **Modal Time Picker**: Business hours scheduling uses a mobile-friendly modal time picker instead of keyboard entry, with quick-select options for common times
- **Reusable Header Component**: `AppHeader` component with centered Acadia Clean IQ logo, radial gradient (#CFFFE5 to #F0FFF7), bilingual navigation labels
- **Custom Logo**: SVG logo featuring a QR code pattern with a water drop containing a white checkmark. "Acadia" in Dark Emerald, "Clean IQ" in Action Green
- **Lightweight Public QR Landing Page**: Optimized for fast loading in low-bandwidth environments (e.g., restrooms with poor Wi-Fi)
  - No heavy animations or gradients
  - Minimal JavaScript bundle
  - Essential information displayed immediately
  - Simple solid backgrounds instead of LinearGradient
  - Reduced icon imports
- **Hero Status Display**: Large, bold status text (CLEAN/PROPRE) as the primary visual element
- **Consistent Card Design**: All cards have 12-16px border-radius and soft shadows for depth
- **Status indicators**:
  - Green "CLEAN/PROPRE": Complete cleanings with simple checkmark icon
  - Yellow "ATTENTION/REQUISE": Attention Required cleanings (not yet resolved)
- **Report Issue Modal**: White card with red border (#EF4444), bilingual Submit button in Action Green (#10B981), text input for issue description, photo upload button in Dark Emerald (#065F46)
- **Recent Cleaning Logs Table**: Clean table layout with Dark Emerald header, Location and Status clearly separated, mint background for Compliant rows, gray for Empty states
- **Public Actions**: Compact "Report an Issue" button (red) for visitors to report problems
- **Staff-Only Access**: Subtle "Staff Only" button that always requires PIN to access cleaning log
- **Compliance badge**: "Compliance Verified / Conformité vérifiée" badge at the bottom of every public page
- **Powered by footer**: "Powered by Acadia Clean IQ" pinned at the bottom
- **Bilingual (EN/FR)**: All text displayed in English first, French second

## Business Portal Dashboard Features

The Business Portal Dashboard (`/manager`) provides a comprehensive single-page view:

1. **Hero Header**: Large, prominent business name at the top-center (from database)
2. **Bilingual Buttons**: "Logout / Déconnexion" and "Add Location / Ajouter un emplacement"
3. **Current Status Grid**: Visual grid showing all locations with green/red/gray status indicators, plus external link icon to view public page
4. **Active Issues**: Visitor-reported issues requiring attention (red cards)
5. **Attention Required**: Staff-logged attention items (amber cards)
6. **Recent Cleaning Logs**: Live feed of the latest 10 cleaning entries (shows "Empty / Vide" when no logs)
7. **Send to Inspector**: Collapsible section for generating PDF audit reports
8. **Compliance Footer**: "Compliance Verified / Conformité vérifiée" badge
9. **Powered by Footer**: "Powered by Acadia Clean" at the bottom

### Manager Dashboard Settings Tab

The Settings tab provides comprehensive business configuration:

- **Alert Email Settings**: Manage global alert emails with toggle for using global emails across all locations
- **Business Hours Schedule**: Configure alert hours for each day of the week (combined with alert settings in one save action)
- **PIN for All Washrooms**: Universal PIN management card that displays the current PIN and allows updating the PIN for all locations at once
- **Send to Inspector**: Generate PDF audit reports for NB Department of Health compliance

### Manager Dashboard Activity Tab

The Activity tab shows cleaning logs and issues:

- **Cleaning Logs**: Recent cleaning entries with location, staff name, timestamp, and compliance status
- **Issues**: Open issues requiring attention with resolve button
- **Resolved Issues (30 Days)**: Collapsible section showing all resolved issues from the past 30 days with:
  - Resolution action taken
  - Resolved by (manager name)
  - Resolution timestamp
  - Issue type and location

### Manager Dashboard Locations Tab

The Locations tab provides location-specific management:

- **Location Status Cards**: Visual status (CLEAN, ATTENTION, ISSUE, NEW, INACTIVE) with recent cleaning times
- **Location Settings Modal**: View public page, export history PDF, manage alert email, toggle location active status
- **Note**: PIN management has been moved to the Settings tab for centralized management

### View Public Page Feature

Both the Admin Dashboard and Business Portal include a "View Public Page" link for each location:
- **Admin Dashboard**: External link icon next to each location in the list
- **Business Portal**: External link icon in the status grid AND "View Public Page" button in location settings modal
- Opens `/washroom/[id]` in a new browser tab to preview exactly what the public sees

## Structure

- `/` - Business Portal Login page (Acadia Clean: Partner Portal) - for business owners and admin access
- `/manage-acadia9511` - **Hidden secure manager login** with rate limiting (share only with authorized managers)
- `/washroom/[id]` - Public QR landing page (hero status display, issue reporting, staff PIN access) - standalone public access
- `/public-log/[id]` - Modern mint/emerald public display screen with glass-effect UI showing cleaning status
- `/scan/[id]` - Redirect route for QR code scans (redirects to `/washroom/[id]`)
- `/login` - Alternative business login page
- `/admin-login` - Admin login page for system administrators
- `/admin` - Admin Master View for managing all businesses and locations
- `/manager` - Acadia Clean Business Portal (for logged-in business owners) with location settings, issue resolution, and CSV export

## App Flow

### Public Flow (QR Code Scanning)
1. Public scans QR code pointing to `https://acadia-clean.vibecode.app/scan/[location_id]`
2. Automatically redirected to `/washroom/[id]` - the Location Status Page
3. Public can see cleaning status (CLEAN/PROPRE) and report issues
4. Staff can tap "Staff Only" button and enter PIN to log cleanings

### Business Flow
1. Business owner visits the app homepage (`/`)
2. Sees "Acadia Clean: Partner Portal" login form
3. Enters email and password to sign in
4. Redirected to `/manager` - the Business Portal Dashboard
5. Can manage locations, view issues, export reports

### Admin Flow
1. Admin clicks "Admin Access" from the homepage
2. Enters admin credentials on `/admin-login`
3. Redirected to `/admin` - the Admin Master View
4. Can view all businesses, all locations, system-wide statistics
5. Can permanently delete washroom locations (with confirmation)
6. Can edit business address (auto-populates in audit reports)
7. Can view plain-text Staff PINs for all washrooms in Business Info section

## QR Code URLs

QR codes use standard HTTPS URLs for maximum phone camera compatibility:
- Format: `https://acadia-clean.vibecode.app/scan/[location_id]`
- When scanned, the `/scan/[id]` route automatically redirects to the washroom cleaning form
- The in-app QR scanner also supports the legacy `vibecode://washroom/[id]` format for backwards compatibility

## QR Scan Tracking & Analytics

The app tracks every QR code scan to provide analytics for business owners:

### How It Works
- When a public user visits a washroom status page (via QR scan), the `trackQrScan()` function is called
- Scans are stored in the `qr_scan_stats` table with a counter-based system (one row per location per day)
- Admin views do NOT count as scans (prevents inflated statistics)

### Admin Dashboard Analytics
The admin dashboard displays:
- **Scans Today**: Total QR scans across all businesses for the current day
- **Last 7 Days**: Rolling 7-day scan total
- **Per-Business Breakdown**: Each business card shows today/7-day/30-day scan counts

### Business Detail Page Analytics
When viewing a specific business:
- **Scans Today**: QR scans for this business today
- **Scans (30 days)**: Total scans for the past 30 days
- **Per-Location Scans**: Each washroom location shows its individual scan count

### PIN Display
- **Universal Business PIN**: If set, displayed prominently in a yellow box for managers to share with staff
- **Global PIN Management**: Admin Dashboard shows the current PIN for all locations and provides an "Update PIN for All Locations" button to change the PIN for every washroom simultaneously
- **Auto-Inherited PIN**: When a new washroom is created, it automatically inherits the business's universal PIN (or the first washroom's PIN if no universal PIN is set)
- PINs are stored hashed for security, with a separate `pin_display` column for showing to authorized managers

### Admin Dashboard Features
- **Password/PIN Display**: The business password is displayed next to the email in the Business Info section for quick reference
- **Update PIN for All Locations**: A single button to update the staff PIN across all washroom locations for the business
- **Real-Time Updates**: Dashboard auto-refreshes every 30 seconds, with pull-to-refresh support
- **Today's Activity**: Accurate timezone-aware counting of today's cleaning logs
- **Open Issues Count**: Updates immediately when new issues are reported or resolved

## Data Storage

Data is persisted using **Supabase** cloud database. The app uses two tables:

### cleaning_logs table
- `id` - Unique identifier
- `location_id` - Reference to the location
- `location_name` - Name of the location
- `staff_name` - Name of the staff member
- `timestamp` - When the cleaning was logged
- `status` - 'complete' or 'attention_required'
- `notes` - Maintenance notes (required when status is attention_required)
- `checklist_handwashing_station` - Handwashing station status
- `checklist_toilet_paper` - Toilet paper status
- `checklist_bins` - Bins status
- `checklist_surfaces_disinfected` - Surfaces disinfected status
- `checklist_fixtures` - Fixtures status
- `checklist_water_temperature` - Water temperature status
- `checklist_floors` - Floors status
- `checklist_ventilation_lighting` - Ventilation & lighting status
- `resolved` - Whether the issue has been resolved
- `resolved_at` - When the issue was resolved
- `created_at` - Record creation timestamp

### locations table
- `id` - Unique identifier (same as local store ID)
- `name` - Location name
- `supervisor_email` - Email address for alerts
- `pin_code` - 4-5 digit PIN for staff access (stored as plain text for verification)
- `created_at` - Record creation timestamp

### washrooms table
- `id` - Unique identifier
- `business_name` - Name of the business
- `room_name` - Name of the washroom location
- `last_cleaned` - Timestamp of last cleaning
- `pin_code` - 4-5 digit PIN for staff access
- `alert_email` - Email address for alerts (editable from manager dashboard)
- `is_active` - Boolean flag for soft delete (when false, location is hidden from cleaning app)
- `created_at` - Record creation timestamp

### reported_issues table
- `id` - Unique identifier
- `location_id` - Reference to the location
- `location_name` - Name of the location
- `issue_type` - Type of issue (out_of_supplies, needs_cleaning, maintenance_required, safety_concern, other)
- `description` - Comment/description of the issue
- `status` - 'open' or 'resolved'
- `created_at` - When the issue was reported
- `resolved_at` - When the issue was resolved

**Note**: Location settings are stored both locally and in Supabase for redundancy.

### businesses table
- `id` - Unique identifier
- `name` - Business name
- `email` - Business email address (for login)
- `password_hash` - Hashed password for authentication
- `staff_pin_hash` - Hashed universal staff PIN for all washroom locations
- `staff_pin_display` - Plain text PIN for display in manager dashboard
- `is_admin` - Boolean flag for admin access
- `is_active` - Boolean flag to enable/disable business access (when false, business cannot log in but data is preserved)
- `created_at` - Record creation timestamp

### Supabase Setup

The app connects to Supabase at:
- Project URL: `https://duznbqmwcdpqjttdbpug.supabase.co`

You must create the following tables in your Supabase dashboard:

1. **cleaning_logs** table with the columns listed above
2. **locations** table with the columns listed above (id, name, supervisor_email, pin_code, created_at)
3. **reported_issues** table with the columns listed above (id, location_id, location_name, issue_type, description, status, created_at, resolved_at)

## Issue Reporting Workflow

Visitors can report facility issues directly from the public washroom page:

1. **Visitor Reports**: Tap "Report an Issue" on the public page, select issue type, add comment
2. **Supabase Storage**: Issues are stored in the `reported_issues` table with status 'open'
3. **Email Notification**: Supervisor receives an urgent email with a blue "View in Dashboard" button that includes deep linking
4. **Deep Linking**: Email links include the issue ID (e.g., `/manager?issueId=abc123`) to highlight the specific issue
5. **Auth Redirect**: If not logged in, users see a message prompting login, then are redirected to the specific issue after authentication
6. **Manager Dashboard**: Active issues appear in a dedicated section with red border; issues from email links are highlighted in blue
7. **Resolution**: Manager can mark issues as resolved, which updates the status in Supabase

**Issue Types:**
- Out of Supplies *(auto-resolved by complete cleaning)*
- Needs Cleaning *(auto-resolved by complete cleaning)*
- Maintenance Required *(auto-resolved by complete cleaning)*
- Safety Concern *(auto-resolved by complete cleaning)*
- Other *(auto-resolved by complete cleaning)*

### Auto-Resolution of Issues

When a **complete** cleaning log is submitted (all checklist items pass), the system automatically resolves **ALL open issues** for that location. This resets the public status card back to "Clean" with the new cleaning timestamp.

### Public Status Card Sync with Issue Reports

The public washroom status card now syncs with issue reports:
- **Issue Reported**: When a visitor reports an issue AND it was reported after the last cleaning, the status card changes from "Clean" to "Issue / Problème"
- **Clean**: When a staff member submits a complete cleaning log, all open issues are auto-resolved and the status resets to "Clean"
- **Most Recent Event**: The status always displays the most recent event - whether that's a successful cleaning or a reported issue

This ensures:
1. Public visitors see when there's a known issue being addressed
2. Staff cleanings immediately reset the status to "Clean"
3. No manual intervention required to sync status between issues and cleanings

## WorkSafeNB Compliance

The Manager Dashboard allows owners to export 6-month cleaning history as CSV files containing:
- Date/Time of each cleaning
- Staff name
- All checklist item results (Yes/No)
- Cleaning status
- Any maintenance notes

## Inspector Mode (PDF Audit Reports)

The Manager Dashboard includes an **Inspector Mode** for generating professional PDF audit reports:

1. Open Inspector Mode from the Manager Dashboard
2. Enter your business name
3. Select a date range (Start Date and End Date)
4. Tap "Generate Audit Report (PDF)"
5. The PDF will be generated and can be shared/emailed directly to WorkSafeNB officers

**PDF Report Features (Unified Template):**
- **Unified Header**: Acadia CleanIQ logo on top left, Client Logo placeholder on top right
- **Document Title**: "Official Compliance Audit" or "Cleaning History Report"
- **Location/Business Info**: Business name and location displayed prominently
- **Date Range**: Human-readable format (e.g., "January 1, 2026 – January 28, 2026")
- **Dark Emerald Header Bar**: Column titles (HS, TP, BN, etc.) centered over checkmarks
- **Emerald Zebra Striping**: Alternating rows use Emerald-50 mint background for readability
- **Standardized Status Labels**:
  - "Complete" (Green) - All checklist items passed
  - "Incomplete" (Red) - One or more items unchecked
  - "Attention Required" (Yellow) - Needs manager review
- **Montserrat Font**: Clean sans-serif font throughout
- **Footer**: Legend and "Generated on [date]" moved to a clean footer section
- **Checklist Legend**: HS, TP, BN, SD, FX, WT, FL, VL abbreviations with bilingual descriptions
- **Web Toolbar**: Close/Print buttons for viewing PDF in browser
- **Mobile Share**: Native sharing on iOS/Android

## Testing Email Alerts

Email alerts are sent automatically when staff submit cleaning logs with "Attention Required" status or when visitors report issues. Alerts are sent to the configured supervisor email for each location.

**Auto-Resolve Feature:** When a cleaner comes back and logs a "Complete" cleaning, any previous "Attention Required" entries for that location are automatically marked as resolved. This eliminates the need for supervisors to manually resolve issues - the next cleaning naturally resolves them.

### Email Alert Troubleshooting

If email alerts are not being sent, check the following:

1. **Vercel Environment Variables**: In your Vercel project settings, ensure these are configured:
   - `API_SECRET` - Must match `EXPO_PUBLIC_API_SECRET` in `.env` EXACTLY
   - `RESEND_API_KEY` - Your Resend API key for sending emails

2. **Check Vercel Logs**: If you see 401 errors on `/api/send-email`, the `API_SECRET` doesn't match between client and server

3. **Check Browser Console**: Open developer tools (F12) and look for `[Email]` or `[Issue]` log messages when submitting an issue

4. **Alert Email Configuration**: Make sure the alert email is set in the Location Settings (visible on the screenshot with "Alert Email" field)

## System Readiness (v1.0 - Soft Launch Ready)

All critical flows verified:
- Report Issue form saves to Supabase AND triggers email notifications (email is non-blocking)
- Attention Required entries auto-resolve when next complete cleaning is logged
- Open Issues from public reports appear in Manager Dashboard with "Mark Resolved" button
- Manager authentication persists across app restarts (Zustand + AsyncStorage)
- All screens have proper empty state messages
- All screens have back/home navigation buttons

## Offline Capability

The app supports **offline cleaning log submission** for environments with unreliable internet (e.g., basements, areas with poor connectivity):

### How It Works

1. **Network Detection**: The app monitors network connectivity in real-time
2. **Offline Queue**: When offline, cleaning logs are saved to a local queue (persisted in AsyncStorage)
3. **Auto-Sync**: When connectivity returns, queued logs automatically sync to Supabase
4. **Visual Feedback**:
   - Yellow banner shows "Offline Mode - Logs will sync when connected"
   - Success message shows "Saved Offline - Will Sync" instead of "Log Saved!"
   - Pending sync indicator shows number of logs waiting to sync

### Technical Details

- **Offline Queue Store**: `src/lib/offline-queue.ts` - Zustand store with AsyncStorage persistence
- **Network Hook**: `src/lib/useNetworkStatus.ts` - Real-time network status monitoring
- **Auto-Sync Listener**: Starts on app launch, listens for connectivity changes
- **Sync Process**: Logs sync in order (oldest first), with retry tracking for failed attempts

### User Experience

**Staff in basement/offline area:**
1. Complete cleaning checklist as normal
2. Submit log - sees "Saved Offline - Will Sync" message
3. Log is stored locally on device
4. When phone regains connectivity (e.g., walking upstairs), log syncs automatically
5. No data is lost - compliance record is maintained

**Limitations:**
- Initial page load requires internet (to fetch washroom data and recent logs)
- Email alerts are sent only when log syncs to server (may be delayed)
- QR scan tracking only works when online

## Multi-Tenant Manager System

The app now supports a **multi-tenant architecture** where managers can access multiple businesses with role-based permissions.

### Manager Roles

| Role | Description | Permissions |
|------|-------------|-------------|
| **Owner** | Business owner / full admin | All permissions - edit locations, settings, billing, invite users |
| **Supervisor** | Shift supervisor | View dashboard, export reports, resolve issues |
| **Viewer** | Read-only access | View dashboard only, no actions |

### Features

- **One Login, Multiple Businesses**: Managers with access to multiple businesses see a business picker after login
- **Business Switcher**: Managers can switch between businesses from the dashboard header
- **Role-Based UI**: Features are shown/hidden based on the user's role for the current business
- **Team Management**: Owners can invite supervisors and viewers to their business
- **Individual Credentials**: Each user has their own email/password - no password sharing required

### How It Works

1. **Manager logs in** with their email/password
2. **System checks** the `managers` table and `manager_businesses` junction table
3. **If 1 business**: Goes directly to dashboard
4. **If 2+ businesses**: Shows business picker screen
5. **Permissions loaded**: UI adapts based on role (owner/supervisor/viewer)

### Database Tables

**managers** - User accounts
- `id` - Unique identifier
- `email` - Login email (unique)
- `password_hash` - Hashed password
- `name` - Display name
- `is_active` - Account status

**manager_businesses** - Links managers to businesses with roles
- `manager_id` - Reference to manager
- `business_id` - Reference to business
- `role` - 'owner', 'supervisor', or 'viewer'
- `can_edit_locations` - Permission flag
- `can_edit_settings` - Permission flag
- `can_invite_users` - Permission flag
- `can_view_billing` - Permission flag
- `can_export_reports` - Permission flag
- `can_resolve_issues` - Permission flag
- `invited_by` - Who invited this user
- `invited_at` - When they were invited

### Inviting Team Members

Owners can invite supervisors/viewers:
1. Tap the **Team** icon in the dashboard header
2. Tap **Invite Team Member**
3. Enter email and name (optional)
4. Select role (Supervisor or Viewer)
5. Tap **Send Invite**

If the email already has an account, they're added to the business immediately. If not, a new account is created.

### Migration from Legacy System

Existing business owners are automatically migrated:
- First login creates a `managers` record
- Links to their business as `owner`
- All existing functionality continues to work

