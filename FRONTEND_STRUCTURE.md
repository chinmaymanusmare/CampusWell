# Frontend Structure Documentation

## Overview

The CampusWell frontend is built using **EJS (Embedded JavaScript)** templates served by Express. The views are organized into role-based folders with reusable partials for consistent UI across the application.

## Directory Structure

```
frontend/
├── views/
│   ├── partials/           # Reusable components
│   │   ├── header.ejs      # Common header with logo and navigation
│   │   └── footer.ejs      # Common footer with copyright
│   ├── shared/             # Shared pages
│   │   └── home.ejs        # Landing page template
│   ├── auth/               # Authentication pages
│   │   ├── login.ejs       # User login form
│   │   └── signup.ejs      # User registration form
│   ├── student/            # Student role pages
│   │   ├── dashboard.ejs
│   │   ├── book_appointment.ejs
│   │   ├── order_medicine.ejs
│   │   ├── request_referral.ejs
│   │   ├── anonymous_concern.ejs
│   │   └── my_prescriptions.ejs
│   ├── doctor/             # Doctor role pages
│   │   ├── dashboard.ejs
│   │   ├── view_appointments.ejs
│   │   ├── approve_referrals.ejs
│   │   ├── respond_to_concern.ejs
│   │   └── update_prescription.ejs
│   ├── pharmacy/           # Pharmacy role pages
│   │   ├── dashboard.ejs
│   │   ├── view_orders.ejs
│   │   └── update_stocks.ejs
│   ├── admin/              # Admin role pages
│   │   └── dashboard.ejs
│   └── home.ejs            # Root page (includes shared/home)
├── css/
│   └── style.css           # Global styles
├── images/
│   ├── LOGO.png
│   └── IIT DHARWAD.jpg
└── public/                 # Other static assets
```

## Partials

### header.ejs
Reusable header component with:
- Campus Wellness logo and branding
- Navigation buttons (customizable via `navHtml` parameter)

**Usage:**
```ejs
<%- include('partials/header', { 
  navHtml: '<a href="/logout" class="btn">LOG OUT</a>' 
}) %>
```

### footer.ejs
Standard footer with copyright information.

**Usage:**
```ejs
<%- include('partials/footer') %>
```

## Route-to-View Mapping

### Public Routes
| Route | View | Description |
|-------|------|-------------|
| `GET /` | `home.ejs` | Landing page |
| `GET /login` | `auth/login.ejs` | Login form |
| `GET /signup` | `auth/signup.ejs` | Registration form |
| `POST /login` | Web auth handler | Processes login, sets cookie |
| `POST /signup` | Web auth handler | Creates user, sets cookie |
| `GET /logout` | Web auth handler | Clears cookie, redirects home |

### Student Routes (Protected)
| Route | View | Description |
|-------|------|-------------|
| `GET /users/:id` | `student/dashboard.ejs` | Student dashboard |
| `GET /users/:id/appointments` | `student/book_appointment.ejs` | Book doctor appointment |
| `GET /users/:id/orders` | `student/order_medicine.ejs` | Order medicines |
| `GET /referrals/:id/request` | `student/request_referral.ejs` | Request specialist referral |
| `GET /concerns/:id` | `student/anonymous_concern.ejs` | View/submit concerns |
| `GET /records/prescriptions/:id` | `student/my_prescriptions.ejs` | View prescription history |

### Doctor Routes (Protected)
| Route | View | Description |
|-------|------|-------------|
| `GET /users/:id` | `doctor/dashboard.ejs` | Doctor dashboard |
| `GET /appointments/doctor/:id` | `doctor/view_appointments.ejs` | View scheduled appointments |
| `GET /referrals/doctor/:id` | `doctor/approve_referrals.ejs` | Approve/reject referrals |
| `GET /concerns/doctor/:id` | `doctor/respond_to_concern.ejs` | Respond to student concerns |
| `GET /records/:id/edit` | `doctor/update_prescription.ejs` | Add prescription records |

### Pharmacy Routes (Protected)
| Route | View | Description |
|-------|------|-------------|
| `GET /users/:id` | `pharmacy/dashboard.ejs` | Pharmacy dashboard |
| `GET /pharmacy/orders/:id` | `pharmacy/view_orders.ejs` | View medicine orders |
| `GET /pharmacy/stocks/:id` | `pharmacy/update_stocks.ejs` | Update medicine inventory |

### Admin Routes (Protected)
| Route | View | Description |
|-------|------|-------------|
| `GET /users/:id` | `admin/dashboard.ejs` | Admin dashboard |

## Authentication Flow

### Web Authentication
1. User submits login/signup form
2. Backend validates credentials
3. JWT token generated and stored in HTTP-only cookie
4. User redirected to role-specific dashboard (`/users/:id`)
5. Protected routes verify JWT from cookie via `auth` middleware
6. Unauthorized HTML requests redirect to `/login`

### Cookie Configuration
```javascript
{
  httpOnly: true,           // Prevents XSS attacks
  maxAge: 24 * 60 * 60 * 1000,  // 24 hours
  sameSite: 'lax'          // CSRF protection
}
```

## Styling Approach

### Global Styles (`/css/style.css`)
- Common layout styles (header, footer, main content)
- Button classes (`.btn`, `.btn-secondary`)
- Typography and color scheme

### Page-Specific Styles
- Scoped `<style>` blocks within each EJS template
- Form layouts (`.form-container`, `.form-group`)
- Card layouts (`.card`, `.card-item`)
- Responsive breakpoints

### Design Principles
- Clean, minimal design with focus on readability
- Consistent spacing and alignment
- Grey backgrounds (`#f0f0f0`) for cards/forms
- Blue primary color (`#0d6efd`) for actions
- Mobile-responsive layouts

## Data Flow

### Server-Side Rendering
Each route handler:
1. Authenticates user (if protected)
2. Fetches required data from database
3. Passes data to EJS template via `res.render()`
4. EJS processes template with data
5. Sends complete HTML to client

### Example: Book Appointment
```javascript
router.get('/users/:id/appointments', auth, async (req, res) => {
  const userId = req.params.id;
  const doctors = await pool.query("SELECT * FROM users WHERE role = 'doctor'");
  const timeSlots = generateTimeSlots();
  
  res.render('student/book_appointment', { 
    userid: userId,
    doctors: doctors.rows,
    timeSlots: timeSlots
  });
});
```

### Template Usage
```ejs
<select name="doctor">
  <% doctors.forEach(doctor => { %>
    <option value="<%= doctor.id %>">
      <%= doctor.name %> (<%= doctor.specialization %>)
    </option>
  <% }) %>
</select>
```

## Form Submissions

### Pattern
1. User submits form (POST request)
2. Backend validates and processes data
3. Success: redirect to appropriate page
4. Error: render form again with error message

### Error Handling
Templates support optional `error` and `success` variables:
```ejs
<% if (error) { %>
  <p class="message message-error"><%= error %></p>
<% } %>
```

## Migration Notes

### Old vs New Structure
**Before:**
- Flat structure with all views in `frontend/views/`
- Duplicate header/footer HTML in each file
- Mixed concerns and verbose comments

**After:**
- Role-based folders (`student/`, `doctor/`, `pharmacy/`)
- Shared partials with parameterized navigation
- Clean, minimal comments
- Consistent styling patterns

### Breaking Changes
If you have old links or route references:
- Update `res.render()` calls to new paths (e.g., `'student/dashboard'`)
- Old flat filenames removed (e.g., `student_dashboard.ejs` → `student/dashboard.ejs`)

## Development Guidelines

### Adding a New Page
1. Create EJS file in appropriate role folder
2. Include header and footer partials
3. Add scoped styles in `<style>` block
4. Use data passed from route handler
5. Add route in `backend/src/routes/frontendRoutes.js`
6. Protect route with `auth` middleware if needed

### Example Template
```ejs
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>Page Title</title>
  <link rel="stylesheet" href="/css/style.css" />
  <style>
    /* Page-specific styles */
  </style>
</head>
<body>
  <%- include('partials/header', { 
    navHtml: '<a href="/logout" class="btn">LOG OUT</a>' 
  }) %>
  
  <main class="main-content">
    <!-- Page content -->
  </main>
  
  <%- include('partials/footer') %>
</body>
</html>
```

## Testing

### Manual Testing
1. Start server: `npm start`
2. Navigate to `http://localhost:3000`
3. Test public pages (home, login, signup)
4. Sign up as different roles
5. Verify role-specific dashboards and features

### Automated Testing
Run integration tests that verify:
- Route accessibility (public vs protected)
- Cookie-based authentication
- Data rendering in templates
- Form submissions

```bash
npm test:integration
```

## Troubleshooting

### Common Issues

**500 Error on page load**
- Check EJS syntax (missing closing tags, undefined variables)
- Verify partial paths are correct
- Ensure data is passed from route handler

**Styles not loading**
- Verify static file paths in `app.js`
- Check CSS file exists at `/frontend/css/style.css`
- Clear browser cache

**Authentication redirect loop**
- Check JWT secret is set in `.env`
- Verify cookie is being set correctly
- Ensure `auth` middleware is applied to protected routes

**Data not displaying**
- Confirm database query returns data
- Check variable names match between route and template
- Use `<%= JSON.stringify(variableName) %>` to debug

## Best Practices

1. **Security**
   - Always use HTTP-only cookies for authentication
   - Never expose sensitive data in client-side JavaScript
   - Validate and sanitize all form inputs server-side

2. **Performance**
   - Minimize database queries per request
   - Use connection pooling
   - Implement pagination for large lists

3. **Maintainability**
   - Keep templates focused on presentation
   - Move business logic to controllers
   - Use partials for repeated UI elements
   - Document complex EJS logic with comments

4. **Accessibility**
   - Use semantic HTML elements
   - Provide alt text for images
   - Ensure forms have proper labels
   - Test with keyboard navigation

## Future Enhancements

- [ ] Add client-side validation with JavaScript
- [ ] Implement AJAX for dynamic content updates
- [ ] Add loading indicators for async operations
- [ ] Create admin pages for user management
- [ ] Add notification system for appointments/orders
- [ ] Implement search and filter functionality
- [ ] Add data export features (PDF prescriptions, CSV reports)

---

**Last Updated:** November 11, 2025  
**Maintained by:** CampusWell Development Team
