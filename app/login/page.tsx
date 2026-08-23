import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return <Suspense fallback={<main className="auth-page" />}><LoginForm /></Suspense>;
}
