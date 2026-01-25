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
- **Alert Email Persistence**: The alert email entered during location creation is saved to Supabase and pre-filled when viewing location settings
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
- **Email Alerts**: Automated server-side email alerts via Resend API when a cleaning requires attention. Emails are sent to the supervisor email (or default: sportsfansummer@hotmail.com) with a professionally formatted HTML template.
- **Manager Resolution**: Managers can mark "Attention Required" entries as resolved, which removes the yellow warning from the public badge while keeping the note for audit purposes
- **Compliance Record**: Displays the 2 most recent cleaning entries with date, time, staff name, and status
- **Password-Protected Access**: Manager Dashboard requires password authentication from the main page
- **NEW Washroom Badge**: New washrooms without any cleaning logs are highlighted with a blue "NEW" badge and "NEEDS QR CODE" status to remind admins to generate QR codes.
- **Admin Email Notifications**: When a manager adds a new washroom, the admin (chris@acadiacleaniq.ca) receives an email notification with washroom details and a reminder to generate QR codes.
- **Export History (PDF)**: Managers can export cleaning history for any location with custom date range selection (7, 14, 30, or 90 days, or custom dates)
- **Send to Inspector**: Generate professional audit reports for NB Department of Health compliance with custom date ranges

## Subscription Tiers (Future)

The database supports subscription tiers for future premium features. Currently all features are available to all users.

### Admin Management
- Admins can toggle subscription tier (Standard/Premium) for each business from the Admin Dashboard
- The `subscription_tier` column exists in the database for future feature gating
- Future premium features may include: photo attachments, automated reminders, supply tracking, analytics dashboard

## Security

- **Universal Staff PIN**: Each business can set a single staff PIN that works for all their washroom locations. This simplifies PIN management when cleaning staff work across multiple locations.
- **PIN-Protected Cleaning Forms**: Each location requires a PIN to submit cleaning logs, preventing unauthorized submissions from people who guess URLs. The system first checks the universal business PIN, then falls back to the individual washroom PIN.
- **PIN Verification**: PINs are stored hashed in Supabase and verified against the database
- **PIN Management for Managers**: Managers can view and change the universal staff PIN directly from their dashboard
- **PIN Display for Managers**: The Manager Dashboard displays the plain PIN so managers can share it with authorized staff
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
- Maintenance Required *(requires manual resolution)*
- Safety Concern *(requires manual resolution)*
- Other *(requires manual resolution)*

### Auto-Resolution of Issues

When a **complete** cleaning log is submitted (all checklist items pass), the system automatically resolves:
- **"Out of Supplies"** issues - because supplies were restocked during cleaning
- **"Needs Cleaning"** issues - because the washroom was just cleaned

Issues that are **NOT auto-resolved** (require manager action):
- **"Maintenance Required"** - e.g., broken toilet, leaky faucet
- **"Safety Concern"** - e.g., ceiling damage, exposed wiring
- **"Other"** - unknown issues that need review

This reduces manual work for managers while ensuring maintenance/safety issues are properly tracked until fixed.

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

**PDF Report Features:**
- Professional header with business name and audit period
- Summary statistics: Total Logs, Complete, Attention Required, Compliance Rate
- Detailed table with fixed column widths to prevent text cut-off
- Checklist legend with abbreviations (HS, TP, BN, SD, FX, WT, FL, VL)
- Color-coded status badges (Green: Complete, Yellow: Attention Required)
- Page padding and proper formatting for print
- Data fully loaded before PDF generation to prevent export errors
- Footer with generation timestamp
- Formatted for landscape letter size paper

## Testing Email Alerts

Email alerts are sent automatically when staff submit cleaning logs with "Attention Required" status or when visitors report issues. Alerts are sent to the configured supervisor email for each location.

**Auto-Resolve Feature:** When a cleaner comes back and logs a "Complete" cleaning, any previous "Attention Required" entries for that location are automatically marked as resolved. This eliminates the need for supervisors to manually resolve issues - the next cleaning naturally resolves them.

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
