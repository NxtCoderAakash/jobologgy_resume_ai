import NavBar from "@/components/NavBar";
import AuthForm from "@/components/AuthForm";

export default function SignupPage() {
  return (
    <main className="min-h-screen">
      <NavBar />
      <AuthForm mode="signup" />
    </main>
  );
}
