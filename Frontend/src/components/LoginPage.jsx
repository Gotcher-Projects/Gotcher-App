import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { loginUser, registerUser, saveSession } from "@/lib/auth";

export default function LoginPage({ onLogin, verifiedBanner, onDismissBanner }) {
  const [tab, setTab]         = useState("login");
  const [email, setEmail]     = useState("");
  const [password, setPass]   = useState("");
  const [name, setName]       = useState("");
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);

  function reset() {
    setError("");
    setEmail("");
    setPass("");
    setName("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      let data;
      if (tab === "login") {
        data = await loginUser(email, password);
      } else {
        data = await registerUser(email, password, name);
      }
      saveSession(data.user);
      onLogin(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-sky-50 to-emerald-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Email verified banner */}
        {verifiedBanner === 'success' && (
          <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex justify-between items-center">
            <span>Your email has been verified!</span>
            <button onClick={onDismissBanner} className="ml-3 text-emerald-600 hover:text-emerald-800">✕</button>
          </div>
        )}
        {verifiedBanner === 'error' && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm flex justify-between items-center">
            <span>Verification link is invalid or expired. Please request a new one.</span>
            <button onClick={onDismissBanner} className="ml-3 text-red-600 hover:text-red-800">✕</button>
          </div>
        )}

        {/* Logo / header */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">👶</div>
          <h1 className="text-3xl font-bold text-fuchsia-700">Baby Steps</h1>
          <p className="text-slate-500 mt-1">Track every milestone, cherish every moment.</p>
        </div>

        <Card className="shadow-lg border-0 bg-white/80 backdrop-blur">
          <CardHeader className="pb-2">
            <CardTitle className="text-xl text-center text-slate-700">Welcome</CardTitle>
            <CardDescription className="text-center">
              {tab === "login" ? "Sign in to your account" : "Create a free account"}
            </CardDescription>
          </CardHeader>

          <CardContent>
            <Tabs value={tab} onValueChange={(v) => { setTab(v); reset(); }}>
              <TabsList className="grid grid-cols-2 mb-6">
                <TabsTrigger value="login">Sign In</TabsTrigger>
                <TabsTrigger value="register">Sign Up</TabsTrigger>
              </TabsList>

              {/* ── Login ── */}
              <TabsContent value="login">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-1">
                    <Label htmlFor="login-email">Email</Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="login-password">Password</Label>
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPass(e.target.value)}
                      required
                    />
                  </div>
                  {error && (
                    <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                      {error}
                    </p>
                  )}
                  <Button
                    type="submit"
                    className="w-full bg-fuchsia-600 hover:bg-fuchsia-700 text-white"
                    disabled={loading}
                  >
                    {loading ? "Signing in…" : "Sign In"}
                  </Button>
                </form>
              </TabsContent>

              {/* ── Register ── */}
              <TabsContent value="register">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-1">
                    <Label htmlFor="reg-name">Display Name <span className="text-slate-400 font-normal">(optional)</span></Label>
                    <Input
                      id="reg-name"
                      type="text"
                      placeholder="e.g. Sarah"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="reg-email">Email</Label>
                    <Input
                      id="reg-email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="reg-password">Password</Label>
                    <Input
                      id="reg-password"
                      type="password"
                      placeholder="At least 8 characters"
                      value={password}
                      onChange={(e) => setPass(e.target.value)}
                      required
                    />
                  </div>
                  {error && (
                    <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                      {error}
                    </p>
                  )}
                  <Button
                    type="submit"
                    className="w-full bg-fuchsia-600 hover:bg-fuchsia-700 text-white"
                    disabled={loading}
                  >
                    {loading ? "Creating account…" : "Create Account"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
