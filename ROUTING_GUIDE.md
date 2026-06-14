# CreativeHUB Routing Guide

## 📍 URL Structure

Your app now uses React Router v7 with proper URL paths. Each page is accessible via its unique URL:

### Authentication Pages
- **`/login`** - Login page (public, visible when not authenticated)
- **`/signup`** - Sign up page (public, visible when not authenticated)

### Protected Pages (Requires Authentication)
- **`/explore`** - Main explore/home page with carousels
- **`/map`** - Map view of freelancers
- **`/freelancers`** - Freelancers portfolio view
- **`/for-you`** - Personalized recommendations
- **`/profile/:id`** - Individual freelancer profile (e.g., `/profile/1`)
- **`/client-profile`** - Your client profile
- **`/requests`** - Incoming requests
- **`/messages`** - Messages/chat
- **`/favorites`** - Favorites list
- **`/my-bookings`** - Your bookings
- **`/booking/:id`** - Booking details (e.g., `/booking/5`)
- **`/freelancer-dashboard`** - Freelancer dashboard
- **`/become-freelancer`** - Freelancer onboarding
- **`/premium`** - Premium subscription

## 🔐 Authentication Flow

1. **Unauthenticated users** → Always redirected to `/login`
2. **Login/Sign up successful** → Redirected to `/explore`
3. **Authenticated users** → Can access protected routes
4. **Logout** → Redirected to `/login`

## 🏗️ Architecture

### Key Components

- **`BrowserRouter`** (in `main.tsx`) - Enables routing
- **`ProtectedRoute`** - Guards pages that require authentication
- **`MainLayout`** - Header + navigation wrapper for authenticated pages
- **`App.tsx`** - Main router configuration

### File Structure

```
src/
├── main.tsx                    # BrowserRouter wrapper
├── app/
│   ├── App.tsx               # Route definitions
│   ├── components/           # Page components
│   └── pages/
│       ├── ExplorePage.tsx
│       ├── LoginPageWithRouting.tsx
│       └── SignUpPageWithRouting.tsx
├── components/
│   ├── ProtectedRoute.tsx     # Auth guard
│   └── MainLayout.tsx         # Header/nav layout
└── contexts/
    └── AuthContext.tsx       # Auth state & methods
```

## ✨ How to Use

### Navigate Between Pages

```tsx
// In any component with useNavigate
import { useNavigate } from 'react-router';

function MyComponent() {
  const navigate = useNavigate();
  
  // Navigate to explore
  navigate('/explore');
  
  // Navigate to profile with ID
  navigate(`/profile/${userId}`);
  
  // Navigate back
  navigate(-1);
}
```

### Add New Routes

Edit `src/app/App.tsx` and add a new Route:

```tsx
<Route
  path="/my-new-page"
  element={
    <ProtectedRoute>
      <MainLayout>
        <MyNewPage />
      </MainLayout>
    </ProtectedRoute>
  }
/>
```

### Create New Page

1. Create `src/app/pages/MyNewPage.tsx`
2. Import and use in App.tsx routes

## 🎯 Current Status

✅ Router enabled with proper URL paths
✅ Authentication guard on protected routes
✅ Auto-redirect to `/login` for unauthenticated users
✅ Auto-redirect to `/explore` after successful login/signup
✅ Header navigation with links to all main pages
✅ Browser back/forward buttons work correctly

## 🚀 Testing

1. Open `http://localhost:5175/` - should redirect to `/login`
2. Click "Sign up free" - should navigate to `/signup`
3. After login - should navigate to `/explore`
4. Click navigation items - URLs should update
5. Share URL (e.g., `/explore`) - page loads directly
