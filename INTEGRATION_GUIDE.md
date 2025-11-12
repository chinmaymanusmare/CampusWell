# CampusWell - Frontend-Backend Integration Guide

## What Was Done

### 1. **Installed Dependencies**
- `ejs` - Template engine for server-side rendering
- `cookie-parser` - For handling authentication cookies

### 2. **Backend Configuration (`backend/src/app.js`)**
- Added EJS as the view engine
- Configured static file serving for CSS, images, and public assets
- Added CORS middleware for cross-origin requests
- Added cookie-parser middleware for cookie-based authentication
- Set up view directory to point to `frontend/views`

### 3. **Created Frontend Routes (`backend/src/routes/frontendRoutes.js`)**
Routes for serving EJS templates:
- `/` - Home page
- `/login` - Login page
- `/signup` - Signup page
- `/users/:id` - User dashboard (role-based: student/doctor/admin/pharmacy)
- `/users/:id/appointments` - Book appointments (student)
- `/users/:id/orders` - Order medicines (student)
- `/referrals/:id/request` - Request referral (student)
- `/concerns/:id` - Anonymous concerns (student)
- `/records/prescriptions/:id` - View prescriptions (student)
- `/appointments/doctor/:id` - View appointments (doctor)
- `/referrals/doctor/:id` - Approve referrals (doctor)
- `/concerns/doctor/:id` - Respond to concerns (doctor)
- `/records/:id/edit` - Update prescriptions (doctor)
- `/pharmacy/orders/:id` - View orders (pharmacy)
- `/pharmacy/stocks/:id` - Update stocks (pharmacy)

### 4. **Web Authentication (`backend/src/controllers/webAuthController.js`)**
- Created web-based login/signup handlers
- Uses JWT tokens stored in HTTP-only cookies
- Redirects to appropriate dashboards after successful authentication
- Supports logout with cookie clearing

### 5. **Updated Authentication Middleware (`backend/src/middleware/auth.js`)**
- Now checks both Authorization headers (for API) and cookies (for web)
- Redirects to login page for unauthenticated web requests
- Returns JSON errors for unauthenticated API requests

### 6. **Created Frontend Assets**
- `/frontend/css/style.css` - Global styles
- `/frontend/images/LOGO.png` - Placeholder logo (SVG)
- Directory structure for additional assets

### 7. **Updated Routes in `app.js`**
- Web routes: `/login`, `/signup`, `/logout` (POST/GET for forms)
- API routes: `/api/login`, `/api/signup`, `/api/logout` (JSON responses)

## Running the Application

### Start the Server
```bash
npm start
```

The server will start on `http://localhost:3000`

### Access the Application
- **Home Page**: http://localhost:3000
- **Login**: http://localhost:3000/login
- **Signup**: http://localhost:3000/signup
- **API Docs**: http://localhost:3000/api-docs

## Authentication Flow

### Web-Based (Forms)
1. User submits login/signup form
2. Server validates credentials
3. JWT token created and stored in HTTP-only cookie
4. User redirected to their role-based dashboard
5. All subsequent requests use cookie authentication

### API-Based (JSON)
1. Client sends POST to `/api/login` or `/api/signup`
2. Server returns JSON with JWT token
3. Client includes token in Authorization header: `Bearer <token>`
4. Used for mobile apps or external integrations

## Folder Structure

```
campuswell/
├── backend/
│   ├── src/
│   │   ├── app.js (main Express app)
│   │   ├── server.js (starts server)
│   │   ├── controllers/
│   │   │   ├── userController.js (API)
│   │   │   └── webAuthController.js (Web)
│   │   ├── middleware/
│   │   │   └── auth.js (JWT verification)
│   │   └── routes/
│   │       ├── frontendRoutes.js (EJS pages)
│   │       └── [other API routes]
│   └── ...
├── frontend/
│   ├── views/ (EJS templates)
│   ├── css/ (stylesheets)
│   ├── images/ (images, logos)
│   └── public/ (other static files)
└── package.json
```

## Testing Checklist

✅ Home page loads at http://localhost:3000
✅ Login page accessible at /login
✅ Signup page accessible at /signup
✅ Static CSS and images are served correctly
✅ Server running without errors
✅ Database connection established

## Next Steps

1. **Add Real Logo**: Replace `/frontend/images/LOGO.png` with actual logo
2. **Add Banner Image**: Add `/frontend/images/IIT DHARWAD.jpg` for home page
3. **Test Login Flow**: 
   - Create a test user via signup
   - Login and verify dashboard loads
   - Check cookie is set in browser
4. **Test Form Submissions**: 
   - Book appointments
   - Order medicines
   - Submit concerns
5. **Styling**: Customize CSS as needed
6. **Error Handling**: Add better error messages and validation

## Environment Variables

Ensure `.env` file contains:
```properties
DB_NAME=campuswell_db
DB_USER=postgres
DB_PASS=admin123
DB_HOST=localhost
DB_PORT=5432
PORT=3000
JWT_SECRET=supersecretkey123
```

## Troubleshooting

### Pages Not Loading
- Check server is running: `npm start`
- Verify EJS views are in `frontend/views/`
- Check console for errors

### Authentication Issues
- Verify JWT_SECRET in `.env`
- Clear browser cookies
- Check token expiration (24h for web, 10m for API)

### Static Files Not Loading
- Verify paths in EJS templates start with `/`
- Check `frontend/css/` and `frontend/images/` exist
- Restart server after adding new static files

## API vs Web Routes

### Web Routes (Redirect-based)
- POST `/login` - Web login (redirects to dashboard)
- POST `/signup` - Web signup (redirects to dashboard)
- GET `/logout` - Web logout (redirects to home)

### API Routes (JSON-based)
- POST `/api/login` - API login (returns token)
- POST `/api/signup` - API signup (returns token)
- POST `/api/logout` - API logout (clears cookie)

---

**Server Status**: ✅ Running on http://localhost:3000
**Database**: ✅ Connected to PostgreSQL
**Frontend**: ✅ Integrated with Backend
