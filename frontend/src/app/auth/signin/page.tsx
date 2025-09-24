"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// This page is deprecated - redirect to homepage
// The homepage now handles both sign-in (when logged out) and dashboard redirect (when logged in)
export default function SignInPage() {
  const router = useRouter();
  
  useEffect(() => {
    router.replace("/");
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-600">Redirecting...</p>
      </div>
    </div>
  );
}