import { SignIn } from "@clerk/nextjs";
import { Suspense } from "react";

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md">
        <Suspense fallback={<div className="text-center p-4">Loading Sign In...</div>}>
          <SignIn routing="path" path="/sign-in" />
        </Suspense>
      </div>
    </div>
  );
}
