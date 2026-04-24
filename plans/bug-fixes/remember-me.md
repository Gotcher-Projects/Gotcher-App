# Remember Me / Persistent Login
**Status:** Complete
**Area:** Auth — LoginPage + AuthController + CookieUtil

## Goal
Add a "Remember me" checkbox to the login form. When checked, the refresh token cookie persists across browser/tab close (30-day `Max-Age`). When unchecked, it remains a session cookie that clears when the browser closes (current behavior).

## How it works
Tokens travel as httpOnly cookies (`credentials: 'include'`). The browser clears session cookies (no `Max-Age`) on close. Setting `Max-Age` makes them persistent. The refresh token TTL in the DB should match the cookie lifetime.

## Affected Files

### Backend — edit
- `Backend/src/main/java/com/gotcherapp/api/auth/AuthController.java` — read `rememberMe` from login request body, pass to `AuthService`
- `Backend/src/main/java/com/gotcherapp/api/auth/AuthService.java` — pass `rememberMe` through to `CookieUtil`
- `Backend/src/main/java/com/gotcherapp/api/auth/dto/LoginRequest.java` — add `boolean rememberMe` field (defaults false)
- `Backend/src/main/java/com/gotcherapp/api/config/CookieUtil.java` — accept `rememberMe` flag; if true set `Max-Age` to 30 days, if false omit `Max-Age` (session cookie)

### Frontend — edit
- `Frontend/src/lib/auth.js` — pass `rememberMe` boolean to login request body
- `Frontend/src/components/LoginPage.jsx` — add "Remember me" checkbox to login form

## Steps

### 1. LoginRequest.java
Add `boolean rememberMe` field (defaults to `false` if absent from JSON).

### 2. CookieUtil
Add `rememberMe` param to the method that builds the refresh cookie:
- `rememberMe=true` → `.maxAge(30 * 24 * 60 * 60)` (30 days in seconds)
- `rememberMe=false` → no `maxAge` call (session cookie, clears on browser close)

Also extend refresh token DB expiry: `rememberMe=true` → 30 days, `false` → 7 days (current).

### 3. AuthService
Thread `rememberMe` from the login call through to `CookieUtil` when building the response cookie.

### 4. AuthController
Read `loginRequest.isRememberMe()` and pass it to `AuthService.login()`.

### 5. auth.js
```js
export async function loginUser(email, password, rememberMe = false) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password, rememberMe }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Login failed');
  return data;
}
```

### 6. LoginPage.jsx
Add a checkbox below the password field in the login tab:
```jsx
<div className="flex items-center gap-2">
  <Checkbox id="rememberMe" checked={rememberMe} onCheckedChange={setRememberMe} />
  <label htmlFor="rememberMe" className="text-sm text-muted-foreground">Remember me</label>
</div>
```
Pass `rememberMe` into the `loginUser()` call.

## Definition of Done
- [ ] "Remember me" checkbox visible on login tab
- [ ] Without checkbox: closing the browser and reopening requires login again
- [ ] With checkbox: closing and reopening restores the session automatically for up to 30 days
- [ ] Explicit logout still clears the session regardless of remember me
