import NavBar from "@/components/NavBar";
import AuthForm from "@/components/AuthForm";

export default function LoginPage() {
  return (
    <main className="min-h-screen">
      <NavBar />
      <AuthForm mode="login" />
    </main>
  );
}
